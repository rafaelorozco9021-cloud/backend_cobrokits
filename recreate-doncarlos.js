require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

(async () => {
  await p.query('SET search_path TO cobrokits');

  const SELLER_ID = '69e12865-66e6-4096-8790-ec6f58c3a774';   // Sofia Herrera
  const COBRO_ID  = 'bb5c2f1b-2afc-494f-99db-66485bf0f7ec';   // cobro2miercoles
  const PROD = {
    salchichon: '459c32f5-cb21-425f-8efc-a6b97b69ecb4',  // 23500
    jamon:      'a14ac8a1-32f7-410d-a9d5-de8f45f8dbbe',  // 27500
    mortadela:  '0401e103-5797-4051-91c2-10e5868a4f4e',  // 13500
    longaniza:  'df834423-beab-460d-966d-ebb9e621e5c6',  // 15200
  };
  const VISIT_DATE = '2026-09-02 10:30:00-05';

  // 1) Cliente Don Carlos
  const cust = await p.query(`SELECT id FROM customers WHERE email='doncarlos@demo.cobrokits'`);
  let customerId;
  if (cust.rows.length) {
    customerId = cust.rows[0].id;
    console.log('Cliente ya existe:', customerId);
  } else {
    const cr = await p.query(
      `INSERT INTO customers (name, phone, email, address, seller_id, cobro_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      ['Don Carlos - Abarrotes', '3109991234', 'doncarlos@demo.cobrokits', 'Calle 45 #12-34 Barrio San Jose', SELLER_ID, COBRO_ID]
    );
    customerId = cr.rows[0].id;
    console.log('Cliente creado:', customerId);
  }

  // 2) Visita
  const v = await p.query(
    `INSERT INTO customer_visits (seller_id, visit_date, visit_day, is_closed, cobro_id)
     VALUES ($1, $2, 3, FALSE, $3) RETURNING id`,
    [SELLER_ID, VISIT_DATE, COBRO_ID]
  );
  const visitId = v.rows[0].id;
  console.log('Visita creada:', visitId);

  // 3) Items
  const items = [
    { pid: PROD.salchichon, qty: 2, up: 23500 },
    { pid: PROD.jamon,      qty: 1, up: 27500 },
    { pid: PROD.mortadela,  qty: 1, up: 13500 },
    { pid: PROD.longaniza,  qty: 1, up: 15200 },
  ];
  const venta = items.reduce((a, i) => a + i.qty * i.up, 0);
  for (const it of items) {
    await p.query(
      `INSERT INTO customer_visit_items (visit_id, product_id, quantity, unit_price) VALUES ($1,$2,$3,$4)`,
      [visitId, it.pid, it.qty, it.up]
    );
  }
  console.log('Items insertados, venta total:', venta);

  // 4) Pago abono 50,000
  const payment = 50000;
  await p.query(
    `INSERT INTO payments (seller_id, customer_id, cobro_id, visit_id, amount, payment_method, status, notes)
     VALUES ($1,$2,$3,$4,$5,'efectivo','completed','Abono parcial - Deuda pendiente 50,000')`,
    [SELLER_ID, customerId, COBRO_ID, visitId, payment]
  );
  console.log('Pago abono registrado: 50,000');

  // 5) Actualizar daily_seller_stock de Sofia para 2026-09-02
  await p.query(`
    INSERT INTO daily_seller_stock (seller_id, date, is_closed, total_sales, total_delivered)
    VALUES ($1, '2026-09-02', FALSE, $2, $2)
    ON CONFLICT (seller_id, date) DO UPDATE SET
      total_sales = COALESCE(daily_seller_stock.total_sales,0) + $2,
      total_delivered = COALESCE(daily_seller_stock.total_delivered,0) + $2
  `, [SELLER_ID, venta]);

  // 6) Descontar inventario del vendedor
  for (const it of items) {
    await p.query(`
      INSERT INTO seller_inventory (seller_id, product_id, quantity, cost_price)
      VALUES ($1,$2,0,0)
      ON CONFLICT (seller_id, product_id) DO UPDATE SET quantity = GREATEST(0, seller_inventory.quantity - $3)
    `, [SELLER_ID, it.pid, it.qty]);
  }

  console.log('\n=== RESUMEN Don Carlos ===');
  console.log('  Venta total (deuda):     $' + venta.toLocaleString());
  console.log('  Abono (pago parcial):    $' + payment.toLocaleString());
  console.log('  Deuda pendiente (SALDO ANT): $' + (venta - payment).toLocaleString());
  console.log('  Cliente:  Don Carlos - Abarrotes');
  console.log('  Vendedor: Sofia Herrera');
  console.log('  Cobro:    cobro2miercoles (Grupo Miercoles)');
  console.log('  Fecha:    2026-09-02 (miercoles)');

  await p.end();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
