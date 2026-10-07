// api/products/[id]/index.js - GET/PUT/DELETE /api/products/:id
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel: id ada di req.query (file-based routing [id]/index.js)
  // Express lokal: id ada di req.params (route :id)
  const id = req.query.id || req.params?.id;
  if (!id) return res.status(400).json({ error: 'Product ID required' });

  try {
    // === GET: single product =====================================
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('products').select('*').eq('id', id).single();
      if (error) return res.status(404).json({ error: 'Product not found' });
      return res.status(200).json(data);
    }

    // === PUT: update product =====================================
    if (req.method === 'PUT') {
      const { stock_add, ...fields } = req.body;

      // Handle restock (add to stock)
      if (stock_add !== undefined) {
        const { data: current } = await supabase.from('products').select('stock').eq('id', id).single();
        const newStock = (current?.stock || 0) + parseInt(stock_add);
        const { data, error } = await supabase
          .from('products').update({ stock: newStock }).eq('id', id).select().single();
        if (error) throw error;

        await supabase.from('stock_logs').insert({
          product_id: id,
          change_type: 'restock',
          qty_before: current?.stock || 0,
          qty_change: parseInt(stock_add),
          qty_after: newStock,
          note: `Restock: +${stock_add} units`
        });
        return res.status(200).json(data);
      }

      // General update
      const updateData = {};
      const allowed = ['name','brand','category','description','price_sell','price_buy','stock','stock_min','image_url','is_active'];
      allowed.forEach(k => { if (fields[k] !== undefined) updateData[k] = fields[k]; });

      const { data, error } = await supabase.from('products').update(updateData).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    // === DELETE: soft delete =====================================
    if (req.method === 'DELETE') {
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Product deactivated' });
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Product [id] error:', err);
    res.status(500).json({ error: err.message });
  }
};
