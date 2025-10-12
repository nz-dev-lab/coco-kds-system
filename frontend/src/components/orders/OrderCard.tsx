// src/components/orders/OrderCard.tsx
import { Clock, User, Printer, AlertCircle, Bike } from 'lucide-react';
import { useAppDispatch } from '../../store/hooks';
import { toggleItemReady } from '../../store/slices/ordersSlice';
import DeliveryDetailsModal from './DeliveryDetailsModal';
import { useState } from 'react';

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

  // Age-based border color
  const getAgeBorderColor = () => {
    if (order.order_age_minutes < 15) return 'border-l-green-500';
    if (order.order_age_minutes < 30) return 'border-l-yellow-500';
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

  // Check if delivery assignment is available
  const canAssignDelivery = order.order_type === 'delivery' && 
                            order.order_status === 'handover' && 
                            !order.delivery_man_id;

  return (
    <div className={`bg-white rounded-lg border-l-4 ${getAgeBorderColor()} shadow-md hover:shadow-lg transition-shadow flex flex-col min-h-[500px]`}>
      {/* Header */}
      <div className={`${config.bg} px-4 py-3 flex items-center justify-between rounded-t-lg`}>
        <div className="flex items-center gap-3">
          <span className="text-white font-bold text-lg font-mono">#{order.id}</span>
          <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded">
            {config.text}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-white text-sm font-semibold">{formatTime(order.order_age_minutes)}</span>
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
        {order.order_status === 'pending' && (
          <button
            onClick={handleConfirm}
            className="w-full py-2.5 mb-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Confirm Order
          </button>
        )}

        {order.order_status === 'confirmed' && (
          <button
            onClick={handleBump}
            className="w-full py-2.5 mb-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
          >
            Start Cooking
          </button>
        )}

        {order.order_status === 'processing' && (
          <button
            onClick={handleBump}
            className="w-full py-2.5 mb-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
          >
            Mark as Ready
          </button>
        )}

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
            {/* <span className="text-sm font-medium">Print</span> */}
          </button>

          {/* Bump Button - Center/Fill */}
          <button
            onClick={handleBump}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
          >
            Bump
          </button>

          {/* Assign Delivery Button - Right (Always visible for delivery orders) */}
          {order.order_type === 'delivery' && (
            <button
              onClick={handleAssignDelivery}
              disabled={!canAssignDelivery}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canAssignDelivery
                  ? 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
              title={canAssignDelivery ? 'Assign delivery person' : 'Not ready for delivery assignment'}
            >
              <Bike className="w-4 h-4" />
              {/* <span className="text-sm font-medium">Assign</span> */}
            </button>
          )}
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