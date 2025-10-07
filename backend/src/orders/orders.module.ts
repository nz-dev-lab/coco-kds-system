import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { OrdersGateway } from './orders/orders.gateway';
import { Order } from './entities/order.entity';
import { OrderDetail } from './entities/order-detail.entities';
import { DeliveryMan } from './entities/delivery-main.entity';
import { RedisModule } from 'src/redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, OrderDetail, DeliveryMan]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || '50ed94020811d0fe4ddcdcd896ee3b91',
      }),
      inject: [ConfigService],
    }),
    forwardRef(() => RedisModule), // Use forwardRef here too
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersGateway],
  exports: [OrdersService, OrdersGateway],
})
export class OrdersModule {}