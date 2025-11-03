import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchFoods,
  updateFoodStatus,
  updateFoodStatusLocally,
  setSearchFilter,
  setCategoryFilter,
  setStatusFilter,
  setVegFilter,
  clearFilters,
} from '../store/slices/foodsSlice';
import toast from 'react-hot-toast';

/**
 * Custom hook for managing foods state and actions
 */
export const useFoods = () => {
  const dispatch = useAppDispatch();

  // Select state from Redux
  const {
    foods,
    filteredFoods,
    loading,
    error,
    filters,
    stats,
    lastFetched,
  } = useAppSelector((state) => state.foods);

  /**
   * Fetch foods on mount (only if not recently fetched)
   */
  useEffect(() => {
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    // Fetch if no data or cache expired
    if (!lastFetched || now - lastFetched > CACHE_DURATION) {
      dispatch(fetchFoods());
    }
  }, [dispatch, lastFetched]);

  /**
   * Show error toast if fetch fails
   */
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  /**
   * Toggle food status with optimistic update
   */
  const toggleFoodStatus = async (foodId: number, currentStatus: 0 | 1) => {
    const newStatus = currentStatus === 1 ? 0 : 1;

    // Optimistic update
    dispatch(updateFoodStatusLocally({ foodId, status: newStatus }));

    try {
      // Sync with backend
      await dispatch(updateFoodStatus({ foodId, status: newStatus })).unwrap();

      // Success notification
      toast.success(
        newStatus === 1
          ? '✅ Food marked as available'
          : '❌ Food marked as unavailable'
      );
    } catch (error: any) {
      // Revert optimistic update on failure
      dispatch(updateFoodStatusLocally({ foodId, status: currentStatus }));
      toast.error(error || 'Failed to update food status');
    }
  };

  /**
   * Refresh foods list
   */
  const refreshFoods = () => {
    dispatch(fetchFoods());
  };

  /**
   * Update search filter
   */
  const handleSearchChange = (search: string) => {
    dispatch(setSearchFilter(search));
  };

  /**
   * Update category filter
   */
  const handleCategoryChange = (category: string | null) => {
    dispatch(setCategoryFilter(category));
  };

  /**
   * Update status filter
   */
  const handleStatusChange = (status: 'all' | 'available' | 'unavailable') => {
    dispatch(setStatusFilter(status));
  };

  /**
   * Update veg filter
   */
  const handleVegChange = (veg: 'all' | 'veg' | 'non-veg') => {
    dispatch(setVegFilter(veg));
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    dispatch(clearFilters());
  };

  return {
    // State
    foods,
    filteredFoods,
    loading,
    error,
    filters,
    stats,

    // Actions
    toggleFoodStatus,
    refreshFoods,
    handleSearchChange,
    handleCategoryChange,
    handleStatusChange,
    handleVegChange,
    handleClearFilters,
  };
};
