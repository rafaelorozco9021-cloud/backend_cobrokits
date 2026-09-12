require('dotenv').config();
const { Pool } = require('pg');
const http = require('http');

function post(port, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const opts = { hostname: 'localhost', port, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...(token ? { Authorization: `Bearer ${token}` } : {}) } };
    const r = http.request(opts, (res) => { let s=''; res.on('data',c=>s+=c); res.on('end',()=>{ try{resolve({status:res.statusCode, body:JSON.parse(s)});}catch(e){resolve({status:res.statusCode, body:s})} }); });
    r.on('error', reject); r.write(data); r.end();
  });
}

(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  // login via API
  const loginRes = await post(3000, '/api/auth/login', { email: 'esperanza@demo.cobrokits', password: 'Esperanza2026!' });
  const token = loginRes.body.token;
  console.log('login', loginRes.status, 'user', loginRes.body.user.name, loginRes.body.user.id);
  const sellerId = '5529535a-d92a-4815-8f01-a54f891ee554'; // Ana Rojas
  const cobroId = '24f240a3-2003-4810-8c05-10cb9e1c5021'; // cobro1domingo
  const prodSal = await pool.query("SELECT id, price FROM cobrokits.products WHERE sku='DEMO-001'");
  const prodId = prodSal.rows[0].id;
  const price = prodSal.rows[0].price;
  console.log('prod', prodId, price);

  // clean first: ensure empty
  await pool.query('DELETE FROM cobrokits.seller_inventory WHERE seller_id=$1', [sellerId]);
  console.log('cleaned inventory');
  // assign 5
  const assign = await post(3000, '/api/inventory', { seller_id: sellerId, cobro_id: cobroId, items: [{ product_id: prodId, quantity: 5 }] }, token);
  console.log('assign', assign.status, assign.body);
  let inv = await pool.query('SELECT quantity FROM cobrokits.seller_inventory WHERE seller_id=$1 AND product_id=$2', [sellerId, prodId]);
  console.log('after assign quantity', inv.rows[0]?.quantity);

  // get a customer for Ana
  const cli = await pool.query("SELECT id FROM cobrokits.customers WHERE seller_id=$1 LIMIT 1", [sellerId]);
  const custId = cli.rows[0].id;
  console.log('customer', custId);

  // sale 2
  const sale = await post(3000, '/api/visits', {
    customerId: custId,
    sellerId: sellerId,
    cobroId: cobroId,
    items: [{ product_id: prodId, quantity: 2, unit_price: Number(price) }],
    payment: 20000,
    paymentMethod: 'efectivo',
    visitDate: new Date().toISOString()
  }, token);
  console.log('sale', sale.status, sale.body);
  inv = await pool.query('SELECT quantity FROM cobrokits.seller_inventory WHERE seller_id=$1 AND product_id=$2', [sellerId, prodId]);
  console.log('after sale quantity (expected 3)', inv.rows[0]?.quantity);

  // check last visit
  const vis = await pool.query('SELECT id FROM cobrokits.customer_visits WHERE seller_id=$1 ORDER BY visit_date DESC LIMIT 1', [sellerId]);
  const vid = vis.rows[0].id;
  const items = await pool.query('SELECT product_id, quantity FROM cobrokits.customer_visit_items WHERE visit_id=$1', [vid]);
  console.log('last visit items', items.rows);

  await pool.end();
})();
