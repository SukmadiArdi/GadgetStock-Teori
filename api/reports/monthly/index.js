// api/reports/monthly.js - GET /api/reports/monthly?month=YYYY-MM
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const [year, mon] = month.split('-');
    const start = `${month}-01T00:00:00`;
    const lastDay = new Date(parseInt(year), parseInt(mon), 0).getDate();
    const end = `${month}-${lastDay}T23:59:59`;

    // Previous month for comparison
    const prevDate = new Date(parseInt(year), parseInt(mon) - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
    const prevLastDay = new Date(parseInt(year), parseInt(mon) - 1, 0).getDate();

    const { data: txns, error } = await supabase.from('transactions')
      .select(`total, tax_amount, created_at, payment_method, transaction_items(product_name, product_sku, quantity, unit_price, subtotal)`)
      .gte('created_at', start).lte('created_at', end).eq('status', 'completed');
    if (error) throw error;

    const { data: prevTxns } = await supabase.from('transactions')
      .select('total')
      .gte('created_at', `${prevMonth}-01T00:00:00`).lte('created_at', `${prevMonth}-${prevLastDay}T23:59:59`)
      .eq('status', 'completed');

    const totalRevenue  = txns.reduce((s,t)=>s+t.total,0);
    const prevRevenue   = (prevTxns||[]).reduce((s,t)=>s+t.total,0);
    const totalOrders   = txns.length;
    const avgOrder      = totalOrders > 0 ? Math.round(totalRevenue/totalOrders) : 0;
    const revChangePct  = prevRevenue > 0 ? (((totalRevenue-prevRevenue)/prevRevenue)*100).toFixed(1) : 0;

    // Daily breakdown
    const dailyMap = {};
    txns.forEach(t => {
      const day = new Date(t.created_at).getDate();
      if (!dailyMap[day]) dailyMap[day] = { day, revenue: 0, orders: 0 };
      dailyMap[day].revenue += t.total; dailyMap[day].orders++;
    });
    const daily = Array.from({length: lastDay}, (_,i) => dailyMap[i+1] || { day: i+1, revenue: 0, orders: 0 });

    // Top products
    const productMap = {};
    txns.forEach(t => { (t.transaction_items||[]).forEach(item => {
      const k = item.product_sku||item.product_name;
      if (!productMap[k]) productMap[k]={name:item.product_name,sku:item.product_sku,qty:0,revenue:0};
      productMap[k].qty+=item.quantity; productMap[k].revenue+=item.subtotal;
    }); });
    const topProducts = Object.values(productMap).sort((a,b)=>b.revenue-a.revenue).slice(0,5);

    // Category breakdown
    const catMap = {};
    txns.forEach(t => { (t.transaction_items||[]).forEach(item => {
      // We don't have category in items snapshot, so group by first word of SKU prefix or name
      const k = item.product_name || 'Other';
      if (!catMap[k]) catMap[k] = { name: k, revenue: 0 };
      catMap[k].revenue += item.subtotal;
    }); });

    res.status(200).json({
      month, summary: { totalRevenue, totalOrders, avgOrder, revChangePct: parseFloat(revChangePct), prevRevenue },
      daily, topProducts
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
