import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Unique } from 'typeorm';

@Entity('daily_seller_stock')
@Unique(['sellerId', 'date'])
export class DailySellerStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'seller_id', type: 'uuid' })
  sellerId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ name: 'is_closed', type: 'boolean', default: false })
  isClosed: boolean;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @Column({ name: 'total_cash', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalCash: string;

  @Column({ name: 'total_nequi', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalNequi: string;

  @Column({ name: 'total_sales', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalSales: string;

  @Column({ name: 'total_delivered', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalDelivered: string;

  @Column({ name: 'total_sold', type: 'numeric', precision: 14, scale: 2, default: 0 })
  totalSold: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
