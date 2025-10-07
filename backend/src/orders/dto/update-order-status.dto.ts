import { IsIn, IsOptional, IsString, MaxLength, IsNumber } from 'class-validator';

export class UpdateOrderStatusDto {
  @IsIn(['confirmed', 'processing', 'handover'])
  order_status: 'confirmed' | 'processing' | 'handover';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  processing_time?: string;

  @IsOptional()
  @IsNumber()
  delivery_man_id?: number;
}