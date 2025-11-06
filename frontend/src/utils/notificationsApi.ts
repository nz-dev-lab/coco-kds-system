import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://kds-api.cocoeats.uk';

/**
 * Get auth token from localStorage
 */
const getAuthToken = (): string | null => {
  return localStorage.getItem('kds_token');
};

/**
 * Create axios instance with auth headers
 */
const createAuthHeaders = () => {
  const token = getAuthToken();
  return {
    Authorization: `Bearer ${token}`,
  };
};

/**
 * Notification data types
 */
export interface SendNotificationData {
  title: string;
  description: string;
  image?: File;
}

export interface NotificationStats {
  sentToday: number;
  sentThisWeek: number;
  sentThisMonth: number;
  dailyLimit: number;
  remainingToday: number;
  canSendMore: boolean;
}

export interface Notification {
  id: number;
  title: string;
  description: string;
  image: string | null;
  zone_id: number;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
  firebase_message_id: string | null;
}

export interface NotificationHistoryResponse {
  success: boolean;
  data: Notification[];
  count: number;
  stats: NotificationStats;
}

export interface SendNotificationResponse {
  success: boolean;
  message: string;
  data: Notification;
  firebase_message_id: string;
}

/**
 * Notifications API
 */
export const notificationsApi = {
  /**
   * Send a new notification to customers in restaurant's zone
   * Rate limited: 5 per day
   */
  sendNotification: async (
    data: SendNotificationData
  ): Promise<SendNotificationResponse> => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('description', data.description);
    if (data.image) {
      formData.append('image', data.image);
    }

    const response = await axios.post(
      `${API_URL}/api/kds/notifications`,
      formData,
      {
        headers: {
          ...createAuthHeaders(),
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  },

  /**
   * Get notification statistics
   * Returns sent counts and rate limit info
   */
  getStats: async (): Promise<NotificationStats> => {
    const response = await axios.get(`${API_URL}/api/kds/notifications/stats`, {
      headers: createAuthHeaders(),
    });

    return response.data;
  },

  /**
   * Get notification history
   * Returns last 30 notifications
   */
  getHistory: async (): Promise<NotificationHistoryResponse> => {
    const response = await axios.get(
      `${API_URL}/api/kds/notifications/history`,
      {
        headers: createAuthHeaders(),
      }
    );

    return response.data;
  },

  /**
   * Get a single notification by ID
   */
  getNotificationById: async (id: number): Promise<Notification> => {
    const response = await axios.get(
      `${API_URL}/api/kds/notifications/${id}`,
      {
        headers: createAuthHeaders(),
      }
    );

    return response.data;
  },
};