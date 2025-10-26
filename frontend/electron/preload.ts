import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  toggleFullscreen: () => ipcRenderer.send('window-fullscreen'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  // Send message to main process
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
  
  // Receive message from main process
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    
    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  
  // Invoke method (async communication)
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

 // Auto-update specific (REPLACE existing ones)
  autoUpdater: {
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update_available', (event, info) => callback(info));
    },
    onUpdateProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('update_progress', (event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('update_downloaded', (event, info) => callback(info));
    },
    downloadUpdate: () => ipcRenderer.send('download-update'),
    installUpdate: () => ipcRenderer.send('install-update'),
  },

  // DATABASE API
  // ==========================================
  database: {
    // Store completed order
    addCompletedOrder: (order: any) => 
      ipcRenderer.invoke('db:add-completed-order', order),
    
    // Get daily statistics
    getDailyStats: (date: string, restaurantId: string) => 
      ipcRenderer.invoke('db:get-daily-stats', date, restaurantId),
    
    // Get orders by date
    getOrdersByDate: (date: string, restaurantId: string) => 
      ipcRenderer.invoke('db:get-orders-by-date', date, restaurantId),
    
    // Get revenue trend
    getRevenueTrend: (days: number, restaurantId: string) => 
      ipcRenderer.invoke('db:get-revenue-trend', days, restaurantId),
    
    // Cleanup old orders
    cleanupOldOrders: (days: number, restaurantId: string) => 
      ipcRenderer.invoke('db:cleanup-old-orders', days, restaurantId),
    
    // Get total count
    getTotalCount: (restaurantId: string) => 
      ipcRenderer.invoke('db:get-total-count', restaurantId),
  },

  // Printer APIs
  printer: {
    /**
     * Get list of available printers
     */
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    
    /**
     * Get the default printer
     */
    getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
    
    /**
     * Print order HTML
     * @param orderHtml - HTML string to print
     * @param printerName - Optional printer name, uses default if not provided
     */
    printOrder: (orderHtml: string, printerName?: string) =>
      ipcRenderer.invoke('print-order', orderHtml, printerName),
  },

});

// Type declarations
declare global {
  interface Window {
    electron: {
      send: (channel: string, data: any) => void;
      on: (channel: string, func: (...args: any[]) => void) => () => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      onUpdateAvailable: (callback: () => void) => void;
      onUpdateDownloaded: (callback: () => void) => void;
    };
  }
}