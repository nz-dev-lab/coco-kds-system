import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Order } from './entities/order.entity';
import { OrderDetail } from './entities/order-detail.entities';
import { DeliveryMan } from './entities/delivery-main.entity';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Restaurant } from '../auth/restaurant.entity';
import { OrdersGateway } from './orders/orders.gateway';
import { DateTime } from 'luxon';

export interface DeliveryAddress {
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
  private readonly logger = new Logger(OrdersService.name);

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
      .filter((order) => new Date(order.created_at) >= twentyFourHoursAgo)
      .map((order) => this.formatOrder(order));
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

      // Emit WebSocket event
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
        const parsed =
          typeof order.delivery_address === 'string'
            ? JSON.parse(order.delivery_address)
            : order.delivery_address;

        parsedDeliveryAddress = parsed as DeliveryAddress;
        customerName = parsedDeliveryAddress?.contact_person_name || null;
      } catch (e) {
        console.warn(
          `Failed to parse delivery_address for order ${order.id}:`,
          e,
        );
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

      // Format timestamps as ISO UTC for consistency
      created_at: this.formatDateToISO(order.created_at),
      schedule_at: order.schedule_at
        ? this.formatDateToISO(order.schedule_at)
        : null,

      order_age_minutes: this.calculateOrderAge(order.created_at),
      is_scheduled: order.schedule_at
        ? new Date(order.schedule_at) > new Date()
        : false,
      customer_name: customerName,
      delivery_address: parsedDeliveryAddress,

      // Format all status timestamps as ISO UTC
      status_timestamps: {
        pending: order.pending ? this.formatDateToISO(order.pending) : null,
        confirmed: order.confirmed
          ? this.formatDateToISO(order.confirmed)
          : null,
        processing: order.processing
          ? this.formatDateToISO(order.processing)
          : null,
        handover: order.handover ? this.formatDateToISO(order.handover) : null,
        delivered: order.delivered
          ? this.formatDateToISO(order.delivered)
          : null,
      },

      items: order.details.map((detail) => this.formatOrderDetail(detail)),
      item_count: order.details.reduce((sum, d) => sum + d.quantity, 0),
    };
  }

  // Convert Laravel timestamp to ISO UTC string
  private formatDateToISO(date: Date | string | null): string | null {
    if (!date) return null;

    try {
      // Parse the date assuming it's London time (as Laravel saves it)
      const storedValue = DateTime.fromJSDate(new Date(date));
      const londonTime = DateTime.fromObject(
        {
          year: storedValue.year,
          month: storedValue.month,
          day: storedValue.day,
          hour: storedValue.hour,
          minute: storedValue.minute,
          second: storedValue.second,
        },
        { zone: 'Europe/London' },
      );

      // Convert to UTC and return ISO string with 'Z'
      return londonTime.toUTC().toISO();
    } catch (e) {
      console.error('Error formatting date to ISO:', e);
      return null;
    }
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
    const now = DateTime.now();

    // Parse what's in the database (stored as Europe/London time)
    // by treating the UTC timestamp as if it were London local time
    const storedValue = DateTime.fromJSDate(new Date(createdAt));

    // Figure out what timezone offset London had at that moment
    const londonAtThatTime = DateTime.fromObject(
      {
        year: storedValue.year,
        month: storedValue.month,
        day: storedValue.day,
        hour: storedValue.hour,
        minute: storedValue.minute,
        second: storedValue.second,
      },
      { zone: 'Europe/London' },
    );

    // Convert to actual UTC
    const actualUTC = londonAtThatTime.toUTC();

    const diff = now.diff(actualUTC, 'minutes');

    // Never return negative age (handles timing edge cases)
    return Math.max(0, Math.floor(diff.minutes));
  }

  async getAvailableDeliveryMen(restaurantId: number, zoneId: number) {
    return this.deliveryManRepo
      .createQueryBuilder('dm')
      .where('dm.status = :status', { status: 1 })
      .andWhere('dm.active = :active', { active: 1 })
      .andWhere('dm.application_status = :appStatus', { appStatus: 'approved' })
      .andWhere(
        '(dm.restaurant_id = :restaurantId OR (dm.type = :zoneWise AND dm.zone_id = :zoneId))',
        { restaurantId, zoneWise: 'zone_wise', zoneId },
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
      // 1. Find and lock order
      const order = await manager.findOne(Order, {
        where: { id: orderId, restaurant_id: restaurantId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      // 2. Validate order status (only allow assignment at handover)
      if (order.order_status !== 'handover') {
        throw new BadRequestException(
          'Can only assign delivery man when order is at handover status',
        );
      }

      // 3. Check if already assigned to same delivery man
      if (order.delivery_man_id === deliveryManId) {
        throw new BadRequestException(
          'Order already assigned to this delivery man',
        );
      }

      // 4. Get restaurant zone for validation
      const restaurant = await manager.findOne(Restaurant, {
        where: { id: restaurantId },
        select: ['zone_id'],
      });

      // 5. Find and validate new delivery man
      const deliveryMan = await manager
        .createQueryBuilder(DeliveryMan, 'dm')
        .where('dm.id = :deliveryManId', { deliveryManId })
        .andWhere('dm.status = :status', { status: 1 }) // Active
        .andWhere('dm.active = :active', { active: 1 }) // Online
        .andWhere('dm.application_status = :appStatus', {
          appStatus: 'approved',
        })
        .andWhere(
          '(dm.restaurant_id = :restaurantId OR (dm.type = :zoneWise AND dm.zone_id = :zoneId))',
          {
            restaurantId,
            zoneWise: 'zone_wise',
            zoneId: restaurant?.zone_id,
          },
        )
        .getOne();

      if (!deliveryMan) {
        throw new NotFoundException('Delivery man not found or unavailable');
      }

      // 6. Check maximum orders limit (prevent overload)
      const MAX_ORDERS = 5;
      if (deliveryMan.current_orders >= MAX_ORDERS) {
        throw new BadRequestException(
          `Delivery man has reached maximum capacity (${deliveryMan.current_orders}/${MAX_ORDERS} orders)`,
        );
      }

      // 7. Handle previous delivery man (if reassigning)
      if (order.delivery_man_id && order.delivery_man_id !== deliveryManId) {
        // Decrement old delivery man's current_orders
        await manager.decrement(
          DeliveryMan,
          { id: order.delivery_man_id },
          'current_orders',
          1,
        );

        this.logger.log(
          `Removed order ${orderId} from delivery man ${order.delivery_man_id}`,
        );
      }

      // 8. Assign new delivery man to order
      order.delivery_man_id = deliveryManId;
      order.updated_at = new Date();
      await manager.save(order);

      this.logger.log(
        `Assigned order ${orderId} to delivery man ${deliveryManId}`,
      );

      // 9. Update new delivery man stats
      // Increment current_orders (active orders count)
      await manager.increment(
        DeliveryMan,
        { id: deliveryManId },
        'current_orders',
        1,
      );

      // Increment assigned_order_count (lifetime total)
      await manager.increment(
        DeliveryMan,
        { id: deliveryManId },
        'assigned_order_count',
        1,
      );

      this.logger.log(
        `Updated delivery man ${deliveryManId} stats: current_orders +1, assigned_order_count +1`,
      );

      // 10. Load updated order with all relations
      const updatedOrder = await manager.findOne(Order, {
        where: { id: order.id },
        relations: ['details'],
      });

      // ✅ Handle null case
      if (!updatedOrder) {
        throw new NotFoundException('Order not found after assignment');
      }

      // 11. Format order for frontend
      const formattedOrder = this.formatOrder(updatedOrder);

      // 12. Broadcast update via WebSocket
      this.ordersGateway.emitOrderUpdated(restaurantId, formattedOrder);

      return formattedOrder;
    });
  }
}