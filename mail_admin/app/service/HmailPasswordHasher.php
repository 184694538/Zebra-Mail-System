<?php

namespace app\service;

/**
 * hMailServer 6.3 (Crypt::ETPBKDF2=4) PBKDF2-HMAC-SHA256 密码格式。
 *
 * accountpassword: $h1$<iterations>$<16-byte-salt-hex>$<32-byte-key-hex>
 * accountpwencryption: 4
 *
 * 对齐 hMailServer 6.3.7 HashCreator::GeneratePBKDF2 / ValidatePBKDF2。
 * 原生 PHP 实现，不调用 hMailServer REST、COM 或其它服务。
 */
final class HmailPasswordHasher
{
    public const ENCRYPTION_TYPE = 4;
    public const ITERATIONS = 210000;
    private const SALT_LENGTH = 16;
    private const HASH_LENGTH = 32;
    private const MAX_ITERATIONS = 10000000;

    /** 每次生成独立随机 Salt，输出 hMailServer 原生 $h1$ 格式。 */
    public static function hash(string $password): string
    {
        if ($password === '') {
            throw new \InvalidArgumentException('邮箱密码不能为空');
        }
        if (!function_exists('hash_pbkdf2')) {
            throw new \RuntimeException('PHP hash 扩展未启用，无法生成 PBKDF2 密码');
        }

        $salt = random_bytes(self::SALT_LENGTH);
        $derived = hash_pbkdf2('sha256', $password, $salt, self::ITERATIONS, self::HASH_LENGTH, true);
        return '$h1$' . self::ITERATIONS . '$' . bin2hex($salt) . '$' . bin2hex($derived);
    }

    /** 严格检测 hMailServer 可识别的 PBKDF2 格式，不把错误格式当作有效哈希。 */
    public static function isPbkdf2Hash(string $stored): bool
    {
        return self::parse($stored) !== null;
    }

    /** 验证明文与 hMailServer 原生 $h1$ 哈希是否匹配。 */
    public static function verify(string $password, string $stored): bool
    {
        $parts = self::parse($stored);
        if ($parts === null || !function_exists('hash_pbkdf2')) {
            return false;
        }
        [$iterations, $salt, $expected] = $parts;
        $actual = hash_pbkdf2('sha256', $password, $salt, $iterations, self::HASH_LENGTH, true);
        return hash_equals($expected, $actual);
    }

    /**
     * 识别旧版错误补丁所生成的 PHC 字符串。
     * 注意：该格式不能用于 hMailServer 登录，只可用于受控的备份/数据修复。
     */
    public static function isLegacyInvalidHash(string $stored): bool
    {
        return self::parseLegacyInvalid($stored) !== null;
    }

    /** 仅用于确认原密码匹配旧错误格式，便于安全地重新生成 $h1$ 哈希。 */
    public static function verifyLegacyInvalid(string $password, string $stored): bool
    {
        $parts = self::parseLegacyInvalid($stored);
        if ($parts === null || !function_exists('hash_pbkdf2')) {
            return false;
        }
        [$iterations, $salt, $expected] = $parts;
        $actual = hash_pbkdf2('sha256', $password, $salt, $iterations, self::HASH_LENGTH, true);
        return hash_equals($expected, $actual);
    }

    /** @return array{int, string, string}|null */
    private static function parse(string $stored): ?array
    {
        if (!preg_match('~\A\$h1\$([1-9][0-9]{0,7})\$([0-9a-fA-F]{32})\$([0-9a-fA-F]{64})\z~', $stored, $matches)) {
            return null;
        }
        $iterations = (int) $matches[1];
        if ($iterations < 1 || $iterations > self::MAX_ITERATIONS) {
            return null;
        }
        $salt = hex2bin($matches[2]);
        $key = hex2bin($matches[3]);
        if ($salt === false || $key === false) {
            return null;
        }
        return [$iterations, $salt, $key];
    }

    /** @return array{int, string, string}|null */
    private static function parseLegacyInvalid(string $stored): ?array
    {
        if (!preg_match('~\A\$pbkdf2-sha256\$i=([1-9][0-9]{0,7})\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)\z~', $stored, $matches)) {
            return null;
        }
        $iterations = (int) $matches[1];
        if ($iterations < 1 || $iterations > self::MAX_ITERATIONS) {
            return null;
        }
        $salt = base64_decode($matches[2], true);
        $key = base64_decode($matches[3], true);
        if ($salt === false || strlen($salt) !== self::SALT_LENGTH
            || rtrim(base64_encode($salt), '=') !== $matches[2]
            || $key === false || strlen($key) !== self::HASH_LENGTH
            || rtrim(base64_encode($key), '=') !== $matches[3]) {
            return null;
        }
        return [$iterations, $salt, $key];
    }
}
