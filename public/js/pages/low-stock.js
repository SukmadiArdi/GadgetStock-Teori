import { InventoryAPI } from '/js/api.js';
import State from '/js/state.js';
import { formatRupiah, showToast } from '/js/utils.js';

function renderGroup(title, items, badgeClass, badgeLabel, borderColor) {
  if (!items.length) return '';
  return `
    <div>
      <h2 style="font-size:0.875rem;font-weight:700;color:var(--on-surface-variant);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.75rem;">${title} (${items.length})</h2>
      <div style="display:flex;flex-direction:column;gap:0.5rem;">
        ${items.map(p => {
          const pct = p.stock_min > 0 ? Math.round((p.stock / p.stock_min) * 100) : 0;
          return `<div class="card alert-card" style="border-left-color:${borderColor};">
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.5rem;">
                <span class="badge ${badgeClass}">${badgeLabel}</span>
                <span style="font-family:monospace;font-size:0.75rem;color:var(--on-surface-variant);">${p.sku}</span>
              </div>
              <p style="font-size:0.9375rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.name}</p>
              <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.5rem;">
                <div style="flex:1;height:0.375rem;background:var(--surface-container-high);border-radius:9999px;overflow:hidden;">
                  <div style="height:100%;width:${Math.min(pct,100)}%;background:${borderColor};border-radius:9999px;"></div>
                </div>
                <span style="font-size:0.75rem;font-weight:600;color:var(--on-surface-variant);white-space:nowrap;">${p.stock} / ${p.stock_min} min</span>
              </div>
            </div>
            <div class="alert-card-actions" style="display:flex;flex-direction:column;gap:0.5rem;flex-shrink:0;">
              <button class="btn btn-primary btn-sm" onclick="restock('${p.id}','${p.name.replace(/'/g, "\\'")}')">
                <span class="material-symbols-outlined" style="font-size:0.875rem;">add_box</span>Restock
              </button>
              <button class="btn btn-ghost btn-sm" onclick="navigate('/product-detail?id=${p.id}')">
                <span class="material-symbols-outlined" style="font-size:0.875rem;">edit</span>Edit
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

async function load() {
  try {
    const data = await InventoryAPI.getLowStock();
    const threshold = data.threshold || State.settings.lowStockThreshold || 10;
    const criticalThreshold = Math.floor(threshold / 2);

    // Update card labels dynamically
    document.getElementById('label-critical').textContent = `Critical (≤${criticalThreshold})`;
    document.getElementById('label-low').textContent      = `Low Stock (≤${threshold})`;

    document.getElementById('count-oos').textContent      = data.out_of_stock.length;
    document.getElementById('count-critical').textContent = data.critical.length;
    document.getElementById('count-low').textContent      = data.low_stock.length;

    const lists = document.getElementById('alert-lists');
    const html = [
      renderGroup('Out of Stock', data.out_of_stock, 'badge-critical', 'Out of Stock', 'var(--error)'),
      renderGroup(`Critical Stock (≤${criticalThreshold})`, data.critical, 'badge-danger', 'Critical', 'var(--error)'),
      renderGroup(`Low Stock (≤${threshold})`, data.low_stock, 'badge-warning', 'Low Stock', '#b45309')
    ].join('');
    lists.innerHTML = html || `<div class="card" style="padding:3rem;text-align:center;color:var(--outline);">✅ All products have healthy stock levels!</div>`;
  } catch (err) {
    document.getElementById('alert-lists').innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--error);">${err.message}</div>`;
  }
}

let _restockId = null;

window.restock = function(id, name) {
  _restockId = id;
  document.getElementById('restock-product-name').textContent = name;
  document.getElementById('restock-qty-input').value = '';
  const modal = document.getElementById('restock-modal');
  modal.style.display = 'flex';
  setTimeout(() => document.getElementById('restock-qty-input').focus(), 100);
};

window.closeRestockModal = function() {
  document.getElementById('restock-modal').style.display = 'none';
  _restockId = null;
};

window.confirmRestock = function() {
  const qty = parseInt(document.getElementById('restock-qty-input').value);
  if (!qty || qty <= 0) return showToast('Please enter a valid quantity', 'error');
  InventoryAPI.restock(_restockId, qty)
    .then(() => { showToast(`Restocked ${qty} units!`, 'success'); closeRestockModal(); load(); })
    .catch(err => showToast('Restock failed: ' + err.message, 'error'));
};

// Allow pressing Enter to confirm
document.getElementById('restock-qty-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') confirmRestock();
});

load();
