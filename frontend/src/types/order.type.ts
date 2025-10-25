// ✅ SINGLE SOURCE OF TRUTH
export interface Order {
  // Core fields (always present)
  id: string;
  restaurant_id: string;
  order_status: 'pending' | 'confirmed' | 'processing' | 'handover' | 'picked_up' | 'delivered';
  order_type: 'delivery' | 'take_away' | 'dine_in';
  
  // Financial (always present from backend)
  order_amount: string;
  delivery_charge: string;
  total_tax_amount: string;
  
  // Optional financial
  coupon_discount_amount?: string;
  restaurant_discount_amount?: string;
  dm_tips?: string;
  additional_charge?: string;
  
  // Items
  items: OrderItem[];
  item_count: number;
  
  // Timing
  created_at: string;           // ← Make required!
  schedule_at?: string;
  is_scheduled: boolean;
  order_age_minutes: number;    // ← Calculated
  
  // Optional details
  order_note?: string | null;
  delivery_instruction?: string | null;
  payment_method?: string;
  processing_time?: string | null;
  
  // Delivery specific
  delivery_man_id?: string | null;
  delivery_address?: DeliveryAddress | null;
  customer_name?: string | null;
  
  // Frontend state
  bumped_at?: string;
  picked_up?: boolean;
}

export interface OrderItem {
  id: string;
  food_id: string;
  name: string;              // ← Flattened from food_details.name
  quantity: number;
  price: string;
  variant?: string | null;
  variation: Array<{ type: string; name: string; price: string }>;
  add_ons: Array<{ name: string; quantity: number; price: string }>;
  isReady?: boolean;         // ← Frontend only
}

export interface DeliveryAddress {
  contact_person_name: string;
  contact_person_number: string;
  contact_person_email?: string;
  address_type: string;
  address: string;
  floor?: string | null;
  road?: string | null;
  house?: string | null;
  longitude: string;
  latitude: string;
}