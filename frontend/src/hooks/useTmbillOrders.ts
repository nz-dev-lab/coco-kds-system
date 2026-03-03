import { useEffect } from 'react';
import { useAppDispatch } from '@/store/hooks';
import {
  setTmbillOrders,
  removeTmbillOrder,
  removeTmbillOrderByTableId,
} from '@/store/slices/ordersSlice';

export function useTmbillOrders() {
  const dispatch = useAppDispatch();

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