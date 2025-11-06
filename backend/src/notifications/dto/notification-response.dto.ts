import { ApiProperty } from '@nestjs/swagger';

/**
 * Notification statistics for display in UI
 */
export class NotificationStatsDto {
  @ApiProperty({ description: 'Total notifications sent today' })
  sentToday: number;

  @ApiProperty({ description: 'Total notifications sent this week' })
  sentThisWeek: number;

  @ApiProperty({ description: 'Total notifications sent this month' })
  sentThisMonth: number;

  @ApiProperty({ description: 'Daily limit' })
  dailyLimit: number;

  @ApiProperty({ description: 'Remaining notifications for today' })
  remainingToday: number;

  @ApiProperty({ description: 'Can send more notifications today' })
  canSendMore: boolean;
}

/**
 * Response for a single notification
 */
export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: number;

  @ApiProperty({ description: 'Notification title' })
  title: string;

  @ApiProperty({ description: 'Notification description' })
  description: string;

  @ApiProperty({ description: 'Image URL (if any)', nullable: true })
  image: string | null;

  @ApiProperty({ description: 'Target audience (customer/deliveryman/restaurant)' })
  tergat: string;

  @ApiProperty({ description: 'Zone ID' })
  zone_id: number;

  @ApiProperty({ description: 'Restaurant ID (who sent it)' })
  restaurant_id: number;

  @ApiProperty({ description: 'Status (1 = active, 0 = inactive)' })
  status: number;

  @ApiProperty({ description: 'Created at timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Updated at timestamp' })
  updated_at: Date;

  @ApiProperty({ description: 'Estimated number of recipients' })
  estimated_reach?: number;
}

/**
 * Response for creating a notification
 */
export class CreateNotificationResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Success message' })
  message: string;

  @ApiProperty({ description: 'The created notification', type: NotificationResponseDto })
  data: NotificationResponseDto;

  @ApiProperty({ description: 'Firebase message ID (if sent successfully)', nullable: true })
  firebase_message_id?: string | null;
}

/**
 * Response for getting notification history
 */
export class NotificationHistoryResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Array of notifications', type: [NotificationResponseDto] })
  data: NotificationResponseDto[];

  @ApiProperty({ description: 'Total count' })
  count: number;

  @ApiProperty({ description: 'Statistics', type: NotificationStatsDto })
  stats: NotificationStatsDto;
}