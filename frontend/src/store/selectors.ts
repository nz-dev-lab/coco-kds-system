// store/selectors.ts
// Cross-slice selectors that need state from multiple slices.

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '.';
import type { DisplayOrder } from '@/types/display-order.type';

/**
 * All orders currently visible on the dashboard — CocoEats + TMBILL running + settled.
 * Bumped orders from either source are excluded (they live in their respective bumped lists).
 *
 * CocoEats item.isReady is sourced from the persistent readyItemIds map (not the raw order
 * data) so it survives fetchOrders() replacing the orders array.
 *
 * Memoized with createSelector — only recomputes when orders, readyItemIds, or TMBILL
 * order arrays actually change (reference equality). This prevents cascading re-renders
 * triggered by unrelated Redux actions.
 */
export const selectAllActiveOrders = createSelector(
  (state: RootState) => state.orders.orders,
  (state: RootState) => state.orders.readyItemIds,
  (state: RootState) => state.tmbill.runningOrders,
  (state: RootState) => state.tmbill.settledOrders,
  (orders, readyItemIds, runningOrders, settledOrders): DisplayOrder[] => [
    ...orders.map(o => {
      const readyIds = readyItemIds[o.id];
      if (!readyIds || readyIds.length === 0) return { ...o, _source: 'cocoeats' as const };
      return {
        ...o,
        _source: 'cocoeats' as const,
        items: o.items?.map(item => ({
          ...item,
          isReady: readyIds.includes(item.id),
        })),
      };
    }),
    ...runningOrders,
    ...settledOrders,
  ],
);
