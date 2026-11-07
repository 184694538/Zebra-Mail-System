function addRandomMail() {
  layer.open({
    type: 1,
    skin: 'batch-mail-layer',
    title: '添加邮箱账户(自动生成批量)',
    area: [window.innerWidth < 720 ? '96vw' : '680px', Math.min(600, window.innerHeight - 32) + 'px'],
    content: `
      <div class="batch-mail-body">
        <form class="layui-form layui-form-pane" id="generateCardForm" lay-filter="batchMailboxForm">
          <div class="layui-form-item">
            <label class="layui-form-label">选择域名：</label>
            <div class="layui-input-block">
              <select id="domainPicker" lay-filter="batchDomainPicker" lay-search>
                <option value="">请选择已有域名（也可在下方输入）</option>
              </select>
            </div>
          </div>
          <div class="layui-form-item">
            <label for="domains" class="layui-form-label">域名：</label>
            <div class="layui-input-block">
              <input type="text" id="domains" name="domains" placeholder="可手动输入，多个域名用英文逗号隔开" class="layui-input" autocomplete="off">
              <div class="layui-form-mid layui-word-aux" style="float:none; padding:5px 0 0!important; line-height:1.5;">从下拉框选择会自动填入，也可以直接修改。</div>
            </div>
          </div>
          <div class="layui-form-item">
            <label for="count" class="layui-form-label">生成数量：</label>
            <div class="layui-input-block">
              <input type="number" id="count" name="count" placeholder="每个域名的生成数量" class="layui-input" min="1">
            </div>
          </div>
          <div class="layui-form-item">
            <label for="emailFormat" class="layui-form-label">邮箱格式：</label>
            <div class="layui-input-block">
              <select id="emailFormat" name="emailFormat">
                <option value="1">8位数字</option>
                <option value="2">8位小写字母</option>
                <option value="3" selected>8位数字+小写字母</option>
              </select>
            </div>
          </div>
          <div class="layui-form-item">
            <label for="passwordFormat" class="layui-form-label">密码格式：</label>
            <div class="layui-input-block">
              <select id="passwordFormat" name="passwordFormat" lay-filter="batchPasswordFormat">
                <option value="1">8位数字</option>
                <option value="2">8位小写字母</option>
                <option value="3" selected>8位数字+小写字母</option>
                <option value="fixed">固定密码（手动输入）</option>
              </select>
            </div>
          </div>
          <div class="layui-form-item" id="fixedPasswordGroup" style="display:none;">
            <label for="fixedPassword" class="layui-form-label">固定密码：</label>
            <div class="layui-input-block">
              <input type="password" id="fixedPassword" name="fixedPassword" class="layui-input" placeholder="请输入至少 8 位密码" autocomplete="new-password">
              <div class="layui-form-mid layui-word-aux" style="float:none; padding:5px 0 0!important; line-height:1.5;">本次生成的所有邮箱将使用相同密码。</div>
            </div>
          </div>
          <div class="batch-mail-actions">
            <button type="button" class="layui-btn" onclick="confirm_addRandomMail()">确认添加</button>
            <button type="button" class="layui-btn layui-btn-primary" onclick="layer.closeAll()">取 消</button>
          </div>
        </form>
      </div>
    `,
    success: function() {
      layui.form.render('select', 'batchMailboxForm');
      layui.form.on('select(batchDomainPicker)', function(data) {
        if (data.value) layui.jquery('#domains').val(data.value);
      });
      layui.form.on('select(batchPasswordFormat)', function(data) {
        layui.jquery('#fixedPasswordGroup').toggle(data.value === 'fixed');
      });
      // 使用现有域名查询接口填充选项，仍允许直接手动输入。
      layui.$.ajax({
        url: window.parent.baseUrl + 'domains/queryDomainName',
        type: 'POST',
        data: { page: 1, limit: 5000, order_type: 'asc' },
        success: function(res) {
          if (res.code !== 200 || !Array.isArray(res.data)) return;
          const select = layui.jquery('#domainPicker');
          res.data.forEach(function(item) {
            if (item.domainname) select.append(new Option(item.domainname, item.domainname));
          });
          layui.form.render('select', 'batchMailboxForm');
        }
      });
    }
  });
}

function confirm_addRandomMail() {
  const passwordFormat = layui.jquery('#passwordFormat').val();
  const fixedPassword = layui.jquery('#fixedPassword').val();
  const domains = layui.jquery('#domains').val().trim();
  if (!domains) return layer.msg('请选择或输入域名', {icon: 2});
  if (passwordFormat === 'fixed' && fixedPassword.length < 8) {
    return layer.msg('固定密码至少需要 8 个字符', {icon: 2});
  }

  const params = {
    domains: domains,
    total: layui.jquery('#count').val(),
    account_format: layui.jquery('#emailFormat').val(),
    password_format: passwordFormat
  };
  if (passwordFormat === 'fixed') params.fixed_password = fixedPassword;

  layer.msg('邮箱生成中，请稍后...(若数据量太大可等几分钟刷新)', {
    icon: 16, shade: [0.5, '#000'], time: 0
  });
  layui.$.ajax({
    url: window.parent.baseUrl + 'Accounts/addRandomMail',
    type: 'POST',
    data: params,
    success: function(result) {
      layer.closeAll();
      if (result.code === 200) {
        document.getElementById('btn-ss').click();
        layer.msg(result.message, { icon: 1, time: 2000 });
      } else {
        layer.msg(result.message, { icon: 2, time: 2000 });
      }
    },
    error: function() {
      layer.closeAll();
      document.getElementById('btn-ss').click();
      layer.msg('请求失败，请重试 (若数据量太大可等几分钟刷新)', {icon: 2, time: 2000});
    }
  });
}


  // 打开添加邮箱的弹出框
  function addmail() {
  layer.open({
    type: 1, // 页面层
    title: '添加邮箱账户',
    area: ['600px', '600px'],
    content: `
      <div style="padding: 20px;">
        <form class="layui-form" id="generateCardForm">
          <div class="layui-form-item">
            <div class="layui-input-block" style="padding-left: 0; margin-left: 0;">
              <textarea style="width: 100%; height: 450px;" name="accountPassword" class="layui-textarea" placeholder="请输入邮箱账户密码，每行一个，例如：\n1@1.com----12345678\n2@1.com----XX345678\n3@3.com----xxx45678\n4@1.cn----xxxx5678" spellcheck="false"></textarea>
            </div>
          </div>

          <div style="text-align: right;">
            <button type="button" class="layui-btn" onclick="confirm_addmail()">确认添加</button>
            <button type="button" class="layui-btn layui-btn-primary" onclick="layer.closeAll()">取 消</button>
          </div>
        </form>
      </div>
    `
  });
}

function confirm_addmail() {
      // 显示执行中弹窗，并且加上自定义文本
      layer.msg(1, {
    icon: 16,              // 设置图标为加载图标
    shade: [0.5, '#000'],  // 设置遮罩背景
    content: '邮箱生成中，请稍后...(若数据量太大可等几分钟刷新)',  // 显示文本
    time: 0  // 设置加载动画不自动关闭
  });

    // 创建要发送的请求参数
    const params = {
        accountPassword: layui.jquery('textarea[name="accountPassword"]').val()
    };

    // 直接发送请求
    layui.$.ajax({
        url: window.parent.baseUrl + 'Accounts/addmail', // 请求 URL
        type: 'POST',
        data: params,
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
            document.getElementById('btn-ss').click();
            layer.msg("请求失败，请重试 (若数据量太大可等几分钟刷新)", { icon: 2, time: 2000 }); // 2 表示失败图标
        },
    });
}


function deleteCreationTime() {

      // 显示执行中弹窗，并且加上自定义文本


    // 获取选中的行
    const checkStatus = layui.table.checkStatus('ID-table-demo-search'); // 表格 ID
    const selectedData = checkStatus.data; // 选中的数据

    if (selectedData.length === 0) {
        layer.msg("请选择要删除的记录", { icon: 2, time: 2000 });
        return;
    }

    // 提取选中行的 date 值
    const creationTimes = selectedData.map(item => item.date).join(',');

    layer.confirm('确定要删除选中的记录吗？', { icon: 3, title: '提示' }, function(index) {
        layer.close(index);

        layer.msg(1, {
    icon: 16,              // 设置图标为加载图标
    shade: [0.5, '#000'],  // 设置遮罩背景
    content: '删除中，请稍后...',  // 显示文本
    time: 0  // 设置加载动画不自动关闭
  });


        // 发送 POST 请求
        layui.$.ajax({
            url: window.parent.baseUrl + 'Accounts/deleteCreationTime', // 请求 URL
            type: 'POST',
            data: { CreationTime: creationTimes }, // 传递选中的日期
            success: function(result) {
                if (result.code === 200) {
                    document.getElementById('btn-ss').click();
                    layer.msg(result.message + " 删除邮箱数: " + result.count, { icon: 1, time: 2000 });
                } else {
                    layer.msg(result.message, { icon: 2, time: 2000 });
                }
            },
            error: function() {
                layer.msg("请求失败，请重试", { icon: 2, time: 2000 });
            }
        });
    });
}
