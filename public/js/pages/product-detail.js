import { ProductsAPI } from '/js/api.js';
import { formatRupiah, getHashParams, showToast, showConfirm } from '/js/utils.js';
import State from '/js/state.js';

let productId = null;

window.formatCurrencyInput = function(el) {
  let val = el.value.replace(/[^0-9]/g, '');
  if (val) el.value = parseInt(val, 10).toLocaleString('id-ID');
  else el.value = '';
};

function calcMargin() {
  const sellStr = document.getElementById('f-price-sell').value.replace(/\./g, '');
  const buyStr  = document.getElementById('f-price-buy').value.replace(/\./g, '');
  const sell = parseInt(sellStr) || 0;
  const buy  = parseInt(buyStr) || 0;
  const el   = document.getElementById('margin-text');
  if (sell && buy) {
    const pct = (((sell - buy) / buy) * 100).toFixed(1);
    el.textContent = `${formatRupiah(sell - buy)} (${pct}%)`;
    el.style.color = pct > 0 ? '#15803d' : 'var(--error)';
  } else el.textContent = '— %';
}

const fPriceSell = document.getElementById('f-price-sell');
const fPriceBuy = document.getElementById('f-price-buy');
if (fPriceSell) fPriceSell.addEventListener('input', calcMargin);
if (fPriceBuy) fPriceBuy.addEventListener('input', calcMargin);

const fImage = document.getElementById('f-image');
if (fImage) {
  fImage.addEventListener('input', () => {
    const url = fImage.value;
    const prev = document.getElementById('img-preview');
    if (url) prev.innerHTML = `<img src="${url}" style="width:100%;height:100%;object-fit:contain;" onerror="this.style.display='none'">`;
    else prev.innerHTML = `<span class="material-symbols-outlined" style="font-size:4rem;color:var(--outline);">image</span>`;
  });
}

window.handleImageUpload = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    const img = new Image();
    img.onload = function() {
      // Resize to max 600px width/height to save database space
      const max_size = 600;
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > max_size) {
          height *= max_size / width;
          width = max_size;
        }
      } else {
        if (height > max_size) {
          width *= max_size / height;
          height = max_size;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      const input = document.getElementById('f-image');
      input.value = dataUrl;
      input.dispatchEvent(new Event('input')); // Update preview
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
};

let cameraStream = null;

window.openCamera = async function() {
  const modal = document.getElementById('camera-modal');
  const video = document.getElementById('camera-video');
  modal.style.display = 'flex';
  
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 800 }, height: { ideal: 600 } },
      audio: false
    });
    video.srcObject = cameraStream;
  } catch (err) {
    showToast('Failed to access camera: ' + err.message, 'error');
    closeCamera();
  }
};

window.capturePhoto = function() {
  const video = document.getElementById('camera-video');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  // Resize to max 600px width/height to save database space
  const max_size = 600;
  let width = canvas.width;
  let height = canvas.height;
  if (width > height) {
    if (width > max_size) {
      height *= max_size / width;
      width = max_size;
    }
  } else {
    if (height > max_size) {
      width *= max_size / height;
      height = max_size;
    }
  }
  
  const resizeCanvas = document.createElement('canvas');
  resizeCanvas.width = width;
  resizeCanvas.height = height;
  const resizeCtx = resizeCanvas.getContext('2d');
  resizeCtx.drawImage(canvas, 0, 0, width, height);
  
  const dataUrl = resizeCanvas.toDataURL('image/jpeg', 0.8);
  const input = document.getElementById('f-image');
  input.value = dataUrl;
  input.dispatchEvent(new Event('input')); // Update preview
  
  showToast('Photo captured!', 'success');
  closeCamera();
};

window.closeCamera = function() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  const modal = document.getElementById('camera-modal');
  if (modal) modal.style.display = 'none';
};

async function init() {
  const params = getHashParams();
  if (params.id) {
    productId = params.id;
    document.getElementById('page-title').textContent = 'Edit Product';
    document.getElementById('save-label').textContent = 'Save Changes';
    document.getElementById('delete-btn').style.display = 'flex';
    try {
      const p = await ProductsAPI.get(productId);
      document.getElementById('breadcrumb-title').textContent = p.name;
      document.getElementById('f-name').value = p.name;
      document.getElementById('f-brand').value = p.brand || '';
      document.getElementById('f-sku').value = p.sku;
      document.getElementById('f-sku').readOnly = true;
      document.getElementById('f-category').value = p.category || '';
      document.getElementById('f-desc').value = p.description || '';
      document.getElementById('f-price-sell').value = parseInt(p.price_sell).toLocaleString('id-ID');
      document.getElementById('f-price-buy').value = p.price_buy ? parseInt(p.price_buy).toLocaleString('id-ID') : '';
      document.getElementById('f-stock').value = p.stock;
      document.getElementById('f-stock-min').value = p.stock_min;
      document.getElementById('f-image').value = p.image_url || '';
      if (p.image_url) document.getElementById('img-preview').innerHTML = `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:contain;">`;
      calcMargin();
    } catch (err) { showToast('Failed to load product: ' + err.message, 'error'); }
  }
}

window.saveProduct = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('save-btn');
  btn.disabled = true; btn.querySelector('.material-symbols-outlined').textContent = 'hourglass_empty';
  try {
    const body = {
      name: document.getElementById('f-name').value,
      brand: document.getElementById('f-brand').value,
      sku: document.getElementById('f-sku').value,
      category: document.getElementById('f-category').value,
      description: document.getElementById('f-desc').value,
      price_sell: parseInt(document.getElementById('f-price-sell').value.replace(/\./g, '')),
      price_buy: parseInt(document.getElementById('f-price-buy').value.replace(/\./g, '')) || 0,
      stock: parseInt(document.getElementById('f-stock').value) || 0,
      stock_min: parseInt(document.getElementById('f-stock-min').value) || 5,
      image_url: document.getElementById('f-image').value || null
    };

    if (State.isGuest) {
      // Guest mode: simulate success without database write
      showToast(`[Demo] Product "${body.name}" ${productId ? 'updated' : 'added'} — tidak disimpan ke database`, 'info', 3000);
      setTimeout(() => navigate('/inventory'), 1200);
      return;
    }

    if (productId) await ProductsAPI.update(productId, body);
    else await ProductsAPI.create(body);
    showToast(`Product ${productId ? 'updated' : 'created'} successfully!`, 'success');
    setTimeout(() => navigate('/inventory'), 1000);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
    btn.disabled = false; btn.querySelector('.material-symbols-outlined').textContent = 'save';
  }
};

window.deleteProduct = function() {
  if (State.isGuest) {
    showToast('[Demo] Hapus produk tidak tersimpan ke database', 'info', 3000);
    setTimeout(() => navigate('/inventory'), 1200);
    return;
  }
  showConfirm('This will deactivate the product. Continue?', async () => {
    try {
      await ProductsAPI.delete(productId);
      showToast('Product deactivated', 'info');
      setTimeout(() => navigate('/inventory'), 800);
    } catch (err) { showToast('Delete failed: ' + err.message, 'error'); }
  });
};

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
      (decodedText) => {
        const sku = decodedText.trim();
        if (navigator.vibrate) navigator.vibrate(100);
        
        document.getElementById('f-sku').value = sku;
        showToast(`SKU Scanned: ${sku}`, 'success');
        closeScanner();
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

init();
