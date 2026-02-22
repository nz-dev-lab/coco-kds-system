import { app, contextBridge, ipcRenderer } from 'electron';

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

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

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

// 🆕 TMBILL Plugin API (separate exposeInMainWorld call)
contextBridge.exposeInMainWorld('tmbill', {
  // Discovery (existing)
  getServices: () => ipcRenderer.invoke('tmbill:get-services'),
  startDiscovery: () => ipcRenderer.invoke('tmbill:start-discovery'),
  stopDiscovery: () => ipcRenderer.invoke('tmbill:stop-discovery'),
  getState: () => ipcRenderer.invoke('tmbill:get-state'),
  getConfig: () => ipcRenderer.invoke('tmbill:get-config'),
  
  // NEW: Authentication & Connection
  authenticate: (service: any, username: string, password: string) => 
    ipcRenderer.invoke('tmbill:authenticate', service, username, password),
  connectSocket: () => 
    ipcRenderer.invoke('tmbill:connect-socket'),
  disconnect: () => 
    ipcRenderer.invoke('tmbill:disconnect'),
  updateItemStatus: (kotItemId: number, status: string) => 
    ipcRenderer.invoke('tmbill:update-item-status', kotItemId, status),
  
  // Events (existing)
  onServiceFound: (callback: (service: any) => void) => {
    ipcRenderer.on('tmbill:service-found', (_, service) => callback(service));
  },
  onServiceLost: (callback: (name: string) => void) => {
    ipcRenderer.on('tmbill:service-lost', (_, name) => callback(name));
  },
  
  // NEW: Order events
  onNewOrder: (callback: (order: any) => void) => {
    ipcRenderer.on('tmbill:new-order', (_, order) => callback(order));
  },
  onOrderUpdated: (callback: (order: any) => void) => {
    ipcRenderer.on('tmbill:order-updated', (_, order) => callback(order));
  },
  onLog: (callback: (data: { message: string; type?: string }) => void) => {
    ipcRenderer.on('tmbill:log', (_, data) => callback(data));
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

     // 🆕 Add TMBILL API types
    tmbill: {
      getServices: () => Promise<any[]>;
      startDiscovery: () => Promise<{ success: boolean }>;
      stopDiscovery: () => Promise<{ success: boolean }>;
      getState: () => Promise<any>;
      getConfig: () => Promise<any>;
      onServiceFound: (callback: (service: any) => void) => void;
      onServiceLost: (callback: (name: string) => void) => void;
    };
  }
}