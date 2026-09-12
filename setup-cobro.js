require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  // Get cobros for miercoles
  const cobros = await pool.query('SELECT * FROM cobrokits.cobros WHERE dia = 3 ORDER BY name');
  console.log('COBROS MIERCOLES:', JSON.stringify(cobros.rows, null, 2));

  // Get sellers
  const sellers = await pool.query('SELECT id, name, email, role FROM cobrokits.sellers ORDER BY name');
  console.log('\nSELLERS:', JSON.stringify(sellers.rows.map(s => ({ id: s.id, name: s.name, email: s.email, role: s.role })), null, 2));

  // Get products demo
  const products = await pool.query("SELECT id, name, price, cost_price, category, sku FROM cobrokits.products WHERE sku LIKE 'DEMO-%' ORDER BY sku LIMIT 10");
  console.log('\nPRODUCTOS:', JSON.stringify(products.rows, null, 2));

  // Get customers for Sofia Herrera (vendedor33)
  const sofiaId = '477e1d4a-2795-4c62-8b04-4b6591077eee';
  const customers = await pool.query('SELECT id, name, seller_id, cobro_id FROM cobrokits.customers WHERE seller_id = $1 OR cobro_id IS NOT NULL LIMIT 10', [sofiaId]);
  console.log('\nCLIENTES (Sofia):', JSON.stringify(customers.rows, null, 2));

  // Check visits for Sofia on day 3 (miercoles)
  const visits = await pool.query("SELECT id, seller_id, cobro_id, visit_date, visit_day, is_closed FROM cobrokits.customer_visits WHERE seller_id = $1 AND visit_day = 3 ORDER BY visit_date DESC LIMIT 5", [sofiaId]);
  console.log('\nVISITAS MIERCOLES:', JSON.stringify(visits.rows, null, 2));

  // Check all customers that have cobro_id set
  const customersWithCobro = await pool.query('SELECT id, name, seller_id, cobro_id FROM cobrokits.customers WHERE cobro_id IS NOT NULL LIMIT 10');
  console.log('\nCLIENTES CON COBRO_ID:', JSON.stringify(customersWithCobro.rows, null, 2));

  await pool.end();
}
main().catch(e => console.log('ERR:', e.message));