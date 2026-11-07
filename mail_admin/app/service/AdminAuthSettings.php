<?php
namespace app\service;

/**
 * 管理员凭据仅保存在 config_private/admin_auth.php。
 * 第一次读取时迁移旧 config/admin_auth.php，保留原有密码格式。
 * 新设置的密码按用户要求以明文保存；旧哈希密码继续兼容验证，无法逆向恢复。
 */
final class AdminAuthSettings
{
    private static function privatePath(): string
    {
        return PrivateConfigStorage::path('admin_auth.php');
    }

    private static function readFile(string $path): ?array
    {
        if (!is_file($path) || !is_readable($path)) {
            return null;
        }
        try {
            $values = include $path;
            return is_array($values) ? $values : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function get(): array
    {
        $private = self::privatePath();
        $legacy = rtrim(root_path(), '/\\') . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'admin_auth.php';
        $values = self::readFile($private);
        if ($values !== null) {
            // 兼容旧配置：未设置时默认允许管理员自行修改密码（0）。
            $values['disable_self_password_change'] = (int)($values['disable_self_password_change'] ?? 0) === 1 ? 1 : 0;
            // Never read the old path again once the private credentials exist.
            return $values;
        }
        if (is_file($private)) {
            return []; // Corrupt/unreadable private file must not fall back to legacy.
        }
        $old = self::readFile($legacy);
        if ($old === null || trim((string)($old['username'] ?? '')) === '' || (string)($old['password'] ?? '') === '') {
            return [];
        }
        $password = (string)$old['password'];
        $disableSelfPasswordChange = (int)($old['disable_self_password_change'] ?? 0) === 1 ? 1 : 0;
        if (!self::write((string)$old['username'], $password, '', $disableSelfPasswordChange)) {
            return []; // 迁移失败时不使用旧路径绕过私有配置存储。
        }
        @unlink($legacy); // If filesystem ownership prevents deletion, installer must remove it manually.
        return [
            'username' => (string)$old['username'],
            'password' => $password,
            'disable_self_password_change' => $disableSelfPasswordChange,
        ];
    }

    /** 是否禁止管理员通过后台接口自行修改管理员账号密码。 */
    public static function selfPasswordChangeDisabled(): bool
    {
        return (int)(self::get()['disable_self_password_change'] ?? 0) === 1;
    }

    /**
     * 只对公开安装默认账号 admin / 123456 强制改密。
     * 不需要额外的状态文件；一旦更新凭据，该判断自动失效。
     * 同时支持旧版把默认密码存成 password_hash() 的情况。
     */
    public static function requiresDefaultPasswordChange(): bool
    {
        return self::verify('admin', '123456');
    }

    private static function isHashed(string $value): bool
    {
        $info = password_get_info($value);
        return ($info['algoName'] ?? 'unknown') !== 'unknown';
    }

    public static function verify(string $username, string $password): bool
    {
        $config = self::get();
        $storedUser = (string)($config['username'] ?? '');
        $storedPassword = (string)($config['password'] ?? '');
        if ($storedUser === '' || $storedPassword === '' || !hash_equals($storedUser, $username)) {
            return false;
        }
        return self::isHashed($storedPassword) ? password_verify($password, $storedPassword)
            : hash_equals($storedPassword, $password);
    }

    /**
     * 服务端统一密码强度校验：不依赖前端脚本 / HTML 属性。
     * 允许特殊字符及 Unicode 字符，但必须至少包含 ASCII 数字和字母（不区分大小写）。
     */
    public static function passwordError(string $password): ?string
    {
        $length = preg_match_all('/./us', $password);
        if ($length === false || $length < 8 || $length > 128) {
            return '新密码长度必须为 8～128 位';
        }
        if (!preg_match('/[0-9]/', $password) || !preg_match('/[A-Za-z]/', $password)) {
            return '新密码必须同时包含数字和字母';
        }
        // 显著弱密码、常用键盘序列、连续数字和长串重复字符均拒绝。
        $weak = '/(?:password|passw0rd|admin123|administrator|qwerty|asdfgh|zxcvbn|abcdef|abc123|123456|654321|12345|98765|11111|00000)/i';
        if (preg_match($weak, $password) || preg_match('/(.)\1{4,}/iu', $password)) {
            return '新密码过于简单，请避免常见密码、连续数字或重复字符';
        }
        return null;
    }

    /** 改动任何管理员凭据均轮换认证版本，全部旧 Token 随即失效。 */
    public static function update(string $username, string $password): bool
    {
        try {
            $version = bin2hex(random_bytes(16));
            // 修改凭据时保留私有配置中的自助改密开关。
            $disableSelfPasswordChange = (int)(self::get()['disable_self_password_change'] ?? 0) === 1 ? 1 : 0;
            // 用户明确要求可从私有配置文件找回新密码；不可逆旧哈希不能还原。
            return self::write($username, $password, $version, $disableSelfPasswordChange);
        } catch (\Throwable $e) {
            return false;
        }
    }

    private static function write(
        string $username,
        string $password,
        string $authVersion = '',
        int $disableSelfPasswordChange = 0
    ): bool {
        $values = [
            'username' => $username,
            'password' => $password,
            'auth_version' => $authVersion,
            'disable_self_password_change' => $disableSelfPasswordChange === 1 ? 1 : 0,
        ];
        $content = "<?php\n// 私有管理员认证配置。新密码以明文保存，严禁公开/提交仓库；文件权限必须为 0600。\nreturn "
            . var_export($values, true) . ";\n";
        return PrivateConfigStorage::write('admin_auth.php', $content);
    }
}
