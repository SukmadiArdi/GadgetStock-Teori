// server.js - Local Express server for GadgetStock
// Menggantikan Vercel dev untuk development lokal
require('dotenv').config({ path: '.env.local' });

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// === Middleware ================================================
app.use(cors());
app.use(express.json());

// === Static files (public/) ====================================
app.use(express.static(path.join(__dirname, 'public')));

// === Helper: adapt Vercel serverless handler ke Express ========
// Vercel format: module.exports = async (req, res) => {}
// Express format: (req, res, next) => {}
// Query params di Vercel pakai req.query, Express juga sama ✅
// Route params di Vercel pakai req.query.id (dari dynamic routes [id].js)
// Kita extract dari Express params dan inject ke req.query
function vercelHandler(handlerPath, paramMap = {}) {
  const handler = require(handlerPath);
  return async (req, res, next) => {
    try {
      // req.query di Express adalah object hasil parse qs yang tidak bisa di-assign langsung.
      // Buat merged query object baru dan proxy req agar handler membaca nilai yang benar.
      if (paramMap && Object.keys(paramMap).length > 0) {
        const extraParams = {};
        Object.entries(paramMap).forEach(([expressParam, vercelParam]) => {
          extraParams[vercelParam] = req.params[expressParam];
        });
        // Override req.query dengan object baru yang sudah include route params
        req.query = Object.assign({}, req.query, extraParams);
      }
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

// === API Routes ================================================

// Auth
app.post('/api/auth',
  vercelHandler('./api/auth/index'));


// Dashboard
app.get('/api/dashboard/summary',
  vercelHandler('./api/dashboard/summary/index'));

// Products
app.get('/api/products',
  vercelHandler('./api/products/index'));

app.post('/api/products',
  vercelHandler('./api/products/index'));

app.get('/api/products/:id',
  vercelHandler('./api/products/[id]/index', { id: 'id' }));

app.put('/api/products/:id',
  vercelHandler('./api/products/[id]/index', { id: 'id' }));

app.delete('/api/products/:id',
  vercelHandler('./api/products/[id]/index', { id: 'id' }));

// Inventory
app.get('/api/inventory/low-stock',
  vercelHandler('./api/inventory/low-stock/index'));

// Transactions
app.get('/api/transactions',
  vercelHandler('./api/transactions/index'));

app.post('/api/transactions',
  vercelHandler('./api/transactions/index'));

app.get('/api/transactions/:id',
  vercelHandler('./api/transactions/[id]/index', { id: 'id' }));

// Settings
app.get('/api/settings',
  vercelHandler('./api/settings/index'));

app.post('/api/settings',
  vercelHandler('./api/settings/index'));

// Reports
app.get('/api/reports/daily',
  vercelHandler('./api/reports/daily/index'));

app.get('/api/reports/monthly',
  vercelHandler('./api/reports/monthly/index'));

// === SPA Fallback ==============================================
// express.static sudah melayani semua file di public/
// Fallback ini hanya untuk URL yang bukan file statis dan bukan /api/
// Contoh: user mengetik http://localhost:3000/dashboard → index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Error Handler =============================================
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// === Start =====================================================
app.listen(PORT, () => {
  console.log('');
  console.log('   _____             _  _____ _             _ ');
  console.log('  / ____|           | |/ ____| |           | |');
  console.log(' | |  __  __ _  __| | (___ | |_ ___   ___| | __');
  console.log(' | | |_ |/ _` |/ _` |\\___ \\| __/ _ \\ / __| |/ /');
  console.log(' | |__| | (_| | (_| |____) | || (_) | (__|   < ');
  console.log('  \\_____|\\__,_|\\__,_|_____/ \\__\\___/ \\___|_|\\_\\');
  console.log('');
  console.log(`  🚀 Server running at: http://localhost:${PORT}`);
  console.log(`  📦 API ready at:      http://localhost:${PORT}/api/`);
  console.log(`  🗄️  Supabase URL:      ${process.env.SUPABASE_URL || '⚠️  NOT SET'}`);
  console.log('');
  console.log('  Ctrl+C to stop');
  console.log('');
});
