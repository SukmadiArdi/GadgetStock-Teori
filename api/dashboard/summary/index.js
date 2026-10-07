// api/dashboard/summary.js
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
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Today's revenue & orders
    const { data: todayTxns, error: txnErr } = await supabase
      .from('transactions')
      .select('total')
      .gte('created_at', `${today}T00:00:00`)
      .lte('created_at', `${today}T23:59:59`)
      .eq('status', 'completed');
    if (txnErr) throw txnErr;

    const todayRevenue = todayTxns.reduce((s, t) => s + (t.total || 0), 0);
    const todayOrders  = todayTxns.length;

    // Yesterday's revenue for comparison
    const { data: yestTxns } = await supabase
      .from('transactions')
      .select('total')
      .gte('created_at', `${yesterday}T00:00:00`)
      .lte('created_at', `${yesterday}T23:59:59`)
      .eq('status', 'completed');

    const yesterdayRevenue = (yestTxns || []).reduce((s, t) => s + (t.total || 0), 0);
    const revenuePct = yesterdayRevenue > 0
      ? (((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100).toFixed(1)
      : 0;

    // Total active SKUs / stock value
    const { data: inventory } = await supabase
      .from('products')
      .select('stock, price_sell')
      .eq('is_active', true);

    const stockValue = (inventory || []).reduce((s, p) => s + (p.stock * p.price_sell), 0);
    const totalSkus  = (inventory || []).length;
    const totalUnits = (inventory || []).reduce((s, p) => s + p.stock, 0);

    // Low stock count
    const { data: lowStock } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .lte('stock', 10)
      .gt('stock', 0);

    const { data: outOfStock } = await supabase
      .from('products')
      .select('id')
      .eq('is_active', true)
      .eq('stock', 0);

    // Recent transactions (last 5)
    const { data: recentTxns } = await supabase
      .from('transactions')
      .select(`
        id, txn_number, customer_name, total, payment_method, created_at,
        transaction_items(product_name, quantity)
      `)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(5);

    // Critical stock products
    const { data: criticalStock } = await supabase
      .from('products')
      .select('id, name, sku, brand, category, stock, stock_min, image_url')
      .eq('is_active', true)
      .lte('stock', 10)
      .order('stock', { ascending: true })
      .limit(5);

    res.status(200).json({
      revenue: {
        today: todayRevenue,
        yesterday: yesterdayRevenue,
        change_pct: parseFloat(revenuePct)
      },
      orders: {
        today: todayOrders
      },
      inventory: {
        stock_value: stockValue,
        total_skus: totalSkus,
        total_units: totalUnits,
        low_stock_count: (lowStock || []).length,
        out_of_stock_count: (outOfStock || []).length
      },
      recent_transactions: recentTxns || [],
      critical_stock: criticalStock || []
    });

  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: err.message });
  }
};
