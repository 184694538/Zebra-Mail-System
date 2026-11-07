(function () {
  const layout = document.getElementById('adminLayout');
  const switchIcon = document.getElementById('toggleIcon');
  const backdrop = document.getElementById('sidebarBackdrop');
  const contentFrame = document.getElementById('contentFrame');
  const DEFAULT_PAGE = '/admin/page2';
  let contentPageLoaded = false;

  // 必须在登录验证完成、主布局可计算尺寸后才加载业务 iframe。
  // 否则 Layui 表格可能在 display:none 容器里提前初始化，造成刷新后空白。
  function loadContentPage(page) {
    if (!page) return;
    contentPageLoaded = true;
    if (contentFrame.getAttribute('src') !== page) {
      contentFrame.setAttribute('src', page);
    }
  }

  const isMobile = () => window.matchMedia('(max-width: 800px)').matches;
  function refreshToggleIcon() {
    const opened = isMobile() ? layout.classList.contains('mobile-open') : !layout.classList.contains('is-collapsed');
    switchIcon.className = 'layui-icon ' + (opened ? 'layui-icon-shrink-right' : 'layui-icon-spread-left');
    document.getElementById('sidebarToggle').setAttribute('aria-expanded', String(opened));
  }
  window.toggleIcon = function () {
    if (isMobile()) {
      layout.classList.toggle('mobile-open');
    } else {
      const collapsed = layout.classList.toggle('is-collapsed');
      localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'expanded');
    }
    refreshToggleIcon();
  };
  backdrop.addEventListener('click', function () { layout.classList.remove('mobile-open'); refreshToggleIcon(); });
  window.addEventListener('resize', function () { if (!isMobile()) layout.classList.remove('mobile-open'); refreshToggleIcon(); });
  if (localStorage.getItem('sidebar') === 'collapsed') layout.classList.add('is-collapsed');
  refreshToggleIcon();

  document.querySelectorAll('.admin-nav .zc a[data-page]').forEach(function (link) {
    link.addEventListener('click', function () {
      const page = link.getAttribute('data-page');
      loadContentPage(page);
      document.querySelectorAll('.admin-nav .zc').forEach(item => item.classList.remove('layui-this'));
      link.closest('li').classList.add('layui-this');
      layout.classList.remove('mobile-open'); refreshToggleIcon();
    });
  });
  document.addEventListener('keydown', function(event){ if(event.key === 'Escape'){layout.classList.remove('mobile-open'); refreshToggleIcon();}});


  // 系统版本和技术支持名称都来自 config/version.php，避免前端写死。
  // 只有管理员认证后才读取；失败不影响后台业务功能。
  async function loadSystemVersion() {
    try {
      const response = await adminAuth.request(window.baseUrl + 'Admin/systemVersion', {
        method: 'POST', headers: { 'Accept': 'application/json' }, cache: 'no-store'
      });
      if (!response.ok) return;
      const result = await response.json();
      if (result.code !== 200 || !result.data) return;
      const version = typeof result.data.version === 'string' ? result.data.version.trim() : '';
      const support = typeof result.data.tech_support === 'string' ? result.data.tech_support.trim() : '';
      const sidebarVersion = document.getElementById('sidebarAppVersion');
      const footerSupport = document.getElementById('footerTechSupport');
      if (sidebarVersion && version) {
        sidebarVersion.textContent = '系统版本：v' + version;
        sidebarVersion.hidden = false;
      }
      if (footerSupport && support) {
        footerSupport.textContent = '· 技术支持（' + support + '）';
        footerSupport.hidden = false;
      }
    } catch (_) { /* 版本和技术支持展示失败不阻塞管理功能 */ }
  }

  // 邮局管理使用原生链接 /hmailadmin/，不再通过 iframe 预览层跳转。
  const token = localStorage.getItem('Token');
  if (!token) { window.location.replace('/admin/login'); return; }
  adminAuth.request(window.baseUrl + 'Admin/tokenValidityCheck', {
    method: 'POST', headers: { 'Accept': 'application/json' }, cache: 'no-store'
  }).then(r => r.json()).then(data => {
    if (!data.status) { adminAuth.expire(); return; }
    if (data.must_change_password) { window.location.replace('/admin/first-login'); return; }
    layout.style.display = '';
    loadSystemVersion();
    // 两次绘制机会让父容器完成布局，随后才加载默认邮箱管理页面。
    // 如用户此时已点击其他菜单，绝不覆盖用户手动选择的页面。
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        if (!contentPageLoaded) loadContentPage(DEFAULT_PAGE);
      });
    });
  }).catch(async () => {
    // 空数据库初始化时，tokenValidityCheck 的域名/账户 SQL 可能因表不存在而报错。
    // 仅在带 Token 的独立备份列表接口验证通过后开放备份页面。
    try {
      const r = await adminAuth.request(window.baseUrl + 'DatabaseBackup/lists', {method:'POST', cache:'no-store', headers:{'Token':localStorage.getItem('Token') || ''}});
      const j = await r.json();
      if (!r.ok || j.code !== 200) throw new Error('无法验证管理员身份或备份服务不可用');
      layout.style.display = '';
      loadSystemVersion();
      document.querySelectorAll('.admin-nav .zc').forEach(item => item.classList.remove('layui-this'));
      const backupNav = document.querySelector('[data-page="/admin/page6"]');
      if (backupNav) backupNav.closest('li').classList.add('layui-this');
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (!contentPageLoaded) loadContentPage('/admin/page6');
      }));
      layui.layer.msg('业务数据库尚未就绪，已打开数据库维护', {icon:0, time:3500});
    } catch (error) {
      layui.layer.msg('登录验证失败：' + error.message, {icon:2, time:4000});
    }
  });
})();

async function logout() {
  if (!localStorage.getItem('Token')) { window.location.replace('/admin/login'); return; }
  try {
    const response = await adminAuth.request(window.baseUrl + 'Admin/logout', {
      method: 'POST', headers: { 'Accept': 'application/json' }, cache: 'no-store'
    });
    const result = await response.json();
    if (result.code !== 200 && result.code !== 401) throw new Error(result.message || '服务器未确认退出');
    localStorage.removeItem('Token');
    window.location.replace('/admin/login');
  } catch (error) { layui.layer.msg('退出失败：' + error.message + '，请重试', { icon:2 }); }
}
function screen_full() {
  const icon = document.getElementById('screen_full');
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().then(() => {icon.className='layui-icon layui-icon-screen-restore';}).catch(() => {layui.layer.msg('浏览器未允许全屏',{icon:0});});
  } else {
    document.exitFullscreen().then(() => {icon.className='layui-icon layui-icon-screen-full';}).catch(() => {layui.layer.msg('退出全屏失败',{icon:0});});
  }
}
