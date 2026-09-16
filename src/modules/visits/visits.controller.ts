import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getEmpresaIdForUser, getUserIdFromRequest, getTargetSellerIds, getSchemaFromRequest } from '../../common/helpers/empresa.helper';

@Controller('api/visits')
export class VisitsController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list(
    @Query('sellerId') sellerId?: string,
    @Query('cobroId') cobroId?: string,
    @Query('date') date?: string,
    @Query('cobro_id') cobro_id?: string,
    @Req() req?: any,
  ) {
    try {
      const tenantSchema = getSchemaFromRequest(req);
      const schema = tenantSchema || 'cobrokits';
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      // fail-closed: schema global sin empresa no expone visitas
      if (!tenantSchema && !empresaId) return [];
      const cob = cobroId || cobro_id;
      const params: any[] = [];
      let idx = 1;
      let where = 'WHERE 1=1';
      // Aislamiento por empresa: solo visitas de sus vendedores
      if (empresaId) {
        const allowedIds: string[] = await getTargetSellerIds(this.dataSource, userId as string);
        if (sellerId) {
          if (!allowedIds.includes(sellerId)) return [];
          where += ` AND cv.seller_id = $${idx++}`;
          params.push(sellerId);
        } else {
          where += ` AND cv.seller_id = ANY($${idx++}::uuid[])`;
          params.push(allowedIds);
        }
      } else if (sellerId) {
        where += ` AND cv.seller_id = $${idx++}`;
        params.push(sellerId);
      }
      if (cob) {
        where += ` AND cv.cobro_id = $${idx++}`;
        params.push(cob);
      }
      if (date) {
        // Día calendario Bogotá (el frontend envía la fecha del cliente en Bogotá).
        // Comparar en UTC movería ventas nocturnas 19:00-23:59 al día siguiente.
        where += ` AND (cv.visit_date AT TIME ZONE 'America/Bogota')::date = $${idx++}::date`;
        params.push(date);
      }
      const q = `
        SELECT
          cv.id,
          cv.seller_id,
          cv.cobro_id,
          cv.visit_date,
          cv.visit_day,
          s.name as vendedor,
          c.id as cliente_id,
          c.name as cliente,
          c.phone as cliente_phone,
          p.payment_method,
          COALESCE(SUM(cvi.quantity * cvi.unit_price), 0) as venta,
          COALESCE(p.amount, 0) as abono,
          COALESCE(SUM(cvi.quantity * cvi.unit_price), 0) - COALESCE(p.amount, 0) as deuda,
          0 as anterior
        FROM ${schema}.customer_visits cv
        LEFT JOIN ${schema}.sellers s ON s.id = cv.seller_id
        LEFT JOIN ${schema}.payments p ON p.visit_id = cv.id
        LEFT JOIN ${schema}.customers c ON c.id = p.customer_id
        LEFT JOIN ${schema}.customer_visit_items cvi ON cvi.visit_id = cv.id
        ${where}
        GROUP BY cv.id, c.id, c.name, c.phone, s.name, p.amount, p.payment_method, cv.visit_date
        ORDER BY cv.visit_date DESC
        LIMIT 100
      `;
      const rows = await this.dataSource.query(q, params);
      // Si no hay cobro_id filtrado y no hay resultados, fallback sin filtro de fecha para mostrar hoy
      if (rows.length === 0 && !date && !cob) {
        // Intentar sin filtro de cobro pero con sellerId y hoy
        const hoy = new Date().toISOString().split('T')[0];
        const q2 = `
          SELECT cv.id, cv.seller_id, cv.cobro_id, cv.visit_date, s.name as vendedor, c.name as cliente, c.phone as cliente_phone, p.payment_method, COALESCE(SUM(cvi.quantity * cvi.unit_price),0) as venta, COALESCE(p.amount,0) as abono, COALESCE(SUM(cvi.quantity * cvi.unit_price),0)-COALESCE(p.amount,0) as deuda
          FROM cobrokits.customer_visits cv
          LEFT JOIN cobrokits.sellers s ON s.id=cv.seller_id
          LEFT JOIN cobrokits.payments p ON p.visit_id=cv.id
          LEFT JOIN cobrokits.customers c ON c.id=p.customer_id
          LEFT JOIN cobrokits.customer_visit_items cvi ON cvi.visit_id=cv.id
          WHERE cv.seller_id = $1 AND (cv.visit_date AT TIME ZONE 'America/Bogota')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Bogota')::date
          GROUP BY cv.id, c.name, c.phone, s.name, p.amount, p.payment_method, cv.visit_date
          ORDER BY cv.visit_date DESC LIMIT 50
        `;
        if (sellerId) {
          const rows2: any[] = await this.dataSource.query(q2, [sellerId]);
          return rows2;
        }
      }
      return rows;
    } catch (e) {
      return { stub: true, module: 'visits', table: 'customer_visits', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any, @Req() req?: any) {
    try {
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      const customerId = body.customerId || body.customer_id || body.clienteId;
      const sellerId = body.sellerId || body.seller_id || body.vendedorId;
      // Validar que seller y customer pertenecen a la misma empresa
      if (empresaId) {
        if (sellerId) {
          const s: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.sellers WHERE id=$1', [sellerId]);
          if (s.length && s[0].empresa_id && s[0].empresa_id !== empresaId) return { success: false, error: 'Vendedor no pertenece a tu empresa' };
        }
        if (customerId) {
          const c: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.customers WHERE id=$1', [customerId]);
          if (c.length && c[0].empresa_id && c[0].empresa_id !== empresaId) return { success: false, error: 'Cliente no pertenece a tu empresa' };
        }
      }
      const cobroId = body.cobroId || body.cobro_id || null;
      const items = body.items || [];
      const payment = Number(body.payment || body.abono || 0);
      const paymentMethod = (body.paymentMethod || body.metodo || 'efectivo').toLowerCase();
      const notes = body.notes || body.nota || body.observacion || '';
      const visitDate = body.visitDate ? new Date(body.visitDate) : new Date();

      if (!customerId || !sellerId) {
        return { success: false, error: 'customerId y sellerId requeridos' };
      }

      // Normalizar items: [{product_id, quantity, unit_price}]
      const normalizedItems = (Array.isArray(items) ? items : []).map((it: any) => ({
        product_id: it.product_id || it.id,
        quantity: Number(it.quantity || it.cant || 0),
        unit_price: Number(it.unit_price || it.price || it.pvp || 0),
      })).filter((it) => it.product_id && it.quantity > 0);

      const itemsJson = JSON.stringify(normalizedItems);

      // Asegurar search_path para que la función encuentre tablas sin esquema (daily_seller_stock, etc.)
      await this.dataSource.query(`SET search_path TO cobrokits,public`).catch(()=>{});

      // Llamar función PL/pgSQL que crea visita, items y pago
      const result: any[] = await this.dataSource.query(
        `SELECT cobrokits.register_customer_visit($1::uuid, $2::uuid, $3::jsonb, $4::numeric, $5::cobrokits.payment_method, $6::text, $7::timestamptz) as visit_id`,
        [customerId, sellerId, itemsJson, payment, paymentMethod, notes, visitDate.toISOString()]
      );

      const visitId = result[0]?.visit_id;

      // Si hay cobro_id, actualizar visita y pago
      if (visitId && cobroId) {
        await this.dataSource.query(`UPDATE cobrokits.customer_visits SET cobro_id = $1 WHERE id = $2`, [cobroId, visitId]).catch(()=>{});
        await this.dataSource.query(`UPDATE cobrokits.payments SET cobro_id = $1 WHERE visit_id = $2`, [cobroId, visitId]).catch(()=>{});
        await this.dataSource.query(`UPDATE cobrokits.customers SET cobro_id = $1 WHERE id = $2 AND cobro_id IS NULL`, [cobroId, customerId]).catch(()=>{});
      }

      return { success: true, visit_id: visitId, cobro_id: cobroId, items: normalizedItems.length, payment, paymentMethod };
    } catch (e: any) {
      return { success: false, error: e.message, detail: e.detail || null };
    }
  }

  @Post('abono')
  async addAbono(@Body() body: any, @Req() req?: any) {
    try {
      const visitId = body.visit_id || body.visitId;
      const amount = Number(body.amount ?? body.abono ?? 0);
      if (!visitId) return { success: false, error: 'visit_id requerido' };
      if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: 'El abono debe ser mayor a 0' };
      const method = String(body.payment_method || body.paymentMethod || 'efectivo').toLowerCase();
      if (!['efectivo', 'nequi', 'transferencia', 'tarjeta'].includes(method))
        return { success: false, error: 'Método de pago no válido' };
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (!empresaId) return { success: false, error: 'No se pudo determinar empresa' };
      // Schema donde vive la visita (tenant físico si existe, si no cobrokits)
      let schema = 'cobrokits';
      const tenantSchema = getSchemaFromRequest(req);
      if (tenantSchema) {
        const t: any[] = await this.dataSource.query(`SELECT to_regclass('${tenantSchema}.customer_visits') AS tbl`);
        if (t[0]?.tbl !== null) {
          const found: any[] = await this.dataSource.query(`SELECT id FROM ${tenantSchema}.customer_visits WHERE id = $1`, [visitId]);
          if (found.length) schema = tenantSchema;
        }
      }
      const visit: any[] = await this.dataSource.query(
        `SELECT id, seller_id, customer_id, cobro_id FROM ${schema}.customer_visits WHERE id = $1`,
        [visitId],
      );
      if (!visit.length) return { success: false, error: 'Visita no encontrada en tu empresa' };
      const v = visit[0];
      // Ownership: el vendedor de la visita debe pertenecer a tu empresa
      const s: any[] = await this.dataSource.query(`SELECT empresa_id FROM cobrokits.sellers WHERE id = $1`, [v.seller_id]);
      if (s.length && s[0].empresa_id && s[0].empresa_id !== empresaId)
        return { success: false, error: 'No autorizado: visita de otra empresa' };
      const pay: any[] = await this.dataSource.query(
        `INSERT INTO ${schema}.payments (seller_id, customer_id, visit_id, amount, payment_method, status, notes)
         VALUES ($1, $2, $3, $4, $5, 'completed', $6) RETURNING id, amount, payment_method, created_at`,
        [v.seller_id, v.customer_id, visitId, amount, method, body.notes || body.nota || 'Abono posterior'],
      );
      const hasCobroCol = (await this.dataSource.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'payments' AND column_name = 'cobro_id'`,
        [schema],
      )).length > 0;
      if (hasCobroCol && v.cobro_id) {
        await this.dataSource.query(`UPDATE ${schema}.payments SET cobro_id = $1 WHERE id = $2`, [v.cobro_id, pay[0].id]).catch(() => {});
      }
      if (schema !== 'cobrokits') {
        await this.dataSource.query(
          `INSERT INTO cobrokits.payments (seller_id, customer_id, visit_id, amount, payment_method, status, notes)
           VALUES ($1, $2, $3, $4, $5, 'completed', $6)`,
          [v.seller_id, v.customer_id, visitId, amount, method, body.notes || body.nota || 'Abono posterior'],
        ).catch(() => {});
      }
      const agg: any[] = await this.dataSource.query(
        `SELECT COALESCE((SELECT SUM(cvi.quantity * cvi.unit_price) FROM ${schema}.customer_visit_items cvi WHERE cvi.visit_id = $1), 0) AS venta,
                COALESCE((SELECT SUM(p2.amount) FROM ${schema}.payments p2 WHERE p2.visit_id = $1), 0) AS abono`,
        [visitId],
      );
      const venta = Number(agg[0]?.venta || 0);
      const abonoTotal = Number(agg[0]?.abono || 0);
      return { success: true, payment: pay[0], visit_id: visitId, venta, abono_total: abonoTotal, deuda: venta - abonoTotal };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Patch()
  async update(@Body() body: any) {
    return { stub: true, module: 'visits', received: body, message: 'PATCH stub' };
  }

  @Delete()
  async remove(@Query('id') id: string) {
    try {
      if (id) await this.dataSource.query('DELETE FROM cobrokits.customer_visits WHERE id = $1', [id]);
      return { success: true, id };
    } catch (e) {
      return { stub: true, error: (e as Error).message };
    }
  }
}

