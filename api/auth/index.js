const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action, employee_id, password, full_name, user_id, new_password } = req.body;

  // Handle change_password separately — does not need employee_id/password
  if (action === 'change_password') {
    if (!user_id) return res.status(400).json({ error: 'User ID is required' });
    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
      const { error } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
      if (error) throw error;
      return res.status(200).json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
      console.error('Change password error:', err);
      return res.status(400).json({ error: err.message });
    }
  }

  // For login/signup: employee_id and password are required
  if (!employee_id || !password) {
    return res.status(400).json({ error: 'Employee ID and password are required' });
  }

  // Format ID
  const empId = employee_id.trim().toUpperCase();
  const email = `${empId.toLowerCase()}@gadgetstock.local`;

  try {
    if (action === 'login') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      
      // Fetch profile
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
      return res.status(200).json({ user: data.user, profile, session: data.session });
    } 
    
    else if (action === 'signup') {
      if (!full_name) return res.status(400).json({ error: 'Full name is required for signup' });
      
      // Verify Employee ID format (GS-EMP-xxx, GS-SPV-xxx, or GS-ADM-xxx)
      if (!empId.startsWith('GS-EMP-') && !empId.startsWith('GS-SPV-') && !empId.startsWith('GS-ADM-')) {
        return res.status(400).json({ error: 'Invalid Employee ID. Must start with GS-EMP-, GS-SPV-, or GS-ADM-' });
      }

      let role = 'cashier';
      if (empId.startsWith('GS-SPV-')) {
        role = 'manager';
      } else if (empId.startsWith('GS-ADM-')) {
        role = 'admin';
      }

      // Supabase signup
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name, role, employee_id: empId }
        }
      });
      if (error) throw error;

      // Note: Because we use service_role, signUp might auto-confirm if email confirmations are disabled.
      // But just in case, we return success.
      return res.status(201).json({ message: 'Signup successful. You can now login.', user: data.user });
    }

    else {
      return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (err) {
    console.error('Auth API Error:', err);
    return res.status(400).json({ error: err.message });
  }
};
