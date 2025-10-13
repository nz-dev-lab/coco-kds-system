// src/components/orders/OrderCard.tsx
import { User, Printer, AlertCircle, Bike, CalendarClock } from 'lucide-react';
import { useAppDispatch } from '../../store/hooks';
import { toggleItemReady } from '../../store/slices/ordersSlice';
import DeliveryDetailsModal from './DeliveryDetailsModal';
import { useEffect, useRef, useState } from 'react';
import { getScheduledInfo, formatCountdown } from '../../utils/scheduledOrderUtils';
import { audioNotificationService } from '@/utils/audioNotifications';
import { useCurrentTime } from '../../hooks/useCurrentTime';

interface Order {
  id: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'handover' | 'delivered';
  order_type: 'delivery' | 'take_away' | 'dine_in';
  order_age_minutes: number;
  processing_time?: string | null;
  items: OrderItem[];
  order_note?: string | null;
  delivery_man_id?: string | null;
  customer_name?: string | null;
  item_count: number;
  created_at?: string;
  schedule_at?: string;
  delivery_address?: any;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  variant?: string | null;
  add_ons?: any[];
  isReady?: boolean;
}

interface OrderCardProps {
  order: Order;
}

export default function OrderCard({ order }: OrderCardProps) {
  const dispatch = useAppDispatch();
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const currentTime = useCurrentTime();

  // Add safety check for items
  const items = order.items || [];

  // If no items, show error state
  if (!order || !items.length) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">
          ⚠️ Order #{order?.id || 'unknown'} has no items
        </p>
      </div>
    );
  }

  // Calculate order age in real-time using currentTime
  const calculateOrderAge = (createdAt: string): number => {
    const created = new Date(createdAt);
    const diffMs = currentTime.getTime() - created.getTime();
    return Math.floor(diffMs / 60000); // Convert to minutes
  };

  const orderAge = order.created_at ? calculateOrderAge(order.created_at) : order.order_age_minutes;

  // Calculate scheduled info
  const scheduledInfo = order.schedule_at && order.created_at
    ? getScheduledInfo(order.schedule_at, order.created_at, order.order_type, currentTime)
    : { isScheduled: false };

  // Status color mapping (matching prototype)
  const statusConfig = {
    pending: {
      bg: 'bg-[#3B82F6]', // Blue
      text: 'New',
    },
    confirmed: {
      bg: 'bg-[#F59E0B]', // Amber
      text: 'Processing',
    },
    processing: {
      bg: 'bg-[#F97316]', // Orange
      text: 'Processing',
    },
    handover: {
      bg: 'bg-[#10B981]', // Green
      text: 'Ready',
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

  const handlePrint = () => {
    console.log('Print order:', order.id);
  };

  const handleBump = () => {
    console.log('Bump order:', order.id);
  };

  const handleAssignDelivery = () => {
    if (order.order_status === 'handover' && order.order_type === 'delivery' && !order.delivery_man_id) {
      console.log('Assign delivery:', order.id);
    }
  };

  const handleConfirm = () => {
    console.log('Confirm order:', order.id);
  };

  const handleStartCooking = () => {
    console.log('Start cooking:', order.id);
  };

  // Check if delivery assignment is available
  const canAssignDelivery = order.order_type === 'delivery' &&
    order.order_status === 'handover' &&
    !order.delivery_man_id;

  // Track previous scheduled status
  const prevStatusRef = useRef<'locked' | 'ready' | 'overdue' | undefined>(undefined);

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

  return (
    <div className={`bg-white rounded-lg border-l-4 ${getAgeBorderColor()} shadow-md hover:shadow-lg transition-shadow flex flex-col min-h-[500px]`}>
      {/* Header */}
      <div className={`${config.bg} px-4 py-3 flex items-center justify-between rounded-t-lg`}>
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg font-mono">#{order.id}</span>
          <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded">
            {config.text}
          </span>
          {/* Scheduled Badge */}
          {scheduledInfo.isScheduled && (
            <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-semibold rounded flex items-center gap-1">
              <CalendarClock className="w-3 h-3" />
              SCHEDULED
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Time Display - Scheduled time or Age */}
          {scheduledInfo.isScheduled ? (
            <span className="text-white text-xs font-semibold">
              🕐 {scheduledInfo.scheduledTimeFormatted}
            </span>
          ) : (
            <span className="text-white text-sm font-semibold">
              {formatTime(orderAge)}
            </span>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Customer Info & Order Type */}
        <div className="flex items-center justify-between mb-3">
          {order.customer_name ? (
            <button
              onClick={() => setShowDeliveryModal(true)}
              className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 -ml-2 rounded transition-colors group"
            >
              <User className="w-4 h-4 text-slate-600 group-hover:text-slate-900" />
              <span className="text-sm font-medium text-slate-800 group-hover:text-slate-900 truncate max-w-[150px]">
                {order.customer_name}
              </span>
              <svg
                className="w-3 h-3 text-slate-400 group-hover:text-slate-600"
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

          <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded uppercase">
            {order.order_type.replace('_', ' ')}
          </span>
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
                <CalendarClock className={`w-3.5 h-3.5 ${
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
                  <span className="font-bold text-slate-900 font-mono text-sm">{item.quantity}x</span>
                  <span className={`text-sm font-medium ${item.isReady ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {item.name}
                  </span>
                </div>
                {item.variant && (
                  <div className="text-xs text-slate-500 ml-6">{item.variant}</div>
                )}
                {item.add_ons && item.add_ons.length > 0 && (
                  <div className="text-xs text-slate-500 ml-6">
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
            <p className="text-xs text-yellow-800 font-medium">{order.order_note}</p>
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

        {/* Delivery Assignment Status */}
        {order.delivery_man_id && (
          <div className="bg-purple-50 border border-purple-200 px-3 py-2 rounded-lg mb-3">
            <p className="text-xs text-purple-800 font-medium flex items-center gap-2">
              <Bike className="w-3 h-3" />
              Assigned to Delivery #{order.delivery_man_id}
            </p>
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Buttons */}
      <div className="p-4 pt-0 border-t border-slate-100 flex-shrink-0 mt-auto">
        {/* Main Status Action Button */}

        {/* Confirm Order - ALWAYS enabled for pending orders */}
        {order.order_status === 'pending' && (
          <button
            onClick={handleConfirm}
            className="w-full py-2.5 mb-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Confirm Order
          </button>
        )}

        {/* Start Cooking - LOCKED if scheduled and not ready */}
        {order.order_status === 'confirmed' && (
          <button
            onClick={handleStartCooking}
            disabled={scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing}
            className={`w-full py-2.5 mb-2 font-semibold rounded-lg transition-colors ${
              scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700 text-white'
            }`}
            title={scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing && scheduledInfo.prepWindowOpens
              ? `Locked until ${scheduledInfo.prepWindowOpens.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`
              : undefined
            }
          >
            {scheduledInfo.isScheduled && !scheduledInfo.canStartPreparing && scheduledInfo.minutesUntilPrep
              ? `🔒 Locked (${formatCountdown(scheduledInfo.minutesUntilPrep)} left)`
              : 'Start Cooking'
            }
          </button>
        )}

        {/* Mark as Ready */}
        {order.order_status === 'processing' && (
          <button
            onClick={handleBump}
            className="w-full py-2.5 mb-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
          >
            Mark as Ready
          </button>
        )}

        {/* Complete Order */}
        {order.order_status === 'handover' && (
          <button
            onClick={handleBump}
            className="w-full py-2.5 mb-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            Complete Order
          </button>
        )}

        {/* Bottom Action Bar - Always Visible */}
        <div className="flex gap-2">
          {/* Print Button - Left */}
          <button
            onClick={handlePrint}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors group"
            title="Print order"
          >
            <Printer className="w-4 h-4 group-hover:text-slate-900" />
          </button>

          {/* Bump Button - Center/Fill */}
          <button
            onClick={handleBump}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
          >
            Bump
          </button>

          {/* Assign Delivery Button - Right (Always visible, disabled for non-delivery) */}
          <button
            onClick={handleAssignDelivery}
            disabled={!canAssignDelivery}
            className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              canAssignDelivery
                ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
            title={
              order.order_type !== 'delivery'
                ? 'Delivery assignment not available for this order type'
                : canAssignDelivery
                ? 'Assign delivery person'
                : 'Not ready for delivery assignment'
            }
          >
            <Bike className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Delivery Details Modal */}
      {order.delivery_address && (
        <DeliveryDetailsModal
          isOpen={showDeliveryModal}
          onClose={() => setShowDeliveryModal(false)}
          deliveryAddress={order.delivery_address}
          orderType={order.order_type}
        />
      )}
    </div>
  );
}