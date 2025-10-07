import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || '50ed94020811d0fe4ddcdcd896ee3b91',
    });
  }

  async validate(payload: any) {
    return {
      vendorId: payload.vendorId,
      restaurantId: payload.restaurantId,
      zoneId: payload.zoneId,
      email: payload.email,
    };
  }
}