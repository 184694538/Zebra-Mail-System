(function () {
  'use strict';

  // 根据用户提供的原版 PHPWebAdmin 复刻界面布局；继续调用现有 hMailServer 6.3.7 REST API。
  const groups = [
    { name: '概览与监控', items: [
      ['status', '运行仪表盘', '◈', '服务器状态、运行指标'],
      ['queue', '投递队列', '↗', '队列查看与重新投递'],
      ['logs', '运行日志', '≡', '日志列表与日志内容'],
      ['backup', '服务器备份', '▣', '查看和启动原生备份'],
      ['backup_archives', '备份归档', '◇', '查看历史备份归档']
    ] },
    { name: '域名与邮箱', items: [
      ['domains', '域名管理', '◉', '查看并创建域名'],
      ['accounts', '邮箱账户', '▤', '查看、创建和启停账户'],
      ['aliases', '邮件别名', '↪', '查看和创建别名'],
      ['lists', '分发列表', '☷', '查看和创建分发列表'],
      ['domain_aliases', '域名别名', '◫', '查看和创建域名别名'],
      ['dkim', '域名 DKIM', '⌁', '查看域名 DKIM 记录']
    ] },
    { name: '协议与投递', items: [
      ['ports', 'TCP/IP 端口', '⇄', '监听器和 TLS 绑定'],
      ['routes', 'SMTP 路由', '⌁', '邮件路由配置'],
      ['rules', '全局规则', '☑', '邮件处理规则'],
      ['ipranges', 'IP 范围', '◎', 'IP 访问配置'],
      ['certificates', 'TLS 证书', '♧', '证书元数据'],
      ['groups', '账户组', '☷', '分组访问控制'],
      ['greylisting_bypass','灰名单绕过地址','◎','灰名单 IP 范围例外'],
      ['greylisting_white_addresses','灰名单白名单','✓','灰名单邮件地址例外'],
      ['tlsa', 'TLSA 记录', '⊙', 'DANE 发布参考'],
      ['srv', 'SRV 记录', '⊕', '客户端服务发现']
    ] },
    { name: '安全与反垃圾', items: [
      ['antispam', '反垃圾设置', '⊘', '评分阈值与反垃圾选项'],
      ['antivirus', '反病毒设置', '✳', '病毒扫描配置'],
      ['quarantine', '隔离邮件', '▧', '隔离邮件列表'],
      ['dns_blacklists', 'DNS 黑名单', '☁', 'DNSBL 配置'],
      ['surbl_servers', 'SURBL 服务', '⊗', 'SURBL 配置'],
      ['whitelist_addresses', '白名单', '✓', '允许的邮件地址'],
      ['blocked_senders', '发件人黑名单', '⊖', '拒绝的邮件地址'],
      ['incoming_relays', '入站中继', '⇢', '中继 IP 列表']
    ] },
    { name: '服务器设置', items: [
      ['settings', '基础设置', '⚙', '服务器全局配置'],
      ['logging', '日志设置', '▥', '日志记录选项'],
      ['backup_settings', '备份设置', '▦', '备份目标与包含内容'],
      ['cache', '缓存设置', '▧', '缓存容量及状态'],
      ['indexing', '索引设置', '▩', '邮件索引配置'],
      ['scripting', '脚本设置', '⌘', '事件脚本配置'],
      ['messages', '系统消息', '✉', '服务器自动消息文本'],
      ['directories', '服务器目录', '▤', '安装及数据目录']
    ] },
  ];
  const itemMap = Object.fromEntries(groups.flatMap(g => g.items.map(x => [x[0], x])));
  Object.assign(itemMap, {status:['status','状态','','查看邮件服务器状态'],domains:['domains','域名','','管理域名'],accounts:['accounts','账户','','管理邮箱账户'],aliases:['aliases','别名','','管理邮件别名'],lists:['lists','分发列表','','管理分发列表'],settings:['settings','常规','','管理服务器常规设置'],queue:['queue','投递队列','','待投递邮件']});
  // 旧版 PHPWebAdmin 的域名树与域名常规页，使用现有 6.3.7 的 GET /domains/{domain} 接口。
  itemMap.domain = ['domain', '域名概况', '◉', '查看当前域名的常规配置和容量限制'];
  // 依旧提供原来全部 34 个管理模块，只调整导航结构，不改动 API 和原有业务。
  const navGroups = [
    {id:'server',title:'服务器',icon:'▣',items:['status']},
    {id:'domains',title:'域名与账户',icon:'▤',items:['domains'],domainTree:true},
    {id:'protocols',title:'协议与投递',icon:'⇄',items:['ports','routes','rules','ipranges','certificates','tlsa','srv']},
    {id:'security',title:'安全与反垃圾',icon:'⬡',items:['antispam','antivirus','quarantine','dns_blacklists','surbl_servers','whitelist_addresses','blocked_senders','incoming_relays']},
    {id:'settings',title:'服务器设置',icon:'⚙',items:['settings','logging','backup_settings','cache','indexing','scripting','messages','directories','smtp','pop3','imap','autoban','mirror','performance','ssl_tls','server_info','greylist']},
    {id:'tools',title:'实用工具',icon:'⚒',items:['queue','logs','backup','backup_archives']}
  ];
  // 对照用户提供的旧版 hMailServer Administrator 截图，补齐协议、反垃圾、反病毒、高级设置。
  const extraPages = {
    smtp:['SMTP','SMTP 服务连接、邮件递交、RFC 兼容性及高级参数'],
    pop3:['POP3','POP3 服务参数'], imap:['IMAP','IMAP 服务参数、公共文件夹与高级选项'],
    autoban:['自动封禁','登录失败与 IP 自动封禁配置'],
    greylist:['灰名单设置','延迟验证、灰名单和绕过规则'],
    mirror:['镜像','服务器镜像邮箱与路由配置'],
    performance:['性能','并发、缓存与性能控制'],
    ssl_tls:['SSL/TLS','TLS、证书与安全协议设置'],
    server_info:['服务器信息','服务器目录和运行环境'],
  };
  for(const [id,[name,desc]] of Object.entries(extraPages))itemMap[id]=[id,name,'',desc];
  const collectionPages=new Set(['dns_blacklists','surbl_servers','whitelist_addresses','blocked_senders','incoming_relays','ipranges','ports','routes','rules','certificates','groups','greylisting_bypass','greylisting_white_addresses']);
  const domainPages = ['domain','accounts','aliases','lists','domain_aliases','dkim'];
  const needsDomain = new Set(['domain', 'accounts', 'aliases', 'lists', 'domain_aliases', 'dkim']);
  const jsonEditable = new Set(['settings', 'antispam', 'antivirus', 'logging', 'backup_settings', 'cache', 'indexing', 'scripting']);
  const rawCreatable = new Set(['aliases', 'lists', 'domain_aliases']);
  // 只翻译显示文案；REST API 的路由、JSON 键、请求参数始终保留原值。
  const fieldNames = {
    id:'编号', name:'名称', value:'内容', description:'说明', comment:'备注', type:'类型', enabled:'是否启用', active:'启用状态',
    status:'当前状态', state:'服务状态', version:'服务器版本', server_version:'服务器版本',
    processedMessages:'累计处理邮件数', spamMessages:'累计识别垃圾邮件数', virusesRemoved:'累计清除病毒数',
    sessions:'当前协议连接', smtp:'SMTP 连接数', imap:'IMAP 连接数', pop3:'POP3 连接数',
    build:'服务器功能支持', script_engine:'脚本引擎', script_languages:'脚本语言',
    argon2id:'Argon2id 密码哈希', post_quantum_key_exchange:'后量子密钥交换',
    address:'邮箱地址', email:'邮箱地址', accountaddress:'邮箱地址', username:'用户名', login:'登录名',
    domain:'域名', domainname:'域名', domainid:'域名编号', postmaster:'邮件管理员地址',
    first_name:'名字', last_name:'姓氏', firstname:'名字', lastname:'姓氏', display_name:'显示名称',
    max_size_mb:'邮箱容量上限（MB）', max_size:'容量上限', size:'大小', total_size:'总大小', size_mb:'大小（MB）',
    quota:'容量配额', quota_mb:'容量配额（MB）', current_size:'已使用容量',
    accountid:'账户编号', accountactive:'账户状态', accountdomainid:'所属域名编号',
    accountmaxsize:'邮箱容量上限', accountsize:'已使用容量', accounttype:'账户类型',
    accounts:'邮箱账户', domains:'域名', aliases:'邮件别名', lists:'分发列表',
    alias:'别名地址', aliasname:'别名', destination:'目标地址', destination_address:'目标邮箱',
    source:'来源地址', target:'目标地址', members:'成员', recipients:'收件人', recipient:'收件人',
    from:'发件人', to:'收件人', subject:'邮件主题', sender:'发件人', from_address:'发件地址', to_address:'收件地址',
    message:'消息', message_id:'邮件编号', messageId:'邮件编号', queue_id:'队列编号',
    retries:'已重试次数', retry_count:'重试次数', next_retry:'下次重试时间', nextRetry:'下次重试时间',
    created:'创建时间', created_at:'创建时间', updated:'更新时间', updated_at:'更新时间',
    timestamp:'时间戳', date:'日期', time:'时间', last_attempt:'上次投递时间',
    error:'错误信息', last_error:'上次错误', reason:'原因', result:'处理结果', priority:'优先级',
    ip:'IP 地址', ip_address:'IP 地址', ipaddress:'IP 地址', lower_ip:'起始 IP 地址', upper_ip:'结束 IP 地址',
    ipaddress1:'起始 IP 地址', ipaddress2:'结束 IP 地址', port:'端口', protocol:'协议',
    connection_security:'连接安全方式', connectionSecurity:'连接安全方式', security:'安全设置',
    ssl:'SSL 加密', tls:'TLS 加密', starttls:'STARTTLS 加密', certificate:'证书', certificate_id:'证书编号',
    ssl_certificate:'SSL 证书', public_key:'公钥', key_file:'密钥文件', certificate_file:'证书文件',
    hostname:'主机名称', host:'主机地址', server:'服务器地址', server_name:'服务器名称',
    target_host:'目标服务器', relay_host:'中继服务器', smtp_host:'SMTP 服务器',
    dns:'域名解析', mx:'邮件交换记录', spf:'发件人验证记录', dkim:'DKIM 邮件签名', dmarc:'DMARC 邮件认证',
    selector:'选择器', secondary_selector:'备用选择器', private_key_file:'私钥文件',
    anti_spam:'反垃圾邮件', anti_virus:'反病毒扫描', antispam:'反垃圾邮件', antivirus:'反病毒扫描',
    spam:'垃圾邮件', score:'评分', spam_score:'垃圾邮件评分', delete_threshold:'删除阈值',
    mark_threshold:'标记阈值', reject_threshold:'拒绝阈值', max_message_size:'邮件大小上限',
    max_message_size_mb:'邮件大小上限（MB）', maximum_message_size:'最大邮件大小',
    whitelist:'白名单', blacklist:'黑名单', blocked:'已拦截', allowed:'已允许',
    logging:'日志记录', log_level:'日志级别', filename:'文件名', file:'文件',
    path:'路径', directory:'目录', data_directory:'数据目录', log_directory:'日志目录',
    backup_directory:'备份目录', backup_path:'备份路径', destination_path:'目标路径',
    archive:'归档文件', archives:'备份归档', backup:'备份', restore:'恢复',
    running:'是否运行', in_progress:'进行中', progress:'进度', percent:'完成百分比',
    completed:'已完成', success:'是否成功', failed:'失败数量', total:'总计', count:'数量',
    interval:'时间间隔', interval_seconds:'时间间隔（秒）', timeout:'超时时间', timeout_seconds:'超时时间（秒）',
    timeout_minutes:'超时时间（分钟）', max_connections:'最大连接数',
    connection_count:'连接数', queue_count:'队列邮件数', queue_length:'队列邮件数',
    delivery_queue_count:'待投递邮件数', uptime:'运行时间', uptime_seconds:'运行秒数',
    started_at:'启动时间', start_time:'启动时间', expires:'到期时间', expires_at:'到期时间',
    expires_on:'到期日期', expiration:'有效期', days:'天数', enabled_for:'适用范围',
    limit:'数量限制', max_accounts:'最大邮箱数量', max_no_of_accounts:'最大邮箱数量',
    max_aliases:'最大别名数量', max_distribution_lists:'最大分发列表数量',
    action:'处理动作', actions:'处理动作', rule:'规则', criteria:'匹配条件', criteria_type:'条件类型',
    pattern:'匹配模式', match:'匹配内容', search:'搜索', order:'排序', sort_order:'排序顺序',
    mode:'模式', method:'处理方式', require_authentication:'要求身份认证',
    authentication:'身份认证', allow_delivery:'允许投递', allow_connections:'允许连接',
    use_ssl:'启用 SSL', use_tls:'启用 TLS', use_starttls:'启用 STARTTLS',
    use_spf:'启用 SPF', use_dkim:'启用 DKIM', use_dmarc:'启用 DMARC',
    use_greylisting:'启用灰名单', greylisting:'灰名单', auto_reply:'自动回复',
    auto_reply_enabled:'启用自动回复', forwarding:'转发设置', forwarding_address:'转发地址',
    signature:'签名', signature_html:'HTML 签名', signature_text:'纯文本签名',
    max_connections_per_ip:'单 IP 最大连接数', relay:'中继', relays:'中继列表',
    default_domain:'默认域名', bind_address:'绑定地址', listen_address:'监听地址',
    dns_servers:'DNS 服务器', dns_server:'DNS 服务器', retry_interval:'重试间隔',
    cache:'缓存', cache_size:'缓存容量', cache_hits:'缓存命中次数', cache_misses:'缓存未命中次数',
    indexing:'邮件索引', index:'索引', index_size:'索引大小', enabled_features:'已启用功能',
    charset:'字符编码', language:'语言', languages:'语言列表', compression:'压缩方式',
    max_size_mb_per_account:'单个账户容量上限（MB）', last_modified:'最后修改时间',
    backup_status:'备份状态', backup_type:'备份类型', archive_name:'归档名称',
    folder:'文件夹', mailbox:'邮箱', mailboxes:'邮箱列表', folders:'文件夹列表',
    account:'邮箱账户', domain_alias:'域名别名', domain_aliases:'域名别名',
    dns_blacklists:'DNS 黑名单', surbl_servers:'SURBL 服务', incoming_relays:'入站中继',
    whitelist_addresses:'白名单地址', blocked_senders:'被拒发件人',
    accountpassword:'账户密码', accountpwencryption:'密码存储方式',
    recipient_count:'收件人数', processed_messages:'累计处理邮件数', spam_messages:'累计识别垃圾邮件数',
    viruses_removed:'累计清除病毒数', session_count:'当前连接数',
  };
  Object.assign(fieldNames,{
    AutoBanEnabled:'启用自动封禁', auto_ban_enabled:'启用自动封禁',
    AutoBanMaxInvalidLogonAttempts:'登录失败最大次数', auto_ban_max_invalid_logon_attempts:'登录失败最大次数',
    AutoBanMinutesBeforeReset:'重置失败次数（分钟）', auto_ban_minutes_before_reset:'重置失败次数（分钟）',
    AutoBanMinutesToAutoBan:'自动封禁时长（分钟）', auto_ban_minutes_to_auto_ban:'自动封禁时长（分钟）',
    mirroremailaddress:'镜像邮箱地址', mirror_email_address:'镜像邮箱地址',
    smtp_relayer_port:'SMTP 中继端口', welcome_message:'欢迎信息',
    clamav_enabled:'启用 ClamAV', clamav_port:'ClamAV 端口', clamav_host:'ClamAV 服务器',
    greylisting_enabled:'启用灰名单', spf_enabled:'启用 SPF',
    surbl_enabled:'启用 SURBL', dnsbl_enabled:'启用 DNS 黑名单',
    max_message_size_kb:'最大邮件大小（KB）', max_connections:'最大并发连接数',
    public_folders:'公共文件夹', use_imap_idle:'使用 IMAP IDLE',
    email_address:'邮件地址', dns_host:'DNS 查询主机', expected_result:'预期返回值',
    rejection_message:'拒绝提示', rejection_score:'拒绝评分',
    lower_ip:'起始 IP', upper_ip:'结束 IP', ip_range:'IP 地址范围'
  });
  // 表格列名按模块翻译，同一字段在不同表格中可能有不同的含义。
  const tableFieldNames = {

    status: {
      state:'服务状态', version:'服务器版本', processedMessages:'累计处理邮件数',
      spamMessages:'累计识别垃圾邮件数', virusesRemoved:'累计清除病毒数',
      sessions:'协议连接数', smtp:'SMTP 连接数', imap:'IMAP 连接数', pop3:'POP3 连接数',
      build:'构建功能', script_engine:'脚本引擎', script_languages:'支持的脚本语言',
      argon2id:'支持 Argon2id', post_quantum_key_exchange:'支持后量子密钥交换'
    },
    backup: {
      state:'备份状态', status:'备份状态', running:'正在运行', in_progress:'正在备份',
      progress:'备份进度', started_at:'开始时间', completed_at:'完成时间',
      last_backup:'上次备份时间', last_backup_at:'上次备份时间',
      archive:'备份归档文件', archive_name:'备份归档名称',
      error:'错误信息', last_error:'最近一次错误', success:'备份是否成功'
    },
    backup_settings: {
      destination:'备份目标路径', directory:'备份目录', backup_directory:'备份目录',
      path:'备份路径', compress:'启用压缩', compression:'压缩方式',
      include_domains:'备份域名', include_settings:'备份设置',
      include_messages:'备份邮件', include_accounts:'备份账户',
      include_mailboxes:'备份邮箱', enabled:'启用备份'
    },
    dkim: {
      enabled:'启用 DKIM', selector:'DKIM 选择器',
      secondary_selector:'备用 DKIM 选择器', private_key_file:'DKIM 私钥文件',
      secondary_private_key_file:'备用 DKIM 私钥文件',
      canonicalization:'DKIM 规范化方式', header_canonicalization:'邮件头规范化方式',
      body_canonicalization:'邮件正文规范化方式', domain:'签名域名',
      public_key:'DKIM 公钥', record:'DKIM DNS 记录'
    },
    tlsa: {
      name:'TLSA 记录名称', hostname:'主机名', port:'端口', protocol:'协议',
      usage:'证书用途', selector:'证书选择器', matching_type:'匹配类型',
      certificate:'证书', record:'TLSA DNS 记录', value:'TLSA 记录值'
    },
    srv: {
      name:'SRV 记录名称', service:'服务名称', protocol:'协议', target:'目标主机',
      port:'端口', priority:'优先级', weight:'权重', record:'SRV DNS 记录'
    },
    antispam: {
      enabled:'启用反垃圾邮件', use_spf:'启用 SPF 检查',
      use_dkim:'启用 DKIM 检查', use_dmarc:'启用 DMARC 检查',
      use_greylisting:'启用灰名单', mark_threshold:'垃圾邮件标记阈值',
      delete_threshold:'垃圾邮件删除阈值', reject_threshold:'垃圾邮件拒收阈值',
      max_message_size:'最大检查邮件大小', spam_score:'垃圾邮件评分',
      add_header:'添加垃圾邮件标头', greylisting:'灰名单设置'
    },
    antivirus: {
      enabled:'启用反病毒扫描', use_clamav:'启用 ClamAV',
      clamav_host:'ClamAV 服务器地址', clamav_port:'ClamAV 服务器端口',
      delete_virus:'发现病毒后删除', max_message_size:'最大扫描邮件大小',
      scanner:'病毒扫描程序', scanner_path:'扫描程序路径'
    },
    settings: {
      hostname:'服务器主机名', server_name:'服务器名称',
      default_domain:'默认域名', postmaster:'邮件管理员地址',
      max_message_size:'全局邮件大小上限', max_connections:'最大连接数',
      max_connections_per_ip:'单 IP 最大连接数',
      smtp_relayer:'SMTP 中继服务器', relay_host:'中继服务器',
      relay_port:'中继端口', relay_username:'中继用户名',
      relay_password:'中继密码', require_authentication:'要求身份认证',
      welcome_message:'SMTP 欢迎信息', dns_servers:'DNS 服务器',
      retry_interval:'重试间隔', delivery_threads:'投递线程数'
    },
    logging: {
      enabled:'启用日志记录', smtp:'记录 SMTP 日志', imap:'记录 IMAP 日志',
      pop3:'记录 POP3 日志', tcpip:'记录 TCP/IP 日志',
      application:'记录应用程序日志', debug:'记录调试日志',
      awstats:'记录 AWStats 日志', log_level:'日志级别',
      directory:'日志存储目录', log_directory:'日志存储目录'
    },
    cache: {
      enabled:'启用缓存', cache_size:'缓存大小', cache_hits:'缓存命中数',
      cache_misses:'缓存未命中数', domain_cache:'域名缓存',
      account_cache:'账户缓存', alias_cache:'别名缓存',
      distribution_list_cache:'分发列表缓存',
      lifetime:'缓存有效期', lifetime_seconds:'缓存有效期（秒）'
    },
    indexing: {
      enabled:'启用邮件索引', index:'索引状态', indexing:'索引设置',
      messages_indexed:'已索引邮件数', message_count:'邮件总数',
      last_indexed:'最近索引时间', index_size:'索引大小'
    },
    scripting: {
      enabled:'启用事件脚本', script_engine:'脚本引擎',
      language:'脚本语言', script_language:'脚本语言',
      script_file:'脚本文件', script_path:'脚本路径',
      last_reload:'最近重新加载时间'
    },
    messages: {
      name:'系统消息名称', subject:'邮件主题', body:'邮件正文',
      text:'消息文本', html:'HTML 消息内容', enabled:'是否启用',
      message:'消息内容', type:'消息类型'
    },
    directories: {
      install_directory:'安装目录', installation_directory:'安装目录',
      data_directory:'邮件数据目录', log_directory:'日志目录',
      event_directory:'事件脚本目录', temp_directory:'临时目录',
      database_directory:'数据库目录', script_directory:'脚本目录',
      ini_file:'配置文件路径', ini_path:'配置文件路径',
      hmailserver_ini:'hMailServer.ini 路径'
    },
    domain: {name:'域名', active:'启用状态', postmaster:'邮件管理员地址'},
    domains: {
      id:'域名编号', name:'域名', domain:'域名', domainname:'域名', active:'启用状态',
      enabled:'启用状态', postmaster:'邮件管理员地址', max_size_mb:'域名容量上限（MB）',
      max_message_size_mb:'单封邮件上限（MB）', max_accounts:'最大邮箱数量',
      max_aliases:'最大别名数量', max_distribution_lists:'最大分发列表数量'
    },
    accounts: {
      id:'邮箱编号', name:'邮箱名称', address:'邮箱地址', email:'邮箱地址', active:'启用状态',
      first_name:'名字', last_name:'姓氏', max_size_mb:'邮箱容量上限（MB）',
      size_mb:'已使用容量（MB）', current_size_mb:'已使用容量（MB）',
      administrator:'管理员权限', admin:'管理员权限', last_login:'最近登录时间',
      forwarding_address:'转发地址', vacation_message_is_on:'自动回复状态'
    },
    aliases: {
      id:'别名编号', name:'别名地址', address:'别名地址', alias:'别名地址',
      destination:'转发目标地址', target:'转发目标地址', active:'启用状态'
    },
    lists: {
      id:'列表编号', name:'列表地址', address:'列表地址', active:'启用状态',
      member_count:'成员数量', members:'成员', mode:'分发方式', recipients:'收件人'
    },
    domain_aliases: {
      id:'域名别名编号', name:'别名域名', alias:'别名域名', domain:'主域名',
      target:'目标域名', destination:'目标域名', active:'启用状态'
    },
    queue: {
      id:'邮件编号', name:'邮件名称', from:'发件人', to:'收件人',
      sender:'发件人', recipient:'收件人', recipients:'收件人',
      created:'进入队列时间', created_at:'进入队列时间', retries:'重试次数',
      next_retry:'下次投递时间', last_attempt:'上次投递时间',
      last_error:'上次投递错误', size:'邮件大小', size_bytes:'邮件大小（字节）'
    },
    logs: {name:'日志文件名', value:'日志文件名', file:'日志文件名', filename:'日志文件名',
      size:'文件大小', size_bytes:'文件大小（字节）', modified:'最后修改时间'},
    backup_archives: {name:'备份文件名', filename:'备份文件名', archive:'备份归档',
      size:'文件大小', size_bytes:'文件大小（字节）', created:'备份创建时间'},
    ports: {name:'监听器名称', port:'监听端口', protocol:'邮件协议',
      address:'监听地址', ip:'监听地址', connection_security:'连接安全方式',
      certificate:'TLS 证书', enabled:'启用状态'},
    ipranges: {name:'IP 范围名称', lower_ip:'起始 IP', upper_ip:'结束 IP',
      ipaddress1:'起始 IP', ipaddress2:'结束 IP', priority:'匹配优先级'},
    routes: {name:'路由名称', domain:'目标域名', host:'目标服务器',
      port:'连接端口', security:'传输安全方式'},
    rules: {name:'规则名称', enabled:'启用状态', active:'启用状态',
      sort_order:'执行顺序', criteria:'匹配条件', actions:'执行动作'},
    certificates: {name:'证书名称', filename:'证书文件', expires:'到期时间',
      expires_at:'到期时间', certificate_file:'证书文件', key_file:'私钥文件'},
    quarantine: {name:'邮件文件名', file:'邮件文件', reason:'隔离原因',
      from:'发件人', to:'收件人', created:'隔离时间'},
    dns_blacklists: {name:'黑名单名称', host:'查询服务器', score:'垃圾邮件评分',
      enabled:'启用状态'},
    surbl_servers: {name:'SURBL 名称', host:'查询服务器', score:'垃圾邮件评分',
      enabled:'启用状态'},
    whitelist_addresses: {name:'地址', address:'白名单地址', email:'白名单地址'},
    blocked_senders: {name:'发件人', address:'被拒发件地址', email:'被拒发件地址'},
    incoming_relays: {name:'中继名称', address:'中继 IP 地址', ip:'中继 IP 地址',
      lower_ip:'起始 IP', upper_ip:'结束 IP'}
  };
  // 新版独立控制台：保留原 API 路由白名单、管理员 Token 与业务接口。
  const $ = id => document.getElementById(id);
  const esc = val => String(val ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const apiLists = new Set(['domains','accounts','aliases','lists','domain_aliases','queue','logs','backup_archives','ports','ipranges','routes','rules','certificates','quarantine','dns_blacklists','surbl_servers','whitelist_addresses','blocked_senders','incoming_relays','groups','greylisting_bypass','greylisting_white_addresses']);
  const stateMap = {0:'未知',1:'已停止',2:'正在启动',3:'运行中',4:'正在停止'};
  const stateWords = {running:'运行中',stopped:'已停止',paused:'已暂停',pending:'等待中',completed:'已完成',failed:'失败',success:'成功',active:'已启用',inactive:'已停用',error:'错误',idle:'空闲',processing:'处理中',queued:'排队中'};
  const openedGroups = {domains:true,settings:true,smtp:true,spam:true,advanced:true,tools:true,protocols:false,security:false,backup:false,other:false};
  const expandedDomains = new Set();
  const createLabels = {domains:'添加',accounts:'添加',aliases:'添加',lists:'添加',domain_aliases:'添加',backup:'开始备份'};
  const displaySettings = {resource:'',search:'',sort:'',desc:false,offset:0};
  let page = 'status';
  let domain = sessionStorage.getItem('hmailConsoleDomain') || '';
  let domains = [];
  let content = null;
  let rows = [];
  let modalSubmit = null;
  let inFlight = 0;

  function label(key, resource = page) {
    const original = String(key);
    const normalized = original.replace(/([a-z\d])([A-Z])/g,'$1_$2').replace(/([A-Z])([A-Z][a-z])/g,'$1_$2').toLowerCase();
    const names = tableFieldNames[resource] || {};
    return names[original] || names[normalized] || fieldNames[original] || fieldNames[normalized] || original;
  }
  function notify(message='', type='') {
    const el = $('notice'); el.textContent = message; el.className = type; el.hidden = !message;
    if(message && (type==='success'||type==='error') && window.layui?.layer) window.layui.layer.msg(esc(message),{icon:type==='success'?1:2,time:2600});
  }
  function connection(ok) {
    $('sideStatus').textContent = ok ? 'API 连接正常' : 'API 连接异常';
    const dot=$('apiDot');if(dot)dot.className='api-dot '+(ok?'good':'bad');
    const indicator=document.querySelector('.connection-indicator .dot');
    if(indicator)indicator.className='dot '+(ok?'good':'bad');
  }
  function expire() {
    localStorage.removeItem('Token');
    window.top.location.replace(new URL('/admin/login',location.href).href);
    throw Error('管理员登录已过期');
  }
  async function call(resource, method='GET', extra={}) {
    const token = localStorage.getItem('Token'); if (!token) expire();
    const ctrl = new AbortController(); const timer = setTimeout(()=>ctrl.abort(),16000);
    try {
      const resp = await fetch('/HmailConsole/gateway',{
        method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json','Token':token},
        body:JSON.stringify({resource,method,...extra}),credentials:'same-origin',cache:'no-store',signal:ctrl.signal
      });
      if (resp.status===401) expire();
      const result = await resp.json();
      if (result.code===401) expire();
      if (result.code!==200) {
        const upstream = result.data && typeof result.data==='object' ? (result.data.error || result.data.message || '') : '';
        throw Error((result.message || 'API 操作失败') + (upstream ? '：'+upstream : ''));
      }
      return result.data;
    } catch(err) {
      if (err.name==='AbortError') throw Error('hMailServer API 响应超时');
      throw err;
    } finally { clearTimeout(timer); }
  }
  function listOf(data, resource) {
    if (Array.isArray(data)) return data;
    if (!data || typeof data!=='object') return [];
    const candidates = [resource,resource.replaceAll('_','-'),'items','results','data','entries','list','accounts','aliases','domains','logs','messages'];
    for (const key of candidates) if (Array.isArray(data[key])) return data[key];
    return Object.values(data).find(Array.isArray) || [];
  }
  function sourceList(data) {
    return listOf(data,'domains').map(d => typeof d==='string'?d:(d.name??d.domain??d.domainname??'')).filter(Boolean);
  }
  function formatted(val, key='') {
    if (val===null || val===undefined || val==='') return '<span class="muted">未设置</span>';
    if (key==='state' && (typeof val==='number'||/^\d+$/.test(String(val)))) return esc(stateMap[val]??val);
    if (key==='status' && typeof val==='string') val=stateWords[val.toLowerCase()]??val;
    if (typeof val==='boolean') return '<span class="'+(val?'active-cell':'inactive-cell')+'">'+(val?'已启用':'已停用')+'</span>';
    if (typeof val==='number') return esc(val.toLocaleString('zh-CN'));
    if (Array.isArray(val)) {
      if (!val.length) return '<span class="muted">暂无数据</span>';
      if (val.every(v=>v===null||typeof v!=='object')) return esc(val.join('、'));
      return '<details class="inline-details"><summary>查看 '+val.length+' 项</summary>'+val.slice(0,30).map((v,i)=>'<div class="nested-entry">'+(i+1)+'. '+formatted(v)+'</div>').join('')+'</details>';
    }
    if (val && typeof val==='object') return '<details class="inline-details"><summary>查看详情</summary>'+Object.entries(val).map(([k,v])=>'<div class="nested-entry"><span class="nested-label" title="'+esc(k)+'">'+esc(label(k))+'</span>'+formatted(v,k)+'</div>').join('')+'</details>';
    return esc(val);
  }
  function empty(message='暂无记录', icon='') {return '<div class="empty-state"><span class="empty-symbol"><i class="layui-icon '+(icon==='!'?'layui-icon-error':'layui-icon-note')+'" aria-hidden="true"></i></span><p>'+esc(message)+'</p></div>';}
  function detail(data) {
    if (!data || typeof data!=='object') return '<div class="detail"><div class="detail-row">'+formatted(data)+'</div></div>';
    return '<div class="detail">'+Object.entries(data).map(([key,value])=>'<div class="detail-row"><span class="key" title="原始字段 '+esc(key)+'">'+esc(label(key))+'</span><div class="val">'+formatted(value,key)+'</div></div>').join('')+'</div>';
  }
  // 数据来自服务器当前实际响应，使用原字段名提交；未知字段保留英文，不伪造旧版 COM 属性。
  const settingSpecs = {
    smtp:{source:'settings',tabs:[
      ['常规',/(^|[._])smtp|welcome|connection|message.size|hostname/i],
      ['邮件递交',/delivery|retry|relay|route|mx|thread|queue|bind|target|smtp/i],
      ['统计',/stat|session|counter|process|delivered|failed|smtp/i],
      ['RFC 兼容性',/rfc|helo|ehlo|vrfy|auth|allow|reject|require|header/i],
      ['高级',/smtp|dns|tls|ssl|timeout|auth|queue|relay|thread/i]]},
    pop3:{source:'settings',tabs:[
      ['常规',/pop3|connection|timeout|welcome|login/i],
      ['高级',/pop3|auth|tls|ssl|quota|limit/i]]},
    imap:{source:'settings',tabs:[
      ['常规',/imap|connection|timeout|welcome|login/i],
      ['公共文件夹',/public|folder|acl|share|imap/i],
      ['高级',/imap|sort|idle|quota|namespace|auth|compress/i]]},
    greylist:{source:'antispam',tabs:[['灰名单',/grey|gray|listing|delay|bypass/i],['全部反垃圾设置',/.*/]]},
    antispam:{source:'antispam',tabs:[
      ['常规',/spam|threshold|score|spf|dkim|dmarc|header|enabled|maximum|message/i],
      ['灰名单',/grey|gray|listing|delay|bypass/i],
      ['检测规则',/check|helo|mx|dns|surbl|rbl|reject|block|test/i]]},
    antivirus:{source:'antivirus',tabs:[
      ['常规',/virus|scan|infect|delete|action|enabled|notify|attachment|maximum|size/i],
      ['ClamAV',/clamav|clam_av/i],
      ['ClamWin',/clamwin|clam_win/i],
      ['外部病毒扫描程序',/external|custom|scanner|command|executable|path/i],
      ['附件过滤',/attachment|extension|filter|blocked|filename/i]]},
    autoban:{source:'settings',tabs:[['自动封禁',/autoban|auto_ban|invalid.logon|failed.login|logon.failure/i]]},
    mirror:{source:'settings',tabs:[['镜像设置',/mirror|copy|archive|recipient/i]]},
    performance:{source:'settings',tabs:[['性能',/performance|thread|cache|worker|connection|queue|pool|limit/i]]},
    ssl_tls:{source:'settings',tabs:[['SSL/TLS',/tls|ssl|cipher|certificate|security|encrypt|starttls/i]]},
    server_info:{source:'directories',readonly:true,tabs:[['服务器目录',/.*/]]}
  };
  const settingTabState={};
  let visibleSettingFields=[];
  let visibleSettingRaw=null;
  let schemaCache=null;
  const secretName=/password|secret|private.?key|token|credential|authorization/i;
  const collectionRoutes={greylisting_bypass:'greylisting-bypass',greylisting_white_addresses:'greylisting-white-addresses',dns_blacklists:'dns-blacklists',surbl_servers:'surbl-servers',
    whitelist_addresses:'whitelist-addresses',blocked_senders:'blocked-senders',
    incoming_relays:'incoming-relays',ipranges:'ipranges',ports:'ports',routes:'routes',
    rules:'rules',certificates:'certificates',groups:'groups'};

  function flattenActualFields(value,prefix=[],level=0){
    if(!value || typeof value!=='object'||Array.isArray(value))return [];
    const entries=[];
    for(const [key,item] of Object.entries(value)){
      const path=[...prefix,key];
      if(item&&typeof item==='object'&&!Array.isArray(item)&&level<4)entries.push(...flattenActualFields(item,path,level+1));
      else entries.push({path,value:item});
    }
    return entries;
  }
  function configField(entry,index,readonly){
    const key=entry.path.at(-1), path=entry.path.join('.'), val=entry.value;
    const safe=!secretName.test(path)&&val!=='（敏感字段已隐藏）';
    const canEdit=!readonly&&safe&&(val===null||['string','number','boolean'].includes(typeof val));
    let input;
    if(!safe) input='<span class="muted">敏感字段已隐藏，不能在此查看或修改</span>';
    else if(!canEdit)input='<code class="config-readonly">'+esc(val&&typeof val==='object'?JSON.stringify(val):val)+'</code>';
    else if(typeof val==='boolean')input='<input class="setting-input" type="checkbox" data-setting-index="'+index+'" '+(val?'checked':'')+'>';
    else input='<input class="setting-input layui-input" data-setting-index="'+index+'" type="'+(typeof val==='number'?'number':'text')+'" '+(typeof val==='number'?'step="any" ':'')+'value="'+esc(val??'')+'">';
    return '<div class="config-row"><label title="'+esc(path)+'">'+esc(label(key))+'<small>'+esc(path)+'</small></label><div>'+input+'</div></div>';
  }
  function renderSettingWorkspace(data){
    const spec=settingSpecs[page];if(!spec)return;
    visibleSettingRaw=data;
    const all=flattenActualFields(data);
    const tabs=[...spec.tabs,['全部实际字段',/.*/]];
    const sel=Math.min(settingTabState[page]||0,tabs.length-1);
    const re=tabs[sel][1];
    const filtered=all.filter(e=>re.test(e.path.join('.')));
    visibleSettingFields=filtered;
    const editable=!spec.readonly&&jsonEditable.has(spec.source);
    const labelUrl='/api/v1/'+(spec.source==='settings'?'settings':spec.source==='ini_settings'?'settings/ini':spec.source==='directories'?'settings/directories':'settings/'+spec.source);
    $('output').innerHTML='<section class="classic-config"><ul class="tabbernav config-tabs">'+tabs.map(([title],i)=>
      '<li'+(i===sel?' class="tabberactive"':'')+'><button type="button" data-config-tab="'+i+'">'+esc(title)+'</button></li>').join('')+'</ul>'+ 
      '<div class="tabbertab-content"><p class="config-hint">数据来源：<code>'+esc(labelUrl)+'</code>。只显示当前服务器实际返回的字段；未翻译字段保留英文名。</p>'+ 
      (filtered.length?filtered.map((v,i)=>configField(v,i,!editable)).join(''):
      '<p class="config-hint">当前 API 返回内容中没有与此选项卡匹配的字段。可查看“全部实际字段”；这不表示服务器支持旧版的所有同名配置。</p>')+
      (editable&&filtered.some(e=>!secretName.test(e.path.join('.')))?'<div class="config-actions"><button type="button" id="saveCurrentSettings" class="layui-btn layui-btn-normal layui-btn-sm">保存本页已修改的字段</button></div>':'')+
      '<p class="config-hint">'+(spec.readonly?'本页仅供查看；避免猜测 ini 设置的写入格式。':'不修改的字段不会提交给服务器；更改部分网络或加密参数可能需要重新初始化服务。')+'</p>'+ 
      '<details class="raw-json"><summary>查看当前接口原始 JSON</summary><pre class="jsonbox">'+esc(JSON.stringify(data,null,2))+'</pre></details></div></section>';
    $('output').querySelectorAll('[data-config-tab]').forEach(btn=>btn.onclick=()=>{settingTabState[page]=Number(btn.dataset.configTab);renderSettingWorkspace(visibleSettingRaw);});
    const saveBtn=$('saveCurrentSettings');if(saveBtn)saveBtn.onclick=saveSettingChanges;
    if(['smtp','pop3','imap'].includes(page)){
      const tabId=page;
      const statusTarget=$('output').querySelector('.tabbertab-content');
      const links=document.createElement('p');links.className='config-hint';
      links.innerHTML='<button type="button" data-link-ports="1">查看 TCP/IP 监听端口</button>　<button type="button" data-link-status="1">查看服务器会话和统计</button>';
      statusTarget?.appendChild(links);
      links.querySelector('[data-link-ports]').onclick=()=>showPage('ports');
      links.querySelector('[data-link-status]').onclick=()=>showPage('status');
      if(tabId==='smtp' && tabs[sel][0]==='统计'){
        const summary=document.createElement('div');summary.className='config-stat';summary.textContent='正在读取 SMTP 实时统计…';statusTarget.prepend(summary);
        call('status').then(current=>{if(page!==tabId || !summary.isConnected)return;
          summary.innerHTML='<p>当前 SMTP 会话：'+esc(current.sessions?.smtp??'—')+'　已处理邮件：'+esc(current.processedMessages??'—')+'　识别垃圾邮件：'+esc(current.spamMessages??'—')+'</p>';
        }).catch(e=>{if(summary.isConnected)summary.textContent='无法读取实时统计：'+e.message;});
      }
    }
  }
  async function saveSettingChanges(){
    const spec=settingSpecs[page];if(!spec || spec.readonly)return;
    const payload={};let changes=0;
    for(const [i,entry] of visibleSettingFields.entries()){
      const el=$('output').querySelector('[data-setting-index="'+i+'"]');if(!el)continue;
      const original=entry.value;
      let value=el.type==='checkbox'?el.checked:el.type==='number'?(el.value===''?null:Number(el.value)):el.value;
      if(el.type==='number'&&value!==null&&!Number.isFinite(value))throw Error('数字输入不合法：'+entry.path.join('.'));
      if(value===original)continue;
      let target=payload;
      const keys=entry.path;
      for(const key of keys.slice(0,-1))target=target[key]??=( {} );
      target[keys.at(-1)]=value;changes++;
    }
    if(!changes){notify('没有需要保存的修改');return;}
    if(!confirm('确定将 '+changes+' 项设置提交到 hMailServer 吗？'))return;
    try{
      await call(spec.source,'PUT',{payload});
      await showPage(page);notify('已保存 '+changes+' 项设置，请按需检查是否需要重载服务','success');
    }catch(err){notify('保存失败：'+err.message,'error');}
  }

  function resolveSchema(spec,input,depth=0){
    if(!input||depth>8)return null;
    if(input.$ref){const node=input.$ref.slice(2).split('/').reduce((v,k)=>v?.[k],spec);return resolveSchema(spec,node,depth+1);}
    const part=input.allOf||input.oneOf||input.anyOf;
    if(Array.isArray(part)&&part.length){
      const merged={properties:{},required:[]};
      for(const p of part){const obj=resolveSchema(spec,p,depth+1);if(obj){Object.assign(merged.properties,obj.properties||{});merged.required.push(...(obj.required||[]));}}
      return merged;
    }
    return input;
  }
  async function collectionSchema(resource,method){
    if(!schemaCache){try{schemaCache=await call('openapi');}catch(err){schemaCache={};}}
    const route='/api/v1/'+collectionRoutes[resource]+(method==='PUT'?'/{id}':'');
    const paths=schemaCache.paths||schemaCache.data?.paths||{};
    const methodInfo=paths[route]?.[method.toLowerCase()]||paths[route.replace('/api/v1','')]?.[method.toLowerCase()];
    let req=methodInfo?.requestBody;
    if(req?.$ref)req=resolveSchema(schemaCache,req);
    const schema=req?.content?.['application/json']?.schema||req?.content?.['application/*+json']?.schema;
    return resolveSchema(schemaCache,schema)?.properties||null;
  }
  function editorMarkup(fields,record){
    return fields.map(([k,meta])=>{
      const val=record[k]??meta.default??'';
      const type=Array.isArray(meta.type)?meta.type.find(x=>x!=='null'):meta.type;
      const labelHtml='<label for="edit_'+esc(k)+'">'+esc(label(k))+' <small>'+esc(k)+'</small></label>';
      const enums=meta.enum;
      let control='';
      if(enums?.length)control='<select id="edit_'+esc(k)+'" data-col-field="'+esc(k)+'">'+enums.map(o=>'<option value="'+esc(o)+'"'+(o===val?' selected':'')+'>'+esc(o)+'</option>').join('')+'</select>';
      else if(type==='boolean'||typeof val==='boolean')control='<input id="edit_'+esc(k)+'" type="checkbox" data-col-field="'+esc(k)+'" '+(val?'checked':'')+'>';
      else if(type==='object'||type==='array'||(val&&typeof val==='object'))control='<textarea id="edit_'+esc(k)+'" data-col-field="'+esc(k)+'" data-field-json="1">'+esc(JSON.stringify(val,null,2))+'</textarea>';
      else control='<input id="edit_'+esc(k)+'" type="'+(type==='integer'||type==='number'||typeof val==='number'?'number':'text')+'" data-col-field="'+esc(k)+'" '+(type==='integer'?'step="1" ':type==='number'?'step="any" ':'')+'value="'+esc(val)+'">';
      return '<div class="field">'+labelHtml+'<div>'+control+'</div>'+(meta.description?'<p class="note">'+esc(meta.description)+'</p>':'')+'</div>';
    }).join('');
  }
  async function editCollection(resource,id=null){
    if(!collectionPages.has(resource))return;
    let record=id?rows.find(r=>String(r.id??r.ID)===String(id))||{}:{};
    if(id){try{const full=await call('collection_item','GET',{collection:resource,id});record=full.item??full.data??full;}catch(e){/* 某些 API 没有单项 GET：回退列表记录。 */}}
    if(!record||typeof record!=='object'||Array.isArray(record))record={};
    const method=id?'PUT':'POST';
    const properties=await collectionSchema(resource,method);
    if(!id && !properties && rows.length){
      // 接口未提供字段 Schema 时，从同类已有记录取得真实字段名，不猜测旧版 COM 字段。
      record=Object.fromEntries(Object.entries(rows[0]).filter(([k])=>k!=='id'&&!secretName.test(k)).map(([k,v])=>
        [k,typeof v==='boolean'?false:typeof v==='number'?0:'']));
    }
    let fields=properties?Object.entries(properties):Object.entries(record).map(([k,v])=>[k,{type:typeof v}]);
    fields=fields.filter(([k])=>k!=='id'&&!secretName.test(k)&&!['created_at','updated_at','created','modified'].includes(k));
    const useFields=fields.length>0;
    const name=itemMap[resource][1];
    const body='<p class="api-note">'+esc(name)+' · '+(id?'编辑记录 #'+id:'新增记录')+'。参数与类型以当前 hMailServer API 返回为准。</p>'+ 
      (useFields?editorMarkup(fields,record):'<p class="api-note">当前列表没有字段定义，需提供符合 OpenAPI 的 JSON 对象。</p>')+
      '<details class="raw-json"'+(!useFields?' open':'')+'><summary>高级 JSON 编辑（优先使用此处内容时勾选）</summary>'+ 
      '<label class="checkbox"><input type="checkbox" id="fmUseJson"'+(!useFields?' checked':'')+'> 使用下面的 JSON 对象</label>'+ 
      '<textarea id="fmJson" spellcheck="false">'+esc(JSON.stringify(Object.fromEntries(Object.entries(record).filter(([k])=>k!=='id'&&!secretName.test(k))),null,2))+'</textarea></details>';
    openModal((id?'编辑':'添加')+name,body,async()=>{
      let payload={};
      if($('fmUseJson')?.checked){try{payload=JSON.parse($('fmJson').value);}catch(e){throw Error('JSON 格式有误');}}
      else for(const [key,meta] of fields){
        const el=$('modalBody').querySelector('[data-col-field="'+CSS.escape(key)+'"]');if(!el)continue;
        if(el.type==='checkbox')payload[key]=el.checked;
        else if(el.dataset.fieldJson){try{payload[key]=JSON.parse(el.value);}catch{throw Error(key+' 的 JSON 值无效');}}
        else if(el.type==='number'){if(el.value==='')continue;payload[key]=Number(el.value);}
        else if(el.value!==''||id)payload[key]=el.value;
      }
      if(!payload||Array.isArray(payload)||typeof payload!=='object'||!Object.keys(payload).length)throw Error('需要填写有效的字段');
      if(!confirm('确认提交 '+name+' 的'+(id?'修改':'创建')+'请求？'))return;
      if(id)await call('collection_item','PUT',{collection:resource,id,payload});
      else await call(resource,'POST',{payload});
      closeModal();await showPage(resource);notify(name+(id?'已更新':'已新增'),'success');
    },id?'保存修改':'确认添加');
  }
  async function removeCollection(resource,id){
    if(!collectionPages.has(resource)||!/^\d+$/.test(String(id)))return;
    if(!confirm('确认永久删除 '+itemMap[resource][1]+' 中编号为 '+id+' 的记录？此操作无法撤销。'))return;
    try{await call('collection_item','DELETE',{collection:resource,id,confirm_id:id});await showPage(resource);notify('删除成功','success');}
    catch(e){notify('删除失败：'+e.message,'error');}
  }
  async function applyNetworkSettings(){
    if(!confirm('此操作会短暂中断 SMTP / POP3 / IMAP 连接，并让服务器重新初始化监听器。确定继续？'))return;
    const text=prompt('请键入 REINITIALIZE 以确认重载邮件服务：');
    if(text!=='REINITIALIZE')return;
    try{await call('reinitialize','POST',{confirm:'REINITIALIZE'});notify('已提交邮件服务重载请求','success');}
    catch(err){notify('重载失败：'+err.message,'error');}
  }
  async function removeDomain(name){
    if(!name)return;
    const answer=prompt('危险操作：移除 '+name+' 将删除该域名及其所有邮箱、邮件和相关数据。\n请输入完整域名以确认永久删除：');
    if(answer!==name){if(answer!==null)notify('输入的域名不一致，已取消删除','error');return;}
    if(!confirm('最后确认：永久移除整个域名 '+name+' 及其全部账户和邮件？'))return;
    try{
      await call('domain','DELETE',{domain:name,confirm_domain:name});
      if(domain===name){domain='';sessionStorage.removeItem('hmailConsoleDomain');}
      await loadDomains();await showPage('domains');notify('已永久移除域名 '+name,'success');
    }catch(e){notify('域名删除失败：'+e.message,'error');}
  }

  function dataView(data) {
    content = data;
    if (page === 'status') { renderDashboard(data); return; }
    if (settingSpecs[page]) { renderSettingWorkspace(data); return; }
    if (apiLists.has(page)) {
      rows = listOf(data,page).slice(0,1000).map(x=>x && typeof x==='object'?x:{value:x});
      displaySettings.resource=page; displaySettings.search=''; displaySettings.sort=''; displaySettings.desc=false;displaySettings.offset=0;
      $('output').innerHTML='<div class="panel" id="gridPanel"></div>';
      renderTable();
    } else {
      $('output').innerHTML='<section class="tabberlive classic-detail-view"><ul class="tabbernav"><li class="tabberactive"><span>常规</span></li></ul><div class="tabbertab-content">'+detail(data)+
      '<details class="raw-json"><summary>显示原始 API JSON（高级）</summary><pre class="jsonbox">'+esc(JSON.stringify(data,null,2))+'</pre></details></div></section>';
    }
  }
  function keyList(list, resource) {
    const frequencies = new Map();
    list.forEach(row=>Object.keys(row).forEach(k=>{if(!/password|secret|private.?key|token/i.test(k))frequencies.set(k,(frequencies.get(k)||0)+1);}));
    const pref={domains:['name','active','postmaster','max_size_mb'],accounts:['address','active','first_name','last_name','size_mb','max_size_mb'],queue:['id','sender','recipients','next_retry','retries'],logs:['name','file','size']};
    return [...new Set([...(pref[resource]||[]),...[...frequencies].sort((a,b)=>b[1]-a[1]).map(([k])=>k)])].filter(k=>frequencies.has(k)).slice(0,7);
  }
  function quotaCell(row,key) {
    const used=Number(row.size_mb ?? row.current_size_mb),max=Number(row.max_size_mb ?? row.max_size);
    if (!['size_mb','current_size_mb','max_size_mb'].includes(key) || !(used>=0&&max>0)) return null;
    const percent=Math.max(0,Math.min(100,Math.round(used/max*100)));
    return '<div class="quota-cell">'+esc(used.toLocaleString('zh-CN'))+' / '+esc(max.toLocaleString('zh-CN'))+' MB<div class="quota-track"><div class="quota-fill '+(percent>=95?'full':percent>=80?'high':'')+'" style="width:'+percent+'%"></div></div></div>';
  }
  function rowAction(row, resource) {
    let action='';
    if (resource==='domains') {
      const d=row.name??row.domain??row.domainname??row.value;
      if(d) action='<button class="row-action" data-action="domain" data-domain="'+esc(d)+'">管理账户</button>　<button class="row-action danger-action" data-action="remove-domain" data-domain="'+esc(d)+'">移除域名</button>';
    } else if(resource==='accounts') {
      const address=row.address??row.accountaddress??row.email;
      if(address) action='<button class="row-action" data-action="account" data-address="'+esc(address)+'">编辑账户</button>';
    } else if(resource==='queue') {
      const id=String(row.id??row.queue_id??row.message_id??'');
      if(/^\d+$/.test(id)) action='<button class="row-action" data-action="retry" data-id="'+esc(id)+'">重新投递</button>';
    } else if(collectionPages.has(resource)) {
      const id=String(row.id??row.ID??'');
      if(/^\d+$/.test(id))action='<button class="row-action" data-action="edit-row" data-collection="'+esc(resource)+'" data-id="'+esc(id)+'">编辑</button>　<button class="row-action danger-action" data-action="remove-row" data-collection="'+esc(resource)+'" data-id="'+esc(id)+'">删除</button>';
    } else if(resource==='logs') {
      const name=String(row.name??row.file??row.filename??row.value??'');
      if(/^[a-zA-Z0-9_.-]+$/.test(name)) action='<button class="row-action" data-action="log" data-name="'+esc(name)+'">查看日志</button>';
    }
    return action;
  }
  function renderTable() {
    const panel=$('gridPanel'); if(!panel)return;
    const resource=page, filtered=rows.filter(r=>!displaySettings.search || Object.values(r).some(v=>String(typeof v==='object'?JSON.stringify(v):v??'').toLowerCase().includes(displaySettings.search)));
    const cols=keyList(rows,resource); const hasActions=['domains','accounts','queue','logs'].includes(resource)||collectionPages.has(resource);
    if(displaySettings.sort) filtered.sort((a,b)=>{
      const x=a[displaySettings.sort],y=b[displaySettings.sort];
      const numX=Number(x),numY=Number(y);
      const comparison=x!=null&&y!=null&&x!==''&&y!==''&&!isNaN(numX)&&!isNaN(numY)?numX-numY:String(x??'').localeCompare(String(y??''),'zh-CN',{numeric:true});
      return displaySettings.desc?-comparison:comparison;
    });
    const pageSize=25, maxOffset=Math.max(0,Math.ceil(filtered.length/pageSize)-1)*pageSize;
    displaySettings.offset=Math.min(displaySettings.offset,maxOffset);
    const shown=filtered.slice(displaySettings.offset,displaySettings.offset+pageSize);
    const th=cols.map(k=>'<th title="原始字段 '+esc(k)+'"><button class="sort-head" data-sort="'+esc(k)+'">'+esc(label(k,resource))+(displaySettings.sort===k?(displaySettings.desc?'<i class="layui-icon layui-icon-down"></i>':'<i class="layui-icon layui-icon-up"></i>'):'')+'</button></th>').join('');
    const trs=shown.map(row=>'<tr>'+cols.map((k,i)=>{
      const val=quotaCell(row,k)||formatted(row[k],k);
      const display=(i===0&&resource==='domains'&&(row.name??row.domain??row.domainname??row.value))?'<button class="classic-inline-link" data-action="domain" data-domain="'+esc(row.name??row.domain??row.domainname??row.value)+'">'+val+'</button>':
      (i===0&&resource==='accounts'&&(row.address??row.accountaddress??row.email))?'<button class="classic-inline-link" data-action="account" data-address="'+esc(row.address??row.accountaddress??row.email)+'">'+val+'</button>':val;
      return '<td>'+display+'</td>';
    }).join('')+(hasActions?'<td class="row-buttons">'+rowAction(row,resource)+'</td>':'')+'</tr>').join('');
    panel.innerHTML='<div class="panel-top"><h2><i class="layui-icon layui-icon-table" aria-hidden="true"></i> '+esc(itemMap[resource][1])+'</h2><div class="panel-top-actions"><span class="table-count">共 '+filtered.length+' 条'+(rows.length>=1000?'（最多显示前 1000 条）':'')+'</span><input id="tableFilter" class="layui-input table-search" type="search" placeholder="查找…" value="'+esc(displaySettings.search)+'" aria-label="搜索表格内容"></div></div>'+ 
      (filtered.length?'<div class="table-wrap"><table class="layui-table data-table"><thead><tr>'+th+(hasActions?'<th class="action-col">操作</th>':'')+'</tr></thead><tbody>'+trs+'</tbody></table></div>':empty('没有记录'))+
      '<div class="table-footer"><span>第 '+(filtered.length?Math.floor(displaySettings.offset/pageSize)+1:0)+' / '+Math.ceil(filtered.length/pageSize)+' 页</span><button type="button" data-action="prev" '+(displaySettings.offset===0?'disabled':'')+'><i class="layui-icon layui-icon-left"></i> 上一页</button><button type="button" data-action="next" '+(displaySettings.offset+pageSize>=filtered.length?'disabled':'')+'>下一页 <i class="layui-icon layui-icon-right"></i></button></div>';
    const input=$('tableFilter');
    input.addEventListener('input', e=>{const caret=e.target.selectionStart;displaySettings.search=e.target.value.toLowerCase();displaySettings.offset=0;renderTable();const next=$('tableFilter');next.focus();next.setSelectionRange(caret,caret);});
  }
  function statusLabel(state) {return stateMap[state] || stateWords[String(state||'').toLowerCase()] || String(state??'未知');}
  // 原版 PHPWebAdmin 状态页：三个选项卡“服务器 / 状态 / 投递队列”。
  async function renderDashboard(data) {
    if (!data || typeof data!=='object') data={state:data};
    const s=statusLabel(data.state??data.status);
    const tabNames=['服务器','状态','投递队列'];
    const tabbar='<ul class="tabbernav status-tabbar">'+tabNames.map((t,i)=>'<li'+(i===0?' class="tabberactive"':'')+'><button type="button" data-status-switch="'+i+'">'+t+'</button></li>').join('')+'</ul>';
    // 用服务器实际返回的统计值展示概览卡片，不做后台轮询或伪造统计。
    const metricCards=[
      ['当前运行状态',s,'layui-icon-engine','blue'],
      ['已处理邮件',data.processedMessages??data.processed_messages,'layui-icon-email','indigo'],
      ['垃圾邮件',data.spamMessages??data.spam_messages,'layui-icon-flag','orange'],
      ['已清除病毒',data.virusesRemoved??data.viruses_removed,'layui-icon-auz','green']
    ];
    const metrics='<div class="hm-stats">'+metricCards.map(([title,value,icon,tone])=>
      '<div class="hm-stat-card"><span class="hm-stat-icon '+tone+'"><i class="layui-icon '+icon+'"></i></span><div class="hm-stat-info"><span>'+esc(title)+'</span><strong>'+formatted(value)+'</strong></div></div>'
    ).join('')+'</div>';
    const statusTable='<table border="0" cellpadding="5"><tr><td class="status-label">服务器启动时间</td><td>'+formatted(data.start_time??data.started_at??data.startTime)+'</td></tr><tr><td colspan="2" class="status-subheader">邮件处理数量</td></tr>'+[
      ['已处理邮件',data.processedMessages??data.processed_messages],['已检测到病毒',data.virusesRemoved??data.viruses_removed],['垃圾邮件',data.spamMessages??data.spam_messages]
    ].map(([k,v])=>'<tr><td>'+k+'</td><td>'+formatted(v)+'</td></tr>').join('')+
    '<tr><td colspan="2" class="status-subheader">当前开放会话数</td></tr>'+['smtp','pop3','imap'].map(k=>'<tr><td>'+k.toUpperCase()+'</td><td>'+formatted(data.sessions?.[k]??0)+'</td></tr>').join('')+'</table>';
    const serverTab='<table border="0" cellpadding="5"><tr><td class="status-label">状态</td><td>'+esc(s)+'</td></tr><tr><td>操作</td><td><span class="muted">使用 hMailServer 管理服务控制，当前界面不提供启动/停止操作</span></td></tr></table>'+ 
      '<div class="server-columns"><div><p><i>服务器信息</i></p>'+formatted(data.version??'未提供')+'</div><div><p><i>数据库信息</i></p><span class="muted">此 REST API 未返回数据库详情</span></div></div>';
    // 常用入口复用既有 data-action=goto，不创建新的接口或权限分支。
    const shortcuts='<div class="hm-shortcuts"><div class="hm-shortcut-heading"><strong>快捷入口</strong><span>常用管理功能</span></div><div class="hm-shortcut-grid">'+[
      ['domains','layui-icon-website','域名管理','查看及管理所有域名'],
      ['smtp','layui-icon-release','SMTP 设置','投递与协议配置'],
      ['antispam','layui-icon-auz','反垃圾邮件','检测规则与过滤设置'],
      ['queue','layui-icon-email','投递队列','查看待处理邮件']
    ].map(([id,icon,title,help])=>'<button type="button" class="hm-shortcut" data-action="goto" data-page="'+id+'"><i class="layui-icon '+icon+'" aria-hidden="true"></i><span><b>'+title+'</b><small>'+help+'</small></span><i class="layui-icon layui-icon-right hm-shortcut-arrow" aria-hidden="true"></i></button>').join('')+'</div></div>';
    $('output').innerHTML='<div class="classic-status">'+metrics+tabbar+
      '<div class="status-tabcontent" data-status-tab="0">'+serverTab+'</div><div class="status-tabcontent" data-status-tab="1" hidden>'+statusTable+'</div><div class="status-tabcontent" data-status-tab="2" hidden><p>正在读取队列…</p></div>'+shortcuts+'</div>';
    $('output').querySelectorAll('[data-status-switch]').forEach(btn=>btn.addEventListener('click',()=>{
      const i=Number(btn.dataset.statusSwitch);const root=$('output');
      root.querySelectorAll('[data-status-tab]').forEach(el=>el.hidden=Number(el.dataset.statusTab)!==i);
      root.querySelectorAll('.status-tabbar li').forEach((el,j)=>el.classList.toggle('tabberactive',i===j));
    }));
    try {
      const queue=await call('queue');if(page!=='status')return;
      const list=listOf(queue,'queue'),visible=list.slice(0,100),cols=keyList(visible,'queue').slice(0,6);
      const body=list.length?'<table class="status-queue" border="0" cellpadding="5"><thead><tr>'+cols.map(k=>'<th>'+esc(label(k,'queue'))+'</th>').join('')+'</tr></thead><tbody>'+visible.map(r=>'<tr>'+cols.map(k=>'<td>'+formatted(r[k],k)+'</td>').join('')+'</tr>').join('')+'</tbody></table>':'<p>当前没有待投递邮件。</p>';
      const target=$('output').querySelector('[data-status-tab="2"]'); if(target)target.innerHTML=body+'<p>'+list.length+' 封邮件在队列中。 <button class="classic-inline-link" data-action="goto" data-page="queue">查看全部</button></p>';
    } catch(err){const target=$('output').querySelector('[data-status-tab="2"]');if(target)target.textContent='当前无法读取投递队列：'+err.message;}
  }
  function setDomain(value) {
    domain=value;sessionStorage.setItem('hmailConsoleDomain',value);
    if(value)expandedDomains.add(value);
    $('domainSelect').value=value;drawNav();
  }
  async function loadDomains() {
    try {
      const data=await call('domains');domains=sourceList(data);
      $('domainSelect').innerHTML='<option value="">选择域名</option>'+domains.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
      if(!domains.includes(domain))domain=domains[0]||'';
      setDomain(domain);
    } catch(err){notify(err.message,'error');}
  }
  // 所有菜单图标均取自项目自带的 Layui iconfont，不依赖旧版图片。
  const menuIcons={
    status:'layui-icon-chart-screen', domains:'layui-icon-website',domain:'layui-icon-website',
    accounts:'layui-icon-user',aliases:'layui-icon-email',lists:'layui-icon-group',
    domain_aliases:'layui-icon-link',dkim:'layui-icon-key',rules:'layui-icon-form',
    settings:'layui-icon-set',smtp:'layui-icon-release',pop3:'layui-icon-download-circle',
    imap:'layui-icon-email',ports:'layui-icon-transfer',certificates:'layui-icon-auz',
    routes:'layui-icon-share',antispam:'layui-icon-auz',greylist:'layui-icon-time',
    greylisting_bypass:'layui-icon-unlink',greylisting_white_addresses:'layui-icon-ok-circle',
    dns_blacklists:'layui-icon-disabled',surbl_servers:'layui-icon-find-fill',
    whitelist_addresses:'layui-icon-ok-circle',blocked_senders:'layui-icon-close-fill',
    antivirus:'layui-icon-auz',logging:'layui-icon-log',autoban:'layui-icon-lock',
    ipranges:'layui-icon-location',incoming_relays:'layui-icon-transfer',mirror:'layui-icon-share',
    performance:'layui-icon-chart',server_info:'layui-icon-about',ssl_tls:'layui-icon-key',
    scripting:'layui-icon-fonts-code',cache:'layui-icon-engine',indexing:'layui-icon-list',
    messages:'layui-icon-dialogue',groups:'layui-icon-group',directories:'layui-icon-folder',
    quarantine:'layui-icon-lock',queue:'layui-icon-email',logs:'layui-icon-file-b',
    backup:'layui-icon-download-circle',backup_archives:'layui-icon-file-b',
    backup_settings:'layui-icon-set',tools:'layui-icon-util',advanced:'layui-icon-set',
    spam:'layui-icon-auz',protocols:'layui-icon-transfer'
  };
  function menuIcon(key){return '<i class="layui-icon '+(menuIcons[key]||'layui-icon-file')+'" aria-hidden="true"></i>';}
  function leaf(resource,depth=1,selected='',title='') {
    const item=itemMap[resource];if(!item)return '';
    const active=page===resource&&(!needsDomain.has(resource)||selected===domain);
    return '<div class="tree-line tree-leaf'+(active?' active':'')+'" style="padding-left:'+(depth*12)+'px">'+
      '<span class="tree-expand-spacer" aria-hidden="true"></span><span class="node-icon">'+menuIcon(resource)+'</span>'+
      '<button class="node-label" data-page="'+resource+'"'+(selected?' data-domain="'+esc(selected)+'"':'')+' title="'+esc(title||item[1])+'">'+esc(title||item[1])+'</button></div>';
  }
  function folder(id,title,depth,icon='',info='') {
    const open=!!openedGroups[id];
    return '<div class="tree-line tree-folder" style="padding-left:'+(depth*12)+'px">'+
      '<span class="node-icon">'+menuIcon(id)+'</span>'+
      '<button class="node-label" data-group="'+id+'" title="'+esc(title)+'">'+esc(title)+(info?' <span class="tree-count">'+esc(info)+'</span>':'')+'</button>'+
      '<button class="tree-expand" data-group="'+id+'" aria-expanded="'+open+'" aria-label="'+(open?'折叠':'展开')+esc(title)+'"><i class="layui-icon '+(open?'layui-icon-down':'layui-icon-right')+'" aria-hidden="true"></i></button></div>';
  }
  function drawNav() {
    let html='<div class="tree-section-title">概览</div>';
    html+=leaf('status',1);
    html+='<div class="tree-section-title">业务管理</div>';
    html+=folder('domains','域名管理',1,'',domains.length);
    if(openedGroups.domains) {
      html+=leaf('domains',2,'','全部域名');
      domains.slice(0,100).forEach(d=>{
        const open=expandedDomains.has(d),sel=d===domain&&needsDomain.has(page);
        html+='<div class="tree-line tree-folder domain-node'+(sel?' domain-selected':'')+'" style="padding-left:24px">'+
          '<span class="node-icon">'+menuIcon('domain')+'</span><button class="node-label" data-domain-open="'+esc(d)+'" title="'+esc(d)+'">'+esc(d)+'</button>'+
          '<button class="tree-expand" data-expand="'+esc(d)+'" aria-label="'+(open?'折叠':'展开')+esc(d)+'"><i class="layui-icon '+(open?'layui-icon-down':'layui-icon-right')+'" aria-hidden="true"></i></button></div>';
        if(open)for(const id of ['domain','accounts','aliases','lists','domain_aliases','dkim'])html+=leaf(id,3,d,{domain:'域名常规',accounts:'邮箱账户',aliases:'邮件别名',lists:'分发列表',domain_aliases:'域名别名',dkim:'DKIM 签名'}[id]);
      });
      if(domains.length>100)html+='<div class="tree-placeholder">仅显示前 100 个域名</div>';
    }
    html+=leaf('rules',1);
    html+='<div class="tree-section-title">服务配置</div>';
    html+=folder('settings','服务器设置',1);
    if(openedGroups.settings) {
      html+=leaf('settings',2,'','常规设置');
      html+=folder('smtp','邮件协议',2);
      if(openedGroups.smtp){
        html+=leaf('smtp',3,'','SMTP');
        html+=leaf('routes',3,'','SMTP 路由');
        html+=leaf('pop3',3,'','POP3');
        html+=leaf('imap',3,'','IMAP');
        html+=leaf('ports',3,'','TCP/IP 端口');
        html+=leaf('certificates',3,'','SSL 证书');
      }
      html+=folder('spam','反垃圾邮件',2);
      if(openedGroups.spam){
        html+=leaf('antispam',3,'','常规');
        html+=leaf('greylist',3,'','灰名单设置');
        html+=leaf('greylisting_bypass',3,'','灰名单绕过 IP');
        html+=leaf('greylisting_white_addresses',3,'','灰名单白名单');
        html+=leaf('dns_blacklists',3,'','DNS 黑名单');
        html+=leaf('surbl_servers',3,'','SURBL');
        html+=leaf('whitelist_addresses',3,'','白名单');
        html+=leaf('blocked_senders',3,'','发件人黑名单');
      }
      html+=leaf('antivirus',2,'','反病毒');
      html+=leaf('logging',2,'','日志记录');
      html+=folder('advanced','高级设置',2);
      if(openedGroups.advanced)for(const [id,title] of [
        ['autoban','自动封禁'],['certificates','SSL 证书'],['ipranges','IP 范围'],
        ['incoming_relays','接收中继'],['mirror','镜像'],['performance','性能'],
        ['server_info','服务器信息'],['ssl_tls','SSL/TLS'],['scripting','脚本'],
        ['ports','TCP/IP 端口'],['cache','缓存'],['indexing','邮件索引'],
        ['messages','服务器消息'],['groups','账户组'],['directories','服务器目录'],
        ['quarantine','隔离邮件']
      ])html+=leaf(id,3,'',title);
    }
    html+='<div class="tree-section-title">维护工具</div>';
    html+=folder('tools','实用工具',1);
    if(openedGroups.tools)for(const id of ['queue','logs','backup','backup_archives','backup_settings'])html+=leaf(id,2);
    $('nav').innerHTML=html;
  }
  function tabs() {
    // 原版列表页没有跨模块选项卡；域名常规页提供少量原版风格选项卡。
    const options=page==='domain'||page==='domain_aliases'||page==='dkim'?['domain','domain_aliases','dkim']:[];
    $('contextTabs').innerHTML=options.length?'<ul class="tabbernav">'+options.map(id=>'<li'+(id===page?' class="tabberactive"':'')+'><button data-page="'+id+'">'+esc({domain:'常规',domain_aliases:'名称',dkim:'DKIM'}[id])+'</button></li>').join('')+'</ul>':'';
    $('scope').hidden=!needsDomain.has(page);
  }
  function buttons() {
    const txt=createLabels[page]||(collectionPages.has(page)?'新增':jsonEditable.has(page)?'修改配置（高级）':'');
    $('primaryAction').innerHTML=txt?'<button id="actionBtn" type="button" class="layui-btn layui-btn-normal layui-btn-sm"><i class="layui-icon '+(page==='backup'?'layui-icon-download-circle':jsonEditable.has(page)?'layui-icon-edit':'layui-icon-add-1')+'" aria-hidden="true"></i> '+txt+'</button>':'';
    if(['ports','ssl_tls'].includes(page))$('primaryAction').insertAdjacentHTML('beforeend','　<button type="button" id="reinitBtn" class="layui-btn layui-btn-primary layui-btn-sm danger-action">重载邮件服务（使端口/TLS 配置生效）</button>');
    const reinit=$('reinitBtn');if(reinit)reinit.onclick=applyNetworkSettings;
    const btn=$('actionBtn');if(btn)btn.addEventListener('click',()=>{
      if(needsDomain.has(page)&&!domain){notify('请先选择域名','error');return;}
      if(page==='domains')createDomain();else if(page==='accounts')createAccount();else if(rawCreatable.has(page))createRaw(page);else if(page==='backup')startBackup();else if(collectionPages.has(page))editCollection(page);else if(jsonEditable.has(page))editJson(page);
    });
  }
  function groupName(resource) {
    const g=navGroups.find(n=>n.items.includes(resource)||(n.domainTree&&domainPages.includes(resource)));
    return g?.title||'服务器';
  }
  async function showPage(resource) {
    if(!itemMap[resource])return;
    closeModal();
    page=resource;location.hash=resource;
    $('heading').textContent=itemMap[resource][1];
    $('crumbCurrent').textContent=itemMap[resource][1];
    $('topTitle').textContent=itemMap[resource][1];$('subtitle').textContent=groupName(resource);
    $('description').textContent=itemMap[resource][3];$('crumbGroup').textContent=groupName(resource);
    tabs();buttons();drawNav();notify('');
    $('output').innerHTML='<p>正在读取服务器信息…</p>';
    const seq=++inFlight;
    if(needsDomain.has(resource)&&!domain){$('output').innerHTML=empty('暂无域名，请先在域名管理中创建域名');return;}
    try {
      const data=await call(settingSpecs[resource]?.source||resource,'GET',needsDomain.has(resource)?{domain}:{});
      if(seq!==inFlight)return;
      connection(true);$('lastUpdate').textContent='更新于 '+new Date().toLocaleTimeString('zh-CN',{hour12:false});
      dataView(data);
    } catch(err) {
      if(seq!==inFlight)return;
      if(/无法连接|连接拒绝|超时|fetch/i.test(err.message))connection(false);
      notify(err.message,'error');$('output').innerHTML=empty('读取失败，请确认该 API 端点在当前版本可用','!')+'<div class="error-help">'+esc(err.message)+'</div>';
    }
  }
  function openModal(title,body,onSave,saveText='保存') {
    $('modalTitle').textContent=title;$('modalBody').innerHTML=body;
    $('modalError').hidden=true;$('modalError').textContent='';$('modalRoot').hidden=false;
    $('output').hidden=true;$('workspaceTools').hidden=true;$('primaryAction').hidden=true;$('headingBar').hidden=true;
    $('modalSave').textContent=saveText;$('modalSave').disabled=false;modalSubmit=onSave;
    const first=$('modalBody').querySelector('input,textarea');if(first)first.focus();
  }
  function closeModal(){ $('modalRoot').hidden=true;modalSubmit=null;$('output').hidden=false;$('workspaceTools').hidden=false;$('primaryAction').hidden=false;$('headingBar').hidden=false; }
  function formField(name,id,value='',type='text',note='') {
    return '<div class="field"><label for="'+esc(id)+'">'+esc(name)+'</label><input class="layui-input" type="'+esc(type)+'" id="'+esc(id)+'" value="'+esc(value)+'"'+(type==='password'?' autocomplete="new-password"':'')+'>'+(note?'<p class="note">'+esc(note)+'</p>':'')+'</div>';
  }
  function tick(name,id,value) {return '<div class="field"><label class="checkbox"><input type="checkbox" id="'+esc(id)+'" '+(value?'checked':'')+'>'+esc(name)+'</label></div>';}
  function input(id){return $(id).value.trim();}
  async function save(resource,method,extra,notice) {
    await call(resource,method,extra);closeModal();
    if(resource==='domains')await loadDomains();
    await showPage(page);notify(notice,'success');
  }
  function createDomain() {
    openModal('创建新域名',formField('域名','fmDomain','','text','例如 example.com')+tick('启用域名','fmActive',true)+formField('管理员邮箱（可选）','fmPostmaster'),async()=>{
      const name=input('fmDomain');
      if(!/^[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$/.test(name))throw Error('请填写有效的域名');
      await save('domains','POST',{payload:{name,active:$('fmActive').checked,postmaster:input('fmPostmaster')}},'域名创建成功');
    },'创建域名');
  }
  function createAccount() {
    openModal('创建邮箱账户','<p class="api-note">所属域名：<b>'+esc(domain)+'</b>。此处通过 hMailServer API 创建，不修改旧版邮箱创建逻辑。</p>'+formField('邮箱名称（@ 前部分）','fmLocal')+formField('邮箱密码','fmPassword','','password','至少 8 位')+formField('名字','fmFirst')+formField('姓氏','fmLast')+formField('邮箱容量限制（MB，0 为不限）','fmQuota','0','number')+tick('立即启用','fmActive',true),async()=>{
      const local=input('fmLocal'),password=$('fmPassword').value;
      if(!/^[^\s@/]+$/.test(local))throw Error('邮箱名称格式不正确');if(password.length<8)throw Error('邮箱密码至少 8 位');
      const max=Number(input('fmQuota'));if(!Number.isFinite(max)||max<0)throw Error('容量必须为非负数');
      const payload={address:local+'@'+domain,password,first_name:input('fmFirst'),last_name:input('fmLast'),max_size_mb:max,active:$('fmActive').checked};
      await save('accounts','POST',{domain,payload},'邮箱创建成功');
    },'创建邮箱');
  }
  function createRaw(resource) {
    const path={aliases:'aliases',lists:'lists',domain_aliases:'domain-aliases'}[resource];
    openModal('创建'+itemMap[resource][1],'<p class="api-note">当前版本使用服务器 API 原始 JSON 字段，避免错误映射配置项。接口：POST /api/v1/domains/'+esc(domain)+'/'+esc(path)+'</p><div class="field"><label for="fmJson">创建参数（JSON 对象）</label><textarea id="fmJson" spellcheck="false">{\n  \n}</textarea></div>',async()=>{
      let payload;try{payload=JSON.parse($('fmJson').value);}catch{throw Error('JSON 语法错误');}
      if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Error('提交内容必须是 JSON 对象');
      await save(resource,'POST',{domain,payload},'创建请求成功');
    },'提交创建');
  }
  function editJson(resource) {
    const keys=content&&typeof content==='object'&&!Array.isArray(content)?Object.keys(content).filter(k=>!/password|secret|private.?key|token/i.test(k)).slice(0,32):[];
    openModal('修改'+itemMap[resource][1],'<p class="api-note">仅填写需要更新的参数。请根据当前服务器 API 文档填写，原始英文字段名不能修改。</p>'+(keys.length?'<div class="field-reference"><strong>当前可见字段</strong><div>'+keys.map(k=>'<span>'+esc(label(k,resource))+' <code>'+esc(k)+'</code></span>').join('')+'</div></div>':'')+'<div class="field"><label for="fmJson">部分更新 JSON</label><textarea id="fmJson" spellcheck="false">{\n  \n}</textarea></div>',async()=>{
      let payload;try{payload=JSON.parse($('fmJson').value);}catch{throw Error('JSON 语法错误');}
      if(!payload||typeof payload!=='object'||Array.isArray(payload)||!Object.keys(payload).length)throw Error('至少提交一个设置字段');
      if(!confirm('确认将以上设置提交至 hMailServer 吗？'))return;
      await save(resource,'PUT',{payload},'已提交设置更新，请确认服务器实际状态');
    },'保存设置');
  }
  async function openAccount(address) {
    try {
      const data=await call('account','GET',{address});const value=data&&typeof data.account==='object'?data.account:data;
      openModal('编辑邮箱 · '+address,'<p class="api-note">只修改启用状态、姓名和容量；不会更改账户密码或执行删除。</p>'+tick('启用邮箱账户','fmActive',Boolean(value.active??true))+formField('名字','fmFirst',value.first_name??'')+formField('姓氏','fmLast',value.last_name??'')+formField('容量限制（MB）','fmQuota',value.max_size_mb??0,'number')+'<details class="readonly-details"><summary>查看原始账户详情（只读）</summary>'+detail(value)+'</details>',async()=>{
        const quota=Number(input('fmQuota'));if(!Number.isFinite(quota)||quota<0)throw Error('容量必须为非负数');
        await save('account','PUT',{address,payload:{active:$('fmActive').checked,first_name:input('fmFirst'),last_name:input('fmLast'),max_size_mb:quota}},'账户设置已更新');
      },'保存账户');
    } catch(err){notify(err.message,'error');}
  }
  async function startBackup() {
    if(!confirm('确认启动 hMailServer 原生备份吗？此操作使用当前服务器备份设置。'))return;
    try{await call('backup','POST');await showPage('backup');notify('备份启动请求已提交','success');}catch(err){notify(err.message,'error');}
  }
  async function retry(id){if(!confirm('确认重新尝试投递队列消息 #'+id+'？'))return;try{await call('queue_retry','POST',{id});await showPage('queue');notify('已提交重新投递','success');}catch(e){notify(e.message,'error');}}
  async function openLog(name){try{const data=await call('log','GET',{name,lines:200});openModal('查看日志 · '+name,'<pre class="jsonbox">'+esc(typeof data==='string'?data:JSON.stringify(data,null,2))+'</pre>',()=>closeModal(),'关闭');}catch(e){notify(e.message,'error');}}

  // 仅控制移动端导航抽屉的显示；不会修改任何管理 API 行为。
  function hideSidebar(){
    $('sidebarPane').classList.remove('sidebar-open');
    $('sidebarBackdrop').hidden=true;
    $('sidebarToggle').setAttribute('aria-expanded','false');
  }
  $('sidebarToggle').addEventListener('click',()=>{
    const open=$('sidebarPane').classList.toggle('sidebar-open');
    $('sidebarBackdrop').hidden=!open;
    $('sidebarToggle').setAttribute('aria-expanded',String(open));
  });
  $('sidebarBackdrop').addEventListener('click',hideSidebar);
  $('nav').addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button)return;
    if(button.dataset.group){openedGroups[button.dataset.group]=!openedGroups[button.dataset.group];drawNav();return;}
    if(button.dataset.expand){const d=button.dataset.expand;expandedDomains.has(d)?expandedDomains.delete(d):expandedDomains.add(d);drawNav();return;}
    if(button.dataset.domainOpen){setDomain(button.dataset.domainOpen);hideSidebar();showPage('domain');}
    else if(button.dataset.page){if(button.dataset.domain)setDomain(button.dataset.domain);hideSidebar();showPage(button.dataset.page);}

  });
  $('contextTabs').addEventListener('click',e=>{const button=e.target.closest('[data-page]');if(button)showPage(button.dataset.page);});
  // 原版左侧 dTree 没有搜索框。
  // 经典 PHPWebAdmin 无移动侧栏切换按钮。
  $('refreshBtn').onclick=()=>showPage(page);
  $('reloadDomains').onclick=async()=>{await loadDomains();showPage(page);};
  $('domainSelect').onchange=e=>{setDomain(e.target.value);showPage(page);};
  $('modalClose').onclick=$('modalCancel').onclick=closeModal;
  $('modalRoot').addEventListener('click',e=>{if(e.target===$('modalRoot'))closeModal();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
  $('modalSave').addEventListener('click',async()=>{
    if(!modalSubmit)return;const button=$('modalSave');button.disabled=true;$('modalError').hidden=true;
    try{await modalSubmit();}catch(err){$('modalError').textContent=err.message;$('modalError').hidden=false;notify(err.message,'error');}
    finally{button.disabled=false;}
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-action],[data-sort]');if(!b)return;
    if(b.dataset.sort){if(displaySettings.sort===b.dataset.sort)displaySettings.desc=!displaySettings.desc;else{displaySettings.sort=b.dataset.sort;displaySettings.desc=false;}renderTable();return;}
    switch(b.dataset.action){
      case 'domain':setDomain(b.dataset.domain);showPage('accounts');break;
      case 'remove-domain':removeDomain(b.dataset.domain);break;
      case 'edit-row':editCollection(b.dataset.collection,b.dataset.id);break;
      case 'remove-row':removeCollection(b.dataset.collection,b.dataset.id);break;
      case 'account':openAccount(b.dataset.address);break;
      case 'retry':retry(b.dataset.id);break;
      case 'log':openLog(b.dataset.name);break;
      case 'prev':displaySettings.offset=Math.max(0,displaySettings.offset-25);renderTable();break;
      case 'next':displaySettings.offset+=25;renderTable();break;
      case 'goto':showPage(b.dataset.page);break;
    }
  });
  if(!localStorage.getItem('Token'))expire();
  drawNav();
  const initial=decodeURIComponent(location.hash.slice(1));
  loadDomains().finally(()=>showPage(itemMap[initial]?initial:'status'));
  // 不做后台自动轮询，避免无人工操作时刷新管理员 Token 的10小时闲置计时。
})();
