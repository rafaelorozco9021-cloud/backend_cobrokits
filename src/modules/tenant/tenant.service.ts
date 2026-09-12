import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface TenantContext {
  empresaId: string;
  schema: string;
  name: string;
}

@Injectable()
export class TenantService {
  private cache = new Map<string, { tenant: TenantContext | null; ts: number }>();
  private CACHE_TTL = 60_000;

  constructor(private dataSource: DataSource) {}

  schemaForEmpresa(id: string): string {
    return 'empresa_' + id.replace(/-/g, '').slice(0, 8);
  }

  async resolveByEmpresaId(empresaId: string): Promise<TenantContext | null> {
    if (!empresaId || !/^[0-9a-f-]{36}$/i.test(empresaId)) return null;
    const cached = this.cache.get(empresaId);
    if (cached && Date.now() - cached.ts < this.CACHE_TTL) return cached.tenant;
    try {
      const rows: any[] = await this.dataSource.query(
        `SELECT id, schema_name, name FROM public.tenants WHERE id=$1`,
        [empresaId],
      );
      if (rows.length) {
        const t: TenantContext = { empresaId: rows[0].id, schema: rows[0].schema_name, name: rows[0].name };
        this.cache.set(empresaId, { tenant: t, ts: Date.now() });
        return t;
      }
      // fallback: if no registry but empresa exists, create context on-the-fly (legacy)
      const sellers: any[] = await this.dataSource.query(`SELECT id, name FROM cobrokits.sellers WHERE id=$1 AND role='empresa'`, [empresaId]);
      if (sellers.length) {
        const t: TenantContext = { empresaId, schema: this.schemaForEmpresa(empresaId), name: sellers[0].name };
        this.cache.set(empresaId, { tenant: t, ts: Date.now() });
        return t;
      }
      return null;
    } catch {
      return null;
    }
  }

  async resolveByUserId(userId: string): Promise<TenantContext | null> {
    if (!userId || userId === 'admin') return null;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
    try {
      const rows: any[] = await this.dataSource.query(`SELECT id, role, empresa_id FROM cobrokits.sellers WHERE id=$1`, [userId]);
      if (!rows.length) return null;
      const u = rows[0];
      const empresaId = u.role === 'empresa' ? u.id : u.empresa_id;
      if (!empresaId) return null;
      return this.resolveByEmpresaId(empresaId);
    } catch {
      return null;
    }
  }

  async listTenants(): Promise<TenantContext[]> {
    const rows: any[] = await this.dataSource.query(`SELECT id, schema_name, name FROM public.tenants ORDER BY name`);
    return rows.map((r) => ({ empresaId: r.id, schema: r.schema_name, name: r.name }));
  }

  clearCache(empresaId?: string) {
    if (empresaId) this.cache.delete(empresaId);
    else this.cache.clear();
  }

  // Helper para controllers: resuelve schema desde req, con fallback a cobrokits
  getSchemaFromRequest(req: any): string {
    return req?.tenant?.schema || 'cobrokits';
  }

  // Para futuro DB-per-tenant: retornar databaseUrl si existe
  async getDatabaseUrlForTenant(empresaId: string): Promise<string | null> {
    try {
      const rows: any[] = await this.dataSource.query(`SELECT database_url FROM public.tenants WHERE id=$1`, [empresaId]);
      return rows[0]?.database_url || null;
    } catch { return null; }
  }
}
