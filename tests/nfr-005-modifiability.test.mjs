// tests/nfr-005-modifiability.test.mjs
// Maintainability Inspection Checklist: NFR-005
// Kriteria: Kemampuan Modifikasi Aturan Bisnis & Isolasi Konfigurasi Sistem (Configurability)
// Modul: public/js/state.js

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupEnvironment } from './setup.mjs';

describe('NFR-005: Modifiability & Configurability (Business Rules Isolation)', () => {
  let State;

  beforeEach(async () => {
    setupEnvironment();
    const module = await import('../public/js/state.js');
    State = module.default;
    State.clearCart();
    // Reset default settings
    State.settings = {
      terminal: 'Terminal 01',
      storeName: 'GadgetStock',
      receiptFooter: 'Terima kasih telah berbelanja!',
      taxRate: 0.11, // 11%
      lowStockThreshold: 10,
      posCardSize: 180,
      posItemsPerPage: 20,
      enabledPaymentMethods: ['cash', 'debit', 'qris', 'credit']
    };
  });

  it('NFR-005.1: Kalkulasi pajak di getCartTotals() harus dinamis mengikuti modifikasi konfigurasi taxRate', () => {
    State.addToCart({ id: 'p1', name: 'Keyboard Mechanical', price_sell: 1000000, stock: 10 }, 1);

    // Baseline: PPN 11%
    State.settings.taxRate = 0.11;
    let totals = State.getCartTotals();
    assert.equal(totals.subtotal, 1000000);
    assert.equal(totals.tax, 110000);
    assert.equal(totals.total, 1110000);

    // Modifikasi: Kebijakan Pajak baru 12%
    State.settings.taxRate = 0.12;
    totals = State.getCartTotals();
    assert.equal(totals.subtotal, 1000000);
    assert.equal(totals.tax, 120000, 'Pajak harus secara dinamis bernilai 120.000 saat taxRate = 0.12');
    assert.equal(totals.total, 1120000);

    // Modifikasi: Pembebasan Pajak (0%)
    State.settings.taxRate = 0.00;
    totals = State.getCartTotals();
    assert.equal(totals.tax, 0, 'Pajak harus bernilai 0 saat taxRate = 0');
    assert.equal(totals.total, 1000000);
  });

  it('NFR-005.2: updateSettings() harus memperbarui pengaturan dan memicu persistensi data', () => {
    State.updateSettings({
      storeName: 'GadgetStock Megastore Surabaya',
      taxRate: 0.10,
      lowStockThreshold: 15
    });

    assert.equal(State.settings.storeName, 'GadgetStock Megastore Surabaya');
    assert.equal(State.settings.taxRate, 0.10);
    assert.equal(State.settings.lowStockThreshold, 15);

    // Memastikan setting lain yang tidak diubah tetap dipertahankan
    assert.equal(State.settings.terminal, 'Terminal 01');
  });

  it('NFR-005.3: Perubahan setting harus memicu event listener settings secara reaktif', () => {
    let settingsUpdated = false;
    let updatedStoreName = '';

    const listener = (state) => {
      settingsUpdated = true;
      updatedStoreName = state.settings.storeName;
    };

    State.on('settings', listener);
    State.updateSettings({ storeName: 'GadgetStock Flagship' });

    assert.equal(settingsUpdated, true, 'Event "settings" harus terpanggil');
    assert.equal(updatedStoreName, 'GadgetStock Flagship');

    State.off('settings', listener);
  });
});
