<?php
namespace app\controller;

class DomainDns extends BaseController
{
    // 获取 PHP 所在服务器的公网出口 IPv4；实际邮件服务 IP 仍需管理员确认。
    public function publicIp()
    {
        $ip = '';
        if (function_exists('curl_init')) {
            $ch = curl_init('https://api.ipify.org');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 2,
                CURLOPT_TIMEOUT => 3,
                CURLOPT_FOLLOWLOCATION => false,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]);
            $result = curl_exec($ch);
            curl_close($ch);
            if (is_string($result)) {
                $candidate = trim($result);
                if (filter_var($candidate, FILTER_VALIDATE_IP,
                    FILTER_FLAG_IPV4 | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    $ip = $candidate;
                }
            }
        }
        return $this->createResponse(200, '', ['ip' => $ip]);
    }
}
