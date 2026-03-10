// store/selectors.ts
// Cross-slice selectors that need state from multiple slices.

import type { RootState } from '.';
import type { DisplayOrder } from '@/types/display-order.type';

/**
 * All orders currently visible on the dashboard — CocoEats + TMBILL running + settled.
 * Bumped orders from either source are excluded (they live in their respective bumped lists).
 *
 * CocoEats item.isReady is sourced from the persistent readyItemIds map (not the raw order
 * data) so it survives fetchOrders() replacing the orders array.
 */
export const selectAllActiveOrders = (state: RootState): DisplayOrder[] => [
  ...state.orders.orders.map(o => {
    const readyIds = state.orders.readyItemIds[o.id];
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
  ...state.tmbill.runningOrders,
  ...state.tmbill.settledOrders,
];
