// 后台统一 Token 请求头与失效处理，适用于 Layui/jQuery、上传及原生 XHR。
(function () {
    'use strict';

    const loginUrl = new URL('/admin/login', document.currentScript.src).href;
    let redirecting = false;

    function isAdminRequest(url) {
        try {
            const target = new URL(url, window.location.href);
            return target.origin === window.location.origin &&
                /\/(?:index\.php\/)?(?:Admin|Accounts|Domains|DatabaseBackup)\/[^/]+/i.test(target.pathname) &&
                !/\/Admin\/logon$/i.test(target.pathname);
        } catch (_) {
            return false;
        }
    }

    function expire() {
        if (redirecting) return;
        redirecting = true;
        localStorage.removeItem('Token');
        window.top.location.replace(loginUrl);
    }

    function isUnauthorized(response) {
        return response && Number(response.code) === 401;
    }

    const xhrOpen = XMLHttpRequest.prototype.open;
    const xhrSetHeader = XMLHttpRequest.prototype.setRequestHeader;
    const xhrSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function (_method, url) {
        this._adminAuthRequest = isAdminRequest(url);
        this._adminAuthHeaderSet = false;
        if (this._adminAuthRequest) {
            this.addEventListener('loadend', function () {
                if (this.status === 401) return expire();
                if (this.responseType === 'json') {
                    if (isUnauthorized(this.response)) expire();
                    return;
                }
                if (this.responseType && this.responseType !== 'text') return;
                try {
                    const response = JSON.parse(this.responseText);
                    if (isUnauthorized(response)) expire();
                } catch (_) { /* 非 JSON 响应不处理 */ }
            }, { once: true });
        }
        return xhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
        if (this._adminAuthRequest && name.toLowerCase() === 'token') {
            this._adminAuthHeaderSet = true;
            return xhrSetHeader.call(this, 'Token', localStorage.getItem('Token') || '');
        }
        return xhrSetHeader.call(this, name, value);
    };

    XMLHttpRequest.prototype.send = function () {
        if (this._adminAuthRequest && !this._adminAuthHeaderSet) {
            xhrSetHeader.call(this, 'Token', localStorage.getItem('Token') || '');
        }
        return xhrSend.apply(this, arguments);
    };

    // 主页面使用的 fetch 也通过同一个入口发送 Token、处理 401。
    async function request(url, options = {}) {
        const init = { ...options, headers: new Headers(options.headers || {}) };
        if (isAdminRequest(url)) {
            init.headers.set('Token', localStorage.getItem('Token') || '');
        }
        const response = await fetch(url, init);
        if (response.status === 401) {
            expire();
        } else {
            const type = response.headers.get('content-type') || '';
            if (type.includes('json')) {
                const data = await response.clone().json().catch(() => null);
                if (isUnauthorized(data)) expire();
            }
        }
        return response;
    }

    window.adminAuth = { request, expire };
})();
