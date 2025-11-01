import { IsInt, IsIn } from 'class-validator';

export class UpdateFoodStatusDto {
  @IsInt({ message: 'Status must be an integer' })
  @IsIn([0, 1], { message: 'Status must be either 0 (inactive) or 1 (active)' })
  status: number;
}