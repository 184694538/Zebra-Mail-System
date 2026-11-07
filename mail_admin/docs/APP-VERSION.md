# 斑马邮箱应用版本号管理

- **唯一配置文件**：项目根目录 `config/version.php`，使用 `number` 字段（如 `1.0.0`）和 `tech_support` 字段（如 `XXXXX`）。
- **显示位置**：后台左侧菜单底部（安全登录下方）显示 `系统版本：v1.0.0`；工作台底部显示 `斑马邮箱 · 统一邮件管理工作台 · 技术支持（XXXXX）`，不再显示版本号。
- **读取逻辑**：登录认证成功后，调用 `POST /Admin/systemVersion`，由后端从 `config/version.php` 读取 `version` 和 `tech_support` 两项。接口受现有管理员 Token 验证保护，并禁止 HTTP 缓存。
- **升级操作**：发布新版本时更新 `config/version.php` 的 `number`，然后部署对应程序代码。需要修改底部技术支持文字时，只需修改 `config/version.php` 的 `tech_support`。无需修改数据库或前端硬编码。必要时清除 ThinkPHP 配置缓存、PHP OPcache 或重启 PHP 工作进程，再刷新后台。
- **版本格式建议**：`主版本.次版本.修订版本`，例如 `1.0.0` → `1.0.1`（修复）→ `1.1.0`（新功能）→ `2.0.0`（不兼容变更）。
- **重要区别**：此处是 ZebraMail Web 应用版本，不是 hMailServer 引擎版本；`config_private/admin_auth.php` 的 `auth_version` 则是认证凭据版本，不能混用。

初始 `1.0.0` 只是可自行调整的项目版本起点，不代表已有发布历史。

**配置示例：**

```php
return [
    'number' => '1.0.0',
    'tech_support' => 'XXXXX',
];
```

`tech_support` 只填写括号内的名称，不需要填写“技术支持”或括号本身。配置为空时隐藏底部技术支持文字。
