// src/hooks/useKdsServerBroadcast.ts
// Watches all active orders in Redux and pushes them to the KDS mediator server
// whenever they change. The server then broadcasts station-filtered snapshots
// to every connected kitchen screen.
//
// Only active when stationView === 'all' (this machine is the KDS host/packing screen).
// On kitchen PCs (stationView !== 'all'), this hook does nothing — they are clients,
// not hosts, and useKdsClient handles receiving orders from the host.

import { useEffect, useRef } from 'react';
import { useAppSelector } from '../store/hooks';
import { selectAllActiveOrders } from '../store/selectors';
import { kdsLog, initKdsMainProcessLog } from '../utils/kdsLogger';

export function useKdsServerBroadcast() {
  const stationView = useAppSelector((s) => s.ui.settings.stationView ?? 'all');
  const allOrders = useAppSelector(selectAllActiveOrders);

  // Keep a ref so the client-connect listener always has the latest filtered orders
  // without stale closure issues.
  const latestFilteredRef = useRef<any[]>([]);

  // Start the KDS server on mount — only when this screen is the host.
  useEffect(() => {
    if (stationView !== 'all') return;
    if (!window.electron?.kdsServer) return;
    initKdsMainProcessLog();
    window.electron.kdsServer.start().catch(() => {});
  }, [stationView]);

  // When a new kitchen client connects, immediately re-push the latest filtered orders
  // so they don't get a stale cachedOrders snapshot from the server.
  useEffect(() => {
    if (stationView !== 'all') return;
    if (!window.electron?.kdsServer) return;
    const unsub = window.electron.kdsServer.onClientCountChanged((_count: number) => {
      if (latestFilteredRef.current.length >= 0) {
        window.electron!.kdsServer!.pushOrders(latestFilteredRef.current);
      }
    });
    return unsub;
  }, [stationView]);

  // Push orders to the server whenever they change (host only).
  useEffect(() => {
    if (stationView !== 'all') return;
    if (!window.electron?.kdsServer) return;
    // Strip completed/served orders before broadcasting — kitchen screens must not
    // display orders the ALL screen has already hidden. selectAllActiveOrders includes
    // TMBILL settledOrders (for the host's recall view) but those must not reach stations.
    const activeForBroadcast = allOrders.filter((o: any) => {
      if (o._source === 'tmbill') return o.status !== 'handover';
      return o.order_status !== 'delivered' && o.order_status !== 'picked_up';
    });
    latestFilteredRef.current = activeForBroadcast;
    const msg = `[KDS Broadcast] ${allOrders.length} → ${activeForBroadcast.length} after filter`;
    console.log(msg);
    kdsLog(msg, 'host');
    window.electron.kdsServer.pushOrders(activeForBroadcast);
  }, [allOrders, stationView]);
}
