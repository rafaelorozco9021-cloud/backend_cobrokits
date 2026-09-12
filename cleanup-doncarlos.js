require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await p.query('SET search_path TO cobrokits');
  const vids = await p.query("SELECT id FROM customer_visits WHERE id IN (SELECT visit_id FROM customer_visit_items WHERE product_id='459c32f5-cb21-425f-8efc-a6b97b69ecb4')");
  for (const r of vids.rows) {
    await p.query('DELETE FROM customer_visit_items WHERE visit_id=$1', [r.id]);
    await p.query('DELETE FROM payments WHERE visit_id=$1', [r.id]);
    await p.query('DELETE FROM customer_visits WHERE id=$1', [r.id]);
  }
  await p.query("DELETE FROM customers WHERE email='doncarlos@demo.cobrokits'");
  await p.end();
  console.log('cleanup ok');
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
