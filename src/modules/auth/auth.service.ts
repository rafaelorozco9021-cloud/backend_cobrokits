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
    // Fallback maestro: ADMIN_PASSWORD permite login sin DB (para demo/seed vacío)
    if (password === process.env.ADMIN_PASSWORD) {
      try {
        const rows: any[] = await this.dataSource.query('SELECT * FROM cobrokits.sellers WHERE email = $1', [email]);
        if (rows.length > 0) {
          const u = rows[0];
          const token = sign({ userId: u.id, role: u.role || 'admin' }, this.jwtSecret, { expiresIn: '7d' });
          return { user: { id: u.id, name: u.name, role: u.role || 'admin' }, token };
        }
      } catch (e) {
        // si la columna email no existe, ignorar
      }
      // usuario maestro sin depender de DB
      const token = sign({ userId: 'admin', role: 'admin' }, this.jwtSecret, { expiresIn: '7d' });
      return { user: { id: 'admin', name: 'Admin', role: 'admin' }, token };
    }

    try {
      const rows: any[] = await this.dataSource.query('SELECT * FROM cobrokits.sellers WHERE email = $1', [email]);
      if (rows.length === 0) throw new UnauthorizedException('Credenciales inválidas');
      const user = rows[0];
      if (user.role === 'empresa' && user.trial_end) {
        const now = new Date(); const trialEnd = new Date(user.trial_end);
        if (now > trialEnd && user.subscription_status === 'trialing') throw new UnauthorizedException('TRIAL_EXPIRED: Tu mes gratis ha terminado. Elige un plan para continuar.');
      }
      if (user.role === 'seller' && user.empresa_id) {
        try {
          const emp: any[] = await this.dataSource.query('SELECT trial_end, subscription_status FROM cobrokits.sellers WHERE id=$1', [user.empresa_id]);
          if (emp.length && emp[0].trial_end && emp[0].subscription_status === 'trialing') {
            const now = new Date(); const trialEnd = new Date(emp[0].trial_end);
            if (now > trialEnd) throw new UnauthorizedException('TRIAL_EXPIRED: El mes gratis de tu empresa ha terminado. Pide al admin que elija un plan.');
          }
        } catch (e) { if (e instanceof UnauthorizedException) throw e; }
      }
      const hash = user.password_hash || user.password;
      if (!hash) throw new UnauthorizedException('Credenciales inválidas');
      const valid = hash.startsWith('$2') ? await bcrypt.compare(password, hash) : password === hash;
      if (!valid) throw new UnauthorizedException('Credenciales inválidas');
      const token = sign({ userId: user.id, role: user.role || 'seller' }, this.jwtSecret, { expiresIn: '7d' });
      return { user: { id: user.id, name: user.name, role: user.role || 'seller', plan: user.plan, trial_end: user.trial_end, subscription_status: user.subscription_status }, token };
    } catch (e: any) {
      if (e instanceof UnauthorizedException) throw e;
      // si es error de columna faltante (42703), intentar por phone
      if (e.code === '42703') {
        try {
          const rows2: any[] = await this.dataSource.query('SELECT * FROM cobrokits.sellers WHERE phone = $1', [email]);
          if (rows2.length === 0) throw new UnauthorizedException('Credenciales inválidas');
          const user = rows2[0];
          if (user.role === 'empresa' && user.trial_end) {
            const now = new Date(); const trialEnd = new Date(user.trial_end);
            if (now > trialEnd && user.subscription_status === 'trialing') throw new UnauthorizedException('TRIAL_EXPIRED: Tu mes gratis ha terminado. Elige un plan para continuar.');
          }
          if (password !== user.password && !(user.password_hash && await bcrypt.compare(password, user.password_hash))) {
            throw new UnauthorizedException('Credenciales inválidas');
          }
          const token = sign({ userId: user.id, role: user.role || 'seller' }, this.jwtSecret, { expiresIn: '7d' });
          return { user: { id: user.id, name: user.name, role: user.role || 'seller', plan: user.plan, trial_end: user.trial_end, subscription_status: user.subscription_status }, token };
        } catch (e2) {
          if (e2 instanceof UnauthorizedException) throw e2;
          throw new UnauthorizedException('Credenciales inválidas');
        }
      }
      throw new UnauthorizedException('Credenciales inválidas');
    }
  }

  async listSellers() {
    try {
      return await this.dataSource.query(`SELECT id, name, email, phone, status, role, empresa_id FROM cobrokits.sellers WHERE role = 'seller' ORDER BY name`);
    } catch {
      return this.dataSource.query(`SELECT id, name, phone, status FROM cobrokits.sellers WHERE role = 'seller' ORDER BY name`);
    }
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
       FROM cobrokits.sellers s
       LEFT JOIN cobrokits.daily_seller_stock d ON s.id = d.seller_id AND d.date = $1
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
       FROM cobrokits.daily_seller_stock d
       LEFT JOIN cobrokits.payments p ON p.seller_id = d.seller_id AND p.created_at::date = d.date
       WHERE d.seller_id = $1 AND d.date BETWEEN $2 AND $3
       GROUP BY d.date
       ORDER BY d.date`,
      [sellerId, weekStart.toISOString(), weekEnd.toISOString()],
    );
  }

  async lowStock(sellerId: string | null) {
    return this.dataSource.query(
      `SELECT si.product_id, p.name, si.quantity, si.cost_price
       FROM cobrokits.seller_inventory si
       JOIN cobrokits.products p ON si.product_id = p.id
       WHERE si.seller_id = $1 AND si.quantity <= 5`,
      [sellerId],
    );
  }

  async createSeller(body: { name: string; email: string; phone?: string; role?: string; password?: string; plan?: string }) {
    const role = body.role || 'seller';
    const plan = body.plan || 'un_mes_gratis';
    const passwordHash = body.password ? await bcrypt.hash(body.password, 10) : null;
    // Primera empresa siempre entra con 1 mes gratis fijo
    const isEmpresaTrial = role === 'empresa';
    const trialStart = new Date();
    const trialEnd = new Date(); trialEnd.setDate(trialEnd.getDate() + 30);
    try {
      const rows: any[] = await this.dataSource.query(
        `INSERT INTO cobrokits.sellers (name, email, phone, status, role, password_hash, trial_start, trial_end, subscription_status, plan) VALUES ($1, $2, $3, 'active', $4, $5, $6, $7, $8, $9) RETURNING id, name, email, phone, status, role, trial_end, plan`,
        [body.name, body.email, body.phone || '', role, passwordHash, trialStart.toISOString(), isEmpresaTrial ? trialEnd.toISOString() : null, isEmpresaTrial ? 'trialing' : 'active', isEmpresaTrial ? 'un_mes_gratis' : plan],
      );
      const newId = rows[0].id;
      if (role === 'empresa') {
        try {
          const schema = `empresa_${newId.replace(/-/g, '').slice(0, 8)}`;
          await this.dataSource.query(`INSERT INTO public.tenants (id, slug, schema_name, name, trial_start, trial_end, subscription_status, plan) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO UPDATE SET trial_end=EXCLUDED.trial_end`, [newId, schema, schema, body.name, trialStart.toISOString(), trialEnd.toISOString(), 'trialing', 'un_mes_gratis']);
          const exists = await this.dataSource.query(`SELECT 1 FROM information_schema.schemata WHERE schema_name=$1`, [schema]);
          if (!exists.length) {
            await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
            const tables: any[] = await this.dataSource.query(`SELECT tablename FROM pg_tables WHERE schemaname='cobrokits'`);
            for (const r of tables) {
              const tbl = r.tablename;
              const ex = await this.dataSource.query(`SELECT 1 FROM pg_tables WHERE schemaname=$1 AND tablename=$2`, [schema, tbl]);
              if (!ex.length) await this.dataSource.query(`CREATE TABLE ${schema}.${tbl} (LIKE cobrokits.${tbl} INCLUDING ALL)`).catch(()=>{});
            }
          }
        } catch (e) { console.error('provision tenant failed', e); }
      }
      return rows[0];
    } catch (e) {
      const rows: any[] = await this.dataSource.query(
        `INSERT INTO cobrokits.sellers (name, phone, status, role, password_hash, trial_start, trial_end, subscription_status, plan) VALUES ($1, $2, 'active', $4, $5, $6, $7, $8, $9) RETURNING id, name, phone, status, role`,
        [body.name, body.phone || '', role, passwordHash, trialStart.toISOString(), isEmpresaTrial ? trialEnd.toISOString() : null, isEmpresaTrial ? 'trialing' : 'active', isEmpresaTrial ? 'un_mes_gratis' : plan],
      );
      return rows[0];
    }
  }

  async updateSeller(id: string, body: { name: string; email: string; phone: string }) {
    try {
      await this.dataSource.query(
        `UPDATE cobrokits.sellers SET name = $1, email = $2, phone = $3, updated_at = NOW() WHERE id = $4`,
        [body.name, body.email, body.phone, id],
      );
    } catch {
      await this.dataSource.query(
        `UPDATE cobrokits.sellers SET name = $1, phone = $2, updated_at = NOW() WHERE id = $3`,
        [body.name, body.phone, id],
      );
    }
    return { id, ...body };
  }

  async closeDay(id: string, date: string) {
    const rows: any[] = await this.dataSource.query(`SELECT * FROM cobrokits.close_seller_day($1, $2)`, [id, date]);
    return rows[0];
  }
}

