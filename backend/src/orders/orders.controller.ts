import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
  Request,
  Post,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersGateway } from './orders/orders.gateway';
import { RedisSubscriberService } from 'src/redis/redis-subscriber.service';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('orders')
@ApiBearerAuth('JWT-auth')
@Controller('api/kds/orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly ordersGateway: OrdersGateway,
    private readonly redisSubscriberService: RedisSubscriberService,
  ) {}

  @Get('delivery-men')
  @ApiOperation({ summary: 'Get available delivery men for the restaurant' })
  @ApiResponse({ status: 200, description: 'List of available delivery men' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDeliveryMen(@Request() req) {
    const restaurantId = req.user.restaurantId;
    const zoneId = req.user.zoneId;

    console.log('🔍 Restaurant ID:', restaurantId);
    console.log('🔍 Zone ID:', zoneId);
    console.log('🔍 Full user object:', req.user);
    return this.ordersService.getAvailableDeliveryMen(restaurantId, zoneId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active kitchen orders' })
  @ApiResponse({ status: 200, description: 'Returns list of kitchen orders' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getOrders(@Request() req) {
    const restaurantId = req.user.restaurantId;
    return this.ordersService.getKitchenOrders(restaurantId);
  }

  @Get('test-redis')
  @ApiOperation({ summary: 'Test Redis connection' })
  @ApiResponse({
    status: 200,
    description: 'Redis connection test result (connected or failed)',
  })
  async testRedis() {
    const isConnected = await this.redisSubscriberService.testConnection();
    return {
      redis_connected: isConnected,
      message: isConnected
        ? 'Redis is connected'
        : 'Redis connection failed',
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed information about a specific order' })
  @ApiParam({ name: 'id', description: 'Order ID', example: 101 })
  @ApiResponse({ status: 200, description: 'Order details returned successfully' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async getOrderDetails(
    @Param('id', ParseIntPipe) orderId: number,
    @Request() req,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.ordersService.getOrderDetails(orderId, restaurantId);
  }

  @Post('test-new-order')
  @ApiOperation({
    summary: 'Emit a test order:new event for WebSocket testing',
    description: 'Use this to simulate a new incoming order on the KDS',
  })
  @ApiResponse({ status: 200, description: 'Event emitted successfully' })
  async testNewOrder(@Request() req) {
    const restaurantId = req.user.restaurantId;

    const mockOrder = {
      id: 999999,
      restaurant_id: restaurantId,
      order_status: 'pending',
      order_type: 'delivery',
      payment_method: 'cash_on_delivery',
      order_amount: '18.99',
      delivery_charge: '2.00',
      total_tax_amount: '0.00',
      order_note: 'Test order — no onions please',
      delivery_instruction: null,
      processing_time: null,
      delivery_man_id: null,
      created_at: new Date().toISOString(),
      schedule_at: null,
      scheduled: 0,
      order_age_minutes: 0,
      delivery_address: JSON.stringify({
        contact_person_name: 'Test Customer',
        contact_person_number: '07700900000',
        address_type: 'home',
        address: '123 Test Street, Preston, PR1 1AA',
        latitude: '53.7632',
        longitude: '-2.7050',
      }),
      details: [
        {
          id: 1,
          food_id: 101,
          food_details: JSON.stringify({ name: 'Chicken Burger' }),
          quantity: 2,
          price: '7.99',
          variant: null,
          variation: null,
          add_ons: JSON.stringify([{ name: 'Extra Sauce', quantity: 1, price: '0.50' }]),
        },
        {
          id: 2,
          food_id: 102,
          food_details: JSON.stringify({ name: 'Chips (Large)' }),
          quantity: 1,
          price: '3.00',
          variant: 'Large',
          variation: null,
          add_ons: '[]',
        },
      ],
    };

    this.ordersGateway.emitNewOrder(restaurantId, mockOrder);

    return { message: 'Test order:new event emitted', order: mockOrder };
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update order status (e.g., confirmed, processing, handover)' })
  @ApiParam({ name: 'id', description: 'Order ID', example: 101 })
  @ApiBody({
    description: 'Order status update data',
    type: UpdateOrderStatusDto,
  })
  @ApiResponse({ status: 200, description: 'Order status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async updateStatus(
    @Param('id', ParseIntPipe) orderId: number,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.ordersService.updateOrderStatus(orderId, restaurantId, dto);
  }

  @Patch(':id/assign-delivery-man')
  @ApiOperation({ summary: 'Assign a delivery man to a specific order' })
  @ApiParam({ name: 'id', description: 'Order ID', example: 101 })
  @ApiBody({
    schema: {
      example: {
        delivery_man_id: 3,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Delivery man assigned successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid input' })
  async assignDeliveryMan(
    @Param('id') orderId: string,
    @Body('delivery_man_id', ParseIntPipe) deliveryManId: number,
    @Request() req,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.ordersService.assignDeliveryMan(
      parseInt(orderId),
      restaurantId,
      deliveryManId,
    );
  }
}
