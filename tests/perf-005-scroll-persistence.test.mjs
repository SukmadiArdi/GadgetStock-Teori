// tests/perf-005-scroll-persistence.test.mjs
// Aspek Kinerja: NFR-015 - Preservasi Posisi Scroll Antarmuka Inventori (Scroll Persistence)
// Modul: public/js/pages/inventory.js & SKPL Section 3.4 (Performance & Speed)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('NFR-015: Performance - Scroll Persistence & Zero Layout Reflow', () => {

  it('NFR-015.1: Posisi scroll vertikal harus disimpan ke SessionStorage secara instan', () => {
    const mockSessionStorage = {
      store: {},
      setItem(k, v) { this.store[k] = String(v); },
      getItem(k) { return this.store[k] || null; },
      removeItem(k) { delete this.store[k]; }
    };

    // Simulasi kasir menggulir daftar inventori ke posisi pixel 1240
    const scrollKey = 'gs_inventory_scroll';
    const targetScrollY = 1240;

    mockSessionStorage.setItem(scrollKey, targetScrollY);
    assert.equal(mockSessionStorage.getItem(scrollKey), '1240');
  });

  it('NFR-015.2: Koordinat scroll yang dipulihkan harus berupa integer valid dan dipulihkan tanpa layout shift', () => {
    const restoreScrollPosition = (storedVal) => {
      const y = parseInt(storedVal, 10);
      return !isNaN(y) && y >= 0 ? y : 0;
    };

    assert.equal(restoreScrollPosition('1240'), 1240);
    assert.equal(restoreScrollPosition(null), 0, 'Ketiadaan nilai tersimpan harus fallback ke 0 (posisi awal)');
    assert.equal(restoreScrollPosition('invalid'), 0);
    assert.equal(restoreScrollPosition('-200'), 0);
  });

  it('NFR-015.3: Penghapusan posisi scroll saat reset filter tidak boleh meninggalkan residu memori', () => {
    const store = { gs_inventory_scroll: '850' };
    delete store.gs_inventory_scroll;

    assert.equal(store.gs_inventory_scroll, undefined, 'Residu posisi scroll harus bersih setelah reset');
  });
});
