require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  const s = '5529535a-d92a-4815-8f01-a54f891ee554';
  const r = await p.query('SELECT product_id, quantity FROM cobrokits.seller_inventory WHERE seller_id=$1 AND quantity>0', [s]);
  console.log('inv', r.rows);
  await p.end();
})();