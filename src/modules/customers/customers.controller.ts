import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getEmpresaIdForUser, getUserIdFromRequest, getSchemaFromRequest } from '../../common/helpers/empresa.helper';

@Controller('api/customers')
export class CustomersController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list(@Query('sellerId') sellerId?: string, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req);
      if (schema) {
        if (sellerId) return this.dataSource.query(`SELECT * FROM ${schema}.customers WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100`, [sellerId]);
        return this.dataSource.query(`SELECT * FROM ${schema}.customers ORDER BY created_at DESC LIMIT 100`);
      }
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (empresaId) {
        if (sellerId) return this.dataSource.query('SELECT * FROM cobrokits.customers WHERE empresa_id = $1 AND seller_id = $2 ORDER BY created_at DESC LIMIT 100', [empresaId, sellerId]);
        return this.dataSource.query('SELECT * FROM cobrokits.customers WHERE empresa_id = $1 ORDER BY created_at DESC LIMIT 100', [empresaId]);
      }
      // fail-closed
      return [];
    } catch (e) {
      return { stub: true, module: 'customers', table: 'customers', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any, @Req() req?: any) {
    try {
      const schema = getSchemaFromRequest(req) || 'cobrokits';
      let sellerId = body.seller_id || body.sellerId || null;
      let cobroId = body.cobro_id || body.cobroId || body.cobro || null;
      if (cobroId && !sellerId) {
        const cob: any[] = await this.dataSource.query(`SELECT seller_id FROM ${schema}.cobros WHERE id=$1`, [cobroId]);
        if (cob[0]?.seller_id) sellerId = cob[0].seller_id;
      }
      const userId = getUserIdFromRequest(req || {});
      const empresaId = body.empresa_id || body.empresaId || (await getEmpresaIdForUser(this.dataSource, userId as string));
      if (!empresaId) return { success: false, error: 'No se pudo determinar empresa' };
      // Validar pertenencia antes de actualizar
      const id = body.id;
      if (id) {
        if (schema === 'cobrokits') {
          const chk: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.customers WHERE id=$1', [id]);
          if (chk.length && chk[0].empresa_id && chk[0].empresa_id !== empresaId) return { success: false, error: 'No autorizado: cliente de otra empresa' };
        }
        await this.dataSource.query(
          `UPDATE ${schema}.customers SET name=$1, phone=$2, email=$3, address=$4, seller_id=$5, cobro_id=$6, updated_at=NOW() WHERE id=$7`,
          [body.name, body.phone || null, body.email || null, body.address || null, sellerId, cobroId, id]
        );
        if (schema !== 'cobrokits') {
          await this.dataSource.query(
            `UPDATE cobrokits.customers SET name=$1, phone=$2, email=$3, address=$4, seller_id=$5, cobro_id=$6, updated_at=NOW() WHERE id=$7`,
            [body.name, body.phone || null, body.email || null, body.address || null, sellerId, cobroId, id]
          ).catch(() => {});
        }
        const rows: any[] = await this.dataSource.query(`SELECT * FROM ${schema}.customers WHERE id=$1`, [id]);
        return rows[0];
      }
      const hasEmpresa = (await this.dataSource.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='customers' AND column_name='empresa_id'`,[schema])).length>0;
      const rows: any[] = hasEmpresa
        ? await this.dataSource.query(`INSERT INTO ${schema}.customers (name, phone, email, address, seller_id, empresa_id, cobro_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[body.name, body.phone||null, body.email||null, body.address||null, sellerId, empresaId, cobroId])
        : await this.dataSource.query(`INSERT INTO ${schema}.customers (name, phone, email, address, seller_id, cobro_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,[body.name, body.phone||null, body.email||null, body.address||null, sellerId, cobroId]);
      if (schema!=='cobrokits' && hasEmpresa) await this.dataSource.query(`INSERT INTO cobrokits.customers (id, name, phone, email, address, seller_id, empresa_id, cobro_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,[rows[0].id, body.name, body.phone||null, body.email||null, body.address||null, sellerId, empresaId, cobroId]).catch(()=>{});
      return rows[0];
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Patch()
  async update(@Body() body: any) {
    return { stub: true, module: 'customers', received: body, message: 'PATCH stub' };
  }

  @Delete()
  async remove(@Query('id') id: string, @Req() req?: any) {
    try {
      const schema = req?.tenant?.schema;
      if (schema && schema!=='cobrokits' && id){ await this.dataSource.query(`DELETE FROM ${schema}.customers WHERE id=$1`,[id]); await this.dataSource.query('DELETE FROM cobrokits.customers WHERE id=$1',[id]).catch(()=>{}); return {success:true,id};}
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (empresaId && id) {
        const rows: any[] = await this.dataSource.query('SELECT empresa_id FROM cobrokits.customers WHERE id=$1', [id]);
        if (rows.length && rows[0].empresa_id && rows[0].empresa_id !== empresaId) return { success: false, error: 'No autorizado: cliente de otra empresa' };
      }
      if (id) await this.dataSource.query('DELETE FROM cobrokits.customers WHERE id = $1', [id]);
      return { success: true, id };
    } catch (e) {
      return { stub: true, error: (e as Error).message };
    }
  }
}

