// tests/perf-002-debounce-throttling.test.mjs
// Aspek Kinerja: NFR-012 - Pengendalian Frekuensi Request Pencarian Kasir (Debouncing 300ms)
// Modul: public/js/utils.js (debounce) & antarmuka pencarian kasir POS

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { debounce } from '../public/js/utils.js';

describe('NFR-012: Performance - Keystroke Search Debouncing & Overload Prevention', () => {

  it('NFR-012.1: Rentetan 10 ketukan keyboard cepat dalam 50ms hanya boleh memicu tepat 1 pemanggilan query', async () => {
    let executionCounter = 0;
    let finalQueryPayload = '';

    const executeApiQuery = (query) => {
      executionCounter++;
      finalQueryPayload = query;
    };

    // Debounce default SKPL: 300ms
    const debouncedSearch = debounce(executeApiQuery, 100);

    // Simulasi kasir mengetik kata "SAMSUNG S24" secara cepat
    const keystrokes = ['S', 'SA', 'SAM', 'SAMS', 'SAMSU', 'SAMSUN', 'SAMSUNG', 'SAMSUNG ', 'SAMSUNG S', 'SAMSUNG S24'];
    for (const stroke of keystrokes) {
      debouncedSearch(stroke);
    }

    // Segera sesudah burst, fungsi belum boleh dieksekusi sama sekali
    assert.equal(executionCounter, 0, 'Query tidak boleh ditembakkan sebelum masa jeda selesai');

    // Tunggu melewati batas delay 100ms
    await new Promise(resolve => setTimeout(resolve, 140));

    // Harus dieksekusi tepat 1 kali dengan teks terakhir
    assert.equal(executionCounter, 1, 'Hanya 1 query yang dikirimkan ke server/database');
    assert.equal(finalQueryPayload, 'SAMSUNG S24', 'Payload yang diproses harus berupa query final');
  });

  it('NFR-012.2: Panggilan baru sebelum batas delay selesai harus me-reset timer (cancellation)', async () => {
    let callCount = 0;
    const fn = () => { callCount++; };
    const debounced = debounce(fn, 80);

    debounced();
    await new Promise(resolve => setTimeout(resolve, 40)); // 40ms berlalu

    // Panggilan kedua mereset timer
    debounced();
    await new Promise(resolve => setTimeout(resolve, 50)); // 50ms dari panggilan kedua (total 90ms)
    assert.equal(callCount, 0, 'Timer harus ter-reset sehingga belum terpanggil');

    await new Promise(resolve => setTimeout(resolve, 50)); // Sekarang total > 80ms dari panggilan kedua
    assert.equal(callCount, 1, 'Harus terpanggil 1 kali setelah timer reset selesai');
  });

  it('NFR-012.3: Parameter delay kustom harus dipatuhi secara presisi', async () => {
    let executed = false;
    const fn = () => { executed = true; };
    const customDebounce = debounce(fn, 50);

    customDebounce();
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(executed, false);

    await new Promise(resolve => setTimeout(resolve, 50));
    assert.equal(executed, true);
  });
});
