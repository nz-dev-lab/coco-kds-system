// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchOrders, selectAllActiveOrders, selectTmbillConnected, selectTmbillBumpedOrders, selectCocoeatsBumpedOrders } from '../store/slices/ordersSlice';
import OrderCard from '../components/orders/OrderCard';
import TmbillOrderCard from '../components/orders/TmbillOrderCard';
import { runTmbillAutoConnect } from '@/hooks/useTmbillOrders';
import { RefreshCw, Clock, Wifi, WifiOff, ScanSearch, ChevronDown, ChevronUp } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useLiveClock } from '../hooks/useLiveClock';
import { clearRecentlyUpdated, releaseFocus } from '@/store/slices/uiSlice';

export default function Dashboard() {
  const dispatch = useAppDispatch();
  // Cast to any[] — Dashboard is not yet shape-aware for TMBILL vs CocoEats orders.
  // TMBILL orders have `status` not `order_status`; filter/sort fall back to 99 priority which is correct.
  // OrderCard internals will be updated when the TMBILL card component is built.
  const orders = useAppSelector(selectAllActiveOrders) as any[];
  const { loading, error } = useAppSelector((state) => state.orders);
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const selectedSource = useAppSelector((state) => state.ui.selectedSource);
  const focusedOrderId = useAppSelector((state) => state.ui.focusedOrderId);
  const focusedOrderPosition = useAppSelector((state) => state.ui.focusedOrderPosition);
  const tmbillConnected = useAppSelector(selectTmbillConnected);
  const hasTmbill = typeof window !== 'undefined' && !!window.tmbill;

  const tmbillBumpedOrders = useAppSelector(selectTmbillBumpedOrders);
  const cocoeatsBumpedOrders = useAppSelector(selectCocoeatsBumpedOrders);
  const allBumpedCount = tmbillBumpedOrders.length + cocoeatsBumpedOrders.length;
  const [tmbillScanning, setTmbillScanning] = useState(false);
  const [showBumped, setShowBumped] = useState(false);

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

  useEffect(() => {
  return () => {
    // Clear focus and highlights when leaving dashboard
    dispatch(releaseFocus());
    dispatch(clearRecentlyUpdated());
  };
}, [dispatch]);

  // Filter out completed/delivered orders + apply source filter
  const activeOrders = orders.filter((order) => {
    // Source filter
    if (selectedSource === 'cocoeats' && order._source !== 'cocoeats') return false;
    if (selectedSource === 'tmbill' && order._source !== 'tmbill') return false;

    // CocoEats: exclude delivered and picked_up
    if (order.order_status === 'delivered') return false;
    if (order.order_status === 'picked_up') return false;

    // TMBILL: exclude served orders (status 5 = SERVED maps to 'handover')
    if (order._source === 'tmbill' && order.status === 'handover') return false;

    return true;
  });

  // Sort orders by status priority first, then by creation time (newest first)
  const statusPriority: Record<string, number> = {
    pending: 1,
    confirmed: 2,
    processing: 3,
    ready: 4,
    handover: 5,
    delivered: 6,
  };

 const sortedOrders = useMemo(() => {
  // 1. Sort all orders by priority first
  const sorted = [...activeOrders].sort((a, b) => {
    // TMBILL orders use `status`; CocoEats orders use `order_status`
    const statusA = a._source === 'tmbill' ? a.status : a.order_status;
    const statusB = b._source === 'tmbill' ? b.status : b.order_status;
    const statusDiff = (statusPriority[statusA] || 99) - (statusPriority[statusB] || 99);
    if (statusDiff !== 0) return statusDiff;
    const timeA = new Date(a.created_at ?? 0).getTime();
    const timeB = new Date(b.created_at ?? 0).getTime();
    return timeB - timeA; // newest first within same status (freshest order at front)
  });
  
  // 2. If there's a focused order, keep it at its original position
  if (focusedOrderId && focusedOrderPosition !== null) {
    const focusedIndex = sorted.findIndex(o => o.id === focusedOrderId);
    
    if (focusedIndex > -1) {
      // Remove focused order from its sorted position
      const [focusedOrder] = sorted.splice(focusedIndex, 1);
      
      // Insert at original position (or as close as possible)
      const insertPosition = Math.min(focusedOrderPosition, sorted.length);
      sorted.splice(insertPosition, 0, focusedOrder);
    }
  }
  
  return sorted;
}, [activeOrders, focusedOrderId, focusedOrderPosition]);

  const handleRefresh = () => {
    dispatch(fetchOrders());
  };

  const handleTmbillScan = async () => {
    if (tmbillScanning) return;
    setTmbillScanning(true);
    try {
      await runTmbillAutoConnect(dispatch);
    } finally {
      setTmbillScanning(false);
    }
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

          {/* Right: TMBILL status + Refresh */}
          <div className="flex items-center gap-3">
            {/* TMBILL POS indicator — only shown when plugin is available */}
            {hasTmbill && (
              tmbillConnected ? (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-700 dark:text-green-400">TMBILL</span>
                </div>
              ) : (
                <button
                  onClick={handleTmbillScan}
                  disabled={tmbillScanning}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/20 dark:hover:bg-amber-900/40 border border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-400 rounded-lg transition-colors disabled:opacity-50"
                  title="Scan LAN for TMBILL POS"
                >
                  {tmbillScanning
                    ? <ScanSearch className="w-4 h-4 animate-pulse" />
                    : <WifiOff className="w-4 h-4" />
                  }
                  <span className="text-sm font-medium">
                    {tmbillScanning ? 'Scanning...' : 'Find TMBILL POS'}
                  </span>
                </button>
              )
            )}

            {allBumpedCount > 0 && (
              <button
                onClick={() => setShowBumped(v => !v)}
                className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-kds-surface dark:hover:bg-kds-border border border-slate-300 dark:border-kds-border text-slate-700 dark:text-kds-text-primary rounded-lg transition-colors"
              >
                <span className="text-sm font-medium">Bumped ({allBumpedCount})</span>
                {showBumped ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            )}

            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
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

      {/* Orders Grid */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {sortedOrders.length === 0 ? (
            <div className="flex items-center justify-center h-64">
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
              {sortedOrders.map((order: any, index) => (
                order._source === 'tmbill'
                  ? <TmbillOrderCard key={order.id} order={order} gridPosition={index} />
                  : <OrderCard key={order.id} order={order} gridPosition={index} />
              ))}
            </div>
          )}
        </div>

        {/* Bumped Orders Section */}
        {showBumped && allBumpedCount > 0 && (
          <div className="border-t border-slate-200 dark:border-kds-border p-6 bg-slate-100/60 dark:bg-kds-surface/20">
            <h2 className="text-base font-semibold text-slate-600 dark:text-kds-text-secondary mb-4 uppercase tracking-wide">
              Bumped Orders ({allBumpedCount})
            </h2>
            <div className={`
              grid gap-4 auto-rows-max
              grid-cols-1
              sm:grid-cols-2
              ${sidebarOpen
                ? 'lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
                : 'lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              }
            `}>
              {tmbillBumpedOrders.map((order, index) => (
                <TmbillOrderCard key={order.id} order={order} gridPosition={index} isBumped={true} />
              ))}
              {cocoeatsBumpedOrders.map((order, index) => (
                <OrderCard key={order.id} order={order as any} gridPosition={index} isBumped={true} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}