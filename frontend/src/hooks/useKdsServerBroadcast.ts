// src/hooks/useKdsServerBroadcast.ts
// Watches all active orders in Redux and pushes them to the KDS mediator server
// whenever they change. The server then broadcasts station-filtered snapshots
// to every connected kitchen screen.
//
// Only active when stationView === 'all' (this machine is the KDS host/packing screen).
// On kitchen PCs (stationView !== 'all'), this hook does nothing — they are clients,
// not hosts, and useKdsClient handles receiving orders from the host.

import { useEffect } from 'react';
import { useAppSelector } from '../store/hooks';
import { selectAllActiveOrders } from '../store/selectors';

export function useKdsServerBroadcast() {
  const stationView = useAppSelector((s) => s.ui.settings.stationView ?? 'all');
  const allOrders = useAppSelector(selectAllActiveOrders);

  // Start the KDS server on mount — only when this screen is the host.
  useEffect(() => {
    if (stationView !== 'all') return;
    if (!window.electron?.kdsServer) return;
    window.electron.kdsServer.start().catch(() => {});
  }, [stationView]);

  // Push orders to the server whenever they change (host only).
  useEffect(() => {
    if (stationView !== 'all') return;
    if (!window.electron?.kdsServer) return;
    window.electron.kdsServer.pushOrders(allOrders);
  }, [allOrders, stationView]);
}
