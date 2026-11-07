<?php
namespace app\service;

/**
 * 管理后台专用的 IP 连续登录失败限制。
 * 不区分管理员账号，同一客户端 IP 的失败次数共享；成功后清零。
 * JSON 以真实 IP 作为键，记录与锁文件独立存放在 config_private。
 */
final class AdminLoginRateLimiter
{
    private const DATA_FILE = 'admin_login_rate.json';
    private const LOCK_FILE = 'admin_login_rate.lock';
    private const MAX_FAILURES = 10;
    private const LOCK_SECONDS = 300;

    private static function normalizeIp(string $clientIp): string
    {
        // 只保存 Web 服务器确认的真实客户端 IP；不哈希，也不直接信任 X-Forwarded-For。
        $clientIp = trim($clientIp);
        $packedIp = @inet_pton($clientIp);
        if ($packedIp === false) {
            throw new \RuntimeException('无法确认登录请求的来源 IP');
        }

        $normalizedIp = @inet_ntop($packedIp);
        if (!is_string($normalizedIp) || $normalizedIp === '') {
            throw new \RuntimeException('无法规范化登录请求的来源 IP');
        }

        // inet_ntop 将 IPv6 地址规范化，避免同一地址因不同缩写形式产生多条记录。
        return strtolower($normalizedIp);
    }

    /** 在独立的锁文件上加锁。不得锁 JSON 本身，以免与原子替换发生竞态。 */
    private static function withLock(callable $operation)
    {
        if (!PrivateConfigStorage::ensureDirectory()) {
            throw new \RuntimeException('无法访问管理员登录限制目录');
        }
        $fp = @fopen(PrivateConfigStorage::path(self::LOCK_FILE), 'c');
        if ($fp === false) {
            throw new \RuntimeException('无法打开管理员登录限制文件锁');
        }
        @chmod(PrivateConfigStorage::path(self::LOCK_FILE), 0600);
        try {
            if (!@flock($fp, LOCK_EX)) {
                throw new \RuntimeException('无法锁定管理员登录限制记录');
            }
            return $operation();
        } finally {
            @flock($fp, LOCK_UN);
            @fclose($fp);
        }
    }

    /** 只在持有锁时读取或首次初始化；损坏/不可写时拒绝登录（fail closed）。 */
    private static function load(): array
    {
        $path = PrivateConfigStorage::path(self::DATA_FILE);
        if (!is_file($path)) {
            $data = ['ips' => []];
            self::save($data);
            return $data;
        }
        $raw = @file_get_contents($path);
        $data = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($data) || !isset($data['ips']) || !is_array($data['ips'])) {
            throw new \RuntimeException('管理员登录限制数据损坏');
        }

        // 兼容旧版 SHA-256 IP 键：哈希无法反向还原真实 IP，因此清除旧哈希记录，
        // 后续请求统一使用真实 IP 作为 JSON 键。旧哈希记录对应的封禁状态无法迁移。
        $realIpRecords = [];
        $needsRewrite = false;
        foreach ($data['ips'] as $storedIp => $record) {
            if (!is_array($record)) {
                throw new \RuntimeException('管理员登录限制数据格式无效');
            }

            try {
                $realIp = self::normalizeIp((string) $storedIp);
            } catch (\RuntimeException $e) {
                $needsRewrite = true;
                continue;
            }

            if ($realIp !== (string) $storedIp) {
                $needsRewrite = true;
            }
            $realIpRecords[$realIp] = $record;
        }

        $data['ips'] = $realIpRecords;
        if ($needsRewrite) {
            self::save($data);
        }

        return $data;
    }

    /** 在 JSON 中将空的 IP 集合明确存为 {}。 */
    private static function save(array $data): void
    {
        $json = json_encode(['ips' => (object) $data['ips']], JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (!PrivateConfigStorage::write(self::DATA_FILE, $json)) {
            throw new \RuntimeException('管理员登录限制数据写入失败');
        }
    }

    private static function retryAfter(array $record, int $now): int
    {
        $until = (int) ($record['locked_until'] ?? 0);
        return max(0, $until - $now);
    }

    /** 登录请求在解密之前也执行此检查，封禁中的 IP 不参与密码校验。 */
    public static function check(string $clientIp): int
    {
        $key = self::normalizeIp($clientIp);
        return self::withLock(static function () use ($key): int {
            $data = self::load();
            $record = $data['ips'][$key] ?? [];
            if (!is_array($record)) {
                throw new \RuntimeException('管理员登录限制数据格式无效');
            }
            return self::retryAfter($record, time());
        });
    }

    /**
     * 在同一把锁中执行账号密码验证并更新计数，避免并发请求越过第 10 次限制。
     * 返回 ['authenticated' => bool, 'retry_after' => int]。
     * 调用方只需传入验证账号密码的函数，不要在此回调中写入会话。
     */
    public static function verify(string $clientIp, callable $verifyCredentials): array
    {
        $key = self::normalizeIp($clientIp);
        return self::withLock(static function () use ($key, $verifyCredentials): array {
            $now = time();
            $data = self::load();
            $record = $data['ips'][$key] ?? [];
            if (!is_array($record)) {
                throw new \RuntimeException('管理员登录限制数据格式无效');
            }
            $remaining = self::retryAfter($record, $now);
            if ($remaining > 0) {
                return ['authenticated' => false, 'retry_after' => $remaining];
            }

            // 封禁到期即解除并重置计数；普通失败计数不设时间窗口，只有登录成功才清零。
            if ((int) ($record['locked_until'] ?? 0) > 0) {
                $record = [];
            }

            if ($verifyCredentials()) {
                if (isset($data['ips'][$key])) {
                    unset($data['ips'][$key]);
                    self::save($data);
                }
                return ['authenticated' => true, 'retry_after' => 0];
            }

            $count = min(self::MAX_FAILURES, max(0, (int) ($record['fail_count'] ?? 0)) + 1);
            $lockedUntil = $count >= self::MAX_FAILURES ? $now + self::LOCK_SECONDS : 0;
            $data['ips'][$key] = [
                'fail_count' => $count,
                'locked_until' => $lockedUntil,
                'updated_at' => $now,
            ];
            // 移除已过期的封禁记录，不影响其他真实 IP 未完成的连续失败计数。
            foreach ($data['ips'] as $storedIp => $entry) {
                if ($storedIp !== $key && is_array($entry)
                    && (int) ($entry['locked_until'] ?? 0) > 0
                    && (int) ($entry['locked_until'] ?? 0) <= $now) {
                    unset($data['ips'][$storedIp]);
                }
            }
            self::save($data);
            return [
                'authenticated' => false,
                'retry_after' => $lockedUntil > 0 ? self::LOCK_SECONDS : 0,
            ];
        });
    }
}
