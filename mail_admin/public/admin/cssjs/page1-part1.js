function deleteDomainName() {
    // 获取选中项的 ID 列表
    const selectedData = layui.table.checkStatus('ID-table-demo-search').data; 
    const ids = selectedData.map(item => item.domainid);
    
    // 检查是否选择了项
    if (ids.length === 0) {
        layer.msg('请选择至少一项进行操作', { icon: 0 });
        return;
    }

    // 格式化 ID 字符串
    const idString = ids.join(',');

    // 确认删除的提示
    layer.confirm('确定要删除选中的项吗？删除后不可恢复！！！', {
        btn: ['确定', '取消'] // 按钮
    }, function() {
        // 用户点击了“确定”按钮，准备请求数据
        const data = {
            ids: idString
        };

        // 发送删除请求
        sendRequest(window.parent.baseUrl+'domains/deleteDomainName', data);
        
        layer.msg('正在删除选中项...'); // 提示正在删除
    }, function() {
        // 用户点击了“取消”按钮
        layer.msg('删除已取消');
    });
}


  // 展示 DNS 记录建议；不自动修改 DNS。
  function showDnsRecords(domain) {
      if (!domain) return;
      var $ = layui.$;
      var width = Math.max(300, Math.min(880, window.innerWidth - 36));
      var height = Math.max(300, Math.min(680, window.innerHeight - 46));
      var content = `
        <div class="dns-guide">
          <div class="dns-guide-title">添加域名DNS解析</div>
          <div class="dns-tip">【<strong class="dns-current-domain"></strong>】域名，添加以下DNS解析记录：</div>
          <div class="dns-form-row">
            <div class="dns-form-field">
              <label for="dnsPublicIp">邮件服务器公网 IPv4</label>
              <input id="dnsPublicIp" type="text" class="layui-input" placeholder="服务器公网IP" spellcheck="false">
              <div class="dns-status" id="dnsIpStatus">正在尝试获取服务器公网 IP，可手动填写。</div>
            </div>
            <div class="dns-form-field">
              <label for="dnsSelector">DKIM 选择器（可省略）</label>
              <input id="dnsSelector" type="text" class="layui-input" value="hmail" spellcheck="false">
            </div>
            <div class="dns-form-field wide">
              <label for="dnsPublicKey">DKIM 公钥（可省略）</label>
              <textarea id="dnsPublicKey" class="layui-textarea" placeholder="请填写当前域名实际使用的 DKIM 公钥；不能复用其他域名的示例密钥" spellcheck="false"></textarea>
            </div>
          </div>
          <div class="dns-table-wrap"><table class="layui-table">
            <colgroup><col style="width:145px"><col style="width:95px"><col style="width:90px"><col></colgroup>
            <thead><tr><th>主机记录</th><th>是否必要</th><th>记录类型</th><th>记录值</th></tr></thead>
            <tbody>
              <tr><td>mail</td><td class="dns-necessary">必须</td><td class="dns-record-type">A</td><td class="dns-record-value dns-ip-value">服务器公网IP</td></tr>
              <tr><td>@</td><td class="dns-necessary">必须</td><td class="dns-record-type">MX</td><td class="dns-record-value" id="dnsMxValue"></td></tr>
              <tr><td>@</td><td class="dns-optional">可省略</td><td class="dns-record-type">A</td><td class="dns-record-value dns-ip-value">服务器公网IP</td></tr>
              <tr><td>@</td><td class="dns-optional">可省略</td><td class="dns-record-type">TXT</td><td class="dns-record-value">v=spf1 a mx ~all</td></tr>
              <tr><td>_dmarc</td><td class="dns-optional">可省略</td><td class="dns-record-type">TXT</td><td class="dns-record-value" id="dnsDmarcValue"></td></tr>
              <tr><td id="dnsDkimHost">hmail._domainkey</td><td class="dns-optional">可省略</td><td class="dns-record-type">TXT</td><td class="dns-record-value" id="dnsDkimValue">v=DKIM1;k=rsa;p=请填写实际DKIM公钥</td></tr>
            </tbody>
          </table></div>
        </div>`;
      layer.open({
          type: 1,
          title: '添加域名DNS解析',
          area: [width + 'px', height + 'px'],
          resize: false,
          shadeClose: true,
          content: content,
          success: function(layero) {
              var $root = $(layero);
              $root.find('.dns-current-domain').text(domain);
              $root.find('#dnsMxValue').text('mail.' + domain);
              $root.find('#dnsDmarcValue').text('v=DMARC1;p=quarantine;rua=mailto:admin@' + domain);

              function refreshRecords() {
                  var ip = $root.find('#dnsPublicIp').val().trim();
                  var selector = $root.find('#dnsSelector').val().trim() || 'hmail';
                  var pub = $root.find('#dnsPublicKey').val().replace(/\s+/g, '').trim();
                  $root.find('.dns-ip-value').text(ip || '服务器公网IP');
                  $root.find('#dnsDkimHost').text(selector + '._domainkey');
                  $root.find('#dnsDkimValue').text('v=DKIM1;k=rsa;p=' + (pub || '请填写实际DKIM公钥'));
              }
              $root.find('#dnsPublicIp, #dnsSelector, #dnsPublicKey').on('input', refreshRecords);
              refreshRecords();

              // 从服务器而不是浏览器检测公网 IP，避免误用访客 IP。
              $.ajax({
                  url: window.parent.baseUrl + 'domainDns/publicIp',
                  type: 'GET',
                  dataType: 'json',
                  timeout: 5000,
                  headers: { 'Token': localStorage.getItem('Token') || '' },
                  success: function(data) {
                      var ip = data && data.code === 200 && data.data && data.data.ip;
                      if (ip) {
                          if (!$root.find('#dnsPublicIp').val().trim()) {
                              $root.find('#dnsPublicIp').val(ip);
                              refreshRecords();
                          }
                          $root.find('#dnsIpStatus').text('已自动获取服务器出口 IPv4，请核对是否为邮件服务公网 IP。');
                      } else {
                          $root.find('#dnsIpStatus').text('未能获取公网 IP，请手动填写，或保留“服务器公网IP”。');
                      }
                  },
                  error: function(xhr) {
                      if (xhr.status === 401 && window.adminAuth) window.adminAuth.expire();
                      $root.find('#dnsIpStatus').text('未能获取公网 IP，请手动填写，或保留“服务器公网IP”。');
                  }
              });
          }
      });
  }

  // 打开生成卡密的弹出框
  function addDomainName() {
  layer.open({
    type: 1, // 页面层
    title: '添加域名',
    area: ['600px', '600px'],
    content: `
      <div style="padding: 20px;">
        <form class="layui-form" id="generateCardForm">
          <div class="layui-form-item">
            <div class="layui-input-block" style="padding-left: 0; margin-left: 0;">
              <textarea style="width: 100%; height: 450px;" name="domainname" class="layui-textarea" placeholder="请输入域名，每行一个，例如：\n1.com\n2.com\n3.com\n4.cn" spellcheck="false"></textarea>
            </div>
          </div>

          <div style="text-align: right;">
            <button type="button" class="layui-btn" onclick="confirm_addDomainName()">确认添加</button>
            <button type="button" class="layui-btn layui-btn-primary" onclick="layer.closeAll()">取 消</button>
          </div>
        </form>
      </div>
    `
  });
}



// 封装的 AJAX 请求函数，只需要 URL 和数据
function sendRequest(url, data) {
    layui.$.ajax({
        url: url,
        type: 'POST',
        data: data,
        success: function(result) {
            // 关闭所有弹窗
            layer.closeAll();
            if (result.code === 200) {
                // 请求成功，显示成功图标
                document.getElementById('btn-ss').click();
                layer.msg(result.message, { icon: 1, time: 2000 }); // 1 表示成功图标
            } else {
                // 请求失败，显示失败图标
                layer.msg(result.message, { icon: 2, time: 2000 }); // 2 表示失败图标
            }
        },
        error: function(xhr, status, error) {
            // 请求失败，显示错误图标
            layer.closeAll();
            layer.msg("请求失败，请重试", { icon: 2, time: 2000 }); // 2 表示失败图标
        },
    });
}



function confirm_addDomainName() {
    // 创建要发送的请求参数
    const params = {
        domain_name: layui.jquery('textarea[name="domainname"]').val()
    };

    // 调用封装的 sendRequest 方法
    sendRequest(
        window.parent.baseUrl + 'domains/addDomainName', // 请求 URL
        params // 请求参数
    );
}
