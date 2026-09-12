require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const s = '5529535a-d92a-4815-8f01-a54f891ee554';
  const inv = await p.query('SELECT product_id, quantity FROM cobrokits.seller_inventory WHERE seller_id=$1 ORDER BY quantity DESC', [s]);
  console.log('inv', inv.rows);
  const wh = await p.query("SELECT p.sku, ws.total_quantity FROM cobrokits.warehouse_stock ws JOIN cobrokits.products p ON p.id=ws.product_id WHERE p.sku IN ('DEMO-001','DEMO-002','DEMO-003') ORDER BY p.sku");
  console.log('wh', wh.rows);
  const mov = await p.query("SELECT type, quantity, reason, created_at::date as d FROM cobrokits.inventory_movements WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 8", [s]);
  console.log('mov', mov.rows);
  const vis = await p.query('SELECT id, visit_date FROM cobrokits.customer_visits WHERE seller_id=$1 ORDER BY visit_date DESC LIMIT 3', [s]);
  console.log('vis', vis.rows);
  if (vis.rows.length) {
    const items = await p.query('SELECT product_id, quantity FROM cobrokits.customer_visit_items WHERE visit_id=$1', [vis.rows[0].id]);
    console.log('last visit items', items.rows);
  }
  const dss = await p.query('SELECT date, is_closed FROM cobrokits.daily_seller_stock WHERE seller_id=$1 ORDER BY date DESC LIMIT 3', [s]);
  console.log('dss', dss.rows);
  await p.end();
})();
