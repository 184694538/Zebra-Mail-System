(function () {
  'use strict';
  var $;
  var table;
  var layer;
  var allBackups = [];
  var tableId = 'ID-table-demo-search';
  var base = (window.parent.baseUrl || '/').replace(/\/?$/, '/');
  var API = base + 'DatabaseBackup/';
  var TYPE_LABELS = {template:'系统模板备份',simple:'简易备份',full:'数据库全量备份'};
  var MAIL_PATH_HELP = '数据库全量备份不包含邮件正文和附件。若需恢复收件箱、发件箱等历史邮件，请另行迁移原服务器的整个 DataFolder。\n\n'
    + 'Windows 常见位置：\nC:\\ProgramData\\hMailServer\\Data\nC:\\Program Files\\hMailServer\\Data\nC:\\Program Files (x86)\\hMailServer\\Data\n\n'
    + 'Debian / Linux 常见位置：\n/var/lib/hmailserver\n\n'
    + '以上仅为参考路径。以实际 hMailServer.ini 中 [Directories] 的 DataFolder 配置为准。'
    + ' 如果数据库使用对象存储，还必须迁移对应对象存储数据。';

  // 三种备份都有说明按钮，按实际备份类型显示对应的包含范围和恢复注意事项。
  function showBackupDetails(row) {
    var lines;
    var title = TYPE_LABELS[row.type] || '备份说明';
    if (row.type === 'template') {
      lines = [
        '包含：完整数据库表结构及所选邮局系统初始化设置。',
        '不包含：域名、邮箱账户、IMAP 文件夹业务记录、邮件索引及邮件正文附件。',
        '用途：在完全空白的数据库中初始化 hMailServer。',
        '注意：恢复后应检查目标机器的 SSL 证书、监听端口、目录与相关密钥配置。'
      ];
    } else if (row.type === 'simple') {
      lines = [
        '包含：系统模板的结构及设置，另加 hm_domains、hm_accounts、hm_imapfolders 数据。',
        '不包含：hm_messages 邮件索引及邮件正文、附件文件。',
        '用途：迁移或重建域名、邮箱账户及文件夹的基础数据。',
        '注意：备份可能包含邮箱原始密码；恢复后需验证账户认证以及目标服务器的相关配置。'
      ];
    } else if (row.type === 'full') {
      lines = [
        '包含：整个 hMailServer 数据库的表结构及所有数据库记录。',
        '不包含：数据库外的实际邮件正文和附件文件。',
        '',
        MAIL_PATH_HELP
      ];
    } else {
      lines = ['无法识别的备份类型，请先校验备份文件。'];
    }
    lines.unshift('备份文件：' + row.fileName);
    layer.alert(escapeHtml(lines.join('\n')).replace(/\n/g, '<br>'), {
      title: title + ' · 说明', area: ['570px', 'auto']
    });
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function request(action, params) {
    return new Promise(function (resolve, reject) {
      $.ajax({url: API + action, type: 'POST', data: params || {}, dataType: 'json',
        // 主动发送 Token，避免浏览器缓存旧版 admin-auth.js 导致新备份接口返回 401。
        headers: {'Token': localStorage.getItem('Token') || ''},
        success: function (r) { if (Number(r.code) === 200) resolve(r.data); else reject(new Error(r.message || '请求失败')); },
        error: function (xhr) { reject(new Error(xhr.status === 401 ? '管理登录已失效' : '网络或服务器错误')); }
      });
    });
  }
  function restoreErrorMessage(error) {
    var message = String(error && error.message || '恢复备份失败');
    // 兼容尚未更新的后端返回的长错误信息，确保只显示指定的简短提示。
    if (message.indexOf('目标数据库不是完全空库') !== -1) {
      return '导入失败：目标数据库不是完全空库';
    }
    return message;
  }
  function busy(promise, success, persistentRestoreError) {
    var spinner = layer.load(1, {shade: [0.18, '#000']});
    return promise.then(function (data) { layer.close(spinner); if (success) success(data); return data; })
      .catch(function (e) {
        layer.close(spinner);
        if (persistentRestoreError) {
          layer.alert(escapeHtml(restoreErrorMessage(e)), {
            title: typeof persistentRestoreError === 'string' ? persistentRestoreError : '恢复备份失败', icon: 2, btn: ['关闭'], closeBtn: 1,
            shadeClose: false, time: 0, area: ['480px', 'auto']
          });
        } else {
          layer.msg(e.message || '操作失败', {icon: 5, time: 4000});
        }
      });
  }
  function formatSize(bytes) {
    var x = Number(bytes) || 0;
    if (x < 1024) return x + ' B';
    if (x < 1024 * 1024) return (x / 1024).toFixed(1) + ' KB';
    return (x / (1024 * 1024)).toFixed(2) + ' MB';
  }
  function renderTable() {
    var search = String($('#backupSearch').val() || '').trim().toLowerCase();
    var type = $('#backupType').val();
    var visible = allBackups.filter(function (b) {
      return (!type || b.type === type) && (!search || b.fileName.toLowerCase().indexOf(search) !== -1);
    });
    $('#backupTotal').text('共 ' + allBackups.length + ' 个备份，当前显示 ' + visible.length + ' 个');
    table.render({
      elem: '#' + tableId, id: tableId, data: visible, page: visible.length > 15, limit: 15,
      limits: [15, 30, 50, 100], toolbar: '#toolbarDemo', defaultToolbar: [],
      // 不使用视口固定高度：无数据时自动收起，避免大面积空白及内部滚动条。
      cols: [[
        {type:'checkbox', width:48},
        {field:'fileName', title:'备份文件 / 邮件迁移提示', minWidth:310, templet:function (d) {
          var html = '<div class="backup-filename">' + escapeHtml(d.fileName) + '</div>';
          if (d.type === 'full') html += '<div class="backup-warning">恢复收件箱/发件箱需另行迁移 DataFolder。Windows：C:\\ProgramData\\hMailServer\\Data（或安装目录 Data）；Debian：/var/lib/hmailserver；以实际配置为准。</div>';
          return html;
        }},
        {field:'typeName', title:'类型', width:132, templet:function(d){return escapeHtml(d.typeName);}},
        {field:'time', title:'备份时间', width:168, sort:true, templet:function(d){return escapeHtml(d.time);}},
        {field:'size', title:'大小', width:96, templet:function(d){return formatSize(d.size);}},
        {title:'操作', width:126, align:'center', templet:function(d){
          return '<div class="backup-row-actions">'
            + '<button type="button" class="layui-btn layui-btn-xs layui-btn-primary" lay-event="download">下载</button>'
            + '<button type="button" class="layui-btn layui-btn-xs layui-btn-primary" lay-event="details">说明</button>'
            + '</div>';
        }}
      ]]
    });
  }
  function queryBackup() {
    busy(request('lists'), function (files) { allBackups = Array.isArray(files) ? files : []; renderTable(); });
  }

  function openBackupUpload() {
    var maxBytes = 1024 * 1024 * 1024;
    var selectedFile = null;
    var uploading = false;
    var html = '<div class="backup-upload-dialog">'
      + '<input id="backupUploadInput" type="file" accept=".zip,application/zip" hidden>'
      + '<div id="backupUploadDrop" class="backup-upload-drop" role="button" tabindex="0">'
      + '<i class="layui-icon layui-icon-upload"></i>'
      + '<strong>点击选择 ZIP 备份，或拖拽文件到这里</strong>'
      + '<span>仅支持本系统数据库备份 ZIP</span>'
      + '</div>'
      + '<div id="backupUploadFileInfo" class="backup-upload-file-info">尚未选择文件</div>'
      + '<div class="backup-upload-progress"><div id="backupUploadProgressBar"></div></div>'
      + '<div id="backupUploadStatus" class="backup-upload-status">最大 1 GB；仍受服务器 PHP / Nginx 上传限制。上传后只保存到备份列表，不会自动恢复。</div>'
      + '<div class="backup-upload-actions"><button type="button" id="backupUploadChoose" class="layui-btn layui-btn-primary layui-btn-sm">选择文件</button>'
      + '<button type="button" id="backupUploadStart" class="layui-btn layui-btn-normal layui-btn-sm" disabled>开始上传</button></div>'
      + '</div>';

    var dialogIndex = layer.open({
      type: 1, title: '上传备份', area: ['500px', 'auto'], content: html,
      shadeClose: false, closeBtn: 1, btn: ['关闭'],
      success: function (layero) {
        var $input = layero.find('#backupUploadInput');
        var $drop = layero.find('#backupUploadDrop');
        var $info = layero.find('#backupUploadFileInfo');
        var $status = layero.find('#backupUploadStatus');
        var $progress = layero.find('#backupUploadProgressBar');
        var $start = layero.find('#backupUploadStart');

        function setStatus(message, isError) {
          $status.text(message).toggleClass('is-error', !!isError);
        }
        function selectFile(file) {
          selectedFile = null;
          $start.prop('disabled', true);
          $progress.css('width', '0%');
          if (!file) {
            $info.text('尚未选择文件');
            setStatus('请选择本系统生成的 ZIP 备份文件。', false);
            return;
          }
          if (!/\.zip$/i.test(file.name || '')) {
            $info.text('文件：' + file.name);
            setStatus('文件格式不正确，只允许 ZIP 文件。', true);
            return;
          }
          if (!file.size || file.size > maxBytes) {
            $info.text('文件：' + file.name + ' · ' + formatSize(file.size));
            setStatus(file.size > maxBytes ? '文件超过 1 GB 上传限制。' : '文件为空，请重新选择。', true);
            return;
          }
          selectedFile = file;
          $info.text('已选择：' + file.name + ' · ' + formatSize(file.size));
          setStatus('准备就绪。服务器将校验备份格式、6108 架构版本、132 张表结构及 SHA-256。', false);
          $start.prop('disabled', false);
        }

        function startUpload() {
          if (uploading) return;
          if (!selectedFile) {
            setStatus('请先选择 ZIP 备份文件。', true);
            return;
          }
          var formData = new FormData();
          formData.append('backupFile', selectedFile, selectedFile.name);
          uploading = true;
          $start.prop('disabled', true).text('上传中...');
          layero.find('#backupUploadChoose').prop('disabled', true);
          setStatus('正在上传文件，请勿关闭页面...', false);

          $.ajax({
            url: API + 'upload', type: 'POST', data: formData,
            processData: false, contentType: false, dataType: 'json',
            headers: {'Token': localStorage.getItem('Token') || ''},
            xhr: function () {
              var xhr = $.ajaxSettings.xhr();
              if (xhr.upload) xhr.upload.addEventListener('progress', function (event) {
                if (!event.lengthComputable) return;
                var percent = Math.max(0, Math.min(100, Math.round(event.loaded / event.total * 100)));
                $progress.css('width', percent + '%');
                setStatus(percent >= 100 ? '文件已上传，服务器正在校验 ZIP 内容和 SHA-256...' : '上传进度：' + percent + '%', false);
              });
              return xhr;
            },
            success: function (response) {
              if (!response || Number(response.code) !== 200) {
                uploading = false;
                $start.prop('disabled', false).text('开始上传');
                layero.find('#backupUploadChoose').prop('disabled', false);
                setStatus(response && response.message ? response.message : '备份校验失败。', true);
                return;
              }
              var result = response.data || {};
              $progress.css('width', '100%');
              layer.close(dialogIndex);
              queryBackup();
              layer.alert('备份上传并校验成功。<br><br>文件：<b>' + escapeHtml(result.fileName || '')
                + '</b><br>类型：' + escapeHtml(result.typeName || TYPE_LABELS[result.type] || '')
                + '<br>表结构：' + Number(result.tableCount || 0) + ' 张<br>文件大小：' + formatSize(result.size || 0)
                + '<br><br>文件已加入备份列表，尚未执行数据库恢复。', {title:'上传成功', icon:1, area:['480px','auto']});
            },
            error: function (xhr) {
              uploading = false;
              $start.prop('disabled', false).text('重新上传');
              layero.find('#backupUploadChoose').prop('disabled', false);
              var payload = xhr.responseJSON;
              if (!payload && xhr.responseText) {
                try { payload = JSON.parse(xhr.responseText); } catch (_) { payload = null; }
              }
              var message = payload && payload.message ? payload.message : '';
              if (xhr.status === 401) message = '管理员登录已失效，请重新登录后再上传。';
              else if (xhr.status === 413) message = '服务器拒绝上传：文件超过 Web 服务器请求大小限制。';
              else if (!message) message = '上传失败（HTTP ' + (xhr.status || 0) + '），请检查服务器上传限制和网络。';
              setStatus(message, true);
            }
          });
        }

        $drop.on('click', function () { if (!uploading) $input.trigger('click'); });
        $drop.on('keydown', function (event) {
          if (!uploading && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); $input.trigger('click'); }
        });
        $input.on('change', function () { selectFile(this.files && this.files[0]); });
        layero.find('#backupUploadChoose').on('click', function () { if (!uploading) $input.trigger('click'); });
        $start.on('click', startUpload);
        $drop.on('dragover', function (event) { event.preventDefault(); if (!uploading) $drop.addClass('is-dragover'); });
        $drop.on('dragleave', function () { $drop.removeClass('is-dragover'); });
        $drop.on('drop', function (event) {
          event.preventDefault();
          $drop.removeClass('is-dragover');
          if (uploading) return;
          var files = event.originalEvent && event.originalEvent.dataTransfer && event.originalEvent.dataTransfer.files;
          selectFile(files && files.length ? files[0] : null);
        });
      }
    });
  }

  function createBackup(type) {
    if (!TYPE_LABELS[type]) return;
    var message = '确定创建【' + TYPE_LABELS[type] + '】吗？<br>文件将保存在 ThinkPHP 项目根目录 backups/ 中，历史备份不会覆盖。'
      + '<br><b>备份可能包含邮箱原始密码等敏感信息，请妥善保护。</b>';
    if (type === 'full') message += '<br><br><b>注意：不包含邮件文件，邮件恢复时还需迁移 DataFolder。</b>';
    layer.confirm(message, {title:'创建备份', btn:['开始备份','取消'], area:['500px','auto']}, function (i) {
      layer.close(i);
      busy(request('create', {type:type}), function (r) {
        layer.msg('备份成功：' + r.fileName, {icon:1, time:3000});
        queryBackup();
        if (type === 'full') layer.alert(escapeHtml(MAIL_PATH_HELP).replace(/\n/g, '<br>'), {title:'邮件文件迁移提醒', area:['540px','auto']});
      });
    });
  }
  function getSelection() { return table.checkStatus(tableId).data || []; }
  function importSelected() {
    var items = getSelection();
    if (items.length !== 1) { layer.msg('一次只能选择一个备份进行恢复', {icon:5}); return; }
    var item = items[0];
    busy(request('verify', {fileName:item.fileName}), function (meta) {
      var help = meta.type === 'full' ? '<p style="color:#b65b19">数据库全量备份不含邮件文件，后续必须另外迁移 DataFolder。</p>' : '';
      layer.prompt({formType:0, title:'最终确认：输入 确认恢复', area:['480px','auto'], value:''}, function(value, idx) {
        if (value !== '确认恢复') { layer.msg('确认文字不一致，已取消', {icon:5}); return; }
        layer.close(idx);
        layer.confirm('<div class="backup-modal-tip"><b>' + escapeHtml(item.fileName) + '</b><br>目标数据库必须一张表也没有（空表也不允许），且目标 hMailServer 必须停止访问数据库。<br><b>不清空、不覆盖任何已有表。</b>' + help + '</div>',
          {title:'确认执行数据库恢复', btn:['确认恢复','取消'], area:['550px','auto']}, function(confirmIndex) {
            layer.close(confirmIndex);
            busy(request('restore', {fileName:item.fileName, confirm:'YES_EMPTY_DATABASE'}), function (result) {
              if (result.mailFilesPending) {
                layer.alert('数据库恢复成功，但邮件文件还未恢复。<br><br>' + escapeHtml(MAIL_PATH_HELP).replace(/\n/g, '<br>'), {title:'数据库已恢复，邮件文件待迁移',area:['570px','auto']});
              } else {
                layer.alert('恢复完成：' + result.tableCount + ' 张表，' + result.totalRows + ' 条记录。请核对 SSL 证书文件路径、端口与服务器密钥，并检查邮局服务。', {title:'恢复成功'});
              }
              queryBackup();
            }, true);
          });
      });
    }, true);
  }
  function ensurePlainPasswordColumn() {
    var message = '<div style="line-height:1.8;padding:8px 2px">'
      + '<b>将检查 hm_accounts.accountpassword_plain 字段。</b><br>'
      + '如果字段不存在，将添加 VARCHAR(255) NULL，并放在表的最后一列。<br>'
      + '如果字段已经存在，只检查结构，不会重复添加或自动移动字段。<br>'
      + '<span style="color:#c64735;font-weight:600">本操作不会回填、读取或修改现有邮箱密码，也不会修改 accountpassword 和 accountpwencryption。</span>'
      + '</div>';
    layer.confirm(message, {title:'数据库字段维护', btn:['检查并添加','取消'], area:['520px','auto']}, function(index) {
      layer.close(index);
      busy(request('ensurePlainPasswordColumn'), function(result) {
        var detail = escapeHtml(result.message || '检查完成');
        detail += '<br><br>数据表：<b>hm_accounts</b>'
          + '<br>字段：<b>accountpassword_plain</b>'
          + '<br>类型：<b>' + escapeHtml(result.type || 'VARCHAR(255)') + '</b>'
          + '<br>允许 NULL：<b>' + (result.nullable ? '是' : '否') + '</b>'
          + '<br>字段位置：<b>' + (result.isLastColumn ? '最后一列' : ('第 ' + Number(result.position || 0) + ' 列（共 ' + Number(result.totalColumns || 0) + ' 列）')) + '</b>';
        if (result.structureValid) {
          layer.alert(detail, {title:result.created ? '字段添加成功' : '字段检查完成', icon:1, btn:['关闭'], area:['500px','auto']});
        } else {
          layer.alert(detail, {title:'字段存在但结构需要检查', icon:0, btn:['关闭'], area:['500px','auto']});
        }
      }, '数据库字段维护失败');
    });
  }

  function openDatabaseCleanup() {
    // Read-only preview: same preservation list used for SIMPLE backup exports.
    busy(request('cleanupPreview'), function (plan) {
      var message = '<div class="backup-cleanup-confirm">'
        + '<div><b>保留：</b>全部 ' + Number(plan.tableCount) + ' 张表结构，以及 ' + Number(plan.preserveCount) + ' 张表的数据（系统设置、域名、账户、IMAP 文件夹）。</div>'
        + '<div><b>清空：</b>其余 ' + Number(plan.clearCount) + ' 张表，包括邮件索引、监控及其他业务记录。</div>'
        + '<div class="backup-cleanup-warning">本操作使用 TRUNCATE TABLE，不可回滚；不创建备份、不停止邮件服务，也不会删除磁盘邮件文件。</div>'
        + '<div>邮件服务持续写入可能导致新记录再次出现或业务数据不一致。</div>'
        + '<label class="backup-cleanup-check"><input id="backupCleanupAck" type="checkbox">我已知晓以上数据会被永久清空，且没有自动备份。</label>'
        + '<div>请输入 <b>确认清理</b> 后继续：</div>'
        + '<input id="backupCleanupPhrase" class="layui-input backup-cleanup-input" type="text" autocomplete="off" placeholder="确认清理">'
        + '</div>';
      layer.open({
        type:1, title:'清理数据库冗余数据', area:['590px','auto'],
        shadeClose:false, closeBtn:1, btn:['确认清理','取消'], content:message,
        yes:function(index) {
          var ack = $('#backupCleanupAck').prop('checked');
          var phrase = String($('#backupCleanupPhrase').val() || '').trim();
          if (!ack || phrase !== '确认清理') {
            layer.msg('请勾选风险确认，并输入“确认清理”', {icon:5, time:3000});
            return;
          }
          layer.close(index);
          busy(request('cleanup', {confirm:'TRUNCATE_SIMPLE_SCOPE'}), function (result) {
            var remaining = Array.isArray(result.remainingNonEmpty) ? result.remainingNonEmpty : [];
            var body = '已执行 TRUNCATE：' + Number(result.truncatedCount)
              + ' 张表；保留 ' + Number(result.preserveCount) + ' 张表数据，全部表结构保持不变。';
            if (remaining.length) {
              body += '<br><br><b>注意：以下表仍检测到记录（可能是邮件服务并发写入）：</b><br>' + escapeHtml(remaining.join('、'));
            } else {
              body += '<br><br>校验时未检测到待清空表中存在记录。';
            }
            body += '<br><br>磁盘上的邮件文件未删除。';
            layer.alert(body, {title:remaining.length ? '清理完成（存在新记录）' : '清理完成',
              icon:remaining.length ? 0 : 1, btn:['关闭'], shadeClose:false, time:0, area:['560px','auto']});
          }, '清理数据库失败');
        }
      });
    }, '清理数据库检查失败');
  }
  function deleteSelected() {
    var items = getSelection();
    if (!items.length) { layer.msg('请先勾选要删除的备份', {icon:5}); return; }
    layer.confirm('确定删除选中的 ' + items.length + ' 份备份文件吗？删除不会影响数据库，但操作不可撤销。',
      {title:'删除备份',btn:['删除','取消']}, function(i) {
        layer.close(i);
        busy(request('delete', {fileNames:JSON.stringify(items.map(function(x){return x.fileName;}))}), function () {
          layer.msg('备份文件已删除', {icon:1}); queryBackup();
        });
      });
  }
  async function downloadBackup(row) {
    var expectedSize = Number(row && row.size) || 0;
    try {
      if (!row || !row.fileName) throw new Error('备份文件信息无效');
      var url = API + 'download?fileName=' + encodeURIComponent(row.fileName) + '&_=' + Date.now();
      var r = await window.adminAuth.request(url, {
        method:'GET', cache:'no-store',
        headers:{'Token':localStorage.getItem('Token') || '', 'Cache-Control':'no-cache'}
      });
      if (!r.ok) {
        var errorText = await r.text().catch(function(){ return ''; });
        var errorMessage = '下载请求失败（HTTP ' + r.status + '）';
        try {
          var errorJson = JSON.parse(errorText);
          if (errorJson && errorJson.message) errorMessage = errorJson.message;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      var contentType = String(r.headers.get('content-type') || '').toLowerCase();
      var file = await r.blob();
      if (contentType.indexOf('application/json') !== -1 || contentType.indexOf('text/html') !== -1) {
        var responseText = await file.text();
        var responseJson = null;
        try { responseJson = JSON.parse(responseText); } catch (_) {}
        throw new Error(responseJson && responseJson.message ? responseJson.message : '服务器没有返回 ZIP 文件，请检查登录状态和下载接口');
      }
      if (!file.size) throw new Error('下载失败：服务器返回了 0 字节文件，原备份未被修改');
      if (expectedSize > 0 && file.size !== expectedSize) {
        throw new Error('下载不完整：应为 ' + formatSize(expectedSize) + '，实际收到 ' + formatSize(file.size) + '。请重试，不会保存不完整文件。');
      }

      var signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      if (signature.length < 4 || signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) {
        throw new Error('下载内容不是有效 ZIP 文件，已阻止保存');
      }

      var objectUrl = URL.createObjectURL(file);
      var a = document.createElement('a');
      a.href = objectUrl;
      a.download = row.fileName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(function(){ URL.revokeObjectURL(objectUrl); }, 60000);
    } catch (e) {
      layer.alert(escapeHtml(e.message || '下载失败'), {title:'备份下载失败', icon:2, btn:['关闭'], area:['460px','auto']});
    }
  }
  layui.use(['table','layer'], function () {
    $ = layui.$; table = layui.table; layer = layui.layer;
    $('#backupSearch').on('input', renderTable);
    $('#backupType').on('change', renderTable);
    table.on('toolbar(' + tableId + ')', function(obj) {
      if (obj.event === 'importSelected') importSelected();
      if (obj.event === 'deleteSelected') deleteSelected();
    });
    table.on('tool(' + tableId + ')', function(obj) {
      if (obj.event === 'download') downloadBackup(obj.data);
      if (obj.event === 'details') showBackupDetails(obj.data);
    });
    queryBackup();
  });
  window.queryBackup = queryBackup;
  window.openBackupUpload = openBackupUpload;
  window.createBackup = createBackup;
  window.openDatabaseCleanup = openDatabaseCleanup;
  window.ensurePlainPasswordColumn = ensurePlainPasswordColumn;
})();
