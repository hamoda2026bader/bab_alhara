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

    const today = new Date();
    const isToday = d => {
      const dt = new Date(d);
      return dt.getFullYear() === today.getFullYear()
        && dt.getMonth() === today.getMonth()
        && dt.getDate() === today.getDate();
    };
    const todaysSales = sales.filter(s => isToday(s.date));
    const todaySales = todaysSales.reduce((sum, s) => sum + parseFloat(s.total || 0), 0);
    const todayProfit = todaysSales.reduce((sum, s) => sum + parseFloat(s.profit || 0), 0);

    document.getElementById('stat-total-sales').textContent = formatCurrency(totalSales);
    document.getElementById('stat-total-products').textContent = products.length;
    document.getElementById('stat-total-profit').textContent = formatCurrency(totalProfit);
    document.getElementById('stat-outstanding-debts').textContent = formatCurrency(outstandingDebts);
    document.getElementById('stat-today-sales').textContent = formatCurrency(todaySales);
    document.getElementById('stat-today-profit').textContent = formatCurrency(todayProfit);

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
