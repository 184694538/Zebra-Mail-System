<?php
namespace app\controller;

use think\facade\Db;
use think\facade\Request;
use think\facade\Config;
use app\service\WebmailPasswordSetting;
use app\service\PrivateMailConfig;
use app\service\MailApiSettings;
use app\service\AdminAuthSettings;
use app\service\ThemeSettings;
use app\service\LoginCryptoService;
use app\service\AdminLoginRateLimiter;

class Admin extends BaseController
{
    /** 统一返回 IP 封禁提示，HTTP 429 与 Retry-After 便于前端识别。 */
    private function adminLoginBlocked(int $seconds)
    {
        $minutes = intdiv($seconds, 60);
        $remainSeconds = $seconds % 60;
        $message = "当前 IP 登录失败次数过多，已限制登录，请在 {$minutes} 分 {$remainSeconds} 秒后重试";
        return json(['status' => false, 'message' => $message, 'retry_after' => $seconds])
            ->code(429)
            ->header(['Retry-After' => (string) $seconds, 'Cache-Control' => 'no-store']);
    }

    // 从 config_private/admin_auth.php 读取管理员凭据（兼容历史哈希和新的明文密码）。
    public function logon()
    {
        // 使用 Web 服务器确认的 REMOTE_ADDR 作为真实客户端 IP；不直接信任客户端可伪造的代理请求头。
        $clientIp = (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        try {
            $retryAfter = AdminLoginRateLimiter::check($clientIp);
            if ($retryAfter > 0) {
                return $this->adminLoginBlocked($retryAfter);
            }
        } catch (\Throwable $e) {
            error_log('Admin login rate limiter unavailable: ' . get_class($e));
            return json(['status' => false, 'message' => '登录安全服务不可用，请稍后重试'])
                ->code(503)->header(['Cache-Control' => 'no-store']);
        }

        $username = trim((string) Request::post('username', ''));
        // 只接受登录密文，不接受旧 password 明文字段。
        try {
            $password = LoginCryptoService::decryptPassword(
                'admin',
                $username,
                (string) Request::post('key_id', ''),
                (string) Request::post('encrypted_password', '')
            );
        } catch (\Throwable $e) {
            // 无效密文/挑战不属于已验证的“账号或密码错误”，仍拒绝请求但不计失败次数。
            return json(['status' => false, 'message' => '登录安全验证失败，请重新尝试']);
        }
        $credentials = AdminAuthSettings::get();
        $configuredUser = (string) ($credentials['username'] ?? '');
        if ($configuredUser === '' || (string) ($credentials['password'] ?? '') === '') {
            return json(['status' => false, 'message' => '管理员配置不可用，请检查 config_private 写入权限及迁移状态']);
        }

        try {
            // 再次检查封禁状态并串行校验密码，防止并发登录越过 10 次门槛。
            $result = AdminLoginRateLimiter::verify($clientIp, static function () use ($username, $password): bool {
                return AdminAuthSettings::verify($username, $password);
            });
        } catch (\Throwable $e) {
            error_log('Admin login rate limiter failed: ' . get_class($e));
            return json(['status' => false, 'message' => '登录安全服务不可用，请稍后重试'])
                ->code(503)->header(['Cache-Control' => 'no-store']);
        }
        if ($result['retry_after'] > 0) {
            return $this->adminLoginBlocked($result['retry_after']);
        }
        if (!$result['authenticated']) {
            return json(['status' => false, 'message' => '账号或密码错误']);
        }

        $token = bin2hex(random_bytes(32));
        // 绑定本次认证所用凭据版本，避免改密并发期间颁发有效旧会话。
        if (!$this->saveAdminSession($token, (string) ($credentials['auth_version'] ?? ''))) {
            return json(['status' => false, 'message' => '无法保存登录状态，请检查 config_private 目录写入权限']);
        }

        return json([
            'status' => true,
            'message' => '登录成功',
            'username' => $configuredUser,
            'token' => $token,
            'must_change_password' => AdminAuthSettings::requiresDefaultPasswordChange(),
        ])->header(['Cache-Control' => 'no-store']);
    }

    // 退出时撤销服务端 Token；仅清理浏览器存储不能使 Token 失效。
    public function logout()
    {
        $token = (string) Request::header('Token', '');
        if (!$this->revokeAdminSession($token)) {
            return $this->createResponse(401, '登录已失效');
        }

        return $this->createResponse(200, '退出成功');
    }

    // 沿用前端原有响应字段，不再请求第三方授权服务。
    public function tokenValidityCheck()
    {
        // 首次安装可能尚未初始化 hMailServer 数据库，改密状态不能依赖数据库查询。
        if (AdminAuthSettings::requiresDefaultPasswordChange()) {
            return json([
                'status' => true,
                'username' => (string) (AdminAuthSettings::get()['username'] ?? ''),
                'must_change_password' => true,
            ])->header(['Cache-Control' => 'no-store']);
        }

        return json([
            'status' => true,
            'username' => (string) (AdminAuthSettings::get()['username'] ?? ''),
            'must_change_password' => false,
            'expiration_time' => date('Y-m-d H:i:s', time() + 36000),
            'domainCount' => Db::table('hm_domains')->count(),
            'domainname' => Db::table('hm_domains')->column('domainname'),
            'emailCount' => Db::table('hm_accounts')->count(),
            'mainEmail' => Db::table('hm_settings')->where('settingname', 'mirroremailaddress')->value('settingstring') ?: '',
        ]);
    }

    /** Admin > 邮箱与系统设置：读取 Webmail 自助修改密码开关。 */
    public function getWebmailPasswordSetting()
    {
        return $this->createResponse(200, 'ok', [
            'enabled' => WebmailPasswordSetting::enabled(),
        ]);
    }

    /** 仅允许后台管理员修改独立 JSON 配置文件。 */
    public function setWebmailPasswordSetting()
    {
        $value = (string) Request::post('enabled', '');
        if ($value !== '0' && $value !== '1') {
            return $this->createResponse(400, '开关参数无效');
        }
        if (!WebmailPasswordSetting::save($value === '1')) {
            return $this->createResponse(500, '配置保存失败，请检查 config_private/webmail_password.json 写入权限');
        }
        return $this->createResponse(200, $value === '1' ? 'Webmail 修改密码功能已开启' : 'Webmail 修改密码功能已关闭', [
            'enabled' => $value === '1',
        ]);
    }

    /** API 密钥管理页面：读取独立的全局 API 设置。 */
    public function getMailApiSettings()
    {
        return $this->createResponse(200, 'ok', MailApiSettings::get());
    }

    /** 管理员可修改全局开关与美化页面邮件数量，不触碰 API 密钥。 */
    public function setMailApiSettings()
    {
        $enabled = (string) Request::post('enabled', '');
        if ($enabled !== '0' && $enabled !== '1') {
            return $this->createResponse(400, '是否启用 API 参数无效');
        }

        // 不传或留空时使用默认 1；最大 100，不能绕过页面直接提交其他值。
        $raw = Request::post('max_emails', '');
        if (!is_string($raw) && !is_numeric($raw)) {
            return $this->createResponse(400, '最多显示邮件数量必须为 1～100 的整数或留空');
        }
        $raw = trim((string) $raw);
        if ($raw === '') {
            $max = 1;
        } elseif (preg_match('/\A(?:100|[1-9][0-9]?)\z/D', $raw)) {
            $max = (int) $raw;
        } else {
            return $this->createResponse(400, '最多显示邮件数量必须为 1～100 的整数或留空');
        }

        if ($enabled === '1' && !MailApiSettings::hasConfiguredKey()) {
            return $this->createResponse(400, '请先在 API 管理页面配置至少一个有效密钥，再手动启用 API');
        }
        if (!MailApiSettings::save($enabled === '1', $max)) {
            return $this->createResponse(500, '保存失败，请检查 config_private/mail_api_settings.json 写入权限');
        }
        return $this->createResponse(200, 'API 全局设置已保存', MailApiSettings::get());
    }

    /** 只返回公开的颜色皮肤 ID；管理端和 Webmail 分别配置。 */
    public function getThemeSettings()
    {
        return $this->createResponse(200, 'ok', ThemeSettings::get());
    }

    public function setThemeSettings()
    {
        $admin = (string) Request::post('admin_theme', '');
        $webmail = (string) Request::post('webmail_theme', '');
        if (!in_array($admin, ThemeSettings::THEMES, true) || !in_array($webmail, ThemeSettings::THEMES, true)) {
            return $this->createResponse(400, '皮肤选项无效');
        }
        if (!ThemeSettings::save($admin, $webmail)) {
            return $this->createResponse(500, '无法保存皮肤配置，请检查 config_private 目录权限');
        }
        return $this->createResponse(200, '皮肤设置已保存', ThemeSettings::get());
    }

    /** Token 已在基类验证；再次校验当前密码，密码规则仅由 PHP 负责。 */
    public function changeAdminCredentials()
    {
        // 测试站可在 config_private/admin_auth.php 中设置为 1，服务端直接拒绝自助改密请求。
        if (AdminAuthSettings::selfPasswordChangeDisabled()) {
            return $this->createResponse(403, '管理员自助修改账号/密码功能已被系统配置禁用');
        }

        $old = (string) Request::post('old_password', '');
        $username = trim((string) Request::post('new_username', ''));
        $password = (string) Request::post('new_password', '');
        $confirm = (string) Request::post('confirm_password', '');
        $currentUser = (string) (AdminAuthSettings::get()['username'] ?? '');
        if ($currentUser === '' || !AdminAuthSettings::verify($currentUser, $old)) {
            return $this->createResponse(403, '当前密码错误');
        }
        if (!preg_match('/\A[A-Za-z0-9_.@-]{3,64}\z/D', $username)) {
            return $this->createResponse(400, '新管理员账号需为 3～64 位字母、数字或 _ . @ -');
        }
        if ($password !== $confirm) {
            return $this->createResponse(400, '两次输入的新密码不一致');
        }
        $error = AdminAuthSettings::passwordError($password);
        if ($error !== null) {
            return $this->createResponse(400, $error);
        }
        if (!AdminAuthSettings::update($username, $password)) {
            return $this->createResponse(500, '保存失败，请检查 config_private/admin_auth.php 写入权限');
        }
        // 每次修改都会轮换认证版本，因此所有旧 Token 都无法通过后续请求验证。
        // 额外清空单文件会话；即使清空失败，版本不匹配也会令全部旧 Token 失效。
        $this->revokeAllAdminSessions();
        return $this->createResponse(200, '管理员账号和密码已修改，所有登录会话已失效，请重新登录');
    }

    public function home_mailbox()
    {
    
        // 获取 mailbox 头信息
        $mailbox =  Request::param('mailbox');


        if(empty($mailbox) || $mailbox === 'null' || $mailbox === 0){
            return $this->createResponse(404, "镜像邮箱地址不可为空");

        }
    
        // 检查 mailbox 是否为空（null、'null'、''、0 都视为空）
        if ($mailbox == -1) {
            $settingString = "";
            $settingInteger = 1;
        } else {
            // 查询 hm_accounts 表是否存在该邮箱
            $account = Db::table('hm_accounts')
                         ->where('accountaddress', $mailbox)
                         ->find();
    
            // 如果邮箱不存在，返回错误
            if (!$account) {
                return $this->createResponse(404, "邮箱账户不存在");
            }
    
            $settingString = $mailbox;
            $settingInteger = 0;
        }
    
        // 查询设置表，检查是否存在该 settingname
        $existingSetting = Db::table('hm_settings')->where('settingname', 'mirroremailaddress')->find();
    
        if ($existingSetting) {
            // 更新现有记录
            Db::table('hm_settings')
                ->where('settingname', 'mirroremailaddress')
                ->update([
                    'settingstring'  => $settingString,
                    'settinginteger' => $settingInteger
                ]);
        } else {
            // 插入新记录
            Db::table('hm_settings')
                ->insert([
                    'settingname'    => 'mirroremailaddress',
                    'settingstring'  => $settingString,
                    'settinginteger' => $settingInteger
                ]);
        }
    
        // 返回成功响应
        return $this->createResponse(200, "镜像邮箱已保存，请重启邮局服务使设置生效");
    }
    
    
    

    public function queryMailKey(){
    
        // 从项目根目录 config_private/mail.php 读取邮件 API 密钥，不依赖 .env。
        $read_email_key = PrivateMailConfig::get('read_email_key', '');
        $read_email_key2 = PrivateMailConfig::get('read_email_key2', '');
        $delete_emails_key = PrivateMailConfig::get('delete_emails_key', '');
        $addMail_key = PrivateMailConfig::get('addMail_key', '');
        $addMail2_key = PrivateMailConfig::get('addMail2_key', '');
        $queryDomainName_key = PrivateMailConfig::get('queryDomainName_key', '');
    

        return json([
            'code' => 200,  // 表示成功
            'read_email_key' => $read_email_key,
            'read_email_key2' => $read_email_key2,
            'delete_emails_key' => $delete_emails_key,
            'addMail_key' => $addMail_key,
            'addMail2_key' => $addMail2_key,
            'queryDomainName_key' => $queryDomainName_key,
        ]);
    }
    
    public function resetKey()
    {
    
        $Keymap = Request::param('Keymap');
    
        // 生成 20 位随机字符串
        $newKey = $this->generateRandomString(12);
    
        // 配置项映射
        switch ($Keymap) {
            case 'read_email_key':
            case 'read_email_key2':
            case 'delete_emails_key':
            case 'addMail_key':
            case 'addMail2_key':
            case 'queryDomainName_key':
                // 只更新指定密钥，其他私有配置保持不变。
                if (!PrivateMailConfig::set($Keymap, $newKey)) {
                    return $this->createResponse(500, '密钥保存失败，请检查 config_private/mail.php 及目录写入权限');
                }
                break;
            default:
                return $this->createResponse(400, "无效的 Keymap");
        }
    
        return $this->createResponse(200, "密钥已重置", ['Keymap' => $Keymap, 'newKey' => $newKey]);
    }
    



    /** 已登录后台的服务器出口公网 IP 和 TCP 本机端口探测。 */
    public function serverNetworkInfo()
    {
        $ports = [25 => 'SMTP', 110 => 'POP3', 143 => 'IMAP', 993 => 'IMAPS',
                  995 => 'POP3S', 587 => 'Submission', 465 => 'SMTPS'];
        $results = [];
        foreach ($ports as $port => $service) {
            $errno = 0;
            $errstr = '';
            $socket = @stream_socket_client('tcp://127.0.0.1:' . $port, $errno, $errstr, 0.5, STREAM_CLIENT_CONNECT);
            $results[] = ['port' => $port, 'service' => $service, 'local' => is_resource($socket)];
            if (is_resource($socket)) {
                fclose($socket);
            }
        }
        $publicIp = $this->portMonitorPublicIp();
        return $this->createResponse(200, 'ok', [
            'public_ip' => $publicIp,
            'ports' => $results,
            'public_probe_available' => $publicIp !== null,
        ]);
    }

    /** 外部节点 TCP 探测，限定固定的端口和自动获取/管理员配置的公网 IP，禁止任意目标扫描。 */
    public function publicPortCheck()
    {
        $port = (int) Request::post('port', 0);
        $allowedPorts = [25, 110, 143, 993, 995, 587, 465];
        if (!in_array($port, $allowedPorts, true)) {
            return $this->createResponse(400, '不支持的邮件端口');
        }
        $mode = (string) Request::post('mode', 'start');
        if ($mode === 'start') {
            $ip = $this->portMonitorPublicIp();
            if ($ip === null) {
                return $this->createResponse(503, '无法确定服务器公网 IPv4，请在 config/port_monitor.php 配置 public_ip');
            }
            $query = http_build_query(['host' => $ip . ':' . $port, 'max_nodes' => 2], '', '&', PHP_QUERY_RFC3986);
            $remote = $this->portMonitorGet('https://check-host.net/check-tcp?' . $query);
            if (!is_array($remote) || ($remote['ok'] ?? 0) != 1 || empty($remote['request_id'])) {
                return $this->createResponse(503, '公网检测服务暂时不可用或请求过于频繁');
            }
            return $this->createResponse(200, '检测已提交', [
                'request_id' => (string) $remote['request_id'],
                'nodes' => array_keys((array) ($remote['nodes'] ?? [])),
            ]);
        }
        if ($mode !== 'result') {
            return $this->createResponse(400, '检测模式无效');
        }
        $id = trim((string) Request::post('request_id', ''));
        if (!preg_match('/^[A-Za-z0-9_-]{1,80}$/D', $id)) {
            return $this->createResponse(400, '检测任务标识无效');
        }
        $remote = $this->portMonitorGet('https://check-host.net/check-result/' . rawurlencode($id));
        if (!is_array($remote)) {
            return $this->createResponse(503, '暂时无法获取检测结果');
        }
        $success = 0;
        $fail = 0;
        $pending = 0;
        foreach ($remote as $nodeResult) {
            if ($nodeResult === null || !is_array($nodeResult) || count($nodeResult) === 0) {
                $pending++;
                continue;
            }
            $nodeOk = false;
            $nodeFail = false;
            foreach ($nodeResult as $item) {
                if (is_array($item) && isset($item['time']) && !isset($item['error'])) {
                    $nodeOk = true;
                } elseif (is_array($item) && isset($item['error'])) {
                    $nodeFail = true;
                }
            }
            if ($nodeOk) {
                $success++;
            } elseif ($nodeFail) {
                $fail++;
            } else {
                $pending++;
            }
        }
        $state = $success > 0 ? 'open' : ($pending > 0 || count($remote) === 0 ? 'pending' : 'closed');
        return $this->createResponse(200, 'ok', [
            'state' => $state,
            'success_nodes' => $success,
            'failed_nodes' => $fail,
            'pending_nodes' => $pending,
        ]);
    }

    private function portMonitorPublicIp(): ?string
    {
        $configured = trim((string) Config::get('port_monitor.public_ip', ''));
        if ($configured !== '') {
            return $this->isPublicIpv4($configured) ? $configured : null;
        }
        // 默认取服务器出站公网 IPv4；存在 NAT 时应手动指定真正的入站公网 IP。
        $response = $this->portMonitorGetText('https://api.ipify.org', 5);
        $ip = trim((string) $response);
        if ($this->isPublicIpv4($ip)) {
            return $ip;
        }
        $fallback = (string) ($_SERVER['SERVER_ADDR'] ?? '');
        return $this->isPublicIpv4($fallback) ? $fallback : null;
    }

    private function isPublicIpv4(string $ip): bool
    {
        return filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }

    private function portMonitorGet(string $url): ?array
    {
        $body = $this->portMonitorGetText($url, 8);
        if ($body === null || strlen($body) > 100000) {
            return null;
        }
        $decoded = json_decode($body, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function portMonitorGetText(string $url, int $seconds): ?string
    {
        // URL 只能来自上面的固定服务，HTTP 跳转禁用，防止服务器端任意 URL 请求。
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => min($seconds, 4),
                CURLOPT_TIMEOUT => $seconds,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
                CURLOPT_HTTPHEADER => ['Accept: application/json, text/plain'],
                CURLOPT_USERAGENT => 'mail-admin-port-monitor/1.0',
            ]);
            $body = curl_exec($ch);
            $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            return is_string($body) && $status === 200 && strlen($body) <= 100000 ? $body : null;
        }
        $context = stream_context_create([
            'http' => ['method' => 'GET', 'header' => "Accept: application/json, text/plain\r\n", 'timeout' => $seconds, 'follow_location' => 0],
            'ssl' => ['verify_peer' => true, 'verify_peer_name' => true],
        ]);
        $body = @file_get_contents($url, false, $context, 0, 100000);
        $status = (string) ($http_response_header[0] ?? '');
        return is_string($body) && preg_match('~^HTTP/\S+\s+200\b~', $status) ? $body : null;
    }

}
