-- ============================================================
-- CobroKits  - Esquema NUEVO completo para el backend actual
-- ============================================================

CREATE SCHEMA IF NOT EXISTS cobrokits;
SET search_path TO cobrokits,public;
SET timezone = 'America/Bogota';

-- ============================================================
-- Enums
-- ============================================================
CREATE TYPE seller_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE inventory_movement_type AS ENUM ('entry', 'exit', 'adjustment');
CREATE TYPE payment_method AS ENUM ('efectivo', 'nequi', 'transferencia', 'tarjeta');

-- ============================================================
-- sellers
-- ============================================================
CREATE TABLE sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  phone VARCHAR(50),
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'seller',
  empresa_id UUID REFERENCES sellers(id),
  status seller_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- products
-- ============================================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
  cost_price NUMERIC(14,2) DEFAULT 0,
  category VARCHAR(100),
  stock INTEGER DEFAULT 0,
  sku VARCHAR(50),
  seller_id UUID REFERENCES sellers(id),
  empresa_id UUID REFERENCES sellers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- cobros
-- ============================================================
CREATE TABLE cobros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  dia INTEGER NOT NULL CHECK (dia BETWEEN 0 AND 6),
  dia_nombre VARCHAR(20) NOT NULL,
  grupo VARCHAR(100) NOT NULL,
  seller_id UUID REFERENCES sellers(id),
  empresa_id UUID REFERENCES sellers(id),
  recorrido VARCHAR(200),
  observacion TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- customers
-- ============================================================
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(200),
  address TEXT,
  seller_id UUID REFERENCES sellers(id),
  cobro_id UUID REFERENCES cobros(id),
  empresa_id UUID REFERENCES sellers(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- cobro_sellers
-- ============================================================
CREATE TABLE cobro_sellers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) NOT NULL,
  cobro_name VARCHAR(200) NOT NULL,
  commission_percentage NUMERIC(5,2) DEFAULT 0 CHECK (commission_percentage >= 0 AND commission_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- seller_inventory
-- ============================================================
CREATE TABLE seller_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
  cost_price NUMERIC(14,2) DEFAULT 0 CHECK (cost_price >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (seller_id, product_id)
);

-- ============================================================
-- inventory_movements
-- ============================================================
CREATE TABLE inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  type inventory_movement_type NOT NULL,
  quantity INTEGER NOT NULL CHECK (ABS(quantity) > 0),
  previous_quantity INTEGER DEFAULT 0,
  new_quantity INTEGER DEFAULT 0,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- ============================================================
-- customer_visits
-- ============================================================
CREATE TABLE customer_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) NOT NULL,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL,
  visit_day INTEGER NOT NULL CHECK (visit_day BETWEEN 0 AND 6),
  is_closed BOOLEAN DEFAULT FALSE,
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID REFERENCES sellers(id),
  cobro_id UUID REFERENCES cobros(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- customer_visit_items
-- ============================================================
CREATE TABLE customer_visit_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_id UUID REFERENCES customer_visits(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(14,2) NOT NULL CHECK (unit_price >= 0),
  total_price NUMERIC(14,2) GENERATED ALWAYS AS (unit_price * quantity) STORED
);

-- ============================================================
-- payments
-- ============================================================
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  cobro_seller_id UUID REFERENCES cobro_sellers(id),
  cobro_id UUID REFERENCES cobros(id),
  visit_id UUID REFERENCES customer_visits(id),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  payment_method payment_method NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'refunded')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- daily_seller_stock
-- ============================================================
CREATE TABLE daily_seller_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) NOT NULL,
  date DATE NOT NULL,
  is_closed BOOLEAN DEFAULT FALSE,
  closed_at TIMESTAMP WITH TIME ZONE,
  total_cash NUMERIC(14,2) DEFAULT 0,
  total_nequi NUMERIC(14,2) DEFAULT 0,
  total_sales NUMERIC(14,2) DEFAULT 0,
  total_delivered NUMERIC(14,2) DEFAULT 0,
  total_sold NUMERIC(14,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (seller_id, date)
);

-- ============================================================
-- warehouse_stock
-- ============================================================
CREATE TABLE warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  total_quantity INTEGER DEFAULT 0 CHECK (total_quantity >= 0),
  reserved_quantity INTEGER DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity INTEGER GENERATED ALWAYS AS (total_quantity - reserved_quantity) STORED,
  last_restock DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- warehouse_stock_entries
-- ============================================================
CREATE TABLE warehouse_stock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  entry_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  entry_by UUID REFERENCES sellers(id),
  notes TEXT
);

-- ============================================================
-- daily_seller_entries
-- ============================================================
CREATE TABLE daily_seller_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID REFERENCES sellers(id) NOT NULL,
  date DATE NOT NULL,
  entry_type VARCHAR(50) NOT NULL CHECK (entry_type IN ('cobro', 'ajuste', 'devolucion')),
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  payment_method payment_method,
  reference_id UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- Views
-- ============================================================
CREATE OR REPLACE VIEW v_daily_seller_performance AS
SELECT
  s.id as seller_id,
  s.name as seller_name,
  d.date,
  d.total_sales,
  d.total_delivered,
  d.total_sold,
  d.is_closed,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'efectivo'), 0) as efectivo,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'nequi'), 0) as nequi,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'transferencia'), 0) as transferencia,
  COALESCE(SUM(p.amount) FILTER (WHERE p.payment_method = 'tarjeta'), 0) as tarjeta
FROM sellers s
LEFT JOIN daily_seller_stock d ON s.id = d.seller_id
LEFT JOIN payments p ON p.seller_id = s.id AND p.created_at::date = d.date
GROUP BY s.id, s.name, d.date, d.total_sales, d.total_delivered, d.total_sold, d.is_closed;

CREATE OR REPLACE VIEW v_dashboard_totals AS
SELECT
  COUNT(s.id) as total_sellers,
  COUNT(s.id) FILTER (WHERE s.status = 'active') as active_sellers,
  COALESCE(SUM(d.total_sales), 0) as total_sales,
  COALESCE(SUM(d.total_delivered), 0) as total_delivered,
  COALESCE(SUM(d.total_sold), 0) as total_sold,
  COUNT(DISTINCT p.id) as total_products,
  COUNT(DISTINCT c.id) as total_customers
FROM sellers s
LEFT JOIN daily_seller_stock d ON s.id = d.seller_id
LEFT JOIN products p ON TRUE
LEFT JOIN customers c ON TRUE;

-- ============================================================
-- Functions
-- ============================================================

-- register_customer_visit: crea visita, items y pago
CREATE OR REPLACE FUNCTION register_customer_visit(
  p_customer_id UUID,
  p_seller_id UUID,
  p_items JSONB,
  p_payment NUMERIC(14,2),
  p_method payment_method,
  p_notes TEXT,
  p_date TIMESTAMP WITH TIME ZONE
)
RETURNS UUID AS $$
DECLARE
  v_visit_day INTEGER;
  v_seller_stock UUID;
  v_visit_closed BOOLEAN;
  v_result UUID;
  v_item RECORD;
  v_total NUMERIC(14,2) := 0;
BEGIN
  v_visit_day := EXTRACT(DOW FROM p_date AT TIME ZONE 'America/Bogota');

  SELECT id INTO v_seller_stock FROM daily_seller_stock WHERE seller_id = p_seller_id AND date = (p_date AT TIME ZONE 'America/Bogota')::date;
  IF FOUND THEN
    SELECT is_closed INTO v_visit_closed FROM daily_seller_stock WHERE seller_id = p_seller_id AND date = (p_date AT TIME ZONE 'America/Bogota')::date;
    IF v_visit_closed THEN
      RAISE EXCEPTION 'El día de cobro ya está cerrado para este vendedor';
    END IF;
  END IF;

  INSERT INTO customer_visits (seller_id, visit_date, visit_day, is_closed)
  VALUES (p_seller_id, p_date, v_visit_day, FALSE)
  RETURNING id INTO v_result;

  FOR v_item IN
    SELECT
      (item->>'product_id')::UUID AS product_id,
      (item->>'quantity')::INTEGER AS quantity,
      (item->>'unit_price')::NUMERIC(14,2) AS unit_price
    FROM jsonb_to_recordset(p_items) AS item(
      product_id UUID, quantity INTEGER, unit_price NUMERIC(14,2)
    )
  LOOP
    INSERT INTO customer_visit_items (visit_id, product_id, quantity, unit_price, total_price)
    VALUES (v_result, v_item.product_id, v_item.quantity, v_item.unit_price, v_item.unit_price * v_item.quantity);
    v_total := v_total + (v_item.unit_price * v_item.quantity);
    -- Descontar inventario del vendedor
    UPDATE seller_inventory SET quantity = GREATEST(0, quantity - v_item.quantity), updated_at = NOW()
    WHERE seller_id = p_seller_id AND product_id = v_item.product_id;
  END LOOP;

  IF p_payment > 0 THEN
    INSERT INTO payments (seller_id, customer_id, amount, payment_method, status, notes, visit_id)
    VALUES (p_seller_id, p_customer_id, p_payment, p_method, 'completed', p_notes, v_result);
  END IF;

  UPDATE daily_seller_stock dss
  SET
    total_sales = COALESCE(dss.total_sales, 0) + v_total,
    total_delivered = COALESCE(dss.total_delivered, 0) + v_total,
    total_sold = COALESCE(dss.total_sold, 0) + COALESCE((SELECT quantity FROM jsonb_to_recordset(p_items) AS item(quantity INTEGER) LIMIT 1), 0),
    updated_at = NOW()
  WHERE dss.seller_id = p_seller_id AND dss.date = (p_date AT TIME ZONE 'America/Bogota')::date;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- get_collection_target
CREATE OR REPLACE FUNCTION get_collection_target(
  p_seller_id UUID,
  p_date DATE
)
RETURNS NUMERIC(14,2) AS $$
DECLARE
  v_target NUMERIC(14,2) := 0;
BEGIN
  SELECT COALESCE(SUM(si.quantity * si.cost_price), 0) INTO v_target
  FROM seller_inventory si
  WHERE si.seller_id = p_seller_id;
  RETURN v_target;
END;
$$ LANGUAGE plpgsql STRICT;

-- close_seller_day
CREATE OR REPLACE FUNCTION close_seller_day(
  p_seller_id UUID,
  p_date DATE
)
RETURNS JSON AS $$
DECLARE
  v_daily_stock daily_seller_stock%ROWTYPE;
  v_delivered NUMERIC(14,2);
  v_sold NUMERIC(14,2);
  v_return_quantity NUMERIC(14,2);
  v_result JSON;
BEGIN
  SELECT * INTO v_daily_stock FROM daily_seller_stock WHERE seller_id = p_seller_id AND date = p_date;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No hay stock diario para este vendedor en la fecha especificada';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_delivered FROM payments
  WHERE seller_id = p_seller_id AND created_at::date = p_date AND status = 'completed';

  v_sold := COALESCE(v_daily_stock.total_sold, 0);
  v_return_quantity := v_delivered - v_sold;

  UPDATE daily_seller_stock
  SET is_closed = TRUE, closed_at = NOW(), total_cash = v_delivered
  WHERE id = v_daily_stock.id;

  v_result := jsonb_build_object(
    'seller_id', p_seller_id,
    'date', p_date,
    'total_delivered', v_delivered,
    'total_sold', v_sold,
    'returned_to_warehouse', v_return_quantity,
    'is_closed', TRUE
  );
  RETURN v_result;
END;
$$ LANGUAGE plpgsql STRICT;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_sellers_email ON cobrokits.sellers(email);
CREATE INDEX idx_products_seller ON cobrokits.products(seller_id);
CREATE INDEX idx_customers_phone ON cobrokits.customers(phone);
CREATE INDEX idx_cobro_sellers_seller ON cobrokits.cobro_sellers(seller_id);
CREATE INDEX idx_seller_inventory_seller ON cobrokits.seller_inventory(seller_id);
CREATE INDEX idx_seller_inventory_product ON cobrokits.seller_inventory(product_id);
CREATE INDEX idx_inventory_movements_seller ON cobrokits.inventory_movements(seller_id);
CREATE INDEX idx_inventory_movements_product ON cobrokits.inventory_movements(product_id);
CREATE INDEX idx_customer_visits_seller ON cobrokits.customer_visits(seller_id);
CREATE INDEX idx_customer_visits_date ON cobrokits.customer_visits(visit_date);
CREATE INDEX idx_visit_items_visit ON cobrokits.customer_visit_items(visit_id);
CREATE INDEX idx_payments_seller ON cobrokits.payments(seller_id);
CREATE INDEX idx_payments_method ON cobrokits.payments(payment_method);
CREATE INDEX idx_daily_seller_stock_seller_date ON cobrokits.daily_seller_stock(seller_id, date);
CREATE INDEX idx_warehouse_stock_product ON cobrokits.warehouse_stock(product_id);
CREATE INDEX idx_warehouse_stock_entries_product ON cobrokits.warehouse_stock_entries(product_id);
CREATE INDEX idx_daily_seller_entries_seller ON cobrokits.daily_seller_entries(seller_id);
CREATE INDEX idx_daily_seller_entries_date ON cobrokits.daily_seller_entries(date);

-- Seguridad: NO otorgar privilegios a PUBLIC. El rol de la app es propietario del schema.
-- Si tu BD heredó los grant viejos, ejecuta en producción:
--   REVOKE ALL ON ALL TABLES IN SCHEMA cobrokits FROM PUBLIC;
--   REVOKE ALL ON ALL SEQUENCES IN SCHEMA cobrokits FROM PUBLIC;
--   REVOKE ALL ON ALL FUNCTIONS IN SCHEMA cobrokits FROM PUBLIC;
-- ... y otorga solo a tu rol de aplicación:
--   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA cobrokits TO <rol_app>;
