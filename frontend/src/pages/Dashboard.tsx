// src/pages/Dashboard.tsx
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchOrders } from '../store/slices/ordersSlice';
import OrderCard from '../components/orders/OrderCard';
import { RefreshCw, Clock } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useLiveClock } from '../hooks/useLiveClock';

export default function Dashboard() {
  const dispatch = useAppDispatch();
  const { orders, loading, error } = useAppSelector((state) => state.orders);
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen); 
  
  // Live clock that updates every second
  const currentTime = useLiveClock();

  useWebSocket();

  useEffect(() => {
    // Initial fetch
    dispatch(fetchOrders());

    // // Refresh every 30 seconds
    // const interval = setInterval(() => {
    //   dispatch(fetchOrders());
    // }, 30000);

    // return () => clearInterval(interval);
  }, [dispatch]);

  // Filter out delivered orders
  const activeOrders = orders.filter((order) => {
    // Exclude delivered orders
    if (order.order_status === 'delivered') return false;
    
    // Exclude picked_up orders (they go to Dispatch page)
    if (order.order_status === 'picked_up') return false;
    
    return true;
  });

  // Sort orders by status priority first, then by creation time (newest first)
  const statusPriority: Record<string, number> = {
    pending: 1,
    confirmed: 2,
    processing: 3,
    handover: 4,
    delivered: 5,
  };

  const sortedOrders = [...activeOrders].sort((a, b) => {
    // First, sort by status priority
    const statusDiff = (statusPriority[a.order_status] || 99) - (statusPriority[b.order_status] || 99);
    
    if (statusDiff !== 0) {
      return statusDiff; // Different status, use priority
    }
    
    // Same status, sort by creation time (newest first)
    const timeA = new Date(a.created_at ?? 0).getTime();
    const timeB = new Date(b.created_at ?? 0).getTime();
    
    return timeB - timeA; // Newest first (descending order)
  });

  const handleRefresh = () => {
    dispatch(fetchOrders());
  };

  // Format time function
  const formatTime = (date: Date) => {
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
          <p className="text-slate-600 dark:text-kds-text-secondary">Loading orders...</p>
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
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-kds-text-primary">
              Active Orders
            </h1>
            <p className="text-sm text-slate-600 dark:text-kds-text-secondary mt-1">
              {sortedOrders.length} {sortedOrders.length === 1 ? 'order' : 'orders'} in queue
            </p>
          </div>

          {/* Center: Live Clock */}
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-kds-surface rounded-lg border border-slate-200 dark:border-kds-border">
            <Clock className="w-5 h-5 text-slate-600 dark:text-kds-text-secondary" />
            <span className="text-2xl font-mono font-bold text-slate-900 dark:text-kds-text-primary tracking-wider">
              {formatTime(currentTime)}
            </span>
          </div>

          {/* Right: Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Status Legend */}
        <div className="flex gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
            <span className="text-xs text-slate-600 dark:text-kds-text-muted">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-teal-600"></div>
            <span className="text-xs text-slate-600 dark:text-kds-text-muted">Confirmed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-xs text-slate-600 dark:text-kds-text-muted">Cooking</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-xs text-slate-600 dark:text-kds-text-muted">Ready</span>
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

      {/* Orders Grid - ✅ FIXED WITH RESPONSIVE COLUMNS */}
      <div className="flex-1 overflow-auto p-6">
        {sortedOrders.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-xl text-slate-600 dark:text-kds-text-secondary mb-2">
                No active orders
              </p>
              <p className="text-sm text-slate-500 dark:text-kds-text-muted">
                Orders will appear here when they come in
              </p>
            </div>
          </div>
        ) : (
          <div className={`
            grid gap-4 auto-rows-max
            grid-cols-1
            sm:grid-cols-2
            ${sidebarOpen 
              ? 'lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
              : 'lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
            }
          `}>
            {sortedOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}