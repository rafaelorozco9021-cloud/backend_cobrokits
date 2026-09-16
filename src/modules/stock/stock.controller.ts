import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { getEmpresaIdForUser, getUserIdFromRequest, getSchemaFromRequest } from '../../common/helpers/empresa.helper';
import { DataSource } from 'typeorm';

@Controller('api/stock')
export class StockController {
  constructor(private dataSource: DataSource) {}

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
        return this.dataSource.query('SELECT ws.* FROM cobrokits.warehouse_stock ws JOIN cobrokits.products p ON p.id=ws.product_id WHERE p.empresa_id=$1 ORDER BY ws.created_at DESC LIMIT 100', [empresaId]);
      }
      return [];
    } catch (e) {
      return { stub: true, module: 'stock', table: 'warehouse_stock', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any) {
    return { stub: true, module: 'stock', received: body, message: 'POST stub - implementar logica de negocio' };
  }

  @Patch()
  async update(@Body() body: any) {
    return { stub: true, module: 'stock', received: body, message: 'PATCH stub' };
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

