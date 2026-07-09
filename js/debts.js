async function loadDebts() {
  return await fetchDebts();
}

function getDebtRemaining(debt) {
  return parseFloat(debt.original) - parseFloat(debt.paid || 0);
}

let currentPaymentDebtId = null;

async function renderDebts(debts = null) {
  checkAuth();
  
  const allDebts = debts || (await loadDebts()).filter(d => d.status === 'active' && getDebtRemaining(d) > 0);

  const container = document.getElementById('debts-list');
  if (!container) return;

  if (allDebts.length === 0) {
    container.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#95a5a6;padding:40px;">لا توجد ديون مسجلة</td></tr>';
    return;
  }

  container.innerHTML = allDebts.map(d => {
    const remaining = getDebtRemaining(d);
    return `<tr>
      <td><strong>${d.customername}</strong></td>
      <td><span class="debt-balance">${formatCurrency(remaining)}</span></td>
      <td>${formatCurrency(d.paid || 0)}</td>
      <td class="table-actions">
        <button class="btn btn-primary btn-sm" onclick="openPaymentModal(${d.id})">
          <i class="fas fa-check"></i> تسديد
        </button>
      </td>
    </tr>`;
  }).join('');
}

function openPaymentModal(debtId) {
  currentPaymentDebtId = debtId;
  document.getElementById('payment-amount').value = '';
  document.getElementById('payment-modal').classList.add('active');
}

function closePaymentModal() {
  document.getElementById('payment-modal').classList.remove('active');
}

async function confirmPayment() {
  const amount = parseFloat(document.getElementById('payment-amount').value) || 0;
  if (amount <= 0) {
    alert('يرجى إدخال مبلغ صحيح');
    return;
  }

  try {
    const debts = await loadDebts();
    const debt = debts.find(d => d.id === currentPaymentDebtId);
    if (!debt) {
      closePaymentModal();
      return;
    }

    const remaining = getDebtRemaining(debt);
    if (amount > remaining) {
      alert('المبلغ أكبر من الدين المتبقي');
      closePaymentModal();
      return;
    }

    const payments = debt.payments ? JSON.parse(debt.payments) : [];
    payments.push({ amount, date: new Date().toISOString() });
    const newPaid = parseFloat(debt.paid || 0) + amount;
    const newStatus = newPaid >= parseFloat(debt.original) ? 'paid' : 'active';

    await supabaseRequest(`/debts?id=eq.${debt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paid: newPaid,
        payments: JSON.stringify(payments),
        status: newStatus
      })
    });

    closePaymentModal();
    renderDebts();
  } catch (error) {
    alert('حدث خطأ: ' + error.message);
  }
}

async function searchDebts() {
  const query = document.getElementById('debt-search').value.toLowerCase();
  
  try {
    const debts = query
      ? await supabaseRequest(`/debts?select=*&status=eq.active&or=(customername.ilike.*${query}*)`)
      : await loadDebts();
    
    const filtered = debts.filter(d => getDebtRemaining(d) > 0);
    await renderDebts(filtered);
  } catch (error) {
    alert('خطأ في البحث');
  }
}

async function getActiveDebts() {
  const debts = await loadDebts();
  return debts.filter(d => d.status === 'active' && getDebtRemaining(d) > 0);
}

async function exportDebtsExcel() {
  try {
    const debts = await getActiveDebts();
    let csv = 'العميل,الدين المتبقي,المدفوع\n';
    debts.forEach(d => {
      csv += `"${d.customername}","${formatCurrency(getDebtRemaining(d))}","${formatCurrency(d.paid || 0)}"\n`;
    });

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'الديون-' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('خطأ في تصدير Excel');
  }
}

async function exportDebtsImage() {
  try {
    const debts = await getActiveDebts();
    if (debts.length === 0) {
      alert('لا توجد ديون للتصدير');
      return;
    }

    const html2canvasFn = window.html2canvas;
    if (!html2canvasFn) {
      alert('مكتبة الصور غير محمّلة');
      return;
    }

    const container = document.createElement('div');
    container.dir = 'rtl';
    container.style.cssText = 'width:794px;margin:0 auto;background:#fff;font-size:12px;';
    container.innerHTML = `
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr>
            <th style="border:1px solid #ddd;padding:5px;background:#f8f9fa;text-align:right;">العميل</th>
            <th style="border:1px solid #ddd;padding:5px;background:#f8f9fa;text-align:right;">الدين المتبقي</th>
            <th style="border:1px solid #ddd;padding:5px;background:#f8f9fa;text-align:right;">المدفوع</th>
          </tr>
        </thead>
        <tbody>
          ${debts.map(d => `
            <tr>
              <td style="border:1px solid #ddd;padding:5px;text-align:right;">${d.customername}</td>
              <td style="border:1px solid #ddd;padding:5px;text-align:right;color:#e74c3c;font-weight:600;">${formatCurrency(getDebtRemaining(d))}</td>
              <td style="border:1px solid #ddd;padding:5px;text-align:right;">${formatCurrency(d.paid || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    document.body.appendChild(container);

    const canvas = await html2canvasFn(container, { scale: 2, backgroundColor: '#ffffff' });
    const link = document.createElement('a');
    link.download = 'الديون-' + new Date().toISOString().split('T')[0] + '.png';
    link.href = canvas.toDataURL('image/png');
    link.click();

    document.body.removeChild(container);
  } catch (error) {
    alert('خطأ في تصدير الصورة');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (!user) return;

  initSidebar(user);

  document.getElementById('debt-search').addEventListener('input', searchDebts);

  document.getElementById('payment-modal').addEventListener('click', (e) => {
    if (e.target.id === 'payment-modal') closePaymentModal();
  });

  renderDebts();
});