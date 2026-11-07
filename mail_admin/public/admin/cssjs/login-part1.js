layui.use(['form', 'layer', 'jquery'], function () {
  const form = layui.form;
  const layer = layui.layer;
  const $ = layui.jquery;
  let submitting = false;
  form.on('submit(login)', async function (data) {
    if (submitting) return false;
    submitting = true;
    const button = document.querySelector('[lay-filter="login"][type="submit"]');
    if (button) button.disabled = true;
    try {
      if (!window.LoginCrypto) throw new Error('登录加密组件不可用');
      const username = String(data.field.username || '').trim();
      const encrypted = await window.LoginCrypto.encryptPassword('admin', username, data.field.password);
      const response = await $.ajax({
        url: '/Admin/logon',
        method: 'POST',
        data: { username, key_id: encrypted.key_id, encrypted_password: encrypted.encrypted_password }
      });
      if (!response.status) {
        layer.msg(response.message || '登录失败', { icon: 2 });
        return false;
      }
      document.querySelector('input[name="password"]').value = '';
      localStorage.setItem('Token', response.token);
      window.location.replace(response.must_change_password ? '/admin/first-login' : '/admin/');
    } catch (error) {
      const serverMessage = error && error.responseJSON && error.responseJSON.message;
      layer.msg(serverMessage || error.message || '登录失败，请重试', { icon: 2 });
    } finally {
      submitting = false;
      if (button) button.disabled = false;
    }
    return false;
  });
});
