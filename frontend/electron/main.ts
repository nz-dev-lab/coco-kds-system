import { app, BrowserWindow, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import { 
  addCompletedOrder, 
  getDailyStats, 
  getOrdersByDate, 
  getRevenueTrend,
  cleanupOldOrders,
  closeDatabase,
  statements 
} from './database';

let mainWindow: BrowserWindow | null = null;
const isDev = process.env.NODE_ENV === 'development';

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
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    frame: false,
    titleBarStyle: 'hidden',
    fullscreen: !isDev,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // ⭐ CRITICAL: Allow loading from file:// protocol
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    title: 'Kitchen Display System',
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
    
    mainWindow.loadFile(indexPath)
      .then(() => {
        console.log('✅ Successfully loaded index.html');
        console.log('🔗 Location will be:', `file://${indexPath}`);
      })
      .catch((err) => {
        console.error('❌ Failed to load index.html:', err);
        console.error('📂 Tried path:', indexPath);
      });
    
    // Open DevTools automatically for debugging
    mainWindow.webContents.openDevTools();
    
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
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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
    window.webContents.send('update_available', info);
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('✓ App is up to date:', info.version);
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error.message);
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`📥 Download progress: ${Math.round(progress.percent)}%`);
    window.webContents.send('update_progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    window.webContents.send('update_downloaded', info);
  });
}

app.whenReady().then(() => {
  createWindow();
  setupMaximizeListeners();

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

app.on('before-quit', () => {
  console.log('🔒 Closing database...');
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});