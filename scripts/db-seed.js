require('dotenv').config();
const { Pool } = require('pg');

async function runSeed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('❌ ERROR: DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  await pool.query('SET search_path TO cobrokits,public');
  await pool.query("SET timezone = 'America/Bogota'");

  try {
    // Seed sample sellers
    await pool.query(
      `INSERT INTO sellers (id, name, email, phone, status) VALUES 
        ('${generateUuid()}', 'Juan Pérez', 'juan@cobrokits.com', '3001234567', 'active'),
        ('${generateUuid()}', 'María Gómez', 'maria@cobrokits.com', '3007654321', 'active'),
        ('${generateUuid()}', 'Carlos Rodríguez', 'carlos@cobrokits.com', '3005550123', 'inactive')
      ON CONFLICT DO NOTHING`
    );

    // Seed sample products
    await pool.query(
      `INSERT INTO products (id, name, description, price, seller_id) VALUES 
        ('${generateUuid()}', 'Arroz 1kg', 'Arroz de primera calidad', 4500, (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1)),
        ('${generateUuid()}', 'Frijoles 500g', 'Frijoles seleccionados', 3200, (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1)),
        ('${generateUuid()}', 'Azúcar 1kg', 'Azúcar refinada', 2800, (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1))
      ON CONFLICT DO NOTHING`
    );

    // Seed sample warehouse stock
    await pool.query(
      `INSERT INTO warehouse_stock (id, product_id, total_quantity, reserved_quantity, last_restock) VALUES 
        ('${generateUuid()}', (SELECT id FROM products WHERE name = 'Arroz 1kg' LIMIT 1), 100, 0, CURRENT_DATE),
        ('${generateUuid()}', (SELECT id FROM products WHERE name = 'Frijoles 500g' LIMIT 1), 200, 0, CURRENT_DATE),
        ('${generateUuid()}', (SELECT id FROM products WHERE name = 'Azúcar 1kg' LIMIT 1), 150, 0, CURRENT_DATE)`
    );

    // Seed sample seller inventory
    await pool.query(
      `INSERT INTO seller_inventory (id, seller_id, product_id, quantity, cost_price) VALUES 
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), (SELECT id FROM products WHERE name = 'Arroz 1kg' LIMIT 1), 50, 4000),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), (SELECT id FROM products WHERE name = 'Frijoles 500g' LIMIT 1), 100, 3000),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1), (SELECT id FROM products WHERE name = 'Azúcar 1kg' LIMIT 1), 75, 2500)
      ON CONFLICT (seller_id, product_id) DO NOTHING`
    );

    // Sample cobro_sellers
    await pool.query(
      `INSERT INTO cobro_sellers (id, seller_id, cobro_name, commission_percentage) VALUES 
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), 'Cobro Semanal', 10.00),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1), 'Cobro Quincenal', 15.00)
      ON CONFLICT DO NOTHING`
    );

    // Sample customers
    await pool.query(
      `INSERT INTO customers (id, name, phone, email, address) VALUES 
        ('${generateUuid()}', 'Cliente A', '3101111111', 'clientea@test.com', 'Calle 1 #1-1'),
        ('${generateUuid()}', 'Cliente B', '3102222222', 'clienteb@test.com', 'Calle 2 #2-2'),
        ('${generateUuid()}', 'Cliente C', '3103333333', 'clientec@test.com', 'Calle 3 #3-3')
      ON CONFLICT DO NOTHING`
    );

    // Sample daily seller stock for today
    await pool.query(
      `INSERT INTO daily_seller_stock (id, seller_id, date, is_closed) VALUES 
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), CURRENT_DATE, FALSE),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1), CURRENT_DATE, FALSE)
      ON CONFLICT (seller_id, date) DO NOTHING`
    );

    // Sample inventory movements
    await pool.query(
      `INSERT INTO inventory_movements (id, seller_id, product_id, type, quantity, previous_quantity, new_quantity, reason) VALUES 
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), (SELECT id FROM products WHERE name = 'Arroz 1kg' LIMIT 1), 'exit', 10, 50, 40, 'Venta al cliente'),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1), (SELECT id FROM products WHERE name = 'Azúcar 1kg' LIMIT 1), 'exit', 5, 75, 70, 'Venta al cliente')
      ON CONFLICT DO NOTHING`
    );

    // Sample payments
    await pool.query(
      `INSERT INTO payments (id, seller_id, customer_id, amount, payment_method, status, notes, visit_id) VALUES 
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), (SELECT id FROM customers WHERE name = 'Cliente A' LIMIT 1), 4500, 'efectivo', 'completed', 'Pago arroz', NULL),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1), (SELECT id FROM customers WHERE name = 'Cliente B' LIMIT 1), 3200, 'nequi', 'completed', 'Pago frijoles', NULL)
      ON CONFLICT DO NOTHING`
    );

    // Sample customer visits
    await pool.query(
      `INSERT INTO customer_visits (id, seller_id, visit_date, visit_day, is_closed) VALUES 
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), CURRENT_DATE, EXTRACT(DOW FROM CURRENT_DATE AT TIME ZONE 'America/Bogota'), FALSE),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1), CURRENT_DATE, EXTRACT(DOW FROM CURRENT_DATE AT TIME ZONE 'America/Bogota'), FALSE)
      ON CONFLICT DO NOTHING`
    );

    // Sample customer visit items
    await pool.query(
      `INSERT INTO customer_visit_items (id, visit_id, product_id, quantity, unit_price) VALUES 
        ('${generateUuid()}', (SELECT id FROM customer_visits WHERE seller_id = (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1)), (SELECT id FROM products WHERE name = 'Arroz 1kg' LIMIT 1), 2, 4500),
        ('${generateUuid()}', (SELECT id FROM customer_visits WHERE seller_id = (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1)), (SELECT id FROM products WHERE name = 'Azúcar 1kg' LIMIT 1), 1, 2800)
      ON CONFLICT DO NOTHING`
    );

    // Sample daily seller entries
    await pool.query(
      `INSERT INTO daily_seller_entries (id, seller_id, date, entry_type, amount, payment_method, notes) VALUES 
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'juan@cobrokits.com' LIMIT 1), CURRENT_DATE, 'cobro', 4500, 'efectivo', 'Pago de arroz'),
        ('${generateUuid()}', (SELECT id FROM sellers WHERE email = 'maria@cobrokits.com' LIMIT 1), CURRENT_DATE, 'cobro', 3200, 'nequi', 'Pago de azúcar')
      ON CONFLICT DO NOTHING`
    );

    console.log('✅ Database seeded successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Database seeding failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

runSeed();