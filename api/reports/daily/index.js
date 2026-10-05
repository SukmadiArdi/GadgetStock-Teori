// api/reports/daily.js - GET /api/reports/daily?date=YYYY-MM-DD
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const { data: txns, error } = await supabase
      .from('transactions')
      .select(`*, transaction_items(product_name, product_sku, quantity, unit_price, subtotal)`)
      .gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`)
      .eq('status', 'completed').order('created_at', { ascending: true });
    if (error) throw error;

    const totalRevenue   = txns.reduce((s, t) => s + t.total, 0);
    const totalOrders    = txns.length;
    const avgOrderValue  = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const totalItemsSold = txns.reduce((s, t) => s + (t.transaction_items||[]).reduce((si,i)=>si+i.quantity,0), 0);

    const hourly = Array.from({ length: 24 }, (_, h) => ({ hour: h, label: `${String(h).padStart(2,'0')}:00`, revenue: 0, orders: 0 }));
    txns.forEach(t => { const h = new Date(t.created_at).getHours(); hourly[h].revenue += t.total; hourly[h].orders++; });

    const paymentBreakdown = {};
    txns.forEach(t => { const m = t.payment_method||'cash'; if (!paymentBreakdown[m]) paymentBreakdown[m]={count:0,total:0}; paymentBreakdown[m].count++; paymentBreakdown[m].total+=t.total; });

    const productMap = {};
    txns.forEach(t => { (t.transaction_items||[]).forEach(item => { const k=item.product_sku||item.product_name; if (!productMap[k]) productMap[k]={name:item.product_name,sku:item.product_sku,qty:0,revenue:0}; productMap[k].qty+=item.quantity; productMap[k].revenue+=item.subtotal; }); });
    const topProducts = Object.values(productMap).sort((a,b)=>b.revenue-a.revenue).slice(0,5);

    res.status(200).json({ date, summary: { totalRevenue, totalOrders, avgOrderValue, totalItemsSold }, hourly, paymentBreakdown, topProducts, transactions: txns });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
