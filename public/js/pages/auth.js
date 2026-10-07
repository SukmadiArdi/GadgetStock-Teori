import { AuthAPI } from '/js/api.js';
import State from '/js/state.js';
import { showToast } from '/js/utils.js';

let isLogin = true;

window.togglePassword = function() {
  const pwInput = document.getElementById('f-password');
  const pwIcon = document.getElementById('pw-icon');
  if (pwInput.type === 'password') {
    pwInput.type = 'text';
    pwIcon.textContent = 'visibility_off';
  } else {
    pwInput.type = 'password';
    pwIcon.textContent = 'visibility';
  }
};

window.toggleMode = function() {
  isLogin = !isLogin;
  document.getElementById('auth-title').textContent         = isLogin ? 'Staff Login'        : 'Buat Akun Baru';
  document.getElementById('auth-subtitle').textContent      = isLogin ? 'Masukkan Employee ID Anda untuk melanjutkan' : 'Daftarkan Employee ID baru Anda';
  document.getElementById('auth-btn-icon').textContent      = isLogin ? 'login'               : 'person_add';
  document.getElementById('auth-btn-text').textContent      = isLogin ? 'Sign In'             : 'Daftar';
  document.getElementById('auth-header-icon').textContent   = isLogin ? 'lock_person'         : 'person_add';
  document.getElementById('auth-toggle-text').textContent   = isLogin ? 'Belum punya akun?'   : 'Sudah punya akun?';
  document.getElementById('toggle-auth-btn').textContent    = isLogin ? 'Daftar di sini'      : 'Masuk di sini';
  document.getElementById('name-group').style.display       = isLogin ? 'none'                : 'block';
  if (!isLogin) document.getElementById('f-fullname').setAttribute('required', 'true');
  else document.getElementById('f-fullname').removeAttribute('required');
};

window.handleAuth = async function(e) {
  e.preventDefault();
  const btn     = document.getElementById('auth-btn');
  const btnIcon = document.getElementById('auth-btn-icon');
  btn.disabled  = true;
  btnIcon.textContent = 'hourglass_empty';

  try {
    const empId    = document.getElementById('f-empid').value.trim();
    const password = document.getElementById('f-password').value;

    if (isLogin) {
      const res = await AuthAPI.login(empId, password);
      State.setUser(res.user, res.profile);
      showToast('Login berhasil!', 'success');
      setTimeout(() => navigate('/dashboard'), 500);
    } else {
      const name = document.getElementById('f-fullname').value.trim();
      const res  = await AuthAPI.signup(empId, password, name);
      showToast(res.message, 'success');
      toggleMode();
      document.getElementById('f-empid').value    = empId;
      document.getElementById('f-password').value = '';
    }
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btnIcon.textContent = isLogin ? 'login' : 'person_add';
  }
};

window.enterGuestMode = function() {
  State.setGuestMode();
  navigate('/dashboard');
};
