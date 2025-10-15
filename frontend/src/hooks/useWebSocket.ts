// src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addOrder, updateOrder } from '../store/slices/ordersSlice';
import { io, Socket } from 'socket.io-client';

export function useWebSocket() {
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.auth);
  const socketRef = useRef<Socket | null>(null);

  // Transform Laravel order format to frontend format
  // Transform Laravel order format to frontend format
const transformOrder = (rawOrder: any) => {
  try {
    console.log('Transforming order:', rawOrder);
    // Map 'details' to 'items' and transform structure
    const items = (rawOrder.details || []).map((detail: any) => {
      // Parse food_details JSON string if it exists
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

      // Parse add_ons if it's a string
      let addOns = [];
      if (detail.add_ons) {
        try {
          addOns = typeof detail.add_ons === 'string'
            ? JSON.parse(detail.add_ons)
            : detail.add_ons;
        } catch (e) {
          addOns = [];
        }
      }

      // Parse variations if it's a string
      let variations = [];
      if (detail.variation) {
        try {
          variations = typeof detail.variation === 'string'
            ? JSON.parse(detail.variation)
            : detail.variation;
        } catch (e) {
          variations = [];
        }
      }

      return {
        id: detail.id.toString(),
        food_id: detail.food_id.toString(),
        name: foodDetails?.name || 'Unknown Item',
        quantity: detail.quantity,
        price: detail.price.toString(),
        variant: detail.variant || null,
        variations: variations,
        add_ons: addOns,
        isReady: false,
      };
    });

    // Parse delivery_address to extract customer info
    let customerName = null;
    let deliveryAddress = null;
    
    if (rawOrder.delivery_address) {
      try {
        deliveryAddress = typeof rawOrder.delivery_address === 'string' 
          ? JSON.parse(rawOrder.delivery_address) 
          : rawOrder.delivery_address;
        
        customerName = deliveryAddress?.contact_person_name || null;
      } catch (e) {
        console.warn('Failed to parse delivery_address:', e);
      }
    }

    // ✨ FIX: Use backend's calculated age (backend handles timezone correctly)
    const ageMinutes = rawOrder.order_age_minutes || 0;

    // Return transformed order
    return {
      id: rawOrder.id.toString(),
      restaurant_id: rawOrder.restaurant_id.toString(),
      order_status: rawOrder.order_status,
      order_type: rawOrder.order_type,
      payment_method: rawOrder.payment_method,
      order_amount: rawOrder.order_amount.toString(),
      processing_time: rawOrder.processing_time,
      order_note: rawOrder.order_note,
      delivery_instruction: rawOrder.delivery_instruction,
      created_at: rawOrder.created_at, // Backend now sends ISO UTC format
      schedule_at: rawOrder.schedule_at,
      order_age_minutes: ageMinutes, // ✨ Use backend's value
      is_scheduled: rawOrder.scheduled === 1,
      items: items,
      item_count: items.length,
      customer_name: customerName,
      delivery_address: deliveryAddress,
      delivery_man_id: rawOrder.delivery_man_id?.toString() || null,
    };
  } catch (error) {
    console.error('Error transforming order:', error);
    return null;
  }
};

  useEffect(() => {
    if (!token) return;

    const socket = io(import.meta.env.VITE_WS_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connected', (data) => {
      console.log('✅ WebSocket connected:', data);
    });

    // socket.on('order:new', (rawOrder) => {
    //   console.log('📥 New order received (raw):', rawOrder);

    //   // Transform the order
    //   const transformedOrder = transformOrder(rawOrder);

    //   if (transformedOrder && transformedOrder.items && transformedOrder.items.length > 0) {
    //     console.log('✅ Order transformed successfully:', transformedOrder);
    //     dispatch(addOrder(transformedOrder));
    //   } else {
    //     console.error('❌ Order transformation failed or no items:', rawOrder);
    //   }
    // });

    // socket.on('order:updated', (rawOrder) => {
    //   console.log('🔄 Order updated (raw):', rawOrder);

    //   // Transform the order
    //   const transformedOrder = transformOrder(rawOrder);

    //   if (transformedOrder && transformedOrder.items && transformedOrder.items.length > 0) {
    //     console.log('✅ Order updated successfully:', transformedOrder);
    //     dispatch(updateOrder(transformedOrder));
    //   } else {
    //     console.error('❌ Order update transformation failed or no items:', rawOrder);
    //   }
    // });

    socket.on('order:new', (rawOrder) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📥 NEW ORDER EVENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Raw data received:', rawOrder);
  console.log('Top-level keys:', Object.keys(rawOrder));
  console.log('Has "order" key?', !!rawOrder.order);
  console.log('Has "details" key?', !!rawOrder.details);
  console.log('Has "items" key?', !!rawOrder.items);
  
  if (rawOrder.order) {
    console.log('🔍 Nested order keys:', Object.keys(rawOrder.order));
    console.log('🔍 Nested order.details?', !!rawOrder.order.details);
    console.log('🔍 Nested order.details length:', rawOrder.order.details?.length);
  }
  
  if (rawOrder.details) {
    console.log('🔍 Direct details length:', rawOrder.details?.length);
    console.log('🔍 First detail:', rawOrder.details?.[0]);
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  const transformedOrder = transformOrder(rawOrder);

  if (transformedOrder && transformedOrder.items && transformedOrder.items.length > 0) {
    console.log('✅ Order transformed successfully:', transformedOrder);
    dispatch(addOrder(transformedOrder));
  } else {
    console.error('❌ Order transformation failed or no items:', rawOrder);
  }
});

socket.on('order:updated', (rawOrder) => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔄 ORDER UPDATED EVENT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Raw data received:', rawOrder);
  console.log('Top-level keys:', Object.keys(rawOrder));
  console.log('Has "order" key?', !!rawOrder.order);
  console.log('Has "details" key?', !!rawOrder.details);
  console.log('Has "items" key?', !!rawOrder.items);
  
  // ✨ FIX: Check if already formatted (has items) or needs transform (has details)
  let orderToDispatch;
  
  if (rawOrder.items) {
    // Already formatted by NestJS - use as-is
    console.log('✅ Order already formatted with items:', rawOrder.items.length);
    orderToDispatch = rawOrder;
  } else if (rawOrder.details) {
    // Has Laravel details - transform it
    console.log('🔄 Order has details, transforming...');
    const transformedOrder = transformOrder(rawOrder);
    
    if (transformedOrder && transformedOrder.items && transformedOrder.items.length > 0) {
      console.log('✅ Order transformed successfully:', transformedOrder.items.length);
      orderToDispatch = transformedOrder;
    } else {
      console.error('❌ Order transformation failed');
      return; // Don't update if transform failed
    }
  } else {
    console.error('❌ Order has neither items nor details!');
    return;
  }
  
  // Dispatch the update
  if (orderToDispatch) {
    // ✨ Additional safety: If items array is empty, don't update
    if (!orderToDispatch.items || orderToDispatch.items.length === 0) {
      console.warn('⚠️ Order has empty items, skipping WebSocket update');
      console.warn('⚠️ Redux fix will preserve existing items');
      return;
    }
    
    console.log('✅ Dispatching order update with', orderToDispatch.items.length, 'items');
    dispatch(updateOrder(orderToDispatch));
  }
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

    socket.on('error', (error) => {
      console.error('⚠️ WebSocket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [token, dispatch]);

  return socketRef.current;
}