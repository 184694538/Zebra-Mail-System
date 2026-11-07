/* 斑马邮箱皮肤预加载：首次绘制前采用已保存的颜色，避免默认皮肤闪烁。 */
(function () {
  'use strict';
  const script = document.currentScript;
  const scope = script && script.dataset.scope === 'webmail' ? 'webmail' : 'admin';
  const valid = new Set(['layui_night', 'layui_day', 'business_blue', 'deep_ocean', 'cloud_white', 'graphite', 'teal', 'sand']);
  const defaults = {admin_theme: 'business_blue', webmail_theme: 'deep_ocean'};
  const storageKey = 'zebra_mail_themes_v2';
  const themeField = scope === 'webmail' ? 'webmail_theme' : 'admin_theme';
  const attr = scope === 'webmail' ? 'data-webmail-theme' : 'data-admin-theme';
  const root = document.documentElement;
  let waitingForInitialTheme = false;

  function readCache() {
    try {
      const value = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
      if (value && valid.has(value.admin_theme) && valid.has(value.webmail_theme)) return value;
    } catch (_) { /* 浏览器禁用存储时继续走服务端配置 */ }
    return null;
  }

  function store(settings) {
    try { window.localStorage.setItem(storageKey, JSON.stringify(settings)); } catch (_) { /* 无痕模式等 */ }
  }

  function apply(settings) {
    const clean = {
      admin_theme: settings && valid.has(settings.admin_theme) ? settings.admin_theme : defaults.admin_theme,
      webmail_theme: settings && valid.has(settings.webmail_theme) ? settings.webmail_theme : defaults.webmail_theme
    };
    // 同源 iframe 共用一份本地配色，子页面在初次渲染前即可取到当前主题。
    store(clean);
    root.setAttribute(attr, clean[themeField]);
    if (waitingForInitialTheme) {
      root.style.removeProperty('visibility');
      waitingForInitialTheme = false;
    }
  }

  const cached = readCache();
  if (cached) {
    // 同步执行：在 CSS 及正文绘制前就应用上次选定的皮肤。
    root.setAttribute(attr, cached[themeField]);
  } else {
    // 新浏览器没有缓存时，等待服务端返回，避免短暂显示商务雾蓝。
    waitingForInitialTheme = true;
    root.style.setProperty('visibility', 'hidden', 'important');
  }

  window.MailTheme = {apply, scope};

  // 后端 config_private/theme_settings.json 仍是最终权威配置。
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timeout = window.setTimeout(function () { if (controller) controller.abort(); }, 5000);
  fetch('/Index/themeSettings', {
    method: 'GET', credentials: 'same-origin', cache: 'no-store',
    ...(controller ? {signal: controller.signal} : {})
  })
    .then(function (res) { if (!res.ok) throw new Error('theme read failed'); return res.json(); })
    .then(function (res) { apply(res && res.code === 200 ? res.data : (cached || defaults)); })
    .catch(function () { apply(cached || defaults); })
    .finally(function () { window.clearTimeout(timeout); });
})();
