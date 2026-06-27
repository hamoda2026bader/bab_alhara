async function fetchProducts() {
  try {
    const response = await window.supabaseRequest('/products?select=*&order=id');
    if (response && response.length > 0) {
      console.log('[products] Schema from Supabase:', Object.keys(response[0]));
    }
    return response;
  } catch (e) {
    console.error('[products] Supabase fetch failed:', e.message);
    return [];
  }
}

async function saveProductsLocal(products) {
}

async function loadProducts() {
  return await fetchProducts();
}

async function renderProducts() {
  checkAuth();
  const products = await loadProducts();
  const tableBody = document.getElementById('products-table-body');

  if (!tableBody) return;

  if (products.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95a5a6;padding:40px;">لا توجد منتجات. أضف أول منتج!</td></tr>';
    return;
  }

  if (!window._productsSchemaLogged && products.length > 0) {
    window._productsSchemaLogged = true;
    console.log('[products] Schema from Supabase:', Object.keys(products[0]));
  }

  const normalizeProduct = p => {
    const stock = parseInt(p.stock ?? p.quantity ?? 0) || 0;
    const purchase = parseFloat(p.purchaseprice ?? p.purchase_price ?? p.purchasePrice ?? p.cost_price ?? p.cost ?? p.price ?? 0) || 0;
    const selling = parseFloat(p.sellingprice ?? p.selling_price ?? p.sellingPrice ?? p.sale_price ?? purchase ?? 0) || 0;
    return {
      ...p,
      stock,
      purchasePrice: purchase,
      sellingPrice: selling,
    };
  };

  const normalized = products.map(normalizeProduct);

  tableBody.innerHTML = normalized.map(p => {
    const stock = parseInt(p.stock) || 0;
    const stockClass = stock < 10 ? 'low-stock' : 'in-stock';
    return `
      <tr>
        <td><span class="stock-indicator ${stockClass}"></span> ${p.name}</td>
        <td>${p.barcode || '-'}</td>
        <td>${formatCurrency(p.purchaseprice)}</td>
        <td>${formatCurrency(p.sellingprice)}</td>
        <td><span class="badge badge-${stock < 5 ? 'danger' : stock < 10 ? 'warning' : 'success'}">${stock}</span></td>
        <td>
          <div class="table-actions">
            <button class="btn btn-primary btn-sm" onclick="editProduct(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>
            <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})" title="حذف"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function generateId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function generateBarcode(name) {
  const base = (name || 'NEW').substring(0, 3).toUpperCase();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `${base}${random}`;
}

function openProductModal(product = null) {
  checkAuth();
  const modal = document.getElementById('product-modal');
  const title = document.getElementById('modal-title');

  if (product) {
    title.textContent = 'تعديل منتج';
    document.getElementById('product-id').value = product.id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-barcode').value = product.barcode || '';
    document.getElementById('product-purchase-price').value = product.purchaseprice;
    document.getElementById('product-selling-price').value = product.sellingprice;
    document.getElementById('product-stock').value = product.stock;
  } else {
    title.textContent = 'إضافة منتج';
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-barcode').value = generateBarcode('');
    document.getElementById('product-stock').value = 0;
  }

  modal.classList.add('active');
  document.getElementById('product-name').focus();
}

function closeProductModal() {
  document.getElementById('product-modal').classList.remove('active');
}

async function saveProduct(e) {
  e.preventDefault();
  checkAuth();

  const id = document.getElementById('product-id').value;
  const name = document.getElementById('product-name').value.trim();
  const barcode = document.getElementById('product-barcode').value.trim();
  const purchasePrice = parseFloat(document.getElementById('product-purchase-price').value) || 0;
  const sellingPrice = parseFloat(document.getElementById('product-selling-price').value) || 0;
  const stock = parseInt(document.getElementById('product-stock').value) || 0;

  if (!name || sellingPrice <= 0) {
    alert('يرجى إدخال اسم المنتج وسعر البيع');
    return;
  }

  const finalBarcode = barcode || generateBarcode(name);
  const productData = { name, barcode: finalBarcode, purchaseprice: purchasePrice, sellingprice: sellingPrice, stock };

  console.log('[products] Saving:', productData);

  try {
    if (window.supabaseAuth) {
      if (id) {
        const { error } = await window.supabaseAuth
          .from('products')
          .update(productData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await window.supabaseAuth
          .from('products')
          .insert([{ ...productData, created: new Date().toISOString() }]);
        if (error) throw error;
      }
    } else {
      if (id) {
        await supabaseRequest(`/products?id=eq.${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(productData)
        });
      } else {
        await supabaseRequest('/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...productData, created: new Date().toISOString() })
        });
      }
    }
    closeProductModal();
    renderProducts();
  } catch (error) {
    console.error('[products] Save failed:', error);
    alert('فشل الحفظ: ' + error.message);
  }
}

async function editProduct(id) {
  try {
    const products = await loadProducts();
    const product = products.find(p => p.id === id);
    if (product) openProductModal(product);
  } catch (error) {
    alert('خطأ في تحميل المنتج');
  }
}

async function deleteProduct(id) {
  checkAuth();
  if (!confirm('هل أنت متأكد من حذف هذا المنتج؟')) return;

  try {
    if (window.supabaseAuth) {
      const { error } = await window.supabaseAuth
        .from('products')
        .delete()
        .eq('id', id);
      if (error) throw error;
    } else {
      await supabaseRequest(`/products?id=eq.${id}`, { method: 'DELETE' });
    }
    renderProducts();
  } catch (error) {
    console.error('[products] Delete failed:', error);
    alert('فشل الحذف: ' + error.message);
  }
}

async function searchProducts() {
  const query = document.getElementById('search-input').value.toLowerCase();

  try {
    if (window.supabaseAuth) {
      let q = window.supabaseAuth.from('products').select('*');
      if (query) {
        q = q.or(`name.ilike.%${query}%,barcode.ilike.%${query}%`);
      }
      const { data, error } = await q.order('id', { ascending: true });
      if (error) throw error;
      const products = data || [];
      const tableBody = document.getElementById('products-table-body');
      if (!tableBody) return;

      if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95a5a6;padding:40px;">لا توجد منتجات. أضف أول منتج!</td></tr>';
        return;
      }

      tableBody.innerHTML = products.map(p => {
        const stock = parseInt(p.stock) || 0;
        const stockClass = stock < 10 ? 'low-stock' : 'in-stock';
        return `
          <tr>
            <td><span class="stock-indicator ${stockClass}"></span> ${p.name}</td>
            <td>${p.barcode || '-'}</td>
            <td>${formatCurrency(p.purchaseprice)}</td>
            <td>${formatCurrency(p.sellingprice)}</td>
            <td><span class="badge badge-${stock < 5 ? 'danger' : stock < 10 ? 'warning' : 'success'}">${stock}</span></td>
            <td>
              <div class="table-actions">
                <button class="btn btn-primary btn-sm" onclick="editProduct(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})" title="حذف"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      const products = query 
        ? await supabaseRequest(`/products?select=*&or=(name.ilike.*${query}*,barcode.ilike.*${query}*)`)
        : await loadProducts();

      const tableBody = document.getElementById('products-table-body');
      if (!tableBody) return;

      if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95a5a6;padding:40px;">لا توجد منتجات. أضف أول منتج!</td></tr>';
        return;
      }

      tableBody.innerHTML = products.map(p => {
        const stock = parseInt(p.stock) || 0;
        const stockClass = stock < 10 ? 'low-stock' : 'in-stock';
        return `
          <tr>
            <td><span class="stock-indicator ${stockClass}"></span> ${p.name}</td>
            <td>${p.barcode || '-'}</td>
            <td>${formatCurrency(p.purchaseprice)}</td>
            <td>${formatCurrency(p.sellingprice)}</td>
            <td><span class="badge badge-${stock < 5 ? 'danger' : stock < 10 ? 'warning' : 'success'}">${stock}</span></td>
            <td>
              <div class="table-actions">
                <button class="btn btn-primary btn-sm" onclick="editProduct(${p.id})" title="تعديل"><i class="fas fa-edit"></i></button>
                <button class="btn btn-danger btn-sm" onclick="deleteProduct(${p.id})" title="حذف"><i class="fas fa-trash"></i></button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('[products] Search failed:', error);
    alert('فشل البحث: ' + error.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  localStorage.removeItem('local_products');
  console.log('[products] Local data cleared');

  const user = checkAuth();
  if (!user) return;

  initSidebar(user);

  document.getElementById('product-form').addEventListener('submit', saveProduct);

  document.getElementById('search-input').addEventListener('input', searchProducts);

  document.getElementById('product-modal').addEventListener('click', (e) => {
    if (e.target.id === 'product-modal') closeProductModal();
  });

  renderProducts();
});
