// src/pages/History.tsx
import { useState, useEffect, useCallback } from 'react';
import { useAppSelector } from '../store/hooks';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Calendar, TrendingUp, ShoppingBag, Clock, ChevronDown, ChevronUp,
  Truck, UtensilsCrossed, Package, Users, DollarSign,
} from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';

// ── Types ───────────────────────────────────────────────────────────────────

interface DailyStats {
  total_orders: number;
  total_revenue: number;
  avg_prep_time: number;
  delivery_count: number;
  takeaway_count: number;
  dine_in_count: number;
  unique_customers: number;
}

interface CompletedOrder {
  id: string;
  created_at: string;
  completed_at: string;
  bumped_at: string;
  order_type: 'delivery' | 'take_away' | 'dine_in';
  order_status: string;
  order_amount: number;
  payment_method: string;
  item_count: number;
  items: { name: string; quantity: number; price: number }[];
  prep_time_minutes: number | null;
  customer_name: string | null;
  bumped_by_user: string;
}

interface TrendPoint {
  date: string;
  orders: number;
  revenue: number;
  avg_prep_time: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(val: number): string {
  return val.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });
}

function formatShortDate(dateStr: string): string {
  try { return format(parseISO(dateStr), 'MMM d'); } catch { return dateStr; }
}

const ORDER_TYPE_CONFIG = {
  delivery:  { label: 'Delivery',  icon: Truck,          color: 'text-blue-600',   bg: 'bg-blue-50',   dot: '#3b82f6' },
  take_away: { label: 'Takeaway',  icon: Package,        color: 'text-orange-600', bg: 'bg-orange-50', dot: '#f97316' },
  dine_in:   { label: 'Dine-in',   icon: UtensilsCrossed,color: 'text-purple-600', bg: 'bg-purple-50', dot: '#a855f7' },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="bg-white dark:bg-kds-bg-secondary rounded-xl shadow-sm border border-slate-200 dark:border-kds-border p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-kds-text-muted uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className={`text-2xl font-bold ${color} dark:text-kds-text-primary`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-1">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg bg-slate-50 dark:bg-kds-surface`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-kds-bg-secondary border border-slate-200 dark:border-kds-border rounded-lg shadow-lg p-3 text-sm">
      <p className="font-semibold text-slate-700 dark:text-kds-text-primary mb-1">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="mb-0.5">
          {entry.name}: {entry.name === 'Revenue' ? Number(entry.value).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' }) : entry.value}
        </p>
      ))}
    </div>
  );
}

function OrderRow({ order }: { order: CompletedOrder }) {
  const [expanded, setExpanded] = useState(false);
  const typeConfig = ORDER_TYPE_CONFIG[order.order_type] ?? ORDER_TYPE_CONFIG.dine_in;
  const TypeIcon = typeConfig.icon;

  return (
    <div className="border border-slate-200 dark:border-kds-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white dark:bg-kds-bg-secondary hover:bg-slate-50 dark:hover:bg-kds-surface transition-colors text-left"
      >
        <div className={`p-1.5 rounded-md ${typeConfig.bg} dark:bg-kds-surface flex-shrink-0`}>
          <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-kds-text-primary truncate">
            {order.customer_name ?? 'Unknown Customer'}
          </p>
          <p className="text-xs text-slate-400 dark:text-kds-text-muted">
            {format(new Date(order.bumped_at), 'HH:mm')} · {order.item_count} item{order.item_count !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {order.prep_time_minutes != null && (
            <span className="text-xs text-slate-400 dark:text-kds-text-muted hidden sm:block">
              {order.prep_time_minutes}m prep
            </span>
          )}
          <span className="text-sm font-semibold text-slate-700 dark:text-kds-text-primary">
            {formatCurrency(order.order_amount)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeConfig.bg} ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-4 py-3 bg-slate-50 dark:bg-kds-surface border-t border-slate-100 dark:border-kds-border">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs text-slate-600 dark:text-kds-text-secondary">
            <div><span className="text-slate-400">Order ID</span><br /><span className="font-mono">{order.id.slice(0, 12)}…</span></div>
            <div><span className="text-slate-400">Payment</span><br /><span className="capitalize">{order.payment_method ?? '—'}</span></div>
            <div><span className="text-slate-400">Bumped at</span><br />{format(new Date(order.bumped_at), 'HH:mm:ss')}</div>
            {order.prep_time_minutes != null && (
              <div><span className="text-slate-400">Prep time</span><br />{order.prep_time_minutes} min</div>
            )}
          </div>
          <div className="space-y-1">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between text-xs text-slate-700 dark:text-kds-text-primary">
                <span>{item.quantity}× {item.name}</span>
                <span className="text-slate-500">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function History() {
  const restaurant = useAppSelector((state) => state.auth.restaurant);
  const restaurantId: string = restaurant?.id ?? restaurant?._id ?? '';

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [trendDays, setTrendDays] = useState<7 | 30>(7);
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [orders, setOrders] = useState<CompletedOrder[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendLoading, setTrendLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'delivery' | 'take_away' | 'dine_in'>('all');

  const isElectron = typeof window !== 'undefined' && !!window.electron?.database;

  const fetchDayData = useCallback(async () => {
    if (!isElectron || !restaurantId) return;
    setLoading(true);
    try {
      const [statsRes, ordersRes] = await Promise.all([
        window.electron.database.getDailyStats(selectedDate, restaurantId),
        window.electron.database.getOrdersByDate(selectedDate, restaurantId),
      ]);
      if (statsRes.success) setStats(statsRes.data ?? null);
      if (ordersRes.success) setOrders((ordersRes.data as CompletedOrder[]) ?? []);
    } finally {
      setLoading(false);
    }
  }, [isElectron, restaurantId, selectedDate]);

  const fetchTrend = useCallback(async () => {
    if (!isElectron || !restaurantId) return;
    setTrendLoading(true);
    try {
      const res = await window.electron.database.getRevenueTrend(trendDays, restaurantId);
      if (res.success) setTrend((res.data as TrendPoint[]) ?? []);
    } finally {
      setTrendLoading(false);
    }
  }, [isElectron, restaurantId, trendDays]);

  useEffect(() => { fetchDayData(); }, [fetchDayData]);
  useEffect(() => { fetchTrend(); }, [fetchTrend]);

  const filteredOrders = typeFilter === 'all'
    ? orders
    : orders.filter(o => o.order_type === typeFilter);

  const trendChartData = trend.map(t => ({
    date: formatShortDate(t.date),
    Revenue: Math.round(t.revenue ?? 0),
    Orders: t.orders,
    'Avg Prep (min)': Math.round(t.avg_prep_time ?? 0),
  }));

  // Fill missing days in trend with 0 so the chart looks continuous
  const filledTrend = (() => {
    if (!trendChartData.length) {
      return Array.from({ length: trendDays }, (_, i) => ({
        date: formatShortDate(format(subDays(new Date(), trendDays - 1 - i), 'yyyy-MM-dd')),
        Revenue: 0, Orders: 0, 'Avg Prep (min)': 0,
      }));
    }
    return trendChartData;
  })();

  if (!isElectron) {
    return (
      <div className="p-6 max-w-4xl">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-kds-text-primary mb-4">Order History</h1>
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6 text-amber-800 dark:text-amber-300">
          History is only available in the Electron app — local database not accessible in browser mode.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-kds-text-primary">Order History</h1>
        <div className="flex items-center gap-2 bg-white dark:bg-kds-bg-secondary border border-slate-200 dark:border-kds-border rounded-lg px-3 py-2 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400" />
          <input
            type="date"
            value={selectedDate}
            max={todayStr}
            onChange={e => setSelectedDate(e.target.value)}
            className="text-sm text-slate-700 dark:text-kds-text-primary bg-transparent outline-none cursor-pointer"
          />
        </div>
      </div>

      {/* Daily Stat Cards */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-4 animate-pulse">
              <div className="h-3 bg-slate-200 dark:bg-kds-surface rounded w-2/3 mb-3" />
              <div className="h-7 bg-slate-200 dark:bg-kds-surface rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={ShoppingBag}  label="Total Orders"   value={String(stats.total_orders)}              color="text-blue-600" />
          <StatCard icon={DollarSign}   label="Revenue"        value={(stats.total_revenue ?? 0).toLocaleString('en-GB', { style: 'currency', currency: 'GBP' })} color="text-green-600" />
          <StatCard icon={Clock}        label="Avg Prep Time"  value={stats.avg_prep_time ? `${Math.round(stats.avg_prep_time)}m` : '—'} color="text-orange-600" />
          <StatCard icon={Users}        label="Unique Customers" value={String(stats.unique_customers ?? 0)}   color="text-purple-600" />
        </div>
      ) : (
        <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-8 text-center">
          <p className="text-slate-400 dark:text-kds-text-muted text-sm">No orders found for {selectedDate}</p>
        </div>
      )}

      {/* Order Type Breakdown — mini pill bar */}
      {stats && stats.total_orders > 0 && (
        <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-kds-text-muted uppercase tracking-wide mb-3">Order Type Breakdown</p>
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'delivery',  count: stats.delivery_count },
              { key: 'take_away', count: stats.takeaway_count },
              { key: 'dine_in',   count: stats.dine_in_count  },
            ] as const).map(({ key, count }) => {
              const cfg = ORDER_TYPE_CONFIG[key];
              const pct = stats.total_orders > 0 ? Math.round((count / stats.total_orders) * 100) : 0;
              return (
                <div key={key} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${cfg.bg} dark:bg-kds-surface`}>
                  <cfg.icon className={`w-4 h-4 ${cfg.color}`} />
                  <span className={`text-sm font-semibold ${cfg.color}`}>{count}</span>
                  <span className="text-xs text-slate-500 dark:text-kds-text-muted">{cfg.label} · {pct}%</span>
                </div>
              );
            })}
          </div>
          {/* Visual bar */}
          <div className="mt-3 flex h-2 rounded-full overflow-hidden gap-0.5">
            {stats.delivery_count > 0 && (
              <div style={{ flex: stats.delivery_count }} className="bg-blue-400 rounded-l-full" />
            )}
            {stats.takeaway_count > 0 && (
              <div style={{ flex: stats.takeaway_count }} className="bg-orange-400" />
            )}
            {stats.dine_in_count > 0 && (
              <div style={{ flex: stats.dine_in_count }} className="bg-purple-400 rounded-r-full" />
            )}
          </div>
        </div>
      )}

      {/* Revenue Trend Chart */}
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">Revenue Trend</h2>
          </div>
          <div className="flex rounded-lg border border-slate-200 dark:border-kds-border overflow-hidden text-xs font-medium">
            {([7, 30] as const).map(d => (
              <button
                key={d}
                onClick={() => setTrendDays(d)}
                className={`px-3 py-1.5 transition-colors ${
                  trendDays === d
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-kds-bg-secondary text-slate-500 dark:text-kds-text-muted hover:bg-slate-50 dark:hover:bg-kds-surface'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
        {trendLoading ? (
          <div className="h-56 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={filledTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
              <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area
                yAxisId="rev"
                type="monotone"
                dataKey="Revenue"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#colorRevenue)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Area
                yAxisId="ord"
                type="monotone"
                dataKey="Orders"
                stroke="#10b981"
                strokeWidth={2}
                fill="none"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Avg Prep Time Trend Bar Chart */}
      {trend.some(t => t.avg_prep_time > 0) && (
        <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-slate-400" />
            <h2 className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">Avg Prep Time (min)</h2>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={filledTrend} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="m" />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="Avg Prep (min)" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Order List */}
      <div className="bg-white dark:bg-kds-bg-secondary rounded-xl border border-slate-200 dark:border-kds-border p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-base font-semibold text-slate-800 dark:text-kds-text-primary">
            Orders on {format(parseISO(selectedDate), 'MMMM d, yyyy')}
            <span className="ml-2 text-slate-400 font-normal text-sm">({filteredOrders.length})</span>
          </h2>
          {/* Type filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {([
              { val: 'all', label: 'All' },
              { val: 'delivery', label: 'Delivery' },
              { val: 'take_away', label: 'Takeaway' },
              { val: 'dine_in', label: 'Dine-in' },
            ] as const).map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setTypeFilter(val)}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
                  typeFilter === val
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-kds-bg-secondary text-slate-500 dark:text-kds-text-muted border-slate-200 dark:border-kds-border hover:border-blue-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 bg-slate-100 dark:bg-kds-surface rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-kds-text-muted text-sm">
            No completed orders found
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map(order => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
