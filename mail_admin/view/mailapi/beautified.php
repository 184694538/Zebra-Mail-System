<?php
/** @var array $messages */
/** @var string $mailUser */
/** @var Closure $escape */
/** @var bool $needsPassword */
/** @var string $apiKey */
/** @var string $mailServer */
/** @var int $port */
/** @var string $error */
/** @var bool $loaded */
/** @var string $formAction */
$count = count($messages);
$multi = $count > 1;
?>
<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="dark">
  <meta name="referrer" content="no-referrer">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <title>斑马邮箱.web · 收件箱</title>
  <link rel="stylesheet" href="/mailapi/beautify.css?v=20261106-switch1">
</head>
<body>
  <header class="mail-topbar">
    <div class="mail-brand"><img src="/favicon.webp" alt=""><span>斑马邮箱</span><span class="brand-sub">邮件阅读</span></div>
    <div class="mail-account" title="<?= $escape($mailUser) ?>">
      <?php if ($mailUser !== '' && $loaded && $error === ''): ?><span class="account-dot"></span><?= $escape($mailUser) ?><?php else: ?>选择邮箱<?php endif; ?>
    </div>
  </header>
  <section class="mail-switcher" aria-label="邮箱账户切换">
    <form id="switch-mail-form" class="switch-mail-form" method="post" action="<?= $escape($formAction) ?>" autocomplete="off">
      <input type="hidden" name="beautify" value="1">
      <input type="hidden" name="key" value="<?= $escape($apiKey) ?>">
      <input type="hidden" name="port" value="<?= (int) $port ?>">
      <?php if ($needsPassword): ?>
        <input type="hidden" name="server_ip" value="<?= $escape($mailServer) ?>">
      <?php endif; ?>
      <label for="switch-mail-username">邮箱账户</label>
      <input id="switch-mail-username" name="username" type="email" maxlength="254" placeholder="请输入邮箱账户" value="<?= $escape($mailUser) ?>" autocomplete="username" spellcheck="false" required>
      <?php if ($needsPassword): ?>
        <label for="switch-mail-password">邮箱密码</label>
        <input id="switch-mail-password" name="password" type="password" placeholder="请输入邮箱密码" autocomplete="off" required>
      <?php endif; ?>
      <button type="submit" class="switch-mail-submit"><?= $loaded && $error === '' ? '切换邮箱' : '查看邮件' ?></button>
    </form>
  </section>
  <div class="app-shell<?= $multi ? ' multiple' : ' single' ?>">
    <aside class="mail-sidebar">
      <div class="side-title">邮箱文件夹</div>
      <div class="side-folder active"><span class="folder-icon">✉</span><span class="folder-label">收件箱</span><span class="folder-count"><?= $count ?></span></div>
      <p class="side-help">仅供查看，邮件不会自动删除。</p>
    </aside>

    <?php if ($multi): ?>
      <section class="mail-list" aria-label="最近邮件列表">
        <div class="list-title"><div><strong>收件箱</strong><small>最近 <?= $count ?> 封邮件</small></div><span class="list-count"><?= $count ?></span></div>
        <?php foreach ($messages as $index => $message): ?>
          <button type="button" class="mail-item<?= $index === 0 ? ' active' : '' ?>" data-mail-index="<?= $index ?>" aria-pressed="<?= $index === 0 ? 'true' : 'false' ?>">
            <span class="item-line"><strong><?= $escape($message['from'] ?: '未知发件人') ?></strong><span class="item-date"><?= $escape($message['date']) ?></span></span>
            <span class="item-subject"><?= $escape($message['subject'] ?: '（无主题）') ?></span>
            <span class="item-preview"><?= $escape($message['summary'] ?: '点击查看邮件') ?></span>
          </button>
        <?php endforeach; ?>
      </section>
    <?php endif; ?>

    <main class="mail-reader" aria-label="邮件内容">
      <?php if ($count === 0): ?>
        <div class="empty-message"><span class="empty-icon">✉</span>
          <?php if ($error !== ''): ?>
            <h1>读取邮件失败</h1><p class="mail-error" role="alert"><?= $escape($error) ?></p>
          <?php elseif (!$loaded): ?>
            <h1>查看邮箱邮件</h1><p>在上方输入邮箱账户<?= $needsPassword ? '和密码' : '' ?>，即可打开收件箱。</p>
          <?php else: ?>
            <h1>收件箱暂无邮件</h1><p>当前邮箱没有可查看的邮件。</p>
          <?php endif; ?>
        </div>
      <?php else: ?>
        <?php foreach ($messages as $index => $message): ?>
          <article class="mail-detail" data-mail-panel="<?= $index ?>"<?= $index !== 0 ? ' hidden' : '' ?>>
            <div class="detail-bar"><span class="detail-breadcrumb">收件箱 <span>/</span> 阅读邮件</span><span class="readonly-pill">只读模式</span></div>
            <div class="mail-head">
              <h1><?= $escape($message['subject'] ?: '（无主题）') ?></h1>
              <div class="message-metadata">
                <div class="avatar">@</div>
                <div class="metadata-main">
                  <div><span class="meta-label">发件人</span> <strong><?= $escape($message['from'] ?: '未知发件人') ?></strong></div>
                  <div><span class="meta-label">收件人</span> <?= $escape($message['to'] ?: $mailUser) ?></div>
                </div>
                <time class="mail-date"><?= $escape($message['date']) ?></time>
              </div>
            </div>
            <div class="mail-body">
              <?php if (trim((string) $message['html']) !== ''): ?>
                <?php
                  // 沙箱隔离 HTML 邮件。无 JS、无表单、无同源权限，CSP 阻止外链资源及跟踪图片。
                  // 移除邮件内自带的 meta/base，防止自动刷新和重定向；其余内容继续由 iframe 沙箱和 CSP 隔离。
                  $safeMailMarkup = preg_replace('/<\s*(?:meta|base)\b[^>]*>/i', '', (string) $message['html']);
                  if (!is_string($safeMailMarkup)) $safeMailMarkup = '';
                  $sandboxHtml = '<!doctype html><html><head><meta charset="utf-8">'
                    . '<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; script-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data:; font-src &#39;none&#39;; connect-src &#39;none&#39;; frame-src &#39;none&#39;; form-action &#39;none&#39;; base-uri &#39;none&#39;">'
                    . '<style>html,body{background:#fff!important;color:#242e38!important;padding:0;margin:0;font:14px/1.7 Arial,Microsoft YaHei,sans-serif;overflow-wrap:anywhere}body{padding:16px}img{max-width:100%;height:auto}a{pointer-events:none!important}table{max-width:100%}</style>'
                    . '</head><body>' . $safeMailMarkup . '</body></html>';
                ?>
                <iframe class="mail-html-frame" sandbox="" referrerpolicy="no-referrer" loading="<?= $index === 0 ? 'eager' : 'lazy' ?>" title="HTML 邮件正文" srcdoc="<?= $escape($sandboxHtml) ?>"></iframe>
              <?php elseif (trim((string) $message['text']) !== ''): ?>
                <pre class="mail-text"><?= $escape($message['text']) ?></pre>
              <?php else: ?>
                <p class="mail-no-body">这封邮件没有可显示的正文。</p>
              <?php endif; ?>
              <?php if (!empty($message['attachments'])): ?>
                <div class="attachment-section">
                  <h2>附件（仅显示文件信息）</h2>
                  <?php foreach ($message['attachments'] as $attachment): ?>
                    <div class="attachment-item">📎 <?= $escape($attachment['filename']) ?><span><?= number_format((int) $attachment['size'] / 1024, 1) ?> KB</span></div>
                  <?php endforeach; ?>
                </div>
              <?php endif; ?>
            </div>
          </article>
        <?php endforeach; ?>
      <?php endif; ?>
    </main>
  </div>
  <script src="/mailapi/beautify.js?v=20261106-switch1" defer></script>
</body>
</html>
