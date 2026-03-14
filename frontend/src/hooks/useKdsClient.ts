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
import { kdsLog } from '../utils/kdsLogger';

const KDS_PORT = 7654;
const RECONNECT_DELAY_MS = 3000;

export interface KdsClientState {
  orders: any[];
  connected: boolean;
  /** True when stationView !== 'all' AND kdsHostIp is set — i.e. client mode is active */
  active: boolean;
  /** True for 1500ms after each connect — orders may still be settling, suppress rendering */
  stabilizing: boolean;
}

export function useKdsClient(): KdsClientState {
  const stationView = useAppSelector((s) => s.ui.settings.stationView ?? 'all');
  const kdsHostIp   = useAppSelector((s) => s.ui.settings.kdsHostIp ?? null);

  const [orders,      setOrders]      = useState<any[]>([]);
  const [connected,   setConnected]   = useState(false);
  const [stabilizing, setStabilizing] = useState(false);

  const wsRef            = useRef<WebSocket | null>(null);
  const reconnectRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef       = useRef(true);
  const prevOrdersCount  = useRef(0);
  const stabilizeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = stationView !== 'all' && !!kdsHostIp;

  useEffect(() => {
    mountedRef.current = true;
    if (!active) {
      kdsLog(`[KDS Client] inactive — stationView='${stationView}' kdsHostIp=${kdsHostIp ?? 'not set'}`, 'client', 'warn');
      setOrders([]);
      setConnected(false);
      return;
    }
    kdsLog(`[KDS Client] activating — stationView='${stationView}' host=${kdsHostIp}`, 'client');

    function connect() {
      if (!mountedRef.current) return;

      const ws = new WebSocket(`ws://${kdsHostIp}:${KDS_PORT}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) { ws.close(); return; }
        setConnected(true);
        // Brief stabilization window — absorbs rapid successive broadcasts from host
        // (e.g. TMBILL poll settling orders within 1s of connect) before rendering.
        setStabilizing(true);
        if (stabilizeTimer.current) clearTimeout(stabilizeTimer.current);
        stabilizeTimer.current = setTimeout(() => {
          if (mountedRef.current) setStabilizing(false);
        }, 1500);
        ws.send(JSON.stringify({ type: 'register', stationView }));
        const msg = `[KDS Client] Connected to ws://${kdsHostIp}:${KDS_PORT} as ${stationView}`;
        console.log(msg);
        kdsLog(msg, 'client');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string);
          if (msg.type === 'orders_update') {
            const incoming = msg.orders ?? [];
            const logMsg = `[KDS Client] orders_update: ${incoming.length} orders (prev: ${prevOrdersCount.current})`;
            console.log(logMsg);
            kdsLog(logMsg, 'client');
            prevOrdersCount.current = incoming.length;
            setOrders(incoming);
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = () => {
        setConnected(false);
        if (mountedRef.current) {
          const msg = `[KDS Client] Disconnected — reconnecting in ${RECONNECT_DELAY_MS}ms`;
          console.log(msg);
          kdsLog(msg, 'client', 'warn');
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
      if (stabilizeTimer.current) clearTimeout(stabilizeTimer.current);
      wsRef.current?.close();
    };
  }, [active, kdsHostIp, stationView]);

  return { orders, connected, active, stabilizing };
}
