// tests/setup.mjs
// Shared test environment setup for Maintainability testing

// Fallback dummy env vars for test environment
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://dummy-test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy-test-service-key-abcdef';

export function createMockStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k];
    },
    get _raw() { return store; }
  };
}

export function setupEnvironment(initialStorage = {}) {
  const storage = createMockStorage(initialStorage);
  globalThis.localStorage = storage;
  
  globalThis.fetch = async (url) => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        terminal: 'Terminal 01',
        storeName: 'GadgetStock',
        receiptFooter: 'Terima kasih telah berbelanja!',
        taxRate: 0.11,
        lowStockThreshold: 10,
        posCardSize: 180,
        posItemsPerPage: 20,
        enabledPaymentMethods: ['cash', 'debit', 'qris', 'credit']
      })
    };
  };

  return { storage };
}
