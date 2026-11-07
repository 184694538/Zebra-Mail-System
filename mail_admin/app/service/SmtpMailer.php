<?php
namespace app\service;

/** Lightweight SMTP client for hMailServer; no extra Composer package required. */
class SmtpMailer
{
    public static function buildMessage(string $from, array $input, array $files = [], int $maxAttachmentBytes = 20971520, bool $allowEmptyRecipients = false): array
    {
        $to = self::parseAddresses((string) ($input['to'] ?? ''));
        $cc = self::parseAddresses((string) ($input['cc'] ?? ''));
        $bcc = self::parseAddresses((string) ($input['bcc'] ?? ''));
        if (!$allowEmptyRecipients && !$to && !$cc && !$bcc) {
            throw new \InvalidArgumentException('请至少填写一个收件人');
        }
        $subject = self::cleanHeader((string) ($input['subject'] ?? ''));
        $html = (string) ($input['html'] ?? '');
        $text = (string) ($input['text'] ?? '');
        if ($html === '' && $text === '') {
            throw new \InvalidArgumentException('邮件正文不能为空');
        }
        if ($html === '') {
            $html = '<div>' . nl2br(htmlspecialchars($text, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')) . '</div>';
        }
        if ($text === '') {
            $text = trim(html_entity_decode(strip_tags(str_replace(['<br>', '<br/>', '<br />'], "\n", $html)), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        }
        $attachments = self::normalizeFiles($files, $maxAttachmentBytes);
        $mixedBoundary = '=_webmail_mixed_' . bin2hex(random_bytes(12));
        $altBoundary = '=_webmail_alt_' . bin2hex(random_bytes(12));
        $domain = substr(strrchr($from, '@') ?: '@localhost', 1);
        $messageId = '<' . bin2hex(random_bytes(16)) . '@' . ($domain !== '' ? $domain : 'localhost') . '>';

        $headers = [
            'Date: ' . date(DATE_RFC2822),
            'From: ' . $from,
            'To: ' . self::formatAddresses($to),
        ];
        if ($cc) $headers[] = 'Cc: ' . self::formatAddresses($cc);
        if ($subject !== '') $headers[] = 'Subject: ' . self::encodeHeader($subject);
        $headers[] = 'Message-ID: ' . $messageId;
        $headers[] = 'MIME-Version: 1.0';
        $headers[] = 'Content-Type: multipart/mixed; boundary="' . $mixedBoundary . '"';

        $body = [];
        $body[] = '--' . $mixedBoundary;
        $body[] = 'Content-Type: multipart/alternative; boundary="' . $altBoundary . '"';
        $body[] = '';
        $body[] = '--' . $altBoundary;
        $body[] = 'Content-Type: text/plain; charset=UTF-8';
        $body[] = 'Content-Transfer-Encoding: base64';
        $body[] = '';
        $body[] = rtrim(chunk_split(base64_encode($text), 76, "\r\n"));
        $body[] = '--' . $altBoundary;
        $body[] = 'Content-Type: text/html; charset=UTF-8';
        $body[] = 'Content-Transfer-Encoding: base64';
        $body[] = '';
        $body[] = rtrim(chunk_split(base64_encode($html), 76, "\r\n"));
        $body[] = '--' . $altBoundary . '--';

        foreach ($attachments as $attachment) {
            $filename = self::encodeParameter($attachment['name']);
            $body[] = '--' . $mixedBoundary;
            $body[] = 'Content-Type: ' . $attachment['type'] . '; name="' . $filename . '"';
            $body[] = 'Content-Transfer-Encoding: base64';
            $body[] = 'Content-Disposition: attachment; filename="' . $filename . '"';
            $body[] = '';
            $body[] = rtrim(chunk_split(base64_encode($attachment['content']), 76, "\r\n"));
        }
        $body[] = '--' . $mixedBoundary . '--';
        $raw = implode("\r\n", $headers) . "\r\n\r\n" . implode("\r\n", $body) . "\r\n";
        $recipients = array_values(array_unique(array_merge($to, $cc, $bcc)));
        return ['raw' => $raw, 'recipients' => $recipients, 'message_id' => $messageId, 'attachments' => count($attachments)];
    }

    public static function send(string $from, string $password, array $input, array $files, array $config): array
    {
        $built = self::buildMessage($from, $input, $files, (int) ($config['max_attachment_bytes'] ?? 20971520));
        $host = trim((string) ($config['host'] ?? '127.0.0.1'));
        $port = (int) ($config['smtp_port'] ?? 25);
        $security = strtolower((string) ($config['smtp_security'] ?? 'none'));
        $timeout = max(5, min(60, (int) ($config['timeout'] ?? 15)));
        if ($host === '' || preg_match('/[\s\r\n\/]/', $host) || $port < 1 || $port > 65535 || !in_array($security, ['none', 'ssl', 'starttls'], true)) {
            throw new \RuntimeException('SMTP 服务器配置无效');
        }
        $verify = !empty($config['validate_cert']);
        $context = stream_context_create(['ssl' => [
            'verify_peer' => $verify,
            'verify_peer_name' => $verify,
            'allow_self_signed' => !$verify,
            'SNI_enabled' => true,
            'peer_name' => $host,
        ]]);
        $target = ($security === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
        $errno = 0;
        $errstr = '';
        $socket = @stream_socket_client($target, $errno, $errstr, $timeout, STREAM_CLIENT_CONNECT, $context);
        if (!$socket) {
            throw new \RuntimeException('无法连接 SMTP 服务器：' . self::safe($errstr ?: (string) $errno));
        }
        stream_set_timeout($socket, $timeout);
        try {
            self::expect($socket, [220]);
            self::command($socket, 'EHLO webmail.local', [250]);
            if ($security === 'starttls') {
                self::command($socket, 'STARTTLS', [220]);
                $crypto = @stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
                if ($crypto !== true) throw new \RuntimeException('SMTP STARTTLS 握手失败');
                self::command($socket, 'EHLO webmail.local', [250]);
            }
            if (!empty($config['smtp_auth'])) {
                self::command($socket, 'AUTH LOGIN', [334]);
                self::command($socket, base64_encode($from), [334]);
                self::command($socket, base64_encode($password), [235]);
            }
            self::command($socket, 'MAIL FROM:<' . $from . '>', [250]);
            foreach ($built['recipients'] as $recipient) {
                self::command($socket, 'RCPT TO:<' . $recipient . '>', [250, 251]);
            }
            self::command($socket, 'DATA', [354]);
            $raw = preg_replace('/(?m)^\./', '..', $built['raw']);
            self::writeAll($socket, $raw . ".\r\n");
            self::expect($socket, [250]);
            @fwrite($socket, "QUIT\r\n");
            return ['message_id' => $built['message_id'], 'attachments' => $built['attachments'], 'raw' => $built['raw']];
        } finally {
            if (is_resource($socket)) fclose($socket);
        }
    }

    private static function writeAll($socket, string $data): void
    {
        $length = strlen($data);
        $offset = 0;
        while ($offset < $length) {
            $written = @fwrite($socket, substr($data, $offset));
            if ($written === false || $written === 0) throw new \RuntimeException('SMTP 邮件内容发送失败');
            $offset += $written;
        }
    }

    private static function command($socket, string $command, array $expected): string
    {
        $written = @fwrite($socket, $command . "\r\n");
        if ($written === false) throw new \RuntimeException('SMTP 命令发送失败');
        return self::expect($socket, $expected);
    }

    private static function expect($socket, array $expected): string
    {
        $response = '';
        while (($line = @fgets($socket, 515)) !== false) {
            $response .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') break;
        }
        if ($response === '') throw new \RuntimeException('SMTP 服务器未返回响应');
        $code = (int) substr($response, 0, 3);
        if (!in_array($code, $expected, true)) {
            $last = trim(substr($response, 0, 400));
            throw new \RuntimeException('SMTP 操作失败：' . self::safe($last));
        }
        return $response;
    }

    private static function parseAddresses(string $value): array
    {
        $result = [];
        foreach (preg_split('/[;,]+/', $value) as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') continue;
            if (preg_match('/<([^<>]+)>/', $candidate, $matches)) $candidate = trim($matches[1]);
            $candidate = trim($candidate, " \t\r\n<>");
            if (!filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
                throw new \InvalidArgumentException('收件人邮箱格式不正确：' . self::safe($candidate));
            }
            $result[] = strtolower($candidate);
        }
        return array_values(array_unique($result));
    }

    private static function formatAddresses(array $addresses): string
    {
        return implode(', ', $addresses);
    }

    private static function cleanHeader(string $value): string
    {
        return trim(preg_replace('/[\r\n\x00-\x1F]+/', ' ', $value));
    }

    private static function encodeHeader(string $value): string
    {
        if ($value === '') return '';
        return '=?UTF-8?B?' . base64_encode($value) . '?=';
    }

    private static function encodeParameter(string $value): string
    {
        $value = str_replace(["\r", "\n", '"', '\\'], '', $value);
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            return '=?UTF-8?B?' . base64_encode($value) . '?=';
        }
        return $value;
    }

    private static function normalizeFiles(array $files, int $maxBytes): array
    {
        $result = [];
        $total = 0;
        foreach ($files as $file) {
            if (!is_array($file) || !isset($file['tmp_name'])) continue;
            if ((int) ($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) continue;
            if ((int) ($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK || !is_uploaded_file((string) $file['tmp_name'])) {
                throw new \RuntimeException('附件上传失败');
            }
            $size = (int) ($file['size'] ?? 0);
            $total += $size;
            if ($size < 0 || $total > $maxBytes) throw new \RuntimeException('附件总大小不能超过 ' . round($maxBytes / 1048576) . ' MiB');
            $content = @file_get_contents((string) $file['tmp_name']);
            if (!is_string($content)) throw new \RuntimeException('无法读取上传附件');
            $name = basename(str_replace('\\', '/', (string) ($file['name'] ?? 'attachment')));
            $name = preg_replace('/[\r\n\x00-\x1F]/', '', $name);
            if ($name === '') $name = 'attachment';
            $type = 'application/octet-stream';
            if (class_exists('finfo')) {
                $finfo = new \finfo(FILEINFO_MIME_TYPE);
                $detected = $finfo->file((string) $file['tmp_name']);
                if (is_string($detected) && preg_match('#^[a-z0-9.+-]+/[a-z0-9.+-]+$#i', $detected)) $type = $detected;
            }
            $result[] = ['name' => $name, 'type' => $type, 'content' => $content];
        }
        return $result;
    }

    private static function safe(string $value): string
    {
        $value = preg_replace('/[\r\n\x00-\x1F]+/', ' ', $value);
        return substr($value, 0, 180);
    }
}
