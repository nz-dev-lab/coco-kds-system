// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { fetchOrders, selectCocoeatsBumpedOrders } from '../store/slices/ordersSlice';
import { selectTmbillConnected, selectTmbillBumpedOrders } from '../store/slices/tmbillOrdersSlice';
import { selectAllActiveOrders } from '../store/selectors';
import OrderCard from '../components/orders/OrderCard';
import TmbillOrderCard from '../components/orders/TmbillOrderCard';
import { runTmbillAutoConnect } from '@/hooks/useTmbillOrders';
import { RefreshCw, Clock, Wifi, WifiOff, ScanSearch, ChevronDown, ChevronUp, ShoppingBag, DollarSign, TrendingUp } from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useLiveClock } from '../hooks/useLiveClock';
import { clearRecentlyUpdated, releaseFocus } from '@/store/slices/uiSlice';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { format, parseISO } from 'date-fns';

// ── Today's Summary mini-widget ──────────────────────────────────────────────

interface TodayStats {
  total_orders: number;
  total_revenue: number;
  avg_prep_time: number;
}

interface TrendPoint { date: string; Revenue: number; Orders: number; }

function TodaySummary({ restaurantId }: { restaurantId: string }) {
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [show, setShow] = useState(false);
  const isElectron = typeof window !== 'undefined' && !!window.electron?.database;

  const load = useCallback(async () => {
    if (!isElectron || !restaurantId) return;
    const today = format(new Date(), 'yyyy-MM-dd');
    const [sRes, tRes] = await Promise.all([
      window.electron.database.getDailyStats(today, restaurantId),
      window.electron.database.getRevenueTrend(7, restaurantId),
    ]);
    if (sRes.success && sRes.data) setStats(sRes.data);
    if (tRes.success && tRes.data) {
      setTrend((tRes.data as any[]).map(t => ({
        date: t.date ? format(parseISO(t.date), 'MMM d') : '',
        Revenue: Math.round(t.revenue ?? 0),
        Orders: t.orders,
      })));
    }
  }, [isElectron, restaurantId]);

  useEffect(() => { load(); }, [load]);
  if (!isElectron || !restaurantId) return null;

  return (
    <div className="border-t border-slate-100 dark:border-kds-border bg-white dark:bg-kds-bg-secondary">
      <button
        onClick={() => setShow(v => !v)}
        className="w-full flex items-center justify-between px-6 py-2 hover:bg-slate-50 dark:hover:bg-kds-surface transition-colors"
      >
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-kds-text-muted uppercase tracking-wide">
          <TrendingUp className="w-3.5 h-3.5" />
          Today at a Glance
        </div>
        {show ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
      </button>

      {show && (
        <div className="px-6 pb-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Stat pills */}
          <div className="flex gap-3 flex-wrap lg:col-span-1 items-start content-start">
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-kds-surface rounded-lg px-3 py-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-xs text-slate-400 dark:text-kds-text-muted">Orders</p>
                <p className="text-lg font-bold text-blue-600">{stats?.total_orders ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-green-50 dark:bg-kds-surface rounded-lg px-3 py-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <div>
                <p className="text-xs text-slate-400 dark:text-kds-text-muted">Revenue</p>
                <p className="text-lg font-bold text-green-600">
                  {stats?.total_revenue != null ? stats.total_revenue.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : '—'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-kds-surface rounded-lg px-3 py-2">
              <Clock className="w-4 h-4 text-orange-600" />
              <div>
                <p className="text-xs text-slate-400 dark:text-kds-text-muted">Avg Prep</p>
                <p className="text-lg font-bold text-orange-600">
                  {stats?.avg_prep_time ? `${Math.round(stats.avg_prep_time)}m` : '—'}
                </p>
              </div>
            </div>
          </div>
          {/* Sparkline */}
          <div className="lg:col-span-2 h-20">
            {trend.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 8 }}
                    formatter={(v: any) => [Number(v).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }), 'Revenue']}
                  />
                  <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#spark)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-300 dark:text-kds-text-muted">
                No trend data yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

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
  const restaurant = useAppSelector((state) => state.auth.restaurant);
  const restaurantId: string = restaurant?.id ?? restaurant?._id ?? '';
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

      {/* Today's Summary (collapsible) */}
      <TodaySummary restaurantId={restaurantId} />

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