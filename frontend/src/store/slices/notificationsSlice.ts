import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { notificationsApi } from '../../utils/notificationsApi';
import type {
  SendNotificationData,
  Notification,
  NotificationStats,
  NotificationHistoryResponse,
} from '../../utils/notificationsApi';

/**
 * Notifications state interface
 */
interface NotificationsState {
  notifications: Notification[];
  stats: NotificationStats | null;
  loading: boolean;
  sending: boolean;
  error: string | null;
  lastFetched: number | null;
}

/**
 * Initial state
 */
const initialState: NotificationsState = {
  notifications: [],
  stats: null,
  loading: false,
  sending: false,
  error: null,
  lastFetched: null,
};

/**
 * Async thunk: Send notification
 */
export const sendNotification = createAsyncThunk(
  'notifications/send',
  async (data: SendNotificationData, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.sendNotification(data);
      return response;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to send notification';
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Async thunk: Fetch notification stats
 */
export const fetchNotificationStats = createAsyncThunk(
  'notifications/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const stats = await notificationsApi.getStats();
      return stats;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch stats';
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Async thunk: Fetch notification history
 */
export const fetchNotificationHistory = createAsyncThunk(
  'notifications/fetchHistory',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notificationsApi.getHistory();
      return response;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        'Failed to fetch history';
      return rejectWithValue(errorMessage);
    }
  }
);

/**
 * Notifications slice
 */
const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    /**
     * Clear error state
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Reset notifications state
     */
    resetNotifications: (state) => {
      state.notifications = [];
      state.stats = null;
      state.error = null;
      state.lastFetched = null;
    },
  },
  extraReducers: (builder) => {
    // Send notification
    builder.addCase(sendNotification.pending, (state) => {
      state.sending = true;
      state.error = null;
    });
    builder.addCase(sendNotification.fulfilled, (state, action) => {
      state.sending = false;
      
      // Add new notification to the beginning of the list
      state.notifications.unshift(action.payload.data);
      
      // Update stats if available
      if (state.stats) {
        state.stats.sentToday += 1;
        state.stats.remainingToday = Math.max(0, state.stats.remainingToday - 1);
        state.stats.canSendMore = state.stats.remainingToday > 0;
      }
    });
    builder.addCase(sendNotification.rejected, (state, action) => {
      state.sending = false;
      state.error = action.payload as string;
    });

    // Fetch stats
    builder.addCase(fetchNotificationStats.pending, (state) => {
      // Don't set loading to true for stats refresh (silent update)
      state.error = null;
    });
    builder.addCase(fetchNotificationStats.fulfilled, (state, action) => {
      state.stats = action.payload;
    });
    builder.addCase(fetchNotificationStats.rejected, (state, action) => {
      state.error = action.payload as string;
    });

    // Fetch history
    builder.addCase(fetchNotificationHistory.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchNotificationHistory.fulfilled, (state, action) => {
      state.loading = false;
      state.notifications = action.payload.data;
      state.stats = action.payload.stats;
      state.lastFetched = Date.now();
    });
    builder.addCase(fetchNotificationHistory.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload as string;
    });
  },
});

export const { clearError, resetNotifications } = notificationsSlice.actions;

export default notificationsSlice.reducer;