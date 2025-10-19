import { IsIn, IsOptional, IsString, MaxLength, IsNumber } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['confirmed', 'processing', 'handover', 'delivered'])
  order_status: 'confirmed' | 'processing' | 'handover' | 'delivered';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  processing_time?: string;

  @IsOptional()
  @IsNumber()
  delivery_man_id?: number;
}