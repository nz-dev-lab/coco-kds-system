import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from './orders/orders.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { FoodsModule } from './foods/foods.module';
import { AppConfigModule } from './config/config.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DeliveryModule } from './delivery/delivery.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: false,
        logging: configService.get<string>('NODE_ENV') === 'development',
        timezone: 'Z',  // ← ADD THIS LINE - Forces UTC interpretation
        extra: {
          connectionLimit: 3,
        },
      }),
      inject: [ConfigService],
    }),
    OrdersModule,
    AuthModule,
    RedisModule,
    FoodsModule,
    AppConfigModule,
    NotificationsModule,
    DeliveryModule,
  ],
})
export class AppModule {}