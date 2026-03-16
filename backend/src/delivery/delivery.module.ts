import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryController } from './delivery.controller';
import { DeliveryService } from './delivery.service';
import { DeliveryHistory } from './entities/delivery-history.entity';
import { Order } from '../orders/entities/order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryHistory, Order])],
  controllers: [DeliveryController],
  providers: [DeliveryService],
})
export class DeliveryModule {}
