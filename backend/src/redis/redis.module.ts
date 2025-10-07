import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisSubscriberService } from './redis-subscriber.service';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    ConfigModule,
    forwardRef(() => OrdersModule), // Use forwardRef here
  ],
  providers: [RedisSubscriberService],
  exports: [RedisSubscriberService],
})
export class RedisModule {}