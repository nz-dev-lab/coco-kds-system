import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderDetail } from './entities/order-detail.entities';
import { DeliveryMan } from './entities/delivery-main.entity';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Restaurant } from '../auth/restaurant.entity';
import { OrdersGateway } from './orders/orders.gateway';


interface DeliveryAddress {
  contact_person_name: string;
  contact_person_number: string;
  contact_person_email?: string;
  address_type: string;
  address: string;
  floor?: string | null;
  road?: string | null;
  house?: string | null;
  longitude?: string;
  latitude?: string;
}


@Injectable()
export class OrdersService {
  private readonly VALID_TRANSITIONS = {
    pending: ['confirmed'],
    confirmed: ['processing'],
    processing: ['handover'],
    handover: [],
    delivered: [],
    canceled: [],
  };

  constructor(
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(OrderDetail)
    private orderDetailRepo: Repository<OrderDetail>,
    @InjectRepository(DeliveryMan)
  private deliveryManRepo: Repository<DeliveryMan>,
  private ordersGateway: OrdersGateway,
  ) {}

async getKitchenOrders(restaurantId: number) {
  const twentyFourHoursAgo = new Date();
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

  const orders = await this.orderRepo.find({
    where: {
      restaurant_id: restaurantId,
      order_status: In(['pending', 'confirmed', 'processing', 'handover']),
    },
    relations: ['details'],
    order: {
      created_at: 'ASC',
    },
  });

  // Filter to last 24 hours
  return orders
    .filter(order => new Date(order.created_at) >= twentyFourHoursAgo)
    .map(order => this.formatOrder(order));
}

  async getOrderDetails(orderId: number, restaurantId: number) {
    const order = await this.orderRepo.findOne({
      where: { id: orderId, restaurant_id: restaurantId },
      relations: ['details'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.formatOrder(order);
  }

async updateOrderStatus(
  orderId: number,
  restaurantId: number,
  dto: UpdateOrderStatusDto,
) {
  return this.orderRepo.manager.transaction(async (manager) => {
    const order = await manager.findOne(Order, {
      where: { id: orderId, restaurant_id: restaurantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    this.validateStatusUpdate(order, dto.order_status);

    const now = new Date();
    order.order_status = dto.order_status;
    order.updated_at = now;

    if (dto.order_status === 'confirmed') {
      order.confirmed = now;
    } else if (dto.order_status === 'processing') {
      order.processing = now;
      if (dto.processing_time) {
        order.processing_time = dto.processing_time;
      }
    } else if (dto.order_status === 'handover') {
      order.handover = now;
    }

    if (dto.delivery_man_id) {
      order.delivery_man_id = dto.delivery_man_id;
    }

    const savedOrder = await manager.save(order);
    
    // Reload with relations
    const updatedOrder = await manager.findOne(Order, {
  where: { id: savedOrder.id },
  relations: ['details'],
});

// ✨ Emit WebSocket event
if (updatedOrder) {
  const formattedOrder = this.formatOrder(updatedOrder);
  this.ordersGateway.emitOrderUpdated(restaurantId, formattedOrder);
}


    return updatedOrder;
  });
}

  private validateStatusUpdate(order: Order, newStatus: string) {
    if (order.delivered !== null) {
      throw new BadRequestException('Cannot change status after delivered');
    }

    const allowedTransitions = this.VALID_TRANSITIONS[order.order_status];
    if (!allowedTransitions || !allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Invalid transition from ${order.order_status} to ${newStatus}`,
      );
    }
  }

  private formatOrder(order: Order) {
  // Parse delivery_address to extract customer info
  let customerName: string | null = null;
  let parsedDeliveryAddress: DeliveryAddress | null = null;
  
  if (order.delivery_address) {
    try {
      const parsed = typeof order.delivery_address === 'string'
        ? JSON.parse(order.delivery_address)
        : order.delivery_address;
      
      // Type assertion after parsing
      parsedDeliveryAddress = parsed as DeliveryAddress;
      customerName = parsedDeliveryAddress?.contact_person_name || null;
    } catch (e) {
      console.warn(`Failed to parse delivery_address for order ${order.id}:`, e);
    }
  }

  return {
    id: order.id,
    restaurant_id: order.restaurant_id,
    order_status: order.order_status,
    order_type: order.order_type,
    payment_method: order.payment_method,
    order_amount: order.order_amount,
    processing_time: order.processing_time,
    order_note: order.order_note,
    delivery_instruction: order.delivery_instruction,
    delivery_man_id: order.delivery_man_id,
    created_at: order.created_at,
    schedule_at: order.schedule_at,
    order_age_minutes: this.calculateOrderAge(order.created_at),
    is_scheduled: order.schedule_at ? new Date(order.schedule_at) > new Date() : false,
    customer_name: customerName,
    delivery_address: parsedDeliveryAddress,
    status_timestamps: {
      pending: order.pending,
      confirmed: order.confirmed,
      processing: order.processing,
      handover: order.handover,
      delivered: order.delivered,
    },
    items: order.details.map((detail) => this.formatOrderDetail(detail)),
    item_count: order.details.reduce((sum, d) => sum + d.quantity, 0),
  };
}

  private formatOrderDetail(detail: OrderDetail) {
    const foodInfo = this.parseJSON(detail.food_details);
    const variations = this.parseJSON(detail.variation);
    const addOns = this.parseJSON(detail.add_ons);

    return {
      id: detail.id,
      food_id: detail.food_id,
      name: foodInfo?.name || 'Unknown Item',
      quantity: detail.quantity,
      price: detail.price,
      variant: detail.variant,
      variations: Array.isArray(variations) ? variations : [],
      add_ons: Array.isArray(addOns) ? addOns : [],
    };
  }

  private parseJSON(jsonString: string | null): any {
    if (!jsonString) return null;
    try {
      return JSON.parse(jsonString);
    } catch {
      return null;
    }
  }

  private calculateOrderAge(createdAt: Date): number {
    const now = new Date();
    const diff = now.getTime() - new Date(createdAt).getTime();
    return Math.floor(diff / 60000);
  }

 async getAvailableDeliveryMen(restaurantId: number, zoneId: number) {
  return this.deliveryManRepo
    .createQueryBuilder('dm')
    .where('dm.status = :status', { status: 1 })
    .andWhere('dm.active = :active', { active: 1 })
    .andWhere('dm.application_status = :appStatus', { appStatus: 'approved' })
    .andWhere(
      '(dm.restaurant_id = :restaurantId OR (dm.type = :zoneWise AND dm.zone_id = :zoneId))',
      { restaurantId, zoneWise: 'zone_wise', zoneId }
    )
    .select([
      'dm.id',
      'dm.f_name',
      'dm.l_name',
      'dm.phone',
      'dm.current_orders',
      'dm.image',
      'dm.type',
    ])
    .orderBy('dm.current_orders', 'ASC')
    .getMany();
}

async assignDeliveryMan(
  orderId: number,
  restaurantId: number,
  deliveryManId: number,
) {
  return this.orderRepo.manager.transaction(async (manager) => {
    const order = await manager.findOne(Order, {
      where: { id: orderId, restaurant_id: restaurantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.order_status !== 'handover') {
      throw new BadRequestException(
        'Can only assign delivery man when order is at handover status',
      );
    }

    const restaurant = await manager.findOne(Restaurant, {
      where: { id: restaurantId },
      select: ['zone_id'],
    });

    const deliveryMan = await manager
      .createQueryBuilder(DeliveryMan, 'dm')
      .where('dm.id = :deliveryManId', { deliveryManId })
      .andWhere('dm.status = :status', { status: 1 })
      .andWhere('dm.active = :active', { active: 1 })
      .andWhere('dm.application_status = :appStatus', { appStatus: 'approved' })
      .andWhere(
        '(dm.restaurant_id = :restaurantId OR (dm.type = :zoneWise AND dm.zone_id = :zoneId))',
        { 
          restaurantId, 
          zoneWise: 'zone_wise', 
          zoneId: restaurant?.zone_id 
        }
      )
      .getOne();

    if (!deliveryMan) {
      throw new NotFoundException('Delivery man not found or unavailable');
    }

    order.delivery_man_id = deliveryManId;
    order.updated_at = new Date();

    await manager.save(order);

    const updatedOrder = await manager.findOne(Order, {
  where: { id: order.id },
  relations: ['details'],
});

// ✨ Emit WebSocket event
if (updatedOrder) {
  const formattedOrder = this.formatOrder(updatedOrder);
  this.ordersGateway.emitOrderUpdated(restaurantId, formattedOrder);
}

    return updatedOrder;
  });
}
}