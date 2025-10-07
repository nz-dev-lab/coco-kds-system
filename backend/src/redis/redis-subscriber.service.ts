import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { OrdersGateway } from 'src/orders/orders/orders.gateway';

@Injectable()
export class RedisSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisSubscriberService.name);
  private redisSubscriber: Redis;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;

  constructor(
    private configService: ConfigService,
    private ordersGateway: OrdersGateway,
  ) {}

  async onModuleInit() {
    await this.connect();
    this.setupSubscriptions();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      const redisHost = this.configService.get<string>('REDIS_HOST', '127.0.0.1');
      const redisPort = this.configService.get<number>('REDIS_PORT', 6379);
      const redisPassword = this.configService.get<string>('REDIS_PASSWORD');

      this.logger.log(`Connecting to Redis at ${redisHost}:${redisPort}...`);

      this.redisSubscriber = new Redis({
        host: redisHost,
        port: redisPort,
        password: redisPassword,
        retryStrategy: (times) => {
          if (times > this.maxReconnectAttempts) {
            this.logger.error('Max Redis reconnection attempts reached');
            return null; // Stop retrying
          }
          const delay = Math.min(times * 1000, 10000); // Max 10s delay
          this.logger.warn(`Reconnecting to Redis in ${delay}ms (attempt ${times})`);
          return delay;
        },
        maxRetriesPerRequest: 3,
      });

      this.redisSubscriber.on('connect', () => {
        this.logger.log('✅ Redis subscriber connected');
        this.reconnectAttempts = 0;
      });

      this.redisSubscriber.on('ready', () => {
        this.logger.log('✅ Redis subscriber ready');
      });

      this.redisSubscriber.on('error', (error) => {
        this.logger.error('❌ Redis subscriber error:', error.message);
        this.reconnectAttempts++;
      });

      this.redisSubscriber.on('close', () => {
        this.logger.warn('⚠️ Redis subscriber connection closed');
      });

      this.redisSubscriber.on('reconnecting', () => {
        this.logger.log('🔄 Redis subscriber reconnecting...');
      });

    } catch (error) {
      this.logger.error('Failed to initialize Redis subscriber:', error);
      throw error;
    }
  }

  private setupSubscriptions() {
    // Subscribe to Laravel's broadcast channels
    // Pattern: laravel_database_* matches all restaurant channels
    this.redisSubscriber.psubscribe('laravel_database_*', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to Redis channels:', err);
        return;
      }
      this.logger.log(`📡 Subscribed to ${count} Redis channel pattern(s)`);
    });

    // Handle messages from Redis
    this.redisSubscriber.on('pmessage', (pattern, channel, message) => {
      this.handleRedisMessage(pattern, channel, message);
    });
  }

  private handleRedisMessage(pattern: string, channel: string, message: string) {
    try {
      this.logger.debug(`📨 Received message on channel: ${channel}`);

      // Parse Laravel broadcast message
      const payload = this.parseLaravelBroadcast(message);
      
      if (!payload) {
        this.logger.warn(`Failed to parse message from ${channel}`);
        return;
      }

      // Extract restaurant ID from channel name
      // Format: laravel_database_restaurant.{restaurant_id}
      const restaurantId = this.extractRestaurantId(channel);
      
      if (!restaurantId) {
        this.logger.warn(`Could not extract restaurant ID from channel: ${channel}`);
        return;
      }

      // Route to appropriate WebSocket event based on event type
      this.routeEvent(restaurantId, payload);

    } catch (error) {
      this.logger.error(`Error handling Redis message from ${channel}:`, error.message);
      this.logger.error(error.stack);
    }
  }

  private parseLaravelBroadcast(message: string): any {
    try {
      const parsed = JSON.parse(message);

      // Laravel broadcast format: { event: "...", data: {...} }
      if (parsed.event && parsed.data) {
        return {
          eventName: parsed.event,
          data: typeof parsed.data === 'string' ? JSON.parse(parsed.data) : parsed.data,
        };
      }

      // Sometimes Laravel sends direct JSON
      return {
        eventName: 'order:updated',
        data: parsed,
      };

    } catch (error) {
      this.logger.error('Failed to parse Laravel broadcast message:', error.message);
      return null;
    }
  }

  private extractRestaurantId(channel: string): number | null {
    try {
      // Extract from patterns like:
      // laravel_database_restaurant.2
      // laravel_database_orders.restaurant.2
      const match = channel.match(/restaurant[._](\d+)/);
      
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }

      // Alternative pattern: last number in channel name
      const numbers = channel.match(/(\d+)/g);
      if (numbers && numbers.length > 0) {
        return parseInt(numbers[numbers.length - 1], 10);
      }

      return null;
    } catch (error) {
      this.logger.error('Error extracting restaurant ID:', error);
      return null;
    }
  }

  private routeEvent(restaurantId: number, payload: any) {
    const eventName = payload.eventName.toLowerCase();
    const data = payload.data;

    this.logger.log(`🎯 Routing event "${eventName}" for restaurant ${restaurantId}`);

    // Route based on Laravel event class name
    if (eventName.includes('order.created') || eventName.includes('ordercreated') || eventName.includes('new')) {
    this.handleNewOrder(restaurantId, data);
  } else if (eventName.includes('order.updated') || eventName.includes('orderupdated') || eventName.includes('statuschanged')) {
    this.handleOrderUpdated(restaurantId, data);
  } else {
    // Default: treat as order updated
    this.logger.log(`Unknown event type "${eventName}", treating as order:updated`);
    this.handleOrderUpdated(restaurantId, data);
  }
  }

  private handleNewOrder(restaurantId: number, orderData: any) {
    try {
      this.logger.log(`📦 New order event for restaurant ${restaurantId}`);
      
      // Extract order from Laravel's broadcast format
      const order = orderData.order || orderData;

      // Emit to WebSocket
      this.ordersGateway.emitNewOrder(restaurantId, order);

    } catch (error) {
      this.logger.error('Error handling new order event:', error);
    }
  }

  private handleOrderUpdated(restaurantId: number, orderData: any) {
    try {
      this.logger.log(`🔄 Order updated event for restaurant ${restaurantId}`);
      
      // Extract order from Laravel's broadcast format
      const order = orderData.order || orderData;

      // Emit to WebSocket
      this.ordersGateway.emitOrderUpdated(restaurantId, order);

    } catch (error) {
      this.logger.error('Error handling order updated event:', error);
    }
  }

  private async disconnect() {
    try {
      if (this.redisSubscriber) {
        await this.redisSubscriber.quit();
        this.logger.log('Redis subscriber disconnected');
      }
    } catch (error) {
      this.logger.error('Error disconnecting Redis subscriber:', error);
    }
  }

  // Public method for testing
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.redisSubscriber.ping();
      return result === 'PONG';
    } catch (error) {
      this.logger.error('Redis ping failed:', error);
      return false;
    }
  }
}