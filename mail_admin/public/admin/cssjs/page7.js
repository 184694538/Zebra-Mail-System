(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const skinForm = $('skin-form');
  const accountForm = $('account-form');
  const feedback = (id, message, error) => { const el = $(id); el.textContent = message; el.classList.toggle('error', !!error); };
  async function post(endpoint, values) {
    const res = await window.adminAuth.request('/Admin/' + endpoint, {
      method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
      body: new URLSearchParams(values), cache:'no-store'
    });
    return res.json();
  }
  window.adminAuth.request('/Admin/getThemeSettings', {method:'POST',cache:'no-store'})
    .then(res => res.json()).then(res => {
      if (res.code === 200 && res.data) {
        $('admin-theme').value = res.data.admin_theme;
        $('webmail-theme').value = res.data.webmail_theme;
      } else feedback('theme-feedback', res.message || '皮肤配置读取失败', true);
    }).catch(() => feedback('theme-feedback','皮肤配置读取失败',true));
  window.adminAuth.request('/Admin/tokenValidityCheck', {method:'POST',cache:'no-store'})
    .then(res => res.json()).then(res => {
      if (res.status && res.username) $('new-admin-name').value = res.username;
    }).catch(() => {});

  skinForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('theme-save'); button.disabled = true;
    try {
      const result = await post('setThemeSettings', {admin_theme: $('admin-theme').value, webmail_theme: $('webmail-theme').value});
      if (result.code !== 200) throw new Error(result.message || '保存失败');
      feedback('theme-feedback','皮肤设置已保存',false);
      if (window.MailTheme) window.MailTheme.apply(result.data);
      if (window.parent !== window && window.parent.MailTheme) window.parent.MailTheme.apply(result.data);
    } catch (error) { feedback('theme-feedback',error.message || '网络错误',true); }
    finally { button.disabled = false; }
  });

  accountForm.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(accountForm).entries());
    if (values.new_password !== values.confirm_password) return feedback('account-feedback','两次新密码不一致',true);
    if (values.new_password.length < 12) return feedback('account-feedback','新密码至少 12 位',true);
    const button = $('account-save'); button.disabled = true;
    try {
      const result = await post('changeAdminCredentials', values);
      if (result.code !== 200) throw new Error(result.message || '修改失败');
      window.localStorage.removeItem('Token');
      window.top.location.replace('/admin/login');
    } catch (error) { feedback('account-feedback',error.message || '网络错误',true); button.disabled = false; }
  });
})();
