/**
 * Type definitions for Notifications feature
 * 
 * This file is optional - types are already defined in notificationsApi.ts
 * but you can import from here for centralized type management.
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