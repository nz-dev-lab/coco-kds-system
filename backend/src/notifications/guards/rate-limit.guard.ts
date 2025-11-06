import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual } from 'typeorm';
import { Notification } from '../entities/notification.entity';

/**
 * Rate Limit Guard for Notifications
 * 
 * Limits restaurants to:
 * - 5 notifications per day
 * - 35 notifications per week
 * - 150 notifications per month
 * - 30 minutes cooldown between notifications
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);

  // Rate limit configuration
  private readonly LIMITS = {
    perDay: 5,
    perWeek: 35,
    perMonth: 150,
    cooldownMinutes: 30,
  };

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const restaurantId = request.user?.restaurantId;

    if (!restaurantId) {
      throw new HttpException(
        'Restaurant ID not found in request',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check daily limit
    const dailyCount = await this.getNotificationCount(restaurantId, 'day');
    if (dailyCount >= this.LIMITS.perDay) {
      this.logger.warn(
        `Restaurant ${restaurantId} exceeded daily limit (${dailyCount}/${this.LIMITS.perDay})`,
      );
      throw new HttpException(
        {
          message: `Daily limit reached. You have sent ${dailyCount}/${this.LIMITS.perDay} notifications today.`,
          error: 'Rate Limit Exceeded',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          limit: this.LIMITS.perDay,
          current: dailyCount,
          resetAt: this.getNextResetTime('day'),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check weekly limit
    const weeklyCount = await this.getNotificationCount(restaurantId, 'week');
    if (weeklyCount >= this.LIMITS.perWeek) {
      this.logger.warn(
        `Restaurant ${restaurantId} exceeded weekly limit (${weeklyCount}/${this.LIMITS.perWeek})`,
      );
      throw new HttpException(
        {
          message: `Weekly limit reached. You have sent ${weeklyCount}/${this.LIMITS.perWeek} notifications this week.`,
          error: 'Rate Limit Exceeded',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          limit: this.LIMITS.perWeek,
          current: weeklyCount,
          resetAt: this.getNextResetTime('week'),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Check monthly limit
    const monthlyCount = await this.getNotificationCount(restaurantId, 'month');
    if (monthlyCount >= this.LIMITS.perMonth) {
      this.logger.warn(
        `Restaurant ${restaurantId} exceeded monthly limit (${monthlyCount}/${this.LIMITS.perMonth})`,
      );
      throw new HttpException(
        {
          message: `Monthly limit reached. You have sent ${monthlyCount}/${this.LIMITS.perMonth} notifications this month.`,
          error: 'Rate Limit Exceeded',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          limit: this.LIMITS.perMonth,
          current: monthlyCount,
          resetAt: this.getNextResetTime('month'),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    
    // Check cooldown period
    const lastNotification = await this.notificationRepo.findOne({
      where: { restaurant_id: restaurantId },
      order: { created_at: 'DESC' },
    });

    if (lastNotification && lastNotification.created_at) {  // ← Added null check
      const timeSinceLastNotification =
        Date.now() - new Date(lastNotification.created_at).getTime();
      const cooldownMs = this.LIMITS.cooldownMinutes * 60 * 1000;

      if (timeSinceLastNotification < cooldownMs) {
        const remainingMinutes = Math.ceil(
          (cooldownMs - timeSinceLastNotification) / 1000 / 60,
        );
        
        this.logger.warn(
          `Restaurant ${restaurantId} in cooldown period (${remainingMinutes} minutes remaining)`,
        );
        
        throw new HttpException(
          {
            message: `Please wait ${remainingMinutes} minutes before sending another notification.`,
            error: 'Cooldown Period',
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            cooldownMinutes: this.LIMITS.cooldownMinutes,
            remainingMinutes,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    // All checks passed
    this.logger.log(
      `Rate limit check passed for restaurant ${restaurantId} ` +
      `(Daily: ${dailyCount}/${this.LIMITS.perDay}, ` +
      `Weekly: ${weeklyCount}/${this.LIMITS.perWeek}, ` +
      `Monthly: ${monthlyCount}/${this.LIMITS.perMonth})`,
    );

    return true;
  }

  /**
   * Get notification count for a time period
   */
  private async getNotificationCount(
    restaurantId: number,
    period: 'day' | 'week' | 'month',
  ): Promise<number> {
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case 'day':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        const dayOfWeek = now.getDay();
        startDate = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    return await this.notificationRepo.count({
      where: {
        restaurant_id: restaurantId,
        created_at: MoreThanOrEqual(startDate),
      },
    });
  }

  /**
   * Get next reset time for a period
   */
  private getNextResetTime(period: 'day' | 'week' | 'month'): Date {
    const now = new Date();

    switch (period) {
      case 'day':
        return new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1,
          0,
          0,
          0,
        );
      case 'week':
        const daysUntilSunday = 7 - now.getDay();
        return new Date(
          now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000,
        );
      case 'month':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }
}