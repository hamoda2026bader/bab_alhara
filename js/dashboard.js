async function loadDashboard() {
  try {
    const sales = await fetchSales();
    const products = await fetchProducts();
    const debts = await fetchDebts();

    const totalSales = sales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + parseFloat(s.profit || 0), 0);
    const outstandingDebts = debts
      .filter(d => d.status === 'active')
      .reduce((sum, d) => sum + (parseFloat(d.original) - parseFloat(d.paid || 0)), 0);
    const lowStock = products.filter(p => parseInt(p.stock) > 0 && parseInt(p.stock) < 10).length;

    document.getElementById('stat-total-sales').textContent = formatCurrency(totalSales);
    document.getElementById('stat-total-products').textContent = products.length;
    document.getElementById('stat-total-profit').textContent = formatCurrency(totalProfit);
    document.getElementById('stat-outstanding-debts').textContent = formatCurrency(outstandingDebts);
    document.getElementById('stat-low-stock').textContent = lowStock;

    if (outstandingDebts > 0) {
      document.getElementById('debt-alert').classList.remove('hidden');
    }

    const recentSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    const tbody = document.getElementById('recent-sales-body');

    if (recentSales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#95a5a6;">لا توجد مبيعات</td></tr>';
    } else {
      tbody.innerHTML = recentSales.map(s => `
        <tr>
          <td>${s.invoiceid}</td>
          <td>${s.customername}</td>
          <td>${formatCurrency(s.total)}</td>
          <td><span class="badge badge-${s.status === 'paid' ? 'success' : 'warning'}">${getPaymentStatusLabel(s.status)}</span></td>
          <td>${formatDate(s.date)}</td>
        </tr>
      `).join('');
    }

    const lowStockProducts = products.filter(p => parseInt(p.stock) > 0 && parseInt(p.stock) < 10);
    const lowStockList = document.getElementById('low-stock-list');

    if (lowStockProducts.length === 0) {
      lowStockList.innerHTML = '<div class="alert alert-info"><i class="fas fa-check-circle"></i> جميع المنتجات بمخزون كافٍ</div>';
    } else {
      lowStockList.innerHTML = lowStockProducts.map(p => `
        <div class="alert alert-warning" style="margin-bottom:8px;">
          <i class="fas fa-box"></i> ${p.name} — متبقي ${p.stock} وحدة
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (!user) return;

  initSidebar(user);

  loadDashboard();
});
