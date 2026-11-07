// 查询 API 密钥并填充页面。
layui.$('#queryMailKey-btn').on('click', function () {
    layui.$.ajax({
        url: window.parent.baseUrl + 'admin/queryMailKey',
        method: 'GET',
        success: function (response) {
            if (response.code === 200) {
                layui.$('#read_email_key').val(response.read_email_key || '');
                layui.$('#read_email_key2').val(response.read_email_key2 || '');
                layui.$('#delete_emails_key').val(response.delete_emails_key || '');
                layui.$('#queryDomainName_key').val(response.queryDomainName_key || '');
            } else {
                layui.layer.msg('获取密钥失败: ' + (response.message || '未知错误'));
            }
        },
        error: function () {
            layui.layer.msg('请求失败，请重试！');
        }
    });
});

// 点击 API 接口文档按钮：打开本站维护的 HTML 文档，不再跳转第三方平台。
layui.$('#jkwd-btn').on('click', function () {
    const baseUrl = (window.parent && window.parent.baseUrl) || '/';
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/';
    window.location.href = normalizedBaseUrl + 'admin/api-docs';
});

// 页面加载完成后自动获取密钥。
layui.$(window).on('load', function () {
    layui.$('#queryMailKey-btn').click();
});

(function () {
    const $ = layui.$;

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(
                function () { return true; },
                function () { return fallbackCopy(text); }
            );
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        let copied = false;
        try {
            copied = document.execCommand('copy');
        } catch (error) {
            copied = false;
        }
        document.body.removeChild(textarea);
        return copied;
    }

    // 只有弹窗允许编辑；页面主区域只显示 config_private 中的当前状态。
    function initGlobalApiSettings() {
        const enabledDisplay = $('#api-global-enabled-display');
        const maxDisplay = $('#api-global-max-emails-display');
        const openButton = $('#api-global-settings-open');
        const base = (window.parent && window.parent.baseUrl) || '/';
        const normalized = base.endsWith('/') ? base : base + '/';
        const getUrl = normalized + 'admin/getMailApiSettings';
        const setUrl = normalized + 'admin/setMailApiSettings';
        let opening = false;

        function setLoaded(data) {
            const enabled = data.enabled === true;
            const max = Number(data.max_emails);
            enabledDisplay.val(enabled ? '启用' : '关闭');
            maxDisplay.val(Number.isInteger(max) && max >= 1 && max <= 100 ? String(max) : '1');
        }

        function loadSettings(onSuccess, showError) {
            $.ajax({
                url: getUrl,
                type: 'GET',
                cache: false,
                success: function (res) {
                    if (res && res.code === 200 && res.data) {
                        setLoaded(res.data);
                        if (onSuccess) onSuccess(res.data);
                    } else {
                        enabledDisplay.val('读取失败');
                        maxDisplay.val('读取失败');
                        if (showError) layui.layer.msg((res && res.message) || '读取 API 全局设置失败');
                    }
                },
                error: function () {
                    enabledDisplay.val('读取失败');
                    maxDisplay.val('读取失败');
                    if (showError) layui.layer.msg('无法读取 API 全局设置，请刷新重试');
                },
                complete: function () { opening = false; }
            });
        }

        loadSettings(null, false);

        function showSettingsDialog(data) {
            const enabled = data.enabled === true;
            const max = Number(data.max_emails);
            const maxText = Number.isInteger(max) && max >= 2 && max <= 100 ? String(max) : '';
            const content = `
                <div class="api-settings-modal">
                    <div class="api-modal-row">
                        <div class="api-modal-label">是否启用 API</div>
                        <div class="api-modal-controls">
                            <label><input type="radio" name="api-modal-enabled" value="1" lay-ignore ${enabled ? 'checked' : ''}> 启用</label>
                            <label><input type="radio" name="api-modal-enabled" value="0" lay-ignore ${enabled ? '' : 'checked'}> 关闭</label>
                        </div>
                    </div>
                    <div class="api-modal-row">
                        <label class="api-modal-label" for="api-modal-max-emails">API最多显示邮件数量</label>
                        <div class="api-modal-controls">
                            <input type="text" id="api-modal-max-emails" class="layui-input" inputmode="numeric"
                                placeholder="留空默认 1，最大 100" maxlength="3" autocomplete="off" value="${maxText}">
                        </div>
                    </div>
                </div>`;
            let saving = false;
            layui.layer.open({
                type: 1,
                title: 'API 全局设置',
                area: [Math.min(480, Math.max(300, window.innerWidth - 24)) + 'px', 'auto'],
                shadeClose: false,
                content: content,
                btn: ['保存', '取消'],
                yes: function (index, layero) {
                    if (saving) return false;
                    const selected = layero.find('input[name="api-modal-enabled"]:checked').val();
                    const value = $.trim(layero.find('#api-modal-max-emails').val() || '');
                    if (selected !== '0' && selected !== '1') {
                        layui.layer.msg('请选择是否启用 API');
                        return false;
                    }
                    if (value !== '' && !/^(?:100|[1-9][0-9]?)$/.test(value)) {
                        layui.layer.msg('API最多显示邮件数量只能填写 1～100 的整数，或留空');
                        layero.find('#api-modal-max-emails').focus();
                        return false;
                    }
                    saving = true;
                    layero.find('.layui-layer-btn0').addClass('layui-btn-disabled').attr('aria-disabled', 'true');
                    $.ajax({
                        url: setUrl,
                        type: 'POST',
                        data: { enabled: selected, max_emails: value },
                        success: function (res) {
                            if (res && res.code === 200 && res.data) {
                                setLoaded(res.data);
                                layui.layer.close(index);
                                layui.layer.msg('API 全局设置已保存', { icon: 1 });
                            } else {
                                layui.layer.msg((res && res.message) || '保存失败');
                            }
                        },
                        error: function (xhr) {
                            layui.layer.msg(xhr.status === 401 ? '登录状态已失效' : '保存失败，请检查网络或服务端');
                        },
                        complete: function () {
                            saving = false;
                            layero.find('.layui-layer-btn0').removeClass('layui-btn-disabled').removeAttr('aria-disabled');
                        }
                    });
                    return false; // 只有服务端保存成功时才关闭弹窗。
                }
            });
        }

        openButton.on('click', function () {
            if (opening) return;
            opening = true;
            // 点击设置前重新拉取全局状态，避免编辑到旧数据。
            loadSettings(showSettingsDialog, true);
        });
    }
    initGlobalApiSettings();

    function openReadEmailDialog() {
        const content = `
            <div style="padding:14px 20px 2px;">
                <div class="layui-form">
                    <div class="layui-form-item" style="margin-bottom:10px;">
                        <label class="layui-form-label" style="width:110px;">服务器 IP</label>
                        <div class="layui-input-block" style="margin-left:125px;display:flex;align-items:center;gap:8px;">
                            <input type="text" id="read-api-server-ip" class="layui-input"
                                style="flex:1 1 0;min-width:0;width:0;" placeholder="留空不传，默认 127.0.0.1" autocomplete="off">
                            <button type="button" class="layui-btn layui-btn-primary" id="read-api-server-ip-help"
                                style="flex:none;height:38px;line-height:36px;padding:0 12px;margin:0;">说明</button>
                        </div>
                    </div>
                    <div class="layui-form-item" style="margin-bottom:10px;">
                        <label class="layui-form-label" style="width:110px;">端口</label>
                        <div class="layui-input-block" style="margin-left:125px;">
                            <select id="read-api-port" class="layui-input" lay-ignore>
                                <option value="" selected>留空不传 默认143</option>
                                <option value="143">143 - IMAP (STARTTLS)</option>
                                <option value="993">993 - IMAP (SSL/TLS)</option>
                                <option value="110">110 - POP3</option>
                                <option value="995">995 - POP3 (SSL/TLS)</option>
                            </select>
                        </div>
                    </div>
                    <div class="layui-form-item" style="margin-bottom:10px;">
                        <label class="layui-form-label" style="width:110px;">需要密码</label>
                        <div class="layui-input-block" style="margin-left:125px;padding-top:4px;">
                            <input type="radio" name="read-api-need-password" value="1" title="需要密码" checked>
                            <input type="radio" name="read-api-need-password" value="0" title="无需密码">
                        </div>
                    </div>
                    <div class="layui-form-item" style="margin-bottom:10px;">
                        <label class="layui-form-label" style="width:110px;">读完删除</label>
                        <div class="layui-input-block" style="margin-left:125px;">
                            <select id="read-api-delete" class="layui-input" lay-ignore>
                                <option value="0" selected>不删除</option>
                                <option value="1">删除</option>
                            </select>
                        </div>
                    </div>
                    <div class="layui-form-item" style="margin-bottom:10px;">
                        <label class="layui-form-label" style="width:110px;">美化网页</label>
                        <div class="layui-input-block" style="margin-left:125px;">
                            <select id="read-api-beautify" class="layui-input" lay-ignore>
                                <option value="0" selected>不美化</option>
                                <option value="1">美化</option>
                            </select>
                        </div>
                    </div>
                    <div class="layui-form-item" id="read-api-credentials-row" style="margin-bottom:0;">
                        <label class="layui-form-label" style="width:110px;">邮箱后缀</label>
                        <div class="layui-input-block" style="margin-left:125px;">
                            <select id="read-api-credentials" class="layui-input" lay-ignore disabled>
                                <option value="1" selected>带后缀</option>
                                <option value="0">不带后缀</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>`;

        const dialogWidth = Math.min(560, Math.max(300, window.innerWidth - 24));
        const dialogIndex = layui.layer.open({
            type: 1,
            title: '读邮件 API 参数设置',
            area: [dialogWidth + 'px', 'auto'],
            maxWidth: 560,
            shadeClose: true,
            content: content,
            btn: ['生成并复制', '取消'],
            success: function (layero) {
                // 弹窗根据表单实际高度自动收缩，避免底部出现大片空白。
                // 仅在矮屏窗口限制内容区高度，以保留固定标题和操作按钮。
                layero.find('.layui-layer-content').css({
                    maxHeight: Math.max(160, window.innerHeight - 160) + 'px',
                    overflowY: 'auto',
                    overflowX: 'hidden'
                });
                layui.form.render('radio');

                // 说明按钮只展示帮助信息，不修改表单值或 API 配置。
                layero.on('click', '#read-api-server-ip-help', function () {
                    layui.layer.alert(
                        '<div style="line-height:1.8;">填写其他自建邮箱服务器的 IP 地址，可使用该服务器的邮箱账户和密码读取邮件。<br><strong>外部服务器不支持「无需密码」模式。</strong>无需密码模式仅连接本机 127.0.0.1。</div>',
                        { title: '服务器 IP 说明' }
                    );
                });

                const beautifySelect = layero.find('#read-api-beautify');
                const deleteSelect = layero.find('#read-api-delete');
                const suffixSelect = layero.find('#read-api-credentials');
                let previousBeautify = false;
                let beautifySuffixChoice = '0'; // 美化模式下默认不带后缀。
                function syncBeautifyMode() {
                    const beautify = beautifySelect.val() === '1';
                    // 始终显示邮箱后缀；不美化时必须带后缀且不可更改。
                    if (beautify) {
                        if (!previousBeautify) suffixSelect.val(beautifySuffixChoice);
                        suffixSelect.prop('disabled', false);
                        deleteSelect.val('0').prop('disabled', true); // 美化模式只读，不自动删除。
                    } else {
                        if (previousBeautify) beautifySuffixChoice = suffixSelect.val();
                        suffixSelect.val('1').prop('disabled', true);
                        deleteSelect.prop('disabled', false);
                    }
                    previousBeautify = beautify;
                }
                beautifySelect.on('change', syncBeautifyMode);
                suffixSelect.on('change', function () {
                    if (beautifySelect.val() === '1') beautifySuffixChoice = suffixSelect.val();
                });
                syncBeautifyMode();
                // 「需要密码」仍沿用 Layui 单选组件；选择无需密码则禁用服务器 IP。
                layero.on('click', '.layui-form-radio', function () {
                    setTimeout(syncPasswordMode, 0);
                });

                const ipInput = layero.find('#read-api-server-ip');

                function syncPasswordMode() {
                    const needPassword = layero.find('input[name="read-api-need-password"]:checked').val() === '1';
                    if (needPassword) {
                        ipInput.prop('disabled', false)
                            .attr('placeholder', '留空不传，默认 127.0.0.1');
                    } else {
                        ipInput.val('').prop('disabled', true)
                            .attr('placeholder', '无需密码模式固定为 127.0.0.1');
                    }
                }

                layero.find('input[name="read-api-need-password"]').on('change', syncPasswordMode);
                syncPasswordMode();
            },
            yes: function (index, layero) {
                const needPassword = layero.find('input[name="read-api-need-password"]:checked').val() === '1';
                const beautify = layero.find('#read-api-beautify').val() === '1';
                const deleteAfterRead = !beautify && layero.find('#read-api-delete').val() === '1';
                const includeCredentials = !beautify || layero.find('#read-api-credentials').val() === '1';
                const serverIp = needPassword ? $.trim(layero.find('#read-api-server-ip').val() || '') : '';
                const portText = $.trim(layero.find('#read-api-port').val() || '');

                // 后端仅支持这四个邮件端口；默认选项不发送 port 参数。
                const supportedPorts = ['143', '993', '110', '995'];
                if (portText !== '' && !supportedPorts.includes(portText)) {
                    layui.layer.msg('请选择受支持的邮件端口');
                    return;
                }
                const port = portText;

                const keyId = needPassword ? 'read_email_key' : 'read_email_key2';
                const key = document.getElementById(keyId).value;
                if (!key || key === '获取中') {
                    layui.layer.msg('API 密钥尚未加载成功，请刷新页面后重试');
                    return;
                }

                const params = new URLSearchParams();
                params.set('key', key);
                if (serverIp !== '') {
                    params.set('server_ip', serverIp);
                }
                if (port !== '') {
                    params.set('port', String(port));
                }
                if (deleteAfterRead) {
                    params.set('delete', '1');
                }
                if (beautify) {
                    params.set('beautify', '1');
                }
                // 无论选了什么可选参数，都将邮箱占位参数放在 URL 查询串最后。
                // 免密码密钥 read_email2 只需 username，不添加无效的 password 参数。
                if (includeCredentials) {
                    params.set('username', '邮箱账户');
                    if (needPassword) {
                        params.set('password', '邮箱密码');
                    }
                }

                const endpoint = needPassword ? 'read_email' : 'read_email2';
                const configuredBaseUrl = (window.parent && window.parent.baseUrl) || '/';
                const normalizedBaseUrl = configuredBaseUrl.endsWith('/')
                    ? configuredBaseUrl
                    : configuredBaseUrl + '/';
                // 邮箱账户、邮箱密码是替换占位符，保留原文；其他参数正常 URL 编码。
                const queryParts = [];
                params.forEach(function (value, key) {
                    const isPlaceholder = value === '邮箱账户' || value === '邮箱密码';
                    queryParts.push(
                        encodeURIComponent(key) + '=' +
                        (isPlaceholder ? value : encodeURIComponent(value))
                    );
                });
                const queryString = queryParts.join('&');
                const apiUrl = window.location.origin + normalizedBaseUrl
                    + 'MailApi/' + endpoint + '?' + queryString;

                copyText(apiUrl).then(function (copied) {
                    if (copied) {
                        layui.layer.msg('API 链接已复制到剪贴板', { icon: 1, time: 2200 });
                        layui.layer.close(index);
                    } else {
                        layui.layer.alert(
                            '<div style="word-break:break-all;line-height:1.7;">复制失败，请手动复制以下链接：</div>'
                            + '<textarea class="layui-textarea" readonly style="margin-top:10px;height:120px;">'
                            + $('<div>').text(apiUrl).html()
                            + '</textarea>',
                            { title: 'API 调用链接', area: ['560px', 'auto'] }
                        );
                    }
                }).catch(function () {
                    layui.layer.msg('复制失败，请重试');
                });
            }
        });
    }

    $('#read-email-api-btn').on('click', openReadEmailDialog);
})();
