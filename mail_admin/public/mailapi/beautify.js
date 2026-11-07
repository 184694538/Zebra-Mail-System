/* 斑马邮箱读邮件 API 美化只读页面：切换已加载的最近邮件，不调用任何写操作。 */
(function () {
  'use strict';
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-mail-index]'));
  var panels = Array.prototype.slice.call(document.querySelectorAll('[data-mail-panel]'));
  function showMail(index) {
    buttons.forEach(function (button) {
      var active = Number(button.getAttribute('data-mail-index')) === index;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    panels.forEach(function (panel) {
      panel.hidden = Number(panel.getAttribute('data-mail-panel')) !== index;
    });
    var reader = document.querySelector('.mail-reader');
    if (reader) {
      reader.scrollTop = 0;
      if (window.innerWidth <= 760 && reader.scrollIntoView) {
        reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      showMail(Number(button.getAttribute('data-mail-index')));
    });
  });
})();
