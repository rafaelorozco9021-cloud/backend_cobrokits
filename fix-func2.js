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
      FOR v_item IN SELECT (item->>'product_id')::UUID AS product_id, (item->>'quantity')::INTEGER AS quantity, (item->>'unit_price')::NUMERIC(14,2) AS unit_price FROM jsonb_to_recordset(p_items) AS item(product_id UUID, quantity INTEGER, unit_price NUMERIC(14,2)) LOOP
        INSERT INTO cobrokits.customer_visit_items (visit_id, product_id, quantity, unit_price) VALUES (v_result, v_item.product_id, v_item.quantity, v_item.unit_price);
        v_total := v_total + (v_item.unit_price * v_item.quantity);
        UPDATE cobrokits.seller_inventory SET quantity=GREATEST(0, quantity - v_item.quantity), updated_at=NOW() WHERE seller_id=p_seller_id AND product_id=v_item.product_id;
      END LOOP;
      IF p_payment > 0 THEN INSERT INTO cobrokits.payments (seller_id, customer_id, amount, payment_method, status, notes, visit_id) VALUES (p_seller_id, p_customer_id, p_payment, p_method, 'completed', p_notes, v_result); END IF;
      UPDATE cobrokits.daily_seller_stock dss SET total_sales=COALESCE(dss.total_sales,0)+v_total, total_delivered=COALESCE(dss.total_delivered,0)+v_total, total_sold=COALESCE(dss.total_sold,0)+COALESCE((SELECT quantity FROM jsonb_to_recordset(p_items) AS item(quantity INTEGER) LIMIT 1),0), updated_at=NOW() WHERE dss.seller_id=p_seller_id AND dss.date=(p_date AT TIME ZONE 'America/Bogota')::date;
      RETURN v_result;
    END; $$ LANGUAGE plpgsql;
  `);
  console.log('register fixed');
  await p.query(`
    CREATE OR REPLACE FUNCTION cobrokits.close_seller_day(p_seller_id UUID, p_date DATE) RETURNS JSON AS $$
    DECLARE v_daily_stock cobrokits.daily_seller_stock%ROWTYPE; v_delivered NUMERIC(14,2); v_sold NUMERIC(14,2); v_return_quantity NUMERIC(14,2); v_result JSON;
    BEGIN
      SELECT * INTO v_daily_stock FROM cobrokits.daily_seller_stock WHERE seller_id=p_seller_id AND date=p_date;
      IF NOT FOUND THEN RAISE EXCEPTION 'No hay stock diario para este vendedor en la fecha especificada'; END IF;
      SELECT COALESCE(SUM(amount),0) INTO v_delivered FROM cobrokits.payments WHERE seller_id=p_seller_id AND created_at::date=p_date AND status='completed';
      v_sold := COALESCE(v_daily_stock.total_sold,0);
      v_return_quantity := v_delivered - v_sold;
      UPDATE cobrokits.daily_seller_stock SET is_closed=TRUE, closed_at=NOW(), total_cash=v_delivered WHERE id=v_daily_stock.id;
      v_result := jsonb_build_object('seller_id',p_seller_id,'date',p_date,'total_delivered',v_delivered,'total_sold',v_sold,'returned_to_warehouse',v_return_quantity,'is_closed',TRUE);
      RETURN v_result;
    END; $$ LANGUAGE plpgsql STRICT;
  `);
  console.log('close fixed');
  await p.end();
})().catch(e=>{console.log('ERR',e.message);process.exit(1)});
