// public/js/router.js - Hash-based SPA client-side router

import State from './state.js';
import { isManagerOrAbove } from './utils.js';


const routes = {
  '/'               : '/pages/dashboard.html',
  '/login'          : '/pages/auth.html',
  '/dashboard'      : '/pages/dashboard.html',
  '/pos'            : '/pages/pos.html',
  '/checkout'       : '/pages/checkout.html',
  '/receipt'        : '/pages/receipt.html',
  '/inventory'      : '/pages/inventory.html',
  '/product-detail' : '/pages/product-detail.html',
  '/low-stock'      : '/pages/low-stock.html',
  '/sales-report'   : '/pages/sales-report.html',
  '/transactions'   : '/pages/transactions.html',
  '/analytics'      : '/pages/analytics.html',
  '/settings'       : '/pages/settings.html'
};

const navMap = {
  '/dashboard'      : 'Dashboard',
  '/pos'            : 'POS',
  '/inventory'      : 'Inventory',
  '/product-detail' : 'Inventory',
  '/low-stock'      : 'Inventory',
  '/transactions'   : 'Transactions',
  '/sales-report'   : 'Reports',
  '/analytics'      : 'Analytics',
  '/settings'       : 'Settings'
};

let currentPath = null;
let currentCleanup = null;

export function navigate(path) {
  window.location.hash = `#${path}`;
}

function getRoute() {
  const hash = window.location.hash || '#/';
  const full = hash.slice(1); // remove '#'
  const path = full.split('?')[0] || '/';
  return { path, full };
}

async function render() {
  const { path, full } = getRoute();

  // Auth protection
  if (!State.currentUser && path !== '/login') {
    navigate('/login');
    return;
  }
  if (State.currentUser && path === '/login') {
    navigate('/dashboard');
    return;
  }

  // ─── RBAC Route Guard ────────────────────────────────────────────
  // Halaman yang hanya boleh diakses Manager / Admin / Guest
  const managerOnlyRoutes = ['/sales-report', '/analytics'];
  if (managerOnlyRoutes.includes(path) && !isManagerOrAbove(State.currentUser)) {
    // Tampilkan toast jika fungsi sudah tersedia
    if (typeof window.showToast === 'function') {
      window.showToast('Akses ditolak: fitur ini hanya untuk Manager atau Admin', 'error', 4000);
    }
    navigate('/dashboard');
    return;
  }

  // product-detail: cashier tidak bisa tambah/edit produk
  if (path === '/product-detail' && !isManagerOrAbove(State.currentUser)) {
    if (typeof window.showToast === 'function') {
      window.showToast('Akses ditolak: hanya Manager atau Admin yang dapat mengelola produk', 'error', 4000);
    }
    navigate('/inventory');
    return;
  }
  // ─────────────────────────────────────────────────────────────────

  // Use full hash (path + query) so edit?id=X vs new are treated as different
  if (full === currentPath) return;
  currentPath = full;

  // Run cleanup of previous page
  if (typeof currentCleanup === 'function') { currentCleanup(); currentCleanup = null; }
  State.clearPageListeners();

  const filePath = routes[path] || routes['/'];

  const container = document.getElementById('page-content');

  // Loading skeleton
  container.innerHTML = `<div style="padding:2rem"><div class="skeleton" style="height:2rem;width:40%;margin-bottom:1rem;"></div><div class="skeleton" style="height:12rem;margin-bottom:1rem;"></div><div class="skeleton" style="height:8rem;"></div></div>`;

  try {
    const html = await fetch(filePath).then(r => r.text());
    container.innerHTML = html;
    container.querySelector('div, section')?.classList.add('fade-in');

    // Update active nav state
    updateNavActive(path);

    // Execute inline and external scripts
    container.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      newScript.type = 'module';
      if (oldScript.src) {
        // Force the browser to re-execute external module scripts by appending a cache-buster query parameter
        const url = new URL(oldScript.src, window.location.origin);
        url.searchParams.set('t', Date.now());
        newScript.src = url.pathname + url.search;
      }
      else { newScript.textContent = oldScript.textContent; }
      oldScript.replaceWith(newScript);
    });

    // Dispatch page:loaded event for page-specific init
    window.dispatchEvent(new CustomEvent('page:loaded', { detail: { path } }));

  } catch (err) {
    console.error('Router error:', err);
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:50vh;gap:1rem;">
        <span class="material-symbols-outlined" style="font-size:4rem;color:var(--outline)">error</span>
        <p style="font-weight:700;color:var(--on-surface)">Halaman tidak dapat dimuat</p>
        <button class="btn btn-primary btn-sm" onclick="navigate('/dashboard')">Kembali ke Dashboard</button>
      </div>`;
  }
}

function updateNavActive(path) {
  const activeLabel = navMap[path] || 'Dashboard';
  document.querySelectorAll('.nav-item').forEach(el => {
    const label = el.dataset.nav;
    el.classList.toggle('active', label === activeLabel);
  });
  document.querySelectorAll('.bottom-nav-item').forEach(el => {
    const label = el.dataset.nav;
    el.classList.toggle('active', label === activeLabel);
  });
}

export function initRouter() {
  window.addEventListener('hashchange', render);
  if (!window.location.hash) window.location.hash = '#/dashboard';
  render();
}

// Expose navigate globally for inline onclick usage
window.navigate = navigate;
