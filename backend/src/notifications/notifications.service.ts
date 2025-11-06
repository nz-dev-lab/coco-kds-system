import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Between } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { 
  NotificationResponseDto, 
  NotificationStatsDto, 
  CreateNotificationResponseDto,
  NotificationHistoryResponseDto 
} from './dto/notification-response.dto';
import { FirebaseConfigService } from '../config/firebase-config/firebase-config.service';
import { DateTime } from 'luxon';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * Notifications Service
 * 
 * Handles:
 * - Creating notifications
 * - Sending to Firebase topics
 * - Getting notification history
 * - Calculating statistics
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  // Rate limits
  private readonly RATE_LIMITS = {
    perDay: 5,
    perWeek: 35,
    perMonth: 150,
  };

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    private readonly firebaseConfig: FirebaseConfigService,
  ) {}

  /**
   * Get notification statistics for a restaurant
   */
  async getStats(restaurantId: number): Promise<NotificationStatsDto> {
  // Get current London time
  const nowLondon = DateTime.now().setZone('Europe/London');
  
  // Start of today in London
  const startOfDayLondon = nowLondon.startOf('day');
  
  // Start of week (Monday) in London
  const startOfWeekLondon = nowLondon.startOf('week');
  
  // Start of month in London
  const startOfMonthLondon = nowLondon.startOf('month');

  // Convert to UTC for database query (MySQL stores as UTC)
  const startOfDayUTC = startOfDayLondon.toUTC().toJSDate();
  const startOfWeekUTC = startOfWeekLondon.toUTC().toJSDate();
  const startOfMonthUTC = startOfMonthLondon.toUTC().toJSDate();

  this.logger.debug(`Stats calculation:
    London now: ${nowLondon.toISO()}
    Start of day (London): ${startOfDayLondon.toISO()}
    Start of day (UTC for DB): ${startOfDayUTC.toISOString()}
  `);

  // Count notifications using UTC dates
  const [sentToday, sentThisWeek, sentThisMonth] = await Promise.all([
    this.notificationRepo.count({
      where: {
        restaurant_id: restaurantId,
        created_at: MoreThanOrEqual(startOfDayUTC),
      },
    }),
    this.notificationRepo.count({
      where: {
        restaurant_id: restaurantId,
        created_at: MoreThanOrEqual(startOfWeekUTC),
      },
    }),
    this.notificationRepo.count({
      where: {
        restaurant_id: restaurantId,
        created_at: MoreThanOrEqual(startOfMonthUTC),
      },
    }),
  ]);

  const remainingToday = Math.max(0, this.RATE_LIMITS.perDay - sentToday);

  this.logger.log(
    `Stats for restaurant ${restaurantId}: ` +
    `Today: ${sentToday}, Week: ${sentThisWeek}, Month: ${sentThisMonth}`
  );

  return {
    sentToday,
    sentThisWeek,
    sentThisMonth,
    dailyLimit: this.RATE_LIMITS.perDay,
    remainingToday,
    canSendMore: remainingToday > 0,
  };
}

  /**
   * Get notification history for a restaurant
   */
  async getHistory(
    restaurantId: number,
    limit: number = 30,
  ): Promise<NotificationHistoryResponseDto> {
    const notifications = await this.notificationRepo.find({
      where: { restaurant_id: restaurantId },
      order: { created_at: 'DESC' },
      take: limit,
    });

    const stats = await this.getStats(restaurantId);

    return {
      success: true,
      data: notifications.map(n => this.mapToResponseDto(n)),
      count: notifications.length,
      stats,
    };
  }

  /**
   * Map notification entity to response DTO
   */
  private mapToResponseDto(notification: Notification): NotificationResponseDto {
    return {
      id: notification.id,
      title: notification.title || '',
      description: notification.description || '',
      image: notification.image || null,
      tergat: notification.tergat || 'customer',
      zone_id: notification.zone_id || 0,
      restaurant_id: notification.restaurant_id || 0,
      status: notification.status,
      created_at: notification.created_at || new Date(),
      updated_at: notification.updated_at || new Date(),
    };
  }

  /**
   * Calculate estimated reach (number of potential recipients)
   * This is a rough estimate - in production you might query user counts
   */
  private async estimateReach(zoneId: number): Promise<number> {
    // Placeholder: In real implementation, query customer count in zone
    // For now, return a reasonable estimate
    return Math.floor(Math.random() * 500) + 200; // 200-700 customers
  }

  /**
   * Get Firebase topic name for a zone and target
   */
  private getFirebaseTopic(zoneId: number, target: string): string {
    // Match Laravel's topic naming convention
    return `zone_${zoneId}_${target}`;
  }

  /**
 * Upload notification image to Laravel's storage directory
 * Matches Laravel's storage structure: storage/app/public/notification/
 */
private async uploadImage(file: Express.Multer.File): Promise<string> {
  try {
    // Generate unique filename (matching Laravel's format: YYYY-MM-DD-{uuid}.ext)
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uuid = uuidv4().replace(/-/g, ''); // Remove hyphens from UUID
    const ext = path.extname(file.originalname);
    const filename = `${date}-${uuid}${ext}`;

    // Laravel storage path: /var/www/rootuser.cocoeats.uk/public_html/storage/app/public/notification/
    const uploadDir = '/var/www/rootuser.cocoeats.uk/public_html/storage/app/public/notification';
    const filePath = path.join(uploadDir, filename);

    // Ensure directory exists
    await fs.mkdir(uploadDir, { recursive: true });

    // Write file to Laravel's storage directory
    await fs.writeFile(filePath, file.buffer);

    this.logger.log(`✅ Image uploaded successfully: ${filename}`);
    this.logger.log(`   Path: ${filePath}`);
    this.logger.log(`   URL: https://rootuser.cocoeats.uk/storage/notification/${filename}`);

    return filename;
  } catch (error) {
    this.logger.error('Failed to upload image:', error.message);
    throw new BadRequestException('Failed to upload image');
  }
}

  /**
   * Validate if Firebase is ready
   */
  private validateFirebaseReady(): void {
    if (!this.firebaseConfig.isFirebaseReady()) {
      throw new BadRequestException(
        'Firebase is not initialized. Cannot send notifications.',
      );
    }
  }

  /**
   * Create and send a notification
   */
  async createNotification(
    createDto: CreateNotificationDto,
    restaurantId: number,
    zoneId: number,
  ): Promise<CreateNotificationResponseDto> {
    this.logger.log(`Creating notification for restaurant ${restaurantId}`);

    // Validate Firebase is ready
    this.validateFirebaseReady();

    // Handle image upload if provided
    let imagePath: string | null = null;
    if (createDto.image) {
      try {
        imagePath = await this.uploadImage(createDto.image);
        this.logger.log(`Image uploaded: ${imagePath}`);
      } catch (error) {
        this.logger.error('Failed to upload image:', error.message);
        // Continue without image rather than failing
      }
    }

    // Create notification record
    const now = new Date();
    const notification = this.notificationRepo.create({
      title: createDto.title,
      description: createDto.description,
      image: imagePath,
      tergat: 'customer',
      status: 1,
      zone_id: zoneId,
      restaurant_id: restaurantId,
      created_at: now,  // ← ADD THIS
      updated_at: now,  // ← ADD THIS
    });

    // Save to database
    const savedNotification = await this.notificationRepo.save(notification);
    this.logger.log(`Notification saved with ID: ${savedNotification.id}`);

    // Send to Firebase
    let firebaseMessageId: string | null = null;
    try {
      firebaseMessageId = await this.sendToFirebase(savedNotification);
      this.logger.log(`Notification sent to Firebase: ${firebaseMessageId}`);
    } catch (error) {
      this.logger.error('Failed to send to Firebase:', error.message);
      // Notification is saved in DB, but Firebase send failed
      // Don't throw error - return partial success
    }

    // Calculate estimated reach
    const estimatedReach = await this.estimateReach(zoneId);

    return {
      success: true,
      message: firebaseMessageId
        ? 'Notification sent successfully'
        : 'Notification saved but push delivery failed',
      data: {
        ...this.mapToResponseDto(savedNotification),
        estimated_reach: estimatedReach,
      },
      firebase_message_id: firebaseMessageId,
    };
  }

  /**
   * Send notification to Firebase topic
   */
  private async sendToFirebase(notification: Notification): Promise<string> {
    if (!notification.zone_id) {
      throw new BadRequestException('Zone ID is required to send notification');
    }

    const messaging = this.firebaseConfig.getMessaging();
    const topic = this.getFirebaseTopic(notification.zone_id, 'customer');

    // Build image URL - CORRECTED FORMAT
    const imageUrl = notification.image 
      ? `https://rootuser.cocoeats.uk/storage/notification/${notification.image}`  // ← FIXED
      : '';

    // Build notification payload matching Laravel's format EXACTLY
    const message = {
      notification: {
        title: notification.title || 'New Notification',
        body: notification.description || '',
        imageUrl: imageUrl || undefined,
      },
      data: {
        title: (notification.title || '').toString(),
        body: (notification.description || '').toString(),
        order_id: '',
        type: 'restaurant_announcement',
        image: imageUrl,
        body_loc_key: 'restaurant_announcement',
        click_action: '',
        sound: 'notification.wav',
        notification_id: notification.id.toString(),
        restaurant_id: (notification.restaurant_id || '').toString(),
      },
      android: {
        notification: {
          channelId: 'stackfood',
          sound: 'notification.wav',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'notification.wav',
          },
        },
      },
      topic,
    };

    this.logger.log(`Sending to Firebase topic: ${topic}`);
    this.logger.debug(`Message payload:`, JSON.stringify(message, null, 2));

    const result = await messaging.send(message);

    this.logger.log(`✅ Firebase notification sent successfully. Message ID: ${result}`);

    return result;
  }

  /**
   * Get a single notification by ID
   */
  async getNotificationById(
    id: number,
    restaurantId: number,
  ): Promise<NotificationResponseDto> {
    const notification = await this.notificationRepo.findOne({
      where: { 
        id, 
        restaurant_id: restaurantId,
      },
    });

    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }

    return this.mapToResponseDto(notification);
  }
}