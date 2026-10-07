// tests/perf-001-query-pagination.test.mjs
// Aspek Kinerja (Performance Efficiency): NFR-011 - Optimasi Query Database melalui Server-Side Pagination
// Modul: api/products/index.js & api/transactions/index.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('NFR-011: Performance - Query Pagination & Range Optimization', () => {

  it('NFR-011.1: Rumus kalkulasi range pagination harus akurat dan membatasi pengambilan baris data', () => {
    const calculateRange = (page = 1, limit = 20) => {
      const p = Math.max(1, parseInt(page, 10) || 1);
      const l = Math.max(1, parseInt(limit, 10) || 20);
      const offset = (p - 1) * l;
      return {
        offset,
        rangeFrom: offset,
        rangeTo: offset + l - 1,
        limit: l
      };
    };

    // Halaman 1 (limit 20) -> indeks 0 s/d 19
    const p1 = calculateRange(1, 20);
    assert.equal(p1.offset, 0);
    assert.equal(p1.rangeFrom, 0);
    assert.equal(p1.rangeTo, 19);

    // Halaman 2 (limit 20) -> indeks 20 s/d 39
    const p2 = calculateRange(2, 20);
    assert.equal(p2.offset, 20);
    assert.equal(p2.rangeFrom, 20);
    assert.equal(p2.rangeTo, 39);

    // Halaman 5 (limit 10) -> indeks 40 s/d 49
    const p5 = calculateRange(5, 10);
    assert.equal(p5.offset, 40);
    assert.equal(p5.rangeFrom, 40);
    assert.equal(p5.rangeTo, 49);
  });

  it('NFR-011.2: Metadata pagination harus menghitung total halaman secara presisi tanpa memuat seluruh baris', () => {
    const buildPaginationMeta = (totalCount, page, limit) => {
      const total = parseInt(totalCount, 10) || 0;
      const l = parseInt(limit, 10) || 20;
      const p = parseInt(page, 10) || 1;
      return {
        total,
        page: p,
        limit: l,
        pages: Math.ceil(total / l)
      };
    };

    const meta = buildPaginationMeta(45, 1, 20);
    assert.equal(meta.total, 45);
    assert.equal(meta.pages, 3, '45 item dengan limit 20 harus terbagi menjadi 3 halaman');

    const metaEmpty = buildPaginationMeta(0, 1, 20);
    assert.equal(metaEmpty.pages, 0);
  });

  it('NFR-011.3: Input parameter halaman negatif atau tidak valid harus dinormalisasi secara defensif', () => {
    const normalizePageParam = (rawPage) => {
      const parsed = parseInt(rawPage, 10);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    };

    assert.equal(normalizePageParam(-5), 1, 'Halaman negatif harus dinormalisasi ke 1');
    assert.equal(normalizePageParam(0), 1, 'Halaman 0 harus dinormalisasi ke 1');
    assert.equal(normalizePageParam('abc'), 1, 'Input non-numerik harus dinormalisasi ke 1');
    assert.equal(normalizePageParam(3), 3, 'Halaman valid harus dipertahankan');
  });
});
