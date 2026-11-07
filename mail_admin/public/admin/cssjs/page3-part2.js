layui.use(function() {
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
              url: window.parent.baseUrl + 'Accounts/queryRecord', // 实际接口地址 Accounts/queryRecord
              method: 'post', // 设置请求方法为 POST
              response: {
                  statusName: 'code',  
                  statusCode: 200
              },
              cols: [[
              { type: 'checkbox', fixed: 'left' },
                  { field: 'date', fixed: 'left', width: 300, title: '添加时间', sort: true },
                  { field: 'count', width: 200, title: '数量', sort: true },
                  {
                      title: '操作',
                      Minwidth: 200,
                      align: 'center',
                      toolbar: '#actionBtns' // 操作按钮的模板
                  }
              ]],
              done: function(res) {
                  if (res.code === 401) { // 检查是否为 401 状态码
                      layer.msg('未登录，请先登录', { icon: 5, time: 1500 }, function() {
                          window.top.location.href = '/admin/login';
                      });
                  }
              }
          });
      }
  
      // 直接加载表格
      loadTable();
  
      // 表格工具条事件处理
      table.on('toolbar(ID-table-demo-search)', function(obj) {
          var checkStatus = table.checkStatus('ID-table-demo-search'); 
          var data = checkStatus.data;  // 获取选中的数据
  
          // 导出数据（导出为 XLSX 和 CSV）
          if (obj.event === 'LAYTABLE_EXPORT') {
              // 提示选择导出格式
              layer.confirm('导出选择', { // 修改标题为“导出选择”
                  btn: ['导出为 XLSX', '导出为 CSV', '取消'] // 按钮
              }, function() {
                  // 导出为 XLSX
                  if (data.length === 0) {
                      layer.msg('没有选中数据可导出', { icon: 5 });
                      return;
                  }
                  table.exportFile('ID-table-demo-search', data, 'xls', {
                      title: '导出数据'
                  });
                  layer.closeAll(); // 关闭弹窗
              }, function() {
                  // 导出为 CSV
                  if (data.length === 0) {
                      layer.msg('没有选中数据可导出', { icon: 5 });
                      return;
                  }
                  table.exportFile('ID-table-demo-search', data, 'csv', {
                      title: '导出数据'
                  });
                  layer.closeAll(); // 关闭弹窗
              });
          }
         
      });
  
//行操作事件
      table.on('tool(ID-table-demo-search)', function(obj) {
  var data = obj.data; // 获取当前行数据
  var event = obj.event; // 获取事件类型
  var accountvacationexpiredate = data.date;
  if (event === 'copy1') {
    // 复制数据到剪贴板
    layui.$.ajax({
      url: window.parent.baseUrl +'Accounts/queryaccountvacationexpiredate',
      method: 'POST',
      data: { accountvacationexpiredate: accountvacationexpiredate }, 
      success: function(res) {
        if (res.code === 200) {
          var text = res.data; // 获取接口返回的 data 数据
          navigator.clipboard.writeText(text).then(function() {
            layer.msg('数据已复制到剪贴板', { icon: 1 });
          }).catch(function(err) {
            console.error('复制失败:', err);
            layer.msg('复制失败', { icon: 5 });
          });
        } else {
          layer.msg('复制失败', { icon: 5 });
        }
      }
    });
  }

  if (event === 'export1') {
    // 导出数据逻辑
    layui.$.ajax({
      url: window.parent.baseUrl+'Accounts/queryaccountvacationexpiredate',
      method: 'POST',
      data: { accountvacationexpiredate: accountvacationexpiredate }, 
      success: function(res) {
        if (res.code === 200) {
          var text = res.data; // 获取接口返回的 data 数据
          var blob = new Blob([text], { type: 'text/plain' });
          var link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = '导出邮箱.txt';
          link.click();
        } else {
          layer.msg('导出失败', { icon: 5 });
        }
      }
    });
  }
});





      // 搜索提交
      form.on('submit(demo-table-search)', function(data) {
          //console.log(data.field); // 获取表单数据
          table.reload('ID-table-demo-search', {
              where: data.field // 重新加载表格
          });
          return false; // 阻止表单提交
      });
  });
