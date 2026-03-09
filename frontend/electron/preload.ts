import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // Window controls
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  toggleFullscreen: () => ipcRenderer.send('window-fullscreen'),
  isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

  // Generic send/on/invoke
  send: (channel: string, data: any) => {
    ipcRenderer.send(channel, data);
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    const subscription = (_event: any, ...args: any[]) => func(...args);
    ipcRenderer.on(channel, subscription);
    return () => {
      ipcRenderer.removeListener(channel, subscription);
    };
  },
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,

  // Auto-updater
  autoUpdater: {
    onUpdateAvailable: (callback: (info: any) => void) => {
      ipcRenderer.on('update_available', (_event, info) => callback(info));
    },
    onUpdateProgress: (callback: (progress: any) => void) => {
      ipcRenderer.on('update_progress', (_event, progress) => callback(progress));
    },
    onUpdateDownloaded: (callback: (info: any) => void) => {
      ipcRenderer.on('update_downloaded', (_event, info) => callback(info));
    },
    downloadUpdate: () => ipcRenderer.send('download-update'),
    installUpdate: () => ipcRenderer.send('install-update'),
  },

  // DATABASE API
  database: {
    addCompletedOrder: (order: any) =>
      ipcRenderer.invoke('db:add-completed-order', order),
    getDailyStats: (date: string, restaurantId: string) =>
      ipcRenderer.invoke('db:get-daily-stats', date, restaurantId),
    getOrdersByDate: (date: string, restaurantId: string) =>
      ipcRenderer.invoke('db:get-orders-by-date', date, restaurantId),
    getRevenueTrend: (days: number, restaurantId: string) =>
      ipcRenderer.invoke('db:get-revenue-trend', days, restaurantId),
    cleanupOldOrders: (days: number, restaurantId: string) =>
      ipcRenderer.invoke('db:cleanup-old-orders', days, restaurantId),
    getTotalCount: (restaurantId: string) =>
      ipcRenderer.invoke('db:get-total-count', restaurantId),
  },

  // App config
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (patch: { tmbill_enabled?: boolean }) => ipcRenderer.invoke('config:set', patch),
  },

  // Item mapping API
  mapping: {
    getAll: () => ipcRenderer.invoke('mapping:get-all'),
    addCanonical: (name: string, category: string | null) =>
      ipcRenderer.invoke('mapping:add-canonical', name, category),
    updateCanonical: (id: number, name: string, category: string | null) =>
      ipcRenderer.invoke('mapping:update-canonical', id, name, category),
    deleteCanonical: (id: number) =>
      ipcRenderer.invoke('mapping:delete-canonical', id),
    addCocoeatsMap: (foodId: string, foodName: string, canonicalItemId: number) =>
      ipcRenderer.invoke('mapping:add-cocoeats-map', foodId, foodName, canonicalItemId),
    removeCocoeatsMap: (foodId: string) =>
      ipcRenderer.invoke('mapping:remove-cocoeats-map', foodId),
    addTmbillMap: (itemId: number, itemName: string, canonicalItemId: number) =>
      ipcRenderer.invoke('mapping:add-tmbill-map', itemId, itemName, canonicalItemId),
    removeTmbillMap: (itemId: number) =>
      ipcRenderer.invoke('mapping:remove-tmbill-map', itemId),
  },

  // Printer APIs
  printer: {
    getPrinters: () => ipcRenderer.invoke('get-printers'),
    getDefaultPrinter: () => ipcRenderer.invoke('get-default-printer'),
    printOrder: (orderHtml: string, printerName?: string, paperWidth?: 58 | 80) =>
      ipcRenderer.invoke('print-order', orderHtml, printerName, paperWidth),
    printOrderEscpos: (orderData: any, printerAddress: string) =>
      ipcRenderer.invoke('print-order-escpos', orderData, printerAddress),
    getPrinterIp: (printerName: string) =>
      ipcRenderer.invoke('get-printer-ip', printerName),
  },
});

// ── TMBILL Plugin API ─────────────────────────────────────────────────────────
// Only exposed when tmbill_enabled: true in config.json.
// All UI components gate on !!window.tmbill — if not exposed, TMBILL UI is hidden.
if (process.env.TMBILL_ENABLED === 'true') {
contextBridge.exposeInMainWorld('tmbill', {
  // Discovery
  getServices: () => ipcRenderer.invoke('tmbill:get-services'),
  startDiscovery: () => ipcRenderer.invoke('tmbill:start-discovery'),
  stopDiscovery: () => ipcRenderer.invoke('tmbill:stop-discovery'),
  getState: () => ipcRenderer.invoke('tmbill:get-state'),
  getConfig: () => ipcRenderer.invoke('tmbill:get-config'),

  // Authentication & connection
  authenticate: (service: any, username: string, password: string) =>
    ipcRenderer.invoke('tmbill:authenticate', service, username, password),
  connectSocket: () =>
    ipcRenderer.invoke('tmbill:connect-socket'),
  disconnect: () =>
    ipcRenderer.invoke('tmbill:disconnect'),

  // Manual fetch (initial load / refresh button)
  fetchRunningTables: () =>
    ipcRenderer.invoke('tmbill:fetch-running-tables'),

  // LAN scan — finds TMBILL POS by probing port 3000 across subnet
  scanNetwork: (port?: number) =>
    ipcRenderer.invoke('tmbill:scan-network', port ?? 3000),

  // Item status — isReady: true → ready, false → pending
  updateItemStatus: (kotItemId: number, isReady: boolean) =>
    ipcRenderer.invoke('tmbill:update-item-status', kotItemId, isReady),

  // ── Event listeners ────────────────────────────────────────────────────────
  onServiceFound: (callback: (service: any) => void) => {
    ipcRenderer.on('tmbill:service-found', (_, service) => callback(service));
  },
  onServiceLost: (callback: (name: string) => void) => {
    ipcRenderer.on('tmbill:service-lost', (_, name) => callback(name));
  },

  // Main event — fires on: kot-saved, kds-kot-updated, quick-bill-placed, post-removal refetch
  // Payload: { running: CocoKDSOrder[], settled: any[] }
  onOrdersRefreshed: (callback: (data: { running: any[]; settled: any[] }) => void) => {
  const sub = (_: any, data: any) => callback(data);
  ipcRenderer.on('tmbill:orders-refreshed', sub);
  return () => ipcRenderer.removeListener('tmbill:orders-refreshed', sub);
},
onOrderRemoved: (callback: (data: { id: string }) => void) => {
  const sub = (_: any, data: any) => callback(data);
  ipcRenderer.on('tmbill:order-removed', sub);
  return () => ipcRenderer.removeListener('tmbill:order-removed', sub);
},
onOrderSettled: (callback: (data: { tableId: number }) => void) => {
  const sub = (_: any, data: any) => callback(data);
  ipcRenderer.on('tmbill:order-settled', sub);
  return () => ipcRenderer.removeListener('tmbill:order-settled', sub);
},

updateKotStatus: (kotId: number, tableId: number, tableName: string, status: number) =>
  ipcRenderer.invoke('tmbill:update-kot-status', kotId, tableId, tableName, status),

updateOrderKotStatus: (orderId: string, status: number) =>
  ipcRenderer.invoke('tmbill:update-order-kot-status', orderId, status),

  onLog: (callback: (data: { message: string; type?: string }) => void) => {
    ipcRenderer.on('tmbill:log', (_, data) => callback(data));
  },

  // Menu — full item list from TMBILL /menu endpoint
  fetchMenu: () => ipcRenderer.invoke('tmbill:fetch-menu'),
  onMenuRefreshed: (callback: (data: { items: any[] }) => void) => {
    const sub = (_: any, data: any) => callback(data);
    ipcRenderer.on('tmbill:menu-refreshed', sub);
    return () => ipcRenderer.removeListener('tmbill:menu-refreshed', sub);
  },
});
} // end if (TMBILL_ENABLED)

// ── Type declarations live in src/types/electron.d.ts (included in frontend tsconfig) ──