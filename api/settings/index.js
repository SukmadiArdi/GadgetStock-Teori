// api/settings/index.js - GET /api/settings, POST /api/settings
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
    // ── GET: fetch all settings ───────────────────────────────────
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('settings').select('*');
      if (error) throw error;
      
      // Convert array of {key, value} to an object
      const settingsMap = {};
      data.forEach(item => {
        settingsMap[item.key] = item.value;
      });

      return res.status(200).json(settingsMap);
    }

    // ── POST: update settings ────────────────────────────────────
    if (req.method === 'POST') {
      const settings = req.body; // Expects object like { tax_rate: '0.11', store_name: 'GadgetStock' }
      
      const promises = Object.keys(settings).map(key => {
        return supabase
          .from('settings')
          .upsert({ key, value: String(settings[key]) }, { onConflict: 'key' });
      });

      await Promise.all(promises);
      
      return res.status(200).json({ success: true, message: 'Settings updated successfully' });
    }

    res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: err.message });
  }
};
