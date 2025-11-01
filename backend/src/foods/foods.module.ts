import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FoodsController } from './foods.controller';
import { FoodsService } from './foods.service';
import { Food } from './entities/food.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Food]), // Register Food entity
  ],
  controllers: [FoodsController],
  providers: [FoodsService],
  exports: [FoodsService], // Export in case other modules need it
})
export class FoodsModule {}