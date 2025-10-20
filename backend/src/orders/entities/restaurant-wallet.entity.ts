import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('restaurant_wallets')
export class RestaurantWallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  vendor_id: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  total_earning: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  total_withdrawn: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  pending_withdraw: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  collected_cash: number;

  @Column({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp' })
  updated_at: Date;
}