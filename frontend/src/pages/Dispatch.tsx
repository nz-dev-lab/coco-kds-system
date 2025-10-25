// src/pages/Dispatch.tsx
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchOrders } from '../store/slices/ordersSlice';
import { Truck, Package, Clock, User, Phone, MapPin, RefreshCw } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useLiveClock } from '../hooks/useLiveClock';
import DeliveryDetailsModal from '../components/orders/DeliveryDetailsModal';
import { Order } from '@/types/order.type'; 

export default function Dispatch() {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state) => state.orders);
  const currentTime = useLiveClock();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useWebSocket();

  useEffect(() => {
    // Initial fetch
    dispatch(fetchOrders());
  }, [dispatch]);

  // Filter: Only picked_up delivery orders
  const dispatchOrders = orders.filter((order) => 
    order.order_status === 'picked_up' && 
    order.order_type === 'delivery'
  );

  // Sort by pickup time (oldest first - by created_at)
  const sortedOrders = [...dispatchOrders].sort((a, b) => {
    const timeA = new Date(a.created_at || Date.now()).getTime();  // ✅ FIXED
    const timeB = new Date(b.created_at || Date.now()).getTime();  // ✅ FIXED
    return timeA - timeB; // Oldest first
  });

  const handleRefresh = () => {
    dispatch(fetchOrders());
  };

  // Calculate time since pickup (order age)
  const calculateTimeSincePickup = (createdAt: string, orderAge: number): number => {
    const created = new Date(createdAt);
    if (isNaN(created.getTime())) {
      return orderAge;
    }
    const diffMs = currentTime.getTime() - created.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  };

  // Format time
  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Format clock time
  const formatClockTime = (date: Date) => {
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 dark:bg-kds-bg">
        <div className="text-center">
          <div className="spinner-lg mb-4"></div>
          <p className="text-slate-600 dark:text-kds-text-secondary">Loading dispatch...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-kds-bg">
      {/* Header */}
      <div className="bg-white dark:bg-kds-bg-secondary border-b border-slate-200 dark:border-kds-border px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Title */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-kds-text-primary">
                Dispatch Center
              </h1>
              <p className="text-sm text-slate-600 dark:text-kds-text-secondary mt-1">
                {sortedOrders.length} {sortedOrders.length === 1 ? 'order' : 'orders'} out for delivery
              </p>
            </div>
          </div>

          {/* Center: Live Clock */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-kds-surface rounded-lg border border-slate-200 dark:border-kds-border">
            <Clock className="w-5 h-5 text-slate-600 dark:text-kds-text-secondary" />
            <span className="text-2xl font-mono font-bold text-slate-900 dark:text-kds-text-primary tracking-wider">
              {formatClockTime(currentTime)}
            </span>
          </div>

          {/* Right: Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Stats Bar */}
        <div className="flex gap-6 mt-4">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-purple-600" />
            <span className="text-sm text-slate-600 dark:text-kds-text-muted">
              Active Deliveries: <span className="font-semibold text-slate-900 dark:text-kds-text-primary">{sortedOrders.length}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-green-600" />
            <span className="text-sm text-slate-600 dark:text-kds-text-muted">
              On the Road
            </span>
          </div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="mx-6 mt-4">
          <div className="alert-danger">
            {error}
          </div>
        </div>
      )}

      {/* Orders Grid */}
      <div className="flex-1 overflow-auto p-6">
        {sortedOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Truck className="w-20 h-20 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-xl text-slate-600 dark:text-kds-text-secondary mb-2">
                No orders out for delivery
              </p>
              <p className="text-sm text-slate-500 dark:text-kds-text-muted">
                Orders will appear here when delivery personnel pick them up
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 auto-rows-max">
            {sortedOrders.map((order) => {
              const timeSincePickup = order.created_at 
                ? calculateTimeSincePickup(order.created_at, order.order_age_minutes)
                : order.order_age_minutes;

              // Time-based border color (green → yellow → red)
              const getBorderColor = () => {
                if (timeSincePickup < 20) return 'border-l-green-500';
                if (timeSincePickup < 35) return 'border-l-yellow-500';
                return 'border-l-red-500';
              };

              return (
                <div 
                  key={order.id} 
                  className={`bg-white dark:bg-kds-bg-secondary rounded-lg border-l-4 ${getBorderColor()} shadow-md hover:shadow-lg transition-shadow flex flex-col min-h-[400px]`}
                >
                  {/* Header */}
                  <div className="bg-purple-600 px-4 py-3 flex items-center justify-between rounded-t-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-lg font-mono">#{order.id}</span>
                      <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-semibold rounded flex items-center gap-1">
                        <Truck className="w-3 h-3" />
                        On the Road
                      </span>
                    </div>
                    <span className="text-white text-sm font-semibold">
                      {formatTime(timeSincePickup)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-4">
                    {/* Customer Info */}
                    <div className="mb-3">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-kds-surface px-2 py-1 -ml-2 rounded transition-colors group w-full"
                      >
                        <User className="w-4 h-4 text-slate-600 dark:text-kds-text-secondary group-hover:text-slate-900" />
                        <span className="text-sm font-medium text-slate-800 dark:text-kds-text-primary group-hover:text-slate-900 truncate">
                          {order.customer_name || 'Customer'}
                        </span>
                        <svg
                          className="w-3 h-3 text-slate-400 group-hover:text-slate-600 ml-auto"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    {/* Delivery Address Preview */}
                    {order.delivery_address && (
                      <div className="mb-3 p-2 bg-slate-50 dark:bg-kds-surface rounded border border-slate-200 dark:border-kds-border">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-500 dark:text-kds-text-muted flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-slate-600 dark:text-kds-text-secondary line-clamp-2">
                            {order.delivery_address.address || 'No address provided'}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Delivery Man Info */}
                    {order.delivery_man_id && (
                      <div className="mb-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <Truck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                            Delivery Man
                          </span>
                        </div>
                        <p className="text-sm font-medium text-purple-800 dark:text-purple-200">
                          ID: #{order.delivery_man_id}
                        </p>
                      </div>
                    )}

                    {/* Items List (Compact) */}
                    <div className="space-y-1.5 mb-3">
                      <p className="text-xs font-semibold text-slate-600 dark:text-kds-text-muted uppercase tracking-wide">
                        Items ({order.item_count})
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {order.items.slice(0, 5).map((item) => (
                          <div key={item.id} className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-700 dark:text-kds-text-primary font-mono">
                              {item.quantity}x
                            </span>
                            <span className="text-slate-600 dark:text-kds-text-secondary truncate">
                              {item.name}
                            </span>
                          </div>
                        ))}
                        {order.items.length > 5 && (
                          <p className="text-xs text-slate-500 dark:text-kds-text-muted italic">
                            +{order.items.length - 5} more items
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Order Amount */}
                    {order.order_amount && (
                      <div className="pt-2 border-t border-slate-200 dark:border-kds-border">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-kds-text-muted">
                            Total Amount:
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-kds-text-primary">
                            £{parseFloat(order.order_amount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-4 pt-0 border-t border-slate-100 dark:border-kds-border flex-shrink-0 mt-auto">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delivery Details Modal */}
      {selectedOrder?.delivery_address && (
        <DeliveryDetailsModal
          isOpen={selectedOrder !== null}
          onClose={() => setSelectedOrder(null)}
          deliveryAddress={selectedOrder.delivery_address}
          orderType={selectedOrder.order_type}
        />
      )}
    </div>
  );
}