<?php
/**
 * 仅 CLI：修复旧增量包生成的无效 $pbkdf2-sha256$... 账户哈希。
 * 默认只检查；只有显式 --apply 才更新数据库。
 * 环境变量：HMAIL_REPAIR_DSN、HMAIL_REPAIR_DB_USER、HMAIL_REPAIR_DB_PASSWORD。
 * 不访问 hMailServer REST/COM；不打印明文密码或完整哈希。
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('CLI only');
}

require_once dirname(__DIR__) . '/app/service/HmailPasswordHasher.php';

use app\service\HmailPasswordHasher as Hasher;

$apply = in_array('--apply', $argv, true);
$limit = 500;
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--limit=')) {
        $value = substr($arg, 8);
        if (!preg_match('/^[1-9][0-9]{0,4}$/D', $value) || (int) $value > 10000) {
            fwrite(STDERR, "--limit 应为 1 至 10000 的整数\n");
            exit(2);
        }
        $limit = (int) $value;
    } elseif (str_starts_with($arg, '--') && !in_array($arg, ['--apply', '--dry-run'], true)) {
        fwrite(STDERR, "未知参数：{$arg}\n");
        exit(2);
    }
}

$dsn = getenv('HMAIL_REPAIR_DSN') ?: '';
$username = getenv('HMAIL_REPAIR_DB_USER') ?: '';
$password = getenv('HMAIL_REPAIR_DB_PASSWORD');
if ($dsn === '' || $username === '' || $password === false) {
    fwrite(STDERR, "请通过环境变量提供 HMAIL_REPAIR_DSN、HMAIL_REPAIR_DB_USER 和 HMAIL_REPAIR_DB_PASSWORD\n");
    exit(2);
}
if (!str_starts_with($dsn, 'mysql:')) {
    fwrite(STDERR, "仅支持 MySQL/MariaDB PDO DSN；不要连接其他数据库。\n");
    exit(2);
}

try {
    $db = new PDO($dsn, $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    // 表名为固定常量，不接收用户输入。
    $stmt = $db->prepare(
        'SELECT accountid, accountpassword, accountpassword_plain FROM hm_accounts '
        . 'WHERE accountpwencryption = 4 AND accountpassword LIKE :pattern '
        . 'ORDER BY accountid LIMIT ' . $limit
    );
    $stmt->execute(['pattern' => '$pbkdf2-sha256$i=%']);
    $update = $db->prepare(
        'UPDATE hm_accounts SET accountpassword = :newhash '
        . 'WHERE accountid = :id AND accountpwencryption = 4 '
        . 'AND BINARY accountpassword = BINARY :oldhash '
        . 'AND BINARY accountpassword_plain = BINARY :plain'
    );
    $counts = [
        'found' => 0,
        'verified' => 0,
        'updated' => 0,
        'missing_plain' => 0,
        'mismatch' => 0,
        'changed_concurrently' => 0,
    ];
    while ($row = $stmt->fetch()) {
        ++$counts['found'];
        $old = (string) $row['accountpassword'];
        $plain = $row['accountpassword_plain'];
        if (!Hasher::isLegacyInvalidHash($old)
            || !is_string($plain) || $plain === '') {
            ++$counts['missing_plain'];
            continue;
        }
        if (!Hasher::verifyLegacyInvalid($plain, $old)) {
            ++$counts['mismatch'];
            continue;
        }
        ++$counts['verified'];
        if (!$apply) {
            continue;
        }
        $new = Hasher::hash($plain);
        $update->execute([
            'newhash' => $new,
            'id' => (int) $row['accountid'],
            'oldhash' => $old,
            'plain' => $plain,
        ]);
        if ($update->rowCount() === 1) {
            ++$counts['updated'];
        } else {
            ++$counts['changed_concurrently'];
        }
    }
    echo $apply ? "模式：已授权执行修复\n" : "模式：只读检查，不修改任何数据\n";
    foreach ($counts as $key => $value) {
        echo "{$key}: {$value}\n";
    }
    echo "检查限制：{$limit} 条候选记录；不会处理原本就是正确格式的账户。\n";
    if (!$apply) {
        echo "确认检查结果、备份数据库后，再使用 --apply。\n";
    }
} catch (Throwable $e) {
    fwrite(STDERR, '修复未完成：' . $e->getMessage() . "\n");
    exit(1);
}
