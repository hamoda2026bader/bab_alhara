async function validateLogin() {
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  const errorDiv = document.getElementById('login-error');
  const form = document.getElementById('login-form');

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  let isValid = true;

  if (!username) {
    usernameInput.parentElement.classList.add('error');
    isValid = false;
  } else {
    usernameInput.parentElement.classList.remove('error');
  }

  if (!password) {
    passwordInput.parentElement.classList.add('error');
    isValid = false;
  } else {
    passwordInput.parentElement.classList.remove('error');
  }

  if (!isValid) {
    errorDiv.classList.remove('hidden');
    errorDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> يرجى ملء جميع الحقول';
    return false;
  }

  try {
    console.log('[login] signing in with Supabase Auth...');

    const { data, error } = await window.supabaseAuth.auth.signInWithPassword({
      email: username,
      password
    });

    if (error) throw error;

    let dbUser = null;
    try {
      const users = await window.supabaseRequest('/users?select=*&order=id');
      dbUser = (Array.isArray(users) ? users : []).find(u => u.username === username) || null;
    } catch (_) {
      dbUser = null;
    }

    const userToStore = dbUser
      ? { ...dbUser, name: dbUser.name || username }
      : { id: data?.user?.id, name: username, username, role: 'admin' };

    sessionStorage.setItem('currentUser', JSON.stringify(userToStore));
    window.location.href = 'dashboard.html';
  } catch (error) {
    console.log('[login] auth failed:', error);
    errorDiv.classList.remove('hidden');
    errorDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> فشل تسجيل الدخول: ${error?.message || 'خطأ غير معروف'}`;
    form.classList.add('shake');
    setTimeout(() => form.classList.remove('shake'), 500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const errorDiv = document.getElementById('login-error');

  if (sessionStorage.getItem('currentUser')) {
    window.location.href = 'dashboard.html';
    return;
  }

  document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    validateLogin();
  });

  const inputs = document.querySelectorAll('.form-group input');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      input.parentElement.classList.remove('error');
      errorDiv.classList.add('hidden');
    });
  });
});
