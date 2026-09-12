require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const t = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='cobrokits' ORDER BY table_name`);
  console.log('Tablas cobrokits:', t.rows.map(r => r.table_name).join(', '));
  await pool.end();
}
main().catch(e => console.log('ERR:', e.message));