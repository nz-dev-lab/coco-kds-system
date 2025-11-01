import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('food')
export class Food {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 191 })
  name: string;

  @Column({ type: 'int' })
  restaurant_id: number;

  @Column({ type: 'int', default: 1 })
  status: number; // 1 = active/available, 0 = inactive/unavailable

  @Column({ type: 'varchar', length: 255, nullable: true })
  image: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'int', nullable: true })
  category_id: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  discount: number;

  @Column({ type: 'varchar', length: 15, default: 'percent' })
  discount_type: string; // 'percent' or 'amount'

  @Column({ type: 'int', default: 0 })
  veg: number; // 0 = non-veg, 1 = veg

  @Column({ type: 'int', default: 0 })
  recommended: number; // 0 = not recommended, 1 = recommended

  @Column({ type: 'time', nullable: true })
  available_time_starts: string;

  @Column({ type: 'time', nullable: true })
  available_time_ends: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date;
}