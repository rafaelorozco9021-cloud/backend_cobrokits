const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
    search_path: 'cobrokits,public',
    timezone: 'America/Bogota',
  });

  try {
    const sql = fs.readFileSync(
      path.resolve(__dirname, '..', 'database', 'cobrokits_postgres.sql'),
      'utf-8'
    );

    await pool.query('BEGIN');
    await pool.query(sql);
    await pool.query('COMMIT');
    
    console.log('✅ Database setup completed successfully');
    process.exit(0);
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('❌ Database setup failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runSetup();