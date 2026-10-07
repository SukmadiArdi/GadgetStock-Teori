// tests/nfr-008-robustness.test.mjs
// Maintainability Inspection Checklist: NFR-008
// Kriteria: Ketahanan Batas Nilai & Integritas Data Keranjang Belanja (Boundary Robustness)
// Modul: public/js/state.js

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnvironment } from './setup.mjs';

describe('NFR-008: Defensive Programming & Boundary Value Robustness (Cart Management)', () => {
  let State;

  beforeEach(async () => {
    setupEnvironment();
    const module = await import('../public/js/state.js');
    State = module.default;
    State.clearCart();
  });

  it('NFR-008.1: updateQty() ke angka 0 atau negatif harus otomatis menghapus item dari keranjang', () => {
    State.addToCart({ id: 'p1', name: 'AirPods Pro 2', price_sell: 3999000, stock: 10 }, 3);
    assert.equal(State.cart.length, 1);

    // Set kuantitas ke 0
    State.updateQty('p1', 0);
    assert.equal(State.cart.length, 0, 'Item harus dihapus saat kuantitas 0');

    // Tambah lagi lalu set ke angka negatif (-5)
    State.addToCart({ id: 'p1', name: 'AirPods Pro 2', price_sell: 3999000, stock: 10 }, 2);
    State.updateQty('p1', -5);
    assert.equal(State.cart.length, 0, 'Item harus dihapus saat kuantitas negatif');
  });

  it('NFR-008.2: updateQty() tidak boleh melebihi batas stok fisik produk yang tersedia (stock capping)', () => {
    State.addToCart({ id: 'p-limited', name: 'PlayStation 5 Pro', price_sell: 13999000, stock: 3 }, 1);

    // Coba minta 10 item, padahal stok hanya 3
    State.updateQty('p-limited', 10);

    const item = State.cart.find(i => i.product_id === 'p-limited');
    assert.equal(item.qty, 3, 'Kuantitas harus di-clamp maksimal sebesar stok fisik (3)');
  });

  it('NFR-008.3: Penambahan berulang melewati batas stok pada addToCart() harus di-clamp ke batas maksimum stok', () => {
    const limitedItem = { id: 'p-lux', name: 'Leica Q3', price_sell: 95000000, stock: 2 };

    State.addToCart(limitedItem, 1);
    assert.equal(State.cart[0].qty, 1);

    // Tambah 5 lagi
    State.addToCart(limitedItem, 5);
    assert.equal(State.cart[0].qty, 2, 'Kuantitas harus tetap dibatasi maksimal 2');
  });

  it('NFR-008.4: getCartTotals() pada keranjang kosong harus mengembalikan nilai nol yang valid (tidak NaN / null)', () => {
    State.clearCart();
    const totals = State.getCartTotals();

    assert.equal(totals.subtotal, 0);
    assert.equal(totals.tax, 0);
    assert.equal(totals.total, 0);
    assert.equal(totals.itemCount, 0);
    assert.equal(Number.isNaN(totals.total), false, 'Total tidak boleh bernilai NaN');
  });

  it('NFR-008.5: Memanggil updateQty() pada ID produk yang tidak ada di keranjang tidak boleh menimbulkan error', () => {
    assert.doesNotThrow(() => {
      State.updateQty('non-existent-product-id', 5);
    }, 'Harus menangani ID yang tidak ditemukan secara aman');
  });
});
