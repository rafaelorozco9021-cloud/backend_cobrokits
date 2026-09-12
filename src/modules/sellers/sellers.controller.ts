import { Controller, Get, Post, Patch, Delete, Body, Query, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getEmpresaIdForUser, getUserIdFromRequest } from '../../common/helpers/empresa.helper';

@Controller('api/sellers')
export class SellersController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list(@Req() req?: any) {
    const schema = req?.tenant?.schema;
    if (schema) return this.dataSource.query(`SELECT id, name, email, phone, status, role, empresa_id FROM ${schema}.sellers WHERE role = 'seller' ORDER BY name`);
    const userId = getUserIdFromRequest(req || {});
    const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
    if (empresaId) return this.dataSource.query(`SELECT id, name, email, phone, status, role, empresa_id FROM cobrokits.sellers WHERE empresa_id = $1 AND role = 'seller' ORDER BY name`, [empresaId]);
    return this.dataSource.query(`SELECT id, name, email, phone, status, role, empresa_id FROM cobrokits.sellers WHERE role = 'seller' ORDER BY name`);
  }

  @Post()
  async create(@Body() body: any, @Req() req?: any) {
    const schema = req?.tenant?.schema || 'cobrokits';
    const userId = getUserIdFromRequest(req || {});
    const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
    const targetEmpresaId = empresaId || body.empresa_id || body.empresaId || null;
    const rows: any[] = await this.dataSource.query(`INSERT INTO ${schema}.sellers (name, email, phone, status, role, empresa_id) VALUES ($1, $2, $3, 'active', 'seller', $4) RETURNING id, name, email, phone, status`,[body.name, body.email, body.phone||'', targetEmpresaId]);
    if (schema!=='cobrokits') await this.dataSource.query(`INSERT INTO cobrokits.sellers (id, name, email, phone, status, role, empresa_id) VALUES ($1,$2,$3,'active','seller',$4) ON CONFLICT (id) DO NOTHING`,[rows[0].id, body.name, body.email, body.phone||'', targetEmpresaId]).catch(()=>{});
    return rows[0];
  }

  @Patch()
  async update(@Body() body: any) {
    await this.dataSource.query(
      `UPDATE cobrokits.sellers SET name = $1, email = $2, phone = $3, updated_at = NOW() WHERE id = $4`,
      [body.name, body.email, body.phone, body.id],
    );
    return { id: body.id, ...body };
  }

  @Delete()
  async remove(@Query('id') id: string, @Req() req?: any) {
    const userId = getUserIdFromRequest(req || {});
    const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
    if (empresaId && id) {
      const rows: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.sellers WHERE id=$1', [id]);
      if (rows.length && rows[0].empresa_id && rows[0].empresa_id !== empresaId) return { success: false, error: 'No autorizado: vendedor de otra empresa' };
    }
    await this.dataSource.query('DELETE FROM cobrokits.sellers WHERE id = $1', [id]);
    return { success: true };
  }
}

