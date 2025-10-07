import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from './vendor.entity';
import { Restaurant } from './restaurant.entity';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Vendor)
    private vendorRepo: Repository<Vendor>,

    @InjectRepository(Restaurant)
    private restaurantRepo: Repository<Restaurant>,

    private jwtService: JwtService,
  ) {}

async validateUser(email: string, password: string) {
  const vendor = await this.vendorRepo.findOne({ where: { email } });
//   console.log('🔍 Vendor:', vendor?.email);

  if (!vendor) {
    throw new UnauthorizedException('Invalid credentials');
  }

//   console.log('🧩 Raw hash from DB:', vendor.password);

  const normalizedHash = vendor.password.replace(/^\$2y\$/, '$2b$');

//   console.log('🧩 Normalized hash:', normalizedHash);

  const isMatch = await bcrypt.compare(password, normalizedHash);
//   console.log('🧩 Password check result:', isMatch);

  if (!isMatch) {
    throw new UnauthorizedException('Invalid credentials');
  }

  const restaurant = await this.restaurantRepo.findOne({
    where: { vendor_id: vendor.id },
  });

  return { vendor, restaurant };
}

  async login(email: string, password: string) {
    const { vendor, restaurant } = await this.validateUser(email, password);

    // Prepare payload for JWT
    const payload = {
      vendorId: vendor.id,
      restaurantId: restaurant?.id,
      zoneId: restaurant?.zone_id,
      email: vendor.email,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      vendor: {
        id: vendor.id,
        name: `${vendor.f_name} ${vendor.l_name ?? ''}`.trim(),
        email: vendor.email,
      },
      restaurant,
    };
  }
}
