import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getEmpresaIdForUser, getUserIdFromRequest, getTargetSellerIds, getSchemaFromRequest } from '../../common/helpers/empresa.helper';

@Controller('api/inventory')
export class InventoryController {
  constructor(private dataSource: DataSource) {}

  @Get('summary')
  async summary(@Query('sellerId') sellerId: string, @Query('date') date?: string) {
    try {
      if (!sellerId) return { success: false, error: 'sellerId requerido' };
      const d = date || new Date().toISOString().split('T')[0];
      const assigned: any[] = await this.dataSource.query(
        `SELECT product_id, COALESCE(SUM(quantity),0)::int as asignado FROM cobrokits.inventory_movements WHERE seller_id=$1 AND type='entry' AND created_at::date=$2::date AND reason LIKE 'Entrega cobro%' GROUP BY product_id`,
        [sellerId, d]
      );
      const sold: any[] = await this.dataSource.query(
        `SELECT cvi.product_id, COALESCE(SUM(cvi.quantity),0)::int as vendido
         FROM cobrokits.customer_visit_items cvi
         JOIN cobrokits.customer_visits cv ON cv.id=cvi.visit_id
         WHERE cv.seller_id=$1 AND cv.visit_date::date=$2::date
         GROUP BY cvi.product_id`,
        [sellerId, d]
      );
      const remaining: any[] = await this.dataSource.query(
        `SELECT product_id, quantity::int as resto, cost_price FROM cobrokits.seller_inventory WHERE seller_id=$1`,
        [sellerId]
      );
      const map = new Map<string, any>();
      for (const a of assigned) map.set(a.product_id, { product_id: a.product_id, asignado: Number(a.asignado), vendido: 0, resto: 0 });
      for (const s of sold) {
        const cur = map.get(s.product_id) || { product_id: s.product_id, asignado: 0, vendido: 0, resto: 0 };
        cur.vendido = Number(s.vendido);
        map.set(s.product_id, cur);
      }
      for (const r of remaining) {
        const cur = map.get(r.product_id) || { product_id: r.product_id, asignado: 0, vendido: 0, resto: 0 };
        cur.resto = Number(r.resto);
        cur.cost_price = r.cost_price;
        map.set(r.product_id, cur);
      }
      // si no hay resto pero hubo asignado, calcular resto = asignado - vendido
      for (const [k, v] of map.entries()) {
        if (v.resto === 0 && v.asignado > 0 && v.vendido > 0) {
          // resto ya está en seller_inventory (debería ser asignado - vendido si no hubo cierre)
          // si no hay fila en seller_inventory (fue cerrado), resto queda 0 correctamente
        }
        if (v.asignado === 0 && v.resto > 0) v.asignado = v.resto + v.vendido;
      }
      return Array.from(map.values()).filter(v => v.asignado > 0 || v.vendido > 0 || v.resto > 0);
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Get()
  async list(@Query('sellerId') sellerId?: string, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req);
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      // Tablas sin dual-write viven en cobrokits: preferir schema tenant si tiene datos,
      // si no, caer a cobrokits filtrado por empresa (nunca global).
      if (schema) {
        const rows: any[] = sellerId
          ? await this.dataSource.query(`SELECT * FROM ${schema}.seller_inventory WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100`, [sellerId])
          : await this.dataSource.query(`SELECT * FROM ${schema}.seller_inventory ORDER BY created_at DESC LIMIT 100`);
        if (rows.length > 0) return rows;
        if (!empresaId) return rows; // schema vacío y sin empresa: no exponer global
      }
      if (empresaId) {
        if (sellerId) {
          const allowed = await getTargetSellerIds(this.dataSource, userId as string);
          if (!allowed.includes(sellerId)) return [];
          return this.dataSource.query('SELECT * FROM cobrokits.seller_inventory WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100', [sellerId]);
        }
        const ids = await getTargetSellerIds(this.dataSource, userId as string);
        return this.dataSource.query('SELECT * FROM cobrokits.seller_inventory WHERE seller_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 100', [ids]);
      }
      // fail-closed: sin tenant ni empresa no exponer inventario global
      return [];
    } catch (e) {
      return { stub: true, module: 'inventory', table: 'seller_inventory', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any, @Req() req?: any) {
    try {
      const sellerId = body.seller_id || body.sellerId;
      const cobroId = body.cobro_id || body.cobroId || null;
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (empresaId) {
        const allowed = await getTargetSellerIds(this.dataSource, userId as string);
        if (!allowed.includes(sellerId)) return { success: false, error: 'Vendedor no pertenece a tu empresa' };
        // validar productos pertenecen a empresa
        let itemsCheck: any[] = [];
        if (Array.isArray(body.items) && body.items.length) itemsCheck = body.items;
        else if (body.product_id) itemsCheck = [{ product_id: body.product_id }];
        for (const it of itemsCheck) {
          const pr: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.products WHERE id=$1', [it.product_id]);
          if (pr.length && pr[0].empresa_id && pr[0].empresa_id !== empresaId) return { success: false, error: `Producto ${it.product_id} no pertenece a tu empresa` };
        }
      }
      // batch: body.items = [{product_id, quantity, cost_price?}]
      let items: any[] = [];
      if (Array.isArray(body.items) && body.items.length) items = body.items;
      else if (body.product_id) items = [{ product_id: body.product_id, quantity: Number(body.quantity || 0), cost_price: body.cost_price }];
      else return { success: false, error: 'items o product_id requerido' };
      if (!sellerId) return { success: false, error: 'seller_id requerido' };

      const results: any[] = [];
      for (const it of items) {
        const qty = Number(it.quantity || 0);
        if (!it.product_id || qty <= 0) continue;
        const prod: any[] = await this.dataSource.query('SELECT cost_price, price FROM cobrokits.products WHERE id=$1', [it.product_id]);
        const cost = it.cost_price ?? prod[0]?.cost_price ?? 0;
        // upsert seller_inventory
        await this.dataSource.query(
          `INSERT INTO cobrokits.seller_inventory (seller_id, product_id, quantity, cost_price)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (seller_id, product_id) DO UPDATE SET quantity = cobrokits.seller_inventory.quantity + EXCLUDED.quantity, cost_price = EXCLUDED.cost_price, updated_at = NOW()`,
          [sellerId, it.product_id, qty, cost]
        );
        // descontar de warehouse_stock
        await this.dataSource.query(
          `UPDATE cobrokits.warehouse_stock SET total_quantity = GREATEST(0, total_quantity - $2), updated_at = NOW() WHERE product_id = $1`,
          [it.product_id, qty]
        ).catch(() => {});
        // registrar movimiento
        await this.dataSource.query(
          `INSERT INTO cobrokits.inventory_movements (seller_id, product_id, type, quantity, reason)
           VALUES ($1,$2,'entry',$3,$4)`,
          [sellerId, it.product_id, qty, cobroId ? `Entrega cobro ${cobroId}` : 'Entrega inventario diario']
        ).catch(() => {});
        // asegurar daily_seller_stock existe para hoy y reabrir si estaba cerrado
        const today = new Date().toISOString().split('T')[0];
        await this.dataSource.query(
          `INSERT INTO cobrokits.daily_seller_stock (seller_id, date, is_closed) VALUES ($1,$2,FALSE) ON CONFLICT (seller_id, date) DO UPDATE SET is_closed=FALSE, closed_at=NULL`,
          [sellerId, today]
        ).catch(async () => {
          await this.dataSource.query(`UPDATE cobrokits.daily_seller_stock SET is_closed=FALSE, closed_at=NULL WHERE seller_id=$1 AND date=$2`, [sellerId, today]).catch(()=>{});
        });
        results.push({ product_id: it.product_id, quantity: qty });
      }
      return { success: true, delivered: results.length, items: results, seller_id: sellerId, cobro_id: cobroId };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Post('close')
  async close(@Body() body: any) {
    try {
      const sellerId = body.seller_id || body.sellerId;
      if (!sellerId) return { success: false, error: 'seller_id requerido' };
      const today = new Date().toISOString().split('T')[0];
      const inv: any[] = await this.dataSource.query('SELECT product_id, quantity, cost_price FROM cobrokits.seller_inventory WHERE seller_id=$1 AND quantity > 0', [sellerId]);
      let totalReturned = 0;
      let totalLlevado = 0;
      // calcular lo llevado hoy desde movements (solo entregas diarias, no asignación inicial seed)
      try {
        const mov: any[] = await this.dataSource.query(
          `SELECT COALESCE(SUM(quantity),0) as sum FROM cobrokits.inventory_movements WHERE seller_id=$1 AND type='entry' AND created_at::date=$2 AND reason LIKE 'Entrega cobro%'`,
          [sellerId, today]
        );
        totalLlevado = Number(mov[0]?.sum || 0);
      } catch {}
      for (const row of inv) {
        const qty = Number(row.quantity || 0);
        if (qty <= 0) continue;
        await this.dataSource.query('UPDATE cobrokits.warehouse_stock SET total_quantity = total_quantity + $2, updated_at=NOW() WHERE product_id=$1', [row.product_id, qty]).catch(() => {});
        await this.dataSource.query(
          `INSERT INTO cobrokits.inventory_movements (seller_id, product_id, type, quantity, reason) VALUES ($1,$2,'exit',$3,$4)`,
          [sellerId, row.product_id, qty, 'Devolución cierre día']
        ).catch(() => {});
        totalReturned += qty;
      }
      await this.dataSource.query('UPDATE cobrokits.seller_inventory SET quantity=0, updated_at=NOW() WHERE seller_id=$1', [sellerId]);
      await this.dataSource.query(`UPDATE cobrokits.daily_seller_stock SET is_closed=TRUE, closed_at=NOW() WHERE seller_id=$1 AND date=$2`, [sellerId, today]).catch(() => {});
      // si no existe daily row, crearla cerrada
      await this.dataSource.query(`INSERT INTO cobrokits.daily_seller_stock (seller_id, date, is_closed, closed_at) VALUES ($1,$2,TRUE,NOW()) ON CONFLICT (seller_id, date) DO UPDATE SET is_closed=TRUE, closed_at=NOW()`, [sellerId, today]).catch(() => {});
      return { success: true, llevado: totalLlevado, devuelto: totalReturned, vendido: Math.max(0, totalLlevado - totalReturned), seller_id: sellerId, date: today };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Patch()
  async update(@Body() body: any) {
    return { stub: true, module: 'inventory', received: body, message: 'PATCH stub' };
  }

  @Delete()
  async remove(@Query('id') id: string) {
    try {
      if (id) await this.dataSource.query('DELETE FROM cobrokits.seller_inventory WHERE id = $1', [id]);
      return { success: true, id };
    } catch (e) {
      return { stub: true, error: (e as Error).message };
    }
  }
}

