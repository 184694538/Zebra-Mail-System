<?php
namespace app\controller;

use think\facade\Config;
use think\facade\Request;

/** 独立的 hMailServer 6.3.7 控制台：不触碰旧业务数据库写入逻辑。 */
class HmailConsole extends BaseController
{
    public function gateway()
    {
        // BaseController 构造函数已验证原后台动态 Token。
        $input = json_decode((string) Request::getInput(), true);
        if (!is_array($input)) {
            return $this->createResponse(400, '请求内容必须是 JSON 对象');
        }

        $resource = (string) ($input['resource'] ?? '');
        $method = strtoupper((string) ($input['method'] ?? 'GET'));
        $domain = trim((string) ($input['domain'] ?? ''));
        $address = trim((string) ($input['address'] ?? ''));
        $id = (string) ($input['id'] ?? '');
        $name = (string) ($input['name'] ?? '');
        $payload = $input['payload'] ?? null;

        // 固定白名单而不是通用反向代理，禁止借此接口调用任意服务/危险管理路由。
        $simple = [
            'status' => '/status',
            'domains' => '/domains',
            'queue' => '/queue',
            'logs' => '/logs',
            'backup' => '/backup',
            'backup_archives' => '/backup/archives',
            'settings' => '/settings',
            'antispam' => '/settings/antispam',
            'antivirus' => '/settings/antivirus',
            'logging' => '/settings/logging',
            'backup_settings' => '/settings/backup',
            'cache' => '/settings/cache',
            'indexing' => '/settings/indexing',
            'scripting' => '/settings/scripting',
            'ports' => '/ports',
            'ipranges' => '/ipranges',
            'routes' => '/routes',
            'rules' => '/rules',
            'certificates' => '/certificates',
            'quarantine' => '/quarantine',
            'dns_blacklists' => '/dns-blacklists',
            'surbl_servers' => '/surbl-servers',
            'whitelist_addresses' => '/whitelist-addresses',
            'blocked_senders' => '/blocked-senders',
            'incoming_relays' => '/incoming-relays',
            'messages' => '/settings/messages',
            'directories' => '/settings/directories',
            'tlsa' => '/tlsa',
            'srv' => '/srv',
            'openapi' => '/openapi.json',
            'ini_settings' => '/settings/ini',
            'groups' => '/groups',
            'greylisting_bypass' => '/greylisting-bypass',
            'greylisting_white_addresses' => '/greylisting-white-addresses',
            'reinitialize' => '/server/reinitialize',
        ];
        $path = $simple[$resource] ?? null;
        $writes = [
            'domains' => ['POST'],
            'groups' => ['POST'],
            'greylisting_bypass' => ['POST'],
            'greylisting_white_addresses' => ['POST'],
            'reinitialize' => ['POST'],
            'dns_blacklists' => ['POST'],
            'surbl_servers' => ['POST'],
            'whitelist_addresses' => ['POST'],
            'blocked_senders' => ['POST'],
            'incoming_relays' => ['POST'],
            'ipranges' => ['POST'],
            'ports' => ['POST'],
            'routes' => ['POST'],
            'rules' => ['POST'],
            'certificates' => ['POST'],
            'backup' => ['POST'],
            // 设置支持通过 JSON 部分更新；未开放危险的 ini/监听器等特殊操作。
            'settings' => ['PUT'],
            'antispam' => ['PUT'],
            'antivirus' => ['PUT'],
            'logging' => ['PUT'],
            'backup_settings' => ['PUT'],
            'cache' => ['PUT'],
            'indexing' => ['PUT'],
            'scripting' => ['PUT'],
        ];

        if (in_array($resource, ['domain', 'accounts', 'aliases', 'lists', 'domain_aliases', 'dkim'], true)) {
            if (!preg_match('/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/', $domain) || strpos($domain, '.') === false) {
                return $this->createResponse(400, '请选择有效域名');
            }
            $base = '/domains/' . rawurlencode($domain);
            $path = match ($resource) {
                'domain' => $base,
                'accounts' => $base . '/accounts',
                'aliases' => $base . '/aliases',
                'lists' => $base . '/lists',
                'domain_aliases' => $base . '/domain-aliases',
                'dkim' => $base . '/dkim',
            };
            if ($resource === 'domain') {
                // 删除仅用于新增的 REST 管理台，不影响旧业务控制器。
                $writes[$resource] = ['DELETE'];
                if ($method === 'DELETE' && ($input['confirm_domain'] ?? '') !== $domain) {
                    return $this->createResponse(400, '永久移除域名必须再次确认准确域名');
                }
            }
            if (in_array($resource, ['accounts', 'aliases', 'lists', 'domain_aliases'], true)) {
                $writes[$resource] = ['POST'];
            }
        } elseif ($resource === 'collection_item') {
            $collections = [
                'dns_blacklists' => 'dns-blacklists',
                'surbl_servers' => 'surbl-servers',
                'whitelist_addresses' => 'whitelist-addresses',
                'blocked_senders' => 'blocked-senders',
                'incoming_relays' => 'incoming-relays',
                'ipranges' => 'ipranges',
                'ports' => 'ports',
                'routes' => 'routes',
                'rules' => 'rules',
                'certificates' => 'certificates',
                'groups' => 'groups',
                'greylisting_bypass' => 'greylisting-bypass',
                'greylisting_white_addresses' => 'greylisting-white-addresses',
            ];
            $collection = (string) ($input['collection'] ?? '');
            if (!isset($collections[$collection]) || !ctype_digit($id) || strlen($id) > 18) {
                return $this->createResponse(400, '无效的管理项目或记录 ID');
            }
            $path = '/' . $collections[$collection] . '/' . $id;
            $writes[$resource] = ['PUT', 'DELETE'];
            // 防止误操作，列表项删除必须携带明确的记录 ID 确认。
            if ($method === 'DELETE' && (string) ($input['confirm_id'] ?? '') !== $id) {
                return $this->createResponse(400, '请确认要删除的记录编号');
            }
        } elseif ($resource === 'account') {
            if (!filter_var($address, FILTER_VALIDATE_EMAIL) || strlen($address) > 254) {
                return $this->createResponse(400, '请输入有效邮箱地址');
            }
            $path = '/accounts/' . rawurlencode($address);
            $writes[$resource] = ['PUT'];
        } elseif ($resource === 'queue_retry') {
            if (!ctype_digit($id) || strlen($id) > 18) {
                return $this->createResponse(400, '无效的队列 ID');
            }
            $path = '/queue/' . $id . '/retry';
            $writes[$resource] = ['POST'];
        } elseif ($resource === 'log') {
            if (!preg_match('/^[a-zA-Z0-9_.-]{1,160}$/', $name) || str_contains($name, '..')) {
                return $this->createResponse(400, '无效日志文件名');
            }
            $lines = max(1, min(2000, (int) ($input['lines'] ?? 100)));
            $path = '/logs/' . rawurlencode($name) . '?lines=' . $lines;
        }

        if ($path === null || ($method !== 'GET' && !in_array($method, $writes[$resource] ?? [], true))) {
            return $this->createResponse(400, '该 API 操作未开放');
        }

        if ($method === 'PUT' && (!is_array($payload) || array_is_list($payload))) {
            return $this->createResponse(400, '更新内容必须是 JSON 对象');
        }
        if ($method === 'POST' && $resource !== 'backup' && $resource !== 'queue_retry' && $resource !== 'reinitialize'
            && (!is_array($payload) || array_is_list($payload))) {
            return $this->createResponse(400, '创建内容必须是 JSON 对象');
        }
        if ($resource === 'reinitialize' && ($input['confirm'] ?? '') !== 'REINITIALIZE') {
            return $this->createResponse(400, '重载邮件服务器需要明确确认');
        }
        if ($resource === 'account' && $method === 'PUT') {
            // 限制可编辑的安全字段，避免更改管理员权限/密码哈希等敏感属性。
            $allowed = ['active', 'first_name', 'last_name', 'max_size_mb'];
            if (array_diff(array_keys($payload), $allowed)) {
                return $this->createResponse(400, '只能修改启用状态、姓名和邮箱配额');
            }
        }
        if ($resource === 'domains' && $method === 'POST') {
            $payload = [
                'name' => trim((string) ($payload['name'] ?? '')),
                'active' => (bool) ($payload['active'] ?? true),
                'postmaster' => (string) ($payload['postmaster'] ?? ''),
            ];
            if (!preg_match('/^[a-zA-Z0-9][a-zA-Z0-9.-]{1,251}[a-zA-Z0-9]$/', $payload['name']) || !str_contains($payload['name'], '.')) {
                return $this->createResponse(400, '域名格式不正确');
            }
        }
        if ($resource === 'accounts' && $method === 'POST') {
            $email = (string) ($payload['address'] ?? '');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !str_ends_with(strtolower($email), '@' . strtolower($domain))
                || !is_string($payload['password'] ?? null) || strlen($payload['password']) < 8) {
                return $this->createResponse(400, '邮箱必须属于当前域名，密码至少 8 位');
            }
        }

        $apiUrl = rtrim((string) Config::get('hmailserver_api.url', ''), '/');
        $parts = parse_url($apiUrl);
        if (!$parts || !in_array($parts['scheme'] ?? '', ['http', 'https'], true)
            || !in_array($parts['host'] ?? '', ['127.0.0.1', 'localhost', '::1'], true)
            || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])
            || !empty($parts['path'])) {
            return $this->createResponse(500, 'hMailServer API URL 必须为本机地址，如 http://127.0.0.1:8045');
        }
        $key = (string) Config::get('hmailserver_api.key', '');
        $password = (string) Config::get('hmailserver_api.password', '');
        if ($key === '' && $password === '') {
            return $this->createResponse(503, '请先在 config/hmailserver_api.php 或 .env 配置 hMailServer API 凭据');
        }

        $json = in_array($method, ['GET', 'DELETE'], true) || in_array($resource, ['backup', 'queue_retry', 'reinitialize'], true)
            ? '' : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json !== '' && strlen($json) > 50000) {
            return $this->createResponse(400, '请求数据太大');
        }
        $headers = ['Accept: application/json', 'Content-Type: application/json', 'Cache-Control: no-store'];
        if ($key !== '') {
            $headers[] = 'Authorization: Bearer ' . $key;
        } else {
            $headers[] = 'Authorization: Basic ' . base64_encode('Administrator:' . $password);
        }

        // PHP 服务端向 127.0.0.1 请求，不转发浏览器 Origin/Sec-Fetch-Site 等跨站头。
        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers) . "\r\n",
                'content' => $json,
                'timeout' => 12,
                'ignore_errors' => true,
                'follow_location' => 0,
                'protocol_version' => 1.1,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $url = $apiUrl . '/api/v1' . $path;
        $body = @file_get_contents($url, false, $context, 0, $resource === 'openapi' ? 8 * 1024 * 1024 : 3 * 1024 * 1024);
        $status = 0;
        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('~^HTTP/\S+\s+(\d{3})~i', $header, $m)) {
                $status = (int) $m[1];
            }
        }
        if ($body === false) {
            return $this->createResponse(503, '无法连接 hMailServer API，请检查 RestApiPort、服务状态及本机地址');
        }
        $decoded = json_decode($body, true);
        $data = json_last_error() === JSON_ERROR_NONE ? $decoded : $body;
        // OpenAPI 是表单元数据，不能把 password/private_key 等字段定义替换成掩码。
        // 其他资源仍隐藏实际响应中的口令、私钥和会话令牌。
        if ($resource !== 'openapi') {
            $data = $this->maskSecrets($data);
        }
        if ($status === 401 || $status === 403) {
            return $this->createResponse(502, 'hMailServer API 鉴权失败或权限不足（上游 HTTP ' . $status . '）', $data);
        }
        if ($status < 200 || $status >= 300) {
            return $this->createResponse(502, 'hMailServer API 返回 HTTP ' . $status, $data);
        }
        return $this->createResponse(200, 'ok', $data);
    }


    /**
     * Control Deck API 适配网关。
     *
     * 浏览器只访问本项目；hMailServer REST API 凭据始终保留在 PHP 服务端。
     * 路径必须命中随项目一同分发的 Control Deck 路由清单，不提供任意 URL 反向代理。
     */
    public function deckGateway()
    {
        $input = json_decode((string) Request::getInput(), true);
        if (!is_array($input)) {
            return $this->createResponse(400, '请求内容必须是 JSON 对象');
        }

        $path = (string) ($input['path'] ?? '');
        $method = strtoupper((string) ($input['method'] ?? 'GET'));
        $raw = !empty($input['raw']);

        if (!in_array($method, ['GET', 'POST', 'PUT', 'DELETE'], true)) {
            return $this->createResponse(405, '不支持的 API 请求方法');
        }
        if ($path === '' || strlen($path) > 4096 || !str_starts_with($path, '/api/v1/')) {
            return $this->createResponse(400, '无效的 hMailServer API 路径');
        }
        if (preg_match('/%(?:2f|5c|00)/i', $path) || str_contains($path, '\\')) {
            return $this->createResponse(400, 'API 路径包含不允许的编码字符');
        }

        $parts = parse_url($path);
        if (!$parts || isset($parts['scheme']) || isset($parts['host']) || isset($parts['user'])
            || isset($parts['pass']) || isset($parts['fragment'])) {
            return $this->createResponse(400, 'API 路径格式不正确');
        }
        $apiPath = (string) ($parts['path'] ?? '');
        $decodedPath = rawurldecode($apiPath);
        foreach (explode('/', $decodedPath) as $segment) {
            if ($segment === '.' || $segment === '..') {
                return $this->createResponse(400, 'API 路径包含不允许的目录段');
            }
        }

        // 来自随项目提供的 Control Deck 源码中的 API 路由；{segment} 只匹配单一路径段。
        $routeTemplates = [
            '/api/v1/accounts',
            '/api/v1/accounts/{segment}',
            '/api/v1/accounts/{segment}/devices',
            '/api/v1/accounts/{segment}/devices/{segment}',
            '/api/v1/accounts/{segment}/directory/photo',
            '/api/v1/accounts/{segment}/export.zip',
            '/api/v1/accounts/{segment}/fetch-accounts',
            '/api/v1/accounts/{segment}/fetch-accounts/{segment}',
            '/api/v1/accounts/{segment}/folders',
            '/api/v1/accounts/{segment}/folders/{segment}/permissions',
            '/api/v1/accounts/{segment}/folders/{segment}/permissions/{segment}',
            '/api/v1/accounts/{segment}/openpgp',
            '/api/v1/addresses/erase',
            '/api/v1/aliases',
            '/api/v1/apikeys',
            '/api/v1/archive',
            '/api/v1/audit',
            '/api/v1/audit/verify',
            '/api/v1/audit/{segment}/revert',
            '/api/v1/backup',
            '/api/v1/backup/archives',
            '/api/v1/backup/restore',
            '/api/v1/backup/restore-mailbox',
            '/api/v1/backup/restore-mailbox/{segment}',
            '/api/v1/backup/{segment}/mailboxes/{segment}',
            '/api/v1/backup/{segment}/mailboxes/{segment}/restore',
            '/api/v1/blocked-attachments',
            '/api/v1/blocked-senders',
            '/api/v1/bounces/expire',
            '/api/v1/certificates',
            '/api/v1/complaints/expire',
            '/api/v1/diagnostics/run',
            '/api/v1/discovery/cases',
            '/api/v1/discovery/cases/{segment}',
            '/api/v1/discovery/cases/{segment}/searches',
            '/api/v1/dns-blacklists',
            '/api/v1/domain-policy-list',
            '/api/v1/domains',
            '/api/v1/domains/{segment}',
            '/api/v1/domains/{segment}/aliases',
            '/api/v1/domains/{segment}/bounces',
            '/api/v1/domains/{segment}/complaints',
            '/api/v1/domains/{segment}/dkim/rotation',
            '/api/v1/domains/{segment}/dkim/rotation/check',
            '/api/v1/domains/{segment}/dkim/rotation/next',
            '/api/v1/domains/{segment}/dkim/rotation/retire',
            '/api/v1/domains/{segment}/dkim/rotation/start',
            '/api/v1/domains/{segment}/dkim/rotation/switch',
            '/api/v1/domains/{segment}/dkim/rotation/{segment}',
            '/api/v1/domains/{segment}/dmarc-reports',
            '/api/v1/domains/{segment}/dmarc-reports/summary',
            '/api/v1/domains/{segment}/domain-aliases',
            '/api/v1/domains/{segment}/lists',
            '/api/v1/domains/{segment}/openpgp',
            '/api/v1/domains/{segment}/rules',
            '/api/v1/domains/{segment}/sender-list',
            '/api/v1/domains/{segment}/spam-traps',
            '/api/v1/domains/{segment}/suppressions',
            '/api/v1/domains/{segment}/tls-reports',
            '/api/v1/domains/{segment}/tls-reports/{segment}',
            '/api/v1/greylisting-bypass',
            '/api/v1/greylisting-white-addresses',
            '/api/v1/groups',
            '/api/v1/groups/{segment}',
            '/api/v1/groups/{segment}/members',
            '/api/v1/help',
            '/api/v1/help/{segment}',
            '/api/v1/inbound-webhooks',
            '/api/v1/inbound-webhooks/deliveries',
            '/api/v1/inbound-webhooks/deliveries/{segment}',
            '/api/v1/inbound-webhooks/deliveries/{segment}/message',
            '/api/v1/inbound-webhooks/deliveries/{segment}/retry',
            '/api/v1/inbound-webhooks/run',
            '/api/v1/inbound-webhooks/{segment}',
            '/api/v1/incoming-relays',
            '/api/v1/ipranges',
            '/api/v1/ipranges/{segment}',
            '/api/v1/journal-rules',
            '/api/v1/lists',
            '/api/v1/lists/{segment}',
            '/api/v1/logs',
            '/api/v1/logs/sessions',
            '/api/v1/logs/sessions/{segment}',
            '/api/v1/metrics/history',
            '/api/v1/migrations',
            '/api/v1/migrations/{segment}/jobs',
            '/api/v1/migrations/{segment}/jobs/{segment}',
            '/api/v1/migrations/{segment}/jobs/{segment}/report',
            '/api/v1/migrations/{segment}/jobs/{segment}/signin',
            '/api/v1/migrations/{segment}/summary.csv',
            '/api/v1/never-ban-names',
            '/api/v1/never-ban-names/check',
            '/api/v1/openapi.json',
            '/api/v1/passkeys',
            '/api/v1/passkeys/challenge',
            '/api/v1/passkeys/options',
            '/api/v1/ports',
            '/api/v1/ports/{segment}',
            '/api/v1/quarantine',
            '/api/v1/quarantine/bulk',
            '/api/v1/quarantine/expire',
            '/api/v1/quarantine/{segment}/release',
            '/api/v1/queue',
            '/api/v1/queue/shaping',
            '/api/v1/queue/shaping/{segment}',
            '/api/v1/queue/{segment}',
            '/api/v1/queue/{segment}/retry',
            '/api/v1/remote-domains',
            '/api/v1/remote-domains/verification-cache/clear',
            '/api/v1/remote-domains/{segment}',
            '/api/v1/reports',
            '/api/v1/reports/summary',
            '/api/v1/reputation',
            '/api/v1/reputation/check',
            '/api/v1/review',
            '/api/v1/review/{segment}',
            '/api/v1/role-assignments',
            '/api/v1/roles',
            '/api/v1/routes',
            '/api/v1/routes/{segment}',
            '/api/v1/rules',
            '/api/v1/sandbox/held',
            '/api/v1/sandbox/held/{segment}',
            '/api/v1/sender-list',
            '/api/v1/server/drain',
            '/api/v1/server/reinitialize',
            '/api/v1/server/settings/pending',
            '/api/v1/session',
            '/api/v1/settings',
            '/api/v1/settings/antispam',
            '/api/v1/settings/antivirus',
            '/api/v1/settings/backup',
            '/api/v1/settings/bounces',
            '/api/v1/settings/breach-check/test',
            '/api/v1/settings/cache',
            '/api/v1/settings/cache/clear',
            '/api/v1/settings/changed',
            '/api/v1/settings/complaints',
            '/api/v1/settings/indexing',
            '/api/v1/settings/indexing/clear',
            '/api/v1/settings/indexing/index',
            '/api/v1/settings/ini',
            '/api/v1/settings/ini/{segment}',
            '/api/v1/settings/logging',
            '/api/v1/settings/messages',
            '/api/v1/settings/messages/{segment}',
            '/api/v1/settings/openpgp',
            '/api/v1/settings/profiles',
            '/api/v1/settings/profiles/decline',
            '/api/v1/settings/profiles/discard',
            '/api/v1/settings/profiles/revert',
            '/api/v1/settings/profiles/{segment}',
            '/api/v1/settings/profiles/{segment}/apply',
            '/api/v1/settings/push',
            '/api/v1/settings/push/vapid',
            '/api/v1/settings/scripting',
            '/api/v1/settings/scripting/check',
            '/api/v1/settings/scripting/reload',
            '/api/v1/setup/checklist',
            '/api/v1/setup/sample-domain',
            '/api/v1/signin-methods',
            '/api/v1/spam-traps',
            '/api/v1/spam-traps/hits',
            '/api/v1/srv',
            '/api/v1/status',
            '/api/v1/store',
            '/api/v1/surbl-servers',
            '/api/v1/tlsa',
            '/api/v1/update',
            '/api/v1/warmup',
            '/api/v1/warmup/{segment}',
            '/api/v1/webhooks',
            '/api/v1/webhooks/deliveries',
            '/api/v1/webhooks/deliveries/{segment}',
            '/api/v1/webhooks/run',
            '/api/v1/webhooks/test',
            '/api/v1/webhooks/{segment}',
            '/api/v1/whitelist-addresses',
            '/api/v1/accounts/{segment}/review/unlock',
            '/api/v1/accounts/{segment}/fetch-accounts/{segment}/download',
            '/api/v1/archive/{segment}/hold',
            '/api/v1/discovery/cases/{segment}/searches/{segment}/export',
            '/api/v1/discovery/cases/{segment}/close',
            '/api/v1/migrations/{segment}/{segment}',
            '/api/v1/migrations/{segment}/jobs/{segment}/{segment}',
            '/api/v1/review/{segment}/release',
            '/api/v1/sandbox/held/{segment}/release',
            '/api/v1/update/{segment}',
                    '/api/v1/accounts/{segment}/booking-policy',
            '/api/v1/accounts/{segment}/directory',
            '/api/v1/accounts/{segment}/mailbox-encryption',
            '/api/v1/accounts/{segment}/mailbox-encryption/recover',
            '/api/v1/accounts/{segment}/move',
            '/api/v1/accounts/{segment}/password',
            '/api/v1/accounts/{segment}/push',
            '/api/v1/accounts/{segment}/recovery',
            '/api/v1/accounts/{segment}/recovery/codes',
            '/api/v1/accounts/{segment}/review',
            '/api/v1/accounts/{segment}/unlock',
            '/api/v1/accounts/{segment}/openpgp/{segment}',
            '/api/v1/accounts/{segment}/devices/{segment}/revoke',
            '/api/v1/aliases/{segment}',
            '/api/v1/apikeys/{segment}',
            '/api/v1/certificates/{segment}',
            '/api/v1/domains/{segment}/accounts',
            '/api/v1/domains/{segment}/mailbox-recovery',
            '/api/v1/domains/{segment}/domain-aliases/{segment}',
            '/api/v1/domains/{segment}/sender-list/{segment}',
            '/api/v1/domains/{segment}/smime-ca',
            '/api/v1/domains/{segment}/smime-ca/rotate',
            '/api/v1/domains/{segment}/smime-ca/issued/{segment}',
            '/api/v1/domains/{segment}/spam-traps/hits',
            '/api/v1/domains/{segment}/suppressions/{segment}',
            '/api/v1/domains/{segment}/dmarc-reports/{segment}',
            '/api/v1/domains/{segment}/rules/{segment}',
            '/api/v1/groups/{segment}/members/{segment}',
            '/api/v1/journal-rules/{segment}',
            '/api/v1/lists/{segment}/members',
            '/api/v1/lists/{segment}/members/{segment}/approve',
            '/api/v1/lists/{segment}/members/{segment}/reset-bounces',
            '/api/v1/logs/{segment}',
            '/api/v1/migrations/{segment}',
            '/api/v1/passkeys/{segment}',
            '/api/v1/quarantine/{segment}/headers',
            '/api/v1/quarantine/{segment}/preview',
            '/api/v1/role-assignments/{segment}',
            '/api/v1/roles/{segment}',
            '/api/v1/spam-traps/{segment}',
            '/api/v1/archive/{segment}',
            '/api/v1/discovery/cases/{segment}/holds',
            '/api/v1/discovery/cases/{segment}/holds/{segment}',
            '/api/v1/reports/{segment}',
            '/api/v1/rules/{segment}',
];
        $allowedRoute = false;
        foreach ($routeTemplates as $template) {
            $quoted = preg_quote($template, '~');
            $pattern = '~^' . str_replace('\\{segment\\}', '[^/]+', $quoted) . '/?$~D';
            if (preg_match($pattern, $apiPath)) {
                $allowedRoute = true;
                break;
            }
        }
        if (!$allowedRoute) {
            return $this->createResponse(400, '该 Control Deck API 路由未开放');
        }

        // 只接受普通查询参数，限制长度，避免借查询串传入额外请求结构。
        $query = (string) ($parts['query'] ?? '');
        if (strlen($query) > 2048 || preg_match('/[\x00-\x1F#]/', $query)) {
            return $this->createResponse(400, 'API 查询参数过长或格式不正确');
        }
        if ($query !== '') {
            parse_str($query, $queryParams);
            foreach ($queryParams as $key => $value) {
                if (!preg_match('/^[A-Za-z][A-Za-z0-9_-]{0,39}$/', (string) $key)) {
                    return $this->createResponse(400, 'API 查询参数名称不合法');
                }
                $values = is_array($value) ? $value : [$value];
                if (count($values) > 100) {
                    return $this->createResponse(400, 'API 查询参数数量过多');
                }
                foreach ($values as $item) {
                    if (!is_scalar($item) || strlen((string) $item) > 1024) {
                        return $this->createResponse(400, 'API 查询参数值不合法');
                    }
                }
            }
        }

        if ($raw && $method !== 'GET') {
            return $this->createResponse(400, '文件读取只允许 GET 请求');
        }

        $hasBody = array_key_exists('body', $input) && $input['body'] !== null;
        $payload = $input['body'] ?? null;
        if ($payload === null) {
            $body = '';
        } elseif (is_string($payload)) {
            $body = $payload;
        } else {
            $body = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }
        if ($body === false || strlen($body) > 5 * 1024 * 1024) {
            return $this->createResponse(400, '请求数据超过 5 MB 或无法编码');
        }
        if (in_array($method, ['GET', 'DELETE'], true) && $body !== '') {
            return $this->createResponse(400, 'GET/DELETE 请求不接受请求正文');
        }

        $apiUrl = rtrim((string) Config::get('hmailserver_api.url', ''), '/');
        $partsUrl = parse_url($apiUrl);
        if (!$partsUrl || !in_array($partsUrl['scheme'] ?? '', ['http', 'https'], true)
            || !in_array($partsUrl['host'] ?? '', ['127.0.0.1', 'localhost', '::1'], true)
            || isset($partsUrl['user']) || isset($partsUrl['pass']) || isset($partsUrl['query'])
            || isset($partsUrl['fragment']) || !empty($partsUrl['path'])) {
            return $this->createResponse(500, 'hMailServer API URL 必须为本机地址，如 http://127.0.0.1:8045');
        }

        $key = (string) Config::get('hmailserver_api.key', '');
        $password = (string) Config::get('hmailserver_api.password', '');
        if ($key === '' && $password === '') {
            return $this->createResponse(503, '请先配置 hMailServer API 凭据');
        }

        $headers = ['Accept: application/json, text/plain, */*', 'Cache-Control: no-store'];
        if ($method !== 'GET') {
            $headers[] = 'X-Requested-With: hMailServer';
        }
        if ($hasBody) {
            $headers[] = 'Content-Type: application/json';
        }
        if ($key !== '') {
            $headers[] = 'Authorization: Bearer ' . $key;
        } else {
            $headers[] = 'Authorization: Basic ' . base64_encode('Administrator:' . $password);
        }
        $otp = (string) ($input['headers']['X-hMailServer-OTP'] ?? '');
        if ($otp !== '') {
            if (!preg_match('/^[0-9]{4,10}$/', $otp)) {
                return $this->createResponse(400, '一次性验证码格式不正确');
            }
            $headers[] = 'X-hMailServer-OTP: ' . $otp;
        }

        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $headers) . "\r\n",
                'content' => $body,
                // Fast connection probes must not monopolize PHP workers for 30s.
                // Keep longer allowances for writes, streaming, and other GET calls.
                'timeout' => $raw ? 60
                    : (in_array($apiPath, ['/api/v1/status', '/api/v1/session'], true) ? 6
                        : ($method === 'GET' ? 15 : 25)),
                'ignore_errors' => true,
                'follow_location' => 0,
                'protocol_version' => 1.1,
            ],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);

        $upstreamUrl = $apiUrl . $path;
        $maxBytes = $raw ? 50 * 1024 * 1024 : 10 * 1024 * 1024;
        $responseBody = @file_get_contents($upstreamUrl, false, $context, 0, $maxBytes);
        $upstreamStatus = 0;
        $contentType = 'application/octet-stream';
        $contentDisposition = '';
        foreach ($http_response_header ?? [] as $header) {
            if (preg_match('~^HTTP/\S+\s+(\d{3})~i', $header, $match)) {
                $upstreamStatus = (int) $match[1];
            } elseif (stripos($header, 'Content-Type:') === 0) {
                $candidate = trim(substr($header, strlen('Content-Type:')));
                if (preg_match('~^[A-Za-z0-9.+-]+/[A-Za-z0-9.+-]+(?:\s*;[^\\r\\n]*)?$~', $candidate)) {
                    $contentType = $candidate;
                }
            } elseif (stripos($header, 'Content-Disposition:') === 0) {
                $candidate = trim(substr($header, strlen('Content-Disposition:')));
                if (!preg_match('/[\r\n]/', $candidate) && strlen($candidate) < 512) {
                    $contentDisposition = $candidate;
                }
            }
        }

        if ($responseBody === false) {
            return $this->createResponse(503, '无法连接 hMailServer API，请检查服务状态、RestApiPort 和本机凭据');
        }

        if ($upstreamStatus < 200 || $upstreamStatus >= 300) {
            $decodedError = json_decode($responseBody, true);
            $errorData = json_last_error() === JSON_ERROR_NONE ? $this->maskSecrets($decodedError) : null;
            $upstreamMessage = is_array($decodedError)
                ? (string) ($decodedError['error'] ?? $decodedError['message'] ?? '')
                : '';
            $message = $upstreamMessage !== '' ? $upstreamMessage : 'hMailServer API 返回 HTTP ' . $upstreamStatus;
            if ($raw) {
                return response(json_encode([
                    'message' => $message,
                    'data' => $errorData,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 502, [
                    'Content-Type' => 'application/json; charset=utf-8',
                    'Cache-Control' => 'no-store',
                ]);
            }
            return $this->createResponse(502, $message, $errorData);
        }

        if ($raw) {
            $downloadHeaders = [
                'Content-Type' => $contentType,
                'Cache-Control' => 'no-store, private',
                'X-Content-Type-Options' => 'nosniff',
            ];
            if ($contentDisposition !== '') {
                $downloadHeaders['Content-Disposition'] = $contentDisposition;
            }
            return response($responseBody, 200, $downloadHeaders);
        }

        if ($responseBody === '') {
            $data = new \stdClass();
        } else {
            $decoded = json_decode($responseBody, true);
            $data = json_last_error() === JSON_ERROR_NONE ? $decoded : $responseBody;
        }
        if ($apiPath !== '/api/v1/openapi.json') {
            $data = $this->maskSecrets($data);
        }
        return $this->createResponse(200, 'ok', $data);
    }

    private function maskSecrets($value)
    {
        if (!is_array($value)) return $value;
        foreach ($value as $key => &$item) {
            if (is_string($key) && preg_match('/password|secret|private.?key|(?:^|_)token$|authorization/i', $key)) {
                $item = '（敏感字段已隐藏）';
            } else {
                $item = $this->maskSecrets($item);
            }
        }
        return $value;
    }
}
