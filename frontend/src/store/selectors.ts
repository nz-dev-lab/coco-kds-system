// store/selectors.ts
// Cross-slice selectors that need state from multiple slices.

import type { RootState } from '.';
import type { DisplayOrder } from '@/types/display-order.type';

/**
 * All orders currently visible on the dashboard — CocoEats + TMBILL running + settled.
 * Bumped orders from either source are excluded (they live in their respective bumped lists).
 */
export const selectAllActiveOrders = (state: RootState): DisplayOrder[] => [
  ...state.orders.orders.map(o => ({ ...o, _source: 'cocoeats' as const })),
  ...state.tmbill.runningOrders,
  ...state.tmbill.settledOrders,
];
