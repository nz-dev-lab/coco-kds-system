import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('order_payments')
export class OrderPayment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  order_id: number;

  @Column({ type: 'decimal', precision: 24, scale: 2 })
  amount: number;

  @Column()
  payment_method: string; // 'cash_on_delivery', 'digital_payment', etc.

  @Column({ default: 'unpaid' })
  payment_status: string; // 'paid' or 'unpaid'

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}