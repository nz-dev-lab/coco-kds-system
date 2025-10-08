import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

// Configure auto-updater (only in production)
if (!isDev) {
  autoUpdater.checkForUpdatesAndNotify();
  
  // Check for updates every 4 hours
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify();
  }, 4 * 60 * 60 * 1000);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: !isDev, // Fullscreen in production, windowed in dev
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#1a1d29',
    title: 'Kitchen Display System',
  });

  // Load app
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Auto-updater events
  if (!isDev && mainWindow) {
    setupAutoUpdater(mainWindow);
  }
}

function setupAutoUpdater(window: BrowserWindow) {
  autoUpdater.on('update-available', () => {
    window.webContents.send('update_available');
  });

  autoUpdater.on('update-downloaded', () => {
    window.webContents.send('update_downloaded');
  });

  autoUpdater.on('error', (error) => {
    console.error('Auto-updater error:', error);
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});