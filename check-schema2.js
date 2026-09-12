require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query('SET search_path TO cobrokits,public');
  for (const t of ['cobros','customer_visits','customers','products','sellers','payments']) {
    const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='cobrokits' AND table_name=$1 ORDER BY ordinal_position`, [t]);
    console.log(`\n[${t}]`);
    console.log('  ', r.rows.map(x => x.column_name).join(', '));
  }
  await pool.end();
}
main().catch(e => console.log('ERR:', e.message));