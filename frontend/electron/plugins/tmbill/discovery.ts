// electron/plugins/tmbill/discovery.ts
import Bonjour from 'bonjour-service';
import { EventEmitter } from 'events';
import type { TMBillService } from './types';

export class TMBillDiscovery extends EventEmitter {
  private bonjour: any;
  private browser: any;
  private services: Map<string, TMBillService> = new Map();
  private isActive = false;

  constructor(private serviceType: string = '_tmbill._tcp') {
    super();
  }

  start() {
    if (this.isActive) {
      console.log('⚠️  Discovery already active');
      return;
    }

    this.isActive = true;
    console.log('🔍 [TMBILL] Starting Bonjour discovery...');
    console.log(`   Service type: ${this.serviceType}`);
    
    this.bonjour = new Bonjour();
    
    // Try primary service type
    this.startBrowser(this.serviceType);
    
    // Also try common alternatives
    this.startBrowser('_http._tcp');
    this.startBrowser('_tcp');
  }

  private startBrowser(type: string) {
    console.log(`👀 [TMBILL] Watching for: ${type}`);
    
    const browser = this.bonjour.find({ type }, (service: any) => {
      console.log(`\n✅ [TMBILL] Service discovered!`);
      console.log('   Name:', service.name);
      console.log('   Type:', service.type);
      console.log('   Host:', service.host);
      console.log('   Port:', service.port);
      console.log('   Addresses:', service.addresses);
      console.log('   TXT:', service.txt);
      console.log('');
      
      const tmbillService: TMBillService = {
        name: service.name,
        host: service.host,
        port: service.port,
        addresses: service.addresses || [],
        type: service.type,
        txt: service.txt,
      };
      
      this.services.set(service.name, tmbillService);
      this.emit('service-found', tmbillService);
    });
    
    browser.on('down', (service: any) => {
      console.log(`❌ [TMBILL] Service lost: ${service.name}`);
      this.services.delete(service.name);
      this.emit('service-lost', service.name);
    });
  }

  stop() {
    if (!this.isActive) return;
    
    console.log('🛑 [TMBILL] Stopping discovery...');
    
    if (this.browser) {
      this.browser.stop();
    }
    
    if (this.bonjour) {
      this.bonjour.destroy();
    }
    
    this.services.clear();
    this.isActive = false;
  }

  getServices(): TMBillService[] {
    return Array.from(this.services.values());
  }

  isDiscovering(): boolean {
    return this.isActive;
  }
}