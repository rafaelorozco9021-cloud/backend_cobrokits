require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  await p.query("DELETE FROM cobrokits.customer_visit_items WHERE visit_id='206d02b6-af3a-4537-9e92-ab0001a87038'");
  await p.query("DELETE FROM cobrokits.payments WHERE visit_id='206d02b6-af3a-4537-9e92-ab0001a87038'");
  await p.query("DELETE FROM cobrokits.customer_visits WHERE id='206d02b6-af3a-4537-9e92-ab0001a87038'");
  await p.query("UPDATE cobrokits.daily_seller_stock SET is_closed=false WHERE seller_id='5529535a-d92a-4815-8f01-a54f891ee554' AND date='2026-09-02'");
  // also need to return warehouse for that sale? The sale consumed 2 from seller inventory, but we already cleaned inventory (returned 3?), need to adjust warehouse: sale of 2 should have been counted as sold, not returned. Since we cleaned inventory via returning 3, but warehouse currently  for Salchichon is  ? Let's check
  const w = await p.query("SELECT total_quantity FROM cobrokits.warehouse_stock WHERE product_id='459c32f5-cb21-425f-8efc-a6b97b69ecb4'");
  console.log('warehouse salchichon', w.rows[0]);
  // the sale of 2 should not affect warehouse, only seller inventory, so cleaning by returning 3 is correct (5 assigned -2 sold =3 remaining, returned 3)
  // but our clean returned only 1 row's quantity (3?) Actually clean returned the remaining 3, not the full 5, so warehouse should be 2+3=5, but full should be 7
  // Let's set warehouse to 7 (original)
  await p.query("UPDATE cobrokits.warehouse_stock SET total_quantity=7 WHERE product_id='459c32f5-cb21-425f-8efc-a6b97b69ecb4'");
  console.log('reset warehouse to 7');
  await p.end();
})();
