import { TransactionsAPI } from '/js/api.js';
import { formatRupiah, formatDate, debounce } from '/js/utils.js';
import State from '/js/state.js';

let currentPage = parseInt(localStorage.getItem('gs_txn_page')) || 1;
const limit = 11;
const methodIcons = { cash:'payments', qris:'qr_code_scanner', debit:'credit_card', credit:'credit_score' };

async function loadTxns() {
  localStorage.setItem('gs_txn_page', currentPage);
  window.loadTxns = loadTxns;
  const tbody = document.getElementById('txn-tbody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--on-surface-variant);">Loading...</td></tr>`;
  try {
    const params = { page: currentPage, limit };
    const search = document.getElementById('txn-search')?.value?.trim();
    const date   = document.getElementById('txn-date')?.value;
    const method = document.getElementById('txn-method')?.value;
    if (search) params.search = search;
    if (date)   params.date   = date;
    if (method) params.method = method;

    const { transactions, pagination } = await TransactionsAPI.list(params);

    if (!transactions.length) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--outline);">No transactions found</td></tr>`;
      document.getElementById('txn-pagination').style.display = 'none';
      return;
    }

    tbody.innerHTML = transactions.map(t => {
      const items = (t.transaction_items||[]);
      const itemSummary = items.length > 0 ? `${items.length} item${items.length>1?'s':''}` : '—';
      const statusColor = t.status === 'completed' ? '#15803d' : t.status === 'voided' ? 'var(--error)' : '#b45309';
      const methodIcon  = methodIcons[t.payment_method] || 'payments';
      return `<tr>
        <td><span style="font-family:monospace;font-size:0.75rem;font-weight:700;color:var(--text-blue);">${t.txn_number}</span></td>
        <td style="font-size:0.8125rem;">${formatDate(t.created_at,'datetime')}</td>
        <td style="font-size:0.8125rem;">${t.customer_name||'Walk-in'}</td>
        <td style="font-size:0.8125rem;color:var(--on-surface-variant);text-align:center;">${itemSummary}</td>
        <td style="text-align:right;font-weight:700;" class="text-rupiah">${formatRupiah(t.total)}</td>
        <td>
          <div style="display:flex;align-items:center;gap:0.375rem;font-size:0.8125rem;text-transform:capitalize;">
            <span class="material-symbols-outlined" style="font-size:1rem;color:var(--on-surface-variant);">${methodIcon}</span>
            ${t.payment_method||'—'}
          </div>
        </td>
        <td style="text-align:center;"><span class="badge" style="background:${statusColor}1a;color:${statusColor};">${t.status}</span></td>
        <td style="text-align:center;">
          <button class="btn btn-ghost btn-sm" onclick="showDetail('${t.id}')" title="View Details">
            <span class="material-symbols-outlined" style="font-size:1.125rem;">visibility</span>
          </button>
        </td>
      </tr>`;
    }).join('');

    // Pagination
    const pag = document.getElementById('txn-pagination');
    pag.style.display = 'flex';
    
    // Restore scroll position
    const scrollArea = document.getElementById('txn-table-scroll');
    const savedScroll = sessionStorage.getItem('gs_txn_scroll');
    if (savedScroll && scrollArea) {
      setTimeout(() => { scrollArea.scrollTop = parseInt(savedScroll); }, 50);
    }
    document.getElementById('txn-pag-info').textContent = `Showing ${(currentPage-1)*limit+1}–${Math.min(currentPage*limit,pagination.total)} of ${pagination.total}`;
    document.getElementById('txn-pag-ctrl').innerHTML = `
      <button class="page-btn" onclick="changePage(${currentPage-1})" ${currentPage<=1?'disabled':''}>
        <span class="material-symbols-outlined" style="font-size:1.125rem;">chevron_left</span>
      </button>
      <span class="page-btn active">${currentPage}</span>
      <button class="page-btn" onclick="changePage(${currentPage+1})" ${currentPage>=pagination.pages?'disabled':''}>
        <span class="material-symbols-outlined" style="font-size:1.125rem;">chevron_right</span>
      </button>`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--error);">${err.message}</td></tr>`;
  }
}

window.showDetail = async function(id) {
  try {
    const t = await TransactionsAPI.get(id);
    const settings = State.settings || {};
    const storeName = settings.storeName || 'GadgetStock';
    const footer = settings.receiptFooter || 'Terima kasih telah berbelanja!';
    
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.style.zIndex = '1000';
    
    const itemsHtml = (t.transaction_items || []).map(item => `
      <div style="display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.875rem;">
        <div style="flex:1;min-width:0;padding-right:1rem;">
          <p style="font-weight:600;margin:0;">${item.product_name}</p>
          <p style="font-size:0.75rem;color:var(--on-surface-variant);margin:0;">x${item.quantity} × ${formatRupiah(item.unit_price)}</p>
        </div>
        <span style="font-weight:700;" class="text-rupiah">${formatRupiah(item.subtotal)}</span>
      </div>
    `).join('');

    const taxRatePct = t.subtotal > 0 ? ((t.tax_amount / t.subtotal) * 100).toFixed(1).replace(/\.0$/, '') : '0';

    overlay.innerHTML = `
      <div class="modal custom-scroll" style="max-width:28rem; padding:0; overflow:hidden; border-radius:1rem; box-shadow:0 20px 40px rgba(0,0,0,0.2);">
        <div class="receipt-header" style="background:var(--primary-container); padding:1.5rem; text-align:center; color:#fff; position:relative;">
          <button class="no-print" onclick="this.closest('.modal-overlay').remove()" style="position:absolute; right:1rem; top:1rem; background:rgba(0,0,0,0.1); border:none; color:#fff; cursor:pointer; width:2rem; height:2rem; border-radius:50%; display:flex; align-items:center; justify-content:center;">
            <span class="material-symbols-outlined" style="font-size:1.25rem;">close</span>
          </button>
          <h2 style="font-size:1.125rem; font-weight:800; margin-bottom:0.25rem;">${storeName}</h2>
          <p style="font-size:0.75rem; opacity:0.8; margin:0;">${t.txn_number}</p>
          <p style="font-size:0.75rem; opacity:0.8; margin:0;">${formatDate(t.created_at, 'datetime')}</p>
        </div>
        
        <div style="padding:1.5rem;">
          <div style="max-height:15rem; overflow-y:auto; margin-bottom:1rem; padding-right:0.5rem;" class="custom-scroll">
            ${itemsHtml}
          </div>
          
          <div class="print-line-dashed" style="border-top:2px dashed var(--outline-variant); margin:1rem 0; padding-top:1rem;">
            <div style="display:flex; flex-direction:column; gap:0.5rem;">
              <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:var(--on-surface-variant);">
                <span>Subtotal</span><span>${formatRupiah(t.subtotal)}</span>
              </div>
              <div style="display:flex; justify-content:space-between; font-size:0.8125rem; color:var(--on-surface-variant);">
                <span>Tax (${taxRatePct}%)</span><span>${formatRupiah(t.tax_amount)}</span>
              </div>
              <div class="print-line-solid" style="display:flex; justify-content:space-between; font-size:1.125rem; font-weight:800; color:var(--text-blue); margin-top:0.5rem; padding-top:0.5rem; border-top:1px solid var(--outline-variant);">
                <span>TOTAL</span><span>${formatRupiah(t.total)}</span>
              </div>
            </div>
          </div>
          
          <div style="background:var(--surface-container-low); padding:1rem; border-radius:0.75rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
            <div>
              <p style="font-size:0.625rem; text-transform:uppercase; font-weight:700; color:var(--on-surface-variant); margin-bottom:0.125rem;">Payment Method</p>
              <p style="font-size:0.875rem; font-weight:700; color:var(--text-blue); text-transform:capitalize; margin:0;">${t.payment_method || '—'}</p>
            </div>
            ${t.payment_method === 'cash' ? `
              <div style="text-align:right;">
                <p style="font-size:0.625rem; text-transform:uppercase; font-weight:700; color:var(--on-surface-variant); margin-bottom:0.125rem;">Change</p>
                <p style="font-size:0.875rem; font-weight:700; color:var(--text-blue); margin:0;">${formatRupiah(t.change_amount || 0)}</p>
              </div>
            ` : ''}
          </div>
          
          <p style="text-align:center; font-size:0.75rem; color:var(--on-surface-variant); font-style:italic; margin:0;">${footer}</p>
        </div>
        
        <div class="no-print" style="padding:1.5rem; border-top:1px solid var(--outline-variant); background:var(--surface-container-lowest); display:flex; gap:0.75rem;">
          <button class="btn btn-primary" style="flex:1;" onclick="window.print()"><span class="material-symbols-outlined">print</span>Print</button>
          <button class="btn btn-ghost" style="flex:1;" onclick="this.closest('.modal-overlay').remove()">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  } catch (err) {
    alert('Error: ' + err.message);
  }
};

window.changePage = function(p) { currentPage = p; localStorage.setItem('gs_txn_page', p); loadTxns(); };
window.clearFilters = function() {
  document.getElementById('txn-search').value = '';
  document.getElementById('txn-date').value = '';
  document.getElementById('txn-method').value = '';
  currentPage = 1; 
  localStorage.setItem('gs_txn_page', 1);
  loadTxns();
};

const debouncedLoad = debounce(() => { currentPage = 1; loadTxns(); }, 400);
window.debouncedLoad = debouncedLoad;

loadTxns();
