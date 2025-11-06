import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  sendNotification,
  fetchNotificationStats,
  fetchNotificationHistory,
  clearError,
  resetNotifications,
} from '../store/slices/notificationsSlice';
import type { SendNotificationData } from '../utils/notificationsApi';
import toast from 'react-hot-toast';

/**
 * Custom hook for managing notifications state and actions
 */
export const useNotifications = () => {
  const dispatch = useAppDispatch();

  // Select state from Redux
  const {
    notifications,
    stats,
    loading,
    sending,
    error,
    lastFetched,
  } = useAppSelector((state) => state.notifications);

  /**
   * Fetch notifications and stats on mount (only if not recently fetched)
   */
  useEffect(() => {
    const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes
    const now = Date.now();

    // Fetch if no data or cache expired
    if (!lastFetched || now - lastFetched > CACHE_DURATION) {
      dispatch(fetchNotificationHistory());
    }
  }, [dispatch, lastFetched]);

  /**
   * Show error toast if operation fails
   */
  useEffect(() => {
    if (error) {
      toast.error(error);
      // Clear error after showing
      setTimeout(() => {
        dispatch(clearError());
      }, 100);
    }
  }, [error, dispatch]);

  /**
   * Send a notification
   */
  const handleSendNotification = async (data: SendNotificationData) => {
    try {
      await dispatch(sendNotification(data)).unwrap();
      
      // Success notification
      toast.success('🎉 Notification sent successfully!');
      
      // Refresh stats
      dispatch(fetchNotificationStats());
      
      return true;
    } catch (error: any) {
      // Error already handled by useEffect above
      return false;
    }
  };

  /**
   * Refresh notifications and stats
   */
  const refreshNotifications = () => {
    dispatch(fetchNotificationHistory());
  };

  /**
   * Refresh only stats (silent)
   */
  const refreshStats = () => {
    dispatch(fetchNotificationStats());
  };

  /**
   * Reset all notifications state
   */
  const resetState = () => {
    dispatch(resetNotifications());
  };

  /**
   * Check if can send more notifications today
   */
  const canSendMore = stats?.canSendMore ?? true;

  /**
   * Get remaining notifications for today
   */
  const remainingToday = stats?.remainingToday ?? 0;

  return {
    // State
    notifications,
    stats,
    loading,
    sending,
    error,
    canSendMore,
    remainingToday,

    // Actions
    handleSendNotification,
    refreshNotifications,
    refreshStats,
    resetState,
  };
};