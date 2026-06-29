async function loadPayments() {
  return await fetchPayments();
}

async function loadPaymentDescriptions() {
  try {
    const payments = await loadPayments();
    const descriptions = [...new Set(payments.map(p => p.description).filter(d => d))].sort();
    const datalist = document.getElementById('payment-description-list');
    if (datalist) {
      datalist.innerHTML = descriptions.map(d => `<option value="${d}"></option>`).join('');
    }
  } catch (e) {}
}

function getNextPaymentId(payments) {
  return payments.length > 0 ? Math.max(...payments.map(p => p.id)) + 1 : 1;
}

async function savePayment(payment) {
  return window.supabaseRequest('/payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payment)
  });
}

async function deletePaymentFromDb(id) {
  return window.supabaseRequest(`/payments?id=eq.${id}`, { method: 'DELETE' });
}

async function addPayment() {
  const description = document.getElementById('payment-description').value.trim();
  const amount = parseFloat(document.getElementById('payment-amount').value) || 0;
  const date = document.getElementById('payment-date').value || new Date().toISOString().split('T')[0];

  if (!description || amount <= 0) {
    alert('يرجى إدخال الوصف والمبلغ');
    return;
  }

  try {
    const payments = await loadPayments();
    const newPayment = {
      id: getNextPaymentId(payments),
      description,
      amount,
      date,
      created: new Date().toISOString(),
      createdby: getCurrentUser()?.name || 'Unknown'
    };

    await savePayment(newPayment);
    document.getElementById('payment-description').value = '';
    document.getElementById('payment-amount').value = '';
    loadPaymentDescriptions();
    renderPayments();
  } catch (error) {
    alert('حدث خطأ: ' + error.message);
  }
}

async function renderPayments(payments = null) {
  try {
    const allPayments = payments || await loadPayments();
    const tbody = document.getElementById('payments-list');
    if (!tbody) return;

    if (allPayments.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:#95a5a6;padding:40px;">لا توجد مدفوعات مسجلة</td></tr>';
      document.getElementById('total-payments').textContent = formatCurrency(0);
      document.getElementById('today-payments').textContent = formatCurrency(0);
      return;
    }

    const sorted = [...allPayments].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tbody.innerHTML = sorted.map(p => `
      <tr>
        <td><strong>${p.description}</strong></td>
        <td>${formatCurrency(p.amount)}</td>
        <td>${formatDate(p.date)}</td>
        <td class="table-actions">
          <button class="remove-payment" onclick="deletePayment(${p.id})" title="حذف">
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');

    const total = allPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    document.getElementById('total-payments').textContent = formatCurrency(total);

    const today = new Date().toISOString().split('T')[0];
    const todayTotal = allPayments
      .filter(p => p.date === today)
      .reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
    document.getElementById('today-payments').textContent = formatCurrency(todayTotal);
  } catch (error) {
    alert('خطأ في تحميل المدفوعات');
  }
}

async function deletePayment(id) {
  if (!confirm('هل أنت متأكد من حذف هذه الدفعة؟')) return;

  try {
    await deletePaymentFromDb(id);
    renderPayments();
  } catch (error) {
    alert('حدث خطأ: ' + error.message);
  }
}

async function searchPayments() {
  const query = document.getElementById('payment-search').value.toLowerCase();

  try {
    const payments = await loadPayments();
    const filtered = payments.filter(p =>
      p.description.toLowerCase().includes(query) ||
      p.date.includes(query)
    );
    renderPayments(filtered);
  } catch (error) {
    alert('خطأ في البحث');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (!user) return;

  initSidebar(user);
  
  document.getElementById('payment-date').valueAsDate = new Date();
  
  document.getElementById('payment-search').addEventListener('input', searchPayments);
  
  loadPaymentDescriptions();
  renderPayments();
});