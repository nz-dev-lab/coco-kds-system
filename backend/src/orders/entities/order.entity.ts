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

  // ✨ ADD THIS
  @Column({ type: 'varchar', length: 191, default: 'unpaid' })
  payment_status: string;

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

  // ✨ ADD THESE PAYMENT/FEE FIELDS
  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  delivery_charge: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  original_delivery_charge: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  total_tax_amount: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  coupon_discount_amount: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  restaurant_discount_amount: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  additional_charge: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  extra_packaging_amount: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  dm_tips: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  ref_bonus_amount: string;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  partially_paid_amount: string;

  // ✨ ADD THESE METADATA FIELDS
  @Column({ type: 'varchar', length: 191, nullable: true })
  coupon_created_by: string; // 'admin' or 'vendor'

  @Column({ type: 'varchar', length: 191, nullable: true })
  free_delivery_by: string; // 'admin' or 'vendor'

  @Column({ type: 'varchar', length: 191, nullable: true })
  discount_on_product_by: string; // 'admin' or 'vendor'

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  subscription_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  zone_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  delivery_man_id: number;

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
  picked_up: Date;  // ✨ ADD THIS (for DM picked up status)

  @Column({ type: 'timestamp', nullable: true })
  schedule_at: Date;

  @Column({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp' })
  updated_at: Date;

  // Relations
  @OneToMany(() => OrderDetail, (detail) => detail.order)
  details: OrderDetail[];
}