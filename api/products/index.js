// api/products/index.js - GET /api/products, POST /api/products
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // === GET: list products =======================================
    if (req.method === 'GET') {
      const { search = '', category = '', status = '', page = 1, limit = 20 } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('is_active', true)
        .order('name', { ascending: true })
        .range(offset, offset + parseInt(limit) - 1);

      if (search) query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,brand.ilike.%${search}%`);
      if (category) query = query.eq('category', category);
      if (status === 'low_stock') query = query.lte('stock', 10).gt('stock', 0);
      if (status === 'out_of_stock') query = query.eq('stock', 0);
      if (status === 'in_stock') query = query.gt('stock', 10);

      const { data, error, count } = await query;
      if (error) throw error;

      return res.status(200).json({
        products: data,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / parseInt(limit)) }
      });
    }

    // === POST: create product =====================================
    if (req.method === 'POST') {
      const { sku, name, brand, category, description, price_sell, price_buy, stock, stock_min, image_url } = req.body;
      if (!sku || !name || !price_sell) return res.status(400).json({ error: 'sku, name, price_sell are required' });

      const { data, error } = await supabase.from('products').insert({
        sku, name, brand, category, description,
        price_sell: parseInt(price_sell),
        price_buy: parseInt(price_buy || 0),
        stock: parseInt(stock || 0),
        stock_min: parseInt(stock_min || 5),
        image_url
      }).select().single();
      if (error) throw error;

      // Log initial stock
      if (parseInt(stock) > 0) {
        await supabase.from('stock_logs').insert({
          product_id: data.id,
          change_type: 'initial',
          qty_before: 0,
          qty_change: parseInt(stock),
          qty_after: parseInt(stock),
          note: 'Initial stock entry'
        });
      }

      return res.status(201).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Products API error:', err);
    res.status(500).json({ error: err.message });
  }
};
