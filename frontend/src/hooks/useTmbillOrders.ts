import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import {
  setTmbillOrders,
  removeTmbillOrder,
  removeTmbillOrderByTableId,
} from '@/store/slices/ordersSlice';

export function useTmbillOrders() {
  const dispatch = useAppDispatch();

  // ── Auto-connect on startup if saved credentials exist ─────────────────────
  useEffect(() => {
    const autoConnect = async () => {
      if (!window.tmbill) return;

      const state = await window.tmbill.getState();
      if (state.connected && state.authenticated) {
        // Already connected (e.g. reconnect after hot-reload) — just fetch
        await window.tmbill.fetchRunningTables();
        return;
      }

      const saved = localStorage.getItem('tmbill_credentials');
      if (!saved) return;

      try {
        const { service, username, password } = JSON.parse(saved);
        console.log('[TMBILL] Auto-connecting with saved credentials...');

        const authResult = await window.tmbill.authenticate(service, username, password);
        if (!authResult.success) {
          console.warn('[TMBILL] Auto-connect: auth failed —', authResult.error);
          return;
        }

        const connResult = await window.tmbill.connectSocket();
        if (!connResult.success) {
          console.warn('[TMBILL] Auto-connect: socket failed —', connResult);
          return;
        }

        await window.tmbill.fetchRunningTables();
        console.log('[TMBILL] Auto-connected successfully');
      } catch (e) {
        console.error('[TMBILL] Auto-connect failed:', e);
      }
    };

    autoConnect();
  }, []);

  useEffect(() => {
    // ── Full refresh (kot-saved, kds-kot-updated, quick-bill-placed, post-removal)
    const unsubRefresh = window.tmbill.onOrdersRefreshed((data) => {
      dispatch(setTmbillOrders({
        running: data.running,
        settled: data.settled,
      }));
    });

    // ── Cancelled order (websocket-kot-cancelled) — remove by id
    const unsubRemoved = window.tmbill.onOrderRemoved((data) => {
      dispatch(removeTmbillOrder({ id: data.id }));
    });

    // ── Settled order (bill-settled with table_id) — remove by tableId
    const unsubSettled = window.tmbill.onOrderSettled((data) => {
      dispatch(removeTmbillOrderByTableId({ tableId: data.tableId }));
    });

    return () => {
      unsubRefresh?.();
      unsubRemoved?.();
      unsubSettled?.();
    };
  }, [dispatch]);
}