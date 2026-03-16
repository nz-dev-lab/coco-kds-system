import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('delivery_histories')
export class DeliveryHistory {
  @PrimaryGeneratedColumn({ type: 'bigint', unsigned: true })
  id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  order_id: number;

  @Column({ type: 'bigint', unsigned: true, nullable: true })
  delivery_man_id: number;

  @Column({ type: 'datetime', nullable: true })
  time: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  longitude: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  latitude: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string;

  @UpdateDateColumn({ type: 'timestamp', nullable: true })
  updated_at: Date;
}
