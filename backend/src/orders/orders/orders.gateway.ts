import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:5173', '*'], // Allow all for testing
    credentials: true,
  },
  transports: ['websocket', 'polling'], // Enable both
})
export class OrdersGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(OrdersGateway.name);

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      this.logger.log(`Client attempting connection: ${client.id}`);
      
      // Extract token from handshake
      const token = client.handshake.auth?.token;

      this.logger.log(`Token received: ${token ? 'Yes' : 'No'}`);

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token - disconnecting`);
        client.emit('error', { message: 'No token provided' });
        client.disconnect();
        return;
      }

      // Verify JWT
      let payload;
      try {
        payload = this.jwtService.verify(token, {
          secret: process.env.JWT_SECRET || '50ed94020811d0fe4ddcdcd896ee3b91',
        });
        this.logger.log(`Token verified for client ${client.id}`);
      } catch (err) {
        this.logger.error(`Token verification failed: ${err.message}`);
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      const restaurantId = payload.restaurantId;

      if (!restaurantId) {
        this.logger.warn(`Client ${client.id} has no restaurantId in token`);
        client.emit('error', { message: 'No restaurant ID in token' });
        client.disconnect();
        return;
      }

      // Store restaurant ID in socket data
      client.data.restaurantId = restaurantId;

      // Join restaurant-specific room
      const room = `restaurant:${restaurantId}`;
      await client.join(room);

      this.logger.log(`✅ Client ${client.id} joined room: ${room}`);
      
      // Send connection confirmation
      client.emit('connected', { 
        message: 'Connected to KDS', 
        restaurantId,
        room,
        clientId: client.id,
      });

    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}:`, error.message);
      this.logger.error(error.stack);
      client.emit('error', { message: 'Connection failed', error: error.message });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // Emit new order event
  emitNewOrder(restaurantId: number, order: any) {
    const room = `restaurant:${restaurantId}`;
    this.server.to(room).emit('order:new', order);
    this.logger.log(`📢 Emitted order:new to ${room}`);
  }

  // Emit order updated event
  emitOrderUpdated(restaurantId: number, order: any) {
    const room = `restaurant:${restaurantId}`;
    this.server.to(room).emit('order:updated', order);
    this.logger.log(`📢 Emitted order:updated to ${room}`);
  }

  // Test endpoint for manual event triggering
  @SubscribeMessage('test')
  handleTest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: any,
  ) {
    const restaurantId = client.data.restaurantId;
    this.logger.log(`Test message received from client ${client.id}`);
    client.emit('test:response', { 
      message: 'Test received', 
      restaurantId,
      data 
    });
  }
}