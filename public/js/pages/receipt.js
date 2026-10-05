import State from '/js/state.js';
import { TransactionsAPI } from '/js/api.js';
import { formatRupiah, formatDate, getHashParams } from '/js/utils.js';

async function init() {
  const params = getHashParams();
  let txn = State.currentTxn;

  if (params.id) {
    try {
      txn = await TransactionsAPI.get(params.id);
      document.getElementById('success-header').style.display = 'none';
      document.getElementById('history-header').style.display = 'block';
      document.getElementById('receipt-actions-new').style.display = 'none';
      document.getElementById('receipt-actions-old').style.display = 'flex';
      document.getElementById('history-txn-num').textContent = `Transaction #${txn.txn_number}`;
    } catch(e) {
      console.error(e);
      navigate('/transactions');
      return;
    }
  }

  if (!txn) { navigate('/dashboard'); return; }

  const txnNum = `Transaction #${txn.txn_number || txn.transaction_number}`;
  document.getElementById('receipt-txn-num').textContent = txnNum;
  document.getElementById('card-txn-num').textContent = txnNum;
  document.getElementById('receipt-datetime').textContent = formatDate(txn.created_at, 'datetime');
  document.getElementById('receipt-method').textContent = txn.payment_method || '—';

  if (txn.payment_method === 'cash' && txn.change_amount > 0) {
    document.getElementById('change-section').style.display = 'block';
    document.getElementById('receipt-change').textContent = formatRupiah(txn.change_amount);
  }

  // Support both real API (transaction_items) and guest mock (items)
  const items = txn.transaction_items || txn.items || [];
  document.getElementById('receipt-items').innerHTML = items.map(item => `
    <div style="display:flex;justify-content:space-between;padding:0.5rem 0;font-size:0.875rem;">
      <div style="flex:1;min-width:0;padding-right:1rem;">
        <p style="font-weight:600;margin:0;">${item.product_name}</p>
        <p style="font-size:0.75rem;color:var(--on-surface-variant);margin:0;">x${item.quantity} × ${formatRupiah(item.unit_price)}</p>
      </div>
      <span style="font-weight:700;" class="text-rupiah">${formatRupiah(item.subtotal)}</span>
    </div>
  `).join('');

  // Support txn.total (real) and txn.total_amount (guest mock)
  const totalAmt = txn.total ?? txn.total_amount;

  // Calculate the actual tax % from the transaction data
  const taxRatePct = txn.subtotal > 0
    ? ((txn.tax_amount / txn.subtotal) * 100).toFixed(1).replace(/\.0$/, '')
    : (State.settings.taxRate * 100).toFixed(1).replace(/\.0$/, '');

  // Store name and footer from settings
  const storeName = State.settings.storeName || 'GadgetStock';
  const footer = State.settings.receiptFooter || 'Terima kasih telah berbelanja!';
  document.getElementById('receipt-store-name').textContent = storeName;
  document.getElementById('receipt-footer-text').textContent = footer;

  document.getElementById('receipt-totals').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:0.5rem;">
      <div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--on-surface-variant);">
        <span>Subtotal</span><span>${formatRupiah(txn.subtotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.8125rem;color:var(--on-surface-variant);">
        <span>Tax (${taxRatePct}%)</span><span>${formatRupiah(txn.tax_amount)}</span>
      </div>
      <div class="print-line-solid" style="display:flex;justify-content:space-between;font-size:1.125rem;font-weight:800;color:var(--text-blue);margin-top:0.5rem;padding-top:0.5rem;border-top:1px solid var(--outline-variant);">
        <span>TOTAL</span><span>${formatRupiah(totalAmt)}</span>
      </div>
    </div>
  `;
}

window.State = State;

// Re-render receipt when settings arrive from server (store name / footer may update)
State.on('settings', init);

init();
