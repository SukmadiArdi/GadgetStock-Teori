import { ProductsAPI } from '/js/api.js';
import State from '/js/state.js';
import { formatRupiah, showToast, showConfirm, debounce } from '/js/utils.js';

let allProducts = [];
let currentCategory = '';
let currentSearch = '';

window.debouncedSearchPos = debounce(() => {
  currentSearch = document.getElementById('pos-search').value.trim();
  loadProducts(currentCategory, currentSearch);
}, 300);

// Generate order ID
const orderIdEl = document.getElementById('order-id');
if (orderIdEl) {
  orderIdEl.textContent = 'ID: ' + Math.floor(100 + Math.random() * 900) + '-' + String.fromCharCode(65 + Math.floor(Math.random()*26));
}

async function loadCategories() {
  try {
    const { products } = await ProductsAPI.list({ limit: 200 }); // Fetch enough to get categories
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const container = document.getElementById('category-filters');
    const allBtn = container.querySelector('button');
    container.innerHTML = '';
    container.appendChild(allBtn);
    
    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'filter-tab';
      btn.textContent = cat;
      btn.onclick = () => filterCategory(btn, cat);
      container.appendChild(btn);
    });
  } catch (err) { console.error('Failed to load categories', err); }
}

async function loadProducts(cat = '', search = '') {
  const grid = document.getElementById('product-grid');
  grid.innerHTML = Array(6).fill(`<div class="skeleton skeleton-card"></div>`).join('');
  
  // Apply settings-based grid size
  const cardSize = State.settings.posCardSize || 180;
  grid.style.setProperty('--pos-card-size', `${cardSize}px`);

  try {
    const params = { limit: State.settings.posItemsPerPage || 20 };
    if (cat) params.category = cat;
    if (search) params.search = search;
    const { products } = await ProductsAPI.list(params);
    allProducts = products;
    renderGrid(products);
  } catch (err) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--error);">${err.message}</div>`;
  }
}

function renderGrid(products) {
  const grid = document.getElementById('product-grid');
  if (!products.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--outline);">No products found</div>`;
    return;
  }
  grid.innerHTML = products.map((p, i) => {
    const oos = p.stock <= 0;
    const low = p.stock > 0 && p.stock <= p.stock_min;
    const icon = p.category === 'Smartphones' ? 'smartphone' : p.category === 'Audio' ? 'headphones' : p.category === 'Wearables' ? 'watch' : p.category === 'Tablets' ? 'tablet' : p.category === 'Laptops' ? 'laptop' : 'devices';
    
    const imgHtml = p.image_url 
      ? `<img src="${p.image_url}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
         <div style="width:100%;height:100%;display:none;align-items:center;justify-content:center;background:var(--surface-container-low);"><span class="material-symbols-outlined" style="font-size:3rem;color:var(--outline);">${icon}</span></div>`
      : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--surface-container-low);"><span class="material-symbols-outlined" style="font-size:3rem;color:var(--outline);">${icon}</span></div>`;

    return `<div class="product-card ${oos?'out-of-stock':''}" data-id="${p.id}" role="button">
      <div class="product-img-box" style="position:relative;background:var(--surface-container-low);overflow:hidden;flex-shrink:0;">
        ${imgHtml}
        <div style="position:absolute;top:0.5rem;left:0.5rem;display:flex;flex-direction:column;gap:0.25rem;">
           ${low ? '<span style="font-size:0.6rem;background:rgba(255,219,206,0.9);color:#7c2d12;padding:0.125rem 0.5rem;border-radius:9999px;font-weight:700;text-transform:uppercase;backdrop-filter:blur(4px);">Low Stock</span>' : ''}
           ${oos ? '<span style="font-size:0.6rem;background:rgba(186,26,26,0.9);color:#fff;padding:0.125rem 0.5rem;border-radius:9999px;font-weight:700;text-transform:uppercase;backdrop-filter:blur(4px);">Out of Stock</span>' : ''}
           <span style="font-size:0.6rem;background:rgba(30,58,95,0.8);color:#fff;padding:0.125rem 0.5rem;border-radius:9999px;font-weight:700;backdrop-filter:blur(4px);align-self:flex-start;">${p.stock} STK</span>
        </div>
      </div>
      <div class="product-info">
        <div style="height:2.6em;display:flex;align-items:flex-start;overflow:hidden;">
          <h4 style="font-size:0.8125rem;font-weight:700;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:var(--text-blue);margin:0;text-align:left;">${p.name}</h4>
        </div>
        <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.875rem;font-weight:800;color:var(--text-blue);white-space:nowrap;" class="text-rupiah">${formatRupiah(p.price_sell)}</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Attach click handlers
  grid.querySelectorAll('.product-card:not(.out-of-stock)').forEach(card => {
    card.addEventListener('click', () => {
      const pid = card.dataset.id;
      const product = allProducts.find(p => p.id === pid);
      if (product) { State.addToCart(product); showToast(`${product.name} added to cart`, 'success', 1500); }
    });
  });

  // Restore scroll position
  const scrollArea = document.getElementById('pos-product-scroll');
  const savedScroll = sessionStorage.getItem('gs_pos_scroll');
  if (savedScroll && scrollArea) {
    setTimeout(() => { scrollArea.scrollTop = parseInt(savedScroll); }, 150);
  }
}

function renderCart() {
  const container = document.getElementById('cart-items');
  if (!container) {
    State.off('cart', renderCart);
    return;
  }

  const cart = State.cart;
  const { subtotal, tax, total } = State.getCartTotals();
  const taxRatePct = (State.settings.taxRate * 100).toFixed(1).replace(/\.0$/, '');
  const totalQty = cart.reduce((s,i)=>s+i.qty,0);

  const taxLabel = document.getElementById('cart-tax-label');
  if (taxLabel) taxLabel.textContent = `Tax (${taxRatePct}%)`;
  document.getElementById('cart-subtotal').textContent = formatRupiah(subtotal);
  document.getElementById('cart-tax').textContent = formatRupiah(tax);
  document.getElementById('cart-total').textContent = formatRupiah(total);
  document.getElementById('cart-items-count').textContent = `${totalQty} items`;

  // Update mobile badge
  const badge = document.getElementById('mobile-cart-badge');
  if (badge) {
    if (totalQty > 0) {
      badge.textContent = totalQty > 99 ? '99+' : totalQty;
      badge.style.display = 'block';
    } else {
      badge.style.display = 'none';
    }
  }

  if (!cart.length) {
    container.innerHTML = `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0.3;padding:2rem;"><span class="material-symbols-outlined" style="font-size:3rem;">shopping_bag</span><p style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.1em;font-weight:700;margin-top:0.5rem;">Cart is empty</p></div>`;
    return;
  }

  container.innerHTML = cart.map(item => {
    const icon = item.category === 'Smartphones' ? 'smartphone' : item.category === 'Audio' ? 'headphones' : item.category === 'Wearables' ? 'watch' : item.category === 'Tablets' ? 'tablet' : item.category === 'Laptops' ? 'laptop' : 'devices';
    const imgHtml = item.image_url 
      ? `<img src="${item.image_url}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-block';" />
         <span class="material-symbols-outlined" style="color:var(--outline);display:none;">${icon}</span>`
      : `<span class="material-symbols-outlined" style="color:var(--outline);">${icon}</span>`;
      
    return `
    <div class="cart-item">
      <div style="width:3.5rem;height:3.5rem;background:var(--surface-container-low);border-radius:0.5rem;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;">
        ${imgHtml}
      </div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;">
          <p style="font-size:0.8125rem;font-weight:700;color:var(--text-blue);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${item.name}</p>
        </div>
        <p style="font-size:0.6875rem;color:var(--on-surface-variant);font-weight:500;">
          ${formatRupiah(item.price)} / unit <span style="margin:0 0.25rem;opacity:0.3;">•</span> <span style="font-weight:700;color:var(--text-blue);">${formatRupiah(item.price * item.qty)}</span>
        </p>
        <div style="display:flex;align-items:center;gap:0.75rem;margin-top:0.5rem;">
          <div style="display:flex;align-items:center;background:var(--surface-container-low);border-radius:0.5rem;overflow:hidden;">
            <button onclick="updateQty('${item.product_id}', ${item.qty - 1})" style="border:none;background:none;padding:0.25rem 0.5rem;cursor:pointer;font-size:1.125rem;line-height:1;color:var(--on-surface);">−</button>
            <span style="padding:0.25rem 0.5rem;font-size:0.8125rem;font-weight:700;color:var(--on-surface);">${item.qty}</span>
            <button onclick="updateQty('${item.product_id}', ${item.qty + 1})" style="border:none;background:none;padding:0.25rem 0.5rem;cursor:pointer;font-size:1.125rem;line-height:1;color:var(--on-surface);">+</button>
          </div>
          <button onclick="removeItem('${item.product_id}')" style="border:none;background:none;cursor:pointer;font-size:0.6875rem;font-weight:700;color:var(--error);text-transform:uppercase;letter-spacing:0.05em;">Remove</button>
        </div>
      </div>
    </div>
  `}).join('');
}

window.filterCategory = function(btn, cat) {
  document.querySelectorAll('.filter-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentCategory = cat;
  loadProducts(currentCategory, currentSearch);
};
window.updateQty = (id, qty) => { State.updateQty(id, qty); };
window.removeItem = (id) => { State.removeFromCart(id); };
window.clearCart = () => { if (State.cart.length) showConfirm('Clear the current order?', () => State.clearCart()); };
window.goCheckout = () => {
  if (!State.cart.length) { showToast('Add items to cart first', 'error'); return; }
  const name = document.getElementById('customer-name-input').value.trim();
  State.currentUser.customerName = name || 'Walk-in Customer';
  navigate('/checkout');
};

// Mobile tab switching
window.switchPosTab = function(tab) {
  const productsPanel = document.getElementById('pos-products-panel');
  const cartPanel     = document.getElementById('pos-cart-panel');
  const tabProducts   = document.getElementById('tab-products');
  const tabCart       = document.getElementById('tab-cart');
  if (!tabProducts) return; // desktop mode, ignore

  if (tab === 'products') {
    productsPanel.classList.remove('mobile-hidden');
    cartPanel.classList.remove('mobile-active');
    tabProducts.style.background = 'var(--primary-container)';
    tabProducts.style.color = '#fff';
    tabCart.style.background = '#fff';
    tabCart.style.color = 'var(--on-surface-variant)';
  } else {
    productsPanel.classList.add('mobile-hidden');
    cartPanel.classList.add('mobile-active');
    tabProducts.style.background = '#fff';
    tabProducts.style.color = 'var(--on-surface-variant)';
    tabCart.style.background = 'var(--primary-container)';
    tabCart.style.color = '#fff';
  }
};

window.switchGrid = function(cols) {
  const grid = document.getElementById('product-grid');
  grid.classList.remove('grid-cols-1', 'grid-cols-2', 'grid-cols-3');
  grid.classList.add(`grid-cols-${cols}`);
  
  // Update buttons
  document.querySelectorAll('.grid-toggle-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(`grid-btn-${cols}`)?.classList.add('active');
  
  // Save preference
  localStorage.setItem('gs_pos_mobile_grid', cols);
};

State.on('cart', renderCart);
State.on('settings', () => {
  renderCart();
  loadProducts(currentCategory, currentSearch);
});

// ─── Scanner Implementation ───────────────────────────────────────
let html5QrCode = null;

window.openScanner = async function() {
  const modal = document.getElementById('scanner-modal');
  modal.style.display = 'flex';
  document.getElementById('close-scanner-btn').onclick = closeScanner;
  
  if (!html5QrCode) {
    html5QrCode = new Html5Qrcode("reader");
  }

  const config = { fps: 10, qrbox: { width: 250, height: 150 } };
  
  try {
    await html5QrCode.start(
      { facingMode: "environment" }, 
      config,
      async (decodedText) => {
        const sku = decodedText.trim();
        if (navigator.vibrate) navigator.vibrate(100);
        
        console.log(`Code scanned: ${sku}`);
        
        try {
          const { products } = await ProductsAPI.list({ search: sku, limit: 1 });
          if (products && products.length > 0) {
            const product = products.find(p => p.sku.toLowerCase() === sku.toLowerCase()) || products[0];
            
            if (product.stock <= 0) {
              showToast(`${product.name} is out of stock!`, 'error');
            } else {
              State.addToCart(product);
              showToast(`${product.name} added to cart`, 'success', 1000);
            }
          } else {
            showToast(`Product with SKU "${sku}" not found`, 'error');
          }
        } catch (err) {
          showToast('Search failed: ' + err.message, 'error');
        }
      }
    );
  } catch (err) {
    showToast('Camera error: ' + err.message, 'error');
    closeScanner();
  }
};

window.closeScanner = async function() {
  if (html5QrCode && html5QrCode.isScanning) {
    await html5QrCode.stop();
  }
  document.getElementById('scanner-modal').style.display = 'none';
};

async function init() {
  await loadCategories();
  loadProducts();
  renderCart();
  
  // Initialize mobile grid if on mobile
  const savedGrid = localStorage.getItem('gs_pos_mobile_grid') || 2;
  if (window.innerWidth < 768) {
    switchGrid(parseInt(savedGrid));
  }

  // Dynamically position the tab bar flush under the guest banner (no gap)
  function updatePosTabPosition() {
    if (window.innerWidth >= 768) return; // only on mobile
    const headerH = document.getElementById('topbar')?.offsetHeight || 56;
    const banner  = document.getElementById('guest-banner');
    const bannerH = (banner && banner.style.display !== 'none') ? banner.offsetHeight : 0;
    const tabTop  = headerH + bannerH;
    const tabBar  = document.getElementById('pos-mobile-tabs');
    const tabH    = tabBar ? tabBar.offsetHeight : 44;
    // Set CSS custom properties on the pos-layout element
    const layout = document.getElementById('pos-layout');
    if (layout) {
      layout.style.setProperty('--pos-tab-top', `${tabTop}px`);
      layout.style.setProperty('--pos-layout-top', `${tabH}px`);
    }
    // Also set on the tab element itself via inline style
    if (tabBar) tabBar.style.top = `${tabTop}px`;
  }

  updatePosTabPosition();
  window.addEventListener('resize', updatePosTabPosition);
  // Re-run when guest banner may appear/disappear
  const bannerObserver = new MutationObserver(updatePosTabPosition);
  const banner = document.getElementById('guest-banner');
  if (banner) bannerObserver.observe(banner, { attributes: true, attributeFilter: ['style'] });

  State.on('cart', renderCart);
}

init();
