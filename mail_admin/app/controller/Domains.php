<?php
namespace app\controller;
use think\facade\Db;
use think\facade\Request;

class Domains extends BaseController
{
    public function queryDomainName()
    {
    
        // 获取查询参数
        $orderType = Request::param('order_type', 'asc');
        $page = Request::param('page', 1); // 默认页码为 1
        $limit = Request::param('limit', 10); // 默认每页 10 条
        $domainName = Request::param('domain_name', null); // 默认值为 null
    
        // 构建查询条件
        $query = Db::table('hm_domains');
    
    


        if ($orderType === 'desc') {
            $query->order('domainid', 'desc'); // 降序
        } else {
            $query->order('domainid', 'asc');  // 默认升序
        }


        // 如果指定了域名名称，添加域名名称模糊查询
        if ($domainName) {
            $query->where('domainname', 'like', '%' . $domainName . '%');
        }
    
        // 执行查询，支持分页
        $domains = $query->page($page, $limit)->select();
    
        // 获取总记录数（用于分页）
        $totalCount = $query->count();
    
        // 返回查询结果
        return $this->createResponse(200, "", $domains, $totalCount);
    }


    public function addDomainName()
    {
        // 获取请求参数 domain_name
        $domainName = Request::param('domain_name');
        
        // 判断域名不能为空
        if (empty($domainName)) {
            return $this->createResponse(402, "域名不能为空");
        }
    
        // 处理换行符 \r、\n、\r\n 并分割为数组
        $domainNames = preg_split('/\r\n|\r|\n/', $domainName);
    
        // 清理每个域名前后的空格和空字符
        $domainNames = array_map('trim', $domainNames);
    
        // 删除空域名
        $domainNames = array_filter($domainNames, function($domain) {
            return !empty($domain);
        });
    
        // 检查每个域名是否有效（至少包含一个 .）
        foreach ($domainNames as $domain) {
            if (strpos($domain, '.') === false) {
                return $this->createResponse(402, "域名无效");
            }
        }
    
        // 获取数据库中已有的域名
        $existingDomains = Db::table('hm_domains')
            ->whereIn('domainname', $domainNames)
            ->column('domainname');  // 获取现有的域名列表
    
        // 过滤掉已存在的域名
        $domainNames = array_diff($domainNames, $existingDomains);
    
        // 如果所有域名都已存在，返回提示
        if (empty($domainNames)) {
            return $this->createResponse(402, '所有域名都已存在');
        }
    
        // 数据插入准备
        $insertData = [];
        foreach ($domainNames as $domain) {
            $insertData[] = [
                'domainname' => $domain,
                'domainactive' => 1,
                'domainpostmaster' => '',
                'domainmaxsize' => 0,
                'domainaddomain' => '',
                'domainmaxmessagesize' => 0,
                'domainuseplusaddressing' => 0,
                'domainplusaddressingchar' => '',
                'domainantispamoptions' => 0,
                'domainenablesignature' => 0,
                'domainsignaturemethod' => 1,
                'domainsignatureplaintext' => '',
                'domainsignaturehtml' => '',
                'domainaddsignaturestoreplies' => 0,
                'domainaddsignaturestolocalemail' => 0,
                'domainmaxnoofaccounts' => 0,
                'domainmaxnoofaliases' => 0,
                'domainmaxnoofdistributionlists' => 0,
                'domainlimitationsenabled' => 0,
                'domainmaxaccountsize' => 0,
                'domaindkimselector' => '',
                'domaindkimprivatekeyfile' => '',
                // hMailServer 6.3.7 / schema 6108: these NOT NULL fields have no database defaults.
                'domaindkimsecondaryselector' => '',
                'domaindkimsecondaryprivatekeyfile' => '',
                'domainrelayhost' => '',
                'domainrelayport' => 0,
                'domainrelayrequiresauth' => 0,
                'domainrelayusername' => '',
                'domainrelaypassword' => '',
                'domainrelayconnectionsecurity' => 0,
                'domainquotawarningtext' => '',
            ];
        }
    
        // 批量插入数据到数据库
        try {
            Db::table('hm_domains')->insertAll($insertData);
            return $this->createResponse(200, '域名添加成功');
        } catch (\Exception $e) {
            return $this->createResponse(402, '域名添加失败: ' . $e->getMessage());
        }
    }
    


    public function deleteDomainName()
    {
    
        // 获取 ids 参数
        $ids = Request::param('ids');
    
        // 如果 ids 为空，则返回错误
        if (empty($ids)) {
            return $this->createResponse(402, "缺少要删除的域名ID");
        }
    
        // 将 ids 按逗号分割成数组
        $idArray = explode(',', $ids);
    
        // 检查 idArray 是否为空或者不是有效的数组
        if (empty($idArray) || !is_array($idArray)) {
            return $this->createResponse(402, "无效的 ID 格式");
        }
    
        try {
            // 开启事务，确保删除操作的原子性
            Db::startTrans();
    
            // 删除 hm_domains 表中符合条件的记录
            Db::table('hm_domains')->whereIn('domainid', $idArray)->delete();
    
            // 删除 hm_accounts 表中符合条件的记录
            Db::table('hm_accounts')->whereIn('accountdomainid', $idArray)->delete();
    
            // 提交事务
            Db::commit();
    
            return $this->createResponse(200, "域名及相关账户删除成功");
        } catch (\Exception $e) {
            // 如果出现异常，回滚事务
            Db::rollback();
            return $this->createResponse(402, '删除失败: ' . $e->getMessage());
        }
    }
    
    
    
}
