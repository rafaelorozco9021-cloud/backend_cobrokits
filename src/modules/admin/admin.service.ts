import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(private dataSource: DataSource) {}

  async overview() {
    const tenants: any[] = await this.dataSource.query(`SELECT id, schema_name, name, status, created_at FROM public.tenants ORDER BY created_at DESC`);
    let totalEmpresas = tenants.length;
    let totalSellers = 0;
    let totalProducts = 0;
    let totalCustomers = 0;
    let totalVisits = 0;
    const perTenant: any[] = [];
    for (const t of tenants) {
      const schema = t.schema_name;
      try {
        const stats: any[] = await this.dataSource.query(`
          SELECT
            (SELECT count(*)::int FROM ${schema}.sellers WHERE role='seller') as sellers,
            (SELECT count(*)::int FROM ${schema}.sellers WHERE role='empresa') as empresas,
            (SELECT count(*)::int FROM ${schema}.products) as products,
            (SELECT count(*)::int FROM ${schema}.customers) as customers,
            (SELECT count(*)::int FROM ${schema}.customer_visits) as visits,
            (SELECT count(*)::int FROM ${schema}.payments) as payments,
            (SELECT COALESCE(SUM(total_sales),0)::numeric FROM ${schema}.daily_seller_stock) as total_sales
        `);
        const s = stats[0];
        totalSellers += s.sellers;
        totalProducts += s.products;
        totalCustomers += s.customers;
        totalVisits += s.visits;
        perTenant.push({ ...t, ...s });
      } catch {
        perTenant.push({ ...t, sellers:0, products:0, customers:0, visits:0, payments:0, total_sales:0, error:true });
      }
    }
    // Also check cobrokits shared (should be only superadmin)
    let sharedSellers = 0;
    try {
      const r: any[] = await this.dataSource.query(`SELECT count(*)::int as c FROM cobrokits.sellers WHERE role='superadmin'`);
      sharedSellers = r[0].c;
    } catch {}
    return {
      totalEmpresas,
      totalSellers,
      totalProducts,
      totalCustomers,
      totalVisits,
      sharedSellers,
      perTenant,
      generatedAt: new Date().toISOString(),
    };
  }

  async tenants() {
    const rows: any[] = await this.dataSource.query(`SELECT id, schema_name, name, status, created_at FROM public.tenants ORDER BY name`);
    // enrich with counts
    for (const r of rows) {
      try {
        const c: any[] = await this.dataSource.query(`SELECT count(*)::int as sellers FROM ${r.schema_name}.sellers WHERE role='seller'`);
        r.sellers = c[0].sellers;
        const p: any[] = await this.dataSource.query(`SELECT count(*)::int as products FROM ${r.schema_name}.products`);
        r.products = p[0].products;
      } catch { r.sellers=0; r.products=0; }
    }
    return rows;
  }

  async deleteTenant(empresaId: string) {
    const rows: any[] = await this.dataSource.query(`SELECT schema_name FROM public.tenants WHERE id=$1`,[empresaId]);
    if(!rows.length) return {success:false, error:'Tenant no encontrado'};
    const schema=rows[0].schema_name;
    await this.dataSource.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await this.dataSource.query(`DELETE FROM public.tenants WHERE id=$1`,[empresaId]);
    // also remove from cobrokits.sellers if exists
    await this.dataSource.query(`DELETE FROM cobrokits.sellers WHERE id=$1`,[empresaId]).catch(()=>{});
    return {success:true, schema};
  }
}
