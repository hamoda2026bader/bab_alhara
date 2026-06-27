function formatCurrency(amount) {
  const num = parseFloat(amount || 0);
  return '₪' + num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ar-IL', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getPaymentStatusLabel(status) {
  return status === 'paid' ? 'مدفوع' : 'دين';
}

function getCurrentUser() {
  try {
    return JSON.parse(sessionStorage.getItem('currentUser'));
  } catch {
    return null;
  }
}

function checkAuth() {
  const user = getCurrentUser();
  if (!user) {
    window.location.href = 'index.html';
    return null;
  }
  return user;
}

function initSidebar(user) {
  if (!user) return;
  const nameEl = document.getElementById('user-name');
  const roleEl = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl) nameEl.textContent = user.name;
  if (roleEl) roleEl.textContent = user.role;
  if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();

  const menuToggle = document.getElementById('menuToggle');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      document.querySelector('.sidebar')?.classList.toggle('active');
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('currentUser');
      window.location.href = 'index.html';
    });
  }
}