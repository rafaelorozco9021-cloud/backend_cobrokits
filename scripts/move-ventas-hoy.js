require('dotenv').config();
const { Pool } = require('pg');

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await pool.query('SET search_path TO cobrokits,public');
  await pool.query("SET timezone = 'America/Bogota'");
  console.log('📅 Moviendo algunas ventas al día de hoy (2026-09-01)...');

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }); // YYYY-MM-DD
  console.log('Hoy considerado:', todayStr);

  // Seleccionar 10 visitas aleatorias que NO son de hoy
  const toMove = await pool.query(`
    SELECT cv.id, cv.seller_id, cv.visit_date, p.amount, p.id as payment_id
    FROM customer_visits cv
    JOIN payments p ON p.visit_id = cv.id
    WHERE cv.visit_date::date != $1::date
    ORDER BY random()
    LIMIT 10
  `, [todayStr]);

  console.log(`  Ventas a mover: ${toMove.rowCount}`);
  if (toMove.rowCount === 0) {
    console.log('  No hay ventas fuera de hoy para mover.');
    await pool.end();
    return;
  }

  for (const row of toMove.rows) {
    const visitId = row.id;
    const sellerId = row.seller_id;
    const oldDate = new Date(row.visit_date).toISOString().split('T')[0];
    const amount = Number(row.amount);
    // Calcular total items cantidad para total_sold
    const itemsRes = await pool.query(`SELECT SUM(quantity)::int as qty FROM customer_visit_items WHERE visit_id=$1`, [visitId]);
    const qty = itemsRes.rows[0]?.qty || 1;

    const newVisitDate = new Date();
    // Hora aleatoria hoy 9-17
    newVisitDate.setHours(9 + Math.floor(Math.random()*8), Math.floor(Math.random()*60), 0, 0);

    // Actualizar visit
    await pool.query(`UPDATE customer_visits SET visit_date=$1, visit_day=$2 WHERE id=$3`, [newVisitDate.toISOString(), newVisitDate.getDay(), visitId]);
    // Actualizar payment
    await pool.query(`UPDATE payments SET created_at=$1, updated_at=NOW() WHERE id=$2`, [newVisitDate.toISOString(), row.payment_id]);

    // Ajustar daily_seller_stock origen (restar)
    await pool.query(`UPDATE daily_seller_stock SET total_sales = GREATEST(0, COALESCE(total_sales,0) - $3), total_delivered = GREATEST(0, COALESCE(total_delivered,0) - $3), total_sold = GREATEST(0, COALESCE(total_sold,0) - $4), updated_at=NOW() WHERE seller_id=$1 AND date=$2::date`, [sellerId, oldDate, amount, qty]);
    // Asegurar destino hoy
    await pool.query(`INSERT INTO daily_seller_stock (seller_id, date, is_closed) VALUES ($1,$2::date,FALSE) ON CONFLICT (seller_id, date) DO NOTHING`, [sellerId, todayStr]);
    await pool.query(`UPDATE daily_seller_stock SET total_sales = COALESCE(total_sales,0)+$3, total_delivered = COALESCE(total_delivered,0)+$3, total_sold = COALESCE(total_sold,0)+$4, updated_at=NOW() WHERE seller_id=$1 AND date=$2::date`, [sellerId, todayStr, amount, qty]);

    // daily_seller_entries mover
    await pool.query(`UPDATE daily_seller_entries SET date=$1::date WHERE reference_id=$2 OR (seller_id=$3 AND amount=$4 AND date=$5::date)`, [todayStr, visitId, sellerId, amount, oldDate]);

    console.log(`  ✓ ${visitId.slice(0,8)} ${row.amount} ${oldDate} → ${todayStr} seller ${sellerId.slice(0,8)} qty ${qty}`);
  }

  // Verificación
  const balHoy = await pool.query(`SELECT seller_id, total_sales, total_sold FROM daily_seller_stock WHERE date=$1::date ORDER BY total_sales DESC`, [todayStr]);
  console.log(`\n📊 Balances hoy ${todayStr}: ${balHoy.rowCount} filas`);
  console.table(balHoy.rows.map(r=> ({ seller: r.seller_id.slice(0,8), sales: r.total_sales, sold: r.total_sold })));

  const week = await pool.query(`
    SELECT d.date::date as fecha, COUNT(p.id) as pagos, SUM(p.amount) as total
    FROM daily_seller_stock d
    LEFT JOIN payments p ON p.seller_id=d.seller_id AND p.created_at::date=d.date
    WHERE d.date BETWEEN (CURRENT_DATE - interval '6 days')::date AND CURRENT_DATE
    GROUP BY d.date ORDER BY d.date
  `);
  console.log('\n📅 Semana (últimos 7 días):');
  console.table(week.rows);

  await pool.end();
  console.log('\n✅ Listo. Refresca /dashboard para ver cambios (POR COBRAR, NEQUI, EFECTIVO, PRODUCCION HOY y gráficas).');
}

run().catch(e=>{ console.error(e); process.exit(1)});
