async function getSales() {
  return await fetchSales();
}

let currentPeriod = 'all';

async function setPeriod(period, btn) {
  currentPeriod = period;
  document.querySelectorAll('.reports-tabs .btn').forEach(b => {
    b.classList.remove('active');
    b.classList.add('btn-secondary');
  });
  btn.classList.add('active');
  btn.classList.remove('btn-secondary');
  updateDateInputs();
  await updateReports();
}

function updateDateInputs() {
  const fromInput = document.getElementById('report-from');
  const toInput = document.getElementById('report-to');
  if (!fromInput || !toInput) return;

  const now = new Date();
  if (currentPeriod === 'daily') {
    fromInput.value = now.toISOString().split('T')[0];
    toInput.value = now.toISOString().split('T')[0];
  } else if (currentPeriod === 'monthly') {
    fromInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    toInput.value = now.toISOString().split('T')[0];
  } else if (currentPeriod === 'yearly') {
    fromInput.value = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    toInput.value = now.toISOString().split('T')[0];
  } else {
    fromInput.value = '';
    toInput.value = '';
  }
}

async function getFilteredSales() {
  const sales = await getSales();
  const fromDate = document.getElementById('report-from')?.value;
  const toDate = document.getElementById('report-to')?.value;

  if (!fromDate && !toDate && currentPeriod === 'all') return sales;

  return sales.filter(sale => {
    const saleDate = new Date(sale.date);
    if (fromDate && saleDate < new Date(fromDate)) return false;
    if (toDate && saleDate > new Date(toDate + 'T23:59:59')) return false;
    return true;
  });
}

async function updateReports() {
  try {
    const filteredSales = await getFilteredSales();

    const totalRevenue = filteredSales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
    const totalProfit = filteredSales.reduce((sum, s) => sum + parseFloat(s.profit || 0), 0);
    const totalOrders = filteredSales.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    document.getElementById('report-revenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('report-profit').textContent = formatCurrency(totalProfit);
    document.getElementById('report-orders').textContent = totalOrders;
    document.getElementById('report-aov').textContent = formatCurrency(avgOrderValue);

    renderProductsChart(filteredSales);
  } catch (error) {
    alert('خطأ في تحميل التقارير');
  }
}

function renderProductsChart(sales) {
  const container = document.getElementById('products-chart');
  const productSales = {};

  sales.forEach(sale => {
    sale.items.forEach(item => {
      productSales[item.name] = (productSales[item.name] || 0) + item.qty;
    });
  });

  const entries = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 10);

  if (entries.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:#95a5a6;width:100%;padding:30px;">لا توجد بيانات</div>';
    return;
  }

  const maxValue = Math.max(...entries.map(e => e[1]), 1);
  container.innerHTML = entries.map(([name, qty]) => `
    <div class="bar" style="height: ${(qty / maxValue) * 100}%" data-value="${qty} وحدة" data-label="${name.substring(0, 10)}"></div>
  `).join('');
}

async function exportReport() {
  try {
    const sales = await getFilteredSales();
    let csv = 'Invoice,Customer,Date,Subtotal,Discount,Total,Status\n';
    sales.forEach(s => {
      csv += `"${s.invoiceid}","${s.customername}","${formatDate(s.date)}",${s.subtotal},${s.discount},${s.total},${getPaymentStatusLabel(s.status)}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sales-report-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('خطأ في تصدير التقرير');
  }
}

async function printReport() {
  try {
    const sales = await getFilteredSales();
    const totalRevenue = sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + parseFloat(s.profit || 0), 0);

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html dir="rtl" lang="ar">
      <head><title>تقرير المبيعات</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; padding: 40px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { padding: 10px; text-align: right; border-bottom: 1px solid #eee; }
          th { background: #f8f9fa; }
        </style>
      </head>
      <body>
        <h1>تقرير المبيعات</h1>
        <p>${formatDate(new Date().toISOString())}</p>
        <table>
          <thead><tr><th>الفاتورة</th><th>الزبون</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th></tr></thead>
          <tbody>
            ${sales.map(s => `<tr><td>${s.invoiceid}</td><td>${s.customername}</td><td>${formatDate(s.date)}</td><td>${formatCurrency(s.total)}</td><td>${getPaymentStatusLabel(s.status)}</td></tr>`).join('')}
          </tbody>
        </table>
        <p>عدد الفواتير: ${sales.length}</p>
        <p>إجمالي الإيرادات: ${formatCurrency(totalRevenue)}</p>
        <p>إجمالي الربح: ${formatCurrency(totalProfit)}</p>
        <script>window.onload = function() { window.print(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } catch (error) {
    alert('خطأ في طباعة التقرير');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (!user) return;

  initSidebar(user);

  document.getElementById('report-from').addEventListener('change', updateReports);
  document.getElementById('report-to').addEventListener('change', updateReports);

  updateReports();
});
