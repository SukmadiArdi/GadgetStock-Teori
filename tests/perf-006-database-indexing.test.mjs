// tests/perf-006-database-indexing.test.mjs
// Aspek Kinerja: NFR-016 - Akselerasi Kueri melalui B-Tree Database Indexing
// Modul: supabase/schema.sql & arsitektur basis data PostgreSQL

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('NFR-016: Performance - B-Tree Database Indexing & Query Acceleration', () => {
  const schemaPath = path.resolve('supabase/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  it('NFR-016.1: Seluruh kolom pencarian produk berfrekuensi tinggi (sku, category, stock, is_active) harus terindeks', () => {
    assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS idx_products_category ON products\(category\);/i);
    assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS idx_products_sku ON products\(sku\);/i);
    assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS idx_products_active ON products\(is_active\);/i);
    assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS idx_products_stock ON products\(stock\);/i);
  });

  it('NFR-016.2: Kolom pengurutan kronologis transaksi wajib memiliki indeks DESC (idx_transactions_created)', () => {
    assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS idx_transactions_created ON transactions\(created_at DESC\);/i);
  });

  it('NFR-016.3: Relasi Foreign Key transaction_items dan stock_logs harus memiliki indeks penunjang JOIN', () => {
    assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS idx_txn_items_transaction ON transaction_items\(transaction_id\);/i);
    assert.match(schemaSql, /CREATE INDEX IF NOT EXISTS idx_stock_logs_product ON stock_logs\(product_id\);/i);
  });
});
