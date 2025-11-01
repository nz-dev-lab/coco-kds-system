import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FoodsService } from './foods.service';
import { UpdateFoodStatusDto } from './dto/update-food.-status.dto';

// Define the request type with user info from JWT
interface RequestWithRestaurant extends Request {
  user: {
    id: number;
    restaurant_id: number;
    email: string;
  };
}

@Controller('api/kds/foods')
@UseGuards(JwtAuthGuard) // Requires JWT authentication for all routes
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  /**
   * GET /api/kds/foods
   * Get all foods for the authenticated restaurant
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async getAllFoods(@Req() req: RequestWithRestaurant) {
    const restaurantId = req.user.restaurant_id;
    const foods = await this.foodsService.findByRestaurant(restaurantId);

    return {
      success: true,
      data: foods,
      count: foods.length,
    };
  }

  /**
   * GET /api/kds/foods/:id
   * Get a single food item by ID
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getFood(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithRestaurant,
  ) {
    const restaurantId = req.user.restaurant_id;
    const food = await this.foodsService.findOne(id, restaurantId);

    return {
      success: true,
      data: food,
    };
  }

  /**
   * PATCH /api/kds/foods/:id/status
   * Update the status of a food item (toggle availability)
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateFoodStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateFoodStatusDto,
    @Req() req: RequestWithRestaurant,
  ) {
    const restaurantId = req.user.restaurant_id;
    const updatedFood = await this.foodsService.updateStatus(
      id,
      updateStatusDto.status,
      restaurantId,
    );

    return {
      success: true,
      message: `Food ${updatedFood.status === 1 ? 'activated' : 'deactivated'} successfully`,
      data: updatedFood,
    };
  }
}