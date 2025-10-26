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
  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleFullscreen: () => void;
  isMaximized: () => Promise<boolean>;
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
  }
}

export {};