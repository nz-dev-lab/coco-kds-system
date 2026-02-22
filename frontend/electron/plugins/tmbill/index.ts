import { BrowserWindow, ipcMain } from 'electron';
import { TMBillDiscovery } from './discovery';
import { TMBillConnection } from './connections';
import { transformTMBillOrder, transformItemStatus } from './transformer';
import type { TMBillPluginConfig, TMBillPluginState, TMBillService } from './types';

export class TMBillPlugin {
  private discovery: TMBillDiscovery;
  private connection: TMBillConnection;
  private mainWindow: BrowserWindow | null = null;
  private state: TMBillPluginState;
  private config: TMBillPluginConfig;

  constructor(config: TMBillPluginConfig) {
    this.config = config;
    this.discovery = new TMBillDiscovery(config.serviceType);
    
    // Create connection with logging callback
    this.connection = new TMBillConnection((message, type) => {
      // Send to renderer AND console
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
      lastError: null,
    };

    this.setupDiscoveryEvents();
  }

  // ✅ NEW: Central logging method
  private log(message: string, type: 'info' | 'success' | 'error' = 'info') {
    console.log(message); // Still log to console
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
    
    // Start discovery
    this.discovery.start();
    this.state.discovering = true;
    this.state.initialized = true;
    
    this.log('✅ TMBILL Plugin initialized successfully', 'success');
  }

  private registerIPCHandlers() {
    // Get discovered services
    ipcMain.handle('tmbill:get-services', () => {
      return this.discovery.getServices();
    });

    // Start discovery
    ipcMain.handle('tmbill:start-discovery', () => {
      this.log('🔍 Starting service discovery...', 'info');
      this.discovery.start();
      this.state.discovering = true;
      return { success: true };
    });

    // Stop discovery
    ipcMain.handle('tmbill:stop-discovery', () => {
      this.log('🛑 Stopping service discovery...', 'info');
      this.discovery.stop();
      this.state.discovering = false;
      return { success: true };
    });

    // Get state
    ipcMain.handle('tmbill:get-state', () => {
      return {
        ...this.state,
        connected: this.connection.isConnected(),
      };
    });

    // Get config
    ipcMain.handle('tmbill:get-config', () => {
      return this.config;
    });

    // Authenticate
    ipcMain.handle('tmbill:authenticate', async (event, service: TMBillService, username: string, password: string) => {
      this.log(`🔐 Authenticating user: ${username}...`, 'info');
      
      try {
        const result = await this.connection.authenticate(service, username, password);
        
        if (result.success) {
          this.state.authenticated = true;
          this.state.service = service;
          this.state.token = result.token || null;
          this.log(`✅ Authentication successful for ${username}`, 'success');
        } else {
          this.log(`❌ Authentication failed: ${result.error}`, 'error');
        }
        
        return result;
      } catch (error: any) {
        this.state.lastError = error.message;
        this.log(`❌ Authentication error: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // Connect Socket.IO
    ipcMain.handle('tmbill:connect-socket', async () => {
      this.log('🔌 Connecting to TMBILL POS Socket.IO...', 'info');
      
      try {
        // Connect to Socket.IO
        this.connection.connect();
        
        this.log('👂 Setting up order listeners...', 'info');
        
        // Listen for new orders
        this.connection.onNewOrder((order) => {
          this.log(`📦 NEW ORDER: KOT #${order.kot_id} - ${order.kot_number || 'N/A'}`, 'success');
          this.log(`   └─ Table: ${order.table_number || 'N/A'}, Items: ${order.items?.length || 0}`, 'info');
          
          // Transform to CocoKDS format
          const transformedOrder = transformTMBillOrder(order);
          
          // Send to renderer
          this.sendToRenderer('tmbill:new-order', transformedOrder);
        });

        // Listen for order updates
        this.connection.onOrderUpdate((order) => {
          this.log(`🔄 ORDER UPDATED: KOT #${order.kot_id}`, 'info');
          
          // Transform to CocoKDS format
          const transformedOrder = transformTMBillOrder(order);
          
          // Send to renderer
          this.sendToRenderer('tmbill:order-updated', transformedOrder);
        });

        this.state.connected = true;
        this.log('✅ Socket.IO connected! Now listening for orders...', 'success');
        
        return { 
          success: true, 
          connected: this.connection.isConnected() 
        };
      } catch (error: any) {
        this.state.lastError = error.message;
        this.state.connected = false;
        this.log(`❌ Socket.IO connection failed: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // Update item status
    ipcMain.handle('tmbill:update-item-status', async (event, kotItemId: number, status: string) => {
      this.log(`📤 Updating item status: Item #${kotItemId} → ${status}`, 'info');
      
      try {
        this.connection.updateItemStatus(kotItemId, status);
        this.log(`✅ Item status updated successfully`, 'success');
        return { success: true };
      } catch (error: any) {
        this.log(`❌ Failed to update item status: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });

    // Disconnect
    ipcMain.handle('tmbill:disconnect', async () => {
      this.log('🔌 Disconnecting from TMBILL POS...', 'info');
      
      try {
        this.connection.disconnect();
        this.state.connected = false;
        this.state.authenticated = false;
        this.state.token = null;
        this.log('✅ Disconnected successfully', 'success');
        return { success: true };
      } catch (error: any) {
        this.log(`❌ Disconnect error: ${error.message}`, 'error');
        return { success: false, error: error.message };
      }
    });
  }

  private sendToRenderer(channel: string, data: any) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  cleanup() {
    this.log('🧹 Cleaning up TMBILL Plugin...', 'info');
    this.discovery.stop();
    this.connection.disconnect();
    this.log('✅ Cleanup complete', 'success');
  }
}
