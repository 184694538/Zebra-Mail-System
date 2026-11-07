<?php
namespace app\controller;

use app\service\HmailPasswordHasher;

use app\service\SmtpMailer;
use app\service\WebmailService;
use app\service\WebmailPasswordSetting;
use app\service\LoginCryptoService;
use think\facade\Db;
use think\facade\Config;
use think\facade\Request;

/**
 * 面向普通邮箱用户的独立 API 控制器。
 * 不继承管理后台 BaseController，避免要求后台管理员 Token。
 */
class Webmail
{
    private const SESSION_NAME = 'WEBMAILSESSID';

    private function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        if (session_name() !== self::SESSION_NAME) @session_name(self::SESSION_NAME);
        $secure = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
            || (string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    private function jsonResponse(int $code, string $message, $data = null, int $httpCode = 200)
    {
        $response = json(['code' => $code, 'message' => $message, 'data' => $data]);
        return $response->code($httpCode)->header([
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    private function input(): array
    {
        $raw = (string) Request::getInput();
        if ($raw !== '') {
            $json = json_decode($raw, true);
            if (is_array($json)) return $json;
        }
        $post = Request::post();
        return is_array($post) ? $post : [];
    }

    private function csrfValid(): bool
    {
        $this->startSession();
        $expected = (string) ($_SESSION['webmail_csrf'] ?? '');
        $actual = (string) Request::header('x-csrf-token', '');
        return $expected !== '' && $actual !== '' && hash_equals($expected, $actual);
    }

    private function requireCsrf()
    {
        if (!$this->csrfValid()) {
            return $this->jsonResponse(419, '页面会话已过期，请刷新页面后重试', null, 419);
        }
        return null;
    }

    private function auth(): ?array
    {
        $this->startSession();
        $auth = $_SESSION['webmail_auth'] ?? null;
        if (!is_array($auth) || empty($auth['email']) || !isset($auth['password'])) return null;
        $timeout = max(300, (int) Config::get('webmail.session_timeout', 1800));
        if (time() - (int) ($auth['last_activity'] ?? 0) > $timeout) {
            unset($_SESSION['webmail_auth']);
            return null;
        }
        $_SESSION['webmail_auth']['last_activity'] = time();
        return [
            'email' => (string) $auth['email'],
            'password' => (string) $auth['password'],
        ];
    }

    private function requireAuth()
    {
        $auth = $this->auth();
        if ($auth === null) {
            return [null, $this->jsonResponse(401, '登录状态已失效，请重新登录', null, 401)];
        }
        return [$auth, null];
    }

    private function flattenUploads(): array
    {
        $files = $_FILES['attachments'] ?? null;
        if (!is_array($files) || !isset($files['name'])) return [];
        $result = [];
        if (is_array($files['name'])) {
            foreach ($files['name'] as $index => $name) {
                $result[] = [
                    'name' => $name,
                    'type' => $files['type'][$index] ?? '',
                    'tmp_name' => $files['tmp_name'][$index] ?? '',
                    'error' => $files['error'][$index] ?? UPLOAD_ERR_NO_FILE,
                    'size' => $files['size'][$index] ?? 0,
                ];
            }
        } else {
            $result[] = $files;
        }
        return $result;
    }

    public function csrf()
    {
        $this->startSession();
        if (empty($_SESSION['webmail_csrf'])) {
            $_SESSION['webmail_csrf'] = bin2hex(random_bytes(32));
        }
        return $this->jsonResponse(0, 'ok', ['csrf_token' => $_SESSION['webmail_csrf']]);
    }

    public function login()
    {
        $this->startSession();
        if ($error = $this->requireCsrf()) return $error;
        $input = $this->input();
        $email = strtolower(trim((string) ($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254) {
            return $this->jsonResponse(400, '请输入正确的邮箱地址', null, 400);
        }
        // 此接口不再接受明文密码请求，失败时禁止回退。
        try {
            $password = LoginCryptoService::decryptPassword(
                'webmail',
                $email,
                (string) ($input['key_id'] ?? ''),
                (string) ($input['encrypted_password'] ?? '')
            );
        } catch (\Throwable $e) {
            return $this->jsonResponse(400, '登录安全验证失败，请重新尝试', null, 400);
        }
        $lockedUntil = (int) ($_SESSION['webmail_login_locked_until'] ?? 0);
        if ($lockedUntil > time()) {
            return $this->jsonResponse(429, '登录尝试过于频繁，请稍后再试', null, 429);
        }
        try {
            $imap = WebmailService::connect($email, $password, 'INBOX');
            WebmailService::close($imap);
            session_regenerate_id(true);
            $_SESSION['webmail_auth'] = [
                'email' => $email,
                'password' => $password,
                'last_activity' => time(),
            ];
            $_SESSION['webmail_login_failures'] = 0;
            $_SESSION['webmail_login_locked_until'] = 0;
            return $this->jsonResponse(0, '登录成功', ['email' => $email]);
        } catch (\Throwable $e) {
            $failures = (int) ($_SESSION['webmail_login_failures'] ?? 0) + 1;
            $_SESSION['webmail_login_failures'] = $failures;
            if ($failures >= 8) {
                $_SESSION['webmail_login_locked_until'] = time() + 300;
                $_SESSION['webmail_login_failures'] = 0;
            }
            return $this->jsonResponse(401, $e->getMessage(), null, 401);
        }
    }

    public function logout()
    {
        $this->startSession();
        if ($error = $this->requireCsrf()) return $error;
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();
        return $this->jsonResponse(0, '已退出邮箱');
    }

    public function me()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        return $this->jsonResponse(0, 'ok', ['email' => $auth['email']]);
    }

    public function folders()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        try {
            return $this->jsonResponse(0, 'ok', WebmailService::folders($auth['email'], $auth['password']));
        } catch (\Throwable $e) {
            return $this->jsonResponse(500, $e->getMessage(), null, 500);
        }
    }

    public function messages()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        $folder = trim((string) Request::param('folder', 'inbox')) ?: 'inbox';
        $page = max(1, (int) Request::param('page', 1));
        $pageSize = max(5, min(100, (int) Config::get('webmail.page_size', 25)));
        $query = trim((string) Request::param('q', ''));
        try {
            return $this->jsonResponse(0, 'ok', WebmailService::messages($auth['email'], $auth['password'], $folder, $page, $pageSize, $query));
        } catch (\Throwable $e) {
            return $this->jsonResponse(500, $e->getMessage(), null, 500);
        }
    }

    public function message()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        $folder = trim((string) Request::param('folder', 'inbox')) ?: 'inbox';
        $uid = (int) Request::param('uid', 0);
        try {
            return $this->jsonResponse(0, 'ok', WebmailService::message($auth['email'], $auth['password'], $folder, $uid));
        } catch (\Throwable $e) {
            return $this->jsonResponse(404, $e->getMessage(), null, 404);
        }
    }

    public function download()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        $folder = trim((string) Request::param('folder', 'inbox')) ?: 'inbox';
        $uid = (int) Request::param('uid', 0);
        $part = (string) Request::param('part', '');
        try {
            $file = WebmailService::attachment($auth['email'], $auth['password'], $folder, $uid, $part);
            $name = basename(str_replace(["\r", "\n", '"'], '', $file['name']));
            $fallback = preg_replace('/[^A-Za-z0-9._-]/', '_', $name) ?: 'attachment';
            return response($file['content'], 200, [
                'Content-Type' => $file['content_type'],
                'Content-Length' => (string) strlen($file['content']),
                'Content-Disposition' => 'attachment; filename="' . $fallback . '"; filename*=UTF-8\'\'' . rawurlencode($name),
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, no-store',
            ]);
        } catch (\Throwable $e) {
            return $this->jsonResponse(404, $e->getMessage(), null, 404);
        }
    }

    public function send()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        if ($error = $this->requireCsrf()) return $error;
        $input = $this->input();
        $html = (string) ($input['html'] ?? '');
        $text = (string) ($input['text'] ?? '');
        $maxMessage = (int) Config::get('webmail.max_message_bytes', 5242880);
        if (strlen($html) > $maxMessage || strlen($text) > $maxMessage) {
            return $this->jsonResponse(413, '邮件正文过大', null, 413);
        }
        try {
            $result = SmtpMailer::send($auth['email'], $auth['password'], $input, $this->flattenUploads(), (array) Config::get('webmail', []));
            $saved = false;
            try {
                $saved = WebmailService::append($auth['email'], $auth['password'], 'sent', $result['raw'], '\\Seen');
            } catch (\Throwable $ignored) {
                $saved = false;
            }
            unset($result['raw']);
            $result['saved_to_sent'] = $saved;
            return $this->jsonResponse(0, $saved ? '邮件发送成功' : '邮件已发送，但未能保存到已发送文件夹', $result);
        } catch (\Throwable $e) {
            return $this->jsonResponse(500, $e->getMessage(), null, 500);
        }
    }

    public function saveDraft()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        if ($error = $this->requireCsrf()) return $error;
        $input = $this->input();
        try {
            $built = SmtpMailer::buildMessage(
                $auth['email'],
                $input,
                $this->flattenUploads(),
                (int) Config::get('webmail.max_attachment_bytes', 20971520),
                true
            );
            $saved = WebmailService::append($auth['email'], $auth['password'], 'drafts', $built['raw'], '\\Draft');
            if (!$saved) throw new \RuntimeException('保存草稿失败，请检查 IMAP 文件夹权限');
            return $this->jsonResponse(0, '草稿已保存', ['message_id' => $built['message_id']]);
        } catch (\Throwable $e) {
            return $this->jsonResponse(500, $e->getMessage(), null, 500);
        }
    }

    public function mark()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        if ($error = $this->requireCsrf()) return $error;
        $input = $this->input();
        $uid = (int) ($input['uid'] ?? 0);
        $folder = trim((string) ($input['folder'] ?? 'inbox')) ?: 'inbox';
        $seen = filter_var($input['seen'] ?? true, FILTER_VALIDATE_BOOLEAN);
        try {
            WebmailService::mark($auth['email'], $auth['password'], $folder, $uid, $seen);
            return $this->jsonResponse(0, '邮件状态已更新');
        } catch (\Throwable $e) {
            return $this->jsonResponse(500, $e->getMessage(), null, 500);
        }
    }

    public function delete()
    {
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        if ($error = $this->requireCsrf()) return $error;
        $input = $this->input();
        $uid = (int) ($input['uid'] ?? 0);
        $folder = trim((string) ($input['folder'] ?? 'inbox')) ?: 'inbox';
        try {
            WebmailService::delete($auth['email'], $auth['password'], $folder, $uid);
            return $this->jsonResponse(0, '邮件已删除');
        } catch (\Throwable $e) {
            return $this->jsonResponse(500, $e->getMessage(), null, 500);
        }
    }

    /** 登录页公开读取开关状态，不泄露数据库或管理员配置。 */
    public function passwordFeature()
    {
        return $this->jsonResponse(0, 'ok', ['enabled' => WebmailPasswordSetting::enabled()]);
    }

    /** 登录前修改邮箱密码：必须提交邮箱账户、原密码及新密码。 */
    public function changePassword()
    {
        $this->startSession();
        if (!WebmailPasswordSetting::enabled()) {
            return $this->jsonResponse(403, '管理员尚未开放修改密码功能', null, 403);
        }
        if ($error = $this->requireCsrf()) return $error;
        $data = $this->input();
        return $this->updateAccountPassword(
            strtolower(trim((string) ($data['email'] ?? ''))),
            (string) ($data['old_password'] ?? ''),
            (string) ($data['new_password'] ?? ''),
            (string) ($data['confirm_password'] ?? '')
        );
    }

    /** 保留登录后已有入口，并同样受管理员开关控制。 */
    public function password()
    {
        if (!WebmailPasswordSetting::enabled()) {
            return $this->jsonResponse(403, '管理员尚未开放修改密码功能', null, 403);
        }
        [$auth, $error] = $this->requireAuth();
        if ($error) return $error;
        if ($error = $this->requireCsrf()) return $error;
        $data = $this->input();
        return $this->updateAccountPassword(
            $auth['email'],
            (string) ($data['old_password'] ?? ''),
            (string) ($data['new_password'] ?? ''),
            (string) ($data['confirm_password'] ?? '')
        );
    }

    /** 未登录入口也要按客户端 IP + 邮箱限流，避免重建 Session 后暴力猜原密码。 */
    private function passwordAttemptAllowed(string $email): bool
    {
        $file = root_path() . 'runtime/webmail_password_attempts.json';
        $fp = @fopen($file, 'c+');
        if ($fp === false) return false;
        try {
            if (!flock($fp, LOCK_EX)) return false;
            $data = json_decode((string) stream_get_contents($fp), true);
            if (!is_array($data)) $data = [];
            $now = time();
            $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
            $keys = [
                'ip:' . hash('sha256', $ip),
                'account:' . hash('sha256', $email),
            ];
            foreach ($data as $key => $timestamps) {
                if (!is_array($timestamps)) { unset($data[$key]); continue; }
                $timestamps = array_values(array_filter($timestamps, static fn($t) => is_int($t) && $t > $now - 600 && $t <= $now));
                if ($timestamps) $data[$key] = $timestamps;
                else unset($data[$key]);
            }
            $allowed = count($data[$keys[0]] ?? []) < 30 && count($data[$keys[1]] ?? []) < 12;
            if ($allowed) {
                foreach ($keys as $key) $data[$key][] = $now;
            }
            // JSON 文件在 public 根目录之外，不记录密码或明文邮箱。
            $serialized = json_encode($data);
            $saved = false;
            if ($serialized !== false && rewind($fp) && ftruncate($fp, 0)) {
                $saved = fwrite($fp, $serialized) === strlen($serialized) && fflush($fp);
            }
            flock($fp, LOCK_UN);
            return $allowed && $saved;
        } finally {
            fclose($fp);
        }
    }

    private function updateAccountPassword(string $email, string $oldPassword, string $newPassword, string $confirm): \think\response\Json
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 254
            || $oldPassword === '' || strlen($oldPassword) > 1024) {
            return $this->jsonResponse(400, '邮箱地址或原密码不正确', null, 400);
        }
        // 与 Admin 邮箱导入的密码格式保持一致。
        if (strlen($newPassword) < 8 || strlen($newPassword) > 128
            || !preg_match('/^[A-Za-z0-9@.]+$/D', $newPassword)) {
            return $this->jsonResponse(400, '新密码须为 8–128 位，只能使用英文字母、数字、@ 和 .', null, 400);
        }
        if (!hash_equals($newPassword, $confirm)) {
            return $this->jsonResponse(400, '两次新密码输入不一致', null, 400);
        }
        if (hash_equals($newPassword, $oldPassword)) {
            return $this->jsonResponse(400, '新密码不能与原密码相同', null, 400);
        }
        $lockedUntil = (int) ($_SESSION['webmail_password_locked_until'] ?? 0);
        if ($lockedUntil > time() || !$this->passwordAttemptAllowed($email)) {
            return $this->jsonResponse(429, '尝试过于频繁，请稍后再试', null, 429);
        }
        try {
            // 使用 hMailServer 原始 PHC/PBKDF2 哈希校验，而非信任明文字段。
            // 老的 0（明文）账户也可登录后改为 4（PHC/PBKDF2）。
            $account = Db::table('hm_accounts')
                ->where('accountaddress', $email)
                ->field('accountid,accountpassword,accountpwencryption,accountactive,accountisad')
                ->find();
            $isActiveLocal = $account !== null
                && (int) ($account['accountactive'] ?? 0) === 1
                && (int) ($account['accountisad'] ?? 1) === 0;
            $encryption = (int) ($account['accountpwencryption'] ?? -1);
            $originalHash = (string) ($account['accountpassword'] ?? '');
            $oldPasswordMatches = $isActiveLocal && (
                ($encryption === 0 && hash_equals($originalHash, $oldPassword))
                || ($encryption === HmailPasswordHasher::ENCRYPTION_TYPE
                    && HmailPasswordHasher::verify($oldPassword, $originalHash))
            );

            if (!$oldPasswordMatches) {
                $failures = (int) ($_SESSION['webmail_password_failures'] ?? 0) + 1;
                if ($failures >= 6) {
                    $_SESSION['webmail_password_locked_until'] = time() + 600;
                    $failures = 0;
                }
                $_SESSION['webmail_password_failures'] = $failures;
                // 统一错误信息：不向未登录访问者透露账户是否存在或密码存储方式。
                return $this->jsonResponse(400, '邮箱地址或原密码不正确，或该账户密码算法暂不支持直接修改', null, 400);
            }

            // 条件更新避免并发覆盖；同时更新 hMailServer 登录哈希及管理员明文字段。
            $changed = Db::table('hm_accounts')
                ->where('accountid', (int) $account['accountid'])
                ->where('accountpassword', $originalHash)
                ->where('accountpwencryption', $encryption)
                ->where('accountactive', 1)
                ->where('accountisad', 0)
                ->update([
                    'accountpassword' => HmailPasswordHasher::hash($newPassword),
                    'accountpassword_plain' => $newPassword,
                    'accountpwencryption' => HmailPasswordHasher::ENCRYPTION_TYPE,
                    'accountpasswordchanged' => date('Y-m-d H:i:s'),
                ]);
            if ($changed !== 1) {
                return $this->jsonResponse(409, '密码记录已更新，请刷新后重试', null, 409);
            }
            $_SESSION['webmail_password_failures'] = 0;
            $_SESSION['webmail_password_locked_until'] = 0;
            if (isset($_SESSION['webmail_auth']['email'])
                && strcasecmp((string) $_SESSION['webmail_auth']['email'], $email) === 0) {
                // 当前邮箱会话同步新密码，避免继续使用旧凭据访问 IMAP。
                $_SESSION['webmail_auth']['password'] = $newPassword;
                $_SESSION['webmail_auth']['last_activity'] = time();
            }
            return $this->jsonResponse(0, '密码已保存，请使用新密码登录', ['email' => $email]);
        } catch (\Throwable $e) {
            // 不向匿名用户暴露数据库连接、表结构等错误内容。
            return $this->jsonResponse(500, '服务器暂时无法修改密码，请联系管理员', null, 500);
        }
    }
}
