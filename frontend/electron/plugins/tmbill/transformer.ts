/**
 * Transform TMBILL order format to CocoKDS format
 */

export interface TMBillOrder {
  kot_id: number;
  kot_number?: string;
  table_number?: string;
  customer_name?: string;
  customer_phone?: string;
  order_status?: number;
  order_type?: string;
  total_amount?: number;
  created_at?: string;
  updated_at?: string;
  items?: TMBillOrderItem[];
}

export interface TMBillOrderItem {
  kot_item_id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  item_status?: number;
  special_instruction?: string;
}

export interface CocoKDSOrder {
  id: string;
  order_number: string;
  status: string;
  order_type: string;
  customer_name: string;
  customer_phone: string;
  table_number: string;
  items: CocoKDSOrderItem[];
  total_amount: string;
  created_at: string;
  updated_at: string;
  _source: 'tmbill';
  _tmbill_original: TMBillOrder;
}

export interface CocoKDSOrderItem {
  id: string;
  food_id: string;
  name: string;
  quantity: number;
  price: string;
  notes: string;
  isReady: boolean;
  _tmbill_item_id: number;
}

/**
 * Transform TMBILL order to CocoKDS format
 */
export function transformTMBillOrder(tmbillOrder: TMBillOrder): CocoKDSOrder {
  return {
    id: `TMBILL-${tmbillOrder.kot_id}`,
    order_number: tmbillOrder.kot_number || `KOT-${tmbillOrder.kot_id}`,
    status: mapStatus(tmbillOrder.order_status),
    order_type: mapOrderType(tmbillOrder.order_type),
    
    // Customer info
    customer_name: tmbillOrder.customer_name || 'Walk-in Customer',
    customer_phone: tmbillOrder.customer_phone || '',
    
    // Table/location
    table_number: tmbillOrder.table_number || '',
    
    // Items
    items: (tmbillOrder.items || []).map((item) => ({
      id: `ITEM-${item.kot_item_id}`,
      food_id: item.item_id.toString(),
      name: item.item_name,
      quantity: item.quantity,
      price: item.unit_price?.toString() || '0',
      notes: item.special_instruction || '',
      isReady: item.item_status === 1, // 0=pending, 1=ready
      _tmbill_item_id: item.kot_item_id,
    })),
    
    // Amounts
    total_amount: tmbillOrder.total_amount?.toString() || '0',
    
    // Timestamps
    created_at: tmbillOrder.created_at || new Date().toISOString(),
    updated_at: tmbillOrder.updated_at || new Date().toISOString(),
    
    // Mark as TMBILL order
    _source: 'tmbill',
    _tmbill_original: tmbillOrder,
  };
}

/**
 * Map TMBILL status to CocoKDS status
 */
function mapStatus(tmbillStatus?: number): string {
  if (!tmbillStatus) return 'pending';
  
  switch (tmbillStatus) {
    case 0: return 'pending';
    case 1: return 'confirmed';
    case 2: return 'processing';
    case 3: return 'ready';
    case 4: return 'completed';
    default: return 'pending';
  }
}

/**
 * Map TMBILL order type to CocoKDS order type
 */
function mapOrderType(tmbillType?: string): string {
  if (!tmbillType) return 'dine_in';
  
  const type = tmbillType.toLowerCase();
  
  switch (type) {
    case 'dine-in':
    case 'dinein':
      return 'dine_in';
    case 'takeaway':
    case 'take-away':
      return 'takeaway';
    case 'delivery':
      return 'delivery';
    default:
      return 'dine_in';
  }
}

/**
 * Transform CocoKDS item status to TMBILL format
 */
export function transformItemStatus(isReady: boolean): string {
  return isReady ? 'ready' : 'preparing';
}