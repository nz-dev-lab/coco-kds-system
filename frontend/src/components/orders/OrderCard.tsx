// src/components/orders/OrderCard.tsx
import { User, Printer, AlertCircle, Bike, CalendarClock, ShoppingBag, CookingPot, RectangleEllipsis } from 'lucide-react';
import CocoEatsIcon from '../icons/CocoEatsIcon';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleItemReady, updateOrderStatus, bumpCocoeatsOrder, recallCocoeatsOrder } from '../../store/slices/ordersSlice';
import DeliveryDetailsModal from './DeliveryDetailsModal';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getScheduledInfo, formatCountdown } from '../../utils/scheduledOrderUtils';
import { audioNotificationService } from '@/utils/audioNotifications';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import DeliveryAssignmentModal from './DeliveryAssignmentModal';
import { assignDeliveryMan } from '@/store/slices/ordersSlice';
import { toast } from 'react-hot-toast'; // or your toast library
import { useOrderBump } from '../../hooks/useOrderBump';
import { usePrintOrder } from '../../hooks/usePrintOrder';
import { Order } from '@/types/order.type';
import { markOrderAsViewed } from '../../store/slices/ordersSlice';
import { useHeaderDoubleTap } from '@/hooks/useHeaderDoubleTap';
import { setFocusedOrder, addRecentlyUpdated, releaseFocus, removeRecentlyUpdated } from '@/store/slices/uiSlice';

// interface Order {
//   id: string;
//   restaurant_id: string;
//   order_status: 'pending' | 'confirmed' | 'processing' | 'handover' | 'picked_up'| 'delivered';
//   order_type: 'delivery' | 'take_away' | 'dine_in';
//   order_age_minutes: number;
//   processing_time?: string | null;
//   items: OrderItem[];
//   order_note?: string | null;
//   delivery_man_id?: string | null;
//   delivery_instruction: string | null;
//   customer_name?: string | null;
//   item_count: number;
//   created_at?: string;
//   schedule_at?: string;
//   is_scheduled: boolean;
//   delivery_address?: any;
//   order_amount?: string;
//   payment_method?: string;
//   bumped_at?: string;        // ← ADD THIS
//   picked_up?: boolean;
//   delivery_charge: string;
//   total_tax_amount: string;
//   coupon_discount_amount?: string;
//   restaurant_discount_amount?: string;
//   dm_tips?: string;
//   additional_charge?: string        // ← ADD THIS (for delivery orders)
  
// }

// interface OrderItem {
//   id: string;
//   food_id: string;
//   name: string;
//   quantity: number;
//   price: string;
//   variant?: string | null;
//   variation: Array<{ type: string; name: string; price: string }>;
//   add_ons: Array<{ name: string; quantity: number; price: string }>;
//   isReady?: boolean;
// }

interface OrderCardProps {
  order: Order;
  gridPosition: number;
  isBumped?: boolean;
}

export default function OrderCard({ order, gridPosition, isBumped = false }: OrderCardProps) {
  const dispatch = useAppDispatch();
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const currentTime = useCurrentTime();
  const { printWithSelection, isPrinting } = usePrintOrder();

  // Get restaurant ID from Redux auth state
  const restaurantId = useAppSelector((state) => state.auth.restaurant?.id);
  const requireDoubleTap = useAppSelector((s) => s.ui.settings.interaction.requireDoubleTap);
  const processingMode = useAppSelector((s) => s.ui.settings.interaction.processingMode);
  const focusedOrderId = useAppSelector((state) => state.ui.focusedOrderId);
  const recentlyUpdatedIds = useAppSelector((state) => state.ui.recentlyUpdatedOrderIds);
  const isFocused = order.id === focusedOrderId;
  const isRecentlyUpdated = recentlyUpdatedIds.includes(order.id);
  const { handleBump: bumpOrder } = useOrderBump();
  // Check if this is a new order
  const isNewOrder = useAppSelector((state) => 
    state.orders.newOrderIds.includes(order.id)
  );

  const [showAnimation, setShowAnimation] = useState(isNewOrder);

  // Add safety check for items
  const items = order.items || [];

  

const calculateOrderAge = (createdAt: string, backendAge: number): number => {
  // Parse ISO UTC format
  const created = new Date(createdAt);
  
  // If parsing failed or resulted in invalid date, use backend age
  if (isNaN(created.getTime())) {
    console.warn('Invalid date format:', createdAt);
    return backendAge;
  }
  
  // Calculate age from UTC timestamps
  const diffMs = currentTime.getTime() - created.getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
};

// Use it with fallback
const orderAge = order.created_at 
  ? calculateOrderAge(order.created_at, order.order_age_minutes)
  : order.order_age_minutes;

  // Calculate scheduled info
  const scheduledInfo = order.schedule_at && order.created_at
    ? getScheduledInfo(order.schedule_at, order.created_at, order.order_type, currentTime)
    : { isScheduled: false };

  // Status color mapping (matching prototype)
  const statusConfig = {
    pending: {
      bg: 'bg-[#3B82F6]',
      text: 'Pending',
    },
    confirmed: {
      bg: 'bg-teal-600',
      text: 'Confirmed',
    },
    processing: {
      bg: 'bg-[#F97316]',
      text: 'Processing',
    },
    handover: {
      bg: 'bg-[#10B981]',
      text: 'Ready',
    },
    picked_up: {
      bg: 'bg-purple-500',
      text: 'Out for Delivery',
    },
    delivered: {
      bg: 'bg-gray-500',
      text: 'Delivered',
    },
  };

  const config = statusConfig[order.order_status];

  // Age-based border color (updated to use calculated orderAge)
  const getAgeBorderColor = () => {
    // For scheduled orders in locked state, use purple
    if (scheduledInfo.isScheduled && scheduledInfo.status === 'locked') {
      return 'border-l-purple-500';
    }
    // For scheduled orders in ready state, use green
    if (scheduledInfo.isScheduled && scheduledInfo.status === 'ready') {
      return 'border-l-green-500';
    }
    // For overdue scheduled orders, use red
    if (scheduledInfo.isScheduled && scheduledInfo.status === 'overdue') {
      return 'border-l-red-500';
    }
    // Normal orders - use calculated age
    if (orderAge < 15) return 'border-l-green-500';
    if (orderAge < 30) return 'border-l-yellow-500';
    return 'border-l-red-500';
  };

  // Format time
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Calculate item progress
  const readyItems = items.filter((item) => item.isReady).length;
  const totalItems = items.length;
  const progressPercent = totalItems > 0 ? (readyItems / totalItems) * 100 : 0;

  const handleItemToggle = (itemId: string) => {
    dispatch(toggleItemReady({ orderId: order.id, itemId }));
  };

  // Stop animation on user interaction
const stopAnimation = () => {
  if (showAnimation) {
    setShowAnimation(false);
    dispatch(markOrderAsViewed(order.id));
  }
};

  // helper to return correct trigger props
  const actionTriggerProps = (handler: () => Promise<void> | void) => {
    if (requireDoubleTap) {
      return { onDoubleClick: (e: any) => { e.stopPropagation(); handler(); } } as any;
    }
    return { onClick: (e: any) => { e.stopPropagation(); handler(); } } as any;
  };


 // Print handler
  const handlePrint = async () => {
    try {
      console.log('🖨️ Print button clicked for order:', order.id);
      await printWithSelection(order);
    } catch (error) {
      console.error('❌ Print error:', error);
    }
  };

// Memoize wrapper for button mode
const handleBump = useCallback(async () => {
  dispatch(setFocusedOrder({ orderId: order.id, position: gridPosition }));
  await bumpOrder(order, orderAge);
  dispatch(releaseFocus());

   dispatch(addRecentlyUpdated(order.id));
}, [bumpOrder, order, orderAge, dispatch]);

const handleBumpLocal = useCallback(() => {
  setMenuOpen(false);
  dispatch(bumpCocoeatsOrder({ id: order.id }));
}, [dispatch, order.id]);

const handleRecall = useCallback(() => {
  dispatch(recallCocoeatsOrder({ id: order.id }));
}, [dispatch, order.id]);

 const handleAssignDelivery = () => {
  setShowAssignModal(true);
};

const handleAssignDeliveryMan = async (deliveryManId: number) => {
  try {
    await dispatch(assignDeliveryMan({
      orderId: order.id,
      deliveryManId: deliveryManId,
    })).unwrap();
    
    toast.success('Delivery man assigned successfully!');
  } catch (error: any) {
    toast.error(error.message || 'Failed to assign delivery man');
    throw error; // Re-throw so modal can handle it
  }
};


const handleConfirm = useCallback(async () => {
  try {
    stopAnimation();
    
    dispatch(setFocusedOrder({ orderId: order.id, position: gridPosition }));
    await dispatch(updateOrderStatus({
      orderId: order.id,
      status: 'confirmed',
    })).unwrap();
    dispatch(addRecentlyUpdated(order.id));
  } catch (error) {
    console.error('❌ Failed to confirm order:', error);
  }
}, [dispatch, order.id, stopAnimation]);

const handleStartCooking = useCallback(async () => {
  try {
    stopAnimation();
    
    dispatch(setFocusedOrder({ orderId: order.id, position: gridPosition }));
    await dispatch(updateOrderStatus({
      orderId: order.id,
      status: 'processing',
    })).unwrap();
    dispatch(addRecentlyUpdated(order.id));
  } catch (error) {
    console.error('❌ Failed to start cooking:', error);
  }
}, [dispatch, order.id, stopAnimation]);

const handleMarkReady = useCallback(async () => {
  try {
    
    dispatch(setFocusedOrder({ orderId: order.id, position: gridPosition }));
    await dispatch(updateOrderStatus({
      orderId: order.id,
      status: 'handover',
    })).unwrap();
    dispatch(addRecentlyUpdated(order.id));
  } catch (error) {
    console.error('❌ Failed to mark ready:', error);
  }
}, [dispatch, order.id]);

const handleComplete = async () => {
  try {
    // Note: Backend might prevent this for delivery orders
    await dispatch(updateOrderStatus({
      orderId: order.id,
      status: 'delivered',
    })).unwrap();
    
    console.log('✅ Order completed:', order.id);
  } catch (error) {
    console.error('❌ Failed to complete order:', error);
  }
};

  // Check if delivery assignment is available
  const canAssignDelivery = order.order_type === 'delivery' &&
    order.order_status === 'handover'; //&&
    //!order.delivery_man_id;

  // Track previous scheduled status
  const prevStatusRef = useRef<'locked' | 'ready' | 'overdue' | undefined>(undefined);


  const { handleHeaderDoubleTap, isEnabled: isHeaderMode } = useHeaderDoubleTap({
  order,
  scheduledInfo,
  orderAge,
  handleConfirm,
  handleStartCooking,
  handleMarkReady,
  handleBump: bumpOrder,
  stopAnimation,
});

  // Auto-stop animation after 20 seconds
useEffect(() => {
  if (isNewOrder && showAnimation) {
    const timer = setTimeout(() => {
      setShowAnimation(false);
      dispatch(markOrderAsViewed(order.id));
    }, 60_000); // 20 seconds
    
    return () => clearTimeout(timer);
  }
}, [isNewOrder, showAnimation, order.id, dispatch]);


  

  // Audio notification effect
  useEffect(() => {
    if (!scheduledInfo.isScheduled) return;

    const prevStatus = prevStatusRef.current;
    const currentStatus = scheduledInfo.status;

    console.log(`🔍 Order ${order.id} status:`, {
      prevStatus,
      currentStatus,
      time: currentTime.toLocaleTimeString()
    });

    // Trigger notification when status changes to 'ready'
    if (prevStatus === 'locked' && currentStatus === 'ready') {
      console.log('🔔 Status changed to READY - Playing notification');
      audioNotificationService.playReadyNotification(order.id);
    }

    // Trigger warning when status changes to 'overdue'
    if (currentStatus === 'overdue' && prevStatus !== 'overdue') {
      console.log('🚨 Status changed to OVERDUE - Playing alarm');
      audioNotificationService.playOverdueWarning(order.id);
    }

    prevStatusRef.current = currentStatus;
  }, [scheduledInfo.status, scheduledInfo.isScheduled, order.id, currentTime]);

  // Reset notification tracking when order status changes
  useEffect(() => {
    if (order.order_status !== 'confirmed') {
      audioNotificationService.resetOrderNotification(order.id);
    }
  }, [order.order_status, order.id]);

  // If no items, show error state
  if (!order || !items.length) {
    // console.error('Order has no items or is invalid:', order);
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">
          ⚠️ Order #{order?.id || 'unknown'} has no items
        </p>
      </div>
    );
  }
  // if(order){
  //   console.log('Rendering OrderCard for order:', order.id, order);
  // }

  useEffect(() => {
  const handleClickOutside = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.order-card') && isFocused) {
      dispatch(releaseFocus());
    }
  };
  
  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [isFocused, dispatch]);

useEffect(() => {
  if (!isFocused) return;
  
  const timeout = setTimeout(() => {
    dispatch(releaseFocus());
  }, 15000); // 15 seconds
  
  return () => clearTimeout(timeout);
}, [isFocused, dispatch]);

useEffect(() => {
  if (!isRecentlyUpdated) return;
  
  const timeout = setTimeout(() => {
    dispatch(removeRecentlyUpdated(order.id));
  }, 5000); // 5 seconds
  
  return () => clearTimeout(timeout);
}, [isRecentlyUpdated, order.id, dispatch]);

return (
  <>
    {/* ✅ ORDER CARD - Container Query Enabled */}
    <div className={`
      @container
      bg-white rounded-lg 
      border-l-4 ${getAgeBorderColor()} 
      shadow-md hover:shadow-lg transition-shadow 
      flex flex-col 
      min-h-[500px]
      min-w-[280px]
      max-w-[550px]
      w-full
      ${isBumped ? 'opacity-60 grayscale-[30%]' : ''}
      ${showAnimation ? 'new-order-animation' : ''}
      ${isFocused ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}
      ${isRecentlyUpdated ? 'animate-pulse-border' : ''}
    `}>
      {/* Header */}
      <div className={`${config.bg} px-3 sm:px-4 py-3 rounded-t-lg ${isHeaderMode ? 'cursor-pointer select-none' : ''} ${isFocused ? 'relative' : ''} `}
        onDoubleClick={isHeaderMode ? handleHeaderDoubleTap : undefined}
        title={isHeaderMode ? 'Double-tap header to progress order' : undefined}
      >
        <div className="flex items-center justify-between gap-2">
          {/* Left side: Order # + Badges */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            {/* Order Number */}
            <span className="text-white font-bold text-base sm:text-lg font-mono flex-shrink-0">
              #{order.id}
            </span>

            {/* Status Badge */}
            <span className="
              px-1.5 sm:px-2 py-0.5
              bg-white/20 text-white
              text-[10px] sm:text-xs
              font-semibold rounded
              whitespace-nowrap
              flex-shrink-0
            ">
              {config.text}
            </span>

            {/* Source Badge — CocoEats online order indicator */}
            <CocoEatsIcon className="w-5 h-5 text-white flex-shrink-0 cocoeats-icon-blink" />

            {/* Bumped badge */}
            {isBumped && (
              <span className="px-1.5 py-0.5 bg-slate-700 text-white text-[10px] font-bold rounded uppercase whitespace-nowrap flex-shrink-0">
                BUMPED
              </span>
            )}

            {/* Scheduled Badge */}
            {scheduledInfo.isScheduled && (
              <span className="
                px-1.5 sm:px-2 py-0.5 
                bg-purple-600 text-white 
                text-[10px] sm:text-xs 
                font-semibold rounded 
                flex items-center gap-1 
                whitespace-nowrap
                flex-shrink-0
              ">
                <CalendarClock className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                <span className="hidden @[350px]:inline">SCHEDULED</span>
                <span className="inline @[350px]:hidden">SCHED</span>
              </span>
            )}
          </div>

          {/* Right side: Time + Source icon */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {scheduledInfo.isScheduled ? (
              <span className="text-white text-[10px] sm:text-xs font-semibold whitespace-nowrap">
                🕐 {scheduledInfo.scheduledTimeFormatted}
              </span>
            ) : (
              <span className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">
                {formatTime(orderAge)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Customer Info & Order Type */}
        <div className="mb-3">
          {/* Row 1: Customer Name + Order Type */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {/* Customer Name Button */}
            {order.customer_name ? (
              <button
                onClick={() => setShowDeliveryModal(true)}
                className="
                  flex items-center gap-2 
                  hover:bg-slate-50 
                  px-2 py-1 -ml-2 rounded 
                  transition-colors 
                  group
                  min-w-0
                  flex-1
                  max-w-[200px]
                "
              >
                <User className="w-4 h-4 text-slate-600 group-hover:text-slate-900 flex-shrink-0" />
                <span className="
                  text-sm font-medium 
                  text-slate-800 group-hover:text-slate-900 
                  truncate
                  max-w-[100px]
                  @[350px]:max-w-[130px]
                  @[450px]:max-w-[170px]
                ">
                  {order.customer_name}
                </span>
                <svg
                  className="w-3 h-3 text-slate-400 group-hover:text-slate-600 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <span className="text-sm text-slate-500">Walk-in Customer</span>
            )}

            {/* Order Type Badge */}
            <span className="
              px-2 py-1 
              bg-slate-100 text-slate-700 
              text-xs font-semibold rounded 
              uppercase 
              whitespace-nowrap
              flex-shrink-0
            ">
              <span className="hidden @[350px]:inline">
                {order.order_type.replace('_', ' ')}
              </span>
              <span className="inline @[350px]:hidden">
                {order.order_type === 'delivery' ? (<Bike className='w-4 h-4 text-slate-700' />):
                 order.order_type === 'take_away' ? (<ShoppingBag className='w-4 h-4 text-slate-700' />) : <CookingPot className='w-4 h-4 text-slate-700' />}
              </span>
            </span>
          </div>

          {/* Row 2: Amount + Payment Method (separate badges, left and right) */}
          {order.order_amount && order.payment_method && (
            <div className="flex items-center justify-between">
              {/* Left: Order amount */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`
                  px-2 py-1 
                  text-xs font-semibold rounded 
                  flex items-center gap-1 
                  whitespace-nowrap
                  bg-slate-100 text-slate-800 border border-slate-200
                `}>
                  <span className="font-mono font-bold">
                    £{parseFloat(order.order_amount).toFixed(2)}
                  </span>
                </span>
              </div>

              {/* Right: Payment method (PAID / UNPAID) */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className={`
                  px-2 py-1 
                  text-xs font-semibold rounded 
                  flex items-center gap-1 
                  whitespace-nowrap
                  ${order.payment_status === 'paid'
                    ? 'bg-green-100 text-green-800 border border-green-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }
                `}>
                  <span className="
                    text-[10px] font-semibold
                    hidden @[300px]:inline
                  ">
                    {order.payment_status === 'paid' ? 'PAID' : 'UNPAID'}
                  </span>
                  <span className="inline @[300px]:hidden text-[10px]">
                    {order.payment_status === 'paid' ? 'PAID' : 'COD'}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Minimal Scheduled Order Info Box */}
        {scheduledInfo.isScheduled && (
          <div className={`mb-3 rounded-lg border-l-4 p-2 ${
            scheduledInfo.status === 'overdue' ? 'bg-red-50 border-red-500' :
            scheduledInfo.status === 'ready' ? 'bg-green-50 border-green-500' :
            'bg-purple-50 border-purple-500'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarClock className={`w-3.5 h-3.5 flex-shrink-0 ${
                  scheduledInfo.status === 'overdue' ? 'text-red-600' :
                  scheduledInfo.status === 'ready' ? 'text-green-600' :
                  'text-purple-600'
                }`} />
                <span className={`text-xs font-semibold ${
                  scheduledInfo.status === 'overdue' ? 'text-red-800' :
                  scheduledInfo.status === 'ready' ? 'text-green-800' :
                  'text-purple-800'
                }`}>
                  {scheduledInfo.status === 'overdue' ? '⚠️ Overdue!' :
                   scheduledInfo.status === 'ready' ? '✓ Ready to cook' :
                   '🔒 Locked'}
                </span>
              </div>
              <span className={`text-xs font-bold ${
                scheduledInfo.status === 'overdue' ? 'text-red-700' :
                scheduledInfo.status === 'ready' ? 'text-green-700' :
                'text-purple-700'
              }`}>
                {scheduledInfo.scheduledTimeFormatted}
              </span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
            <span>Items Ready</span>
            <span className="font-semibold">{readyItems}/{totalItems}</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={item.isReady || false}
                onChange={() => handleItemToggle(item.id)}
                className="mt-1 w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-slate-900 font-mono text-sm flex-shrink-0">{item.quantity}x</span>
                  <span className={`
                    text-sm font-medium 
                    ${item.isReady ? 'line-through text-slate-400' : 'text-slate-800'}
                    truncate
                  `}>
                    {item.name}
                  </span>
                </div>
                {item.variant && (
                  <div className="text-xs text-slate-500 ml-6 truncate">{item.variant}</div>
                )}
                {item.add_ons && item.add_ons.length > 0 && (
                  <div className="text-xs text-slate-500 ml-6 truncate">
                    + {item.add_ons.map((a: any) => a.name).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Order Note */}
        {order.order_note && (
          <div className="bg-yellow-50 border-l-2 border-yellow-400 px-3 py-2 mb-3 flex gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 font-medium break-words">{order.order_note}</p>
          </div>
        )}

        {/* Processing Time (if set) */}
        {order.processing_time && order.order_status === 'processing' && (
          <div className="bg-blue-50 border-l-2 border-blue-400 px-3 py-2 mb-3">
            <p className="text-xs text-blue-800 font-medium">
              ⏱️ Estimated: {order.processing_time} minutes
            </p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Buttons */}
      <div className="p-4 pt-0 border-t border-slate-100 flex-shrink-0 mt-auto">
        {isBumped ? (
          /* Bumped state — show Recall button only */
          <button
            onClick={handleRecall}
            className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
          >
            Recall to Dashboard
          </button>
        ) : (
        <>
        {processingMode === 'buttons' && (
          <>
          {/* Confirm Order */}
        {order.order_status === 'pending' && (
           <button
              {...actionTriggerProps(handleConfirm)}
              className="w-full py-2.5 mb-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
            >
            Confirm Order
          </button>
        )}

        {/* Start Cooking */}
        {order.order_status === 'confirmed' && (
          <button
            {...actionTriggerProps(handleStartCooking)}
            disabled={scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing}
            className={`w-full py-2.5 mb-2 font-semibold rounded-lg transition-colors ${
              scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-teal-600 hover:bg-teal-700 text-white'
            }`}
            title={scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing && scheduledInfo.prepWindowOpens
              ? `Locked until ${scheduledInfo.prepWindowOpens.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`
              : undefined
            }
          >
            {scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing && scheduledInfo.minutesUntilPrep ? (
              <>
                <span className="hidden @[350px]:inline">
                  🔒 Locked ({formatCountdown(scheduledInfo.minutesUntilPrep)} left)
                </span>
                <span className="inline @[350px]:hidden">
                  🔒 {formatCountdown(scheduledInfo.minutesUntilPrep)}
                </span>
              </>
            ) : (
              'Start Cooking'
            )}
          </button>
        )}

        {/* Mark as Ready */}
        {order.order_status === 'processing' && (
          <button
            {...actionTriggerProps(handleMarkReady)}
            className="w-full py-2.5 mb-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
          >
            Mark as Ready
          </button>
        )}

        {/* Complete Order - ONLY for takeaway/dine-in at handover */}
        {order.order_status === 'handover' && order.order_type !== 'delivery' && (
          <button
            {...actionTriggerProps(handleBump)}
            className="w-full py-2.5 mb-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            Complete Order
          </button>
        )}
          </>
        )}

        {/* Delivery Order Info Banner */}
        {order.order_status === 'handover' && order.order_type === 'delivery' && (
          <div className="mb-2 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            {order.delivery_man_id ? (
              <div>
                <p className="text-sm font-semibold text-purple-900 mb-1 flex items-center gap-2">
                  <Bike className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">Assigned to DM #{order.delivery_man_id}</span>
                </p>
                <p className="text-xs text-purple-700">
                  ⏳ Waiting for pickup via delivery man app
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  No Delivery Man Assigned
                </p>
                <p className="text-xs text-amber-700">
                  Please assign a delivery person below
                </p>
              </div>
            )}
          </div>
        )}

        {/* Bottom Action Bar */}
        <div className="flex gap-2">
          {order.order_type === 'delivery' ? (
            <>
              <button
                onClick={handlePrint}
                className="
                  flex-1 py-2
                  bg-slate-700 hover:bg-slate-800
                  text-slate-100
                  rounded-lg transition-colors
                  flex items-center justify-center gap-2
                  group
                "
                title="Print order"
              >
                <Printer className="w-4 h-4 flex-shrink-0" />
                <span className="hidden @[350px]:inline">Print</span>
              </button>

              <button
                onClick={handleAssignDelivery}
                disabled={order.order_status !== 'handover'}
                className={`
                  flex-1 py-2
                  rounded-lg transition-colors
                  flex items-center justify-center gap-2
                  ${order.order_status === 'handover'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }
                `}
                title={
                  order.order_status !== 'handover'
                    ? 'Delivery assignment available when order is ready'
                    : order.delivery_man_id
                    ? 'Change delivery person'
                    : 'Assign delivery person'
                }
              >
                <Bike className="w-4 h-4 flex-shrink-0" />
                <span className="hidden @[320px]:inline">
                  {order.delivery_man_id ? 'Change' : 'Assign'}
                </span>
                <span className="hidden @[400px]:inline"> DM</span>
              </button>
            </>
          ) : (
            <button
              onClick={handlePrint}
              className="
                flex-1 py-2
                bg-slate-700 hover:bg-slate-800
                text-slate-100
                rounded-lg transition-colors
                flex items-center justify-center gap-2
                group
              "
              title="Print order"
            >
              <Printer className="w-4 h-4 flex-shrink-0" />
              <span className="hidden @[350px]:inline">Print Order</span>
              <span className="inline @[350px]:hidden">Print</span>
            </button>
          )}

          {/* Ellipsis menu — Bump Order (local hide, no backend change) */}
          <div className="relative flex-shrink-0" onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="h-full px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center transition-colors"
              title="Order actions"
            >
              <RectangleEllipsis className="w-5 h-5" />
            </button>
            {menuOpen && (
              <div className="absolute bottom-full right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden min-w-[150px]">
                <button
                  onClick={handleBumpLocal}
                  className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-semibold text-left bg-slate-800 hover:bg-slate-900 text-white transition-colors"
                >
                  <RectangleEllipsis className="w-4 h-4 flex-shrink-0" />
                  Bump Order
                </button>
              </div>
            )}
          </div>
        </div>
        </>
        )}
      </div>
    </div>

    {/* ✅ MODALS - OUTSIDE CONTAINER (Full Screen Overlays) */}
    {order.delivery_address && (
      <DeliveryDetailsModal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        deliveryAddress={order.delivery_address}
        orderType={order.order_type}
      />
    )}

    <DeliveryAssignmentModal
      isOpen={showAssignModal}
      onClose={() => setShowAssignModal(false)}
      onAssign={handleAssignDeliveryMan}
      orderId={order.id}
      currentDeliveryManId={order.delivery_man_id}
    />
  </>
);
}