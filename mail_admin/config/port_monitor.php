<?php
// 公网端口检测目标。留空时从 ipify 获取服务器出站公网 IPv4；NAT/多网卡需填写实际入站公网 IPv4。
// 外部检测通过 check-host.net 的独立节点完成，需服务器能向外发起 HTTPS 请求。
return [
    'public_ip' => env('port_monitor.public_ip', ''),
];
