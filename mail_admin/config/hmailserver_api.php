<?php

// hMailServer 6.3.7 REST API，仅供服务端读取；不会发送给浏览器。
// API 默认只监听本机 127.0.0.1；不要直接将 API 端口暴露到公网。
// 可在项目 .env 的 [HMAILSERVER_API] 节配置 URL/PASSWORD 或 KEY。
return [
    'url' => env('hmailserver_api.url', 'http://127.0.0.1:8045'),
    'password' => env('hmailserver_api.password', '123456'), // hMailServer 的 Administrator 密码，不是网页后台密码
    'key' => env('hmailserver_api.key', ''),           // 可选：具有权限的 hMailServer API Key
];
