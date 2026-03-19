// src/pages/Dispatch.tsx
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchOrders } from '../store/slices/ordersSlice';
import { Truck, Package, Clock, User, MapPin, RefreshCw, Navigation } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useLiveClock } from '../hooks/useLiveClock';
import DeliveryMapModal from '../components/DeliveryMapModal';
import TrackingFeatureTour from '../components/TrackingFeatureTour';
import { Order } from '@/types/order.type';

export default function Dispatch() {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state) => state.orders);
  const hasSeenTrackingTour = useAppSelector((state) => state.ui.hasSeenTrackingTour);
  const currentTime = useLiveClock();
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);
  const [showTour, setShowTour] = useState(false);

  // Show the tour automatically on first visit
  useEffect(() => {
    if (!hasSeenTrackingTour) {
      const timer = setTimeout(() => setShowTour(true), 600);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTrackingTour]);

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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 auto-rows-max">
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
                  className={`bg-white dark:bg-kds-bg-secondary rounded-lg border-l-4 ${getBorderColor()} shadow-md flex flex-col`}
                >
                  {/* Header */}
                  <div className="bg-purple-600 px-3 py-2 flex items-center justify-between rounded-t-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-white font-bold font-mono truncate">#{order.id}</span>
                    </div>
                    <span className="text-white text-xs font-semibold shrink-0 ml-2">
                      {formatTime(timeSincePickup)}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 p-3 space-y-2">
                    {/* Customer */}
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-sm font-medium text-slate-800 dark:text-kds-text-primary truncate">
                        {order.customer_name || 'Customer'}
                      </span>
                    </div>

                    {/* Address */}
                    {order.delivery_address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-slate-500 dark:text-kds-text-muted line-clamp-2">
                          {order.delivery_address.address}
                        </p>
                      </div>
                    )}

                    {/* Delivery Man */}
                    {order.delivery_man_id && (
                      <div className="flex items-center gap-2 py-1.5 px-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <Truck className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                        <span className="text-xs font-medium text-purple-800 dark:text-purple-200 truncate flex-1">
                          {order.delivery_man_name || `DM #${order.delivery_man_id}`}
                        </span>
                      </div>
                    )}

                    {/* Items */}
                    <div>
                      <p className="text-xs text-slate-400 dark:text-kds-text-muted mb-1">
                        {order.item_count} {order.item_count === 1 ? 'item' : 'items'}
                      </p>
                      <div className="space-y-0.5 max-h-24 overflow-y-auto">
                        {order.items.slice(0, 4).map((item) => (
                          <div key={item.id} className="flex gap-1.5 text-xs">
                            <span className="font-bold text-slate-600 dark:text-kds-text-primary font-mono shrink-0">
                              {item.quantity}×
                            </span>
                            <span className="text-slate-500 dark:text-kds-text-secondary truncate">
                              {item.name}
                            </span>
                          </div>
                        ))}
                        {order.items.length > 4 && (
                          <p className="text-xs text-slate-400 italic">+{order.items.length - 4} more</p>
                        )}
                      </div>
                    </div>

                    {/* Amount */}
                    {order.order_amount && (
                      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-kds-border">
                        <span className="text-xs text-slate-400">Total</span>
                        <span className="text-sm font-bold text-slate-800 dark:text-kds-text-primary">
                          £{parseFloat(order.order_amount).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Footer — Track button */}
                  <div className="px-3 pb-3">
                    <button
                      onClick={() => setTrackingOrder(order)}
                      className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Navigation className="w-4 h-4" />
                      Track
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Live Tracking Map Modal */}
      {trackingOrder && (
        <DeliveryMapModal
          isOpen={trackingOrder !== null}
          onClose={() => setTrackingOrder(null)}
          order={trackingOrder}
        />
      )}

      {/* Feature Tour */}
      {showTour && <TrackingFeatureTour onClose={() => setShowTour(false)} />}
    </div>
  );
}