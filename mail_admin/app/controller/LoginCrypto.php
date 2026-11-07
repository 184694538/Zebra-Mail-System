<?php
namespace app\controller;

use app\service\LoginCryptoService;
use app\service\LoginRateLimitException;
use think\facade\Request;

/** 公开登录加密信息入口；返回公钥、时间戳和随机字段，不持久化挑战；不继承管理员 Token。 */
final class LoginCrypto
{
    public function challenge()
    {
        $headers = [
            'Cache-Control' => 'no-store, private',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
        ];
        if (strtoupper((string) Request::method()) !== 'POST') {
            return json(['status' => false, 'message' => '请求方式无效'])->code(405)->header($headers);
        }
        $raw = (string) Request::getInput();
        $body = json_decode($raw, true);
        if (!is_array($body)) {
            return json(['status' => false, 'message' => '请求格式无效'])->code(400)->header($headers);
        }
        try {
            $data = LoginCryptoService::challenge(
                (string) ($body['scene'] ?? ''),
                (string) ($body['username'] ?? ''),
                (string) ($_SERVER['REMOTE_ADDR'] ?? '')
            );
            return json(['status' => true, 'data' => $data])->header($headers);
        } catch (\InvalidArgumentException $e) {
            return json(['status' => false, 'message' => '登录信息不完整'])->code(400)->header($headers);
        } catch (LoginRateLimitException $e) {
            return json(['status' => false, 'message' => '登录请求过于频繁，请稍后再试'])->code(429)->header($headers);
        } catch (\Throwable $e) {
            error_log('LoginCrypto challenge failed: ' . get_class($e));
            return json(['status' => false, 'message' => '登录安全服务不可用，请稍后重试'])->code(503)->header($headers);
        }
    }
}
