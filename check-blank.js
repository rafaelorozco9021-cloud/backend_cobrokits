require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const s = await pool.query(`SELECT schema_name FROM information_schema.schemata`);
  console.log('Esquemas:', s.rows.map(r => r.schema_name).join(', '));
  await pool.end();
}
main().catch(e => console.log('ERR:', e.message));