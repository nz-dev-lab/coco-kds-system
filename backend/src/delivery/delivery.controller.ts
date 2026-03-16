import { Controller, Get, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { DeliveryService } from './delivery.service';
import { DmLocationResponseDto } from './dto/dm-location-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('delivery')
@ApiBearerAuth('JWT-auth')
@Controller('api/kds/delivery')
@UseGuards(JwtAuthGuard)
export class DeliveryController {
  constructor(private readonly deliveryService: DeliveryService) {}

  @Get('dm-location/:orderId')
  @ApiOperation({
    summary: 'Get delivery man current location for an order',
    description: 'Returns the latest GPS coordinates of the delivery man assigned to the given order. Used by CocoFlow to plot the DM pin on the Leaflet map.',
  })
  @ApiParam({ name: 'orderId', type: Number, example: 1234, description: 'Order ID' })
  @ApiOkResponse({ type: DmLocationResponseDto })
  @ApiNotFoundResponse({ description: 'Order not found, no DM assigned, or no location data available' })
  async getDmLocation(
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<DmLocationResponseDto> {
    return this.deliveryService.getDmLocationByOrderId(orderId);
  }
}
