require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

  // PELIGRO: Este script BORRA TODO. Solo usar manualmente con confirmación.
  if (!process.argv.includes('--force')) {
    console.error('⛔ Este script hace DROP SCHEMA cobrokits CASCADE (BORRA TODO).');
    console.error('   Usa: node recreate-schema.js --force  para confirmar');
    await pool.end();
    process.exit(1);
  }
  console.log('Dropeando esquema cobrokits (viejo)...');
  try {
    await pool.query('DROP SCHEMA IF EXISTS cobrokits CASCADE');
    console.log('  esquema eliminado');
  } catch (e) {
    console.log('  error drop:', e.message.slice(0, 60));
  }

  console.log('Aplicando cobrokits_postgres.sql...');
  const sql = fs.readFileSync(path.resolve(__dirname, 'database', 'cobrokits_postgres.sql'), 'utf-8');
  try {
    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    console.log('  esquema creado correctamente');
  } catch (e) {
    await pool.query('ROLLBACK').catch(() => {});
    console.log('  ERROR aplicando SQL:', e.message);
    process.exit(1);
  }

  await pool.end();
}
main().catch(e => console.log('ERR MAIN:', e.message));