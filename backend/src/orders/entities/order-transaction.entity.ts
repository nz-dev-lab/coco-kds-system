import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('order_transactions')
export class OrderTransaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true })
  vendor_id: number;

  @Column({ nullable: true })
  delivery_man_id: number;

  @Column()
  order_id: number;

  @Column({ type: 'decimal', precision: 24, scale: 2 })
  order_amount: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  restaurant_amount: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  admin_commission: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  delivery_charge: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  original_delivery_charge: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  tax: number;

  @Column({ nullable: true })
  received_by: string; // 'restaurant', 'admin', 'deliveryman'

  @Column({ nullable: true })
  zone_id: number;

  @Column({ nullable: true })
  status: string; // 'approved', 'pending', etc.

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  dm_tips: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  delivery_fee_comission: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  admin_expense: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  restaurant_expense: number;

  @Column({ type: 'tinyint', default: 0 })
  is_subscribed: number; // 0 or 1

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  commission_percentage: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  discount_amount_by_restaurant: number;

  @Column({ type: 'tinyint', default: 0 })
  is_subscription: number; // 0 or 1

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  additional_charge: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  extra_packaging_amount: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  ref_bonus_amount: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}