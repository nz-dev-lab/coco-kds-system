import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import fs from 'fs';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import { autoUpdater } from 'electron-updater';
import path from 'path';
import {
  addCompletedOrder,
  getDailyStats,
  getOrdersByDate,
  getRevenueTrend,
  cleanupOldOrders,
  closeDatabase,
  statements,
  getAllCanonicalItems,
  addCanonicalItem,
  updateCanonicalItem,
  deleteCanonicalItem,
  addCocoeatsMap,
  removeCocoeatsMap,
  addTmbillMap,
  removeTmbillMap,
  setCanonicalStation,
} from './database';
import { TMBillPlugin } from './plugins/tmbill';
import { readAppConfig, writeAppConfig } from './appConfig';
import { buildEscPosReceipt, sendToTcpPrinter, parsePrinterAddress } from './escpos';
import { startKdsServer, broadcastOrders, getClientCount, stopKdsServer, getLocalIpAddresses, scanForKdsServer } from './kds-server';


let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';
let tmbillPlugin: TMBillPlugin | null = null;
// Worker runs as a plain Node.js child process (ELECTRON_RUN_AS_NODE=1) to avoid
// utilityProcess Win32 sandbox restrictions that crash @roamhq/wrtc ICE gathering.
let intercomWorker: ChildProcess | null = null;
let intercomReady = false;

// ── Circular log buffer — last 150 lines from worker stdout/stderr ────────────
const INTERCOM_LOG_MAX = 150;
const intercomLogs: string[] = [];
function pushIntercomLog(line: string) {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  intercomLogs.push(`[${ts}] ${line}`);
  if (intercomLogs.length > INTERCOM_LOG_MAX) intercomLogs.shift();
}

function startIntercomWorker(): void {
  intercomLogs.length = 0; // clear on each (re)start
  const workerPath = path.join(__dirname, 'intercom-worker.js');
  // In packaged app the worker must come from app.asar.unpacked (not inside asar)
  // so the OS can load it as a plain Node.js script with full Win32 network access.
  const unpackedWorkerPath = workerPath.includes('app.asar')
    ? workerPath.replace('app.asar', 'app.asar.unpacked')
    : workerPath;
  const worker = spawn(process.execPath, [unpackedWorkerPath], {
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    cwd: path.join(app.getAppPath(), '..'),
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      // Point NODE_PATH to asar node_modules so worker can resolve tailcom-client etc.
      NODE_PATH: path.join(app.getAppPath(), 'node_modules'),
      TAILCOM_AUTO_ACCEPT: process.env.TAILCOM_AUTO_ACCEPT,
    },
  });
  worker.stdout?.on('data', (d: Buffer) => {
    const lines = d.toString().trimEnd().split('\n');
    for (const line of lines) {
      const msg = line.trimEnd();
      if (!msg) continue;
      console.log('[intercom]', msg);
      pushIntercomLog(msg);
      if (msg.includes('listening on port')) intercomReady = true;
      if (msg.includes('incoming-call')) mainWindow?.webContents.send('intercom:incoming-call');
      if (msg.includes('call started'))  mainWindow?.webContents.send('intercom:call-started');
      if (msg.includes('call ended'))    mainWindow?.webContents.send('intercom:call-ended');
    }
  });
  worker.stderr?.on('data', (d: Buffer) => {
    const lines = d.toString().trimEnd().split('\n');
    for (const line of lines) {
      const msg = line.trimEnd();
      if (!msg) continue;
      console.error('[intercom]', msg);
      pushIntercomLog('ERR ' + msg);
    }
  });
  worker.on('message', (msg: any) => {
    if (msg?.type === 'audio-level') {
      mainWindow?.webContents.send('intercom:audio-level', { channel: msg.channel, rms: msg.rms });
    }
  });

  worker.on('exit', (code: number) => {
    const msg = `🎙️ Intercom worker exited (code ${code})`;
    console.log(msg);
    pushIntercomLog(msg);
    intercomWorker = null;
    intercomReady = false;
  });
  intercomWorker = worker;
  pushIntercomLog('🎙️ Tailcom intercom worker started');
  console.log('🎙️ Tailcom intercom worker started');
}

function stopIntercomWorker(): void {
  if (intercomWorker) {
    intercomWorker.kill();
    intercomWorker = null;
    intercomReady = false;
  }
}

// Configure auto-updater (only in production)
if (!isDev) {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'nz-dev-lab',
    repo: 'coco-kds-releases',
  });

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  app.whenReady().then(() => {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000);
  });

  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 4 * 60 * 60 * 1000);
}

function createWindow() {
  // Read config BEFORE creating the window so the preload inherits the env var
  const appConfig = readAppConfig();
  process.env.TMBILL_ENABLED = appConfig.tmbill_enabled ? 'true' : 'false';
  process.env.TAILCOM_ENABLED = appConfig.tailcom_enabled ? 'true' : 'false';
  process.env.TAILCOM_AUTO_ACCEPT = appConfig.tailcom_auto_accept ? 'true' : 'false';
  console.log('🔧 App config loaded — TMBILL:', appConfig.tmbill_enabled ? 'ENABLED' : 'DISABLED', '| TALECOM:', appConfig.tailcom_enabled ? 'ENABLED' : 'DISABLED', '| AUTO_ACCEPT:', appConfig.tailcom_auto_accept ? 'YES' : 'NO');

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    frame: false,
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    fullscreen: !isDev,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false,
      devTools: isDev,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: 'CocoFlow',
  });

  // Enhanced error logging with correct event signatures
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error('❌ Page failed to load:', errorCode, errorDescription, validatedURL);
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('❌ Renderer process gone!', details.reason, details.exitCode);
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    console.log('🔧 Development mode - Loading from localhost:5173');
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
    console.log('🚀 Production mode');
    console.log('📂 App path:', app.getAppPath());
    console.log('📄 Loading from:', indexPath);

    //open devtools for diagnostics
    // mainWindow.webContents.openDevTools();
    // console.log('🔧 Opening DevTools for diagnostics') ;
    
    mainWindow.loadFile(indexPath)
      .then(() => {
        console.log('✅ Successfully loaded index.html');
        console.log('🔗 Location will be:', `file://${indexPath}`);
      })
      .catch((err) => {
        console.error('❌ Failed to load index.html:', err);
        console.error('📂 Tried path:', indexPath);
      });
    
    // Log when DOM is ready
    mainWindow.webContents.on('dom-ready', () => {
      console.log('✅ DOM is ready');
      
      // Execute some checks in the renderer
      mainWindow?.webContents.executeJavaScript(`
        console.log('🔍 Diagnostic Info:');
        console.log('Location:', window.location.href);
        console.log('Base URI:', document.baseURI);
        console.log('Root element exists:', !!document.getElementById('root'));
        console.log('Scripts loaded:', document.scripts.length);
        console.log('Script sources:', Array.from(document.scripts).map(s => s.src));
      `).catch(err => console.error('Failed to execute diagnostic script:', err));
    });

  //   // Initialize TMBILL plugin
  // const tmbillEnabled = process.env.ENABLE_TMBILL_PLUGIN === 'true';
  
  // if (tmbillEnabled) {
  //   tmbillPlugin = new TMBillPlugin({
  //     enabled: true,
  //     serviceType: process.env.TMBILL_SERVICE_TYPE || '_tmbill._tcp',
  //     autoConnect: process.env.TMBILL_AUTO_CONNECT === 'true',
  //   });
    
  //   tmbillPlugin.initialize(mainWindow);
  // } else {
  //   console.log('⚠️  TMBILL plugin disabled (ENABLE_TMBILL_PLUGIN !== true)');
  // }
    
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  mainWindow.webContents.on('did-finish-load', () => {
    // Guard: did-finish-load fires on every hot reload in dev.
    // IPC handlers must only be registered once per process — re-calling
    // initialize() would throw "second handler for tmbill:*".
    if (appConfig.tmbill_enabled && !tmbillPlugin) {
      tmbillPlugin = new TMBillPlugin({
        enabled: true,
        serviceType: '_http._tcp',
        autoConnect: false,
      });
      tmbillPlugin.initialize(mainWindow!);
      console.log('✅ TMBILL plugin initialized');
    }
  });

  

  if (!isDev && mainWindow) {
    setupAutoUpdater(mainWindow);
  }
}

// Window control IPC handlers
ipcMain.on('window-minimize', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window-close', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('window-fullscreen', () => {
  if (mainWindow) {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  }
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() || false;
});

function setupMaximizeListeners() {
  if (mainWindow) {
    mainWindow.on('maximize', () => {
      mainWindow?.webContents.send('window-maximized', true);
    });

    mainWindow.on('unmaximize', () => {
      mainWindow?.webContents.send('window-maximized', false);
    });
  }
}

function setupAutoUpdater(window: BrowserWindow) {
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('✅ Update available:', info.version);
    // Send to renderer - let user decide
    window.webContents.send('update_available', {
      version: info.version,
      releaseNotes: info.releaseNotes,
      releaseDate: info.releaseDate,
    });
    // ⭐ DON'T auto-download - wait for user to click "Download Now"
    console.log('⏳ Waiting for user action...');
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('✓ App is up to date:', info.version);
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error.message);
    window.webContents.send('update_error', error.message);
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent);
    console.log(`📥 Download progress: ${percent}%`);
    window.webContents.send('update_progress', {
      percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    console.log('🔄 Ready to install - waiting for user...');
    window.webContents.send('update_downloaded', {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });
}

// Allow audio to play without prior user interaction.
// Chromium 73+ silently mutes HTMLAudioElement.play() when the window hasn't
// had a user gesture — play() resolves but no sound comes out. This is wrong
// for a KDS app where notifications fire autonomously.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

app.whenReady().then(() => {
  createWindow();
  setupMaximizeListeners();

  // Start intercom worker only when tailcom is enabled in config
  if (process.env.TAILCOM_ENABLED === 'true') {
    startIntercomWorker();
  } else {
    console.log('🎙️ Tailcom disabled — intercom worker not started');
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupMaximizeListeners();
    }
  });

  const restaurantId = '2';
  const count = statements.getTotalCount.get(restaurantId);
  console.log(`📊 Total orders for restaurant ${restaurantId}:`, count);
});

// ── KDS Server IPC handlers ───────────────────────────────────────────────────

// Renderer calls this when stationView === 'all' to start the mediator server.
// Kitchen PC renderers (stationView !== 'all') never call this, so no server starts.
ipcMain.handle('kds-server:start', () => {
  return startKdsServer(
    (clientCount) => { mainWindow?.webContents.send('kds-server:client-count', clientCount); },
    (msg) => { mainWindow?.webContents.send('kds-server:log', msg); },
  );
});

// Renderer pushes current order state whenever it changes
ipcMain.handle('kds-server:push-orders', (_e, orders: any[]) => {
  broadcastOrders(orders);
});

// Renderer can query how many kitchen screens are connected
ipcMain.handle('kds-server:get-client-count', () => {
  return getClientCount();
});

// Returns non-loopback IPv4 addresses of this machine (shown in Settings on host screen)
ipcMain.handle('kds-server:get-local-ips', () => {
  return getLocalIpAddresses();
});

// Scans the local subnet for a KDS server on port 7654
// Used by kitchen screens to auto-discover the host without manual IP entry
ipcMain.handle('kds-server:scan', async () => {
  return scanForKdsServer();
});

// DATABASE IPC HANDLERS
ipcMain.handle('db:add-completed-order', async (event, order) => {
  try {
    console.log('📦 Storing completed order:', order.id);
    const result = addCompletedOrder(order);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to store order:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get-daily-stats', async (event, date: string, restaurantId: string) => {
  try {
    console.log('📊 Getting daily stats for:', date, restaurantId);
    const result = getDailyStats(date, restaurantId);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to get daily stats:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get-orders-by-date', async (event, date: string, restaurantId: string) => {
  try {
    console.log('📋 Getting orders for date:', date, restaurantId);
    const result = getOrdersByDate(date, restaurantId);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to get orders:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get-revenue-trend', async (event, days: number, restaurantId: string) => {
  try {
    console.log('📈 Getting revenue trend for:', days, 'days', restaurantId);
    const result = getRevenueTrend(days, restaurantId);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to get revenue trend:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:cleanup-old-orders', async (event, days: number, restaurantId: string) => {
  try {
    console.log('🗑️ Cleaning up orders older than:', days, 'days for', restaurantId);
    const result = cleanupOldOrders(days, restaurantId);
    return result;
  } catch (error: any) {
    console.error('❌ Failed to cleanup:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('db:get-total-count', async (event, restaurantId: string) => {
  try {
    const result = statements.getTotalCount.get(restaurantId);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('❌ Failed to get count:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

// INTERCOM IPC HANDLERS
ipcMain.handle('intercom:get-status', () => ({
  enabled: process.env.TAILCOM_ENABLED === 'true',
  running: intercomWorker !== null,
  ready: intercomReady,
  port: 7655,
}));

ipcMain.handle('intercom:get-logs', () => [...intercomLogs]);

ipcMain.handle('intercom:accept-call', () => {
  intercomWorker?.send({ type: 'accept' });
});

ipcMain.handle('intercom:reject-call', () => {
  intercomWorker?.send({ type: 'reject' });
});

// CONFIG IPC HANDLERS
ipcMain.handle('config:get', () => {
  return readAppConfig();
});

ipcMain.handle('config:set', (_event, patch: Partial<{ tmbill_enabled: boolean; tailcom_enabled: boolean; tailcom_auto_accept: boolean }>) => {
  const updated = writeAppConfig(patch);
  // Restart the intercom worker immediately if auto-accept setting changed
  if ('tailcom_auto_accept' in patch && process.env.TAILCOM_ENABLED === 'true') {
    process.env.TAILCOM_AUTO_ACCEPT = updated.tailcom_auto_accept ? 'true' : 'false';
    stopIntercomWorker();
    startIntercomWorker();
  }
  return updated;
});

// FILE PICKER IPC HANDLER
ipcMain.handle('dialog:pick-audio-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select Notification Sound',
    filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a'] }],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// TMBILL — read audio file bytes for custom notification sound.
// Renderer fetch('file://...') is silently suppressed by Chromium; reading via
// the main process with fs and sending the buffer is the only reliable approach.
ipcMain.handle('tmbill:read-audio-file', async (_event, filePath: string) => {
  try {
    return await fs.promises.readFile(filePath);
  } catch (err) {
    console.error('[TMBILL] Failed to read audio file:', err);
    return null;
  }
});

// ITEM MAPPING IPC HANDLERS
ipcMain.handle('mapping:get-all', () => getAllCanonicalItems());

ipcMain.handle('mapping:add-canonical', (_e, name: string, category: string | null) =>
  addCanonicalItem(name, category)
);

ipcMain.handle('mapping:update-canonical', (_e, id: number, name: string, category: string | null) =>
  updateCanonicalItem(id, name, category)
);

ipcMain.handle('mapping:delete-canonical', (_e, id: number) =>
  deleteCanonicalItem(id)
);

ipcMain.handle('mapping:add-cocoeats-map', (_e, foodId: string, foodName: string, canonicalItemId: number) =>
  addCocoeatsMap(foodId, foodName, canonicalItemId)
);

ipcMain.handle('mapping:remove-cocoeats-map', (_e, foodId: string) =>
  removeCocoeatsMap(foodId)
);

ipcMain.handle('mapping:add-tmbill-map', (_e, itemId: number, itemName: string, canonicalItemId: number) =>
  addTmbillMap(itemId, itemName, canonicalItemId)
);

ipcMain.handle('mapping:remove-tmbill-map', (_e, itemId: number) =>
  removeTmbillMap(itemId)
);

ipcMain.handle('mapping:set-station', (_e, id: number, station: string | null) =>
  setCanonicalStation(id, station)
);

// ⭐ AUTO-UPDATE USER ACTIONS
ipcMain.on('download-update', () => {
  console.log('📥 USER CLICKED "Download Now" - starting download...');
  if (!isDev) {
    autoUpdater.downloadUpdate();
  } else {
    console.log('⚠️ Download skipped - dev mode');
  }
});

ipcMain.on('install-update', () => {
  console.log('🔄 USER CLICKED "Install & Restart" - installing...');
  if (!isDev) {
    autoUpdater.quitAndInstall(false, true);
  } else {
    console.log('⚠️ Install skipped - dev mode');
  }
});

// PRINTER IPC HANDLERS
ipcMain.handle('get-printers', async () => {
  try {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    if (!win) {
      throw new Error('No window available');
    }

    const printers = await win.webContents.getPrintersAsync();
    console.log('📄 Available printers:', printers.map(p => p.name));
    return printers;
  } catch (error) {
    console.error('❌ Error getting printers:', error);
    throw error;
  }
});

// ── Resolve printer IP from Windows printer name (WMI) ───────────────────────
ipcMain.handle('get-printer-ip', async (_event, printerName: string) => {
  if (process.platform !== 'win32') return { success: false };
  try {
    // Escape single quotes for PowerShell
    const safeName = printerName.replace(/'/g, "''");
    // Step 1: get the port name assigned to this printer
    const { stdout: portOut } = await execAsync(
      `powershell -NoProfile -Command "Get-WmiObject Win32_Printer -Filter \\"Name='${safeName}'\\\" | Select-Object -ExpandProperty PortName"`,
      { timeout: 6000 }
    );
    const portName = portOut.trim();
    if (!portName) return { success: false };
    // Step 2: resolve the IP from the TCP/IP port
    const { stdout: ipOut } = await execAsync(
      `powershell -NoProfile -Command "Get-WmiObject Win32_TCPIPPrinterPort -Filter \\"Name='${portName.replace(/'/g, "''")}'\\\" | Select-Object -ExpandProperty HostAddress"`,
      { timeout: 6000 }
    );
    const ip = ipOut.trim();
    const valid = /^\d{1,3}(\.\d{1,3}){3}$/.test(ip);
    console.log(`🖨️ Printer IP lookup: "${printerName}" → port "${portName}" → IP "${ip}" (valid: ${valid})`);
    return valid ? { success: true, ip } : { success: false };
  } catch (err: any) {
    console.warn('⚠️ get-printer-ip failed:', err.message);
    return { success: false };
  }
});

// ── ESC/POS direct TCP printing ───────────────────────────────────────────────
ipcMain.handle('print-order-escpos', async (_event, orderData: any, printerAddress: string) => {
  try {
    const { host, port } = parsePrinterAddress(printerAddress);
    console.log(`🖨️ ESC/POS print → ${host}:${port}`);
    const receipt = buildEscPosReceipt(orderData);
    await sendToTcpPrinter(host, port, receipt);
    console.log(`✅ ESC/POS sent to ${host}:${port}`);
    return { success: true };
  } catch (error: any) {
    console.error('❌ ESC/POS print error:', error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('print-order', async (event, orderHtml: string, printerName?: string, paperWidth?: 58 | 80) => {
  let printWindow: BrowserWindow | null = null;
  try {
    console.log('🖨️ Printing order...');
    console.log('Selected printer:', printerName || 'Default');

    // Paper width in pixels at 96 DPI so the hidden window renders at actual receipt width
    // 80mm → 302px, 58mm → 219px  (px = mm * 96 / 25.4)
    const paperWidthPx = paperWidth === 58 ? 219 : 302;

    // Create a hidden window for printing, sized to the receipt width
    printWindow = new BrowserWindow({
      show: false,
      width: paperWidthPx,
      height: 1200,          // tall enough that content never clips before measurement
      webPreferences: {
        nodeIntegration: false,
      },
    });

    // Load the HTML content
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(orderHtml)}`);

    // Compute dynamic height (in microns) based on rendered content at receipt width
    const contentHeightMicrons = await printWindow.webContents.executeJavaScript(`
      (function () {
        const probe = document.createElement('div');
        probe.style.height = '1mm';
        probe.style.position = 'absolute';
        probe.style.visibility = 'hidden';
        document.body.appendChild(probe);
        const pxPerMm = probe.getBoundingClientRect().height || 1;
        document.body.removeChild(probe);
        const contentPx = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, document.body.offsetHeight);
        const heightMm = contentPx / pxPerMm;
        return Math.ceil(heightMm * 1000);
      })();
    `) as number;

    const pageWidthMicrons = (paperWidth === 58 ? 58000 : 80000);
    const pageHeightMicrons = (typeof contentHeightMicrons === 'number' && contentHeightMicrons > 0)
      ? Math.max(contentHeightMicrons, 50000)   // minimum 50mm
      : 300000;

    console.log(`🖨️ Paper: ${paperWidth}mm wide | Content height: ${Math.round(pageHeightMicrons / 1000)}mm (${contentHeightMicrons} µm measured)`);

    return new Promise((resolve) => {
      printWindow!.webContents.print(
        {
          silent: true,
          printBackground: false,
          deviceName: printerName || '',
          margins: { marginType: 'none' },
          pageSize: {
            width: pageWidthMicrons,
            height: pageHeightMicrons,
          },
        },
        (success, errorType) => {
          printWindow!.close();
          printWindow = null;

          if (success) {
            console.log('✅ Print job sent successfully');
            resolve({ success: true });
          } else {
            console.error('❌ Print failed:', errorType);
            resolve({ success: false, error: errorType });
          }
        }
      );
    });
  } catch (error) {
    // Ensure window is always closed even if loadURL or executeJavaScript throws
    if (printWindow && !printWindow.isDestroyed()) {
      printWindow.close();
    }
    console.error('❌ Print error:', error);
    return { success: false, error: String(error) };
  }
});

ipcMain.handle('get-default-printer', async () => {
  try {
    const win = mainWindow ?? BrowserWindow.getFocusedWindow();
    if (!win) {
      throw new Error('No window available');
    }

    const printers = await win.webContents.getPrintersAsync();
    const defaultPrinter = printers.find(p => p.isDefault);
    
    console.log('🖨️ Default printer:', defaultPrinter?.name || 'None');
    return defaultPrinter;
  } catch (error) {
    console.error('❌ Error getting default printer:', error);
    throw error;
  }
});

app.on('before-quit', () => {
  console.log('🔒 Closing database...');
  closeDatabase();
  stopKdsServer();
  stopIntercomWorker();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});