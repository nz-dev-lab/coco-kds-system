import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_wallets')
export class AdminWallet {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  admin_id: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  total_commission_earning: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  digital_received: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  manual_received: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  delivery_charge: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  total_withdrawn: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  pending_withdraw: number;

  @Column({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp' })
  updated_at: Date;
}