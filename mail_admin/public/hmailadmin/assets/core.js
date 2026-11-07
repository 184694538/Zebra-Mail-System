
"use strict";
window.__HMAILADMIN_BUILD="20261106-simple-v2";
/* ---------- Trusted Types ----------
   The page is served with require-trusted-types-for 'script' and
   trusted-types default (HandleWebAdminPage_ in RestApiServer.cpp). In a
   browser that has Trusted Types, every string the script hands to an HTML
   sink - each view's innerHTML - passes through this one function first; no
   other policy can be made; and a string meant as script, or as a script's
   address, has no policy at all and is refused. The views build their markup
   from values put through escHtml, which this lets through as it is. What it
   refuses is markup the Deck never builds: a script, a style or link
   element, a meta refresh, a base, a frame, an object or embed, a form, and
   the elements that parse differently or animate attributes. Such markup can
   only come from a value that reached a view unescaped, and that view is
   then not drawn at all. Script is already refused by the hash in
   script-src; this refuses what an escaping slip could still do without
   script - send the tab elsewhere, restyle the page, post a form, look up a
   name for another site. build/check-deck-script.py holds the views to
   building none of these elements. */
(function(){
  if(!window.trustedTypes||!trustedTypes.createPolicy)return;
  const NEVER=/<\/?(?:script|style|link|meta|base|iframe|frame|frameset|object|embed|applet|form|portal|template|noscript|xmp|plaintext|noembed|noframes|math|foreignobject|animate|animatemotion|animatetransform|set|use)(?=[\s\/>]|$)/i;
  trustedTypes.createPolicy("default",{createHTML:html=>{
    html=String(html);
    if(NEVER.test(html))throw new TypeError("The Deck refused markup it never builds: a value reached a view unescaped.");
    return html;
  }});
})();
const $=s=>document.querySelector(s);
let view="dash", pollTimer=null, dashPollPending=false, firstDashboardStatus=null;
/* 精简模式是界面配置而非权限控制；服务器端权限检查照常执行。 */
const DECK_SIMPLE_VIEWS=new Set(["dash","queue","dns","ipranges","logs","certs","ports","settings_server","settings_spam"]);
// 每次进入 hmailadmin 都从精简模式开始，不使用浏览器历史模式设置。
// 专业模式仅在当前页面有效，刷新或再次打开后自动恢复精简模式。
let deckMode="simple";
try{localStorage.removeItem("mailAdminControlDeckMode");}catch(_){}
function deckApplyMode(){
  document.body.dataset.deckMode=deckMode;
  document.documentElement.dataset.deckMode=deckMode;
  const simple=document.getElementById("deckSimpleMode"),pro=document.getElementById("deckProMode");
  if(simple){simple.classList.toggle("is-active",deckMode==="simple");simple.setAttribute("aria-pressed",String(deckMode==="simple"));}
  if(pro){pro.classList.toggle("is-active",deckMode==="pro");pro.setAttribute("aria-pressed",String(deckMode==="pro"));}
  const risk=document.getElementById("deckRiskBanner");
  if(risk)risk.hidden=false; // 两种模式均显示风险提示
}
async function deckSetMode(next){
  if(next===deckMode)return;
  if(next==="pro"){
    const confirmed=await deckConfirm("专业模式包含高级邮件服务器配置，误操作可能影响邮件收发。确定进入专业模式吗？");
    if(!confirmed||next===deckMode)return;
  }
  deckMode=next;
  deckApplyMode();
  applyPermissions();
  if(deckMode==="simple"){
    const first=document.querySelector("#nav button[data-view]:not([hidden])");
    if(first&&!viewShown(view))view=first.dataset.view;
  }
  if(deckBootReady&&view)render();
}
document.getElementById("deckSimpleMode")?.addEventListener("click",()=>deckSetMode("simple"));
document.getElementById("deckProMode")?.addEventListener("click",()=>deckSetMode("pro"));
deckApplyMode();

/* The discovery case on screen, its name and its re-read timer: declared here,
   with the view, because the navigation and a sign-out put them back. */
let discoveryCase=0,discoveryName="",discoveryTimer=null;
/* What the view on screen asks of the server when the search box changes,
   beyond the rows filterRows narrows: the quarantine's search of every held
   message, which drawQuarantine sets. Every render clears it, so that no other
   view's box asks anything. A hook rather than a test of the view in
   filterRows, since the Deck parity census reads view==="x") f() as the view's
   own render function. */
let searchHook=null;

/* ---------- Fixed Simplified Chinese ----------
   Always use zh-Hans, regardless of browser language or previous selection.
   Embed the shipped, validated catalogue to avoid another network request at
   startup and to keep the UI Chinese even if static language files are slow. */
const language="zh-Hans";
const catalogue={"(choose a route)":"（选择路由）","(empty)":"（空）","(no archives in the backup destination)":"(备份目标中没有存档)","(no domain)":"（无域）","(no subject)":"（无主题）","(no user name)":"（无用户名）","(none)":"（无）","(the backup log is empty)":"（备份日志为空）","1 message":"1 封邮件","1 message cannot be listed and will be left where it is: {0}":"1 封邮件无法列入名单，将保留原状：{0}","1 message held.":"已暂挂 1 封邮件。","A DMARC record":"一条 DMARC 记录","A JPEG, a PNG or a GIF, up to 100 KB. What is kept is judged by the bytes, not by the file's name.":"JPEG、PNG 或 GIF，不超过 100 KB。是否保留由字节内容判断，而不是文件名。","A backup destination":"一个备份目标","A bounce":"退信","A counter: each point is the change since the sample before it.":"计数器：每个点是自上一样本以来的变化量。","A delivery report":"投递报告","A destination that answered a slow-down reply - a 421, a rate-limit code or words to that effect - is not connected to until its window ends; then one delivery probes it, and the same answer doubles the window. Resume clears the window now.":"对于以减速回复（421、限速代码或类似措辞）作答的目标，在其窗口结束前不再连接；之后由一次投递进行探测，若得到同样的回复则窗口加倍。“恢复”会立即清除该窗口。","A directory photo is a JPEG, a PNG or a GIF.":"通讯录照片必须是 JPEG、PNG 或 GIF。","A domain":"一个域","A domain hosted here":"在此托管的域","A domain name is required.":"需要域名。","A domain named {0} is on this server and the sample did not make it, so nothing here creates it or removes it. Delete that domain yourself if it is not wanted.":"此服务器上存在名为 {0} 的域，而它不是样例创建的，因此这里既不会创建它，也不会删除它。如果不需要，请自行删除该域。","A domain or an account address is required.":"需要一个域或一个账户地址。","A domain such as example.com, matched exactly; or a suffix such as .mail.example.com, which covers that name and every name under it.":"如 example.com 的域名（精确匹配）；或如 .mail.example.com 的后缀（覆盖该名称及其下的所有名称）。","A domain to send to":"要发送到的域","A domain, or an account address":"域或账户地址","A field kept in the server's settings store carries one of three marks instead, the server's own for its key: {0} - the save is in effect when it returns; {1} - it waits for a reinitialize, which Apply now above does when one waits; {2} - it waits for the service to be restarted.":"保存在服务器设置存储中的字段改为带有三种标记之一，由服务器为其键给出：{0} - 保存返回时即生效；{1} - 等待重新初始化，有等待项时上方的“立即应用”会执行；{2} - 等待服务重启。","A file-name pattern, such as *.exe.":"文件名模式，例如 *.exe。","A gauge: each point is the value as it was.":"仪表：每个点是当时的值。","A group":"一个组","A group name is required.":"需要组名。","A hint for the passphrase (optional)":"密码短语的提示（可选）","A key is required.":"需要一个密钥。","A key marked {0} is set by this server's environment, which stores it again at every start: it is shown and not sent. Change the variable and restart to change it.":"标记为 {0} 的键由此服务器的环境设置，每次启动时都会重新保存：它只显示、不发送。要更改它，请更改变量并重新启动。","A list address is required.":"需要列表地址。","A listed recipient is delivered, and only recorded.":"列表中的收件人照常投递，仅作记录。","A listed recipient is dropped without a report.":"列表中的收件人被丢弃，不发报告。","A listed recipient is refused, with the reason.":"列表中的收件人被拒绝，并说明原因。","A listener wants a certificate and STARTTLS, so that no password crosses the network in the clear.":"侦听器需要证书和 STARTTLS，这样就不会有密码以明文形式经过网络。","A mail client signs in with a password, and from any address but this computer's the password should cross the network only inside TLS.":"邮件客户端使用密码登录；从本计算机以外的任何地址，密码都应只在 TLS 内穿过网络。","A message with an attachment of a submitted type waits here - in no mailbox and not in the quarantine - until the sandbox has answered for each file: clean is delivered, malicious is quarantined. Release delivers it now without the verdict; Discard deletes it and tells nobody.":"附件属于提交类型的邮件会在这里等待，既不进入任何邮箱，也不进入隔离区，直到沙箱对每个文件都作出答复：干净的会被投递，恶意的会被隔离。放行会立即投递而不等判定；丢弃会删除它且不通知任何人。","A name for the external account.":"外部帐户的名称。","A name for the range.":"范围的名称。","A name for the relay.":"中继的名称。","A name is required.":"需要名称。","A new address is required.":"需要新地址。","A new key was generated and staged. Publish its record.":"已生成并准备好新密钥。请发布它的记录。","A new passphrase, 12 characters or more":"新的密码短语，至少 12 个字符","A new password for the account":"账户的新密码","A new password goes through the password policy, the reuse history, the breach check and the configured hash exactly as when the Control Panel sets one, and the next logon uses it.":"新密码会像在 Control Panel 中设置时一样，经过密码策略、重用历史记录、泄露检查和所配置的哈希算法，下次登录即使用新密码。","A newer release is available":"有更新的版本可用","A note.":"备注。","A one-time code is needed. Enter the code from your authenticator app.":"需要一次性验证码。请输入身份验证器应用中显示的验证码。","A passkey signs the administrator in with this device - its fingerprint reader, its face or its PIN - instead of the administrator password. The key stays on the device and never reaches this server.":"通行密钥用这台设备（指纹、面容或 PIN）让管理员登录，而不是管理员密码。密钥留在设备上，永远不会传到本服务器。","A person":"个人","A person, a room or a piece of equipment. A room or a piece of equipment answers the invitations it is sent by its booking policy, and cannot be signed into.":"个人、会议室或设备。会议室或设备按其预订策略答复收到的邀请，且无法登录。","A piece of equipment":"设备","A profile for this server":"此服务器的配置方案","A profile sets the thirty or so settings one kind of server needs - which, to what and why - shows the difference from this server before anything changes, and keeps what it replaces so that it can be put back.":"配置方案会设置某类服务器所需的约三十项设置——设置哪些、设为何值、为何如此——在任何更改之前显示与此服务器的差异，并保留它所替换的值以便恢复。","A query that finds the rest of the members among the server's accounts each time a message is sent to the list, in union with the addresses above: empty for a list whose members are its addresses alone, domain for every account of this domain, domain:other.example for another domain this server hosts, pattern:sales-*@example.com for the addresses matching a wildcard, everyone for every account on the server.":"每当有邮件发往该列表时，用来在服务器的账户中找出其余成员的查询，与上面的地址取并集：留空表示成员只有上面的地址，domain 表示本域的每个账户，domain:other.example 表示本服务器托管的另一个域，pattern:sales-*@example.com 表示与通配符匹配的地址，everyone 表示服务器上的每个账户。","A recovery key is kept: {0}, sealing {1} accounts' keys.":"已保存一个恢复密钥：{0}，有 {1} 个账户的密钥封存于它。","A room":"会议室","A room or a piece of equipment answers the invitations it is sent by this policy, as they are delivered: it accepts one that fits and declines one that does not, saying why. It cannot be signed into; its delegates answer for it from its calendar.":"会议室或设备在邀请送达时按此策略答复：接受符合条件的邀请，拒绝不符合条件的邀请并说明原因。它无法登录；由其代理人从其日历代为答复。","A sample domain to learn on":"用于学习的样例域","A schedule holds a new outbound address to a daily ceiling of recipients at each large provider, rising day by day. The queue sends up to the ceiling and holds the rest: once the day's ceiling is reached, usually until the next UTC day; while deliveries in progress hold the room, a few minutes. The log says when each is tried again. The counts are today's.":"计划将新的发信地址在每个大型服务商处限制在每日收件人上限内，上限逐日提高。队列发送到上限为止，其余的暂缓：当天上限已满时，通常到下一个 UTC 日；正在进行的投递占着名额时，暂缓几分钟。每封何时重试见日志。计数为今天的。","A second factor for the administrator":"管理员的第二因素","A trap address is required.":"需要填写陷阱地址。","A way back from a profile is held and cannot be read, so it cannot be put back. Discard it to apply a profile; the audit trail names each value the profile replaced.":"已保留某个配置方案的恢复记录，但无法读取，因此无法恢复。请放弃它以应用配置方案；审计记录列出了该方案替换的每个值。","AND":"并且","API keys":"API 密钥","Abort on messages marked as spam":"对标记为垃圾邮件的邮件中止","Abuse":"滥用","Access control: which addresses may connect and what they are allowed to do. Higher priority wins when ranges overlap.":"访问控制：哪些地址可以连接，以及允许它们做什么。范围重叠时优先级高者胜出。","Account":"帐户","Account address":"帐户地址","Account address or group name":"账户地址或组名","Account created: {0}":"已创建帐户：{0}","Account enabled: it receives mail and can sign in.":"启用帐户：可以接收邮件并登录。","Account saved":"已保存帐户","Account {0}":"帐户 {0}","Accounts ›":"帐户 ›","Accounts: {0}.":"账户：{0} 个。","Action":"操作","Action needed":"需要处理","Active":"已启用","Active domains: {0} of {1}.":"活动的域：{1} 个中的 {0} 个。","Add a DNS blacklist":"添加 DNS 黑名单","Add a SURBL server":"添加 SURBL 服务器","Add a blocked attachment":"添加阻止的附件","Add a blocked sender":"添加阻止的发件人","Add a certificate":"添加证书","Add a domain":"添加域","Add a greylisting bypass entry":"添加灰名单绕过条目","Add a greylisting white address":"添加灰名单白名单地址","Add a name":"添加名称","Add a passkey":"添加通行密钥","Add a policy":"添加策略","Add a port":"添加端口","Add a range":"添加范围","Add a route":"添加路由","Add a rule":"添加规则","Add a schedule":"添加计划","Add a signature to outgoing messages.":"为发出的邮件添加签名。","Add a subscription":"添加订阅","Add a trap":"添加陷阱","Add a white-list address":"添加白名单地址","Add account":"添加帐户","Add action":"添加动作","Add an entry":"添加条目","Add an external account":"添加外部帐户","Add an inbound webhook":"添加入站 Webhook","Add an incoming relay":"添加传入中继","Add certificate":"添加证书","Add criterion":"添加条件","Add jobs":"添加任务","Add name":"添加名称","Add the jobs":"添加这些任务","Add the signature to local e-mail.":"也为本地邮件添加签名。","Add the signature to replies.":"也为回复添加签名。","Add to the list":"添加到名单","Added":"添加时间","Added to the end of every message the list sends.":"会添加到列表发送的每封邮件末尾。","Added to the suppression list: {0}":"已添加到抑制列表：{0}","Adding one asks for the administrator password again, so a session somebody else is holding cannot add a way in that outlives it.":"添加时会再次要求管理员密码，这样别人手里的会话就无法添加一个比它存在更久的入口。","Address":"地址","Address or domain to hold":"要保留的地址或域","Address to check":"要检查的地址","Administrator's note":"管理员备注","After a restart":"重启后生效","After reinitialize":"重新初始化后生效","Alias":"别名","Alias created: {0}":"已创建别名：{0}","Alias deleted: {0}":"已删除别名：{0}","Aliases ›":"别名 ›","All documentation":"全部文档","All domains":"所有域","All of the mailboxes sign in with the password {0}. It is shown here once - write it down, because this server did not keep it.":"所有邮箱都使用密码 {0} 登录。它在此处只显示一次，请记下来，因为本服务器并未保存它。","Allow IMAP connections.":"允许 IMAP 连接。","Allow POP3 connections.":"允许 POP3 连接。","Allow SMTP connections from the range.":"允许来自此范围的 SMTP 连接。","Allow and block list":"允许与拦截名单","Allow overlapping bookings":"允许重叠的预订","Allow recurring meetings":"允许定期会议","Allowed":"允许","Allowed from":"允许来源","Allowed from (addresses or CIDR, optional)":"允许来源（地址或 CIDR，可选）","Also deliver to a recipient found in the headers when a route covers its domain.":"当某条路由覆盖其域时，也向标头中找到的收件人投递。","Also disable the app password the client used":"同时停用该客户端使用的应用密码","An SPF record":"一条 SPF 记录","An account":"一个账户","An account address is required.":"需要帐户地址。","An account is a mailbox in a domain: the address people write to, and what a client signs in as.":"账户是域中的邮箱：人们写信的地址，也是客户端登录时使用的身份。","An account's review state":"账户的审查状态","An address and a new password are required.":"需要地址和新密码。","An address and a password are required.":"需要地址和密码。","An address in this domain that nobody uses":"本域中无人使用的地址","An address is required.":"需要地址。","An address or a domain":"地址或域名","An address or a domain is required.":"需要地址或域名。","An address, a domain that covers its subdomains, or a URL such as https://host/anything, which covers links to that host.":"一个地址、一个涵盖其子域的域，或形如 https://host/anything 的 URL，它涵盖指向该主机的链接。","An address, or a pattern such as 192.168.* or 2001:db8:*.":"一个地址，或形如 192.168.* 或 2001:db8:* 的模式。","An administrator":"管理员","An administrator's install is being prepared at the server":"正在服务器上准备由管理员进行的安装","An alias address and the address it delivers to are required.":"需要别名地址和投递目标地址。","An alias has no update on the API: to change one, delete it and make it again.":"别名在 API 上没有更新操作：要修改别名，请删除后重新创建。","An encrypted archive is encrypted as it is written, file names included, and the passphrase is kept nowhere but in this server's own settings - never in the archive and never beside it. A restore asks for it. If it is lost, nothing in an archive written with it can be recovered, by anybody.":"加密的存档在写入时就已加密，文件名也在内，口令只保存在本服务器自己的设置中，既不在存档里，也不在存档旁边。还原时会要求输入口令。一旦丢失，用它写成的存档里的任何内容，任何人都无法恢复。","An outbound address is required.":"必须填写发信地址。","And this is the server's own verdict on what you have built. It is the page to come back to.":"这是服务器对您所搭建的一切给出的判断。这是值得常回来看的页面。","Another name for this domain":"此域的其他名称","Answer":"应答","Answer invitations by this policy":"按此策略答复邀请","Answer only senders whose address belongs to this server; with the domain's external override on, strangers still get the domain's text.":"只答复地址属于本服务器的发件人；域的外部覆盖开启时，陌生人仍会收到域的正文。","Anti-spam":"反垃圾邮件","Anti-spam white list":"反垃圾邮件白名单","Anti-virus":"反病毒","Any domain":"任何域","Any one criterion matches":"任一条件匹配","Anyone":"任何人","Append the legal footer below to mail this domain sends outside the organisation. Never to a signed or encrypted message, an automatic reply, a bounce or a list posting, and never twice on a reply chain.":"把下面的法律页脚附加到此域发往组织外部的邮件上。绝不会附加到已签名或已加密的邮件、自动回复、退信或邮件列表投稿上，也绝不会在回复链中出现两次。","Applies on save":"保存即生效","Apply now":"立即应用","Apply the server's spam filtering to this account.":"对此帐户应用服务器的垃圾邮件过滤。","Apply the {0} profile? {1} settings change, and what they held is kept so that they can be put back.":"应用 {0} 配置方案？将更改 {1} 项设置，原有的值会被保留以便恢复。","Apply this profile":"应用此配置方案","Approve":"批准","Approved: {0}":"已批准：{0}","Archive":"存档","Archive and holds":"归档与保留","Arrived":"送达时间","Arrived from {0}":"来自 {0}","Arriving":"收到的","At most":"最多","Attachment name contains":"附件名称包含","Attachment type, such as application/pdf":"附件类型，例如 application/pdf","Attempts":"尝试次数","Audit trail":"审计记录","Authentication":"身份验证","Authentication failed. Check the password.":"身份验证失败。请检查密码。","Auto-reply":"自动回复","AutoBanFirewall is on, but {0} cannot write Windows Defender Firewall rules: banned addresses are refused by the server and not blocked in the firewall. Run the service as LocalSystem, or reach a firewall through AutoBanCommand.":"AutoBanFirewall 已开启，但 {0} 无法写入 Windows Defender Firewall 规则：被封禁的地址由服务器拒绝，但不会在防火墙中被阻止。请以 LocalSystem 运行服务，或通过 AutoBanCommand 操作防火墙。","Available version":"可用版本","Awaiting its owner's sign-in":"等待所有者登录","Back":"上一步","Back-off cleared":"已清除等待","Backup":"备份","Backup started":"已开始备份","Backups from now on are not encrypted":"从现在起备份不再加密","Backups go to {0}.":"备份保存到 {0}。","Blacklist and delete":"加入黑名单并删除","Blacklist the checked messages' senders, then delete":"将已勾选邮件的发件人加入黑名单，然后删除","Blacklist the sender, then delete":"将发件人加入黑名单，然后删除","Blacklist this group's senders, then delete":"将此组的发件人加入黑名单，然后删除","Blacklisted. List entries: {0}. Messages deleted: {1}.":"已加入黑名单。名单条目数：{0}。已删除邮件数：{1}。","Block":"拦截","Blocked":"已拦截","Blocked attachment deleted":"已删除阻止的附件","Blocked attachment saved":"已保存阻止的附件","Blocked attachments":"阻止的附件","Blocked sender deleted":"已删除阻止的发件人","Blocked sender saved":"已保存阻止的发件人","Blocked senders":"阻止的发件人","Body":"正文","Booking policy":"预订策略","Booking policy saved":"预订策略已保存","Booking window, in days ahead":"可预订期限（提前天数）","Both the domain's recovery passphrase and a new password are needed.":"需要域的恢复密码短语和新密码两者。","Both ways":"双向","Bounce address (empty = bounces go to the poster).":"退信地址（留空时退信发给投递者）。","Bounce counts":"退信计数","Bounce processing is off, so no bounce is classified or counted - but the entries below ARE still applied, because complaint processing is on and the feedback loops fill this same list. Settings has both switches.":"退信处理已关闭，因此不会对退信进行分类或计数，但下面的条目仍然生效，因为投诉处理已开启，反馈环写入的是同一个列表。两个开关都在设置中。","Bounce processing is off: nothing is counted, listed or refused, and the entries below are not applied. Settings has the switch.":"退信处理已关闭：不计数、不加入列表、不拒绝，下面的条目也不会生效。开关在设置中。","Bounced":"已退回","Bounces and suppression":"退信与抑制列表","Bounces reset: {0}":"退信已重置：{0}","Bucket":"间隔","Built in":"内置","Busiest hour":"最繁忙的小时","By country, since the server started":"按国家/地区统计，自服务器启动以来","Bytes":"字节","CSV":"CSV","CSV file":"CSV 文件","Cache":"缓存","Calendars":"日历","Cancel":"取消","Cancel the job":"取消任务","Cancel the next key":"取消下一个密钥","Cancel the next key of {0}? Signing does not change.":"要取消 {0} 的下一个密钥吗？签名不会改变。","Cancel this job? What it copied stays.":"取消此任务?已复制的内容会保留。","Cannot tell":"无法判断","Capacity, in people (0 if not said)":"容纳人数（0 表示未说明）","Case name":"案件名称","Certificate":"证书","Certificate added":"已添加证书","Certificate deleted":"已删除证书","Certificate file":"证书文件","Certificate {0} revoked":"已吊销证书 {0}","Certificates":"证书","Certificates a listener can present are kept here, and ACME can renew them for you.":"侦听器可以出示的证书保存在这里，ACME 还能替您续期。","Cessation of operation":"停止运营","Change the permission":"更改权限","Changed from stock":"与出厂设置的差异","Channel":"渠道","Check DNS now":"立即检查 DNS","Check again":"再次检查","Check an address":"检查地址","Check every message":"勾选所有邮件","Check every message from {0}":"勾选来自 {0} 的所有邮件","Check now":"立即检查","Check the messages first: the header's icons act on every checked message.":"请先勾选邮件：标题行的图标会作用于每一封已勾选的邮件。","Check the syntax":"检查语法","Check this message":"勾选此邮件","Check this password against Windows (Active Directory, or a local Windows account).":"用 Windows（Active Directory 或本地 Windows 帐户）校验此密码。","Checked {0}":"检查于 {0}","Checked {0} address(es) against {1} list(s)":"已针对 {1} 个列表检查 {0} 个地址","Checklist":"检查清单","Choose a domain that has accounts.":"请选择一个有帐户的域。","Choose an archive from the backup destination.":"请从备份目标中选择一个存档。","Choose what to look for and press Search.":"选择要查找的内容，然后按搜索。","Choose what to restore: the settings, the domains, or the messages with them.":"请选择要还原的内容：设置、域，或者与域一起还原的邮件。","Clear the record":"清空记录","Clear the record of every spam trap hit? The bans and the blocked senders they made stay.":"要清空所有垃圾邮件陷阱命中的记录吗？由此产生的封禁和被拦截的发件人仍然保留。","Clear the recovery address":"清除恢复地址","Clear the recovery codes":"清除恢复代码","Clear the search to see them first, or go on and act on all of them.":"请先清除搜索以查看它们，或继续并对全部邮件执行。","Client":"客户端","Client certificate":"客户端证书","Client certificate policy":"客户端证书验证策略","Client certificate CA file":"客户端证书 CA 证书文件","Client networks seen":"已见的客户端网络","Close":"关闭","Close the SMTP, IMAP, POP3 and ManageSieve listeners and pause delivery? The sessions and deliveries in flight finish; the Deck, the webmail and the DAV services stay up. Resume reopens the listeners.":"关闭 SMTP、IMAP、POP3 和 ManageSieve 监听器并暂停投递？进行中的会话和投递会完成；Deck、网页邮箱和 DAV 服务保持可用。“恢复”会重新开启监听器。","Close the case":"结案","Close the help":"关闭帮助","Close this list, or leave the search box":"关闭此列表，或离开搜索框","Close {0}? Every hold it placed is released, and it runs no search, places no hold and makes no export again.":"关闭 {0}？它设置的每项保留都会解除，此后不再运行搜索、设置保留或进行导出。","Closed":"已结案","Closes a listener":"关闭一个侦听器","Collect from this mailbox on the schedule.":"按计划从此邮箱收取邮件。","Collect now":"立即收取","Collection queued":"已排队收取","Complaints and feedback loops":"投诉与反馈环","Complaints are not being read: nothing is recorded, counted or listed. Settings has the switch.":"未读取投诉：不记录、不计数、不加入列表。开关在设置中。","Complaints ›":"投诉 ›","Connect":"连接","Connected":"已连接","Connecting address":"连接地址","Connection problem":"连接问题","Connection security and port go together: SSL/TLS on 995 (POP3) or 993 (IMAP), STARTTLS on 110 or 143.":"连接的安全方式与端口是配套的：SSL/TLS 用 995（POP3）或 993（IMAP），STARTTLS 用 110 或 143。","Connections":"连接","Connections in use when the page was drawn":"绘制页面时使用中的连接","Consulted for the next message.":"从下一封邮件起生效。","Contacts":"联系人","Copied":"已复制","Copied to clipboard":"已复制到剪贴板","Copy":"复制","Copy all":"全部复制","Copy it now: the server keeps only a hash, and it is not shown again.":"请立即复制：服务器只保留哈希值，不会再次显示。","Copy the key":"复制密钥","Copy the value":"复制值","Could not follow session {0}: {1}":"无法跟踪会话 {0}：{1}","Could not reach the server.":"无法连接到服务器。","Could not reach the server: {0}":"无法连接到服务器：{0}","Could not read {0}: {1}":"无法读取 {0}：{1}","Could not search every held message on the server, so the search looks at the most recent only: {0}":"无法搜索服务器上的所有暂挂邮件，因此搜索只查看最近的邮件：{0}","Count":"数量","Country":"国家/地区","Country blocking":"国家/地区屏蔽","Country refusals":"按国家/地区拒绝数","Covers":"覆盖期间","Create account":"创建帐户","Create alias":"创建别名","Create an S/MIME authority":"创建 S/MIME 证书颁发机构","Create domain":"创建域","Create group":"创建组","Create list":"创建列表","Create the migration":"创建迁移","Created":"创建时间","Created {0}":"创建于 {0}","Credential":"凭据","Current key":"当前密钥","Custodians":"保管人","Custodians: addresses or domains, comma-separated, or *":"保管人：以逗号分隔的地址或域，或 *","DANE / TLSA":"DANE / TLSA","DKIM":"DKIM","DKIM aligned":"DKIM 对齐","DKIM key rotation":"DKIM 密钥轮换","DKIM signing":"DKIM 签名","DKIM signs outgoing mail so receivers can verify it left this domain unchanged; the public key has to be published in DNS.":"DKIM 为外发邮件签名，让收件方能验证邮件从此域发出且未被改动；公钥必须发布到 DNS。","DMARC tells receivers what to do with mail that fails SPF and DKIM, and where to report it.":"DMARC 告诉收件方如何处理未通过 SPF 和 DKIM 的邮件，以及向哪里报告。","DMARC ›":"DMARC ›","DNS blacklist deleted":"已删除 DNS 黑名单","DNS blacklist saved":"已保存 DNS 黑名单","DNS blacklists":"DNS 黑名单","DNS records":"DNS 记录","Dashboard":"仪表板","Day":"日期","Day 1":"第 1 天","Day {0} of {1}":"第 {0} 天，共 {1} 天","Days after which the same sender is answered again while the reply stays on; 0 answers each sender once per absence.":"在回复保持开启期间，再次答复同一发件人前经过的天数；0 表示每次外出对每个发件人只答复一次。","Days between rotations, 1 to 3650.":"两次轮换之间的天数，1 到 3650。","Days the archive keeps a message; 0 keeps it for ever.":"存档保留邮件的天数；0 表示永久保留。","Days the old selector stays published after the switch, for mail still on its way, 1 to 365.":"切换后旧选择器保持发布的天数，供仍在途中的邮件使用，1 到 365。","Days to keep a message on the remote server; 0 keeps every message, -1 deletes it after the download.":"在远程服务器上保留邮件的天数。0 表示保留所有邮件，-1 表示下载后删除。","Days until the entry stops applying; 0 keeps it until it is removed.":"条目失效前的天数；0 表示保留到被移除为止。","Default":"默认","Deferred":"已延迟","Delegates: addresses and group names, one to a line. They see this calendar and answer the invitations it does not answer by itself.":"代理人：地址和组名，每行一个。他们可查看此日历，并代为答复它不会自动答复的邀请。","Delete":"删除","Delete account":"删除帐户","Delete domain":"删除域","Delete list":"删除列表","Delete messages in this domain's mailboxes older than this many days; 0 is no policy, and an account's own value overrides it.":"删除此域各邮箱中早于该天数的邮件。0 表示没有策略，帐户自身的值优先。","Delete messages older than this many days; -1 keeps forever, 0 follows the domain.":"删除早于该天数的邮件。-1 表示永久保留，0 表示遵循域的设置。","Delete quarantined message":"删除已隔离的邮件","Delete the DNS blacklist {0}?":"要删除 DNS 黑名单 {0} 吗？","Delete the IP range {0}?":"要删除 IP 范围 {0} 吗？","Delete the SURBL server {0}?":"要删除 SURBL 服务器 {0} 吗？","Delete the alias {0}?":"要删除别名 {0} 吗？","Delete the blocked attachment {0}?":"要删除阻止的附件 {0} 吗？","Delete the blocked sender {0}?":"要删除阻止的发件人 {0} 吗？","Delete the certificate “{0}”?":"要删除证书“{0}”吗？","Delete the checked messages":"删除已勾选的邮件","Delete the distribution list {0}?":"要删除邮件列表 {0} 吗？","Delete the domain list entry {0}?":"删除域列表条目 {0}？","Delete the domain {0} with every account, alias and list in it? Their messages go with them.":"要删除域 {0} 及其中的所有帐户、别名和列表吗？它们的邮件也会一并删除。","Delete the external account {0}? Mail already collected stays.":"要删除外部帐户 {0} 吗？已经收取的邮件会保留。","Delete the greylisting bypass entry {0}?":"删除灰名单绕过条目 {0}？","Delete the greylisting white address {0}?":"要删除灰名单白名单地址 {0} 吗？","Delete the group {0}? The accounts stay; the group, the rows that put accounts in it and every folder permission that names it go together.":"要删除组 {0} 吗？帐户会保留；该组、它的成员行以及每一条指名它的文件夹权限都会一并删除。","Delete the incoming relay {0}?":"要删除传入中继 {0} 吗？","Delete the list entry {0}?":"删除名单条目 {0}?","Delete the listener {0}?":"要删除侦听器 {0} 吗？","Delete the migration {0}? What it copied stays.":"删除迁移 {0}?已复制的内容会保留。","Delete the never-ban name {0}?":"要删除永不封禁名称 {0} 吗？","Delete the remote domain policy for {0}?":"删除远程域 {0} 的策略？","Delete the role {0}?":"要删除角色 {0} 吗？","Delete the route for {0}?":"要删除 {0} 的路由吗？","Delete the rule “{0}”?":"要删除规则“{0}”吗？","Delete the subscription {0}?":"删除订阅 {0}?","Delete the warm-up schedule for {0}? Its counts go with it, and the address is no longer held.":"删除 {0} 的预热计划？其计数随之删除，该地址不再受限。","Delete the white-list address {0}?":"要删除白名单地址 {0} 吗？","Delete these {0} held messages for good?":"要永久删除这 {0} 封被暂挂的邮件吗？","Delete this group":"删除此组","Delete this held message for good?":"永久删除这封被扣留的邮件？","Delete {0}?":"要删除 {0} 吗？","Deleted":"已删除","Deleted {0}":"已删除 {0}","Deleted {0} messages.":"已删除 {0} 封邮件。","Deliver message {0} now, without the sandbox's verdict?":"不等沙箱判定，立即投递邮件 {0} 吗？","Delivered":"已投递","Delivers to":"投递至","Delivers to now":"当前投递给","Delivery failures":"投递失败","Delivery queue":"投递队列","Delivery removed":"已移除投递","Delivery retriggered":"已重新触发投递","Department":"部门","Description":"描述","Detail":"详情","Details":"详情","Device":"设备","Devices":"设备","Diagnostics":"诊断","Different":"不一致","Digest":"摘要","Digest settings":"摘要设置","Direction":"方向","Directory entry":"通讯录资料","Directory entry saved":"通讯录资料已保存","Disabled":"已禁用","Discard":"丢弃","Discard message {0}? It is deleted and nobody is told.":"要丢弃邮件 {0} 吗？它将被删除，且不会通知任何人。","Discard the way back":"放弃恢复记录","Discard this held message for good?":"永久丢弃这条被扣留的邮件？","Discarded":"已丢弃","Discovery":"电子取证","Disposition":"处置","Do not forward messages flagged as spam.":"不转发被标记为垃圾邮件的邮件。","Do not reply to messages flagged as spam.":"不回复被标记为垃圾邮件的邮件。","Domain":"域","Domain created: {0}":"已创建域：{0}","Domain deleted: {0}":"已删除域：{0}","Domain list entry deleted":"域列表条目已删除","Domain list entry saved":"域列表条目已保存","Domain name":"域名","Domain renamed to {0}":"域已重命名为 {0}","Domain saved":"已保存域","Domain white and black list":"域白名单和黑名单","Domain {0}":"域 {0}","Domains":"域","Domains whose look-alikes are judged exactly as this server's own are: partner.example, separated by commas or spaces, ASCII only (an internationalised name in its xn-- form); at most 2,000 characters.":"其形似域完全按本服务器自有域的方式判定的域：partner.example，用逗号或空格分隔，仅限 ASCII（国际化名称用 xn-- 形式）；最多 2,000 个字符。","Domains, comma separated":"域名，以逗号分隔","Domains, comma-separated (empty: all)":"域，以逗号分隔（留空：全部）","Done":"已完成","Download":"下载","Download and verify":"下载并验证","Download the root":"下载根证书","Download the summary (CSV)":"下载摘要 (CSV)","Downloaded mail":"已下载邮件","Drain":"排空","Draining":"正在排空","Draining since {0}: {1} session(s) and {2} delivery(ies) in flight.":"自 {0} 起排空中：进行中的会话 {1} 个，投递 {2} 个。","Each message":"每封邮件","Each profile sets the settings one kind of server needs. Showing one lists every setting beside the value this server holds now; nothing changes until it is applied.":"每个配置方案都会设置某类服务器所需的设置。显示某个方案时，每项设置都列在此服务器当前值的旁边；在应用之前不会有任何更改。","Edit":"编辑","Edit DNS blacklist {0}":"编辑 DNS 黑名单 {0}","Edit IP range {0}":"编辑 IP 范围 {0}","Edit SURBL server {0}":"编辑 SURBL 服务器 {0}","Edit blocked attachment {0}":"编辑阻止的附件 {0}","Edit blocked sender {0}":"编辑阻止的发件人 {0}","Edit domain list entry {0}":"编辑域列表条目 {0}","Edit external account {0} for {1}":"编辑 {1} 的外部帐户 {0}","Edit greylisting bypass entry {0}":"编辑灰名单绕过条目 {0}","Edit greylisting white address {0}":"编辑灰名单白名单地址 {0}","Edit incoming relay {0}":"编辑传入中继 {0}","Edit list entry {0}":"编辑名单条目 {0}","Edit never-ban name {0}":"编辑永不封禁名称 {0}","Edit policy {0}":"编辑策略 {0}","Edit port {0}":"编辑端口 {0}","Edit route {0}":"编辑路由 {0}","Edit rule {0}":"编辑规则 {0}","Edit the inbound webhook for {0}":"编辑 {0} 的入站 Webhook","Edit the subscription {0}":"编辑订阅 {0}","Edit the warm-up of {0}":"编辑 {0} 的预热","Edit white-list address {0}":"编辑白名单地址 {0}","Edited above.":"在上方编辑。","Empty the caches":"清空缓存","Empty the index":"清空索引","Enable greylisting for this domain.":"为此域启用灰名单。","Enable plus addressing: mail to user+anything@domain reaches user@domain.":"启用加号地址：发往 user+anything@domain 的邮件会送达 user@domain。","Enabled":"已启用","Encryption":"加密","Encryption at rest":"静态加密","Encryption at rest switched off":"静态加密已关闭","Encryption at rest switched on":"静态加密已开启","Ended":"已结束","Ended recently":"最近结束","Entry added: {0}":"已添加条目：{0}","Entry removed: {0}":"已移除条目：{0}","Envelope report":"信封报告","Erase every stored trace of {0}? Quarantine entries, trace rows, greylisting, list memberships, aliases, the address-book entries, certificates, keys and memories other accounts keep of it, the messages outside any mailbox that name it - held for review (discarded for every recipient), expiring or password-protected - the archive tree and the log lines that name the address. What a legal hold covers is left in place. This cannot be undone.":"清除 {0} 的所有存储痕迹？隔离条目、跟踪行、灰名单、列表成员资格、别名、其他账户保存的关于它的通讯录条目、证书、密钥和记忆，任何邮箱之外提到它的邮件（待审核的邮件 - 对所有收件人丢弃 -、会过期的邮件或受密码保护的邮件）、归档树以及提到该地址的日志行。法律保全涵盖的内容保持不变。此操作无法撤销。","Erase traces":"清除痕迹","Erased {0} trace(s) of {1}.":"已清除 {1} 的 {0} 条痕迹。","Erased {0} trace(s) of {1}; {2} item(s) left in place under a legal hold.":"已清除 {1} 的 {0} 条痕迹；{2} 项因法律保全而保留。","Error":"错误","Errors met and retried":"遇到并重试过的错误","Event":"事件","Events":"事件","Every":"间隔","Every client that has signed in to an account: what it speaks, where from, which of the account's credentials it used, and when it was first and last seen. Revoking one ends the session it holds now - its browser session, and its live IMAP, POP3 and SMTP connections - and can disable the app password behind it. It is not a ban: the client can sign in again with a credential that still works.":"每一个登录过某个帐户的客户端：它说什么协议、从哪里来、用了该帐户的哪一项凭据，以及第一次和最后一次出现的时间。吊销会结束它此刻持有的会话——它的浏览器会话，以及正在进行的 IMAP、POP3 和 SMTP 连接——并可停用其背后的应用密码。这不是封禁：只要还有可用的凭据，客户端可以再次登录。","Every connection this server has open now - the SMTP, POP3 and IMAP sessions it answers, and the ones it opens itself - and the last ones that ended. Follow one and its log lines appear below as the server writes them - what a grep through the day's log for its session id stands in for.":"此服务器当前打开的每个连接 - 它应答的 SMTP、POP3 和 IMAP 会话，以及它自己打开的连接 - 以及最近结束的连接。跟踪其中一个，它的日志行会在服务器写入时随即显示在下方 - 这正是以往在当天日志中按会话 ID 执行 grep 所做的事。","Every criterion must match":"所有条件都必须匹配","Every field below, its type and its words are read from the server's own OpenAPI document, so a setting added to the API appears here on its own. Only the fields you change are sent. A key marked {0} is sent only when you fill it in; one marked {1} is stored at once but reaches the running server when its services restart — the Ports view has the button that restarts them. A key marked {2} is a counter or a fact about the server, shown and not sent.":"下面每个字段、它的类型和措辞都读自服务器自己的 OpenAPI 文档，因此 API 新增的设置会自行出现在这里。只有您更改过的字段才会发送。标记为 {0} 的键只有在您填写后才发送；标记为 {1} 的键会立即保存，但要等服务重启后才会到达运行中的服务器 — 重启的按钮在端口页面上。标记为 {2} 的键是计数器或关于服务器的事实，只显示而不发送。","Every mailbox signs in with one password, which this server mints now and shows once, so write it down - and remove the sample before this server takes real mail.":"所有邮箱都使用同一个密码登录，该密码由本服务器现在生成并只显示一次，请记下来，并在此服务器接收真实邮件之前移除样例。","Every port the IP range {0} may use starts TLS before it takes a password.":"IP 范围 {0} 可以使用的每个端口都会在接受密码之前启动 TLS。","Every setting whose value is not the one this version of the server ships with. It is the first thing to look at when a server behaves oddly, and the first thing to put in a support message. A setting whose value is a secret is named here and never shown.":"值与本版本服务器出厂设置不同的每一项设置。当服务器行为异常时，这是首先要查看的内容，也是提交支持请求时首先要写明的内容。值为机密的设置在此只列出名称，绝不显示其值。","Everything (.zip)":"全部 (.zip)","Exempt from the detection":"不纳入检测","Exempt: may exchange mail with anyone":"豁免：可与任何人收发邮件","Expire and prune now":"立即过期并清理","Expired":"已过期","Expires":"到期","Expires (YYYY-MM-DD, optional)":"过期时间（YYYY-MM-DD，可选）","Expiry":"到期","Export":"导出","Exports":"导出记录","External account":"外部帐户","External account deleted":"已删除外部帐户","External account saved":"已保存外部帐户","External sender to external recipient - an open relay unless authentication is required.":"外部发件人发往外部收件人 - 除非要求身份验证，否则这就是开放中继。","External sender to local recipient (incoming mail).":"外部发件人发往本地收件人（接收邮件）。","Failed":"失败","Failed DMARC":"DMARC 未通过","Failed incoming":"接收失败","Failed outgoing":"发送失败","Failures":"失败","Fast":"快速","Fetch accounts":"收取帐户","Filter by administrator or API key":"按管理员或 API 密钥筛选","Filter messages by name or text":"按名称或正文筛选消息","Filter settings by name or description":"按名称或说明筛选设置","Fingerprint":"指纹","Finish":"完成","First seen":"首次出现","First seen {0}":"首次看到 {0}","Fold this group":"折叠此组","Folder":"文件夹","Follow":"跟踪","Following session {0}":"正在跟踪会话 {0}","Follows the domain":"沿用域设置","Follows the domain takes the domain's list of named domains. Restricted confines the account to the named domains, its own domain and the postmaster - and, when the domain names nothing, to its own domain alone. Exempt lets an account in a restricted domain exchange mail with anyone.":"沿用域设置采用域的指定域列表。受限将账户限定于指定的域、自己的域和 postmaster；当域未指定任何内容时，仅限自己的域。豁免允许受限域中的账户与任何人收发邮件。","For a managed list: how each member takes its mail, and what their bounces have done. Reset bounces sends a stopped member each message again.":"对于受管理的列表：说明每个成员如何接收邮件，以及其退信情况。重置退信会让已停止的成员重新收到每封邮件。","Forced from [SettingsOverride] in hMailServer.ini":"由 hMailServer.ini 中的 [SettingsOverride] 强制设定","Forget the remembered verdicts":"清除已记住的结果","Forward incoming mail.":"转发收到的邮件。","Forwarding":"转发","Fraud":"欺诈","From":"发件人","From (YYYY-MM-DD)":"起始（YYYY-MM-DD）","From the query":"来自查询","Full access":"完全访问","General":"常规","Gentle":"温和","Give the address of the account whose mailbox to restore.":"请输入要恢复其邮箱的账户地址。","Give the device a name.":"给设备起个名字。","Give the key a label.":"请给密钥一个标签。","Give the path of the archive on the server.":"请填写存档在服务器上的路径。","Give the role":"授予角色","Grant":"授予","Grant a permission":"授予权限","Greylisting bypass entry deleted":"已删除灰名单绕过条目","Greylisting bypass entry saved":"已保存灰名单绕过条目","Greylisting bypass list":"灰名单绕过列表","Greylisting white address deleted":"已删除灰名单白名单地址","Greylisting white address saved":"已保存灰名单白名单地址","Greylisting white list":"灰名单白名单","Group":"组","Group by":"分组依据","Group created: {0}":"已创建组：{0}","Group deleted":"已删除组","Group name":"组名","Group saved":"已保存组","Group {0}":"组 {0}","Groups":"组","HELO":"HELO","HELO domain":"HELO 域","Hard":"硬退信","Header name":"标头名称","Headers of the message from {0}":"来自 {0} 的邮件的邮件头","Headings":"标题","Held":"已扣留","Held because: {0}":"暂挂原因：{0}","Held copies only":"仅保留的副本","Held for a sandbox":"等待沙箱判定","Held for review":"扣留待审","Held for {0} s; {1} file(s)":"已保留 {0} 秒；{1} 个文件","Held or refused":"已扣留或已拒绝","Held: {0}. Listed here: the most recent {1}; a search looks through every held message.":"已暂挂：{0} 封。此处列出最近的 {1} 封；搜索会查看所有暂挂邮件。","Help":"帮助","Help for this view":"此视图的帮助","Help for this view, beside it":"在旁边显示此视图的帮助","Hidden by the search":"被搜索隐藏","Hide it":"隐藏","Hide the changes":"隐藏更改","Higher wins when ranges overlap.":"范围重叠时数值大者胜出。","Highest":"最高","Hint: {0}":"提示：{0}","Hits since the server started: {0}":"服务器启动以来的命中数：{0}","Hold":"保留","Hold its archived copies":"保留其存档副本","Hold lifted":"保留已解除","Holds":"保留记录","Host":"主机","Hours of the day seen (UTC)":"已见的一天中的小时 (UTC)","Hours the new key's record must have resolved before signing moves to it, 1 to 720.":"签名切换到新密钥之前，新密钥的记录必须能够解析的小时数，1 到 720。","How far past its limit a mailbox still accepts incoming mail, as a percentage of the limit; 0 is not at all and -1 uses the server's value.":"邮箱超出限额后仍接收来信的幅度，以限额的百分比计；0 为完全不接收，-1 使用服务器的值。","How long a signed-in browser session of this domain's accounts - the webmail, the self-service portal - may go unused before it ends, in seconds. 0 takes the server-wide value, and where that is 0 too the server's own ceiling of 1800 seconds applies. At most 2592000, which is thirty days.":"该域帐户的已登录浏览器会话——网页邮件、自助门户——在结束之前可以闲置多久，以秒计。0 采用全服务器的值；若那也是 0，则适用服务器自身 1800 秒的上限。最多 2592000，也就是三十天。","How long such a session may live at all, however busy it is, in seconds. 0 takes the server-wide value, and where that is 0 too the server's own ceiling of 43200 seconds - twelve hours - applies.":"这样的会话无论多忙总共可以存在多久，以秒计。0 采用全服务器的值；若那也是 0，则适用服务器自身 43200 秒、也就是十二小时的上限。","How the connection to the relay is secured.":"与中继的连接如何加以保护。","How the connection to the remote server is secured.":"与远程服务器的连接如何加以保护。","I confirm the changes marked above: they close a listener, trust an address range, turn a filter or a check off, or shorten how long data is kept on this server - and what a shorter window deletes, a revert does not bring back.":"我确认上面标出的更改：它们会在此服务器上关闭侦听器、信任某个地址范围、关闭某个过滤器或检查，或缩短数据的保留时间——较短期限删除的内容，恢复也无法找回。","ID":"ID","IMAP sessions":"IMAP 会话","IP banned":"IP 已封禁","IP range deleted":"已删除 IP 范围","IP range saved":"已保存 IP 范围","IP ranges":"IP 范围","Idle":"空闲","Impersonation protection":"冒充防护","In a row":"连续","In effect: {0}, from the account":"生效：{0}，来自帐户","In effect: {0}, from the domain":"生效：{0}，来自域","In effect: {0}, from the server":"生效：{0}，来自服务器","In the source":"源中","Inbound TLS":"接收 TLS","Inbound webhook removed":"入站 Webhook 已移除","Inbound webhook saved":"入站 Webhook 已保存","Inbound webhooks":"入站 Webhook","Incoming":"接收","Incoming relay deleted":"已删除传入中继","Incoming relay saved":"已保存传入中继","Incoming relays":"传入中继","Index now":"立即建立索引","Information":"信息","Install the update":"安装更新","Install the verified update now? The service stops and starts while it runs, and comes back on the new version - or on this one if the install fails.":"现在安装已验证的更新？安装期间服务会停止并重新启动，之后以新版本恢复；若安装失败则以当前版本恢复。","Installed as":"安装方式","Installer":"安装程序","Installing":"正在安装","Interface":"接口","Into this folder (empty: the one it was in)":"恢复到此文件夹 (留空: 原来所在的文件夹)","It is left out of the checklist above, because a sample domain is not this server's first domain.":"它不计入上面的检查清单，因为样例域不是此服务器的第一个域。","Its addresses alone":"仅其地址","Job cancelled":"任务已取消","Job queued again":"任务已重新排队","Job title":"职务","Job {0} is {1}: {2} folders, {3} messages added, {4} skipped as still in the mailbox, {5} failed.":"作业 {0} 状态为 {1}: {2} 个文件夹, 已添加 {3} 封, 因仍在邮箱中而跳过 {4} 封, 失败 {5} 封。","Jobs":"任务","Journaling":"日志归档","Journaling rule added for {0}":"已为 {0} 添加日志归档规则","Journaling rule removed for {0}":"已移除 {0} 的日志归档规则","Journaling rules":"日志归档规则","Keep":"保留","Keep its settings, forget the way back":"保留其设置，放弃恢复记录","Keep the old address as an alias":"将旧地址保留为别名","Keep the original message in this mailbox.":"在此邮箱中保留原始邮件。","Keep the settings this version ships with, and apply no profile? The checklist stops asking; any profile can still be applied later.":"保留此版本附带的设置，不应用任何配置方案？检查清单将不再询问；以后仍可应用任何配置方案。","Keep the shipped settings":"保留出厂设置","Kept by hand":"手工维护","Key":"密钥","Key compromise":"密钥泄露","Key file: {0}":"密钥文件：{0}","Key made":"密钥已创建","Key revoked":"密钥已吊销","Key type":"密钥类型","Key unreadable":"密钥无法读取","Keyboard shortcuts":"键盘快捷键","Label":"标签","Language":"语言","Largest mailboxes":"最大的邮箱","Last 200":"最后 200 行","Last 2000":"最后 2000 行","Last 24 hours":"最近 24 小时","Last 30 days":"最近 30 天","Last 7 days":"最近 7 天","Last 90 days":"最近 90 天","Last bounce":"最近退信","Last checked {0}, next {1}":"上次检查 {0}，下次 {1}","Last delivered":"最近投递","Last error":"最近错误","Last moved from {0} to {1} on {2}.":"上次于 {2} 从 {0} 迁移到 {1}。","Last seen":"最近出现","Last status":"最近状态","Last used":"最近使用","Last value":"最近值","Leave this account out of the directory":"不要把此帐户列入通讯录","Left the list":"已退出列表","Left where they were: {0}. The first reason: {1}":"已保留原状：{0} 封。首个原因：{1}","Levels saved":"级别已保存","Lift the hold":"解除保留","Limit the number of accounts.":"限制帐户的数量。","Limit the number of aliases.":"限制别名的数量。","Limit the number of distribution lists.":"限制邮件列表的数量。","Limits":"限制","Lines arrived faster than they were read; the server holds only the most recent few thousand, and the ones between are gone.":"日志行到达的速度快于读取速度；服务器只保留最近的几千行，中间的行已丢失。","List":"列表","List created: {0}":"已创建列表：{0}","List deleted: {0}":"已删除列表：{0}","List entry deleted":"名单条目已删除","List entry saved":"名单条目已保存","List is active.":"启用此列表。","List it anyway":"仍然加入名单","List lists everything":"列表列入所有地址","List not answering":"列表无响应","List saved":"已保存列表","List the archive's messages":"列出存档中的邮件","List {0}":"列表 {0}","Listed":"已列入","Listens on":"侦听地址","Lists":"列表","Lists ›":"列表 ›","Live sessions":"活动会话","Local sender to external recipient (relay out).":"本地发件人发往外部收件人（向外中继）。","Local sender to local recipient.":"本地发件人发往本地收件人。","Locked since {0}":"自 {0} 起锁定","Log file":"日志文件","Log files":"日志文件","Logging":"日志记录","Logging is off for this session's protocol, so no line will appear. Turn it on under Settings, Logging.":"此会话协议的日志记录已关闭，因此不会显示任何行。请在设置、日志记录中开启。","Logs":"日志","Longest booking, in minutes (0 for no limit)":"最长预订时长，以分钟计（0 表示不限）","Look up":"查询","Lookup failed":"查询失败","Lower IP":"最低 IP","Mail clients send through the submission port, and without TLS their passwords cross the network in the clear.":"邮件客户端通过提交端口发送，没有 TLS，密码就会以明文穿过网络。","Mail is addressed to a domain, so the server needs one before it can receive anything.":"邮件是寄给域的，所以服务器需要先有一个域才能接收任何邮件。","Mail to an unknown recipient in the domain is redirected to this address; empty means it is refused.":"发往此域中未知收件人的邮件会改投到这个地址。留空表示拒收。","Mailbox":"邮箱","Mailbox full":"邮箱已满","Mailbox recovery key":"邮箱恢复密钥","Mailbox restore started":"邮箱恢复已开始","Mailboxes":"邮箱","Mailboxes and the archive":"邮箱和存档","Maintenance mode":"维护模式","Make a key":"创建密钥","Make a new VAPID key pair":"生成新的 VAPID 密钥对","Make a sample domain":"创建样例域","Make the key":"创建该密钥","Make the recovery key":"创建恢复密钥","Matches":"匹配","Maximum domain size in MB; 0 is unlimited.":"域的最大容量（MB）。0 表示不限。","Maximum mailbox size in MB; 0 is unlimited.":"邮箱的最大容量（MB）。0 表示不限。","Maximum message size in KB; 0 is unlimited.":"邮件的最大大小（KB）。0 表示不限。","Maximum size for accounts created in this domain, in MB; 0 is unlimited.":"在此域中创建的帐户的最大容量（MB）。0 表示不限。","Measured {0}; new mail is stored as it came.":"测量于 {0}；新邮件按原样存储。","Measured {0}; new mail is stored compressed.":"测量于 {0}；新邮件以压缩形式存储。","Measuring the message store; the figures follow on the next refresh.":"正在测量邮件存储；数字将在下次刷新时显示。","Megabytes":"兆字节","Members":"成员","Membership query":"成员查询","Merge the archive's folders and messages into the mailbox of {0}? Nothing already there is removed.":"将存档中的文件夹和邮件合并到 {0} 的邮箱? 已有的内容不会被删除。","Merge: add the archive's folders and messages that the mailbox lacks; nothing already there is removed":"合并: 添加邮箱中缺少的存档文件夹和邮件; 已有的内容不会被删除","Message":"邮件","Message indexing":"邮件索引","Message passed DMARC":"邮件通过 DMARC","Message removed":"已移除邮件","Message restore started":"邮件恢复已开始","Message saved: {0}":"已保存消息：{0}","Message size":"邮件大小","Message store":"邮件存储","Message trace":"邮件跟踪","Messages":"邮件数","Messages per day":"每天邮件数","Messages processed":"已处理邮件","Metric history":"指标历史","Metrics history":"指标历史","Migration created":"迁移已创建","Migration deleted":"迁移已删除","Migration paused":"迁移已暂停","Migration resumed":"迁移已恢复","Migration started":"迁移已开始","Migrations":"迁移","Minutes between downloads.":"两次收取之间的间隔（分钟）。","Mirror every folder (IMAP only): a migration, verbatim, with flags and dates, nothing delivered.":"镜像每个文件夹（仅限 IMAP）：这是一次原样迁移，连同标志和日期一并搬过来，不进行任何投递。","Mobile":"手机","Mode: {0}":"模式：{0}","Moderator (empty = no moderation).":"审核人（留空表示不审核）。","More connections are open than this list holds; the newest {0} are shown.":"打开的连接比这份列表能容纳的多；显示的是最新的 {0} 个。","Move mailbox":"迁移邮箱","Move or rename":"迁移或重命名","Move signing for {0} to the next key now, without waiting for the propagation period?":"要不等传播期结束，立即将 {0} 的签名切换到下一个密钥吗？","Move signing for {0} to the next key now?":"要立即将 {0} 的签名切换到下一个密钥吗？","Move through the rows of a table, or the views while the keyboard is in the navigation column":"在表格的行之间移动；键盘位于导航栏时，则在各视图之间移动","Move to the next control; the one holding the keyboard is ringed":"移到下一个控件；持有键盘的控件会显示外框","Moved {0} to {1}":"已将 {0} 迁移到 {1}","Name":"名称","Name added: {0}":"已添加名称：{0}","Name removed: {0}":"已移除名称：{0}","Name the account or the group.":"请指定账户或组。","Names":"名称","Near their quota":"接近配额","Never":"从不","Never-ban list by reverse name":"按反向名称的永不封禁列表","Never-ban name deleted":"永不封禁名称已删除","Never-ban name saved":"永不封禁名称已保存","New DNS blacklist":"新建 DNS 黑名单","New IP range":"新建 IP 范围","New SURBL server":"新建 SURBL 服务器","New account":"新建帐户","New address":"新地址","New alias":"新建别名","New blocked attachment":"新建阻止的附件","New blocked sender":"新建阻止的发件人","New domain":"新建域","New domain list entry":"新建域列表条目","New external account for {0}":"为 {0} 新建外部帐户","New greylisting bypass entry":"新建灰名单绕过条目","New greylisting white address":"新建灰名单白名单地址","New group":"新建组","New inbound webhook":"新建入站 Webhook","New incoming relay":"新建传入中继","New list":"新建列表","New list entry":"新名单条目","New migration":"新建迁移","New never-ban name":"新的永不封禁名称","New password":"新密码","New password or token (optional)":"新密码或令牌(可选)","New policy":"新建策略","New port":"新建端口","New route":"新建路由","New rule":"新建规则","New subscription":"新建订阅","New warm-up schedule":"新建预热计划","New white-list address":"新建白名单地址","Newer":"较新","Next":"下一步","Next download":"下次收取","Next key":"下一个密钥","Next rotation due {0}":"下次轮换时间 {0}","Next try":"下次重试","No":"否","No API keys. Make one above for a program that should reach this server without the administrator password.":"没有 API 密钥。为需要在没有管理员密码的情况下访问此服务器的程序，在上方创建一个。","No CRL distribution point is written into its certificates: set smime_authority_base_url on the Settings page to where the web services listener is reached.":"其证书中不写入 CRL 分发点：请在设置页面将 smime_authority_base_url 设为可访问 Web 服务侦听器的地址。","No DMARC report has been read for this domain.":"尚未为此域读取任何 DMARC 报告。","No HELO name was recorded":"未记录 HELO 名称","No IP ranges: nothing may connect.":"没有 IP 范围：任何来源都无法连接。","No OpenPGP keys are held for this domain's accounts.":"本域的账户没有保存任何 OpenPGP 密钥。","No SMTP listener is on port 25, so no delivery port takes a password.":"端口 25 上没有 SMTP 侦听器，因此没有投递端口接受密码。","No SMTP, POP3 or IMAP session is open, and none has ended since the server started.":"没有打开的 SMTP、POP3 或 IMAP 会话，服务器启动以来也没有会话结束。","No TLS report has been read for this domain in this window.":"此期间内尚未为此域读取任何 TLS 报告。","No TLSA records available — assign an SSL certificate first.":"没有可用的 TLSA 记录 — 请先指定一个 SSL 证书。","No abuse report has been recorded for this domain.":"该域名尚未记录任何滥用举报。","No account has been added in any domain.":"任何域中都没有添加账户。","No account to collect for":"没有可收取邮件的帐户","No accounts in this group.":"此组中没有帐户。","No accounts.":"没有帐户。","No actions: the rule does nothing.":"没有动作：此规则不做任何事。","No active domain yet.":"尚无活动的域。","No active domain, so there is nothing to publish yet.":"没有活动的域，因此暂时没有什么可发布。","No address or domain is routed to a URL, so every message goes to a mailbox as it always has.":"没有地址或域被转到 URL，所以每封邮件都像以往一样进入邮箱。","No addresses are on this domain's suppression list.":"此域的抑制列表中没有地址。","No aliases in this domain.":"此域中没有别名。","No backup destination is set.":"未设置备份目标。","No baseline yet: fewer than {0} submissions in the window, so only the volume and recipients floors are judged.":"尚无基线：窗口内的发送少于 {0} 次，因此仅按发送量和收件人的下限判断。","No bounces have been counted for this domain.":"此域尚未统计到退信。","No certificates are configured.":"没有配置任何证书。","No complaint mailbox is named, so no report is ever read. Settings has the field; it is the address the feedback loops are registered against.":"未指定投诉邮箱，因此不会读取任何举报。该字段在设置中，它是注册反馈环时使用的地址。","No criteria: the rule matches every message.":"没有条件：此规则匹配每一封邮件。","No destination has asked this server to slow down.":"没有目标要求本服务器放慢速度。","No distribution lists in this domain.":"此域中没有邮件列表。","No domain has been added yet.":"尚未添加任何域。","No domains configured.":"没有配置任何域。","No external accounts are collected for {0}.":"没有为 {0} 收取任何外部帐户。","No failure recorded.":"没有记录到失败。","No global rules are defined.":"没有定义全局规则。","No groups. A group is a named set of accounts that a folder permission can name as one principal.":"没有组。组是一组有名称的帐户，文件夹权限可以把它作为一个主体来指名。","No held message matches the search.":"没有与搜索匹配的暂挂邮件。","No jobs yet. Add them below.":"还没有任务。请在下方添加。","No journaling rules: nothing is copied anywhere and the evaluation costs one comparison per message.":"没有日志归档规则：不会复制到任何地方，每封邮件的判断只需一次比较。","No listeners are configured.":"没有配置任何侦听器。","No log files. Logging may be off, or the folder is empty.":"没有日志文件。日志记录可能已关闭，或者文件夹是空的。","No mailbox":"无邮箱","No members.":"没有成员。","No migration has been made. A migration copies many mailboxes from another server into accounts here, one job per mailbox.":"尚未创建任何迁移。迁移会把另一台服务器上的许多邮箱复制到这里的帐户,每个邮箱一个任务。","No other names: mail is accepted for the domain name only.":"没有其他名称：只接收发往该域名的邮件。","No outbound address is being warmed up.":"没有正在预热的发信地址。","No outbound address is configured, so nothing is checked: set the delivery bind address, or name this server's public address in reputation_watch_addresses on the Settings page.":"未配置出站地址，因此不会检查任何内容：请设置投递绑定地址，或在设置页面的 reputation_watch_addresses 中填写本服务器的公网地址。","No passkeys yet. Add one for this device and sign in with it next time.":"还没有通行密钥。为这台设备添加一个，下次用它登录。","No password on port 25":"端口 25 不接受密码","No port takes message submission, so mail clients cannot send through this server.":"没有端口接受邮件提交，因此邮件客户端无法通过此服务器发送。","No profile has been applied. A profile sets about thirty settings for the kind of server this is - a small office, behind a filtering gateway, an outbound relay, a high-volume sender - and shows every change before it is made.":"尚未应用任何配置方案。配置方案会按此服务器的类型——小型办公室、位于过滤网关之后、出站中继、大批量发件方——设置约三十项设置，并在进行每项更改之前先显示出来。","No recovery address is set.":"未设置恢复地址。","No recovery key: no account of this domain can be encrypted at rest until one is made.":"没有恢复密钥：在创建之前，此域的任何账户都不能进行静态加密。","No remote domain policies are configured; mail to every domain is sent as this server's own settings decide.":"尚未配置远程域策略；发往各个域的邮件按本服务器自身的设置发送。","No report has been read for this domain in this window.":"此期间内尚未为此域读取任何报告。","No report mailbox is named for this domain, so no report is ever read. Edit the domain and name one: it is the address to publish in the domain's DMARC and TLS-RPT records.":"此域未指定报告邮箱，因此不会读取任何报告。请编辑该域并指定一个：它就是要发布到该域 DMARC 和 TLS-RPT 记录中的地址。","No results came back.":"没有返回结果。","No rotation is scheduled. Rotate now to start one.":"没有计划中的轮换。点击“立即轮换”开始一次。","No routes are configured; every domain is delivered to by its MX records.":"没有配置任何路由；每个域都按其 MX 记录投递。","No rules are defined for this domain.":"此域未定义任何规则。","No server messages.":"没有服务器消息。","No source has been reported in this window.":"此期间内没有报告任何来源。","No spam traps: every address of this domain that is not an account, an alias or a list is refused as an unknown address, and nothing is banned for it.":"没有垃圾邮件陷阱：本域中不属于账户、别名或列表的地址都会作为未知地址被拒收，也不会因此封禁任何人。","No stored-secrets key has been made, so an account's second factor and the [Settings] secrets are stored as written. Make one on the server with {0}, then export it.":"尚未创建存储机密密钥，因此账户的第二因素和 [Settings] 机密按原样存储。请在服务器上使用 {0} 创建一个，然后将其导出。","No subscriptions are configured, so no mail event leaves this server.":"尚未配置任何订阅，因此没有任何邮件事件离开此服务器。","Nobody else reaches this folder. ✦":"没有其他人可以访问此文件夹。✦","Nobody has been given a role yet. An account without one holds the authority its admin level gives it. ✦":"尚未向任何人授予角色。没有角色的帐户拥有其管理员级别所赋予的权限。 ✦","Nobody has reported in this window.":"此期间内没有任何报告方。","Nobody: this list would deliver to no one.":"无人：该列表不会投递给任何人。","None":"无","None open.":"没有打开的会话。","Not checked":"未检查","Not checked since the service started":"服务启动后尚未检查","Not checked yet":"尚未检查","Not covered":"不涵盖","Not draining: the listeners are open.":"未排空：监听器已开启。","Not enough samples yet. The history fills as the server runs.":"样本还不够。历史会随着服务器运行而填充。","Not found":"未找到","Not listed":"未列入","Not locked":"未锁定","Not looked up":"未查询","Not named":"未注明","Not needed":"不需要","Not published":"未发布","Not recorded":"未记录","Not spam":"不是垃圾邮件","Not spared":"未豁免","Note":"备注","Nothing changed":"没有任何更改","Nothing for now":"暂不接收","Nothing has addressed a spam trap.":"还没有人写信到垃圾邮件陷阱。","Nothing has addressed a trap of this domain.":"还没有人写信到本域的陷阱地址。","Nothing has been changed. Every setting on this server is what this version ships with.":"没有任何更改。本服务器的每一项设置都与本版本出厂时相同。","Nothing has been queued yet.":"尚未有任何内容进入队列。","Nothing has been recorded yet. Every administrative change appears here.":"尚无任何记录。此后的每一次管理变更都会显示在这里。","Nothing has signed in to this account yet. ✦":"还没有任何客户端登录过这个帐户。✦","Nothing here.":"这里没有内容。","Nothing in the archive matches. ✦":"归档中没有匹配项。✦","Nothing in this range.":"此时间范围内没有数据。","Nothing is held for a sandbox.":"没有等待沙箱判定的邮件。","Nothing is held for review. ✦":"没有扣留待审的邮件。✦","Nothing is held. ✦":"没有被扣留的邮件。✦","Nothing is on this domain's list, so each account's own list and then the server's decide.":"本域名的名单为空，因此由各账户自己的名单、再由服务器的名单决定。","Nothing on this server to look at yet? This makes {0} with three mailboxes, a distribution list, a rule and a handful of delivered messages, so that every view has something in it while you learn.":"此服务器上还没有可看的内容？这会创建 {0}，带三个邮箱、一个通讯组列表、一条规则和若干已投递的邮件，让您学习时每个视图里都有内容。","Nothing was old enough to remove. The window is the QuarantineRetentionDays setting, on the Control Panel's Anti-spam settings page or at PUT /api/v1/settings/ini/QuarantineRetentionDays, and 0 means never.":"没有足够旧到可以移除的内容。窗口为 QuarantineRetentionDays 设置，可在控制面板的反垃圾邮件设置页面或通过 PUT /api/v1/settings/ini/QuarantineRetentionDays 更改，0 表示从不。","Notifications stopped on {0} device(s) of {1}":"已在 {1} 的 {0} 台设备上停止通知","Now a mailbox. An account is an address somebody signs in to and receives mail at.":"接下来是邮箱。帐户就是某个人用来登录并接收邮件的地址。","OK":"正常","OR":"或者","Object":"对象","Off":"关闭","Off for new mail. What was stored encrypted stays encrypted, and the key stays to read it.":"对新邮件关闭。已加密保存的内容仍保持加密，密钥也保留以供读取。","Off: mail is stored as it arrives.":"关闭：邮件按到达时的原样保存。","Off: mail is stored as it arrives. The person switches it on from the webmail's Security page, once zero-access mailboxes are allowed under Settings, OpenPGP; nothing here can switch it on for them.":"关闭：邮件按到达时的样子存储。在“设置”的 OpenPGP 中允许零访问邮箱后，本人可从网页邮箱的“安全”页面开启；这里无法替其开启。","Office":"办公地点","Older":"较早","Oldest":"最早记录","On":"开启","On blocks the sender for every account; off lets its mail past the spam filter.":"开启时对所有账户拦截该发件人；关闭时让其邮件绕过垃圾邮件过滤。","On hold":"保留中","On hold: kept through the retention sweep and any erasure":"保留中：在保留期清理和任何擦除中都会保留","On. The key is closed until the person signs in with their password.":"开启。在本人用自己的密码登录之前，密钥处于关闭状态。","On. The key is open: the person is signed in.":"开启。密钥已打开：本人已登录。","On. The key waits for the person's first sign-in with their password, which wraps it.":"开启。密钥正在等待本人第一次用自己的密码登录，该密码随后会包裹它。","On: every message delivered to this account is encrypted, after the filters have run, to the account's own OpenPGP key. This server cannot read, search, export or recover its mail, and neither can you: the message source and the export answer 403, search sees the headers only, IMAP and POP hand out the ciphertext. Only the person can switch it off, from the webmail, and switching it off decrypts nothing already stored.":"开启：投递到此账户的每封邮件在过滤器处理后都会用账户自己的 OpenPGP 密钥加密。此服务器无法阅读、搜索、导出或恢复其邮件，您也不能：邮件源和导出返回 403，搜索只能看到邮件头，IMAP 和 POP 交付密文。只有本人能从网页邮箱关闭它，关闭也不会解密已存储的任何内容。","One line per mailbox: sourceuser,secret,target. Paste the lines or choose a file. For Google and Microsoft 365 the secret may be left empty; each such job then gets a sign-in link for the mailbox's owner.":"每个邮箱一行:sourceuser,secret,target。粘贴这些行,或选择一个文件。对于 Google 和 Microsoft 365,secret 可以留空;这样的每个任务都会得到一个供邮箱所有者使用的登录链接。","One per line":"每行一个","One-time code":"一次性验证码","Only the first {0} characters are shown.":"只显示前 {0} 个字符。","Only the most recent {0} lines are kept here, and Copy takes those; the ones before them are in the log file below.":"这里只保留最近的 {0} 行，复制取的就是这些；在此之前的行在下面的日志文件里。","Only this computer may connect, so no password crosses a network.":"只有本计算机可以连接，因此没有密码会穿过网络。","Open":"打开","Open a case":"新建案件","Open now":"当前打开","Open on the wiki":"在 Wiki 中打开","Open the row the cursor is on":"打开光标所在的行","OpenPGP":"邮件加密（OpenPGP）","OpenPGP ›":"邮件加密（OpenPGP） ›","Other":"其他","Other providers":"其他服务商","Out of office":"外出回复","Out of the listing, out of everybody's To field and out of the CardDAV collection. It hides no mailbox: mail still arrives and anybody who knows the address can still write.":"不在列表中，不在所有人的收件人栏中，也不在 CardDAV 集合中。这不会隐藏任何邮箱：邮件照常送达，知道地址的人仍可写信。","Outbound TLS":"发送 TLS","Outbound address":"发信地址","Outbound reputation":"出站信誉","Outgoing":"发送","P-256 (recommended)":"P-256（推荐）","POP3 or IMAP.":"POP3 或 IMAP。","POP3 sessions":"POP3 会话","Partial":"部分","Parts held once":"只存一次的部分","Pass rate":"通过率","Passed DMARC":"DMARC 通过","Passkey added":"已添加通行密钥","Passkey removed":"已删除通行密钥","Passkeys":"通行密钥","Passkeys are switched off on this server.":"本服务器已关闭通行密钥。","Password":"密码","Password reset: {0}":"密码已重置：{0}","Passwords only over TLS":"密码仅通过 TLS","Pause":"暂停","People outside this domain's accounts whose name must not be borrowed - the chairman who has no mailbox here, or an address at another hosted domain. One per line or separated by commas, each a name, an address, or a name followed by the address in angle brackets; at most 2,000 characters.":"不属于此域账户、姓名不得被冒用的人 - 例如在此没有邮箱的董事长，或另一个承载域中的地址。每行一个或用逗号分隔，每项为姓名、地址，或姓名后跟尖括号中的地址；最多 2,000 个字符。","Percent used":"已用百分比","Permission revoked":"权限已撤销","Permission saved":"权限已保存","Permissions":"权限","Phase: {0}":"阶段：{0}","Photo":"照片","Plan":"方案","Policy":"策略","Policy deleted":"策略已删除","Policy saved":"策略已保存","Policy seen":"观察到的策略","Policy type":"策略类型","Port":"端口","Port 25 is where other servers deliver mail, and no mail client should sign in there: an AUTH on it is a password being guessed.":"端口 25 是其他服务器投递邮件的端口，任何邮件客户端都不应在那里登录：在该端口上的 AUTH 就是在猜密码。","Port deleted":"已删除端口","Port saved — it reaches the wire when the services restart":"已保存端口 — 服务重启后才会生效","Port {0} does not offer AUTH: DisableAUTHList names it, and an AUTH sent there is refused without a ban.":"端口 {0} 不提供 AUTH：DisableAUTHList 列出了它，发往该端口的 AUTH 会被拒绝但不封禁。","Port {0} is set to TLS but has no certificate, so TLS cannot start.":"端口 {0} 设置为 TLS，但没有证书，因此 TLS 无法启动。","Port {0} offers TLS with the certificate {1}.":"端口 {0} 以证书 {1} 提供 TLS。","Port {0} offers TLS with {1}, the self-signed certificate this installation made: mail clients warn about it until it is replaced with one a certificate authority issued, which ACME can fetch from Let's Encrypt.":"端口 {0} 使用 {1} 提供 TLS，这是本次安装创建的自签名证书：在替换为证书颁发机构签发的证书之前，邮件客户端会对此发出警告；ACME 可以从 Let's Encrypt 获取证书。","Port {0} still accepts AUTH: it is where other servers deliver mail, and a password tried there is a guess. Set its SMTP authentication to Honeypot or Off, and sign mail clients in on 587.":"端口 {0} 仍接受 AUTH：其他服务器向它投递邮件，在那里尝试的密码都是猜测。请将其 SMTP 身份验证设为“蜜罐”或“关闭”，并让邮件客户端在 587 登录。","Port {0} takes no password, but AutoBanMinutes is 0, so an address that sends AUTH there is refused and not banned.":"端口 {0} 不接受密码，但 AutoBanMinutes 为 0，因此向该端口发送 AUTH 的地址会被拒绝但不会被封禁。","Port {0} takes no password: EHLO does not offer AUTH there, and an address that sends one anyway is refused and banned.":"端口 {0} 不接受密码：EHLO 在那里不提供 AUTH，仍发送 AUTH 的地址会被拒绝并封禁。","Port {0} takes no password: EHLO offers AUTH there as bait, and an address that sends one is refused and banned.":"端口 {0} 不接受密码：EHLO 在那里把 AUTH 作为诱饵提供，发送 AUTH 的地址会被拒绝并封禁。","Port {0} takes submission without TLS, so passwords and mail would cross the network in the clear.":"端口 {0} 在没有 TLS 的情况下接受提交，密码和邮件会以明文穿过网络。","Ports":"端口","Postmaster":"邮件管理员","Postmaster address":"邮件管理员地址","Postmaster address (optional)":"邮件管理员地址（可选）","Press Run the tests. They take a few seconds; a connection test waits for its timeout.":"请按运行测试。需要几秒钟；连接测试会等到超时。","Preview of \"{0}\"":"预览“{0}”","Preview the text":"预览文本","Priority":"优先级","Private key file":"私钥文件","Processed":"已处理","Progress":"进度","Propagating":"正在传播","ProtectStoredSecretsWithDPAPI is 0, so an account's second factor and the [Settings] secrets are stored as written, and no stored-secrets key is needed.":"ProtectStoredSecretsWithDPAPI 为 0，因此账户的第二因素和 [Settings] 机密按原样存储，不需要存储机密密钥。","Protection":"防护","Protocol":"协议","Prune old complaints now":"立即清理旧投诉","Publish":"发布","Publish this account's OpenPGP public keys in the Web Key Directory, so that anybody who has the address can find the key. The keys themselves are on the domain's OpenPGP page.":"在 Web Key Directory 中发布该账户的 OpenPGP 公钥，让任何知道地址的人都能找到密钥。密钥本身在该域的 OpenPGP 页面上。","Publish this account's keys as well as storing this one.":"除保存这个密钥外，还发布该账户的密钥。","Publish this domain's accounts' OpenPGP public keys, so that anybody on the internet can find a key from the address alone. Off by default; the server setting and each account's own switch have to be on as well, and only public keys are ever held.":"发布本域各账户的 OpenPGP 公钥，让互联网上的任何人仅凭地址就能找到密钥。默认关闭；服务器设置和每个账户自己的开关也必须打开，并且只保存公钥。","Publish-ready DANE TLSA records for your certificates. Add these to DNS (with DNSSEC) to enable DANE validation by sending servers.":"可直接发布的、与您的证书对应的 DANE TLSA 记录。把它们添加到启用了 DNSSEC 的 DNS 中，发送方服务器便能进行 DANE 验证。","Published":"已发布","Put an address on the list":"将地址加入列表","Put back":"恢复","Put back the values the {0} profile replaced? A setting changed since is left as it is, and a filter the profile turned on may be turned off again.":"恢复 {0} 配置方案所替换的值？此后被更改过的设置将保持不变，而该方案开启的过滤器可能会再次关闭。","Put back what it changed":"恢复它所更改的内容","Put back: {0} is {1} again.":"已恢复：{0} 又是 {1} 了。","Put on hold":"设为保留","Put once at the start of every subject.":"只在每个主题的开头加一次。","Put the tag text at the front of the subject of mail this domain receives from outside. It breaks any DKIM signature the sender made over their subject, exactly as the anti-spam subject prefix does; the header below costs the sender nothing.":"在此域从外部收到的邮件主题前面加上标记文字。这会破坏发件人对自己主题所做的任何 DKIM 签名，和反垃圾邮件的主题前缀完全一样；下面的邮件头则不会让发件人付出任何代价。","Put this message back into the mailbox of {0}?":"将此邮件放回 {0} 的邮箱?","Quarantine":"隔离区","Quarantine digest":"隔离摘要","Quarantined":"已隔离","Queue":"队列","Queued again":"已重新排队","Queued: the server works through one search or export at a time.":"已排队：服务器一次处理一项搜索或导出。","Quota (MB)":"配额 (MB)","Quota policy":"配额策略","RSA 3072":"RSA 3072","Re-read status":"重新读取状态","Re-read the outcome":"重新读取结果","Reached by":"连接方式","Read":"读取日期","Read at MAIL FROM: a black domain is refused with 550 before anything else runs, for every recipient. The entry covers the organization's domain and everything beneath it.":"在 MAIL FROM 时读取：黑名单域会在任何其他检查运行之前，针对每个收件人以 550 拒绝。该条目覆盖该组织的域及其下的一切。","Read at MAIL FROM: a white domain is not greylisted, and not refused or held on the spam score, while every test still runs and the mark threshold still marks. The entry covers the organization's domain and everything beneath it.":"在 MAIL FROM 时读取：白名单域不会被灰名单，也不会因垃圾邮件分数被拒绝或暂挂，但每项测试仍会运行，标记阈值仍会标记。该条目覆盖该组织的域及其下的一切。","Read at delivery, for every recipient: a blocked sender's mail is held for them where the quarantine is on, and marked as spam where it is not.":"在投递时针对每个收件人读取：被拦截发件人的邮件，在隔离开启处会为该收件人暂挂，在隔离关闭处会被标记为垃圾邮件。","Read at delivery, for every recipient: an allowed sender's mail is delivered unmarked, and the accounts' own spam thresholds do not run. A message the server-wide spam score holds during the SMTP conversation is still held; the domain list is the one that stops that.":"在投递时针对每个收件人读取：被允许发件人的邮件会不加标记地投递，且各账户自己的垃圾邮件阈值不会运行。服务器整体垃圾邮件分数在 SMTP 会话期间暂挂的邮件，仍然会被暂挂；能阻止这一点的是域名单。","Read the recipients from the message's headers and deliver to the local ones found there; when none are, to this account.":"从邮件标头中读取收件人，并投递给在其中找到的本地收件人；一个也没有时，投递给此帐户。","Read-only":"只读","Ready for the administrator's install at the server":"已可由管理员在服务器上安装","Ready to switch":"可以切换","Reason":"原因","Recent deliveries":"最近的投递","Recently addressed":"最近被投递","Recipient":"收件人","Recipient contains":"收件人包含","Recipients":"收件人","Recipients remembered":"已记住的收件人","Records ›":"记录 ›","Recover the mailbox":"恢复邮箱","Recovery":"恢复","Recovery address confirmed: {0}":"恢复地址已确认：{0}","Recovery address set but not confirmed: {0}":"恢复地址已设置但未确认：{0}","Refresh":"刷新","Refused":"已拒绝","Refused: {0}":"已拒绝：{0}","Reinitialize the server now? Every service stops and starts again in place: connections in progress are dropped, and this browser session ends with them.":"现在重新初始化服务器吗？所有服务会就地停止并重新启动：进行中的连接会被断开，此浏览器会话也会随之结束。","Reinitializing - maintenance mode ends with it…":"正在重新初始化 - 维护模式随之结束…","Reinitializing the server…":"正在重新初始化服务器…","Rejected":"已拒绝","Relaxed":"宽松","Relay":"中继","Relaying":"中继权限","Release":"放行","Release notes":"版本说明","Release the checked messages":"放行已勾选的邮件","Release this group":"放行此组","Released to its recipients":"已放行给收件人","Released to the delivery queue":"已放入投递队列","Released {0} messages to their recipients.":"已将 {0} 封邮件放行给其收件人。","Reload the script":"重新加载脚本","Remote domains":"远程域","Remove":"移除","Remove expired":"移除已过期项","Remove message {0} from the queue?":"要从队列中移除邮件 {0} 吗？","Remove the inbound webhook for {0}? The messages its queue still holds go with it.":"移除 {0} 的入站 Webhook？其队列中仍保留的邮件将一并删除。","Remove the journaling rule for {0}? What it has already sent stays where it was sent.":"移除 {0} 的日志归档规则？已经发出的内容仍留在发往之处。","Remove the name {0} from {1}?":"要从 {1} 中移除名称 {0} 吗？","Remove the passkey {0}? That device will no longer sign you in.":"删除通行密钥 {0}？那台设备将不能再登录。","Remove the photo":"移除照片","Remove the range once the time below passes, as one the auto-ban placed is removed.":"过了下面的时刻就移除此范围，就像自动封禁所添加的范围被移除一样。","Remove the sample domain":"移除样例域","Remove the sample domain with every mailbox, message and rule in it? Anything added to it goes too.":"移除样例域及其中的所有邮箱、邮件和规则吗？之后添加到它里面的内容也会一并移除。","Remove the spam trap {0}?":"要删除垃圾邮件陷阱 {0} 吗？","Remove this delivery and the message it kept?":"移除此投递及其保留的邮件？","Remove this key from {0}? Anybody who looks that address up will stop finding it.":"从 {0} 中删除此密钥？查询该地址的人将不再能找到它。","Remove {0} from the list of {1}?":"从 {1} 的名单中移除 {0}?","Removed from the suppression list: {0}":"已从抑制列表移除：{0}","Removed the OpenPGP key of {0}":"已删除 {0} 的 OpenPGP 密钥","Replace the mailbox of {0} with the archive's? Every folder is emptied first: mail that arrived since the backup is gone, kept only for RecoverDeletedDays, which is off by default.":"用存档中的邮箱替换 {0} 的邮箱? 会先清空每个文件夹: 备份之后收到的邮件将丢失, 仅在 RecoverDeletedDays 期间保留, 而该设置默认关闭。","Replace the recovery key":"替换恢复密钥","Replace: empty every folder first, so the mailbox is the archive's - mail that arrived since the backup is gone":"替换: 先清空每个文件夹, 使邮箱与存档一致 - 备份之后收到的邮件将丢失","Report":"报告","Report of {0}":"{0} 的报告","Report {0}, covering {1} to {2}, read {3}. The reporter saw p={4}.":"报告 {0}，覆盖 {1} 至 {2}，于 {3} 读取。报告方看到的策略为 p={4}。","Reported by":"举报方","Reporter":"报告方","Reporters":"报告方","Reports":"报表","Reports arrive at {0}. Publish that address in the domain's DNS: rua=mailto:{0} in the _dmarc TXT record for DMARC reports and in the _smtp._tls TXT record for TLS reports.":"报告会送达 {0}。请在该域的 DNS 中发布此地址：DMARC 报告写在 _dmarc TXT 记录中，TLS 报告写在 _smtp._tls TXT 记录中，均为 rua=mailto:{0}。","Reports the domain receives":"此域收到的报告","Require SMTP authentication for external to external.":"外部发往外部时要求 SMTP 身份验证。","Require SMTP authentication for external to local.":"外部发往本地时要求 SMTP 身份验证。","Require SMTP authentication for local to external.":"本地发往外部时要求 SMTP 身份验证。","Require SMTP authentication for local to local.":"本地发往本地时要求 SMTP 身份验证。","Require SMTP authentication to send to the list.":"向此列表发送时要求 SMTP 身份验证。","Require SSL/TLS when authenticating.":"身份验证时要求 SSL/TLS。","Require TLS for sign-in from the IP range {0}? From then on a client there that signs in before STARTTLS is refused.":"要求从 IP 范围 {0} 登录时使用 TLS？此后，那里在 STARTTLS 之前登录的客户端将被拒绝。","Require TLS for sign-in from this range":"要求从此范围登录时使用 TLS","Require auth":"要求身份验证","Require sender address (empty = any).":"要求发件人地址（留空表示任意）。","Reset a password":"重置密码","Reset bounces":"重置退信","Reset password":"重置密码","Restart the server's services now? Connections in progress are dropped, and this browser session ends with them.":"要立即重启服务器的服务吗？正在进行的连接会被中断，此浏览器会话也会随之结束。","Restart the services now":"立即重启服务","Restarting the services…":"正在重启服务…","Restore":"还原","Restore a mailbox":"恢复邮箱","Restore one message":"恢复一封邮件","Restore started":"已开始还原","Restore the mailbox":"恢复该邮箱","Restore this archive over what is on this server now? Everything it restores is replaced.":"用这个存档覆盖服务器上现有的内容吗？还原的部分都会被替换。","Restricted delivery":"受限投递","Restricted: named domains only":"受限：仅限指定的域","Resume":"恢复","Resume deliveries to {0} now? The next slow-down reply opens a new window.":"现在恢复向 {0} 的投递？下一次减速回复将打开新的窗口。","Retention":"保留期","Retire due {0}":"停用时间 {0}","Retire the old selector now":"立即停用旧选择器","Retire the old selector of {0} now? Its record may then be removed.":"要立即停用 {0} 的旧选择器吗？之后可以删除它的记录。","Retired key":"已停用的密钥","Retired {0}":"停用于 {0}","Retiring key":"正在停用的密钥","Retry":"重试","Retry now":"立即重试","Revoke":"吊销","Revoke certificate {0} of {1}?":"要吊销 {1} 的证书 {0} 吗？","Revoke the key {0}? Programs holding it are refused from now on.":"吊销密钥 {0}？持有它的程序从现在起会被拒绝。","Revoke this permission?":"撤销此权限？","Revoked":"已吊销","Revoked: {0} session(s) ended, {1} connection(s) dropped.":"已吊销：结束了 {0} 个会话，断开了 {1} 个连接。","Rights":"权限","Role":"角色","Role (optional)":"角色（可选）","Roles":"角色","Rotate now":"立即轮换","Rotate the S/MIME authority of {0}? New certificates are signed by a new root, which every client must be given; the old root stays published until its last certificate expires.":"要轮换 {0} 的 S/MIME 证书颁发机构吗？新证书由新的根证书签名，必须将其分发给每个客户端；旧根证书会保持发布，直到它签发的最后一个证书过期。","Rotate the authority":"轮换证书颁发机构","Rotate the key on a schedule: a new key is generated, its record checked from the server's resolver, signing moved to it once the record has resolved for the propagation period, and the old selector retired after the retention period.":"按计划轮换密钥：生成新密钥，通过服务器的解析器检查其记录，在整个传播期内记录都能解析后将签名切换到新密钥，并在保留期结束后停用旧选择器。","Route deleted":"已删除路由","Route saved":"已保存路由","Routes":"路由","Rows":"行数","Rule":"规则","Rule deleted":"已删除规则","Rule name":"规则名称","Rule saved":"已保存规则","Rules":"规则","Rules of":"规则所属","Run a delivery pass":"运行一次投递","Run anti-spam on downloaded mail.":"对下载的邮件运行反垃圾邮件检查。","Run anti-virus on downloaded mail.":"对下载的邮件运行反病毒扫描。","Run the anti-spam checks on mail from this range.":"对来自此范围的邮件运行反垃圾邮件检查。","Run the anti-virus scan on mail from this range.":"对来自此范围的邮件运行反病毒扫描。","Run the search":"运行搜索","Run the tests":"运行测试","Running":"正在运行","Running version":"运行中的版本","Running…":"运行中…","Runs the server's own diagnostic tests: MX records, an outbound connection, connecting to this server, the data and backup directories, the IP ranges.":"运行服务器自带的诊断测试：MX 记录、一次出站连接、连接到此服务器、数据和备份目录、IP 范围。","S/MIME authority":"S/MIME 证书颁发机构","S/MIME authority created":"已创建 S/MIME 证书颁发机构","S/MIME authority rotated":"已轮换 S/MIME 证书颁发机构","SMTP authentication":"SMTP 身份验证","SMTP sessions":"SMTP 会话","SMTPDeliveryBindToIP does not bind this address - a delivery binds only the first entry of each family: unless a global rule binds it, no delivery leaves from it and nothing is counted.":"SMTPDeliveryBindToIP 不绑定此地址——投递只绑定每个地址族的第一项：除非有全局规则绑定它，否则不会从它发出任何投递，也不会计数。","SPF":"SPF","SPF aligned":"SPF 对齐","SPF tells receivers which servers may send this domain's mail; without it the mail is more likely to be refused or filed as spam.":"SPF 告诉收件方哪些服务器可以发送此域的邮件；没有它，邮件更容易被拒收或归入垃圾邮件。","SURBL server deleted":"已删除 SURBL 服务器","SURBL server saved":"已保存 SURBL 服务器","SURBL servers":"SURBL 服务器","Samples":"样本","Save":"保存","Save DNS blacklist":"保存 DNS 黑名单","Save IP range":"保存 IP 范围","Save OpenPGP settings":"保存 OpenPGP 设置","Save SURBL server":"保存 SURBL 服务器","Save Web Push settings":"保存 Web Push 设置","Save account":"保存帐户","Save anti-spam settings":"保存反垃圾邮件设置","Save anti-virus settings":"保存反病毒设置","Save backup settings":"保存备份设置","Save blocked attachment":"保存阻止的附件","Save blocked sender":"保存阻止的发件人","Save booking policy":"保存预订策略","Save bounce settings":"保存退信设置","Save cache settings":"保存缓存设置","Save complaint settings":"保存投诉设置","Save directory entry":"保存通讯录资料","Save domain":"保存域","Save domain list entry":"保存域列表条目","Save external account":"保存外部帐户","Save greylisting bypass entry":"保存灰名单绕过条目","Save greylisting white address":"保存灰名单白名单地址","Save group":"保存组","Save incoming relay":"保存传入中继","Save levels":"保存级别","Save list":"保存列表","Save list entry":"保存名单条目","Save logging settings":"保存日志记录设置","Save message indexing settings":"保存邮件索引设置","Save never-ban name":"保存永不封禁名称","Save policy":"保存策略","Save port":"保存端口","Save route":"保存路由","Save rule":"保存规则","Save schedule":"保存计划","Save scripting settings":"保存脚本设置","Save server settings":"保存服务器设置","Save the inbound webhook":"保存入站 Webhook","Save the permission":"保存权限","Save the subscription":"保存订阅","Save white-list address":"保存白名单地址","Saved: {0}":"已保存：{0}","Schedule":"计划","Scheduled check":"计划检查","Scope":"范围","Scope or role":"范围或角色","Score":"分数","Scripting":"脚本","Search":"搜索","Search addresses":"搜索地址","Search complaints":"搜索投诉","Search the archive":"搜索归档","Search this document":"在此文档中搜索","Search this view":"在此视图中搜索","Searched every held message on the server. Matches: {0}.":"已搜索服务器上的所有暂挂邮件。匹配：{0} 封。","Searched every held message on the server. Matches: {0}; shown here, the most recent: {1}.":"已搜索服务器上的所有暂挂邮件。匹配：{0} 封；此处显示最近的 {1} 封。","Searches":"搜索记录","Searching every held message on the server…":"正在搜索服务器上的所有暂挂邮件…","Security":"安全","Selector (optional)":"选择器（可选）","Send a daily digest to the members who choose it.":"向选择此项的成员发送每日摘要。","Send a domain-wide out-of-office reply. It answers only for accounts that have no vacation message of their own, and at most one reply answers any message.":"发送全域范围的外出回复。它只为没有自己外出邮件的帐户作答，且对任何一封邮件最多只回复一次。","Send a test event":"发送测试事件","Send an automatic reply (vacation message).":"发送自动回复（外出邮件）。","Send each account of this domain a daily message listing what the quarantine is holding for it, with a link that releases it. Off by default, and nothing is sent until the server's QuarantineDigestBaseUrl names the address those links point at.":"每天给本域名的每个账户发一封邮件，列出隔离区为它扣留的邮件，并附带释放链接。默认关闭；在服务器的 QuarantineDigestBaseUrl 指明这些链接指向的地址之前不会发送任何内容。","Send each copy from an address that names its member, so every bounce is matched to its member.":"从标明其成员的地址发送每份副本，使每次退信都能匹配到对应成员。","Sender":"发件人","Sender blocked":"发件人已拦截","Sender contains":"发件人包含","Sender domain":"发件人域","Senders outside this server get the domain's text even when the account has a reply of its own; colleagues still get the account's.":"即使账户有自己的回复，本服务器之外的发件人也会收到域的正文；同事仍收到账户的正文。","Sending stops at (%)":"停止发送于 (%)","Sends a day (0: the server's limits)":"每天发送数（0：服务器的限制）","Sends a minute (0: the server's limits)":"每分钟发送数（0：服务器的限制）","Sends as":"以此域名发送","Sends as (address or *@domain, optional)":"发件身份（地址或 *@domain，可选）","Sensitivity":"灵敏度","Sent":"发出的","Serial":"序列号","Server":"服务器","Server messages":"服务器消息","Server state":"服务器状态","Session":"会话","Sessions":"会话","Set by the environment":"由环境设置","Set by the environment, from a file":"由环境设置（来自文件）","Setting":"设置","Setting levels":"设置级别","Setting profiles":"配置方案列表","Settings":"设置","Shared folders":"共享文件夹","Shipped default":"出厂默认值","Shortens how long data is kept":"缩短数据的保留时间","Show":"显示","Show me around":"服务器导览","Show or hide this list":"显示或隐藏此列表","Show the changes":"显示更改","Show the headers":"显示邮件头","Sieve":"Sieve","Sign in with a passkey":"用通行密钥登录","Sign in with the hMailServer administrator credential. The password is exchanged once for a session cookie and is never kept by this page.":"使用 hMailServer 管理员凭据登录。密码只用于换取一次会话 Cookie，此页面绝不会保存密码。","Sign in with {0}":"使用 {0} 登录","Sign mail from the domain's aliases too, with the domain's selector - so every alias needs the record as well.":"也用该域的选择器为该域别名发出的邮件签名——因此每个别名也需要这条记录。","Sign out":"注销","Sign outgoing mail from this domain.":"为此域发出的邮件签名。","Sign-in link":"登录链接","Sign-in links, for each mailbox's owner to open once:":"登录链接,每个邮箱的所有者打开一次:","Sign-ins":"登录次数","Signals":"信号","Signature":"签名","Signed by":"签名者","Signed in, but the server did not answer: {0}":"已登录，但服务器没有响应：{0}","Signed out.":"已注销。","Signing moved to the next key.":"签名已切换到下一个密钥。","Since":"列入时间","Since (YYYY-MM-DD HH:MM:SS)":"起始（YYYY-MM-DD HH:MM:SS）","Since {0}":"自 {0} 起","Since {0}, until {1}; window {2} min; {3} deferred":"自 {0} 起，至 {1}；窗口 {2} 分钟；已推迟 {3} 封","Single sign-on did not complete: {0}":"单点登录未完成：{0}","Size":"大小","Skip the propagation period":"跳过传播期","Skip the tour":"跳过导览","Skip to the content":"跳到内容","Skipped":"已跳过","Skipped: {0}":"已跳过:{0}","Slowed destinations":"已减速的目标","Soft":"软退信","Source":"数据来源","Space saved":"节省的空间","Spam":"垃圾邮件","Spam blocked":"已拦截垃圾邮件","Spam traps":"垃圾邮件陷阱","Spared from auto-ban":"已豁免自动封禁","Stamp X-hMailServer-External on mail this domain receives from outside, which the webmail shows as a banner beside the sender.":"在此域从外部收到的邮件上加盖 X-hMailServer-External，网页邮件会把它显示为发件人旁边的横幅。","Standard":"标准","Standard rises over 30 days; gentle has half of each ceiling over 60; fast has twice each over 15. Every other provider gets five times the ceiling.":"标准方案在 30 天内逐步提高；温和方案每个上限减半，历时 60 天；快速方案每个上限翻倍，历时 15 天。其他服务商的上限为五倍。","Start":"开始","Start backup now":"立即开始备份","Start restore":"开始还原","Start with a domain: the part after the @ that this server accepts mail for. Add yours here.":"先从域开始：就是 @ 后面的那一部分，也就是此服务器为之接收邮件的域。在这里添加您自己的域。","Started":"已开始","Starting":"正在启动","State":"状态","State {0}":"状态 {0}","Status":"状态","Step {0} of {1}":"第 {0} 步，共 {1} 步","Stop encrypting":"停止加密","Stop encrypting the backup? The archives already written stay encrypted and still need their passphrase.":"停止加密备份吗？已经写好的存档仍然是加密的，仍然需要各自的口令。","Stop following":"停止跟踪","Stop notifications":"停止通知","Stop sending replies after a date.":"过了某个日期之后停止发送回复。","Stopped":"已停止","Stopping":"正在停止","Storage":"存储","Store":"存储","Store a key for an account":"为账户保存密钥","Store a key whose user ids do not carry the account's own address. A server administrator's decision, and the wrong answer for an ordinary mailbox.":"保存用户标识中不含该账户自身地址的密钥。这是服务器管理员的决定，对普通邮箱来说是错误的选择。","Store the key":"保存密钥","Stored an OpenPGP key for {0}":"已为 {0} 保存 OpenPGP 密钥","Stored on disk":"磁盘占用","Strict":"严格","Subject":"主题","Subject contains":"主题包含","Submissions in the last {0} days":"最近 {0} 天的发送","Subscription":"订阅","Subscription deleted":"订阅已删除","Subscription saved":"订阅已保存","Succeeded":"成功","Superseded":"已被取代","Suppressions ›":"抑制列表 ›","Switch due {0}":"切换时间 {0}","Switch encryption off":"关闭加密","Switch encryption on":"开启加密","Switch now":"立即切换","Switch off":"关闭","Switch on":"开启","TLS on the submission port":"提交端口上的 TLS","TLS reports":"TLS 报告","Take {0} off the suppression list? The next message to it will be sent.":"要将 {0} 从抑制列表移除吗？发往该地址的下一封邮件将会发出。","Target":"目标","Tell the reader when an outside sender has not written to this account before. It costs one database lookup for each message delivered here.":"当外部发件人此前从未写信给此账户时告知读者。这会为投递到这里的每封邮件带来一次数据库查询。","Test":"测试","Test the breach check endpoint":"测试泄露检查端点","That did not work. Sign in with the administrator password.":"没有成功。请用管理员密码登录。","That file could not be read.":"无法读取该文件。","That is the end of {0}. You can start it again whenever you like.":"“{0}”到此结束。您随时可以重新开始。","The DNS lookup failed. It is tried again on the next pass.":"DNS 查询失败。将在下一轮重试。","The HELO name's domain, on the domain white and black list":"HELO 名称的域，写入域白名单和黑名单","The HTML signature.":"HTML 格式的签名。","The IP range {0} takes a password only over TLS.":"IP 范围 {0} 仅通过 TLS 接受密码。","The IP range {0} takes a password without TLS on port {1}, so a client there that signs in before STARTTLS sends it across the network in the clear.":"IP 范围 {0} 在端口 {1} 上接受不经 TLS 的密码，因此那里在 STARTTLS 之前登录的客户端会以明文在网络上发送密码。","The IP range {0} takes a password without TLS, and port {1} has no TLS a client could start: give those ports a certificate and STARTTLS first, then require TLS for sign-in from the range.":"IP 范围 {0} 接受不经 TLS 的密码，而端口 {1} 没有客户端可以启动的 TLS：请先为这些端口配置证书和 STARTTLS，然后再要求从该范围登录时使用 TLS。","The IPv4 or IPv6 address mail leaves from. It must be configured on this host and named by SMTPDeliveryBindToIP or a rule; the server cannot check the first.":"邮件发出所用的 IPv4 或 IPv6 地址。它必须已在此主机上配置，并由 SMTPDeliveryBindToIP 或规则指定；前一项服务器无法检查。","The OpenPGP PUBLIC key: an armoured PGP PUBLIC KEY BLOCK, or base64 of its bytes. A SECRET key is refused here and everywhere else.":"OpenPGP 公钥：带 ASCII 铠装的 PGP PUBLIC KEY BLOCK，或其字节的 base64。私钥在这里和其他任何地方都会被拒绝。","The UTC date the warm-up began, YYYY-MM-DD: today or earlier. Empty is today.":"预热开始的 UTC 日期，YYYY-MM-DD：今天或更早。留空即为今天。","The Web Key Directory is off at the server: no key of any domain is served. Settings has the switch.":"服务器上的 Web Key Directory 已关闭：任何域的密钥都不会提供。开关在设置中。","The Windows domain.":"Windows 域。","The Windows user name.":"Windows 用户名。","The account the server runs as":"服务器运行所用的账户","The account's active Sieve filter, parsed before it is stored as the portal and ManageSieve parse one; empty removes it.":"此帐户当前生效的 Sieve 过滤器。保存之前会按门户和 ManageSieve 解析脚本的方式先行解析；留空即删除。","The address a password-reset link would be sent to, and the one-time recovery codes beside it. Only the masked form is ever shown, here or anywhere else: the address is another mailbox of the person's, and nothing an administrator does needs to read it. Clearing it ends every reset link in flight, and the person sets one again from the webmail.":"密码重置链接将发送到的地址，以及旁边的一次性代码。无论在这里还是别处，显示的始终只是掩码形式：该地址是本人的另一个邮箱，管理员所做的任何事都不需要读取它。清除它会终止所有仍在途中的重置链接；本人可从网页邮箱重新设置一个。","The address of an account to add":"要添加的帐户的地址","The address the copy goes to is required.":"需要副本发往的地址。","The address the mail is forwarded to.":"邮件转发到的地址。","The address this domain's DMARC aggregate and TLS-RPT reports are posted to, and the one address they are read from into the DMARC page: what the domain's rua= tags name. One address in a domain this server hosts, or empty, which is the default and reads nothing. Make the account or alias at it yourself; the server does not.":"此域的 DMARC 汇总报告和 TLS-RPT 报告的投递地址，也是读入 DMARC 页面的唯一地址：即该域 rua= 标签所指定的地址。可以是此服务器托管的某个域中的一个地址，或留空（默认值，不读取任何内容）。该地址对应的账户或别名需要您自行创建；服务器不会创建。","The address to stop sending to. An address this server hosts is refused.":"不再发送的地址。本服务器托管的地址会被拒绝。","The addresses a message sent to this list would reach, worked out at this moment. Nothing is stored: the query is run again for every message.":"此刻算出的、发往该列表的邮件会到达的地址。不会存储任何内容：每封邮件都会重新运行该查询。","The addresses this server sends from, checked once a day against the DNS block lists other servers use. Which addresses, and which lists, are on the Settings page.":"本服务器发信所用的地址，每天一次对照其他服务器使用的 DNS 阻止列表进行检查。检查哪些地址、哪些列表，见设置页面。","The administrator password":"管理员密码","The administrator password opens everything; a one-time code beside it keeps a leaked password from being enough.":"管理员密码可以打开一切；再加一个一次性代码，泄露的密码就不够用了。","The administrator signs in with a password alone.":"管理员仅凭密码登录。","The administrator's password is backed by a one-time code.":"管理员密码有一次性代码保护。","The alias address, in this domain.":"此域中的别名地址。","The answers that mean listed: 127.0.0.2, a range or a wildcard.":"表示已被列入的应答：127.0.0.2、一个范围或一个通配符。","The answers that mean listed; empty is any answer but a refusal code.":"表示已被列入的应答；留空表示除拒绝代码外的任何应答。","The archive holds no messages for this account.":"存档中没有此账户的邮件。","The archive: 0 none, 1 for the members, 2 public.":"存档：0 不存档，1 供成员查看，2 公开。","The authority could not be read.":"无法读取证书颁发机构。","The backup destination {0} does not exist on the server.":"备份目标 {0} 在服务器上不存在。","The backup writes the database and the message store to a folder; until one is set there is no backup.":"备份会把数据库和邮件存储写入一个文件夹；在设置目标之前，没有备份。","The chain is broken at row {0}. {1}":"链在第 {0} 行断开。{1}","The chain is intact. {0} row(s) checked.":"链完好。已校验 {0} 行。","The current passphrase":"当前密码短语","The database's record of its stored-secrets key could not be read, so whether this server holds the database's key cannot be told.":"无法读取数据库对其存储机密密钥的记录，因此无法判断此服务器是否持有数据库的密钥。","The database's second factors and [Settings] secrets are sealed under the stored-secrets key {0}, which this server does not hold, so they do not open here. Import it on the server from one that holds it: {1}.":"数据库中的第二因素和 [Settings] 机密是用存储机密密钥 {0} 封存的，而此服务器没有该密钥，因此在这里无法打开。请从持有该密钥的服务器将其导入到此服务器：{1}。","The delivery queue is empty. ✦":"投递队列是空的。 ✦","The documentation could not be loaded.":"无法加载文档。","The domain has no signing key yet.":"该域还没有签名密钥。","The domain is inactive, so the schedule starts no rotation.":"该域未启用，因此计划不会开始轮换。","The domain name. Changing it renames the domain and moves every account, alias and list with it.":"域名。更改它会重命名此域，并把其中的每个帐户、别名和列表一并迁移。","The domain's own certificate authority certifies the keys its accounts make in the webmail, so S/MIME works inside the organisation without buying a certificate; a person's private key never comes to the server. A client outside this webmail trusts it once the root is installed on it - by group policy, device management or by hand from the download here. It is managed here and over REST; the Control Panel shows none of it.":"该域自己的证书颁发机构为其账户在网页邮件中生成的密钥签发证书，因此无需购买证书即可在组织内部使用 S/MIME；个人的私钥永远不会到达服务器。此网页邮件之外的客户端在安装根证书后即信任它 - 通过组策略、设备管理，或从此处下载后手动安装。它在此处和通过 REST 管理；Control Panel 不显示其任何内容。","The domain's recovery key does not open this mailbox: its key is sealed to a recovery key the domain no longer has. The recovery below will be refused; the person's own password is the only way in.":"域的恢复密钥无法打开此邮箱：它的密钥被一个该域已不再拥有的恢复密钥封存。下面的恢复将被拒绝；本人自己的密码是唯一的进入方式。","The domain's recovery passphrase":"域的恢复密码短语","The domains this domain's accounts may exchange mail with: partner.example, or .example for the domain and everything beneath it, separated by commas or spaces, ASCII only. Empty, the default, restricts nothing. With a list, an outside sender not in a named domain is refused at RCPT TO, and an account here may send only to the named domains, its own domain and the postmaster; other domains this server hosts count as outside unless named. Each account follows this unless its own editor says restricted or exempt. An alias or a distribution list of this domain that reaches outside is the administrator's, and a restricted account may write to it.":"此域的账户可与之收发邮件的域：partner.example，或 .example 表示该域及其下所有子域，用逗号或空格分隔，仅限 ASCII。留空 (默认) 则不限制。设置列表后，不在指定域中的外部发件人会在 RCPT TO 时被拒绝，此处的账户只能发送到指定的域、自己的域和 postmaster；此服务器托管的其他域除非指定，否则视为外部。每个账户都遵循此设置，除非其自身的编辑器设为受限或豁免。 此域中通向外部的别名或分发列表由管理员掌管，受限账户可以向其发送。","The e-mail address it delivers to.":"它投递到的电子邮件地址。","The endpoint answered with {0} entries, not padded.":"端点返回了 {0} 个条目（未填充）。","The endpoint answered with {0} entries, padded.":"端点返回了 {0} 个条目（已填充）。","The endpoint could not be used: {0}":"无法使用端点：{0}","The first hour: what this server still needs before it is a mail server anybody can use, judged by the server itself. The record items look SPF, DKIM and DMARC up in DNS for every active domain.":"第一个小时：在成为任何人都能使用的邮件服务器之前，此服务器还缺什么，由服务器自己判断。记录项会为每个活动的域在 DNS 中查询 SPF、DKIM 和 DMARC。","The footer, as HTML. Empty means the plain text is used, with its line breaks turned into line breaks in HTML.":"页脚，HTML 形式。留空表示使用纯文本，并把其中的换行转换为 HTML 中的换行。","The footer, as plain text.":"页脚，纯文本形式。","The group's name, as a folder permission names it. At most 255 characters, and no two groups share one.":"文件夹权限指名时所用的组名。最多 255 个字符，并且没有两个组使用同一个名称。","The headers the recipients are read from, comma-separated.":"从中读取收件人的标头，以逗号分隔。","The highest address of the range.":"范围的最高地址。","The history is not being kept: MetricsHistoryDays is 0. Set it under Settings, Server.":"未保留历史：MetricsHistoryDays 为 0。请在设置、服务器下设置。","The hour of the local day the digests go out, 0 to 23. The sends are spread across that hour rather than fired at the top of it.":"摘要发出的本地时刻（小时），0 到 23。发送会分散在这一小时内，而不是在整点一齐发出。","The hour, 0 to 23, the digest is sent at.":"摘要发送的时间，0 到 23 点。","The installer is downloaded and verified":"安装程序已下载并验证","The key an account's second factor and the [Settings] secrets are sealed under in the database. It exists on the server alone, so a copy has to be exported and kept with the database backups.":"在数据库中封存账户第二因素和 [Settings] 机密所用的密钥。它只存在于服务器上，因此必须导出一份副本，并与数据库备份一起保存。","The key file was kept: {0}":"已保留密钥文件：{0}","The key sends as":"密钥的发件身份","The key that opens this domain's encrypted mailboxes when a password is lost. Its private half is kept wrapped by a passphrase this server never stores: keep the passphrase somewhere else. Replacing it needs the current passphrase.":"在密码丢失时打开此域加密邮箱的密钥。它的私有部分只以本服务器从不保存的密码短语包裹的形式保存：请把密码短语保存在别处。替换它需要当前的密码短语。","The last attempt failed at {0}: {1}":"上次尝试于 {0} 失败：{1}","The last check failed":"上次检查失败","The last install":"上次安装","The last move of this mailbox did not finish. The server's application log says what it left behind.":"此邮箱的上次迁移未完成。服务器的应用程序日志会说明它留下了什么。","The last replacement of this key did not finish: some accounts are still sealed to the key it replaced. They open with the current passphrase all the same; replace the key again, giving the current passphrase, to finish it.":"此密钥的上一次替换没有完成：有些账户仍被它所替换的密钥封存。它们仍可用当前密码短语打开；请输入当前密码短语再次替换密钥，以完成替换。","The list manager runs this list: people join and leave by mail and by page, and each member gets a copy of their own.":"列表管理器运行此列表：人们通过邮件和页面加入和退出，每个成员都会收到自己的一份副本。","The list's address, in this domain.":"此域中的列表地址。","The lists the desktop Control Panel edits in its collection editors, each a resource of its own. Every table and every editor below is built from the server's OpenAPI document, so a key a collection gains appears here on its own.":"桌面版 Control Panel 在其集合编辑器中编辑的那些列表，每一个都是独立的资源。下面的每个表格和每个编辑器都由服务器的 OpenAPI 文档生成，因此集合新增的键会自行出现在这里。","The lowest address of the range, IPv4 or IPv6.":"范围的最低地址，IPv4 或 IPv6 均可。","The lowest address of the range.":"范围的最低地址。","The mailbox keeps everything it is: its messages, folders, rules, filters and settings move with it. The new address may be at any domain this server holds.":"邮箱会保留它的一切：邮件、文件夹、规则、过滤器和设置都会随之迁移。新地址可以位于此服务器持有的任何域。","The mailbox was recovered: the new password opens it.":"邮箱已恢复：新密码可以打开它。","The mailbox's messages are stored encrypted to a key of its own, which opens when the person signs in with their password and closes when they have gone. It protects the files and their backups, not the mail from this server: while the key is open the server reads it. The domain needs a recovery key first, and IMAP and POP3 then accept only the account's own password.":"邮箱的邮件以其专属密钥加密保存，本人用自己的密码登录时密钥打开，离开后密钥关闭。它保护的是文件及其备份，而不是让邮件免于本服务器读取：密钥打开期间，服务器会读取邮件。域需要先有一个恢复密钥，之后 IMAP 和 POP3 只接受账户自己的密码。","The members, one address per line. Set when the list is made; the update does not change them.":"成员，每行一个地址。在创建列表时设定，更新操作不会改动它们。","The message has no text to show.":"此邮件没有可显示的文本。","The message itself":"邮件本身","The message must carry a DKIM signature that verifies. Known only after DATA, so the message is received first; needs DKIM verification switched on.":"邮件必须带有可验证的 DKIM 签名。仅在 DATA 之后得知，因此先接收邮件；需要开启 DKIM 验证。","The message must pass DMARC. Known only after DATA; needs DMARC switched on.":"邮件必须通过 DMARC。仅在 DATA 之后得知；需要开启 DMARC。","The message must pass SPF. Known at RCPT TO, so an entry requiring SPF alone decides there.":"邮件必须通过 SPF。在 RCPT TO 时即可得知，因此仅要求 SPF 的条目在该处决定。","The metric over time":"指标随时间的变化","The most accounts the domain may hold, when limited.":"设有限制时，此域最多可容纳的帐户数。","The most aliases the domain may hold, when limited.":"设有限制时，此域最多可容纳的别名数。","The most distribution lists the domain may hold, when limited.":"设有限制时，此域最多可容纳的邮件列表数。","The new key's file could not be read.":"无法读取新密钥的文件。","The new key's record has not been checked yet.":"尚未检查新密钥的记录。","The new key's record was not found. Publish it.":"未找到新密钥的记录。请发布它。","The next key was cancelled.":"已取消下一个密钥。","The next rotation starts when the interval has passed.":"间隔期满后开始下一次轮换。","The old selector is kept for mail still on its way.":"旧选择器会保留，供仍在途中的邮件使用。","The old selector was retired.":"旧选择器已停用。","The one character that separates the address from its tag.":"把地址与其标记分开的那一个字符。","The one password for all of the mailboxes was shown when the sample was made and was not kept; remove the sample and make it again to be given another.":"所有邮箱共用的密码在创建样例时显示过一次，并未保存；如需新密码，请先移除样例再重新创建。","The password at the remote server. Accepted here and never shown.":"远程服务器上的密码。可在此输入，但绝不显示。","The password could not be checked against published data breaches just now, and this server is set to refuse a change it cannot check. Try again later.":"目前无法将该密码与公开的数据泄露进行比对，而本服务器被设置为拒绝无法检查的更改。请稍后再试。","The password for the relay. Accepted here and never shown.":"中继的密码。可在此输入，但绝不显示。","The path of the private key file on the server.":"私钥文件在服务器上的路径。","The percentage of its limit at which an account stops sending, before it stops receiving; 0 is never and -1 uses the server's value.":"账户停止发送时所处的限额百分比，先于停止接收；0 为从不，-1 使用服务器的值。","The person's first name.":"此人的名。","The person's last name.":"此人的姓。","The plain-text signature.":"纯文本签名。","The profile":"配置方案","The published record does not carry the new key. Correct it.":"已发布的记录不包含新密钥。请更正它。","The record is propagating.":"记录正在传播。","The records were checked.":"记录已检查。","The recovery address was cleared.":"恢复地址已清除。","The recovery codes were cleared.":"恢复代码已清除。","The recovery key was saved.":"恢复密钥已保存。","The relay requires authentication.":"此中继需要身份验证。","The relay's port; 0 is 25.":"中继的端口；0 表示 25。","The remote server.":"远程服务器。","The reply's subject.":"回复的主题。","The reply's text.":"回复的正文。","The report holds no records.":"此报告不包含任何记录。","The reports":"报告列表","The root's private key does not open on this machine - the database or a backup came from another machine. Rotate the authority before it signs again.":"根证书的私钥无法在此计算机上打开 - 数据库或备份来自另一台计算机。请先轮换证书颁发机构，再让它签名。","The rotation could not be read.":"无法读取轮换状态。","The rule is off. Nothing it covers is copied until it is on again.":"规则已关闭。在重新开启之前，它所涵盖的邮件都不会被复制。","The rule is on.":"规则已开启。","The schedule is the settings ScheduledBackupTime, ScheduledBackupIntervalMinutes, ScheduledBackupKeepCount and ScheduledBackupMaxAgeDays, under Scheduled backups in the Control Panel or at PUT /api/v1/settings/ini/ followed by the name; a restore is below.":"计划任务由 ScheduledBackupTime、ScheduledBackupIntervalMinutes、ScheduledBackupKeepCount、ScheduledBackupMaxAgeDays 这些设置决定，可在 Control Panel 的“计划备份”中或通过 PUT /api/v1/settings/ini/ 加设置名更改；还原在下方。","The score at which a message is deleted; -1 is the server's own value.":"删除邮件的分值；-1 表示使用服务器自身的值。","The score at which a message is marked as spam; -1 is the server's own value.":"把邮件标记为垃圾邮件的分值；-1 表示使用服务器自身的值。","The script parses.":"脚本语法正确。","The search hides {0} of the messages this acts on ({1} in all).":"此操作涉及的邮件中有 {0} 封被搜索隐藏（共 {1} 封）。","The selector, which names the DNS record the public key is published under.":"选择器，它指明公钥发布在哪条 DNS 记录下。","The sender was told it was accepted, so nothing will retry and there is no other copy.":"发件人已被告知邮件已被接受，因此不会重试，也没有其他副本。","The sender's address, on the server's allow and block list":"发件人的地址，写入服务器的允许与拦截名单","The sender's domain, on the domain white and black list":"发件人的域，写入域白名单和黑名单","The sender, with wildcards; empty is any.":"发件人，可使用通配符；留空表示任意。","The sends a minute and a day are whole numbers.":"每分钟和每天的发送数须为整数。","The server":"服务器","The server did not answer after the restart. Sign in again when it is back.":"重启之后服务器没有响应。等它恢复后请重新登录。","The server drains first: the listeners close and the delivery queue pauses while the sessions and deliveries in flight finish, then the service stops, installs and starts again.":"服务器先排空：关闭监听器并暂停投递队列，等待进行中的会话和投递完成；然后服务停止、安装并重新启动。","The server is draining. A reinitialize ends maintenance mode: the listeners open again and delivery resumes, and this browser session ends. Reinitialize the server now?":"服务器正在排空。重新初始化会结束维护模式：侦听器重新打开，投递恢复，此浏览器会话随之结束。现在重新初始化服务器吗？","The server reads mail from anybody on the internet; the less its account may do, the less a flaw in it is worth to an attacker.":"服务器会读取互联网上任何人发来的邮件；它的账户能做的事越少，其中的漏洞对攻击者就越没有价值。","The server reinitialized and took the saved settings, which ended this session. Sign in again.":"服务器已重新初始化并采用了保存的设置，此会话随之结束。请重新登录。","The server reinitialized and took the settings that waited for a reinitialize; {0} still wait for a service restart. That ended this session. Sign in again.":"服务器已重新初始化，并采用了等待重新初始化的设置；仍有 {0} 项等待重启服务。本次会话因此结束。请重新登录。","The server runs as root, so a flaw reachable through SMTP, IMAP or POP3 would have full control of the machine. The packages run it as a user of its own.":"服务器以 root 运行，因此可通过 SMTP、IMAP 或 POP3 触及的漏洞将完全控制这台机器。软件包会以专用用户运行它。","The service runs as LocalSystem, the most privileged account on the machine, so a flaw reachable through SMTP, IMAP or POP3 would have full control of it. The virtual account a new installation uses contains that; running the installer again, or the Control Panel, moves the service to it.":"服务以 LocalSystem 运行，这是本机权限最高的账户，因此可通过 SMTP、IMAP 或 POP3 触及的漏洞将完全控制这台计算机。新安装使用的虚拟账户可以限制这一点；再次运行安装程序或使用 Control Panel 即可把服务迁移到该账户。","The service runs as {0}.":"服务以 {0} 运行。","The services restarted, which ended this session. Sign in again.":"服务已重启，此会话随之结束。请重新登录。","The session ended.":"会话已结束。","The session ended. Sign in again.":"会话已结束。请重新登录。","The settings this version ships with were chosen on {0}, and no profile applied; any of the four can still be compared with this server.":"已于 {0} 选择此版本附带的设置，未应用任何配置方案；仍可将四个方案中的任何一个与此服务器比较。","The shipped settings are kept; no profile is applied.":"已保留出厂设置；未应用任何配置方案。","The signing algorithm.":"签名算法。","The size of the keys the rotation generates: 2048, 3072 or 4096.":"轮换生成的密钥大小：2048、3072 或 4096。","The spam score a listing adds.":"被列入时增加的垃圾邮件分值。","The spam score the sender adds; the desktop's 100 crosses every threshold.":"此发件人增加的垃圾邮件分值；桌面版的 100 会越过所有阈值。","The stored-secrets key":"存储机密密钥","The stored-secrets key {0} has never been exported. Export it on the server with {1} and keep the file with the database backups: a database restored without it opens no second factor and no [Settings] secret.":"存储机密密钥 {0} 从未导出过。请在服务器上使用 {1} 将其导出，并将该文件与数据库备份一起保存：没有它而恢复的数据库无法打开任何第二因素或任何 [Settings] 机密。","The stored-secrets key {0} was exported on {1}; keep that file with the database backups.":"存储机密密钥 {0} 已于 {1} 导出；请将该文件与数据库备份一起保存。","The subject for senders whose address belongs to this server; empty means the subject above.":"发给地址属于本服务器的发件人的主题；留空表示使用上面的主题。","The test event was queued for {0} subscription(s).":"测试事件已为 {0} 个订阅加入队列。","The text for senders whose address belongs to this server; empty means the text above, and leaving the text above empty makes the reply internal-only.":"发给地址属于本服务器的发件人的正文；留空表示使用上面的正文，而将上面的正文留空则使回复仅限内部。","The text for senders whose address belongs to this server; empty means the text above. It never leaves the server, so it can say more.":"发给地址属于本服务器的发件人的正文；留空表示使用上面的正文。它永远不会离开服务器，因此可以多说一些。","The text of the refusal.":"拒绝时返回的文字。","The text put at the front of the subject. Empty is the shipped [EXTERNAL]. At most 100 characters, so a domain whose readers do not read English can say it in the language they do.":"加在主题前面的文字。留空表示随附的 [EXTERNAL]。最多 100 个字符，这样读者不读英文的域可以用他们所读的语言来写。","The user name at the remote server.":"远程服务器上的用户名。","The user name for the relay.":"中继的用户名。","The warm-up is complete: nothing is held or counted.":"预热已完成：不再暂缓也不再计数。","The warm-up schedules could not be read; the rest of the page is shown.":"无法读取预热计划；页面其余部分照常显示。","The warning's subject; empty uses the QUOTA_WARNING_SUBJECT server message.":"警告的主题；留空则使用服务器消息 QUOTA_WARNING_SUBJECT。","The warning's text, with %MACRO_MAILBOX%, %MACRO_QUOTA%, %MACRO_USED% and %MACRO_PERCENT%; empty uses the QUOTA_WARNING server message.":"警告的正文，可用 %MACRO_MAILBOX%、%MACRO_QUOTA%、%MACRO_USED% 和 %MACRO_PERCENT%；留空则使用服务器消息 QUOTA_WARNING。","The watch is off. reputation_watch_enabled on the Settings page turns it on.":"监视已关闭。设置页面的 reputation_watch_enabled 可将其开启。","The zone the connecting address is looked up in.":"用来查询连接地址的区域。","The zone the domains in a message are looked up in.":"用来查询邮件中各域的区域。","The {0} profile could not be applied in full on {1}: some of its settings were not written. Put back what it wrote, or keep it, and apply it again.":"{0} 配置方案于 {1} 未能完整应用：其部分设置未写入。请恢复它写入的内容或予以保留，然后重新应用。","The {0} profile is applied. What it replaced is kept, and can be put back.":"{0} 配置方案已应用。它所替换的值已保留，可以恢复。","The {0} profile was applied and then reverted on {1}; the settings are the ones it replaced.":"{0} 配置方案已应用，并于 {1} 被恢复；当前设置即它所替换的设置。","The {0} profile was applied on {1}.":"{0} 配置方案已于 {1} 应用。","The {0} profile was applied on {1}; its way back was discarded and its settings kept.":"{0} 配置方案已于 {1} 应用；其恢复记录已被放弃，设置予以保留。","Theme: dark":"主题：深色","Theme: light":"主题：浅色","Theme: the system's choice":"主题：跟随系统","Then":"动作","These are the ports the server listens on. The submission port, 587, is the one your own people send through.":"这些是服务器侦听的端口。提交端口 587 是您自己的用户发信时使用的端口。","This action takes no parameters.":"此动作不带参数。","This browser cannot make a passkey: it does not offer WebAuthn, or the page was not opened over HTTPS.":"此浏览器无法创建通行密钥：它不支持 WebAuthn，或者页面不是通过 HTTPS 打开的。","This domain does not publish keys, so nothing of it is served whatever an account says. Edit the domain to turn it on.":"本域不发布密钥，因此无论账户怎么设置，本域都不会提供任何内容。请编辑该域以开启。","This domain has no S/MIME authority.":"此域没有 S/MIME 证书颁发机构。","This mailbox cannot be moved at the moment: {0}":"此邮箱当前无法迁移：{0}","This password appears in a published data breach, so it would be among the first tried against this account. Choose a different one.":"此密码出现在一次公开的数据泄露中，因此会是针对此账户最先尝试的密码之一。请另选一个。","This role reaches none of the pages of the Deck. Ask an administrator for one that does.":"此角色无法访问 Deck 的任何页面。请向管理员申请可以访问的角色。","This server answers no setting levels for this record.":"此服务器没有为该记录提供设置级别。","This server could not read its domain table, so it cannot say whether the sample is here. Nothing is offered until it can.":"本服务器无法读取域表，因此无法说明样例是否存在。在能读取之前不提供任何操作。","This server has no default for it":"本服务器没有它的默认值","This server holds {0} accounts, so it is in service: a profile is offered to a new server, and any of the four can still be compared with this one.":"此服务器有 {0} 个账户，因此正在使用中：配置方案是为新服务器提供的，但仍可将四个方案中的任何一个与此服务器比较。","This server now":"此服务器当前值","This service runs as {0}, which cannot run an installer, so updates are installed by an administrator at the server: open the hMailServer Control Panel on {1} and click Install update on its Status page. It asks Windows for permission once, checks the installer itself, and installs {2}.":"此服务以无法运行安装程序的 {0} 身份运行，因此更新须由管理员在服务器上安装：请在 {1} 上打开 hMailServer Control Panel，并在其“状态”页上点击“安装更新”。Windows 会请求一次许可，检查安装程序后安装 {2}。","Tick the confirmation first: this profile closes a listener, trusts an address range, turns a filter or a check off, or shortens how long data is kept here.":"请先勾选确认：此配置方案会在此关闭侦听器、信任某个地址范围、关闭某个过滤器或检查，或缩短数据的保留时间。","Time":"时间","Time zone of the working hours":"工作时间的时区","To":"收件人","To (YYYY-MM-DD)":"截止（YYYY-MM-DD）","Top recipients":"收信最多的地址","Top senders":"发信最多的地址","Total":"合计","Total over the window":"时段内总计","Tour":"导览","Traffic":"流量","Trap":"陷阱","Trap added: {0}":"已添加陷阱：{0}","Trap removed: {0}":"已删除陷阱：{0}","Trusts an address range":"信任某个地址范围","Turns a filter or a check off":"关闭某个过滤器或检查","Type":"类型","Type an account address and press Show. ✦":"输入帐户地址并按 显示。✦","Type an address first.":"请先输入地址。","Unexpected answer":"意外的应答","Unfold this group":"展开此组","Unknown":"未知","Unlock":"解锁","Unlocked: {0}":"已解锁：{0}","Until (YYYY-MM-DD HH:MM:SS)":"截止（YYYY-MM-DD HH:MM:SS）","Up to date":"已是最新","Update":"更新","Update with":"更新命令","Upper IP":"最高 IP","Use the domain's signature only if the account has none, overwrite the account's signature, or append to it.":"仅在帐户没有签名时使用域的签名，或覆盖帐户的签名，或追加到其后。","Use the message's own Date header as its date rather than the time of the download.":"以邮件自身的 Date 标头作为它的日期，而不是下载时的时间。","User name":"用户名","Username":"用户名","Valid":"有效","Value":"值","Verification":"收件人核验","Verified":"已验证","Verify the chain":"校验链","Virus":"病毒","Viruses":"病毒","Viruses removed":"已清除病毒","Volume":"处理量","Waiting for approval":"等待批准","Waiting for confirmation":"等待确认","Waiting for the DNS record":"正在等待 DNS 记录","Waiting for the next line…":"正在等待下一行…","Waiting for the old selector to be retired.":"正在等待旧选择器停用。","Waiting for the old selector to retire":"等待旧选择器停用","Warm-up":"预热","Warm-up schedule deleted":"预热计划已删除","Warm-up schedule saved":"预热计划已保存","Warn the mailbox owner at this percentage of their limit; 0 warns nobody and -1 uses the server's QuotaWarningPercent.":"在达到限额的此百分比时警告邮箱所有者；0 不警告任何人，-1 使用服务器的 QuotaWarningPercent。","Warning":"警告","Warning: {0} is a public suffix. An entry for it covers every domain registered beneath it, which is almost never what is meant.":"警告：{0} 是一个公共后缀。为它写入的条目会覆盖在它之下注册的每一个域，这几乎从来都不是本意。","Warns at (%)":"警告于 (%)","Web Key Directory":"Web Key Directory","Web Push":"网页推送（Web Push）","Webhooks":"Webhook","What an account CREATED in this domain from now on starts with. It never changes an account that already exists, so switching it on publishes nobody who is already here.":"从现在起在本域中创建的账户的初始状态。它从不改变已经存在的账户，因此开启它不会发布任何已在此处的人。","What cannot be answered":"无法回答的内容","What each domain publishes for this server: SPF and DMARC starting points, the DKIM keys the rotation keeps or wants, the SRV records that let a phone find the server by the address alone, and the TLSA records for DANE. Copy them to your DNS; the checklist and the DKIM rotation say when they are seen.":"每个域为此服务器发布的内容：SPF 和 DMARC 起点、轮换保留或需要的 DKIM 密钥、让手机仅凭地址就能找到服务器的 SRV 记录，以及用于 DANE 的 TLSA 记录。将它们复制到您的 DNS；检查清单和 DKIM 轮换会告知何时可见。","What each of these settings is for the accounts of this domain that hold no value of their own, and where it came from. Tick one to give the domain a value of its own; untick it to take the server's. A setting kept in a field above is edited there.":"对于此域中没有自己值的帐户，每项设置的值及其来源。勾选一项可为域指定自己的值；取消勾选则采用服务器的值。在上方有专用字段的设置在那里编辑。","What each of these settings is for this account, and where it came from. Tick one to give the account a value of its own; untick it to take its domain's. A setting kept in a field above is edited there.":"此帐户每项设置的值及其来源。勾选一项可为帐户指定自己的值；取消勾选则采用其域的值。在上方有专用字段的设置在那里编辑。","What everyone at this domain sees beside the name in the webmail's Directory page, in their To field and in the read-only address book a phone syncs. The note is yours alone and is never answered to a reader.":"此域中的所有人在网页邮件的通讯录页面、收件人栏以及手机同步的只读通讯录中，在姓名旁看到的内容。备注只属于你，永远不会返回给读者。","What is done with a message from outside whose sender's display name is an active account's person name or a protected person's, or whose sender domain is one edit or one look-alike character from a domain this server hosts or a protected partner: 0 is off, the default, and nothing is read; 1 flags the recipient's copy with a header the webmail shows as a warning; 2 holds the copy in the quarantine as a spam verdict would, released as spam is and not checked again. A sender the recipient marked safe is exempt, and so is a sender domain that is itself hosted here or a partner.":"对于来自外部、发件人显示名称是某个有效账户或受保护人员的姓名，或发件人域与本服务器承载的域或受保护合作方仅相差一次编辑或一个形似字符的邮件，如何处理：0 为关闭（默认），不读取任何内容；1 用一个网页邮箱显示为警告的邮件头标记收件人的副本；2 像垃圾邮件判定那样将副本扣留在隔离区，像垃圾邮件一样放行且不再检查。收件人标记为安全的发件人不受影响，本服务器承载的域或合作方作为发件人域时也不受影响。","What is sent":"发送什么","What it cannot do for you":"它无法替您完成的事项","What it is for":"用途","What the device is called":"设备的名称","What the pattern is compared with: the envelope sender's domain, the HELO name, or either.":"模式与什么比较：信封发件人的域、HELO 名称或两者之一。","What this domain does to a message":"此域对邮件所做的处理","What this server keeps":"此服务器保留的数据","What was done":"所做处理","What will be written:":"将写入的内容：","When":"条件","When it stops mattering, as YYYY-MM-DD HH:MM:SS.":"失效时间，格式为 YYYY-MM-DD HH:MM:SS。","Where it goes":"发往何处","Where mail FROM this domain leaves through. Empty means the domain has no opinion and the server-wide SMTP relayer applies; a route still wins over both, because a route is a statement about the destination.":"来自此域的邮件由何处发出。留空表示此域不作主张，改用服务器范围的 SMTP 中继；而路由仍然胜过这两者，因为路由是关于目的地的规定。","Where replies go: 0 the sender, 1 the list.":"回复发往何处：0 发件人，1 列表。","Where the copy goes":"副本发往何处","Whether a session is refused from any address but the one it began on: 0 takes the server-wide answer, 1 is on, 2 is off. With it on, somebody whose address changes underneath them - a phone moving between wi-fi and a mobile network - is signed out.":"会话是否被拒绝于除其开始时的地址之外的任何地址：0 采用全服务器的答案，1 为开，2 为关。开启时，地址在脚下改变的人——在 wi-fi 与移动网络之间切换的手机——会被登出。","Whether mail to the alias is delivered.":"是否投递发往此别名的邮件。","Whether signing in again from a client that already has a session ends the earlier one: 0 takes the server-wide answer, 1 is on, 2 is off.":"从已经拥有会话的客户端再次登录时是否结束较早的那个会话：0 采用全服务器的答案，1 为开，2 为关。","Whether the domain receives mail and its accounts can sign in.":"此域是否接收邮件、其帐户是否可以登录。","Whether the entry stops mattering at a time.":"条目是否在某个时间失效。","Whether the pattern is matched against the envelope sender's domain, the HELO host, or either.":"模式是与信封发件人的域名、HELO 主机还是二者之一进行匹配。","Which countries may sign in to this domain's accounts, on any protocol. Empty judges nothing; allow:GB,IE admits only those countries; block:CN,RU refuses those. It needs the server's geographic database to be configured, and an address in the exempt ranges - the loopback address and the private networks - is never judged.":"哪些国家/地区可以登录此域的账户，适用于所有协议。留空则不作判定；allow:GB,IE 仅允许这些国家/地区；block:CN,RU 拒绝这些国家/地区。需要先配置服务器的地理数据库；豁免范围内的地址（回环地址和专用网络）永远不会被判定。","Which way":"哪个方向","White skips greylisting and the score's refusals while every test still runs and logs; black is refused at MAIL FROM before any test runs.":"白名单跳过灰名单和按分数的拒绝，而每项测试仍会运行并记录；黑名单在任何测试运行之前就在 MAIL FROM 时被拒绝。","White-list address deleted":"已删除白名单地址","White-list address saved":"已保存白名单地址","Whitelist and release":"加入白名单并放行","Whitelist the checked messages' senders, then release":"将已勾选邮件的发件人加入白名单，然后放行","Whitelist the sender, then release":"将发件人加入白名单，然后放行","Whitelist this group's senders, then release":"将此组的发件人加入白名单，然后放行","Whitelisted. List entries: {0}. Messages released: {1}.":"已加入白名单。名单条目数：{0}。已放行邮件数：{1}。","Who":"操作者","Who complained":"投诉人","Who may book: addresses, @domains and group names, one to a line. Empty lets everyone in this organisation book, and nobody from outside.":"可预订者：地址、@域名和组名，每行一个。留空则本组织内的所有人都可预订，外部人员均不可。","Who may join: 0 nobody (you add the members), 1 anyone who confirms by mail, 2 anyone the owner then approves.":"谁可以加入：0 任何人都不可以（由你添加成员），1 通过邮件确认的任何人，2 由所有者批准的任何人。","Who may reach an account's folders, by folder: the rights a client sets with SETACL. Type an account address and press Show, then pick a folder.":"谁可以按文件夹访问某账户的文件夹：客户端用 SETACL 设置的权限。输入账户地址并按显示，然后选择一个文件夹。","Who may send":"可发送者","Who may send to this list: public is anyone, membership the members, announcement the one sender named below, domain_members the accounts of the domain.":"谁可以向此列表发送：public 表示任何人，membership 表示成员，announcement 表示下面指定的那一个发件人，domain_members 表示该域的帐户。","Who reports":"报告方","Who runs the list: requests to join and bounce notices go here. Empty is the moderator.":"谁运行此列表：加入请求和退信通知发到这里。留空表示审核人。","Who sends as {0}":"谁在以 {0} 的名义发送","Whose mail":"谁的邮件","Why":"原因","Why (optional)":"原因（可选）","Why the entry is there.":"设置该条目的原因。","Why, for whoever reads the list next.":"原因，留给下一个查看列表的人。","Windows directory":"Windows 目录","Words":"关键词","Words that must all be found":"必须全部找到的关键词","Work telephone":"工作电话","Working days":"工作日","Working hours end (HH:MM)":"工作时间结束 (HH:MM)","Working hours only":"仅限工作时间","Working hours start (HH:MM)":"工作时间开始 (HH:MM)","YYYY-MM-DD HH:MM:SS on the server's clock, or a date alone for midnight; required when the range expires, and taken only then.":"按服务器时钟的 YYYY-MM-DD HH:MM:SS；只写日期则表示当日零点。范围设有到期时间时必填，也只有那时才采用。","YYYY-MM-DD; empty means today.":"YYYY-MM-DD；留空表示今天。","Your domains live in this list. Opening one gives you its accounts, aliases and distribution lists.":"您的域都在此列表中。打开其中一个，就能看到它的帐户、别名和邮件列表。","Your new key":"您的新密钥","Zero-access mailbox":"零访问邮箱","and {0} more":"以及另外 {0} 个","answered":"已回复","anyone":"任何人","anywhere":"任何位置","bounced":"已退回","cancelled":"已取消","cannot encrypt":"无法加密","checked {0}":"检查于 {0}","clean":"安全","collecting":"收取中","counts towards nothing":"不计入任何统计","day 1 was {0}":"第 1 天为 {0}","dead-lettered":"已放弃投递","delete after the download":"下载后删除","delivered":"已投递","destinations":"目标","does not send":"不发送","done":"完成","encrypted":"已加密","error":"错误","every domain":"所有域","every event":"所有事件","every recipient":"所有收件人","example.com for that domain alone, or .example.com for the domain and everything beneath it.":"example.com 只匹配该域，.example.com 匹配该域及其下的一切。","expired":"已过期","expires {0}":"到期 {0}","failed":"失败","finished":"已结束","group":"组","id {0}":"ID {0}","is already on the list":"已在名单中","is on the list the other way, and will be changed to allow":"以相反的方式列在名单中，将被改为允许","is on the list the other way, and will be changed to block":"以相反的方式列在名单中，将被改为拦截","keep on the server":"保留在服务器上","keep {0} days":"保留 {0} 天","kept":"已保留","left unchanged unless filled":"不填写则保持不变","listed since {0}":"自 {0} 起列入","mail.example.net for that name alone, or .example.net for the name and every name beneath it. An address is spared only when its reverse name also resolves back to it.":"mail.example.net 仅表示该名称，.example.net 表示该名称及其下的所有名称。只有当地址的反向名称也正向解析回该地址时，该地址才会被豁免。","malicious":"恶意","min":"分钟","new":"新建","no":"否","no ceiling":"无上限","none":"无","not submitted yet":"尚未提交","not submitted: too large or unreadable":"未提交：过大或无法读取","nothing yet":"暂无","only for an encrypted archive":"仅用于加密的存档","only if the key is encrypted":"仅当密钥已加密时","paused":"已暂停","pending":"等待中","posted and delivered":"推送并投递","posted only":"仅推送","probing":"探测中","queued":"排队中","read-only":"只读","required":"必填","restart":"需重启","running":"运行中","submitted, waiting for the verdict":"已提交，等待判定","suspicious":"可疑","tenants":"租户","the account's own domain":"该帐户自己的域","the new release":"新版本","until {0}":"直到 {0}","user, domain or server. Who is asking decides what it may become: a key restricted to named domains may set user or domain only.":"user、domain 或 server。能设成什么由请求方决定：受限于指定域的密钥只能设为 user 或 domain。","will be added":"将被添加","write-only":"只写","yes":"是","{0} + {1} more":"{0} + 另外 {1} 个","{0} - {1}":"{0} - {1}","{0} KB":"{0} KB","{0} a minute, {1} a day":"每分钟 {0}，每天 {1}","{0} added to the group":"已将 {0} 添加到组","{0} address":"{0} 个地址","{0} addresses":"{0} 个地址","{0} cannot run an installer, so updates are checked, downloaded and verified here and installed by an administrator with Install update in the Control Panel on this server.":"{0} 无法运行安装程序，因此更新在这里检查、下载并验证，再由管理员通过此服务器上 Control Panel 中的“安装更新”安装。","{0} closed. It picks up where you left off.":"“{0}”已关闭。它会从您上次停下的地方继续。","{0} complaint(s) in {1} message(s) over {2} days - too little sent for a rate to mean anything.":"{2} 天内 {1} 封邮件中有 {0} 件投诉：发送量太少，比率没有意义。","{0} complaint(s) in {1} message(s) over {2} days: {3} in a million.":"{2} 天内 {1} 封邮件中有 {0} 件投诉：每百万封 {3} 件。","{0} connections":"{0} 个连接","{0} copied, {1} skipped":"已复制 {0},已跳过 {1}","{0} days":"{0} 天","{0} dead-lettered":"{0} 个已放弃投递","{0} deferred":"已推迟 {0} 个","{0} delivered, {1} removed":"{0} 个已投递，{1} 个已移除","{0} domains, none of them active.":"{0} 个域，没有一个处于活动状态。","{0} done, {1} need action, {2} cannot be told, {3} not needed.":"已完成 {0} 项，需要处理 {1} 项，无法判断 {2} 项，不需要 {3} 项。","{0} dropped":"{0} 个已丢弃","{0} hard, {1} soft bounces":"硬退信 {0} 次，软退信 {1} 次","{0} hits cleared":"已清空 {0} 条记录","{0} is here: {1}, the list {2}, and one rule that files invoices.":"{0} 已存在：{1}、列表 {2}，以及一条归档发票的规则。","{0} is the sample domain and is not counted here; remove it when you are done with it.":"{0} 是样例域，此处不计入；用完后请将其移除。","{0} job(s) added":"已添加 {0} 个任务","{0} jobs: {1} done, {2} failed":"{0} 个任务:{1} 完成,{2} 失败","{0} kept":"{0} 已保留","{0} made: {1} mailboxes, and {2} messages on their way":"已创建 {0}：{1} 个邮箱，{2} 封邮件正在投递","{0} message(s) past the retention window were removed.":"已移除 {0} 封超出保留窗口的邮件。","{0} messages":"{0} 封邮件","{0} messages cannot be listed and will be left where they are. The first reason: {1}":"{0} 封邮件无法列入名单，将保留原状。首个原因：{1}","{0} messages held.":"已暂挂 {0} 封邮件。","{0} min":"{0} 分钟","{0} more active domains were not looked up.":"另有 {0} 个活动的域未查询。","{0} must be a whole number.":"{0} 必须是整数。","{0} of its {1} settings would change on this server.":"此服务器上其 {1} 项设置中将有 {0} 项发生更改。","{0} of {1} held messages are shown, oldest first.":"显示 {1} 封暂扣邮件中的 {0} 封，最早的在前。","{0} of {1} messages":"{0} / {1} 封邮件","{0} of {1} settings are not what this version ships with.":"{1} 项设置中有 {0} 项与本版本出厂设置不同。","{0} of {1} sources are shown, most messages first.":"共 {1} 个来源，显示 {0} 个，按邮件数量从多到少排列。","{0} read, {1} matched, {2} not searched":"已读 {0}，匹配 {1}，未搜索 {2}","{0} removed from the group":"已将 {0} 从组中移除","{0} removed: {1} mailboxes and {2} messages":"已移除 {0}：{1} 个邮箱和 {2} 封邮件","{0} returned":"{0} 已退回","{0} saved setting(s) wait for a reinitialize, and {1} for a service restart.":"已保存的设置中有 {0} 项等待重新初始化，{1} 项等待服务重启。","{0} saved setting(s) wait for a reinitialize.":"已保存的设置中有 {0} 项等待重新初始化。","{0} saved setting(s) wait for a service restart.":"已保存的设置中有 {0} 项等待服务重启。","{0} sent":"{0} 个已发送","{0} session(s) to this domain succeeded and {1} failed, by what the senders that keep TLS-RPT reported over the window.":"根据维护 TLS-RPT 的发送方在此期间的报告，到此域的会话有 {0} 个成功、{1} 个失败。","{0} setting saved":"已保存 {0} 设置","{0} settings saved":"已保存 {0} 设置","{0} stops here: the next thing it points at is not on this screen.":"“{0}”到此为止：它接下来要指向的内容不在此屏幕上。","{0} to {1} of {2}":"第 {0} - {1} 条，共 {2} 条","{0} unused recovery codes.":"有 {0} 个未使用的恢复代码。","{0} verdict(s) forgotten":"已清除 {0} 条结果","{0} waiting":"{0} 个等待中","{0} — DMARC and TLS reports":"{0} — DMARC 与 TLS 报告","{0} — OpenPGP keys":"{0} — OpenPGP 密钥","{0} — a DMARC report from {1}":"{0} — 来自 {1} 的 DMARC 报告","{0} — accounts":"{0} — 帐户","{0} — aliases":"{0} — 别名","{0} — complaints":"{0} — 投诉","{0} — distribution lists":"{0} — 邮件列表","{0} — external accounts":"{0} — 外部帐户","{0} — suppression list":"{0} — 抑制列表","{0}/minute":"{0}/分钟","{0}: done":"{0}：完成","{0}: no {1} record at {2}.":"{0}：{2} 处没有 {1} 记录。","{0}: signing is off, so receivers cannot verify the mail as this domain's.":"{0}：签名已关闭，收件方无法验证邮件来自此域。","{0}: signing is on but no selector is set.":"{0}：签名已开启，但未设置选择器。","{0}: signing is on but the key file {1} was not found.":"{0}：签名已开启，但未找到密钥文件 {1}。","{0}: the lookup for {2} failed, which says nothing about the {1} record.":"{0}：对 {2} 的查询失败，这并不说明 {1} 记录的情况。","{0}: the {1} record at {2} is published.":"{0}：{2} 处的 {1} 记录已发布。","{0}: the {1} record at {2} was not looked up.":"{0}：未查询 {2} 处的 {1} 记录。","{0}: {1} put back, {2} left as they were; {3} wait for a reinitialise and {4} for a restart.":"{0}：已恢复 {1} 项，{2} 项保持原样；{3} 项等待重新初始化，{4} 项等待重启。","{0}: {1} set, {2} unchanged, {3} skipped; {4} wait for a reinitialise and {5} for a restart.":"{0}：已设置 {1} 项，{2} 项未变，跳过 {3} 项；{4} 项等待重新初始化，{5} 项等待重启。","‹ Accounts of {0}":"‹ {0} 的帐户","‹ All IP ranges":"‹ 所有 IP 范围","‹ All domains":"‹ 所有域","‹ All external accounts":"‹ 所有外部帐户","‹ All groups":"‹ 所有组","‹ All inbound webhooks":"‹ 所有入站 Webhook","‹ All lists":"‹ 所有列表","‹ All migrations":"‹ 所有迁移","‹ All ports":"‹ 所有端口","‹ All remote domains":"‹ 全部远程域","‹ All routes":"‹ 所有路由","‹ All rules":"‹ 所有规则","‹ All subscriptions":"‹ 所有订阅","‹ Back to the reports":"‹ 返回报告列表","‹ Delivery queue":"‹ 投递队列","‹ Lists of {0}":"‹ {0} 的列表"};
/* Fixed translations used by both server-driven forms and dedicated port views. */
Object.assign(catalogue,{
  "OpenPGP":"邮件加密（OpenPGP）",
  "Web Push":"网页推送（Web Push）",
  "OpenPGP ›":"邮件加密（OpenPGP） ›",
  "Client certificate policy":"客户端证书验证策略",
  "Client certificate CA file":"客户端证书 CA 证书文件",
  "The listeners are created when the server starts, so a port added here takes effect when the server restarts.":"端口监听器仅在服务器启动时创建，因此新增端口需要重启邮件服务才能生效。",
  "Takes effect when the server restarts.":"重启邮件服务后生效。",
  "The row is gone at once; the listener stays up until the server restarts.":"删除后该端口立即从列表移除，但原监听器会持续运行至邮件服务重启。"
});
const K=s=>s;
function catalogueHas(key){return Object.prototype.hasOwnProperty.call(catalogue,key)&&typeof catalogue[key]==="string"&&catalogue[key]!=="";}
function t(key){return catalogueHas(key)?catalogue[key]:key;}
function tf(key,...args){return t(key).replace(/\{(\d+)\}/g,(m,i)=>Number(i)<args.length?String(args[Number(i)]):m);}
const LOCALISED_ATTRIBUTES=["placeholder","aria-label","title","alt"];
function localiseTree(root){
  Array.from(root.childNodes).forEach(n=>{
    if(n.nodeType===3){
      const original=n.__en!==undefined?n.__en:String(n.nodeValue||"");
      const trimmed=original.trim();
      if(trimmed&&(catalogueHas(trimmed)||n.__en!==undefined)){
        if(n.__en===undefined)n.__en=original;
        n.nodeValue=original.replace(trimmed,()=>t(trimmed));
      }
    }else if(n.nodeType===1){
      if(n.tagName==="SCRIPT"||n.tagName==="STYLE"||n.id==="content"||n.hasAttribute("data-nowalk"))return;
      LOCALISED_ATTRIBUTES.forEach(name=>{
        if(!n.hasAttribute(name))return;
        const key="__en_"+name;
        const given=n[key]!==undefined?n[key]:n.getAttribute(name);
        if(catalogueHas(given)||n[key]!==undefined){n[key]=given;n.setAttribute(name,t(given));}
      });
      localiseTree(n);
    }
  });
}

/* The server's own OpenAPI document, fetched once per sign-in. Every form on
   this page - which keys a settings group has, what type each one is, which
   words an enumeration takes, which key is write-only and which is read-only -
   is built from it, so a key added to the API appears here without this file
   being touched. */
let spec=null;

/* The last listing each view read, so that an editor can be opened on a row
   without asking again. Never written to instead of re-reading: every write is
   followed by a fresh GET. */
const cache={certificates:[],ports:[],routes:[],rules:[],domains:[],groups:[],ranges:[],lists:[],collections:{},messages:[],remotedomains:[],webhooks:[],
  /* The fetch view's chosen domain and account, kept across its re-reads. */
  fetch:{domain:"",address:"",accounts:[],items:[]}};

/* The editor a view has open, if any: {kind, id, values} - id 0 is a new one. */
let editing=null;

/* Per settings group: the schema it was built from and the values it was built
   with, so that Save can send only what changed. */
const settingsState={};

/* ---------- API ----------
   One entry point for every request. A write carries X-Requested-With, which
   is what the server demands of a request authenticated by the session cookie
   (its own cross-site protection, on top of the cookie's SameSite=Strict), and
   the cookie itself travels because the request is same-origin. Nothing here
   holds a credential: after sign-in the page has no secret at all. */
async function api(path,opts){
  opts=opts||{};
  const method=(opts.method||"GET").toUpperCase();
  const token=localStorage.getItem("Token");
  if(!token)throw new Error("auth");
  const safeHeaders={};
  const given=opts.headers||{};
  if(given["X-hMailServer-OTP"])safeHeaders["X-hMailServer-OTP"]=String(given["X-hMailServer-OTP"]);
  // fetch() has no native deadline. Bound both response and JSON body reading.
  const timeoutMs=Number.isFinite(opts.timeoutMs)?Math.max(1000,opts.timeoutMs):(method==="GET"?12000:25000);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const res=await fetch("/HmailConsole/deckGateway",{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"application/json","Token":token},
      body:JSON.stringify({path:path,method:method,body:opts.body,headers:safeHeaders}),
      credentials:"same-origin",
      cache:"no-store",
      signal:controller.signal
    });
    if(res.status===401)throw new Error("auth");
    let result={};
    try{result=await res.json();}
    catch(err){
      if(err&&err.name==="AbortError")throw err;
      throw new Error("管理网关返回了无法识别的数据");
    }
    if(result.code===401)throw new Error("auth");
    if(result.code!==200){
      const message=String(result.message||"hMailServer API 请求失败");
      const err=new Error(message);
      err.status=result.code||res.status;
      err.reason=result.data&&result.data.reason?String(result.data.reason):"";
      throw err;
    }
    return result.data;
  }catch(err){
    if(err&&err.name==="AbortError"){
      const timeoutError=new Error("请求超时（"+Math.ceil(timeoutMs/1000)+" 秒），请检查 hMailServer REST API 或 PHP 网关是否响应");
      timeoutError.status=504;
      throw timeoutError;
    }
    throw err;
  }finally{clearTimeout(timer);}
}
async function apiBinary(path){
  const token=localStorage.getItem("Token");
  if(!token)throw new Error("auth");
  // Large exports can take longer than JSON requests, but must still terminate.
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),90000);
  try{
    const res=await fetch("/HmailConsole/deckGateway",{
      method:"POST",
      headers:{"Content-Type":"application/json","Accept":"*/*","Token":token},
      body:JSON.stringify({path:path,method:"GET",raw:true}),
      credentials:"same-origin",
      cache:"no-store",signal:controller.signal
    });
    if(res.status===401)throw new Error("auth");
    if(!res.ok){
      let message="文件读取失败（HTTP "+res.status+"）";
      try{const body=await res.json();message=body.message||message;}catch(_){}
      throw new Error(message);
    }
    return await res.blob();
  }catch(err){
    if(err&&err.name==="AbortError")throw new Error("文件读取超时（90 秒），请检查 REST API 或网络连接");
    throw err;
  }finally{clearTimeout(timer);}
}
async function apiRaw(path){
  const blob=await apiBinary(path);
  return await blob.text();
}
async function downloadApi(path,filename){
  const blob=await apiBinary(path);
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url;a.download=filename||"download";a.style.display="none";
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
document.addEventListener("click",event=>{
  const link=event.target.closest("a[data-api-download]");
  if(!link)return;
  event.preventDefault();
  downloadApi(link.dataset.apiDownload,link.getAttribute("download")||"download").catch(err=>{
    if(err.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    toast(err.message);
  });
});
const deckApiImages=new WeakSet();
function hydrateApiImages(root=document){
  if(!root.querySelectorAll)return;
  root.querySelectorAll("img[data-api-src]").forEach(async img=>{
    if(deckApiImages.has(img))return;
    deckApiImages.add(img);
    try{
      const blob=await apiBinary(img.dataset.apiSrc);
      if(img.isConnected)img.src=URL.createObjectURL(blob);
    }catch(err){
      if(err.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
      if(img.isConnected)img.alt=img.alt||t("Image unavailable");
    }
  });
}
const deckContentRoot=document.getElementById("content");
if(deckContentRoot){
  hydrateApiImages(deckContentRoot);
  new MutationObserver(()=>hydrateApiImages(deckContentRoot)).observe(deckContentRoot,{childList:true,subtree:true});
}

/* The refusals the page translates, by the reason word the server sends beside
   its sentence; any other refusal is shown in the server's own words. */
const REFUSAL_REASONS={
  breached:K("This password appears in a published data breach, so it would be among the first tried against this account. Choose a different one."),
  breach_check_unavailable:K("The password could not be checked against published data breaches just now, and this server is set to refuse a change it cannot check. Try again later.")
};
function refusalText(e){
  if(e&&e.reason&&Object.prototype.hasOwnProperty.call(REFUSAL_REASONS,e.reason))return t(REFUSAL_REASONS[e.reason]);
  return e?e.message:"";
}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");
  clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove("show"),2600);}

/* Server-provided values (domain names, addresses, queue entries, TLSA records,
   and every word of the OpenAPI document) are rendered into HTML, so every one
   of them goes through this first. */
function escHtml(v){
  return String(v===undefined||v===null?"":v)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}
/* All destructive/privileged actions use the Layui layer rather than the
   browser's synchronous confirm box. Callers are async and only proceed after
   an explicit affirmative choice. Missing Layui fails closed (never delete). */
function deckConfirm(message){
  return new Promise(resolve=>{
    const layer=window.layui&&window.layui.layer;
    if(!layer||typeof layer.confirm!=="function"){
      console.error("Layui 弹窗组件不可用，操作未执行");
      toast("确认窗口未加载，请刷新页面后重试");
      resolve(false);
      return;
    }
    let index=-1,finished=false;
    const previous=document.activeElement;
    function keydown(event){
      if(event.key!=="Escape")return;
      event.preventDefault();event.stopImmediatePropagation();
      finish(false);
    }
    function finish(confirmed){
      if(finished)return;
      finished=true;
      document.removeEventListener("keydown",keydown,true);
      if(index>=0)layer.close(index);
      resolve(!!confirmed);
      setTimeout(()=>{
        if(previous&&previous.isConnected&&typeof previous.focus==="function"){
          try{previous.focus({preventScroll:true});}catch(_){previous.focus();}
        }
      },0);
    }
    try{
      document.addEventListener("keydown",keydown,true);
      index=layer.confirm(escHtml(message).replace(/\r?\n/g,"<br>"),{
        title:"操作确认",icon:3,btn:["确定","取消"],
        shadeClose:false,closeBtn:1,skin:"deck-confirm-dialog",
        success:dialog=>{
          const cancel=dialog&&dialog.find?dialog.find(".layui-layer-btn1")[0]:null;
          if(cancel&&cancel.focus)cancel.focus();
        },
        end:()=>finish(false)
      },()=>finish(true),()=>finish(false));
    }catch(err){
      console.error("Layui 确认弹窗创建失败",err);
      toast("确认窗口打开失败，操作未执行");
      finish(false);
    }
  });
}

/* An address the server handed over - the release page the update feed names,
   the documentation wiki, an export to download - is drawn as a link only when
   it is a web address: http: or https:, resolved against this page as the
   browser resolves it, and drawn as resolved, so what was checked is what is
   followed. Anything else, or nothing, answers "" and no link is drawn.
   escHtml keeps a value inside its attribute; it says nothing about where the
   address leads, so every data-driven href goes through this as well. */
function safeHref(v){
  const text=String(v===undefined||v===null?"":v).replace(/^[\x00-\x20]+|[\x00-\x20]+$/g,"");
  if(!text)return "";
  try{
    const url=new URL(text,location.href);
    return url.protocol==="https:"||url.protocol==="http:"?url.href:"";
  }catch(_){return "";}
}
/* The server's sentence, shown where the request came from. */
function setErr(id,message){const e=document.getElementById(id);if(e)e.textContent=message||"";}
function asList(x,key){return Array.isArray(x)?x:((x&&x[key])||[]);}

/* ---------- The theme ----------
   The webmail's, which is three choices and not two: light, dark, and the
   system's, which is prefers-color-scheme asked through matchMedia and
   followed as the reader changes it in their desktop. A reader who says
   light or dark overrules the system until they say otherwise. The choice
   is what this browser remembers, under a name that is not a secret, and a
   browser that keeps nothing is still a browser. One button cycles the
   three and carries the name of the one it is on, in the reader's language,
   which is why it is marked data-nowalk and painted from here. */
const THEMES=[["system",K("Theme: the system's choice"),"◐"],["light",K("Theme: light"),"☀"],["dark",K("Theme: dark"),"☾"]];
const systemDark=typeof matchMedia==="function"?matchMedia("(prefers-color-scheme: dark)"):null;
let themeChoice="system";
function storedTheme(){
  try{const kept=localStorage.getItem("hmsTheme");return kept==="light"||kept==="dark"?kept:"system";}catch(_){return "system";}
}
function paintTheme(){
  const entry=THEMES.filter(x=>x[0]===themeChoice)[0]||THEMES[0];
  const button=$("#themeBtn");
  if(!button)return;
  button.textContent=entry[2];
  button.setAttribute("title",t(entry[1]));
  button.setAttribute("aria-label",t(entry[1]));
}
function applyTheme(choice){
  themeChoice=choice==="light"||choice==="dark"?choice:"system";
  document.body.dataset.theme=themeChoice==="system"?((systemDark&&!systemDark.matches)?"light":"dark"):themeChoice;
  try{localStorage.setItem("hmsTheme",themeChoice);}catch(_){}
  paintTheme();
}
if(systemDark&&systemDark.addEventListener)systemDark.addEventListener("change",()=>{if(themeChoice==="system")applyTheme("system");});
$("#themeBtn").onclick=()=>{
  const order=THEMES.map(x=>x[0]);
  applyTheme(order[(order.indexOf(themeChoice)+1)%order.length]);
};
applyTheme(storedTheme());

/* ---------- The status pill ----------
   The state of the link to the server, as the desktop console shows it: a
   colour, a mark and a word, never a colour alone. */
function connection(level,key){
  const pill=$("#connPill"),mark=$("#connMark"),word=$("#connState");
  if(pill)pill.setAttribute("data-level",level);
  if(mark)mark.textContent=level==="good"?"■":"▲";
  if(word)word.textContent=t(key);
}

/* ---------- The notice ----------
   A statement in the flow of a page at one of the desktop console's levels:
   the mark, the severity word and the sentence. The word is there because a
   status carried by colour alone is a status half the readers cannot see. */
const NOTICE_WORDS={info:K("Information"),warn:K("Warning"),bad:K("Error")};
const NOTICE_MARKS={info:"◆",warn:"▲",bad:"✕"};
function noticeHtml(level,text){
  if(!text)return "";
  return '<div class="notice" data-level="'+level+'"><span class="mark" aria-hidden="true">'+NOTICE_MARKS[level]+'</span>'+
         '<div><b>'+escHtml(t(NOTICE_WORDS[level]))+'</b>'+escHtml(text)+'</div></div>';
}

/* ---------- Sign in, sign out ----------
   The password is presented once, to POST /api/v1/session, and the server
   answers with an HttpOnly cookie; the page never reads it and never stores a
   credential of its own. When a second factor is enrolled on the administrator
   credential the server answers 401 with second_factor "required", and the
   code field appears. */
function basicCredential(user,password){
  return "Basic "+btoa(unescape(encodeURIComponent(user+":"+password)));
}
$("#loginForm").onsubmit=e=>{
  e.preventDefault();
  window.top.location.replace(new URL("/admin/login",location.href).href);
};
$("#logoutBtn").onclick=async()=>{
  const token=localStorage.getItem("Token");
  try{
    await fetch("/Admin/logout",{method:"POST",headers:{"Token":token||""},credentials:"same-origin"});
  }catch(_){}
  localStorage.removeItem("Token");
  window.top.location.replace(new URL("/admin/login",location.href).href);
};
function signedOut(message){
  if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  if(discoveryTimer){clearTimeout(discoveryTimer);discoveryTimer=null;}
  spec=null;editing=null;discoveryCase=0;
  try{sessionStorage.removeItem("hmsSession");}catch(_){}
  localStorage.removeItem("Token");
  window.top.location.replace(new URL("/admin/login",location.href).href);
}
/* What the signed-in credential may do. Read once, at sign-in, from the server's
   own answer - never inferred here - and used for one thing: leaving out a page
   this role may not use, rather than showing one whose every button answers 403.
   It is not a security boundary and is not treated as one; the server refuses
   the request whatever this page shows, which is why a whoami that cannot be
   read leaves every view in place rather than hiding the Deck from somebody
   whose credential is perfectly good. */
let permissions=null;
/* True when the credential is confined to named domains. A view whose data is
   the whole server's - the settings, the queue, the logs - is refused to such a
   credential whatever permission it holds, so it is left out for it too. */
let confined=false;
/* True when the credential is the administrator password itself rather than an
   account holding a role. A few routes answer to it alone and consult no
   permission at all - the api keys, the [Settings] section of hMailServer.ini,
   and the Changed from stock list, which is those settings' values seen from
   another angle - so a view of one of them says data-admin rather than naming a
   permission: view_configuration would put it in front of an auditor whose every
   request it refuses. It starts true, as the permissions start unknown, so that
   a whoami that could not be read never hides a page from the credential that
   may use it. */
let administrator=true;
/* administer_server is the whole of it, as it is in RoleManager::Allows. */
function may(permission){return !permissions||!permission||permissions.indexOf("administer_server")>=0||permissions.indexOf(permission)>=0;}
/* A view that needs more than one permission names them all in data-needs,
   separated by spaces, and is shown only when every one is held - the reports
   need view_configuration and view_message_trace, as the server decides in
   RestApiServer::SecondPermissionFor_, because their senders and recipients
   are who mails whom. */
function mayAll(needs){return String(needs||"").split(" ").filter(Boolean).every(may);}
/* Whether a view is in the navigation for this credential. The tour and the
   keyboard ask this rather than walking into a view applyPermissions left out. */
function viewShown(name){
  const b=Array.from(document.querySelectorAll("#nav button[data-view]")).filter(x=>x.dataset.view===name)[0];
  return !!b&&!b.hidden;
}
function applyPermissions(){
  const buttons=Array.from(document.querySelectorAll("#nav button[data-view]"));
  let visible=null;
  buttons.forEach(b=>{
    const allowed=mayAll(b.dataset.needs)&&!(confined&&b.dataset.serverwide)&&!(b.dataset.admin&&!administrator)&&(deckMode==="pro"||DECK_SIMPLE_VIEWS.has(b.dataset.view));
    b.hidden=!allowed;
    if(allowed&&!visible)visible=b.dataset.view;
  });
  const settingsNode=document.querySelector("#deckSettingsGroup");
  if(settingsNode)settingsNode.hidden=!settingsNode.querySelector("button[data-view]:not([hidden])");
  document.querySelectorAll("#nav [data-nav-group]").forEach(g=>{g.hidden=!g.querySelector("button[data-view]:not([hidden])");});
  if(!visible){view=null;return;}
  if(!buttons.some(b=>b.dataset.view===view&&!b.hidden)){
    view=visible;
    buttons.forEach(b=>b.classList.toggle("on",b.dataset.view===view));
    deckRevealNavView(view);
  }
}
async function readSession(){
  permissions=null;confined=false;administrator=true;
  try{
    const who=await api("/api/v1/session",{timeoutMs:3500});
    if(who&&Array.isArray(who.permissions))permissions=who.permissions;
    confined=!!(who&&Array.isArray(who.domains)&&who.domains.length>0);
    if(who&&who.credential)administrator=who.credential==="administrator";
  }catch(_){/* an older server, or a request that did not arrive: show everything */}
  applyPermissions();
}
/* What happens after a session exists: the credential's permissions first,
   then the status for the version in the footer - but only for a role that may
   read it. A help desk may not, and asking would answer 403 and leave it
   standing at the sign-in card with a working session. */
async function startDeck(){
  // The two probes can run concurrently, but /status is not available to every
  // limited role. Respect permissions returned by /session before interpreting
  // the status result (including a 403) as a startup failure.
  const [statusResult]=await Promise.all([
    api("/api/v1/status",{timeoutMs:7500}).then(
      value=>({ok:true,value}),error=>({ok:false,error})
    ),
    readSession()
  ]);
  if(!may("view_configuration")){enter({});return;}
  if(!statusResult.ok)throw statusResult.error;
  enter(statusResult.value);
}
function enter(status){
  deckBootReady=true;
  $("#gate").style.display="none";$("#app").style.display="grid";
  $("#ver").textContent=status.version||"?";
  if(!view){$("#viewTitle").textContent="";$("#content").innerHTML='<div class="empty">'+t("This role reaches none of the pages of the Deck. Ask an administrator for one that does.")+'</div>';return;}
  if(helpRemembered()){$("#helpPane").hidden=false;}
  // Reuse the successful boot probe instead of immediately fetching status again.
  if(view==="dash")firstDashboardStatus=status;
  render();
  // No overlapping polls and no traffic from background tabs.
  if(!pollTimer)pollTimer=setInterval(()=>{
    if(view!=="dash"||document.hidden||dashPollPending)return;
    dashPollPending=true;
    render(true).finally(()=>{dashPollPending=false;});
  },12000);
}

/* ---------- Navigation ---------- */
/* 分类子菜单独立展开/收起；同一时间最多展开一个分类。 */
function deckSettingsOpen(open){
  const toggle=document.querySelector("#deckSettingsToggle");
  const submenu=document.querySelector("#deckSettingsSub");
  if(!toggle||!submenu)return;
  toggle.setAttribute("aria-expanded",String(open));
  submenu.hidden=!open;
}
const deckNavGroups=Array.from(document.querySelectorAll("#nav [data-nav-group]"));
function deckSetGroupOpen(group,open){
  const toggle=group&&group.querySelector(".nav-group-toggle");
  const submenu=group&&group.querySelector(".nav-submenu");
  if(!toggle||!submenu)return;
  toggle.setAttribute("aria-expanded",String(open));
  submenu.hidden=!open;
}
function deckRevealNavView(name){
  const button=Array.from(document.querySelectorAll("#nav button[data-view]"))
    .find(b=>b.dataset.view===name&&!b.hidden);
  const group=button&&button.closest("[data-nav-group]");
  if(group)deckNavGroups.forEach(g=>deckSetGroupOpen(g,g===group));
  if(button&&button.closest(".nav-settings-sub"))deckSettingsOpen(true);
}
$("#nav").addEventListener("click",e=>{
  const heading=e.target.closest(".nav-group-toggle");
  if(heading){
    const group=heading.closest("[data-nav-group]");
    const opening=heading.getAttribute("aria-expanded")!=="true";
    deckNavGroups.forEach(g=>deckSetGroupOpen(g,opening&&g===group));
    return;
  }
  const settingToggle=e.target.closest("#deckSettingsToggle");
  if(settingToggle){deckSettingsOpen(settingToggle.getAttribute("aria-expanded")!=="true");return;}
  const b=e.target.closest("button[data-view]");if(!b||b.hidden)return;
  document.querySelectorAll("#nav button[data-view]").forEach(x=>x.classList.toggle("on",x===b));
  // The search belongs to the view it was typed in, as the console's toolbar
  // search belongs to its page; a view arrived at shows everything it has.
  $("#deckSearch").value="";
  view=b.dataset.view;editing=null;discoveryCase=0;
  if(deckBootReady)render();else $("#viewTitle").textContent=t(titles[view]);
});
const titles={dash:K("Dashboard"),checklist:K("Checklist"),domains:K("Domains"),groups:K("Groups"),ipranges:K("IP ranges"),fetch:K("Fetch accounts"),migrations:K("Migrations"),lists:K("Lists"),queue:K("Delivery queue"),tlsa:K("DANE / TLSA"),settings_server:"服务器",settings_spam:"反垃圾邮件",settings_virus:"反病毒",settings_logging:"日志记录",settings_other:"其他设置",backup:K("Backup"),messages:K("Server messages"),rules:K("Rules"),routes:K("Routes"),remotedomains:K("Remote domains"),certs:K("Certificates"),ports:K("Ports"),roles:K("Roles"),logs:K("Logs"),reports:K("Reports"),audit:K("Audit trail"),webhooks:K("Webhooks"),inboundwebhooks:K("Inbound webhooks"),devices:K("Devices"),changed:K("Changed from stock"),reputation:K("Outbound reputation"),spamtraps:K("Spam traps"),journal:K("Journaling"),quarantine:K("Quarantine"),review:K("Held for review"),archive:K("Archive and holds"),discovery:K("Discovery"),folders:K("Shared folders"),dns:K("DNS records"),diagnostics:K("Diagnostics"),metrics:K("Metrics history"),update:K("Update"),apikeys:K("API keys"),passkeys:K("Passkeys")};

async function render(silent){
  if(deckMode==="simple"&&!DECK_SIMPLE_VIEWS.has(view)){applyPermissions();if(!view||!DECK_SIMPLE_VIEWS.has(view))return;}
  const requestedView=view;
  $("#viewTitle").textContent=t(titles[view]);
  helpFollow();
  searchHook=null;
  try{
    await ensureDeckView(requestedView);
    if(view!==requestedView)return;
    if(view==="dash")await renderDash(silent);
    else if(view==="domains")await renderDomains();
    else if(view==="groups")await renderGroups();
    else if(view==="ipranges")await renderIpRanges();
    else if(view==="fetch")await renderFetch();
    else if(view==="migrations")await renderMigrations();
    else if(view==="lists")await renderLists();
    else if(view==="reputation")await renderReputation();
    else if(view==="checklist")await renderChecklist();
    else if(view==="spamtraps")await renderSpamTraps();
    else if(view==="journal")await renderJournal();
    else if(view==="queue")await renderQueue();
    else if(view==="tlsa")await renderTlsa();
    else if(view.startsWith("settings_"))await renderSettings(view);
    else if(view==="changed")await renderChanged();
    else if(view==="backup")await renderBackup();
    else if(view==="messages")await renderMessages();
    else if(view==="rules")await renderRules();
    else if(view==="routes")await renderRoutes();
    else if(view==="remotedomains")await renderRemoteDomains();
    else if(view==="certs")await renderCerts();
    else if(view==="ports")await renderPorts();
    else if(view==="roles")await renderRoles();
    else if(view==="devices")await renderDevices();
    else if(view==="reports")await renderReports();
    else if(view==="logs")await renderLogs();
    else if(view==="audit")await renderAudit();
    else if(view==="webhooks")await renderWebhooks();
    else if(view==="inboundwebhooks")await renderInboundWebhooks();
    else if(view==="quarantine")await renderQuarantine();
    else if(view==="review")await renderReview();
    else if(view==="archive")await renderArchive();
    else if(view==="discovery")await renderDiscovery();
    else if(view==="folders")await renderFolders();
    else if(view==="dns")await renderDns();
    else if(view==="diagnostics")await renderDiagnostics();
    else if(view==="metrics")await renderMetrics();
    else if(view==="update")await renderUpdate();
    else if(view==="apikeys")await renderApiKeys();
    else if(view==="passkeys")await renderPasskeys();
    $("#connState").textContent=t("Connected");
    connection("good",K("Connected"));
  }catch(err){
    if(err.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    connection("warn",K("Connection problem"));
    if(!silent)$("#content").innerHTML='<div class="empty">'+tf("Could not reach the server: {0}",escHtml(err.message))+'</div>';
  }
  // A view drawn afresh has no row under the keyboard, and comes up with
  // whatever the search box already holds applied to it.
  rowCursor=-1;
  filterRows();
}

/* ---------- Tours ----------
   Teaching a view while somebody uses it. One mechanism, the same shape as the
   desktop Control Panel's and the webmail's: a step is an element (by id or by
   a stable selector), one sentence, an optional condition that ends the step
   when the thing has happened, and what to do when the element is not there -
   skip it, or end the tour saying so. A tour is an ordered list of those with a
   name and a version.

   Four properties of it are the feature rather than decoration, and each is
   checked by build/deck-script-test.js:

     * it is never modal - the ring takes no pointer events and the card is the
       only thing on its layer that does, so every control underneath, the one
       being pointed at included, stays usable;
     * it never takes the keyboard - nothing is focused when a step opens, and
       the card's three buttons are ordinary tab stops;
     * a step whose element is not on the view is skipped rather than waited on,
       because a view draws what the server has and a server without a domain
       has no domain row to point at;
     * where it got to is remembered, so leaving a tour is not losing it.

   Every sentence goes through the catalogues like every other text on this
   page: K() marks it here and t() looks it up when it is drawn. */
const TOURS=[{
  id:"firstrun",
  name:K("Show me around"),
  version:1,
  steps:[
    {view:"domains",sel:"#newDomain",until:"domain-exists",
     text:K("Start with a domain: the part after the @ that this server accepts mail for. Add yours here.")},
    {view:"domains",sel:"#content .tablewrap",
     text:K("Your domains live in this list. Opening one gives you its accounts, aliases and distribution lists.")},
    {view:"domains",sel:'#content button[data-act="accounts"]',
     text:K("Now a mailbox. An account is an address somebody signs in to and receives mail at.")},
    {view:"ports",sel:"#content .tablewrap",missing:"end",
     text:K("These are the ports the server listens on. The submission port, 587, is the one your own people send through.")},
    {view:"ports",sel:'#content button[data-act="portnew"]',until:"tls-listener",
     text:K("A listener wants a certificate and STARTTLS, so that no password crosses the network in the clear.")},
    {view:"certs",sel:"#content .tablewrap",
     text:K("Certificates a listener can present are kept here, and ACME can renew them for you.")},
    {view:"dash",sel:"#kpiState",
     text:K("And this is the server's own verdict on what you have built. It is the page to come back to.")}
  ]}];
/* What a step can wait for. Answered from what the view has just read rather
   than from the words on the screen: a table cell says "Starttls optional" in
   English only, and a condition that stopped working in German would be a
   defect nobody here would ever see. */
const TOUR_CONDITIONS={
  "domain-exists":()=>cache.domains.length>0,
  "tls-listener":()=>cache.ports.some(p=>String(p.connection_security||"none")!=="none")
};
function tourFind(id){return TOURS.filter(x=>x.id===id)[0]||null;}
/* Which tours this browser has finished, and where it stopped in one it left.
   One line, finished then resume points - "firstrun=1|firstrun@3v1" - which is
   the form the Control Panel keeps in the registry, so the two surfaces can be
   read with one explanation. Every kind of damage is survivable and silent:
   the worst it can cost is being offered a tour twice. */
function tourProgress(){
  const out={finished:{},stopped:{}};
  let raw="";
  try{raw=localStorage.getItem("hmsTours")||"";}catch(_){raw="";}
  const halves=String(raw).split("|");
  halves[0].split(",").forEach(pair=>{
    const at=pair.indexOf("=");if(at<=0)return;
    const version=parseInt(pair.slice(at+1),10);
    if(version>0)out.finished[pair.slice(0,at).trim()]=version;
  });
  (halves[1]||"").split(",").forEach(pair=>{
    const at=pair.indexOf("@");if(at<=0)return;
    const rest=pair.slice(at+1),mark=rest.indexOf("v");if(mark<=0)return;
    const step=parseInt(rest.slice(0,mark),10),version=parseInt(rest.slice(mark+1),10);
    if(step>0&&version>0)out.stopped[pair.slice(0,at).trim()]={step:step,version:version};
  });
  return out;
}
function tourSaveProgress(p){
  const finished=Object.keys(p.finished).sort().map(id=>id+"="+p.finished[id]).join(",");
  const stopped=Object.keys(p.stopped).sort().map(id=>id+"@"+p.stopped[id].step+"v"+p.stopped[id].version).join(",");
  try{localStorage.setItem("hmsTours",finished+"|"+stopped);}catch(_){}
}
function tourFinished(t0){const p=tourProgress();return !!t0&&(p.finished[t0.id]||0)>=t0.version;}
function tourResumeAt(t0){
  const stop=tourProgress().stopped[t0.id];
  return stop&&stop.version===t0.version&&stop.step<t0.steps.length?stop.step:0;
}
/* The tour running now: the tour, the step it is on, and what its condition
   said when the step opened. That last one is why a step does not vanish in
   front of somebody who already has a domain - it is the CHANGE that ends a
   step, not the state. */
let tourNow=null;
let tourTimer=null;
function tourCondition(step){
  const test=step&&step.until?TOUR_CONDITIONS[step.until]:null;
  try{return !!test&&!!test();}catch(_){return false;}
}
/* The element a step points at, with the view it is on opened first: a control
   on a view nobody has drawn is in no document to be found in. */
async function tourElement(step){
  if(step.view&&!viewShown(step.view))return null;
  if(step.view&&step.view!==view){
    view=step.view;editing=null;
    document.querySelectorAll("#nav button[data-view]").forEach(b=>b.classList.toggle("on",b.dataset.view===view));
    deckRevealNavView(view);
    await render();
  }
  return $(step.sel);
}
/* From this step onwards, the first one that can be shown. A step whose element
   is missing is skipped; a step marked missing:"end" stops the tour instead,
   which is for the one whose absence makes the rest meaningless. */
async function tourSettle(from){
  for(let at=from;at<tourNow.tour.steps.length;at++){
    const step=tourNow.tour.steps[at];
    if(await tourElement(step)){tourNow.at=at;tourNow.entry=tourCondition(step);return true;}
    if(step.missing==="end"){tourNow.at=at;tourEnd("missing");return false;}
  }
  tourEnd("finished");
  return false;
}
async function tourStart(id,at){
  const t0=tourFind(id);
  if(!t0||$("#app").style.display==="none")return;
  tourNow={tour:t0,at:0,entry:false};
  const from=typeof at==="number"&&at>=0?Math.min(at,t0.steps.length-1):tourResumeAt(t0);
  if(!await tourSettle(from))return;
  tourDraw();
  if(!tourTimer)tourTimer=setInterval(tourTick,400);
}
function tourDraw(){
  const step=tourNow.tour.steps[tourNow.at];
  $("#tourName").textContent=t(tourNow.tour.name);
  $("#tourStep").textContent=tf("Step {0} of {1}",tourNow.at+1,tourNow.tour.steps.length);
  $("#tourText").textContent=t(step.text);
  $("#tourBack").hidden=tourNow.at===0;
  $("#tourNext").textContent=tourNow.at===tourNow.tour.steps.length-1?t("Finish"):t("Next");
  $("#tourCard").hidden=false;
  tourPlace();
}
/* The ring put back where the element is. The view under a tour goes on living
   - it scrolls, it redraws itself every three seconds on the dashboard - and a
   ring left where the element used to be is worse than no ring. An element that
   has gone takes the ring with it and leaves the card, because the sentence is
   still the sentence. */
function tourPlace(){
  if(!tourNow)return;
  const step=tourNow.tour.steps[tourNow.at];
  const el=$(step.sel);
  const ring=$("#tourRing"),card=$("#tourCard");
  if(!el||!el.getBoundingClientRect){ring.hidden=true;return;}
  const at=el.getBoundingClientRect();
  if(!at.width&&!at.height){ring.hidden=true;return;}
  ring.hidden=false;
  ring.style.left=at.left+"px";ring.style.top=at.top+"px";
  ring.style.width=at.width+"px";ring.style.height=at.height+"px";
  const height=card.offsetHeight||190;
  const room=typeof innerHeight==="number"?innerHeight:900;
  const wide=typeof innerWidth==="number"?innerWidth:1280;
  let top=at.bottom+12;
  if(top+height>room)top=Math.max(8,at.top-12-height);
  card.style.top=Math.max(8,Math.min(top,Math.max(8,room-height-8)))+"px";
  card.style.left=Math.max(8,Math.min(at.left,Math.max(8,wide-346)))+"px";
}
function tourTick(){
  if(!tourNow){if(tourTimer){clearInterval(tourTimer);tourTimer=null;}return;}
  tourPlace();
  const step=tourNow.tour.steps[tourNow.at];
  if(step.until&&!tourNow.entry&&tourCondition(step))tourNext();
}
async function tourNext(){
  if(!tourNow)return;
  if(tourNow.at+1>=tourNow.tour.steps.length){tourEnd("finished");return;}
  if(await tourSettle(tourNow.at+1))tourDraw();
}
async function tourBack(){
  if(!tourNow)return;
  for(let at=tourNow.at-1;at>=0;at--){
    if(await tourElement(tourNow.tour.steps[at])){
      tourNow.at=at;tourNow.entry=tourCondition(tourNow.tour.steps[at]);tourDraw();return;
    }
  }
  // Nowhere to go back to is standing still, never closing the tour: Back is
  // how somebody re-reads a sentence, and a Back that ended it would be a trap.
  tourDraw();
}
/* Every ending says something. Silence after a tour that stopped on its own is
   how somebody decides the feature is broken. */
function tourEnd(why){
  if(!tourNow)return;
  const walk=tourNow.tour,at=tourNow.at;
  const progress=tourProgress();
  if(why==="finished"){progress.finished[walk.id]=Math.max(progress.finished[walk.id]||0,walk.version);delete progress.stopped[walk.id];}
  else if(why==="left"&&at>0)progress.stopped[walk.id]={step:at,version:walk.version};
  else delete progress.stopped[walk.id];
  tourSaveProgress(progress);
  tourNow=null;
  if(tourTimer){clearInterval(tourTimer);tourTimer=null;}
  $("#tourCard").hidden=true;$("#tourRing").hidden=true;
  if(why==="finished")toast(tf("That is the end of {0}. You can start it again whenever you like.",t(walk.name)));
  else if(why==="missing")toast(tf("{0} stops here: the next thing it points at is not on this screen.",t(walk.name)));
  else toast(tf("{0} closed. It picks up where you left off.",t(walk.name)));
}
/* The header's entry point. It starts the tour that visits the view showing, at
   its first stop there, so the button teaches THIS view; on a view no tour
   visits it starts at the beginning. */
$("#tourBtn").onclick=()=>{
  if(tourNow){tourEnd("left");return;}
  for(const walk of TOURS){
    for(let at=0;at<walk.steps.length;at++)
      if(walk.steps[at].view===view)return tourStart(walk.id,at);
  }
  if(TOURS.length)tourStart(TOURS[0].id,-1);
};
$("#tourNext").onclick=()=>tourNext();
$("#tourBack").onclick=()=>tourBack();
$("#tourSkip").onclick=()=>tourEnd("left");
/* Escape leaves the tour only when the keyboard is already inside its card.
   Everywhere else Escape still belongs to the page, and a tour that ate it
   would be exactly the "in the way of the keyboard" this promises not to be. */
document.addEventListener("keydown",e=>{
  if(!tourNow||e.key!=="Escape")return;
  const active=document.activeElement;
  if(active&&active.closest&&active.closest("#tourCard"))tourEnd("left");
});

/* Buttons inside a rendered view carry their arguments as data attributes and are
   handled here, so no server-provided value is ever placed inside inline JavaScript,
   where an HTML entity in an account address would be decoded before the handler
   is parsed. */
$("#content").addEventListener("click",e=>{
  const b=e.target.closest("button[data-act]");if(!b)return;
  const d=b.dataset;
  if(d.act==="accounts")showAccounts(d.domain);
  else if(d.act==="groups"){editing=null;render();}
  else if(d.act==="groupnew")createGroup();
  else if(d.act==="groupedit")openGroup(Number(d.id));
  else if(d.act==="groupsave")saveGroup();
  else if(d.act==="groupdel")deleteGroup(Number(d.id),d.name);
  else if(d.act==="memberadd")addGroupMember();
  else if(d.act==="memberdel")deleteGroupMember(Number(d.account),d.address);
  else if(d.act==="accountedit")openAccount(d.address,d.domain);
  else if(d.act==="accountsave")saveAccount();
  else if(d.act==="accountlevels")saveLevels("account");
  else if(d.act==="accountmove")moveAccount();
  else if(d.act==="recoveryclear")clearRecovery();
  else if(d.act==="recoverycodesclear")clearRecoveryCodes();
  else if(d.act==="mkeyon")setMailboxKey(true);
  else if(d.act==="mkeyoff")setMailboxKey(false);
  else if(d.act==="mkeyrecover")recoverMailboxKey();
  else if(d.act==="mrecsave")saveMailboxRecovery();
  else if(d.act==="accountdirsave")saveAccountDirectory();
  else if(d.act==="bookingsave")saveBookingPolicy();
  else if(d.act==="aliases")showAliases(d.domain);
  else if(d.act==="aliasnew")createAlias(d.domain);
  else if(d.act==="aliasdel")deleteAlias(d.name,d.domain);
  else if(d.act==="lists")showLists(d.domain);
  else if(d.act==="listnew")createList(d.domain);
  else if(d.act==="listedit")openList(d.address,d.domain);
  else if(d.act==="listsave")saveList();
  else if(d.act==="listdel")deleteList(d.address,d.domain);
  else if(d.act==="listreset")resetListBounces(d.address);
  else if(d.act==="listapprove")approveListMember(d.address);
  else if(d.act==="suppressions")showSuppressions(d.domain,"",0);
  else if(d.act==="openpgp")showOpenPgp(d.domain);
  else if(d.act==="pgpnew")storeOpenPgpKey();
  else if(d.act==="pgpdel")removeOpenPgpKey(d.address,d.fingerprint);
  else if(d.act==="suppsearch")showSuppressions(suppressionView.domain,($("#suppSearch")||{}).value||"",0);
  else if(d.act==="supppage")showSuppressions(suppressionView.domain,suppressionView.search,Math.max(0,suppressionView.offset+Number(d.by)));
  else if(d.act==="suppnew")addSuppression();
  else if(d.act==="suppdel")removeSuppression(d.address);
  else if(d.act==="complaints")showComplaints(d.domain,"",0);
  else if(d.act==="cmpsearch")showComplaints(complaintView.domain,($("#cmpSearch")||{}).value||"",0);
  else if(d.act==="cmppage")showComplaints(complaintView.domain,complaintView.search,Math.max(0,complaintView.offset+Number(d.by)));
  else if(d.act==="dmarc")showDmarc(d.domain,30,0);
  else if(d.act==="dmarcrange")showDmarc(dmarcView.domain,Number(d.days),0);
  else if(d.act==="dmarcpage")showDmarc(dmarcView.domain,dmarcView.days,Math.max(0,dmarcView.offset+Number(d.by)));
  else if(d.act==="dmarcreport")showDmarcReport(dmarcView.domain,Number(d.id));
  else if(d.act==="dmarcback")showDmarc(dmarcView.domain,dmarcView.days,dmarcView.offset);
  else if(d.act==="domains"){editing=null;render();}
  else if(d.act==="domainnew")createDomain();
  else if(d.act==="domainedit")openDomain(d.name);
  else if(d.act==="domainsave")saveDomain();
  else if(d.act==="domainlevels")saveLevels("domain");
  else if(d.act==="domaindel")deleteDomain(d.name);
  else if(d.act==="daliasadd")addDomainAlias();
  else if(d.act==="daliasdel")deleteDomainAlias(d.name);
  else if(d.act==="dsenderadd")addDomainSender();
  else if(d.act==="dsenderdel")deleteDomainSender(Number(d.id),d.value);
  else if(d.act==="dtrapadd")addDomainTrap();
  else if(d.act==="dtrapdel")deleteDomainTrap(d.address);
  else if(d.act==="trapclear")clearSpamTrapHits();
  else if(d.act==="jrnadd")addJournalRule();
  else if(d.act==="jrndel")deleteJournalRule(Number(d.id),d.value);
  else if(d.act==="jrntoggle")toggleJournalRule(Number(d.id),d.value==="1");
  else if(d.act==="dkimrotstart")rotationAct("start");
  else if(d.act==="dkimrotcheck")rotationAct("check");
  else if(d.act==="dkimrotswitch")rotationAct("switch");
  else if(d.act==="dkimrotretire")rotationAct("retire");
  else if(d.act==="dkimrotcancel")rotationAct("cancel");
  else if(d.act==="dkimrotcopy")rotationCopy(d.slot,d.i);
  else if(d.act==="smimecacreate")smimeAuthorityAct("create");
  else if(d.act==="smimecarotate")smimeAuthorityAct("rotate");
  else if(d.act==="smimecarevoke")smimeAuthorityAct("revoke",d.serial,d.address);
  else if(d.act==="rangenew")openRange(0);
  else if(d.act==="rangeedit")openRange(Number(d.id));
  else if(d.act==="rangedel")deleteRange(Number(d.id),d.label);
  else if(d.act==="rangesave")saveRange();
  else if(d.act==="fetchnew")openFetch(0);
  else if(d.act==="fetchedit")openFetch(Number(d.id));
  else if(d.act==="fetchdel")deleteFetch(Number(d.id),d.name);
  else if(d.act==="fetchsave")saveFetch();
  else if(d.act==="fetchnow")fetchNow(Number(d.id));
  else if(d.act==="collnew")openCollectionItem(d.coll,0);
  else if(d.act==="colledit")openCollectionItem(d.coll,Number(d.id));
  else if(d.act==="colldel")deleteCollectionItem(d.coll,Number(d.id),d.label);
  else if(d.act==="collsave")saveCollectionItem();
  else if(d.act==="collcheck")checkCollectionAddress(d.coll);
  else if(d.act==="msgsave")saveMessage(d.name,Number(d.i));
  else if(d.act==="backupstart")startBackup();
  else if(d.act==="backupstatus")render();
  else if(d.act==="backuprestore")startRestore();
  else if(d.act==="backupclearpass")clearBackupPassphrase();
  else if(d.act==="mailboxrestore")startMailboxRestore();
  else if(d.act==="mailboxrestorestatus")readMailboxRestoreOutcome(d.job);
  else if(d.act==="mailboxlist")listArchivedMailbox();
  else if(d.act==="messagerestore")restoreArchivedMessage(d.id,d.folder);
  else if(d.act==="add")addAccount(d.domain);
  else if(d.act==="del")delAccount(d.address,d.domain);
  else if(d.act==="retry")retryMsg(d.id);
  else if(d.act==="delmsg")delMsg(d.id);
  else if(d.act==="shresume")resumeDestination(d.id);
  else if(d.act==="sbrelease")sandboxAct(d.id,true);
  else if(d.act==="sbdiscard")sandboxAct(d.id,false);
  else if(d.act==="warmnew")openWarmup(0);
  else if(d.act==="warmedit")openWarmup(Number(d.id));
  else if(d.act==="warmsave")saveWarmup();
  else if(d.act==="warmdel")deleteWarmup(Number(d.id));
  else if(d.act==="log")showLog(d.name,d.lines);
  else if(d.act==="sessrefresh")render();
  else if(d.act==="follow")followSession(Number(d.id));
  else if(d.act==="followstop")stopFollow();
  else if(d.act==="followcopy")navigator.clipboard.writeText($("#followPre").textContent).then(()=>toast(t("Copied to clipboard")));
  else if(d.act==="repshow")reportShow();
  else if(d.act==="repdays")reportLastDays(d.days);
  else if(d.act==="copy")navigator.clipboard.writeText($("#tlsaPre").textContent).then(()=>toast(t("Copied to clipboard")));
  else if(d.act==="passkeynew")createPasskey();
  else if(d.act==="passkeydel")removePasskey(Number(d.id),d.name);
  else if(d.act==="keynew")createApiKey();
  else if(d.act==="keyrevoke")revokeApiKey(d.id,d.label);
  else if(d.act==="keycopy")navigator.clipboard.writeText($("#keyToken").textContent).then(()=>toast(t("Copied to clipboard")));
  else if(d.act==="keyhide"){apiKeyToken="";render();}
  else if(d.act==="qcheck")qCheck(d);
  else if(d.act==="qsort")qSort(d.col);
  else if(d.act==="qfold")qFold(d.key);
  else if(d.act==="qact")qAct(d);
  else if(d.act==="qread")qRead(d.id,d.what);
  else if(d.act==="qreadclose")qReadClose();
  else if(d.act==="qexpire")qExpire();
  else if(d.act==="qrefresh")render();
  else if(d.act==="qdigest")qDigest();
  else if(d.act==="qaskyes")qAnswer(true);
  else if(d.act==="qaskno")qAnswer(false);
  else if(d.act==="qlistpick")qListPick(d.list);
  else if(d.act==="qlistsuffix")qListSuffix();
  else if(d.act==="qlistyes")qListYes();
  else if(d.act==="qlistno")qListClose(null);
  else if(d.act==="rvrelease")reviewAct(d.id,true);
  else if(d.act==="rvdiscard")reviewAct(d.id,false);
  else if(d.act==="rvlookup")reviewLookup();
  else if(d.act==="rvsave")reviewSave(d.address);
  else if(d.act==="rvunlock")reviewUnlock(d.address);
  else if(d.act==="arcsearch"){readArchiveForm();render();}
  else if(d.act==="archold")archiveHold(d.id,true);
  else if(d.act==="arcunhold")archiveHold(d.id,false);
  else if(d.act==="dscopen"){discoveryCase=Number(d.id)||0;render();}
  else if(d.act==="dscback"){discoveryCase=0;render();}
  else if(d.act==="dscrefresh")render();
  else if(d.act==="dscnew")discoveryAct("new");
  else if(d.act==="dscsearch")discoveryAct("search");
  else if(d.act==="dschold")discoveryAct("hold");
  else if(d.act==="dscholdarchive")discoveryAct("holdarchive",d.id);
  else if(d.act==="dscrelease")discoveryAct("release",d.id);
  else if(d.act==="dscexport")discoveryAct("export",d.id);
  else if(d.act==="dscclose")discoveryAct("close");
  else if(d.act==="metload"){metricsChoice={metric:$("#metName").value,range:$("#metRange").value};render();}
  else if(d.act==="upcheck")updateAct("check");
  else if(d.act==="updownload")updateAct("download");
  else if(d.act==="upinstall")updateAct("install");
  else if(d.act==="updrain")drainAct(true);
  else if(d.act==="upresume")drainAct(false);
  else if(d.act==="dnscopy")navigator.clipboard.writeText($("#dnsPre").textContent).then(()=>toast(t("Copied to clipboard")));
  else if(d.act==="fldshow"){foldersFor=$("#fldAddress").value.trim();foldersPick=0;permEditing=null;render();}
  else if(d.act==="permsave")savePermission();
  else if(d.act==="permcancel"){permEditing=null;render();}
  else if(d.act==="permedit")editPermission(d.id);
  else if(d.act==="permdel")deletePermission(d.id);
  else if(d.act==="diagrun")runDiagnostics();
  else if(d.act==="setsave")saveSettings(d.group);
  else if(d.act==="setpost")settingsPost(d.group,d.path,d.label);
  else if(d.act==="rulenew")openRule(0);
  else if(d.act==="ruleedit")openRule(Number(d.id));
  else if(d.act==="ruledel")deleteRule(Number(d.id),d.name);
  else if(d.act==="rulesave")saveRule();
  else if(d.act==="critadd"){readRuleForm();editing.rule.criteria.push({field:"subject",header:"",match:"contains",value:""});renderRuleEditor();}
  else if(d.act==="critdel"){readRuleForm();editing.rule.criteria.splice(Number(d.i),1);renderRuleEditor();}
  else if(d.act==="actadd"){readRuleForm();editing.rule.actions.push({type:ruleWords().types[0]||"delete"});renderRuleEditor();}
  else if(d.act==="actdel"){readRuleForm();editing.rule.actions.splice(Number(d.i),1);renderRuleEditor();}
  else if(d.act==="certadd")addCertificate();
  else if(d.act==="certdel")deleteCertificate(Number(d.id),d.name);
  else if(d.act==="portnew")openPort(0);
  else if(d.act==="portedit")openPort(Number(d.id));
  else if(d.act==="portdel")deletePort(Number(d.id),d.label);
  else if(d.act==="portsave")savePort();
  else if(d.act==="portapply")applyRestart();
  else if(d.act==="applypending")applyPending();
  else if(d.act==="routenew")openRoute(0);
  else if(d.act==="routeedit")openRoute(Number(d.id));
  else if(d.act==="routedel")deleteRoute(Number(d.id),d.name);
  else if(d.act==="routesave")saveRoute();
  else if(d.act==="resetpick")pickReset(d.address);
  else if(d.act==="resetpass")resetPassword(d.domain);
  else if(d.act==="unlock")unlockAccount(d.address);
  else if(d.act==="erasetraces")eraseTraces(d.address);
  else if(d.act==="stoppush")stopPush(d.address);
  else if(d.act==="assign")assignRole();
  else if(d.act==="unassign")unassignRole(d.address);
  else if(d.act==="roledel")deleteRole(d.name);
  else if(d.act==="auditpage"){auditOffset=Math.max(0,auditOffset+Number(d.by));render();}
  else if(d.act==="auditverify")verifyAuditChain();
  else if(d.act==="auditrevert")revertAuditedChange(d.id);
  else if(d.act==="repwatchcheck")runReputationCheck();
  else if(d.act==="checklistagain")render();
  else if(d.act==="checklistfix")applyChecklistFix(d.i);
  else if(d.act==="checklistgo"){const to=document.querySelector('#nav button[data-view="'+d.to+'"]');if(to&&!to.hidden)to.click();}
  else if(d.act==="checklistopen"){const b=Array.from(document.querySelectorAll("#nav button[data-view]")).filter(x=>x.dataset.view==="checklist")[0];if(b&&!b.hidden)b.click();}
  else if(d.act==="profileshow"){profileShown_=d.name;render();}
  else if(d.act==="profilehide"){profileShown_="";render();}
  else if(d.act==="profileapply")applyProfile(d.name,Number(d.changes)||0,d.needs==="1",d.token||"");
  else if(d.act==="profilerevert")revertProfile(d.name);
  else if(d.act==="profilediscard")discardProfile();
  else if(d.act==="profiledecline")declineProfiles();
  else if(d.act==="samplecreate")createSampleDomain();
  else if(d.act==="sampleremove")removeSampleDomain();
  else if(d.act==="rdnew")openRemoteDomain(0);
  else if(d.act==="devshow")showDevices();
  else if(d.act==="devrevoke")revokeDevice(d.id);
  else if(d.act==="rdedit")openRemoteDomain(Number(d.id));
  else if(d.act==="rddel")deleteRemoteDomain(Number(d.id),d.name);
  else if(d.act==="rdsave")saveRemoteDomain();
  else if(d.act==="rdclearcache")clearVerificationCache();
  else if(d.act==="hooknew")openWebhook("");
  else if(d.act==="hookedit")openWebhook(d.id);
  else if(d.act==="hookdel")deleteWebhook(d.id);
  else if(d.act==="hooksave")saveWebhook();
  else if(d.act==="hookrun")runWebhookPass();
  else if(d.act==="hooktest")sendTestWebhook();
  else if(d.act==="inhooknew")openInboundWebhook("");
  else if(d.act==="inhookedit")openInboundWebhook(d.id);
  else if(d.act==="inhookdel")deleteInboundWebhook(d.id);
  else if(d.act==="inhooksave")saveInboundWebhook();
  else if(d.act==="inhookrun")runInboundWebhookPass();
  else if(d.act==="inhookretry")retryInboundDelivery(d.id);
  else if(d.act==="inhookdrop")deleteInboundDelivery(d.id);
  else if(d.act==="mignew")openNewMigration();
  else if(d.act==="migsave")saveMigration();
  else if(d.act==="migopen"){migrationOpen=Number(d.id)||0;migrationReport=null;migrationLinks=[];editing=null;render();}
  else if(d.act==="migback"){migrationOpen=0;migrationReport=null;migrationLinks=[];render();}
  else if(d.act==="migstart")migrationVerb(d.id,"start",K("Migration started"));
  else if(d.act==="migpause")migrationVerb(d.id,"pause",K("Migration paused"));
  else if(d.act==="migresume")migrationVerb(d.id,"resume",K("Migration resumed"));
  else if(d.act==="migdel")deleteMigration(d.id,d.name);
  else if(d.act==="migjobs")addMigrationJobs();
  else if(d.act==="migreport")showMigrationReport(d.id);
  else if(d.act==="migretry")migrationJobVerb(d.id,"retry",K("Job queued again"));
  else if(d.act==="migcancel")migrationJobVerb(d.id,"cancel",K("Job cancelled"));
  else if(d.act==="migsignin")migrationSignInLink(d.id);
  else if(d.act==="cancel"){editing=null;render();}
});
/* A criterion's field or an action's type decides which further controls the
   row has, so those two selects redraw the editor. */
$("#content").addEventListener("change",e=>{
  const el=e.target.closest("[data-r]");if(!el)return;
  if(el.dataset.r==="crit-field"||el.dataset.r==="act-type"){readRuleForm();renderRuleEditor();}
  else if(el.dataset.r==="rule-scope"){ruleScope=el.value;editing=null;render();}
  else if(el.dataset.r==="fld-folder"){foldersPick=Number(el.value)||0;permEditing=null;render();}
  else if(el.dataset.r==="fetch-domain"){cache.fetch.domain=el.value;cache.fetch.address="";render();}
  else if(el.dataset.r==="fetch-account"){cache.fetch.address=el.value;render();}
  // A CSV chosen from disk is read into the box, where it can be looked at
  // before it is sent.
  else if(el.dataset.r==="mig-csv-file"){const f=el.files&&el.files[0];if(f&&f.text)f.text().then(x=>{const box=$("#migCsv");if(box)box.value=x;});}
});
/* Enter in a text box inside a row marked data-enter presses that row's
   button, so the small forms - a new account, a new domain, another name for
   one - are completed from the keyboard as a form would be. */
$("#content").addEventListener("keydown",e=>{
  if(e.key!=="Enter"||!e.target||e.target.tagName!=="INPUT"||e.target.type==="checkbox")return;
  const box=e.target.closest("[data-enter]");if(!box)return;
  const b=box.querySelector('button[data-act="'+box.dataset.enter+'"]');
  if(b){e.preventDefault();b.click();}
});

/* ---------- The keyboard ----------
   The webmail's, as far as an administration page has the same things to do:
   / puts the keyboard in the search box, ? opens the list of the shortcuts
   themselves, Escape closes what is open or leaves the search box, the arrows
   move a cursor down the rows of whatever table the view has drawn and Enter
   opens the row it is on, and the arrows move between the views while the
   keyboard is in the navigation column. Every control the page draws is a
   button, a field or a link, reached with Tab and ringed while it holds the
   keyboard, which is what the rest of this rests on: the page is usable with
   no pointer at all.

   The key names are literals rather than texts, because Esc and Tab are what
   is printed on the keyboard in front of the reader; what each one does is a
   text, and the list is drawn afresh every time it is opened so that it is
   drawn in the language the page is in. */
const SHORTCUTS=[
  ["/",K("Search this view")],
  ["?",K("Show or hide this list")],
  ["F1",K("Help for this view, beside it")],
  ["Esc",K("Close this list, or leave the search box")],
  ["↑ ↓",K("Move through the rows of a table, or the views while the keyboard is in the navigation column")],
  ["Enter",K("Open the row the cursor is on")],
  ["Tab",K("Move to the next control; the one holding the keyboard is ringed")]
];
function keysOpen(){return $("#keysOverlay").hidden===false;}
function openKeys(){
  $("#keysList").innerHTML=SHORTCUTS.map(pair=>'<dt><kbd>'+escHtml(pair[0])+'</kbd></dt><dd>'+escHtml(t(pair[1]))+'</dd>').join("");
  $("#keysOverlay").hidden=false;
  $("#keysClose").focus();
}
function closeKeys(){$("#keysOverlay").hidden=true;$("#keysBtn").focus();}
$("#keysBtn").onclick=()=>{if(keysOpen())closeKeys();else openKeys();};
$("#keysClose").onclick=closeKeys;
$("#keysOverlay").onclick=e=>{if(e.target===$("#keysOverlay"))closeKeys();};

/* The row the keyboard is on: an index into the rows the drawn view has, the
   ones the search has hidden left out. A view drawn afresh has none. */
let rowCursor=-1;
function cursorRows(){
  return Array.from(document.querySelectorAll("#content tbody tr")).filter(r=>!r.hidden&&!r.querySelector("td.empty"));
}
function markRow(at){
  const rows=cursorRows();
  if(!rows.length){rowCursor=-1;return;}
  rowCursor=Math.max(0,Math.min(rows.length-1,at));
  rows.forEach((r,i)=>r.classList.toggle("cur",i===rowCursor));
  rows[rowCursor].scrollIntoView();
}
/* Enter presses the row's first button that is not a destructive one, which
   is the one that opens it: Accounts on a domain, Edit on a rule, Last 200
   on a log file. A row whose only button deletes it - a certificate's - is a
   row Enter leaves alone, because a keyboard that deletes what an arrow key
   landed on is a keyboard nobody uses twice. */
function openRow(){
  const rows=cursorRows();
  if(rowCursor<0||!rows[rowCursor])return;
  const button=Array.from(rows[rowCursor].querySelectorAll("button[data-act]")).filter(b=>!b.classList.contains("danger"))[0];
  if(button)button.click();
}

/* ---------- Help, beside the view ----------
   The documentation the server carries (GET /api/v1/help/{page}: the
   repository's own hmailserver/docs, embedded), one document per view,
   drawn in a pane to the right of the content rather than in its place.
   HELP_MAP is the view's document and, where one is named, the heading
   the pane opens on; build/check-help-map.py holds it to the documents,
   and the Control Panel (Services/HelpMap.cs) and the webmail (Portal.js)
   keep the same table for their pages. The pane follows the view as the
   navigation changes, and whether it is open is this browser's choice,
   kept beside the theme and the language.

   The renderer is a copy of the webmail's /portal-markdown.js
   (Common/Util/PortalMarkdown.js): this page's policy allows no script but
   its own inline one, so the module cannot be loaded here. The copy is the
   module's factory body verbatim, and a change there is a change here. It
   builds nodes and never assigns markup, so a document can carry nothing
   the page runs. */
const hmMarkdown=(function () {
  'use strict';

  var FENCE = /^ {0,3}(```|~~~)\s*([\w.+-]*)\s*$/;
  var ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/;
  var SETEXT_ONE = /^ {0,3}=+[ \t]*$/;
  var SETEXT_TWO = /^ {0,3}-+[ \t]*$/;
  var RULE = /^ {0,3}([-*_])[ \t]*(?:\1[ \t]*){2,}$/;
  var BULLET = /^( *)([-*+])[ \t]+(.*)$/;
  var NUMBERED = /^( *)(\d{1,9})[.)][ \t]+(.*)$/;
  var QUOTE = /^ {0,3}>[ ]?(.*)$/;
  var TABLE_DELIMITER = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

  var isBlank = function (line) { return !line || !line.trim(); };
  var isListStart = function (line) { return BULLET.test(line) || NUMBERED.test(line); };
  var isTableRow = function (line) { return line.indexOf('|') >= 0; };

  // The cells of a table row: the outer pipes dropped, a pipe inside a code
  // span kept as the character it is.
  var splitRow = function (line) {
    var cells = [];
    var current = '';
    var inCode = false;
    var text = line.trim();
    if (text.charAt(0) === '|') { text = text.slice(1); }
    if (text.charAt(text.length - 1) === '|' && text.charAt(text.length - 2) !== '\\') { text = text.slice(0, -1); }
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      if (ch === '`') { inCode = !inCode; current += ch; }
      else if (ch === '\\' && text.charAt(i + 1) === '|') { current += '|'; i++; }
      else if (ch === '|' && !inCode) { cells.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cells.push(current.trim());
    return cells;
  };

  // ---- Blocks ---------------------------------------------------------------
  // parse(text) -> an array of blocks, each with the line it starts on:
  //   {type:'heading', level, text, line}
  //   {type:'paragraph', text, line}
  //   {type:'code', text, language, line}
  //   {type:'list', ordered, start, items:[[block...]], line}
  //   {type:'quote', blocks:[block...], line}
  //   {type:'table', header:[text...], rows:[[text...]], line}
  //   {type:'rule', line}
  var parseBlocks = function (lines, offset) {
    var blocks = [];
    var i = 0;
    var n = lines.length;
    var at = function () { return offset + i; };
    while (i < n) {
      var line = lines[i];
      if (isBlank(line)) { i++; continue; }

      var fence = FENCE.exec(line);
      if (fence) {
        var start = at();
        var mark = fence[1];
        var language = fence[2] || '';
        var code = [];
        i++;
        while (i < n) {
          var close = FENCE.exec(lines[i]);
          if (close && close[1] === mark && !close[2]) { i++; break; }
          code.push(lines[i]);
          i++;
        }
        blocks.push({ type: 'code', text: code.join('\n'), language: language, line: start });
        continue;
      }

      var atx = ATX.exec(line);
      if (atx) {
        blocks.push({ type: 'heading', level: atx[1].length, text: atx[2], line: at() });
        i++;
        continue;
      }

      if (RULE.test(line)) {
        // A run of dashes under a paragraph line is a setext heading, read
        // below when the paragraph is gathered; here the line stands alone.
        blocks.push({ type: 'rule', line: at() });
        i++;
        continue;
      }

      var quote = QUOTE.exec(line);
      if (quote) {
        var quoteStart = at();
        var inner = [];
        while (i < n) {
          var q = QUOTE.exec(lines[i]);
          if (q) { inner.push(q[1]); i++; }
          else if (!isBlank(lines[i]) && inner.length && !isListStart(lines[i]) && !FENCE.test(lines[i]) && !ATX.test(lines[i])) { inner.push(lines[i]); i++; }
          else { break; }
        }
        blocks.push({ type: 'quote', blocks: parseBlocks(inner, quoteStart), line: quoteStart });
        continue;
      }

      if (isListStart(line)) {
        var listStart = at();
        var first = BULLET.exec(line) || NUMBERED.exec(line);
        var ordered = !!NUMBERED.exec(line);
        var indent = first[1].length;
        var items = [];
        var item = null;
        var itemIndent = 0;
        while (i < n) {
          var current = lines[i];
          var open = BULLET.exec(current) || NUMBERED.exec(current);
          if (open && open[1].length <= indent) {
            if (open[1].length < indent) { break; }
            if ((ordered && !NUMBERED.exec(current)) || (!ordered && !BULLET.exec(current))) { break; }
            if (item) { items.push(item); }
            // The item's own text is indented to where its text began, so a
            // line under it that is indented that far belongs to it.
            itemIndent = current.length - open[3].length;
            item = { lines: [open[3]], start: at() };
            i++;
            continue;
          }
          if (!item) { break; }
          if (isBlank(current)) {
            // A blank line ends the list unless the next line is indented
            // under the item (a second paragraph, a nested list) or another
            // item of this list.
            var next = i + 1 < n ? lines[i + 1] : '';
            var nextOpen = BULLET.exec(next) || NUMBERED.exec(next);
            var continues = (!isBlank(next) && next.length - next.replace(/^ */, '').length >= itemIndent) ||
              (nextOpen && nextOpen[1].length === indent && ((ordered && NUMBERED.exec(next)) || (!ordered && BULLET.exec(next))));
            if (!continues) { break; }
            item.lines.push('');
            i++;
            continue;
          }
          var lead = current.length - current.replace(/^ */, '').length;
          if (lead >= itemIndent) { item.lines.push(current.slice(itemIndent)); i++; continue; }
          if (open) { break; }
          if (FENCE.test(current) || ATX.test(current) || (isTableRow(current) && i + 1 < n && isTableRow(lines[i + 1]) && TABLE_DELIMITER.test(lines[i + 1]))) { break; }
          // A lazy continuation of the item's paragraph.
          item.lines.push(current.trim());
          i++;
        }
        if (item) { items.push(item); }
        blocks.push({
          type: 'list', ordered: ordered, start: ordered ? parseInt(first[2], 10) : 1,
          items: items.map(function (entry) { return parseBlocks(entry.lines, entry.start); }),
          line: listStart
        });
        continue;
      }

      if (isTableRow(line) && i + 1 < n && TABLE_DELIMITER.test(lines[i + 1]) && isTableRow(lines[i + 1])) {
        var tableStart = at();
        var header = splitRow(line);
        var rows = [];
        i += 2;
        while (i < n && !isBlank(lines[i]) && isTableRow(lines[i])) { rows.push(splitRow(lines[i])); i++; }
        blocks.push({ type: 'table', header: header, rows: rows, line: tableStart });
        continue;
      }

      // A paragraph: lines until a blank one or the start of something else.
      // A setext underline under it makes the line above it a heading, and
      // the lines before that a paragraph of their own.
      var paragraphStart = at();
      var text = [];
      while (i < n) {
        var candidate = lines[i];
        if (isBlank(candidate)) { break; }
        if (text.length && (SETEXT_ONE.test(candidate) || SETEXT_TWO.test(candidate))) {
          var headingText = text.pop();
          if (text.length) { blocks.push({ type: 'paragraph', text: text.join(' '), line: paragraphStart }); }
          blocks.push({ type: 'heading', level: SETEXT_ONE.test(candidate) ? 1 : 2, text: headingText, line: at() - 1 });
          text = [];
          i++;
          paragraphStart = at();
          break;
        }
        if (text.length && (FENCE.test(candidate) || ATX.test(candidate) || isListStart(candidate) || QUOTE.test(candidate) || RULE.test(candidate))) { break; }
        if (text.length && isTableRow(candidate) && i + 1 < n && isTableRow(lines[i + 1]) && TABLE_DELIMITER.test(lines[i + 1])) { break; }
        text.push(candidate.trim());
        i++;
      }
      if (text.length) { blocks.push({ type: 'paragraph', text: text.join(' '), line: paragraphStart }); }
    }
    return blocks;
  };

  var parse = function (text) {
    return parseBlocks(String(text || '').replace(/\r\n?/g, '\n').split('\n'), 0);
  };

  // The level-one and level-two headings, as the server lists them.
  var headings = function (text) {
    var found = [];
    parse(text).forEach(function (block) {
      if (block.type === 'heading' && block.level <= 2) { found.push({ text: block.text, level: block.level, line: block.line }); }
    });
    return found;
  };

  // ---- Inlines --------------------------------------------------------------
  // Code spans first, since nothing inside one is markup; then links, strong,
  // emphasis and autolinks, left to right; an image is its alternative text.
  var inlinesInto = function (doc, parent, text, linkOf) {
    var rest = String(text || '');
    var buffer = '';
    var flush = function () { if (buffer) { parent.appendChild(doc.createTextNode(buffer)); buffer = ''; } };
    var pattern = /(`+)([\s\S]*?[^`])\1(?!`)|!\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^)\s]*)(?:\s+"[^"]*")?\)|<((?:https?|mailto):[^>\s]+)>|(\*\*|__)(?=\S)([\s\S]*?\S)\8|(\*|_)(?=\S)([\s\S]*?\S)\10/;
    while (rest.length) {
      var m = pattern.exec(rest);
      if (!m) { buffer += rest; break; }
      // An underscore inside a word is a character, not emphasis: setting_name.
      if (m[10] === '_' && m.index > 0 && /\w/.test(rest.charAt(m.index - 1))) {
        buffer += rest.slice(0, m.index + 1);
        rest = rest.slice(m.index + 1);
        continue;
      }
      buffer += rest.slice(0, m.index);
      flush();
      if (m[1]) {
        var code = doc.createElement('code');
        code.appendChild(doc.createTextNode(m[2].replace(/^ (.+) $/, '$1')));
        parent.appendChild(code);
      } else if (m[3] !== undefined) {
        buffer += m[3];
      } else if (m[5] !== undefined) {
        var target = linkOf(m[6]);
        if (target) {
          var a = doc.createElement('a');
          a.setAttribute('href', target.href);
          if (target.doc) { a.setAttribute('data-doc', target.doc); if (target.heading) { a.setAttribute('data-heading', target.heading); } }
          else { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer'); }
          inlinesInto(doc, a, m[5], linkOf);
          parent.appendChild(a);
        } else {
          inlinesInto(doc, parent, m[5], linkOf);
        }
      } else if (m[7]) {
        var auto = linkOf(m[7]);
        if (auto) {
          var link = doc.createElement('a');
          link.setAttribute('href', auto.href);
          link.setAttribute('target', '_blank');
          link.setAttribute('rel', 'noopener noreferrer');
          link.appendChild(doc.createTextNode(m[7]));
          parent.appendChild(link);
        } else { buffer += m[7]; }
      } else if (m[8]) {
        var strong = doc.createElement('strong');
        inlinesInto(doc, strong, m[9], linkOf);
        parent.appendChild(strong);
      } else if (m[10]) {
        var em = doc.createElement('em');
        inlinesInto(doc, em, m[11], linkOf);
        parent.appendChild(em);
      }
      rest = rest.slice(m.index + m[0].length);
    }
    flush();
  };

  // Where a link may go. http, https and mailto are followed as they are;
  // Name.md and Name.md#fragment name another document of the set, which the
  // pane opens; a fragment alone names a heading of this one; anything else -
  // a path, a script, a protocol the pane does not know - is not a link.
  var defaultLink = function (href) {
    var target = String(href || '').trim();
    if (/^(https?|mailto):/i.test(target)) { return { href: target }; }
    var doc = /^([A-Za-z0-9]+)\.md(?:#(.*))?$/.exec(target);
    if (doc) { return { href: '#', doc: doc[1], heading: doc[2] || '' }; }
    if (/^#[\w-]+$/.test(target)) { return { href: target }; }
    return null;
  };

  // The text of a line with its inline markup taken off - `What it does
  // *not* do` as What it does not do - for a label that is a string rather
  // than rendered nodes: the headings list's buttons.
  var plain = function (text) {
    var out = [];
    var node = function () { return { appendChild: function (n) { out.push(n); }, setAttribute: function () {} }; };
    var collector = { createElement: node, createTextNode: function (t) { return { text: String(t) }; } };
    inlinesInto(collector, node(), text, function () { return null; });
    return out.filter(function (n) { return n.text !== undefined; }).map(function (n) { return n.text; }).join('');
  };

  var slug = function (text) {
    return String(text || '').toLowerCase().replace(/`/g, '').replace(/[^\wÀ-￿]+/g, '-').replace(/^-+|-+$/g, '');
  };

  // ---- Rendering ------------------------------------------------------------
  var renderBlocks = function (doc, parent, blocks, linkOf) {
    blocks.forEach(function (block) {
      var node;
      if (block.type === 'heading') {
        node = doc.createElement('h' + Math.min(6, block.level + 1));
        node.setAttribute('id', 'help-' + slug(block.text));
        node.setAttribute('data-line', String(block.line));
        node.setAttribute('data-level', String(block.level));
        inlinesInto(doc, node, block.text, linkOf);
      } else if (block.type === 'paragraph') {
        node = doc.createElement('p');
        inlinesInto(doc, node, block.text, linkOf);
      } else if (block.type === 'code') {
        node = doc.createElement('pre');
        var code = doc.createElement('code');
        if (block.language) { code.setAttribute('data-language', block.language); }
        code.appendChild(doc.createTextNode(block.text));
        node.appendChild(code);
      } else if (block.type === 'list') {
        node = doc.createElement(block.ordered ? 'ol' : 'ul');
        if (block.ordered && block.start !== 1) { node.setAttribute('start', String(block.start)); }
        block.items.forEach(function (item) {
          var li = doc.createElement('li');
          // One paragraph in an item is the item's text; more keeps its blocks.
          if (item.length === 1 && item[0].type === 'paragraph') { inlinesInto(doc, li, item[0].text, linkOf); }
          else { renderBlocks(doc, li, item, linkOf); }
          node.appendChild(li);
        });
      } else if (block.type === 'quote') {
        node = doc.createElement('blockquote');
        renderBlocks(doc, node, block.blocks, linkOf);
      } else if (block.type === 'table') {
        node = doc.createElement('table');
        var thead = doc.createElement('thead');
        var headRow = doc.createElement('tr');
        block.header.forEach(function (cell) { var th = doc.createElement('th'); inlinesInto(doc, th, cell, linkOf); headRow.appendChild(th); });
        thead.appendChild(headRow);
        node.appendChild(thead);
        var tbody = doc.createElement('tbody');
        block.rows.forEach(function (row) {
          var tr = doc.createElement('tr');
          for (var c = 0; c < block.header.length; c++) { var td = doc.createElement('td'); inlinesInto(doc, td, row[c] || '', linkOf); tr.appendChild(td); }
          tbody.appendChild(tr);
        });
        node.appendChild(tbody);
      } else if (block.type === 'rule') {
        node = doc.createElement('hr');
      }
      if (node) {
        if (block.type !== 'heading') { node.setAttribute('data-line', String(block.line)); }
        parent.appendChild(node);
      }
    });
  };

  // render(text, doc, linkOf) -> a fragment of doc holding the document.
  var render = function (text, doc, linkOf) {
    var fragment = doc.createDocumentFragment ? doc.createDocumentFragment() : doc.createElement('div');
    renderBlocks(doc, fragment, parse(text), linkOf || defaultLink);
    return fragment;
  };

  return { parse: parse, headings: headings, render: render, plain: plain, slug: slug, link: defaultLink, splitRow: splitRow };
}());
const HELP_MAP={
  dash:["SetupChecklist.md","Where it is"],
  checklist:["SetupChecklist.md"],
  domains:["DomainTransforms.md"],
  groups:["Backup.md","In the archive"],
  ipranges:["CountryBlocking.md"],
  fetch:["Migration.md","From another IMAP server"],
  migrations:["Migration.md","Five hundred mailboxes: migration jobs"],
  lists:["DistributionLists.md"],
  spamtraps:["SpamTraps.md"],
  journal:["Journaling.md"],
  queue:["DiagnosingStalledMail.md","Delivering: the message is accepted but never leaves"],
  tlsa:["RemoteDomains.md","Outbound TLS"],
  settings:["ChangedFromStock.md"],
  changed:["ChangedFromStock.md"],
  backup:["Backup.md"],
  messages:["BounceSuppression.md","Delivery reports"],
  rules:["MailFlowRules.md"],
  routes:["RemoteDomains.md","A policy is not a route"],
  remotedomains:["RemoteDomains.md"],
  certs:["RemoteDomains.md","Outbound TLS"],
  ports:["SmtpAuthOnDeliveryPorts.md"],
  roles:["Roles.md"],
  devices:["DevicesAndSessions.md"],
  logs:["DiagnosingStalledMail.md","Turn on debug logging first"],
  reputation:["ReputationWatch.md"],
  reports:["Reports.md"],
  audit:["AlertsAndAuditTrail.md","The audit trail"],
  webhooks:["Webhooks.md"],
  inboundwebhooks:["InboundWebhooks.md"],
  quarantine:["SenderListsAndDigests.md","Reviewing the quarantine"],
  review:["CompromisedAccounts.md","Reviewing"],
  archive:["Journaling.md"],
  discovery:["Discovery.md"],
  folders:["Backup.md","In the archive"],
  dns:["SetupChecklist.md","The document"],
  diagnostics:["DiagnosingStalledMail.md","What to include in a report"],
  metrics:["Reports.md","The three sources"],
  update:["Upgrading.md"],
  apikeys:["CommandLine.md","Credentials"],
  passkeys:["PasskeysAndSingleSignOn.md","Passkeys"]
};
let helpShown="",helpWiki="",helpPages=null,helpMarks=[],helpMarkAt=-1,helpHeadings=[],helpAt="";
function helpOpen(){return $("#helpPane").hidden===false;}
function helpRemembered(){try{return localStorage.getItem("hmsHelp")==="1";}catch(_){return false;}}
function helpRemember(open){try{if(open)localStorage.setItem("hmsHelp","1");else localStorage.removeItem("hmsHelp");}catch(_){}}
/* The view's document and heading: the map's entry, the name without .md. */
function helpTarget(name){const entry=HELP_MAP[name||view];return entry?{name:entry[0].replace(/\.md$/,""),heading:entry[1]||""}:null;}
/* The list: every document with its title and the wiki page made from it,
   and the wiki base URL. Asked once. */
async function helpIndex(){
  if(helpPages)return helpPages;
  try{const list=await api("/api/v1/help");helpWiki=String(list.wiki||"");helpPages=asList(list,"pages");}
  catch(_){helpWiki="";helpPages=[];}
  return helpPages;
}
/* Where Open on the wiki goes for a document: the base with the page the
   wiki made from it - the wiki names its pages its own way, Backup-and-Restore
   for Backup - or nowhere when the wiki has none, or there is no base. */
function helpWikiPage(name){
  const want=String(name).toLowerCase();
  const page=(helpPages||[]).find(p=>p&&String(p.name).toLowerCase()===want);
  return page&&page.wiki_page?String(page.wiki_page):"";
}
/* A link in a document: the web opens in a new tab, another document of
   the set opens in this pane. */
function helpLinkOf(href){return hmMarkdown.link(href);}
/* Scrolls to the heading that starts on a line of the document - the
   renderer marks every heading with its line - or to the top for none. By
   line rather than by text, because a heading's rendered text is not its
   markdown: `What it does *not* do` renders without the asterisks. */
function helpScrollTo(line){
  const body=$("#helpBody");
  const target=line===null||line===undefined||line<0?null:body.querySelector('[data-level][data-line="'+line+'"]');
  if(target&&target.scrollIntoView)target.scrollIntoView();
  else body.scrollTop=0;
}
/* The line the heading the map names starts on, in the document showing,
   or -1 for none: the map names headings by their markdown text, as the
   generator lists them. */
function helpLineOf(heading){
  if(!heading)return -1;
  for(const h of helpHeadings){if(h.text===heading)return h.line;}
  return -1;
}
/* One document into the pane, opened on a heading; the same document
   again only scrolls. */
async function helpShow(name,heading){
  const pane=$("#helpPane");pane.hidden=false;
  if(helpShown!==name){
    const body=$("#helpBody"),heads=$("#helpHeads");
    body.textContent="";heads.textContent="";helpMarks=[];helpMarkAt=-1;$("#helpSearch").value="";
    $("#helpTitle").textContent=name;
    let text="";
    try{text=await apiRaw("/api/v1/help/"+encodeURIComponent(name));}
    catch(err){if(err.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}body.textContent=t("The documentation could not be loaded.");helpShown="";return;}
    helpShown=name;
    const list=hmMarkdown.headings(text);
    helpHeadings=list;
    if(list.length&&list[0].level===1)$("#helpTitle").textContent=hmMarkdown.plain(list[0].text);
    list.forEach((h,i)=>{
      if(i===0&&h.level===1)return;
      const b=document.createElement("button");b.type="button";b.className=h.level===2?"head sub":"head";b.textContent=hmMarkdown.plain(h.text);b.dataset.line=String(h.line);
      b.onclick=()=>helpScrollTo(h.line);heads.appendChild(b);
    });
    body.appendChild(hmMarkdown.render(text,document,helpLinkOf));
    await helpIndex();
    const wiki=$("#helpWiki");
    // The wiki's page for the document, never its own name: the wiki has no
    // page called Backup, and a document it made no page from has no link.
    // The server refuses a wiki base that is not http(s) when it is set; one
    // that reached the database another way is still no link.
    const wikiPage=helpWikiPage(name);
    const wikiHref=helpWiki&&wikiPage?safeHref(helpWiki+wikiPage):"";
    if(wikiHref){wiki.setAttribute("href",wikiHref);wiki.hidden=false;}else{wiki.removeAttribute("href");wiki.hidden=true;}
  }
  helpScrollTo(helpLineOf(heading));
}
/* Every document, by its title, for opening in the pane. */
async function helpList(){
  const pane=$("#helpPane");pane.hidden=false;
  const body=$("#helpBody"),heads=$("#helpHeads");
  body.textContent="";heads.textContent="";helpShown="";helpHeadings=[];helpAt="";helpMarks=[];helpMarkAt=-1;$("#helpSearch").value="";
  $("#helpTitle").textContent=t("All documentation");
  $("#helpWiki").hidden=true;
  const pages=await helpIndex();
  if(!pages.length){body.textContent=t("The documentation could not be loaded.");return;}
  const ul=document.createElement("ul");ul.className="doclist";
  pages.forEach(p=>{
    const li=document.createElement("li"),b=document.createElement("button");b.type="button";
    b.appendChild(document.createTextNode(String(p.title||p.name)));
    const small=document.createElement("small");small.textContent=String(p.name)+".md";b.appendChild(small);
    b.onclick=()=>helpShow(String(p.name),"");li.appendChild(b);ul.appendChild(li);
  });
  body.appendChild(ul);
}
/* The pane follows the view: the view's document, or nothing changes when
   the pane is closed. Called by render(), which the dashboard's poll and
   every save call too, so what the pane last followed is remembered and a
   view drawn again costs a comparison and moves nothing - the reader's
   place in the text is theirs until the view changes. */
function helpFollow(){
  if(!helpOpen())return;
  const target=helpTarget();
  if(!target)return;
  const at=target.name+"#"+target.heading;
  if(at===helpAt)return;
  helpAt=at;
  helpShow(target.name,target.heading);
}
function helpToggle(){
  if(helpOpen()){helpClose();return;}
  helpRemember(true);
  helpAt="";
  if(helpTarget()){$("#helpPane").hidden=false;helpFollow();}else helpList();
}
function helpClose(){$("#helpPane").hidden=true;helpRemember(false);helpAt="";$("#helpBtn").focus();}
/* The search box over the open document: every match marked, the first
   scrolled to, Enter moving to the next. The marks are nodes wrapped round
   the text and taken off again before the next search. */
function helpUnmark(){
  helpMarks.forEach(m=>{const p=m.parentNode;if(!p)return;p.replaceChild(document.createTextNode(m.textContent),m);p.normalize&&p.normalize();});
  helpMarks=[];helpMarkAt=-1;
}
function helpSearch(q){
  helpUnmark();
  q=String(q||"").trim().toLowerCase();
  if(q.length<2)return;
  const found=[];
  const walk=n=>{Array.from(n.childNodes).forEach(c=>{if(c.nodeType===3){if(String(c.nodeValue||"").toLowerCase().indexOf(q)>=0)found.push(c);}else if(c.nodeType===1)walk(c);});};
  walk($("#helpBody"));
  found.forEach(node=>{
    const text=String(node.nodeValue||"");const lower=text.toLowerCase();
    const span=document.createElement("span");let at=0,hit;
    while((hit=lower.indexOf(q,at))>=0){
      if(hit>at)span.appendChild(document.createTextNode(text.slice(at,hit)));
      const mark=document.createElement("mark");mark.textContent=text.slice(hit,hit+q.length);span.appendChild(mark);helpMarks.push(mark);
      at=hit+q.length;
    }
    if(at<text.length)span.appendChild(document.createTextNode(text.slice(at)));
    node.parentNode.replaceChild(span,node);
  });
  helpNextMark();
}
function helpNextMark(){
  if(!helpMarks.length)return;
  helpMarkAt=(helpMarkAt+1)%helpMarks.length;
  const m=helpMarks[helpMarkAt];if(m.scrollIntoView)m.scrollIntoView();
}
$("#helpBtn").onclick=helpToggle;
$("#helpClose").onclick=helpClose;
$("#helpAll").onclick=()=>{helpRemember(true);helpList();};
$("#helpSearch").oninput=e=>helpSearch(e.target.value);
$("#helpSearch").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();helpNextMark();}});
$("#helpBody").addEventListener("click",e=>{
  const a=e.target&&e.target.closest?e.target.closest("a[data-doc]"):null;
  if(!a)return;
  e.preventDefault();
  helpShow(a.getAttribute("data-doc"),"").then(()=>{
    const slug=a.getAttribute("data-heading");
    if(!slug)return;
    const h=$("#helpBody").querySelector("#help-"+slug.replace(/[^\w-]/g,""));
    if(h&&h.scrollIntoView)h.scrollIntoView();
  });
});

/* One search for every view. It hides the rows of a table and the rows of a
   form that do not carry what was typed, which is what the desktop console's
   toolbar does to a grid. Two views have a filter of their own - the settings
   page and the server messages - and both are read here, so a row has to
   answer to both boxes rather than to whichever was typed in last. */
function filterRows(){
  const box=$("#deckSearch");
  const wide=box?String(box.value||"").trim().toLowerCase():"";
  const own=document.getElementById("setFilter")||document.getElementById("msgFilter");
  const narrow=own?String(own.value||"").trim().toLowerCase():"";
  const keeps=text=>(!wide||text.indexOf(wide)>=0)&&(!narrow||text.indexOf(narrow)>=0);
  document.querySelectorAll("#content tbody tr").forEach(r=>{
    if(r.querySelector("td.empty"))return;
    // A row the server found for this very text (the quarantine's search of
    // every held message) is shown whole: it matched there.
    if(r.dataset&&r.dataset.keep){r.hidden=false;return;}
    r.hidden=!keeps(r.textContent.toLowerCase());
  });
  document.querySelectorAll("#content .fr").forEach(r=>{
    r.hidden=!keeps(r.dataset.k||r.textContent.toLowerCase());
  });
  if(rowCursor>=0)markRow(rowCursor);
  if(searchHook)searchHook();
}
$("#deckSearch").oninput=filterRows;

document.addEventListener("keydown",e=>{
  // The sign-in card owns the keyboard until there is a session.
  if($("#app").style.display==="none")return;
  const tag=(e.target&&e.target.tagName)||"";
  if(e.key==="F1"&&!e.ctrlKey&&!e.metaKey&&!e.altKey){e.preventDefault();helpToggle();return;}
  if(e.key==="Escape"){
    if(keysOpen()){e.preventDefault();closeKeys();return;}
    // The search box's Escape is the list's promise - leave the box - and
    // comes before the pane's, so a search is left with the pane where it was.
    if(e.target===$("#deckSearch")){
      e.preventDefault();
      $("#deckSearch").value="";filterRows();$("#deckSearch").blur();$("#content").focus();
      return;
    }
    if(helpOpen()&&!(e.target&&e.target.id==="helpSearch"&&e.target.value)){e.preventDefault();helpClose();return;}
    return;
  }
  if(tag==="INPUT"||tag==="TEXTAREA"||tag==="SELECT"||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key==="?"){e.preventDefault();if(keysOpen())closeKeys();else openKeys();return;}
  // The shortcut list has one control, so keeping Tab on it is the whole trap:
  // the keyboard cannot wander behind an open sheet and act on what it hides.
  if(keysOpen()){if(e.key==="Tab"){e.preventDefault();$("#keysClose").focus();}return;}
  if(e.key==="/"){e.preventDefault();$("#deckSearch").focus();$("#deckSearch").select();return;}
  const inNav=e.target&&e.target.closest?e.target.closest("#nav"):null;
  if(inNav){
    if(e.key!=="ArrowDown"&&e.key!=="ArrowUp")return;
    const buttons=Array.from(document.querySelectorAll("#nav button")).filter(b=>b.getClientRects().length>0);
    const at=buttons.indexOf(e.target.closest("button"));
    const next=buttons[(at+(e.key==="ArrowDown"?1:buttons.length-1))%buttons.length];
    if(next){e.preventDefault();next.focus();}
    return;
  }
  if(e.key==="ArrowDown"){e.preventDefault();markRow(rowCursor<0?0:rowCursor+1);return;}
  if(e.key==="ArrowUp"){e.preventDefault();markRow(rowCursor<0?0:rowCursor-1);return;}
  if(e.key==="Enter"&&rowCursor>=0){e.preventDefault();openRow();}
});

/* ---------- The OpenAPI document ---------- */
async function loadSpec(){
  if(!spec)spec=await api("/api/v1/openapi.json");
  return spec;
}
function operation(path,method){
  const p=((spec||{}).paths||{})[path];
  return (p&&p[method])||{};
}
function bodySchema(path,method){
  const c=((operation(path,method).requestBody||{}).content||{})["application/json"]||{};
  return c.schema||{};
}
function properties(path,method){return bodySchema(path,method).properties||{};}
function requiredOf(path,method){return bodySchema(path,method).required||[];}
/* The sentences of a description that mention a word, so that what the page
   tells the administrator about (say) restarting is the server's own wording
   and not a copy of it that can drift. */
function uiDocText(text){
  const raw=String(text||"");
  if(!raw)return "";
  const value=t(raw);
  return value!==raw||/[\u3400-\u9fff]/.test(value)?value:"";
}
function sentencesWith(text,word){
  return String(text||"").split(". ")
    .filter(s=>s.toLowerCase().indexOf(word)>=0)
    .map(s=>s.replace(/\.$/,"")+".").join(" ");
}
/* The defaults a create route states in prose - "all_addresses (default true)"
   for a route, "connection_security to none" for a port - so that a new record's
   form starts where the server would put it rather than at blank and false. A
   key the description does not mention simply keeps the empty control. */
function documentedDefaults(path,method,props){
  const text=operation(path,method).description||"";
  const out={};
  Object.keys(props).forEach(key=>{
    // The gap between the key and its "(default …)" may name the key's other
    // spelling but must not cross a bracket: without that, "addresses (an array
    // of e-mail addresses) and connection_security (default none)" hands the
    // address list the word "none".
    const parenthesised=new RegExp("\\b"+key+"\\b[^.;()]{0,40}?\\(default ([^),:]*)[),:]").exec(text);
    // "connection_security (none, starttls_optional, starttls_required, tls;
    // default none)" and "server_type (pop3, the default, or imap)": the
    // words listed first, the default named among them.
    const listed=new RegExp("\\b"+key+"\\b \\([^)]*;\\s*default ([^)]*)\\)").exec(text);
    const theDefault=new RegExp("\\b"+key+"\\b \\(([A-Za-z0-9_.:]+), the default").exec(text);
    const prose=new RegExp("\\b"+key+"\\b (?:defaults to|to) ([A-Za-z0-9_.:]+)").exec(text);
    const match=parenthesised||listed||theDefault||prose;
    if(!match)return;
    const raw=String(match[1]).trim();
    const type=props[key].type||"string";
    if(type==="boolean"){if(raw==="true"||raw==="false")out[key]=raw==="true";return;}
    if(type==="integer"){const n=Number(raw);if(isFinite(n))out[key]=n;return;}
    // "mode (...; default public, and any other word is refused)": for a key
    // with words, the first word of the match that is one of them.
    if(props[key]["enum"]){
      const word=raw.split(/[^A-Za-z0-9_]+/).filter(w=>props[key]["enum"].indexOf(w)>=0)[0];
      if(word)out[key]=word;
      return;
    }
    out[key]=raw;
  });
  return out;
}

/* ---------- Building a control from a schema property ---------- */
const ACRONYMS={smtp:"SMTP",imap:"IMAP",pop3:"POP3",tls:"TLS",ssl:"SSL",starttls:"STARTTLS",sasl:"SASL",
  acl:"ACL",ip:"IP",ipv6:"IPv6",kb:"KB",mb:"MB",mx:"MX",ptr:"PTR",spf:"SPF",dkim:"DKIM",dmarc:"DMARC",arc:"ARC",
  dane:"DANE",tlsa:"TLSA",ca:"CA",id:"ID",url:"URL",tcpip:"TCP/IP",csa:"CSA",sql:"SQL",dns:"DNS",helo:"HELO"};
const FIELD_ZH={"name":"名称","id":"编号","type":"类型","value":"值","key":"键名","enabled":"启用","active":"启用","status":"状态","state":"状态","description":"说明","username":"用户名","user_name":"用户名","password":"密码","old_password":"旧密码","new_password":"新密码","password_hash":"密码哈希","email":"邮箱地址","address":"地址","display_name":"显示名称","first_name":"名","last_name":"姓","full_name":"姓名","alias":"别名","aliases":"别名","domain":"域名","domain_name":"域名","domains":"域名列表","account":"邮箱账户","accounts":"邮箱账户","group":"账户组","groups":"账户组","host":"主机","hostname":"主机名","server":"服务器","server_name":"服务器名称","server_address":"服务器地址","server_type":"服务器类型","server_port":"服务器端口","port":"端口","protocol":"协议","connection":"连接","connection_security":"连接安全","security":"安全性","ssl":"SSL","tls":"TLS","starttls":"STARTTLS","certificate":"证书","certificate_id":"证书编号","certificate_name":"证书名称","private_key":"私钥","public_key":"公钥","path":"路径","file":"文件","file_name":"文件名","filename":"文件名","folder":"文件夹","directory":"目录","url":"链接地址","destination":"目标","source":"来源","target":"目标","from":"发件人","to":"收件人","sender":"发件人","recipient":"收件人","recipients":"收件人列表","subject":"主题","message":"邮件","messages":"邮件","body":"正文","header":"邮件头","headers":"邮件头","attachment":"附件","attachments":"附件","size":"大小","quota":"配额","max_size":"最大大小","maximum_size":"最大大小","limit":"限制","rate":"速率","interval":"间隔","time":"时间","date":"日期","created":"创建时间","updated":"更新时间","created_at":"创建时间","updated_at":"更新时间","expires":"到期时间","expires_at":"到期时间","days":"天数","hours":"小时数","minutes":"分钟数","seconds":"秒数","duration":"持续时间","timeout":"超时时间","retry":"重试","retries":"重试次数","priority":"优先级","order":"顺序","position":"位置","scope":"范围","permissions":"权限","permission":"权限","role":"角色","roles":"角色","ip":"IP","ip_address":"IP 地址","ip_range":"IP 范围","start_ip":"起始 IP","end_ip":"结束 IP","network":"网络","mask":"掩码","subnet":"子网","smtp":"SMTP","imap":"IMAP","pop3":"POP3","http":"HTTP","https":"HTTPS","dns":"DNS","dkim":"DKIM","spf":"SPF","dmarc":"DMARC","mx":"MX","ptr":"PTR","helo":"HELO","relay":"中继","route":"路由","routes":"路由","local":"本地","remote":"远程","external":"外部","internal":"内部","authentication":"身份验证","auth":"身份验证","method":"方式","mode":"模式","policy":"策略","action":"操作","condition":"条件","rule":"规则","pattern":"匹配模式","regex":"正则表达式","match":"匹配","filter":"过滤器","filters":"过滤器","forward":"转发","forwarding":"转发","reply":"回复","auto_reply":"自动回复","vacation":"自动回复","signature":"签名","footer":"页脚","prefix":"前缀","suffix":"后缀","log":"日志","logging":"日志记录","level":"级别","error":"错误","warning":"警告","info":"信息","debug":"调试","backup":"备份","restore":"恢复","archive":"归档","storage":"存储","database":"数据库","compression":"压缩","encrypt":"加密","encryption":"加密","hash":"哈希","algorithm":"算法","token":"令牌","secret":"密钥","api_key":"API 密钥","webhook":"Webhook","webhooks":"Webhook","event":"事件","events":"事件","endpoint":"接口地址","callback":"回调","queue":"队列","delivery":"投递","deliver":"投递","retry_count":"重试次数","attempts":"尝试次数","count":"数量","total":"总数","spam":"垃圾邮件","virus":"病毒","quarantine":"隔离区","threshold":"阈值","score":"评分","check":"检查","scan":"扫描","accept":"接受","reject":"拒绝","deny":"拒绝","allow":"允许","block":"阻止","skip":"跳过","discard":"丢弃","delete":"删除","none":"无","all":"全部","any":"任意","true":"是","false":"否","yes":"是","no":"否","on":"开","off":"关","default":"默认","optional":"可选","required":"必填","automatic":"自动","manual":"手动","custom":"自定义","global":"全局","public":"公开","private":"私有","incoming":"入站","outgoing":"出站","inbound":"入站","outbound":"出站","read":"读取","write":"写入","read_only":"只读","write_only":"只写","user":"用户","members":"成员","member":"成员","list":"列表","lists":"列表","resource":"资源","provider":"服务商","username_or_email":"用户名或邮箱","send":"发送","receive":"接收","verify":"验证","verification":"验证","save":"保存","apply":"应用","cancel":"取消","test":"测试","result":"结果","results":"结果","reason":"原因","notes":"备注","note":"备注","comment":"备注","comments":"备注","title":"标题","language":"语言","timezone":"时区","feature":"功能","features":"功能","forward_to":"转发至","reply_to":"回复地址","return_path":"退信地址","bounce":"退信","max_recipients":"最大收件人数","max_connections":"最大连接数","max_message_size":"最大邮件大小","max_mailbox_size":"最大邮箱大小","use_ssl":"使用 SSL","use_tls":"使用 TLS","require_tls":"强制 TLS","tls_mode":"TLS 模式","ssl_certificate":"SSL 证书","protocol_type":"协议类型","port_number":"端口号","list_name":"列表名称","domain_id":"域名编号","account_id":"账户编号","force":"强制执行","strict":"严格","relaxed":"宽松","fail":"失败","pass":"通过","softfail":"软失败","neutral":"中立","host_name":"主机名称","listen_address":"监听地址","bind_address":"绑定地址","bind_port":"绑定端口","address_type":"地址类型","email_address":"邮箱地址","message_id":"邮件编号","message_size":"邮件大小","valid":"有效","invalid":"无效","unknown":"未知","success":"成功","failed":"失败","pending":"待处理","running":"运行中","stopped":"已停止","disabled":"已禁用","enabled_only":"仅已启用","authenticated":"已验证","unauthenticated":"未验证","full":"完整","partial":"部分","simple":"简单","detailed":"详细","summary":"摘要","include":"包含","exclude":"排除","add":"添加","remove":"移除","create":"创建","update":"更新","edit":"编辑","enable":"启用","disable":"停用","output":"输出","input":"输入","format":"格式","encoding":"编码","charset":"字符集","character_set":"字符集","file_path":"文件路径","directory_path":"目录路径","max_age":"最长保留时间","retention":"保留期限"};
function humanise(key){
  const raw=String(key===undefined||key===null?"":key);
  if(Object.prototype.hasOwnProperty.call(FIELD_ZH,raw.toLowerCase()))return FIELD_ZH[raw.toLowerCase()];
  if(catalogueHas(raw))return t(raw);
  const chunks=raw.replace(/([a-z])([A-Z])/g,"$1_$2").split(/[ _-]+/);
  if(chunks.length&&chunks.every(part=>Object.prototype.hasOwnProperty.call(FIELD_ZH,part.toLowerCase())||ACRONYMS[part.toLowerCase()]))
    return chunks.map(part=>FIELD_ZH[part.toLowerCase()]||ACRONYMS[part.toLowerCase()]).join("");
  return raw.split("_").map((w,i)=>ACRONYMS[w]||(i===0?w.charAt(0).toUpperCase()+w.slice(1):w)).join(" ");
}

Object.assign(FIELD_ZH,{
  "client_certificate_policy":"客户端证书验证策略",
  "client_certificate_ca_file":"客户端证书 CA 证书文件",
  "client_certificate":"客户端证书",
  "openpgp":"邮件加密（OpenPGP）",
  "web_push":"网页推送（Web Push）"
});

/* 系统设置、备份与恢复：统一的中文字段字典。
   仅翻译界面显示文字，不改动 OpenAPI 字段名、枚举 value 或接口请求体。 */
const SETTINGS_FIELD_ZH={"host_name":"主机名称","default_domain":"默认域名","mirror_email_address":"邮件镜像接收地址","max_message_size_kb":"邮件最大大小（KB）","max_message_size_kb_levels":"邮件大小限制适用层级","max_smtp_connections":"最大 SMTP 连接数","max_imap_connections":"最大 IMAP 连接数","max_pop3_connections":"最大 POP3 连接数","max_delivery_threads":"最大邮件投递线程数","max_asynchronous_threads":"最大异步处理线程数","tcpip_threads":"TCP/IP 工作线程数","worker_thread_priority":"工作线程优先级","service_smtp":"启用 SMTP 服务","service_pop3":"启用 POP3 服务","service_imap":"启用 IMAP 服务","welcome_smtp":"SMTP 欢迎语","welcome_pop3":"POP3 欢迎语","welcome_imap":"IMAP 欢迎语","smtp_relayer":"SMTP 中继服务器","smtp_relayer_port":"SMTP 中继端口","smtp_relayer_connection_security":"SMTP 中继连接加密方式","smtp_relayer_requires_authentication":"SMTP 中继需要身份验证","smtp_relayer_username":"SMTP 中继用户名","smtp_connection_security":"SMTP 连接加密方式","smtp_no_of_tries":"SMTP 投递最大重试次数","smtp_minutes_between_try":"SMTP 重试间隔（分钟）","smtp_delivery_bind_to_ip":"SMTP 投递绑定的本地 IP","max_smtp_recipients_in_batch":"每批 SMTP 投递最大收件人数","max_number_of_mx_hosts":"最大 MX 主机数量","outbound_backoff_minutes":"出站投递退避时间（分钟）","outbound_backoff_max_minutes":"出站投递最长退避时间（分钟）","max_outbound_connections_per_destination":"每个目标最大出站连接数","max_outbound_connections_per_tenant":"每个租户最大出站连接数","sandbox_enabled":"启用附件沙箱检测","sandbox_submit_url":"沙箱文件提交地址","sandbox_verdict_url":"沙箱检测结果查询地址","sandbox_timeout_minutes":"沙箱检测超时（分钟）","sandbox_timeout_action":"沙箱超时后的处理方式","sandbox_max_size_kb":"沙箱检测最大文件大小（KB）","sandbox_types":"提交沙箱检测的文件类型","sandbox_poll_seconds":"沙箱结果轮询间隔（秒）","sandbox_score_threshold":"沙箱恶意评分阈值","sandbox_cache_hours":"沙箱结果缓存时间（小时）","sandbox_internal_mail":"检测内部往来邮件","sandbox_max_files":"沙箱每封邮件最多检测文件数","snmp_enabled":"启用 SNMP 监控","snmp_port":"SNMP 端口","snmp_bind_address":"SNMP 绑定地址","snmp_allowed_addresses":"SNMP 允许访问的地址","snmp_v3_user":"SNMP v3 用户名","snmp_v2c_enabled":"允许 SNMP v2c","snmp_contact":"SNMP 联系人","snmp_location":"SNMP 部署位置","allow_smtp_auth_plain":"允许 SMTP 明文身份验证","deny_mail_from_null":"拒绝空发件人地址","allow_incorrect_line_endings":"允许不规范的换行格式","add_delivered_to_header":"添加 Delivered-To 邮件头","disconnect_invalid_clients":"断开无效客户端连接","max_number_of_invalid_commands":"最多允许无效命令次数","rule_loop_limit":"邮件规则循环执行上限","imap_public_folder_name":"IMAP 公共文件夹名称","imap_hierarchy_delimiter":"IMAP 文件夹层级分隔符","imap_master_user":"IMAP 主用户","imap_sasl_plain_enabled":"启用 IMAP SASL PLAIN","imap_sasl_initial_response_enabled":"允许 IMAP SASL 初始响应","imap_sort_enabled":"启用 IMAP 排序功能","imap_quota_enabled":"启用 IMAP 邮箱配额","imap_idle_enabled":"启用 IMAP IDLE 推送","imap_acl_enabled":"启用 IMAP 访问控制列表","imap_proxy_protocol_enabled":"启用 IMAP 代理协议","imap_proxy_protocol_trusted_ips":"IMAP 代理协议可信 IP","pop3_proxy_protocol_enabled":"启用 POP3 代理协议","pop3_proxy_protocol_trusted_ips":"POP3 代理协议可信 IP","auto_ban_on_logon_failure":"登录失败后自动封禁","max_invalid_logon_attempts":"触发封禁的最大登录失败次数","minutes_before_reset":"登录失败计数重置间隔（分钟）","minutes_to_ban":"自动封禁时长（分钟）","auto_ban_widen_by_reverse_name":"根据反向主机名扩展封禁范围","quota_grace_percent":"邮箱配额宽限比例（%）","quota_grace_percent_levels":"邮箱配额宽限比例适用层级","quota_send_stop_percent":"停止发信的配额比例（%）","quota_send_stop_percent_levels":"停止发信比例适用层级","tls_prefer_server_ciphers":"优先使用服务器 TLS 密码套件","tls_prioritize_chacha":"优先使用 ChaCha 加密算法","ssl_cipher_list":"允许的 SSL/TLS 密码套件列表","reputation_watch_enabled":"启用 IP 信誉监控","reputation_watch_lists":"IP 信誉监控黑名单源","reputation_watch_addresses":"IP 信誉监控指定地址","help_wiki_base_url":"帮助文档 Wiki 地址","tls_version_10_enabled":"启用 TLS 1.0","tls_version_11_enabled":"启用 TLS 1.1","tls_version_12_enabled":"启用 TLS 1.2","tls_version_13_enabled":"启用 TLS 1.3","verify_remote_ssl_certificate":"验证远程服务器 SSL 证书","ipv6_preferred":"优先使用 IPv6","rewrite_envelope_from_when_forwarding":"转发邮件时重写信封发件人","create_default_special_use_folders":"自动创建特殊用途文件夹","log_smtp_conversations":"记录 SMTP 会话日志","log_imap_conversations":"记录 IMAP 会话日志","log_pop3_conversations":"记录 POP3 会话日志","user_interface_language":"服务器用户界面语言","audit_trail_enabled":"启用审计追踪","audit_retention_days":"审计日志保留天数","alerts_enabled":"启用系统告警","alert_recipient":"告警接收地址","session_idle_seconds":"会话空闲超时（秒）","session_idle_seconds_levels":"会话空闲超时适用层级","session_lifetime_seconds":"会话最长存活时间（秒）","session_lifetime_seconds_levels":"会话存活时间适用层级","session_one_per_device":"限制每台设备仅有一个会话","session_one_per_device_levels":"单设备会话限制适用层级","quarantine_digest_base_url":"隔离摘要页面基础地址","quarantine_digest_link_hours":"隔离摘要链接有效期（小时）","brand_logos_enabled":"启用品牌标识","reader_fetch_accounts_max":"邮件阅读器最多获取账户数","reader_fetch_accounts_max_levels":"阅读器账户数限制适用层级","reader_fetch_accounts_private_addresses":"允许阅读器获取私人地址","account_recovery_enabled":"启用账户找回功能","recovery_reset_link_minutes":"重置密码链接有效期（分钟）","recovery_verify_link_hours":"验证链接有效期（小时）","recover_deleted_days":"已删除邮件可恢复天数","recover_deleted_days_levels":"已删除邮件恢复期限适用层级","message_store_compression":"启用邮件存储压缩","message_store_dedup_min_kb":"邮件存储去重最小大小（KB）","message_store_backend":"邮件存储后端类型","message_store_object_service":"对象存储服务类型","message_store_object_endpoint":"对象存储接口地址","message_store_object_region":"对象存储区域","message_store_object_bucket":"对象存储桶名称","message_store_object_addressing":"对象存储访问寻址方式","message_store_object_prefix":"对象存储对象前缀","message_store_object_access_key":"对象存储访问密钥","message_store_object_ca_file":"对象存储 CA 证书文件","message_store_object_cache_mb":"对象存储缓存大小（MB）","mailbox_key_idle_minutes":"邮箱加密密钥空闲关闭时间（分钟）","recall_days":"邮件撤回期限（天）","recall_days_levels":"邮件撤回期限适用层级","list_base_url":"邮件列表服务基础地址","list_hard_bounces_to_unsubscribe":"硬退信自动退订次数阈值","list_soft_bounces_to_unsubscribe":"软退信自动退订次数阈值","list_bounce_window_days":"退信统计窗口（天）","smime_authority_base_url":"S/MIME 证书颁发服务地址","directory_enabled":"启用全局通讯录","directory_user_editable":"允许用户编辑通讯录","directory_user_editable_levels":"通讯录编辑权限适用层级","reader_offline_days_max":"阅读器最长离线天数","reader_offline_days_max_levels":"阅读器离线期限适用层级","sample_domain_id":"样例域名编号","compromise_detection_mode":"账户异常检测模式","compromise_baseline_days":"异常检测基线天数","compromise_minimum_history":"异常检测最小历史记录数","compromise_volume_factor":"异常发信量倍率阈值","compromise_volume_floor":"异常发信量最低阈值","compromise_recipient_floor":"异常收件人数最低阈值","compromise_new_recipient_share":"新收件人占比阈值（%）","compromise_score_to_lock":"自动锁定账户的风险评分阈值","compromise_held_days":"异常邮件暂扣天数","confidential_base_url":"机密邮件访问基础地址","dlp_account_number_pattern":"数据防泄漏账户号码匹配规则","domain_report_retention_days":"域名统计报告保留天数","reader_masked_addresses_max":"阅读器最多使用掩码地址数","reader_masked_addresses_max_levels":"掩码地址数限制适用层级","reader_sender_addresses_max":"阅读器最多使用发件地址数","reader_sender_addresses_max_levels":"发件地址数限制适用层级","import_oauth_redirect_base_url":"外部账户 OAuth 回调基础地址","import_oauth_google_client_id":"Google OAuth 客户端编号","import_oauth_google_authorize_url":"Google OAuth 授权接口地址","import_oauth_google_token_url":"Google OAuth 令牌接口地址","import_oauth_microsoft_client_id":"Microsoft OAuth 客户端编号","import_oauth_microsoft_authorize_url":"Microsoft OAuth 授权接口地址","import_oauth_microsoft_token_url":"Microsoft OAuth 令牌接口地址","passkeys_enabled":"启用通行密钥","passkey_relying_party":"通行密钥依赖方标识","passkey_allowed_origins":"允许使用通行密钥的来源地址","oidc_issuer":"OIDC 身份提供方地址","oidc_client_id":"OIDC 客户端编号","oidc_scopes":"OIDC 授权范围","oidc_redirect_base_url":"OIDC 回调基础地址","oidc_auto_provision":"OIDC 自动创建用户","oidc_administrators":"OIDC 管理员名单","saml_idp_entity_id":"SAML 身份提供方实体编号","saml_idp_sso_url":"SAML 单点登录地址","saml_idp_certificate_fingerprints":"SAML 身份提供方证书指纹","saml_sp_entity_id":"SAML 服务提供方实体编号","saml_email_attribute":"SAML 邮箱属性名称","saml_require_signed_assertion":"要求 SAML 断言签名","saml_auto_provision":"SAML 自动创建用户","saml_administrators":"SAML 管理员名单","saml_button_label":"SAML 登录按钮文字","spam_trap_ban_minutes":"垃圾邮件陷阱命中后封禁时长（分钟）","spam_trap_block_days":"垃圾邮件陷阱封锁天数","spam_trap_hit_retention_days":"垃圾邮件陷阱命中记录保留天数","spam_trap_teach_spamassassin":"将陷阱样本提供给 SpamAssassin 学习","session_bind_to_address":"将会话绑定到客户端地址","session_bind_to_address_levels":"会话地址绑定适用层级","alert_sender_address":"告警发件人地址","alert_digest_enabled":"启用告警汇总","alert_digest_hour":"告警汇总发送时间（小时）","alert_max_per_hour":"每小时最多发送告警数","alert_webhook_max_attempts":"告警 Webhook 最多重试次数","webhooks_enabled":"启用 Webhook","webhook_max_attempts":"Webhook 最多重试次数","webhook_max_per_minute":"Webhook 每分钟最大调用次数","webhook_retention_days":"Webhook 记录保留天数","migration_connections_per_host":"每个目标主机允许的迁移连接数","pst_import_directory":"PST 导入文件夹","breach_check_enabled":"启用密码泄露检查","breach_check_url":"密码泄露检查接口地址","breach_check_minimum_count":"密码泄露命中次数阈值","breach_check_unreachable_action":"密码检查服务不可用时的处理方式","geoip_database_file":"GeoIP 数据库文件路径","geoip_database_max_age_days":"GeoIP 数据库最大使用天数","geoip_database_status":"GeoIP 数据库状态","country_blocking_exempt_ranges":"国家或地区屏蔽规则豁免 IP 段","country_policy_smtp":"SMTP 国家或地区访问策略","country_policy_imap":"IMAP 国家或地区访问策略","country_policy_pop3":"POP3 国家或地区访问策略","country_policy_http":"HTTP 国家或地区访问策略","destination":"备份存放目录","backup_domains":"备份域名信息","backup_messages":"备份邮件内容","backup_settings":"备份服务器设置","compress":"压缩备份文件","log_file":"备份日志文件路径","encryption_passphrase_set":"已设置备份加密口令","encryption_passphrase":"备份加密口令","passphrase":"备份解密口令","restore_settings":"恢复服务器设置","restore_domains":"恢复域名和账户","restore_messages":"恢复邮件内容","restore_accounts":"恢复邮箱账户","file":"备份存档文件路径","archive":"备份存档","mode":"恢复方式","verify":"校验备份存档","skip_existing":"跳过已存在的邮件"};
const SETTINGS_HELP_ZH={"destination":"备份文件保存到服务器上的目录。请先确认目录存在且邮件服务有写入权限。","backup_domains":"将域名、邮箱账户等域配置纳入备份。","backup_messages":"将邮件内容及其存储数据纳入备份。","backup_settings":"将服务器配置参数纳入备份。","compress":"压缩备份存档，以减少占用空间。","log_file":"备份运行日志在服务器上的完整文件路径。","encryption_passphrase_set":"只读状态：表示当前是否已经保存备份加密口令。","encryption_passphrase":"为后续备份设置加密口令；留空表示不修改当前口令。丢失口令可能导致加密备份无法恢复。","file":"填写服务器本机可读取的备份存档文件路径，而不是浏览器电脑上的文件路径。","restore_settings":"用备份中的服务器设置覆盖当前设置。","restore_domains":"恢复备份中的域名及账户资料。","restore_messages":"恢复备份中的邮件内容。","passphrase":"如果存档已加密，请提供创建备份时使用的口令。","mode":"合并模式保留现有邮件；替换模式先清空原有文件夹，可能丢失备份后的新邮件。"};
const SETTINGS_ENUM_ZH={"account":"账户级","domain":"域名级","server":"服务器级","global":"全局级","none":"无","starttls_optional":"可选 STARTTLS","starttls_required":"强制 STARTTLS","ssl_tls":"SSL/TLS 加密","tls":"TLS 加密","plain":"明文","watch":"仅监测","lock":"锁定","allow":"允许","deny":"拒绝","deliver":"正常投递","quarantine":"转入隔离区","discard":"丢弃","hold":"暂扣","file":"本地文件","object":"对象存储","auto":"自动","virtual_hosted":"虚拟主机寻址","path":"路径寻址","English":"英语（服务端语言设置）","running":"运行中","idle":"空闲","ready":"就绪","completed":"已完成","complete":"已完成","failed":"失败","error":"发生错误","pending":"等待中","started":"已启动","success":"成功","done":"已完成","queued":"已排队","merge":"合并","replace":"替换","off":"关闭","on":"开启"};
function settingsCaption(key){return Object.prototype.hasOwnProperty.call(SETTINGS_FIELD_ZH,key)?SETTINGS_FIELD_ZH[key]:humanise(key);}
function settingsEnumLabel(value){const s=String(value);return Object.prototype.hasOwnProperty.call(SETTINGS_ENUM_ZH,s)?SETTINGS_ENUM_ZH[s]:humanise(s);}
function backupDisplayStatus(value){const s=String(value||'').trim();return Object.prototype.hasOwnProperty.call(SETTINGS_ENUM_ZH,s.toLowerCase())?SETTINGS_ENUM_ZH[s.toLowerCase()]:s;}
function optionsHtml(values,selected){
  return values.map(v=>{
    const value=(v&&typeof v==="object")?v.value:v;
    const label=(v&&typeof v==="object")?(catalogueHas(String(v.label))?t(String(v.label)):humanise(v.label)):humanise(v);
    return '<option value="'+escHtml(value)+'"'+(String(value)===String(selected===undefined?"":selected)?" selected":"")+'>'+escHtml(label)+'</option>';
  }).join("");
}
function isPassword(key,prop){return !!prop.writeOnly||/password$/.test(key);}
function controlHtml(prefix,key,prop,value,opts){
  const id=prefix+"_"+key;
  const type=prop.type||"string";
  if(prop.readOnly)
    return '<code class="ro">'+escHtml(value===undefined||value===null||value===""?"—":value)+'</code>';
  if(opts.choices&&opts.choices[key])
    return '<select id="'+id+'">'+optionsHtml(opts.choices[key],value)+'</select>';
  if(prop["enum"])
    return '<select id="'+id+'">'+(prefix.startsWith("set_")||prefix==="restore"
      ?prop["enum"].map(v=>'<option value="'+escHtml(v)+'"'+(String(v)===String(value===undefined?"":value)?' selected':'')+'>'+escHtml(settingsEnumLabel(v))+'</option>').join("")
      :optionsHtml(prop["enum"],value))+'</select>';
  if(type==="boolean")
    return '<input type="checkbox" id="'+id+'"'+(value?" checked":"")+'>';
  if(type==="integer")
    return '<input type="number" id="'+id+'" value="'+escHtml(value===undefined||value===null?"":value)+'">';
  if(type==="array")
    return '<textarea id="'+id+'" rows="4" placeholder="'+escHtml(t("One per line"))+'">'+escHtml((Array.isArray(value)?value:[]).join("\n"))+'</textarea>';
  if(prop.format==="multiline")
    return '<textarea id="'+id+'" rows="5">'+escHtml(value===undefined||value===null||prop.writeOnly?"":value)+'</textarea>';
  if(isPassword(key,prop))
    return '<input type="password" id="'+id+'" value="" autocomplete="new-password" placeholder="'+escHtml(opts.passwordHint||t("left unchanged unless filled"))+'">';
  return '<input type="text" id="'+id+'" value="'+escHtml(value===undefined||value===null?"":value)+'">';
}
/* When a saved value reaches the running server, for a key kept in the settings
   store that was hMailServer.ini's [Settings] section: the document carries the
   server's mark as x-applies on those properties (docs/SettingsApply.md) - now,
   reinitialize or restart - and the field shows it. A mark this page does not
   know is left out rather than guessed. */
const APPLIES_WORDS={now:K("Applies on save"),reinitialize:K("After reinitialize"),restart:K("After a restart")};
function appliesBadge(mark){
  if(!mark||!Object.prototype.hasOwnProperty.call(APPLIES_WORDS,mark))return "";
  return '<span class="badge '+(mark==="now"?"good":"warn")+'" data-applies="'+escHtml(mark)+'">'+t(APPLIES_WORDS[mark])+'</span>';
}
/* A setting this server's environment sets (docs/EnvironmentConfiguration.md):
   the group's GET answers <key>_environment, variable or file, beside it, and
   the server refuses a change to it, which the next start would undo. So the
   field is shown with the mark and no control - readForm then never sends it -
   and a value a file supplied arrives as (set), or null, and is shown so. */
const ENVIRONMENT_WORDS={variable:K("Set by the environment"),file:K("Set by the environment, from a file")};
function environmentBadge(source){
  if(!source||!Object.prototype.hasOwnProperty.call(ENVIRONMENT_WORDS,source))return "";
  return ' <span class="badge info" data-environment="'+escHtml(source)+'">'+t(ENVIRONMENT_WORDS[source])+'</span>';
}
function formHtml(prefix,props,values,opts){
  opts=opts||{};
  const required=opts.required||[];
  return Object.keys(props).map(key=>{
    if(opts.skip&&opts.skip.indexOf(key)>=0)return "";
    const prop=props[key];
    const value=values?values[key]:undefined;
    const environment=values?values[key+"_environment"]:undefined;
    const managed=!!environmentBadge(environment);
    const isSettingsForm=prefix.startsWith("set_")||prefix==="restore";
    // Field labels supplied by a specific editor also apply outside Settings (e.g. service ports).
    const caption=(opts.labels&&opts.labels[key])||(isSettingsForm?settingsCaption(key):humanise(key));
    // A hint this page wrote is a key and comes back in the reader's language;
    // a sentence from the server's document is not one and comes back as it is.
    const description=(opts.descriptions&&opts.descriptions[key])||
      (isSettingsForm&&SETTINGS_HELP_ZH[key])||
      (prop.description?(catalogueHas(prop.description)?t(prop.description):
      // 未收录的 OpenAPI 英文说明不直接展示；字段名已使用完整中文名称。
      (/[\u3400-\u9fff]/.test(prop.description)?prop.description:"")):"");
    // A key with a mark says the mark; the rest say "restart" when the document
    // says they wait for one, as before.
    const applies=prop["x-applies"]||"";
    const restart=!applies&&/takes effect when the server restarts/i.test(prop.description||"");
    const flags=(required.indexOf(key)>=0?'<span class="badge info">'+t("required")+'</span> ':"")+
                (prop.readOnly?'<span class="badge info">'+t("read-only")+'</span> ':"")+
                (isPassword(key,prop)?'<span class="badge info">'+t("write-only")+'</span> ':"")+
                (restart?'<span class="badge warn">'+t("restart")+'</span>':"")+
                appliesBadge(applies)+
                environmentBadge(environment);
    const search=(key+" "+caption+" "+description).toLowerCase();
    const control=managed
      ?'<code class="ro">'+escHtml(value===undefined||value===null||value===""?"—":String(value))+'</code>'
      :controlHtml(prefix,key,prop,value,opts);
    return '<div class="fr" data-k="'+escHtml(search)+'">'+
             '<div class="lab"><b title="'+escHtml(key)+'">'+escHtml(caption)+'</b> '+flags+
               (description?'<div class="hint">'+escHtml(description)+'</div>':"")+'</div>'+
             '<div class="ctl">'+control+'</div>'+
           '</div>';
  }).join("");
}
/* Reads a form back into a plain object of the schema's types. An empty number
   is left out rather than sent as 0: on a create that lets the server apply its
   own default, and on a settings save it means "unchanged". */
function readForm(prefix,props,opts){
  opts=opts||{};
  const out={};
  Object.keys(props).forEach(key=>{
    const prop=props[key];
    if(prop.readOnly)return;
    if(opts.skip&&opts.skip.indexOf(key)>=0)return;
    const el=document.getElementById(prefix+"_"+key);
    if(!el)return;
    const type=prop.type||"string";
    if(isPassword(key,prop)){if(el.value!=="")out[key]=el.value;return;}
    if(type==="boolean"){out[key]=el.checked;return;}
    if(type==="integer"){
      const raw=String(el.value).trim();
      if(raw==="")return;
      const n=Number(raw);
      if(!isFinite(n)||Math.floor(n)!==n)throw new Error(tf("{0} must be a whole number.",humanise(key)));
      out[key]=n;return;
    }
    if(type==="array"){out[key]=el.value.split("\n").map(s=>s.trim()).filter(Boolean);return;}
    out[key]=el.value;
  });
  return out;
}



/* Shared helpers used by lazy-loaded feature pages */
function groupedKeys(groups,props){
  const named={};
  const out=groups.map(g=>({title:g.title,keys:g.keys.filter(k=>{named[k]=true;return k in props;})})).filter(g=>g.keys.length);
  const rest=Object.keys(props).filter(k=>!named[k]);
  if(rest.length)out.push({title:K("Other"),keys:rest});
  return out;
}

function pick(props,keys){const out={};keys.forEach(k=>{out[k]=props[k];});return out;}

function reportChartHtml(labels,series){
  if(!labels.length)return "";
  const W=880,H=190,L=54,R=10,T=12,B=30;
  let max=0;
  series.forEach(s=>s.values.forEach(v=>{if(v>max)max=v;}));
  if(max<=0)max=1;
  const plotW=W-L-R,plotH=H-T-B;
  const group=plotW/labels.length,bw=Math.max(1.5,(group-4)/series.length);
  let bars="";
  labels.forEach((label,i)=>{
    series.forEach((s,j)=>{
      const value=Number(s.values[i])||0;
      const h=Math.max(value>0?1:0,Math.round(value/max*plotH));
      const x=L+i*group+2+j*bw,y=T+plotH-h;
      bars+='<rect x="'+x.toFixed(1)+'" y="'+y+'" width="'+bw.toFixed(1)+'" height="'+h+'" fill="'+s.colour+'">'+
            '<title>'+escHtml(label+" "+t(s.label)+": "+value)+'</title></rect>';
    });
  });
  let ticks="";
  [0,Math.round(labels.length/2)-1,labels.length-1].forEach(i=>{
    if(i<0||i>=labels.length)return;
    ticks+='<text x="'+(L+i*group+group/2).toFixed(1)+'" y="'+(H-10)+'" font-size="10" fill="#8b949e" text-anchor="middle">'+escHtml(labels[i])+'</text>';
  });
  const legend=series.map(s=>'<span class="muted" style="margin-right:14px"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:'+s.colour+';margin-right:6px"></span>'+escHtml(t(s.label))+'</span>').join("");
  return '<div class="tablewrap"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="'+escHtml(t("Messages per day"))+'">'+
    '<line x1="'+L+'" y1="'+(T+plotH)+'" x2="'+(W-R)+'" y2="'+(T+plotH)+'" stroke="#8b949e" stroke-width="0.5"></line>'+
    '<text x="'+(L-8)+'" y="'+(T+8)+'" font-size="10" fill="#8b949e" text-anchor="end">'+escHtml(String(max))+'</text>'+
    '<text x="'+(L-8)+'" y="'+(T+plotH)+'" font-size="10" fill="#8b949e" text-anchor="end">0</text>'+
    bars+ticks+'</svg></div><div class="row" style="margin-top:8px">'+legend+'</div>';
}

function fmtBytes(n){n=Number(n)||0;if(n>=1048576)return (n/1048576).toFixed(1)+" MB";if(n>=1024)return (n/1024).toFixed(1)+" KB";return n+" B";}

function auditWhen(seconds){
  const value=Number(seconds)||0;
  if(!value)return "—";
  return new Date(value*1000).toISOString().replace("T"," ").replace(/\.\d+Z$/,"Z");
}


/* Each view has its own JavaScript bundle. No scripts for hidden views load on startup. */
const deckBundleBase = new URL('./views/',document.currentScript.src).href;
const deckBundleMap = {
  dash:'dashboard', domains:'accounts', groups:'groups', queue:'delivery', tlsa:'delivery', apikeys:'delivery', passkeys:'delivery',
  quarantine:'security', review:'security', archive:'security', discovery:'security', metrics:'security', update:'security', dns:'security', folders:'security', diagnostics:'security',
  settings_server:'settings', settings_spam:'settings', settings_virus:'settings', settings_logging:'settings', settings_other:'settings', rules:'routing', certs:'routing', ports:'routing', routes:'routing', remotedomains:'routing',
  ipranges:'access', fetch:'access', lists:'access', spamtraps:'access', journal:'access',
  backup:'backup', messages:'backup', reports:'reports', roles:'admin', devices:'admin', logs:'admin', changed:'admin', audit:'admin',
  checklist:'checklist', reputation:'checklist', migrations:'migrations', inboundwebhooks:'webhooks', webhooks:'webhooks'
};
const deckBundleLoads = new Map();
function ensureDeckView(viewName){
  const bundle=deckBundleMap[viewName];
  if(!bundle)return Promise.reject(new Error('未找到功能页面：'+viewName));
  if(deckBundleLoads.has(bundle))return deckBundleLoads.get(bundle);
  const loaded=new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.src=deckBundleBase+bundle+'.js?v=20261106-simple-v2';
    script.async=true;
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error('页面模块加载失败：'+bundle+'，请检查静态文件是否全部覆盖。'));
    document.head.appendChild(script);
  });
  deckBundleLoads.set(bundle,loaded);
  loaded.catch(()=>deckBundleLoads.delete(bundle));
  return loaded;
}
