/* ---------- Settings ----------
   Seven groups, seven forms, each one generated from the schema of that group's
   PUT: the property names, their types, their enumerated words, which one is
   write-only and which is read-only all come from the document, so nothing here
   lists a settings key by name. Save sends only the keys whose control differs
   from the value the page was drawn with, and then re-reads the group. A group
   with verbs beside it - the script reloaded or checked, the caches emptied,
   the index run or emptied - draws a button per verb, worded from the route's
   own summary, and re-reads the group after one so its counters follow. */
const SETTING_GROUPS=[
  {id:"srv",  path:"/api/v1/settings",          title:K("Server"),save:K("Save server settings"),
    verbs:[{path:"/api/v1/settings/breach-check/test",label:K("Test the breach check endpoint")}]},
  {id:"spam", path:"/api/v1/settings/antispam", title:K("Anti-spam"),save:K("Save anti-spam settings")},
  {id:"av",   path:"/api/v1/settings/antivirus", title:K("Anti-virus"),save:K("Save anti-virus settings")},
  {id:"log",  path:"/api/v1/settings/logging",  title:K("Logging"),save:K("Save logging settings")},
  {id:"script",path:"/api/v1/settings/scripting",title:K("Scripting"),save:K("Save scripting settings"),
    verbs:[{path:"/api/v1/settings/scripting/reload",label:K("Reload the script")},{path:"/api/v1/settings/scripting/check",label:K("Check the syntax")}]},
  {id:"cache",path:"/api/v1/settings/cache",    title:K("Cache"),save:K("Save cache settings"),
    verbs:[{path:"/api/v1/settings/cache/clear",label:K("Empty the caches")}]},
  {id:"index",path:"/api/v1/settings/indexing", title:K("Message indexing"),save:K("Save message indexing settings"),
    verbs:[{path:"/api/v1/settings/indexing/index",label:K("Index now")},{path:"/api/v1/settings/indexing/clear",label:K("Empty the index")}]},
  {id:"bounce",path:"/api/v1/settings/bounces", title:K("Bounces and suppression"),save:K("Save bounce settings"),
    verbs:[{path:"/api/v1/bounces/expire",label:K("Expire and prune now")}]},
  {id:"pgp",  path:"/api/v1/settings/openpgp", title:K("邮件加密（OpenPGP）"),save:K("保存邮件加密设置")},
  // Web Push: the switch, the limits, the public key (read-only, derived) and
  // the private key (write-only, for carrying an installation); the verb makes
  // a fresh pair, after which every device has to be asked again.
  {id:"push", path:"/api/v1/settings/push",    title:K("网页推送（Web Push）"),save:K("保存网页推送设置"),
    verbs:[{path:"/api/v1/settings/push/vapid",label:K("生成新的 VAPID 推送密钥对")}]},
  {id:"complaint",path:"/api/v1/settings/complaints", title:K("Complaints and feedback loops"),save:K("Save complaint settings"),
    verbs:[{path:"/api/v1/complaints/expire",label:K("Prune old complaints now")}]}
];
function verbButtonsHtml(g){
  return (g.verbs||[]).map(v=>`<button class="btn ghost" data-act="setpost" data-group="${g.id}" data-path="${escHtml(v.path)}" data-label="${escHtml(t(v.label))}" title="${escHtml(t(v.label))}">${escHtml(t(v.label))}</button>`).join("");
}
/* The saved settings the server is not running on yet: every [Settings] key
   marked reinitialize or restart whose stored value is not the running one,
   from GET /api/v1/server/settings/pending - recomputed by the server at every
   request, so a value put back is not listed. The administrator password's
   route, as the ini list is, so a role is not asked for it; a refusal or an
   older server shows no banner rather than a wrong one. Apply now reinitialises,
   which takes the reinitialize keys and ends this session with every other. */
async function pendingBannerHtml(){
  if(!administrator)return "";
  let pending=[];
  try{pending=asList(await api("/api/v1/server/settings/pending"),"pending");}catch(_){return "";}
  const reinitialize=pending.filter(p=>p.applies==="reinitialize").length;
  const restart=pending.filter(p=>p.applies==="restart").length;
  if(!reinitialize&&!restart)return "";
  const sentence=!restart?tf("{0} saved setting(s) wait for a reinitialize.",reinitialize)
    :!reinitialize?tf("{0} saved setting(s) wait for a service restart.",restart)
    :tf("{0} saved setting(s) wait for a reinitialize, and {1} for a service restart.",reinitialize,restart);
  const names=pending.map(p=>'<code>'+escHtml(p.name)+'</code> '+escHtml(p.running)+' → '+escHtml(p.stored)).join(", ");
  return `<div class="card flat" id="pendingBar" style="margin-bottom:14px">
      ${noticeHtml("warn",sentence)}
      <p class="note">${names}</p>
      ${reinitialize?`<div class="row" style="margin-top:10px"><button class="btn" data-act="applypending">${t("Apply now")}</button><div class="err" id="err_pending"></div></div>`:""}
    </div>`;
}
/* 设置表单专用中文标签：按接口分组，避免“启用/目录/处理方式”等同名字段串译。
   字段键名与原始值不改写；只改变页面显示。 */
const SETTINGS_GROUP_LABELS={"spam":{"spam_mark_threshold":"判定为垃圾邮件的评分阈值","spam_delete_threshold":"直接删除邮件的评分阈值","add_header_spam":"添加垃圾邮件标记邮件头","add_header_reason":"在邮件头中添加垃圾邮件判定原因","prepend_subject":"在主题前添加垃圾邮件标记","prepend_subject_text":"主题前缀文字","use_spf":"启用 SPF 检查","use_spf_score":"SPF 验证失败评分","use_spf_softfail_score":"SPF 软失败评分","use_spf_temperror_score":"SPF 临时错误评分","use_spf_permerror_score":"SPF 永久错误评分","spf_temperror_defer":"SPF 临时错误时延迟接收","reject_multi_rcpt_null_sender":"拒绝空发件人且有多个收件人的邮件","ban_multi_rcpt_null_sender":"封禁空发件人且有多个收件人的连接源","ban_multi_rcpt_null_sender_hours":"上述封禁持续时间（小时）","check_host_in_helo":"检查 HELO/EHLO 主机名","check_host_in_helo_score":"HELO/EHLO 主机名检查评分","check_mx_records":"检查发件域名 MX 记录","check_mx_records_score":"MX 记录检查评分","check_ptr":"检查发件服务器 PTR 反向解析","check_ptr_score":"PTR 反向解析检查评分","refuse_helo_not_fqdn":"拒绝非完整域名的 HELO/EHLO","refuse_mail_from_domain_not_fqdn":"拒绝使用非完整域名的发件人地址","surbl_too_many_domains_score":"邮件正文域名过多的评分","dkim_verification_enabled":"启用 DKIM 签名验证","dkim_verification_failure_score":"DKIM 验证失败评分","dmarc_enabled":"启用 DMARC 验证","dmarc_failure_score":"DMARC 验证失败评分","arc_filtering_enabled":"启用 ARC 邮件认证链检查","arc_trusted_sealers":"受信任的 ARC 签名者列表","spamassassin_enabled":"启用 SpamAssassin 扫描","spamassassin_host":"SpamAssassin 服务器地址","spamassassin_port":"SpamAssassin 服务端口","spamassassin_score":"SpamAssassin 结果评分","spamassassin_merge_score":"合并 SpamAssassin 评分","tarpit_count":"延迟响应触发次数","tarpit_delay":"延迟响应时间","greylisting_enabled":"启用灰名单","greylisting_initial_delay":"灰名单首次重试等待时间","greylisting_initial_delete":"灰名单初始记录保留时间","greylisting_final_delete":"灰名单通过后记录保留时间","bypass_greylisting_on_spf_success":"SPF 通过时跳过灰名单","bypass_greylisting_on_mail_from_mx":"发件域名 MX 匹配时跳过灰名单","greylisting_slide_on_early_retry":"过早重试时顺延灰名单等待期","greylisting_abuse_threshold":"灰名单异常重试次数阈值","greylisting_abuse_lock_minutes":"灰名单异常封锁时间（分钟）","maximum_message_size_kb":"反垃圾邮件扫描的最大邮件大小（KB）"},"av":{"clamav_enabled":"启用 ClamAV 防病毒扫描","clamav_host":"ClamAV 服务地址","clamav_port":"ClamAV 服务端口","clamwin_enabled":"启用 ClamWin 扫描","clamwin_executable":"ClamWin 可执行文件路径","clamwin_db_folder":"ClamWin 病毒库目录","custom_scanner_enabled":"启用自定义病毒扫描程序","custom_scanner_executable":"自定义扫描程序路径","custom_scanner_return_value":"自定义扫描程序表示检出病毒的返回码","action":"检测到病毒后的处理方式","notify_sender":"检出病毒时通知发件人","notify_receiver":"检出病毒时通知收件人","maximum_message_size_kb":"反病毒扫描的最大邮件大小（KB）","attachment_blocking_enabled":"启用附件类型拦截"},"log":{"enabled":"启用服务器日志记录","log_application":"记录应用程序日志","log_smtp":"记录 SMTP 日志","log_pop3":"记录 POP3 日志","log_imap":"记录 IMAP 日志","log_tcpip":"记录 TCP/IP 连接日志","log_debug":"记录调试日志","log_awstats":"生成 AWStats 日志","keep_files_open":"保持日志文件句柄打开","device":"日志输出设备","log_format":"日志输出格式","syslog_enabled":"启用远程 Syslog 日志","syslog_host":"Syslog 服务器地址","syslog_port":"Syslog 服务器端口","syslog_transport":"Syslog 传输协议","syslog_facility":"Syslog 设施编号","syslog_minimum_severity":"Syslog 最低记录严重级别","syslog_log_smtp":"向 Syslog 发送 SMTP 日志","syslog_log_pop3":"向 Syslog 发送 POP3 日志","syslog_log_imap":"向 Syslog 发送 IMAP 日志","syslog_log_application":"向 Syslog 发送应用日志","syslog_log_tcpip":"向 Syslog 发送 TCP/IP 日志","syslog_log_debug":"向 Syslog 发送调试日志","directory":"日志保存目录","current_default_log":"当前默认日志文件","current_error_log":"当前错误日志文件","current_event_log":"当前事件日志文件","current_awstats_log":"当前 AWStats 日志文件"},"script":{"enabled":"启用事件脚本","language":"事件脚本语言","current_script_file":"当前事件脚本文件","directory":"事件脚本目录"},"cache":{"enabled":"启用服务端缓存","domain_cache_size_kb":"当前域名缓存大小（KB）","domain_cache_max_size_kb":"域名缓存最大大小（KB）","domain_cache_ttl":"域名缓存有效期","domain_hit_rate":"域名缓存命中率（%）","account_cache_size_kb":"当前账户缓存大小（KB）","account_cache_max_size_kb":"账户缓存最大大小（KB）","account_cache_ttl":"账户缓存有效期","account_hit_rate":"账户缓存命中率（%）","alias_cache_size_kb":"当前别名缓存大小（KB）","alias_cache_max_size_kb":"别名缓存最大大小（KB）","alias_cache_ttl":"别名缓存有效期","alias_hit_rate":"别名缓存命中率（%）","distribution_list_cache_size_kb":"当前邮件列表缓存大小（KB）","distribution_list_cache_max_size_kb":"邮件列表缓存最大大小（KB）","distribution_list_cache_ttl":"邮件列表缓存有效期","distribution_list_hit_rate":"邮件列表缓存命中率（%）"},"index":{"enabled":"启用邮件索引","total_indexed_count":"已建立索引的邮件数量","total_message_count":"邮件总数量"},"bounce":{"processing_enabled":"启用退信处理","hard_bounce_threshold":"触发抑制的硬退信次数","mailbox_full_is_hard":"将邮箱已满视为硬退信","suppression_action":"退信抑制后的处理方式","suppression_expiry_days":"退信抑制记录有效期（天）","read_delivery_reports":"读取邮件投递报告","count_retention_days":"退信次数统计保留天数","report_window_days":"退信报告统计窗口（天）"},"pgp":{"web_key_directory_enabled":"启用网页公钥目录（WKD）","key_maximum_bytes":"OpenPGP 公钥最大大小（字节）","keys_per_account":"每个账户允许的 OpenPGP 密钥数量","require_address_in_user_id":"要求密钥用户 ID 包含邮箱地址","portal_enabled":"启用加密邮件门户","portal_enabled_levels":"加密邮件门户的适用层级","lookup_wkd":"允许通过 Web 密钥目录查询公钥","lookup_keyserver":"允许通过公钥服务器查询公钥","keyserver_url":"OpenPGP 公钥服务器地址","lookup_timeout":"公钥查询超时时间","protected_message_days":"加密保护邮件保留天数","zero_access_allowed":"允许零访问模式","zero_access_allowed_levels":"零访问模式适用层级"},"push":{"enabled":"启用网页消息推送","subject":"网页推送联系地址","time_to_live_seconds":"推送消息有效期（秒）","max_devices_per_account":"每个账户最多绑定设备数","max_attempts":"推送最大尝试次数","loopback_http_for_tests":"允许本机 HTTP 测试","vapid_public_key":"VAPID 公钥（只读）"},"complaint":{"processing_enabled":"启用邮件投诉处理","mailbox":"接收投诉的邮箱地址","suppression_threshold":"触发发信抑制的投诉次数","retention_days":"投诉记录保留天数"}};
const SETTINGS_GROUP_HELP={"spam":{"spam_mark_threshold":"分数达到此阈值时将邮件标记为垃圾邮件；具体分数由启用的检测规则累加。","spam_delete_threshold":"分数达到此阈值时邮件可能被删除；修改前请确认不会误删正常邮件。","prepend_subject_text":"仅在启用主题前缀选项后生效。","greylisting_initial_delay":"首次连接后等待发件方再次尝试投递的时间；单位以服务器接口定义为准。","greylisting_initial_delete":"控制首次灰名单记录的过期时间；请以服务器接口说明确认单位。","greylisting_final_delete":"控制已通过灰名单记录的过期时间；请以服务器接口说明确认单位。","maximum_message_size_kb":"超过该大小的邮件可能不接受反垃圾邮件扫描；单位为 KB。"},"av":{"action":"病毒检测命中后的处置策略；此操作可能影响邮件投递。","custom_scanner_return_value":"自定义扫描器退出时用于判定检出病毒的返回代码。","maximum_message_size_kb":"防病毒扫描处理的邮件大小上限，单位为 KB；0 的具体含义以服务器实现为准。"},"log":{"keep_files_open":"若开启，邮件服务可能持续占用日志文件句柄。","current_default_log":"当前日志文件位置，由服务端返回，通常不能直接更改。","current_error_log":"当前错误日志文件路径。","current_event_log":"当前事件日志文件路径。","current_awstats_log":"当前统计日志文件路径。"},"cache":{"domain_hit_rate":"当前缓存统计信息，由服务器计算。","account_hit_rate":"当前缓存统计信息，由服务器计算。","alias_hit_rate":"当前缓存统计信息，由服务器计算。","distribution_list_hit_rate":"当前缓存统计信息，由服务器计算。"},"pgp":{"zero_access_allowed":"控制是否允许用户启用零访问模式；更改前请确认密钥恢复和访问策略。"},"push":{"vapid_public_key":"服务器当前用于网页推送身份标识的 VAPID 公钥。"}};
/* API 枚举值继续保留英文，中文只用作下拉选项的可见名称。 */
Object.assign(SETTINGS_ENUM_ZH, {"unknown":"未指定","default":"默认","udp":"UDP（无连接）","tcp":"TCP（有连接）","tcp_tls":"TCP（TLS 加密）","file":"本地文件","syslog":"系统日志","console":"控制台","stdout":"标准输出","stderr":"标准错误","delete_email":"删除邮件","delete_message":"删除邮件","delete_attachment":"删除含病毒的附件","remove_attachment":"移除附件","refuse":"拒绝接收","reject":"拒绝接收","deliver":"正常投递","quarantine":"隔离邮件","disable":"停用","keep":"保留","discard":"丢弃","VBScript":"VBScript 脚本","javascript":"JavaScript 脚本","jscript":"JScript 脚本","notice":"提示","warning":"警告","error":"错误","info":"信息","debug":"调试","none":"无","smtp":"SMTP 邮件协议","imap":"IMAP 邮件协议","pop3":"POP3 邮件协议"});
const SETTINGS_PAGES={
  settings_server:{title:"服务器",groups:["srv"]},
  settings_spam:{title:"反垃圾邮件",groups:["spam"]},
  settings_virus:{title:"反病毒",groups:["av"]},
  settings_logging:{title:"日志记录",groups:["log"]},
  settings_other:{title:"其他设置",groups:["script","cache","index","bounce","pgp","push","complaint"]}
};
/* 简洁设置由明确的字段白名单控制，避免新增 OpenAPI 字段自动进入精简模式。 */
const SIMPLE_SETTING_KEYS={
  srv:["mirror_email_address","max_message_size_kb","auto_ban_on_logon_failure","max_invalid_logon_attempts","minutes_before_reset","minutes_to_ban"],
  spam:["spam_mark_threshold","add_header_spam","use_spf","dkim_verification_enabled","greylisting_enabled"],
  log:["enabled","log_application","log_smtp","log_imap","log_pop3"]
};
function simpleSettingProps(group,props){
  if(deckMode!=="simple")return props;
  const keys=SIMPLE_SETTING_KEYS[group]||[];
  return Object.fromEntries(keys.filter(key=>Object.prototype.hasOwnProperty.call(props,key)).map(key=>[key,props[key]]));
}
async function renderSettings(selectedView=view){
  const page=SETTINGS_PAGES[selectedView]||SETTINGS_PAGES.settings_server;
  await loadSpec();
  if(view!==selectedView)return;
  const chosen=SETTING_GROUPS.filter(group=>page.groups.includes(group.id));
  // Read only the selected subpage's groups; independent requests run in parallel.
  const [results,pendingBar]=await Promise.all([
    Promise.all(chosen.map(async g=>{
      try{
        const props=properties(g.path,"put");
        const values=await api(g.path);
        settingsState[g.id]={path:g.path,props:props,values:values};
        return {g:g,props:props,values:values,error:null};
      }catch(error){return {g:g,error:error};}
    })),
    selectedView==="settings_server"&&deckMode!=="simple"?pendingBannerHtml():Promise.resolve("")
  ]);
  if(view!==selectedView)return;
  const cards=results.map(({g,props,values,error})=>{
    if(error)return `<div class="sect"><h2>${escHtml(t(g.title))}</h2><div class="card flat">${noticeHtml("warn","读取设置失败："+String(error.message||error))}</div></div>`;
    const shownProps=simpleSettingProps(g.id,props);
    const simple=deckMode==="simple";
    const serverReadOnly=false;
    return `<div class="sect"><h2>${escHtml(t(g.title))}</h2>
      <div class="card flat">
        ${simple&&Object.keys(shownProps).length===0?'<p class="note">当前服务器未提供该分类的常用字段，可切换专业模式查看完整设置。</p>':''}
        <div class="form">${formHtml("set_"+g.id,shownProps,values,{labels:SETTINGS_GROUP_LABELS[g.id]||{},descriptions:SETTINGS_GROUP_HELP[g.id]||{}})}</div>
        <div class="row" style="margin-top:18px">
          ${serverReadOnly||simple&&!Object.keys(shownProps).length?'':`<button class="btn" data-act="setsave" data-group="${g.id}">${t(g.save)}</button>`}
          ${simple?'':verbButtonsHtml(g)}
          <div class="err" id="err_set_${g.id}"></div>
        </div>
        ${simple?'':(g.verbs||[]).map(v=>'<p class="note" style="margin-top:12px">'+escHtml(t(v.label))+'. '+escHtml(uiDocText(operation(v.path,"post").description||""))+'</p>').join("")}
      </div></div>`;
  }).join("");
  $("#content").innerHTML=`<div class="view">
    ${pendingBar}
    <div class="card flat">
      <h2>${page.title}</h2>
      <p class="note">${deckMode==="simple"?(selectedView==="settings_server"?"仅显示指定的 6 项服务器设置；修改后点击保存，只提交发生变化的字段。":"只显示常用设置项，保存时仅提交页面上已更改的字段；高级设置请切换专业模式。"):'设置项来自服务器接口定义。修改后点击对应保存按钮；只提交发生变化的字段。只读字段不能编辑，部分设置需要重启邮件服务后生效。'}</p>
      <input id="setFilter" placeholder="搜索此分类中的设置项" aria-label="搜索设置项" style="width:100%">
    </div>
    ${cards}</div>`;
  $("#setFilter").oninput=filterRows;
}
async function saveSettings(groupId){
  const st=settingsState[groupId];
  if(!st)return;
  if(deckMode==="simple"&&!(["srv","spam"].includes(groupId))){toast("请切换专业模式修改此设置");return;}
  const writableProps=simpleSettingProps(groupId,st.props);
  setErr("err_set_"+groupId,"");
  let all;
  try{all=readForm("set_"+groupId,writableProps,{});}
  catch(e){setErr("err_set_"+groupId,e.message);return;}
  const body={};
  Object.keys(all).forEach(k=>{
    if(isPassword(k,st.props[k])){body[k]=all[k];return;}
    if(all[k]!==st.values[k])body[k]=all[k];
  });
  if(!Object.keys(body).length){toast(t("Nothing changed"));return;}
  try{
    await api(st.path,{method:"PUT",body:JSON.stringify(body)});
    const n=Object.keys(body).length;
    toast(n===1?tf("{0} setting saved",n):tf("{0} settings saved",n));
    // The view that holds the group reads it back: Settings for its seven,
    // Backup for its own.
    await render();
  }catch(e){
    if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    setErr("err_set_"+groupId,e.message);
  }
}
/* A verb beside a group: POSTed, and what it answers shown - the syntax
   check's result is the parser's message, or nothing when the script parses;
   the others answer a flag and the group is read again so its counters follow. */
async function settingsPost(groupId,path,label){
  setErr("err_set_"+groupId,"");
  try{
    const answer=await api(path,{method:"POST"});
    // The breach check's endpoint test answers whether the endpoint could be
    // used, and what it said about itself; nothing in the group changed.
    if(answer&&answer.reachable!==undefined){
      if(!answer.reachable){setErr("err_set_"+groupId,tf("The endpoint could not be used: {0}",String(answer.error||("HTTP "+answer.status))));return;}
      toast(answer.padded?tf("The endpoint answered with {0} entries, padded.",answer.entries):tf("The endpoint answered with {0} entries, not padded.",answer.entries));
      return;
    }
    if(answer&&answer.result!==undefined){
      if(answer.result){setErr("err_set_"+groupId,String(answer.result));return;}
      toast(t("The script parses."));return;
    }
    toast(tf("{0}: done",label));
    await render();
  }catch(e){
    if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    setErr("err_set_"+groupId,e.message);
  }
}

