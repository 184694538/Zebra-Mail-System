// 上传备份文件
  function uploadBackup() {
    layui.use(function() {
      var upload = layui.upload;
      var $ = layui.$;

      // 弹出上传文件选择框
      layui.layer.open({
        type: 1,
        title: '上传备份文件',
        content: `
            <div style="padding: 20px;">
                <div id="ID-upload-demo-drag" class="layui-btn layui-btn-normal" style="width: 100%; text-align: center; border: 1px dashed #ccc; padding: 80px;margin-bottom: 20px;">
                  拖拽文件或点击选择文件
                </div>
                <button type="button" class="layui-btn" id="ID-upload-demo-action" disabled>开始上传</button>
                <div id="selectedFileInfo" style="margin-top: 10px; color: #666;"></div> <!-- 显示选择的文件信息 -->
                <input type="file" id="backupFileInput" style="display: none;" />
            </div>
        `,
        area: ['400px', '400px'],  // 弹窗的宽度和高度
        btn: ['关闭'],  // 关闭按钮
        success: function (layero, index) {
          var filesData = [];  // 存储选择的文件

          var uploadInstance = layui.upload.render({
            elem: '#ID-upload-demo-drag',  // 触发文件选择的区域，可以通过拖拽或点击来选择文件
            url: window.parent.baseUrl + 'Accounts/uploadBackup',  // 后端上传接口
            auto: false,  // 不自动上传
            accept: 'file',  // 只允许上传文件
            exts: 'json',  // 只允许上传 json 文件
            size: 102400000,  // 限制文件大小为 100000MB
            choose: function (obj) {
              filesData = obj.pushFile();  // 获取选择的文件列表
              var fileName = Object.keys(filesData).map(function(key) { return filesData[key].name }).join(', ');  // 获取文件名
              layui.$('#selectedFileInfo').html('已选择文件: ' + fileName);  // 显示文件名
              var uploadButton = layui.$('#ID-upload-demo-action');
              
              // 判断文件是否已选择
              if (Object.keys(filesData).length > 0) {
                uploadButton.prop('disabled', false);  // 启用上传按钮
              } else {
                uploadButton.prop('disabled', true);  // 禁用上传按钮
              }
            },
            before: function (obj) {
              // 在上传之前验证文件是否已选择
              if (!Object.keys(filesData).length) {
                layer.msg('请选择文件后再上传', { icon: 5 });
                return false;  // 阻止上传
              }
            },
            done: function (res) {
              queryBackup();
              layer.closeAll(); // 关闭弹窗
              // 上传成功后的回调
              if (res.code === 200) {
                layer.msg('上传成功', { icon: 1 });
                loadTable();  // 刷新表格
              } else {
                layer.msg(res.message || '上传失败，请重试', { icon: 5 });
              }
            },
            error: function () {
              // 上传失败后的回调
              layer.msg('上传失败，请稍后再试', { icon: 5 });
            }
          });

          // 绑定点击上传按钮事件
          layui.$('#ID-upload-demo-action').click(function() {
            if (Object.keys(filesData).length > 0) {
              uploadInstance.upload();  // 手动触发上传操作
            } else {
              layer.msg('请选择文件后再上传', { icon: 5 });  // 显示错误消息
            }
          });
        }
      });
    });
  }
