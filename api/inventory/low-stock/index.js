// api/inventory/low-stock.js - GET /api/inventory/low-stock
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Fetch setting from database
    const { data: settingData } = await supabase.from('settings').select('value').eq('key', 'low_stock_threshold').single();
    const threshold = parseInt(settingData?.value || process.env.LOW_STOCK_THRESHOLD || 10);

    const { data: outOfStock } = await supabase
      .from('products').select('*').eq('is_active', true).eq('stock', 0).order('name');

    const { data: critical } = await supabase
      .from('products').select('*').eq('is_active', true)
      .gt('stock', 0).lte('stock', Math.floor(threshold / 2)).order('stock');

    const { data: lowStock } = await supabase
      .from('products').select('*').eq('is_active', true)
      .gt('stock', Math.floor(threshold / 2)).lte('stock', threshold).order('stock');

    res.status(200).json({
      out_of_stock: outOfStock || [],
      critical: critical || [],
      low_stock: lowStock || [],
      total: (outOfStock?.length || 0) + (critical?.length || 0) + (lowStock?.length || 0),
      threshold
    });

  } catch (err) {
    console.error('Low stock error:', err);
    res.status(500).json({ error: err.message });
  }
};
