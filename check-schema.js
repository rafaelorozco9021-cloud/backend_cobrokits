require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query('SET search_path TO cobrokits,public');
  for (const t of ['sellers', 'products', 'customers', 'customer_visits', 'customer_visit_items', 'payments', 'cobros', 'daily_seller_stock']) {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='cobrokits' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`\n[${t}]`);
    console.log('  cols:', r.rows.map(x => x.column_name).join(', '));
  }
  await pool.end();
}
main().catch(e => console.log('ERR:', e.message));