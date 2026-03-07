// store/slices/ordersSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { Order } from '@/types/order.type';
import { CocoKDSOrder, transformTMBillSettledOrder } from '../../../electron/plugins/tmbill/transformer';
import { DisplayOrder } from '@/types/display-order.type';

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
  newOrderIds: string[];
   // ── TMBILL ──────────────────────────────
  tmbillRunningOrders: CocoKDSOrder[];   // from tables[] — normal KOTs
  tmbillSettledOrders: CocoKDSOrder[];   // from settledOrders[] — quick bills (pre-transformed)
}

const initialState: OrdersState = {
  orders: [],
  loading: false,
  error: null,
  lastFetch: null,
  newOrderIds: [],
  tmbillRunningOrders: [],
  tmbillSettledOrders: [],
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
      
      // For delivery orders, we don't change backend status (stays at handover)
      // For takeaway/dine-in, backend status changes to delivered
      // This action is mainly for frontend state management
      
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
      // ✅ MODIFIED: Check if order already exists
      const exists = state.orders.some(o => o.id === action.payload.id);
      if (!exists) {
        state.orders.unshift(action.payload);
        state.newOrderIds.push(action.payload.id);  // ✅ ADD: Mark as new
      }
    },
    updateOrder: (state, action: PayloadAction<Order>) => {
      const index = state.orders.findIndex((o) => o.id === action.payload.id);
      if (index !== -1) {
        state.orders[index] = action.payload;
      }
    },
    toggleItemReady: (state, action: PayloadAction<{ orderId: string; itemId: string }>) => {
      const order = state.orders.find((o) => o.id === action.payload.orderId);
      if (order) {
        const item = order.items.find((i) => i.id === action.payload.itemId);
        if (item) {
          item.isReady = !item.isReady;
        }
      }
    },
    markOrderAsViewed: (state, action: PayloadAction<string>) => {
      state.newOrderIds = state.newOrderIds.filter(id => id !== action.payload);
    },
    // ── TMBILL: Full refresh from tmbill:orders-refreshed event ──────────────────
// Fires on: kot-saved, kds-kot-updated, quick-bill-placed, post-removal refetch
// Replaces ALL tmbill orders — CocoEats orders (state.orders) untouched
setTmbillOrders: (
  state,
  action: PayloadAction<{ running: CocoKDSOrder[]; settled: any[] }>
) => {
  state.tmbillRunningOrders = action.payload.running;
  state.tmbillSettledOrders = action.payload.settled.map(transformTMBillSettledOrder);
},

// ── TMBILL: Remove running order by id (websocket-kot-cancelled) ─────────────
// Payload: { id: 'TMBILL-55270' }
removeTmbillOrder: (state, action: PayloadAction<{ id: string }>) => {
  state.tmbillRunningOrders = state.tmbillRunningOrders.filter(
    o => o.id !== action.payload.id
  );
},

// ── TMBILL: Remove running order by tableId (bill-settled) ───────────────────
// bill-settled only gives table_id — match against _tmbill_table_id
removeTmbillOrderByTableId: (state, action: PayloadAction<{ tableId: number }>) => {
  state.tmbillRunningOrders = state.tmbillRunningOrders.filter(
    o => o._tmbill_table_id !== action.payload.tableId
  );
},

// Item ready toggle for TMBILL (local UI only — IPC call handled separately)
toggleTmbillItemReady(
  state,
  action: PayloadAction<{ orderId: string; itemId: string }>
) {
  const order =
    state.tmbillRunningOrders.find((o) => o.id === action.payload.orderId) ??
    state.tmbillSettledOrders.find((o) => o.id === action.payload.orderId);
  if (order) {
    const item = order.items.find((i) => i.id === action.payload.itemId);
    if (item) item.isReady = !item.isReady;
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
        state.orders = action.payload;
        state.lastFetch = Date.now();
        // ✅ IMPORTANT: Don't mark fetched orders as new (they already existed)
        // Only WebSocket 'order:new' events should add to newOrderIds
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      
      // Update order status
      .addCase(updateOrderStatus.fulfilled, (state, action) => {
        const index = state.orders.findIndex((o) => o.id === action.payload.id);
        if (index !== -1) {
          const existingOrder = state.orders[index];
          
          console.log('🔄 Updating order in Redux');
          console.log('Existing order has items?', existingOrder.items?.length);
          console.log('API response has items?', action.payload.items?.length);
          console.log('API response has details?', action.payload.details?.length);
          
          // Transform details to items if needed
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
          
          // Merge update with existing order
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
        const index = state.orders.findIndex((o) => o.id === action.payload.id);
        if (index !== -1) {
          const existingOrder = state.orders[index];
          
          console.log('🚚 Delivery man assigned in Redux');
          console.log('Order ID:', action.payload.id);
          console.log('Delivery Man ID:', action.payload.delivery_man_id);
          
          // Preserve items from existing order
          const items = action.payload.items || existingOrder.items;
          
          // Update order with delivery man assignment
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
          // For delivery orders: Mark as "picked_up" but keep in state
          // (will move to Dispatch view later)
          const index = state.orders.findIndex(o => o.id === orderId);
          if (index !== -1) {
            state.orders[index] = {
              ...state.orders[index],
              bumped_at: bumpedAt,
              picked_up: true,
            };
          }
        } else {
          // For takeaway/dine-in: Remove from active orders
          state.orders = state.orders.filter(o => o.id !== orderId);
        }
        
        // ✅ ADD: Remove from new orders list when bumped
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
  setTmbillOrders,
  removeTmbillOrder,
  removeTmbillOrderByTableId,
  toggleTmbillItemReady
} = ordersSlice.actions;
// Selectors for TMBILL orders
export const selectTmbillRunningOrders = (state: { orders: OrdersState }) =>
  state.orders.tmbillRunningOrders;

export const selectTmbillSettledOrders = (state: { orders: OrdersState }) =>
  state.orders.tmbillSettledOrders;

// Combined selector — all active orders from both sources
// export const selectAllActiveOrders = (state: { orders: OrdersState }) => [
//   ...state.orders.orders,               // CocoEats orders
//   ...state.orders.tmbillRunningOrders,  // TMBILL KOTs
// ];
export const selectAllActiveOrders = (state: { orders: OrdersState }): DisplayOrder[] => [
  ...state.orders.orders.map(o => ({ ...o, _source: 'cocoeats' as const })),
  ...state.orders.tmbillRunningOrders,
  ...state.orders.tmbillSettledOrders,
];

export default ordersSlice.reducer;