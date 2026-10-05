// public/js/utils.js - Utility helpers for GadgetStock

/**
 * Format number to Indonesian Rupiah
 * @param {number} amount
 * @returns {string} e.g. "Rp 18.899.000"
 */
export function formatRupiah(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return 'Rp 0';
  return 'Rp ' + Math.round(amount).toLocaleString('id-ID');
}

/**
 * Format date to readable string
 * @param {string|Date} date
 * @param {'short'|'long'|'time'|'datetime'} format
 * @returns {string}
 */
export function formatDate(date, format = 'short') {
  const d = date ? new Date(date) : new Date();
  const opts = {
    short:    { day: '2-digit', month: 'short', year: 'numeric' },
    long:     { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    time:     { hour: '2-digit', minute: '2-digit', hour12: false },
    datetime: { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
  };
  return d.toLocaleDateString('id-ID', opts[format] || opts.short);
}

/**
 * Format datetime to "Today, HH:MM" or date string
 */
export function formatRelativeTime(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return isToday ? `Today, ${time}` : `${formatDate(d, 'short')}, ${time}`;
}

/**
 * Generate a transaction number
 */
export function generateTxnNumber() {
  const rand = Math.floor(100 + Math.random() * 900);
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `TXN-${rand}-${letter}`;
}

/**
 * Generate UUID v4
 */
export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Debounce a function
 */
export function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Get stock status info
 */
export function getStockStatus(stock, minStock = 10) {
  if (stock <= 0)          return { label: 'Out of Stock', class: 'badge-critical', color: 'text-error' };
  if (stock <= minStock / 2) return { label: 'Critical',     class: 'badge-danger',   color: 'text-error' };
  if (stock <= minStock)   return { label: 'Low Stock',    class: 'badge-warning',  color: 'text-amber' };
  return                          { label: 'In Stock',     class: 'badge-success',  color: 'text-green' };
}

/**
 * Show toast notification
 */
export function showToast(message, type = 'info', duration = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  const icons = { success: 'check_circle', error: 'error', info: 'info' };
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="material-symbols-outlined" style="font-size:1.25rem">${icons[type] || 'info'}</span>
    <span>${message}</span>
  `;
  
  // Limit to 3 toasts
  if (container.children.length >= 3) {
    container.removeChild(container.firstChild);
  }
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => { if (toast.parentNode) container.removeChild(toast); }, 300);
  }, duration);
}

/**
 * Show confirmation modal
 */
export function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3 style="font-size:1rem;font-weight:700;margin-bottom:0.75rem;">Konfirmasi</h3>
      <p style="font-size:0.875rem;color:var(--on-surface-variant);margin-bottom:1.5rem;">${message}</p>
      <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
        <button id="cancel-btn" class="btn btn-ghost btn-sm">Batal</button>
        <button id="confirm-btn" class="btn btn-danger btn-sm">Ya, Lanjutkan</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-btn').onclick = () => overlay.remove();
  overlay.querySelector('#confirm-btn').onclick = () => { overlay.remove(); onConfirm(); };
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

/**
 * Calculate cart totals
 */
export function calcCartTotals(items, taxRate = 0.085) {
  const subtotal = items.reduce((s, i) => s + (i.price * i.qty), 0);
  const tax = Math.round(subtotal * taxRate);
  const total = subtotal + tax;
  return { subtotal, tax, total };
}

/**
 * Truncate string
 */
export function truncate(str, n = 40) {
  return str && str.length > n ? str.slice(0, n) + '...' : str;
}

/**
 * Get today's date as YYYY-MM-DD
 */
export function todayISO() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get current month as YYYY-MM
 */
export function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Parse query params from hash URL
 * e.g. "#/product-detail?id=abc" => { id: 'abc' }
 */
export function getHashParams() {
  const hash = window.location.hash || '';
  const qIdx = hash.indexOf('?');
  if (qIdx === -1) return {};
  return Object.fromEntries(new URLSearchParams(hash.slice(qIdx + 1)));
}

/**
 * Role-Based Access Control (RBAC) helper.
 * Cek apakah user saat ini memiliki izin terhadap suatu fitur.
 *
 * Role hierarchy:
 *  - admin    : akses penuh (sama dengan manager)
 *  - manager  : akses penuh ke semua fitur termasuk laporan & manajemen produk
 *  - cashier  : hanya POS, lihat inventory & transaksi — tidak bisa kelola produk / laporan
 *  - _guest   : semua fitur dalam mode demo (tidak disimpan ke DB)
 *
 * @param {'reports'|'analytics'|'manage_products'|'store_settings'|'full'} feature
 * @param {object|null} user  - State.currentUser (default: ambil dari localStorage)
 * @returns {boolean}
 */
export function canAccess(feature, user = null) {
  // Ambil user dari localStorage jika tidak disediakan
  if (!user) {
    try {
      const stored = localStorage.getItem('gs_user');
      user = stored && stored !== 'undefined' ? JSON.parse(stored) : null;
    } catch (_) { user = null; }
  }
  if (!user) return false;

  const role = user.role;

  // Guest: akses semua fitur dalam mode demo
  if (role === '_guest') return true;

  // Admin & Manager: akses penuh
  if (role === 'admin' || role === 'manager') return true;

  // Cashier: pembatasan berdasarkan fitur
  if (role === 'cashier') {
    // Fitur yang BOLEH diakses cashier
    const cashierAllowed = ['pos', 'checkout', 'receipt', 'dashboard', 'inventory_view', 'transactions_view', 'low_stock', 'settings_personal'];
    return cashierAllowed.includes(feature);
  }

  return false;
}

/**
 * Cek apakah user adalah manager atau admin (atau guest untuk demo).
 * Shorthand untuk canAccess('manage_products').
 * @param {object|null} user
 * @returns {boolean}
 */
export function isManagerOrAbove(user = null) {
  if (!user) {
    try {
      const stored = localStorage.getItem('gs_user');
      user = stored && stored !== 'undefined' ? JSON.parse(stored) : null;
    } catch (_) { user = null; }
  }
  if (!user) return false;
  return ['admin', 'manager', '_guest'].includes(user.role);
}
