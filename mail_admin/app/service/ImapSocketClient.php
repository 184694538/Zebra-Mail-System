<?php
namespace app\service;

/**
 * Minimal IMAP4rev1 client implemented with PHP streams.
 * No ext-imap or third-party Composer package is required.
 */
class ImapSocketClient
{
    /** @var resource|null */
    private $socket;
    private int $timeout;
    private int $tagNumber = 0;
    private bool $closed = false;
    private bool $preAuthenticated = false;
    private int $exists = 0;
    private string $selectedFolder = '';

    private function __construct($socket, int $timeout, string $greeting)
    {
        $this->socket = $socket;
        $this->timeout = $timeout;
        $this->preAuthenticated = (bool) preg_match('/^\*\s+PREAUTH\b/i', trim($greeting));
    }

    public static function connect(
        string $host,
        int $port,
        string $security,
        bool $validateCert,
        int $timeout,
        string $username,
        string $password
    ): self {
        $host = trim($host);
        $security = strtolower(trim($security));
        $timeout = max(5, min(60, $timeout));
        if ($host === '' || preg_match('/[\s\/{}\r\n\x00]/', $host) || $port < 1 || $port > 65535) {
            throw new \RuntimeException('IMAP 服务器地址或端口配置无效');
        }
        if (!in_array($security, ['none', 'ssl', 'starttls'], true)) {
            throw new \RuntimeException('IMAP 加密方式配置无效');
        }
        if ($username === '' || $password === '') {
            throw new \RuntimeException('邮箱地址或密码不能为空');
        }
        if (!function_exists('stream_socket_client')) {
            throw new \RuntimeException('当前 PHP 未启用 Socket/Streams 功能，无法连接 IMAP');
        }

        $context = stream_context_create(['ssl' => [
            'verify_peer' => $validateCert,
            'verify_peer_name' => $validateCert,
            'allow_self_signed' => !$validateCert,
            'SNI_enabled' => true,
            'peer_name' => $host,
        ]]);
        $target = ($security === 'ssl' ? 'ssl://' : 'tcp://') . self::socketHost($host) . ':' . $port;
        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client($target, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
        if (!is_resource($socket)) {
            throw new \RuntimeException('无法连接 IMAP 服务器：' . self::safeText($errstr !== '' ? $errstr : (string) $errno));
        }
        stream_set_timeout($socket, $timeout);
        $greeting = @fgets($socket, 8192);
        if (!is_string($greeting) || !preg_match('/^\*\s+(?:OK|PREAUTH)\b/i', $greeting)) {
            fclose($socket);
            throw new \RuntimeException('IMAP 服务器未返回有效欢迎信息');
        }

        $client = new self($socket, $timeout, $greeting);
        try {
            if ($security === 'starttls') {
                $client->command('STARTTLS');
                $crypto = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($crypto !== true) {
                    throw new \RuntimeException('IMAP STARTTLS 握手失败，请检查服务器 TLS 配置和证书');
                }
            }
            if (!$client->preAuthenticated) {
                $client->command('LOGIN ' . self::quote($username) . ' ' . self::quote($password));
            }
            return $client;
        } catch (\Throwable $e) {
            $client->close(false);
            throw $e;
        }
    }

    private static function socketHost(string $host): string
    {
        if (filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            return '[' . $host . ']';
        }
        return $host;
    }

    private static function safeText(string $value): string
    {
        $value = preg_replace('/[\r\n\x00-\x1F]+/', ' ', $value);
        return substr(trim($value), 0, 180);
    }

    public static function quote(string $value): string
    {
        if (preg_match('/[\x00\r\n]/', $value)) {
            throw new \InvalidArgumentException('IMAP 参数包含非法控制字符');
        }
        return '"' . addcslashes($value, "\\\"") . '"';
    }

    private function nextTag(): string
    {
        $this->tagNumber++;
        return 'A' . str_pad((string) $this->tagNumber, 4, '0', STR_PAD_LEFT);
    }

    private function writeAll(string $data): void
    {
        if (!is_resource($this->socket) || $this->closed) {
            throw new \RuntimeException('IMAP 连接已关闭');
        }
        $length = strlen($data);
        $offset = 0;
        while ($offset < $length) {
            $written = @fwrite($this->socket, substr($data, $offset));
            if ($written === false || $written === 0) {
                throw new \RuntimeException('IMAP 命令发送失败，连接可能已中断');
            }
            $offset += $written;
        }
    }

    private function readLine(): string
    {
        if (!is_resource($this->socket) || $this->closed) {
            throw new \RuntimeException('IMAP 连接已关闭');
        }
        $line = @fgets($this->socket, 8192);
        if ($line === false) {
            $meta = stream_get_meta_data($this->socket);
            throw new \RuntimeException(!empty($meta['timed_out']) ? 'IMAP 服务器响应超时' : '读取 IMAP 服务器响应失败');
        }
        return $line;
    }

    private function readExact(int $length): string
    {
        if ($length < 0 || $length > 67108864) {
            throw new \RuntimeException('IMAP 返回的数据长度异常');
        }
        $data = '';
        while (strlen($data) < $length) {
            $chunk = @fread($this->socket, min(8192, $length - strlen($data)));
            if ($chunk === false || $chunk === '') {
                $meta = stream_get_meta_data($this->socket);
                throw new \RuntimeException(!empty($meta['timed_out']) ? '读取邮件内容超时' : '邮件内容传输中断');
            }
            $data .= $chunk;
        }
        return $data;
    }

    private function readResponse(string $tag): array
    {
        $lines = [];
        $literals = [];
        $status = '';
        $statusText = '';
        while (true) {
            $line = $this->readLine();
            $lines[] = $line;
            if (preg_match('/\{([0-9]+)\+?\}\r?\n$/', $line, $match)) {
                $literal = $this->readExact((int) $match[1]);
                $literals[] = $literal;
                continue;
            }
            if (preg_match('/^' . preg_quote($tag, '/') . '\s+(OK|NO|BAD)\b(.*)$/i', trim($line), $match)) {
                $status = strtoupper($match[1]);
                $statusText = trim($match[2] ?? '');
                break;
            }
        }
        return ['status' => $status, 'status_text' => $statusText, 'lines' => $lines, 'literals' => $literals];
    }

    public function command(string $command): array
    {
        if (preg_match('/[\x00\r\n]/', $command)) {
            throw new \InvalidArgumentException('IMAP 命令包含非法控制字符');
        }
        $tag = $this->nextTag();
        $this->writeAll($tag . ' ' . $command . "\r\n");
        $response = $this->readResponse($tag);
        if ($response['status'] !== 'OK') {
            $detail = $response['status_text'] !== '' ? $response['status_text'] : $response['status'];
            throw new \RuntimeException('IMAP 操作失败：' . self::safeText($detail));
        }
        return $response;
    }

    public static function encodeMailbox(string $folder): string
    {
        $folder = trim($folder);
        if ($folder === '' || strlen($folder) > 255 || preg_match('/[\x00\r\n]/', $folder)) {
            throw new \InvalidArgumentException('无效的邮件文件夹名称');
        }
        if (!preg_match('/[^\x20-\x7E]|&/', $folder)) {
            return $folder;
        }
        return preg_replace_callback('/[^\x20-\x7E&]+|&/u', static function ($match) {
            if ($match[0] === '&') return '&-';
            $utf16 = function_exists('iconv') ? @iconv('UTF-8', 'UTF-16BE//IGNORE', $match[0]) : false;
            if ($utf16 === false) return $match[0];
            return '&' . rtrim(strtr(base64_encode($utf16), '/', ','), '=') . '-';
        }, $folder);
    }

    public static function decodeMailbox(string $folder): string
    {
        return preg_replace_callback('/&([A-Za-z0-9+,]*)-/', static function ($match) {
            if ($match[1] === '') return '&';
            $base64 = strtr($match[1], ',', '/') . str_repeat('=', (4 - strlen($match[1]) % 4) % 4);
            $bytes = base64_decode($base64, true);
            if ($bytes === false || !function_exists('iconv')) return $match[0];
            $decoded = @iconv('UTF-16BE', 'UTF-8//IGNORE', $bytes);
            return $decoded === false ? $match[0] : $decoded;
        }, $folder);
    }

    public function select(string $folder): array
    {
        $mailbox = self::encodeMailbox($folder);
        $response = $this->command('SELECT ' . self::quote($mailbox));
        $this->selectedFolder = $folder;
        $this->exists = 0;
        foreach ($response['lines'] as $line) {
            if (preg_match('/^\*\s+(\d+)\s+EXISTS\b/i', $line, $match)) {
                $this->exists = (int) $match[1];
            }
        }
        return $response;
    }

    public function messageCount(): int
    {
        return $this->exists;
    }

    public function listFolders(): array
    {
        $response = $this->command('LIST "" "*"');
        $folders = [];
        foreach ($response['lines'] as $line) {
            if (!preg_match('/^\*\s+LIST\s+\([^)]*\)\s+(?:"(?:\\\\.|[^"])*"|NIL)\s+("(?:\\\\.|[^"])*"|[^\s]+)\s*$/i', trim($line), $match)) {
                continue;
            }
            $token = $match[1];
            if (strlen($token) >= 2 && $token[0] === '"' && substr($token, -1) === '"') {
                $token = stripcslashes(substr($token, 1, -1));
            }
            if ($token !== '') $folders[] = self::decodeMailbox($token);
        }
        if (!in_array('INBOX', array_map('strtoupper', $folders), true)) array_unshift($folders, 'INBOX');
        return array_values(array_unique($folders));
    }

    public function createFolder(string $folder): bool
    {
        try {
            $this->command('CREATE ' . self::quote(self::encodeMailbox($folder)));
            return true;
        } catch (\Throwable $e) {
            if (stripos($e->getMessage(), 'already') !== false || stripos($e->getMessage(), 'exists') !== false) return true;
            return false;
        }
    }

    public function subscribe(string $folder): void
    {
        $this->command('SUBSCRIBE ' . self::quote(self::encodeMailbox($folder)));
    }

    public function search(string $criteria = 'ALL'): array
    {
        if (preg_match('/[\x00\r\n]/', $criteria)) throw new \InvalidArgumentException('搜索条件无效');
        $response = $this->command('UID SEARCH ' . $criteria);
        $uids = [];
        foreach ($response['lines'] as $line) {
            if (preg_match('/^\*\s+SEARCH(?:\s+(.*))?$/i', trim($line), $match)) {
                $values = preg_split('/\s+/', trim((string) ($match[1] ?? '')));
                foreach ($values as $value) if ($value !== '' && ctype_digit($value)) $uids[] = (int) $value;
            }
        }
        return array_values(array_unique($uids));
    }

    public function searchText(string $query): array
    {
        $query = trim(preg_replace('/[\x00-\x1F]+/', ' ', $query));
        if ($query === '') return $this->search('ALL');
        if (function_exists('mb_substr')) $query = mb_substr($query, 0, 100, 'UTF-8');
        else $query = substr($query, 0, 100);
        try {
            return $this->search('CHARSET UTF-8 TEXT ' . self::quote($query));
        } catch (\Throwable $e) {
            // Some older IMAP servers do not accept the optional CHARSET argument.
            return $this->search('TEXT ' . self::quote($query));
        }
    }

    public function fetchHeader(int $uid): array
    {
        if ($uid < 1) throw new \InvalidArgumentException('无效的邮件 UID');
        $items = '(UID FLAGS RFC822.SIZE INTERNALDATE BODY.PEEK[HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID CONTENT-TYPE)])';
        $response = $this->command('UID FETCH ' . $uid . ' ' . $items);
        $metadata = implode('', $response['lines']);
        $flags = '';
        if (preg_match('/\bFLAGS\s+\(([^)]*)\)/i', $metadata, $match)) $flags = $match[1];
        $size = 0;
        if (preg_match('/\bRFC822\.SIZE\s+(\d+)/i', $metadata, $match)) $size = (int) $match[1];
        $internalDate = '';
        if (preg_match('/\bINTERNALDATE\s+"((?:\\\\.|[^"])*)"/i', $metadata, $match)) $internalDate = stripcslashes($match[1]);
        return [
            'uid' => $uid,
            'flags' => $flags,
            'seen' => in_array('\\Seen', preg_split('/\s+/', trim($flags)) ?: [], true),
            'flagged' => in_array('\\Flagged', preg_split('/\s+/', trim($flags)) ?: [], true),
            'answered' => in_array('\\Answered', preg_split('/\s+/', trim($flags)) ?: [], true),
            'size' => $size,
            'internal_date' => $internalDate,
            'header' => $response['literals'][0] ?? '',
        ];
    }

    public function fetchRaw(int $uid): string
    {
        if ($uid < 1) throw new \InvalidArgumentException('无效的邮件 UID');
        $response = $this->command('UID FETCH ' . $uid . ' BODY.PEEK[]');
        if (!isset($response['literals'][0])) throw new \RuntimeException('邮件不存在或服务器未返回邮件内容');
        return $response['literals'][0];
    }

    public function fetchSequenceRaw(int $sequence): string
    {
        if ($sequence < 1 || $sequence > $this->exists) throw new \InvalidArgumentException('无效的邮件编号');
        $response = $this->command('FETCH ' . $sequence . ' BODY.PEEK[]');
        if (!isset($response['literals'][0])) throw new \RuntimeException('邮件不存在或服务器未返回邮件内容');
        return $response['literals'][0];
    }

    public function storeSeen(int $uid, bool $seen): void
    {
        $operation = $seen ? '+FLAGS.SILENT' : '-FLAGS.SILENT';
        $this->command('UID STORE ' . $uid . ' ' . $operation . ' (\\Seen)');
    }

    public function storeSequenceDeleted(string $sequenceSet = '1:*'): void
    {
        $this->command('STORE ' . $sequenceSet . ' +FLAGS.SILENT (\\Deleted)');
    }

    public function copyTo(int $uid, string $folder): void
    {
        $this->command('UID COPY ' . $uid . ' ' . self::quote(self::encodeMailbox($folder)));
    }

    public function markDeleted(int $uid): void
    {
        $this->command('UID STORE ' . $uid . ' +FLAGS.SILENT (\\Deleted)');
    }

    public function expunge(): void
    {
        $this->command('EXPUNGE');
    }

    public function append(string $folder, string $raw, string $flags = ''): bool
    {
        $mailbox = self::quote(self::encodeMailbox($folder));
        $flags = trim($flags);
        if ($flags !== '' && !preg_match('/^\\\\[A-Za-z]+(?:\s+\\\\[A-Za-z]+)*$/', $flags)) {
            throw new \InvalidArgumentException('邮件标记参数无效');
        }
        $tag = $this->nextTag();
        $suffix = $flags !== '' ? ' (' . $flags . ')' : '';
        $this->writeAll($tag . ' APPEND ' . $mailbox . $suffix . ' {' . strlen($raw) . "}\r\n");
        $line = $this->readLine();
        if (strpos($line, '+') !== 0) {
            if (preg_match('/^' . preg_quote($tag, '/') . '\s+(NO|BAD)\b(.*)$/i', trim($line), $match)) {
                throw new \RuntimeException('IMAP 保存邮件失败：' . self::safeText(trim($match[2] ?? $match[1])));
            }
            throw new \RuntimeException('IMAP 服务器未接受 APPEND 邮件内容');
        }
        // The literal length is exactly strlen($raw); the final CRLF terminates APPEND.
        $this->writeAll($raw . "\r\n");
        $response = $this->readResponse($tag);
        if ($response['status'] !== 'OK') {
            throw new \RuntimeException('IMAP 保存邮件失败：' . self::safeText($response['status_text']));
        }
        return true;
    }

    public function uidForSequence(int $sequence): int
    {
        if ($sequence < 1 || $sequence > $this->exists) throw new \InvalidArgumentException('无效的邮件编号');
        $response = $this->command('FETCH ' . $sequence . ' (UID)');
        $metadata = implode('', $response['lines']);
        if (!preg_match('/\bUID\s+(\d+)/i', $metadata, $match)) throw new \RuntimeException('无法读取邮件 UID');
        return (int) $match[1];
    }

    public function deleteSequence(int $sequence): void
    {
        if ($sequence < 1 || $sequence > $this->exists) throw new \InvalidArgumentException('无效的邮件编号');
        $this->command('STORE ' . $sequence . ' +FLAGS.SILENT (\\Deleted)');
        $this->expunge();
    }

    public function deleteAll(): int
    {
        $count = $this->exists;
        if ($count > 0) {
            $this->storeSequenceDeleted('1:*');
            $this->expunge();
        }
        return $count;
    }

    public function close(bool $sendLogout = true): void
    {
        if ($this->closed) return;
        if ($sendLogout && is_resource($this->socket)) {
            try { $this->command('LOGOUT'); } catch (\Throwable $ignored) {}
        }
        if (is_resource($this->socket)) @fclose($this->socket);
        $this->socket = null;
        $this->closed = true;
    }

    public function __destruct()
    {
        $this->close(false);
    }
}
