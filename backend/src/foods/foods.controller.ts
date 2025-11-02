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
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'; // ← ADD THIS
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FoodsService } from './foods.service';
import { UpdateFoodStatusDto } from './dto/update-food-status.dto';

// Define the request type with user info from JWT
interface RequestWithRestaurant extends Request {
  user: {
    vendorId: number;
    restaurantId: number;  // ← camelCase to match JWT
    zoneId: number;
    email: string;
    iat: number;
    exp: number;
  };
}

@ApiTags('Foods')           // ← ADD: Groups in Swagger UI
@ApiBearerAuth('JWT-auth')            // ← ADD: Tells Swagger to send Authorization header
@Controller('api/kds/foods')
@UseGuards(JwtAuthGuard)
export class FoodsController {
  constructor(private readonly foodsService: FoodsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all foods for the restaurant' })  // ← ADD
  @ApiResponse({ status: 200, description: 'Returns list of foods' })  // ← ADD
  @ApiResponse({ status: 401, description: 'Unauthorized' })  // ← ADD
  async getAllFoods(@Req() req: RequestWithRestaurant) {
    const restaurantId = req.user.restaurantId; // ← camelCase
    const foods = await this.foodsService.findByRestaurant(restaurantId);

    return {
      success: true,
      data: foods,
      count: foods.length,
    };
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single food item by ID' })  // ← ADD
  @ApiResponse({ status: 200, description: 'Returns food item' })  // ← ADD
  @ApiResponse({ status: 401, description: 'Unauthorized' })  // ← ADD
  @ApiResponse({ status: 404, description: 'Food not found' })  // ← ADD
  async getFood(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: RequestWithRestaurant,
  ) {
    const restaurantId = req.user.restaurantId; // ← camelCase
    const food = await this.foodsService.findOne(id, restaurantId);

    return {
      success: true,
      data: food,
    };
  }

  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update food availability status' })  // ← ADD
  @ApiResponse({ status: 200, description: 'Food status updated successfully' })  // ← ADD
  @ApiResponse({ status: 401, description: 'Unauthorized' })  // ← ADD
  @ApiResponse({ status: 404, description: 'Food not found' })  // ← ADD
  async updateFoodStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateFoodStatusDto,
    @Req() req: RequestWithRestaurant,
  ) {
    const restaurantId = req.user.restaurantId; // ← camelCase
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