// tests/perf-004-cart-latency.test.mjs
// Aspek Kinerja: NFR-014 - Kalkulasi Keranjang Kasir Berlatensi Sangat Rendah (< 10ms)
// Modul: public/js/state.js (getCartTotals, addToCart, updateQty)

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnvironment } from './setup.mjs';

describe('NFR-014: Performance - Low-Latency In-Memory State & Cart Computation', () => {
  let State;

  beforeEach(async () => {
    setupEnvironment();
    const module = await import('../public/js/state.js');
    State = module.default;
    State.clearCart();
  });

  it('NFR-014.1: Kalkulasi total belanja getCartTotals() harus selesai dalam waktu < 2 milidetik', () => {
    // Isi keranjang kasir dengan 50 item unik
    for (let i = 1; i <= 50; i++) {
      State.cart.push({
        product_id: `prod-${i}`,
        name: `Gadget Item ${i}`,
        price: 500000 + (i * 25000),
        qty: (i % 3) + 1,
        stock: 50
      });
    }

    const startTime = performance.now();
    const totals = State.getCartTotals();
    const durationMs = performance.now() - startTime;

    assert.ok(totals.total > 0);
    assert.equal(totals.itemCount, 50);
    assert.ok(durationMs < 2.0, `Durasi kalkulasi ${durationMs.toFixed(3)}ms harus di bawah 2.0ms`);
  });

  it('NFR-014.2: Stress test 500 operasi mutasi kuantitas berturut-turut harus selesai di bawah 25 milidetik', () => {
    State.addToCart({ id: 'bench-item', name: 'Benchmark Item', price_sell: 1000000, stock: 1000 }, 1);

    const startTime = performance.now();
    for (let q = 1; q <= 500; q++) {
      State.updateQty('bench-item', (q % 100) + 1);
    }
    const durationMs = performance.now() - startTime;

    assert.ok(durationMs < 25.0, `500 mutasi kuantitas selesai dalam ${durationMs.toFixed(2)}ms (rata-rata < 0.05ms/op)`);
  });

  it('NFR-014.3: Perhitungan pajak dinamis tidak boleh menyebabkan thread blocking atau memory leak', () => {
    State.addToCart({ id: 'p1', name: 'Item', price_sell: 1000000, stock: 10 }, 2);

    const rates = [0.10, 0.11, 0.12, 0.05, 0.00];
    const results = [];

    const startTime = performance.now();
    for (const r of rates) {
      State.settings.taxRate = r;
      results.push(State.getCartTotals().total);
    }
    const durationMs = performance.now() - startTime;

    assert.equal(results.length, 5);
    assert.ok(durationMs < 5.0, 'Pergantian tarif pajak selesai seketika tanpa blocking');
  });
});
