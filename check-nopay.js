require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  await pool.query('SET search_path TO cobrokits,public');
  // Visitas SIN payment (deuda)
  const res = await pool.query(`
    SELECT cv.id, cv.visit_date::date as fecha, s.name as vendedor,
      COUNT(cvi.id) as num_items,
      SUM(cvi.quantity * cvi.unit_price) as venta,
      (SELECT COUNT(*) FROM payments p WHERE p.visit_id=cv.id) as num_pagos
    FROM customer_visits cv
    JOIN sellers s ON s.id=cv.seller_id
    LEFT JOIN customer_visit_items cvi ON cvi.visit_id=cv.id
    LEFT JOIN payments p ON p.visit_id=cv.id
    WHERE p.id IS NULL
    GROUP BY cv.id, cv.visit_date, s.name
    ORDER BY cv.visit_date
  `);
  console.log('=== VISITAS SIN PAGO (deuda) ===');
  for (const v of res.rows) {
    console.log(`${v.fecha} | ${v.vendedor} | cliente=${v.cliente} | items=${v.num_items} | venta=${v.venta}`);
  }

  // Ver si las visitas del seed tienen customer_id en la tabla customer_visits
  const cvCols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='cobrokits' AND table_name='customer_visits'`);
  console.log('\nColumnas customer_visits:', cvCols.rows.map(r=>r.column_name).join(', '));

  // Payments con visit_id nulo u otros
  const orphans = await pool.query(`SELECT COUNT(*) as total FROM payments WHERE visit_id IS NULL`);
  console.log('\nPayments sin visit_id:', orphans.rows[0].total);

  await pool.end();
}
main().catch(e => console.log('ERR:', e.message));