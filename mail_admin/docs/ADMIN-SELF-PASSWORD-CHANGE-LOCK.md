# 管理员自助修改密码开关

测试站可通过私有配置 `config_private/admin_auth.php` 控制管理员是否能通过后台自行修改管理员账号/密码。

## 配置项

在 `return [...]` 数组中增加：

```php
'disable_self_password_change' => 1,
```

- `1`：禁用管理员自助修改账号/密码；后端 `Admin/changeAdminCredentials` 接口直接返回 HTTP 200 响应体中的业务码 `403`，不会验证/保存新账号密码，也不会轮换 Token。
- `0`：允许管理员通过后台修改账号/密码。
- 未配置该项时按 `0` 处理，保持旧版本行为。

该开关只控制管理员自己的账号/密码修改接口，不影响邮箱账户密码管理、Webmail 用户改密开关或其他业务接口。

## 安全地修改配置

增量包提供了仅限 CLI 的配置更新脚本。它会读取现有 `admin_auth.php`，只更新开关字段，保留原有管理员用户名、密码和 `auth_version`，并以原子方式写回，文件权限设为 `0600`。

在项目根目录执行：

```bash
# 禁用管理员自助修改账号/密码（测试站）
php tools/set_admin_password_change_policy.php 1

# 恢复允许管理员自行修改
php tools/set_admin_password_change_policy.php 0
```

也可以直接手动编辑 `config_private/admin_auth.php`。请勿把真实的 `admin_auth.php` 放进增量压缩包、公开目录或代码仓库。

## 部署注意

建议先完成首次默认管理员密码修改，再将开关设为 `1`。如果安装环境仍使用默认管理员密码，启用锁定后首次强制改密接口也会被拒绝；请先设置好测试站管理员凭据，再启用锁定。
