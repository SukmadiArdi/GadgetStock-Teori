// tests/nfr-004-reusability.test.mjs
// Maintainability Inspection Checklist: NFR-004
// Kriteria: Penggunaan Ulang Fungsi Utilitas & Kemurnian Fungsi (DRY & Functional Purity)
// Modul: public/js/utils.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRupiah,
  formatDate,
  formatRelativeTime,
  generateTxnNumber,
  uuid,
  getStockStatus,
  debounce
} from '../public/js/utils.js';

describe('NFR-004: Reusability & Functional Purity (Utility Helpers)', () => {

  it('NFR-004.1: formatRupiah() harus memformat nominal uang ke format Rupiah secara konsisten dan murni', () => {
    assert.equal(formatRupiah(18899000).replace(/\s/g, ' '), 'Rp 18.899.000');
    assert.equal(formatRupiah(0), 'Rp 0');
    assert.equal(formatRupiah(null), 'Rp 0');
    assert.equal(formatRupiah(undefined), 'Rp 0');
    assert.equal(formatRupiah(NaN), 'Rp 0');
    assert.equal(formatRupiah(1500.75).replace(/\s/g, ' '), 'Rp 1.501');
  });

  it('NFR-004.2: getStockStatus() harus menghasilkan klasifikasi status dan badge yang deterministik', () => {
    // Out of Stock (<= 0)
    const outOfStock = getStockStatus(0, 10);
    assert.equal(outOfStock.label, 'Out of Stock');
    assert.equal(outOfStock.class, 'badge-critical');

    // Critical (<= minStock / 2)
    const critical = getStockStatus(3, 10);
    assert.equal(critical.label, 'Critical');
    assert.equal(critical.class, 'badge-danger');

    // Low Stock (<= minStock)
    const lowStock = getStockStatus(8, 10);
    assert.equal(lowStock.label, 'Low Stock');
    assert.equal(lowStock.class, 'badge-warning');

    // In Stock (> minStock)
    const inStock = getStockStatus(25, 10);
    assert.equal(inStock.label, 'In Stock');
    assert.equal(inStock.class, 'badge-success');
  });

  it('NFR-004.3: uuid() harus menghasilkan format UUID v4 yang valid dan tidak berbenturan', () => {
    const id1 = uuid();
    const id2 = uuid();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    assert.match(id1, uuidRegex, 'UUID 1 harus mematuhi format RFC4122 v4');
    assert.match(id2, uuidRegex, 'UUID 2 harus mematuhi format RFC4122 v4');
    assert.notEqual(id1, id2, 'Dua UUID yang digenerate berurutan tidak boleh identik');
  });

  it('NFR-004.4: generateTxnNumber() harus menghasilkan format kode transaksi kasir yang baku', () => {
    const txn = generateTxnNumber();
    assert.match(txn, /^TXN-\d{3}-[A-Z]$/, 'Nomor transaksi harus berformat TXN-{3-digit}-{Letter}');
  });

  it('NFR-004.5: formatDate() harus memformat tanggal tanpa memutasi objek Date asli', () => {
    const fixedDate = new Date('2026-05-20T10:30:00Z');
    const originalTime = fixedDate.getTime();

    const formattedShort = formatDate(fixedDate, 'short');
    assert.ok(formattedShort.length > 0);
    assert.equal(fixedDate.getTime(), originalTime, 'Objek Date asli tidak boleh dimutasi (pure function)');
  });

  it('NFR-004.6: debounce() harus menunda eksekusi berulang dan hanya memanggil fungsi sekali', async () => {
    let callCount = 0;
    let lastArg = null;
    const fn = (arg) => {
      callCount++;
      lastArg = arg;
    };

    const debounced = debounce(fn, 50);

    debounced('call 1');
    debounced('call 2');
    debounced('call 3');

    assert.equal(callCount, 0, 'Fungsi tidak boleh langsung dieksekusi sebelum delay selesai');

    await new Promise(resolve => setTimeout(resolve, 80));

    assert.equal(callCount, 1, 'Fungsi harus dieksekusi tepat 1 kali');
    assert.equal(lastArg, 'call 3', 'Argumen yang diproses harus berupa panggilan terakhir');
  });
});
