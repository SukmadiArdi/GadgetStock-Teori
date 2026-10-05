// api/transactions/index.js - GET /api/transactions, POST /api/transactions
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function generateTxnNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;
  
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const timeStr = `${hours}${minutes}${seconds}`;
  
  const rand = Math.floor(1000 + Math.random() * 9000); // 4-digit random
  return `TXN-${dateStr}-${timeStr}-${rand}`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // === GET: list transactions ===================================
    if (req.method === 'GET') {
      const { date, start_date, end_date, method, status, page = 1, limit = 20, search = '' } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);

      let query = supabase
        .from('transactions')
        .select(`*, transaction_items(product_name, quantity, unit_price, subtotal)`, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + parseInt(limit) - 1);

      if (date) {
        query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);
      } else if (start_date && end_date) {
        query = query.gte('created_at', `${start_date}T00:00:00`).lte('created_at', `${end_date}T23:59:59`);
      }
      if (method) query = query.eq('payment_method', method);
      if (status) query = query.eq('status', status);
      if (search) query = query.or(`txn_number.ilike.%${search}%,customer_name.ilike.%${search}%`);

      const { data, error, count } = await query;
      if (error) throw error;

      return res.status(200).json({
        transactions: data,
        pagination: { total: count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / parseInt(limit)) }
      });
    }

    // === POST: create transaction =================================
    if (req.method === 'POST') {
      const { items, customer_name, payment_method, cash_received, cashier_id, terminal, notes } = req.body;

      if (!items || !items.length) return res.status(400).json({ error: 'items are required' });
      if (!payment_method) return res.status(400).json({ error: 'payment_method is required' });

      // Fetch settings from database
      const { data: settingsData } = await supabase.from('settings').select('*');
      const settingsMap = {};
      if (settingsData) settingsData.forEach(s => settingsMap[s.key] = s.value);

      // Calculate totals
      const taxRate = parseFloat(settingsMap['tax_rate'] || process.env.TAX_RATE || 0.11);
      const subtotal   = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
      const tax_amount = Math.round(subtotal * taxRate);
      const total      = subtotal + tax_amount;
      const change_amount = payment_method === 'cash' && cash_received
        ? Math.max(0, parseInt(cash_received) - total) : 0;

      // Prepare items format for PostgreSQL function: product_id, product_name, product_sku, quantity, unit_price
      const preparedItems = items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        product_sku: item.product_sku,
        quantity: parseInt(item.quantity),
        unit_price: parseInt(item.unit_price)
      }));

      const txnNumber = generateTxnNumber();

      // Call database RPC to execute sales transaction atomically
      const { data: txnId, error: rpcErr } = await supabase.rpc('create_sales_transaction', {
        p_txn_number: txnNumber,
        p_cashier_id: cashier_id || null,
        p_customer_name: customer_name || 'Walk-in Customer',
        p_subtotal: subtotal,
        p_tax_amount: tax_amount,
        p_total: total,
        p_payment_method: payment_method,
        p_cash_received: cash_received ? parseInt(cash_received) : null,
        p_change_amount: change_amount,
        p_terminal: terminal || 'Terminal 01',
        p_notes: notes || null,
        p_items: preparedItems
      });

      if (rpcErr) {
        console.error('RPC transaction error:', rpcErr);
        // Handle database-raised validation messages (e.g. Insufficient stock)
        if (rpcErr.message && rpcErr.message.includes('Insufficient stock')) {
          return res.status(400).json({ error: rpcErr.message });
        }
        return res.status(400).json({ error: rpcErr.message || 'Transaction failed in database' });
      }

      // Return full transaction with items
      const { data: fullTxn, error: fetchErr } = await supabase
        .from('transactions')
        .select(`*, transaction_items(*)`)
        .eq('id', txnId)
        .single();

      if (fetchErr) throw fetchErr;

      return res.status(201).json(fullTxn);
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ error: err.message });
  }
};
