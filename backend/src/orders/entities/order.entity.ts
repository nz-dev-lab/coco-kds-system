import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { OrderDetail } from './order-detail.entities';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  restaurant_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  user_id: number;

  @Column({ type: 'varchar', length: 191, default: 'pending' })
  order_status: string;

  @Column({ type: 'varchar', length: 191, default: 'delivery' })
  order_type: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  payment_method: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  order_amount: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  processing_time: string;

  @Column({ type: 'text', nullable: true })
  order_note: string;

  @Column({ type: 'text', nullable: true })
  delivery_instruction: string;

  @Column({ type: 'text', nullable: true })
  delivery_address: string;

  // Status timestamps
  @Column({ type: 'timestamp', nullable: true })
  pending: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmed: Date;

  @Column({ type: 'timestamp', nullable: true })
  processing: Date;

  @Column({ type: 'timestamp', nullable: true })
  handover: Date;

  @Column({ type: 'timestamp', nullable: true })
  delivered: Date;

  @Column({ type: 'timestamp', nullable: true })
  schedule_at: Date;

  @Column({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp' })
  updated_at: Date;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  delivery_man_id: number;

  // Relations
  @OneToMany(() => OrderDetail, (detail) => detail.order)
  details: OrderDetail[];
}