<?php
namespace app\service;

use PDO;
use RuntimeException;
use ZipArchive;

/**
 * hMailServer 6.3.8 / schema 6108 database backups.
 * Archives contain DDL and streaming JSONL row data (not email files).
 * Import is ALWAYS restricted to an entirely object-free database.
 */
final class HmailDatabaseBackup
{
    private const VERSION = 6108;
    private const TABLE_COUNT = 132;
    private const FORMAT = 'hmail-db-backup-v1';
    // 上传大小限制；实际还受 PHP upload_max_filesize / post_max_size 与 Nginx 限制。
    private const MAX_UPLOAD_BYTES = 1073741824; // 1 GiB
    private const MAX_ARCHIVE_UNCOMPRESSED_BYTES = 8589934592; // 8 GiB
    private const TYPES = [
        'template' => ['system_template', 'HMAIL_SYSTEM_TEMPLATE', '系统模板备份'],
        'simple' => ['simple', 'HMAIL_SIMPLE', '简易备份'],
        'full' => ['database_full', 'HMAIL_DATABASE_FULL', '数据库全量备份'],
    ];

    // Global configuration seed tables. All other data omitted in template.
    private const SYSTEM_TABLES = [
        'hm_dbversion', 'hm_settings', 'hm_inisettings', 'hm_tcpipports',
        'hm_sslcertificates', 'hm_securityranges', 'hm_dnsbl', 'hm_surblservers',
        'hm_blocked_attachments', 'hm_blocked_senders', 'hm_greylisting_bypass',
        'hm_greylisting_whiteaddresses', 'hm_incoming_relays', 'hm_neverbannames',
        'hm_roles', 'hm_servermessages', 'hm_whitelist', 'hm_routes', 'hm_routeaddresses',
        'hm_remotedomainpolicies', 'hm_alertrules',
    ];
    private const SIMPLE_TABLES = ['hm_domains', 'hm_accounts', 'hm_imapfolders'];

    private static function root(): string
    {
        return rtrim(root_path(), '/\\') . DIRECTORY_SEPARATOR . 'backups';
    }

    private static function ensureDir(string $dir): void
    {
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('备份目录无法创建或没有写入权限');
        }
    }

    private static function typeDir(string $type): string
    {
        if (!isset(self::TYPES[$type])) throw new RuntimeException('备份类型无效');
        return self::root() . DIRECTORY_SEPARATOR . self::TYPES[$type][0];
    }

    private static function pathForName(string $name): array
    {
        if (!preg_match('/^(HMAIL_SYSTEM_TEMPLATE|HMAIL_SIMPLE|HMAIL_DATABASE_FULL)_[0-9]{8}_[0-9]{6}(?:_[0-9]{2})?\.zip$/D', $name)) {
            throw new RuntimeException('备份文件名无效');
        }
        foreach (self::TYPES as $type => $info) {
            if (str_starts_with($name, $info[1] . '_')) {
                return [$type, self::typeDir($type) . DIRECTORY_SEPARATOR . $name];
            }
        }
        throw new RuntimeException('备份类型无效');
    }

    private static function db(): PDO
    {
        $cfg = config('database.connections.mysql');
        if (!is_array($cfg)) throw new RuntimeException('找不到 MariaDB 配置');
        $host = (string) ($cfg['hostname'] ?? '127.0.0.1');
        $name = (string) ($cfg['database'] ?? 'hmailserver');
        $port = (int) ($cfg['hostport'] ?? 3306);
        $charset = 'utf8mb4';
        if ($name === '' || !preg_match('/^[a-zA-Z0-9_\-]+$/D', $name)) throw new RuntimeException('数据库名称不合法');
        $dsn = "mysql:host={$host};port={$port};dbname={$name};charset={$charset}";
        return new PDO($dsn, (string) ($cfg['username'] ?? ''), (string) ($cfg['password'] ?? ''), [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 10,
        ]);
    }

    /**
     * 确保 hm_accounts.accountpassword_plain 存在。
     * 仅在字段不存在时添加到最后一列；不会回填或修改任何邮箱密码。
     */
    public static function ensurePlainPasswordColumn(): array
    {
        // 与备份、恢复、数据库清理共用同一文件锁，避免 DDL 与备份任务并发。
        $lock = self::lockFile();
        try {
            $pdo = self::db();
            $pdo->exec('SET SESSION lock_wait_timeout = 5');

            $table = $pdo->prepare(
                'SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES '
                . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? LIMIT 1'
            );
            $table->execute(['hm_accounts']);
            if ($table->fetchColumn() !== 'BASE TABLE') {
                throw new RuntimeException('数据库中不存在 hm_accounts 数据表，请先初始化 hMailServer 数据库');
            }

            $version = (int) $pdo->query('SELECT `value` FROM `hm_dbversion` LIMIT 1')->fetchColumn();
            if ($version !== self::VERSION) {
                throw new RuntimeException('当前数据库架构版本不是 hMailServer 6.3.8（6108），为避免修改不兼容的数据库，已拒绝添加字段');
            }

            $readColumns = static function () use ($pdo): array {
                $stmt = $pdo->prepare(
                    'SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE, ORDINAL_POSITION '
                    . 'FROM INFORMATION_SCHEMA.COLUMNS '
                    . 'WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? '
                    . 'ORDER BY ORDINAL_POSITION'
                );
                $stmt->execute(['hm_accounts']);
                return $stmt->fetchAll(PDO::FETCH_ASSOC);
            };

            $columns = $readColumns();
            $existing = null;
            foreach ($columns as $column) {
                if (strcasecmp((string) ($column['COLUMN_NAME'] ?? ''), 'accountpassword_plain') === 0) {
                    $existing = $column;
                    break;
                }
            }

            $created = false;
            if ($existing === null) {
                // 表名和字段名固定，不接受任何请求参数拼接进 DDL。
                $pdo->exec('ALTER TABLE `hm_accounts` ADD COLUMN `accountpassword_plain` VARCHAR(255) NULL');
                $created = true;
                $columns = $readColumns();
                $existing = null;
                foreach ($columns as $column) {
                    if (strcasecmp((string) ($column['COLUMN_NAME'] ?? ''), 'accountpassword_plain') === 0) {
                        $existing = $column;
                        break;
                    }
                }
            }

            if (!is_array($existing)) {
                throw new RuntimeException('字段添加后未能在数据库结构中确认，请检查数据库 ALTER 权限及表状态');
            }

            $position = (int) ($existing['ORDINAL_POSITION'] ?? 0);
            $totalColumns = count($columns);
            $isExpectedType = strtolower((string) ($existing['DATA_TYPE'] ?? '')) === 'varchar'
                && (int) ($existing['CHARACTER_MAXIMUM_LENGTH'] ?? 0) === 255
                && strtoupper((string) ($existing['IS_NULLABLE'] ?? '')) === 'YES';
            $isLastColumn = $position === $totalColumns;

            return [
                'created' => $created,
                'exists' => true,
                'column' => 'accountpassword_plain',
                'type' => strtoupper((string) ($existing['DATA_TYPE'] ?? ''))
                    . (strtolower((string) ($existing['DATA_TYPE'] ?? '')) === 'varchar'
                        ? '(' . (int) ($existing['CHARACTER_MAXIMUM_LENGTH'] ?? 0) . ')' : ''),
                'nullable' => strtoupper((string) ($existing['IS_NULLABLE'] ?? '')) === 'YES',
                'position' => $position,
                'totalColumns' => $totalColumns,
                'isLastColumn' => $isLastColumn,
                'structureValid' => $isExpectedType && $isLastColumn,
                'message' => !$isExpectedType
                    ? '字段已存在，但类型或 NULL 属性与预期不一致；为避免影响现有数据，未自动修改。'
                    : (!$isLastColumn
                        ? '字段已存在，但不在最后一列；为避免重排现有表结构，未自动移动。'
                        : ($created ? 'accountpassword_plain 字段已成功添加到 hm_accounts 表最后一列。' : 'accountpassword_plain 字段已存在，结构正常，无需修改。')),
            ];
        } finally {
            self::doneLock($lock);
        }
    }

    private static function objects(PDO $pdo): array
    {
        $tables = $pdo->query('SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()')->fetchAll();
        $routines = (int) $pdo->query('SELECT COUNT(*) FROM INFORMATION_SCHEMA.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE()')->fetchColumn();
        $events = (int) $pdo->query('SELECT COUNT(*) FROM INFORMATION_SCHEMA.EVENTS WHERE EVENT_SCHEMA = DATABASE()')->fetchColumn();
        $triggers = (int) $pdo->query('SELECT COUNT(*) FROM INFORMATION_SCHEMA.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()')->fetchColumn();
        return [$tables, $routines, $events, $triggers];
    }

    private static function assertEmpty(PDO $pdo): void
    {
        [$tables, $routines, $events, $triggers] = self::objects($pdo);
        if ($tables || $routines || $events || $triggers) {
            throw new RuntimeException('目标数据库不是完全空库');
        }
    }

    private static function assertSource(PDO $pdo): array
    {
        [$tables, $routines, $events, $triggers] = self::objects($pdo);
        if ($routines || $events || $triggers) {
            throw new RuntimeException('数据库存在存储过程/事件/触发器，本版本备份不支持这些对象，已拒绝创建不完整备份');
        }
        $names = [];
        foreach ($tables as $row) {
            if ($row['TABLE_TYPE'] !== 'BASE TABLE' || !preg_match('/^hm_[a-z0-9_]+$/D', $row['TABLE_NAME'])) {
                throw new RuntimeException('数据库存在不支持的表或视图：' . $row['TABLE_NAME']);
            }
            $names[] = $row['TABLE_NAME'];
        }
        sort($names);
        if (count($names) !== self::TABLE_COUNT || !in_array('hm_dbversion', $names, true)) {
            throw new RuntimeException('数据库结构不符合 hMailServer 6.3.8：应有 132 张表');
        }
        $version = (int) $pdo->query('SELECT `value` FROM `hm_dbversion` LIMIT 1')->fetchColumn();
        if ($version !== self::VERSION) throw new RuntimeException('数据库架构版本不是 6108，拒绝创建可能不兼容的备份');
        return $names;
    }

    private static function lockFile(bool $exclusive = true)
    {
        self::ensureDir(self::root());
        $handle = fopen(self::root() . DIRECTORY_SEPARATOR . '.operation.lock', 'c');
        if (!$handle || !flock($handle, $exclusive ? LOCK_EX | LOCK_NB : LOCK_SH | LOCK_NB)) {
            throw new RuntimeException('另一个备份或导入操作正在进行');
        }
        return $handle;
    }

    private static function doneLock($handle): void
    {
        if (is_resource($handle)) { flock($handle, LOCK_UN); fclose($handle); }
    }

    private static function useData(string $type, string $table): bool
    {
        return $type === 'full' || in_array($table, self::SYSTEM_TABLES, true)
            || ($type === 'simple' && in_array($table, self::SIMPLE_TABLES, true));
    }

    private static function quoted(string $identifier): string
    {
        if (!preg_match('/^[a-zA-Z0-9_]+$/D', $identifier)) throw new RuntimeException('表/字段名无效');
        return '`' . $identifier . '`';
    }

    private static function writeJson(string $path, $value): void
    {
        $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        if (file_put_contents($path, $json) === false) throw new RuntimeException('备份写入失败');
    }

    public static function create(string $type): array
    {
        @set_time_limit(0);
        ignore_user_abort(true);
        if (!isset(self::TYPES[$type])) throw new RuntimeException('备份类型无效');
        if (!class_exists(ZipArchive::class)) throw new RuntimeException('PHP 未安装 zip 扩展');
        $lock = self::lockFile();
        $tmpDir = '';
        $archivePath = '';
        try {
            $pdo = self::db();
            $tables = self::assertSource($pdo);
            $dir = self::typeDir($type);
            self::ensureDir($dir);
            $stamp = date('Ymd_His');
            $name = self::TYPES[$type][1] . '_' . $stamp . '.zip';
            $i = 0;
            while (file_exists($dir . DIRECTORY_SEPARATOR . $name)) {
                if (++$i > 99) throw new RuntimeException('备份文件名冲突过多');
                $name = self::TYPES[$type][1] . '_' . $stamp . '_' . sprintf('%02d', $i) . '.zip';
            }
            $archivePath = $dir . DIRECTORY_SEPARATOR . $name;
            $tmpDir = self::root() . DIRECTORY_SEPARATOR . '.backup-' . bin2hex(random_bytes(8));
            self::ensureDir($tmpDir);
            self::ensureDir($tmpDir . DIRECTORY_SEPARATOR . 'data');
            $schema = [];
            foreach ($tables as $table) {
                $create = $pdo->query('SHOW CREATE TABLE ' . self::quoted($table))->fetch();
                if (!isset($create['Create Table'])) throw new RuntimeException('无法读取表结构 ' . $table);
                $schema[$table] = $type === 'template'
                    ? preg_replace('/\sAUTO_INCREMENT=\d+/i', '', $create['Create Table'])
                    : $create['Create Table'];
            }
            self::writeJson($tmpDir . '/schema.json', $schema);
            $manifest = [
                'format' => self::FORMAT, 'type' => $type, 'label' => self::TYPES[$type][2],
                'created_at' => date('c'), 'schema_version' => self::VERSION,
                'table_count' => count($tables), 'tables' => [], 'checksums' => [],
                'includes_mail_files' => false,
            ];
            $manifest['checksums']['schema.json'] = hash_file('sha256', $tmpDir . '/schema.json');
            // Stream large tables instead of buffering the complete query result in PHP memory.
            if (defined('PDO::MYSQL_ATTR_USE_BUFFERED_QUERY')) {
                $pdo->setAttribute(PDO::MYSQL_ATTR_USE_BUFFERED_QUERY, false);
            }
            $pdo->exec('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            $pdo->beginTransaction(); // REPEATABLE READ fixes one consistent snapshot on first SELECT
            try {
                foreach ($tables as $table) {
                    $count = 0;
                    if (self::useData($type, $table)) {
                        $stmt = $pdo->query('SHOW COLUMNS FROM ' . self::quoted($table));
                        $binaryFields = [];
                        $selectFields = [];
                        foreach ($stmt->fetchAll() as $column) {
                            // Generated columns exist in SELECT *, but cannot be inserted explicitly during restore.
                            if (stripos((string) ($column['Extra'] ?? ''), 'GENERATED') !== false) continue;
                            $selectFields[] = self::quoted($column['Field']);
                            if (preg_match('/(?:binary|blob|bit)(?:\(|$)/i', $column['Type'])) $binaryFields[$column['Field']] = true;
                        }
                        if (!$selectFields) throw new RuntimeException('没有可导出的列：' . $table);
                        $path = $tmpDir . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . $table . '.jsonl';
                        $fh = fopen($path, 'wb');
                        if (!$fh) throw new RuntimeException('无法写入表数据 ' . $table);
                        try {
                            $query = $pdo->query('SELECT ' . implode(',', $selectFields) . ' FROM ' . self::quoted($table));
                            while ($row = $query->fetch(PDO::FETCH_ASSOC)) {
                                // Template has no accounts: do not retain a mirror mailbox pointing to a removed account.
                                if ($type === 'template' && $table === 'hm_settings'
                                    && strtolower((string) ($row['settingname'] ?? '')) === 'mirroremailaddress') {
                                    $row['settingstring'] = '';
                                    $row['settinginteger'] = 1;
                                }
                                foreach ($binaryFields as $col => $_) {
                                    if ($row[$col] !== null) $row[$col] = ['_binary_base64' => base64_encode($row[$col])];
                                }
                                $line = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
                                if (fwrite($fh, $line) !== strlen($line)) throw new RuntimeException('表数据写入失败');
                                $count++;
                            }
                            $query->closeCursor();
                        } finally { fclose($fh); }
                        $manifest['checksums']['data/' . $table . '.jsonl'] = hash_file('sha256', $path);
                    }
                    $manifest['tables'][$table] = $count;
                }
                $pdo->commit();
            } catch (\Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
            self::writeJson($tmpDir . '/manifest.json', $manifest);
            $zip = new ZipArchive();
            $tmpZip = $archivePath . '.partial';
            if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::EXCL) !== true) throw new RuntimeException('无法创建 ZIP');
            $zip->addFile($tmpDir . '/manifest.json', 'manifest.json');
            $zip->addFile($tmpDir . '/schema.json', 'schema.json');
            foreach ($manifest['checksums'] as $key => $_) {
                if ($key !== 'schema.json') $zip->addFile($tmpDir . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $key), $key);
            }
            if (!$zip->close()) throw new RuntimeException('ZIP 写入失败');
            if (!rename($tmpZip, $archivePath)) throw new RuntimeException('无法发布备份文件');
            @chmod($archivePath, 0600);
            return ['fileName' => $name, 'type' => $type, 'tableCount' => count($tables), 'size' => filesize($archivePath)];
        } finally {
            if ($tmpDir && is_dir($tmpDir)) self::removeTemp($tmpDir);
            if ($archivePath && is_file($archivePath . '.partial')) @unlink($archivePath . '.partial');
            self::doneLock($lock);
        }
    }

    private static function removeTemp(string $dir): void
    {
        foreach (new \FilesystemIterator($dir) as $f) {
            if ($f->isDir()) self::removeTemp($f->getPathname());
            else @unlink($f->getPathname());
        }
        @rmdir($dir);
    }

    /** 从 ZIP 流中限量读取小型元数据，避免依赖压缩包声明的大小。 */
    private static function readZipEntry(ZipArchive $zip, string $entry, int $maxBytes): string
    {
        $stat = $zip->statName($entry);
        if (!is_array($stat) || (int) ($stat['size'] ?? -1) < 0 || (int) $stat['size'] > $maxBytes) {
            throw new RuntimeException('备份元数据大小异常：' . $entry);
        }
        $stream = $zip->getStream($entry);
        if ($stream === false) throw new RuntimeException('备份缺少 ' . $entry);
        try {
            $content = stream_get_contents($stream, $maxBytes + 1);
            if (!is_string($content) || strlen($content) > $maxBytes || strlen($content) !== (int) $stat['size']) {
                throw new RuntimeException('备份元数据内容长度异常：' . $entry);
            }
            return $content;
        } finally {
            fclose($stream);
        }
    }

    /**
     * 验证备份归档本身，不解压任何文件。上传与本地备份恢复共用此校验。
     * 返回的 ZipArchive 由调用方负责 close()。
     */
    private static function inspectArchive(string $path, ?string $expectedType = null): array
    {
        if (!is_file($path) || is_link($path)) throw new RuntimeException('找不到备份文件');
        $zip = new ZipArchive();
        if ($zip->open($path, ZipArchive::RDONLY) !== true) throw new RuntimeException('备份 ZIP 损坏或格式无效');
        try {
            if ($zip->numFiles < 2 || $zip->numFiles > self::TABLE_COUNT + 2) {
                throw new RuntimeException('备份 ZIP 文件数量异常');
            }
            $manifestStat = $zip->statName('manifest.json');
            $schemaStat = $zip->statName('schema.json');
            if (!is_array($manifestStat) || (int) ($manifestStat['size'] ?? 0) < 2 || (int) $manifestStat['size'] > 2097152) {
                throw new RuntimeException('备份清单不存在或大小异常');
            }
            if (!is_array($schemaStat) || (int) ($schemaStat['size'] ?? 0) < 2 || (int) $schemaStat['size'] > 8388608) {
                throw new RuntimeException('备份表结构文件不存在或大小异常');
            }

            $raw = self::readZipEntry($zip, 'manifest.json', 2097152);
            $meta = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
            $type = is_array($meta) ? (string) ($meta['type'] ?? '') : '';
            if (!isset(self::TYPES[$type]) || ($expectedType !== null && $type !== $expectedType) ||
                ($meta['format'] ?? '') !== self::FORMAT || ($meta['schema_version'] ?? null) !== self::VERSION ||
                ($meta['table_count'] ?? null) !== self::TABLE_COUNT || ($meta['includes_mail_files'] ?? null) !== false ||
                !is_array($meta['checksums'] ?? null) || !is_array($meta['tables'] ?? null)) {
                throw new RuntimeException('备份格式、类型或数据库架构版本不兼容');
            }

            $schemaRaw = self::readZipEntry($zip, 'schema.json', 8388608);
            if (!is_string($meta['checksums']['schema.json'] ?? null) ||
                !hash_equals($meta['checksums']['schema.json'], hash('sha256', $schemaRaw))) {
                throw new RuntimeException('表结构文件校验失败');
            }
            $schema = json_decode($schemaRaw, true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($schema) || count($schema) !== self::TABLE_COUNT || count($meta['tables']) !== self::TABLE_COUNT) {
                throw new RuntimeException('备份表结构不完整');
            }

            $schemaKeys = array_keys($schema);
            $manifestTableKeys = array_keys($meta['tables']);
            sort($schemaKeys, SORT_STRING);
            sort($manifestTableKeys, SORT_STRING);
            if ($schemaKeys !== $manifestTableKeys) throw new RuntimeException('备份清单与表结构不一致');

            $expectedEntries = ['manifest.json' => true, 'schema.json' => true];
            $expectedChecksums = ['schema.json' => true];
            foreach ($schema as $table => $ddl) {
                if (!is_string($table) || !preg_match('/^hm_[a-z0-9_]+$/D', $table)) {
                    throw new RuntimeException('备份包含非法数据表名称');
                }
                self::quoted($table);
                if (!is_string($ddl) || strlen($ddl) > 1048576 || strpos($ddl, ';') !== false
                    || !preg_match('/^CREATE TABLE `' . preg_quote($table, '/') . '`\s*\(/i', $ddl)) {
                    throw new RuntimeException('表结构异常：' . $table);
                }
                if (!is_int($meta['tables'][$table]) || $meta['tables'][$table] < 0) {
                    throw new RuntimeException('缺少表记录数：' . $table);
                }
                $entry = 'data/' . $table . '.jsonl';
                if (!self::useData($type, $table)) {
                    if ($meta['tables'][$table] > 0) throw new RuntimeException('备份范围不正确');
                } else {
                    if (!is_string($meta['checksums'][$entry] ?? null)) throw new RuntimeException('缺少表数据：' . $table);
                    $expectedEntries[$entry] = true;
                    $expectedChecksums[$entry] = true;
                }
            }

            $checksumKeys = array_keys($meta['checksums']);
            $expectedChecksumKeys = array_keys($expectedChecksums);
            sort($checksumKeys, SORT_STRING);
            sort($expectedChecksumKeys, SORT_STRING);
            if ($checksumKeys !== $expectedChecksumKeys) throw new RuntimeException('备份校验清单包含缺失或多余文件');

            // 严格限定 ZIP 内部文件名，拒绝额外目录、重复项、路径穿越项和压缩炸弹。
            $actualEntries = [];
            $entrySizes = [];
            $totalUncompressed = 0;
            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);
                if (!is_array($stat) || !isset($stat['name'])) throw new RuntimeException('ZIP 文件目录异常');
                $entry = (string) $stat['name'];
                if (isset($actualEntries[$entry]) || !isset($expectedEntries[$entry])) {
                    throw new RuntimeException('备份 ZIP 包含重复或未允许的文件');
                }
                $actualEntries[$entry] = true;
                $entrySize = (int) ($stat['size'] ?? -1);
                $entrySizes[$entry] = $entrySize;
                if ($entrySize < 0 || $entrySize > self::MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
                    throw new RuntimeException('备份文件解压后大小异常');
                }
                $totalUncompressed += $entrySize;
                if ($totalUncompressed > self::MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
                    throw new RuntimeException('备份解压后总大小超过安全限制');
                }
            }
            $actualKeys = array_keys($actualEntries);
            $expectedKeys = array_keys($expectedEntries);
            sort($actualKeys, SORT_STRING);
            sort($expectedKeys, SORT_STRING);
            if ($actualKeys !== $expectedKeys) throw new RuntimeException('备份 ZIP 文件不完整');

            foreach ($meta['checksums'] as $entry => $hash) {
                if (!is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)) {
                    throw new RuntimeException('备份校验值无效');
                }
                $stream = $zip->getStream($entry);
                if ($stream === false) throw new RuntimeException('备份缺少 ' . $entry);
                $ctx = hash_init('sha256');
                $readBytes = 0;
                try {
                    while (!feof($stream)) {
                        $chunk = fread($stream, 1048576);
                        if ($chunk === false) throw new RuntimeException('读取备份数据失败：' . $entry);
                        if ($chunk === '') {
                            if (!feof($stream)) throw new RuntimeException('备份数据流异常：' . $entry);
                            break;
                        }
                        $readBytes += strlen($chunk);
                        if ($readBytes > ($entrySizes[$entry] ?? 0) || $readBytes > self::MAX_ARCHIVE_UNCOMPRESSED_BYTES) {
                            throw new RuntimeException('备份数据实际解压大小异常：' . $entry);
                        }
                        hash_update($ctx, $chunk);
                    }
                } finally {
                    fclose($stream);
                }
                if ($readBytes !== ($entrySizes[$entry] ?? -1) || !hash_equals($hash, hash_final($ctx))) {
                    throw new RuntimeException('备份文件损坏：' . $entry);
                }
            }
            return [$zip, $meta, $schema, $type, $path];
        } catch (\Throwable $e) {
            $zip->close();
            throw $e;
        }
    }

    private static function openValidated(string $name): array
    {
        [$type, $path] = self::pathForName($name);
        return self::inspectArchive($path, $type);
    }

    /** 上传已登录管理员提供的本系统 ZIP；校验通过后按清单类型自动归档，不执行恢复。 */
    public static function upload(\think\file\UploadedFile $file): array
    {
        @set_time_limit(0);
        ignore_user_abort(true);
        if (!class_exists(ZipArchive::class)) throw new RuntimeException('PHP 未安装 zip 扩展');
        if (!$file->isValid()) throw new RuntimeException('上传文件无效，请重新选择');
        if (strtolower($file->getOriginalExtension()) !== 'zip') throw new RuntimeException('只允许上传 ZIP 格式的本系统备份');
        $size = (int) $file->getSize();
        if ($size <= 0) throw new RuntimeException('上传文件为空');
        if ($size > self::MAX_UPLOAD_BYTES) throw new RuntimeException('备份文件超过 1 GB 上传限制');

        $lock = self::lockFile();
        $tempPath = '';
        try {
            $incomingDir = self::root() . DIRECTORY_SEPARATOR . '.incoming';
            self::ensureDir($incomingDir);
            @chmod($incomingDir, 0700);
            $tempName = 'upload-' . bin2hex(random_bytes(16)) . '.zip';
            $moved = $file->move($incomingDir, $tempName);
            $tempPath = $moved->getPathname();
            @chmod($tempPath, 0600);

            [$zip, $meta, $schema, $type] = self::inspectArchive($tempPath);
            $zip->close();

            $dir = self::typeDir($type);
            self::ensureDir($dir);
            $prefix = self::TYPES[$type][1];
            $stamp = date('Ymd_His');
            $name = $prefix . '_' . $stamp . '.zip';
            $suffix = 0;
            while (file_exists($dir . DIRECTORY_SEPARATOR . $name)) {
                if (++$suffix > 99) throw new RuntimeException('备份文件名冲突过多，请稍后重试');
                $name = $prefix . '_' . $stamp . '_' . sprintf('%02d', $suffix) . '.zip';
            }
            $target = $dir . DIRECTORY_SEPARATOR . $name;
            if (!rename($tempPath, $target)) throw new RuntimeException('校验通过，但无法将备份保存到正式目录');
            $tempPath = '';
            @chmod($target, 0600);

            return [
                'fileName' => $name,
                'type' => $type,
                'typeName' => self::TYPES[$type][2],
                'tableCount' => count($schema),
                'size' => (int) filesize($target),
                'createdAt' => (string) ($meta['created_at'] ?? ''),
            ];
        } finally {
            if ($tempPath !== '' && is_file($tempPath)) @unlink($tempPath);
            self::doneLock($lock);
        }
    }

    public static function listFiles(): array
    {
        $result = [];
        foreach (self::TYPES as $type => $info) {
            $dir = self::typeDir($type);
            if (!is_dir($dir)) continue;
            foreach (new \DirectoryIterator($dir) as $file) {
                if (!$file->isFile() || $file->isLink()) continue;
                $name = $file->getFilename();
                try { [$parsed] = self::pathForName($name); } catch (\Throwable $e) { continue; }
                if ($parsed !== $type) continue;
                $result[] = [
                    'fileName' => $name, 'type' => $type, 'typeName' => $info[2],
                    'size' => $file->getSize(), 'time' => date('Y-m-d H:i:s', $file->getMTime()),
                    'containsMailFiles' => false,
                ];
            }
        }
        usort($result, static fn($a, $b) => strcmp($b['time'], $a['time']) ?: strcmp($b['fileName'], $a['fileName']));
        return $result;
    }

    public static function validate(string $name): array
    {
        [$zip, $meta] = self::openValidated($name);
        $zip->close();
        return ['type' => $meta['type'], 'tableCount' => $meta['table_count'], 'rows' => array_sum($meta['tables']), 'createdAt' => $meta['created_at'] ?? ''];
    }

    public static function import(string $name): array
    {
        @set_time_limit(0);
        ignore_user_abort(true);
        $lock = self::lockFile();
        $zip = null;
        try {
            [$zip, $meta, $schema, $type] = self::openValidated($name);
            $pdo = self::db();
            // An advisory lock prevents other imports, not external hMailServer writes.
            $advisory = 'hmail-db-restore-' . sha1((string) config('database.connections.mysql.database'));
            $s = $pdo->prepare('SELECT GET_LOCK(?, 0)');
            $s->execute([$advisory]);
            if ((int) $s->fetchColumn() !== 1) throw new RuntimeException('数据库正在被其他恢复任务占用');
            try {
                self::assertEmpty($pdo);
                $pdo->exec("SET SESSION sql_mode='NO_AUTO_VALUE_ON_ZERO'");
                $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS=0');
                // DDL is not transactional: failures leave partial tables and require a NEW empty database.
                foreach ($schema as $table => $ddl) $pdo->exec($ddl);
                foreach ($schema as $table => $_) {
                    if (!self::useData($type, $table)) continue;
                    $fh = $zip->getStream('data/' . $table . '.jsonl');
                    if (!$fh) throw new RuntimeException('缺少数据文件 ' . $table);
                    $rowCount = 0;
                    try {
                        $insert = null;
                        $columns = [];
                        while (($line = fgets($fh)) !== false) {
                            $row = json_decode($line, true, 512, JSON_THROW_ON_ERROR);
                            if (!is_array($row) || !$row) throw new RuntimeException('数据行无效：' . $table);
                            if ($insert === null) {
                                $columns = array_keys($row);
                                $names = implode(',', array_map([self::class, 'quoted'], $columns));
                                $marks = implode(',', array_fill(0, count($columns), '?'));
                                $insert = $pdo->prepare('INSERT INTO ' . self::quoted($table) . ' (' . $names . ') VALUES (' . $marks . ')');
                            }
                            if (array_keys($row) !== $columns) throw new RuntimeException('表字段顺序异常：' . $table);
                            foreach ($row as &$value) {
                                if (is_array($value)) {
                                    if (count($value) !== 1 || !isset($value['_binary_base64'])) throw new RuntimeException('无效二进制内容');
                                    $value = base64_decode($value['_binary_base64'], true);
                                    if ($value === false) throw new RuntimeException('二进制内容损坏');
                                }
                            }
                            unset($value);
                            $insert->execute(array_values($row));
                            $rowCount++;
                        }
                    } finally { fclose($fh); }
                    if ($rowCount !== $meta['tables'][$table]) throw new RuntimeException('备份数据条数不符：' . $table);
                }
                $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS=1');
                foreach ($meta['tables'] as $table => $count) {
                    $actual = (int) $pdo->query('SELECT COUNT(*) FROM ' . self::quoted($table))->fetchColumn();
                    if ($actual !== $count) throw new RuntimeException('导入校验失败：' . $table);
                }
                $version = (int) $pdo->query('SELECT `value` FROM `hm_dbversion` LIMIT 1')->fetchColumn();
                if ($version !== self::VERSION) throw new RuntimeException('架构版本校验失败');
                return ['type' => $type, 'tableCount' => count($schema), 'totalRows' => array_sum($meta['tables']),
                    'mailFilesPending' => $type === 'full' && ($meta['tables']['hm_messages'] ?? 0) > 0];
            } finally {
                try { $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS=1'); } catch (\Throwable $e) {}
                $s = $pdo->prepare('SELECT RELEASE_LOCK(?)');
                $s->execute([$advisory]);
            }
        } finally {
            if ($zip instanceof ZipArchive) $zip->close();
            self::doneLock($lock);
        }
    }

    /**
     * Preview the destructive cleanup. Keep exactly the same rows as a SIMPLE
     * backup: system seed tables plus hm_domains, hm_accounts and hm_imapfolders.
     */
    private static function cleanupPlan(PDO $pdo): array
    {
        $tables = self::assertSource($pdo);
        $preserve = [];
        $clear = [];
        foreach ($tables as $table) {
            if (self::useData('simple', $table)) $preserve[] = $table;
            else $clear[] = $table;
        }
        $required = array_values(array_unique(array_merge(self::SYSTEM_TABLES, self::SIMPLE_TABLES)));
        sort($required);
        if ($preserve !== $required || count($clear) + count($preserve) !== self::TABLE_COUNT
            || in_array('hm_messages', $preserve, true)) {
            throw new RuntimeException('简易备份保留表清单与当前数据库结构不匹配，拒绝清理');
        }
        // A retained table must never have an FK pointing at a table we clear.
        // This check prevents leaving preserved records with broken references
        // if the schema was customized but kept the same version number.
        $fk = $pdo->query('SELECT TABLE_NAME, REFERENCED_TABLE_NAME FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE '
            . 'WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_SCHEMA = DATABASE() '
            . 'AND REFERENCED_TABLE_NAME IS NOT NULL')->fetchAll();
        foreach ($fk as $row) {
            if (in_array($row['TABLE_NAME'], $preserve, true)
                && in_array($row['REFERENCED_TABLE_NAME'], $clear, true)) {
                throw new RuntimeException('保留表依赖待清理表，已拒绝执行：' . $row['TABLE_NAME']);
            }
        }
        return ['tableCount' => count($tables), 'preserveCount' => count($preserve),
            'clearCount' => count($clear), 'preserveTables' => $preserve, 'clearTables' => $clear,
            'nonTransactional' => true, 'automaticBackup' => false, 'stopMailService' => false];
    }

    public static function cleanupPreview(): array
    {
        // Read-only check, does not create a backup or change database data.
        $pdo = self::db();
        return self::cleanupPlan($pdo);
    }

    /** Irreversible TRUNCATE, consciously without backup or mail-service shutdown. */
    public static function cleanup(): array
    {
        @set_time_limit(0);
        ignore_user_abort(true);
        $lock = self::lockFile();
        $pdo = null;
        $gotAdvisory = false;
        $foreignKeysChanged = false;
        $previousForeignKeys = 1;
        $completed = [];
        try {
            $pdo = self::db();
            $advisory = 'hmail-db-restore-' . sha1((string) config('database.connections.mysql.database'));
            $stmt = $pdo->prepare('SELECT GET_LOCK(?, 0)');
            $stmt->execute([$advisory]);
            if ((int) $stmt->fetchColumn() !== 1) {
                throw new RuntimeException('数据库正被其他备份恢复或清理任务占用');
            }
            $gotAdvisory = true;
            $plan = self::cleanupPlan($pdo);
            $previousForeignKeys = (int) $pdo->query('SELECT @@SESSION.foreign_key_checks')->fetchColumn();
            // DDL lock waits must not block indefinitely if hMailServer is active.
            $pdo->exec('SET SESSION lock_wait_timeout = 5');
            $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = 0');
            $foreignKeysChanged = true;
            foreach ($plan['clearTables'] as $table) {
                try {
                    $pdo->exec('TRUNCATE TABLE ' . self::quoted($table));
                    $completed[] = $table;
                } catch (\Throwable $e) {
                    // TRUNCATE commits immediately; earlier tables cannot be rolled back.
                    throw new RuntimeException('清理中断：已清空 ' . count($completed)
                        . ' 张表，执行到 ' . $table . ' 时失败：' . $e->getMessage()
                        . '。前面已经清空的数据不可回滚。', 0, $e);
                }
            }
            $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = ' . $previousForeignKeys);
            $foreignKeysChanged = false;
            $remaining = [];
            foreach ($plan['clearTables'] as $table) {
                // Only existence test; counting rows in large mail/log tables is unnecessary.
                if ($pdo->query('SELECT 1 FROM ' . self::quoted($table) . ' LIMIT 1')->fetchColumn() !== false) {
                    $remaining[] = $table;
                }
            }
            return ['tableCount' => $plan['tableCount'], 'preserveCount' => $plan['preserveCount'],
                'truncatedCount' => count($completed), 'remainingNonEmpty' => $remaining,
                'concurrentWritesPossible' => true];
        } finally {
            if ($pdo instanceof PDO) {
                if ($foreignKeysChanged) {
                    try { $pdo->exec('SET SESSION FOREIGN_KEY_CHECKS = ' . $previousForeignKeys); }
                    catch (\Throwable $ignored) { /* connection will be closed */ }
                }
                if ($gotAdvisory) {
                    try {
                        $stmt = $pdo->prepare('SELECT RELEASE_LOCK(?)');
                        $stmt->execute([$advisory]);
                    } catch (\Throwable $ignored) { /* connection will be closed */ }
                }
            }
            self::doneLock($lock);
        }
    }

    public static function remove(array $names): array
    {
        $lock = self::lockFile();
        try {
            $paths = [];
            foreach ($names as $name) {
                if (!is_string($name)) throw new RuntimeException('备份文件名无效');
                [, $path] = self::pathForName($name);
                if (!is_file($path) || is_link($path)) throw new RuntimeException('找不到备份：' . $name);
                $paths[$name] = $path;
            }
            $deleted = [];
            foreach ($paths as $name => $path) {
                if (!unlink($path)) throw new RuntimeException('无法删除备份：' . $name);
                $deleted[] = $name;
            }
            return $deleted;
        } finally { self::doneLock($lock); }
    }

    public static function file(string $name): string
    {
        [, $path] = self::pathForName($name);
        if (!is_file($path) || is_link($path)) throw new RuntimeException('备份文件不存在');
        return $path;
    }
}
