/**
 * TMBILL → CocoKDS Transformer
 *
 * Architecture note:
 * - `kot-saved` socket event is a LEAN NOTIFICATION (no items)
 * - Items must always be fetched via GET /kds/runningtables after receiving kot-saved
 * - `kds-kot-updated` also has no kot_id — only table_id, also requires re-fetch
 * - Item fields from /kds/runningtables differ from what you'd expect:
 *     item name  → `title`        (not item_name)
 *     item id    → `kot_item_id`  (aliased from `id`)
 *     price      → `item_price`   (not unit_price)
 *     notes      → `comment`      (+ optional `note`)
 *     status     → `orderstatus`  (not item_status)
 */

// ─── kot-saved Socket Event (lean notification) ───────────────────────────────

export interface TMBillKotSavedPayload {
  insertedKOTid: number;        // ← THE KOT ID. Not kot_id, not id.
  table_id?: number;
  message?: string;
  createTable?: boolean;
  tableDetails?: {
    table_name?: string;
    isactive?: number;
    tablenameAscustomer?: number;
    department?: number;
    order_type_flag?: number;   // 0=dine-in,1=takeaway,2=delivery,3=quickbill,4=online,5=virtual
    table_color?: string;
    table_action_flag?: number;
    store_id?: number;
    order_state?: number;
    is_pre_order?: number;
    waiter?: string;
    waiter_id?: number;
    // NOTE: NO items array here — items must be fetched from /kds/runningtables
  };
}

// ─── /kds/runningtables Response ─────────────────────────────────────────────

export interface TMBillRunningTable {
  table_id: number;
  table_name: string;
  kot_id: number;
  kot_number: string;
  order_type_flag: number;
  in_time: string;
  status: number;             // kot_status: 0=pending,1=in-progress,2=ready,3=served
  createdBy: number;
  note?: string;
  amount: number;
  persons?: number;
  items: TMBillRunningItem[];
}

export interface TMBillRunningItem {
  kot_item_id: number;        // aliased from `id`
  title: string;              // item name — NOT item_name
  amount: string;             // total line amount
  item_price: string;         // unit price — NOT unit_price
  quantity: number;
  item_id: number;
  item_tax_per: number;
  item_tax_value: number;
  item_tax_method: number;
  item_is_devidable: number;
  orderstatus?: number;       // item status — NOT item_status. 0=pending,1=preparing,2=ready
  previousstatus?: number;
  comment?: string;           // special instructions / kitchen notes
  kot_id: number;
  reason?: string;
  note?: string;              // secondary notes field
  status?: number;
  discounted_price?: number;
  discount_type?: number;
  discount_rate?: number;
  pricebeforeDiscount?: number;
  modified_discount?: number;
}

// ─── kds-kot-updated Event ────────────────────────────────────────────────────
// WARNING: No kot_id — must re-fetch from /kds/runningtables using table_id

export interface TMBillKotUpdatedPayload {
  table_id?: number;          // use this to find & refresh the order
  table?: string;             // legacy string version (some code paths)
  allitemsRemoved?: boolean;
  message?: string;
}

// ─── websocket-kot-cancelled Event ───────────────────────────────────────────

export interface TMBillKotCancelledPayload {
  kot_id: number;
}

// ─── bill-saved Event ─────────────────────────────────────────────────────────

export interface TMBillBillSavedPayload {
  bill_number: number;
  order_id: number;
  table_id: number;
  message: string;
}

// ─── bill-settled Event ───────────────────────────────────────────────────────
// This is the removal trigger — remove order from KDS when this fires

export interface TMBillBillSettledPayload {
  order_state: string;
  order_type_flag: number;
  status: 'success' | 'failure';
  table_id: number;
  order_id: number;
  [key: string]: any;         // billData may include additional fields
}

// ─── order_type_flag constants ────────────────────────────────────────────────

export const TMBILL_ORDER_TYPE = {
  DINE_IN:       0,
  TAKEAWAY:      1,
  HOME_DELIVERY: 2,
  QUICK_BILL:    3,
  ONLINE_ORDER:  4,
  VIRTUAL_TABLE: 5,
} as const;

// ─── CocoKDS Unified Order ────────────────────────────────────────────────────

export interface CocoKDSOrder {
  id: string;                 // "TMBILL-{kot_id}"
  order_number: string;       // "KOT-{kot_number}" or "KOT-{kot_id}"
  status: string;             // mapped to CocoKDS status string
  order_type: string;         // "dine_in" | "takeaway" | "delivery" | "quick_bill"
  customer_name: string;
  customer_phone: string;
  table_number: string;       // TMBILL-specific, not present in CocoEats orders
  ordered_by?: string;        // waiter/captain name — TMBILL-specific
  items: CocoKDSOrderItem[];
  item_count: number;
  total_amount: string;
  order_age_minutes: number;  // calculated on receipt
  created_at: string;
  updated_at: string;
  // TMBILL-specific fields (won't exist on CocoEats orders)
  _source: 'tmbill';
  _tmbill_kot_id: number;     // raw numeric ID for API callbacks
  _tmbill_table_id: number;   // needed for kds-kot-updated matching
  _tmbill_original: TMBillKotSavedPayload | TMBillRunningTable;
}

export interface CocoKDSOrderItem {
  id: string;                 // "ITEM-{kot_item_id}"
  food_id: string;            // item_id as string
  name: string;               // from `title` field
  quantity: number;
  price: string;              // from `item_price`
  notes: string;              // from `comment` + `note` combined
  isReady: boolean;           // orderstatus >= 2
  // TMBILL-specific
  _tmbill_item_id: number;    // raw kot_item_id for status update API calls
}

// ─── Primary Transformer: RunningTable → CocoKDS ─────────────────────────────
// Use after fetching from /kds/runningtables (which you ALWAYS need to do)

export function transformTMBillRunningTable(table: TMBillRunningTable): CocoKDSOrder {
  const items = mapItems(table.items ?? []);

  return {
    id: `TMBILL-${table.kot_id}`,
    order_number: table.kot_number ? `KOT-${table.kot_number}` : `KOT-${table.kot_id}`,
    status: mapKotStatus(table.status),
    order_type: mapOrderTypeFlag(table.order_type_flag),
    customer_name: table.table_name || 'Walk-in',  // table_name doubles as customer name for dine-in
    customer_phone: '',                              // not available in runningtables response
    table_number: table.table_name || `Table ${table.table_id}`,
    ordered_by: undefined,                           // not in runningtables response
    items,
    item_count: items.length,
    total_amount: (table.amount ?? 0).toString(),
    order_age_minutes: table.in_time
      ? Math.floor((Date.now() - new Date(table.in_time).getTime()) / 60000)
      : 0,
    created_at: table.in_time || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    _source: 'tmbill',
    _tmbill_kot_id: table.kot_id,
    _tmbill_table_id: table.table_id,
    _tmbill_original: table,
  };
}

// ─── Notification Transformer: kot-saved + RunningTable → CocoKDS ─────────────
// Use when you receive kot-saved and have fetched the full table from the API

export function transformTMBillNewOrder(
  notification: TMBillKotSavedPayload,
  fetchedTable: TMBillRunningTable
): CocoKDSOrder {
  // Merge: notification has waiter info, fetchedTable has items + amounts
  const base = transformTMBillRunningTable(fetchedTable);
  return {
    ...base,
    ordered_by: notification.tableDetails?.waiter,
    _tmbill_original: notification,
  };
}

// ─── Shared Item Mapper ───────────────────────────────────────────────────────

function mapItems(rawItems: TMBillRunningItem[]): CocoKDSOrderItem[] {
  return rawItems.map((item) => ({
    id: `ITEM-${item.kot_item_id}`,
    food_id: (item.item_id ?? 0).toString(),
    name: item.title ?? 'Unknown Item',             // field is `title`, not `item_name`
    quantity: item.quantity ?? 1,
    price: item.item_price ?? '0',                  // field is `item_price`, not `unit_price`
    notes: [item.comment, item.note].filter(Boolean).join(' | '),
    isReady: (item.orderstatus ?? 0) >= 2,          // field is `orderstatus`, not `item_status`
    _tmbill_item_id: item.kot_item_id,
  }));
}

// ─── Status Mappers ───────────────────────────────────────────────────────────

function mapKotStatus(tmbillStatus: number): string {
  switch (tmbillStatus) {
    case 0: return 'pending';
    case 1: return 'processing';
    case 2: return 'ready';
    case 3: return 'handover';    // "served" maps to CocoKDS handover
    default: return 'pending';
  }
}

function mapOrderTypeFlag(flag: number): string {
  switch (flag) {
    case TMBILL_ORDER_TYPE.DINE_IN:       return 'dine_in';
    case TMBILL_ORDER_TYPE.TAKEAWAY:      return 'takeaway';
    case TMBILL_ORDER_TYPE.HOME_DELIVERY: return 'delivery';
    case TMBILL_ORDER_TYPE.QUICK_BILL:    return 'quick_bill';
    case TMBILL_ORDER_TYPE.ONLINE_ORDER:  return 'dine_in';   // treat as dine-in for display
    case TMBILL_ORDER_TYPE.VIRTUAL_TABLE: return 'takeaway';  // virtual = counter/takeaway
    default:                              return 'dine_in';
  }
}

// ─── Item Status (KDS → POS) ─────────────────────────────────────────────────
// Used when sending item-status-changed back to TMBILL POS

export function transformItemStatusToTmbill(isReady: boolean): number {
  return isReady ? 2 : 0;   // 0=pending, 1=preparing, 2=ready (skip 1 for simplicity)
}