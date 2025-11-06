import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';
import { RateLimitGuard } from './guards/rate-limit.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    // ConfigModule is global, so FirebaseConfigService is available
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    RateLimitGuard,  // Register the guard
  ],
  exports: [NotificationsService],  // Export in case other modules need it
})
export class NotificationsModule {}