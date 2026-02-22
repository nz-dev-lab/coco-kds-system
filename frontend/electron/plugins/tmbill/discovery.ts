// electron/plugins/tmbill/discovery.ts
import Bonjour from 'bonjour-service';
import { EventEmitter } from 'events';
import type { TMBillService } from './types';

export class TMBillDiscovery extends EventEmitter {
  private bonjour: any;
  private browsers: any[] = [];
  private services: Map<string, TMBillService> = new Map();
  private isActive = false;

  constructor(private serviceType: string = '_http._tcp') {  // ✅ Changed default
    super();
  }

  start() {
    if (this.isActive) {
      console.log('⚠️  [TMBILL Discovery] Already active');
      return;
    }

    this.isActive = true;
    console.log('\n🔍 [TMBILL Discovery] Starting Bonjour discovery...');
    console.log(`   Primary service type: ${this.serviceType}`);
    
    this.bonjour = new Bonjour();
    
    // Search for _http._tcp (TMBILL's actual service type)
    this.startBrowser('_http._tcp');
    
    // Also try alternatives just in case
    const alternatives = ['_tcp', '_tmbill._tcp'];
    alternatives.forEach(type => {
      this.startBrowser(type);
    });

    console.log('👂 [TMBILL Discovery] Listening for services...\n');
  }

  private startBrowser(type: string) {
    console.log(`   👀 Watching for: ${type}`);
    
    const browser = this.bonjour.find({ type }, (service: any) => {
      // ✅ Filter for TMBILL services
      const isTMBill = service.name && (
        service.name.includes('TMBill Altantic') ||  // Their typo
        service.name.includes('TMBill Atlantic') ||  // Correct spelling
        service.name.toLowerCase().includes('tmbill')
      );
      
      // Skip non-TMBILL _http._tcp services (there are many)
      if (!isTMBill && type === '_http._tcp') {
        console.log(`   ⏭️  Skipping non-TMBILL service: ${service.name}`);
        return;
      }
      
      console.log(`\n✅ [TMBILL Discovery] Service discovered!`);
      console.log('   ├─ Name:', service.name);
      console.log('   ├─ Type:', service.type);
      console.log('   ├─ Host:', service.host);
      console.log('   ├─ Port:', service.port);
      console.log('   ├─ Addresses:', service.addresses);
      if (service.txt && Object.keys(service.txt).length > 0) {
        console.log('   ├─ TXT:', JSON.stringify(service.txt));
        console.log('   └─ Store Name:', service.txt.storeName);  // ✅ TMBILL includes this
      }
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
      const isTMBill = service.name && service.name.toLowerCase().includes('tmbill');
      if (isTMBill) {
        console.log(`\n❌ [TMBILL Discovery] Service lost: ${service.name}\n`);
        this.services.delete(service.name);
        this.emit('service-lost', service.name);
      }
    });

    this.browsers.push(browser);
  }

  stop() {
    if (!this.isActive) return;
    
    console.log('\n🛑 [TMBILL Discovery] Stopping discovery...\n');
    
    this.browsers.forEach(browser => {
      try {
        browser.stop();
      } catch (error) {
        console.error('Error stopping browser:', error);
      }
    });
    this.browsers = [];
    
    if (this.bonjour) {
      try {
        this.bonjour.destroy();
      } catch (error) {
        console.error('Error destroying bonjour:', error);
      }
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