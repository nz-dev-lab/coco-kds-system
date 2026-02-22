// src/types/electron.d.ts

export interface PrinterInfo {
  name: string;
  displayName: string;
  description: string;
  status: number;
  isDefault: boolean;
  options?: Record<string, any>;
}

export interface PrintResult {
  success: boolean;
  error?: string;
}

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
export interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleFullscreen: () => void;
  isMaximized: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  autoUpdater: {
        onUpdateAvailable: (callback: (info: any) => void) => void;
        onUpdateProgress: (callback: (progress: any) => void) => void;
        onUpdateDownloaded: (callback: (info: any) => void) => void;
        downloadUpdate: () => void;
        installUpdate: () => void;
  };
  
  // Database API
  database: {
    addCompletedOrder: (order: any) => Promise<{ success: boolean; error?: string }>;
    getDailyStats: (date: string, restaurantId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getOrdersByDate: (date: string, restaurantId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getRevenueTrend: (days: number, restaurantId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    cleanupOldOrders: (days: number, restaurantId: string) => Promise<{ success: boolean; deleted?: number; error?: string }>;
    getTotalCount: (restaurantId: string) => Promise<{ success: boolean; data?: { count: number }; error?: string }>;
  };

  // Printer API
  printer: {
    getPrinters: () => Promise<PrinterInfo[]>;
    getDefaultPrinter: () => Promise<PrinterInfo | null>;
    printOrder: (orderHtml: string, printerName?: string) => Promise<PrintResult>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
    tmbill: TMBillAPI;
  }
}

export {};