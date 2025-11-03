import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Food } from './entities/food.entity';

@Injectable()
export class FoodsService {
  private readonly logger =  new Logger(FoodsService.name);
  constructor(
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
  ) {}

  /**
   * Get all foods for a specific restaurant
   * @param restaurantId - The ID of the restaurant
   * @returns Array of Food entities
   */
  async findByRestaurant(restaurantId: number): Promise<Food[]> {
    return this.foodRepository.find({
      where: { restaurant_id: restaurantId },
      order: { name: 'ASC' },
      select: [
        'id',
        'name',
        'restaurant_id',
        'status',
        'image',
        'price',
        'description',
        'category_id',
        'discount',
        'discount_type',
        'veg',
        'recommended',
        'available_time_starts',
        'available_time_ends',
      ],
    });
  }

  /**
   * Update the status of a food item
   * @param foodId - The ID of the food item
   * @param status - The new status (0 or 1)
   * @param restaurantId - The ID of the restaurant (for security check)
   * @throws NotFoundException if food doesn't exist
   * @throws ForbiddenException if food doesn't belong to restaurant
   */
async updateStatus(
  foodId: number,
  status: number,
  restaurantId: number,
): Promise<Food> {
  // First, find the food item
  const food = await this.foodRepository.findOne({
    where: { id: foodId },
  });

  // Check if food exists
  if (!food) {
    throw new NotFoundException(`Food item with ID ${foodId} not found`);
  }

  // Convert both to numbers explicitly for comparison
  const foodRestaurantId = Number(food.restaurant_id);
  const requestRestaurantId = Number(restaurantId);

  // Add debug logging
  this.logger.log(
    `Comparing restaurants: food.restaurant_id=${foodRestaurantId} (${typeof foodRestaurantId}), ` +
    `restaurantId=${requestRestaurantId} (${typeof requestRestaurantId}), ` +
    `equal=${foodRestaurantId === requestRestaurantId}`
  );

  // Security check: Ensure food belongs to this restaurant
  if (foodRestaurantId !== requestRestaurantId) {
    this.logger.warn(
      `Restaurant ${requestRestaurantId} attempted to modify food ${foodId} belonging to restaurant ${foodRestaurantId}`
    );
    throw new ForbiddenException(
      'You do not have permission to modify this food item',
    );
  }

  // Update the status
  const result = await this.foodRepository.update(
    { id: foodId, restaurant_id: restaurantId },
    { status },
  );

  // Check if update was successful
  if (result.affected === 0) {
    throw new NotFoundException(
      `Failed to update food item with ID ${foodId}`,
    );
  }

  // Return the updated food item
  const updatedFood = await this.foodRepository.findOne({ 
    where: { id: foodId } 
  });

  if (!updatedFood) {
    throw new NotFoundException(
      `Food item with ID ${foodId} not found after update`,
    );
  }

  return updatedFood;
}
  /**
   * Get a single food item by ID
   * @param foodId - The ID of the food item
   * @param restaurantId - The ID of the restaurant (for security check)
   * @throws NotFoundException if food doesn't exist
   * @throws ForbiddenException if food doesn't belong to restaurant
   */
  async findOne(foodId: number, restaurantId: number): Promise<Food> {
    const food = await this.foodRepository.findOne({
      where: { id: foodId },
    });

    if (!food) {
      throw new NotFoundException(`Food item with ID ${foodId} not found`);
    }

    // Convert both to numbers explicitly for comparison
  const foodRestaurantId = Number(food.restaurant_id);
  const requestRestaurantId = Number(restaurantId);

    // Security check: Ensure food belongs to this restaurant
    if (foodRestaurantId !== requestRestaurantId) {
      throw new ForbiddenException(
        'You do not have permission to view this food item',
      );
    }

    return food;
  }
}