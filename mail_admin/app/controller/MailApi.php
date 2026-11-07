<?php
namespace app\controller;
use think\facade\Db;
use think\facade\Request;
use app\service\ImapSocketClient;
use app\service\Pop3SocketClient;
use app\service\MimeParser;
use app\service\PrivateMailConfig;
use app\service\MailApiSettings;


class MailApi extends BaseController
{

    // 从配置文件中获取密钥
    private $read_email_key;
    private $read_email_key2;
    private $delete_emails_key;
    private $queryDomainName_key;

    public function __construct()
    {
        // 直接从项目根目录 config_private/mail.php 读取，不依赖 .env 或 ThinkPHP mail 配置。
        $this->read_email_key = PrivateMailConfig::get('read_email_key', '');
        $this->read_email_key2 = PrivateMailConfig::get('read_email_key2', '');
        $this->delete_emails_key = PrivateMailConfig::get('delete_emails_key', '');
        $this->queryDomainName_key = PrivateMailConfig::get('queryDomainName_key', '');
    }


    /**
     * 将邮件文本转换为 UTF-8。
     * 优先保留已经合法的 UTF-8；按常见中文编码尝试转换。
     * mbstring/iconv 均为可选扩展，缺少时不会触发未定义函数错误。
     */
    private function convert_to_utf8($string): string
    {
        $string = (string) $string;
        if ($string === '') {
            return '';
        }

        // 不依赖 mbstring 即可严格判断 UTF-8，避免正常中文被再次转码。
        if (preg_match('//u', $string) === 1) {
            return $string;
        }

        $encodings = ['GB18030', 'GBK', 'BIG5', 'Windows-1252', 'ISO-8859-1'];
        if (strncmp($string, "\xFF\xFE", 2) === 0) {
            array_unshift($encodings, 'UTF-16LE');
        } elseif (strncmp($string, "\xFE\xFF", 2) === 0) {
            array_unshift($encodings, 'UTF-16BE');
        }

        // mbstring 可用时，先严格检测再转换。
        if (function_exists('mb_detect_encoding') && function_exists('mb_convert_encoding')) {
            try {
                $detected = mb_detect_encoding($string, $encodings, true);
                if (is_string($detected) && $detected !== '') {
                    $converted = mb_convert_encoding($string, 'UTF-8', $detected);
                    if (is_string($converted) && preg_match('//u', $converted) === 1) {
                        return $converted;
                    }
                }
            } catch (\Throwable $e) {
                // 继续尝试 iconv 或保留原始内容。
            }
        }

        // iconv 是可选扩展，必须先检查函数是否存在。
        if (function_exists('iconv')) {
            foreach ($encodings as $encoding) {
                $converted = @iconv($encoding, 'UTF-8//IGNORE', $string);
                if (is_string($converted) && $converted !== '' && preg_match('//u', $converted) === 1) {
                    return $converted;
                }
            }
        }

        // 无可用转换扩展或无法可靠识别编码时保留原始字节；
        // HTML 输出使用 ENT_SUBSTITUTE，避免无效 UTF-8 破坏页面。
        return $string;
    }

    /** 对来自邮件或服务器的动态内容进行 HTML 转义。 */
    private function escapeHtml($value): string
    {
        return htmlspecialchars(
            $this->convert_to_utf8((string) $value),
            ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5,
            'UTF-8'
        );
    }

    /** 邮件正文按纯文本显示，不执行邮件中的 HTML 或脚本。 */
    private function renderEmailHtml(array $data): string
    {
        $messageNumber = (int) ($data['msg_number'] ?? 0);
        $subject = $this->escapeHtml($data['decodedSubject'] ?? '');
        $from = $this->escapeHtml($data['from'] ?? '');
        $to = $this->escapeHtml($data['to'] ?? '');
        $body = nl2br($this->escapeHtml($data['text'] ?? ''), false);

        return '<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<title>邮件获取成功</title></head><body>'
            . '<h1>邮件获取成功</h1><div>'
            . '<p><strong>ID:</strong> ' . $messageNumber . '</p>'
            . '<p><strong>主题:</strong> ' . $subject . '</p>'
            . '<p><strong>发件人:</strong> ' . $from . '</p>'
            . '<p><strong>收件人:</strong> ' . $to . '</p>'
            . '<p><strong>正文:</strong></p><div class="mail-body">' . $body . '</div>'
            . '</div></body></html>';
    }

    /**
     * 只删除指定 UID。UID EXPUNGE 属于 UIDPLUS 扩展；
     * 不支持时直接拒绝删除，不回退到会清除其他已标记邮件的 EXPUNGE。
     */
    private function deleteImapUidSafely(ImapSocketClient $mbox, int $uid): void
    {
        if ($uid < 1) {
            throw new \InvalidArgumentException('无效的邮件 UID');
        }

        $capability = $mbox->command('CAPABILITY');
        $capabilityText = strtoupper(implode(' ', $capability['lines'] ?? []));
        if (!preg_match('/\bUIDPLUS\b/', $capabilityText)) {
            throw new \RuntimeException('IMAP 服务器不支持 UIDPLUS，已取消删除以避免误删其他邮件');
        }

        $mbox->markDeleted($uid);
        $mbox->command('UID EXPUNGE ' . $uid);
    }

    // IMAP/POP3 连接函数：使用 PHP Socket，不依赖 ext-imap。
    private function imapConnect($mailServer, $mailUser, $mailPass, $port)
    {
        $port = (int) $port;
        if ($port === 143 || $port === 993) {
            return ImapSocketClient::connect(
                (string) $mailServer,
                $port,
                $port === 993 ? 'ssl' : 'starttls',
                false,
                15,
                (string) $mailUser,
                (string) $mailPass
            );
        }
        if ($port === 110 || $port === 995) {
            return Pop3SocketClient::connect((string) $mailServer, $port, (string) $mailUser, (string) $mailPass, 15);
        }
        return null;
    }

    // 读取单封邮件。mbox_id 继续按旧接口的邮件序号处理。
    private function getEmailDetails($mailServer, $mailUser, $mailPass, $port, $mbox_id, $delete)
    {
        $port = (int) $port;
        $mbox = null;
        try {
            $mbox = $this->imapConnect($mailServer, $mailUser, $mailPass, $port);
            if (!$mbox) return ['status' => false, 'message' => '不支持的邮件服务器端口'];

            if ($mbox instanceof ImapSocketClient) {
                $mbox->select('INBOX');
                $totalrows = $mbox->messageCount();
            } else {
                $totalrows = $mbox->count();
            }
            if ($totalrows === 0) return ['status' => false, 'message' => '无邮件'];

            $msg_number = ($mbox_id === 0 || $mbox_id === '0' || $mbox_id === '' || $mbox_id === null) ? $totalrows : (int) $mbox_id;
            if ($msg_number < 1 || $totalrows < $msg_number) {
                return ['status' => false, 'message' => '无效的消息 ID'];
            }

            if ($mbox instanceof ImapSocketClient) {
                // 旧接口仍接收邮件序号，但读取和删除统一使用稳定 UID。
                $uid = $mbox->uidForSequence($msg_number);
                $raw = $mbox->fetchRaw($uid);
                if ((int) $delete === 1) {
                    $this->deleteImapUidSafely($mbox, $uid);
                }
            } else {
                $raw = $mbox->retrieve($msg_number);
            }

            $parsed = MimeParser::parse($raw);
            $formatAddresses = static function (array $addresses): string {
                $items = [];
                foreach ($addresses as $address) {
                    $email = (string) ($address['email'] ?? '');
                    if ($email === '') continue;
                    $name = trim((string) ($address['name'] ?? ''));
                    $items[] = $name !== '' ? $name . ' <' . $email . '>' : $email;
                }
                return implode(', ', $items);
            };
            $from = $formatAddresses($parsed['from']);
            $to = $formatAddresses($parsed['to']);
            $text = (string) $parsed['text'];
            if ($text === '' && (string) $parsed['html'] !== '') {
                $text = trim(html_entity_decode(strip_tags($parsed['html']), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
            }

            return [
                'status' => true,
                'data' => [
                    'msg_number' => $msg_number,
                    'decodedSubject' => $this->convert_to_utf8($parsed['subject']),
                    'from' => $this->convert_to_utf8($from),
                    'to' => $this->convert_to_utf8($to),
                    'text' => $this->convert_to_utf8($text),
                ]
            ];
        } catch (\Throwable $e) {
            return ['status' => false, 'message' => $e->getMessage()];
        } finally {
            if ($mbox instanceof ImapSocketClient || $mbox instanceof Pop3SocketClient) $mbox->close();
        }
    }

    /** 只有 beautify=1 才进入新版只读收件箱。 */
    private function isBeautifiedRequest(): bool
    {
        return (string) Request::param('beautify', '0') === '1';
    }

    /** 全局读取量仅取决于 config_private 设置，不接受 URL 参数覆盖。 */
    private function beautifiedMailLimit(): int
    {
        return MailApiSettings::maxEmails();
    }

    /** 总开关关闭后，所有 MailApi 对外接口统一拒绝访问。 */
    private function apiDisabledResponse(bool $asJson = false)
    {
        $headers = [
            'Cache-Control' => 'no-store, private, max-age=0',
            'X-Content-Type-Options' => 'nosniff',
        ];
        if ($asJson) {
            return json(['status' => false, 'code' => 403, 'message' => '邮件 API 已由管理员关闭'], 403)
                ->header($headers);
        }
        return response('<!doctype html><html lang="zh-CN"><meta charset="utf-8">'
            . '<title>API 已关闭</title><body><h1>邮件 API 已关闭</h1></body></html>', 403)
            ->header($headers + ['Content-Type' => 'text/html; charset=utf-8']);
    }

    /** 格式化 MIME 邮箱地址（不会输出原始 HTML）。 */
    private function formatEmailAddresses(array $addresses): string
    {
        $items = [];
        foreach ($addresses as $address) {
            $email = trim((string) ($address['email'] ?? ''));
            if ($email === '') continue;
            $name = trim((string) ($address['name'] ?? ''));
            $items[] = $name === '' ? $email : $name . ' <' . $email . '>';
        }
        return $this->convert_to_utf8(implode(', ', $items));
    }

    /** 美化页面的数据只来自 INBOX，不能修改、删除或发送邮件。 */
    private function getBeautifiedInbox($mailServer, $mailUser, $mailPass, $port, int $limit): array
    {
        $mbox = null;
        try {
            $mbox = $this->imapConnect($mailServer, $mailUser, $mailPass, (int) $port);
            if (!$mbox) return ['status' => false, 'message' => '不支持的邮件服务器端口'];

            $ids = [];
            $imap = $mbox instanceof ImapSocketClient;
            if ($imap) {
                $mbox->select('INBOX');
                // UID 随 INBOX 投递递增，取最大 UID 优先，不受邮件序号变化影响。
                $ids = $mbox->search('ALL');
                rsort($ids, SORT_NUMERIC);
                $ids = array_slice($ids, 0, $limit);
            } else {
                $total = $mbox->count();
                for ($id = $total; $id >= 1 && count($ids) < $limit; $id--) {
                    $ids[] = $id;
                }
            }

            $messages = [];
            foreach ($ids as $id) {
                $internalDate = '';
                if ($imap) {
                    $metadata = $mbox->fetchHeader((int) $id);
                    $internalDate = (string) ($metadata['internal_date'] ?? '');
                    // 全局最多显示 100 封，单封超大邮件只展示邮件头，避免大附件耗尽内存。
                    if ((int) ($metadata['size'] ?? 0) > 12 * 1024 * 1024) {
                        $parsed = MimeParser::parse((string) ($metadata['header'] ?? ''));
                        $parsed['text'] = '邮件体积超过 12 MB，为保护服务器资源，此页面不加载正文。';
                        $parsed['html'] = '';
                        $parsed['attachments'] = [];
                    } else {
                        $parsed = MimeParser::parse($mbox->fetchRaw((int) $id));
                    }
                } else {
                    $parsed = MimeParser::parse($mbox->retrieve((int) $id));
                }

                $text = $this->convert_to_utf8((string) ($parsed['text'] ?? ''));
                $html = $this->convert_to_utf8((string) ($parsed['html'] ?? ''));
                if ($text === '' && $html !== '') {
                    $text = trim(html_entity_decode(strip_tags($html), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                }
                $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
                $summary = function_exists('mb_substr') ? mb_substr($text, 0, 100, 'UTF-8') : substr($text, 0, 220);
                $dateText = $internalDate !== '' ? $internalDate : (string) ($parsed['date'] ?? '');
                $timestamp = strtotime($dateText);
                $displayDate = $timestamp !== false ? date('Y-m-d H:i', $timestamp) : $dateText;
                $attachments = [];
                foreach (($parsed['attachments'] ?? []) as $attachment) {
                    $attachments[] = [
                        'filename' => $this->convert_to_utf8((string) ($attachment['filename'] ?? '附件')),
                        'size' => (int) ($attachment['size'] ?? 0),
                    ];
                    if (count($attachments) >= 30) break;
                }
                $messages[] = [
                    'uid' => (int) $id,
                    'subject' => $this->convert_to_utf8((string) ($parsed['subject'] ?? '（无主题）')),
                    'from' => $this->formatEmailAddresses($parsed['from'] ?? []),
                    'to' => $this->formatEmailAddresses($parsed['to'] ?? []),
                    'date' => $this->convert_to_utf8($displayDate),
                    'summary' => $summary,
                    'text' => $this->convert_to_utf8((string) ($parsed['text'] ?? '')),
                    'html' => substr($html, 0, 2 * 1024 * 1024),
                    'attachments' => $attachments,
                ];
            }
            return ['status' => true, 'data' => $messages];
        } catch (\Throwable $e) {
            return ['status' => false, 'message' => $e->getMessage()];
        } finally {
            if ($mbox instanceof ImapSocketClient || $mbox instanceof Pop3SocketClient) $mbox->close();
        }
    }

    /**
     * 美化模式的访问方式由已经验证的读邮件密钥决定：
     * read_email_key 要求账户+密码；read_email_key2 只要求账户。
     * 表单 POST 使用当前 API 路径，不把新输入的密码放入 URL。
     */
    private function renderBeautifiedInbox(
        array $messages,
        string $mailUser,
        bool $needsPassword,
        string $apiKey,
        string $mailServer,
        int $port,
        string $error = '',
        bool $loaded = false
    ): string {
        $escape = function ($value): string { return $this->escapeHtml($value); };
        $rawUri = (string) ($_SERVER['REQUEST_URI'] ?? '');
        $path = parse_url($rawUri, PHP_URL_PATH);
        $fallback = '/MailApi/' . ($needsPassword ? 'read_email' : 'read_email2');
        $formAction = is_string($path) && str_starts_with($path, '/') && !str_starts_with($path, '//')
            ? $path : $fallback;
        // 在 /index.php?s=/MailApi/... 的部署方式下保留 ThinkPHP 的路由 s 参数。
        $query = parse_url($rawUri, PHP_URL_QUERY);
        if (is_string($query)) {
            parse_str($query, $params);
            $s = $params['s'] ?? null;
            if (is_string($s) && preg_match('~^/?MailApi/(?:read_email|read_email2)$~i', $s)) {
                $formAction .= '?s=' . rawurlencode($s);
            }
        }
        ob_start();
        try {
            include dirname(__DIR__, 2) . '/view/mailapi/beautified.php';
            return (string) ob_get_clean();
        } catch (\Throwable $e) {
            ob_end_clean();
            throw $e;
        }
    }

    private function beautifiedResponse(
        $mailServer, $mailUser, $mailPass, $port,
        bool $needsPassword, string $apiKey, string $error = ''
    ) {
        // 兼容旧版生成的“邮箱账户/邮箱密码”占位符链接。
        $mailUser = trim(is_string($mailUser) ? $mailUser : '');
        $mailPass = is_string($mailPass) ? $mailPass : '';
        if ($mailUser === '邮箱账户') $mailUser = '';
        if ($mailPass === '邮箱密码') $mailPass = '';

        $messages = [];
        $hasCredentials = $mailUser !== '' && (!$needsPassword || $mailPass !== '');
        $loaded = false;
        if ($error === '' && $hasCredentials) {
            $loaded = true;
            $result = $this->getBeautifiedInbox(
                $mailServer, $mailUser, $mailPass, $port, $this->beautifiedMailLimit()
            );
            if ($result['status']) {
                $messages = $result['data'];
            } else {
                $error = (string) ($result['message'] ?? '读取邮件失败');
            }
        } elseif ($error === '' && Request::isPost()) {
            $error = $mailUser === '' ? '请输入邮箱账户' : '请输入邮箱密码';
        }

        // 不缓存包含私人邮件及密钥的页面；所有失败情况都留在表单页便于换账户。
        $html = $this->renderBeautifiedInbox(
            $messages, $mailUser, $needsPassword, $apiKey,
            (string) $mailServer, (int) $port, $error, $loaded
        );
        return response($html)->header([
            'Content-Type' => 'text/html; charset=utf-8',
            'Cache-Control' => 'no-store, private, max-age=0',
            'Pragma' => 'no-cache',
            'Referrer-Policy' => 'no-referrer',
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
        ]);
    }

    // 读取邮件
    public function read_email()
    {
        if (!MailApiSettings::enabled()) return $this->apiDisabledResponse(false);
        // server_ip 和 port 均可省略；省略或传空时默认连接本机 127.0.0.1:143。
        $mailServer = trim((string) Request::param('server_ip', '127.0.0.1'));
        if ($mailServer === '') {
            $mailServer = '127.0.0.1';
        }
        $mailUser = Request::param('username');
        $mailPass = Request::param('password');
        $port = Request::param('port', 143);
        $port = ($port === null || trim((string) $port) === '') ? 143 : (int) $port;
        $mbox_id = Request::param('mbox_id', 0);
        $delete = Request::param('delete', 0);
        $key = Request::param('key');
    
        if ((!$this->read_email_key || $key != $this->read_email_key)) {
            return "<h1>密钥错误</h1>";
        }
    
        if ($this->isBeautifiedRequest()) {
            // 已使用 read_email_key 验证身份；即使未携带账号/密码也渲染输入页。
            // 美化模式忽略 mbox_id/delete；只读 INBOX，永不自动删除。
            return $this->beautifiedResponse(
                $mailServer, $mailUser, $mailPass, $port, true, (string) $key
            );
        }

        // 普通模式仍保持原有参数要求与响应方式。
        if (!$mailUser || !$mailPass) {
            return "<h1>用户名和密码不能为空</h1>";
        }

        // 调用公共的邮件读取方法
        $result = $this->getEmailDetails($mailServer, $mailUser, $mailPass, $port, $mbox_id, $delete);
        if (!$result['status']) {
            return '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><h1>'
                . $this->escapeHtml($result['message'] ?? '读取邮件失败')
                . '</h1></html>';
        }

        return $this->renderEmailHtml($result['data']);
    }
    

    
    // 读取邮件，无需要密码
    public function read_email2()
    {
        if (!MailApiSettings::enabled()) return $this->apiDisabledResponse(false);
        // 免密码读取接口固定连接本机 hMailServer，不接受外部传入 server_ip。
        $mailServer = '127.0.0.1';
        $mailUser = Request::param('username');
        $port = Request::param('port', 143);
        $port = ($port === null || trim((string) $port) === '') ? 143 : (int) $port;
        $mbox_id = Request::param('mbox_id', 0);
        $delete = Request::param('delete', 0);
        $key = Request::param('key');
    
        if (!$this->read_email_key2 || $key != $this->read_email_key2) {
            return "<h1>密钥错误</h1>";
        }
    
        // 美化模式允许无账号访问并在页面输入；免密码密钥不显示密码输入框。
        if ($this->isBeautifiedRequest()) {
            $beautyUser = trim(is_string($mailUser) ? $mailUser : '');
            if ($beautyUser === '' || $beautyUser === '邮箱账户') {
                return $this->beautifiedResponse(
                    $mailServer, '', '', $port, false, (string) $key
                );
            }
            // 仅查明文存储字段；不读取 accountpassword 的不可逆哈希。
            $plain = Db::table('hm_accounts')
                ->where('accountaddress', $beautyUser)
                ->where('accountactive', 1)
                ->where('accountisad', 0)
                ->value('accountpassword_plain');
            if (!is_string($plain) || $plain === '') {
                return $this->beautifiedResponse(
                    $mailServer, $beautyUser, '', $port, false, (string) $key,
                    '该邮箱未保存原始密码，无法使用免密码读取模式'
                );
            }
            return $this->beautifiedResponse(
                $mailServer, $beautyUser, $plain, $port, false, (string) $key
            );
        }

        if (!is_string($mailUser) || trim($mailUser) === '') {
            return '<h1>邮箱账户不能为空</h1>';
        }

        // 只有 accountpassword_plain 才可用于 IMAP/POP3 认证。
        // accountpassword 是单向 PHC 哈希，既不能解密也不能充当登录密码。
        $accountPasswordPlain = Db::table('hm_accounts')
            ->where('accountaddress', $mailUser)
            ->where('accountactive', 1)
            ->where('accountisad', 0)
            ->value('accountpassword_plain');

        // 旧账户若从未保存明文，不可回退读取 accountpassword（可能是哈希）。
        if (!is_string($accountPasswordPlain) || $accountPasswordPlain === '') {
            return '<h1>该邮箱未保存原始密码，无法使用免密码读取模式</h1>';
        }

        // 调用公共的邮件读取方法
        $result = $this->getEmailDetails($mailServer, $mailUser, $accountPasswordPlain, $port, $mbox_id, $delete);
        if (!$result['status']) {
            return '<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><h1>'
                . $this->escapeHtml($result['message'] ?? '读取邮件失败')
                . '</h1></html>';
        }

        return $this->renderEmailHtml($result['data']);
    }
    

// 删除所有邮件（IMAP Socket 实现；保留原有密钥和参数接口）。
public function delete_emails()
{
    if (!MailApiSettings::enabled()) return $this->apiDisabledResponse(true);
    // server_ip 和 port 均可省略；省略或传空时默认连接本机 127.0.0.1:143。
    $mailServer = trim((string) Request::param('server_ip', '127.0.0.1'));
    if ($mailServer === '') {
        $mailServer = '127.0.0.1';
    }
    $mailUser = Request::param('username');
    $mailPass = Request::param('password');
    $port = Request::param('port', 143);
    $port = ($port === null || trim((string) $port) === '') ? 143 : (int) $port;
    $key = Request::param('key');

    if (!$this->delete_emails_key || $key != $this->delete_emails_key) {
        return json(['status' => false, 'message' => '密钥错误']);
    }
    if (!$mailUser || !$mailPass) {
        return json(['status' => false, 'message' => '用户名和密码不能为空']);
    }
    if (!in_array($port, [143, 993], true)) {
        return json(['status' => false, 'message' => '批量删除仅支持 IMAP 端口 143/993']);
    }

    $mbox = null;
    try {
        $mbox = $this->imapConnect($mailServer, $mailUser, $mailPass, $port);
        if (!($mbox instanceof ImapSocketClient)) {
            return json(['status' => false, 'message' => '无法连接到 IMAP 邮件服务器']);
        }
        $mbox->select('INBOX');
        $totalrows = $mbox->deleteAll();
        if ($totalrows === 0) return json(['status' => false, 'message' => '没有邮件可以删除']);
        return json(['status' => true, 'message' => "已删除 $totalrows 封邮件"]);
    } catch (\Throwable $e) {
        return json(['status' => false, 'message' => $e->getMessage()]);
    } finally {
        if ($mbox instanceof ImapSocketClient) $mbox->close();
    }
}

public function queryDomainName()
{
    if (!MailApiSettings::enabled()) return $this->apiDisabledResponse(true);
    $key = Request::param('key');
    // 验证密钥是否正确
    if ((!$this->queryDomainName_key || $key != $this->queryDomainName_key)) {
        return json(['status' => false, 'code' => 401, 'message' => '密钥错误']);
    }

    // 查询 hm_domains 表中的所有 domainname 字段
    try {
        $domainNames = Db::table('hm_domains')->column('domainname');  // 获取所有 domainname 字段值
        if (!$domainNames) {
            return json(['status' => false, 'code' => 404, 'message' => '没有找到任何域名']);
        }

        // 返回查询结果
        return json([
            'status' => true,
            'code' => 200,  // 成功返回 200 状态码
            'message' => '查询成功',
            'data' => $domainNames
        ]);
    } catch (\Exception $e) {
        return json(['status' => false, 'code' => 500, 'message' => '查询失败: ' . $e->getMessage()]);
    }
}




}