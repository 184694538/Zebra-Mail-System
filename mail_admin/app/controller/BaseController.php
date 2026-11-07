<?php

namespace app\controller;

use think\facade\Request;
use think\response\Json;
use think\facade\Db;
use think\facade\Config;
use think\exception\HttpResponseException;
use app\service\PrivateConfigStorage;
use app\service\AdminAuthSettings;

class BaseController
{
    // 管理后台统一在控制器入口验证；登录页、独立密钥接口和公开示例除外。
    public function __construct()
    {
        if ($this instanceof MailApi || $this instanceof Index ||
            ($this instanceof Admin && Request::action(true) === 'logon')) {
            return;
        }

        if ($this->verifyToken() !== 1) {
            throw new HttpResponseException($this->createResponse(401, '无权限')->code(401));
        }

        // 默认密码未修改时，服务端只允许查询改密状态、修改凭据和退出登录。
        // 不依赖前端跳转，直接调用任意其他管理接口同样会被拒绝。
        if (AdminAuthSettings::requiresDefaultPasswordChange()) {
            $action = strtolower((string) Request::action(true));
            $allowed = $this instanceof Admin && in_array(
                $action,
                ['tokenvaliditycheck', 'changeadmincredentials', 'logout'],
                true
            );
            if (!$allowed) {
                throw new HttpResponseException(
                    $this->createResponse(403, '首次登录必须修改默认管理员密码', [
                        'must_change_password' => true,
                    ])->code(403)->header(['Cache-Control' => 'no-store'])
                );
            }
        }
    }


    // 方法：统一生成 JSON 格式的响应
    protected function createResponse($code, $message, $data = null, $count = null)
    {
        return json([
            'code' => $code,
            'message' => $message,
            'count' => $count,
            'data' => $data
        ]);
    }


// 转换为32进制的函数
protected function toBase32($num) {
    $characters = '0123456789BCDEFGHIJKLMPRSTUXYZ';  // 自定义32进制字符集
    $base = strlen($characters);  // 基数为32
    $result = '';

    // 当数字不为0时，持续除以32并将余数对应的字符追加到结果中
    while ($num > 0) {
        $result = $characters[$num % $base] . $result;
        $num = intdiv($num, $base);  // 整除，获取商
    }

    return $result ?: '0';  // 如果结果为空，返回'0'
}

// 生成带有纳秒级时间戳的随机字符串
protected function generateRandomString($randomStrLength = 10) {
    // 获取当前的纳秒级时间戳
    $nanoTime = hrtime(true);  // 纳秒级时间戳
    
    // 将纳秒级时间戳转换为32进制
    $timestampBase32 = $this->toBase32($nanoTime);
    
    // 生成一个自定义长度的随机数字和大写字母组合
    $characters = '0123456789BCDEFGHIJKLMPRSTUXYZ';  // 允许的字符
    $randomStr = '';
    for ($i = 0; $i < $randomStrLength; $i++) {
        $randomStr .= $characters[rand(0, strlen($characters) - 1)];
    }

    // 返回格式化的字符串：32进制时间戳 + 随机字符
    return $randomStr . '-' . $timestampBase32;
}







    /** 管理员会话统一存放在项目根目录 config_private/admin_session.json。 */
    private function adminSessionFile(): string
    {
        PrivateConfigStorage::migrateLegacyFile(
            'admin_session.json',
            rtrim(root_path(), '/\\\\') . DIRECTORY_SEPARATOR . 'runtime' . DIRECTORY_SEPARATOR . 'admin_session.json'
        );
        return PrivateConfigStorage::path('admin_session.json');
    }

    // 全部管理接口通过此方法校验 Token，并按实际操作更新最后活动时间。
    // 10 小时无请求即过期，检查与更新在同一文件锁内完成。
    protected function verifyToken(): int
    {
        $token = (string) Request::header('Token', '');
        if ($token === '') {
            return 0;
        }

        $file = $this->adminSessionFile();
        $fp = @fopen($file, 'r+');
        if ($fp === false) {
            return 0;
        }

        flock($fp, LOCK_EX);
        $session = json_decode(stream_get_contents($fp), true);
        $credentials = \app\service\AdminAuthSettings::get();
        $version = (string) ($credentials['auth_version'] ?? '');
        $valid = is_array($session)
            && (string) ($credentials['username'] ?? '') !== ''
            && (string) ($credentials['password'] ?? '') !== ''
            && hash_equals((string) ($session['token_hash'] ?? ''), hash('sha256', $token))
            && hash_equals($version, (string) ($session['auth_version'] ?? ''))
            && time() - (int) ($session['last_active'] ?? 0) < 36000;

        if ($valid) {
            $session['last_active'] = time();
            rewind($fp);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($session));
            fflush($fp);
        }

        flock($fp, LOCK_UN);
        fclose($fp);
        return $valid ? 1 : 0;
    }

    // 单管理员仅保留最后一次登录的会话，新登录会让旧 Token 立即失效。
    protected function saveAdminSession(string $token, string $authVersion = ''): bool
    {
        if (!PrivateConfigStorage::ensureDirectory()) {
            return false;
        }
        $file = $this->adminSessionFile();
        $fp = @fopen($file, 'c+');
        if ($fp === false) {
            return false;
        }

        $session = json_encode([
            'token_hash' => hash('sha256', $token),
            'last_active' => time(),
            'auth_version' => $authVersion,
        ]);
        flock($fp, LOCK_EX);
        rewind($fp);
        ftruncate($fp, 0);
        $success = fwrite($fp, $session) === strlen($session);
        fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        @chmod($file, 0600);
        return $success;
    }

    /** 修改管理员凭据后清空全部会话（本项目的会话存储为单文件）。 */
    protected function revokeAllAdminSessions(): bool
    {
        $file = $this->adminSessionFile();
        $fp = @fopen($file, 'c+');
        if ($fp === false) {
            return false;
        }
        if (!flock($fp, LOCK_EX)) {
            fclose($fp);
            return false;
        }
        rewind($fp);
        $ok = ftruncate($fp, 0) && fflush($fp);
        flock($fp, LOCK_UN);
        fclose($fp);
        return $ok;
    }

    // 只有当前有效 Token 可以撤销当前会话，撤销后文件清空。
    protected function revokeAdminSession(string $token): bool
    {
        if ($token === '') {
            return false;
        }

        $file = $this->adminSessionFile();
        $fp = @fopen($file, 'r+');
        if ($fp === false) {
            return false;
        }

        flock($fp, LOCK_EX);
        $session = json_decode(stream_get_contents($fp), true);
        $valid = is_array($session)
            && hash_equals((string) ($session['token_hash'] ?? ''), hash('sha256', $token))
            && time() - (int) ($session['last_active'] ?? 0) < 36000;

        if ($valid) {
            rewind($fp);
            ftruncate($fp, 0);
            fflush($fp);
        }

        flock($fp, LOCK_UN);
        fclose($fp);
        return $valid;
    }
}
