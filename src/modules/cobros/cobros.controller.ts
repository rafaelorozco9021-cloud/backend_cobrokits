import { Controller, Get, Post, Patch, Delete, Query, Body, Req } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { getEmpresaIdForUser, getUserIdFromRequest } from '../../common/helpers/empresa.helper';

@Controller('api/cobros')
export class CobrosController {
  constructor(private dataSource: DataSource) {}

  @Get()
  async list(@Query('sellerId') sellerId?: string, @Query('dia') dia?: string, @Query('grupo') grupo?: string, @Req() req?: any) {
    try {
      const schema = req?.tenant?.schema || 'cobrokits';
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      const hasCobros = await this.dataSource.query(`SELECT to_regclass('${schema}.cobros') as tbl`);
      const exists = hasCobros[0]?.tbl !== null;
      if (exists) {
        let q = `SELECT c.*, s.name as seller_name FROM ${schema}.cobros c LEFT JOIN ${schema}.sellers s ON s.id=c.seller_id WHERE 1=1`;
        const params: any[] = [];
        let idx = 1;
        if (schema==='cobrokits' && empresaId) { q += ` AND c.empresa_id = $${idx++}`; params.push(empresaId); }
        if (sellerId) { q += ` AND c.seller_id = $${idx++}`; params.push(sellerId); }
        if (dia !== undefined && dia !== '') { q += ` AND c.dia = $${idx++}`; params.push(Number(dia)); }
        if (grupo) { q += ` AND c.grupo ILIKE $${idx++}`; params.push(`%${grupo}%`); }
        q += ` ORDER BY c.dia, c.name LIMIT 100`;
        return this.dataSource.query(q, params);
      }
      if (sellerId) {
        return this.dataSource.query('SELECT * FROM cobrokits.payments WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100', [sellerId]);
      }
      return this.dataSource.query('SELECT * FROM cobrokits.payments ORDER BY created_at DESC LIMIT 100');
    } catch (e) {
      return { stub: true, module: 'cobros', table: 'payments', message: 'Tabla no inicializada o sin datos', error: (e as Error).message };
    }
  }

  @Post()
  async create(@Body() body: any, @Req() req?: any) {
    try {
      const schema = req?.tenant?.schema || 'cobrokits';
      const userId = getUserIdFromRequest(req || {});
      const empresaId = body.empresa_id || body.empresaId || (await getEmpresaIdForUser(this.dataSource, userId as string));
      if (!empresaId) return { success: false, error: 'No se pudo determinar empresa' };
      const hasEmpresa = (await this.dataSource.query(`SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='cobros' AND column_name='empresa_id'`,[schema])).length>0;
      const rows: any[] = hasEmpresa
        ? await this.dataSource.query(`INSERT INTO ${schema}.cobros (name, dia, dia_nombre, grupo, seller_id, empresa_id, recorrido, observacion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,[body.name, body.dia, body.dia_nombre||'', body.grupo, body.seller_id||body.sellerId||null, empresaId, body.recorrido||null, body.observacion||null])
        : await this.dataSource.query(`INSERT INTO ${schema}.cobros (name, dia, dia_nombre, grupo, seller_id, recorrido, observacion) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[body.name, body.dia, body.dia_nombre||'', body.grupo, body.seller_id||body.sellerId||null, body.recorrido||null, body.observacion||null]);
      if (schema!=='cobrokits') await this.dataSource.query(`INSERT INTO cobrokits.cobros (id, name, dia, dia_nombre, grupo, seller_id, empresa_id, recorrido, observacion) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,[rows[0].id, body.name, body.dia, body.dia_nombre||'', body.grupo, body.seller_id||body.sellerId||null, empresaId, body.recorrido||null, body.observacion||null]).catch(()=>{});
      return rows[0];
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Patch()
  async update(@Body() body: any, @Req() req?: any) {
    try {
      const schema = req?.tenant?.schema || 'cobrokits';
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      const id = body.id;
      if (!id) return { success: false, error: 'Falta id' };
      const cols: any[] = await this.dataSource.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name='cobros'`,
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
      if (body.dia !== undefined) put('dia', Number(body.dia));
      put('dia_nombre', body.dia_nombre);
      put('grupo', body.grupo);
      put('seller_id', body.seller_id ?? body.sellerId ?? null);
      put('recorrido', body.recorrido ?? null);
      put('observacion', body.observacion ?? null);
      if (body.activo !== undefined) put('activo', !!body.activo);
      if (names.has('updated_at')) sets.push(`updated_at = NOW()`);
      if (!sets.length) return { success: false, error: 'Nada para actualizar' };
      params.push(id);
      let q = `UPDATE ${schema}.cobros SET ${sets.join(', ')} WHERE id = $${idx++}`;
      const scope: any[] = [];
      if (schema === 'cobrokits' && empresaId && names.has('empresa_id')) {
        q += ` AND empresa_id = $${idx++}`;
        scope.push(empresaId);
      }
      const rows: any[] = await this.dataSource.query(`${q} RETURNING *`, [...params, ...scope]);
      const updated = rows[0] || null;
      if (updated && schema !== 'cobrokits') {
        await this.dataSource
          .query(
            `UPDATE cobrokits.cobros SET name=$2, dia=$3, dia_nombre=$4, grupo=$5, seller_id=$6, recorrido=$7, observacion=$8, activo=$9 WHERE id=$1`,
            [updated.id, updated.name, updated.dia, updated.dia_nombre, updated.grupo, updated.seller_id, updated.recorrido, updated.observacion, updated.activo],
          )
          .catch(() => {});
      }
      return updated || { success: true, id };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  @Delete()
  async remove(@Query('id') id: string, @Req() req?: any) {
    try {
      if (!id) return { success: false, error: 'Falta id' };
      const schema = req?.tenant?.schema || 'cobrokits';
      const userId = getUserIdFromRequest(req || {});
      const empresaId = await getEmpresaIdForUser(this.dataSource, userId as string);
      if (schema === 'cobrokits' && empresaId) {
        const rows: any[] = await this.dataSource.query(`SELECT empresa_id FROM cobrokits.cobros WHERE id=$1`, [id]);
        if (rows.length && rows[0].empresa_id && rows[0].empresa_id !== empresaId)
          return { success: false, error: 'No autorizado: cobro de otra empresa' };
      }
      await this.dataSource.query(`DELETE FROM ${schema}.cobros WHERE id = $1`, [id]).catch(() => {});
      await this.dataSource.query(`DELETE FROM cobrokits.cobros WHERE id = $1`, [id]).catch(() => {});
      return { success: true, id };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
