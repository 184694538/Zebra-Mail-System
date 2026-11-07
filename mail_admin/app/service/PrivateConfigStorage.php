<?php
namespace app\service;

/**
 * 项目根目录 config_private 私有配置存储。
 * 所有迁移只在目标文件不存在时进行，迁移成功后才删除旧文件。
 */
final class PrivateConfigStorage
{
    public static function directory(): string
    {
        return rtrim(root_path(), '/\\\\') . DIRECTORY_SEPARATOR . 'config_private';
    }

    public static function path(string $filename): string
    {
        if (!preg_match('/\A[a-zA-Z0-9_.-]+\z/', $filename) || $filename === '.' || $filename === '..') {
            throw new \InvalidArgumentException('Invalid private config filename');
        }
        return self::directory() . DIRECTORY_SEPARATOR . $filename;
    }

    public static function ensureDirectory(): bool
    {
        $directory = self::directory();
        if (!is_dir($directory)) {
            if (!@mkdir($directory, 0700, true) && !is_dir($directory)) {
                return false;
            }
            @chmod($directory, 0700);
        }
        return is_dir($directory);
    }

    /**
     * 将旧位置的普通文件迁移到 config_private。
     * 若目标文件已存在，则以目标文件为准，并清理旧文件。
     */
    public static function migrateLegacyFile(string $filename, string $legacyPath): bool
    {
        if (!self::ensureDirectory()) {
            return false;
        }

        $target = self::path($filename);
        if (is_file($target)) {
            if (is_readable($target) && is_file($legacyPath)) {
                @unlink($legacyPath);
            }
            return is_readable($target);
        }

        if (!is_file($legacyPath)) {
            return true;
        }

        $contents = @file_get_contents($legacyPath);
        if (!is_string($contents)) {
            return false;
        }

        if (!self::write($filename, $contents)) {
            return false;
        }

        // 只有新文件完整写入后才删除旧文件。
        @unlink($legacyPath);
        return true;
    }

    /** 原子写入私有配置文件，避免写入中断造成配置损坏。 */
    public static function write(string $filename, string $contents): bool
    {
        if (!self::ensureDirectory()) {
            return false;
        }

        $directory = self::directory();
        if (!is_writable($directory)) {
            return false;
        }

        $target = self::path($filename);
        try {
            $temp = $target . '.tmp.' . bin2hex(random_bytes(8));
        } catch (\Throwable $e) {
            return false;
        }

        $fp = @fopen($temp, 'xb');
        if ($fp === false) {
            return false;
        }

        $length = strlen($contents);
        $written = 0;
        $ok = true;
        while ($written < $length) {
            $count = @fwrite($fp, substr($contents, $written));
            if ($count === false || $count === 0) {
                $ok = false;
                break;
            }
            $written += $count;
        }

        $ok = $ok && @fflush($fp);
        if ($ok && function_exists('fsync')) {
            @fsync($fp);
        }
        @fclose($fp);

        if (!$ok || !@rename($temp, $target)) {
            @unlink($temp);
            return false;
        }

        @chmod($target, 0600);
        if (function_exists('opcache_invalidate')) {
            @opcache_invalidate($target, true);
        }
        return true;
    }
}
