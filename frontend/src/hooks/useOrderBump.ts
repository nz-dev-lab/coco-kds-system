// src/hooks/useOrderBump.ts
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateOrderStatus } from '../store/slices/ordersSlice';
import { toast } from 'react-hot-toast';

interface Order {
  id: string;
  order_status: string;
  order_type: 'delivery' | 'take_away' | 'dine_in';
  order_age_minutes: number;
  delivery_man_id?: string | null;
  created_at?: string;
  order_amount?: string;
  payment_method?: string;
  item_count: number;
  items: any[];
  customer_name?: string | null;
}

export function useOrderBump() {
  const dispatch = useAppDispatch();
  const restaurantId = useAppSelector((state) => state.auth.restaurant?.id);

  const handleBump = async (order: Order, orderAge: number) => {
    if (!restaurantId) {
      toast.error('Restaurant information not available');
      return;
    }

    // ===================================
    // VALIDATION CHECKS
    // ===================================

    // 1. Check if delivery order without delivery man
    if (
      order.order_type === 'delivery' &&
      order.order_status === 'handover' &&
      !order.delivery_man_id
    ) {
      toast.error('⚠️ Please assign a delivery man first');
      return;
    }

    // 2. Check if delivery order not at handover
    if (order.order_type === 'delivery' && order.order_status !== 'handover') {
      toast.error('⚠️ Order must be at "Ready" status to bump');
      return;
    }

    // 3. Confirmation for orders < 30 min AND not at handover (takeaway/dine-in)
    if (
      order.order_type !== 'delivery' &&
      orderAge < 30 &&
      order.order_status !== 'handover'
    ) {
      const confirmed = window.confirm(
        `⚠️ Order #${order.id} is not ready yet (status: ${order.order_status}).\n\nAre you sure you want to bump?`
      );

      if (!confirmed) return;
    }

    // ===================================
    // EXECUTE BUMP
    // ===================================

    try {
      if (order.order_type === 'delivery') {
        // ✨ DELIVERY ORDER: Pickup is managed by delivery man's mobile app
        console.log('🚚 Delivery order - pickup managed by delivery man app');
        // toast.info(
        //   'Delivery pickup is managed via delivery man\'s mobile app. Order will move to Dispatch when picked up.'
        // );
        return;
      } else {
        // ✨ TAKEAWAY/DINE-IN: Mark as delivered, store to DB
        console.log('🥡 Bumping takeaway/dine-in order:', order.id);

        // Update status to delivered
        await dispatch(
          updateOrderStatus({
            orderId: order.id,
            status: 'delivered',
          })
        ).unwrap();

        // Store to SQLite
        const orderData = {
          id: order.id,
          created_at: order.created_at,
          completed_at: new Date().toISOString(),
          order_type: order.order_type,
          order_status: 'delivered',
          order_amount: order.order_amount,
          payment_method: order.payment_method,
          item_count: order.item_count,
          items: order.items,
          prep_time_minutes: orderAge,
          delivery_man_id: null,
          restaurant_id: restaurantId,
          customer_name: order.customer_name,
        };

        const result = await window.electron.database.addCompletedOrder(orderData);

        if (!result.success) {
          console.error('Failed to store order:', result.error);
        //   toast.warning('Order completed but not saved to history');
        } else {
          console.log('✅ Order completed and stored');
          toast.success(`Order #${order.id} completed!`);
        }
      }
    } catch (error: any) {
      console.error('❌ Failed to bump order:', error);
      toast.error(error.message || 'Failed to bump order');
    }
  };

  return { handleBump };
}