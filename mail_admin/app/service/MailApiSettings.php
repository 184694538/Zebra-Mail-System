<?php
namespace app\service;

/**
 * 邮件开放 API 的后端全局设置。
 * 文件只存放于项目根目录 config_private/mail_api_settings.json，不与密钥配置混用。
 */
final class MailApiSettings
{
    private const FILENAME = 'mail_api_settings.json';

    /**
     * 默认关闭。升级前遗留的 {"enabled":true} 不被视为管理员明确启用，
     * 必须在新版本管理页点击保存一次才会写入 manual_enabled 标记。
     */
    public static function get(): array
    {
        $file = PrivateConfigStorage::path(self::FILENAME);
        if (!is_file($file)) {
            return ['enabled' => false, 'max_emails' => 1];
        }
        // 已有文件却无法读取或解析时，API 默认关闭，避免错误配置意外开放接口。
        $raw = @file_get_contents($file);
        if (!is_string($raw)) {
            return ['enabled' => false, 'max_emails' => 1];
        }
        $data = json_decode($raw, true);
        if (!is_array($data) || !is_bool($data['enabled'] ?? null)) {
            return ['enabled' => false, 'max_emails' => 1];
        }
        $max = $data['max_emails'] ?? 1;
        if (!is_int($max) || $max < 1 || $max > 100) {
            $max = 1;
        }
        return [
            'enabled' => $data['enabled'] === true
                && ($data['manual_enabled'] ?? null) === true
                && self::hasConfiguredKey(),
            'max_emails' => $max,
        ];
    }

    public static function enabled(): bool
    {
        return self::get()['enabled'];
    }

    /** 数量设置仅用于美化网页模式，调用者不能通过 URL 覆盖。 */
    public static function maxEmails(): int
    {
        return self::get()['max_emails'];
    }

    /** 仅在至少配置一项非空的邮件 API 密钥后允许手动启用。 */
    public static function hasConfiguredKey(): bool
    {
        $config = PrivateMailConfig::all();
        foreach ([
            'read_email_key', 'read_email_key2', 'delete_emails_key',
            'addMail_key', 'addMail2_key', 'queryDomainName_key',
        ] as $key) {
            if (is_string($config[$key] ?? null) && trim($config[$key]) !== '') {
                return true;
            }
        }
        return false;
    }

    public static function save(bool $enabled, int $maxEmails): bool
    {
        if ($maxEmails < 1 || $maxEmails > 100 || ($enabled && !self::hasConfiguredKey())) {
            return false;
        }
        $json = json_encode(
            ['enabled' => $enabled, 'manual_enabled' => $enabled, 'max_emails' => $maxEmails],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
        );
        if (!is_string($json)) {
            return false;
        }
        return PrivateConfigStorage::write(self::FILENAME, $json . "\n");
    }
}
