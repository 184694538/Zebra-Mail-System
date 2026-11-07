<?php
namespace app\service;

final class LoginRateLimitException extends \RuntimeException {}

/**
 * Admin / Webmail 登录加密 V1：libsodium sealed box (X25519 + XSalsa20-Poly1305)。
 * 长期密钥与独立 IP 限流记录存放在项目根目录 config_private。
 */
final class LoginCryptoService
{
    public const TIMESTAMP_WINDOW = 60;
    private const KEY_FILE = 'login_crypto_keys.json';
    // 只保存 IP 请求频率，不保存任何 challenge_id 或登录挑战。
    private const RATE_FILE = 'login_crypto_rate.json';

    private static function withLock(string $name, callable $operation)
    {
        if (!PrivateConfigStorage::ensureDirectory()) {
            throw new \RuntimeException('无法访问登录安全配置目录');
        }
        $path = PrivateConfigStorage::path($name . '.lock');
        $fp = @fopen($path, 'c');
        if ($fp === false) {
            throw new \RuntimeException('登录安全文件锁不可用');
        }
        @chmod($path, 0600);
        try {
            if (!flock($fp, LOCK_EX)) {
                throw new \RuntimeException('登录安全文件锁不可用');
            }
            return $operation();
        } finally {
            flock($fp, LOCK_UN);
            fclose($fp);
        }
    }

    private static function keys(): array
    {
        if (!extension_loaded('sodium')) {
            throw new \RuntimeException('PHP Sodium 扩展未启用');
        }
        return self::withLock('login_crypto_keys', static function (): array {
            $file = PrivateConfigStorage::path(self::KEY_FILE);
            if (is_file($file)) {
                $raw = @file_get_contents($file);
                $data = is_string($raw) ? json_decode($raw, true) : null;
                if (!is_array($data)) {
                    throw new \RuntimeException('登录密钥文件已损坏');
                }
                $pub = base64_decode((string) ($data['public_key'] ?? ''), true);
                $secret = base64_decode((string) ($data['secret_key'] ?? ''), true);
                $kid = (string) ($data['key_id'] ?? '');
                if ($pub === false || $secret === false || strlen($pub) !== SODIUM_CRYPTO_BOX_PUBLICKEYBYTES
                    || strlen($secret) !== SODIUM_CRYPTO_BOX_SECRETKEYBYTES
                    || !hash_equals(sodium_crypto_scalarmult_base($secret), $pub)
                    || !hash_equals(substr(hash('sha256', $pub), 0, 24), $kid)) {
                    throw new \RuntimeException('登录密钥文件无效');
                }
                return ['key_id' => $kid, 'public' => $pub, 'secret' => $secret];
            }
            $pair = sodium_crypto_box_keypair();
            $pub = sodium_crypto_box_publickey($pair);
            $secret = sodium_crypto_box_secretkey($pair);
            $kid = substr(hash('sha256', $pub), 0, 24);
            $data = [
                'version' => 1,
                'key_id' => $kid,
                'public_key' => base64_encode($pub),
                'secret_key' => base64_encode($secret),
                'created_at' => time(),
            ];
            $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
            if (!PrivateConfigStorage::write(self::KEY_FILE, $json)) {
                throw new \RuntimeException('登录密钥保存失败');
            }
            sodium_memzero($secret);
            return ['key_id' => $kid, 'public' => $pub, 'secret' => sodium_crypto_box_secretkey($pair)];
        });
    }

    private static function normalUser(string $scene, string $username): string
    {
        if ($scene !== 'admin' && $scene !== 'webmail') {
            throw new \InvalidArgumentException('登录场景无效');
        }
        $user = trim($username);
        if ($scene === 'webmail') $user = strtolower($user);
        if ($user === '' || strlen($user) > 254) {
            throw new \InvalidArgumentException('账号不能为空');
        }
        return $user;
    }

    private static function loadRateData(): array
    {
        $file = PrivateConfigStorage::path(self::RATE_FILE);
        if (!is_file($file)) return ['rate' => []];
        $raw = @file_get_contents($file);
        $data = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($data) || !isset($data['rate']) || !is_array($data['rate'])) {
            throw new \RuntimeException('登录限流文件无效');
        }
        return $data;
    }

    private static function saveRateData(array $data): void
    {
        $json = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (!PrivateConfigStorage::write(self::RATE_FILE, $json)) {
            throw new \RuntimeException('登录限流记录保存失败');
        }
    }

    /**
     * 限制公开公钥接口的请求频率。这里仅保存 IP 频率统计，绝不保存 challenge_id。
     */
    private static function checkChallengeRate(string $clientIp): void
    {
        self::withLock('login_crypto_rate', static function () use ($clientIp): void {
            $now = time();
            $data = self::loadRateData();
            foreach ($data['rate'] as $id => $row) {
                if (!is_array($row) || (int) ($row['start'] ?? 0) + 60 < $now) {
                    unset($data['rate'][$id]);
                }
            }
            $fingerprint = hash('sha256', $clientIp);
            $rate = $data['rate'][$fingerprint] ?? ['start' => $now, 'count' => 0];
            if ((int) ($rate['start'] ?? 0) + 60 <= $now) {
                $rate = ['start' => $now, 'count' => 0];
            }
            if ((int) ($rate['count'] ?? 0) >= 40) {
                self::saveRateData($data);
                throw new LoginRateLimitException('登录请求过于频繁，请稍后再试');
            }
            ++$rate['count'];
            $data['rate'][$fingerprint] = $rate;
            self::saveRateData($data);
        });
    }

    /**
     * 返回公钥、服务器时间戳和随机 challenge_id。
     * challenge_id 只作为加密载荷中的随机字段，不保存、不查询、不验证。
     */
    public static function challenge(string $scene, string $username, string $clientIp): array
    {
        self::normalUser($scene, $username);
        self::checkChallengeRate($clientIp);
        $keys = self::keys();
        $now = time();
        return [
            'version' => 1,
            'key_id' => $keys['key_id'],
            'public_key' => base64_encode($keys['public']),
            'timestamp' => $now,
            'challenge_id' => bin2hex(random_bytes(24)),
            'expires_in' => self::TIMESTAMP_WINDOW,
        ];
    }

    /**
     * 解密登录密码，仅校验服务器时间戳窗口；challenge_id 不保存、不查询、不验证。
     * 失败时全部拒绝，绝不回退到 password 明文参数。
     */
    public static function decryptPassword(string $scene, string $username, string $keyId, string $base64Cipher): string
    {
        self::normalUser($scene, $username);
        if ($keyId === '' || strlen($base64Cipher) < 64 || strlen($base64Cipher) > 8192) {
            throw new \InvalidArgumentException('登录加密数据无效');
        }
        $keys = self::keys();
        if (!hash_equals($keys['key_id'], $keyId)) {
            throw new \InvalidArgumentException('登录加密密钥不匹配');
        }
        $cipher = base64_decode($base64Cipher, true);
        if ($cipher === false || strlen($cipher) <= SODIUM_CRYPTO_BOX_SEALBYTES) {
            throw new \InvalidArgumentException('登录密文无效');
        }
        $pair = sodium_crypto_box_keypair_from_secretkey_and_publickey($keys['secret'], $keys['public']);
        $plain = sodium_crypto_box_seal_open($cipher, $pair);
        if ($plain === false || strlen($plain) > 4096) {
            throw new \InvalidArgumentException('登录密文解密失败');
        }
        try {
            $payload = json_decode($plain, true, 8, JSON_THROW_ON_ERROR);
        } catch (\JsonException $e) {
            throw new \InvalidArgumentException('登录数据格式无效');
        } finally {
            sodium_memzero($plain);
        }

        // 紧凑 JSON 严格包含 password、timestamp、challenge_id 三个字段。
        // challenge_id 仅保留兼容协议结构，不进行任何有效性或重复使用检查。
        if (!is_array($payload) || count($payload) !== 3
            || !array_key_exists('password', $payload)
            || !array_key_exists('timestamp', $payload)
            || !array_key_exists('challenge_id', $payload)
            || !is_string($payload['password']) || $payload['password'] === '' || strlen($payload['password']) > 1024
            || !is_int($payload['timestamp'])) {
            throw new \InvalidArgumentException('登录数据格式无效');
        }

        $timestamp = $payload['timestamp'];
        if (abs(time() - $timestamp) > self::TIMESTAMP_WINDOW) {
            throw new \InvalidArgumentException('登录安全信息已过期，请重新尝试');
        }

        return $payload['password'];
    }
}
