(() => {
  'use strict';
  const API = new URL('../Webmail/', window.location.href);
  const apiUrl = (name, params = {}) => {
    const url = new URL(name, API);
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
  };
  const $ = (id) => document.getElementById(id);
  const state = { csrf: '', passwordEnabled: false, email: '', folders: [], folder: 'inbox', folderLabel: '收件箱', page: 1, pageSize: 25, total: 0, messages: [], selectedUid: 0, search: '', currentMessage: null, busy: false };
  const iconByFolder = { inbox: 'layui-icon-email', sent: 'layui-icon-release', drafts: 'layui-icon-edit', trash: 'layui-icon-delete', junk: 'layui-icon-folder' };
  const layer = window.layui && layui.layer ? layui.layer : null;

  function toast(message, type = 'info') {
    if (layer) layer.msg(message, { time: 2200, icon: type === 'success' ? 1 : type === 'error' ? 2 : 0, shade: 0, skin: 'webmail-toast' });
    else if (type === 'error') window.alert(message);
  }
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }
  function formatDate(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const today = new Date();
    const sameDay = date.toDateString() === today.toDateString();
    return sameDay ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : date.toLocaleDateString();
  }
  function senderName(value) {
    const text = String(value || '未知发件人');
    const match = text.match(/^\s*(.*?)\s*<([^>]+)>/);
    return match ? (match[1].replace(/^"|"$/g, '') || match[2]) : text;
  }
  async function request(name, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.method && options.method.toUpperCase() !== 'GET' && state.csrf) headers.set('X-CSRF-Token', state.csrf);
    if (options.body && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(apiUrl(name, options.params || {}), { credentials: 'same-origin', cache: 'no-store', ...options, headers });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      if (!response.ok) throw new Error(`请求失败（${response.status}）`);
      return response;
    }
    const result = await response.json();
    if (!response.ok || result.code !== 0) {
      if (response.status === 401 && name !== 'login') showLogin();
      const error = new Error(result.message || '请求失败');
      error.status = response.status;
      throw error;
    }
    return result.data;
  }
  async function refreshPasswordFeature() {
    try {
      const data = await request('passwordFeature');
      state.passwordEnabled = data?.enabled === true;
    } catch (_) {
      state.passwordEnabled = false; // 网络异常时也不暴露入口
    }
    $('login-change-password').hidden = !state.passwordEnabled;
    $('password-open').hidden = !state.passwordEnabled;
  }
  function openPasswordDialog() {
    if (!state.passwordEnabled) return;
    $('password-form').reset();
    $('password-email').value = state.email || $('login-email').value.trim();
    $('password-dialog').showModal();
    $('old-password').focus();
  }
  async function refreshCsrf() {
    const result = await request('csrf');
    state.csrf = result.csrf_token;
  }
  function showLogin() {
    $('mail-app').hidden = true;
    $('login-screen').hidden = false;
    $('boot-screen').hidden = true;
    $('login-password').value = '';
    $('login-error').textContent = '';
    state.email = '';
    state.currentMessage = null;
  }
  function showApp() {
    $('login-screen').hidden = true;
    $('mail-app').hidden = false;
    $('boot-screen').hidden = true;
    $('user-email').textContent = state.email;
  }
  async function checkSession() {
    let me;
    try {
      me = await request('me');
    } catch (error) {
      // 401 means unauthenticated; other failures should be visible to the user.
      showLogin();
      if (error.status !== 401) $('login-error').textContent = '检查登录状态失败：' + error.message;
      return;
    }
    state.email = me.email;
    showApp();
    try {
      await loadFolders();
      await loadMessages();
    } catch (error) {
      // Folder/IMAP errors must not turn a valid login into a login-screen flash.
      if (!$('mail-app').hidden) toast('加载邮件失败：' + error.message, 'error');
    }
  }
  async function loadFolders() {
    const folders = await request('folders');
    state.folders = Array.isArray(folders) ? folders : [];
    renderFolders();
    if (!state.folders.some((item) => item.key === state.folder || item.name === state.folder)) {
      const inbox = state.folders.find((item) => item.key === 'inbox');
      state.folder = inbox ? inbox.key : 'inbox';
    }
  }
  function renderFolders() {
    const container = $('folder-list');
    container.innerHTML = '';
    state.folders.forEach((folder) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `folder-item${state.folder === folder.key || state.folder === folder.name ? ' active' : ''}`;
      const icon = iconByFolder[folder.key] || 'layui-icon-folder';
      button.innerHTML = `<i class="layui-icon ${icon}"></i><span>${escapeHtml(folder.label)}</span>`;
      button.title = folder.label;
      button.addEventListener('click', () => selectFolder(folder));
      container.appendChild(button);
    });
  }
  async function selectFolder(folder) {
    state.folder = folder.key;
    state.folderLabel = folder.label;
    state.page = 1;
    state.selectedUid = 0;
    state.currentMessage = null;
    document.querySelector('.mail-main')?.classList.remove('reading');
    renderFolders();
    await loadMessages();
    renderEmptyReader();
  }
  async function loadMessages() {
    $('folder-title').textContent = state.folders.find((item) => item.key === state.folder || item.name === state.folder)?.label || state.folderLabel || state.folder;
    $('message-list').innerHTML = '<div class="loading">正在加载邮件…</div>';
    try {
      const data = await request('messages', { params: { folder: state.folder, page: state.page, q: state.search } });
      state.messages = data.messages || [];
      state.total = Number(data.total || 0);
      state.page = Number(data.page || 1);
      state.pageSize = Number(data.page_size || 25);
      $('message-count').textContent = `${state.total} 封邮件 · ${Number(data.unread || 0)} 封未读`;
      $('page-label').textContent = `${state.page} / ${Math.max(1, Math.ceil(state.total / state.pageSize))}`;
      $('page-prev').disabled = state.page <= 1;
      $('page-next').disabled = state.page >= Math.ceil(state.total / state.pageSize);
      renderMessages();
    } catch (error) {
      $('message-list').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
      $('message-count').textContent = '加载失败';
    }
  }
  function renderMessages() {
    const container = $('message-list');
    container.innerHTML = '';
    if (!state.messages.length) {
      container.innerHTML = '<div class="empty-state">这个文件夹里还没有邮件</div>';
      return;
    }
    state.messages.forEach((message) => {
      const row = document.createElement('article');
      row.className = `message-row${message.seen ? '' : ' unread'}${state.selectedUid === Number(message.uid) ? ' active' : ''}`;
      row.innerHTML = `<div class="message-topline"><div class="message-from">${escapeHtml(senderName(message.from))}</div><time class="message-date">${escapeHtml(formatDate(message.date))}</time></div><div class="message-subject">${escapeHtml(message.subject || '（无主题）')}</div><div class="message-flags">${message.has_attachment ? '<span><i class="layui-icon layui-icon-attach"></i> 附件</span>' : ''}${message.flagged ? '<span><i class="layui-icon layui-icon-star-fill"></i> 星标</span>' : ''}</div>`;
      row.addEventListener('click', () => openMessage(message.uid));
      container.appendChild(row);
    });
  }
  function renderEmptyReader() {
    $('reader-panel').innerHTML = '<div class="reader-empty"><div class="reader-empty-icon"><i class="layui-icon layui-icon-email"></i></div><div class="reader-empty-title">选择一封邮件</div><div class="reader-empty-text">邮件内容将在这里显示</div></div>';
  }
  async function openMessage(uid) {
    state.selectedUid = Number(uid);
    renderMessages();
    $('reader-panel').innerHTML = '<div class="loading">正在读取邮件…</div>';
    document.querySelector('.mail-main').classList.add('reading');
    try {
      const message = await request('message', { params: { folder: state.folder, uid } });
      state.currentMessage = message;
      renderMessage(message);
      const item = state.messages.find((entry) => Number(entry.uid) === Number(uid));
      if (item) item.seen = true;
      renderMessages();
    } catch (error) {
      $('reader-panel').innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    }
  }
  function addressText(items) {
    return (items || []).map((item) => item.name ? `${item.name} <${item.email}>` : item.email).join(', ');
  }
  function renderMessage(message) {
    const from = message.from && message.from[0] ? message.from[0] : { name: '', email: '' };
    const initial = (from.name || from.email || '?').trim().slice(0, 1).toUpperCase();
    const downloadLinks = (message.attachments || []).map((file) => {
      const url = apiUrl('download', { folder: state.folder, uid: message.uid, part: file.part });
      return `<a class="attachment-link" href="${escapeHtml(url)}"><i class="layui-icon layui-icon-download-circle"></i>${escapeHtml(file.filename)} <span>(${formatBytes(file.size)})</span></a>`;
    }).join('');
    const body = message.html
      ? `<iframe id="message-frame" sandbox="" referrerpolicy="no-referrer" title="邮件正文"></iframe>`
      : `<pre>${escapeHtml(message.text || '（此邮件没有可显示的正文）')}</pre>`;
    $('reader-panel').innerHTML = `<div class="reader-toolbar"><button id="reply-button" class="icon-button" type="button"><i class="layui-icon layui-icon-reply-fill"></i> 回复</button><button id="reply-all-button" class="icon-button" type="button"><i class="layui-icon layui-icon-reply-fill"></i> 回复全部</button><button id="forward-button" class="icon-button" type="button"><i class="layui-icon layui-icon-share"></i> 转发</button><span class="toolbar-spacer"></span><button id="mark-unread-button" class="icon-button" type="button" title="标记未读"><i class="layui-icon layui-icon-read"></i></button><button id="delete-message-button" class="icon-button toolbar-danger" type="button" title="删除"><i class="layui-icon layui-icon-delete"></i></button></div><div class="reader-content"><h2 class="reader-subject">${escapeHtml(message.subject)}</h2><div class="reader-meta"><div class="avatar">${escapeHtml(initial)}</div><div class="meta-main"><div class="meta-from">${escapeHtml(from.name || from.email || '未知发件人')}</div><div class="meta-detail">${escapeHtml(from.email || '')}<br>收件人：${escapeHtml(addressText(message.to))}${message.cc?.length ? `<br>抄送：${escapeHtml(addressText(message.cc))}` : ''}</div></div><time class="meta-date">${escapeHtml(message.date || '')}</time></div><div class="reader-body">${body}</div>${downloadLinks ? `<div class="attachment-list"><div class="attachment-title">附件（${message.attachments.length}）</div>${downloadLinks}</div>` : ''}</div>`;
    const frame = $('message-frame');
    if (frame) {
      const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; font-src data:;">`;
      frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8">${csp}<style>body{font:14px/1.8 Arial,sans-serif;color:#344252;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{max-width:100%;border-collapse:collapse}a{color:#3678d8}</style></head><body>${message.html}</body></html>`;
    }
    $('reply-button').addEventListener('click', () => openCompose('reply', message));
    $('reply-all-button').addEventListener('click', () => openCompose('replyall', message));
    $('forward-button').addEventListener('click', () => openCompose('forward', message));
    $('mark-unread-button').addEventListener('click', () => markMessage(message.uid, false));
    $('delete-message-button').addEventListener('click', () => deleteMessage(message.uid));
  }
  function formatBytes(size) {
    const value = Number(size || 0);
    if (value < 1024) return `${value} B`;
    if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1048576).toFixed(1)} MB`;
  }
  async function markMessage(uid, seen) {
    try {
      await request('mark', { method: 'POST', body: JSON.stringify({ folder: state.folder, uid, seen }) });
      toast(seen ? '已标记为已读' : '已标记为未读', 'success');
      await loadMessages();
    } catch (error) { toast(error.message, 'error'); }
  }
  async function deleteMessage(uid) {
    if (!window.confirm('确定删除这封邮件吗？')) return;
    try {
      await request('delete', { method: 'POST', body: JSON.stringify({ folder: state.folder, uid }) });
      state.selectedUid = 0;
      state.currentMessage = null;
      renderEmptyReader();
      await loadMessages();
      toast('邮件已删除', 'success');
    } catch (error) { toast(error.message, 'error'); }
  }
  function openCompose(mode = 'new', message = null) {
    $('compose-form').reset();
    $('compose-body').innerHTML = '';
    $('attachment-names').textContent = '';
    $('compose-title').textContent = mode === 'reply' ? '回复邮件' : mode === 'replyall' ? '回复全部' : mode === 'forward' ? '转发邮件' : '写邮件';
    if (message) {
      const from = message.from?.[0]?.email || '';
      $('compose-to').value = mode === 'reply' ? from : mode === 'replyall' ? [...new Set([from, ...(message.to || []).map((item) => item.email)].filter((address) => address && address.toLowerCase() !== state.email.toLowerCase()))].join(', ') : '';
      if (mode === 'replyall') $('compose-cc').value = [...new Set((message.cc || []).map((item) => item.email).filter((address) => address && address.toLowerCase() !== state.email.toLowerCase()))].join(', ');
      $('compose-subject').value = `${mode === 'reply' || mode === 'replyall' ? 'Re: ' : 'Fwd: '}${String(message.subject || '').replace(/^(re|fwd):\s*/i, '')}`;
      const quote = message.text || (message.html ? message.html.replace(/<[^>]*>/g, ' ') : '');
      $('compose-body').innerHTML = mode === 'reply' || mode === 'replyall'
        ? `<p><br></p><blockquote style="border-left:3px solid #dce4ed;padding-left:12px;color:#778594">${escapeHtml(quote).replace(/\n/g, '<br>')}</blockquote>`
        : `<p><br></p><hr><p>---------- 转发邮件 ----------</p><p>主题：${escapeHtml(message.subject)}</p><p>发件人：${escapeHtml(addressText(message.from))}</p><div>${escapeHtml(quote).replace(/\n/g, '<br>')}</div>`;
    }
    $('compose-dialog').showModal();
    $('compose-to').focus();
  }
  function composePayload() {
    const text = $('compose-body').innerText.trim();
    const html = text ? $('compose-body').innerHTML.trim() : '';
    return { to: $('compose-to').value.trim(), cc: $('compose-cc').value.trim(), bcc: $('compose-bcc').value.trim(), subject: $('compose-subject').value.trim(), html, text };
  }
  function selectedFiles() {
    return Array.from($('compose-files').files || []);
  }
  async function sendMail(event) {
    event.preventDefault();
    if (state.busy) return;
    const payload = composePayload();
    if (!payload.to && !payload.cc && !payload.bcc) { toast('请填写收件人', 'error'); $('compose-to').focus(); return; }
    if (!payload.html && !payload.text) { toast('请填写邮件正文', 'error'); return; }
    state.busy = true;
    $('send-button').disabled = true;
    $('send-button').textContent = '发送中…';
    try {
      const form = new FormData();
      Object.entries(payload).forEach(([key, value]) => form.append(key, value));
      selectedFiles().forEach((file) => form.append('attachments[]', file));
      const result = await request('send', { method: 'POST', body: form });
      $('compose-dialog').close();
      toast(result.saved_to_sent ? '邮件发送成功' : '邮件已发送（未保存到已发送）', 'success');
      if (state.folder === 'sent') await loadMessages();
    } catch (error) { toast(error.message, 'error'); }
    finally { state.busy = false; $('send-button').disabled = false; $('send-button').innerHTML = '<i class="layui-icon layui-icon-release"></i> 发送'; }
  }
  async function saveDraft() {
    const payload = composePayload();
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => form.append(key, value));
    selectedFiles().forEach((file) => form.append('attachments[]', file));
    try {
      await request('saveDraft', { method: 'POST', body: form });
      $('compose-dialog').close();
      toast('草稿已保存', 'success');
      if (state.folder === 'drafts') await loadMessages();
    } catch (error) { toast(error.message, 'error'); }
  }
  async function changePassword(event) {
    event.preventDefault();
    if (!state.passwordEnabled) return;
    const payload = { email: $('password-email').value.trim(), old_password: $('old-password').value, new_password: $('new-password').value, confirm_password: $('confirm-password').value };
    if (payload.new_password !== payload.confirm_password) { toast('两次输入的新密码不一致', 'error'); return; }
    $('password-submit').disabled = true;
    try {
      await request('changePassword', { method: 'POST', body: JSON.stringify(payload) });
      $('password-dialog').close();
      $('password-form').reset();
      $('login-email').value = payload.email;
      toast('密码修改成功，请使用新密码登录', 'success');
    } catch (error) { toast(error.message, 'error'); }
    finally { $('password-submit').disabled = false; }
  }
  async function logout() {
    try { await request('logout', { method: 'POST', body: '{}' }); } catch (_) { /* session may already be expired */ }
    showLogin();
    await refreshCsrf().catch(() => {});
  }

  $('login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    $('login-submit').disabled = true;
    $('login-error').textContent = '';
    try {
      const email = $('login-email').value.trim().toLowerCase();
      if (!window.LoginCrypto) throw new Error('登录加密组件不可用');
      const encrypted = await window.LoginCrypto.encryptPassword('webmail', email, $('login-password').value);
      const result = await request('login', {
        method: 'POST',
        body: JSON.stringify({ email, key_id: encrypted.key_id, encrypted_password: encrypted.encrypted_password })
      });
      state.email = result.email;
      $('login-password').value = '';
      showApp();
      await loadFolders();
      state.folder = 'inbox';
      await loadMessages();
    } catch (error) { $('login-error').textContent = error.message; }
    finally { $('login-submit').disabled = false; }
  });
  $('compose-open').addEventListener('click', () => openCompose());
  $('compose-form').addEventListener('submit', sendMail);
  $('draft-button').addEventListener('click', saveDraft);
  $('compose-files').addEventListener('change', () => { $('attachment-names').textContent = selectedFiles().map((file) => file.name).join('、'); });
  $('password-open').addEventListener('click', openPasswordDialog);
  $('login-change-password').addEventListener('click', openPasswordDialog);
  $('password-form').addEventListener('submit', changePassword);
  $('logout-button').addEventListener('click', logout);
  document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
  $('refresh-button').addEventListener('click', async () => { await loadMessages(); if (state.currentMessage) await openMessage(state.selectedUid); });
  $('page-prev').addEventListener('click', async () => { if (state.page > 1) { state.page--; await loadMessages(); } });
  $('page-next').addEventListener('click', async () => { if (state.page * state.pageSize < state.total) { state.page++; await loadMessages(); } });
  $('search-input').addEventListener('keydown', async (event) => { if (event.key === 'Enter') { state.search = event.target.value.trim(); state.page = 1; await loadMessages(); } });
  $('search-clear').addEventListener('click', async () => { $('search-input').value = ''; state.search = ''; state.page = 1; await loadMessages(); });

  (async () => {
    try { await refreshCsrf(); await refreshPasswordFeature(); await checkSession(); }
    catch (error) { showLogin(); $('login-error').textContent = error.message; }
  })();
})();
