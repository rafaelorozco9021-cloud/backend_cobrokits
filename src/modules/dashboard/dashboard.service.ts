import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DashboardService {
  constructor(private dataSource: DataSource) {}

  async overview(sellerId: string) {
    const now = new Date();
    const bogotaDate = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
    const todayDate = bogotaDate.toISOString().split('T')[0];
    const dow = bogotaDate.getDay();

    const target: any[] = await this.dataSource.query(`SELECT get_collection_target($1, $2) as target`, [sellerId, todayDate]);
    const sellers: any[] = await this.dataSource.query('SELECT id, name, email, status FROM sellers ORDER BY name');
    const balances: any[] = await this.dataSource.query(
      `SELECT seller_id, date, total_sales, total_delivered, total_sold, is_closed FROM daily_seller_stock WHERE date = $1`,
      [todayDate],
    );

    const weekStart = new Date(bogotaDate);
    weekStart.setDate(bogotaDate.getDate() - bogotaDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const weekData: any[] = await this.dataSource.query(
      `SELECT 
        d.date,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'efectivo'), 0) as efectivo,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'nequi'), 0) as nequi,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'transferencia'), 0) as transferencia,
        COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'tarjeta'), 0) as tarjeta,
        COALESCE(SUM(p.amount), 0) as total_entrega
       FROM daily_seller_stock d
       LEFT JOIN payments p ON p.seller_id = d.seller_id AND p.created_at::date = d.date
       WHERE d.seller_id = $1 AND d.date BETWEEN $2 AND $3
       GROUP BY d.date
       ORDER BY d.date`,
      [sellerId, weekStart.toISOString(), weekEnd.toISOString()],
    );

    const lowStock: any[] = await this.dataSource.query(
      `SELECT si.product_id, p.name, si.quantity, si.cost_price FROM seller_inventory si JOIN products p ON si.product_id = p.id WHERE si.seller_id = $1 AND si.quantity <= 5`,
      [sellerId],
    );

    return {
      today_date: todayDate,
      dow,
      collection_target: target[0]?.target || 0,
      sellers,
      balances,
      week: weekData,
      lowStock,
    };
  }

  async sellers() {
    return this.dataSource.query('SELECT id, name, email, phone, status FROM sellers ORDER BY name');
  }
}
