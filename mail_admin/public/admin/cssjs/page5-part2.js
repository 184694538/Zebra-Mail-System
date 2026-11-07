layui.use(['jquery', 'layer'], function () {
        var $ = layui.$;
        var layer = layui.layer;
        
        // 重置密钥方法
        function resetKey(Keymap) {
            // 显示加载提示
            var index = layer.load(1, {shade: [0.1, '#fff']}); // 1 为加载样式
        
            // 发送请求重置密钥
            $.ajax({
                url:  window.parent.baseUrl + 'admin/resetKey',  // 后端处理的 URL
                method: 'POST',
                data: {Keymap: Keymap},
                success: function (response) {
                    // 关闭加载提示
                    layer.close(index);
                    // 判断请求是否成功
                    if (response.code === 200) {
                        // 更新对应的输入框值
                        $('#' + Keymap).val(response.data.newKey);
                        // 弹出成功提示
                        layer.msg('密钥已重置成功');
                    } else {
                        // 弹出失败提示
                        layer.msg(response.message || '重置失败');
                    }
                },
                error: function () {
                    // 请求失败
                    layer.close(index);
                    layer.msg('网络错误，请稍后再试');
                }
            });
        }
        
        // 绑定所有按钮的点击事件
        $('.read_key-btn').each(function () {
            var btn = $(this);
            var keymap = btn.attr('name'); // 获取对应的密钥 Keymap
            btn.on('click', function () {
                resetKey(keymap);
            });
        });
        });
