/* ---------- IP ranges ----------
   Access control: which addresses may connect and what they may do. The form
   is built from the schema of POST /api/v1/ipranges, which names every field
   with its type, and drawn in the groups the desktop dialog uses - General,
   Connections, Relaying, Require auth, Protection - with a key the document
   gains later falling into a group of its own rather than out of sight. The
   document gives the keys no wording, so the captions here are the desktop
   dialog's. A new range starts where the create handler puts a key left out;
   the document does not state those defaults, so they are here, with the
   desktop's 15 for the priority (the handler's 0 would lose to every range
   there is). expires and expires_time are the expiry the auto-ban gives its
   ranges and the desktop dialog offers: a range that expires is removed once
   its time passes, and the time goes only with the flag. */
const RANGE_GROUPS=[
  {title:K("General"),keys:["name","lower","upper","priority"]},
  {title:K("Connections"),keys:["allow_smtp","allow_imap","allow_pop3"]},
  {title:K("Relaying"),keys:["deliver_local_to_local","deliver_local_to_remote","deliver_remote_to_local","deliver_remote_to_remote"]},
  {title:K("Require auth"),keys:["require_auth_local_to_local","require_auth_local_to_remote","require_auth_remote_to_local","require_auth_remote_to_remote","require_tls_for_auth"]},
  {title:K("Protection"),keys:["spam_protection","virus_protection"]},
  {title:K("Expiry"),keys:["expires","expires_time"]}
];
const RANGE_HINTS={
  name:K("A name for the range."),lower:K("The lowest address of the range, IPv4 or IPv6."),upper:K("The highest address of the range."),
  priority:K("Higher wins when ranges overlap."),
  allow_smtp:K("Allow SMTP connections from the range."),allow_imap:K("Allow IMAP connections."),allow_pop3:K("Allow POP3 connections."),
  deliver_local_to_local:K("Local sender to local recipient."),deliver_local_to_remote:K("Local sender to external recipient (relay out)."),
  deliver_remote_to_local:K("External sender to local recipient (incoming mail)."),deliver_remote_to_remote:K("External sender to external recipient - an open relay unless authentication is required."),
  require_auth_local_to_local:K("Require SMTP authentication for local to local."),require_auth_local_to_remote:K("Require SMTP authentication for local to external."),
  require_auth_remote_to_local:K("Require SMTP authentication for external to local."),require_auth_remote_to_remote:K("Require SMTP authentication for external to external."),
  require_tls_for_auth:K("Require SSL/TLS when authenticating."),
  spam_protection:K("Run the anti-spam checks on mail from this range."),virus_protection:K("Run the anti-virus scan on mail from this range."),
  expires:K("Remove the range once the time below passes, as one the auto-ban placed is removed."),
  expires_time:K("YYYY-MM-DD HH:MM:SS on the server's clock, or a date alone for midnight; required when the range expires, and taken only then.")
};
const RANGE_DEFAULTS={priority:15,expires:false,allow_smtp:true,allow_imap:true,allow_pop3:true,
  deliver_local_to_local:true,deliver_local_to_remote:false,deliver_remote_to_local:true,deliver_remote_to_remote:false,
  require_auth_local_to_local:false,require_auth_local_to_remote:true,require_auth_remote_to_local:false,require_auth_remote_to_remote:true,
  require_tls_for_auth:false,spam_protection:true,virus_protection:true};
function rangeProps(){
  const props=properties("/api/v1/ipranges","post"), out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&RANGE_HINTS[k])out[k].description=RANGE_HINTS[k];});
  return out;
}
/* The groups, each with the keys of the schema it names, and then whatever
   the schema has that no group names. */


const yesNo=v=>v?'<span class="badge good">'+t("yes")+'</span>':'<span class="badge warn">'+t("no")+'</span>';
async function renderIpRanges(){
  await loadSpec();
  cache.ranges=asList(await api("/api/v1/ipranges"),"ranges");
  if(editing&&editing.kind==="range"){renderRangeEditor();return;}
  const rows=cache.ranges.map(r=>`
    <tr><td><b>${escHtml(r.name)}</b>${r.expires?' <span class="badge info">'+tf("expires {0}",escHtml(r.expires_time||""))+'</span>':""}<div class="hint muted">${tf("id {0}",escHtml(r.id))}</div></td>
        <td><code>${escHtml(r.lower)}</code></td><td><code>${escHtml(r.upper)}</code></td>
        <td>${escHtml(r.priority)}</td>
        <td>${yesNo(r.allow_smtp)}</td><td>${yesNo(r.allow_imap)}</td><td>${yesNo(r.allow_pop3)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="rangeedit" data-id="${escHtml(r.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="rangedel" data-id="${escHtml(r.id)}" data-label="${escHtml(r.name+" ("+r.lower+" – "+r.upper+")")}">${t("Delete")}</button>
          <div class="err" id="err_range_${escHtml(r.id)}"></div></td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${t("Access control: which addresses may connect and what they are allowed to do. Higher priority wins when ranges overlap.")} ${escHtml(uiDocText(operation("/api/v1/ipranges","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Name")}</th><th>${t("Lower IP")}</th><th>${t("Upper IP")}</th><th>${t("Priority")}</th><th>SMTP</th><th>IMAP</th><th>POP3</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="8" class="empty">'+t("No IP ranges: nothing may connect.")+'</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px"><button class="btn" data-act="rangenew">${t("Add a range")}</button></div>
    </div></div>`;
}
function openRange(id){
  const existing=cache.ranges.filter(r=>Number(r.id)===Number(id))[0];
  const values=existing?JSON.parse(JSON.stringify(existing)):Object.assign({},RANGE_DEFAULTS);
  editing={kind:"range",id:Number(id)||0,values:values};
  renderRangeEditor();
}
function renderRangeEditor(){
  const props=rangeProps(), required=requiredOf("/api/v1/ipranges","post");
  const cards=groupedKeys(RANGE_GROUPS,props).map(g=>`
    <div class="sect"><h2>${escHtml(t(g.title))}</h2>
      <div class="card flat"><div class="form">${formHtml("range",pick(props,g.keys),editing.values,{required:required})}</div></div></div>`).join("");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All IP ranges")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit IP range {0}",escHtml(editing.id)):t("New IP range")}</h2>
      <div class="card flat"><p class="note">${escHtml(operation(editing.id?"/api/v1/ipranges/{id}":"/api/v1/ipranges",editing.id?"put":"post").description||operation("/api/v1/ipranges","post").summary||"")}</p></div></div>
    ${cards}
    <div class="sect"><div class="row">
      <button class="btn" data-act="rangesave">${t("Save IP range")}</button>
      <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
      <div class="err" id="err_rangeedit"></div>
    </div></div></div>`;
}
async function saveRange(){
  setErr("err_rangeedit","");
  let body;
  try{body=readForm("range",rangeProps(),{});}catch(e){setErr("err_rangeedit",e.message);return;}
  try{
    if(editing.id)await api("/api/v1/ipranges/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/ipranges",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("IP range saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_rangeedit",e.message);}
}
async function deleteRange(id,label){
  if(!await deckConfirm(tf("Delete the IP range {0}?",label)))return;
  setErr("err_range_"+id,"");
  try{await api("/api/v1/ipranges/"+id,{method:"DELETE"});toast(t("IP range deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_range_"+id,e.message);}
}

/* ---------- Fetch accounts ----------
   The external POP3 or IMAP mailboxes the server collects into an account:
   Account.FetchAccounts over COM, /api/v1/accounts/{address}/fetch-accounts
   here, under the address that scopes them. The view picks a domain and an
   account first and lists that account's external accounts. The editor is
   built from the schema of the create route, which types every key and gives
   the two enumerations their words, in the order the desktop's external
   accounts editor has them and with its captions; a new one starts at the
   defaults the route's description states - enabled, every 30 minutes, keep 0
   days, pop3, no security - read out of that sentence. */
const FETCH_GROUPS=[
  {title:K("External account"),keys:["enabled","name","server_type","server_address","port","connection_security","username","password"]},
  {title:K("Schedule"),keys:["minutes_between_fetch","days_to_keep_messages"]},
  {title:K("Downloaded mail"),keys:["use_antispam","use_antivirus","mirror_folders","process_mime_recipients","process_mime_date","enable_route_recipients","mime_recipient_headers"]}
];
const FETCH_HINTS={
  enabled:K("Collect from this mailbox on the schedule."),name:K("A name for the external account."),
  server_type:K("POP3 or IMAP."),server_address:K("The remote server."),
  port:K("Connection security and port go together: SSL/TLS on 995 (POP3) or 993 (IMAP), STARTTLS on 110 or 143."),
  connection_security:K("How the connection to the remote server is secured."),username:K("The user name at the remote server."),
  password:K("The password at the remote server. Accepted here and never shown."),
  minutes_between_fetch:K("Minutes between downloads."),
  days_to_keep_messages:K("Days to keep a message on the remote server; 0 keeps every message, -1 deletes it after the download."),
  use_antispam:K("Run anti-spam on downloaded mail."),use_antivirus:K("Run anti-virus on downloaded mail."),
  mirror_folders:K("Mirror every folder (IMAP only): a migration, verbatim, with flags and dates, nothing delivered."),
  process_mime_recipients:K("Read the recipients from the message's headers and deliver to the local ones found there; when none are, to this account."),
  process_mime_date:K("Use the message's own Date header as its date rather than the time of the download."),
  enable_route_recipients:K("Also deliver to a recipient found in the headers when a route covers its domain."),
  mime_recipient_headers:K("The headers the recipients are read from, comma-separated.")
};
/* What an external account leaves on the remote server, in the server's one
   meaning for POP3 and IMAP (FetchAccount.h): 0 every message, -1 nothing once
   it has been collected, N days. Until 6.3.6 this list read "keep 0 days" for
   an account that keeps everything. */
function fetchKeepWords(days){
  const n=Number(days);
  if(n<0)return t("delete after the download");
  if(n===0)return t("keep on the server");
  return tf("keep {0} days",String(n));
}
/* Said beside every days_to_keep_messages this page sends: the one meaning
   above, the server's since schema 6106. A Deck loaded before 6.3.6 told the
   administrator that -1 keeps every message; the server refuses a negative value
   from a browser session without this beside it, so that such a page, still open
   after the upgrade, cannot have the mail deleted (RestApiFetchAccounts.cpp). */
const FETCH_KEEP_MEANING=6106;
function fetchProps(){
  const props=properties("/api/v1/accounts/{address}/fetch-accounts","post"), out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&FETCH_HINTS[k])out[k].description=FETCH_HINTS[k];});
  return out;
}
async function renderFetch(){
  await loadSpec();
  const f=cache.fetch;
  cache.domains=asList(await api("/api/v1/domains"),"domains");
  if(!cache.domains.some(d=>d.name===f.domain)){f.domain=cache.domains.length?cache.domains[0].name:"";f.address="";}
  f.accounts=f.domain?asList(await api("/api/v1/domains/"+encodeURIComponent(f.domain)+"/accounts"),"accounts"):[];
  if(!f.accounts.some(a=>a.address===f.address))f.address=f.accounts.length?f.accounts[0].address:"";
  f.items=f.address?asList(await api("/api/v1/accounts/"+encodeURIComponent(f.address)+"/fetch-accounts"),"fetch_accounts"):[];
  if(editing&&editing.kind==="fetch"){renderFetchEditor();return;}
  const rows=f.items.map(x=>`
    <tr><td><b>${escHtml(x.name)}</b><div class="hint muted">${tf("id {0}",escHtml(x.id))}</div></td>
        <td>${x.enabled?'<span class="badge good">'+t("On")+'</span>':'<span class="badge warn">'+t("Off")+'</span>'}${x.locked?' <span class="badge info">'+t("collecting")+'</span>':""}</td>
        <td><code>${escHtml(x.server_address)}:${escHtml(x.port)}</code><div class="hint muted">${escHtml(humanise(x.server_type))}, ${escHtml(humanise(x.connection_security))}</div></td>
        <td>${escHtml(x.username||"—")}</td>
        <td>${tf("{0} min",escHtml(x.minutes_between_fetch))}<div class="hint muted">${escHtml(fetchKeepWords(x.days_to_keep_messages))}</div></td>
        <td>${escHtml(x.next_download_time||"—")}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="fetchnow" data-id="${escHtml(x.id)}">${t("Collect now")}</button>
          <button class="btn ghost sm" data-act="fetchedit" data-id="${escHtml(x.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="fetchdel" data-id="${escHtml(x.id)}" data-name="${escHtml(x.name)}">${t("Delete")}</button>
          <div class="err" id="err_fetch_${escHtml(x.id)}"></div></td></tr>`).join("");
  const domainChoices=cache.domains.map(d=>({value:d.name,label:d.name}));
  const accountChoices=f.accounts.map(a=>({value:a.address,label:a.address}));
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/accounts/{address}/fetch-accounts","get").description||""))}</p>
      <div class="row">
        <label class="row" style="gap:7px">${t("Domain")} <select id="fetchDomain" data-r="fetch-domain">${optionsHtml(domainChoices,f.domain)}</select></label>
        <label class="row" style="gap:7px">${t("Account")} <select id="fetchAccount" data-r="fetch-account">${optionsHtml(accountChoices,f.address)}</select></label>
      </div>
    </div>
    <div class="sect"><h2>${f.address?tf("{0} — external accounts",escHtml(f.address)):t("No account to collect for")}</h2>
      <div class="card flat">
        <div class="tablewrap"><table><thead><tr><th>${t("Name")}</th><th>${t("State")}</th><th>${t("Server")}</th><th>${t("User name")}</th><th>${t("Every")}</th><th>${t("Next download")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="7" class="empty">'+(f.address?tf("No external accounts are collected for {0}.",escHtml(f.address)):t("Choose a domain that has accounts."))+'</td></tr>'}</tbody></table></div>
        ${f.address?'<div class="row" style="margin-top:16px"><button class="btn" data-act="fetchnew">'+t("Add an external account")+'</button></div>':""}
      </div></div></div>`;
}
function openFetch(id){
  const existing=cache.fetch.items.filter(x=>Number(x.id)===Number(id))[0];
  const values=existing
    ? JSON.parse(JSON.stringify(existing))
    : documentedDefaults("/api/v1/accounts/{address}/fetch-accounts","post",fetchProps());
  editing={kind:"fetch",id:Number(id)||0,values:values};
  renderFetchEditor();
}
function renderFetchEditor(){
  const props=fetchProps(), required=requiredOf("/api/v1/accounts/{address}/fetch-accounts","post");
  const cards=groupedKeys(FETCH_GROUPS,props).map(g=>`
    <div class="sect"><h2>${escHtml(t(g.title))}</h2>
      <div class="card flat"><div class="form">${formHtml("fetch",pick(props,g.keys),editing.values,{required:required})}</div></div></div>`).join("");
  const op=editing.id?operation("/api/v1/accounts/{address}/fetch-accounts/{id}","put"):operation("/api/v1/accounts/{address}/fetch-accounts","post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All external accounts")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit external account {0} for {1}",escHtml(editing.id),escHtml(cache.fetch.address)):tf("New external account for {0}",escHtml(cache.fetch.address))}</h2>
      <div class="card flat"><p class="note">${escHtml(op.description||"")}</p></div></div>
    ${cards}
    <div class="sect"><div class="row">
      <button class="btn" data-act="fetchsave">${t("Save external account")}</button>
      <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
      <div class="err" id="err_fetchedit"></div>
    </div></div></div>`;
}
async function saveFetch(){
  setErr("err_fetchedit","");
  let body;
  try{body=readForm("fetch",fetchProps(),{});}catch(e){setErr("err_fetchedit",e.message);return;}
  body.days_to_keep_meaning=FETCH_KEEP_MEANING;
  const address=encodeURIComponent(cache.fetch.address);
  try{
    if(editing.id)await api("/api/v1/accounts/"+address+"/fetch-accounts/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/accounts/"+address+"/fetch-accounts",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("External account saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_fetchedit",e.message);}
}
async function deleteFetch(id,name){
  if(!await deckConfirm(tf("Delete the external account {0}? Mail already collected stays.",name)))return;
  setErr("err_fetch_"+id,"");
  try{await api("/api/v1/accounts/"+encodeURIComponent(cache.fetch.address)+"/fetch-accounts/"+id,{method:"DELETE"});toast(t("External account deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_fetch_"+id,e.message);}
}
async function fetchNow(id){
  setErr("err_fetch_"+id,"");
  try{await api("/api/v1/accounts/"+encodeURIComponent(cache.fetch.address)+"/fetch-accounts/"+id+"/download",{method:"POST"});toast(t("Collection queued"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_fetch_"+id,e.message);}
}

/* ---------- Lists ----------
   The nine small collections the desktop edits in its collection editors,
   each a resource of the same shape - a listing and a create at its path, an
   update and a delete at /{id} - drawn from one description: the DNS
   blacklists, the SURBL servers, the anti-spam white list, the blocked
   senders, the blocked attachments, the sender list, the greylisting white
   list, the incoming relays and the greylisting bypass list. Each is a table
   of the entry's own keys, with Edit and
   Delete on the row and Add below, and the editor is built from the schema
   of that collection's create, which types every key; a new entry starts at
   the defaults the create's description states, and at the desktop editor's
   where the description has none - a score of 5 for a DNS list, 100 for a
   blocked sender, *.exe for an attachment. Save posts a new entry and PUTs
   the whole record of an existing one by id, as the range editor does, then
   reads the collections again. The captions are the desktop editors'. Each
   collection carries its own sentences rather than a noun the sentences are
   built around, because a noun's gender and case change the sentence in most
   of the languages the page speaks. */
const COLLECTIONS=[
  {id:"dnsbl",path:"/api/v1/dns-blacklists",title:K("DNS blacklists"),columns:["active","dns_host","expected_result","reject_message","score"],
    add:K("Add a DNS blacklist"),fresh:K("New DNS blacklist"),edit:K("Edit DNS blacklist {0}"),save:K("Save DNS blacklist"),ask:K("Delete the DNS blacklist {0}?"),saved:K("DNS blacklist saved"),deleted:K("DNS blacklist deleted"),
    defaults:{score:5},hints:{active:K("Consulted for the next message."),dns_host:K("The zone the connecting address is looked up in."),expected_result:K("The answers that mean listed: 127.0.0.2, a range or a wildcard."),reject_message:K("The text of the refusal."),score:K("The spam score a listing adds.")}},
  {id:"surbl",path:"/api/v1/surbl-servers",title:K("SURBL servers"),columns:["active","dns_host","expected_result","reject_message","score"],
    add:K("Add a SURBL server"),fresh:K("New SURBL server"),edit:K("Edit SURBL server {0}"),save:K("Save SURBL server"),ask:K("Delete the SURBL server {0}?"),saved:K("SURBL server saved"),deleted:K("SURBL server deleted"),
    defaults:{score:5},hints:{active:K("Consulted for the next message."),dns_host:K("The zone the domains in a message are looked up in."),expected_result:K("The answers that mean listed; empty is any answer but a refusal code."),reject_message:K("The text of the refusal."),score:K("The spam score a listing adds.")}},
  {id:"whitelist",path:"/api/v1/whitelist-addresses",title:K("Anti-spam white list"),columns:["lower_ip","upper_ip","email_address","description"],
    add:K("Add a white-list address"),fresh:K("New white-list address"),edit:K("Edit white-list address {0}"),save:K("Save white-list address"),ask:K("Delete the white-list address {0}?"),saved:K("White-list address saved"),deleted:K("White-list address deleted"),
    defaults:{},hints:{lower_ip:K("The lowest address of the range."),upper_ip:K("The highest address of the range."),email_address:K("The sender, with wildcards; empty is any."),description:K("A note.")}},
  {id:"blocked",path:"/api/v1/blocked-senders",title:K("Blocked senders"),columns:["address","score","description"],
    add:K("Add a blocked sender"),fresh:K("New blocked sender"),edit:K("Edit blocked sender {0}"),save:K("Save blocked sender"),ask:K("Delete the blocked sender {0}?"),saved:K("Blocked sender saved"),deleted:K("Blocked sender deleted"),
    defaults:{score:100},hints:{address:K("An address, a domain that covers its subdomains, or a URL such as https://host/anything, which covers links to that host."),score:K("The spam score the sender adds; the desktop's 100 crosses every threshold."),description:K("A note.")}},
  {id:"attachments",path:"/api/v1/blocked-attachments",title:K("Blocked attachments"),columns:["wildcard","description"],
    add:K("Add a blocked attachment"),fresh:K("New blocked attachment"),edit:K("Edit blocked attachment {0}"),save:K("Save blocked attachment"),ask:K("Delete the blocked attachment {0}?"),saved:K("Blocked attachment saved"),deleted:K("Blocked attachment deleted"),
    defaults:{wildcard:"*.exe"},hints:{wildcard:K("A file-name pattern, such as *.exe."),description:K("A note.")}},
  {id:"senderlist",path:"/api/v1/sender-list",title:K("Allow and block list"),columns:["value","blocked","reason","expires"],
    add:K("Add an entry"),fresh:K("New list entry"),edit:K("Edit list entry {0}"),save:K("Save list entry"),ask:K("Delete the list entry {0}?"),saved:K("List entry saved"),deleted:K("List entry deleted"),
    defaults:{blocked:false,expires:false},hints:{value:K("An address, a domain that covers its subdomains, or a URL such as https://host/anything, which covers links to that host."),blocked:K("On blocks the sender for every account; off lets its mail past the spam filter."),reason:K("Why the entry is there."),expires:K("Whether the entry stops mattering at a time."),expires_time:K("When it stops mattering, as YYYY-MM-DD HH:MM:SS.")}},
  {id:"greylist",path:"/api/v1/greylisting-white-addresses",title:K("Greylisting white list"),columns:["ip_address","description"],
    add:K("Add a greylisting white address"),fresh:K("New greylisting white address"),edit:K("Edit greylisting white address {0}"),save:K("Save greylisting white address"),ask:K("Delete the greylisting white address {0}?"),saved:K("Greylisting white address saved"),deleted:K("Greylisting white address deleted"),
    defaults:{},hints:{ip_address:K("An address, or a pattern such as 192.168.* or 2001:db8:*."),description:K("A note.")}},
  {id:"relays",path:"/api/v1/incoming-relays",title:K("Incoming relays"),columns:["name","lower_ip","upper_ip"],
    add:K("Add an incoming relay"),fresh:K("New incoming relay"),edit:K("Edit incoming relay {0}"),save:K("Save incoming relay"),ask:K("Delete the incoming relay {0}?"),saved:K("Incoming relay saved"),deleted:K("Incoming relay deleted"),
    defaults:{},hints:{name:K("A name for the relay."),lower_ip:K("The lowest address of the range."),upper_ip:K("The highest address of the range.")}},
  /* Last, after the relays, so the eight tables before it keep their places. */
  {id:"greybypass",path:"/api/v1/greylisting-bypass",title:K("Greylisting bypass list"),columns:["pattern","match","require_spf","require_dkim","require_dmarc","note"],
    add:K("Add a greylisting bypass entry"),fresh:K("New greylisting bypass entry"),edit:K("Edit greylisting bypass entry {0}"),save:K("Save greylisting bypass entry"),ask:K("Delete the greylisting bypass entry {0}?"),saved:K("Greylisting bypass entry saved"),deleted:K("Greylisting bypass entry deleted"),
    defaults:{match:"envelope",require_spf:true,require_dkim:false,require_dmarc:false},hints:{pattern:K("A domain such as example.com, matched exactly; or a suffix such as .mail.example.com, which covers that name and every name under it."),match:K("Whether the pattern is matched against the envelope sender's domain, the HELO host, or either."),require_spf:K("The message must pass SPF. Known at RCPT TO, so an entry requiring SPF alone decides there."),require_dkim:K("The message must carry a DKIM signature that verifies. Known only after DATA, so the message is received first; needs DKIM verification switched on."),require_dmarc:K("The message must pass DMARC. Known only after DATA; needs DMARC switched on."),note:K("Why the entry is there.")}},
  // Keyed by domain where the lists above are keyed by address (discussion
  // #285): white skips greylisting and the score's refusals while the tests
  // still run, black is a 550 at MAIL FROM before anything runs. The two
  // choices are enums in the OpenAPI document, so the form draws them as
  // selects on its own.
  {id:"domainpolicy",path:"/api/v1/domain-policy-list",title:K("Domain white and black list"),columns:["pattern","match_on","action","note"],
    add:K("Add a domain"),fresh:K("New domain list entry"),edit:K("Edit domain list entry {0}"),save:K("Save domain list entry"),ask:K("Delete the domain list entry {0}?"),saved:K("Domain list entry saved"),deleted:K("Domain list entry deleted"),
    defaults:{match_on:"both",action:"white"},hints:{pattern:K("example.com for that domain alone, or .example.com for the domain and everything beneath it."),match_on:K("What the pattern is compared with: the envelope sender's domain, the HELO name, or either."),action:K("White skips greylisting and the score's refusals while every test still runs and logs; black is refused at MAIL FROM before any test runs."),note:K("Why the entry is there.")}},
  // The never-ban list by reverse name (GitLab work item #56): providers no
  // auto-ban ever bans, named by the reverse names of their hosts - the
  // Auto-ban page's list on the desktop. Last, so the tables before it keep
  // their places, and the one collection with a check: what the list would
  // decide about an address, which the server looks up when asked.
  {id:"neverban",path:"/api/v1/never-ban-names",title:K("Never-ban list by reverse name"),columns:["pattern","note","created"],
    add:K("Add a name"),fresh:K("New never-ban name"),edit:K("Edit never-ban name {0}"),save:K("Save never-ban name"),ask:K("Delete the never-ban name {0}?"),saved:K("Never-ban name saved"),deleted:K("Never-ban name deleted"),
    defaults:{},hints:{pattern:K("mail.example.net for that name alone, or .example.net for the name and every name beneath it. An address is spared only when its reverse name also resolves back to it."),note:K("Why the entry is there.")},
    check:"/api/v1/never-ban-names/check"}
];
function collectionById(id){return COLLECTIONS.filter(c=>c.id===id)[0];}
function collectionProps(c){
  const props=properties(c.path,"post"), out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&c.hints[k])out[k].description=c.hints[k];});
  return out;
}
/* ---------- Spam traps ----------
   The record across every domain, which is the one question this page can
   answer that a domain's own card cannot: is anything walking the address
   space, and what did the server do about it. The traps themselves are
   declared on the domain they belong to, so this view links back to it. */
async function renderSpamTraps(){
  await loadSpec();
  const answer=await api("/api/v1/spam-traps/hits?limit=200");
  const hits=asList(answer,"items");
  const rows=hits.map(h=>`
    <tr><td>${escHtml(h.time||"")}</td><td><code>${escHtml(h.address||"")}</code></td>
        <td>${escHtml(h.domain||"")}</td><td>${escHtml(h.ip_address||"")}</td><td>${escHtml(h.sender||"\u2014")}</td>
        <td>${h.banned?'<span class="badge warn">'+t("IP banned")+'</span> ':""}${h.blocked?'<span class="badge warn">'+t("Sender blocked")+'</span> ':""}${escHtml(h.note||"")}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat"><p class="note">${escHtml(uiDocText(operation("/api/v1/spam-traps/hits","get").description||""))}</p>
      <p class="note">${tf("Hits since the server started: {0}",String(Number(answer&&answer.hits_since_start!==undefined?answer.hits_since_start:hits.length)||0))}</p></div>
    <div class="sect"><h2>${t("Recently addressed")}</h2>
      <div class="card flat">
        <div class="tablewrap"><table><thead><tr><th>${t("When")}</th><th>${t("Trap")}</th><th>${t("Domain")}</th><th>${t("Connecting address")}</th><th>${t("Sender")}</th><th>${t("What was done")}</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="empty">'+t("Nothing has addressed a spam trap.")+'</td></tr>'}</tbody></table></div>
        <div class="row" style="margin-top:16px"><button class="btn ghost" data-act="trapclear">${t("Clear the record")}</button>
          <div class="err" id="err_trapclear"></div></div>
      </div></div>
    </div>`;
}
async function clearSpamTrapHits(){
  if(!await deckConfirm(t("Clear the record of every spam trap hit? The bans and the blocked senders they made stay.")))return;
  setErr("err_trapclear","");
  try{
    const answer=await api("/api/v1/spam-traps/hits",{method:"DELETE"});
    toast(tf("{0} hits cleared",String(answer&&answer.removed!==undefined?answer.removed:0)));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_trapclear",e.message);}
}

async function renderJournal(){
  await loadSpec();
  const rules=asList(await api("/api/v1/journal-rules"),"items");
  const word=(k,v)=>({domain:t("Domain"),account:t("Account"),inbound:t("Arriving"),outbound:t("Sent"),both:t("Both ways"),
    report:t("Envelope report"),copy:t("The message itself")}[v]||v);
  const rows=rules.map(r=>`
    <tr><td><code>${escHtml(r.target||"")}</code><div class="note">${escHtml(word("scope",r.scope))}</div></td>
        <td>${escHtml(word("direction",r.direction))}</td>
        <td>${escHtml(word("mode",r.mode))}</td>
        <td><code>${escHtml(r.journal_address||"")}</code></td>
        <td>${r.enabled?'<span class="badge ok">'+t("On")+'</span>':'<span class="badge">'+t("Off")+'</span>'}</td>
        <td>${escHtml(r.note||"\u2014")}</td>
        <td class="right"><button class="btn ghost sm" data-act="jrntoggle" data-id="${Number(r.id)||0}" data-value="${r.enabled?"0":"1"}">${r.enabled?t("Switch off"):t("Switch on")}</button>
          <button class="btn ghost sm" data-act="jrndel" data-id="${Number(r.id)||0}" data-value="${escHtml(r.target||"")}">${t("Remove")}</button></td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat"><p class="note">${escHtml(uiDocText(operation("/api/v1/journal-rules","get").description||""))}</p></div>
    <div class="sect"><h2>${t("Journaling rules")}</h2>
      <div class="card flat" id="journalRules">
        <div class="tablewrap"><table><thead><tr><th>${t("Whose mail")}</th><th>${t("Which way")}</th><th>${t("What is sent")}</th><th>${t("Where it goes")}</th><th>${t("State")}</th><th>${t("Note")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="7" class="empty">'+t("No journaling rules: nothing is copied anywhere and the evaluation costs one comparison per message.")+'</td></tr>'}</tbody></table></div>
      </div></div>
    <div class="sect"><h2>${t("Add a rule")}</h2>
      <div class="card flat">
        <div class="row" data-enter="jrnadd">
          <select id="newJournalScope" aria-label="${t("Whose mail")}"><option value="domain">${t("Domain")}</option><option value="account">${t("Account")}</option></select>
          <input id="newJournalTarget" placeholder="${t("A domain, or an account address")}" aria-label="${t("Whose mail")}" style="flex:1;min-width:200px">
          <select id="newJournalDirection" aria-label="${t("Which way")}"><option value="both">${t("Both ways")}</option><option value="inbound">${t("Arriving")}</option><option value="outbound">${t("Sent")}</option></select>
          <select id="newJournalMode" aria-label="${t("What is sent")}"><option value="report">${t("Envelope report")}</option><option value="copy">${t("The message itself")}</option></select>
          <input id="newJournalAddress" placeholder="${t("Where the copy goes")}" aria-label="${t("Where it goes")}" style="flex:1;min-width:200px">
          <input id="newJournalNote" placeholder="${t("Why (optional)")}" aria-label="${t("Note")}" style="flex:1;min-width:140px">
          <button class="btn ghost sm" data-act="jrnadd">${t("Add a rule")}</button>
        </div>
        <div class="err" id="err_journal"></div>
      </div></div>
    </div>`;
}
async function addJournalRule(){
  setErr("err_journal","");
  const target=$("#newJournalTarget").value.trim();
  const address=$("#newJournalAddress").value.trim();
  if(!target){setErr("err_journal",t("A domain or an account address is required."));return;}
  if(!address){setErr("err_journal",t("The address the copy goes to is required."));return;}
  try{
    await api("/api/v1/journal-rules",{method:"POST",body:JSON.stringify({scope:$("#newJournalScope").value,target:target,
      journal_address:address,direction:$("#newJournalDirection").value,mode:$("#newJournalMode").value,note:$("#newJournalNote").value.trim()})});
    toast(tf("Journaling rule added for {0}",target));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_journal",e.message);}
}
async function toggleJournalRule(id,enabled){
  setErr("err_journal","");
  try{
    await api("/api/v1/journal-rules/"+id,{method:"PUT",body:JSON.stringify({enabled:enabled})});
    toast(enabled?t("The rule is on."):t("The rule is off. Nothing it covers is copied until it is on again."));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_journal",e.message);}
}
async function deleteJournalRule(id,target){
  if(!await deckConfirm(tf("Remove the journaling rule for {0}? What it has already sent stays where it was sent.",target)))return;
  setErr("err_journal","");
  try{
    await api("/api/v1/journal-rules/"+id,{method:"DELETE"});
    toast(tf("Journaling rule removed for {0}",target));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_journal",e.message);}
}

async function renderLists(){
  await loadSpec();
  for(const c of COLLECTIONS)cache.collections[c.id]=asList(await api(c.path),"items");
  if(editing&&editing.kind==="collection"){renderCollectionEditor();return;}
  const cell=(c,x,k)=>{
    const prop=properties(c.path,"post")[k]||{};
    if(prop.type==="boolean")return yesNo(x[k]);
    return escHtml(x[k]===undefined||x[k]===null||x[k]===""?"—":x[k]);
  };
  const sections=COLLECTIONS.map(c=>{
    // The question a delete asks names the entry by its first text column.
    const labelKey=c.columns.filter(k=>(properties(c.path,"post")[k]||{}).type!=="boolean")[0]||c.columns[0];
    const rows=cache.collections[c.id].map(x=>`
      <tr>${c.columns.map(k=>'<td>'+cell(c,x,k)+'</td>').join("")}
          <td style="text-align:right;white-space:nowrap">
            <button class="btn ghost sm" data-act="colledit" data-coll="${c.id}" data-id="${escHtml(x.id)}">${t("Edit")}</button>
            <button class="btn danger sm" data-act="colldel" data-coll="${c.id}" data-id="${escHtml(x.id)}" data-label="${escHtml(x[labelKey]===undefined?x.id:x[labelKey])}">${t("Delete")}</button>
            <div class="err" id="err_coll_${c.id}_${escHtml(x.id)}"></div></td></tr>`).join("");
    return `<div class="sect"><h2>${escHtml(t(c.title))} <code class="muted">${escHtml(c.path)}</code></h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation(c.path,"get").description||""))}</p>
        <div class="tablewrap"><table><thead><tr>${c.columns.map(k=>'<th>'+escHtml(humanise(k))+'</th>').join("")}<th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="'+(c.columns.length+1)+'" class="empty">'+t("Nothing here.")+'</td></tr>'}</tbody></table></div>
        <div class="row" style="margin-top:16px"><button class="btn" data-act="collnew" data-coll="${c.id}">${t(c.add)}</button></div>
        ${c.check?`<div class="row" style="margin-top:12px">
          <input id="chk_${c.id}" placeholder="192.0.2.10" aria-label="${t("Address to check")}" style="flex:1;min-width:220px;max-width:320px">
          <button class="btn ghost" data-act="collcheck" data-coll="${c.id}">${t("Check an address")}</button></div>
        <div class="err" id="err_chk_${c.id}"></div><div id="out_chk_${c.id}"></div>`:""}
      </div></div>`;
  }).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat"><p class="note">${t("The lists the desktop Control Panel edits in its collection editors, each a resource of its own. Every table and every editor below is built from the server's OpenAPI document, so a key a collection gains appears here on its own.")}</p></div>
    ${sections}</div>`;
}
function openCollectionItem(collId,id){
  const c=collectionById(collId);
  const existing=(cache.collections[collId]||[]).filter(x=>Number(x.id)===Number(id))[0];
  const values=existing?JSON.parse(JSON.stringify(existing)):Object.assign(documentedDefaults(c.path,"post",collectionProps(c)),c.defaults);
  editing={kind:"collection",coll:collId,id:Number(id)||0,values:values};
  renderCollectionEditor();
}
function renderCollectionEditor(){
  const c=collectionById(editing.coll), props=collectionProps(c);
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All lists")}</button>
    <div class="sect"><h2>${editing.id?tf(c.edit,escHtml(editing.id)):t(c.fresh)}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation(editing.id?c.path+"/{id}":c.path,editing.id?"put":"post").description||""))}</p>
        <div class="form">${formHtml("coll",props,editing.values,{required:requiredOf(c.path,"post")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="collsave">${t(c.save)}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_colledit"></div>
        </div>
      </div></div></div>`;
}
async function saveCollectionItem(){
  setErr("err_colledit","");
  const c=collectionById(editing.coll);
  let body;
  try{body=readForm("coll",collectionProps(c),{});}catch(e){setErr("err_colledit",e.message);return;}
  try{
    if(editing.id)await api(c.path+"/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api(c.path,{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t(c.saved));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_colledit",e.message);}
}
/* What a collection with a check - the never-ban list by reverse name - would
   decide about one address: the server looks its reverse names up now and says
   whether one is covered and resolves back. Nothing is kept or changed. The
   reason is the server's own sentence; each reverse name is a row of the
   answer's own keys. */
async function checkCollectionAddress(collId){
  const c=collectionById(collId);
  const input=document.getElementById("chk_"+collId), out=document.getElementById("out_chk_"+collId);
  setErr("err_chk_"+collId,"");
  if(out)out.innerHTML="";
  const address=input?String(input.value||"").trim():"";
  if(!address){setErr("err_chk_"+collId,t("Type an address first."));return;}
  try{
    const r=await api(c.check,{method:"POST",body:JSON.stringify({address:address})});
    const names=Array.isArray(r.reverse_names)?r.reverse_names:[];
    const keys=["name","usable","pattern","resolves_back"];
    const rows=names.map(n=>'<tr>'+keys.map(k=>'<td>'+(typeof n[k]==="boolean"?yesNo(n[k]):escHtml(n[k]===undefined||n[k]===null||n[k]===""?"—":n[k]))+'</td>').join("")+'</tr>').join("");
    if(out)out.innerHTML=`<p class="note"><strong>${escHtml(r.spared?t("Spared from auto-ban"):t("Not spared"))}</strong> ${escHtml(r.address||address)}: ${escHtml(r.reason||"")}</p>
      ${rows?`<div class="tablewrap"><table><thead><tr>${keys.map(k=>'<th>'+escHtml(humanise(k))+'</th>').join("")}</tr></thead><tbody>${rows}</tbody></table></div>`:""}`;
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_chk_"+collId,e.message);}
}
async function deleteCollectionItem(collId,id,label){
  const c=collectionById(collId);
  if(!await deckConfirm(tf(c.ask,label)))return;
  setErr("err_coll_"+collId+"_"+id,"");
  try{await api(c.path+"/"+id,{method:"DELETE"});toast(t(c.deleted));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_coll_"+collId+"_"+id,e.message);}
}

