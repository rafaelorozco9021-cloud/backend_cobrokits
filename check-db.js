require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const schemaRes = await pool.query("SELECT schema_name FROM information_schema.schemas WHERE schema_name = 'cobrokits'");
    console.log('SCHEMA exists:', schemaRes.rows.length > 0);

    if (schemaRes.rows.length > 0) {
      const tablesRes = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'cobrokits' ORDER BY table_name");
      console.log('TABLES:', tablesRes.rows.map(r => r.table_name));

      const enumRes = await pool.query("SELECT typname FROM pg_type WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'cobrokits') AND typtype = 'e'");
      console.log('ENUMS:', enumRes.rows.map(r => r.typname));

      const funcRes = await pool.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'cobrokits'");
      console.log('FUNCTIONS:', funcRes.rows.map(r => r.routine_name));
    } else {
      console.log('Schema cobrokits does not exist. Need to run db-setup.');
    }
  } catch (e) {
    console.log('ERR:', e.message);
  } finally {
    await pool.end();
  }
}

main();