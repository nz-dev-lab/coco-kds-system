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

export interface TMBillPluginState {
  initialized: boolean;
  discovering: boolean;
  connected: boolean;
  authenticated: boolean; // NEW
  service: TMBillService | null;
  token: string | null; // NEW
  lastError: string | null;
}