// public/js/api.js - All API calls to backend (Vercel Serverless Functions)
import State from '/js/state.js';

const BASE = '/api';

async function request(path, options = {}) {
  // Intercept write operations in Guest Mode
  const method = (options.method || 'GET').toUpperCase();
  if (State.isGuest && ['POST','PUT','DELETE','PATCH'].includes(method)) {
    throw new Error('Mode Demo: Data tidak disimpan ke database. Silakan login untuk menggunakan fitur ini.');
  }

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      ...options
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      if (!res.ok) throw new Error(`HTTP ${res.status}: Server returned non-JSON response.`);
      throw err;
    }
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  } catch (err) {
    console.error(`API Error [${options.method || 'GET'} ${path}]:`, err);
    throw err;
  }
}

// === Auth =========================================================
export const AuthAPI = {
  login: (employee_id, password) => request('/auth', { method: 'POST', body: JSON.stringify({ action: 'login', employee_id, password }) }),
  signup: (employee_id, password, full_name) => request('/auth', { method: 'POST', body: JSON.stringify({ action: 'signup', employee_id, password, full_name }) }),
  changePassword: (user_id, new_password) => request('/auth', { method: 'POST', body: JSON.stringify({ action: 'change_password', user_id, new_password }) })
};

// === Dashboard ====================================================
export const DashboardAPI = {
  getSummary: () => request('/dashboard/summary')
};

// === Products =====================================================
export const ProductsAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/products${q ? '?' + q : ''}`);
  },
  get: (id) => request(`/products/${id}`),
  create: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => request(`/products/${id}`, { method: 'DELETE' })
};

// === Inventory ====================================================
export const InventoryAPI = {
  getLowStock: () => request('/inventory/low-stock'),
  restock: (id, qty) => request(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ stock_add: qty })
  })
};

// === Transactions =================================================
export const TransactionsAPI = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/transactions${q ? '?' + q : ''}`);
  },
  get: (id) => request(`/transactions/${id}`),
  create: (body) => request('/transactions', { method: 'POST', body: JSON.stringify(body) })
};

// === Reports ======================================================
export const ReportsAPI = {
  daily: (date) => request(`/reports/daily?date=${date}`),
  monthly: (month) => request(`/reports/monthly?month=${month}`)
};
