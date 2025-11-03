/**
 * Food item interface matching backend API response
 */
export interface Food {
  id: number;
  name: string;
  description: string | null;
  image: string | null;
  category_id: number | null;
  price: number;
  discount: number;
  discount_type: 'percent' | 'amount';
  available_time_starts: string | null;
  available_time_ends: string | null;
  veg: 0 | 1; // 0 = non-veg, 1 = veg
  status: 0 | 1; // 0 = unavailable, 1 = available
  recommended: 0 | 1;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
}

/**
 * API response for getting all foods
 */
export interface GetFoodsResponse {
  success: boolean;
  data: Food[];
  count: number;
}

/**
 * API response for updating food status
 */
export interface UpdateFoodStatusResponse {
  success: boolean;
  message: string;
  data: Food;
}

/**
 * Filter options for foods list
 */
export interface FoodFilters {
  search: string;
  category: string | null;
  status: 'all' | 'available' | 'unavailable';
  veg: 'all' | 'veg' | 'non-veg';
}

/**
 * Statistics for foods
 */
export interface FoodStats {
  total: number;
  available: number;
  unavailable: number;
  veg: number;
  nonVeg: number;
}