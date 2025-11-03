import type { 
  Food,
  GetFoodsResponse, 
  UpdateFoodStatusResponse 
} from '../types/food.type';

const API_URL = import.meta.env.VITE_API_URL || 'https://kds-api.cocoeats.uk';

/**
 * Get authentication headers
 * Returns a properly typed HeadersInit object
 */
const getAuthHeaders = (): HeadersInit => {
  const token = localStorage.getItem('kds_token');
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Foods API service
 */
export const foodsApi = {
  /**
   * Get all foods for the authenticated restaurant
   */
  getAllFoods: async (): Promise<GetFoodsResponse> => {
    try {
      const response = await fetch(`${API_URL}/api/kds/foods`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ Error fetching foods:', error);
      throw error;
    }
  },

  /**
   * Get a single food item by ID
   */
  getFoodById: async (id: number): Promise<{ success: boolean; data: Food }> => {
    try {
      const response = await fetch(`${API_URL}/api/kds/foods/${id}`, {
        method: 'GET',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Error fetching food ${id}:`, error);
      throw error;
    }
  },

  /**
   * Update food availability status
   * @param id - Food item ID
   * @param status - New status (0 = unavailable, 1 = available)
   */
  updateFoodStatus: async (
    id: number,
    status: 0 | 1
  ): Promise<UpdateFoodStatusResponse> => {
    try {
      const response = await fetch(`${API_URL}/api/kds/foods/${id}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`❌ Error updating food ${id} status:`, error);
      throw error;
    }
  },
};