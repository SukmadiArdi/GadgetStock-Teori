// public/js/state.js - Global in-memory state management

const State = {
  // Currently logged-in user
  currentUser: (() => {
    try {
      const stored = localStorage.getItem('gs_user');
      if (stored === 'undefined') return null;
      return stored ? JSON.parse(stored) : null;
    } catch(e) {
      console.warn('Failed to parse gs_user from localStorage', e);
      return null;
    }
  })(),

  // Guest Mode flag
  get isGuest() {
    return this.currentUser?.role === '_guest';
  },

  // Global App Settings
  settings: JSON.parse(localStorage.getItem('gs_settings')) || {
    terminal: 'Terminal 01',
    storeName: 'GadgetStock',
    receiptFooter: 'Terima kasih telah berbelanja!',
    taxRate: 0.11, // 11%
    lowStockThreshold: 10,
    posCardSize: 180, // min width in px
    posItemsPerPage: 20,
    enabledPaymentMethods: ['cash', 'debit', 'qris', 'credit']
  },
  
  // Persistent cart
  cart: (() => {
    try {
      const stored = localStorage.getItem('gs_cart');
      return stored ? JSON.parse(stored) : [];
    } catch(e) { return []; }
  })(),

  // Listeners for state changes
  _listeners: {},

  // === Cart Methods =========================================

  addToCart(product, qty = 1) {
    const existing = this.cart.find(i => i.product_id === product.id);
    if (existing) {
      existing.qty = Math.min(existing.qty + qty, product.stock);
    } else {
      this.cart.push({
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        price: product.price_sell,
        image_url: product.image_url,
        category: product.category,
        stock: product.stock,
        qty: qty
      });
    }
    this._emit('cart');
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(i => i.product_id !== productId);
    this._emit('cart');
  },

  updateQty(productId, qty) {
    const item = this.cart.find(i => i.product_id === productId);
    if (item) {
      if (qty <= 0) {
        this.removeFromCart(productId);
      } else {
        item.qty = Math.min(qty, item.stock);
        this._emit('cart');
      }
    }
  },

  clearCart() {
    this.cart = [];
    this._emit('cart');
  },

  getCartTotals() {
    const subtotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const tax = Math.round(subtotal * this.settings.taxRate);
    const total = subtotal + tax;
    return { subtotal, tax, total, itemCount: this.cart.length };
  },

  // === Transaction Methods ===================================

  setCurrentTxn(txn) {
    this.currentTxn = txn;
    this._emit('txn');
  },

  // === Settings Methods ======================================
  
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    localStorage.setItem('gs_settings', JSON.stringify(this.settings));
    this._emit('settings');
    this._emit('user');

    // Skip server sync in guest mode
    if (this.isGuest) return;

    // Sync with backend
    try {
      const payload = {};
      if (newSettings.storeName !== undefined) payload.store_name = newSettings.storeName;
      if (newSettings.taxRate !== undefined) payload.tax_rate = newSettings.taxRate;
      if (newSettings.receiptFooter !== undefined) payload.receipt_footer = newSettings.receiptFooter;
      if (newSettings.lowStockThreshold !== undefined) payload.low_stock_threshold = newSettings.lowStockThreshold;
      if (newSettings.posCardSize !== undefined) payload.pos_card_size = newSettings.posCardSize;
      if (newSettings.posItemsPerPage !== undefined) payload.pos_items_per_page = newSettings.posItemsPerPage;
      if (newSettings.enabledPaymentMethods !== undefined) payload.enabled_payment_methods = JSON.stringify(newSettings.enabledPaymentMethods);
      
      if (Object.keys(payload).length > 0) {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    } catch (err) {
      console.error('Failed to sync settings with server', err);
    }
  },

  async fetchSettings() {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        const updated = {
          ...this.settings,
          storeName: data.store_name || this.settings.storeName,
          taxRate: parseFloat(data.tax_rate) || this.settings.taxRate,
          receiptFooter: data.receipt_footer || this.settings.receiptFooter,
          lowStockThreshold: parseInt(data.low_stock_threshold) || this.settings.lowStockThreshold,
          posCardSize: parseInt(data.pos_card_size) || this.settings.posCardSize,
          posItemsPerPage: parseInt(data.pos_items_per_page) || this.settings.posItemsPerPage,
          enabledPaymentMethods: data.enabled_payment_methods ? JSON.parse(data.enabled_payment_methods) : this.settings.enabledPaymentMethods
        };
        this.settings = updated;
        localStorage.setItem('gs_settings', JSON.stringify(this.settings));
        this._emit('settings');
      }
    } catch (err) {
      console.error('Failed to fetch settings', err);
    }
  },

  // === User Methods ==========================================

  setUser(user, profile) {
    this.currentUser = {
      id: user.id,
      name: profile?.full_name || user.user_metadata?.full_name || user.email,
      role: profile?.role || user.user_metadata?.role || 'cashier',
      employee_id: profile?.employee_id || user.user_metadata?.employee_id,
      initials: (profile?.full_name || user.user_metadata?.full_name || 'U').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    };
    // No need to set terminal here since it comes from settings now
    localStorage.setItem('gs_user', JSON.stringify(this.currentUser));
    this._emit('user');
  },

  setGuestMode() {
    this.currentUser = {
      id: 'guest',
      name: 'Guest User',
      role: '_guest',
      employee_id: 'GUEST',
      initials: 'GU'
    };
    // Don't persist guest to localStorage
    this._emit('user');
  },

  logout() {
    this.currentUser = null;
    this.cart = [];
    localStorage.removeItem('gs_user');
    localStorage.removeItem('gs_cart');
    this._emit('cart');
    this._emit('user');
  },

  // === Event Emitter =========================================

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  },

  off(event, cb) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(l => l !== cb);
    }
  },

  clearPageListeners() {
    for (const event in this._listeners) {
      this._listeners[event] = this._listeners[event].filter(cb => cb.name === 'syncUserUI');
    }
  },

  _emit(event) {
    if (event === 'cart') {
      // Don't persist cart in guest mode
      if (!this.isGuest) {
        localStorage.setItem('gs_cart', JSON.stringify(this.cart));
      }
    }
    (this._listeners[event] || []).forEach(cb => cb(this));
  }
};

// Fetch initial settings from server
State.fetchSettings();

export default State;
