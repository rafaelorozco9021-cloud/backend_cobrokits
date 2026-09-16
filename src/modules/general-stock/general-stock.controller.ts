import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { getEmpresaIdForUser, getUserIdFromRequest, getSchemaFromRequest } from '../../common/helpers/empresa.helper';
import { DataSource } from 'typeorm';

@Controller('api/general-stock')
export class GeneralStockController {
  constructor(private dataSource: DataSource) {}

  // Suma stock sin depender de un constraint único en product_id
  // (la tabla puede no tenerlo y el ON CONFLICT fallaría).
  private async addStock(ds: DataSource, schema: string, productId: string, qty: number) {
    const cur: any[] = await ds.query(
      `SELECT id FROM ${schema}.warehouse_stock WHERE product_id = $1 LIMIT 1`,
      [productId],
    );
    if (cur.length) {
      await ds.query(
        `UPDATE ${schema}.warehouse_stock SET total_quantity = total_quantity + $2, last_restock = CURRENT_DATE, updated_at = NOW() WHERE product_id = $1`,
        [productId, qty],
      );
    } else {
      await ds.query(
        `INSERT INTO ${schema}.warehouse_stock (product_id, total_quantity, reserved_quantity, last_restock) VALUES ($1, $2, 0, CURRENT_DATE)`,
        [productId, qty],
      );
    }
  }

  @Get()
  async list(@Query('sellerId') sellerId?: string, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req);
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (schema) {
        const rows: any[] = await this.dataSource.query(`SELECT ws.* FROM ${schema}.warehouse_stock ws ORDER BY ws.created_at DESC LIMIT 100`);
        if (rows.length > 0) return rows;
        if (!empresaId) return rows;
      }
      if (empresaId) {
        // warehouse_stock se filtra por productos de la empresa
        return this.dataSource.query('SELECT ws.* FROM cobrokits.warehouse_stock ws JOIN cobrokits.products p ON p.id=ws.product_id WHERE p.empresa_id=$1 ORDER BY ws.created_at DESC LIMIT 100', [empresaId]);
      }
      // fail-closed
      return [];
    } catch (e) {
      return { stub: true, module: 'general-stock', table: 'warehouse_stock', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any) {
    return { stub: true, module: 'general-stock', received: body, message: 'POST stub - usar POST /api/general-stock/add' };
  }

  // Ingreso de stock a bodega: suma cantidad al producto de TU empresa.
  @Post('add')
  async add(@Body() body: any, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req) || 'cobrokits';
      const productId = body.product_id || body.productId;
      const qty = Number(body.quantity ?? body.qty ?? 0);
      if (!productId) return { success: false, error: 'product_id requerido' };
      if (!Number.isFinite(qty) || qty <= 0) return { success: false, error: 'La cantidad debe ser mayor a 0' };
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (!empresaId) return { success: false, error: 'No se pudo determinar empresa' };
      // Validar que el producto pertenece a esta empresa (nunca al de otra)
      const prod: any[] = await this.dataSource.query(
        `SELECT id, name, empresa_id FROM ${schema}.products WHERE id = $1`,
        [productId],
      );
      if (!prod.length) return { success: false, error: 'Producto no encontrado en tu empresa' };
      if (prod[0].empresa_id && prod[0].empresa_id !== empresaId)
        return { success: false, error: 'No autorizado: producto de otra empresa' };
      await this.addStock(this.dataSource, schema, productId, qty);
      await this.dataSource.query(
        `INSERT INTO ${schema}.warehouse_stock_entries (product_id, quantity, notes) VALUES ($1, $2, $3)`,
        [productId, qty, body.notes || 'Ingreso manual desde Inventario General'],
      ).catch(() => {});
      if (schema !== 'cobrokits') {
        await this.addStock(this.dataSource, 'cobrokits', productId, qty).catch(() => {});
        await this.dataSource.query(
          `INSERT INTO cobrokits.warehouse_stock_entries (product_id, quantity, notes) VALUES ($1, $2, $3)`,
          [productId, qty, body.notes || 'Ingreso manual desde Inventario General'],
        ).catch(() => {});
      }
      const cur: any[] = await this.dataSource.query(
        `SELECT total_quantity FROM ${schema}.warehouse_stock WHERE product_id = $1`,
        [productId],
      );
      return { success: true, product_id: productId, added: qty, stock: Number(cur[0]?.total_quantity ?? 0) };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Patch()
  async update(@Body() body: any) {
    return { stub: true, module: 'general-stock', received: body, message: 'PATCH stub' };
  }

  @Delete()
  async remove(@Query('id') id: string) {
    try {
      if (id) await this.dataSource.query('DELETE FROM cobrokits.warehouse_stock WHERE id = $1', [id]);
      return { success: true, id };
    } catch (e) {
      return { stub: true, error: (e as Error).message };
    }
  }
}

