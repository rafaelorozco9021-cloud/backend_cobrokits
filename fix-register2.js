require('dotenv').config();
const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  await p.query(`
    CREATE OR REPLACE FUNCTION cobrokits.register_customer_visit(
      p_customer_id UUID, p_seller_id UUID, p_items JSONB, p_payment NUMERIC(14,2),
      p_method cobrokits.payment_method, p_notes TEXT, p_date TIMESTAMP WITH TIME ZONE
    ) RETURNS UUID AS $$
    DECLARE v_visit_day INTEGER; v_seller_stock UUID; v_visit_closed BOOLEAN; v_result UUID; v_item RECORD; v_total NUMERIC(14,2):=0;
    BEGIN
      v_visit_day := EXTRACT(DOW FROM p_date AT TIME ZONE 'America/Bogota');
      SELECT id INTO v_seller_stock FROM cobrokits.daily_seller_stock WHERE seller_id=p_seller_id AND date=(p_date AT TIME ZONE 'America/Bogota')::date;
      IF FOUND THEN
        SELECT is_closed INTO v_visit_closed FROM cobrokits.daily_seller_stock WHERE seller_id=p_seller_id AND date=(p_date AT TIME ZONE 'America/Bogota')::date;
        IF v_visit_closed THEN RAISE EXCEPTION 'El día de cobro ya está cerrado para este vendedor'; END IF;
      END IF;
      INSERT INTO cobrokits.customer_visits (seller_id, visit_date, visit_day, is_closed) VALUES (p_seller_id, p_date, v_visit_day, FALSE) RETURNING id INTO v_result;
      FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS item(product_id UUID, quantity INTEGER, unit_price NUMERIC(14,2)) LOOP
        INSERT INTO cobrokits.customer_visit_items (visit_id, product_id, quantity, unit_price) VALUES (v_result, v_item.product_id, v_item.quantity, v_item.unit_price);
        v_total := v_total + (v_item.unit_price * v_item.quantity);
        UPDATE cobrokits.seller_inventory SET quantity=GREATEST(0, quantity - v_item.quantity), updated_at=NOW() WHERE seller_id=p_seller_id AND product_id=v_item.product_id;
      END LOOP;
      IF p_payment > 0 THEN INSERT INTO cobrokits.payments (seller_id, customer_id, amount, payment_method, status, notes, visit_id) VALUES (p_seller_id, p_customer_id, p_payment, p_method, 'completed', p_notes, v_result); END IF;
      UPDATE cobrokits.daily_seller_stock dss SET total_sales=COALESCE(dss.total_sales,0)+v_total, total_delivered=COALESCE(dss.total_delivered,0)+v_total, total_sold=COALESCE(dss.total_sold,0)+COALESCE((SELECT SUM(quantity) FROM jsonb_to_recordset(p_items) AS item(quantity INTEGER)),0), updated_at=NOW() WHERE dss.seller_id=p_seller_id AND dss.date=(p_date AT TIME ZONE 'America/Bogota')::date;
      RETURN v_result;
    END; $$ LANGUAGE plpgsql;
  `);
  console.log('register fixed to use SELECT *');
  // test again
  const pool2 = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool2.query("SELECT cobrokits.register_customer_visit('ef899fcb-fde5-42ec-9134-a9ce9cf34791'::uuid, '5529535a-d92a-4815-8f01-a54f891ee554'::uuid, '[{\"product_id\":\"459c32f5-cb21-425f-8efc-a6b97b69ecb4\",\"quantity\":1,\"unit_price\":23500}]'::jsonb, 10000, 'efectivo'::cobrokits.payment_method, 'test', NOW()) as vid");
  console.log('direct function test', r.rows[0]);
  const inv = await pool2.query('SELECT quantity FROM cobrokits.seller_inventory WHERE seller_id=$1 AND product_id=$2', ['5529535a-d92a-4815-8f01-a54f891ee554','459c32f5-cb21-425f-8efc-a6b97b69ecb4']);
  console.log('after direct call quantity', inv.rows[0]?.quantity);
  await pool2.end();
  await p.end();
})();
