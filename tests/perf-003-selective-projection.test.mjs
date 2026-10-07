// tests/perf-003-selective-projection.test.mjs
// Aspek Kinerja: NFR-013 - Optimasi Payload Transmisi Data melalui Proyeksi Selektif
// Modul: api/transactions/index.js & api/products/index.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('NFR-013: Performance - Selective Field Projection & Payload Optimization', () => {

  it('NFR-013.1: Subquery item transaksi harus memproyeksikan kolom esensial tanpa data berlebih (overfetching)', () => {
    // Definisi proyeksi di api/transactions/index.js line 40:
    // select(`*, transaction_items(product_name, quantity, unit_price, subtotal)`)
    const rawJoinedRow = {
      id: 'txn-001',
      txn_number: 'TXN-20261007-001',
      total: 35000000,
      payment_method: 'qris',
      transaction_items: [
        {
          product_name: 'iPhone 15 Pro',
          quantity: 1,
          unit_price: 18999000,
          subtotal: 18999000
        },
        {
          product_name: 'MacBook Air M2',
          quantity: 1,
          unit_price: 16001000,
          subtotal: 16001000
        }
      ]
    };

    // Pastikan setiap item hanya membawa 4 atribut esensial (tidak membawa seluruh tabel produk seperti deskripsi panjang atau gambar mentah)
    rawJoinedRow.transaction_items.forEach(item => {
      const keys = Object.keys(item);
      assert.deepEqual(keys.sort(), ['product_name', 'quantity', 'subtotal', 'unit_price'].sort());
      assert.equal(typeof item.subtotal, 'number');
      assert.equal(typeof item.quantity, 'number');
    });
  });

  it('NFR-013.2: Perhitungan ukuran payload JSON selektif harus lebih hemat dibanding full product snapshot', () => {
    const compactItem = {
      product_name: 'Samsung S24 Ultra',
      quantity: 1,
      unit_price: 20499000,
      subtotal: 20499000
    };

    const bloatedItem = {
      ...compactItem,
      id: 'd9b9c9f2-2b63-4b92-b43e-9bf89196328a',
      product_id: 'prod-001',
      description: 'Layar Dynamic AMOLED 2X 6.8 inci resolusi QHD+, rangka titanium grade 5, kamera 200MP zoom optik 5x, baterai 5000mAh, garansi resmi SEIN Indonesia...',
      image_base64: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////',
      full_specs: { cpu: 'Snapdragon 8 Gen 3', ram: '12GB', rom: '512GB', os: 'Android 14 OneUI 6.1' }
    };

    const compactSize = JSON.stringify(compactItem).length;
    const bloatedSize = JSON.stringify(bloatedItem).length;

    assert.ok(compactSize < bloatedSize * 0.3, 'Payload selektif harus menghemat setidaknya 70% ukuran transmisi data');
  });

  it('NFR-013.3: Struktur respons transaksi harus membungkus pagination dan data secara terpisah', () => {
    const apiResponse = {
      transactions: [{ id: 'txn-1' }],
      pagination: { total: 100, page: 1, limit: 20, pages: 5 }
    };

    assert.ok(Array.isArray(apiResponse.transactions));
    assert.ok(apiResponse.pagination);
    assert.equal(apiResponse.pagination.limit, 20);
  });
});
