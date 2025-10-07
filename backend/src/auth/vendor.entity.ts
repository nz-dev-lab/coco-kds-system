import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('vendors')
export class Vendor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  f_name: string;

  @Column({ nullable: true })
  l_name: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column()
  password: string;

  @Column({ default: 1 })
  status: number;

  @Column({ nullable: true })
  firebase_token: string;
}
