<?php
namespace app\controller;
use think\facade\Db;
use think\facade\Request;
use app\service\HmailPasswordHasher;


class Accounts extends BaseController
{
    public function queryAccounts()
    {

        // 获取查询参数
        // 排序方向只接受 asc/desc；任何其他值均回退为默认 desc。
        $orderType = Request::param('order_type', 'desc');
        $orderType = is_string($orderType) ? strtolower($orderType) : 'desc';
        if (!in_array($orderType, ['asc', 'desc'], true)) {
            $orderType = 'desc';
        }
        $page = Request::param('page', 1); // 默认页码为 1
        $limit = Request::param('limit', 10); // 默认每页 10 条
        $accountaddress = Request::param('accountaddress', null); // 字段 accountaddress 模糊查询
        $start_time = Request::param('start_time'); // 创建时间 字段 accountvacationexpiredate
        $end_time = Request::param('end_time'); // 创建时间 字段 accountvacationexpiredate

        // 构建查询条件
        $query = Db::table('hm_accounts');

        // 如果 accountaddress 参数存在，进行模糊查询
        if ($accountaddress) {
            $query->where('accountaddress', 'like', '%' . $accountaddress . '%');
        }

        // 如果 start_time 和 end_time 存在，按创建时间筛选
        if ($start_time && $end_time) {
            $query->whereBetween('accountvacationexpiredate', [$start_time, $end_time]);
        }

        // 设置排序
        $query->order('accountvacationexpiredate', $orderType);

        // 获取分页结果
        $total = $query->count(); // 总记录数
        $accounts = $query->field(
            'accountid,accountdomainid,accountadminlevel,accountaddress,accountpassword_plain,'
            . 'accountactive,accountisad,accountmaxsize,accountlastlogontime,'
            . 'accountvacationexpiredate,accountpwencryption,accountpasswordchanged'
        )->page($page, $limit)->select(); // 白名单查询：从 SQL 层彻底排除 accountpassword 及 TOTP 等秘密字段

        // 返回结果
        return $this->createResponse(200, "查询成功", $accounts, $total);
    }

    public function addmail()
    {
    
        ini_set('max_execution_time', 1800);
        ini_set('memory_limit', '-1'); // 不限制内存
    
        // 获取请求参数 accountPassword
        $accountPassword = Request::param('accountPassword');
    
        // 检查 accountPassword 参数不可为空
        if (empty($accountPassword)) {
            return $this->createResponse(402, "账户密码不能为空");
        }
    
        // 按换行符分割成数组，保留换行符进行分割
        $accountPasswordS = preg_split('/\r\n|\r|\n/', $accountPassword);
    
        // 删除每行前后的空格
        $accountPasswordS = array_map('trim', $accountPasswordS);
    
        // 过滤掉空行
        $accountPasswordS = array_filter($accountPasswordS, function($item) {
            return !empty($item);
        });
    
        // 初始化账户地址和密码数组
        $accountAddresses = [];
        $accountPasswords = [];
    
        // 用 "----" 分割每个值
        foreach ($accountPasswordS as $item) {
            $parts = explode("----", $item);
            if (count($parts) != 2) {
                return $this->createResponse(402, "账户或者密码格式错误");
            }
    
            $accountAddresses[] = $parts[0];
            $accountPasswords[] = $parts[1];
        }
    
        // 检查账户地址和密码是否有空值
        foreach ($accountAddresses as $index => $address) {
            if (empty($address) || empty($accountPasswords[$index])) {
                return $this->createResponse(402, "账户或密码不能为空");
            }
    
            // 检查密码最小长度
            if (strlen($accountPasswords[$index]) < 8) {
                return $this->createResponse(402, "密码必须至少 8 个字符");
            }
    
            // 检查密码格式，只能包含大写字母、小写字母、数字、@ 和 .
            if (!preg_match('/^[A-Za-z0-9@.]+$/', $accountPasswords[$index])) {
                return $this->createResponse(402, "密码只能包含大写字母、小写字母、数字、@ 和 . 组成");
            }
    
            // 检查账户地址格式（只能包含大写字母、数字、@ 和 .）
            if (!preg_match('/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/', $address)) {
                return $this->createResponse(402, "账户地址不是有效的邮箱格式");
            }
    
            // 检查账户地址是否已存在
            $existingAccount = Db::table('hm_accounts')->where('accountaddress', $address)->count();
            if ($existingAccount > 0) {
                // 提示具体存在的邮箱地址
                return $this->createResponse(402, "邮箱地址已经存在: " . $address);
            }
        }
    
        if (count(array_unique(array_map('strtolower', $accountAddresses))) !== count($accountAddresses)) {
            return $this->createResponse(402, '导入数据中存在重复邮箱地址');
        }

        // 获取当前时间（只计算一次）
        $time = date('Y-m-d H:i:s', time());
    
        try {
            // 批量插入账户
            $totalCount = 0;
    
            foreach ($accountAddresses as $index => $address) {
                $result = $this->importEmail($address, $accountPasswords[$index], '0', $time);
                if ($result !== 1) {
                    return $this->createResponse(402, '账户添加失败（域名不存在）: ' . $address);
                }
                $totalCount++;
            }
    
            return $this->createResponse(200, '账户添加成功', '', $totalCount);
        } catch (\Throwable $e) {
            return $this->createResponse(402, '账户添加失败: ' . $e->getMessage());
        }
    }
    
    


    public function addRandomMail()
    {
    
        ini_set('max_execution_time', 1800);
        ini_set('memory_limit', '-1'); // 不限制内存
    
        // 获取请求参数
        $domains = Request::param('domains');  // 多个域名，逗号分隔
        $total = Request::param('total');      // 每个域名生成的账户总数
        $accountFormat = Request::param('account_format'); // 账户格式：1 - 8位纯小写字母，2 - 8位纯数字，3 - 8位小写字母+数字
        $passwordFormat = Request::param('password_format'); // 密码格式：1、2、3 为随机密码，fixed 为固定密码
        $fixedPassword = (string) Request::param('fixed_password', '');
    
        // 参数验证
        if (!$domains || !$total || !$accountFormat || !$passwordFormat) {
            return $this->createResponse(402, "缺少必填参数");
        }
    
        if ($passwordFormat === 'fixed'
            && (strlen($fixedPassword) < 8 || strlen($fixedPassword) > 128
                || !preg_match('/^[A-Za-z0-9@.]+$/D', $fixedPassword))) {
            return $this->createResponse(402, "固定密码须为 8–128 位，只能包含英文字母、数字、@ 和 .");
        }

        // 替换中文逗号为英文逗号，并去掉域名前后的空格。
        $domains = str_replace('，', ',', $domains);
        $domainArray = array_filter(array_map('trim', explode(',', $domains)));
    
        // 生成账号的基础逻辑
        $generatedAccounts = []; // 存储已生成的账户地址
        $totalCount = 0;  // 记录生成的总条数
        $time = date('Y-m-d H:i:s', time()); // 固定当前时间
    
        // 遍历每个域名
        foreach ($domainArray as $domain) {
            // 检查域名是否存在
            $domainId = Db::table('hm_domains')->where('domainname', $domain)->value('domainid');
            if (!$domainId) {
                return $this->createResponse(402, "域名不存在: " . $domain);
            }
    
            for ($i = 0; $i < $total; $i++) {
                do {
                    // 生成账号和密码
                    $username = $this->generateRandomUsername($domain, $accountFormat);
                    $password = $passwordFormat === 'fixed'
                        ? $fixedPassword
                        : $this->generateRandomPassword($passwordFormat);
                } while (in_array($username, $generatedAccounts) || $this->checkIfAccountExistsInDb($username));
    
                // 记录已生成的账号
                $generatedAccounts[] = $username;
    
                // 调用 importEmail 方法添加账户数据
                try {
                    $result = $this->importEmail($username, $password, 0, $time);
                } catch (\Throwable $e) {
                    return $this->createResponse(500, '账户添加失败: ' . $username . '，' . $e->getMessage());
                }

                if ($result === 1) {
                    $totalCount++;  // 增加成功生成的账户数量
                } else {
                    return $this->createResponse(402, '账户添加失败: ' . $username);
                }
            }
        }
    
        return $this->createResponse(200, '账户添加成功', $time, $totalCount);
    }
    
    

// 随机生成账号
protected function generateRandomUsername($domain, $accountFormat)
{
    $username = '';
    switch ($accountFormat) {
        case 1:
            $username = strtolower($this->generateRandomString2(8, 'lowercase')) . '@' . $domain;
            break;
        case 2:
            $username = $this->generateRandomString2(8, 'digits') . '@' . $domain;
            break;
        case 3:
            $username = strtolower($this->generateRandomString2(5, 'lowercase')) . $this->generateRandomString2(3, 'digits') . '@' . $domain;
            break;
        default:
            return '';
    }
    return $username;
}

// 随机生成密码
protected function generateRandomPassword($passwordFormat)
{
    switch ($passwordFormat) {
        case 1:
            return $this->generateRandomString2(8, 'digits'); // 纯数字
        case 2:
            return $this->generateRandomString2(8, 'lowercase'); // 纯小写字母
        case 3:
            return $this->generateRandomString2(8, 'lowercase+digits'); // 小写字母+数字
        default:
            return '';
    }
}

// 生成随机字符串
protected function generateRandomString2($length, $type = 'alphanumeric')
{
    $characters = '';
    if ($type == 'digits') {
        $characters = '0123456789';
    } elseif ($type == 'lowercase') {
        $characters = 'abcdefghijklmnopqrstuvwxyz';
    } elseif ($type == 'lowercase+digits') {
        $characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    } else {
        $characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    }

    $randomString = '';
    for ($i = 0; $i < $length; $i++) {
        $randomString .= $characters[rand(0, strlen($characters) - 1)];
    }

    return $randomString;
}

// 检查数据库中是否存在该账户
protected function checkIfAccountExistsInDb($username)
{
    return Db::table('hm_accounts')->where('accountaddress', $username)->count() > 0;
}

// 插入默认文件夹
protected function addDefaultFolders($insertData)
{
    foreach ($insertData as $account) {
        $accountId = Db::table('hm_accounts')->where('accountaddress', $account['accountaddress'])->value('accountid');
        if ($accountId) {
            // 默认插入 INBOX 文件夹
            Db::table('hm_imapfolders')->insert([
                'folderaccountid' => $accountId,
                'folderparentid' => -1, // 父级ID, INBOX为根文件夹
                'foldername' => 'INBOX',
                'folderissubscribed' => 1,
                'foldercreationtime' => date('Y-m-d H:i:s', time()),
                'foldercurrentuid' => 0
            ]);
        }
    }
}

public function queryRecord()
{

    // 获取查询参数
    // 日期统计排序方向使用同一白名单；非法值保持默认降序。
    $orderType = Request::param('order_type', 'desc');
    $orderType = is_string($orderType) ? strtolower($orderType) : 'desc';
    if (!in_array($orderType, ['asc', 'desc'], true)) {
        $orderType = 'desc';
    }
    $page = Request::param('page', 1); // 默认页码为 1
    $limit = Request::param('limit', 10); // 默认每页 10 条
    $start_time = Request::param('start_time'); // 创建时间 字段 accountvacationexpiredate
    $end_time = Request::param('end_time'); // 创建时间 字段 accountvacationexpiredate

    $now = time();

// 如果 start_time 或 end_time 为 null 或空字符串，则设置为默认 30 天
if (empty($start_time)) {
    // 设置开始时间为 30 天前的时间
    $start_time = date('Y-m-d H:i:s', strtotime('-30 days', $now));
}

if (empty($end_time)) {
    // 设置结束时间为当前时间
    $end_time = date('Y-m-d H:i:s', $now);
}

    // 构建查询条件
    $query = Db::table('hm_accounts');

    // 如果 start_time 和 end_time 存在，按创建时间筛选
    if ($start_time && $end_time) {
        $query->whereBetween('accountvacationexpiredate', [$start_time, $end_time]);
    }

    // 获取查询所有数据（不分页）
    $accounts = $query->field('accountvacationexpiredate')->select();

    // 处理数据，统计每个 accountvacationexpiredate 相同的数量
    $dateCounts = [];
    foreach ($accounts as $account) {
        $date = $account['accountvacationexpiredate']; // 获取当前记录的 accountvacationexpiredate

        // 使用日期作为唯一标识进行分组
        if (isset($dateCounts[$date])) {
            $dateCounts[$date] += 1;
        } else {
            $dateCounts[$date] = 1;
        }
    }

    // 将 $dateCounts 转换为键值对格式
    $dateCountsWithKeys = [];
    foreach ($dateCounts as $date => $count) {
        $dateCountsWithKeys[] = ['date' => $date, 'count' => $count];
    }

    // 根据 $orderType 对 $dateCountsWithKeys 排序
    if ($orderType === 'desc') {
        usort($dateCountsWithKeys, function ($a, $b) {
            return strcmp($b['date'], $a['date']); // 按日期降序排序
        });
    } else {
        usort($dateCountsWithKeys, function ($a, $b) {
            return strcmp($a['date'], $b['date']); // 按日期升序排序
        });
    }

    // 对 $dateCountsWithKeys 进行分页处理
    $total = count($dateCountsWithKeys); // 总数量
    $dateCountsWithKeys = array_slice($dateCountsWithKeys, ($page - 1) * $limit, $limit); // 获取当前页的数据

    // 返回结果，只返回日期和数量统计数据
    return $this->createResponse(200, "查询成功", $dateCountsWithKeys,$total);
}

public function queryaccountvacationexpiredate()
{

    // 获取请求参数 accountvacationexpiredate
    $accountvacationexpiredate = Request::param('accountvacationexpiredate');

    if (!$accountvacationexpiredate) {
        return $this->createResponse(402, "缺少参数: accountvacationexpiredate");
    }

    // 查询数据
    $accounts = Db::table('hm_accounts')
                  ->where('accountvacationexpiredate', $accountvacationexpiredate)
                  ->field('accountaddress, accountpassword_plain')
                  ->select();

    // 如果没有数据
    if (empty($accounts)) {
        return $this->createResponse(404, "未找到相关数据");
    }

    // 用保存的明文导出；旧账户字段为 NULL 时留空，绝不将哈希当密码。
    $result = [];
    foreach ($accounts as $account) {
        $result[] = $account['accountaddress'] . '----' . (string) ($account['accountpassword_plain'] ?? '');
    }

    // 每行一个 "邮箱地址----原密码"。
    $resultString = implode("\r\n", $result);

    // 返回结果
    return $this->createResponse(200, "查询成功", $resultString);
}


public function deleteCreationTime()
{

    // 获取请求参数 CreationTime
    $CreationTime = Request::param('CreationTime');

    // 如果 CreationTime 为空，返回错误信息
    if (empty($CreationTime)) {
        return $this->createResponse(400, "参数 CreationTime 不能为空");
    }

    // 将 CreationTime 以 ',' 分割成数组
    $CreationTimeArray = explode(',', $CreationTime);

    try {
        // 删除 hm_imapfolders 表中 foldercreationtime 在 $CreationTimeArray 里的数据
        Db::table('hm_imapfolders')->whereIn('foldercreationtime', $CreationTimeArray)->delete();

        // 删除 hm_accounts 表中 accountvacationexpiredate 在 $CreationTimeArray 里的数据，并获取删除的条数
        $deletedCount = Db::table('hm_accounts')->whereIn('accountvacationexpiredate', $CreationTimeArray)->delete();

        return $this->createResponse(200, "删除成功","" ,$deletedCount);
    } catch (\Exception $e) {
        return $this->createResponse(500, "删除失败：" . $e->getMessage());
    }
}


public function deleteMailID()
{

    $ids = Request::param('ids');

    // 检查是否有传入 ids
    if (empty($ids)) {
        return $this->createResponse(400, "参数错误，ids 不能为空");
    }

    // 将 ids 以 ',' 分割成数组
    $idArray = explode(',', $ids);

    try {
        // 删除 hm_imapfolders 相关数据
        Db::table('hm_imapfolders')->whereIn('folderaccountid', $idArray)->delete();

        // 删除 hm_accounts 相关数据，并获取删除的数量
        $deletedCount = Db::table('hm_accounts')->whereIn('accountid', $idArray)->delete();

        // 返回格式: {"code":200, "message":"删除成功", "count":40, "data":""}
        return $this->createResponse(200, "删除成功", "", $deletedCount);
    } catch (\Exception $e) {
        return $this->createResponse(500, "删除失败：" . $e->getMessage());
    }
}


public function deleteMailCustomize()
{

    $mail = Request::param('mail');

    // 检查参数
    if (empty($mail)) {
        return $this->createResponse(400, "参数错误，mail 不能为空");
    }

    // 将 mail 以 ',' 分割成数组
    $mailArray = explode(',', $mail);

    try {
        // 先查询要删除的 accountid
        $idArray = Db::table('hm_accounts')
            ->whereIn('accountaddress', $mailArray)
            ->column('accountid');

        if (empty($idArray)) {
            return $this->createResponse(404, "未找到匹配的邮箱");
        }

        // 删除相关的 hm_imapfolders 数据
        $imapDeletedCount = Db::table('hm_imapfolders')->whereIn('folderaccountid', $idArray)->delete();

        // 删除 hm_accounts 数据
        $deletedCount = Db::table('hm_accounts')->whereIn('accountid', $idArray)->delete();

        // 如果没有删除任何记录，返回失败
        if ($deletedCount === 0) {
            return $this->createResponse(500, "删除邮箱失败，未删除任何记录");
        }

        // 返回成功的响应
        return $this->createResponse(200, "删除成功", "", $deletedCount);
    } catch (\Exception $e) {
        // 捕获异常并返回错误信息
        return $this->createResponse(500, "删除失败：" . $e->getMessage());
    }
}

  
public function deleteAllEmails()
{

    // 清空 `hm_messages` 表，并重置自增 ID
    try {
        Db::execute('TRUNCATE TABLE hm_messages'); // 清空表并重置 ID
    } catch (\Exception $e) {
        return $this->createResponse(500, '清空邮件数据失败: ' . $e->getMessage());
    }

    // 需要删除 `C:\BtSoft\hMailServer\Data` 下的所有文件和文件夹
    $directory = "C:\\BtSoft\\hMailServer\\Data";

    // 执行删除操作
    try {
        $this->deleteFilesAndFolders($directory);
    } catch (\Exception $e) {
        return $this->createResponse(500, '删除邮件存储文件失败: ' . $e->getMessage());
    }

    return $this->createResponse(200, "邮件数据及存储文件已成功清空");
}

/**
 * 递归删除文件夹下的所有文件和文件夹，但保留根目录
 */
private function deleteFilesAndFolders($path)
{
    if (!is_dir($path)) {
        return;
    }

    $files = array_diff(scandir($path), ['.', '..']);
    foreach ($files as $file) {
        $fullPath = $path . DIRECTORY_SEPARATOR . $file;
        if (is_dir($fullPath)) {
            $this->deleteFilesAndFolders($fullPath); // 递归删除子目录
            rmdir($fullPath); // 删除空文件夹
        } else {
            unlink($fullPath); // 删除文件
        }
    }
}


// 单条邮箱导入的统一入口：普通新增的输入是明文；备份恢复可以携带旧哈希。
// $accountpwencryption=0：原始明文转换为 hMailServer $h1$ PBKDF2；非 0：视为备份中的已存储哈希。
// $plainPassword 只用于备份恢复（旧备份若无该字段，则无法恢复已有哈希的原密码）。
protected function importEmail($accountAddresses, $accountPasswords, $accountpwencryption, $time, ?string $plainPassword = null) {
    $domain = substr(strrchr((string) $accountAddresses, "@") ?: '', 1);
    $domainId = Db::table('hm_domains')->where('domainname', $domain)->value('domainid');
    if (!$domainId) {
        return 0;
    }

    $encryption = (int) $accountpwencryption;
    $storedPassword = (string) $accountPasswords;
    if ($encryption === 0) {
        // 原始明文（新建邮箱或旧版明文备份）转换为 6.3 原生 $h1$ PBKDF2。
        $plainPassword = $storedPassword;
        $storedPassword = HmailPasswordHasher::hash($plainPassword);
        $encryption = HmailPasswordHasher::ENCRYPTION_TYPE;
    } elseif ($encryption === HmailPasswordHasher::ENCRYPTION_TYPE) {
        // hMailServer 6.3 的编号 4 只对应 $h1$ PBKDF2-HMAC-SHA256。
        if (HmailPasswordHasher::isPbkdf2Hash($storedPassword)) {
            // 恢复正确的原生哈希时原样保留；如提供了明文则校验一致性。
            if ($plainPassword !== null && !HmailPasswordHasher::verify($plainPassword, $storedPassword)) {
                throw new \InvalidArgumentException('备份的原密码与 PBKDF2 哈希不匹配');
            }
        } elseif (HmailPasswordHasher::isLegacyInvalidHash($storedPassword)) {
            // 修复历史增量包误生成的无效 PHC 格式；必须有可验证的原密码。
            if ($plainPassword === null || !HmailPasswordHasher::verifyLegacyInvalid($plainPassword, $storedPassword)) {
                throw new \InvalidArgumentException('备份包含旧版错误 PBKDF2 格式，缺少匹配的原密码，无法安全修复');
            }
            $storedPassword = HmailPasswordHasher::hash($plainPassword);
        } else {
            throw new \InvalidArgumentException('备份中的 PBKDF2 哈希格式错误（应为 $h1$）');
        }
    } elseif ($encryption === 5 || $encryption === 7) {
        // 6.3 的 Argon2id(5) / scrypt(7) 已存储哈希允许原样恢复，不能重复哈希。
        $expectedPrefix = $encryption === 5 ? '$a2$' : '$s2$';
        if (!str_starts_with($storedPassword, $expectedPrefix)) {
            throw new \InvalidArgumentException('备份密码算法编号与哈希格式不匹配');
        }
    } elseif ($encryption < 1 || $encryption > 3 || $storedPassword === '') {
        throw new \InvalidArgumentException('备份包含不支持的密码算法或空哈希');
    }

    if ($plainPassword !== null && strlen($plainPassword) > 255) {
        throw new \InvalidArgumentException('原密码超过数据库字段长度限制');
    }
    if (strlen($storedPassword) > 255) {
        throw new \InvalidArgumentException('密码哈希超过数据库字段长度限制');
    }

    // 账户与 INBOX 在一个事务内完成，避免只有账户没有文件夹。
    return Db::transaction(function () use ($domainId, $accountAddresses, $storedPassword, $plainPassword, $encryption, $time) {
        $accountId = Db::table('hm_accounts')->insertGetId([
            'accountdomainid' => $domainId,
            'accountadminlevel' => 0,
            'accountaddress' => $accountAddresses,
            'accountpassword' => $storedPassword,
            'accountpassword_plain' => $plainPassword,
            'accountactive' => 1,
            'accountisad' => 0,
            'accountaddomain' => '',
            'accountadusername' => '',
            'accountmaxsize' => 0,
            'accountvacationmessageon' => 0,
            'accountvacationmessage' => '',
            'accountvacationsubject' => '',
            'accountpwencryption' => $encryption,
            'accountforwardenabled' => 0,
            'accountforwardaddress' => '',
            'accountforwardkeeporiginal' => 1,
            'accountenablesignature' => 0,
            'accountsignatureplaintext' => '',
            'accountsignaturehtml' => '',
            'accountlastlogontime' => $time,
            'accountvacationexpires' => 0,
            'accountvacationexpiredate' => $time,
            'accountvacationbegindate' => $time,
            'accountvacationabortspamflagged' => 0,
            'accountforwardabortspamflagged' => 0,
            'accountpersonfirstname' => '',
            'accountpersonlastname' => '',
            'accountpasswordchanged' => $time,
        ]);
        if (!$accountId) {
            throw new \RuntimeException('创建邮箱账户失败');
        }
        Db::table('hm_imapfolders')->insert([
            'folderaccountid' => $accountId,
            'folderparentid' => -1,
            'foldername' => 'INBOX',
            'folderissubscribed' => 1,
            'foldercreationtime' => $time,
            'foldercurrentuid' => 0,
        ]);
        return 1;
    });
}

/** 管理员后台批量修改密码：固定密码或缺省随机密码，始终同步更新两个字段。 */
public function changePassword()
{
    $input = str_replace(["\r", "\n"], ',', (string) Request::param('accounts', ''));
    $accounts = array_values(array_unique(array_filter(array_map('trim', explode(',', $input)))));
    if (!$accounts) {
        return $this->createResponse(402, '请提供至少一个邮箱账户');
    }
    $fixed = Request::param('password', null);
    if ($fixed !== null && !is_string($fixed)) {
        return $this->createResponse(402, '密码格式错误');
    }
    if ($fixed !== null && (strlen($fixed) < 8 || strlen($fixed) > 128
        || !preg_match('/^[A-Za-z0-9@.]+$/D', $fixed))) {
        return $this->createResponse(402, '密码须为 8–128 位，只能包含英文字母、数字、@ 和 .');
    }
    try {
        $total = 0;
        foreach ($accounts as $address) {
            // 随机模式不返回密码明文，管理员可以通过账户列表及导出功能查看。
            $password = $fixed ?? bin2hex(random_bytes(8));
            $data = [
                'accountpassword' => HmailPasswordHasher::hash($password),
                'accountpassword_plain' => $password,
                'accountpwencryption' => HmailPasswordHasher::ENCRYPTION_TYPE,
                'accountpasswordchanged' => date('Y-m-d H:i:s'),
            ];
            $total += Db::table('hm_accounts')
                ->where('accountaddress', $address)
                ->where('accountisad', 0)
                ->update($data);
        }
        return $this->createResponse(200, "密码更新完成，成功 {$total} 个（未找到或 AD 账户已跳过）", '', $total);
    } catch (\Throwable $e) {
        return $this->createResponse(500, '修改密码失败: ' . $e->getMessage());
    }
}

//备份
public function backupsDomainEmailData()
{
    // Deprecated legacy JSON backup API: disable to enforce the new protected backups/ workflow.
    return $this->createResponse(410, '旧版备份接口已关闭，请使用「初始化与备份」页面');
}

//删除
public function deleteFileName()
{
    // Deprecated legacy JSON backup API: disable to enforce the new protected backups/ workflow.
    return $this->createResponse(410, '旧版备份接口已关闭，请使用「初始化与备份」页面');
}


// 导入整个备份文件的数据
public function importDomainEmailData()
{
    // 已禁用旧版 TRUNCATE 覆盖恢复；所有导入统一使用 DatabaseBackup/restore 且只能导入空数据库。
    return $this->createResponse(410, '旧版覆盖导入已禁用，请使用「初始化与备份」页面的统一导入功能');
}

public function downloadBackup()
{
    // Deprecated legacy JSON backup API: disable to enforce the new protected backups/ workflow.
    return $this->createResponse(410, '旧版备份接口已关闭，请使用「初始化与备份」页面');
}






public function uploadBackup()
{
    // Deprecated legacy JSON backup API: disable to enforce the new protected backups/ workflow.
    return $this->createResponse(410, '旧版备份接口已关闭，请使用「初始化与备份」页面');
}



//查询
public function queryBackup()
{
    // Deprecated legacy JSON backup API: disable to enforce the new protected backups/ workflow.
    return $this->createResponse(410, '旧版备份接口已关闭，请使用「初始化与备份」页面');
}
}
