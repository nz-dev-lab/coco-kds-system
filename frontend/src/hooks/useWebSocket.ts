// src/hooks/useWebSocket.ts
import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { addOrder, updateOrder } from '../store/slices/ordersSlice';
import { io, Socket } from 'socket.io-client';
import { Order } from '@/types/order.type';
import { audioNotificationService } from '../utils/audioNotifications';
import { usePrintOrder } from './usePrintOrder';

export function useWebSocket() {
  const dispatch = useAppDispatch();
  const { token } = useAppSelector((state) => state.auth);
  const restaurantId = useAppSelector((state) => state.auth.restaurant?.id);
  const autoPrint = useAppSelector((s) => s.ui.settings.printer?.autoPrint ?? false);
  const socketRef = useRef<Socket | null>(null);

  const { printWithSelection } = usePrintOrder();

  // Keep refs current so the socket event closure always has the latest values
  const autoPrintRef = useRef(autoPrint);
  autoPrintRef.current = autoPrint;
  const printWithSelectionRef = useRef(printWithSelection);
  printWithSelectionRef.current = printWithSelection;

  // Transform Laravel order format to frontend format
  const transformOrder = (rawOrder: any): Order | null => {
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

      const ageMinutes = rawOrder.order_age_minutes || 0;

      // Return transformed order
      return {
        id: rawOrder.id.toString(),
        restaurant_id: rawOrder.restaurant_id.toString(),
        order_status: rawOrder.order_status,
        order_type: rawOrder.order_type,
        payment_method: rawOrder.payment_method,
        order_amount: rawOrder.order_amount?.toString() || '0.00',
        processing_time: rawOrder.processing_time,
        order_note: rawOrder.order_note,
        delivery_instruction: rawOrder.delivery_instruction,
        created_at: rawOrder.created_at || new Date().toISOString(),
        schedule_at: rawOrder.schedule_at,
        order_age_minutes: ageMinutes,
        is_scheduled: rawOrder.scheduled === 1,
        items: items,
        item_count: items.length,
        customer_name: customerName,
        delivery_address: deliveryAddress,
        delivery_man_id: rawOrder.delivery_man_id?.toString() || null,
        delivery_charge: rawOrder.delivery_charge?.toString() || '0.00',
        total_tax_amount: rawOrder.total_tax_amount?.toString() || '0.00',
        coupon_discount_amount: rawOrder.coupon_discount_amount?.toString(),
        restaurant_discount_amount: rawOrder.restaurant_discount_amount?.toString(),
        dm_tips: rawOrder.dm_tips?.toString(),
        additional_charge: rawOrder.additional_charge?.toString(),
      };
    } catch (error) {
      console.error('Error transforming order:', error);
      return null;
    }
  };

  // Function to save completed delivery orders to SQLite
  const saveDeliveredOrderToSQLite = async (order: Order) => {
    if (!restaurantId) {
      console.error('❌ Cannot save to SQLite: No restaurant ID');
      return;
    }

    console.log('💾 Saving delivered order to SQLite:', order.id);

    try {
      const orderData = {
        id: order.id,
        created_at: order.created_at || new Date().toISOString(),
        completed_at: new Date().toISOString(),
        order_type: order.order_type,
        order_status: order.order_status,
        order_amount: order.order_amount || '0.00',
        payment_method: order.payment_method,
        item_count: order.item_count,
        items: order.items,
        prep_time_minutes: order.order_age_minutes,
        delivery_man_id: order.delivery_man_id,
        restaurant_id: restaurantId,
        customer_name: order.customer_name,
      };

      const result = await window.electron.database.addCompletedOrder(orderData);

      if (result.success) {
        console.log('✅ Order saved to SQLite successfully');
      } else {
        console.error('❌ Failed to save order to SQLite:', result.error);
      }
    } catch (error) {
      console.error('❌ Error saving order to SQLite:', error);
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
        audioNotificationService.playNewOrderNotification();

        // Auto-print if enabled in settings
        if (autoPrintRef.current) {
          console.log('🖨️ Auto-printing order:', transformedOrder.id);
          printWithSelectionRef.current(transformedOrder).catch((err) => {
            console.error('❌ Auto-print failed:', err);
          });
        }
      } else {
        console.error('❌ Order transformation failed or no items:', rawOrder);
      }
    });

    socket.on('order:updated', async (rawOrder) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('🔄 ORDER UPDATED EVENT');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Raw data received:', rawOrder);
      console.log('Top-level keys:', Object.keys(rawOrder));
      console.log('Has "order" key?', !!rawOrder.order);
      console.log('Has "details" key?', !!rawOrder.details);
      console.log('Has "items" key?', !!rawOrder.items);
      
      let orderToDispatch: Order | null = null;
      
      if (rawOrder.items) {
        console.log('✅ Order already formatted with items:', rawOrder.items.length);
        orderToDispatch = rawOrder as Order;
      } else if (rawOrder.details) {
        console.log('🔄 Order has details, transforming...');
        const transformedOrder = transformOrder(rawOrder);
        
        if (transformedOrder && transformedOrder.items && transformedOrder.items.length > 0) {
          console.log('✅ Order transformed successfully:', transformedOrder.items.length);
          orderToDispatch = transformedOrder;
        } else {
          console.error('❌ Order transformation failed');
          return;
        }
      } else {
        console.error('❌ Order has neither items nor details!');
        return;
      }
      
      if (
        orderToDispatch &&
        orderToDispatch.order_status === 'delivered' &&
        orderToDispatch.order_type === 'delivery'
      ) {
        console.log('💾 Delivery order delivered - auto-saving to SQLite');
        await saveDeliveredOrderToSQLite(orderToDispatch);
      }
      
      if (orderToDispatch) {
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
  }, [token, dispatch, restaurantId]);

  return socketRef.current;
}