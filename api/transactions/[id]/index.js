// api/transactions/[id]/index.js - GET /api/transactions/:id
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Vercel: id ada di req.query (file-based routing [id]/index.js)
  // Express lokal: id ada di req.params (route :id)
  const id = req.query.id || req.params?.id;
  if (!id) return res.status(400).json({ error: 'Transaction ID required' });

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('transactions')
        .select(`*, transaction_items(*)`)
        .eq('id', id)
        .single();

      if (error) return res.status(404).json({ error: 'Transaction not found' });
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
