require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
(async () => {
  await p.query("SET search_path TO cobrokits,public");
  await p.query(`
    CREATE OR REPLACE FUNCTION cobrokits.get_collection_target(p_seller_id UUID, p_date DATE)
    RETURNS NUMERIC(14,2) AS $$
    DECLARE v_target NUMERIC(14,2):=0;
    BEGIN
      SELECT COALESCE(SUM(si.quantity * si.cost_price),0) INTO v_target FROM cobrokits.seller_inventory si WHERE si.seller_id=p_seller_id;
      RETURN v_target;
    END;
    $$ LANGUAGE plpgsql
  `);
  console.log('func fixed');
  const r = await p.query('SELECT cobrokits.get_collection_target($1,$2) as t',['69e12865-66e6-4096-8790-ec6f58c3a774','2026-09-02']);
  console.log('test', r.rows[0]);
  await p.end();
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
