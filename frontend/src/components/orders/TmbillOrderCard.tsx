// src/components/orders/TmbillOrderCard.tsx
// Visual clone of OrderCard.tsx for TMBILL POS orders (CocoKDSOrder shape).
// Excluded: print, delivery modal, scheduled logic, CocoEats-specific fields.
// Status progression calls window.tmbill IPC instead of CocoEats API.

import { Bike, Check, ClipboardList, Clock, CookingPot, RectangleEllipsis, ShoppingBag, Store, User, X, Zap } from 'lucide-react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { toggleTmbillItemReady, bumpTmbillOrder, recallTmbillOrder, markAllTmbillItemsReady, setTmbillScheduledOverride } from '../../store/slices/tmbillOrdersSlice';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentTime } from '../../hooks/useCurrentTime';
import { CocoKDSOrder } from '../../../electron/plugins/tmbill/transformer';
import { setFocusedOrder, addRecentlyUpdated, releaseFocus, removeRecentlyUpdated, clearFlashOrder } from '../../store/slices/uiSlice';
import { detectScheduledTime, getTmbillScheduleInfo, parseManualTime, formatTmbillCountdown } from '../../utils/scheduledTmbillUtils';

interface TmbillOrderCardProps {
  order: CocoKDSOrder;
  gridPosition: number;
  isBumped?: boolean;
}

function TmbillOrderCard({ order, gridPosition, isBumped = false }: TmbillOrderCardProps) {
  const dispatch = useAppDispatch();
  const currentTime = useCurrentTime();

  const requireDoubleTap = useAppSelector((s) => s.ui.settings.interaction?.requireDoubleTap ?? true);
  const processingMode   = useAppSelector((s) => s.ui.settings.interaction?.processingMode ?? 'buttons');
  const itemNameFontSize = useAppSelector((s) => s.ui.settings.display.itemNameFontSize ?? 'sm');
  const itemNameUppercase = useAppSelector((s) => s.ui.settings.display.itemNameUppercase ?? false);

  const itemNameFontClass: Record<string, string> = { sm: 'text-sm', base: 'text-base', lg: 'text-lg', xl: 'text-xl' };
  const itemNotesFontClass: Record<string, string> = { sm: 'text-xs', base: 'text-sm', lg: 'text-base', xl: 'text-lg' };
  const itemNameOverflowClass = (itemNameFontSize === 'lg' || itemNameFontSize === 'xl') ? 'line-clamp-2 break-words' : 'truncate';
  const focusedOrderId   = useAppSelector((s) => s.ui.focusedOrderId);
  const recentlyUpdatedIds = useAppSelector((s) => s.ui.recentlyUpdatedOrderIds);
  const isNewOrder = useAppSelector((s) => s.ui.flashOrderIds?.includes(order.id) ?? false);

  const isFocused         = order.id === focusedOrderId;
  const isRecentlyUpdated = recentlyUpdatedIds.includes(order.id);
  const isHeaderMode      = processingMode === 'header';

  const scheduledOverride  = useAppSelector((s) => (s as any).tmbill.scheduledOverrides?.[order.id] ?? null);
  const alertMinutes       = useAppSelector((s) => s.ui.settings.tmbillNotifications?.scheduledAlertMinutes ?? 30);

  // ── Scheduled time detection ──────────────────────────────────────────────
  const scheduleInfo = useMemo(() => {
    let scheduledTime: Date | null = null;
    let confidence: 'high' | 'medium' | 'none' = 'none';
    if (scheduledOverride) {
      scheduledTime = new Date(scheduledOverride);
      confidence = 'high';
    } else {
      const detected = detectScheduledTime(order, currentTime);
      if (detected) { scheduledTime = detected.scheduledTime; confidence = detected.confidence; }
    }
    return getTmbillScheduleInfo(scheduledTime, confidence, alertMinutes, currentTime);
  }, [scheduledOverride, order, alertMinutes, currentTime]);

  const [showAnimation, setShowAnimation] = useState(isNewOrder);
  const [menuOpen, setMenuOpen] = useState(false);

  // ── Time picker state ─────────────────────────────────────────────────────
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pickerHour,   setPickerHour]   = useState('');
  const [pickerMinute, setPickerMinute] = useState('00');
  const [pickerAmPm,   setPickerAmPm]   = useState<'am' | 'pm'>('pm');

  const items = order.items || [];

  // ── Age calculation (same as OrderCard) ───────────────────────────────────
  const calculateOrderAge = (createdAt: string, backendAge: number): number => {
    const created = new Date(createdAt);
    if (isNaN(created.getTime())) return backendAge;
    return Math.max(0, Math.floor((currentTime.getTime() - created.getTime()) / 60000));
  };
  const orderAge = order.created_at
    ? calculateOrderAge(order.created_at, order.order_age_minutes)
    : order.order_age_minutes;

  // ── Age border — amber/red override when scheduled order is approaching/overdue
  const getAgeBorderColor = () => {
    if (scheduleInfo.detected && scheduleInfo.isOverdue)    return 'border-l-red-600';
    if (scheduleInfo.detected && scheduleInfo.isApproaching) return 'border-l-purple-500';
    if (orderAge < 15) return 'border-l-green-500';
    if (orderAge < 30) return 'border-l-yellow-500';
    return 'border-l-red-500';
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  // ── Status config — mirrors OrderCard's statusConfig ──────────────────────
  // TMBILL statuses: pending | processing | ready | handover
  // (handover is the served/completed state from transformer mapKotStatus)
  const statusConfig: Record<string, { bg: string; text: string }> = {
    pending:    { bg: 'bg-[#3B82F6]', text: 'Pending'    },
    processing: { bg: 'bg-[#F97316]', text: 'Processing' },
    ready:      { bg: 'bg-[#10B981]', text: 'Ready'      },
    handover:   { bg: 'bg-[#10B981]', text: 'Served'     },
  };
  const config = statusConfig[order.status] ?? statusConfig['pending'];

  // ── Source badge (top of header, beside status badge) ─────────────────────
  const getSourceBadge = () => {
    switch (order.order_type) {
      case 'quick_bill': return { bg: 'bg-amber-500', text: 'Quick Bill' };
      case 'takeaway':   return { bg: 'bg-slate-500', text: 'Takeaway'   };
      case 'delivery':   return { bg: 'bg-blue-500',  text: 'Delivery'   };
      case 'dine_in':    return { bg: 'bg-green-700', text: 'Dine In'    };
      default:           return { bg: 'bg-gray-500',  text: 'POS'        };
    }
  };
  const sourceBadge = getSourceBadge();

  // ── Item progress (same as OrderCard) ─────────────────────────────────────
  const readyItems     = items.filter((i) => i.isReady).length;
  const totalItems     = items.length;
  const progressPercent = totalItems > 0 ? (readyItems / totalItems) * 100 : 0;

  // ── Animation helpers (same as OrderCard) ─────────────────────────────────
  const stopAnimation = useCallback(() => {
    if (showAnimation) {
      setShowAnimation(false);
      dispatch(clearFlashOrder(order.id));
    }
  }, [showAnimation, dispatch, order.id]);

  useEffect(() => {
    if (!isNewOrder || !showAnimation) return;
    const t = setTimeout(() => {
      setShowAnimation(false);
      dispatch(clearFlashOrder(order.id));
    }, 60_000);
    return () => clearTimeout(t);
  }, [isNewOrder, showAnimation, order.id, dispatch]);

  // ── Focus / recently-updated effects (same as OrderCard) ──────────────────
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.order-card-hook')) {
        if (isFocused) dispatch(releaseFocus());
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isFocused, dispatch]);

  useEffect(() => {
    if (!isFocused) return;
    const t = setTimeout(() => dispatch(releaseFocus()), 15000);
    return () => clearTimeout(t);
  }, [isFocused, dispatch]);

  useEffect(() => {
    if (!isRecentlyUpdated) return;
    const t = setTimeout(() => dispatch(removeRecentlyUpdated(order.id)), 5000);
    return () => clearTimeout(t);
  }, [isRecentlyUpdated, order.id, dispatch]);

  // ── actionTriggerProps — same helper as OrderCard ─────────────────────────
  const actionTriggerProps = (handler: () => Promise<void> | void) => {
    if (requireDoubleTap) {
      return { onDoubleClick: (e: any) => { e.stopPropagation(); handler(); } } as any;
    }
    return { onClick: (e: any) => { e.stopPropagation(); handler(); } } as any;
  };

  // ── Item toggle ────────────────────────────────────────────────────────────
  const handleItemToggle = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return;
    dispatch(toggleTmbillItemReady({ orderId: order.id, itemId }));
    window.tmbill.updateItemStatus(item._tmbill_item_id, !item.isReady);
  };

  // ── TMBILL KOT status advancement ─────────────────────────────────────────
  // Table KOTs use KOT_STATES_BYFLAG:  pending→3(Preparing), processing→4(Ready), ready→5(Served)
  // Order KOTs use BILL_STATES_BYFLAG: pending→4(Preparing), processing→5(Ready), ready→1(Served)
  const isOrderKot = order._tmbill_order_id !== '';

  const advanceKotStatus = useCallback(async (currentStatus: string) => {
    dispatch(setFocusedOrder({ orderId: order.id, position: gridPosition }));

    if (isOrderKot) {
      // Quick bill / settled order — BILL_STATES_BYFLAG
      switch (currentStatus) {
        case 'pending':
          await window.tmbill.updateOrderKotStatus(order._tmbill_order_id, 4);
          dispatch(addRecentlyUpdated(order.id));
          setTimeout(() => dispatch(releaseFocus()), 15000);
          break;
        case 'processing':
          // Mark all items ready before the API call so setTmbillOrders preservation
          // keeps them checked across the subsequent kds-kot-updated refresh.
          dispatch(markAllTmbillItemsReady({ orderId: order.id }));
          await window.tmbill.updateOrderKotStatus(order._tmbill_order_id, 5);
          dispatch(addRecentlyUpdated(order.id));
          setTimeout(() => dispatch(releaseFocus()), 15000);
          break;
        case 'ready':
          await window.tmbill.updateOrderKotStatus(order._tmbill_order_id, 1);
          dispatch(bumpTmbillOrder({ id: order.id }));
          break;
        default:
          dispatch(releaseFocus());
      }
    } else {
      // Table KOT — KOT_STATES_BYFLAG
      switch (currentStatus) {
        case 'pending':
          await window.tmbill.updateKotStatus(order._tmbill_kot_id, order._tmbill_table_id, order._tmbill_table_name, 3);
          dispatch(addRecentlyUpdated(order.id));
          setTimeout(() => dispatch(releaseFocus()), 15000);
          break;
        case 'processing':
          // Mark all items ready before the API call so setTmbillOrders preservation
          // keeps them checked across the subsequent kds-kot-updated refresh.
          dispatch(markAllTmbillItemsReady({ orderId: order.id }));
          await window.tmbill.updateKotStatus(order._tmbill_kot_id, order._tmbill_table_id, order._tmbill_table_name, 4);
          dispatch(addRecentlyUpdated(order.id));
          setTimeout(() => dispatch(releaseFocus()), 15000);
          break;
        case 'ready':
          await window.tmbill.updateKotStatus(order._tmbill_kot_id, order._tmbill_table_id, order._tmbill_table_name, 5);
          dispatch(bumpTmbillOrder({ id: order.id }));
          break;
        default:
          dispatch(releaseFocus());
      }
    }
  }, [isOrderKot, order._tmbill_kot_id, order._tmbill_table_id, order._tmbill_table_name, order._tmbill_order_id, order.id, gridPosition, dispatch]);

  const handleStartCooking = useCallback(async () => {
    stopAnimation();
    await advanceKotStatus('pending');
  }, [stopAnimation, advanceKotStatus]);

  const handleMarkReady = useCallback(async () => {
    stopAnimation();
    await advanceKotStatus('processing');
  }, [stopAnimation, advanceKotStatus]);

  const handleComplete = useCallback(async () => {
    stopAnimation();
    await advanceKotStatus('ready');
  }, [stopAnimation, advanceKotStatus]);

  // Jump directly to any status from the ellipsis menu
  const jumpToStatus = useCallback(async (target: 'processing' | 'ready' | 'complete') => {
    setMenuOpen(false);
    stopAnimation();

    if (target === 'complete') {
      // Bump: local hide only — no status sent to POS, order state on POS preserved
      dispatch(bumpTmbillOrder({ id: order.id }));
      return;
    }

    dispatch(setFocusedOrder({ orderId: order.id, position: gridPosition }));

    if (isOrderKot) {
      // BILL_STATES_BYFLAG: 4=Preparing, 5=Ready
      const code = target === 'processing' ? 4 : 5;
      await window.tmbill.updateOrderKotStatus(order._tmbill_order_id, code);
    } else {
      // KOT_STATES_BYFLAG: 3=Preparing, 4=Ready
      const code = target === 'processing' ? 3 : 4;
      await window.tmbill.updateKotStatus(order._tmbill_kot_id, order._tmbill_table_id, order._tmbill_table_name, code);
    }

    dispatch(addRecentlyUpdated(order.id));
    setTimeout(() => dispatch(releaseFocus()), 15000);
  }, [isOrderKot, order, gridPosition, stopAnimation, dispatch]);

  // Mark as Served — sends Served status to POS without hiding from dashboard
  // Table KOTs: status 5 (KOT_STATES_BYFLAG), Order KOTs: status 1 (BILL_STATES_BYFLAG)
  const handleMarkServed = useCallback(async () => {
    setMenuOpen(false);
    stopAnimation();
    if (isOrderKot) {
      await window.tmbill.updateOrderKotStatus(order._tmbill_order_id, 1);
    } else {
      await window.tmbill.updateKotStatus(order._tmbill_kot_id, order._tmbill_table_id, order._tmbill_table_name, 5);
    }
    dispatch(addRecentlyUpdated(order.id));
  }, [isOrderKot, order, stopAnimation, dispatch]);

  // Recall a bumped order back to the active dashboard
  const handleRecall = useCallback(() => {
    dispatch(recallTmbillOrder({ id: order.id }));
  }, [order.id, dispatch]);

  // ── Header double-tap (mirrors useHeaderDoubleTap logic for TMBILL) ───────
  const handleHeaderDoubleTap = useCallback(async () => {
    if (processingMode !== 'header') return;
    stopAnimation();
    switch (order.status) {
      case 'pending':    await handleStartCooking(); break;
      case 'processing': await handleMarkReady();    break;
      case 'ready':      await handleComplete();     break;
    }
  }, [processingMode, order.status, stopAnimation, handleStartCooking, handleMarkReady, handleComplete]);

  // ── Guard: empty order ─────────────────────────────────────────────────────
  if (!order || !items.length) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600 text-sm">
          ⚠️ Order #{order?.id || 'unknown'} has no items
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ORDER CARD - same container as OrderCard */}
      <div className={`
        order-card-hook
        @container
        bg-white rounded-lg
        border-l-4 ${getAgeBorderColor()}
        shadow-md hover:shadow-lg transition-shadow
        flex flex-col
        min-h-[500px]
        min-w-[280px]
        max-w-[550px]
        w-full
        ${isBumped ? 'opacity-60 grayscale-[30%]' : ''}
        ${showAnimation ? 'new-order-animation' : ''}
        ${isFocused ? 'ring-4 ring-blue-500 ring-opacity-50' : ''}
        ${isRecentlyUpdated ? 'animate-pulse-border' : ''}
      `}>

        {/* Header — same structure as OrderCard */}
        <div
          className={`${config.bg} px-3 sm:px-4 py-3 rounded-t-lg group/header ${isHeaderMode ? 'cursor-pointer select-none' : ''} ${isFocused ? 'relative' : ''}`}
          onDoubleClick={isHeaderMode ? handleHeaderDoubleTap : undefined}
          title={isHeaderMode ? 'Double-tap header to progress order' : undefined}
        >
          <div className="flex items-center justify-between gap-2">
            {/* Left: Order number + status badge + source badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <span className="text-white font-bold text-base sm:text-lg font-mono flex-shrink-0">
                #{order.order_number}
              </span>
              <span className="
                px-1.5 sm:px-2 py-0.5
                bg-white/20 text-white
                text-[10px] sm:text-xs
                font-semibold rounded
                whitespace-nowrap flex-shrink-0
              ">
                {config.text}
              </span>
              {isBumped && (
                <span className="px-1.5 py-0.5 bg-slate-700 text-white text-[10px] font-bold rounded uppercase whitespace-nowrap flex-shrink-0">
                  BUMPED
                </span>
              )}
              <span
                className={`p-1 ${sourceBadge.bg} rounded flex-shrink-0`}
                title={sourceBadge.text}
              >
                <Store className="w-3.5 h-3.5 text-white" />
              </span>
            </div>

            {/* Right: Age + clock button */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <span className="text-white text-xs sm:text-sm font-semibold whitespace-nowrap">
                {formatTime(orderAge)}
              </span>
              {/* Clock button — opens time picker to set/override scheduled time */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Pre-fill picker from existing schedule if any
                  if (scheduleInfo.scheduledTime) {
                    const h = scheduleInfo.scheduledTime.getHours();
                    const m = scheduleInfo.scheduledTime.getMinutes();
                    setPickerHour(String(h > 12 ? h - 12 : h === 0 ? 12 : h));
                    setPickerMinute(String(m).padStart(2, '0'));
                    setPickerAmPm(h >= 12 ? 'pm' : 'am');
                  } else {
                    setPickerHour('');
                    setPickerMinute('00');
                    setPickerAmPm('pm');
                  }
                  setShowTimePicker((v) => !v);
                }}
                className={`p-1 rounded transition-all flex-shrink-0 ${
                  scheduleInfo.detected || scheduledOverride
                    ? 'bg-purple-500/80 hover:bg-purple-400 text-white opacity-100'
                    : 'bg-white/20 hover:bg-white/30 text-white opacity-0 group-hover/header:opacity-100'
                }`}
                title={scheduleInfo.detected ? `Scheduled: ${scheduleInfo.scheduledTimeFormatted} — tap to edit` : 'Set scheduled time'}
              >
                <Clock className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Scheduled badge strip */}
        {scheduleInfo.detected && (
          <div className={`px-3 py-1.5 flex items-center justify-between gap-2 text-xs font-semibold ${
            scheduleInfo.isOverdue
              ? 'bg-red-100 text-red-700'
              : scheduleInfo.isApproaching
              ? 'bg-purple-100 text-purple-800'
              : 'bg-purple-50 text-purple-700'
          }`}>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" />
              <span>
                {scheduleInfo.isOverdue
                  ? `Overdue by ${formatTmbillCountdown(scheduleInfo.minutesUntil ?? 0)}`
                  : scheduleInfo.isApproaching
                  ? `${scheduleInfo.scheduledTimeFormatted} — in ${formatTmbillCountdown(scheduleInfo.minutesUntil ?? 0)}`
                  : `Scheduled ${scheduleInfo.scheduledTimeFormatted} — in ${formatTmbillCountdown(scheduleInfo.minutesUntil ?? 0)}`
                }
              </span>
              {scheduleInfo.confidence === 'medium' && (
                <span className="opacity-60 text-[10px]">(inferred)</span>
              )}
            </div>
            {/* Clear override button */}
            {scheduledOverride && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(setTmbillScheduledOverride({ orderId: order.id, isoTime: null }));
                }}
                className="opacity-60 hover:opacity-100 transition-opacity"
                title="Clear manual schedule"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Time picker popover */}
        {showTimePicker && (
          <div
            className="bg-white border border-slate-200 shadow-lg rounded-b-lg px-4 py-3 flex items-center gap-3 flex-wrap"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1} max={12}
                placeholder="7"
                value={pickerHour}
                onChange={(e) => setPickerHour(e.target.value)}
                className="w-14 border border-slate-300 rounded px-2 py-1 text-sm text-center text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <span className="text-slate-700 font-bold">:</span>
              <input
                type="number"
                min={0} max={59}
                placeholder="00"
                value={pickerMinute}
                onChange={(e) => setPickerMinute(String(e.target.value).padStart(2, '0'))}
                className="w-14 border border-slate-300 rounded px-2 py-1 text-sm text-center text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            {/* AM/PM toggle */}
            <div className="flex rounded overflow-hidden border border-slate-300 text-sm font-semibold flex-shrink-0">
              {(['am', 'pm'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setPickerAmPm(v)}
                  className={`px-3 py-1 transition-colors ${pickerAmPm === v ? 'bg-blue-500 text-white' : 'bg-white text-slate-900 hover:bg-slate-100'}`}
                >
                  {v.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const date = parseManualTime(`${pickerHour}:${pickerMinute}`, pickerAmPm);
                if (date) dispatch(setTmbillScheduledOverride({ orderId: order.id, isoTime: date.toISOString() }));
                setShowTimePicker(false);
              }}
              className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-semibold flex-shrink-0"
            >
              Set
            </button>
            <button
              onClick={() => setShowTimePicker(false)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm flex-shrink-0"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">

          {/* Customer Info & Order Type — same layout as OrderCard */}
          <div className="mb-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              {/* Customer / table name — same button style as OrderCard, no modal */}
              {order.customer_name ? (
                <div className="
                  flex items-center gap-2
                  hover:bg-slate-50
                  px-2 py-1 -ml-2 rounded
                  transition-colors
                  group
                  min-w-0 flex-1 max-w-[200px]
                ">
                  <User className="w-4 h-4 text-slate-600 group-hover:text-slate-900 flex-shrink-0" />
                  <span className="
                    text-sm font-medium
                    text-slate-800 group-hover:text-slate-900
                    truncate
                    max-w-[100px]
                    @[350px]:max-w-[130px]
                    @[450px]:max-w-[170px]
                  ">
                    {order.customer_name}
                  </span>
                  {/* Only show table_number if different from customer_name
                      (TMBILL sets both to table_name so they're often the same) */}
                  {order.table_number && order.table_number !== order.customer_name && (
                    <span className="text-xs text-slate-500 flex-shrink-0">
                      · {order.table_number}
                    </span>
                  )}
                  <svg
                    className="w-3 h-3 text-slate-400 group-hover:text-slate-600 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              ) : (
                <span className="text-sm text-slate-500">Walk-in Customer</span>
              )}

              {/* Order Type Badge — same as OrderCard */}
              <span className="
                px-2 py-1
                bg-slate-100 text-slate-700
                text-xs font-semibold rounded
                uppercase whitespace-nowrap flex-shrink-0
              ">
                <span className="hidden @[350px]:inline">
                  {order.order_type.replace('_', ' ')}
                </span>
                <span className="inline @[350px]:hidden">
                  {order.order_type === 'delivery'   ? <Bike        className="w-4 h-4 text-slate-700" /> :
                   order.order_type === 'takeaway'   ? <ShoppingBag className="w-4 h-4 text-slate-700" /> :
                   order.order_type === 'quick_bill' ? <Zap         className="w-4 h-4 text-amber-600" /> :
                                                       <CookingPot  className="w-4 h-4 text-slate-700" />}
                </span>
              </span>
            </div>

            {/* Waiter name if available */}
            {order.ordered_by && (
              <div className="text-xs text-slate-500 px-2 mb-1">
                Waiter: {order.ordered_by}
              </div>
            )}

            {/* KOT note / special instructions */}
            {order.kot_note && (
              <div className="mx-2 mb-2 px-3 py-2 bg-amber-100 dark:bg-amber-900/40 border border-amber-300 dark:border-amber-600 rounded-lg flex items-start gap-2">
                <ClipboardList className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-amber-900 dark:text-amber-200 leading-snug">{order.kot_note}</span>
              </div>
            )}
          </div>

          {/* Progress Bar — identical to OrderCard */}
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
              <span>Items Ready</span>
              <span className="font-semibold">{readyItems}/{totalItems}</span>
            </div>
            <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Items List — same checkbox style as OrderCard */}
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
                    <span className="font-bold text-slate-900 font-mono text-sm flex-shrink-0">
                      {item.quantity}x
                    </span>
                    <span className={`
                      ${itemNameFontClass[itemNameFontSize]} font-medium
                      ${item.isReady ? 'line-through text-slate-400' : 'text-slate-800'}
                      ${itemNameOverflowClass}
                      ${itemNameUppercase ? 'uppercase' : ''}
                    `}>
                      {item.name}
                    </span>
                  </div>
                  {item.notes && (
                    <div className={`${itemNotesFontClass[itemNameFontSize]} text-slate-500 ml-6 truncate`}>{item.notes}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fixed Bottom Action Buttons — same structure as OrderCard */}
        <div className="p-4 pt-0 border-t border-slate-100 flex-shrink-0 mt-auto">

          {isBumped ? (
            /* Bumped state — show Recall button only */
            <button
              onClick={handleRecall}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
            >
              Recall to Dashboard
            </button>
          ) : (
            <>
              {/* Button mode — same for all order types including quick bill */}
              {processingMode === 'buttons' && (
                <>
                  {order.status === 'pending' && (
                    <button
                      {...actionTriggerProps(handleStartCooking)}
                      className="w-full py-2.5 mb-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Start Cooking
                    </button>
                  )}
                  {order.status === 'processing' && (
                    <button
                      {...actionTriggerProps(handleMarkReady)}
                      className="w-full py-2.5 mb-2 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Mark as Ready
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      {...actionTriggerProps(handleComplete)}
                      className="w-full py-2.5 mb-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                    >
                      Complete Order
                    </button>
                  )}
                </>
              )}

              {/* Bottom bar — centered ellipsis menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-lg flex items-center justify-center transition-colors"
                  title="Order actions"
                >
                  <RectangleEllipsis className="w-6 h-6" />
                </button>

                {/* Dropdown — opens above the bar */}
                {menuOpen && (
                  <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 overflow-hidden">
                    {/* Start Cooking */}
                    {(() => {
                      const isPast    = order.status === 'processing' || order.status === 'ready';
                      const isCurrent = order.status === 'processing';
                      return (
                        <button
                          onClick={() => !isPast && jumpToStatus('processing')}
                          disabled={isPast}
                          className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm text-left transition-colors
                            ${isPast    ? 'text-slate-400 cursor-default' : ''}
                            ${isCurrent ? 'bg-orange-50 text-orange-700 font-semibold' : ''}
                            ${!isPast && !isCurrent ? 'hover:bg-slate-50 text-slate-700' : ''}
                          `}
                        >
                          {isPast
                            ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                            : <span className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
                          }
                          Start Cooking
                        </button>
                      );
                    })()}

                    <div className="border-t border-slate-100" />

                    {/* Mark as Ready */}
                    {(() => {
                      const isPast    = order.status === 'ready';
                      const isCurrent = order.status === 'ready';
                      return (
                        <button
                          onClick={() => !isPast && jumpToStatus('ready')}
                          disabled={isPast}
                          className={`w-full px-4 py-2.5 flex items-center gap-3 text-sm text-left transition-colors
                            ${isPast    ? 'text-slate-400 cursor-default' : ''}
                            ${isCurrent ? 'bg-green-50 text-green-700 font-semibold' : ''}
                            ${!isPast && !isCurrent ? 'hover:bg-slate-50 text-slate-700' : ''}
                          `}
                        >
                          {isPast
                            ? <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                            : <span className="w-4 h-4 rounded-full border-2 border-current flex-shrink-0" />
                          }
                          Mark as Ready
                        </button>
                      );
                    })()}

                    <div className="border-t border-slate-100" />

                    {/* Mark as Served — sends Served to POS, stays on dashboard */}
                    <button
                      onClick={handleMarkServed}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-sm text-left hover:bg-slate-50 text-slate-700 transition-colors"
                    >
                      <Check className="w-4 h-4 flex-shrink-0 text-green-600" />
                      Mark as Served
                    </button>

                    <div className="border-t border-slate-100" />

                    {/* Bump — local hide only, no status sent to POS */}
                    <button
                      onClick={() => jumpToStatus('complete')}
                      className="w-full px-4 py-2.5 flex items-center gap-3 text-sm font-semibold text-left bg-slate-800 hover:bg-slate-900 text-white transition-colors"
                    >
                      <Store className="w-4 h-4 flex-shrink-0" />
                      Bump Order
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default memo(TmbillOrderCard);
