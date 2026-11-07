/* Zebra Mail - Admin/Webmail login protocol v1; challenge_id is random payload data only; server validates timestamp only. */
(function (global) {
  'use strict';
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  // libsodium browser distribution invokes sodium.onload after its runtime is initialized.
  global.sodium = { onload: function (instance) { readyResolve(instance); } };

  function libraryFailed() {
    readyReject(new Error('登录加密库加载失败，请检查网络连接'));
  }
  async function sodiumReady() {
    return Promise.race([
      ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error('登录加密组件初始化超时')), 15000))
    ]);
  }
  async function encryptPassword(scene, username, password) {
    if (!['admin', 'webmail'].includes(scene) || !username || !password) {
      throw new Error('请输入正确的账号和密码');
    }
    const sodium = await sodiumReady();
    const response = await fetch('/LoginCrypto/challenge', {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ scene, username })
    });
    if (!response.ok) throw new Error(response.status === 429 ? '登录请求过于频繁' : '获取登录安全信息失败');
    const result = await response.json();
    if (!result.status || !result.data) throw new Error(result.message || '无法获取登录加密信息');
    const c = result.data;
    if (c.version !== 1 || typeof c.timestamp !== 'number' || !c.challenge_id || !c.public_key || !c.key_id) {
      throw new Error('服务器登录加密协议不兼容');
    }
    // JSON.stringify 直接生成紧凑 JSON（不添加空格、换行或 GZIP）。
    const plain = JSON.stringify({ password, timestamp: c.timestamp, challenge_id: c.challenge_id });
    const b64 = sodium.base64_variants.ORIGINAL;
    const publicKey = sodium.from_base64(c.public_key, b64);
    if (publicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) throw new Error('登录公钥无效');
    const ciphertext = sodium.crypto_box_seal(sodium.from_string(plain), publicKey);
    return { key_id: c.key_id, encrypted_password: sodium.to_base64(ciphertext, b64) };
  }
  global.LoginCrypto = Object.freeze({ encryptPassword, libraryFailed });
})(window);
