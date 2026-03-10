// store/slices/ordersSlice.ts
// CocoEats order state only.
// TMBILL state lives in tmbillOrdersSlice.ts.
// Cross-slice selectors (selectAllActiveOrders) live in store/selectors.ts.

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { Order } from '@/types/order.type';

interface OrdersState {
  orders: Order[];
  cocoeatsBumpedOrders: Order[];  // bumped (hidden) CocoEats orders — retrievable via recall
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  newOrderIds: string[];
  // Persistent item-ready state — survives fetchOrders() replacing the orders array.
  // Key: orderId, Value: array of itemIds that have been marked ready.
  readyItemIds: Record<string, string[]>;
}

const initialState: OrdersState = {
  orders: [],
  cocoeatsBumpedOrders: [],
  loading: false,
  error: null,
  lastFetch: null,
  newOrderIds: [],
  readyItemIds: {},
};

// Fetch orders
export const fetchOrders = createAsyncThunk(
  'orders/fetchOrders',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const token = state.auth.token;

      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/kds/orders`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log('Fetched orders:', response.data);

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch orders');
    }
  }
);

// Update order status
export const updateOrderStatus = createAsyncThunk(
  'orders/updateStatus',
  async (
    { orderId, status, processingTime }: { orderId: string; status: string; processingTime?: string },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as any;
      const token = state.auth.token;

      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/kds/orders/${orderId}/status`,
        { order_status: status, processing_time: processingTime },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update order');
    }
  }
);

// Assign delivery man to order
export const assignDeliveryMan = createAsyncThunk(
  'orders/assignDeliveryMan',
  async (
    { orderId, deliveryManId }: { orderId: string; deliveryManId: number },
    { getState, rejectWithValue }
  ) => {
    try {
      const state = getState() as any;
      const token = state.auth.token;

      console.log('🚚 Assigning delivery man:', { orderId, deliveryManId });

      const response = await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/kds/orders/${orderId}/assign-delivery-man`,
        { delivery_man_id: deliveryManId },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      console.log('✅ Delivery man assigned:', response.data);

      return response.data;
    } catch (error: any) {
      console.error('❌ Failed to assign delivery man:', error);
      return rejectWithValue(
        error.response?.data?.message || 'Failed to assign delivery man'
      );
    }
  }
);

// Bump order (mark as picked up for delivery, or completed for takeaway/dine-in)
export const bumpOrder = createAsyncThunk(
  'orders/bumpOrder',
  async ({ orderId, orderType }: { orderId: string; orderType: string }, { rejectWithValue }) => {
    try {
      console.log('🔄 Bumping order:', orderId, orderType);
      return { orderId, orderType, bumpedAt: new Date().toISOString() };
    } catch (error: any) {
      console.error('❌ Failed to bump order:', error);
      return rejectWithValue(error.message || 'Failed to bump order');
    }
  }
);

const ordersSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    addOrder: (state, action: PayloadAction<Order>) => {
      const exists = state.orders.some(o => o.id === action.payload.id);
      if (!exists) {
        state.orders.unshift(action.payload);
        state.newOrderIds.push(action.payload.id);
      }
    },

    updateOrder: (state, action: PayloadAction<Order>) => {
      const index = state.orders.findIndex(o => o.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = action.payload;
      }
    },

    toggleItemReady: (state, action: PayloadAction<{ orderId: string; itemId: string }>) => {
      const { orderId, itemId } = action.payload;
      const current = state.readyItemIds[orderId] ?? [];
      if (current.includes(itemId)) {
        state.readyItemIds[orderId] = current.filter(id => id !== itemId);
      } else {
        state.readyItemIds[orderId] = [...current, itemId];
      }
    },

    markOrderAsViewed: (state, action: PayloadAction<string>) => {
      state.newOrderIds = state.newOrderIds.filter(id => id !== action.payload);
    },

    // ── Bump — hide order from dashboard, move to bumped list ────────────────
    bumpCocoeatsOrder: (state, action: PayloadAction<{ id: string }>) => {
      const idx = state.orders.findIndex(o => o.id === action.payload.id);
      if (idx !== -1) {
        const [order] = state.orders.splice(idx, 1);
        state.cocoeatsBumpedOrders.unshift(order);
        delete state.readyItemIds[action.payload.id];
      }
    },

    // ── Recall — move bumped order back to the active dashboard ──────────────
    recallCocoeatsOrder: (state, action: PayloadAction<{ id: string }>) => {
      const idx = state.cocoeatsBumpedOrders.findIndex(o => o.id === action.payload.id);
      if (idx !== -1) {
        const [order] = state.cocoeatsBumpedOrders.splice(idx, 1);
        state.orders.unshift(order);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch orders
      .addCase(fetchOrders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false;
        // Filter out locally bumped orders so they don't pop back on refresh
        const bumpedIds = new Set(state.cocoeatsBumpedOrders.map((o: Order) => o.id));
        state.orders = action.payload.filter((o: Order) => !bumpedIds.has(o.id));
        state.lastFetch = Date.now();
        // Don't mark fetched orders as new — only WebSocket 'order:new' events should
        // Prune readyItemIds for orders that no longer exist
        const activeIds = new Set(state.orders.map((o: Order) => o.id));
        for (const orderId of Object.keys(state.readyItemIds)) {
          if (!activeIds.has(orderId)) delete state.readyItemIds[orderId];
        }
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })

      // Update order status
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const index = state.orders.findIndex(o => o.id === action.payload.id);
        if (index !== -1) {
          const existingOrder = state.orders[index];

          console.log('🔄 Updating order in Redux');
          console.log('Existing order has items?', existingOrder.items?.length);
          console.log('API response has items?', action.payload.items?.length);
          console.log('API response has details?', action.payload.details?.length);

          let items = action.payload.items || existingOrder.items;

          if (!items && action.payload.details) {
            console.log('📦 Transforming details to items');
            items = action.payload.details.map((detail: any) => {
              let foodDetails = null;
              if (detail.food_details) {
                try {
                  foodDetails = typeof detail.food_details === 'string'
                    ? JSON.parse(detail.food_details)
                    : detail.food_details;
                } catch (e) {
                  console.warn('Failed to parse food_details:', e);
                }
              }
              return {
                id: detail.id?.toString(),
                food_id: detail.food_id?.toString(),
                name: foodDetails?.name || 'Unknown Item',
                quantity: detail.quantity,
                price: detail.price?.toString(),
                variant: detail.variant || null,
                variations: [],
                add_ons: [],
                isReady: false,
              };
            });
          }

          state.orders[index] = {
            ...existingOrder,
            ...action.payload,
            items: items,
            item_count: items?.length || 0,
          };

          console.log('✅ Order updated with items:', state.orders[index].items?.length);
        }
      })

      // Assign delivery man
      .addCase(assignDeliveryMan.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(assignDeliveryMan.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.orders.findIndex(o => o.id === action.payload.id);
        if (index !== -1) {
          const existingOrder = state.orders[index];

          console.log('🚚 Delivery man assigned in Redux');
          console.log('Order ID:', action.payload.id);
          console.log('Delivery Man ID:', action.payload.delivery_man_id);

          const items = action.payload.items || existingOrder.items;

          state.orders[index] = {
            ...existingOrder,
            ...action.payload,
            items: items,
            item_count: items?.length || 0,
          };

          console.log('✅ Order updated with delivery man');
        }
      })
      .addCase(assignDeliveryMan.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
        console.error('❌ Delivery man assignment failed:', action.payload);
      })

      // Bump order
      .addCase(bumpOrder.fulfilled, (state, action) => {
        const { orderId, orderType, bumpedAt } = action.payload;

        console.log('📦 Order bumped:', orderId);

        if (orderType === 'delivery') {
          const index = state.orders.findIndex(o => o.id === orderId);
          if (index !== -1) {
            state.orders[index] = {
              ...state.orders[index],
              bumped_at: bumpedAt,
              picked_up: true,
            };
          }
        } else {
          state.orders = state.orders.filter(o => o.id !== orderId);
        }

        state.newOrderIds = state.newOrderIds.filter(id => id !== orderId);

        console.log('✅ Order bumped successfully');
      })
      .addCase(bumpOrder.rejected, (state, action) => {
        console.error('❌ Bump failed:', action.payload);
        state.error = action.payload as string;
      });
  },
});

export const {
  addOrder,
  updateOrder,
  toggleItemReady,
  markOrderAsViewed,
  bumpCocoeatsOrder,
  recallCocoeatsOrder,
} = ordersSlice.actions;

export const selectCocoeatsBumpedOrders = (state: { orders: OrdersState }) =>
  state.orders.cocoeatsBumpedOrders;

export const selectReadyItemIds = (state: { orders: OrdersState }) =>
  state.orders.readyItemIds;

export default ordersSlice.reducer;
