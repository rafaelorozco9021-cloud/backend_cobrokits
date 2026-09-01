import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('customer_visit_items')
export class CustomerVisitItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visit_id', type: 'uuid' })
  visitId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'numeric', precision: 14, scale: 2 })
  unitPrice: string;

  // total_price is GENERATED ALWAYS AS (unit_price * quantity) STORED
  @Column({ name: 'total_price', type: 'numeric', precision: 14, scale: 2, insert: false, update: false })
  totalPrice: string;
}
