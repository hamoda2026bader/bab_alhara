async function loadUsers() {
  return await fetchUsers();
}

async function renderUsers() {
  checkAuth();
  const users = await loadUsers();
  const container = document.getElementById('users-list');

  if (!container) return;

  if (users.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:#95a5a6;padding:40px;">لا يوجد مستخدمين</p>';
    return;
  }

  const rolePermissions = {
    admin: ['صلاحيات كاملة'],
    sales: ['إنشاء مبيعات', 'عرض التقارير', 'إدارة العملاء'],
    inventory: ['إدارة المنتجات', 'إدارة المخزون', 'عرض التقارير']
  };

  const roleLabels = {
    admin: 'مدير',
    sales: 'مبيعات',
    inventory: 'مخزون'
  };

  container.innerHTML = users.map(u => `
    <div class="user-card">
      <div class="user-avatar-lg ${u.role}">${u.name.charAt(0).toUpperCase()}</div>
      <div class="user-details">
        <h4>${u.name}</h4>
        <p><i class="fas fa-user"></i> ${u.username}</p>
        <p><i class="fas fa-envelope"></i> ${u.email || 'غير متوفر'}</p>
        <span class="role-badge ${u.role}">${roleLabels[u.role] || u.role}</span>
        <div class="user-permissions">
          ${rolePermissions[u.role].map(p => `<span class="permission granted">${p}</span>`).join('')}
        </div>
      </div>
      <div class="user-actions">
        <button class="btn btn-primary btn-sm" onclick="editUser(${u.id})"><i class="fas fa-edit"></i> تعديل</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i> حذف</button>
      </div>
    </div>
  `).join('');
}

async function openUserModal(user = null) {
  checkAuth();
  const modal = document.getElementById('user-modal');

  if (user) {
    document.getElementById('modal-title').textContent = 'تعديل مستخدم';
    document.getElementById('user-id').value = user.id;
    document.getElementById('user-name').value = user.name;
    document.getElementById('user-username').value = user.username;
    document.getElementById('user-email').value = user.email || '';
    document.getElementById('user-role').value = user.role;
    document.getElementById('user-password').value = '';
    document.getElementById('user-password').placeholder = 'اتركه فارغاً لعدم التغيير';
  } else {
    document.getElementById('modal-title').textContent = 'إضافة مستخدم';
    document.getElementById('user-form').reset();
    document.getElementById('user-id').value = '';
  }

  modal.classList.add('active');
}

function closeUserModal() {
  document.getElementById('user-modal').classList.remove('active');
}

async function saveUserHandler(e) {
  e.preventDefault();
  checkAuth();

  const id = document.getElementById('user-id').value;
  const name = document.getElementById('user-name').value.trim();
  const username = document.getElementById('user-username').value.trim();
  const email = document.getElementById('user-email').value.trim();
  const role = document.getElementById('user-role').value;
  const password = document.getElementById('user-password').value.trim();

  if (!name || !username || !role) {
    alert('يرجى ملء جميع الحقول المطلوبة');
    return;
  }

  try {
    const users = await loadUsers();
    const userData = { name, username, email, role };

    if (id) {
      if (password) {
        userData.password = password;
      }
      await supabaseRequest(`/users?id=eq.${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
    } else {
      if (!password) {
        alert('كلمة المرور مطلوبة للمستخدمين الجدد');
        return;
      }

      const existing = users.find(u => u.username === username);
      if (existing) {
        alert('اسم المستخدم موجود مسبقاً');
        return;
      }
      userData.password = password;
      userData.created = new Date().toISOString();
      await supabaseRequest('/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
    }
    closeUserModal();
    renderUsers();
  } catch (error) {
    alert('حدث خطأ: ' + error.message);
  }
}

async function editUser(id) {
  try {
    const users = await loadUsers();
    const user = users.find(u => u.id === id);
    if (user) openUserModal(user);
  } catch (error) {
    alert('خطأ في تحميل المستخدم');
  }
}

async function deleteUser(id) {
  const currentUser = getCurrentUser();
  if (currentUser && currentUser.id === id) {
    alert('لا يمكنك حذف حسابك الخاص');
    return;
  }

  if (!confirm('هل أنت متأكد من حذف هذا المستخدم؟')) return;

  try {
    await deleteUserFromDb(id);
    renderUsers();
  } catch (error) {
    alert('حدث خطأ: ' + error.message);
  }
}

async function searchUsers() {
  checkAuth();
  const query = document.getElementById('user-search').value.toLowerCase();
  const role = document.getElementById('user-role-filter').value;

  try {
    let users = await loadUsers();

    if (query) {
      users = users.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.username.toLowerCase().includes(query)
      );
    }

    if (role) {
      users = users.filter(u => u.role === role);
    }

    const container = document.getElementById('users-list');

    if (users.length === 0) {
      container.innerHTML = '<p style="text-align:center;color:#95a5a6;padding:40px;">لا يوجد مستخدمين</p>';
      return;
    }

    const rolePermissions = {
      admin: ['صلاحيات كاملة'],
      sales: ['إنشاء مبيعات', 'عرض التقارير', 'إدارة العملاء'],
      inventory: ['إدارة المنتجات', 'إدارة المخزون', 'عرض التقارير']
    };

    const roleLabels = {
      admin: 'مدير',
      sales: 'مبيعات',
      inventory: 'مخزون'
    };

    container.innerHTML = users.map(u => `
      <div class="user-card">
        <div class="user-avatar-lg ${u.role}">${u.name.charAt(0).toUpperCase()}</div>
        <div class="user-details">
          <h4>${u.name}</h4>
          <p><i class="fas fa-user"></i> ${u.username}</p>
          <p><i class="fas fa-envelope"></i> ${u.email || 'غير متوفر'}</p>
          <span class="role-badge ${u.role}">${roleLabels[u.role] || u.role}</span>
          <div class="user-permissions">
            ${rolePermissions[u.role].map(p => `<span class="permission granted">${p}</span>`).join('')}
          </div>
        </div>
        <div class="user-actions">
          <button class="btn btn-primary btn-sm" onclick="editUser(${u.id})"><i class="fas fa-edit"></i> تعديل</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id})"><i class="fas fa-trash"></i> حذف</button>
        </div>
      </div>
    `).join('');
  } catch (error) {
    alert('خطأ في البحث');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const user = checkAuth();
  if (!user) return;

  initSidebar(user);

  renderUsers();

  const searchInput = document.getElementById('user-search');
  const roleFilter = document.getElementById('user-role-filter');

  if (searchInput) searchInput.addEventListener('input', searchUsers);
  if (roleFilter) roleFilter.addEventListener('change', searchUsers);

  const userForm = document.getElementById('user-form');
  if (userForm) {
    userForm.addEventListener('submit', saveUserHandler);
  }

  const modal = document.getElementById('user-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeUserModal();
      }
    });
  }
});