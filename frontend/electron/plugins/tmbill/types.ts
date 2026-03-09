export interface TMBillService {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  type: string;
  txt?: Record<string, any>;
}

export interface TMBillPluginConfig {
  enabled: boolean;
  serviceType: string;
  autoConnect: boolean;
}

export interface TmbillMenuItem {
  item_id: number;
  item_refid: number;
  title: string;
  active: number;
}

export interface TMBillPluginState {
  initialized: boolean;
  discovering: boolean;
  connected: boolean;
  authenticated: boolean;
  service: TMBillService | null;
  token: string | null;
  storeId: string | null;    // ← NEW: needed for /kds/runningtables calls
  baseUrl: string | null;   // ← NEW: stored after auth so connection.ts can fetch
  lastError: string | null;
}