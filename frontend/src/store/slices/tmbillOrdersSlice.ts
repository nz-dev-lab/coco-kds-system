// store/slices/tmbillOrdersSlice.ts
// All TMBILL-specific Redux state lives here.
// CocoEats order state lives in ordersSlice.ts.
// Cross-slice selectors (e.g. selectAllActiveOrders) live in store/selectors.ts.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  CocoKDSOrder,
  transformTMBillSettledOrder,
} from '../../../electron/plugins/tmbill/transformer';
import type { TmbillMenuItem } from '../../../electron/plugins/tmbill/types';

interface TmbillOrdersState {
  runningOrders: CocoKDSOrder[];   // from tables[] — normal KOTs
  settledOrders: CocoKDSOrder[];   // from settledOrders[] — quick bills (pre-transformed)
  bumpedOrders: CocoKDSOrder[];    // bumped (hidden) — retrievable via recall
  connected: boolean;              // true after successful socket connection
  menu: TmbillMenuItem[];          // full item list from /menu endpoint
  fullyReadyOrderIds: string[];    // orders where kitchen explicitly marked ALL items done
                                   // (via "Mark as Ready" button). Survives TMBILL refreshes.
                                   // Cleared per-order when user unchecks any item.
}

const initialState: TmbillOrdersState = {
  runningOrders: [],
  settledOrders: [],
  bumpedOrders: [],
  connected: false,
  menu: [],
  fullyReadyOrderIds: [],
};

// ── Shared helper: build isReady preservation map for an order list ───────────
// Keys stored per item: item.id, f:{food_id}, n:{name} — multiple fallbacks
// because TMBILL may change kot_item_id on KOT status advancement.
function buildReadyByOrder(orders: CocoKDSOrder[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.isReady) continue;
      if (!map.has(order.id)) map.set(order.id, new Set());
      const keys = map.get(order.id)!;
      keys.add(item.id);
      if (item.food_id && item.food_id !== '0') keys.add(`f:${item.food_id}`);
      keys.add(`n:${item.name.toLowerCase()}`);
    }
  }
  return map;
}

// ── Shared helper: apply preservation to a single order ──────────────────────
function applyReadyPreservation(
  order: CocoKDSOrder,
  keys: Set<string>,
): CocoKDSOrder {
  return {
    ...order,
    items: order.items.map(item => {
      const isPreserved =
        keys.has(item.id) ||
        (item.food_id && item.food_id !== '0' && keys.has(`f:${item.food_id}`)) ||
        keys.has(`n:${item.name.toLowerCase()}`);
      return { ...item, isReady: isPreserved ? true : item.isReady };
    }),
  };
}

const tmbillOrdersSlice = createSlice({
  name: 'tmbill',
  initialState,
  reducers: {
    // ── Full refresh from tmbill:orders-refreshed event ──────────────────────
    // Fires on: kot-saved, kds-kot-updated, quick-bill-placed, post-removal refetch.
    // Replaces ALL tmbill orders — CocoEats orders (ordersSlice) untouched.
    //
    // isReady preservation strategy (two layers):
    //
    // Layer 1 — fullyReadyOrderIds: orders where "Mark as Ready" was clicked.
    //   All items forced to isReady=true unconditionally, bypassing ID matching.
    //   Cleared when user unchecks any item. This is the primary mechanism.
    //
    // Layer 2 — multi-key item matching: for individually checked items.
    //   Reads existing isReady=true items from state, stores keys (item.id,
    //   food_id, name), then re-applies them to new payload items.
    //   Handles TMBILL resetting orderstatus on kds-kot-updated events.
    setTmbillOrders: (
      state,
      action: PayloadAction<{ running: CocoKDSOrder[]; settled: any[] }>
    ) => {
      const bumpedIds = new Set(state.bumpedOrders.map(o => o.id));
      const fullyReadyIds = new Set(state.fullyReadyOrderIds);

      // Layer 2 preservation maps (item-key-based, for individually checked items)
      const runningReadyByOrder  = buildReadyByOrder(state.runningOrders);
      const settledReadyByOrder  = buildReadyByOrder(state.settledOrders);

      state.runningOrders = action.payload.running
        .filter(o => !bumpedIds.has(o.id))
        .map(o => {
          // Layer 1: order was fully marked ready — force all items true
          if (fullyReadyIds.has(o.id)) {
            return { ...o, items: o.items.map(item => ({ ...item, isReady: true })) };
          }
          // Layer 2: preserve individually checked items
          const keys = runningReadyByOrder.get(o.id);
          if (!keys) return o;
          return applyReadyPreservation(o, keys);
        });

      const runningIds = new Set(state.runningOrders.map(o => o.id));
      state.settledOrders = action.payload.settled
        .map(transformTMBillSettledOrder)
        .filter(o => !bumpedIds.has(o.id) && !runningIds.has(o.id))
        .map(o => {
          // Layer 1: order was fully marked ready — force all items true
          if (fullyReadyIds.has(o.id)) {
            return { ...o, items: o.items.map(item => ({ ...item, isReady: true })) };
          }
          // Layer 2: preserve individually checked items
          const keys = settledReadyByOrder.get(o.id);
          if (!keys) return o;
          return applyReadyPreservation(o, keys);
        });

      // Prune fullyReadyOrderIds to orders that are still present (prevents unbounded growth)
      const stillPresent = new Set([
        ...state.runningOrders.map(o => o.id),
        ...state.settledOrders.map(o => o.id),
        ...state.bumpedOrders.map(o => o.id),
      ]);
      state.fullyReadyOrderIds = state.fullyReadyOrderIds.filter(id => stillPresent.has(id));
    },

    // ── Remove running order by id (websocket-kot-cancelled) ─────────────────
    removeTmbillOrder: (state, action: PayloadAction<{ id: string }>) => {
      state.runningOrders = state.runningOrders.filter(o => o.id !== action.payload.id);
      state.bumpedOrders  = state.bumpedOrders.filter(o => o.id !== action.payload.id);
      state.fullyReadyOrderIds = state.fullyReadyOrderIds.filter(id => id !== action.payload.id);
    },

    // ── Remove running order by tableId (bill-settled) ────────────────────────
    // bill-settled only gives table_id — match against _tmbill_table_id
    removeTmbillOrderByTableId: (state, action: PayloadAction<{ tableId: number }>) => {
      state.runningOrders = state.runningOrders.filter(
        o => o._tmbill_table_id !== action.payload.tableId
      );
      state.bumpedOrders = state.bumpedOrders.filter(
        o => o._tmbill_table_id !== action.payload.tableId
      );
    },

    // ── Connection state ──────────────────────────────────────────────────────
    setTmbillConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },

    // ── Menu items from /menu endpoint ────────────────────────────────────────
    setTmbillMenu: (state, action: PayloadAction<TmbillMenuItem[]>) => {
      state.menu = action.payload;
    },

    // ── Bump — hide order from dashboard, move to bumped list ────────────────
    // No status sent to POS. Order's current status is preserved.
    // Quick bills (settledOrders) and table KOTs (runningOrders) both supported.
    bumpTmbillOrder: (state, action: PayloadAction<{ id: string }>) => {
      const runningIdx = state.runningOrders.findIndex(o => o.id === action.payload.id);
      if (runningIdx !== -1) {
        const [order] = state.runningOrders.splice(runningIdx, 1);
        (order as any)._bumped_from = 'running';
        state.bumpedOrders.unshift(order);
        return;
      }
      const settledIdx = state.settledOrders.findIndex(o => o.id === action.payload.id);
      if (settledIdx !== -1) {
        const [order] = state.settledOrders.splice(settledIdx, 1);
        (order as any)._bumped_from = 'settled';
        state.bumpedOrders.unshift(order);
      }
    },

    // ── Recall — move bumped order back to the active dashboard ──────────────
    // Restores to the original list (running or settled) it came from.
    recallTmbillOrder: (state, action: PayloadAction<{ id: string }>) => {
      const idx = state.bumpedOrders.findIndex(o => o.id === action.payload.id);
      if (idx !== -1) {
        const [order] = state.bumpedOrders.splice(idx, 1);
        if ((order as any)._bumped_from === 'settled') {
          state.settledOrders.unshift(order);
        } else {
          state.runningOrders.unshift(order);
        }
      }
    },

    // ── Item ready toggle (local UI only — IPC call handled separately) ───────
    toggleTmbillItemReady: (
      state,
      action: PayloadAction<{ orderId: string; itemId: string }>
    ) => {
      const order =
        state.runningOrders.find(o => o.id === action.payload.orderId) ??
        state.settledOrders.find(o => o.id === action.payload.orderId);
      if (order) {
        const item = order.items.find(i => i.id === action.payload.itemId);
        if (item) {
          item.isReady = !item.isReady;
          // Unchecking any item removes the order from fullyReadyOrderIds so it
          // can reappear on the kitchen screen.
          if (!item.isReady) {
            state.fullyReadyOrderIds = state.fullyReadyOrderIds.filter(
              id => id !== action.payload.orderId
            );
          }
        }
      }
    },

    // ── Mark all items ready for an order (explicit status action) ────────────
    // Dispatched before TMBILL API calls (e.g. Mark as Ready, Complete).
    // Searches both runningOrders and settledOrders (quick bills live in settled).
    // Adds orderId to fullyReadyOrderIds so ALL subsequent setTmbillOrders calls
    // keep items isReady=true without relying on ID matching.
    markAllTmbillItemsReady: (
      state,
      action: PayloadAction<{ orderId: string }>
    ) => {
      const order =
        state.runningOrders.find(o => o.id === action.payload.orderId) ??
        state.settledOrders.find(o => o.id === action.payload.orderId);
      if (order) {
        for (const item of order.items) item.isReady = true;
      }
      if (!state.fullyReadyOrderIds.includes(action.payload.orderId)) {
        state.fullyReadyOrderIds.push(action.payload.orderId);
      }
    },
  },
});

export const {
  setTmbillOrders,
  removeTmbillOrder,
  removeTmbillOrderByTableId,
  setTmbillConnected,
  markAllTmbillItemsReady,
  setTmbillMenu,
  bumpTmbillOrder,
  recallTmbillOrder,
  toggleTmbillItemReady,
} = tmbillOrdersSlice.actions;

// ── Selectors ────────────────────────────────────────────────────────────────
export const selectTmbillConnected = (state: { tmbill: TmbillOrdersState }) =>
  state.tmbill.connected;

export const selectTmbillRunningOrders = (state: { tmbill: TmbillOrdersState }) =>
  state.tmbill.runningOrders;

export const selectTmbillSettledOrders = (state: { tmbill: TmbillOrdersState }) =>
  state.tmbill.settledOrders;

export const selectTmbillBumpedOrders = (state: { tmbill: TmbillOrdersState }) =>
  state.tmbill.bumpedOrders;

export const selectTmbillMenu = (state: { tmbill: TmbillOrdersState }) =>
  state.tmbill.menu;

export default tmbillOrdersSlice.reducer;
