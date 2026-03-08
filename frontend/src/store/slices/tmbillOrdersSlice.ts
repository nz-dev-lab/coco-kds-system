// store/slices/tmbillOrdersSlice.ts
// All TMBILL-specific Redux state lives here.
// CocoEats order state lives in ordersSlice.ts.
// Cross-slice selectors (e.g. selectAllActiveOrders) live in store/selectors.ts.

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
  CocoKDSOrder,
  transformTMBillSettledOrder,
} from '../../../electron/plugins/tmbill/transformer';

interface TmbillOrdersState {
  runningOrders: CocoKDSOrder[];   // from tables[] — normal KOTs
  settledOrders: CocoKDSOrder[];   // from settledOrders[] — quick bills (pre-transformed)
  bumpedOrders: CocoKDSOrder[];    // bumped (hidden) — retrievable via recall
  connected: boolean;              // true after successful socket connection
}

const initialState: TmbillOrdersState = {
  runningOrders: [],
  settledOrders: [],
  bumpedOrders: [],
  connected: false,
};

const tmbillOrdersSlice = createSlice({
  name: 'tmbill',
  initialState,
  reducers: {
    // ── Full refresh from tmbill:orders-refreshed event ──────────────────────
    // Fires on: kot-saved, kds-kot-updated, quick-bill-placed, post-removal refetch.
    // Replaces ALL tmbill orders — CocoEats orders (ordersSlice) untouched.
    setTmbillOrders: (
      state,
      action: PayloadAction<{ running: CocoKDSOrder[]; settled: any[] }>
    ) => {
      const bumpedIds = new Set(state.bumpedOrders.map(o => o.id));
      state.runningOrders = action.payload.running.filter(o => !bumpedIds.has(o.id));
      const runningIds = new Set(state.runningOrders.map(o => o.id));
      state.settledOrders = action.payload.settled
        .map(transformTMBillSettledOrder)
        .filter(o => !bumpedIds.has(o.id) && !runningIds.has(o.id));
    },

    // ── Remove running order by id (websocket-kot-cancelled) ─────────────────
    removeTmbillOrder: (state, action: PayloadAction<{ id: string }>) => {
      state.runningOrders = state.runningOrders.filter(o => o.id !== action.payload.id);
      state.bumpedOrders  = state.bumpedOrders.filter(o => o.id !== action.payload.id);
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
        if (item) item.isReady = !item.isReady;
      }
    },
  },
});

export const {
  setTmbillOrders,
  removeTmbillOrder,
  removeTmbillOrderByTableId,
  setTmbillConnected,
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

export default tmbillOrdersSlice.reducer;
