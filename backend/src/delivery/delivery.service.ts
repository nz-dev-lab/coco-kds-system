import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryHistory } from './entities/delivery-history.entity';
import { Order } from '../orders/entities/order.entity';

@Injectable()
export class DeliveryService {
  constructor(
    @InjectRepository(DeliveryHistory)
    private readonly deliveryHistoryRepo: Repository<DeliveryHistory>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getDmLocationByOrderId(orderId: number): Promise<{
    delivery_man_id: number;
    latitude: string;
    longitude: string;
    location: string | null;
    updated_at: Date;
  }> {
    const order = await this.orderRepo.findOne({
      where: { id: orderId },
      select: ['id', 'delivery_man_id'],
    });

    if (!order) throw new NotFoundException(`Order ${orderId} not found`);
    if (!order.delivery_man_id) throw new NotFoundException(`Order ${orderId} has no delivery man assigned`);

    const location = await this.deliveryHistoryRepo.findOne({
      where: { delivery_man_id: order.delivery_man_id },
      order: { updated_at: 'DESC' },
    });

    if (!location || !location.latitude || !location.longitude) {
      throw new NotFoundException(`No location data found for delivery man ${order.delivery_man_id}`);
    }

    return {
      delivery_man_id: order.delivery_man_id,
      latitude: location.latitude,
      longitude: location.longitude,
      location: location.location ?? null,
      updated_at: location.updated_at,
    };
  }
}
