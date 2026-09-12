require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  await p.query("DELETE FROM cobrokits.customer_visit_items WHERE visit_id='0e447944-563d-4a32-bc35-242d6880c940'");
  await p.query("DELETE FROM cobrokits.payments WHERE visit_id='0e447944-563d-4a32-bc35-242d6880c940'");
  await p.query("DELETE FROM cobrokits.customer_visits WHERE id='0e447944-563d-4a32-bc35-242d6880c940'");
  await p.query("UPDATE cobrokits.seller_inventory SET quantity=5 WHERE seller_id='5529535a-d92a-4815-8f01-a54f891ee554' AND product_id='459c32f5-cb21-425f-8efc-a6b97b69ecb4'");
  const r = await p.query('SELECT quantity FROM cobrokits.seller_inventory WHERE seller_id=$1 AND product_id=$2', ['5529535a-d92a-4815-8f01-a54f891ee554','459c32f5-cb21-425f-8efc-a6b97b69ecb4']);
  console.log(r.rows[0]);
  await p.end();
})();
