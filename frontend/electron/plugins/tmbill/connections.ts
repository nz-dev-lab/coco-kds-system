import { io, Socket } from 'socket.io-client';
import type { TMBillService } from './types';

interface TMBillLoginResponse {
  status: number;
  message?: string;
  jwttoken?: string;
  data?: {
    is_captain_app: number;
    is_kds_app: number;
    is_self_order: number;
    is_old_kot_enabled: number;
    is_terminal_app: number;
  };
  storeDetails?: {
    store_id: number;
    store_name: string;
    username: string;
  };
  settings?: any;
}

type LogCallback = (message: string, type?: 'info' | 'error' | 'success') => void;

export class TMBillConnection {
  private socket: Socket | null = null;
  private service: TMBillService | null = null;
  private token: string | null = null;
  private logCallback: LogCallback | null = null;

  constructor(logCallback?: LogCallback) {
    this.logCallback = logCallback || null;
  }

  private log(message: string, type: 'info' | 'error' | 'success' = 'info') {
    console.log(message); // Still log to console for debugging
    if (this.logCallback) {
      this.logCallback(message, type);
    }
  }

  /**
   * Authenticate with TMBILL POS and get JWT token
   */
  async authenticate(service: TMBillService, username: string, password: string) {
    const url = service.txt?.url || `http://${service.host}:${service.port}/`;
    
    this.log(`🔐 Authenticating with ${url}...`, 'info');
    
    try {
      const response = await fetch(`${url}login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json() as TMBillLoginResponse;
      
      if (data.status === 200 && data.jwttoken) {
        this.token = data.jwttoken;
        this.service = service;
        this.log(`✅ Authentication successful! User: ${username}`, 'success');
        return { 
          success: true, 
          token: data.jwttoken,
          storeDetails: data.storeDetails 
        };
      } else {
        this.log(`❌ Authentication failed: ${data.message}`, 'error');
        return { success: false, error: data.message };
      }
    } catch (error: any) {
      this.log(`❌ Authentication error: ${error.message}`, 'error');
      return { success: false, error: error.message };
    }
  }

  /**
   * Connect to TMBILL POS Socket.IO server
   */
  connect() {
    if (!this.service || !this.token) {
      const error = 'Must authenticate first';
      this.log(`❌ ${error}`, 'error');
      throw new Error(error);
    }

    const url = this.service.txt?.url || `http://${this.service.host}:${this.service.port}/`;
    
    this.log(`🔌 Connecting to Socket.IO at ${url}...`, 'info');
    
    this.socket = io(url, {
      query: { token: this.token },
      transports: ['websocket', 'polling'], // Try websocket first, fallback to polling
    });

    this.socket.on('connect', () => {
      this.log('✅ Connected to TMBILL POS Socket.IO', 'success');
    });

    this.socket.on('disconnect', (reason) => {
      this.log(`❌ Disconnected from TMBILL POS: ${reason}`, 'error');
    });

    this.socket.on('connect_error', (error) => {
      this.log(`❌ Connection error: ${error.message}`, 'error');
    });

    return this.socket;
  }

  /**
   * Listen for new orders from TMBILL POS
   */
  onNewOrder(callback: (order: any) => void) {
    if (!this.socket) {
      const error = 'Not connected';
      this.log(`❌ ${error}`, 'error');
      throw new Error(error);
    }
    
    this.log('👂 Listening for new orders (kot-saved event)...', 'info');
    
    // Listen for the KOT_SAVED event (new order)
    this.socket.on('kot-saved', (data) => {
      this.log(`📦 New order received! KOT ID: ${data.kot_id || 'unknown'}`, 'success');
      callback(data);
    });
  }

  /**
   * Listen for order updates
   */
  onOrderUpdate(callback: (order: any) => void) {
    if (!this.socket) {
      const error = 'Not connected';
      this.log(`❌ ${error}`, 'error');
      throw new Error(error);
    }
    
    this.log('👂 Listening for order updates (kds-kot-updated event)...', 'info');
    
    this.socket.on('kds-kot-updated', (data) => {
      this.log(`🔄 Order updated! KOT ID: ${data.kot_id || 'unknown'}`, 'info');
      callback(data);
    });
  }

  /**
   * Send item status change to POS
   */
  updateItemStatus(kotItemId: number, status: string) {
    if (!this.socket) {
      const error = 'Not connected';
      this.log(`❌ ${error}`, 'error');
      throw new Error(error);
    }
    
    this.log(`📤 Sending item status update: Item ${kotItemId} → ${status}`, 'info');
    
    this.socket.emit('item-status-changed', {
      kot_item_id: kotItemId,
      status: status, // 'ready', 'preparing', etc.
    });
  }

  disconnect() {
    if (this.socket) {
      this.log('🔌 Disconnecting from TMBILL POS...', 'info');
      this.socket.disconnect();
      this.socket = null;
      this.log('✅ Disconnected', 'success');
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return this.token;
  }
}