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
  // Explicitly configure the update source
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'nz-dev-lab',
    repo: 'coco-kds-releases',
  });

  // Don't auto-download, let user decide
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  // Initial check on startup
  app.whenReady().then(() => {
    setTimeout(() => {
      autoUpdater.checkForUpdates();
    }, 3000); // Wait 3 seconds after app starts
  });

  // Check for updates every 4 hours
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
    frame: false, // Remove default window frame
    titleBarStyle: 'hidden', // Hide title bar
    fullscreen: !isDev, // Fullscreen in production, windowed in dev
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    autoHideMenuBar: true,
    backgroundColor: '#0f172a', // Updated to match your kds-bg color
    title: 'Kitchen Display System',
    
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
    console.log('🔧 Development mode - Loading from localhost:5173');
  } else {
    const indexPath = path.join(app.getAppPath(), 'dist', 'index.html');
mainWindow.loadFile(indexPath)
  .then(() => console.log('✅ Successfully loaded index.html'))
  .catch((err) => console.error('❌ Failed to load:', err));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Setup auto-updater events
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

// Check if window is maximized
ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() || false;
});

// Listen for maximize/unmaximize events to update UI
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
    // Automatically start download
    autoUpdater.downloadUpdate();
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('✓ App is up to date:', info.version);
  });

  autoUpdater.on('error', (error) => {
    console.error('❌ Auto-updater error:', error.message);
    // Don't crash the app, just log the error
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`📥 Download progress: ${Math.round(progress.percent)}%`);
    window.webContents.send('update_progress', progress);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Update downloaded:', info.version);
    window.webContents.send('update_downloaded', info);
    // Optional: Auto-install after 30 seconds
    // setTimeout(() => {
    //   autoUpdater.quitAndInstall();
    // }, 30000);
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

// ==========================================
// DATABASE IPC HANDLERS
// ==========================================

// Store completed order
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

// Get daily statistics
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

// Get orders by date
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

// Get revenue trend
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

// Cleanup old orders
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

// Get total order count for restaurant
ipcMain.handle('db:get-total-count', async (event, restaurantId: string) => {
  try {
    const result = statements.getTotalCount.get(restaurantId);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('❌ Failed to get count:', error);
    return { success: false, error: error.message };
  }
});

// Close database on quit
app.on('before-quit', () => {
  console.log('🔒 Closing database...');
  closeDatabase();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});