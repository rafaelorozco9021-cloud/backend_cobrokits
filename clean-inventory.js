require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const s = await p.query('SELECT seller_id, product_id, quantity FROM cobrokits.seller_inventory');
  console.log('seller_inventory rows', s.rows.length);
  for (const r of s.rows) {
    await p.query('UPDATE cobrokits.warehouse_stock SET total_quantity = total_quantity + $1 WHERE product_id=$2', [r.quantity, r.product_id]).catch(() => {});
  }
  await p.query('DELETE FROM cobrokits.seller_inventory');
  await p.query("DELETE FROM cobrokits.products WHERE name='Test Producto Unit' AND sku LIKE 'SKU-MT%'").catch(() => {});
  await p.query("DELETE FROM cobrokits.customers WHERE email='testunit@demo.cobrokits'").catch(() => {});
  await p.query("DELETE FROM cobrokits.inventory_movements WHERE reason LIKE 'Entrega cobro%'").catch(()=>{});

  const w = await p.query('SELECT p.name, ws.total_quantity FROM cobrokits.warehouse_stock ws JOIN cobrokits.products p ON p.id=ws.product_id ORDER BY p.name LIMIT 8');
  console.log('warehouse sample', w.rows);
  const c = await p.query('SELECT count(*) FROM cobrokits.seller_inventory');
  console.log('seller_inventory after', c.rows[0].count);
  const prodCount = await p.query('SELECT count(*) FROM cobrokits.products');
  console.log('products', prodCount.rows[0].count);
  await p.end();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
