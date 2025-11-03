import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { foodsApi } from '../../utils/foodsApi';
import type { Food, FoodFilters, FoodStats } from '../../types/food.type';

/**
 * Foods state interface
 */
interface FoodsState {
  foods: Food[];
  filteredFoods: Food[];
  loading: boolean;
  error: string | null;
  filters: FoodFilters;
  stats: FoodStats;
  lastFetched: number | null;
}

/**
 * Initial state
 */
const initialState: FoodsState = {
  foods: [],
  filteredFoods: [],
  loading: false,
  error: null,
  filters: {
    search: '',
    category: null,
    status: 'all',
    veg: 'all',
  },
  stats: {
    total: 0,
    available: 0,
    unavailable: 0,
    veg: 0,
    nonVeg: 0,
  },
  lastFetched: null,
};

/**
 * Calculate statistics from foods array
 */
const calculateStats = (foods: Food[]): FoodStats => {
  return {
    total: foods.length,
    available: foods.filter(f => f.status === 1).length,
    unavailable: foods.filter(f => f.status === 0).length,
    veg: foods.filter(f => f.veg === 1).length,
    nonVeg: foods.filter(f => f.veg === 0).length,
  };
};

/**
 * Apply filters to foods array
 */
const applyFilters = (foods: Food[], filters: FoodFilters): Food[] => {
  return foods.filter(food => {
    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (!food.name.toLowerCase().includes(searchLower)) {
        return false;
      }
    }

    // Category filter
    if (filters.category && food.category_id !== parseInt(filters.category)) {
      return false;
    }

    // Status filter
    if (filters.status === 'available' && food.status !== 1) {
      return false;
    }
    if (filters.status === 'unavailable' && food.status !== 0) {
      return false;
    }

    // Veg filter
    if (filters.veg === 'veg' && food.veg !== 1) {
      return false;
    }
    if (filters.veg === 'non-veg' && food.veg !== 0) {
      return false;
    }

    return true;
  });
};

/**
 * Async thunk: Fetch all foods
 */
export const fetchFoods = createAsyncThunk(
  'foods/fetchFoods',
  async (_, { rejectWithValue }) => {
    try {
      const response = await foodsApi.getAllFoods();
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to fetch foods');
    }
  }
);

/**
 * Async thunk: Update food status
 */
export const updateFoodStatus = createAsyncThunk(
  'foods/updateStatus',
  async (
    { foodId, status }: { foodId: number; status: 0 | 1 },
    { rejectWithValue }
  ) => {
    try {
      const response = await foodsApi.updateFoodStatus(foodId, status);
      return response.data;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to update food status');
    }
  }
);

/**
 * Foods slice
 */
const foodsSlice = createSlice({
  name: 'foods',
  initialState,
  reducers: {
    /**
     * Update search filter
     */
    setSearchFilter: (state, action: PayloadAction<string>) => {
      state.filters.search = action.payload;
      state.filteredFoods = applyFilters(state.foods, state.filters);
    },

    /**
     * Update category filter
     */
    setCategoryFilter: (state, action: PayloadAction<string | null>) => {
      state.filters.category = action.payload;
      state.filteredFoods = applyFilters(state.foods, state.filters);
    },

    /**
     * Update status filter
     */
    setStatusFilter: (
      state,
      action: PayloadAction<'all' | 'available' | 'unavailable'>
    ) => {
      state.filters.status = action.payload;
      state.filteredFoods = applyFilters(state.foods, state.filters);
    },

    /**
     * Update veg filter
     */
    setVegFilter: (
      state,
      action: PayloadAction<'all' | 'veg' | 'non-veg'>
    ) => {
      state.filters.veg = action.payload;
      state.filteredFoods = applyFilters(state.foods, state.filters);
    },

    /**
     * Clear all filters
     */
    clearFilters: (state) => {
      state.filters = initialState.filters;
      state.filteredFoods = state.foods;
    },

    /**
     * Optimistic update for food status (for instant UI feedback)
     */
    updateFoodStatusLocally: (
      state,
      action: PayloadAction<{ foodId: number; status: 0 | 1 }>
    ) => {
      const { foodId, status } = action.payload;
      
      // Update in foods array
      const food = state.foods.find(f => f.id === foodId);
      if (food) {
        food.status = status;
      }

      // Update in filtered foods array
      const filteredFood = state.filteredFoods.find(f => f.id === foodId);
      if (filteredFood) {
        filteredFood.status = status;
      }

      // Recalculate stats
      state.stats = calculateStats(state.foods);
    },
  },
  extraReducers: (builder) => {
    // Fetch foods
    builder.addCase(fetchFoods.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchFoods.fulfilled, (state, action) => {
      state.loading = false;
      state.foods = action.payload;
      state.filteredFoods = applyFilters(action.payload, state.filters);
      state.stats = calculateStats(action.payload);
      state.lastFetched = Date.now();
    });
    builder.addCase(fetchFoods.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });

    // Update food status
    builder.addCase(updateFoodStatus.pending, (state) => {
      // Loading handled by optimistic update
    });
    builder.addCase(updateFoodStatus.fulfilled, (state, action) => {
      // Update the food with the server response
      const updatedFood = action.payload;
      const index = state.foods.findIndex(f => f.id === updatedFood.id);
      if (index !== -1) {
        state.foods[index] = updatedFood;
      }

      // Update filtered foods
      const filteredIndex = state.filteredFoods.findIndex(
        f => f.id === updatedFood.id
      );
      if (filteredIndex !== -1) {
        state.filteredFoods[filteredIndex] = updatedFood;
      }

      // Recalculate stats
      state.stats = calculateStats(state.foods);
    });
    builder.addCase(updateFoodStatus.rejected, (state, action) => {
      state.error = action.payload as string;
      // Note: Optimistic update will be reverted by the component
    });
  },
});

export const {
  setSearchFilter,
  setCategoryFilter,
  setStatusFilter,
  setVegFilter,
  clearFilters,
  updateFoodStatusLocally,
} = foodsSlice.actions;

export default foodsSlice.reducer;