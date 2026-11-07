# 斑马邮箱系统（ZebraMail）

斑马邮箱是面向 **hMailServer** 的 Web 管理与网页邮箱项目，使用 ThinkPHP 8、PHP 和 MySQL / MariaDB，集中管理邮件域名、邮箱账户、WebMail 及日常运维功能。

> **项目定位：** 斑马邮箱提供 hMailServer 的 Web 管理与使用界面，不替代 hMailServer 邮件服务器本身。实际 SMTP、IMAP 等邮件服务仍由单独部署的 hMailServer 提供。

## 仓库目录结构

本仓库按项目目录分层保存，**不要把 `mail_admin/` 内的文件移动到仓库根目录**。

```text
斑马邮箱系统/
├── .git/                         # 本地 Git 元数据；推送时不会作为普通文件上传
├── .gitattributes
├── .gitignore
├── README.md                     # 项目总说明
├── LICENSE                       # GNU AGPLv3
└── mail_admin/                   # 斑马邮箱应用程序根目录
    ├── app/
    ├── config/
    ├── config_private/
    ├── public/
    ├── route/
    ├── setup/
    ├── vendor/                   # 已安装的 PHP 依赖，必须保留并提交
    ├── composer.json
    ├── composer.lock
    ├── README.md
    └── ...
```

GitHub 上的仓库根目录会显示 `README.md`、`LICENSE` 和 `mail_admin/` 等项目文件；本地 `.git/` 仅供 Git 管理版本，不会被 Git 推送到 GitHub。

## 主要功能

- 邮件域名及邮箱账户管理
- WebMail 网页邮箱
- hMailServer 相关管理与接口功能
- 系统设置及 API 管理
- 数据库备份、恢复与维护

具体功能以当前版本实际页面和代码为准。

## 技术栈

- 邮件服务：hMailServer（主要面向 hMailServer 6.3 使用场景）
- 后端：PHP、ThinkPHP 8
- 数据库：MySQL / MariaDB
- 前端：HTML、CSS、JavaScript
- Web 服务：Nginx 或其他兼容的 Web 服务器

## 部署说明

### 1. 准备运行环境

先单独安装并配置 hMailServer、PHP、MySQL / MariaDB 和 Web 服务器。斑马邮箱不包含 hMailServer 服务端程序。

### 2. 下载项目

克隆 GitHub 仓库，或下载 GitHub 提供的 ZIP 并解压。应用程序位于 `mail_admin/` 目录中。

**本仓库已经包含完整的 `mail_admin/vendor/` 依赖目录，正常部署无需安装 Composer，也无需执行 `composer install`。** `composer.json` 和 `composer.lock` 保留用于开发者维护和更新依赖。

### 3. 配置数据库

编辑：

```text
mail_admin/config/database.php
```

按实际环境填写数据库地址、数据库名、用户名、密码和端口。仓库发布版本中的数据库密码为空。该文件属于版本控制文件，配置真实密码后不要将修改后的文件提交或推送到公开仓库。

### 4. 配置 hMailServer API

按实际环境检查：

```text
mail_admin/config/hmailserver_api.php
```

其中 hMailServer REST API 的地址和认证信息应使用部署环境自己的值，不要公开服务器密码或 API Key。

### 5. 配置网站根目录和权限

网站根目录应指向：

```text
mail_admin/public/
```

不要将网站根目录直接指向 `mail_admin/`。确保 PHP 运行用户对以下目录具有所需写入权限：

- `mail_admin/config_private/`
- `mail_admin/runtime/`
- `mail_admin/backups/`（仅在使用备份功能时）

`config_private/` 应位于 Web 根目录之外，不应通过 HTTP 直接访问。

### 6. 首次初始化与登录

首次部署时，程序会在必要的私有配置缺失时，从 `mail_admin/setup/config_private/` 中的安全示例初始化配置：

- 初始管理员账号：`admin`
- 初始管理员密码：`123456`
- 首次使用默认凭据登录后，必须先修改密码才能继续使用后台。
- 邮件 API 默认关闭；配置至少一项有效 API 密钥后，还需要管理员在后台手动启用。

初始化说明见 [`mail_admin/setup/README.md`](mail_admin/setup/README.md)。

### 7. 部署后检查

建议依次验证后台登录、首次修改密码、数据库连接、hMailServer API 连接、域名与邮箱账户管理、WebMail、邮件 API 开关及备份功能。

## 数据库维护注意事项

数据库清理可能造成不可恢复的数据丢失。清理操作不会自动创建全量备份、不会自动停止邮件服务，也不会删除磁盘邮件文件。执行前请自行备份数据库和实际邮件文件，并确认操作范围。

## 安全提示

- 不要提交真实数据库密码、管理员密码、API 密钥、Token、会话文件、日志或备份。
- `mail_admin/config_private/` 中的运行时私有配置由 `.gitignore` 排除；仓库只保留安全初始化模板。
- `mail_admin/config/database.php` 是需要按部署环境填写的配置文件，真实密码不要提交。
- 首次登录后立即修改默认管理员密码。
- API 必须在配置密钥后由管理员手动启用。
- 发布前请核对第三方组件各自的许可证和安全更新。

## 第三方组件与许可证

本项目作者拥有版权且有权授权的项目代码采用 **GNU Affero General Public License v3.0（AGPLv3）**，完整条款见仓库根目录 [`LICENSE`](LICENSE)。

ThinkPHP、hMailServer、Layui 及其他第三方组件分别遵循各自许可证。本项目的 AGPLv3 声明不会替代或改变第三方组件的许可证。详细说明见 [`mail_admin/THIRD_PARTY_NOTICES.md`](mail_admin/THIRD_PARTY_NOTICES.md)，并请保留依赖目录中随附的许可证文件。

---

**斑马邮箱 ZebraMail** · hMailServer Web 管理与 WebMail 项目
