import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class AutoCloseService implements OnModuleInit {
  private readonly logger = new Logger(AutoCloseService.name);

  constructor(private dataSource: DataSource) {}

  onModuleInit() {
    this.logger.log('✅ AutoCloseService iniciado - cron programado para 00:00 diario');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async autoCloseDailyInventory() {
    this.logger.log('🕛 Iniciando cierre automático de inventario a medianoche');
    try {
      const today = new Date().toISOString().split('T')[0];
      // Si hay tenants, iterar por cada schema tenant
      let tenants: any[] = [];
      try { tenants = await this.dataSource.query(`SELECT schema_name FROM public.tenants`); } catch {}
      const schemas = tenants.length ? tenants.map((t) => t.schema_name) : ['cobrokits'];
      for (const schema of schemas) {
        try { await this.autoCloseForSchema(schema, today); } catch (e) { this.logger.error(`Error tenant ${schema}: ${e.message}`); }
      }
    } catch (e) { this.logger.error(`❌ Error en autoCloseDailyInventory: ${e.message}`); }
  }

  private async autoCloseForSchema(schema: string, today: string) {
    const sellersWithOpenDay: any[] = await this.dataSource.query(
      `SELECT DISTINCT im.seller_id 
       FROM ${schema}.inventory_movements im
       WHERE im.type = 'entry' 
         AND im.created_at::date = $1::date
         AND im.reason LIKE 'Entrega cobro%'
         AND NOT EXISTS (
           SELECT 1 FROM ${schema}.daily_seller_stock dss 
           WHERE dss.seller_id = im.seller_id 
           AND dss.date = $1::date 
           AND dss.is_closed = true
         )`,
      [today]
    );

    if (sellersWithOpenDay.length === 0) {
      this.logger.log(`✅ [${schema}] No hay vendedores con día abierto`);
      return;
    }
    this.logger.log(`🔄 [${schema}] Cerrando ${sellersWithOpenDay.length} vendedores`);
    for (const row of sellersWithOpenDay) {
      try { await this.closeSellerDay(row.seller_id, today, schema); this.logger.log(`✅ [${schema}] Auto-cerrado ${row.seller_id}`); }
      catch (e) { this.logger.error(`❌ [${schema}] Error ${row.seller_id}: ${e.message}`); }
    }
  }
  private async closeSellerDay(sellerId: string, today: string, schema = 'cobrokits') {
    const inv: any[] = await this.dataSource.query(`SELECT product_id, quantity, cost_price FROM ${schema}.seller_inventory WHERE seller_id=$1 AND quantity > 0`,[sellerId]);
    if (inv.length === 0) {
      await this.dataSource.query(`UPDATE ${schema}.daily_seller_stock SET is_closed=TRUE, closed_at=NOW() WHERE seller_id=$1 AND date=$2`,[sellerId, today]).catch(()=>{});
      await this.dataSource.query(`INSERT INTO ${schema}.daily_seller_stock (seller_id, date, is_closed, closed_at) VALUES ($1,$2,TRUE,NOW()) ON CONFLICT (seller_id, date) DO UPDATE SET is_closed=TRUE, closed_at=NOW()`,[sellerId, today]).catch(()=>{});
      return;
    }
    const mov: any[] = await this.dataSource.query(`SELECT COALESCE(SUM(quantity),0) as sum FROM ${schema}.inventory_movements WHERE seller_id=$1 AND type='entry' AND created_at::date=$2 AND reason LIKE 'Entrega cobro%'`,[sellerId, today]);
    let totalReturned = 0;
    for (const row of inv) {
      const qty = Number(row.quantity||0); if(qty<=0) continue;
      await this.dataSource.query(`UPDATE ${schema}.warehouse_stock SET total_quantity = total_quantity + $2, updated_at=NOW() WHERE product_id=$1`,[row.product_id, qty]).catch(()=>{});
      await this.dataSource.query(`INSERT INTO ${schema}.inventory_movements (seller_id, product_id, type, quantity, reason) VALUES ($1,$2,'exit',$3,$4)`,[sellerId, row.product_id, qty, 'Devolución automática medianoche']).catch(()=>{});
      totalReturned += qty;
    }
    await this.dataSource.query(`UPDATE ${schema}.seller_inventory SET quantity=0, updated_at=NOW() WHERE seller_id=$1`,[sellerId]);
    await this.dataSource.query(`UPDATE ${schema}.daily_seller_stock SET is_closed=TRUE, closed_at=NOW() WHERE seller_id=$1 AND date=$2`,[sellerId, today]).catch(()=>{});
    await this.dataSource.query(`INSERT INTO ${schema}.daily_seller_stock (seller_id, date, is_closed, closed_at) VALUES ($1,$2,TRUE,NOW()) ON CONFLICT (seller_id, date) DO UPDATE SET is_closed=TRUE, closed_at=NOW()`,[sellerId, today]).catch(()=>{});
  }
}