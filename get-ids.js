require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await p.query('SET search_path TO cobrokits');
  const pr = await p.query("SELECT name, id, price FROM products WHERE sku='DEMO-001' OR sku='DEMO-003'");
  console.log('PRODUCTOS:', JSON.stringify(pr.rows));
  await p.end();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
