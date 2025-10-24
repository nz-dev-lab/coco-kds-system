// store/slices/ordersSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

export interface DeliveryAddress {
  contact_person_name: string;
  contact_person_number: string;
  contact_person_email?: string;
  address_type: string;
  address: string;
  floor?: string | null;
  road?: string | null;
  house?: string | null;
  longitude: string;
  latitude: string;
}

export interface OrderItem {
  id: string;
  food_id: string;
  name: string;
  quantity: number;
  price: string;
  variant?: string | null;
  variation: Array<{ type: string; name: string; price: string }>;
  add_ons: Array<{ name: string; quantity: number; price: string }>;
  isReady?: boolean; // Frontend only
}

export interface Order {
  id: string;
  restaurant_id: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'handover' |'picked_up' | 'delivered';
  order_type: 'delivery' | 'take_away' | 'dine_in';
  payment_method?: string;
  order_amount?: string;
  processing_time?: string | null;
  order_note?: string | null;
  delivery_instruction: string | null;
  delivery_man_id?: string | null;
  created_at?: string;
  schedule_at?: string;
  order_age_minutes: number;
  is_scheduled: boolean;
  items: OrderItem[];
  item_count: number;
  customer_name?: string | null;
  delivery_address?: DeliveryAddress | null;
  bumped_at?: string;        // When order was bumped
  picked_up?: boolean;        // For delivery orders (picked up by delivery man)
  delivery_charge: string;
  total_tax_amount: string;
  coupon_discount_amount?: string;
  restaurant_discount_amount?: string;
  dm_tips?: string;
  additional_charge?: string
}

interface OrdersState {
  orders: Order[];
  loading: boolean;
  error: string | null;
  lastFetch: number | null;
}

const initialState: OrdersState = {
  orders: [],
  loading: false,
  error: null,
  lastFetch: null,
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
      state.orders.unshift(action.payload);
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
        
        console.log('✅ Order bumped successfully');
      })
      .addCase(bumpOrder.rejected, (state, action) => {
        console.error('❌ Bump failed:', action.payload);
        state.error = action.payload as string;
      });
  },
});

export const { addOrder, updateOrder, toggleItemReady } = ordersSlice.actions;
export default ordersSlice.reducer;