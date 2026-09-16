import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { getEmpresaIdForUser, getUserIdFromRequest, getTargetSellerIds, getSchemaFromRequest } from '../../common/helpers/empresa.helper';
import { DataSource } from 'typeorm';

@Controller('api/collection-report')
export class CollectionReportController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list(@Query('sellerId') sellerId?: string, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req);
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (schema) {
        const rows: any[] = sellerId
          ? await this.dataSource.query(`SELECT * FROM ${schema}.payments WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100`, [sellerId])
          : await this.dataSource.query(`SELECT * FROM ${schema}.payments ORDER BY created_at DESC LIMIT 100`);
        if (rows.length > 0) return rows;
        if (!empresaId) return rows;
      }
      if (empresaId) {
        const allowed = await getTargetSellerIds(this.dataSource, userId as string);
        if (sellerId) {
          if (!allowed.includes(sellerId)) return [];
          return this.dataSource.query('SELECT * FROM cobrokits.payments WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100', [sellerId]);
        }
        return this.dataSource.query('SELECT * FROM cobrokits.payments WHERE seller_id = ANY($1::uuid[]) ORDER BY created_at DESC LIMIT 100', [allowed]);
      }
      return [];
    } catch (e) {
      return { stub: true, module: 'collection-report', table: 'payments', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any) {
    return { stub: true, module: 'collection-report', received: body, message: 'POST stub - implementar logica de negocio' };
  }

  @Patch()
  async update(@Body() body: any) {
    return { stub: true, module: 'collection-report', received: body, message: 'PATCH stub' };
  }

  @Delete()
  async remove(@Query('id') id: string) {
    try {
      if (id) await this.dataSource.query('DELETE FROM cobrokits.payments WHERE id = $1', [id]);
      return { success: true, id };
    } catch (e) {
      return { stub: true, error: (e as Error).message };
    }
  }
}

