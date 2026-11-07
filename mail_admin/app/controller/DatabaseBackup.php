<?php
namespace app\controller;

use app\service\HmailDatabaseBackup;
use think\facade\Request;
use think\file\UploadedFile;

/** Admin-authenticated database backup actions. */
class DatabaseBackup extends BaseController
{
    private function safe(callable $action)
    {
        try {
            return $this->createResponse(200, '操作成功', $action());
        } catch (\Throwable $e) {
            return $this->createResponse(400, $e->getMessage());
        }
    }

    public function lists()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        return $this->safe(static fn() => HmailDatabaseBackup::listFiles());
    }

    public function create()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        return $this->safe(static fn() => HmailDatabaseBackup::create((string) Request::post('type', '')));
    }

    /**
     * 上传已有的本系统 ZIP 备份。此控制器继承 BaseController，构造阶段已强制校验管理员 Token。
     * 文件仅在校验完整通过后归档，不会在上传时执行数据库恢复。
     */
    public function upload()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        return $this->safe(static function () {
            $file = Request::file('backupFile');
            if (!$file instanceof UploadedFile) {
                throw new \RuntimeException('请选择要上传的 ZIP 备份文件');
            }
            return HmailDatabaseBackup::upload($file);
        });
    }

    public function verify()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        return $this->safe(static fn() => HmailDatabaseBackup::validate((string) Request::post('fileName', '')));
    }

    public function restore()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        $confirmed = (string) Request::post('confirm', '');
        if ($confirmed !== 'YES_EMPTY_DATABASE') return $this->createResponse(400, '请先确认目标数据库完全空白');
        try {
            return $this->createResponse(200, '导入成功', HmailDatabaseBackup::import((string) Request::post('fileName', '')));
        } catch (\Throwable $e) {
            // 空数据库校验失败仅给出简短提示，其余错误仍保留详细原因。
            if (str_contains($e->getMessage(), '目标数据库不是完全空库')) {
                return $this->createResponse(400, '导入失败：目标数据库不是完全空库');
            }
            return $this->createResponse(400, '导入失败：' . $e->getMessage() . '。如果已开始建表，数据库可能残留部分表；请另建完全空白的数据库再恢复。');
        }
    }

    /** 手动检查并补齐邮箱明文密码字段。 */
    public function ensurePlainPasswordColumn()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        return $this->safe(static fn() => HmailDatabaseBackup::ensurePlainPasswordColumn());
    }

    public function cleanupPreview()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        return $this->safe(static fn() => HmailDatabaseBackup::cleanupPreview());
    }

    public function cleanup()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        if ((string) Request::post('confirm', '') !== 'TRUNCATE_SIMPLE_SCOPE') {
            return $this->createResponse(400, '请先确认不可回滚清理操作');
        }
        try {
            return $this->createResponse(200, '清理完成', HmailDatabaseBackup::cleanup());
        } catch (\Throwable $e) {
            return $this->createResponse(400, $e->getMessage());
        }
    }

    public function delete()
    {
        if (!Request::isPost()) return $this->createResponse(405, '仅允许 POST');
        return $this->safe(static function () {
            $raw = (string) Request::post('fileNames', '');
            $list = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
            if (!is_array($list) || !$list || count($list) > 200 || count(array_unique($list)) !== count($list)) {
                throw new \RuntimeException('请选择 1～200 个不同的备份文件');
            }
            return HmailDatabaseBackup::remove($list);
        });
    }

    public function download()
    {
        if (!Request::isGet()) {
            return $this->createResponse(405, '仅允许 GET')->code(405);
        }

        $handle = null;
        try {
            $fileName = (string) Request::get('fileName', '');
            $path = HmailDatabaseBackup::file($fileName);
            if (!is_file($path) || is_link($path) || !is_readable($path)) {
                throw new \RuntimeException('备份文件不存在或不可读取');
            }

            // 在发送响应头之前打开文件并确认长度，避免返回一个空的下载响应。
            $handle = @fopen($path, 'rb');
            if ($handle === false) {
                $handle = null;
                throw new \RuntimeException('服务器无法读取备份文件');
            }
            $stat = fstat($handle);
            $size = (int) ($stat['size'] ?? 0);
            if ($size <= 0) {
                throw new \RuntimeException('备份文件内容为空，已阻止下载');
            }

            if (headers_sent($sentFile, $sentLine)) {
                throw new \RuntimeException('服务器已提前输出内容，无法安全开始下载');
            }

            // 直接流式传输文件，不再经由框架 File 响应读取整个文件到内存。
            @ini_set('zlib.output_compression', '0');
            while (ob_get_level() > 0) {
                if (!@ob_end_clean()) break;
            }
            if (function_exists('session_status') && session_status() === PHP_SESSION_ACTIVE) {
                session_write_close();
            }

            http_response_code(200);
            header('Content-Type: application/zip');
            header('Content-Length: ' . $size);
            header('Content-Disposition: attachment; filename="' . $fileName . '"; filename*=UTF-8\'\'' . rawurlencode($fileName));
            header('Cache-Control: private, no-store, no-cache, must-revalidate, max-age=0');
            header('Pragma: no-cache');
            header('Expires: 0');
            header('X-Content-Type-Options: nosniff');
            header('X-Accel-Buffering: no');

            $sent = 0;
            while (!feof($handle)) {
                $chunk = fread($handle, 1024 * 1024);
                if ($chunk === false) break;
                if ($chunk === '') break;
                echo $chunk;
                $sent += strlen($chunk);
                flush();
            }
            fclose($handle);
            $handle = null;

            if ($sent !== $size) {
                error_log(sprintf('DatabaseBackup download truncated: %s expected=%d sent=%d', $fileName, $size, $sent));
            }
            exit;
        } catch (\Throwable $e) {
            if (is_resource($handle)) fclose($handle);
            return $this->createResponse(400, '下载失败：' . $e->getMessage())->code(400);
        }
    }
}
