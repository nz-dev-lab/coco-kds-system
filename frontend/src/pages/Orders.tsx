import { useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { Order } from '@/types/order.type';
import { PrintOrderTemplate } from '../components/orders/PrintOrderTemplate';
import { usePrintOrder } from '../hooks/usePrintOrder';
import { Printer, X, Truck, Package, UtensilsCrossed, Receipt } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  delivery:  { label: 'Delivery',  Icon: Truck,           color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-900/20',   border: 'border-blue-200 dark:border-blue-700' },
  take_away: { label: 'Takeaway',  Icon: Package,         color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-700' },
  dine_in:   { label: 'Dine-in',   Icon: UtensilsCrossed, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-200 dark:border-purple-700' },
} as const;

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.dine_in;
}

function formatAmount(amount: string) {
  return `£${parseFloat(amount || '0').toFixed(2)}`;
}

// ── Order Block ───────────────────────────────────────────────────────────────

function OrderBlock({ order, selected, onClick }: {
  order: Order;
  selected: boolean;
  onClick: () => void;
}) {
  const cfg = getTypeConfig(order.order_type);
  const { Icon } = cfg;

  return (
    <button
      onClick={onClick}
      className={`
        w-full text-left rounded-xl border-2 p-4 transition-all
        ${selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-md'
          : `border-slate-200 dark:border-kds-border bg-white dark:bg-kds-bg-secondary hover:border-blue-300 hover:shadow-sm`
        }
      `}
    >
      {/* Top row: order number + amount */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <span className="text-lg font-bold text-slate-800 dark:text-kds-text-primary leading-none">
          #{order.id}
        </span>
        <span className="text-base font-bold text-slate-700 dark:text-kds-text-primary">
          {formatAmount(order.order_amount)}
        </span>
      </div>

      {/* Type badge */}
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${cfg.bg} ${cfg.color} mb-3`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </div>

      {/* Customer / note */}
      <div className="text-sm text-slate-500 dark:text-kds-text-muted truncate">
        {order.delivery_address?.contact_person_name
          ?? order.customer_name
          ?? (order.order_type === 'dine_in' ? 'Dine-in' : 'Walk-in')}
      </div>

      {/* Item count */}
      <div className="mt-2 text-xs text-slate-400 dark:text-kds-text-muted">
        {order.item_count} item{order.item_count !== 1 ? 's' : ''}
      </div>
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function Orders() {
  const orders = useAppSelector((s) => s.orders.orders);
  const restaurantName = useAppSelector((s) => s.auth.restaurant?.name);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { printWithSelection, isPrinting } = usePrintOrder();

  const handleSelect = (order: Order) => {
    setSelectedOrder(prev => prev?.id === order.id ? null : order);
  };

  const handleClose = () => setSelectedOrder(null);

  const handlePrint = async () => {
    if (!selectedOrder) return;
    await printWithSelection(selectedOrder);
  };

  return (
    <div className="flex h-full relative">
      {/* ── Order List ─────────────────────────────────────────────────────── */}
      <div
        className={`flex-1 min-w-0 p-6 overflow-y-auto transition-all duration-300 ${
          selectedOrder ? 'pr-[420px]' : ''
        }`}
      >
        <div className="max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-kds-text-primary">
              Receipt Preview
            </h1>
            <p className="text-sm text-slate-500 dark:text-kds-text-muted mt-1">
              {orders.length > 0
                ? `${orders.length} active CocoEats order${orders.length !== 1 ? 's' : ''} — click to preview receipt`
                : 'No active orders right now'}
            </p>
          </div>

          {/* Empty state */}
          {orders.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 dark:text-kds-text-muted">
              <Receipt className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">No active CocoEats orders</p>
              <p className="text-xs mt-1">Orders will appear here as they come in</p>
            </div>
          )}

          {/* Order grid */}
          {orders.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {orders.map(order => (
                <OrderBlock
                  key={order.id}
                  order={order}
                  selected={selectedOrder?.id === order.id}
                  onClick={() => handleSelect(order)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Slide-in Drawer ────────────────────────────────────────────────── */}
      <div
        className={`
          fixed top-0 right-0 h-full w-[400px] bg-white dark:bg-kds-bg-secondary
          border-l border-slate-200 dark:border-kds-border shadow-2xl
          flex flex-col z-40
          transition-transform duration-300 ease-in-out
          ${selectedOrder ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {selectedOrder && (
          <>
            {/* Drawer header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-kds-border flex-shrink-0">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-kds-text-primary">
                  Order #{selectedOrder.id}
                </p>
                <p className="text-xs text-slate-400 dark:text-kds-text-muted mt-0.5">
                  Receipt Preview
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  disabled={isPrinting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  {isPrinting ? 'Printing…' : 'Print'}
                </button>
                <button
                  onClick={handleClose}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-kds-surface text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Receipt preview */}
            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-kds-surface p-4">
              <div className="flex justify-center">
                {/* Paper shadow effect */}
                <div className="shadow-lg rounded-sm">
                  <PrintOrderTemplate order={selectedOrder} restaurantName={restaurantName} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
