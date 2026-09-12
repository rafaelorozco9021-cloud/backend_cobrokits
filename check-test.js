require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const r = await p.query("SELECT name,sku FROM cobrokits.products WHERE name ILIKE '%Test%'");
  console.log(r.rows);
  await p.query("DELETE FROM cobrokits.products WHERE name ILIKE '%Test%'");
  const c = await p.query('SELECT count(*) FROM cobrokits.products');
  console.log('after', c.rows[0].count);
  await p.end();
})();
