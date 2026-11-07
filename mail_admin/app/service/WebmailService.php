<?php
namespace app\service;

/** hMailServer webmail service using a pure PHP IMAP socket client. */
class WebmailService
{
    private static function config(): array
    {
        return (array) \think\facade\Config::get('webmail', []);
    }

    public static function assertAvailable(): void
    {
        if (!function_exists('stream_socket_client') || !function_exists('stream_socket_enable_crypto')) {
            throw new \RuntimeException('当前 PHP 未启用 Socket/Streams 或 OpenSSL，无法连接 IMAP');
        }
    }

    public static function connect(string $email, string $password, string $folder = 'INBOX'): ImapSocketClient
    {
        self::assertAvailable();
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254 || $password === '') {
            throw new \RuntimeException('邮箱地址或密码无效');
        }
        $cfg = self::config();
        $client = ImapSocketClient::connect(
            (string) ($cfg['host'] ?? '127.0.0.1'),
            (int) ($cfg['imap_port'] ?? 143),
            (string) ($cfg['imap_security'] ?? 'none'),
            !empty($cfg['validate_cert']),
            (int) ($cfg['timeout'] ?? 15),
            $email,
            $password
        );
        try {
            $client->select($folder);
            return $client;
        } catch (\Throwable $e) {
            $client->close();
            throw $e;
        }
    }

    public static function close($client): void
    {
        if ($client instanceof ImapSocketClient) $client->close();
    }

    private static function keyForFolder(string $name): string
    {
        $lower = function_exists('mb_strtolower') ? mb_strtolower($name, 'UTF-8') : strtolower($name);
        if (strtoupper($name) === 'INBOX') return 'inbox';
        if (preg_match('/sent|send|gesendet|envoy|送信済/u', $lower)) return 'sent';
        if (preg_match('/draft|entwurf|草稿/u', $lower)) return 'drafts';
        if (preg_match('/trash|deleted|bin|papierkorb|已删除|垃圾桶/u', $lower)) return 'trash';
        if (preg_match('/junk|spam|垃圾邮件/u', $lower)) return 'junk';
        return 'custom';
    }

    private static function listFolderNames(ImapSocketClient $imap): array
    {
        return $imap->listFolders();
    }

    private static function ensureSystemFolders(ImapSocketClient $imap, array $names): array
    {
        $cfg = self::config();
        if (empty($cfg['create_system_folders'])) return $names;
        $defaults = ['sent' => 'Sent', 'drafts' => 'Drafts', 'trash' => 'Trash'];
        $keys = array_map([self::class, 'keyForFolder'], $names);
        foreach ($defaults as $key => $folder) {
            if (!in_array($key, $keys, true) && $imap->createFolder($folder)) {
                try { $imap->subscribe($folder); } catch (\Throwable $ignored) {}
                $names[] = $folder;
                $keys[] = $key;
            }
        }
        return array_values(array_unique($names));
    }

    private static function resolveFolder(ImapSocketClient $imap, string $requested): string
    {
        $names = self::listFolderNames($imap);
        $key = strtolower($requested);
        $aliases = [
            'inbox' => 'inbox', 'sent' => 'sent', 'sentbox' => 'sent',
            'draft' => 'drafts', 'drafts' => 'drafts',
            'trash' => 'trash', 'deleted' => 'trash',
            'junk' => 'junk', 'spam' => 'junk',
        ];
        if (isset($aliases[$key])) {
            $targetKey = $aliases[$key];
            foreach ($names as $name) {
                if (self::keyForFolder($name) === $targetKey) return $name;
            }
            if ($targetKey === 'inbox') return 'INBOX';
            throw new \RuntimeException('邮箱中尚未创建该文件夹');
        }
        foreach ($names as $name) {
            if (hash_equals($name, $requested)) return $name;
        }
        throw new \RuntimeException('邮件文件夹不存在或不可访问');
    }

    /** @return array{0:ImapSocketClient,1:string} */
    private static function connectFolder(string $email, string $password, string $requested): array
    {
        $imap = self::connect($email, $password, 'INBOX');
        try {
            $folderName = self::resolveFolder($imap, $requested);
            if (strcasecmp($folderName, 'INBOX') !== 0 || $requested !== 'INBOX') {
                $imap->select($folderName);
            }
            return [$imap, $folderName];
        } catch (\Throwable $e) {
            $imap->close();
            throw $e;
        }
    }

    public static function folders(string $email, string $password): array
    {
        $imap = self::connect($email, $password, 'INBOX');
        try {
            $names = self::ensureSystemFolders($imap, self::listFolderNames($imap));
            $result = [];
            $labels = ['inbox' => '收件箱', 'sent' => '已发送', 'drafts' => '草稿箱', 'trash' => '垃圾桶', 'junk' => '垃圾邮件'];
            foreach ($names as $name) {
                $key = self::keyForFolder($name);
                $result[] = ['key' => $key === 'custom' ? $name : $key, 'name' => $name, 'label' => $labels[$key] ?? $name];
            }
            usort($result, static function ($a, $b) {
                $order = ['inbox' => 0, 'sent' => 1, 'drafts' => 2, 'trash' => 3, 'junk' => 4];
                return ($order[$a['key']] ?? 99) <=> ($order[$b['key']] ?? 99);
            });
            return $result;
        } finally {
            $imap->close();
        }
    }

    public static function messages(string $email, string $password, string $folder, int $page, int $pageSize, string $query = ''): array
    {
        [$imap, $folderName] = self::connectFolder($email, $password, $folder);
        try {
            $uids = trim($query) !== '' ? $imap->searchText($query) : $imap->search('ALL');
            rsort($uids, SORT_NUMERIC);
            $total = count($uids);
            $pageSize = max(5, min(100, $pageSize));
            $page = max(1, $page);
            $slice = array_slice($uids, ($page - 1) * $pageSize, $pageSize);
            $items = [];
            foreach ($slice as $uid) {
                try {
                    $overview = $imap->fetchHeader((int) $uid);
                } catch (\Throwable $ignored) {
                    continue;
                }
                $headers = MimeParser::parseHeaders((string) $overview['header']);
                $items[] = [
                    'uid' => (int) $uid,
                    'subject' => MimeParser::decodeHeader($headers['subject'] ?? '') ?: '（无主题）',
                    'from' => MimeParser::decodeHeader($headers['from'] ?? ''),
                    'to' => MimeParser::decodeHeader($headers['to'] ?? ''),
                    'date' => (string) (($headers['date'] ?? '') ?: $overview['internal_date']),
                    'seen' => (bool) $overview['seen'],
                    'flagged' => (bool) $overview['flagged'],
                    'answered' => (bool) $overview['answered'],
                    'size' => (int) $overview['size'],
                    'has_attachment' => MimeParser::headerMayHaveAttachment((string) $overview['header']),
                ];
            }
            $unseen = $imap->search('UNSEEN');
            return [
                'folder' => $folderName,
                'page' => $page,
                'page_size' => $pageSize,
                'total' => $total,
                'unread' => count($unseen),
                'messages' => $items,
            ];
        } finally {
            $imap->close();
        }
    }

    public static function message(string $email, string $password, string $folder, int $uid): array
    {
        if ($uid < 1) throw new \InvalidArgumentException('无效的邮件编号');
        [$imap, $folderName] = self::connectFolder($email, $password, $folder);
        try {
            $raw = $imap->fetchRaw($uid);
            $parsed = MimeParser::parse($raw);
            try { $imap->storeSeen($uid, true); } catch (\Throwable $ignored) {}
            $attachments = [];
            foreach ($parsed['attachments'] as $attachment) {
                $attachments[] = [
                    'part' => $attachment['part'],
                    'filename' => $attachment['filename'],
                    'content_type' => $attachment['content_type'],
                    'size' => $attachment['size'],
                ];
            }
            return [
                'uid' => $uid,
                'folder' => $folderName,
                'subject' => $parsed['subject'],
                'from' => $parsed['from'],
                'to' => $parsed['to'],
                'cc' => $parsed['cc'],
                'reply_to' => $parsed['reply_to'],
                'date' => $parsed['date'],
                'message_id' => $parsed['message_id'],
                'html' => $parsed['html'],
                'text' => $parsed['text'],
                'attachments' => $attachments,
            ];
        } finally {
            $imap->close();
        }
    }

    public static function attachment(string $email, string $password, string $folder, int $uid, string $partId): array
    {
        if ($uid < 1 || !preg_match('/^[0-9]+(?:\.[0-9]+)*$/', $partId)) {
            throw new \InvalidArgumentException('无效的附件编号');
        }
        [$imap, $folderName] = self::connectFolder($email, $password, $folder);
        try {
            $parsed = MimeParser::parse($imap->fetchRaw($uid));
            foreach ($parsed['attachments'] as $attachment) {
                if (hash_equals((string) $attachment['part'], $partId)) {
                    return [
                        'name' => $attachment['filename'],
                        'content_type' => $attachment['content_type'],
                        'content' => $attachment['content'],
                    ];
                }
            }
            throw new \RuntimeException('附件不存在');
        } finally {
            $imap->close();
        }
    }

    public static function mark(string $email, string $password, string $folder, int $uid, bool $seen): void
    {
        if ($uid < 1) throw new \InvalidArgumentException('无效的邮件编号');
        [$imap] = self::connectFolder($email, $password, $folder);
        try {
            $imap->storeSeen($uid, $seen);
        } finally {
            $imap->close();
        }
    }

    public static function delete(string $email, string $password, string $folder, int $uid): void
    {
        if ($uid < 1) throw new \InvalidArgumentException('无效的邮件编号');
        [$imap, $folderName] = self::connectFolder($email, $password, $folder);
        try {
            if (self::keyForFolder($folderName) !== 'trash') {
                $trash = null;
                foreach (self::listFolderNames($imap) as $name) {
                    if (self::keyForFolder($name) === 'trash') { $trash = $name; break; }
                }
                if ($trash !== null) {
                    $copied = false;
                    try {
                        $imap->copyTo($uid, $trash);
                        $copied = true;
                    } catch (\Throwable $ignored) {
                        // Fall through to permanent deletion when COPY is unavailable.
                    }
                    if ($copied) {
                        $imap->markDeleted($uid);
                        $imap->expunge();
                        return;
                    }
                }
            }
            $imap->markDeleted($uid);
            $imap->expunge();
        } finally {
            $imap->close();
        }
    }

    public static function append(string $email, string $password, string $folderKey, string $raw, string $flags = ''): bool
    {
        $imap = self::connect($email, $password, 'INBOX');
        try {
            $names = self::listFolderNames($imap);
            $folder = null;
            foreach ($names as $name) {
                if (self::keyForFolder($name) === $folderKey) { $folder = $name; break; }
            }
            if ($folder === null) {
                $default = ['sent' => 'Sent', 'drafts' => 'Drafts'][$folderKey] ?? null;
                if ($default === null || !$imap->createFolder($default)) return false;
                try { $imap->subscribe($default); } catch (\Throwable $ignored) {}
                $folder = $default;
            }
            return $imap->append($folder, $raw, $flags);
        } finally {
            $imap->close();
        }
    }
}
