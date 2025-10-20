import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('admin_wallets')
export class AdminWallet {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true })
  admin_id: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  total_commission_earning: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  digital_received: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  manual_received: number;

  @Column({ type: 'decimal', precision: 24, scale: 2, default: 0 })
  delivery_charge: number;

  @Column({ type: 'timestamp', nullable: true })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date;
}