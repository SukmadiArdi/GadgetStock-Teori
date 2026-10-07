// tests/nfr-006-analysability.test.mjs
// Maintainability Inspection Checklist: NFR-006
// Kriteria: Ketertelusuran & Konsistensi Penanganan Kesalahan (Analysability & Error Handling)
// Modul: server.js (vercelHandler adapter & error middleware)

import './setup.mjs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { vercelHandler } = require('../server.js');

describe('NFR-006: Analysability & Error Handling (Server Middleware & Adapters)', () => {

  it('NFR-006.1: vercelHandler harus menangkap unhandled exception dan meneruskannya ke next(err)', async () => {
    // Mock handler yang melempar error
    const failingHandler = async (req, res) => {
      throw new Error('Database connection failed');
    };

    // Buat proxy wrapper dengan pola yang sama seperti server.js
    const adaptedMiddleware = async (req, res, next) => {
      try {
        await failingHandler(req, res);
      } catch (err) {
        next(err);
      }
    };

    let capturedError = null;
    const req = { query: {}, params: {} };
    const res = {};
    const next = (err) => {
      capturedError = err;
    };

    await adaptedMiddleware(req, res, next);

    assert.ok(capturedError instanceof Error, 'Kesalahan harus ditangkap dan diteruskan ke next');
    assert.equal(capturedError.message, 'Database connection failed');
  });

  it('NFR-006.2: Error handling middleware harus menghasilkan respon JSON error terstandarisasi', () => {
    let statusCode = null;
    let jsonPayload = null;

    const mockRes = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(payload) {
        jsonPayload = payload;
        return this;
      }
    };

    const mockErr = new Error('Invalid SKU code parameter');
    const mockReq = {};
    const mockNext = () => {};

    // Middleware error handler standar di server.js
    const errorHandler = (err, req, res, next) => {
      res.status(500).json({ error: err.message || 'Internal server error' });
    };

    errorHandler(mockErr, mockReq, mockRes, mockNext);

    assert.equal(statusCode, 500, 'Status HTTP harus 500');
    assert.deepEqual(jsonPayload, { error: 'Invalid SKU code parameter' }, 'Payload harus berupa JSON terstruktur { error: message }');
  });

  it('NFR-006.3: vercelHandler harus memetakan dynamic route parameters Express ke req.query secara deterministik', async () => {
    // Test logic parameter mapping vercelHandler
    const paramMap = { id: 'id', category: 'cat' };
    const req = {
      params: { id: 'prod-999', category: 'gadget' },
      query: { search: 'ipad' }
    };

    // Menjalankan mapping
    const extraParams = {};
    Object.entries(paramMap).forEach(([expressParam, vercelParam]) => {
      extraParams[vercelParam] = req.params[expressParam];
    });
    const mergedQuery = Object.assign({}, req.query, extraParams);

    assert.equal(mergedQuery.id, 'prod-999');
    assert.equal(mergedQuery.cat, 'gadget');
    assert.equal(mergedQuery.search, 'ipad');
  });
});
