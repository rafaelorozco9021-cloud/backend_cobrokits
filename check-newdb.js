require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query('SET search_path TO cobrokits,public').catch(e => console.log('SET path err (ok si no existe):', e.message.slice(0,40)));
  const schemas = await pool.query(`SELECT schema_name FROM information_schema.schemata`);
  console.log('Esquemas:', schemas.rows.map(r => r.schema_name).join(', '));
  try {
    const tables = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='cobrokits' ORDER BY table_name`);
    console.log('Tablas cobrokits:', tables.rows.map(r => r.table_name).join(', '));
  } catch (e) {
    console.log('Error leyendo tablas cobrokits:', e.message.slice(0,60));
  }
  try {
    const n = await pool.query(`SELECT COUNT(*) FROM cobrokits.customers`);
    console.log('clientes:', n.rows[0].count);
  } catch (e) { console.log('customers err:', e.message.slice(0,60)); }
  await pool.end();
}
main().catch(e => console.log('ERR MAIN:', e.message));