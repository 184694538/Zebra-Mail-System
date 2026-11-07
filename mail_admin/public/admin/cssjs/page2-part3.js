layui.use(['laydate', 'form', 'table'], function () {
      var laydate = layui.laydate;

      // 创建日期选择器，并设置精确到秒
      laydate.render({
        elem: '.demo-table-search-start',
        type: 'datetime'  // 精确到秒
      });

      laydate.render({
        elem: '.demo-table-search-end',
        type: 'datetime'  // 精确到秒
      });
    });

    // 获取当前日期的格式化函数，包括时间部分，兼容IE
    function formatDate(date, startOfDay) {
      var year = date.getFullYear();
      var month = ('0' + (date.getMonth() + 1)).slice(-2); // 月份从0开始
      var day = ('0' + date.getDate()).slice(-2);
      var time = startOfDay ? '00:00:00' : '23:59:59';
      return year + '-' + month + '-' + day + ' ' + time; // 格式化为 YYYY-MM-DD HH:mm:ss
    }

    // 获取元素的兼容性方法，不使用 querySelector
    function setDateInput(idStart, idEnd, startDate, endDate) {
      document.getElementById(idStart).value = formatDate(startDate, true);   // 开始时间 00:00:00
      document.getElementById(idEnd).value = formatDate(endDate, false);     // 结束时间 23:59:59
    }

    // 设置按钮事件，兼容IE
    document.getElementById('btn-today').onclick = function () {
      var now = new Date();
      setDateInput('start-date', 'end-date', now, now);
    };

    document.getElementById('btn-yesterday').onclick = function () {
      var yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      setDateInput('start-date', 'end-date', yesterday, yesterday);
    };

    document.getElementById('btn-7days').onclick = function () {
      var now = new Date();
      var sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      setDateInput('start-date', 'end-date', sevenDaysAgo, now);
    };

    document.getElementById('btn-30days').onclick = function () {
      var now = new Date();
      var thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      setDateInput('start-date', 'end-date', thirtyDaysAgo, now);
    };

    document.getElementById('btn-365days').onclick = function () {
      var now = new Date();
      var threeHundredSixtyFiveDaysAgo = new Date();
      threeHundredSixtyFiveDaysAgo.setDate(now.getDate() - 365);
      setDateInput('start-date', 'end-date', threeHundredSixtyFiveDaysAgo, now);
    };

    document.getElementById('btn-bxsj').onclick = function () {
      document.getElementById('start-date').value = '';
      document.getElementById('end-date').value = '';
    };
