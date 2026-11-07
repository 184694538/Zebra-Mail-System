<?php
namespace app\service;

/** Small RFC 2045/2047 MIME reader used by the socket-based webmail client. */
class MimeParser
{
    public static function parseHeaders(string $raw): array
    {
        $raw = preg_replace("/\r\n[ \t]+|\n[ \t]+/", ' ', $raw);
        $headers = [];
        foreach (preg_split('/\r?\n/', $raw) as $line) {
            if ($line === '' || $line[0] === ' ' || $line[0] === "\t") continue;
            $pos = strpos($line, ':');
            if ($pos === false) continue;
            $name = strtolower(trim(substr($line, 0, $pos)));
            if ($name === '') continue;
            $value = trim(substr($line, $pos + 1));
            if (isset($headers[$name])) $headers[$name] .= ', ' . $value;
            else $headers[$name] = $value;
        }
        return $headers;
    }

    public static function decodeHeader(?string $value): string
    {
        if ($value === null || $value === '') return '';
        if (!preg_match('/=\?[^?]+\?[bq]\?/i', $value)) return $value;
        if (function_exists('iconv_mime_decode')) {
            $decoded = @iconv_mime_decode($value, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
            if (is_string($decoded)) return trim($decoded);
        }
        $decoded = preg_replace_callback('/=\?([^?]+)\?([bq])\?([^?]*)\?=/i', static function ($match) {
            $charset = $match[1];
            if (strtolower($match[2]) === 'b') {
                $bytes = base64_decode($match[3], false);
                if ($bytes === false) return $match[0];
            } else {
                $bytes = quoted_printable_decode(str_replace('_', ' ', $match[3]));
            }
            if (strtoupper($charset) !== 'UTF-8' && function_exists('iconv')) {
                $converted = @iconv($charset, 'UTF-8//IGNORE', $bytes);
                if ($converted !== false) return $converted;
            }
            return $bytes;
        }, $value);
        return is_string($decoded) ? trim($decoded) : $value;
    }

    public static function addressList(string $value): array
    {
        $value = self::decodeHeader($value);
        $items = preg_split('/,(?=(?:[^"]*"[^"]*")*[^"]*$)/', $value) ?: [];
        $result = [];
        foreach ($items as $item) {
            $item = trim($item);
            if ($item === '') continue;
            $name = '';
            $email = $item;
            if (preg_match('/^(.*?)<\s*([^<>]+)\s*>$/', $item, $match)) {
                $name = trim($match[1], " \t\"'");
                $email = trim($match[2]);
            }
            $email = trim($email, " \t\r\n<>");
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
            $result[] = ['name' => self::decodeHeader($name), 'email' => $email];
        }
        return $result;
    }

    public static function parse(string $raw): array
    {
        [$headerBlock] = self::splitEntity($raw);
        $headers = self::parseHeaders($headerBlock);
        $parts = ['html' => '', 'text' => '', 'attachments' => []];
        self::parseEntity($raw, '', $parts);
        if ($parts['html'] === '' && $parts['text'] === '') {
            [, $rootBody] = self::splitEntity($raw);
            $parts['text'] = self::decodeTransfer($rootBody, $headers['content-transfer-encoding'] ?? '');
            $parts['text'] = self::decodeCharset($parts['text'], self::contentTypeInfo($headers['content-type'] ?? 'text/plain'));
        }
        return [
            'headers' => $headers,
            'subject' => self::decodeHeader($headers['subject'] ?? '') ?: '（无主题）',
            'from' => self::addressList($headers['from'] ?? ''),
            'to' => self::addressList($headers['to'] ?? ''),
            'cc' => self::addressList($headers['cc'] ?? ''),
            'reply_to' => self::addressList($headers['reply-to'] ?? ''),
            'date' => (string) ($headers['date'] ?? ''),
            'message_id' => trim((string) ($headers['message-id'] ?? ''), " <>\t\r\n"),
            'html' => $parts['html'],
            'text' => $parts['text'],
            'attachments' => $parts['attachments'],
        ];
    }

    public static function headerMayHaveAttachment(string $headerRaw): bool
    {
        $headers = self::parseHeaders($headerRaw);
        $contentType = strtolower($headers['content-type'] ?? '');
        return str_contains($contentType, 'multipart/mixed')
            || str_contains($contentType, 'multipart/related')
            || str_contains(strtolower($headers['content-disposition'] ?? ''), 'attachment');
    }

    private static function splitEntity(string $raw): array
    {
        $pos = strpos($raw, "\r\n\r\n");
        $separatorLength = 4;
        if ($pos === false) {
            $pos = strpos($raw, "\n\n");
            $separatorLength = 2;
        }
        if ($pos === false) return [$raw, ''];
        return [substr($raw, 0, $pos), substr($raw, $pos + $separatorLength)];
    }

    private static function parseEntity(string $raw, string $section, array &$result): void
    {
        [$headerBlock, $body] = self::splitEntity($raw);
        $headers = self::parseHeaders($headerBlock);
        $contentType = self::contentTypeInfo($headers['content-type'] ?? 'text/plain');
        $disposition = self::contentTypeInfo($headers['content-disposition'] ?? '');
        $type = strtolower($contentType['type']);
        $subtype = strtolower($contentType['subtype']);
        $filename = self::parameterFilename($disposition['params'] ?? []);
        if ($filename === '') $filename = self::parameterFilename($contentType['params'] ?? []);
        $isAttachment = $filename !== '' || $disposition['type'] === 'attachment';

        if ($type === 'multipart') {
            $boundary = (string) ($contentType['params']['boundary'] ?? '');
            if ($boundary === '' || strlen($boundary) > 200) return;
            $chunks = explode('--' . $boundary, $body);
            array_shift($chunks);
            $partNumber = 0;
            foreach ($chunks as $chunk) {
                $chunk = ltrim($chunk, "\r\n");
                if (str_starts_with($chunk, '--')) break;
                $chunk = preg_replace('/\r?\n$/', '', $chunk);
                if (trim($chunk) === '') continue;
                $partNumber++;
                $childSection = $section === '' ? (string) $partNumber : $section . '.' . $partNumber;
                self::parseEntity($chunk, $childSection, $result);
            }
            return;
        }

        $encoding = strtolower(trim($headers['content-transfer-encoding'] ?? ''));
        $decoded = self::decodeTransfer($body, $encoding);
        if ($isAttachment || ($type !== 'text' && $type !== 'message')) {
            $safeName = $filename !== '' ? $filename : 'attachment';
            $result['attachments'][] = [
                'part' => $section !== '' ? $section : '1',
                'filename' => $safeName,
                'content_type' => $contentType['type'] !== '' ? $contentType['type'] . '/' . $contentType['subtype'] : 'application/octet-stream',
                'size' => strlen($decoded),
                'content' => $decoded,
            ];
            return;
        }

        if ($type === 'message' && $subtype === 'rfc822') {
            self::parseEntity($decoded, $section !== '' ? $section . '.1' : '1', $result);
            return;
        }

        if ($type === 'text') {
            $decoded = self::decodeCharset($decoded, $contentType);
            if ($subtype === 'html' && $result['html'] === '') {
                $result['html'] = self::limitBody($decoded);
            } elseif ($subtype === 'plain' && $result['text'] === '') {
                $result['text'] = self::limitBody($decoded);
            }
        }
    }

    private static function limitBody(string $body): string
    {
        return strlen($body) > 2 * 1024 * 1024 ? substr($body, 0, 2 * 1024 * 1024) : $body;
    }

    private static function contentTypeInfo(string $value): array
    {
        $segments = preg_split('/;\s*(?=(?:[^"]*"[^"]*")*[^"]*$)/', $value) ?: [];
        $main = strtolower(trim((string) array_shift($segments)));
        $type = 'application';
        $subtype = 'octet-stream';
        if (strpos($main, '/') !== false) {
            [$type, $subtype] = array_map('trim', explode('/', $main, 2));
        }
        $params = [];
        foreach ($segments as $segment) {
            $pos = strpos($segment, '=');
            if ($pos === false) continue;
            $key = strtolower(trim(substr($segment, 0, $pos)));
            $param = trim(substr($segment, $pos + 1));
            if (strlen($param) >= 2 && $param[0] === '"' && substr($param, -1) === '"') {
                $param = stripcslashes(substr($param, 1, -1));
            }
            $params[$key] = $param;
        }
        return ['type' => $type, 'subtype' => $subtype, 'params' => $params];
    }

    private static function parameterFilename(array $params): string
    {
        foreach (['filename*', 'name*'] as $key) {
            if (!empty($params[$key])) {
                $value = (string) $params[$key];
                if (preg_match("/^([^']*)'[^']*'(.*)$/", $value, $match)) {
                    $charset = $match[1];
                    $value = rawurldecode($match[2]);
                    if ($charset !== '' && strtoupper($charset) !== 'UTF-8' && function_exists('iconv')) {
                        $converted = @iconv($charset, 'UTF-8//IGNORE', $value);
                        if ($converted !== false) $value = $converted;
                    }
                }
                return self::decodeHeader($value);
            }
        }
        foreach (['filename', 'name'] as $key) {
            if (!empty($params[$key])) return self::decodeHeader((string) $params[$key]);
        }
        return '';
    }

    private static function decodeTransfer(string $body, string $encoding): string
    {
        if ($encoding === 'base64') {
            $decoded = base64_decode(preg_replace('/\s+/', '', $body), false);
            return $decoded === false ? '' : $decoded;
        }
        if ($encoding === 'quoted-printable') return quoted_printable_decode($body);
        return $body;
    }

    private static function decodeCharset(string $body, array $contentType): string
    {
        $charset = trim((string) ($contentType['params']['charset'] ?? ''), " \t\"'");
        if ($charset !== '' && strtoupper($charset) !== 'UTF-8' && function_exists('iconv')) {
            $converted = @iconv($charset, 'UTF-8//IGNORE', $body);
            if ($converted !== false) return $converted;
        }
        return $body;
    }
}
