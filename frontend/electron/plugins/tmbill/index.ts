// electron/plugins/tmbill/index.ts
import { BrowserWindow, ipcMain } from 'electron';
import { TMBillDiscovery } from './discovery';
import type { TMBillPluginConfig, TMBillPluginState, TMBillService } from './types';

export class TMBillPlugin {
  private discovery: TMBillDiscovery;
  private mainWindow: BrowserWindow | null = null;
  private config: TMBillPluginConfig;
  private state: TMBillPluginState;

  constructor(config: TMBillPluginConfig) {
    this.config = config;
    this.discovery = new TMBillDiscovery(config.serviceType);
    
    this.state = {
      initialized: false,
      discovering: false,
      connected: false,
      service: null,
      lastError: null,
    };
    
    this.setupDiscoveryEvents();
  }

  private setupDiscoveryEvents() {
    this.discovery.on('service-found', (service: TMBillService) => {
      console.log('🎯 [TMBILL Plugin] Service found:', service.name);
      this.sendToRenderer('tmbill:service-found', service);
    });

    this.discovery.on('service-lost', (name: string) => {
      console.log('📉 [TMBILL Plugin] Service lost:', name);
      this.sendToRenderer('tmbill:service-lost', name);
    });
  }

  initialize(mainWindow: BrowserWindow) {
    if (!this.config.enabled) {
      console.log('⚠️  [TMBILL Plugin] Disabled via config');
      return;
    }

    console.log('\n🚀 [TMBILL Plugin] Initializing...');
    console.log('   Config:', JSON.stringify(this.config, null, 2));
    
    this.mainWindow = mainWindow;
    this.registerIPCHandlers();
    
    // Start discovery
    this.discovery.start();
    this.state.initialized = true;
    this.state.discovering = true;
    
    console.log('✅ [TMBILL Plugin] Initialized\n');
  }

  private registerIPCHandlers() {
    // Discovery
    ipcMain.handle('tmbill:get-services', () => {
      const services = this.discovery.getServices();
      console.log(`📋 [TMBILL Plugin] Returning ${services.length} services`);
      return services;
    });

    ipcMain.handle('tmbill:start-discovery', () => {
      console.log('🔄 [TMBILL Plugin] Starting discovery (manual trigger)');
      this.discovery.start();
      this.state.discovering = true;
      return { success: true };
    });

    ipcMain.handle('tmbill:stop-discovery', () => {
      console.log('🛑 [TMBILL Plugin] Stopping discovery (manual trigger)');
      this.discovery.stop();
      this.state.discovering = false;
      return { success: true };
    });

    ipcMain.handle('tmbill:get-state', () => {
      return this.state;
    });

    ipcMain.handle('tmbill:get-config', () => {
      return this.config;
    });
  }

  private sendToRenderer(channel: string, data?: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  cleanup() {
    console.log('🧹 [TMBILL Plugin] Cleaning up...');
    this.discovery.stop();
    this.state.initialized = false;
    this.state.discovering = false;
  }
}