// tests/nfr-003-modularity.test.mjs
// Maintainability Inspection Checklist: NFR-003
// Kriteria: Modularitas Pengelolaan State & Pemisahan Logika Bisnis dari Lapisan DOM
// Modul: public/js/state.js

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnvironment } from './setup.mjs';

describe('NFR-003: Modularity & Separation of Concerns (State Management)', () => {
  let State;

  beforeEach(async () => {
    setupEnvironment();
    const module = await import('../public/js/state.js');
    State = module.default;
    State.clearCart();
    State.clearPageListeners();
  });

  it('NFR-003.1: Harus dapat menginisialisasi dan menambah item ke keranjang tanpa ketergantungan DOM', () => {
    const mockProduct = {
      id: 'prod-001',
      name: 'Samsung Galaxy S24 Ultra',
      sku: 'SS-S24U-256',
      price_sell: 21999000,
      stock: 10,
      category: 'smartphone',
      image_url: 'https://example.com/s24.jpg'
    };

    State.addToCart(mockProduct, 1);

    assert.equal(State.cart.length, 1, 'Keranjang harus memiliki tepat 1 entitas produk');
    assert.equal(State.cart[0].product_id, 'prod-001');
    assert.equal(State.cart[0].qty, 1);
    assert.equal(State.cart[0].price, 21999000);
  });

  it('NFR-003.2: Penambahan item yang sama harus memutasi kuantitas item yang ada, bukan membuat baris duplikat', () => {
    const mockProduct = {
      id: 'prod-002',
      name: 'iPad Pro M4',
      sku: 'APL-IPD-M4',
      price_sell: 18499000,
      stock: 5
    };

    State.addToCart(mockProduct, 1);
    State.addToCart(mockProduct, 2);

    assert.equal(State.cart.length, 1, 'Panjang array keranjang tidak boleh bertambah');
    assert.equal(State.cart[0].qty, 3, 'Kuantitas harus terakumulasi menjadi 3');
  });

  it('NFR-003.3: Menghapus item dari keranjang melalui removeFromCart() harus terisolasi dan modular', () => {
    State.addToCart({ id: 'p1', name: 'Item 1', price_sell: 10000, stock: 10 }, 1);
    State.addToCart({ id: 'p2', name: 'Item 2', price_sell: 20000, stock: 10 }, 1);
    assert.equal(State.cart.length, 2);

    State.removeFromCart('p1');

    assert.equal(State.cart.length, 1);
    assert.equal(State.cart[0].product_id, 'p2');
  });

  it('NFR-003.4: Mekanisme Observer/Event Pub-Sub State._emit() harus memberitahu listener secara reaktif', () => {
    let eventReceived = false;
    let statePayload = null;

    const listener = (state) => {
      eventReceived = true;
      statePayload = state;
    };

    State.on('cart', listener);
    State.addToCart({ id: 'p3', name: 'Sony WH-1000XM5', price_sell: 4999000, stock: 4 }, 1);

    assert.equal(eventReceived, true, 'Listener event "cart" harus terpanggil saat state berubah');
    assert.ok(statePayload, 'Payload state harus diteruskan ke callback');
    assert.equal(statePayload.cart.length, 1);

    State.off('cart', listener);
  });

  it('NFR-003.5: clearCart() harus mengosongkan state keranjang belanja secara deterministik', () => {
    State.addToCart({ id: 'p1', name: 'Item 1', price_sell: 10000, stock: 10 }, 3);
    assert.equal(State.cart.length, 1);

    State.clearCart();

    assert.equal(State.cart.length, 0, 'Keranjang harus kosong setelah clearCart()');
  });
});
