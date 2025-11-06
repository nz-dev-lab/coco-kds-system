import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Business Settings Entity
 * Maps to Laravel's business_settings table
 * 
 * This table stores various configuration settings including:
 * - Firebase credentials
 * - Payment gateway configs
 * - App settings
 * - Feature flags
 */
@Entity('business_settings')
export class BusinessSetting {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 191 })
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;

  @Column({ type: 'timestamp', nullable: true })
  created_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  updated_at: Date | null;
}