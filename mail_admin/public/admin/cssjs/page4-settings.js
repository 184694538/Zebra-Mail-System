(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const skinDialog = $('theme-settings-dialog');
  const accountDialog = $('admin-credentials-dialog');
  const skinForm = $('skin-form');
  const accountForm = $('account-form');
  if (!skinDialog || !accountDialog || !window.adminAuth) return;
  const feedback = (id, message, error) => {
    const el = $(id); if (!el) return;
    el.textContent = message; el.classList.toggle('error', !!error);
  };
  async function post(endpoint, values) {
    const res = await window.adminAuth.request('/Admin/' + endpoint, {
      method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
      body: new URLSearchParams(values), cache: 'no-store'
    });
    if (!res.ok) throw new Error('请求失败（HTTP ' + res.status + '）');
    return res.json();
  }
  const themeLabels = Object.freeze({
    layui_night: 'Layui 经典 · 夜晚', layui_day: 'Layui 经典 · 白天',
    business_blue: '商务雾蓝', deep_ocean: '深海夜航',
    cloud_white: '极简云白', graphite: '曜石深灰',
    teal: '青岚科技', sand: '暖砂护眼'
  });
  function showThemeField(fieldId, themeId) {
    const field = $(fieldId);
    if (field && Object.prototype.hasOwnProperty.call(themeLabels, themeId)) {
      field.value = themeLabels[themeId];
    }
  }
  function showCurrentThemes(settings) {
    if (!settings) return;
    showThemeField('current-admin-theme', settings.admin_theme);
    showThemeField('current-webmail-theme', settings.webmail_theme);
  }
  // 在服务端确认前优先显示预加载皮肤与缓存的用户端皮肤，避免文字闪烁。
  showThemeField('current-admin-theme', document.documentElement.getAttribute('data-admin-theme'));
  try {
    const cached = JSON.parse(window.localStorage.getItem('zebra_mail_themes_v2') || 'null');
    showCurrentThemes(cached);
  } catch (_) { /* 关闭本地存储时仍可通过服务器获取 */ }
  async function refreshCurrentThemes() {
    try {
      const result = await post('getThemeSettings', {});
      if (result.code === 200 && result.data) showCurrentThemes(result.data);
    } catch (_) { /* 无网络时保留已有展示 */ }
  }
  refreshCurrentThemes();
  async function loadTheme() {
    feedback('theme-feedback', '', false);
    try {
      const res = await post('getThemeSettings', {});
      if (res.code !== 200 || !res.data) throw new Error(res.message || '皮肤配置读取失败');
      $('admin-theme').value = res.data.admin_theme;
      showCurrentThemes(res.data);
      $('webmail-theme').value = res.data.webmail_theme;
    } catch (e) { feedback('theme-feedback',e.message || '皮肤配置读取失败',true); }
  }
  async function loadName() {
    feedback('account-feedback','',false);
    try {
      const res = await post('tokenValidityCheck', {});
      if (res.status && res.username) {
        $('current-admin-name').value = res.username;
        // 默认使用当前管理员名，便于仅修改密码；也可以直接填新账号名。
        $('new-admin-name').value = res.username;
      }
    } catch (e) { feedback('account-feedback','账号读取失败',true); }
  }
  $('open-theme-settings').addEventListener('click', () => {
    skinDialog.showModal(); loadTheme();
  });
  $('open-admin-credentials').addEventListener('click', () => {
    accountForm.reset(); accountDialog.showModal(); loadName();
  });
  document.querySelectorAll('.system-settings-close, .system-settings-dialog [data-close]').forEach(btn => {
    btn.addEventListener('click', () => { const dialog = $(btn.dataset.close) || btn.closest('dialog'); if (dialog) dialog.close(); });
  });
  [skinDialog, accountDialog].forEach(dialog => dialog.addEventListener('click', e => {
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    }
  }));

  skinForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = $('theme-save'); button.disabled = true;
    try {
      const result = await post('setThemeSettings', {admin_theme: $('admin-theme').value, webmail_theme: $('webmail-theme').value});
      if (result.code !== 200) throw new Error(result.message || '保存失败');
      showCurrentThemes(result.data);
      if (window.MailTheme) window.MailTheme.apply(result.data);
      if (window.parent !== window && window.parent.MailTheme) window.parent.MailTheme.apply(result.data);
      feedback('theme-feedback','已保存',false);
      window.setTimeout(() => skinDialog.close(), 450);
    } catch (error) { feedback('theme-feedback',error.message || '网络错误',true); }
    finally { button.disabled = false; }
  });
  accountForm.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(accountForm).entries());
    // 密码强度、长度及两次确认一致性全部由 PHP 服务端验证。
    const button = $('account-save'); button.disabled = true;
    try {
      const result = await post('changeAdminCredentials', values);
      if (result.code !== 200) throw new Error(result.message || '修改失败');
      window.localStorage.removeItem('Token');
      window.top.location.replace('/admin/login');
    } catch (error) { feedback('account-feedback',error.message || '网络错误',true); button.disabled = false; }
  });
})();
