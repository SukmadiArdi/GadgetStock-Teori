// tests/nfr-007-testability.test.mjs
// Maintainability Inspection Checklist: NFR-007
// Kriteria: Kemampuan Pengujian Mandiri & Isolasi Dependensi Jaringan (Testability & Guest Mode)
// Modul: public/js/state.js

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnvironment } from './setup.mjs';

describe('NFR-007: Testability & Dependency Isolation (Guest Mode & Lifecycle)', () => {
  let State;
  let mockEnv;

  beforeEach(async () => {
    mockEnv = setupEnvironment();
    const module = await import('../public/js/state.js');
    State = module.default;
    State.clearCart();
    State.clearPageListeners();
  });

  it('NFR-007.1: setGuestMode() harus mengaktifkan profil tamu tanpa memerlukan otentikasi server', () => {
    State.setGuestMode();

    assert.equal(State.isGuest, true, 'isGuest harus bernilai true dalam mode demo');
    assert.equal(State.currentUser?.role, '_guest');
    assert.equal(State.currentUser?.name, 'Guest User');
    assert.equal(State.currentUser?.employee_id, 'GUEST');
  });

  it('NFR-007.2: Dalam Guest Mode, mutasi keranjang tidak boleh mencemari persistent storage produksi', () => {
    State.setGuestMode();

    State.addToCart({ id: 'p-demo', name: 'MacBook Air M3', price_sell: 19999000, stock: 5 }, 1);

    // Di Guest Mode, state.js memiliki proteksi: (!this.isGuest) -> jangan simpan ke localStorage
    const savedCart = mockEnv.storage.getItem('gs_cart');
    assert.equal(savedCart, null, 'LocalStorage tidak boleh menyimpan data transaksi mode demo');
  });

  it('NFR-007.3: Mekanisme unregister event listener (off / clean tear-down) harus mencegah memory leak', () => {
    let callCounter = 0;
    const testCallback = () => { callCounter++; };

    // Register
    State.on('txn', testCallback);
    State.setCurrentTxn({ id: 'txn-101' });
    assert.equal(callCounter, 1);

    // Unregister
    State.off('txn', testCallback);
    State.setCurrentTxn({ id: 'txn-102' });
    assert.equal(callCounter, 1, 'Callback yang telah di-unsubscribed tidak boleh dieksekusi lagi');
  });

  it('NFR-007.4: logout() harus mereset state user dan keranjang belanja ke kondisi awal yang bersih', () => {
    State.setUser({ id: 'user-001', role: 'cashier', email: 'kasir@gadgetstock.id' });
    State.addToCart({ id: 'p1', name: 'Item', price_sell: 50000, stock: 10 }, 2);

    State.logout();

    assert.equal(State.currentUser, null, 'CurrentUser harus null sesudah logout');
    assert.equal(State.cart.length, 0, 'Keranjang belanja harus kosong sesudah logout');
  });
});
