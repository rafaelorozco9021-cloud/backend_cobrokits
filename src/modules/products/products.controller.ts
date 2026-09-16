import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getEmpresaIdForUser, getUserIdFromRequest, getSchemaFromRequest } from '../../common/helpers/empresa.helper';

@Controller('api/products')
export class ProductsController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list(@Query('sellerId') sellerId?: string, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req);
      if (schema) {
        // Tenant físico: aislamiento total por schema
        if (sellerId) return this.dataSource.query(`SELECT * FROM ${schema}.products WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100`, [sellerId]);
        return this.dataSource.query(`SELECT * FROM ${schema}.products ORDER BY created_at DESC LIMIT 100`);
      }
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (empresaId) {
        if (sellerId) return this.dataSource.query('SELECT * FROM cobrokits.products WHERE empresa_id = $1 AND seller_id = $2 ORDER BY created_at DESC LIMIT 100', [empresaId, sellerId]);
        return this.dataSource.query('SELECT * FROM cobrokits.products WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT 100', [empresaId]);
      }
      // fail-closed: sin tenant ni empresa no exponer catálogo global
      return [];
    } catch (e) {
      return { stub: true, module: 'products', table: 'products', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any, @Req() req?: any) {
    try {
      const schema = req?.tenant?.schema || 'cobrokits';
      const sku = body.sku || `SKU-${Date.now().toString(36).toUpperCase()}`;
      const cost = body.cost_price ?? body.cost ?? 0;
      const price = body.price ?? body.pvp ?? 0;
      const stock = body.stock ?? 0;
      const sellerId = body.seller_id || body.sellerId || null;
      const userId = getUserIdFromRequest(req || {});
      const empresaId = body.empresa_id || body.empresaId || (await getEmpresaIdForUser(this.dataSource, userId as string)) || sellerId;
      const hasEmpresaCol = (await this.dataSource.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='products' AND column_name='empresa_id'`, [schema])).length > 0;
      const rows: any[] = hasEmpresaCol
        ? await this.dataSource.query(
            `INSERT INTO ${schema}.products (name, description, price, seller_id, empresa_id, cost_price, category, stock, sku) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
            [body.name, body.description || null, price, sellerId, empresaId, cost, body.category || 'general', stock, sku]
          )
        : await this.dataSource.query(
            `INSERT INTO ${schema}.products (name, description, price, seller_id, cost_price, category, stock, sku) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [body.name, body.description || null, price, sellerId, cost, body.category || 'general', stock, sku]
          );
      const prodId = rows[0].id;
      if (Number(stock) > 0) {
        await this.dataSource.query(
          `INSERT INTO ${schema}.warehouse_stock (product_id, total_quantity, reserved_quantity, last_restock) VALUES ($1,$2,0,CURRENT_DATE) ON CONFLICT (product_id) DO UPDATE SET total_quantity = ${schema}.warehouse_stock.total_quantity + $2`,
          [prodId, Number(stock)]
        ).catch(()=>{});
        await this.dataSource.query(
          `INSERT INTO ${schema}.warehouse_stock_entries (product_id, quantity, notes) VALUES ($1,$2,$3)`,
          [prodId, Number(stock), 'Stock inicial']
        ).catch(()=>{});
      }
      // Dual-write a cobrokits si es tenant (compatibilidad)
      if (schema !== 'cobrokits' && hasEmpresaCol) {
        await this.dataSource.query(`INSERT INTO cobrokits.products (id, name, description, price, seller_id, empresa_id, cost_price, category, stock, sku) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`, [prodId, body.name, body.description||null, price, sellerId, empresaId, cost, body.category||'general', stock, sku]).catch(()=>{});
      }
      return rows[0];
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Patch()
  async update(@Body() body: any, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req) || 'cobrokits';
      const id = body.id;
      if (!id) return { success: false, error: 'Falta id' };
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (schema === 'cobrokits' && empresaId) {
        const chk: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.products WHERE id=$1', [id]);
        if (chk.length && chk[0].empresa_id && chk[0].empresa_id !== empresaId)
          return { success: false, error: 'No autorizado: producto de otra empresa' };
      }
      const cols: any[] = await this.dataSource.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='products'`,
        [schema],
      );
      const names = new Set(cols.map((c) => c.column_name));
      const sets: string[] = [];
      const params: any[] = [];
      let idx = 1;
      const put = (col: string, val: any) => {
        if (names.has(col) && val !== undefined) {
          sets.push(`${col} = $${idx++}`);
          params.push(val);
        }
      };
      put('name', body.name);
      put('description', body.description ?? null);
      if (body.price !== undefined) put('price', Number(body.price));
      if (body.pvp !== undefined) put('price', Number(body.pvp));
      if (body.cost_price !== undefined) put('cost_price', Number(body.cost_price));
      if (body.cost !== undefined) put('cost_price', Number(body.cost));
      if (body.stock !== undefined) put('stock', Number(body.stock));
      put('category', body.category);
      put('sku', body.sku);
      if (names.has('updated_at')) sets.push('updated_at = NOW()');
      if (!sets.length) return { success: false, error: 'Nada para actualizar' };
      params.push(id);
      const rows: any[] = await this.dataSource.query(
        `UPDATE ${schema}.products SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
        params,
      );
      const updated = rows[0] || null;
      if (updated && schema !== 'cobrokits') {
        await this.dataSource.query(
          `UPDATE cobrokits.products SET name=$2, description=$3, price=$4, cost_price=$5, category=$6, stock=$7, sku=$8 WHERE id=$1`,
          [updated.id, updated.name, updated.description, updated.price, updated.cost_price, updated.category, updated.stock, updated.sku],
        ).catch(() => {});
      }
      return updated || { success: true, id };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Delete()
  async remove(@Query('id') id: string, @Req() req?: any) {
    try {
      const schema = req?.tenant?.schema || 'cobrokits';
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (schema !== 'cobrokits' && id) {
        await this.dataSource.query(`DELETE FROM ${schema}.products WHERE id = $1`, [id]);
        await this.dataSource.query(`DELETE FROM cobrokits.products WHERE id=$1`, [id]).catch(()=>{});
        return { success: true, id };
      }
      if (empresaId && id) {
        const rows: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.products WHERE id=$1', [id]);
        if (rows.length && rows[0].empresa_id && rows[0].empresa_id !== empresaId) return { success: false, error: 'No autorizado: producto de otra empresa' };
      }
      if (id) await this.dataSource.query('DELETE FROM cobrokits.products WHERE id = $1', [id]);
      return { success: true, id };
    } catch (e) {
      return { stub: true, error: (e as Error).message };
    }
  }
}

