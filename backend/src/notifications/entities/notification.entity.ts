import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * Notification Entity
 * Maps to Laravel's notifications table
 * 
 * Stores notifications sent by admins or restaurants to:
 * - Customers
 * - Delivery men
 * - Restaurants
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'varchar', length: 191, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  image: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  status: number; // 1 = active, 0 = inactive

  @CreateDateColumn({ type: 'timestamp', nullable: true })
  created_at: Date | null;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at: Date | null;

  /**
   * Target audience for notification
   * Values: 'customer', 'deliveryman', 'restaurant'
   * 
   * Note: 'tergat' is misspelled in Laravel table (should be 'target')
   * We keep the same spelling for compatibility
   */
  @Column({ type: 'varchar', length: 191, nullable: true })
  tergat: string | null;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  zone_id: number | null;

  /**
   * Restaurant ID - identifies which restaurant sent this notification
   * This is the NEW column we need to add to Laravel's table
   * 
   * NULL = sent by admin
   * NOT NULL = sent by restaurant
   */
  @Column({ type: 'bigint', unsigned: true, nullable: true })
  restaurant_id: number | null;
}