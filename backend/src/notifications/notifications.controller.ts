import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { NotificationsService } from './notifications.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import {
  CreateNotificationResponseDto,
  NotificationHistoryResponseDto,
  NotificationStatsDto,
} from './dto/notification-response.dto';

// Define the request type with user info from JWT
interface RequestWithRestaurant extends Request {
  user: {
    vendorId: number;
    restaurantId: number;
    zoneId: number;
    email: string;
  };
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('api/kds/notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(RateLimitGuard)  // Apply rate limiting
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({ summary: 'Send notification to customers in restaurant zone' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: 201,
    description: 'Notification sent successfully',
    type: CreateNotificationResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async sendNotification(
    @Body() createDto: CreateNotificationDto,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: RequestWithRestaurant,
  ): Promise<CreateNotificationResponseDto> {
    const restaurantId = req.user.restaurantId;
    const zoneId = req.user.zoneId;

    // Attach file to DTO if uploaded
    if (file) {
      createDto.image = file;
    }

    return this.notificationsService.createNotification(
      createDto,
      restaurantId,
      zoneId,
    );
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification history for restaurant' })
  @ApiResponse({
    status: 200,
    description: 'Returns notification history with statistics',
    type: NotificationHistoryResponseDto,
  })
  async getHistory(
    @Req() req: RequestWithRestaurant,
  ): Promise<NotificationHistoryResponseDto> {
    const restaurantId = req.user.restaurantId;
    return this.notificationsService.getHistory(restaurantId);
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get notification statistics' })
  @ApiResponse({
    status: 200,
    description: 'Returns notification statistics',
    type: NotificationStatsDto,
  })
  async getStats(
    @Req() req: RequestWithRestaurant,
  ): Promise<NotificationStatsDto> {
    const restaurantId = req.user.restaurantId;
    return this.notificationsService.getStats(restaurantId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single notification by ID' })
  @ApiResponse({ status: 200, description: 'Returns notification details' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotification(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithRestaurant,
  ) {
    const restaurantId = req.user.restaurantId;
    return this.notificationsService.getNotificationById(id, restaurantId);
  }
}