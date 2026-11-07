<?php
namespace app\service;

/** 全站颜色主题；公开读取仅返回两个皮肤 ID，修改仅通过管理员接口。 */
final class ThemeSettings
{
    public const THEMES = [
        'layui_night', 'layui_day', 'business_blue', 'deep_ocean',
        'cloud_white', 'graphite', 'teal', 'sand',
    ];
    private const FILE = 'theme_settings.json';
    private const DEFAULTS = ['admin_theme' => 'business_blue', 'webmail_theme' => 'deep_ocean'];

    public static function get(): array
    {
        $path = PrivateConfigStorage::path(self::FILE);
        $text = is_file($path) ? @file_get_contents($path) : false;
        $raw = is_string($text) ? json_decode($text, true) : null;
        $settings = self::DEFAULTS;
        foreach (['admin_theme', 'webmail_theme'] as $key) {
            if (is_array($raw) && is_string($raw[$key] ?? null) && in_array($raw[$key], self::THEMES, true)) {
                $settings[$key] = $raw[$key];
            }
        }
        return $settings;
    }

    public static function save(string $admin, string $webmail): bool
    {
        if (!in_array($admin, self::THEMES, true) || !in_array($webmail, self::THEMES, true)) {
            return false;
        }
        return PrivateConfigStorage::write(self::FILE,
            json_encode(['admin_theme' => $admin, 'webmail_theme' => $webmail], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n");
    }
}
