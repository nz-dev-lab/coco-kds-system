import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategies';
import { Vendor } from './vendor.entity';
import { Restaurant } from './restaurant.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vendor, Restaurant]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || '50ed94020811d0fe4ddcdcd896ee3b91',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}