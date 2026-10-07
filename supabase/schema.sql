-- ═══════════════════════════════════════════════════════════════
-- GadgetStock — Supabase PostgreSQL Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ─── Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── 1. Profiles (extends auth.users) ───────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name   VARCHAR(255),
  role        VARCHAR(50)  DEFAULT 'cashier' CHECK (role IN ('cashier', 'manager', 'admin')),
  terminal    VARCHAR(50)  DEFAULT 'Terminal 01',
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', COALESCE(NEW.raw_user_meta_data->>'role', 'cashier'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── 2. Products ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id           UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  sku          VARCHAR(50)  UNIQUE NOT NULL,
  name         VARCHAR(255) NOT NULL,
  brand        VARCHAR(100),
  category     VARCHAR(100) CHECK (category IN ('Smartphones','Wearables','Accessories','Tablets','Laptops','Audio','Other')),
  description  TEXT,
  price_sell   BIGINT       NOT NULL CHECK (price_sell >= 0),
  price_buy    BIGINT       DEFAULT 0,
  stock        INTEGER      DEFAULT 0 CHECK (stock >= 0),
  stock_min    INTEGER      DEFAULT 5,
  image_url    TEXT,
  is_active    BOOLEAN      DEFAULT TRUE,
  created_at   TIMESTAMPTZ  DEFAULT NOW(),
  updated_at   TIMESTAMPTZ  DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 3. Transactions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id              UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  txn_number      VARCHAR(30)  UNIQUE,
  cashier_id      UUID         REFERENCES profiles(id),
  customer_name   VARCHAR(255) DEFAULT 'Walk-in Customer',
  subtotal        BIGINT       NOT NULL,
  tax_amount      BIGINT       NOT NULL,
  total           BIGINT       NOT NULL,
  payment_method  VARCHAR(50)  CHECK (payment_method IN ('cash','debit','qris','credit')),
  cash_received   BIGINT,
  change_amount   BIGINT,
  status          VARCHAR(20)  DEFAULT 'completed' CHECK (status IN ('pending','completed','voided')),
  terminal        VARCHAR(50)  DEFAULT 'Terminal 01',
  notes           TEXT,
  created_at      TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 4. Transaction Items ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_items (
  id             UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id UUID    REFERENCES transactions(id) ON DELETE CASCADE NOT NULL,
  product_id     UUID    REFERENCES products(id),
  product_name   VARCHAR(255), -- snapshot at time of sale
  product_sku    VARCHAR(50),
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  unit_price     BIGINT  NOT NULL,
  subtotal       BIGINT  NOT NULL
);

-- ─── 5. Stock Logs ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_logs (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id     UUID         REFERENCES products(id) ON DELETE CASCADE,
  change_type    VARCHAR(50)  CHECK (change_type IN ('sale','restock','adjustment','audit','initial')),
  qty_before     INTEGER,
  qty_change     INTEGER,
  qty_after      INTEGER,
  note           TEXT,
  created_by     UUID         REFERENCES profiles(id),
  transaction_id UUID         REFERENCES transactions(id),
  created_at     TIMESTAMPTZ  DEFAULT NOW()
);

-- ─── 6. Settings ───────────────────────────────────────────────
CREATE TABLE public.settings (
    key text PRIMARY KEY,
    value text NOT NULL
);

-- ─── Insert default settings ─────────────────────────────────────────────────────
INSERT INTO public.settings (key, value) VALUES
    ('tax_rate', '0.11'),
    ('store_name', 'GadgetStock'),
    ('low_stock_threshold', '10'),
    ('receipt_footer', 'Terima kasih telah berbelanja!');


-- ─── Indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock);
CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_cashier ON transactions(cashier_id);
CREATE INDEX IF NOT EXISTS idx_txn_items_transaction ON transaction_items(transaction_id);
CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON stock_logs(product_id);

-- ─── Row Level Security ───────────────────────────────────────────
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE products           ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_logs         ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update their own
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Products: all authenticated can read; manager/admin can write
CREATE POLICY "products_select" ON products FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin'))
);
CREATE POLICY "products_update" ON products FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin'))
);
CREATE POLICY "products_delete" ON products FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin'))
);

-- Transactions: all authenticated can read & insert; manager can update
CREATE POLICY "txn_select" ON transactions FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "txn_insert" ON transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "txn_update" ON transactions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('manager','admin'))
);

-- Transaction items: all authenticated
CREATE POLICY "txn_items_select" ON transaction_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "txn_items_insert" ON transaction_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Stock logs: read all, insert all authenticated
CREATE POLICY "stock_logs_select" ON stock_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "stock_logs_insert" ON stock_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- ═══════════════════════════════════════════════════════════════
-- SEED DATA — Run this after schema
-- ═══════════════════════════════════════════════════════════════
INSERT INTO products (sku, name, brand, category, description, price_sell, price_buy, stock, stock_min) VALUES
('APL-IP15-PM-256', 'iPhone 15 Pro Max 256GB', 'Apple', 'Smartphones', 'Titanium chassis, A17 Pro chip, 48MP camera system', 21999000, 18500000, 42, 10),
('APL-IP15-P-256',  'iPhone 15 Pro 256GB',     'Apple', 'Smartphones', 'Titanium chassis, A17 Pro chip', 18999000, 16000000, 15, 8),
('SAM-S24-U-512',   'Samsung Galaxy S24 Ultra', 'Samsung', 'Smartphones', 'S Pen, 200MP camera, Snapdragon 8 Gen 3', 20499000, 17000000, 8, 10),
('SAM-S24-P-256',   'Samsung Galaxy S24+',      'Samsung', 'Smartphones', 'Exynos 2400, 12GB RAM', 15499000, 13000000, 22, 8),
('GGL-PXL8-P-128',  'Google Pixel 8 Pro',       'Google', 'Smartphones', 'Google Tensor G3, AI features, 50MP', 15799000, 13200000, 15, 8),
('APL-AW9-45-AL',   'Apple Watch Series 9 45mm','Apple', 'Wearables',   'Always-on display, Double Tap, S9 chip', 7299000, 5800000, 0, 5),
('SAM-GW6-44-SV',   'Samsung Galaxy Watch 6 44mm','Samsung','Wearables','BioActive sensor, Exynos W930', 4299000, 3400000, 2, 5),
('SNY-WF1K-M5',     'Sony WF-1000XM5',          'Sony', 'Audio', 'Industry-leading ANC, 8hr battery', 4699000, 3700000, 28, 8),
('APL-APP-G2-MW',   'AirPods Pro 2nd Gen',       'Apple', 'Audio', 'Active Noise Cancellation, Adaptive Audio', 3999000, 3200000, 5, 8),
('APL-IPAD-AIR-M2', 'iPad Air M2 11"',           'Apple', 'Tablets', 'M2 chip, Liquid Retina display, 5G', 9999000, 8200000, 8, 5),
('APL-MBA-M2-256',  'MacBook Air M2 256GB',      'Apple', 'Laptops', 'M2 chip, 8GB RAM, 13.6" display', 16499000, 13800000, 12, 5),
('ACC-CASE-IP15',   'iPhone 15 Pro Silicone Case','Apple', 'Accessories', 'Original Apple silicone case', 699000, 300000, 45, 15),
('ACC-CHRG-20W',    'Apple 20W USB-C Charger',   'Apple', 'Accessories', 'Fast charging adapter', 499000, 200000, 60, 20),
('ACC-SCRN-IP15',   'iPhone 15 Pro Screen Guard', 'Generic', 'Accessories', 'Tempered glass 9H', 99000, 30000, 80, 25)
ON CONFLICT (sku) DO NOTHING;
