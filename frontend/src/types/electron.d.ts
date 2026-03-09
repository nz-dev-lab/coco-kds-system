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

export interface AppConfig {
  tmbill_enabled: boolean;
}

export interface TmbillMenuItem {
  item_id: number;
  item_refid: number;
  title: string;
  active: number;
}

export interface CanonicalItem {
  id: number;
  name: string;
  category: string | null;
  station_id: number | null;
  created_at: string;
  cocoeats_maps: { id: number; food_id: string; food_name: string }[];
  tmbill_maps:   { id: number; item_id: number; item_name: string }[];
}

export interface ElectronAPI {
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleFullscreen: () => void;
  isMaximized: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  platform: string;
  config: {
    get: () => Promise<AppConfig>;
    set: (patch: Partial<AppConfig>) => Promise<AppConfig>;
  };
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
  mapping: {
    getAll: () => Promise<{ success: boolean; data?: CanonicalItem[]; error?: string }>;
    addCanonical: (name: string, category: string | null) => Promise<{ success: boolean; id?: number; error?: string }>;
    updateCanonical: (id: number, name: string, category: string | null) => Promise<{ success: boolean; error?: string }>;
    deleteCanonical: (id: number) => Promise<{ success: boolean; error?: string }>;
    addCocoeatsMap: (foodId: string, foodName: string, canonicalItemId: number) => Promise<{ success: boolean; error?: string }>;
    removeCocoeatsMap: (foodId: string) => Promise<{ success: boolean; error?: string }>;
    addTmbillMap: (itemId: number, itemName: string, canonicalItemId: number) => Promise<{ success: boolean; error?: string }>;
    removeTmbillMap: (itemId: number) => Promise<{ success: boolean; error?: string }>;
  };
  printer: {
    getPrinters: () => Promise<PrinterInfo[]>;
    getDefaultPrinter: () => Promise<PrinterInfo | null>;
    printOrder: (orderHtml: string, printerName?: string, paperWidth?: 58 | 80) => Promise<PrintResult>;
    printOrderEscpos: (orderData: any, printerAddress: string) => Promise<PrintResult>;
    getPrinterIp: (printerName: string) => Promise<{ success: boolean; ip?: string }>;
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
  fetchMenu: () => Promise<{ success: boolean; count?: number }>;
  onMenuRefreshed: (callback: (data: { items: TmbillMenuItem[] }) => void) => () => void;
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