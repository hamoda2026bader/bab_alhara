// Supabase client with Auth + REST helpers (no framework needed)
// This file provides both window.supabaseAuth and window.supabaseRequest

const SUPABASE_URL = 'https://binpwhrndlndyjezgkzr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpbnB3aHJuZGxuZHlqZXpna3pyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTk0NjksImV4cCI6MjA5Nzk3NTQ2OX0.09fFyrZohzePo3qdYn6EAp6t34-YlNels1auZUQMb-w';

window.supabaseAuth = null;

// Initialize Supabase client - wait for library to load
(function() {
  function initSupabase() {
    if (window.supabase && !window.supabaseAuth) {
      window.supabaseAuth = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      console.log('[supabase] initialized');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
  } else {
    // Poll until supabase library is available
    const pollInterval = setInterval(() => {
      if (window.supabase) {
        clearInterval(pollInterval);
        initSupabase();
      }
    }, 100);
    // Stop polling after 5 seconds
    setTimeout(() => clearInterval(pollInterval), 5000);
    // Also try immediately in case library is already loaded
    initSupabase();
  }
})();

// REST helper (used by all pages)
window.supabaseRequest = async function supabaseRequest(endpoint, options = {}) {
  const url = `${SUPABASE_URL}/rest/v1${endpoint}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...options.headers
  };

  console.log('[supabase] Request:', url);

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      const error = await response.text();
      console.error('[supabase] Error response:', response.status, error);
      throw new Error(`${response.status}: ${error || 'Request failed'}`);
    }

    return response.json();
  } catch (error) {
    console.error('[supabase] Request error:', error.message);
    throw error;
  }
};

// Helper functions for data access
async function fetchUsers() {
  return window.supabaseRequest('/users?select=*&order=id');
}

async function fetchProducts() {
  return window.supabaseRequest('/products?select=*&order=id');
}

async function fetchSales() {
  return window.supabaseRequest('/sales?select=*&order=id.desc');
}

async function fetchDebts() {
  return window.supabaseRequest('/debts?select=*&order=id');
}

async function fetchPayments() {
  return window.supabaseRequest('/payments?select=*&order=id.desc');
}

async function fetchInventoryMovements() {
  return window.supabaseRequest('/inventory_movements?select=*&order=id.desc');
}

async function saveUser(userData) {
  const id = userData.id;
  if (id) {
    return window.supabaseRequest(`/users?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
  } else {
    return window.supabaseRequest('/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...userData, created: new Date().toISOString() })
    });
  }
}

async function deleteUserFromDb(id) {
  return window.supabaseRequest(`/users?id=eq.${id}`, { method: 'DELETE' });
}

async function saveProduct(product) {
  const id = product.id;
  if (id) {
    return window.supabaseRequest(`/products?id=eq.${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(product)
    });
  } else {
    return window.supabaseRequest('/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...product, created: new Date().toISOString() })
    });
  }
}

async function deleteProductFromDb(id) {
  return window.supabaseRequest(`/products?id=eq.${id}`, { method: 'DELETE' });
}

async function saveSale(sale) {
  return window.supabaseRequest('/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sale)
  });
}

async function deleteSale(id) {
  return window.supabaseRequest(`/sales?id=eq.${id}`, { method: 'DELETE' });
}

async function saveInventoryMovement(movement) {
  return window.supabaseRequest('/inventory_movements', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(movement)
  });
}

async function updateProductStock(productId, newStock) {
  return window.supabaseRequest(`/products?id=eq.${productId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stock: newStock })
  });
}