// store/slices/ordersSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';

interface DeliveryAddress {
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

interface OrderItem {
  id: string;
  food_id: string;
  name: string;
  quantity: number;
  price: string;
  variant: string | null;
  variations: any[];
  add_ons: any[];
  isReady?: boolean; // Frontend only
}

interface Order {
  id: string;
  restaurant_id: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'handover' | 'delivered';
  order_type: 'delivery' | 'take_away' | 'dine_in';
  payment_method: string;
  order_amount: string;
  processing_time: string | null;
  order_note: string | null;
  delivery_instruction: string | null;
  delivery_man_id?: string | null;
  created_at: string;
  schedule_at: string;
  order_age_minutes: number;
  is_scheduled: boolean;
  items: OrderItem[];
  item_count: number;
  customer_name?: string | null;
  delivery_address?: DeliveryAddress | null;
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

// ✨ NEW: Assign delivery man to order
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
          
          // ✨ Transform details to items if needed
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
      
      // ✨ Assign delivery man
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
      });
  },
});

export const { addOrder, updateOrder, toggleItemReady } = ordersSlice.actions;
export default ordersSlice.reducer;