import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

@Entity('order_details')
export class OrderDetail {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  order_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  food_id: number;

  @Column({ type: 'text', nullable: true })
  food_details: string; // JSON: {id, name, description, image}

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  price: string;

  @Column({ type: 'text', nullable: true })
  variation: string; // JSON array of variations

  @Column({ type: 'text', nullable: true })
  add_ons: string; // JSON array of add-ons

  @Column({ type: 'varchar', length: 191, nullable: true })
  variant: string; // Selected variant string

  @Column({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp' })
  updated_at: Date;

  @ManyToOne(() => Order, (order) => order.details)
  @JoinColumn({ name: 'order_id' })
  order: Order;
}