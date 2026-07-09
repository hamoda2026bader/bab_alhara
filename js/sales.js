async function loadProducts() {
  return await fetchProducts();
}

async function loadSales() {
  return await fetchSales();
}

async function loadDebts() {
  return await fetchDebts();
}

async function loadCustomers() {
  try {
    const sales = await loadSales();
    const customers = [...new Set(sales.map(s => s.customername).filter(c => c))].sort();
    const datalist = document.getElementById('customer-list');
    if (datalist) {
      datalist.innerHTML = customers.map(c => `<option value="${c}"></option>`).join('');
    }
  } catch (e) {}
}

let currentInvoiceItems = [];
let currentInvoiceFilter = 'today';
let currentInvoiceSearch = '';

function setPaymentStatus(status) {
  document.getElementById('invoice-status').value = status;
  document.getElementById('btn-paid').classList.toggle('active', status === 'paid');
  document.getElementById('btn-debt').classList.toggle('active', status === 'debt');
  document.getElementById('btn-returned').classList.toggle('active', status === 'returned');
}

function initSalesPage() {
  checkAuth();
  currentInvoiceItems = [];
  setPaymentStatus('paid');
  updateInvoiceSummary();

  const barcodeInput = document.getElementById('barcode-input');
  if (barcodeInput) {
    barcodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleBarcodeScan();
      }
    });
  }
}

async function handleBarcodeScan() {
  const input = document.getElementById('barcode-input').value.trim();
  if (!input) return;

  try {
    const products = await loadProducts();
    const product = products.find(p =>
      (p.barcode && p.barcode.toLowerCase() === input.toLowerCase()) ||
      p.name.toLowerCase() === input.toLowerCase()
    );

    if (!product) {
      alert('المنتج غير موجود: ' + input);
      document.getElementById('barcode-input').select();
      return;
    }

    addToInvoice(product.id);
    document.getElementById('barcode-input').value = '';
    document.getElementById('barcode-input').focus();
  } catch (error) {
    alert('خطأ في البحث: ' + error.message);
  }
}

async function addToInvoice(productId) {
  try {
    const products = await loadProducts();
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const existing = currentInvoiceItems.find(item => item.productId === productId);
    if (existing) {
      existing.qty += 1;
    } else {
      currentInvoiceItems.push({
        productId: product.id,
        name: product.name,
        price: product.sellingprice,
        cost: product.purchaseprice,
        qty: 1
      });
    }

    renderInvoiceItems();
    updateInvoiceSummary();
  } catch (error) {
    alert('خطأ في إضافة المنتج: ' + error.message);
  }
}

function renderInvoiceItems() {
  const container = document.getElementById('invoice-items-container');

  if (currentInvoiceItems.length === 0) {
    container.innerHTML = `
      <div class="invoice-item header">
        <span>المنتج</span>
        <span>السعر</span>
        <span>الكمية</span>
        <span>الإجمالي</span>
        <span></span>
      </div>
      <p class="empty-invoice-msg">لا توجد أصناف. امسح الباركود لإضافة منتج.</p>
    `;
    return;
  }

  let html = `
    <div class="invoice-item header">
      <span>المنتج</span>
      <span>السعر</span>
      <span>الكمية</span>
      <span>الإجمالي</span>
      <span></span>
    </div>
  `;

  html += currentInvoiceItems.map((item, index) => `
    <div class="invoice-item">
      <span>${item.name}</span>
      <span>${formatCurrency(item.price)}</span>
      <span>
        <button onclick="changeQuantity(${index}, -1)" class="qty-btn">-</button>
        <span class="qty-value">${item.qty}</span>
        <button onclick="changeQuantity(${index}, 1)" class="qty-btn">+</button>
      </span>
      <span class="item-total">${formatCurrency(item.price * item.qty)}</span>
      <button class="remove-item" onclick="removeItemCompletely(${index})" title="إزالة المنتج">&times;</button>
    </div>
  `).join('');

  container.innerHTML = html;
}

function changeQuantity(index, delta) {
  const item = currentInvoiceItems[index];
  if (!item) return;
  
  item.qty = Math.max(1, item.qty + delta);
  renderInvoiceItems();
  updateInvoiceSummary();
}

function removeItemCompletely(index) {
  currentInvoiceItems.splice(index, 1);
  renderInvoiceItems();
  updateInvoiceSummary();
}

function updateInvoiceSummary() {
  const subtotal = currentInvoiceItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discount = parseFloat(document.getElementById('invoice-discount')?.value) || 0;
  const total = Math.max(0, subtotal + discount);

  document.getElementById('summary-subtotal').textContent = formatCurrency(subtotal);
  document.getElementById('summary-total').textContent = formatCurrency(total);
  document.getElementById('current-total').value = total.toFixed(2);
}

function resetInvoiceForm() {
  currentInvoiceItems = [];
  document.getElementById('invoice-customer-name').value = '';
  document.getElementById('barcode-input').value = '';
  document.getElementById('invoice-discount').value = 0;
  document.getElementById('invoice-number').textContent = 'جديدة';
  setPaymentStatus('paid');
  renderInvoiceItems();
  updateInvoiceSummary();
  document.getElementById('barcode-input').focus();
}

function clearInvoice() {
  if (currentInvoiceItems.length > 0 && !confirm('هل تريد مسح الفاتورة الحالية؟')) return;
  resetInvoiceForm();
}

async function createInvoice() {
  if (!checkAuth()) return;

  if (currentInvoiceItems.length === 0) {
    alert('يرجى إضافة منتج واحد على الأقل');
    return;
  }

  const itemsToSave = currentInvoiceItems.map(item => ({ ...item }));
const customerName = document.getElementById('invoice-customer-name').value.trim() || 'زبون';
   const subtotal = itemsToSave.reduce((sum, item) => sum + (item.price * item.qty), 0);
   const discount = parseFloat(document.getElementById('invoice-discount').value) || 0;
   const total = Math.max(0, subtotal + discount);
  const totalCost = itemsToSave.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const profit = total - totalCost;
  const status = document.getElementById('invoice-status').value;

  if (status === 'debt' && customerName === 'زبون') {
    alert('يرجى إدخال اسم الشخص عند تسجيل فاتورة دين');
    return;
  }

  try {
    const sales = await loadSales();
    const isReturn = status === 'returned';
    const sale = {
      id: Math.max(...sales.map(s => s.id || 0), 0) + 1,
      invoiceid: (isReturn ? 'RET-' : 'INV-') + String(Date.now()).slice(-6),
      customername: customerName,
      items: isReturn ? itemsToSave.map(it => ({ ...it, qty: -it.qty })) : itemsToSave,
      subtotal: isReturn ? -subtotal : subtotal,
      discount,
      taxrate: 0,
      taxamount: 0,
      total: isReturn ? -subtotal : total,
      profit: isReturn ? -profit : profit,
      status: 'paid',
      date: new Date().toISOString(),
      createdby: getCurrentUser()?.name || 'Unknown'
    };

    await saveSale(sale);

    if (isReturn) {
      const products = await loadProducts();
      for (const it of itemsToSave) {
        const product = products.find(p => p.id === it.productId);
        if (product) {
          const newStock = (parseInt(product.stock) || 0) + it.qty;
          await updateProductStock(product.id, newStock);
        }
      }
    } else if (status === 'debt') {
      const debts = await loadDebts();
      const existingDebt = debts.find(d => d.customername === customerName && d.status === 'active');

      if (existingDebt) {
        const newOriginal = parseFloat(existingDebt.original) + total;
        const invoiceIds = existingDebt.invoiceIds ? JSON.parse(existingDebt.invoiceIds) : [];
        invoiceIds.push(sale.invoiceid);

        await supabaseRequest(`/debts?id=eq.${existingDebt.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            original: newOriginal,
            invoiceids: JSON.stringify(invoiceIds)
          })
        });
      } else {
        const newDebt = {
          customername: customerName,
          original: total,
          paid: 0,
          status: 'active',
          invoiceids: JSON.stringify([sale.invoiceid]),
          created: new Date().toISOString()
        };
        await supabaseRequest('/debts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newDebt)
        });
      }
    }

    resetInvoiceForm();
    renderInvoiceHistory();
  } catch (error) {
    alert('حدث خطأ: ' + error.message);
  }
}

async function renderInvoiceHistory() {
  try {
    const sales = await loadSales();
    const tbody = document.getElementById('invoice-history-body');
    if (!tbody) return;

    const isReturn = (s) => String(s.invoiceid).startsWith('RET-');

    const today = new Date();
    const isToday = (d) => {
      const dt = new Date(d);
      return dt.getFullYear() === today.getFullYear()
        && dt.getMonth() === today.getMonth()
        && dt.getDate() === today.getDate();
    };

    let filtered = sales;
    if (currentInvoiceFilter === 'today') {
      filtered = sales.filter(s => isToday(s.date));
    } else if (currentInvoiceFilter === 'paid') {
      filtered = sales.filter(s => !isReturn(s) && s.status === 'paid');
    } else if (currentInvoiceFilter === 'debt') {
      filtered = sales.filter(s => !isReturn(s) && s.status === 'debt');
    } else if (currentInvoiceFilter === 'returned') {
      filtered = sales.filter(s => isReturn(s));
    }

    const term = currentInvoiceSearch.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(s =>
        String(s.invoiceid).toLowerCase().includes(term) ||
        String(s.customername).toLowerCase().includes(term)
      );
    }

    if (filtered.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95a5a6;">لا توجد فواتير</td></tr>';
      return;
    }

    const showAll = currentInvoiceFilter === 'today';
    const recent = [...filtered]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, showAll ? filtered.length : 10);

    tbody.innerHTML = recent.map(sale => {
      const returned = isReturn(sale);
      const badgeClass = returned ? 'danger' : (sale.status === 'paid' ? 'success' : 'warning');
      const statusLabel = returned ? 'مرتجع' : getPaymentStatusLabel(sale.status);
      const actions = returned
        ? `<button class="btn btn-sm btn-secondary" onclick="printInvoice('${sale.invoiceid}')"><i class="fas fa-print"></i></button>`
        : `<button class="btn btn-sm btn-secondary" onclick="printInvoice('${sale.invoiceid}')"><i class="fas fa-print"></i></button>
           <button class="btn btn-sm btn-danger" onclick="openReturnModal('${sale.invoiceid}')"><i class="fas fa-undo"></i></button>`;
      return `
        <tr>
          <td>${sale.invoiceid}</td>
          <td>${sale.customername}</td>
          <td>${formatCurrency(sale.total)}</td>
          <td><span class="badge badge-${badgeClass}">${statusLabel}</span></td>
          <td>${formatDate(sale.date)}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    alert('خطأ في تحميل الفواتير');
  }
}

function setInvoiceFilter(filter) {
  currentInvoiceFilter = filter;
  document.querySelectorAll('.invoice-filters .filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  renderInvoiceHistory();
}

async function printInvoice(invoiceId) {
  try {
    const sales = await loadSales();
    const sale = sales.find(s => s.invoiceid === invoiceId);
    if (!sale) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
      <head>
        <title>فاتورة ${sale.invoiceid}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Segoe UI', sans-serif; }
          body { padding: 40px; }
          .inv-header { text-align: center; border-bottom: 3px solid #2c3e50; padding-bottom: 20px; margin-bottom: 20px; }
          .inv-header h1 { color: #2c3e50; font-size: 28px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 12px; text-align: right; border-bottom: 1px solid #eee; }
          th { background: #f8f9fa; }
          .totals { margin-top: 20px; text-align: left; }
          .totals .final { font-size: 24px; font-weight: 700; color: #2c3e50; border-top: 2px solid #2c3e50; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="inv-header">
          <h1>فاتورة</h1>
          <p>نظام باب الحارة - سوبر ماركت</p>
          <p>#${sale.invoiceid} | ${formatDate(sale.date)}</p>
        </div>
        <p><strong>الزبون:</strong> ${sale.customername}</p>
        <p><strong>الحالة:</strong> ${getPaymentStatusLabel(sale.status)}</p>
        <table>
          <thead><tr><th>المنتج</th><th>السعر</th><th>الإجمالي</th></tr></thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${formatCurrency(item.price * item.qty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
<div class="totals">
           <p>المجموع: ${formatCurrency(sale.subtotal)}</p>
           ${sale.discount > 0 ? `<p>الإضافة: ${formatCurrency(sale.discount)}</p>` : ''}
           <p class="final">الإجمالي: ${formatCurrency(sale.total)}</p>
         </div>
        <script>window.onload = function() { window.print(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (error) {
    alert('خطأ في طباعة الفاتورة');
  }
}

let currentReturnSale = null;

async function openReturnModal(invoiceId) {
  try {
    const sales = await loadSales();
    const sale = sales.find(s => s.invoiceid === invoiceId);
    if (!sale) return;
    if (String(sale.invoiceid).startsWith('RET-')) {
      alert('لا يمكن الإرجاع على فاتورة مرتجعة');
      return;
    }

    currentReturnSale = sale;
    document.getElementById('return-invoice-label').textContent = sale.invoiceid;

    const container = document.getElementById('return-items-container');
    container.innerHTML = (sale.items || []).map((item, i) => `
      <div class="return-item">
        <div class="return-item-info">
          <strong>${item.name}</strong>
          <span class="return-item-sold">الكمية المباعة: ${item.qty}</span>
        </div>
        <div class="form-group return-qty-group">
          <label>الكمية المُرجعة</label>
          <input type="number" min="0" max="${item.qty}" value="${item.qty}"
                 class="form-control return-qty" data-index="${i}">
        </div>
      </div>
    `).join('');

    document.getElementById('return-modal').classList.add('active');
  } catch (error) {
    alert('خطأ في فتح نافذة الإرجاع');
  }
}

function closeReturnModal() {
  document.getElementById('return-modal').classList.remove('active');
  currentReturnSale = null;
}

async function confirmReturn() {
  if (!currentReturnSale) return;

  const sale = currentReturnSale;
  const inputs = document.querySelectorAll('#return-items-container .return-qty');
  const returnedItems = [];

  inputs.forEach(input => {
    const idx = parseInt(input.dataset.index);
    const qty = Math.max(0, Math.min(parseInt(input.value) || 0, sale.items[idx].qty));
    if (qty > 0) {
      returnedItems.push({ ...sale.items[idx], qty, returnedFrom: sale.invoiceid });
    }
  });

  if (returnedItems.length === 0) {
    alert('يرجى إدخال كمية مرتجعة واحدة على الأقل');
    return;
  }

  const isFullReturn = returnedItems.length === sale.items.length
    && returnedItems.every(it => it.qty === sale.items.find(o => o.productId === it.productId).qty);

  const subtotal = returnedItems.reduce((sum, it) => sum + (it.price * it.qty), 0);
  const cost = returnedItems.reduce((sum, it) => sum + ((it.cost || 0) * it.qty), 0);
  const profit = subtotal - cost;

  try {
    const products = await loadProducts();
    for (const it of returnedItems) {
      const product = products.find(p => p.id === it.productId);
      if (product) {
        const newStock = (parseInt(product.stock) || 0) + it.qty;
        await updateProductStock(product.id, newStock);
      }
    }

    const sales = await loadSales();
    const returnRecord = {
      id: Math.max(...sales.map(s => s.id || 0), 0) + 1,
      invoiceid: 'RET-' + String(Date.now()).slice(-6),
      customername: sale.customername,
      items: returnedItems.map(it => ({ ...it, qty: -it.qty })),
      subtotal: -subtotal,
      discount: 0,
      taxrate: 0,
      taxamount: 0,
      total: -subtotal,
      profit: -profit,
      status: 'paid',
      date: new Date().toISOString(),
      createdby: getCurrentUser()?.name || 'Unknown'
    };

    await saveSale(returnRecord);

    if (isFullReturn) {
      await deleteSale(sale.id);
    }

    closeReturnModal();
    renderInvoiceHistory();
    alert(isFullReturn
      ? 'تم حذف الفاتورة وتسجيل المرتجع واسترجاع الكميات للمخزون'
      : 'تم تسجيل المرتجع واسترجاع الكميات للمخزون');
  } catch (error) {
    alert('حدث خطأ أثناء الإرجاع: ' + error.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (!user) return;

  initSidebar(user);

  document.getElementById('invoice-discount').addEventListener('input', updateInvoiceSummary);

  const searchInput = document.getElementById('invoice-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentInvoiceSearch = e.target.value;
      renderInvoiceHistory();
    });
  }

  initSalesPage();
  loadCustomers();
  renderInvoiceHistory();
});
