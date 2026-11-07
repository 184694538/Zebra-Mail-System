
<?php

return [
    // 邮件服务器
    'host' => '127.0.0.1',

    // IMAP 收件
    'imap_port' => 143,
    'imap_security' => 'starttls',

    // SMTP 发件：本机 25 端口，明文连接，本机受信任 IP 才允许免认证投递
    'smtp_port' => 25,
    'smtp_security' => 'none',
    'smtp_auth' => false,

    // 当前安装的 IMAP 证书为自签名：仅用于临时兼容，生产环境请换证书并开启验证
    'validate_cert' => false,

    // 通用配置
    'timeout' => 20,
    'session_timeout' => 1800,
    'page_size' => 25,

    'max_attachment_bytes' => 20971520,
    'max_message_bytes' => 5242880,

    'create_system_folders' => true,
];
