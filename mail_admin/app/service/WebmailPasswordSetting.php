<?php
namespace app\service;

/** Webmail 自助修改密码开关，保存在项目根目录 config_private/webmail_password.json。 */
final class WebmailPasswordSetting
{
    private static function file(): string
    {
        PrivateConfigStorage::migrateLegacyFile(
            'webmail_password.json',
            rtrim(root_path(), '/\\\\') . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'webmail_password.json'
        );
        return PrivateConfigStorage::path('webmail_password.json');
    }

    public static function enabled(): bool
    {
        $file = self::file();
        $fp = @fopen($file, 'rb');
        if ($fp === false) return false; // 配置缺失或不可读时默认关闭

        try {
            if (!flock($fp, LOCK_SH)) return false;
            $raw = stream_get_contents($fp, 1024);
            flock($fp, LOCK_UN);
            $data = is_string($raw) ? json_decode($raw, true) : null;
            return is_array($data) && ($data['enabled'] ?? null) === true;
        } finally {
            fclose($fp);
        }
    }

    public static function save(bool $enabled): bool
    {
        // 只更新开关文件，不触碰邮件 API 密钥或管理员会话。
        self::file();
        $json = json_encode(['enabled' => $enabled], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        if (!is_string($json)) return false;
        return PrivateConfigStorage::write('webmail_password.json', $json . "\n");
    }
}
