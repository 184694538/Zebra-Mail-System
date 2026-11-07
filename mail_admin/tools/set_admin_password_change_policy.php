<?php
/**
 * 仅供命令行使用：安全地修改 config_private/admin_auth.php 中的自助改密开关。
 * 用法：php tools/set_admin_password_change_policy.php 1  （禁用管理员自助改密）
 *       php tools/set_admin_password_change_policy.php 0  （允许管理员自助改密）
 */
if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit(1);
}

$value = $argv[1] ?? '1';
if ($value !== '0' && $value !== '1') {
    fwrite(STDERR, "参数只能是 0 或 1。\n");
    exit(2);
}

$root = dirname(__DIR__);
$configFile = $root . DIRECTORY_SEPARATOR . 'config_private' . DIRECTORY_SEPARATOR . 'admin_auth.php';
if (!is_file($configFile) || !is_readable($configFile)) {
    fwrite(STDERR, "找不到或无法读取 config_private/admin_auth.php。\n");
    exit(3);
}

try {
    $config = (static function (string $path) {
        return include $path;
    })($configFile);
} catch (Throwable $e) {
    fwrite(STDERR, "读取管理员配置失败，请检查 PHP 配置文件语法。\n");
    exit(4);
}

if (!is_array($config)
    || trim((string)($config['username'] ?? '')) === ''
    || (string)($config['password'] ?? '') === '') {
    fwrite(STDERR, "管理员配置内容不完整，未执行修改。\n");
    exit(5);
}

$config['disable_self_password_change'] = (int)$value;
$content = "<?php\n// 私有管理员认证配置。严禁公开/提交仓库；文件权限必须为 0600。\nreturn "
    . var_export($config, true) . ";\n";

$tempFile = $configFile . '.tmp.' . bin2hex(random_bytes(8));
$oldUmask = umask(0077); // 临时文件从创建起即为仅文件所有者可读写。
$written = @file_put_contents($tempFile, $content, LOCK_EX);
umask($oldUmask);
if ($written !== strlen($content)) {
    @unlink($tempFile);
    fwrite(STDERR, "临时配置写入失败，请检查 config_private 目录权限。\n");
    exit(6);
}
@chmod($tempFile, 0600);
if (!@rename($tempFile, $configFile)) {
    @unlink($tempFile);
    fwrite(STDERR, "配置替换失败，原配置保持不变。\n");
    exit(7);
}
@chmod($configFile, 0600);
if (function_exists('opcache_invalidate')) {
    @opcache_invalidate($configFile, true);
}

fwrite(STDOUT, $value === '1'
    ? "已启用管理员自助改密锁定：后端接口将拒绝管理员自行修改账号/密码。\n"
    : "已解除管理员自助改密锁定：管理员可通过后台修改账号/密码。\n");
