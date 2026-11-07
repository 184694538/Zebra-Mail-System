function deleteMailID() {
      // 获取选中项的 ID 列表
      const selectedData = layui.table.checkStatus('ID-table-demo-search').data;
      const ids = selectedData.map(item => item.accountid);

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
      }, function () {
        // 用户点击了“确定”按钮，准备请求数据
        const data = {
          ids: idString
        };

        // 发送删除请求
        layer.msg('正在删除选中项...'); // 提示正在删除
        sendRequest(window.parent.baseUrl + 'Accounts/deleteMailID', data);


      }, function () {
        // 用户点击了“取消”按钮
        layer.msg('删除已取消');
      });
    }


    function deleteMailCustomize() {
      // 弹出层让用户输入邮箱地址，支持多个邮箱换行输入
      layer.open({
        type: 1, // 页面层
        title: '输入邮箱删除账户',
        area: ['600px', '350px'],
        content: `
            <div style="padding: 20px;">
                <textarea id="emailInput" style="width: 100%; height: 200px;" placeholder="请输入邮箱地址，每行一个，例如：\n1@domain.com\n2@domain.com"></textarea>
            </div>
            <div style="text-align: right; margin-top: 10px;">
                <button type="button" class="layui-btn" onclick="confirmDeleteMail()">确认删除</button>
                <button type="button" class="layui-btn layui-btn-primary" onclick="layer.closeAll()">取 消</button>
            </div>
        `,
      });
    }

    // 确认删除邮箱
    function confirmDeleteMail() {


      // 获取用户输入的邮箱地址
      const emailInput = layui.jquery('#emailInput').val().trim();

      // 检查是否输入了邮箱
      if (emailInput === "") {
        layer.msg('请输入邮箱地址', { icon: 0 });
        return;
      }

      // 将输入的邮箱地址按换行分割成数组
      const mailArray = emailInput.split('\n').map(mail => mail.trim()).filter(mail => mail !== "");

      // 如果没有有效的邮箱，则返回
      if (mailArray.length === 0) {
        layer.msg('请输入有效的邮箱地址', { icon: 0 });
        return;
      }

      // 将邮箱数组传给后台进行处理
      const data = { mail: mailArray.join(',') };

      // 调用删除接口
      layer.confirm('确定要删除这些账户吗？删除后不可恢复！！！', {
        btn: ['确定', '取消'] // 按钮
      }, function () {
        // 用户点击了“确定”按钮，准备请求数据        
        layer.msg(1, {
        icon: 16,              // 设置图标为加载图标
        shade: [0.5, '#000'],  // 设置遮罩背景
        content: '删除中，请稍后...',  // 显示文本
        time: 0  // 设置加载动画不自动关闭
      });

        sendRequest(window.parent.baseUrl + 'Accounts/deleteMailCustomize', data);
      }, function () {
        // 用户点击了“取消”按钮
        layer.msg('删除已取消');
      });
    }


    function changePassword() {
    // 获取选中行的数据
    const selectedData = layui.table.checkStatus('ID-table-demo-search').data;
    const accounts = selectedData.map(item => item.accountaddress);

    // 检查是否有选中项
    if (accounts.length === 0) {
        layer.msg('请选择要修改密码的邮箱账户', { icon: 0 });
        return;
    }

    // 弹出输入框让用户输入新密码
    layer.prompt({
        formType: 1,
        title: '请输入新密码'
    }, function (value, index) {

              // 检查密码是否为空
        if (!value) {
        layer.msg('密码不能为空', { icon: 0 });
        return;
        }

        // 关闭输入框
        layer.close(index);
        const data = {
            accounts: accounts.join(','),
            password: value
        };
        // 发送请求修改密码
        sendRequest(window.parent.baseUrl + 'Accounts/changePassword', data);
    });
}

function changePasswordRandomly() {
    // 获取选中行的数据
    const selectedData = layui.table.checkStatus('ID-table-demo-search').data;
    const accounts = selectedData.map(item => item.accountaddress);

    // 检查是否有选中项
    if (accounts.length === 0) {
        layer.msg('请选择要修改密码的邮箱账户', { icon: 0 });
        return;
    }

    // 确认是否要随机修改密码
    layer.confirm('确定要为选中的邮箱账户随机修改密码吗？', {
        btn: ['确定', '取消']
    }, function () {
        const data = {
            accounts: accounts.join(','),
        };
        // 发送请求随机修改密码
        sendRequest(window.parent.baseUrl + 'Accounts/changePassword', data);
    });
}


function changePasswordRandomly2() {
    // 弹出输入框让用户输入邮箱（每行一个邮箱）
    layer.prompt({
        formType: 2, // formType 2 表示多行输入框
        title: '请输入邮箱地址（每行一个邮箱）',
        area: ['400px', '200px'] // 设置输入框的大小
    }, function (value, index) {
        // 关闭输入框
        layer.close(index);

        // 按换行符分割输入的邮箱地址，去除空格并过滤掉空行
        const accounts = value.split('\n').map(item => item.trim()).filter(item => item !== '');

        // 检查是否有有效的邮箱输入
        if (accounts.length === 0) {
            layer.msg('请输入有效的邮箱地址', { icon: 0 });
            return;
        }

        // 发送请求随机修改密码
        const data = {
            accounts: accounts.join(','),
        };
        sendRequest(window.parent.baseUrl + 'Accounts/changePassword', data);
    });
}



    // 封装的 AJAX 请求函数，只需要 URL 和数据
    function sendRequest(url, data) {
      layui.$.ajax({
        url: url,
        type: 'POST',
        data: data,
        success: function (result) {
          // 关闭所有弹窗
          layer.closeAll()
          if (result.code === 200) {
            // 请求成功，显示成功图标
            document.getElementById('btn-ss').click();
            layer.msg(result.message, { icon: 1, time: 2000 }); // 1 表示成功图标
          } else {
            // 请求失败，显示失败图标
            layer.msg(result.message, { icon: 2, time: 2000 }); // 2 表示失败图标
          }
        },
        error: function (xhr, status, error) {
          layer.msg("请求失败，请重试", { icon: 2, time: 2000 }); // 2 表示失败图标
        },
      });
    }
