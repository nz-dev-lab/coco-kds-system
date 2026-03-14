// src/components/orders/KitchenOrderCard.tsx
// Read-only display card for kitchen / station screens (stationView !== 'all').
// Handles both CocoEats and TMBILL order shapes via normalised access.
//
// Intentionally stripped of:
//   - Status action buttons (Confirm / Start Cooking / Mark Ready / Complete)
//   - Print button
//   - Delivery assignment
//   - Bump / Recall
//   - Item checkboxes / progress bar
//   - Payment info / modals
//
// What kitchen staff need at a glance:
//   - Order number + age (urgency colour)
//   - Order type + table / customer
//   - Special notes (KOT note / order note)
//   - Item list — large, high-contrast, quantity-first

import { memo, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bike,
  Clock,
  ClipboardList,
  CookingPot,
  ShoppingBag,
  Store,
  Zap,
} from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { clearFlashOrder } from '../../store/slices/uiSlice';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import CocoEatsIcon from '../icons/CocoEatsIcon';
import { detectScheduledTime, getTmbillScheduleInfo, formatTmbillCountdown } from '../../utils/scheduledTmbillUtils';

interface KitchenOrderCardProps {
  order: any;
}

// ── Status header colours — mirrors OrderCard / TmbillOrderCard ───────────────
const STATUS_BG: Record<string, string> = {
  pending:    'bg-blue-500',
  confirmed:  'bg-teal-600',
  processing: 'bg-orange-500',
  ready:      'bg-green-500',
  handover:   'bg-green-500',
};

// ── Item name font — one step larger than packing card for readability ────────
const ITEM_FONT: Record<string, string> = {
  sm:   'text-base',
  base: 'text-lg',
  lg:   'text-xl',
  xl:   'text-2xl',
};

function KitchenOrderCard({ order }: KitchenOrderCardProps) {
  const dispatch = useAppDispatch();
  const currentTime = useCurrentTime();

  const itemNameFontSize  = useAppSelector((s) => s.ui.settings.display.itemNameFontSize  ?? 'sm');
  const itemNameUppercase = useAppSelector((s) => s.ui.settings.display.itemNameUppercase ?? false);
  const isNewOrder        = useAppSelector((s) => s.ui.flashOrderIds?.includes(String(order.id)) ?? false);
  const [showAnimation, setShowAnimation] = useState(isNewOrder);

  // ── Normalise order fields across both CocoEats and TMBILL shapes ────────────
  const isTmbill    = order._source === 'tmbill';
  const items       = order.items ?? [];
  const orderNumber = isTmbill ? `#${order.order_number}` : `#${order.id}`;
  const status      = isTmbill ? (order.status ?? 'pending') : (order.order_status ?? 'pending');
  const orderType   = order.order_type ?? 'dine_in';
  const note        = order.order_note || order.kot_note || null;

  // ── Age (mirrors OrderCard's calculateOrderAge) ───────────────────────────────
  const orderAge = (() => {
    if (!order.created_at) return order.order_age_minutes ?? 0;
    const created = new Date(order.created_at);
    if (isNaN(created.getTime())) return order.order_age_minutes ?? 0;
    return Math.max(0, Math.floor((currentTime.getTime() - created.getTime()) / 60000));
  })();

  const formatAge = (m: number) =>
    m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${m % 60}m`;

  // ── Scheduled time detection (TMBILL orders only, auto-detect from notes) ────
  const alertMinutes = useAppSelector((s) => s.ui.settings.tmbillNotifications?.scheduledAlertMinutes ?? 30);
  const scheduleInfo = useMemo(() => {
    if (!isTmbill) return null;
    const detected = detectScheduledTime(order, currentTime);
    if (!detected) return null;
    return getTmbillScheduleInfo(detected.scheduledTime, detected.confidence, alertMinutes, currentTime);
  }, [isTmbill, order, alertMinutes, currentTime]);

  // ── Age border — amber/red override when scheduled TMBILL order is approaching/overdue
  const ageBorder =
    scheduleInfo?.isOverdue    ? 'border-l-red-600' :
    scheduleInfo?.isApproaching ? 'border-l-purple-500' :
    orderAge < 15 ? 'border-l-green-500' :
    orderAge < 30 ? 'border-l-yellow-500' :
                    'border-l-red-500';

  const headerBg = STATUS_BG[status] ?? 'bg-slate-500';
  const itemFont = ITEM_FONT[itemNameFontSize] ?? 'text-base';

  // ── Order type label + icon ───────────────────────────────────────────────────
  const orderTypeDisplay: Record<string, { label: string; icon: React.ReactNode }> = {
    delivery:   { label: 'Delivery',   icon: <Bike        className="w-4 h-4" /> },
    take_away:  { label: 'Takeaway',   icon: <ShoppingBag className="w-4 h-4" /> },
    takeaway:   { label: 'Takeaway',   icon: <ShoppingBag className="w-4 h-4" /> },
    quick_bill: { label: 'Quick Bill', icon: <Zap         className="w-4 h-4" /> },
    dine_in:    { label: 'Dine In',    icon: <CookingPot  className="w-4 h-4" /> },
  };
  const typeDisplay = orderTypeDisplay[orderType] ?? { label: orderType, icon: <CookingPot className="w-4 h-4" /> };

  // ── Sync showAnimation when flash is dispatched after mount ─────────────────
  useEffect(() => {
    if (isNewOrder) setShowAnimation(true);
  }, [isNewOrder]);

  // ── Auto-dismiss new-order animation after 60 s ───────────────────────────────
  useEffect(() => {
    if (!isNewOrder || !showAnimation) return;
    const t = setTimeout(() => {
      setShowAnimation(false);
      dispatch(clearFlashOrder(String(order.id)));
    }, 60_000);
    return () => clearTimeout(t);
  }, [isNewOrder, showAnimation, order.id, dispatch]);

  // ── Guard ─────────────────────────────────────────────────────────────────────
  if (!items.length) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
        <p className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ Order {orderNumber} has no items
        </p>
      </div>
    );
  }

  return (
    <div className={`
      @container
      bg-white dark:bg-kds-bg-secondary
      rounded-lg border-l-4 ${ageBorder}
      shadow-md
      flex flex-col
      min-w-[240px] max-w-[550px] w-full
      ${showAnimation ? 'new-order-animation-kitchen' : ''}
    `}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className={`${headerBg} px-4 py-3 rounded-t-lg`}>
        <div className="flex items-center justify-between gap-2">
          {/* Order number + source icon */}
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-white font-bold text-xl font-mono flex-shrink-0">
              {orderNumber}
            </span>
            {isTmbill
              ? <Store         className="w-4 h-4 text-white/70 flex-shrink-0" />
              : <CocoEatsIcon  className="w-4 h-4 text-white/70 flex-shrink-0" />
            }
          </div>
          {/* Age */}
          <span className="text-white font-bold text-lg flex-shrink-0">
            {formatAge(orderAge)}
          </span>
        </div>
      </div>

      {/* ── Scheduled badge strip (TMBILL only) ─────────────────────────────── */}
      {scheduleInfo?.detected && (
        <div className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-semibold ${
          scheduleInfo.isOverdue
            ? 'bg-red-100 text-red-700'
            : scheduleInfo.isApproaching
            ? 'bg-purple-100 text-purple-800'
            : 'bg-purple-50 text-purple-700'
        }`}>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>
            {scheduleInfo.isOverdue
              ? `Overdue by ${formatTmbillCountdown(scheduleInfo.minutesUntil ?? 0)}`
              : `Scheduled ${scheduleInfo.scheduledTimeFormatted} — in ${formatTmbillCountdown(scheduleInfo.minutesUntil ?? 0)}`
            }
          </span>
          {scheduleInfo.confidence === 'medium' && (
            <span className="opacity-60 text-[10px]">(inferred)</span>
          )}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="p-4 flex flex-col gap-3">

        {/* Order type + table / customer + waiter */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-kds-text-secondary text-sm font-medium">
            {typeDisplay.icon}
            <span>{typeDisplay.label}</span>
            {order.table_number && (
              <span className="text-slate-400 dark:text-kds-text-muted">
                · {order.table_number}
              </span>
            )}
            {!isTmbill && order.customer_name && (
              <span className="text-slate-400 dark:text-kds-text-muted truncate max-w-[120px]">
                · {order.customer_name}
              </span>
            )}
          </div>
          {order.ordered_by && (
            <span className="text-xs text-slate-400 dark:text-kds-text-muted truncate max-w-[100px]">
              {order.ordered_by}
            </span>
          )}
        </div>

        {/* Note (order_note or kot_note) */}
        {note && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/30 border-l-2 border-amber-400 px-3 py-2 rounded-r">
            {isTmbill
              ? <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              : <AlertCircle   className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            }
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 break-words leading-snug">
              {note}
            </p>
          </div>
        )}

        {/* Items list — no checkboxes, large text */}
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-start gap-3">
              {/* Quantity */}
              <span className={`font-black font-mono text-2xl leading-tight flex-shrink-0 w-10 text-right ${item.isReady ? 'text-slate-300 dark:text-kds-text-muted line-through' : 'text-slate-900 dark:text-kds-text-primary'}`}>
                {item.quantity}×
              </span>

              {/* Name + modifiers */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={`font-bold leading-snug ${itemFont} ${itemNameUppercase ? 'uppercase' : ''} ${item.isReady ? 'line-through text-slate-400 dark:text-kds-text-muted' : 'text-slate-900 dark:text-kds-text-primary'}`}>
                  {item.name}
                </p>
                {!item.isReady && item.variant && (
                  <p className="text-sm text-slate-500 dark:text-kds-text-muted mt-0.5">{item.variant}</p>
                )}
                {!item.isReady && item.add_ons?.length > 0 && (
                  <p className="text-sm text-slate-500 dark:text-kds-text-muted mt-0.5">
                    + {item.add_ons.map((a: any) => a.name).join(', ')}
                  </p>
                )}
                {!item.isReady && item.notes && (
                  <p className="text-sm text-slate-500 dark:text-kds-text-muted italic mt-0.5">
                    {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default memo(KitchenOrderCard);
