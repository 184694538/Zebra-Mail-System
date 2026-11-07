<?php
namespace app\service;

/**
 * 邮件 API 私有配置。
 * 最终配置只从项目根目录 config_private/mail.php 读取，不依赖 .env 或 ThinkPHP Config。
 */
final class PrivateMailConfig
{
    private const ALLOWED_KEYS = [
        'read_email_key',
        'read_email_key2',
        'delete_emails_key',
        'addMail_key',
        'addMail2_key',
        'queryDomainName_key',
    ];

    private static function migrateLegacy(): bool
    {
        $target = PrivateConfigStorage::path('mail.php');
        $legacy = rtrim(root_path(), '/\\\\') . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'mail.php';

        if (is_file($target)) {
            $current = self::includeConfig($target);
            if (!is_array($current)) {
                return false;
            }
            if (is_file($legacy)) {
                @unlink($legacy);
            }
            return true;
        }

        if (!is_file($legacy)) {
            return false;
        }

        // 仅在首次迁移时加载旧文件，让旧版 env() 值在当前 ThinkPHP 环境中解析一次。
        // 新文件写入的是解析后的静态 PHP 数组，不再包含 env() 调用。
        $legacyConfig = self::includeConfig($legacy);
        if (!is_array($legacyConfig)) {
            return false;
        }

        $php = "<?php\n\n// 私有邮件 API 配置：不依赖 .env。\nreturn " . var_export($legacyConfig, true) . ";\n";
        if (!PrivateConfigStorage::write('mail.php', $php)) {
            return false;
        }

        @unlink($legacy);
        return true;
    }

    private static function includeConfig(string $path): ?array
    {
        try {
            $value = include $path;
            return is_array($value) ? $value : null;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function all(): array
    {
        if (!self::migrateLegacy()) {
            return [];
        }

        $config = self::includeConfig(PrivateConfigStorage::path('mail.php'));
        return is_array($config) ? $config : [];
    }

    public static function get(string $key, $default = '')
    {
        $config = self::all();
        return array_key_exists($key, $config) ? $config[$key] : $default;
    }

    public static function set(string $key, string $value): bool
    {
        if (!in_array($key, self::ALLOWED_KEYS, true)) {
            return false;
        }

        $config = self::all();
        if (!$config) {
            return false;
        }

        $config[$key] = $value;
        $php = "<?php\n\n// 私有邮件 API 配置：不依赖 .env。\nreturn " . var_export($config, true) . ";\n";
        return PrivateConfigStorage::write('mail.php', $php);
    }
}
