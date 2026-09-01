import { Injectable, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { sign } from 'jsonwebtoken';

@Injectable()
export class AuthService {
  constructor(private dataSource: DataSource) {}

  private get jwtSecret() {
    return process.env.JWT_SECRET || 'cobrokits-jwt-secret-change-in-production';
  }

  async login(email: string, password: string) {
    const rows: any[] = await this.dataSource.query('SELECT * FROM sellers WHERE email = $1', [email]);
    if (rows.length === 0) throw new UnauthorizedException('Credenciales inválidas');

    const user = rows[0];
    // Si no hay password_hash (seed viejo), comparar con ADMIN_PASSWORD como fallback o rechazar
    if (!user.password_hash) {
      if (password !== process.env.ADMIN_PASSWORD) throw new UnauthorizedException('Credenciales inválidas');
    } else {
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) throw new UnauthorizedException('Credenciales inválidas');
    }

    const token = sign({ userId: user.id, role: user.role || 'seller' }, this.jwtSecret, { expiresIn: '7d' });
    return {
      user: { id: user.id, name: user.name, role: user.role || 'seller' },
      token,
    };
  }

  async listSellers() {
    return this.dataSource.query('SELECT id, name, email, phone, status FROM sellers ORDER BY name');
  }

  async todayStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rows: any[] = await this.dataSource.query(
      `SELECT 
        COUNT(s.id) FILTER (WHERE s.status = 'active') as active_sellers,
        COALESCE(SUM(d.total_sales), 0) as total_sales,
        COALESCE(SUM(d.total_delivered), 0) as total_delivered,
        COALESCE(SUM(d.total_sold), 0) as total_sold
       FROM sellers s
       LEFT JOIN daily_seller_stock d ON s.id = d.seller_id AND d.date = $1
       WHERE s.status = 'active'`,
      [today.toISOString()],
    );
    return rows[0];
  }

  async weekStats(sellerId: string) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return this.dataSource.query(
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
  }

  async lowStock(sellerId: string | null) {
    return this.dataSource.query(
      `SELECT si.product_id, p.name, si.quantity, si.cost_price
       FROM seller_inventory si
       JOIN products p ON si.product_id = p.id
       WHERE si.seller_id = $1 AND si.quantity <= 5`,
      [sellerId],
    );
  }

  async createSeller(body: { name: string; email: string; phone?: string }) {
    const rows: any[] = await this.dataSource.query(
      `INSERT INTO sellers (name, email, phone, status) VALUES ($1, $2, $3, 'active') RETURNING id, name, email, phone, status`,
      [body.name, body.email, body.phone || ''],
    );
    return rows[0];
  }

  async updateSeller(id: string, body: { name: string; email: string; phone: string }) {
    await this.dataSource.query(
      `UPDATE sellers SET name = $1, email = $2, phone = $3, updated_at = NOW() WHERE id = $4`,
      [body.name, body.email, body.phone, id],
    );
    return { id, ...body };
  }

  async closeDay(id: string, date: string) {
    const rows: any[] = await this.dataSource.query(`SELECT * FROM close_seller_day($1, $2)`, [id, date]);
    return rows[0];
  }
}
