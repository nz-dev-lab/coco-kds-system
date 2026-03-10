// src/hooks/useKdsClient.ts
// WebSocket client for kitchen screens.
// Connects to the KDS host PC (the packing screen running stationView = 'all')
// and receives station-filtered order snapshots from it.
//
// Only active when:
//   - stationView !== 'all'  (this is a station screen, not the host)
//   - kdsHostIp is configured in Settings
//
// When kdsHostIp is not set the hook returns empty state and the Dashboard
// falls back to fetching orders from the CocoEats API directly (standalone/dev mode).

import { useState, useEffect, useRef } from 'react';
import { useAppSelector } from '../store/hooks';

const KDS_PORT = 7654;
const RECONNECT_DELAY_MS = 3000;

export interface KdsClientState {
  orders: any[];
  connected: boolean;
  /** True when stationView !== 'all' AND kdsHostIp is set — i.e. client mode is active */
  active: boolean;
}

export function useKdsClient(): KdsClientState {
  const stationView = useAppSelector((s) => s.ui.settings.stationView ?? 'all');
  const kdsHostIp   = useAppSelector((s) => s.ui.settings.kdsHostIp ?? null);

  const [orders,    setOrders]    = useState<any[]>([]);
  const [connected, setConnected] = useState(false);

  const wsRef            = useRef<WebSocket | null>(null);
  const reconnectRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef       = useRef(true);

  const active = stationView !== 'all' && !!kdsHostIp;

  useEffect(() => {
    mountedRef.current = true;
    if (!active) {
      setOrders([]);
      setConnected(false);
      return;
    }

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(`ws://${kdsHostIp}:${KDS_PORT}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        ws.send(JSON.stringify({ type: 'register', stationView }));
        console.log(`[KDS Client] Connected to ws://${kdsHostIp}:${KDS_PORT} as ${stationView}`);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'orders_update') setOrders(msg.orders ?? []);
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (mountedRef.current) {
          console.log(`[KDS Client] Disconnected — reconnecting in ${RECONNECT_DELAY_MS}ms`);
          reconnectRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      ws.onerror = () => {
        // onclose fires after onerror, which handles reconnect
        ws.close();
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
    };
  }, [active, kdsHostIp, stationView]);

  return { orders, connected, active };
}
