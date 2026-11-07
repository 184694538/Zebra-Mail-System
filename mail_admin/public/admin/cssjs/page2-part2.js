layui.use(function () {
      var table = layui.table;
      var form = layui.form;
      var laydate = layui.laydate;

      // 定义一个函数来加载表格
      function loadTable() {
        // 创建表格实例
        table.render({
          elem: '#ID-table-demo-search',
          toolbar: '#toolbarDemo',
          totalRow: true,
          page: true,
          // 不设置 height：表格随数据自然增高，由业务页面统一纵向滚动。
          css: [ // 重设当前表格样式
            '.layui-table-tool-temp{padding-right: 145px;}'
          ].join(''),
          defaultToolbar: ['filter', {
            title: '导出数据',
            layEvent: 'LAYTABLE_EXPORT',
            icon: 'layui-icon-export'
          }],
          limits: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000],
          limit: 10,
          url: window.parent.baseUrl + 'Accounts/queryAccounts', // 实际接口地址
          method: 'post', // 设置请求方法为 POST
          response: {
            statusName: 'code',
            statusCode: 200
          },
          cols: [[
            { type: 'checkbox', fixed: 'left' },
            { field: 'accountid', fixed: 'left', width: 100, title: 'ID', sort: true },
            { field: 'accountaddress', Minwidth: 200, title: '邮箱账户', sort: true },
            { field: 'accountpassword_plain', minWidth: 200, title: '邮箱密码', sort: true, templet: function (row) {
              return row.accountpassword_plain == null ? '<span style="color:#888">未保存</span>' : layui.util.escape(String(row.accountpassword_plain));
            } },
            { field: 'accountlastlogontime', Minwidth: 200, title: '最近登录时间', sort: true },
            { field: 'accountvacationexpiredate', Minwidth: 200, title: '创建时间', sort: true },
          ]],
          done: function (res) {
            if (res.code === 401) { // 检查是否为 401 状态码
              layer.msg('未登录，请先登录', { icon: 5, time: 1500 }, function () {
                window.top.location.href = '/admin/login';
              });
            }
          }
        });
      }

      // 直接加载表格
      loadTable();

      // 表格工具条事件处理
      table.on('toolbar(ID-table-demo-search)', function (obj) {
        if (obj.event === 'LAYTABLE_EXPORT') {
          // 提示选择导出格式
          layer.confirm('导出选择', { // 修改标题为“导出选择”
            btn: ['导出为 XLSX', '导出为 CSV', '取消'] // 按钮
          }, function () {
            // 导出为 XLSX
            var checkStatus = table.checkStatus('ID-table-demo-search'); // 获取当前选中数据的状态
            var data = checkStatus.data; // 获取选中行数据
            if (data.length === 0) { // 检查选中数据是否为空
              layer.msg('没有选中数据可导出', { icon: 5 }); // 提示信息
              return; // 终止导出操作
            }
            table.exportFile('ID-table-demo-search', data, 'xls', {
              title: '导出数据' // 自定义导出标题
            });
            layer.closeAll(); // 关闭弹窗
          }, function () {
            // 导出为 CSV
            var checkStatus = table.checkStatus('ID-table-demo-search'); // 获取当前选中数据的状态
            var data = checkStatus.data; // 获取选中行数据
            if (data.length === 0) { // 检查选中数据是否为空
              layer.msg('没有选中数据可导出', { icon: 5 }); // 提示信息
              return; // 终止导出操作
            }
            table.exportFile('ID-table-demo-search', data, 'csv', {
              title: '导出数据' // 自定义导出标题
            });
            layer.closeAll(); // 关闭弹窗
          });
        }
      });

      // 搜索提交
      form.on('submit(demo-table-search)', function (data) {
        console.log(data.field); // 获取表单数据
        table.reload('ID-table-demo-search', {
          where: data.field // 重新加载表格
        });
        return false; // 阻止表单提交
      });
    });
