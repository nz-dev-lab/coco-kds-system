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

    socket.on('order:new', (rawOrder) => {
      console.log('📥 New order received (raw):', rawOrder);

      // Transform the order
      const transformedOrder = transformOrder(rawOrder);

      if (transformedOrder && transformedOrder.items && transformedOrder.items.length > 0) {
        console.log('✅ Order transformed successfully:', transformedOrder);
        dispatch(addOrder(transformedOrder));
      } else {
        console.error('❌ Order transformation failed or no items:', rawOrder);
      }
    });

    socket.on('order:updated', (rawOrder) => {
      console.log('🔄 Order updated (raw):', rawOrder);

      // Transform the order
      const transformedOrder = transformOrder(rawOrder);

      if (transformedOrder && transformedOrder.items && transformedOrder.items.length > 0) {
        console.log('✅ Order updated successfully:', transformedOrder);
        dispatch(updateOrder(transformedOrder));
      } else {
        console.error('❌ Order update transformation failed or no items:', rawOrder);
      }
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