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

export interface ElectronAPI {
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleFullscreen: () => void;
  isMaximized: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  platform: string;
  autoUpdater: {
    onUpdateAvailable: (callback: (info: any) => void) => void;
    onUpdateProgress: (callback: (progress: any) => void) => void;
    onUpdateDownloaded: (callback: (info: any) => void) => void;
    downloadUpdate: () => void;
    installUpdate: () => void;
  };
  database: {
    addCompletedOrder: (order: any) => Promise<{ success: boolean; error?: string }>;
    getDailyStats: (date: string, restaurantId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getOrdersByDate: (date: string, restaurantId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getRevenueTrend: (days: number, restaurantId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    cleanupOldOrders: (days: number, restaurantId: string) => Promise<{ success: boolean; deleted?: number; error?: string }>;
    getTotalCount: (restaurantId: string) => Promise<{ success: boolean; data?: { count: number }; error?: string }>;
  };
  printer: {
    getPrinters: () => Promise<PrinterInfo[]>;
    getDefaultPrinter: () => Promise<PrinterInfo | null>;
    printOrder: (orderHtml: string, printerName?: string, paperWidth?: 58 | 80) => Promise<PrintResult>;
  };
}

export interface TMBillAPI {
  getServices: () => Promise<any[]>;
  startDiscovery: () => Promise<{ success: boolean }>;
  stopDiscovery: () => Promise<{ success: boolean }>;
  getState: () => Promise<any>;
  getConfig: () => Promise<any>;
  authenticate: (service: any, username: string, password: string) => Promise<any>;
  connectSocket: () => Promise<{ success: boolean; connected: boolean }>;
  disconnect: () => Promise<{ success: boolean }>;
  fetchRunningTables: () => Promise<{ success: boolean; count: number; settledCount: number }>;
  scanNetwork: (port?: number) => Promise<{ found: boolean; host: string | null }>;
  updateItemStatus: (kotItemId: number, isReady: boolean) => Promise<{ success: boolean }>;
  updateKotStatus: (kotId: number, tableId: number, tableName: string, status: number) => Promise<{ success: boolean }>;
  updateOrderKotStatus: (orderId: string, status: number) => Promise<{ success: boolean }>;
  onServiceFound: (callback: (service: any) => void) => void;
  onServiceLost: (callback: (name: string) => void) => void;
  onOrdersRefreshed: (callback: (data: { running: any[]; settled: any[] }) => void) => () => void;
  onOrderRemoved: (callback: (data: { id: string }) => void) => () => void;
  onOrderSettled: (callback: (data: { tableId: number }) => void) => () => void;
  onLog: (callback: (data: { message: string; type?: string }) => void) => void;
}

declare global {
  interface Window {
    electron: ElectronAPI;
    tmbill: TMBillAPI;
  }
}

export {};