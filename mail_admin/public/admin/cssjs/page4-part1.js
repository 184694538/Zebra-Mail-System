layui.use(['layer', 'jquery'], function() {
            var layer = layui.layer;    // 引入 layui 的 layer 模块
            var $ = layui.jquery;       // 使用 layui 内部的 jq 代替 $
    
            // 封装 Token 校验与数据请求函数
            function checkTokenAndFetchData(token, successCallback) {
                if (token) {
                    layui.$.ajax({
                        url: window.parent.baseUrl + 'admin/tokenValidityCheck', // API 请求地址
                        type: 'POST', // 请求方式
                        contentType: 'application/json', // 设置请求头类型
                        dataType: 'json', // 期望的返回数据类型
                        data: JSON.stringify({}), // 请求体，按实际需求填写参数
                        success: function(data) {
                            if (data.status) {
                                if (typeof successCallback === 'function') {
                                    successCallback(data);  // 执行回调函数
                                }
                            } else {
                                // Token 无效，跳转到登录页面
                                layer.alert('Token 无效，请重新登录', { icon: 2, title: '错误' }, function() {
                                    window.top.location.href = '/admin/login';
                                });
                            }
                        },
                        error: function(xhr, status, error) {
                            layer.alert('请求失败，请稍后重试', { icon: 2, title: '错误' });
                        }
                    });
                } else {
                    // 如果 Token 不存在，跳转到登录页面
                    window.top.location.href = '/admin/login';
                }
            }
    
            // 从 localStorage 中获取 Token
            const token = localStorage.getItem('Token');
    
            // 如果 Token 存在，则进行 API 请求并刷新数据
            checkTokenAndFetchData(token, function(data) {
                $('#admin-account').val(data.username);
                $('#expiration-time').val(data.expiration_time);
                $('#domain-count').val(data.domainCount);
                $('#email-count').val(data.emailCount);
                $('#main-email').val(data.mainEmail);
            });
    
            // 设置按钮点击事件，修改镜像邮箱
            $('#set-btn').on('click', function() {
                layer.prompt({
                    formType: 0, // 单行文本输入
                    title: '请输入镜像邮箱地址（输入 -1 取消镜像邮箱）',
                    value: '', // 默认值
                }, function(mailbox, index) {
                    layer.close(index); // 关闭输入框
    
                    // 发送 AJAX 请求修改镜像邮箱
                    $.ajax({
                        url: window.parent.baseUrl + 'admin/home_mailbox',
                        type: 'POST',
                        data: {
                            mailbox: mailbox
                        },
                        success: function(res) {
                            if (res.code === 200) {
                                layer.alert('镜像邮箱设置成功，需要重启邮局服务后生效。', { icon: 1, title: '设置成功' });
                                // 修改成功后刷新页面数据
                                checkTokenAndFetchData(localStorage.getItem('Token'), function(data) {
                                    $('#admin-account').val(data.username);
                                    $('#expiration-time').val(data.expiration_time);
                                    $('#domain-count').val(data.domainCount);
                                    $('#email-count').val(data.emailCount);
                                    $('#main-email').val(data.mainEmail);
                                });
                            } else {
                                layer.msg(res.message, { icon: 2, time: 2000 }); // 失败图标
                            }
                        },
                        error: function() {
                            layer.msg("请求失败，请稍后重试", { icon: 2, time: 2000 });
                        }
                    });
                });
            });
    
            // 使用教程仅展示联系提示，不再跳转外部网站。
            $('#tutorial-btn').on('click', function() {
                layer.alert('请联系QQ 184694538 获取教程', { title: '使用教程', icon: 0 });
            });


             // 监听按钮点击事件
    $('#qkyx-btn').on('click', function() {
        layer.confirm('确定要清空所有邮件吗？该操作不可恢复！', { icon: 3, title: '警告' }, function(index) {
            // 发送 AJAX 请求调用后端方法
            $.ajax({
                url:  window.parent.baseUrl  + 'Accounts/deleteAllEmails', // 后端接口地址
                method: 'GET',
                success: function(response) {
                    if (response.code === 200) {
                        layer.msg('邮件清空成功！', { icon: 1, time: 2000 });
                    } else {
                        layer.msg('清空失败：' + response.message, { icon: 2, time: 3000 });
                    }
                },
                error: function() {
                    layer.msg('请求失败，请检查网络或联系管理员！', { icon: 2, time: 3000 });
                }
            });

            layer.close(index); // 关闭确认框
        });
    });




        });

// 服务器诊断与服务重初始化：追加功能不改变原来的管理员/邮箱操作。
layui.use(['layer', 'jquery'], function () {
    'use strict';
    const layer = layui.layer;
    const $ = layui.jquery;
    const baseUrl = (window.parent && window.parent.baseUrl) || '/index.php/';
    const ports = [25, 110, 143, 993, 995, 587, 465];
    const dialog = document.getElementById('port-status-dialog');
    let generation = 0;
    let running = false;

    function adminPost(endpoint, data) {
        return $.ajax({
            url: baseUrl + endpoint,
            method: 'POST',
            dataType: 'json',
            timeout: 13000,
            data: data || {},
            headers: { Token: localStorage.getItem('Token') || '' }
        });
    }
    function setPortState(port, column, text, state) {
        const el = document.getElementById(`port-${port}-${column}`);
        if (!el) return;
        el.textContent = text;
        el.className = 'port-state ' + (state || '');
    }
    async function pollPort(port, requestId, thisRun) {
        for (let attempt = 0; attempt < 5; attempt++) {
            if (thisRun !== generation || !dialog.open) return;
            await new Promise(resolve => setTimeout(resolve, 1600 + attempt * 400));
            if (thisRun !== generation || !dialog.open) return;
            try {
                const res = await adminPost('admin/publicPortCheck', { port, mode: 'result', request_id: requestId });
                if (thisRun !== generation || !dialog.open) return;
                if (res.code !== 200) {
                    setPortState(port, 'public', res.message || '检测失败', '');
                    return;
                }
                const result = res.data || {};
                if (result.state === 'open') {
                    setPortState(port, 'public', '公网可达 · ' + result.success_nodes + ' 节点', 'open');
                    return;
                }
                if (result.state === 'closed') {
                    setPortState(port, 'public', '公网不可达 · ' + result.failed_nodes + ' 节点', 'closed');
                    return;
                }
                setPortState(port, 'public', '检测节点响应中…', 'pending');
            } catch (_) {
                if (thisRun !== generation || !dialog.open) return;
                if (attempt >= 4) setPortState(port, 'public', '检测服务无响应', '');
            }
        }
        if (thisRun === generation && dialog.open) setPortState(port, 'public', '检测超时 / 未知', '');
    }
    async function checkPublicPort(port, thisRun) {
        try {
            const res = await adminPost('admin/publicPortCheck', { port, mode: 'start' });
            if (thisRun !== generation || !dialog.open) return;
            if (res.code !== 200 || !res.data || !res.data.request_id) {
                setPortState(port, 'public', res.message || '无法提交检测', '');
                return;
            }
            setPortState(port, 'public', '正在远程检测…', 'pending');
            await pollPort(port, res.data.request_id, thisRun);
        } catch (_) {
            if (thisRun === generation && dialog.open) setPortState(port, 'public', '外部检测不可用', '');
        }
    }
    async function runPortCheck() {
        if (running) return;
        running = true;
        const thisRun = ++generation;
        const recheck = document.getElementById('port-recheck-btn');
        recheck.disabled = true;
        const rows = document.getElementById('port-check-rows');
        rows.replaceChildren();
        for (const port of ports) {
            const row = document.createElement('tr');
            row.innerHTML = '<td>' + port + '</td><td></td><td><span class="port-state pending" id="port-' + port + '-local">检测中…</span></td><td><span class="port-state pending" id="port-' + port + '-public">排队中…</span></td>';
            rows.appendChild(row);
        }
        document.getElementById('port-public-ip').textContent = '正在获取…';
        document.getElementById('port-check-time').textContent = '正在检测…';
        try {
            const res = await adminPost('admin/serverNetworkInfo');
            if (thisRun !== generation || !dialog.open) return;
            if (res.code !== 200 || !res.data) throw new Error(res.message || '无法读取服务器信息');
            const info = res.data;
            document.getElementById('port-public-ip').textContent = info.public_ip || '无法获取，请配置 public_ip';
            (info.ports || []).forEach(item => {
                const row = document.getElementById(`port-${item.port}-local`);
                if (row) {
                    row.closest('tr').children[1].textContent = item.service;
                    setPortState(item.port, 'local', item.local ? '可连接' : '未监听 / 不可连', item.local ? 'open' : 'closed');
                }
            });
            if (!info.public_probe_available) {
                ports.forEach(port => setPortState(port, 'public', '缺少公网 IP', ''));
            } else {
                await Promise.all(ports.map(port => checkPublicPort(port, thisRun)));
            }
            if (thisRun === generation && dialog.open) {
                document.getElementById('port-check-time').textContent = '检测结束 · ' + new Date().toLocaleTimeString();
            }
        } catch (error) {
            if (thisRun === generation && dialog.open) {
                ports.forEach(port => setPortState(port, 'public', '检测失败', ''));
                document.getElementById('port-public-ip').textContent = '获取失败';
                document.getElementById('port-check-time').textContent = error.message || '无法连接后台';
            }
        } finally {
            if (thisRun === generation) {
                running = false;
                recheck.disabled = false;
            }
        }
    }
    $('#port-check-btn').on('click', function () {
        if (!dialog.open) dialog.showModal();
        runPortCheck();
    });
    $('#port-recheck-btn').on('click', runPortCheck);
    $('#port-dialog-close').on('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { generation++; running = false; });

    $('#restart-service-btn').on('click', function () {
        layer.confirm('确定重新初始化 hMailServer 邮局服务吗？ SMTP / IMAP / POP3 等监听将短暂中断，当前连接可能掉线',
            { icon: 3, title: '确认重启邮局服务' }, function (index) {
                layer.close(index);
                const button = $('#restart-service-btn');
                button.prop('disabled', true).text('正在重启…');
                $.ajax({
                    url: baseUrl + 'HmailConsole/gateway',
                    type: 'POST',
                    headers: { Token: localStorage.getItem('Token') || '' },
                    data: JSON.stringify({ resource: 'reinitialize', method: 'POST', confirm: 'REINITIALIZE' }),
                    contentType: 'application/json',
                    dataType: 'json',
                    timeout: 18000
                }).done(function (response) {
                    if (response.code === 200) {
                        layer.msg('重初始化指令已提交，邮局服务正在重新加载。', { icon: 1, time: 3500 });
                    } else {
                        layer.alert(response.message || 'API 操作失败', { icon: 2, title: '重启失败' });
                    }
                }).fail(function () {
                    layer.alert('API 请求中断。服务可能正在重初始化，请稍后检查 25/143/587 端口。', { icon: 0, title: '状态待确认' });
                }).always(function () { button.prop('disabled', false).text('重启服务'); });
            });
    });
});

// Webmail 自助修改密码：Admin 专用开关，状态持久化在服务端 JSON 配置。
layui.use(['jquery', 'layer'], function () {
    'use strict';
    const $ = layui.jquery;
    const layer = layui.layer;
    const btn = document.getElementById('mail-password-toggle-btn');
    const stateLabel = document.getElementById('mail-password-toggle-state');
    const baseUrl = (window.parent && window.parent.baseUrl) || '/index.php/';
    let enabled = false;
    let loaded = false;
    function request(endpoint, data) {
        return $.ajax({
            url: baseUrl + 'admin/' + endpoint,
            type: 'POST',
            data: data || {},
            dataType: 'json',
            headers: { Token: localStorage.getItem('Token') || '' },
            timeout: 10000
        });
    }
    function render() {
        btn.disabled = !loaded;
        btn.textContent = !loaded ? '加载中' : enabled ? '关闭改密' : '开启改密';
        stateLabel.value = !loaded ? '读取失败' : enabled ? '启用' : '关闭';
        btn.className = enabled ? 'layui-btn layui-btn-sm layui-btn-danger' : 'layui-btn layui-btn-sm layui-btn-normal';
    }
    async function refresh() {
        try {
            const response = await request('getWebmailPasswordSetting');
            if (response.code !== 200) throw new Error(response.message || '读取失败');
            enabled = response.data?.enabled === true;
            loaded = true;
        } catch (error) {
            loaded = false;
            layer.msg(error.message || '无法读取功能开关', {icon: 2});
        }
        render();
    }
    btn.addEventListener('click', function () {
        if (!loaded || btn.disabled) return;
        const next = !enabled;
        layer.confirm(next ? '确认开启 斑马邮箱用户自助修改密码吗？' : '确认关闭 斑马邮箱用户自助修改密码吗？', {title: '斑马邮箱功能设置'}, async function (index) {
            layer.close(index);
            btn.disabled = true;
            try {
                const response = await request('setWebmailPasswordSetting', {enabled: next ? '1' : '0'});
                if (response.code !== 200) throw new Error(response.message || '保存失败');
                enabled = response.data?.enabled === true;
                layer.msg(response.message, {icon: 1});
            } catch (error) {
                layer.msg(error.message || '保存失败', {icon: 2, time: 3300});
            } finally { render(); }
        });
    });
    refresh();
});
