import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('delivery_men')
export class DeliveryMan {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  f_name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  l_name: string;

  @Column({ type: 'varchar', length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  image: string;

  @Column({ type: 'bigint', nullable: true })
  restaurant_id: number;

  @Column({ type: 'bigint', nullable: true })
  zone_id: number;

  @Column({ type: 'tinyint', default: 1 })
  status: number; // 1 = active, 0 = inactive

  @Column({ type: 'tinyint', default: 1 })
  active: number; // 1 = online, 0 = offline

  @Column({ 
    type: 'enum', 
    enum: ['approved', 'denied', 'pending'], 
    default: 'approved' 
  })
  application_status: string;

  @Column({ type: 'int', default: 0 })
  current_orders: number;

  @Column({ type: 'int', unsigned: true, default: 0 })
  assigned_order_count: number;

  @Column({ type: 'varchar', length: 191, default: 'zone_wise' })
  type: string; // zone_wise or restaurant_wise
}