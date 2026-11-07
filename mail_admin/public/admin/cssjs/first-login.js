(function () {
  'use strict';
  const token = localStorage.getItem('Token');
  if (!token) { window.location.replace('/admin/login'); return; }

  const form = document.getElementById('first-change-form');
  const submit = document.getElementById('change-submit');
  const feedback = document.getElementById('change-feedback');
  const authCheck = document.getElementById('auth-check');
  const say = (message, error) => {
    feedback.textContent = message;
    feedback.classList.toggle('change-error', !!error);
  };
  let submitting = false;

  window.adminAuth.request('/Admin/tokenValidityCheck', { method: 'POST', cache: 'no-store' })
    .then(async response => {
      if (!response.ok) throw new Error('登录验证失败');
      const data = await response.json();
      if (!data.status) throw new Error('登录验证失败');
      if (!data.must_change_password) { window.location.replace('/admin/'); return; }
      if (data.username) document.getElementById('new-username').value = data.username;
      authCheck.hidden = true;
      form.hidden = false;
    })
    .catch(() => { authCheck.textContent = '无法验证登录状态，请返回登录页重新登录。'; });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.new_password !== values.confirm_password) {
      say('两次输入的新密码不一致', true); return;
    }
    if (values.new_password === values.old_password) {
      say('新密码不能与默认密码相同', true); return;
    }
    submitting = true;
    submit.disabled = true;
    say('正在修改密码…', false);
    try {
      const response = await window.adminAuth.request('/Admin/changeAdminCredentials', {
        method: 'POST', cache: 'no-store',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams(values)
      });
      const result = await response.json();
      if (result.code !== 200) throw new Error(result.message || '修改密码失败');
      localStorage.removeItem('Token');
      window.location.replace('/admin/login');
    } catch (error) {
      say(error.message || '修改密码失败，请重试', true);
    } finally {
      submitting = false;
      submit.disabled = false;
    }
  });

  document.getElementById('change-logout').addEventListener('click', async () => {
    try {
      await window.adminAuth.request('/Admin/logout', { method: 'POST', cache: 'no-store' });
    } catch (_) { /* 网络异常也清理本地登录状态。 */ }
    localStorage.removeItem('Token');
    window.location.replace('/admin/login');
  });
})();
