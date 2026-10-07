import State from '/js/state.js';
import { TransactionsAPI } from '/js/api.js';
import { formatRupiah, showToast } from '/js/utils.js';

let selectedMethod = 'cash';
let totals = { subtotal: 0, tax: 0, total: 0 };

function updateTotals() {
  totals = State.getCartTotals();
  const taxRatePct = (State.settings.taxRate * 100).toFixed(1).replace(/\.0$/, '');
  document.getElementById('co-tax-label').textContent = `Tax (${taxRatePct}%)`;
  document.getElementById('co-subtotal').textContent = formatRupiah(totals.subtotal);
  document.getElementById('co-tax').textContent = formatRupiah(totals.tax);
  document.getElementById('co-total').textContent = formatRupiah(totals.total);
}

function init() {
  if (!State.cart.length) { navigate('/pos'); return; }
  updateTotals();

  // Re-render if settings load from server after page init
  State.on('settings', () => updateTotals());

  const summary = document.getElementById('order-summary');
  summary.innerHTML = State.cart.map(item => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:0.875rem 1.25rem;border-bottom:1px solid rgba(196,198,207,0.1);">
      <div style="flex:1;min-width:0;padding-right:1.5rem;">
        <p style="font-size:0.875rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</p>
        <p style="font-size:0.75rem;color:var(--on-surface-variant);">x${item.qty} × ${formatRupiah(item.price)}</p>
      </div>
      <span style="font-weight:700;font-size:0.875rem;" class="text-rupiah">${formatRupiah(item.price * item.qty)}</span>
    </div>
  `).join('');

  renderPaymentMethods();
}

function renderPaymentMethods() {
  const container = document.getElementById('payment-options-container');
  const enabledMethods = State.settings.enabledPaymentMethods || ['cash', 'debit', 'qris', 'credit'];
  
  const methods = [
    { id: 'cash', label: 'Cash', icon: 'payments' },
    { id: 'qris', label: 'QRIS', icon: 'qr_code_scanner' },
    { id: 'debit', label: 'Debit Card', icon: 'credit_card' },
    { id: 'credit', label: 'Credit Card', icon: 'credit_score' }
  ];

  const filtered = methods.filter(m => enabledMethods.includes(m.id));
  
  // Reset selected method if current one is disabled
  if (!enabledMethods.includes(selectedMethod)) {
    selectedMethod = enabledMethods[0];
  }

  container.innerHTML = filtered.map(m => `
    <div class="pay-option ${m.id === selectedMethod ? 'selected' : ''}" data-method="${m.id}" onclick="selectMethod(this)">
      <span class="material-symbols-outlined">${m.icon}</span>
      <span>${m.label}</span>
    </div>
  `).join('');

  const select = document.getElementById('payment-method-select');
  if (select) {
    select.innerHTML = filtered.map(m => `
      <option value="${m.id}" ${m.id === selectedMethod ? 'selected' : ''}>${m.label}</option>
    `).join('');
  }

  // Update form visibility
  selectMethod({ dataset: { method: selectedMethod } }, true); 
}

window.selectMethod = function(el, isInitial = false) {
  selectedMethod = el.dataset.method;
  
  if (!isInitial) {
    document.querySelectorAll('.pay-option').forEach(o => {
      if (o.dataset.method === selectedMethod) o.classList.add('selected');
      else o.classList.remove('selected');
    });
    const select = document.getElementById('payment-method-select');
    if (select) select.value = selectedMethod;
  }
  
  const cashForm = document.getElementById('cash-form');
  const ncForm = document.getElementById('noncash-form');
  if (selectedMethod === 'cash') { cashForm.style.display='block'; ncForm.style.display='none'; }
  else {
    cashForm.style.display='none'; ncForm.style.display='flex';
    const labels = { qris:'Present QR code for payment', debit:'Swipe or tap debit card', credit:'Swipe or tap credit card' };
    document.getElementById('noncash-label').textContent = labels[selectedMethod] || '';
  }
};

window.setCash = function(val) {
  const input = document.getElementById('cash-input');
  if (val === 'exact') {
    input.value = totals.total.toLocaleString('id-ID');
  } else {
    // Increment the current value
    const current = parseInt(input.value.replace(/\./g, '')) || 0;
    const added = parseInt(val);
    input.value = (current + added).toLocaleString('id-ID');
  }
  calcChange();
};

window.formatCurrencyInput = function(el) {
  let val = el.value.replace(/[^0-9]/g, '');
  if (val) el.value = parseInt(val, 10).toLocaleString('id-ID');
  else el.value = '';
};

window.calcChange = function() {
  const cashStr = document.getElementById('cash-input').value.replace(/\./g, '');
  const cash = parseInt(cashStr) || 0;
  const change = Math.max(0, cash - totals.total);
  document.getElementById('change-amount').textContent = formatRupiah(change);
};

window.confirmPayment = async function() {
  const btn = document.getElementById('confirm-btn');
  const errEl = document.getElementById('confirm-error');
  errEl.style.display = 'none';

  if (selectedMethod === 'cash') {
    const cashStr = document.getElementById('cash-input').value.replace(/\./g, '');
    const cash = parseInt(cashStr) || 0;
    if (cash < totals.total) { errEl.textContent = 'Cash received is less than total amount'; errEl.style.display = 'block'; return; }
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="material-symbols-outlined" style="animation:spin 1s linear infinite">refresh</span> Processing...`;

  try {
    let txn;

    if (State.isGuest) {
      // Guest mode: simulate a transaction without hitting the database
      const cashReceived = selectedMethod === 'cash'
        ? (parseInt(document.getElementById('cash-input').value.replace(/\./g, '')) || 0)
        : null;
      txn = {
        id: 'demo-' + Date.now(),
        transaction_number: 'DEMO-' + Math.floor(1000 + Math.random() * 9000),
        created_at: new Date().toISOString(),
        payment_method: selectedMethod,
        cash_received: cashReceived,
        change_amount: cashReceived ? Math.max(0, cashReceived - totals.total) : 0,
        subtotal: totals.subtotal,
        tax_amount: totals.tax,
        total_amount: totals.total,
        customer_name: 'Walk-in Customer',
        terminal: State.settings.terminal || 'Terminal 01',
        status: 'completed',
        items: State.cart.map(i => ({
          product_name: i.name,
          product_sku: i.sku,
          quantity: i.qty,
          unit_price: i.price,
          subtotal: i.price * i.qty
        }))
      };
    } else {
      txn = await TransactionsAPI.create({
        items: State.cart.map(i => ({ product_id: i.product_id, product_name: i.name, product_sku: i.sku, quantity: i.qty, unit_price: i.price })),
        customer_name: State.currentUser.customerName || 'Walk-in Customer',
        payment_method: selectedMethod,
        cash_received: selectedMethod === 'cash' ? (parseInt(document.getElementById('cash-input').value.replace(/\./g, ''))||0) : null,
        terminal: State.settings.terminal
      });
    }

    State.setCurrentTxn(txn);
    State.clearCart();
    navigate('/receipt');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined">check_circle</span> Confirm Payment`;
    showToast('Payment failed: ' + err.message, 'error');
  }
};

init();
