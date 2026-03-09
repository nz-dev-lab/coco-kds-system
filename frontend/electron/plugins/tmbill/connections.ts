import { io, Socket } from 'socket.io-client';
import type { TMBillService, TmbillMenuItem } from './types';
import type { 
  TMBillRunningTable, 
  TMBillKotSavedPayload, 
  TMBillBillSettledPayload, 
  TMBillKotCancelledPayload 
} from './transformer';

interface TMBillLoginResponse {
  status: number;
  message?: string;
  jwttoken?: string;
  token?: string;
  data?: {
    is_captain_app: number;
    is_kds_app: number;
    is_self_order: number;
    is_old_kot_enabled: number;
    is_terminal_app: number;
    assignedKitchedeps?: string;
  };
  storeDetails?: {
    store_id: string;        // ← string, confirmed from real data
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
  private storeId: string | null = null;
  private baseUrl: string | null = null;
  private assignedKitchedeps: string | null = null;
  private logCallback: LogCallback | null = null;
  private tmposId: string | null = null;
  private reconnectCallback: (() => void) | null = null;
  private hasConnectedOnce = false;

  constructor(logCallback?: LogCallback) {
    this.logCallback = logCallback || null;
  }

  private log(message: string, type: 'info' | 'error' | 'success' = 'info') {
    console.log(message);
    if (this.logCallback) {
      this.logCallback(message, type);
    }
  }

  async authenticate(service: TMBillService, username: string, password: string) {
    const url = service.txt?.url || `http://${service.host}:${service.port}/`;
    // Normalise: always ends with /
    this.baseUrl = url.endsWith('/') ? url : url + '/';

    this.log(`🔐 Authenticating with ${this.baseUrl}...`, 'info');

    try {
      const response = await fetch(`${this.baseUrl}login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json() as TMBillLoginResponse;

      if (data.status === 200 && (data.token || data.jwttoken)) {
        this.token = data.token || data.jwttoken || null;
        this.service = service;
        this.storeId = data.storeDetails?.store_id?.toString() || null;
        this.tmposId = (data.storeDetails as any)?.tmpos_id?.toString() || null;
        this.assignedKitchedeps = data.data?.assignedKitchedeps || null;
        this.log(`✅ Authentication successful! Store ID: ${this.storeId}`, 'success');
        return {
          success: true,
          token: this.token,
          storeId: this.storeId,
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
   * Fetch all running + settled orders from /api/kds/runningtables
   * Called after every socket event that signals an order change.
   *
   * Path: /api/kds/runningtables (confirmed working from curl_response)
   * Auth: Authorization: Bearer header
   * Params:
   *   store_id           — required
   *   showQsrorders=1    — include quick bill / QSR orders
   *   showOnlineorders=1 — include online orders
   *   showDigitalorders=1 — include digital/tablet orders
   *   showAllorders=true — skip billing_type filter
   */
  async fetchRunningTables(): Promise<{ tables: TMBillRunningTable[]; settledOrders: any[] }> {
    if (!this.baseUrl || !this.token || !this.storeId) {
      this.log('❌ Cannot fetch: missing baseUrl, token, or storeId', 'error');
      return { tables: [], settledOrders: [] };
    }

    try {
      const storeIdToUse = this.storeId || this.tmposId;
      this.log(`📋 Fetching running tables with store_id: ${storeIdToUse}`, 'info');

      let url = `${this.baseUrl}api/kds/runningtables?store_id=${storeIdToUse}&showQsrorders=1&showOnlineorders=1&showDigitalorders=1&showAllorders=true`;
      if (this.assignedKitchedeps) {
        url += `&assignedKitchedeps=${this.assignedKitchedeps}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      // Read body once as text — avoids "Body is unusable" double-read error
      const rawText = await response.text();
      this.log(`📡 Fetch status: ${response.status}, response: ${rawText.substring(0, 200)}`, 'info');

      const json = JSON.parse(rawText) as {
        status: number;
        data?: {
          tables: TMBillRunningTable[];
          settledOrders: any[];
        };
      };

      const tables = json?.data?.tables || [];
      const settledOrders = json?.data?.settledOrders || [];
      this.log(`📋 Fetched ${tables.length} running orders, ${settledOrders.length} settled orders from POS`, 'info');
      return { tables, settledOrders };
    } catch (error: any) {
      this.log(`❌ Failed to fetch running tables: ${error.message}`, 'error');
      return { tables: [], settledOrders: [] };
    }
  }

  connect() {
    if (!this.service || !this.token) {
      throw new Error('Must authenticate first');
    }

    const url = this.baseUrl || `http://${this.service.host}:${this.service.port}/`;
    this.log(`🔌 Connecting to Socket.IO at ${url}...`, 'info');

    this.socket = io(url, {
      query: { token: this.token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      if (!this.hasConnectedOnce) {
        this.hasConnectedOnce = true;
        this.log('✅ Connected to TMBILL POS Socket.IO', 'success');
      } else {
        this.log('🔄 Reconnected to TMBILL POS — re-syncing orders...', 'info');
        this.reconnectCallback?.();
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.log(`❌ Disconnected from TMBILL POS: ${reason}`, 'error');
    });

    this.socket.on('connect_error', (error) => {
      this.log(`❌ Connection error: ${error.message}`, 'error');
    });

    this.socket.onAny((eventName: string, ...args: any[]) => {
      this.log(`🔍 RAW EVENT: "${eventName}" → ${JSON.stringify(args).substring(0, 2000)}`, 'info');
    });

    return this.socket;
  }

  /**
   * Listen for new orders (kot-saved).
   * Socket payload is lean — no items. Fetch full data after receiving.
   * Callback receives notification + full { tables, settledOrders } result.
   */
  onNewOrder(callback: (notification: TMBillKotSavedPayload, result: { tables: TMBillRunningTable[]; settledOrders: any[] }) => void) {
    if (!this.socket) throw new Error('Not connected');

    this.log('👂 Listening for new orders (kot-saved)...', 'info');

    this.socket.on('kot-saved', async (rawData: any) => {
      const data: TMBillKotSavedPayload = typeof rawData === 'string'
        ? JSON.parse(rawData)
        : rawData;

      this.log(`📦 New order notification! KOT ID: ${data.insertedKOTid}`, 'success');

      // Wait 500ms for POS to finish writing to DB before fetching
      await new Promise(resolve => setTimeout(resolve, 500));

      const result = await this.fetchRunningTables();

      const matchedTable = result.tables.find(t => t.kot_number === data.insertedKOTid.toString());
      if (!matchedTable) {
        this.log(`⚠️ KOT ${data.insertedKOTid} — no matching table found after fetch`, 'info');
      } else {
        this.log(`✅ Found order: ${matchedTable.items?.length || 0} items, table: ${matchedTable.table_name}`, 'success');
      }

      callback(data, result);
    });
  }

  /**
   * Listen for order updates (kds-kot-updated).
   * Payload has no kot_id — re-fetch all running tables.
   * Callback receives full { tables, settledOrders } result.
   */
  onOrderUpdate(callback: (result: { tables: TMBillRunningTable[]; settledOrders: any[] }) => void) {
    if (!this.socket) throw new Error('Not connected');

    this.log('👂 Listening for order updates (kds-kot-updated)...', 'info');

    this.socket.on('kds-kot-updated', async (rawData: any) => {
      const data = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
      this.log(`🔄 Order updated for table_id: ${data.table_id || data.table}`, 'info');

      const result = await this.fetchRunningTables();
      callback(result);
    });
  }

  /**
   * Listen for quick-bill-placed.
   * Fires BEFORE DB write — 800ms delay before fetch to let DB catch up.
   * Callback receives full { tables, settledOrders } result.
   */
  onQuickBill(callback: (result: { tables: TMBillRunningTable[]; settledOrders: any[] }) => void) {
    if (!this.socket) throw new Error('Not connected');

    this.log('👂 Listening for quick bills (quick-bill-placed)...', 'info');

    this.socket.on('quick-bill-placed', async () => {
      this.log('⚡ Quick bill placed — fetching updated orders...', 'info');

      // 800ms delay — quick-bill-placed fires before DB write completes
      await new Promise(resolve => setTimeout(resolve, 800));

      const result = await this.fetchRunningTables();
      this.log(`⚡ Quick bill fetch complete — ${result.settledOrders.length} settled orders`, 'info');
      callback(result);
    });
  }

  onReconnected(callback: () => void) {
    this.reconnectCallback = callback;
  }

  /**
   * Listen for order removal events.
   *
   * bill-settled: table_id known (running table) or order_id only (quick bill)
   * websocket-kot-cancelled: exact kot_id known → renderer removes by id
   */
  onOrderRemoved(callback: (kotId: number | null, tableId: number | null, orderId: string | null) => void) {
    if (!this.socket) throw new Error('Not connected');

    this.log('👂 Listening for order removal events...', 'info');

    this.socket.on('bill-settled', (rawData: any) => {
      const data: TMBillBillSettledPayload = typeof rawData === 'string'
        ? JSON.parse(rawData)
        : rawData;

      this.log(`💳 Bill settled — table_id: ${data.table_id}, order_id: ${data.order_id}`, 'info');
      // Quick bills have order_id but no table_id; running tables have table_id
      callback(null, data.table_id ?? null, data.order_id?.toString() ?? null);
    });

    this.socket.on('websocket-kot-cancelled', (rawData: any) => {
      const data: TMBillKotCancelledPayload = typeof rawData === 'string'
        ? JSON.parse(rawData)
        : rawData;

      this.log(`🚫 Order cancelled: KOT ${data.kot_id} — removing from KDS`, 'info');
      callback(data.kot_id, null, null);
    });
  }

  /**
   * Send item status change to POS
   * isReady: true → status 2 (ready), false → status 0 (pending)
   */
  updateItemStatus(kotItemId: number, isReady: boolean) {
    if (!this.socket) throw new Error('Not connected');

    const status = isReady ? 2 : 0;
    this.log(`📤 Item ${kotItemId} → status ${status}`, 'info');

    this.socket.emit('item-status-changed', {
      kot_item_id: kotItemId,
      status,
    });
  }

  /**
   * Update a table KOT status (dine-in / takeaway / delivery).
   * 1. Persists to DB via PATCH /api/kds/kot
   * 2. After 400ms emits kds-kot-updated (triggers re-fetch on other KDS screens)
   *    and kds-kot-status-updated (updates status badge instantly on other screens)
   * Uses KOT_STATES_BYFLAG: 3=Preparing, 4=Ready, 5=Served
   */
  async updateTableKotStatus(kotId: number, tableId: number, tableName: string, status: number) {
    if (!this.socket || !this.baseUrl || !this.token) throw new Error('Not connected');
    this.log(`📤 Table KOT ${kotId} → status ${status}`, 'info');

    await fetch(`${this.baseUrl}api/kds/kot`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ kot_id: kotId, status }),
    });

    await new Promise(resolve => setTimeout(resolve, 400));

    this.socket.emit('kds-kot-updated', { table_id: tableId, kot_id: kotId, status, table_name: tableName });
    this.socket.emit('kds-kot-status-updated', { table_id: tableId, kot_id: kotId, status, table_name: tableName });
  }

  /**
   * Update a quick-bill / settled order KOT status.
   * 1. Persists to DB via PATCH /api/kds/orderkot
   * 2. Emits kds-kot-status-updated with forOrder: true
   * Uses BILL_STATES_BYFLAG: 4=Preparing, 5=Ready, 1=Served
   */
  async updateOrderKotStatus(orderId: string, status: number) {
    if (!this.socket || !this.baseUrl || !this.token) throw new Error('Not connected');
    this.log(`📤 Order KOT ${orderId} → status ${status}`, 'info');

    await fetch(`${this.baseUrl}api/kds/orderkot`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
      },
      body: JSON.stringify({ order_id: orderId, status }),
    });

    await new Promise(resolve => setTimeout(resolve, 400));

    this.socket.emit('kds-kot-status-updated', { forOrder: true, order_id: orderId, status });
  }

  disconnect() {
    if (this.socket) {
      this.log('🔌 Disconnecting...', 'info');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getToken(): string | null {
    return this.token;
  }

  getStoreId(): string | null {
    return this.storeId;
  }

  getBaseUrl(): string | null {
    return this.baseUrl;
  }

  async fetchMenu(): Promise<{ items: TmbillMenuItem[] }> {
    if (!this.baseUrl || !this.token || !this.storeId) {
      this.log(`❌ Cannot fetch menu: baseUrl=${this.baseUrl} token=${!!this.token} storeId=${this.storeId}`, 'error');
      return { items: [] };
    }
    try {
      // Try candidate paths in order — stop at the first that doesn't return status 404
      const storeIdToUse = this.storeId || this.tmposId;
      const candidates = [
        `${this.baseUrl}api/kds/menu?store_id=${storeIdToUse}`,
        `${this.baseUrl}api/menu?store_id=${storeIdToUse}`,
        `${this.baseUrl}menu?store_id=${storeIdToUse}`,
      ];

      let rawText = '';
      let json: any = null;

      for (const url of candidates) {
        this.log(`📋 Trying: GET ${url}`, 'info');
        const res = await fetch(url, { headers: { 'Authorization': `Bearer ${this.token}` } });
        rawText = await res.text();
        console.log(`[TMBILL fetchMenu] ${url} → HTTP ${res.status} | ${rawText}`);
        json = JSON.parse(rawText);
        if (json?.status !== 404) break;
      }

      // Handle multiple possible response shapes from TMBILL
      let rawItems: any[] | null = null;
      if (Array.isArray(json?.data?.items))       rawItems = json.data.items;      // { data: { items: [] } }
      else if (Array.isArray(json?.data))          rawItems = json.data;            // { data: [] }
      else if (Array.isArray(json?.items))         rawItems = json.items;           // { items: [] }
      else if (Array.isArray(json))                rawItems = json;                 // []

      if (rawItems) {
        const items: TmbillMenuItem[] = rawItems
          .filter(i => i.active !== 0)
          .map(i => ({
            item_id:    i.item_id,
            item_refid: i.item_refid ?? 0,
            title:      i.title ?? i.item_name ?? 'Unknown',
            active:     i.active ?? 1,
          }));
        this.log(`✅ Fetched ${items.length} menu items`, 'success');
        return { items };
      }
      this.log(`⚠️ Menu fetch: unrecognised response shape (status ${json?.status})`, 'error');
      return { items: [] };
    } catch (error: any) {
      this.log(`❌ Menu fetch error: ${error.message}`, 'error');
      return { items: [] };
    }
  }
}