// src/types/electron.d.ts
export interface ElectronAPI {
  // Window controls
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
  toggleFullscreen: () => void;
  isMaximized: () => Promise<boolean>;
  onUpdateAvailable: (callback: (info: any) => void) => void;
  onDownloadProgress: (callback: (progress: any) => void) => void;
  onUpdateDownloaded: (callback: (info: any) => void) => void;
  
  // Database API
  database: {
    addCompletedOrder: (order: any) => Promise<{ success: boolean; error?: string }>;
    getDailyStats: (date: string, restaurantId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
    getOrdersByDate: (date: string, restaurantId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    getRevenueTrend: (days: number, restaurantId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
    cleanupOldOrders: (days: number, restaurantId: string) => Promise<{ success: boolean; deleted?: number; error?: string }>;
    getTotalCount: (restaurantId: string) => Promise<{ success: boolean; data?: { count: number }; error?: string }>;
  };
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

export {};