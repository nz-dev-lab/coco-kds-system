import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Data Transfer Object for creating a notification
 * Validates input from restaurant users
 */
export class CreateNotificationDto {
  @ApiProperty({
    description: 'Notification title',
    example: '20% Off All Pizzas Tonight!',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Title is required' })
  @MaxLength(100, { message: 'Title must be 100 characters or less' })
  title: string;

  @ApiProperty({
    description: 'Notification message body',
    example: 'Order now and get 20% off all pizzas. Limited time offer! Use code: PIZZA20',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty({ message: 'Description is required' })
  @MaxLength(500, { message: 'Description must be 500 characters or less' })
  description: string;

  @ApiPropertyOptional({
    description: 'Notification image (optional)',
    type: 'string',
    format: 'binary',
  })
  @IsOptional()
  image?: Express.Multer.File;
}