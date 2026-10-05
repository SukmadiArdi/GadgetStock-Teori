import State from '/js/state.js';
import { AuthAPI } from '/js/api.js';
import { showToast } from '/js/utils.js';

// Load Current Data
function loadSettings() {
  const user = State.currentUser;
  if (!user) return;

  // Profile
  document.getElementById('set-empid').value = user.employee_id || 'N/A';
  document.getElementById('set-role').value = user.role || 'Unknown';
  document.getElementById('set-name').value = user.name || '';

  // Preferences
  const prefs = State.settings || {};
  document.getElementById('set-terminal').value = prefs.terminal || 'Terminal 01';
  document.getElementById('set-pos-limit').value = prefs.posItemsPerPage || 20;

  // Manager Only Section — also show for guest (demo mode shows all features)
  if (user.role === 'manager' || user.role === 'admin' || State.isGuest) {
    document.getElementById('manager-settings-section').style.display = 'block';
    document.getElementById('set-store-name').value = prefs.storeName || 'GadgetStock';
    // taxRate in state is stored as decimal (e.g. 0.11), display as percent (11)
    const taxRatePct = prefs.taxRate ? (prefs.taxRate * 100).toFixed(2).replace(/\.?0+$/, '') : '11';
    document.getElementById('set-tax-rate').value = taxRatePct;
    document.getElementById('set-footer').value = prefs.receiptFooter || 'Terima kasih telah berbelanja!';
    
    // Payment Methods
    const enabledMethods = prefs.enabledPaymentMethods || ['cash', 'debit', 'qris', 'credit'];
    const checkboxes = document.querySelectorAll('#set-pay-methods input[type="checkbox"]');
    checkboxes.forEach(cb => {
      cb.checked = enabledMethods.includes(cb.value);
    });
  }
}

// Reload form when settings sync from server
State.on('settings', loadSettings);

// Toggle password visibility
window.togglePass = function(inputId, iconId) {
  const input = document.getElementById(inputId);
  const icon  = document.getElementById(iconId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.textContent = 'visibility_off';
  } else {
    input.type = 'password';
    icon.textContent = 'visibility';
  }
};

// Global functions for inline onclick handlers
window.updateProfile = function() {
  const newName = document.getElementById('set-name').value.trim();
  if (!newName) return showToast('Name cannot be empty', 'error');
  
  // Optimistic UI update
  const user = State.currentUser;
  user.name = newName;
  user.initials = newName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  State.setUser(user); 
  // In a real app, you would send an API request to update 'profiles' table here
  showToast('Profile name updated successfully', 'success');
};

window.updatePassword = async function() {
  if (State.isGuest) {
    return showToast('Password tidak dapat diubah pada Mode Demo', 'error');
  }
  const p1 = document.getElementById('set-pass1').value;
  const p2 = document.getElementById('set-pass2').value;
  if (!p1 || p1.length < 6) return showToast('Password minimal 6 karakter', 'error');
  if (p1 !== p2) return showToast('Password tidak sama', 'error');

  const userId = State.currentUser?.id;
  if (!userId) return showToast('Sesi tidak ditemukan, silakan login ulang', 'error');

  const btn = document.querySelector('button[onclick="updatePassword()"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    await AuthAPI.changePassword(userId, p1);
    showToast('Password berhasil diubah', 'success');
    document.getElementById('set-pass1').value = '';
    document.getElementById('set-pass2').value = '';
  } catch (err) {
    showToast('Gagal mengubah password: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
};

window.adjustPosLimit = function(delta) {
  const input = document.getElementById('set-pos-limit');
  let val = parseInt(input.value) || 20;
  val = Math.max(5, Math.min(100, val + delta));
  input.value = val;
  saveAppPrefs();
};

window.saveAppPrefs = async function() {
  const term = document.getElementById('set-terminal').value;
  const limit = parseInt(document.getElementById('set-pos-limit').value) || 20;
  
  await State.updateSettings({ 
    terminal: term,
    posItemsPerPage: limit
  });
  showToast('Preferences saved', 'success');
};

window.saveStorePrefs = async function() {
  const storeName = document.getElementById('set-store-name').value.trim();
  // Input is in percent (e.g. "11"), convert to decimal (0.11) for storage
  const taxRatePct = parseFloat(document.getElementById('set-tax-rate').value) || 0;
  const taxRate = taxRatePct / 100;
  const footer = document.getElementById('set-footer').value.trim();
  
  const enabledMethods = [];
  document.querySelectorAll('#set-pay-methods input[type="checkbox"]').forEach(cb => {
    if (cb.checked) enabledMethods.push(cb.value);
  });

  if (enabledMethods.length === 0) {
    showToast('At least one payment method must be enabled', 'error');
    loadSettings(); // revert checkboxes
    return;
  }
  
  await State.updateSettings({
    storeName,
    taxRate,
    receiptFooter: footer,
    enabledPaymentMethods: enabledMethods
  });
  showToast('Store settings saved successfully', 'success');
};

loadSettings();

// Guest mode: show banner and lock only security/password controls
if (State.isGuest) {
  // Show guest notice banner
  const banner = document.createElement('div');
  banner.style.cssText = 'display:flex;align-items:center;gap:0.75rem;padding:0.875rem 1.25rem;background:#ede9fe;border:1px solid #7c3aed;border-radius:0.75rem;color:#5b21b6;font-size:0.875rem;font-weight:600;margin-bottom:1.5rem;';
  banner.innerHTML = `<span class="material-symbols-outlined" style="font-size:1.25rem;color:#7c3aed;">info</span><span>Anda dalam <strong>Mode Demo</strong>. Pengaturan dapat diubah dan disimpan secara lokal (di browser), tetapi tidak disimpan ke database.</span>`;
  const settingsGrid = document.getElementById('settings-grid');
  if (settingsGrid && settingsGrid.parentNode) {
    settingsGrid.parentNode.insertBefore(banner, settingsGrid);
  }
  // Disable only password controls since there is no DB user account for Guest
  document.querySelectorAll('#set-pass1, #set-pass2, button[onclick="updatePassword()"]').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.6';
    el.style.cursor = 'not-allowed';
  });
}
