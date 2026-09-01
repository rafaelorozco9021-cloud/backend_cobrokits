import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('warehouse_stock')
export class WarehouseStock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'total_quantity', type: 'int', default: 0 })
  totalQuantity: number;

  @Column({ name: 'reserved_quantity', type: 'int', default: 0 })
  reservedQuantity: number;

  // available_quantity is GENERATED ALWAYS AS (total_quantity - reserved_quantity) STORED, read-only
  @Column({ name: 'available_quantity', type: 'int', insert: false, update: false, select: true })
  availableQuantity: number;

  @Column({ name: 'last_restock', type: 'date', nullable: true })
  lastRestock: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
