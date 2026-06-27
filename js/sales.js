async function loadProducts() {
  return await fetchProducts();
}

async function loadSales() {
  return await fetchSales();
}

async function loadDebts() {
  return await fetchDebts();
}

function getNextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map(i => i.id)) + 1 : 1;
}

let currentInvoiceItems = [];

function setPaymentStatus(status) {
  document.getElementById('invoice-status').value = status;
  document.getElementById('btn-paid').classList.toggle('active', status === 'paid');
  document.getElementById('btn-debt').classList.toggle('active', status === 'debt');
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
  const barcode = document.getElementById('barcode-input').value.trim();
  if (!barcode) return;

  try {
    const products = await loadProducts();
    const product = products.find(p =>
      p.barcode && p.barcode.toLowerCase() === barcode.toLowerCase()
    );

    if (!product) {
      alert('المنتج غير موجود: ' + barcode);
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
      if (existing.qty < parseInt(product.stock)) {
        existing.qty++;
      } else {
        alert('لا يوجد مخزون كافٍ');
        return;
      }
    } else {
      if (parseInt(product.stock) <= 0) {
        alert('المنتج نفذ من المخزون');
        return;
      }
      currentInvoiceItems.push({
        productId: product.id,
        name: product.name,
        price: product.sellingprice,
        cost: product.purchaseprice,
        qty: 1,
        stock: product.stock
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
      <input type="number" value="${item.qty}" min="1" max="${item.stock}" onchange="updateItemQty(${index}, this.value)">
      <span class="item-total">${formatCurrency(item.price * item.qty)}</span>
      <button class="remove-item" onclick="removeFromInvoice(${index})">&times;</button>
    </div>
  `).join('');

  container.innerHTML = html;
}

function updateItemQty(index, qty) {
  const q = parseInt(qty) || 1;
  if (q < 1) return;
  if (q > currentInvoiceItems[index].stock) {
    alert('الكمية تتجاوز المخزون المتاح');
    renderInvoiceItems();
    return;
  }
  currentInvoiceItems[index].qty = q;
  renderInvoiceItems();
  updateInvoiceSummary();
}

function removeFromInvoice(index) {
  currentInvoiceItems.splice(index, 1);
  renderInvoiceItems();
  updateInvoiceSummary();
}

function updateInvoiceSummary() {
  const subtotal = currentInvoiceItems.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const discount = parseFloat(document.getElementById('invoice-discount')?.value) || 0;
  const total = Math.max(0, subtotal - discount);

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
  const total = Math.max(0, subtotal - discount);
  const totalCost = itemsToSave.reduce((sum, item) => sum + (item.cost * item.qty), 0);
  const profit = total - totalCost;
  const status = document.getElementById('invoice-status').value;

  if (status === 'debt' && customerName === 'زبون') {
    alert('يرجى إدخال اسم الشخص عند تسجيل فاتورة دين');
    return;
  }

  try {
    const sales = await loadSales();
    const sale = {
      id: Math.max(...sales.map(s => s.id || 0), 0) + 1,
      invoiceid: 'INV-' + String(Date.now()).slice(-6),
      customername: customerName,
      items: itemsToSave,
      subtotal,
      discount,
      taxrate: 0,
      taxamount: 0,
      total,
      profit,
      status,
      date: new Date().toISOString(),
      createdby: getCurrentUser()?.name || 'Unknown'
    };

    await saveSale(sale);

    if (status === 'debt') {
      const debts = await loadDebts();
      const existingDebt = debts.find(d => d.customername === customerName && d.status === 'active');

      if (existingDebt) {
        const newPaid = parseFloat(existingDebt.paid || 0);
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

    const products = await loadProducts();
    for (const item of itemsToSave) {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const oldStock = parseInt(product.stock) || 0;
        const newStock = Math.max(0, oldStock - item.qty);
        await updateProductStock(product.id, newStock);
        await saveInventoryMovement({
          productid: product.id,
          productname: product.name,
          type: 'out',
          qty: item.qty,
          previousstock: oldStock,
          newstock: newStock,
          note: 'بيع ' + sale.invoiceid,
          date: new Date().toISOString()
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

    if (sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#95a5a6;">لا توجد فواتير</td></tr>';
      return;
    }

    const recent = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

    tbody.innerHTML = recent.map(sale => `
      <tr>
        <td>${sale.invoiceid}</td>
        <td>${sale.customername}</td>
        <td>${formatCurrency(sale.total)}</td>
        <td><span class="badge badge-${sale.status === 'paid' ? 'success' : 'warning'}">${getPaymentStatusLabel(sale.status)}</span></td>
        <td>${formatDate(sale.date)}</td>
        <td>
          <button class="btn btn-sm btn-secondary" onclick="printInvoice('${sale.invoiceid}')"><i class="fas fa-print"></i></button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    alert('خطأ في تحميل الفواتير');
  }
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
          <thead><tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
          <tbody>
            ${sale.items.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${formatCurrency(item.price)}</td>
                <td>${item.qty}</td>
                <td>${formatCurrency(item.price * item.qty)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="totals">
          <p>المجموع: ${formatCurrency(sale.subtotal)}</p>
          ${sale.discount > 0 ? `<p>الخصم: ${formatCurrency(sale.discount)}</p>` : ''}
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

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (!user) return;

  initSidebar(user);

  document.getElementById('invoice-discount').addEventListener('input', updateInvoiceSummary);

  initSalesPage();
  renderInvoiceHistory();
});
