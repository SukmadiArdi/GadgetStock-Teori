import { ProductsAPI, DashboardAPI } from '/js/api.js';
import { formatRupiah, getStockStatus, debounce, getHashParams, isManagerOrAbove } from '/js/utils.js';
import State from '/js/state.js';


let currentPage = parseInt(localStorage.getItem('gs_inv_page')) || 1;
const limit = 12;
let searchTimeout;

window.debouncedSearchInv = debounce(() => {
  filterInventory();
}, 300);

window.filterInventory = () => {
  currentPage = 1;
  loadInventory();
};

async function loadCategories() {
  try {
    const { products } = await ProductsAPI.list({ limit: 1000 });
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
    const select = document.getElementById('cat-filter');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Categories</option>' + 
      categories.map(c => `<option value="${c}" ${c===currentVal?'selected':''}>${c}</option>`).join('');
  } catch (err) { console.error('Failed to load categories', err); }
}

async function loadInventory() {
  localStorage.setItem('gs_inv_page', currentPage);
  const tbody = document.getElementById('inventory-tbody');
  tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:3rem;color:var(--on-surface-variant);">Loading...</td></tr>`;

  try {
    const cat    = document.getElementById('cat-filter')?.value;
    const status = document.getElementById('status-filter')?.value;
    const search = document.getElementById('search-filter')?.value;
    
    const params = { page: currentPage, limit, category: cat, status };
    if (search) params.search = search;
    const { products, pagination } = await ProductsAPI.list(params);

    if (!products.length && currentPage > 1) {
      currentPage = 1;
      return loadInventory();
    }

    // Cek apakah user bisa manage produk
    const canManage = isManagerOrAbove(State.currentUser);
    const colspan = canManage ? 8 : 7;

    if (!products.length) {
      tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center;padding:3rem;color:var(--outline);">No products found</td></tr>`;
      document.getElementById('inventory-pagination').style.display = 'none';
      return;
    }

    tbody.innerHTML = products.map(p => {
      const s = getStockStatus(p.stock, p.stock_min);
      return `<tr>
        <td><span style="font-family:monospace;font-size:0.75rem;color:var(--on-surface-variant);">${p.sku}</span></td>
        <td style="font-weight:700;color:var(--text-blue);">${p.brand||'—'}</td>
        <td>${p.name}</td>
        <td style="font-size:0.8125rem;color:var(--on-surface-variant);">${p.category||'—'}</td>
        <td style="text-align:right;font-weight:700;color:var(--text-blue);" class="text-rupiah">${formatRupiah(p.price_sell)}</td>
        <td style="text-align:center;"><span class="badge ${s.class}">${s.label}</span></td>
        <td style="text-align:right;font-weight:700;${p.stock===0?'color:var(--error)':p.stock<=p.stock_min?'color:#b45309':''}">${p.stock}</td>
        ${canManage ? `<td style="text-align:center;"><button class="btn btn-ghost btn-sm" onclick="navigate('/product-detail?id=${p.id}')" title="Edit"><span class="material-symbols-outlined" style="font-size:1.125rem;">edit</span></button></td>` : ''}
      </tr>`;
    }).join('');

    // Sesuaikan header kolom Aksi
    const actionHeader = document.getElementById('inv-action-header');
    if (actionHeader) actionHeader.style.display = canManage ? '' : 'none';

    // Sembunyikan tombol Add Product untuk cashier
    const addBtn = document.getElementById('btn-add-product');
    if (addBtn) addBtn.style.display = canManage ? '' : 'none';

    // Pagination
    const pag = document.getElementById('inventory-pagination');
    pag.style.display = 'flex';
    
    // Restore scroll position after table is filled
    const scrollArea = document.getElementById('inv-table-scroll');
    const savedScroll = sessionStorage.getItem('gs_inv_scroll');
    if (savedScroll && scrollArea) {
      setTimeout(() => { scrollArea.scrollTop = parseInt(savedScroll); }, 50);
    }
    document.getElementById('pagination-info').textContent = `Showing ${(currentPage-1)*limit+1}–${Math.min(currentPage*limit, pagination.total)} of ${pagination.total} products`;
    const ctrl = document.getElementById('pagination-controls');
    ctrl.innerHTML = `
      <button class="page-btn" onclick="changePage(${currentPage-1})" ${currentPage<=1?'disabled':''}>
        <span class="material-symbols-outlined" style="font-size:1.125rem;">chevron_left</span>
      </button>
      <span class="page-btn active">${currentPage}</span>
      <button class="page-btn" onclick="changePage(${currentPage+1})" ${currentPage>=pagination.pages?'disabled':''}>
        <span class="material-symbols-outlined" style="font-size:1.125rem;">chevron_right</span>
      </button>
    `;

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--error);">${err.message}</td></tr>`;
  }
}

window.changePage = function(p) { currentPage = p; localStorage.setItem('gs_inv_page', p); loadInventory(); };
window.clearFilters = function() {
  document.getElementById('search-filter').value = '';
  document.getElementById('cat-filter').value = '';
  document.getElementById('status-filter').value = '';
  currentPage = 1; 
  localStorage.setItem('gs_inv_page', 1);
  loadInventory();
};

// Load dashboard stats for sidebar
DashboardAPI.getSummary().then(data => {
  document.getElementById('inv-value').textContent = formatRupiah(data.inventory.stock_value);
  document.getElementById('inv-low').textContent   = data.inventory.low_stock_count + ' Items';
  document.getElementById('inv-oos').textContent   = data.inventory.out_of_stock_count + ' Items';
}).catch(() => {});

// Initialize search from URL params if present
const params = getHashParams();
if (params.search) {
  const searchInput = document.getElementById('search-filter');
  if (searchInput) searchInput.value = decodeURIComponent(params.search);
}

loadCategories();
loadInventory();
