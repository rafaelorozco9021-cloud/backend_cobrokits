require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const ids = await p.query("SELECT id FROM cobrokits.products WHERE name ILIKE '%Test%'");
  for (const r of ids.rows) {
    await p.query('DELETE FROM cobrokits.warehouse_stock_entries WHERE product_id=$1', [r.id]);
    await p.query('DELETE FROM cobrokits.warehouse_stock WHERE product_id=$1', [r.id]);
    await p.query('DELETE FROM cobrokits.seller_inventory WHERE product_id=$1', [r.id]);
    await p.query('DELETE FROM cobrokits.customer_visit_items WHERE product_id=$1', [r.id]);
    await p.query('DELETE FROM cobrokits.products WHERE id=$1', [r.id]);
  }
  const c = await p.query('SELECT count(*) FROM cobrokits.products');
  console.log('products after', c.rows[0].count);
  const s = await p.query('SELECT count(*) FROM cobrokits.seller_inventory');
  console.log('seller_inv', s.rows[0].count);
  await p.end();
})();
