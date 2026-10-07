import { DashboardAPI } from '/js/api.js';
import { formatRupiah, formatRelativeTime, getStockStatus, isManagerOrAbove } from '/js/utils.js';
import State from '/js/state.js';


async function load() {
  // Greeting
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const userName = State.currentUser?.name?.split(' ')[0] || 'User';
  document.getElementById('dash-greeting').textContent = `${greet}, ${userName} 👋`;
  document.getElementById('dash-date').textContent = new Date().toLocaleDateString('id-ID', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  try {
    const data = await DashboardAPI.getSummary();

    // KPI
    document.getElementById('kpi-revenue').textContent = formatRupiah(data.revenue.today);
    document.getElementById('kpi-orders').textContent  = data.orders.today;
    document.getElementById('kpi-stock').textContent   = formatRupiah(data.inventory.stock_value);
    document.getElementById('kpi-skus').textContent    = `${data.inventory.total_skus} active SKUs`;

    const pct = data.revenue.change_pct;
    const icon = pct >= 0 ? 'trending_up' : 'trending_down';
    const color = pct >= 0 ? '#4ade80' : '#f87171';
    document.getElementById('kpi-rev-pct').textContent = `${pct >= 0 ? '+' : ''}${pct}%`;
    document.getElementById('kpi-rev-badge').querySelector('.material-symbols-outlined').textContent = icon;
    document.getElementById('kpi-rev-badge').querySelector('.material-symbols-outlined').style.color = color;

    // Critical Stock Table
    const tbody = document.getElementById('stock-alerts-body');
    const canManage = isManagerOrAbove(State.currentUser);
    if (!data.critical_stock.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--outline);">✅ All products have sufficient stock</td></tr>`;
    } else {
      tbody.innerHTML = data.critical_stock.map(p => {
        const s = getStockStatus(p.stock, p.stock_min);
        return `<tr>
          <td>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <div style="width:2.5rem;height:2.5rem;background:var(--surface-container-low);border-radius:0.5rem;display:flex;align-items:center;justify-content:center;">
                <span class="material-symbols-outlined" style="color:var(--outline);font-size:1.125rem;">smartphone</span>
              </div>
              <div>
                <p style="font-size:0.875rem;font-weight:700;">${p.name}</p>
                <p style="font-size:0.625rem;color:var(--on-surface-variant);text-transform:uppercase;">${p.brand} · ${p.category}</p>
              </div>
            </div>
          </td>
          <td><span style="font-family:monospace;font-size:0.75rem;color:var(--on-surface-variant);">${p.sku}</span></td>
          <td><span style="font-weight:700;color:${p.stock===0?'var(--error)':'inherit'}">${p.stock}</span></td>
          <td><span class="badge ${s.class}">${s.label}</span></td>
          <td>${canManage ? `<button class="btn btn-ghost btn-sm" onclick="navigate('/product-detail?id=${p.id}')"><span class="material-symbols-outlined" style="font-size:1rem;">edit</span></button>` : '<span style="font-size:0.75rem;color:var(--on-surface-variant);">—</span>'}</td>
        </tr>`;
      }).join('');
    }

    // Recent Sales
    const salesList = document.getElementById('recent-sales-list');
    if (!data.recent_transactions.length) {
      salesList.innerHTML = `<div class="card" style="padding:1.5rem;text-align:center;color:var(--outline);">No transactions today</div>`;
    } else {
      salesList.innerHTML = data.recent_transactions.slice(0, 10).map((t) => {
        const items = (t.transaction_items||[]).map(i=>i.product_name).join(', ');
        const initials = (t.customer_name||'W').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return `<div class="card" style="padding:1rem;display:flex;align-items:center;gap:0.75rem;">
          <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:var(--primary-container);color:var(--on-primary);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;flex-shrink:0;">${initials}</div>
          <div style="flex:1;min-width:0;">
            <p style="font-size:0.875rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.customer_name||'Walk-in Customer'}</p>
            <p style="font-size:0.6875rem;color:var(--on-surface-variant);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${items || t.txn_number} · ${formatRelativeTime(t.created_at)}</p>
          </div>
          <p style="font-size:0.875rem;font-weight:700;flex-shrink:0;" class="text-rupiah">${formatRupiah(t.total)}</p>
        </div>`;
      }).join('');
    }

  } catch (err) {
    console.error('Dashboard load error:', err);
    document.getElementById('kpi-revenue').textContent = formatRupiah(0);
    document.getElementById('kpi-orders').textContent = '0';
    document.getElementById('kpi-stock').textContent = formatRupiah(0);
    document.getElementById('stock-alerts-body').innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--error);">Failed to load data. Check your Supabase connection.</td></tr>`;
    document.getElementById('recent-sales-list').innerHTML = `<div class="card" style="padding:1.5rem;text-align:center;color:var(--error);">${err.message}</div>`;
  }
}

load();
