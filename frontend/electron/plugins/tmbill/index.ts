import { BrowserWindow, ipcMain } from 'electron';
import { TMBillDiscovery } from './discovery';
import { TMBillConnection } from './connections';
import { 
  transformTMBillRunningTable,
  transformItemStatusToTmbill 
} from './transformer';
import type { TMBillPluginConfig, TMBillPluginState, TMBillService } from './types';
import type { TMBillRunningTable } from './transformer';

export class TMBillPlugin {
  private discovery: TMBillDiscovery;
  private connection: TMBillConnection;
  private mainWindow: BrowserWindow | null = null;
  private state: TMBillPluginState;
  private config: TMBillPluginConfig;

  constructor(config: TMBillPluginConfig) {
    this.config = config;
    this.discovery = new TMBillDiscovery(config.serviceType);
    
    this.connection = new TMBillConnection((message, type) => {
      console.log(message);
      this.sendToRenderer('tmbill:log', { message, type });
    });
    
    this.state = {
      initialized: false,
      discovering: false,
      connected: false,
      authenticated: false,
      service: null,
      token: null,
      storeId: null,
      baseUrl: null,
      lastError: null,
    };

    this.setupDiscoveryEvents();
  }

  private log(message: string, type: 'info' | 'success' | 'error' = 'info') {
    console.log(message);
    this.sendToRenderer('tmbill:log', { message, type });
  }

  private setupDiscoveryEvents() {
    this.discovery.on('service-found', (service: TMBillService) => {
      this.log(`🎯 Service found: ${service.name}`, 'success');
      this.state.service = service;
      this.sendToRenderer('tmbill:service-found', service);
    });

    this.discovery.on('service-lost', (name: string) => {
      this.log(`📉 Service lost: ${name}`, 'error');
      this.sendToRenderer('tmbill:service-lost', name);
    });
  }

  initialize(mainWindow: BrowserWindow) {
    this.log('🚀 TMBILL Plugin initializing...', 'info');
    this.mainWindow = mainWindow;
    this.registerIPCHandlers();
    this.discovery.start();
    this.state.discovering = true;
    this.state.initialized = true;
    this.log('✅ TMBILL Plugin initialized', 'success');
  }

  private registerIPCHandlers() {
    ipcMain.handle('tmbill:get-services', () => {
      return this.discovery.getServices();
    });

    ipcMain.handle('tmbill:start-discovery', () => {
      this.log('🔍 Starting discovery...', 'info');
      this.discovery.start();
      this.state.discovering = true;
      return { success: true };
    });

    ipcMain.handle('tmbill:stop-discovery', () => {
      this.log('🛑 Stopping discovery...', 'info');
      this.discovery.stop();
      this.state.discovering = false;
      return { success: true };
    });

    ipcMain.handle('tmbill:get-state', () => {
      return {
        ...this.state,
        connected: this.connection.isConnected(),
      };
    });

    ipcMain.handle('tmbill:get-config', () => {
      return this.config;
    });

    // ── Authenticate ──────────────────────────────────────────────────────────
    ipcMain.handle('tmbill:authenticate', async (_event, service: TMBillService, username: string, password: string) => {
      this.log(`🔐 Authenticating: ${username}...`, 'info');
      
      try {
        const result = await this.connection.authenticate(service, username, password);
        
        if (result.success) {
          this.state.authenticated = true;
          this.state.service = service;
          this.state.token = result.token || null;
          this.state.storeId = result.storeId || null;
          this.state.baseUrl = this.connection.getBaseUrl();
          this.log(`✅ Authenticated — Store ID: ${this.state.storeId}`, 'success');
        } else {
          this.log(`❌ Auth failed: ${result.error}`, 'error');
        }
        
        return result;
      } catch (error: any) {
        this.state.lastError = error.message;
        this.log(`❌ Auth error: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // ── Connect Socket + Wire Up All Order Events ─────────────────────────────
    ipcMain.handle('tmbill:connect-socket', async () => {
      this.log('🔌 Connecting to TMBILL POS...', 'info');
      
      try {
        this.connection.connect();
        this.log('👂 Setting up order listeners...', 'info');

        // ── NEW ORDER (kot-saved → fetch → transform → send to renderer) ────
        this.connection.onNewOrder((notification, { tables, settledOrders }) => {
          this.log(`📦 Orders refreshed after kot-saved — ${tables.length} running, ${settledOrders.length} settled`, 'success');
          const transformedOrders = tables.map(t => transformTMBillRunningTable(t));
          this.sendToRenderer('tmbill:orders-refreshed', { running: transformedOrders, settled: settledOrders });
        });

        // ── ORDER UPDATED (kds-kot-updated → re-fetch all) ────────────────
        this.connection.onOrderUpdate(({ tables, settledOrders }) => {
          this.log(`🔄 Orders refreshed — ${tables.length} running, ${settledOrders.length} settled`, 'info');
          const transformedOrders = tables.map(t => transformTMBillRunningTable(t));
          this.sendToRenderer('tmbill:orders-refreshed', { running: transformedOrders, settled: settledOrders });
        });

        // ── QUICK BILL (quick-bill-placed → fetch → send to renderer) ─────
        this.connection.onQuickBill(({ tables, settledOrders }) => {
          this.log(`⚡ Orders refreshed after quick-bill-placed — ${tables.length} running, ${settledOrders.length} settled`, 'info');
          const transformedOrders = tables.map(t => transformTMBillRunningTable(t));
          this.sendToRenderer('tmbill:orders-refreshed', { running: transformedOrders, settled: settledOrders });
        });

        // ── ORDER REMOVED (bill-settled / cancelled) ──────────────────────
        this.connection.onOrderRemoved(async (kotId, tableId) => {
          if (kotId !== null) {
            // websocket-kot-cancelled — exact kot_id known
            this.log(`🚫 Order removed: TMBILL-${kotId}`, 'info');
            this.sendToRenderer('tmbill:order-removed', { id: `TMBILL-${kotId}` });

            // Re-fetch to sync state after cancellation
            const { tables, settledOrders } = await this.connection.fetchRunningTables();
            const transformedOrders = tables.map(t => transformTMBillRunningTable(t));
            this.sendToRenderer('tmbill:orders-refreshed', { running: transformedOrders, settled: settledOrders });
          } else if (tableId !== null) {
            // bill-settled — only table_id known; renderer matches by _tmbill_table_id
            this.log(`💳 Order settled for table_id: ${tableId}`, 'info');
            this.sendToRenderer('tmbill:order-settled', { tableId });

            // Re-fetch to sync settledOrders after bill settlement
            const { tables, settledOrders } = await this.connection.fetchRunningTables();
            const transformedOrders = tables.map(t => transformTMBillRunningTable(t));
            this.sendToRenderer('tmbill:orders-refreshed', { running: transformedOrders, settled: settledOrders });
          }
        });

        this.state.connected = true;
        this.log('✅ All listeners active. Waiting for orders...', 'success');
        
        return { success: true, connected: this.connection.isConnected() };
      } catch (error: any) {
        this.state.lastError = error.message;
        this.state.connected = false;
        this.log(`❌ Connection failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // ── Fetch Running Tables (manual trigger / initial load) ──────────────
    ipcMain.handle('tmbill:fetch-running-tables', async () => {
      this.log('📋 Fetching running tables...', 'info');
      try {
        const { tables, settledOrders } = await this.connection.fetchRunningTables();
        const transformedOrders = tables.map(t => transformTMBillRunningTable(t));
        this.sendToRenderer('tmbill:orders-refreshed', { running: transformedOrders, settled: settledOrders });
        return { success: true, count: transformedOrders.length, settledCount: settledOrders.length };
      } catch (error: any) {
        this.log(`❌ Fetch failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // ── Update Item Status ────────────────────────────────────────────────
    ipcMain.handle('tmbill:update-item-status', async (_event, kotItemId: number, isReady: boolean) => {
      this.log(`📤 Item #${kotItemId} → ${isReady ? 'ready' : 'pending'}`, 'info');
      
      try {
        this.connection.updateItemStatus(kotItemId, isReady);
        return { success: true };
      } catch (error: any) {
        this.log(`❌ Item status update failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // ── Disconnect ────────────────────────────────────────────────────────
    ipcMain.handle('tmbill:disconnect', async () => {
      this.log('🔌 Disconnecting...', 'info');
      
      try {
        this.connection.disconnect();
        this.state.connected = false;
        this.state.authenticated = false;
        this.state.token = null;
        this.state.storeId = null;
        this.state.baseUrl = null;
        this.log('✅ Disconnected', 'success');
        return { success: true };
      } catch (error: any) {
        this.log(`❌ Disconnect error: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });
  }

  private sendToRenderer(channel: string, data: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  cleanup() {
    this.log('🧹 Cleaning up...', 'info');
    this.discovery.stop();
    this.connection.disconnect();
  }
}