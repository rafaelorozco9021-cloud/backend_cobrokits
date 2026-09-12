require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query('SET search_path TO cobrokits,public');
  // Visitas con deuda: ver payments asociados
  const visits = await pool.query(`
    SELECT cv.id, cv.visit_date::date as fecha, s.name as vendedor,
      (SELECT SUM(quantity*unit_price) FROM customer_visit_items WHERE visit_id=cv.id) as venta,
      (SELECT amount FROM payments WHERE visit_id=cv.id) as pago,
      (SELECT payment_method FROM payments WHERE visit_id=cv.id) as metodo
    FROM customer_visits cv
    JOIN sellers s ON s.id=cv.seller_id
    ORDER BY cv.visit_date DESC
    LIMIT 30
  `);
  console.log('=== TODAS LAS VISITAS (con venta y pago) ===');
  for (const v of visits.rows) {
    console.log(`${v.fecha} | ${v.vendedor} | venta=${v.venta} pago=${v.pago} metodo=${v.metodo} deuda=${Number(v.venta||0)-Number(v.pago||0)}`);
  }
  await pool.end();
}
main().catch(e => console.log('ERR:', e.message));