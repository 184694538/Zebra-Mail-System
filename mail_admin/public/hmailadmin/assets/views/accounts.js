/* ---------- Domains and accounts ----------
   The domain's editor holds every field PUT /api/v1/domains/{domain} takes,
   grouped as the desktop Control Panel's domain dialog groups them. That
   route's schema names three keys and lists the rest in its description, so
   this table is that prose, typed: each key's type, its words and whether it
   is write-only are as the handler reads them. The handler refuses a key it
   does not take, by name, so a key here that the server no longer takes is a
   refusal shown on the page rather than a change lost in silence. Save sends
   active, which the route requires, and the keys whose control differs from
   the record as it was read; a filled password goes as well. */
const DOMAIN_GROUPS=[
  {title:K("General"),props:{
    active:{type:"boolean",description:K("Whether the domain receives mail and its accounts can sign in.")},
    name:{type:"string",description:K("The domain name. Changing it renames the domain and moves every account, alias and list with it.")},
    postmaster:{type:"string",description:K("Mail to an unknown recipient in the domain is redirected to this address; empty means it is refused.")}}},
  {title:K("Limits"),props:{
    max_size_mb:{type:"integer",description:K("Maximum domain size in MB; 0 is unlimited.")},
    max_message_size_kb:{type:"integer",description:K("Maximum message size in KB; 0 is unlimited.")},
    max_account_size_mb:{type:"integer",description:K("Maximum size for accounts created in this domain, in MB; 0 is unlimited.")},
    message_retention_days:{type:"integer",description:K("Delete messages in this domain's mailboxes older than this many days; 0 is no policy, and an account's own value overrides it.")},
    max_accounts_enabled:{type:"boolean",description:K("Limit the number of accounts.")},
    max_accounts:{type:"integer",description:K("The most accounts the domain may hold, when limited.")},
    max_aliases_enabled:{type:"boolean",description:K("Limit the number of aliases.")},
    max_aliases:{type:"integer",description:K("The most aliases the domain may hold, when limited.")},
    max_lists_enabled:{type:"boolean",description:K("Limit the number of distribution lists.")},
    max_lists:{type:"integer",description:K("The most distribution lists the domain may hold, when limited.")},
    plus_addressing_enabled:{type:"boolean",description:K("Enable plus addressing: mail to user+anything@domain reaches user@domain.")},
    plus_addressing_character:{type:"string",description:K("The one character that separates the address from its tag.")},
    use_greylisting:{type:"boolean",description:K("Enable greylisting for this domain.")}}},
  {title:K("Signature"),props:{
    signature_enabled:{type:"boolean",description:K("Add a signature to outgoing messages.")},
    signature_method:{type:"string","enum":["set_if_not_specified","overwrite","append"],description:K("Use the domain's signature only if the account has none, overwrite the account's signature, or append to it.")},
    signature_plain_text:{type:"string",format:"multiline",description:K("The plain-text signature.")},
    signature_html:{type:"string",format:"multiline",description:K("The HTML signature.")},
    signature_add_to_replies:{type:"boolean",description:K("Add the signature to replies.")},
    signature_add_to_local_mail:{type:"boolean",description:K("Add the signature to local e-mail.")}}},
  {title:K("Relay"),props:{
    relay_host:{type:"string",description:K("Where mail FROM this domain leaves through. Empty means the domain has no opinion and the server-wide SMTP relayer applies; a route still wins over both, because a route is a statement about the destination.")},
    relay_port:{type:"integer",description:K("The relay's port; 0 is 25.")},
    relay_connection_security:{type:"string","enum":["none","starttls_optional","starttls_required","tls"],description:K("How the connection to the relay is secured.")},
    relay_requires_auth:{type:"boolean",description:K("The relay requires authentication.")},
    relay_username:{type:"string",description:K("The user name for the relay.")},
    relay_password:{type:"string",writeOnly:true,description:K("The password for the relay. Accepted here and never shown.")}}},
  {title:K("Out of office"),props:{
    vacation_enabled:{type:"boolean",description:K("Send a domain-wide out-of-office reply. It answers only for accounts that have no vacation message of their own, and at most one reply answers any message.")},
    vacation_subject:{type:"string",description:K("The reply's subject.")},
    vacation_message:{type:"string",format:"multiline",description:K("The reply's text.")},
    vacation_internal_subject:{type:"string",description:K("The subject for senders whose address belongs to this server; empty means the subject above.")},
    vacation_internal_message:{type:"string",format:"multiline",description:K("The text for senders whose address belongs to this server; empty means the text above, and leaving the text above empty makes the reply internal-only.")},
    vacation_external_override:{type:"boolean",description:K("Senders outside this server get the domain's text even when the account has a reply of its own; colleagues still get the account's.")},
    vacation_days:{type:"integer",description:K("Days after which the same sender is answered again while the reply stays on; 0 answers each sender once per absence.")}}},
  {title:K("Quota policy"),props:{
    quota_warning_percent:{type:"integer",description:K("Warn the mailbox owner at this percentage of their limit; 0 warns nobody and -1 uses the server's QuotaWarningPercent.")},
    quota_warning_subject:{type:"string",description:K("The warning's subject; empty uses the QUOTA_WARNING_SUBJECT server message.")},
    quota_warning_text:{type:"string",format:"multiline",description:K("The warning's text, with %MACRO_MAILBOX%, %MACRO_QUOTA%, %MACRO_USED% and %MACRO_PERCENT%; empty uses the QUOTA_WARNING server message.")},
    quota_grace_percent:{type:"integer",description:K("How far past its limit a mailbox still accepts incoming mail, as a percentage of the limit; 0 is not at all and -1 uses the server's value.")},
    quota_send_stop_percent:{type:"integer",description:K("The percentage of its limit at which an account stops sending, before it stops receiving; 0 is never and -1 uses the server's value.")}}},
  {title:K("Country blocking"),props:{
    country_policy:{type:"string",description:K("Which countries may sign in to this domain's accounts, on any protocol. Empty judges nothing; allow:GB,IE admits only those countries; block:CN,RU refuses those. It needs the server's geographic database to be configured, and an address in the exempt ranges - the loopback address and the private networks - is never judged.")}}},
  {title:K("What this domain does to a message"),props:{
    external_tag_subject:{type:"boolean",description:K("Put the tag text at the front of the subject of mail this domain receives from outside. It breaks any DKIM signature the sender made over their subject, exactly as the anti-spam subject prefix does; the header below costs the sender nothing.")},
    external_tag_header:{type:"boolean",description:K("Stamp X-hMailServer-External on mail this domain receives from outside, which the webmail shows as a banner beside the sender.")},
    external_tag_text:{type:"string",description:K("The text put at the front of the subject. Empty is the shipped [EXTERNAL]. At most 100 characters, so a domain whose readers do not read English can say it in the language they do.")},
    first_contact_tip:{type:"boolean",description:K("Tell the reader when an outside sender has not written to this account before. It costs one database lookup for each message delivered here.")},
    disclaimer_enabled:{type:"boolean",description:K("Append the legal footer below to mail this domain sends outside the organisation. Never to a signed or encrypted message, an automatic reply, a bounce or a list posting, and never twice on a reply chain.")},
    disclaimer_plain_text:{type:"string",format:"multiline",description:K("The footer, as plain text.")},
    disclaimer_html:{type:"string",format:"multiline",description:K("The footer, as HTML. Empty means the plain text is used, with its line breaks turned into line breaks in HTML.")}}},
  {title:K("Impersonation protection"),props:{
    impersonation_action:{type:"integer",description:K("What is done with a message from outside whose sender's display name is an active account's person name or a protected person's, or whose sender domain is one edit or one look-alike character from a domain this server hosts or a protected partner: 0 is off, the default, and nothing is read; 1 flags the recipient's copy with a header the webmail shows as a warning; 2 holds the copy in the quarantine as a spam verdict would, released as spam is and not checked again. A sender the recipient marked safe is exempt, and so is a sender domain that is itself hosted here or a partner.")},
    protected_persons:{type:"string",format:"multiline",description:K("People outside this domain's accounts whose name must not be borrowed - the chairman who has no mailbox here, or an address at another hosted domain. One per line or separated by commas, each a name, an address, or a name followed by the address in angle brackets; at most 2,000 characters.")},
    protected_partners:{type:"string",format:"multiline",description:K("Domains whose look-alikes are judged exactly as this server's own are: partner.example, separated by commas or spaces, ASCII only (an internationalised name in its xn-- form); at most 2,000 characters.")}}},
  {title:K("Sessions"),props:{
    session_idle_seconds:{type:"integer",description:K("How long a signed-in browser session of this domain's accounts - the webmail, the self-service portal - may go unused before it ends, in seconds. 0 takes the server-wide value, and where that is 0 too the server's own ceiling of 1800 seconds applies. At most 2592000, which is thirty days.")},
    session_lifetime_seconds:{type:"integer",description:K("How long such a session may live at all, however busy it is, in seconds. 0 takes the server-wide value, and where that is 0 too the server's own ceiling of 43200 seconds - twelve hours - applies.")},
    session_one_per_device:{type:"integer",description:K("Whether signing in again from a client that already has a session ends the earlier one: 0 takes the server-wide answer, 1 is on, 2 is off.")},
    session_bind_to_address:{type:"integer",description:K("Whether a session is refused from any address but the one it began on: 0 takes the server-wide answer, 1 is on, 2 is off. With it on, somebody whose address changes underneath them - a phone moving between wi-fi and a mobile network - is signed out.")}}},
  {title:K("Quarantine digest"),props:{
    quarantine_digest:{type:"boolean",description:K("Send each account of this domain a daily message listing what the quarantine is holding for it, with a link that releases it. Off by default, and nothing is sent until the server's QuarantineDigestBaseUrl names the address those links point at.")},
    quarantine_digest_hour:{type:"integer",description:K("The hour of the local day the digests go out, 0 to 23. The sends are spread across that hour rather than fired at the top of it.")}}},
  {title:K("Reports the domain receives"),props:{
    report_mailbox:{type:"string",description:K("The address this domain's DMARC aggregate and TLS-RPT reports are posted to, and the one address they are read from into the DMARC page: what the domain's rua= tags name. One address in a domain this server hosts, or empty, which is the default and reads nothing. Make the account or alias at it yourself; the server does not.")}}},
  {title:K("Restricted delivery"),props:{
    restricted_domains:{type:"string",format:"multiline",description:K("The domains this domain's accounts may exchange mail with: partner.example, or .example for the domain and everything beneath it, separated by commas or spaces, ASCII only. Empty, the default, restricts nothing. With a list, an outside sender not in a named domain is refused at RCPT TO, and an account here may send only to the named domains, its own domain and the postmaster; other domains this server hosts count as outside unless named. Each account follows this unless its own editor says restricted or exempt. An alias or a distribution list of this domain that reaches outside is the administrator's, and a restricted account may write to it.")}}},
  {title:K("Web Key Directory"),props:{
    openpgp_publish:{type:"boolean",description:K("Publish this domain's accounts' OpenPGP public keys, so that anybody on the internet can find a key from the address alone. Off by default; the server setting and each account's own switch have to be on as well, and only public keys are ever held.")},
    openpgp_publish_new_accounts:{type:"boolean",description:K("What an account CREATED in this domain from now on starts with. It never changes an account that already exists, so switching it on publishes nobody who is already here.")}}},
  {title:K("DKIM"),props:{
    dkim_enabled:{type:"boolean",description:K("Sign outgoing mail from this domain.")},
    dkim_selector:{type:"string",description:K("The selector, which names the DNS record the public key is published under.")},
    dkim_private_key_file:{type:"string",description:K("The path of the private key file on the server.")},
    dkim_signing_algorithm:{type:"string","enum":["sha1","sha256"],description:K("The signing algorithm.")},
    dkim_sign_aliases:{type:"boolean",description:K("Sign mail from the domain's aliases too, with the domain's selector - so every alias needs the record as well.")},
    dkim_rotation_enabled:{type:"boolean",description:K("Rotate the key on a schedule: a new key is generated, its record checked from the server's resolver, signing moved to it once the record has resolved for the propagation period, and the old selector retired after the retention period.")},
    dkim_rotation_interval_days:{type:"integer",description:K("Days between rotations, 1 to 3650.")},
    dkim_rotation_propagation_hours:{type:"integer",description:K("Hours the new key's record must have resolved before signing moves to it, 1 to 720.")},
    dkim_rotation_retention_days:{type:"integer",description:K("Days the old selector stays published after the switch, for mail still on its way, 1 to 365.")},
    dkim_rotation_key_bits:{type:"integer",description:K("The size of the keys the rotation generates: 2048, 3072 or 4096.")}}}
];
function domainProps(){const all={};DOMAIN_GROUPS.forEach(g=>Object.assign(all,g.props));return all;}

async function renderDomains(){
  await loadSpec();
  cache.domains=asList(await api("/api/v1/domains"),"domains");
  if(editing&&editing.kind==="domain"){renderDomainEditor();return;}
  if(editing&&editing.kind==="account"){await openAccount(editing.address,editing.domain);return;}
  if(editing&&editing.kind==="list"){await openList(editing.address,editing.domain);return;}
  const rows=cache.domains.map(x=>`
    <tr><td><b>${escHtml(x.name)}</b></td>
        <td>${x.active?'<span class="badge good">'+t("Active")+'</span>':'<span class="badge warn">'+t("Disabled")+'</span>'}</td>
        <td>${escHtml(x.postmaster||"—")}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="accounts" data-domain="${escHtml(x.name)}">${t("Accounts ›")}</button>
          <button class="btn ghost sm" data-act="aliases" data-domain="${escHtml(x.name)}">${t("Aliases ›")}</button>
          <button class="btn ghost sm" data-act="lists" data-domain="${escHtml(x.name)}">${t("Lists ›")}</button>
          <button class="btn ghost sm" data-act="suppressions" data-domain="${escHtml(x.name)}">${t("Suppressions ›")}</button>
          <button class="btn ghost sm" data-act="complaints" data-domain="${escHtml(x.name)}">${t("Complaints ›")}</button>
          <button class="btn ghost sm" data-act="dmarc" data-domain="${escHtml(x.name)}">${t("DMARC ›")}</button>
          <button class="btn ghost sm" data-act="openpgp" data-domain="${escHtml(x.name)}">${t("OpenPGP ›")}</button>
          <button class="btn ghost sm" data-act="domainedit" data-name="${escHtml(x.name)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="domaindel" data-name="${escHtml(x.name)}">${t("Delete")}</button>
          <div class="err" id="err_domain_${escHtml(x.name)}"></div></td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/domains","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Domain")}</th><th>${t("Status")}</th><th>${t("Postmaster")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="4" class="empty">'+t("No domains configured.")+'</td></tr>'}</tbody></table></div>
    </div>
    <div class="sect"><h2>${t("New domain")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/domains","post").description||""))}</p>
        <div class="row" data-enter="domainnew">
          <input id="newDomain" placeholder="example.com" aria-label="${t("Domain name")}" style="flex:1;min-width:220px">
          <input id="newPostmaster" placeholder="${t("Postmaster address (optional)")}" aria-label="${t("Postmaster address")}" style="flex:1;min-width:220px">
          <label class="row" style="gap:7px"><input type="checkbox" id="newDomainActive" checked> ${t("Active")}</label>
          <button class="btn" data-act="domainnew">${t("Create domain")}</button>
          <div class="err" id="err_domainnew"></div>
        </div>
      </div></div></div>`;
}
async function createDomain(){
  setErr("err_domainnew","");
  const name=$("#newDomain").value.trim(),postmaster=$("#newPostmaster").value.trim(),active=$("#newDomainActive").checked;
  if(!name){setErr("err_domainnew",t("A domain name is required."));return;}
  try{
    await api("/api/v1/domains",{method:"POST",body:JSON.stringify({name:name,active:active,postmaster:postmaster})});
    toast(tf("Domain created: {0}",name));
    // Read back, and then straight into the editor of the domain as the
    // server holds it, where the rest of its settings are.
    cache.domains=asList(await api("/api/v1/domains"),"domains");
    if(cache.domains.some(d=>d.name===name))await openDomain(name);else await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_domainnew",e.message);}
}
async function openDomain(name){
  const existing=cache.domains.filter(d=>d.name===name)[0];
  if(!existing)return;
  editing={kind:"domain",name:name,values:JSON.parse(JSON.stringify(existing)),aliases:[],aliasError:"",senders:[],senderError:"",traps:[],trapHits:[],trapError:"",rotation:null,rotationError:"",smimeCa:null,smimeCaError:"",mailboxRecovery:null,mailboxRecoveryError:""};
  // The settings with levels are not in the listing: the domain itself answers
  // them. Its own try: a server from before them answers none, and the editor
  // opens all the same.
  try{await reloadDomainLevels();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}}
  try{await reloadDomainAliases();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}editing.aliasError=e.message;}
  // The domain's own allow and block list, read with the domain rather than
  // through the Lists view: it belongs to this domain the way its other names
  // do, and a domain administrator whose key is scoped to it has no other way in.
  try{await reloadDomainSenders();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}editing.senderError=e.message;}
  // The domain's spam traps, and what has addressed them: read with the domain,
  // because a trap is a property of the domain as its other names are, and a
  // domain administrator confined to it has no other way in.
  try{await reloadDomainTraps();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}editing.trapError=e.message;}
  try{await reloadRotation();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}editing.rotationError=e.message;}
  // The domain's S/MIME authority: its own try, so that a server from before it
  // answers nothing here and the editor opens all the same.
  try{await reloadSmimeAuthority();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}editing.smimeCaError=e.message;}
  // The domain's recovery key for mailbox encryption at rest: its own try, so
  // that a server from before it answers nothing here and the editor opens.
  try{editing.mailboxRecovery=await api("/api/v1/domains/"+encodeURIComponent(name)+"/mailbox-recovery");}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}editing.mailboxRecoveryError=e.message;}
  renderDomainEditor();
}
/* A domain's recovery key for mailbox encryption at rest (docs/
   EncryptionAtRest.md): what opens an encrypted mailbox of the domain when its
   password is lost. Made or replaced here; never shown, and its passphrase
   never stored - the hint is all that is kept of it. */
function mailboxRecoveryHtml(){
  const r=editing.mailboxRecovery;
  if(!r)return '<div class="note">'+escHtml(editing.mailboxRecoveryError||"")+'</div>';
  const state=r.exists?tf("A recovery key is kept: {0}, sealing {1} accounts' keys.",r.fingerprint,String(r.accounts||0))
    :t("No recovery key: no account of this domain can be encrypted at rest until one is made.");
  return `<p class="note">${t("The key that opens this domain's encrypted mailboxes when a password is lost. Its private half is kept wrapped by a passphrase this server never stores: keep the passphrase somewhere else. Replacing it needs the current passphrase.")}</p>
    <p class="note">${escHtml(state)}</p>
    ${r.exists&&r.replacement_unfinished?'<p class="note" id="mrecUnfinished">'+t("The last replacement of this key did not finish: some accounts are still sealed to the key it replaced. They open with the current passphrase all the same; replace the key again, giving the current passphrase, to finish it.")+'</p>':""}
    ${r.exists&&r.hint?'<p class="note">'+escHtml(tf("Hint: {0}",r.hint))+'</p>':""}
    <div class="row" style="gap:12px;flex-wrap:wrap" data-enter="mrecsave">
      ${r.exists?`<input id="mrecCurrent" type="password" autocomplete="off" placeholder="${t("The current passphrase")}" aria-label="${t("The current passphrase")}" style="flex:1;min-width:180px">`:""}
      <input id="mrecPassphrase" type="password" autocomplete="off" placeholder="${t("A new passphrase, 12 characters or more")}" aria-label="${t("A new passphrase, 12 characters or more")}" style="flex:1;min-width:180px">
      <input id="mrecHint" maxlength="255" placeholder="${t("A hint for the passphrase (optional)")}" aria-label="${t("A hint for the passphrase (optional)")}" style="flex:1;min-width:180px">
      <button class="btn" data-act="mrecsave">${r.exists?t("Replace the recovery key"):t("Make the recovery key")}</button>
    </div>
    <div class="err" id="err_mrec"></div>`;
}
async function saveMailboxRecovery(){
  setErr("err_mrec","");
  const body={passphrase:$("#mrecPassphrase").value,hint:$("#mrecHint").value.trim()};
  const current=$("#mrecCurrent");
  if(current&&current.value)body.current_passphrase=current.value;
  try{
    editing.mailboxRecovery=await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/mailbox-recovery",{method:"PUT",body:JSON.stringify(body)});
    toast(t("The recovery key was saved."));
    $("#mailboxRecovery").innerHTML=mailboxRecoveryHtml();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mrec",e.message);}
}
async function reloadDomainAliases(){
  editing.aliases=asList(await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/domain-aliases"),"aliases");
}
function domainNamesHtml(){
  const list=editing.aliases.map(a=>`
    <div class="row erow"><code style="flex:1">${escHtml(a.name)}</code>
      <button class="btn ghost sm" data-act="daliasdel" data-name="${escHtml(a.name)}">${t("Remove")}</button></div>`).join("")
    ||'<div class="note">'+t("No other names: mail is accepted for the domain name only.")+'</div>';
  return `<p class="note">${escHtml(operation("/api/v1/domains/{domain}/domain-aliases","get").summary||"")}</p>
    ${list}
    <div class="row" style="margin-top:14px" data-enter="daliasadd">
      <input id="newDomainAlias" placeholder="${t("Another name for this domain")}" aria-label="${t("Another name for this domain")}" style="flex:1;min-width:220px">
      <button class="btn ghost sm" data-act="daliasadd">${t("Add name")}</button>
      <div class="err" id="err_dalias">${escHtml(editing.aliasError||"")}</div>
    </div>`;
}
async function reloadDomainSenders(){
  editing.senders=asList(await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/sender-list"),"items");
}
function domainSendersHtml(){
  const list=(editing.senders||[]).map(x=>`
    <div class="row erow"><code style="flex:1">${escHtml(x.value)}</code>
      ${x.blocked?'<span class="badge warn">'+t("Blocked")+'</span>':'<span class="badge good">'+t("Allowed")+'</span>'}
      <span class="muted" style="flex:1">${escHtml(x.reason||"")}</span>
      <button class="btn ghost sm" data-act="dsenderdel" data-id="${escHtml(x.id)}" data-value="${escHtml(x.value)}">${t("Remove")}</button></div>`).join("")
    ||'<div class="note">'+t("Nothing is on this domain's list, so each account's own list and then the server's decide.")+'</div>';
  return `<p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/sender-list","get").description||""))}</p>
    ${list}
    <div class="row" style="margin-top:14px" data-enter="dsenderadd">
      <input id="newDomainSender" placeholder="${t("An address or a domain")}" aria-label="${t("An address or a domain")}" style="flex:1;min-width:200px">
      <input id="newDomainSenderReason" placeholder="${t("Why (optional)")}" aria-label="${t("Why the entry is there.")}" style="flex:1;min-width:160px">
      <label class="row" style="gap:7px"><input type="checkbox" id="newDomainSenderBlocked"> ${t("Block")}</label>
      <button class="btn ghost sm" data-act="dsenderadd">${t("Add to the list")}</button>
      <div class="err" id="err_dsender">${escHtml(editing.senderError||"")}</div>
    </div>`;
}
async function addDomainSender(){
  setErr("err_dsender","");
  const value=$("#newDomainSender").value.trim(),reason=$("#newDomainSenderReason").value.trim(),blocked=$("#newDomainSenderBlocked").checked;
  if(!value){setErr("err_dsender",t("An address or a domain is required."));return;}
  try{
    await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/sender-list",{method:"POST",body:JSON.stringify({value:value,blocked:blocked,reason:reason})});
    toast(tf("Entry added: {0}",value));editing.senderError="";await reloadDomainSenders();$("#domainSenders").innerHTML=domainSendersHtml();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_dsender",e.message);}
}
async function deleteDomainSender(id,value){
  if(!await deckConfirm(tf("Remove {0} from the list of {1}?",value,editing.name)))return;
  setErr("err_dsender","");
  try{
    await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/sender-list/"+id,{method:"DELETE"});
    toast(tf("Entry removed: {0}",value));editing.senderError="";await reloadDomainSenders();$("#domainSenders").innerHTML=domainSendersHtml();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_dsender",e.message);}
}
function renderDomainEditor(){
  const cards=DOMAIN_GROUPS.map(g=>`
    <div class="sect"><h2>${escHtml(t(g.title))}</h2>
      <div class="card flat"><div class="form">${formHtml("dom",g.props,editing.values,{required:["active"]})}</div></div></div>`);
  // The names the domain answers to, between General and Limits as the
  // desktop dialog has them; drawn into their own box so that adding or
  // removing one redraws the box and not the edits in the other groups.
  cards.splice(1,0,`<div class="sect"><h2>${t("Names")}</h2><div class="card flat" id="domainNames">${domainNamesHtml()}</div></div>`);
  // The allow and block list sits after the digest, the other half of the same
  // question: who decides that a message is wanted, and how a person sees what
  // was held. +2: one for Names above, one to come after the digest group.
  const digestAt=DOMAIN_GROUPS.findIndex(g=>g.title==="Quarantine digest");
  cards.splice(digestAt>=0?digestAt+2:cards.length,0,`<div class="sect"><h2>${t("Allow and block list")}</h2><div class="card flat" id="domainSenders">${domainSendersHtml()}</div></div>`);
  // The key rotation under the DKIM group it belongs to, in a box of its own so
  // that an action redraws the rotation and not the edits in the groups above.
  // The traps after the allow and block list: both are this domain saying which
  // mail it does not want, one by naming senders and one by naming addresses
  // that were never real.
  cards.splice(digestAt>=0?digestAt+3:cards.length,0,`<div class="sect"><h2>${t("Spam traps")}</h2><div class="card flat" id="domainTraps">${domainTrapsHtml()}</div></div>`);
  cards.push(`<div class="sect"><h2>${t("DKIM key rotation")}</h2><div class="card flat" id="dkimRotation">${rotationHtml()}</div></div>`);
  // The domain's own S/MIME authority after its DKIM key: both are the domain
  // vouching for its mail, and both are made and rotated here.
  cards.push(`<div class="sect"><h2>${t("S/MIME authority")}</h2><div class="card flat" id="smimeAuthority">${smimeAuthorityHtml()}</div></div>`);
  // The recovery key of the domain's mailboxes encrypted at rest, after the
  // other keys the domain holds.
  if(may("manage_accounts"))
    cards.push(`<div class="sect"><h2>${t("Mailbox recovery key")}</h2><div class="card flat" id="mailboxRecovery">${mailboxRecoveryHtml()}</div></div>`);
  cards.push(`<div class="sect"><h2>${t("Setting levels")}</h2><div class="card flat" id="domainLevels">${levelsHtml("domain")}</div></div>`);
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("Domain {0}",escHtml(editing.name))}</h2>
      <div class="card flat"><p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}","put").description||""))}</p></div></div>
    ${cards.join("")}
    <div class="sect"><div class="row">
      <button class="btn" data-act="domainsave">${t("Save domain")}</button>
      <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
      <button class="btn danger" data-act="domaindel" data-name="${escHtml(editing.name)}">${t("Delete domain")}</button>
      <div class="err" id="err_domainedit"></div>
    </div></div>
  </div>`;
}
async function saveDomain(){
  setErr("err_domainedit","");
  const props=domainProps();
  let all;
  try{all=readForm("dom",props,{});}catch(e){setErr("err_domainedit",e.message);return;}
  const body={active:!!all.active};
  Object.keys(all).forEach(k=>{
    if(k==="active"||all[k]===undefined)return;
    if(isPassword(k,props[k])){body[k]=all[k];return;}
    if(all[k]!==editing.values[k])body[k]=all[k];
  });
  if(Object.keys(body).length===1&&body.active===!!editing.values.active){toast(t("Nothing changed"));return;}
  const oldName=editing.name;
  try{
    await api("/api/v1/domains/"+encodeURIComponent(oldName),{method:"PUT",body:JSON.stringify(body)});
    // The domain as the server holds it now, read back rather than taken
    // from the answer, and the editor redrawn from that - under its new name
    // when it was renamed.
    cache.domains=asList(await api("/api/v1/domains"),"domains");
    const newName=body.name!==undefined?body.name:oldName;
    const fresh=cache.domains.filter(d=>d.name===newName)[0]||cache.domains.filter(d=>d.name===oldName)[0];
    if(!fresh){editing=null;toast(t("Domain saved"));await render();return;}
    editing.name=fresh.name;editing.values=JSON.parse(JSON.stringify(fresh));
    // A field saved above can change what is in effect below it.
    try{await reloadDomainLevels();}catch(e){if(e.message==="auth")throw e;}
    // A policy saved above can change what the rotation is waiting for.
    try{await reloadRotation();editing.rotationError="";}catch(e){if(e.message==="auth")throw e;editing.rotationError=e.message;}
    toast(fresh.name!==oldName?tf("Domain renamed to {0}",fresh.name):t("Domain saved"));
    renderDomainEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_domainedit",e.message);}
}
/* ---------- DKIM key rotation ----------
   The domain's rotation as GET /api/v1/domains/{domain}/dkim/rotation answers it:
   the phase, the current, next, retiring and retired selectors with the records
   to publish, keep or remove, the last check of each from the server's own
   resolver as a pill (colour, mark and word), and what is waiting and until when.
   The server decides everything; the page draws the document and posts the five
   operations, and a refusal is shown in the server's own words. The records'
   hosts and values are the server's and go through escHtml like everything else
   it says. The policy is five keys of the domain itself, in the DKIM group above. */
const ROTATION_PHASES={off:K("Off"),idle:K("Idle"),awaiting_dns:K("Waiting for the DNS record"),propagating:K("Propagating"),
  ready:K("Ready to switch"),waiting_for_retiring_slot:K("Waiting for the old selector to retire")};
const ROTATION_CHECKS={unchecked:["info",K("Not checked")],matches:["good",K("Matches")],not_found:["warn",K("Not found")],
  different:["bad",K("Different")],lookup_failed:["warn",K("Lookup failed")],key_unreadable:["bad",K("Key unreadable")]};
const ROTATION_MARKS={good:"■",info:"◆",warn:"▲",bad:"✕"};
const ROTATION_ACTIONS={publish:K("Publish"),keep:K("Keep"),remove:K("Remove")};
const ROTATION_WAITS={
  not_scheduled:K("No rotation is scheduled. Rotate now to start one."),
  domain_inactive:K("The domain is inactive, so the schedule starts no rotation."),
  interval:K("The next rotation starts when the interval has passed."),
  unchecked:K("The new key's record has not been checked yet."),
  record_not_found:K("The new key's record was not found. Publish it."),
  record_differs:K("The published record does not carry the new key. Correct it."),
  lookup_failed:K("The DNS lookup failed. It is tried again on the next pass."),
  key_unreadable:K("The new key's file could not be read."),
  propagation:K("The record is propagating."),
  retiring_slot:K("Waiting for the old selector to be retired."),
  retention:K("The old selector is kept for mail still on its way.")};
function rotationPath(action){return "/api/v1/domains/"+encodeURIComponent(editing.name)+"/dkim/rotation"+(action||"");}
async function reloadDomainTraps(){
  // Both paths written out where they are fetched, as every other reload
  // function writes its own. build/check-deck-parity.py reads those calls to
  // census which routes this page uses, and it can only read a literal: a path
  // held in a variable is credited to every collection the page knows, and a
  // path built by concatenating one is credited to none.
  editing.traps=asList(await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/spam-traps"),"spam_traps");
  // The hits are the other half of the answer to "is this doing anything", and
  // they are the domain's own: the server-wide list is a view of its own.
  try{editing.trapHits=asList(await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/spam-traps/hits?limit=10"),"items");}
  catch(e){editing.trapHits=[];}
}
function domainTrapsHtml(){
  const list=(editing.traps||[]).map(x=>`
    <div class="row erow"><code style="flex:1">${escHtml(x.address)}</code>
      <button class="btn ghost sm" data-act="dtrapdel" data-address="${escHtml(x.address)}">${t("Remove")}</button></div>`).join("")
    ||'<div class="note">'+t("No spam traps: every address of this domain that is not an account, an alias or a list is refused as an unknown address, and nothing is banned for it.")+'</div>';
  const hits=(editing.trapHits||[]).map(h=>`
    <tr><td>${escHtml(h.time||"")}</td><td><code>${escHtml(h.address||"")}</code></td>
        <td>${escHtml(h.ip_address||"")}</td><td>${escHtml(h.sender||"\u2014")}</td>
        <td>${h.banned?'<span class="badge warn">'+t("IP banned")+'</span> ':""}${h.blocked?'<span class="badge warn">'+t("Sender blocked")+'</span> ':""}${escHtml(h.note||"")}</td></tr>`).join("");
  const table=hits?`<div class="tablewrap"><table><thead><tr><th>${t("When")}</th><th>${t("Trap")}</th><th>${t("Connecting address")}</th><th>${t("Sender")}</th><th>${t("What was done")}</th></tr></thead><tbody>${hits}</tbody></table></div>`
    :'<div class="note">'+t("Nothing has addressed a trap of this domain.")+'</div>';
  return `<p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/spam-traps","get").description||""))}</p>
    ${list}
    <div class="row" style="margin-top:14px" data-enter="dtrapadd">
      <input id="newSpamTrap" placeholder="${t("An address in this domain that nobody uses")}" aria-label="${t("An address in this domain that nobody uses")}" style="flex:1;min-width:220px">
      <button class="btn ghost sm" data-act="dtrapadd">${t("Add a trap")}</button>
      <div class="err" id="err_dtrap">${escHtml(editing.trapError||"")}</div>
    </div>
    <h3 style="margin-top:18px">${t("Recently addressed")}</h3>
    ${table}`;
}
async function addDomainTrap(){
  setErr("err_dtrap","");
  const value=$("#newSpamTrap").value.trim();
  if(!value){setErr("err_dtrap",t("A trap address is required."));return;}
  try{
    await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/spam-traps",{method:"POST",body:JSON.stringify({address:value})});
    toast(tf("Trap added: {0}",value));editing.trapError="";await reloadDomainTraps();$("#domainTraps").innerHTML=domainTrapsHtml();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_dtrap",e.message);}
}
async function deleteDomainTrap(address){
  if(!await deckConfirm(tf("Remove the spam trap {0}?",address)))return;
  setErr("err_dtrap","");
  try{
    await api("/api/v1/spam-traps/"+encodeURIComponent(address),{method:"DELETE"});
    toast(tf("Trap removed: {0}",address));editing.trapError="";await reloadDomainTraps();$("#domainTraps").innerHTML=domainTrapsHtml();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_dtrap",e.message);}
}
async function reloadRotation(){editing.rotation=await api(rotationPath());}
function rotationCheckHtml(check){
  const c=ROTATION_CHECKS[(check&&check.status)||"unchecked"]||ROTATION_CHECKS.unchecked;
  return '<span class="pill" data-level="'+c[0]+'"><span class="mark" aria-hidden="true">'+ROTATION_MARKS[c[0]]+'</span>'+escHtml(t(c[1]))+'</span>'+
    (check&&check.checked?' <span class="muted">'+escHtml(tf("checked {0}",auditWhen(check.checked)))+'</span>':"")+
    (check&&check.detail?'<div class="hint"><code>'+escHtml(check.detail)+'</code></div>':"");
}
function rotationRecordsHtml(slot,records){
  const rows=(records||[]).map((r,i)=>'<tr><td><code>'+escHtml(r.host)+'</code></td><td>'+escHtml(r.type||"TXT")+'</td>'+
    '<td><code style="word-break:break-all">'+escHtml(r.value||"")+'</code></td><td>'+escHtml(t(ROTATION_ACTIONS[r.action]||r.action||""))+'</td>'+
    '<td>'+(r.value?'<button class="btn ghost sm" data-act="dkimrotcopy" data-slot="'+slot+'" data-i="'+i+'">'+t("Copy the value")+'</button>':"")+'</td></tr>').join("");
  if(!rows)return "";
  return '<div class="tablewrap"><table><thead><tr><th>'+t("Host")+'</th><th>'+t("Type")+'</th><th>'+t("Value")+'</th><th>'+t("Action")+'</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
function rotationSlotHtml(slot,title,s,lines){
  if(!s)return "";
  const facts=lines.filter(l=>l).map(l=>'<div class="hint">'+escHtml(l)+'</div>').join("");
  return '<div class="erow" data-slot="'+slot+'" style="display:block"><div><b>'+escHtml(t(title))+'</b> <code>'+escHtml(s.selector)+'</code>'+
    (s.check?' '+rotationCheckHtml(s.check):"")+'</div>'+facts+rotationRecordsHtml(slot,s.records)+'</div>';
}
function rotationHtml(){
  const s=editing.rotation;
  if(!s)return noticeHtml("bad",editing.rotationError||t("The rotation could not be read."));
  const when=v=>auditWhen(v);
  const current=s.current?rotationSlotHtml("current",K("Current key"),s.current,[
    s.current.key_file?tf("Key file: {0}",s.current.key_file):"",
    s.current.since?tf("Since {0}",when(s.current.since)):"",
    s.current.next_rotation_due?tf("Next rotation due {0}",when(s.current.next_rotation_due)):""]):'<div class="note">'+t("The domain has no signing key yet.")+'</div>';
  const next=rotationSlotHtml("next",K("Next key"),s.next,s.next?[
    tf("Key file: {0}",s.next.key_file),
    s.next.created?tf("Created {0}",when(s.next.created)):"",
    s.next.first_seen?tf("First seen {0}",when(s.next.first_seen)):"",
    s.next.switch_due?tf("Switch due {0}",when(s.next.switch_due)):""]:[]);
  const retiring=rotationSlotHtml("retiring",K("Retiring key"),s.retiring,s.retiring?[
    tf("Since {0}",when(s.retiring.since)),
    s.retiring.retire_due?tf("Retire due {0}",when(s.retiring.retire_due)):""]:[]);
  const retired=s.retired?rotationSlotHtml("retired",K("Retired key"),s.retired,[
    tf("Retired {0}",when(s.retired.at)),
    s.retired.key_file_kept?tf("The key file was kept: {0}",s.retired.key_file_kept):""]):"";
  const waiting=(s.waiting||[]).map(w=>'<li>'+escHtml(t(ROTATION_WAITS[w.reason]||w.reason))+
    (w.until?' <span class="muted">'+escHtml(tf("until {0}",when(w.until)))+'</span>':"")+
    (w.detail&&w.reason!=="retiring_slot"?' <code>'+escHtml(w.detail)+'</code>':"")+'</li>').join("");
  const error=s.last_error?noticeHtml("warn",tf("The last attempt failed at {0}: {1}",when(s.last_error.time),s.last_error.text)):"";
  const staged=!!s.next;
  const buttons=
    (staged?"":'<input id="dkimrot_selector" placeholder="'+escHtml(t("Selector (optional)"))+'" aria-label="'+escHtml(t("Selector (optional)"))+'" style="min-width:160px">'+
      '<button class="btn ghost sm" data-act="dkimrotstart">'+t("Rotate now")+'</button>')+
    '<button class="btn ghost sm" data-act="dkimrotcheck">'+t("Check DNS now")+'</button>'+
    (staged?'<label class="row" style="gap:7px"><input type="checkbox" id="dkimrot_force"> '+t("Skip the propagation period")+'</label>'+
      '<button class="btn ghost sm" data-act="dkimrotswitch">'+t("Switch now")+'</button>'+
      '<button class="btn danger sm" data-act="dkimrotcancel">'+t("Cancel the next key")+'</button>':"")+
    (s.retiring?'<button class="btn ghost sm" data-act="dkimrotretire">'+t("Retire the old selector now")+'</button>':"");
  return '<p class="note">'+escHtml(tf("Phase: {0}",t(ROTATION_PHASES[s.phase]||s.phase)))+'</p>'+error+current+next+retiring+retired+
    (waiting?'<ul class="hint">'+waiting+'</ul>':"")+
    '<div class="row" style="margin-top:14px" data-enter="dkimrotstart">'+buttons+'<div class="err" id="err_dkimrot">'+escHtml(editing.rotationError||"")+'</div></div>';
}
function drawRotation(){const box=$("#dkimRotation");if(box)box.innerHTML=rotationHtml();}
async function rotationAct(kind){
  setErr("err_dkimrot","");
  const name=editing.name;
  let method="POST",action="",body={},done="";
  if(kind==="start"){
    const selector=($("#dkimrot_selector")||{value:""}).value.trim();
    action="/start";if(selector)body.selector=selector;done=t("A new key was generated and staged. Publish its record.");
  }else if(kind==="check"){action="/check";done=t("The records were checked.");}
  else if(kind==="switch"){
    const force=!!($("#dkimrot_force")&&$("#dkimrot_force").checked);
    if(!await deckConfirm(force?tf("Move signing for {0} to the next key now, without waiting for the propagation period?",name):tf("Move signing for {0} to the next key now?",name)))return;
    action="/switch";if(force)body.force=true;done=t("Signing moved to the next key.");
  }else if(kind==="retire"){
    if(!await deckConfirm(tf("Retire the old selector of {0} now? Its record may then be removed.",name)))return;
    action="/retire";done=t("The old selector was retired.");
  }else if(kind==="cancel"){
    if(!await deckConfirm(tf("Cancel the next key of {0}? Signing does not change.",name)))return;
    method="DELETE";action="/next";body=undefined;done=t("The next key was cancelled.");
  }
  try{
    editing.rotation=await api(rotationPath(action),{method:method,body:body===undefined?undefined:JSON.stringify(body)});
    editing.rotationError="";
    // The selectors are the domain's own keys too, and the editor above shows them.
    cache.domains=asList(await api("/api/v1/domains"),"domains");
    const fresh=cache.domains.filter(d=>d.name===name)[0];
    if(fresh)["dkim_selector","dkim_private_key_file"].forEach(k=>{editing.values[k]=fresh[k];const el=document.getElementById("dom_"+k);if(el)el.value=fresh[k]||"";});
    toast(done);
    drawRotation();
  }catch(e){
    if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    try{await reloadRotation();}catch(_){}
    drawRotation();
    setErr("err_dkimrot",e.message);
  }
}
function rotationCopy(slot,i){
  const s=editing&&editing.rotation&&editing.rotation[slot];
  const r=s&&s.records&&s.records[Number(i)];
  if(r&&r.value)navigator.clipboard.writeText(r.value).then(()=>toast(t("Copied to clipboard")));
}
/* ---------- S/MIME authority ----------
   The domain's own certificate authority as GET /api/v1/domains/{domain}/smime-ca
   answers it (RestApiSmimeAuthority.cpp, docs/SmimeAuthority.md): the current
   root with its facts, whether its private key opens on this machine, the roots
   a rotation retired, and the certificates it issued with their status. The
   page creates it, rotates it, hands out the root and revokes a certificate;
   the server decides everything and a refusal is shown in its own words. The
   root is public, so the download is its PEM as the answer carries it. */
const SMIME_REASONS={keyCompromise:K("Key compromise"),superseded:K("Superseded"),cessationOfOperation:K("Cessation of operation")};
const SMIME_STATUS={valid:["good",K("Valid")],revoked:["bad",K("Revoked")],expired:["warn",K("Expired")]};
async function reloadSmimeAuthority(){
  editing.smimeCa=await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/smime-ca");
}
function smimeKeyChoiceHtml(){
  return '<select id="smimeca_key" aria-label="'+escHtml(t("Key type"))+'"><option value="p256">'+escHtml(t("P-256 (recommended)"))+'</option>'+
    '<option value="rsa3072">'+escHtml(t("RSA 3072"))+'</option></select>';
}
function smimeAuthorityHtml(){
  const s=editing.smimeCa;
  if(!s)return noticeHtml("bad",editing.smimeCaError||t("The authority could not be read."));
  const intro='<p class="note">'+escHtml(t("The domain's own certificate authority certifies the keys its accounts make in the webmail, so S/MIME works inside the organisation without buying a certificate; a person's private key never comes to the server. A client outside this webmail trusts it once the root is installed on it - by group policy, device management or by hand from the download here. It is managed here and over REST; the Control Panel shows none of it."))+'</p>';
  const a=s.authority;
  if(!a){
    return intro+'<div class="note">'+escHtml(t("This domain has no S/MIME authority."))+'</div>'+
      '<div class="row" style="margin-top:14px">'+smimeKeyChoiceHtml()+
      '<button class="btn ghost sm" data-act="smimecacreate">'+escHtml(t("Create an S/MIME authority"))+'</button>'+
      '<div class="err" id="err_smimeca">'+escHtml(editing.smimeCaError||"")+'</div></div>';
  }
  const keyWarning=a.key_opens===false?noticeHtml("warn",t("The root's private key does not open on this machine - the database or a backup came from another machine. Rotate the authority before it signs again.")):"";
  const baseNote=!s.base_url?noticeHtml("info",t("No CRL distribution point is written into its certificates: set smime_authority_base_url on the Settings page to where the web services listener is reached.")):"";
  const facts='<div><b>'+escHtml(a.subject)+'</b> <span class="muted">'+escHtml(a.key_type||"")+'</span></div>'+
    '<div class="hint">'+escHtml(t("Fingerprint"))+' <code style="word-break:break-all">'+escHtml(a.fingerprint)+'</code></div>'+
    '<div class="hint">'+escHtml(t("Expires"))+' '+escHtml(auditWhen(a.not_after))+'</div>';
  const retired=(s.retired||[]).map(r=>'<div class="hint">'+escHtml(t("Retired key"))+' <code>'+escHtml(String(r.fingerprint||"").slice(0,16))+'</code> '+
    escHtml(t(r.published?"Published":"Not published"))+'</div>').join("");
  const rows=(s.issued||[]).map(c=>{
    const st=SMIME_STATUS[c.status]||SMIME_STATUS.valid;
    return '<tr><td>'+escHtml(c.serial)+'</td><td><code>'+escHtml(c.address)+'</code></td><td>'+escHtml(auditWhen(c.not_after))+'</td>'+
      '<td><span class="pill" data-level="'+st[0]+'"><span class="mark" aria-hidden="true">'+ROTATION_MARKS[st[0]]+'</span>'+escHtml(t(st[1]))+'</span>'+
      (c.reason?' <span class="muted">'+escHtml(SMIME_REASONS[c.reason]?t(SMIME_REASONS[c.reason]):c.reason)+'</span>':"")+'</td>'+
      '<td>'+(c.status==="valid"?'<button class="btn ghost sm" data-act="smimecarevoke" data-serial="'+escHtml(c.serial)+'" data-address="'+escHtml(c.address)+'">'+escHtml(t("Revoke"))+'</button>':"")+'</td></tr>';
  }).join("");
  const table=rows?'<div class="row" style="margin-top:18px"><select id="smimeca_reason" aria-label="'+escHtml(t("Reason"))+'">'+
      Object.keys(SMIME_REASONS).map(k=>'<option value="'+k+'">'+escHtml(t(SMIME_REASONS[k]))+'</option>').join("")+'</select></div>'+
    '<div class="tablewrap"><table><thead><tr><th>'+escHtml(t("Serial"))+'</th><th>'+escHtml(t("Address"))+'</th><th>'+escHtml(t("Expires"))+'</th><th>'+escHtml(t("Status"))+'</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div>':"";
  return intro+keyWarning+baseNote+facts+retired+
    '<div class="row" style="margin-top:14px">'+
      '<a class="btn ghost sm" id="smimeca_download" download="'+escHtml(editing.name+"-smime-root.pem")+'" href="data:application/x-pem-file;charset=utf-8,'+escHtml(encodeURIComponent(a.pem||""))+'">'+escHtml(t("Download the root"))+'</a>'+
      smimeKeyChoiceHtml()+
      '<button class="btn ghost sm" data-act="smimecarotate">'+escHtml(t("Rotate the authority"))+'</button>'+
      '<div class="err" id="err_smimeca">'+escHtml(editing.smimeCaError||"")+'</div></div>'+table;
}
function drawSmimeAuthority(){const box=$("#smimeAuthority");if(box)box.innerHTML=smimeAuthorityHtml();}
async function smimeAuthorityAct(kind,serial,address){
  setErr("err_smimeca","");
  const name=editing.name;
  const key=($("#smimeca_key")||{value:"p256"}).value==="rsa3072"?"rsa3072":"p256";
  try{
    if(kind==="create"){
      editing.smimeCa=await api("/api/v1/domains/"+encodeURIComponent(name)+"/smime-ca",{method:"POST",body:JSON.stringify({key:key})});
      toast(t("S/MIME authority created"));
    }else if(kind==="rotate"){
      if(!await deckConfirm(tf("Rotate the S/MIME authority of {0}? New certificates are signed by a new root, which every client must be given; the old root stays published until its last certificate expires.",name)))return;
      editing.smimeCa=await api("/api/v1/domains/"+encodeURIComponent(name)+"/smime-ca/rotate",{method:"POST",body:JSON.stringify({key:key})});
      toast(t("S/MIME authority rotated"));
    }else if(kind==="revoke"){
      const reason=($("#smimeca_reason")||{value:"keyCompromise"}).value;
      if(!await deckConfirm(tf("Revoke certificate {0} of {1}?",serial,address)))return;
      await api("/api/v1/domains/"+encodeURIComponent(name)+"/smime-ca/issued/"+encodeURIComponent(serial)+"?reason="+encodeURIComponent(reason),{method:"DELETE"});
      await reloadSmimeAuthority();
      toast(tf("Certificate {0} revoked",serial));
    }
    editing.smimeCaError="";
    drawSmimeAuthority();
  }catch(e){
    if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    try{await reloadSmimeAuthority();}catch(_){}
    drawSmimeAuthority();
    setErr("err_smimeca",e.message);
  }
}
async function deleteDomain(name){
  if(!await deckConfirm(tf("Delete the domain {0} with every account, alias and list in it? Their messages go with them.",name)))return;
  const where=editing&&editing.kind==="domain"?"err_domainedit":"err_domain_"+name;
  setErr(where,"");
  try{await api("/api/v1/domains/"+encodeURIComponent(name),{method:"DELETE"});editing=null;toast(tf("Domain deleted: {0}",name));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr(where,e.message);}
}
async function addDomainAlias(){
  setErr("err_dalias","");
  const name=$("#newDomainAlias").value.trim();
  if(!name){setErr("err_dalias",t("A name is required."));return;}
  try{
    await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/domain-aliases",{method:"POST",body:JSON.stringify({name:name})});
    toast(tf("Name added: {0}",name));editing.aliasError="";await reloadDomainAliases();$("#domainNames").innerHTML=domainNamesHtml();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_dalias",e.message);}
}
async function deleteDomainAlias(name){
  if(!await deckConfirm(tf("Remove the name {0} from {1}?",name,editing.name)))return;
  setErr("err_dalias","");
  try{
    await api("/api/v1/domains/"+encodeURIComponent(editing.name)+"/domain-aliases/"+encodeURIComponent(name),{method:"DELETE"});
    toast(tf("Name removed: {0}",name));editing.aliasError="";await reloadDomainAliases();$("#domainNames").innerHTML=domainNamesHtml();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_dalias",e.message);}
}

async function showAccounts(domain){
  editing=null;
  const a=await api("/api/v1/domains/"+encodeURIComponent(domain)+"/accounts");
  const list=asList(a,"accounts");
  const rows=list.map(x=>`
    <tr><td><b>${escHtml(x.address)}</b></td>
        <td>${x.active?'<span class="badge good">'+t("Active")+'</span>':'<span class="badge warn">'+t("Disabled")+'</span>'}</td>
        <td style="text-align:right;white-space:nowrap">
          ${may("reset_password")?`<button class="btn ghost sm" data-act="resetpick" data-address="${escHtml(x.address)}">${t("Reset password")}</button>`:""}
          ${may("unlock_account")?`<button class="btn ghost sm" data-act="unlock" data-address="${escHtml(x.address)}" data-domain="${escHtml(domain)}">${t("Unlock")}</button>`:""}
          ${may("manage_accounts")?`<button class="btn ghost sm" data-act="stoppush" data-address="${escHtml(x.address)}" data-domain="${escHtml(domain)}">${t("Stop notifications")}</button>`:""}
          ${may("administer_server")?`<a class="btn ghost sm" href="#" data-api-download="/api/v1/accounts/${encodeURIComponent(x.address)}/export.zip" download="${escHtml(x.address)}.zip">${t("Everything (.zip)")}</a><button class="btn ghost sm" data-act="erasetraces" data-address="${escHtml(x.address)}">${t("Erase traces")}</button>`:""}
          ${may("view_accounts")?`<button class="btn ghost sm" data-act="accountedit" data-address="${escHtml(x.address)}" data-domain="${escHtml(domain)}">${t("Edit")}</button>`:""}
          ${may("manage_accounts")?`<button class="btn danger sm" data-act="del" data-address="${escHtml(x.address)}" data-domain="${escHtml(domain)}">${t("Delete")}</button>`:""}</td></tr>`).join("");
  $("#content").innerHTML=`
  <div class="view">
    <button class="btn ghost sm" data-act="domains">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("{0} — accounts",escHtml(domain))}</h2>
      <div class="card"><div class="tablewrap"><table><thead><tr><th>${t("Address")}</th><th>${t("Status")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="3" class="empty">'+t("No accounts.")+'</td></tr>'}</tbody></table></div></div>
    </div>
    ${may("reset_password")?`<div class="sect"><h2>${t("Reset a password")}</h2>
      <div class="card" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center" data-enter="resetpass">
        <input id="helpAddr" placeholder="user@${escHtml(domain)}" aria-label="${t("Address")}" style="flex:1;min-width:220px">
        <input id="helpPass" type="password" placeholder="${t("New password")}" aria-label="${t("New password")}" style="flex:1;min-width:160px">
        <button class="btn" data-act="resetpass" data-domain="${escHtml(domain)}">${t("Reset password")}</button>
        <div class="err" id="err_help"></div>
      </div>
    </div>`:""}
    ${may("manage_accounts")?`<div class="sect"><h2>${t("New account")}</h2>
      <div class="card" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center" data-enter="add">
        <input id="newAddr" placeholder="user@${escHtml(domain)}" aria-label="${t("Address")}" style="flex:1;min-width:220px">
        <input id="newPass" type="password" placeholder="${t("Password")}" aria-label="${t("Password")}" style="flex:1;min-width:160px">
        <button class="btn" data-act="add" data-domain="${escHtml(domain)}">${t("Create account")}</button>
        <div class="err" id="err_account"></div>
      </div>
    </div>`:""}
    <div class="err" id="err_accountrow"></div>
  </div>`;
}

/* A help desk's two actions, each its own route so that a role can be allowed
   exactly these and nothing else. The password goes in the body of a POST and
   is cleared from the page the moment it has been sent. */
function pickReset(address){
  const box=$("#helpAddr");if(!box)return;
  box.value=address;
  const pass=$("#helpPass");if(pass)pass.focus();
}
async function resetPassword(domain){
  setErr("err_help","");
  const address=($("#helpAddr").value||"").trim(),password=$("#helpPass").value;
  if(!address||!password){setErr("err_help",t("An address and a new password are required."));return;}
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/password",{method:"POST",body:JSON.stringify({password:password})});
    $("#helpPass").value="";
    toast(tf("Password reset: {0}",address));
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_help",refusalText(e));}
}
/* Article 17: every stored trace of an address, the archive tree (held copies
   excepted) and the log lines naming it - what Utilities.EraseAddressTraces and
   EraseAddressLogLines do over COM. Asked first, because nothing brings it
   back. The administrator password's alone: a role session is refused by the
   server and told so. What a legal hold kept in place (the answer's held) is
   said in the toast, for whoever answers the person. */
async function eraseTraces(address){
  setErr("err_accountrow","");
  if(!await deckConfirm(tf("Erase every stored trace of {0}? Quarantine entries, trace rows, greylisting, list memberships, aliases, the address-book entries, certificates, keys and memories other accounts keep of it, the messages outside any mailbox that name it - held for review (discarded for every recipient), expiring or password-protected - the archive tree and the log lines that name the address. What a legal hold covers is left in place. This cannot be undone.",address)))return;
  try{
    const answer=await api("/api/v1/addresses/erase",{method:"POST",body:JSON.stringify({address:address,include_archive:true,include_logs:true})});
    toast(answer.held>0?tf("Erased {0} trace(s) of {1}; {2} item(s) left in place under a legal hold.",answer.removed,address,answer.held):tf("Erased {0} trace(s) of {1}.",answer.removed,address));
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_accountrow",e.message);}
}
async function unlockAccount(address){
  setErr("err_accountrow","");
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/unlock",{method:"POST"});
    toast(tf("Unlocked: {0}",address));
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_accountrow",e.message);}
}

/* A lost phone: every Web Push subscription of the account removed, so nothing
   more reaches any of its devices; the person turns notifications on again on
   the devices they still have. Reversible by them, so no confirmation. */
async function stopPush(address){
  setErr("err_accountrow","");
  try{
    const r=await api("/api/v1/accounts/"+encodeURIComponent(address)+"/push",{method:"DELETE"});
    toast(tf("Notifications stopped on {0} device(s) of {1}",r.removed,address));
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_accountrow",e.message);}
}

async function addAccount(domain){
  const address=$("#newAddr").value.trim(),password=$("#newPass").value;
  setErr("err_account","");
  if(!address||!password){setErr("err_account",t("An address and a password are required."));return;}
  try{
    await api("/api/v1/domains/"+encodeURIComponent(domain)+"/accounts",
      {method:"POST",body:JSON.stringify({address:address,password:password})});
    toast(tf("Account created: {0}",address));showAccounts(domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_account",refusalText(e));}
}

async function delAccount(address,domain){
  if(!await deckConfirm(tf("Delete {0}?",address)))return;
  const where=editing&&editing.kind==="account"?"err_accountedit":"err_account";
  setErr(where,"");
  try{await api("/api/v1/accounts/"+encodeURIComponent(address),{method:"DELETE"});
    toast(tf("Deleted {0}",address));showAccounts(domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr(where,e.message);}
}

/* ---------- The account editor ----------
   Every field PUT /api/v1/accounts/{address} takes, which the route's schema
   types - the admin level's three words among them - drawn in the groups the
   desktop Control Panel's account dialog has, with its captions, since the
   document gives the keys no wording; a key the document gains later falls
   into a group of its own rather than out of sight. The long texts - the two
   signatures, the reply, the Sieve script - are text areas. The account is
   read whole from GET /api/v1/accounts/{address}, and Save sends only the
   keys whose control differs from that record, a filled password with them,
   then reads the account again and redraws from what the server holds. The
   external accounts, app passwords, second factor, rules and folders of the
   desktop dialog are not here: the external accounts have their own view,
   and the rest are not on the administrative API. */
const ACCOUNT_GROUPS=[
  {title:K("General"),keys:["active","kind","first_name","last_name","password","max_size_mb","admin_level","message_retention_days"]},
  {title:K("Forwarding"),keys:["forward_enabled","forward_address","forward_keep_original","forward_abort_spam_flagged"]},
  {title:K("Auto-reply"),keys:["vacation_enabled","vacation_subject","vacation_message","vacation_expires","vacation_expires_date","vacation_begin_date","vacation_abort_spam_flagged","vacation_days","vacation_internal_subject","vacation_internal_message","vacation_internal_only"]},
  {title:K("Spam"),keys:["antispam_enabled","spam_mark_threshold","spam_delete_threshold"]},
  {title:K("Signature"),keys:["signature_enabled","signature_plain_text","signature_html"]},
  {title:K("Sieve"),keys:["sieve_script"]},
  {title:K("Windows directory"),keys:["ad_enabled","ad_domain","ad_username"]},
  {title:K("OpenPGP"),keys:["openpgp_publish"]},
  {title:K("Restricted delivery"),keys:["restricted_delivery"]}
];
const ACCOUNT_HINTS={
  active:K("Account enabled: it receives mail and can sign in."),first_name:K("The person's first name."),last_name:K("The person's last name."),
  kind:K("A person, a room or a piece of equipment. A room or a piece of equipment answers the invitations it is sent by its booking policy, and cannot be signed into."),
  password:K("A new password goes through the password policy, the reuse history, the breach check and the configured hash exactly as when the Control Panel sets one, and the next logon uses it."),
  max_size_mb:K("Maximum mailbox size in MB; 0 is unlimited."),
  admin_level:K("user, domain or server. Who is asking decides what it may become: a key restricted to named domains may set user or domain only."),
  message_retention_days:K("Delete messages older than this many days; -1 keeps forever, 0 follows the domain."),
  forward_enabled:K("Forward incoming mail."),forward_address:K("The address the mail is forwarded to."),forward_keep_original:K("Keep the original message in this mailbox."),
  forward_abort_spam_flagged:K("Do not forward messages flagged as spam."),
  vacation_enabled:K("Send an automatic reply (vacation message)."),vacation_subject:K("The reply's subject."),vacation_message:K("The reply's text."),
  vacation_expires:K("Stop sending replies after a date."),vacation_expires_date:K("YYYY-MM-DD; empty means today."),vacation_begin_date:K("YYYY-MM-DD; empty means today."),
  vacation_abort_spam_flagged:K("Do not reply to messages flagged as spam."),
  vacation_days:K("Days after which the same sender is answered again while the reply stays on; 0 answers each sender once per absence."),
  vacation_internal_subject:K("The subject for senders whose address belongs to this server; empty means the subject above."),
  vacation_internal_message:K("The text for senders whose address belongs to this server; empty means the text above. It never leaves the server, so it can say more."),
  vacation_internal_only:K("Answer only senders whose address belongs to this server; with the domain's external override on, strangers still get the domain's text."),
  antispam_enabled:K("Apply the server's spam filtering to this account."),spam_mark_threshold:K("The score at which a message is marked as spam; -1 is the server's own value."),
  spam_delete_threshold:K("The score at which a message is deleted; -1 is the server's own value."),
  signature_enabled:K("Add a signature to outgoing messages."),signature_plain_text:K("The plain-text signature."),signature_html:K("The HTML signature."),
  sieve_script:K("The account's active Sieve filter, parsed before it is stored as the portal and ManageSieve parse one; empty removes it."),
  ad_enabled:K("Check this password against Windows (Active Directory, or a local Windows account)."),ad_domain:K("The Windows domain."),ad_username:K("The Windows user name."),
  openpgp_publish:K("Publish this account's OpenPGP public keys in the Web Key Directory, so that anybody who has the address can find the key. The keys themselves are on the domain's OpenPGP page."),
  restricted_delivery:K("Follows the domain takes the domain's list of named domains. Restricted confines the account to the named domains, its own domain and the postmaster - and, when the domain names nothing, to its own domain alone. Exempt lets an account in a restricted domain exchange mail with anyone.")
};
const ACCOUNT_CHOICES=()=>({restricted_delivery:[{value:0,label:t("Follows the domain")},{value:1,label:t("Restricted: named domains only")},{value:2,label:t("Exempt: may exchange mail with anyone")}],
  kind:[{value:"person",label:t("A person")},{value:"room",label:t("A room")},{value:"equipment",label:t("A piece of equipment")}]});
const ACCOUNT_LONG=["signature_plain_text","signature_html","vacation_message","vacation_internal_message","sieve_script"];
function accountProps(){
  const props=properties("/api/v1/accounts/{address}","put"), out={};
  Object.keys(props).forEach(k=>{
    out[k]=Object.assign({},props[k]);
    if(!out[k].description&&ACCOUNT_HINTS[k])out[k].description=ACCOUNT_HINTS[k];
    if(ACCOUNT_LONG.indexOf(k)>=0&&!out[k].format)out[k].format="multiline";
  });
  return out;
}
async function openAccount(address,domain){
  setErr("err_account","");
  let record;
  try{record=await api("/api/v1/accounts/"+encodeURIComponent(address));}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_account",e.message);return;}
  editing={kind:"account",address:address,domain:domain,values:record,move:null};
  // Whether a move would be refused at this moment, and what this mailbox has
  // been through. Its own route, and its own try: a role that may read an
  // account but not this is answered 403, and that must not empty the editor.
  try{editing.move=await api("/api/v1/accounts/"+encodeURIComponent(address)+"/move");}catch(e){editing.move=null;}
  // The account's directory entry, on its own route and with its own try: a
  // role that may read an account but not this is answered 403, and the editor
  // must still open.
  try{editing.directory=await api("/api/v1/accounts/"+encodeURIComponent(address)+"/directory");}catch(e){editing.directory=null;}
  // Whether the mailbox is encrypted at rest, on its own route and with its
  // own try, for the same reason.
  try{editing.mailboxKey=await api("/api/v1/accounts/"+encodeURIComponent(address)+"/mailbox-encryption");}catch(e){editing.mailboxKey=null;}
  // A room's or a piece of equipment's booking policy, the same way.
  editing.booking=await bookingOf(address,record);
  renderAccountEditor();
}
function renderAccountEditor(){
  const props=accountProps();
  const cards=groupedKeys(ACCOUNT_GROUPS,props).map(g=>`
    <div class="sect"><h2>${escHtml(t(g.title))}</h2>
      <div class="card flat"><div class="form">${formHtml("acct",pick(props,g.keys),editing.values,{passwordHint:t("left unchanged unless filled"),choices:ACCOUNT_CHOICES()})}</div></div></div>`).join("");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="accounts" data-domain="${escHtml(editing.domain)}">${tf("‹ Accounts of {0}",escHtml(editing.domain))}</button>
    <div class="sect"><h2>${tf("Account {0}",escHtml(editing.address))}</h2>
      <div class="card flat"><p class="note">${escHtml(uiDocText(operation("/api/v1/accounts/{address}","put").description||""))}</p></div></div>
    ${cards}
    ${may("manage_accounts")?recoveryCardHtml():""}
    ${zeroAccessCardHtml()}
    ${may("manage_accounts")?mailboxKeyCardHtml():""}
    ${directoryCardHtml()}
    ${bookingCardHtml()}
    ${may("manage_accounts")?moveCardHtml():""}
    <div class="sect"><h2>${t("Setting levels")}</h2><div class="card flat" id="accountLevels">${levelsHtml("account")}</div></div>
    <div class="sect"><div class="row">
      <button class="btn" data-act="accountsave">${t("Save account")}</button>
      <button class="btn ghost" data-act="accounts" data-domain="${escHtml(editing.domain)}">${t("Cancel")}</button>
      <button class="btn danger" data-act="del" data-address="${escHtml(editing.address)}" data-domain="${escHtml(editing.domain)}">${t("Delete account")}</button>
      <div class="err" id="err_accountedit"></div>
    </div></div>
  </div>`;
}
/* A zero-access mailbox (docs/ZeroAccess.md), read-only here and deliberately
   so: the person switches it on and off from the webmail's Security page,
   once the ZeroAccessAllowed setting under OpenPGP permits it, and an
   administrator sees the state - because a switch an administrator could
   throw would not be a promise about what an administrator cannot read. */
function zeroAccessCardHtml(){
  const v=editing.values||{};
  if(v.zero_access===undefined)return "";
  return `<div class="sect"><h2>${t("Zero-access mailbox")}</h2>
    <div class="card">
      <p class="note">${v.zero_access
        ?t("On: every message delivered to this account is encrypted, after the filters have run, to the account's own OpenPGP key. This server cannot read, search, export or recover its mail, and neither can you: the message source and the export answer 403, search sees the headers only, IMAP and POP hand out the ciphertext. Only the person can switch it off, from the webmail, and switching it off decrypts nothing already stored.")
        :t("Off: mail is stored as it arrives. The person switches it on from the webmail's Security page, once zero-access mailboxes are allowed under Settings, OpenPGP; nothing here can switch it on for them.")}</p>
    </div></div>`;
}
/* Mailbox encryption at rest (docs/EncryptionAtRest.md), over
   /api/v1/accounts/{address}/mailbox-encryption: the state, the switch, and the
   recovery that opens the key with the domain's passphrase to set a new
   password. Unlike zero access above it is the administrator's switch: the
   server holds this key while the person is signed in, and the domain's
   recovery key opens it when a password is lost. */
function mailboxKeyCardHtml(){
  const k=editing.mailboxKey;
  if(!k)return "";
  const state=!k.keyed?t("Off: mail is stored as it arrives.")
    :!k.enabled?t("Off for new mail. What was stored encrypted stays encrypted, and the key stays to read it.")
    :k.pending?t("On. The key waits for the person's first sign-in with their password, which wraps it.")
    :k.open?t("On. The key is open: the person is signed in.")
    :t("On. The key is closed until the person signs in with their password.");
  /* recovery_current is false when the key's recovery copy is sealed to a
     recovery key the domain no longer has - a database edited by hand, a
     restore that mixed archives: the recovery below cannot open it. */
  const stale=k.keyed&&k.domain_recovery&&k.recovery_current===false
    ?`<p class="note" id="mkeyStale">${t("The domain's recovery key does not open this mailbox: its key is sealed to a recovery key the domain no longer has. The recovery below will be refused; the person's own password is the only way in.")}</p>`:"";
  const recover=k.keyed?`<div class="row" style="gap:12px;flex-wrap:wrap;margin-top:10px" data-enter="mkeyrecover">
        <input id="mkeyPassphrase" type="password" autocomplete="off" placeholder="${t("The domain's recovery passphrase")}" aria-label="${t("The domain's recovery passphrase")}" style="flex:1;min-width:200px">
        <input id="mkeyPassword" type="password" autocomplete="new-password" placeholder="${t("A new password for the account")}" aria-label="${t("A new password for the account")}" style="flex:1;min-width:200px">
        <button class="btn" data-act="mkeyrecover">${t("Recover the mailbox")}</button></div>`:"";
  return `<div class="sect"><h2>${t("Encryption at rest")}</h2>
    <div class="card">
      <p class="note">${t("The mailbox's messages are stored encrypted to a key of its own, which opens when the person signs in with their password and closes when they have gone. It protects the files and their backups, not the mail from this server: while the key is open the server reads it. The domain needs a recovery key first, and IMAP and POP3 then accept only the account's own password.")}</p>
      <p class="note">${escHtml(state)}</p>
      ${stale}
      <div class="row">${k.enabled
        ?`<button class="btn ghost" data-act="mkeyoff">${t("Switch encryption off")}</button>`
        :`<button class="btn" data-act="mkeyon"${k.zero_access||!k.domain_recovery?" disabled":""}>${t("Switch encryption on")}</button>`}</div>
      ${recover}
      <div class="err" id="err_mkey"></div>
    </div></div>`;
}
async function setMailboxKey(on){
  setErr("err_mkey","");
  try{
    editing.mailboxKey=await api("/api/v1/accounts/"+encodeURIComponent(editing.address)+"/mailbox-encryption",{method:"PUT",body:JSON.stringify({enabled:on})});
    toast(on?t("Encryption at rest switched on"):t("Encryption at rest switched off"));
    renderAccountEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mkey",e.message);}
}
async function recoverMailboxKey(){
  setErr("err_mkey","");
  const passphrase=$("#mkeyPassphrase").value,password=$("#mkeyPassword").value;
  if(!passphrase||!password){setErr("err_mkey",t("Both the domain's recovery passphrase and a new password are needed."));return;}
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(editing.address)+"/mailbox-encryption/recover",{method:"POST",body:JSON.stringify({passphrase:passphrase,password:password})});
    toast(t("The mailbox was recovered: the new password opens it."));
    editing.mailboxKey=await api("/api/v1/accounts/"+encodeURIComponent(editing.address)+"/mailbox-encryption");
    renderAccountEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mkey",refusalText(e));}
}
/* What an administrator may know about an account's recovery address, which is
   less than the account knows and deliberately so: whether one is set, whether
   the person has confirmed it, the masked spelling of it, and how many one-time
   codes are unused. The address itself is answered to nobody - not here, not
   over COM, not in an export - because it is another mailbox belonging to the
   person and nothing an administrator does needs to read it. What an
   administrator CAN do is take it away, which is what a person ringing up to
   say "that address is not mine any more" needs. */
function recoveryCardHtml(){
  const v=editing.values||{};
  if(v.recovery_address_set===undefined)return "";
  const masked=v.recovery_address||"";
  const state=!v.recovery_address_set?t("No recovery address is set.")
    :v.recovery_address_verified?tf("Recovery address confirmed: {0}",masked)
    :tf("Recovery address set but not confirmed: {0}",masked);
  return `<div class="sect"><h2>${t("Recovery")}</h2>
    <div class="card">
      <p class="note">${t("The address a password-reset link would be sent to, and the one-time recovery codes beside it. Only the masked form is ever shown, here or anywhere else: the address is another mailbox of the person's, and nothing an administrator does needs to read it. Clearing it ends every reset link in flight, and the person sets one again from the webmail.")}</p>
      <p class="note">${escHtml(state)}</p>
      <p class="note">${escHtml(tf("{0} unused recovery codes.",String(v.recovery_codes_unused||0)))}</p>
      <div class="row"><button class="btn danger" data-act="recoveryclear"${v.recovery_address_set?"":" disabled"}>${t("Clear the recovery address")}</button>
      <button class="btn danger" data-act="recoverycodesclear"${v.recovery_codes_unused?"":" disabled"}>${t("Clear the recovery codes")}</button></div>
      <div class="err" id="err_recovery"></div>
    </div></div>`;
}
/* And the other half of the remedy: ending the code set. A code stands in for
   the account's second factor, so a card somebody else has read is a standing
   way past it - and the account holder's own replacement from the webmail is
   exactly what somebody locked out of the webmail cannot reach. Separate from
   clearing the address because the two answer separate reports. */
async function clearRecoveryCodes(){
  setErr("err_recovery","");
  const address=editing.address;
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/recovery/codes",{method:"DELETE"});
    toast(t("The recovery codes were cleared."));
    editing.values=await api("/api/v1/accounts/"+encodeURIComponent(address));
    renderAccountEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_recovery",refusalText(e));}
}
async function clearRecovery(){
  setErr("err_recovery","");
  const address=editing.address;
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/recovery",{method:"DELETE"});
    toast(t("The recovery address was cleared."));
    editing.values=await api("/api/v1/accounts/"+encodeURIComponent(address));
    renderAccountEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_recovery",refusalText(e));}
}
/* The account's entry in the organisation's directory (DirectoryStore.h), over
   GET and PUT /api/v1/accounts/{address}/directory. Its own card rather than a
   group of the account's form, because it is its own route and its own table -
   and because it is the one part of an account a person can also set for
   themselves, from the webmail, so "who last wrote this" is a real question and
   the two surfaces must not silently overwrite one another in one Save.
   The note is the administrator's and is answered here and nowhere else. */
const DIRECTORY_FIELDS=[
  {key:"title",label:K("Job title"),max:100},
  {key:"department",label:K("Department"),max:100},
  {key:"phone",label:K("Work telephone"),max:60},
  {key:"mobile",label:K("Mobile"),max:60},
  {key:"office",label:K("Office"),max:100},
  {key:"note",label:K("Administrator's note"),max:255}
];
function directoryCardHtml(){
  const e=(editing.directory&&editing.directory.entry)||null;
  if(!e)return "";
  const rows=DIRECTORY_FIELDS.map(f=>`<div style="flex:1;min-width:200px"><label for="dir_${f.key}">${escHtml(t(f.label))}</label>`
    +`<input id="dir_${f.key}" maxlength="${f.max}" value="${escHtml(e[f.key]||"")}"></div>`).join("");
  const photo=e.has_photo?`<img data-api-src="/api/v1/accounts/${encodeURIComponent(editing.address)}/directory/photo" alt="" width="48" height="48" style="border-radius:50%;object-fit:cover">`:"";
  return `<div class="sect"><h2>${t("Directory entry")}</h2>
    <div class="card" data-enter="accountdirsave">
      <p class="note">${t("What everyone at this domain sees beside the name in the webmail's Directory page, in their To field and in the read-only address book a phone syncs. The note is yours alone and is never answered to a reader.")}</p>
      <div class="row" style="gap:12px;flex-wrap:wrap">${rows}</div>
      <div class="row" style="gap:12px;flex-wrap:wrap;align-items:center;margin-top:10px">
        ${photo}
        <input id="dirPhoto" type="file" accept="image/png,image/jpeg,image/gif" aria-label="${t("Photo")}">
        ${e.has_photo?`<label class="row" style="gap:6px;align-items:center"><input id="dirPhotoRemove" type="checkbox"> ${t("Remove the photo")}</label>`:""}
      </div>
      <p class="note">${t("A JPEG, a PNG or a GIF, up to 100 KB. What is kept is judged by the bytes, not by the file's name.")}</p>
      <label class="row" style="gap:6px;align-items:center"><input id="dirOptOut" type="checkbox"${e.opt_out?" checked":""}> ${t("Leave this account out of the directory")}</label>
      <p class="note">${t("Out of the listing, out of everybody's To field and out of the CardDAV collection. It hides no mailbox: mail still arrives and anybody who knows the address can still write.")}</p>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="accountdirsave">${t("Save directory entry")}</button></div>
      <div class="err" id="err_accountdir"></div>
    </div></div>`;
}
function directoryPhotoFile(){
  const box=$("#dirPhoto");
  const file=box&&box.files&&box.files[0];
  if(!file)return Promise.resolve(undefined);
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const url=String(reader.result||""),at=url.indexOf(";base64,");
      if(at<0){reject(new Error(t("A directory photo is a JPEG, a PNG or a GIF.")));return;}
      resolve(url.slice(at+8));
    };
    reader.onerror=()=>reject(new Error(t("That file could not be read.")));
    reader.readAsDataURL(file);
  });
}
async function saveAccountDirectory(){
  setErr("err_accountdir","");
  const current=(editing.directory&&editing.directory.entry)||{},body={};
  DIRECTORY_FIELDS.forEach(f=>{
    const box=$("#dir_"+f.key);
    if(!box)return;
    if((box.value||"")!==(current[f.key]||""))body[f.key]=box.value||"";
  });
  const optOut=$("#dirOptOut")?$("#dirOptOut").checked:!!current.opt_out;
  if(optOut!==!!current.opt_out)body.opt_out=optOut;
  const remove=$("#dirPhotoRemove")?$("#dirPhotoRemove").checked:false;
  let chosen;
  try{chosen=await directoryPhotoFile();}catch(e){setErr("err_accountdir",e.message);return;}
  if(remove)body.photo=null;
  else if(chosen!==undefined)body.photo=chosen;
  if(!Object.keys(body).length){toast(t("Nothing changed"));return;}
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(editing.address)+"/directory",{method:"PUT",body:JSON.stringify(body)});
    // Read back rather than trusted from the answer, as the account's own save
    // does, so what is drawn is what the server holds.
    editing.directory=await api("/api/v1/accounts/"+encodeURIComponent(editing.address)+"/directory");
    toast(t("Directory entry saved"));
    renderAccountEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_accountdir",refusalText(e));}
}
/* A room's or a piece of equipment's booking policy (docs/RoomsAndEquipment.md),
   over GET and PUT /api/v1/accounts/{address}/booking-policy. Its own card, as
   the directory entry is, because it is its own route and its own table, and
   drawn only for an account whose kind is room or equipment: a person has none.
   The delegates are the accounts and groups the resource's calendar is shared
   with as a delegate; they answer for it what it does not answer by itself. */
const BOOKING_DAYS=["mon","tue","wed","thu","fri","sat","sun"];
async function bookingOf(address,values){
  if(!values||!values.kind||values.kind==="person")return null;
  try{return await api("/api/v1/accounts/"+encodeURIComponent(address)+"/booking-policy");}catch(e){return null;}
}
function weekdayNames(){
  const english=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  try{
    const format=new Intl.DateTimeFormat(language,{weekday:"short",timeZone:"UTC"});
    return english.map((_,i)=>format.format(new Date(Date.UTC(2024,0,1+i))));
  }catch(_){return english;}
}
function bookingCardHtml(){
  const b=editing.booking;
  if(!b)return "";
  const names=weekdayNames();
  const check=(id,on,label)=>`<label class="row" style="gap:6px;align-items:center"><input id="${id}" type="checkbox"${on?" checked":""}> ${escHtml(t(label))}</label>`;
  const field=(id,value,label,width)=>`<div style="flex:1;min-width:${width}px"><label for="${id}">${escHtml(t(label))}</label><input id="${id}" value="${escHtml(String(value===undefined||value===null?"":value))}"></div>`;
  const area=(id,values,label)=>`<label for="${id}">${escHtml(t(label))}</label><textarea id="${id}" rows="3">${escHtml((values||[]).join("\n"))}</textarea>`;
  const days=BOOKING_DAYS.map((d,i)=>`<label class="row" style="gap:6px;align-items:center"><input id="bk_day_${d}" type="checkbox"${(b.work_days||[]).indexOf(d)>=0?" checked":""}> ${escHtml(names[i])}</label>`).join("");
  return `<div class="sect"><h2>${t("Booking policy")}</h2>
    <div class="card" data-enter="bookingsave">
      <p class="note">${t("A room or a piece of equipment answers the invitations it is sent by this policy, as they are delivered: it accepts one that fits and declines one that does not, saying why. It cannot be signed into; its delegates answer for it from its calendar.")}</p>
      ${check("bk_auto",b.auto_accept,K("Answer invitations by this policy"))}
      <div class="row" style="gap:12px;flex-wrap:wrap;margin-top:10px">
        ${field("bk_window",b.window_days,K("Booking window, in days ahead"),160)}
        ${field("bk_max",b.max_duration_minutes,K("Longest booking, in minutes (0 for no limit)"),160)}
        ${field("bk_capacity",b.capacity,K("Capacity, in people (0 if not said)"),160)}
      </div>
      <div style="margin-top:10px">${check("bk_hours",b.working_hours_only,K("Working hours only"))}</div>
      <p class="note">${t("Working days")}</p>
      <div class="row" style="gap:12px;flex-wrap:wrap">${days}</div>
      <div class="row" style="gap:12px;flex-wrap:wrap;margin-top:10px">
        ${field("bk_start",b.work_start,K("Working hours start (HH:MM)"),140)}
        ${field("bk_end",b.work_end,K("Working hours end (HH:MM)"),140)}
        ${field("bk_zone",b.time_zone,K("Time zone of the working hours"),200)}
      </div>
      <div class="row" style="gap:12px;flex-wrap:wrap;margin-top:10px">
        ${check("bk_conflicts",b.allow_conflicts,K("Allow overlapping bookings"))}
        ${check("bk_recurring",b.allow_recurring,K("Allow recurring meetings"))}
      </div>
      <div style="margin-top:10px">${area("bk_bookers",b.bookers,K("Who may book: addresses, @domains and group names, one to a line. Empty lets everyone in this organisation book, and nobody from outside."))}</div>
      <div style="margin-top:10px">${area("bk_delegates",b.delegates,K("Delegates: addresses and group names, one to a line. They see this calendar and answer the invitations it does not answer by itself."))}</div>
      <div class="row" style="margin-top:10px"><button class="btn" data-act="bookingsave">${t("Save booking policy")}</button></div>
      <div class="err" id="err_booking"></div>
    </div></div>`;
}
async function saveBookingPolicy(){
  setErr("err_booking","");
  const b=editing.booking||{},body={};
  const flag=(id,key)=>{const el=$("#"+id);if(el&&el.checked!==!!b[key])body[key]=el.checked;};
  flag("bk_auto","auto_accept");flag("bk_hours","working_hours_only");flag("bk_conflicts","allow_conflicts");flag("bk_recurring","allow_recurring");
  const whole=(id,key)=>{
    const el=$("#"+id);
    if(!el)return true;
    const raw=String(el.value).trim(),n=Number(raw);
    if(raw===""||!isFinite(n)||Math.floor(n)!==n){setErr("err_booking",tf("{0} must be a whole number.",humanise(key)));return false;}
    if(n!==b[key])body[key]=n;
    return true;
  };
  if(!whole("bk_window","window_days")||!whole("bk_max","max_duration_minutes")||!whole("bk_capacity","capacity"))return;
  const text=(id,key)=>{const el=$("#"+id);if(el&&el.value.trim()!==String(b[key]||""))body[key]=el.value.trim();};
  text("bk_start","work_start");text("bk_end","work_end");text("bk_zone","time_zone");
  const days=BOOKING_DAYS.filter(d=>{const el=$("#bk_day_"+d);return !!(el&&el.checked);});
  if(days.join(",")!==(b.work_days||[]).join(","))body.work_days=days;
  const lines=id=>{const el=$("#"+id);return el?String(el.value).split("\n").map(s=>s.trim()).filter(Boolean):[];};
  const bookers=lines("bk_bookers"),delegates=lines("bk_delegates");
  if(bookers.join("\n")!==(b.bookers||[]).join("\n"))body.bookers=bookers;
  if(delegates.join("\n")!==(b.delegates||[]).join("\n"))body.delegates=delegates;
  if(!Object.keys(body).length){toast(t("Nothing changed"));return;}
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(editing.address)+"/booking-policy",{method:"PUT",body:JSON.stringify(body)});
    // Read back, as the directory entry is, so what is drawn is what the
    // server holds: the bookers in their stored form, the delegates as shared.
    editing.booking=await api("/api/v1/accounts/"+encodeURIComponent(editing.address)+"/booking-policy");
    toast(t("Booking policy saved"));
    renderAccountEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_booking",refusalText(e));}
}
/* Renaming a mailbox, and moving it to another domain on this server, are one
   operation and one route: POST /api/v1/accounts/{address}/move. It is here
   rather than in the account's form because the address is not a field that is
   saved with the others - the mailbox on disk moves with it - and because the
   GET beside it says whether it would be refused right now. */
function moveCardHtml(){
  const m=editing.move||{},blocked=!!m.in_use,last=m.last_move||null;
  const notes=[];
  if(blocked)notes.push(`<p class="note">${escHtml(tf("This mailbox cannot be moved at the moment: {0}",m.in_use_reason||""))}</p>`);
  if(last&&last.complete)notes.push(`<p class="note">${escHtml(tf("Last moved from {0} to {1} on {2}.",last.old_address,last.new_address,last.finished||last.started||""))}</p>`);
  if(last&&!last.complete)notes.push(`<p class="note">${escHtml(t("The last move of this mailbox did not finish. The server's application log says what it left behind."))}</p>`);
  return `<div class="sect"><h2>${t("Move or rename")}</h2>
    <div class="card" data-enter="accountmove">
      <p class="note">${t("The mailbox keeps everything it is: its messages, folders, rules, filters and settings move with it. The new address may be at any domain this server holds.")}</p>
      ${notes.join("")}
      <div class="row" style="gap:12px;flex-wrap:wrap;align-items:center">
        <input id="moveAddr" placeholder="${t("New address")}" aria-label="${t("New address")}" style="flex:1;min-width:220px">
        <label class="row" style="gap:6px;align-items:center"><input id="moveAlias" type="checkbox" checked> ${t("Keep the old address as an alias")}</label>
        <button class="btn" data-act="accountmove"${blocked?" disabled":""}>${t("Move mailbox")}</button>
      </div>
      <div class="err" id="err_accountmove"></div>
    </div></div>`;
}
async function moveAccount(){
  setErr("err_accountmove","");
  const box=$("#moveAddr");if(!box)return;
  const to=(box.value||"").trim();
  if(!to){setErr("err_accountmove",t("A new address is required."));return;}
  const keep=$("#moveAlias")?$("#moveAlias").checked:true;
  const from=editing.address;
  try{
    const done=await api("/api/v1/accounts/"+encodeURIComponent(from)+"/move",
      {method:"POST",body:JSON.stringify({new_address:to,keep_alias:keep})});
    toast(tf("Moved {0} to {1}",from,done.new_address||to));
    // The account is at a new address, and possibly in another domain, so the
    // editor's own address is stale: go back to the list the mailbox is in now.
    showAccounts(done.new_domain||editing.domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_accountmove",refusalText(e));}
}
async function saveAccount(){
  setErr("err_accountedit","");
  const props=accountProps();
  let all;
  try{all=readForm("acct",props,{});}catch(e){setErr("err_accountedit",e.message);return;}
  const body={};
  Object.keys(all).forEach(k=>{
    if(all[k]===undefined)return;
    if(isPassword(k,props[k])){body[k]=all[k];return;}
    if(all[k]!==editing.values[k])body[k]=all[k];
  });
  if(!Object.keys(body).length){toast(t("Nothing changed"));return;}
  const address=editing.address;
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address),{method:"PUT",body:JSON.stringify(body)});
    // The account as the server holds it now, read back rather than taken
    // from the answer, and the editor redrawn from that.
    editing.values=await api("/api/v1/accounts/"+encodeURIComponent(address));
    // Made a room or a piece of equipment, or a person again: its booking
    // policy card comes or goes with it.
    editing.booking=await bookingOf(address,editing.values);
    toast(t("Account saved"));
    renderAccountEditor();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_accountedit",refusalText(e));}
}

/* ---------- One value, three levels ----------
   The settings a domain or an account may hold its own value of
   (docs/SettingLevels.md), as the domain's and the account's GET answers them:
   every such setting carries <name>_effective, the value in effect there, and
   <name>_source - server, domain or account - which is the only honest answer
   to "why is this account not doing what the domain says". Where the level is
   held in the overlay the answer carries <name> too, the level's own value or
   null when it takes the level above; a setting kept in a field of its own is
   edited in that field above and shown here with what is in effect. Save
   levels sends only what changed - a value, or null to take the level above -
   on the same PUT the editor saves with (the domain's with active, which that
   route requires), reads the record again and redraws from it. The list is
   the server's: whatever names the answer carries, and nothing else. */
const LEVEL_SOURCES={server:K("In effect: {0}, from the server"),domain:K("In effect: {0}, from the domain"),account:K("In effect: {0}, from the account")};
function levelNames(values){
  return Object.keys(values||{}).filter(k=>/_source$/.test(k)).map(k=>k.slice(0,-7)).filter(n=>(n+"_effective") in values);
}
function levelShown(v){
  if(v===true)return t("On");
  if(v===false)return t("Off");
  if(v===null||v===undefined||v==="")return t("(empty)");
  return String(v);
}
function levelFields(kind){return kind==="domain"?domainProps():accountProps();}
async function reloadDomainLevels(){
  const one=await api("/api/v1/domains/"+encodeURIComponent(editing.name));
  levelNames(one).forEach(n=>{[n,n+"_effective",n+"_source"].forEach(k=>{if(k in one)editing.values[k]=one[k];});});
}
/* The account's levels read again - and only the levels: the editor's other
   fields, which may hold what somebody has typed and not saved, are left as
   they are. */
async function reloadAccountLevels(){
  const one=await api("/api/v1/accounts/"+encodeURIComponent(editing.address));
  levelNames(one).forEach(n=>{[n,n+"_effective",n+"_source"].forEach(k=>{if(k in one)editing.values[k]=one[k];});});
}
/* Saving the levels redraws the levels card alone, so nothing typed elsewhere
   in the editor and not yet saved is lost. */
function redrawLevels(kind){
  const card=document.getElementById(kind==="domain"?"domainLevels":"accountLevels");
  if(card)card.innerHTML=levelsHtml(kind);
}
function levelsHtml(kind){
  const values=(editing&&editing.values)||{};
  const fields=levelFields(kind);
  const names=levelNames(values);
  if(!names.length)return '<p class="note">'+t("This server answers no setting levels for this record.")+'</p>';
  const rows=names.map(n=>{
    const eff=values[n+"_effective"], src=values[n+"_source"];
    const said=LEVEL_SOURCES[src]?tf(LEVEL_SOURCES[src],levelShown(eff)):"";
    if(n in fields)return `<div class="row erow"><code style="flex:1">${escHtml(n)}</code><span class="muted">${escHtml(said)}</span> <span class="note">${t("Edited above.")}</span></div>`;
    const own=values[n], has=own!==null&&own!==undefined;
    const control=typeof eff==="boolean"
      ?`<select id="lvl_${escHtml(n)}" aria-label="${escHtml(n)}"><option value="true"${has&&own===true?" selected":""}>${t("On")}</option><option value="false"${has&&own===false?" selected":""}>${t("Off")}</option></select>`
      :`<input id="lvl_${escHtml(n)}" aria-label="${escHtml(n)}" value="${has?escHtml(String(own)):""}" style="width:180px">`;
    return `<div class="row erow"><label style="flex:1"><input type="checkbox" id="lvlown_${escHtml(n)}"${has?" checked":""}> <code>${escHtml(n)}</code></label>${control} <span class="muted">${escHtml(said)}</span></div>`;
  }).join("");
  const note=kind==="domain"
    ?t("What each of these settings is for the accounts of this domain that hold no value of their own, and where it came from. Tick one to give the domain a value of its own; untick it to take the server's. A setting kept in a field above is edited there.")
    :t("What each of these settings is for this account, and where it came from. Tick one to give the account a value of its own; untick it to take its domain's. A setting kept in a field above is edited there.");
  return `<p class="note">${note}</p>${rows}
    <div class="row" style="margin-top:14px"><button class="btn sm" data-act="${kind}levels">${t("Save levels")}</button><div class="err" id="err_${kind}levels"></div></div>`;
}
async function saveLevels(kind){
  setErr("err_"+kind+"levels","");
  const values=editing.values||{}, fields=levelFields(kind), body={};
  try{
    levelNames(values).forEach(n=>{
      if(n in fields)return;
      const box=document.getElementById("lvlown_"+n), control=document.getElementById("lvl_"+n);
      if(!box||!control)return;
      const had=values[n]!==null&&values[n]!==undefined;
      if(!box.checked){if(had)body[n]=null;return;}
      const eff=values[n+"_effective"];
      let v=control.value;
      if(typeof eff==="boolean")v=v==="true";
      else if(typeof eff==="number"){
        const raw=String(v).trim(), num=Number(raw);
        if(raw===""||!isFinite(num)||Math.floor(num)!==num)throw new Error(tf("{0} must be a whole number.",n));
        v=num;
      }
      if(!had||v!==values[n])body[n]=v;
    });
  }catch(e){setErr("err_"+kind+"levels",e.message);return;}
  if(!Object.keys(body).length){toast(t("Nothing changed"));return;}
  try{
    if(kind==="domain"){
      body.active=!!values.active;
      await api("/api/v1/domains/"+encodeURIComponent(editing.name),{method:"PUT",body:JSON.stringify(body)});
      await reloadDomainLevels();
      toast(t("Levels saved"));
      redrawLevels(kind);
    }else{
      await api("/api/v1/accounts/"+encodeURIComponent(editing.address),{method:"PUT",body:JSON.stringify(body)});
      await reloadAccountLevels();
      toast(t("Levels saved"));
      redrawLevels(kind);
    }
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_"+kind+"levels",refusalText(e));}
}

/* ---------- Aliases ----------
   The aliases of a domain, over GET and POST /api/v1/domains/{domain}/aliases
   and DELETE /api/v1/aliases/{address}: an address in the domain and the
   address it delivers to. The API has no update for an alias - the desktop
   deletes and re-creates one as well - so the page lists, makes and removes.
   The form is built from the create's schema and starts at the default its
   description states, active. */
const ALIAS_HINTS={name:K("The alias address, in this domain."),value:K("The e-mail address it delivers to."),active:K("Whether mail to the alias is delivered.")};
function aliasProps(){
  const props=properties("/api/v1/domains/{domain}/aliases","post"), out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&ALIAS_HINTS[k])out[k].description=ALIAS_HINTS[k];});
  return out;
}
async function showAliases(domain){
  editing=null;
  await loadSpec();
  const aliases=asList(await api("/api/v1/domains/"+encodeURIComponent(domain)+"/aliases"),"aliases");
  const rows=aliases.map(x=>`
    <tr><td><b>${escHtml(x.name)}</b></td>
        <td><code>${escHtml(x.value)}</code></td>
        <td>${x.active?'<span class="badge good">'+t("Active")+'</span>':'<span class="badge warn">'+t("Disabled")+'</span>'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn danger sm" data-act="aliasdel" data-name="${escHtml(x.name)}" data-domain="${escHtml(domain)}">${t("Delete")}</button>
          <div class="err" id="err_alias_${escHtml(x.name)}"></div></td></tr>`).join("");
  const props=aliasProps();
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="domains">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("{0} — aliases",escHtml(domain))}</h2>
      <div class="card flat">
        <p class="note">${escHtml(operation("/api/v1/domains/{domain}/aliases","get").summary||"")}. ${t("An alias has no update on the API: to change one, delete it and make it again.")}</p>
        <div class="tablewrap"><table><thead><tr><th>${t("Alias")}</th><th>${t("Delivers to")}</th><th>${t("Status")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="4" class="empty">'+t("No aliases in this domain.")+'</td></tr>'}</tbody></table></div>
      </div></div>
    <div class="sect"><h2>${t("New alias")}</h2>
      <div class="card flat" data-enter="aliasnew">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/aliases","post").description||""))}</p>
        <div class="form">${formHtml("aliasnew",props,documentedDefaults("/api/v1/domains/{domain}/aliases","post",props),{required:requiredOf("/api/v1/domains/{domain}/aliases","post")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="aliasnew" data-domain="${escHtml(domain)}">${t("Create alias")}</button>
          <div class="err" id="err_aliasnew"></div>
        </div>
      </div></div></div>`;
}
async function createAlias(domain){
  setErr("err_aliasnew","");
  let body;
  try{body=readForm("aliasnew",aliasProps(),{});}catch(e){setErr("err_aliasnew",e.message);return;}
  if(!String(body.name||"").trim()||!String(body.value||"").trim()){setErr("err_aliasnew",t("An alias address and the address it delivers to are required."));return;}
  try{
    await api("/api/v1/domains/"+encodeURIComponent(domain)+"/aliases",{method:"POST",body:JSON.stringify(body)});
    toast(tf("Alias created: {0}",body.name));await showAliases(domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_aliasnew",e.message);}
}
async function deleteAlias(name,domain){
  if(!await deckConfirm(tf("Delete the alias {0}?",name)))return;
  setErr("err_alias_"+name,"");
  try{await api("/api/v1/aliases/"+encodeURIComponent(name),{method:"DELETE"});toast(tf("Alias deleted: {0}",name));await showAliases(domain);}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_alias_"+name,e.message);}
}

/* ---------- Distribution lists ----------
   The lists of a domain, over GET and POST /api/v1/domains/{domain}/lists and
   PUT and DELETE /api/v1/lists/{address}. The new-list form is built from the
   create's schema, which types every key, gives the mode its four words and
   carries the members as an array, and starts at the defaults the create's
   description states; the editor of an existing list is built from the
   update's schema, and shows the members without a control, since the
   update does not change them - the route says so, and the note repeats it.
   The captions are the desktop dialog's. */
const LIST_HINTS={
  address:K("The list's address, in this domain."),
  members:K("The members, one address per line. Set when the list is made; the update does not change them."),
  membership:K("A query that finds the rest of the members among the server's accounts each time a message is sent to the list, in union with the addresses above: empty for a list whose members are its addresses alone, domain for every account of this domain, domain:other.example for another domain this server hosts, pattern:sales-*@example.com for the addresses matching a wildcard, everyone for every account on the server."),
  active:K("List is active."),require_auth:K("Require SMTP authentication to send to the list."),
  mode:K("Who may send to this list: public is anyone, membership the members, announcement the one sender named below, domain_members the accounts of the domain."),
  require_sender_address:K("Require sender address (empty = any)."),moderator_address:K("Moderator (empty = no moderation)."),
  bounce_address:K("Bounce address (empty = bounces go to the poster)."),
  // The list manager (docs/MailingLists.md): what the create's and the update's
  // schemas carry for it, each with the words the desktop dialog uses.
  managed:K("The list manager runs this list: people join and leave by mail and by page, and each member gets a copy of their own."),
  subscribe_policy:K("Who may join: 0 nobody (you add the members), 1 anyone who confirms by mail, 2 anyone the owner then approves."),
  archive:K("The archive: 0 none, 1 for the members, 2 public."),
  archive_days:K("Days the archive keeps a message; 0 keeps it for ever."),
  digest:K("Send a daily digest to the members who choose it."),
  digest_hour:K("The hour, 0 to 23, the digest is sent at."),
  reply_to:K("Where replies go: 0 the sender, 1 the list."),
  subject_prefix:K("Put once at the start of every subject."),
  footer:K("Added to the end of every message the list sends."),
  verp:K("Send each copy from an address that names its member, so every bounce is matched to its member."),
  owner:K("Who runs the list: requests to join and bounce notices go here. Empty is the moderator.")
};
// How a member of a managed list takes its mail, in the words the member's own
// page uses.
const LIST_DELIVERY={each:K("Each message"),digest:K("Digest"),none:K("Nothing for now")};
function listProps(method){
  const props=properties(method==="post"?"/api/v1/domains/{domain}/lists":"/api/v1/lists/{address}",method), out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&LIST_HINTS[k])out[k].description=LIST_HINTS[k];});
  // The footer is lines of text: a text box keeps them, where a one-line input
  // would flatten them on every save of the list - a server older than the
  // schema's own mark included.
  if(out.footer)out.footer.format="multiline";
  return out;
}
async function showLists(domain){
  editing=null;
  await loadSpec();
  const lists=asList(await api("/api/v1/domains/"+encodeURIComponent(domain)+"/lists"),"lists");
  cache.lists=lists;
  const rows=lists.map(x=>`
    <tr><td><b>${escHtml(x.address)}</b></td>
        <td>${x.active?'<span class="badge good">'+t("Active")+'</span>':'<span class="badge warn">'+t("Disabled")+'</span>'}</td>
        <td>${escHtml(humanise(x.mode||""))}</td>
        <td>${escHtml((x.members||[]).length)}${(x.members||[]).length?'<div class="hint muted">'+escHtml((x.members||[]).slice(0,3).join(", ")+((x.members||[]).length>3?", …":""))+'</div>':""}</td>
        <td>${x.membership?'<code>'+escHtml(x.membership)+'</code>':'<span class="muted">'+t("Its addresses alone")+'</span>'}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="listedit" data-address="${escHtml(x.address)}" data-domain="${escHtml(domain)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="listdel" data-address="${escHtml(x.address)}" data-domain="${escHtml(domain)}">${t("Delete")}</button>
          <div class="err" id="err_list_${escHtml(x.address)}"></div></td></tr>`).join("");
  const props=listProps("post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="domains">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("{0} — distribution lists",escHtml(domain))}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/lists","get").description||""))}</p>
        <div class="tablewrap"><table><thead><tr><th>${t("Address")}</th><th>${t("Status")}</th><th>${t("Who may send")}</th><th>${t("Members")}</th><th>${t("Membership query")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="empty">'+t("No distribution lists in this domain.")+'</td></tr>'}</tbody></table></div>
      </div></div>
    <div class="sect"><h2>${t("New list")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/lists","post").description||""))}</p>
        <div class="form">${formHtml("listnew",props,documentedDefaults("/api/v1/domains/{domain}/lists","post",props),{required:requiredOf("/api/v1/domains/{domain}/lists","post")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="listnew" data-domain="${escHtml(domain)}">${t("Create list")}</button>
          <div class="err" id="err_listnew"></div>
        </div>
      </div></div></div>`;
}
async function createList(domain){
  setErr("err_listnew","");
  const props=listProps("post");
  let body;
  try{body=readForm("listnew",props,{});}catch(e){setErr("err_listnew",e.message);return;}
  if(!String(body.address||"").trim()){setErr("err_listnew",t("A list address is required."));return;}
  try{
    await api("/api/v1/domains/"+encodeURIComponent(domain)+"/lists",{method:"POST",body:JSON.stringify(body)});
    toast(tf("List created: {0}",body.address));await showLists(domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_listnew",e.message);}
}
async function openList(address,domain){
  await loadSpec();
  cache.lists=asList(await api("/api/v1/domains/"+encodeURIComponent(domain)+"/lists"),"lists");
  const existing=cache.lists.filter(l=>l.address===address)[0];
  if(!existing){await showLists(domain);return;}
  // Who the list delivers to now: its own rows and what its membership query
  // answers at this moment, which is the only place that answer exists - a
  // query list has no membership table to read. A failure here is not a
  // failure of the editor, so the editor opens without it.
  let resolved=null;
  try{resolved=await api("/api/v1/lists/"+encodeURIComponent(address)+"/members");}catch(e){resolved=null;}
  editing={kind:"list",address:address,domain:domain,values:JSON.parse(JSON.stringify(existing)),resolved:resolved};
  renderListEditor();
}
function renderListEditor(){
  const props=listProps("put");
  const members=(editing.values.members||[]).map(m=>'<div class="row erow"><code>'+escHtml(m)+'</code></div>').join("")||'<div class="note">'+t("No members.")+'</div>';
  const now=editing.resolved&&Array.isArray(editing.resolved.members)?editing.resolved.members:null;
  // A managed list's row says how the member takes its mail - or that it is a
  // request still waiting - and what its bounces have done, with the owner's
  // two verbs beside it.
  const managed=!!editing.values.managed;
  const memberExtra=m=>{
    if(!managed||m.source!=="row")return"";
    const hard=Number(m.hard_bounces)||0,soft=Number(m.soft_bounces)||0;
    // "left": an address the membership query answers that has left, kept
    // out of the list's mail by its row.
    const state=m.state==="pending"?'<span class="badge warn">'+t("Waiting for confirmation")+'</span>':
      m.state==="awaiting_owner"?'<span class="badge warn">'+t("Waiting for approval")+'</span>':
      m.state==="left"?'<span class="badge">'+t("Left the list")+'</span>':
      '<span class="badge'+(m.delivery==="none"?" warn":"")+'">'+t(LIST_DELIVERY[m.delivery]||LIST_DELIVERY.each)+'</span>';
    const bounces=hard||soft?' <span class="muted">'+escHtml(tf("{0} hard, {1} soft bounces",hard,soft))+'</span>':"";
    const reset=m.state==="member"&&(hard||soft||m.reason)?' <button class="btn ghost sm" data-act="listreset" data-address="'+escHtml(m.address)+'">'+t("Reset bounces")+'</button>':"";
    const approve=m.state==="awaiting_owner"?' <button class="btn sm" data-act="listapprove" data-address="'+escHtml(m.address)+'">'+t("Approve")+'</button>':"";
    const reason=m.reason?'<div class="hint muted">'+escHtml(m.reason)+'</div>':"";
    return " "+state+bounces+reset+approve+reason;
  };
  const nowRows=now?(now.map(m=>'<div class="row erow"><code>'+escHtml(m.address)+'</code> <span class="badge '+(m.source==="query"?"good":"")+'">'+(m.source==="query"?t("From the query"):t("Kept by hand"))+'</span>'+memberExtra(m)+'</div>').join("")||'<div class="note">'+t("Nobody: this list would deliver to no one.")+'</div>'):"";
  const nowProblem=editing.resolved&&editing.resolved.problem?'<div class="note warn">'+escHtml(editing.resolved.problem)+'</div>':"";
  const nowSection=now?`<div class="sect"><h2>${t("Delivers to now")}</h2>
      <div class="card flat"><p class="note">${t("The addresses a message sent to this list would reach, worked out at this moment. Nothing is stored: the query is run again for every message.")}</p>${managed?'<p class="note">'+t("For a managed list: how each member takes its mail, and what their bounces have done. Reset bounces sends a stopped member each message again.")+'</p>':""}${nowProblem}${nowRows}</div></div>`:"";
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="lists" data-domain="${escHtml(editing.domain)}">${tf("‹ Lists of {0}",escHtml(editing.domain))}</button>
    <div class="sect"><h2>${tf("List {0}",escHtml(editing.address))}</h2>
      <div class="card flat"><p class="note">${escHtml(uiDocText(operation("/api/v1/lists/{address}","put").description||""))}</p>
        <div class="form">${formHtml("list",props,editing.values,{})}</div></div></div>
    <div class="sect"><h2>${t("Members")}</h2>
      <div class="card flat"><p class="note">${escHtml(t(LIST_HINTS.members))}</p>${members}</div></div>
    ${nowSection}
    <div class="sect"><div class="row">
      <button class="btn" data-act="listsave">${t("Save list")}</button>
      <button class="btn ghost" data-act="lists" data-domain="${escHtml(editing.domain)}">${t("Cancel")}</button>
      <button class="btn danger" data-act="listdel" data-address="${escHtml(editing.address)}" data-domain="${escHtml(editing.domain)}">${t("Delete list")}</button>
      <div class="err" id="err_listedit"></div>
    </div></div></div>`;
}
async function saveList(){
  setErr("err_listedit","");
  const props=listProps("put");
  let all;
  try{all=readForm("list",props,{});}catch(e){setErr("err_listedit",e.message);return;}
  const body={};
  Object.keys(all).forEach(k=>{if(all[k]!==undefined&&all[k]!==editing.values[k])body[k]=all[k];});
  if(!Object.keys(body).length){toast(t("Nothing changed"));return;}
  try{
    await api("/api/v1/lists/"+encodeURIComponent(editing.address),{method:"PUT",body:JSON.stringify(body)});
    toast(t("List saved"));await openList(editing.address,editing.domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_listedit",e.message);}
}
// The owner's two verbs on one member of a managed list, over
// POST /api/v1/lists/{address}/members/{member}/reset-bounces and /approve.
async function resetListBounces(address){
  setErr("err_listedit","");
  try{
    await api("/api/v1/lists/"+encodeURIComponent(editing.address)+"/members/"+encodeURIComponent(address)+"/reset-bounces",{method:"POST"});
    toast(tf("Bounces reset: {0}",address));await openList(editing.address,editing.domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_listedit",e.message);}
}
async function approveListMember(address){
  setErr("err_listedit","");
  try{
    await api("/api/v1/lists/"+encodeURIComponent(editing.address)+"/members/"+encodeURIComponent(address)+"/approve",{method:"POST"});
    toast(tf("Approved: {0}",address));await openList(editing.address,editing.domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_listedit",e.message);}
}
async function deleteList(address,domain){
  if(!await deckConfirm(tf("Delete the distribution list {0}?",address)))return;
  const where=editing&&editing.kind==="list"?"err_listedit":"err_list_"+address;
  setErr(where,"");
  try{await api("/api/v1/lists/"+encodeURIComponent(address),{method:"DELETE"});toast(tf("List deleted: {0}",address));await showLists(domain);}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr(where,e.message);}
}

/* ---------- Suppression list ----------
   The addresses a domain no longer sends to, because mail to them bounced for
   good or because an administrator said so, and the bounce counts the list is
   fed from - GET /api/v1/domains/{domain}/suppressions and /bounces, which are
   also what Utilities.GetSuppressionList and GetBounceCounts answer the desktop
   Control Panel. Reached from a domain's row, as its lists and aliases are.

   The add form is the create's own schema, so a field added to the route
   appears here on its own; a removal asks first, because the next message to
   the address is sent. When bounce processing is off the page says so above
   the table: an empty list and a list nobody is applying look the same
   otherwise. */
const SUPPRESSION_PAGE=50;
let suppressionView={domain:"",search:"",offset:0};
const SUPPRESSION_HINTS={
  address:K("The address to stop sending to. An address this server hosts is refused."),
  note:K("Why, for whoever reads the list next."),
  expires_days:K("Days until the entry stops applying; 0 keeps it until it is removed.")
};
const SUPPRESSION_SOURCES={bounce:K("A bounce"),report:K("A delivery report"),manual:K("An administrator")};
const BOUNCE_CATEGORIES={hard:K("Hard"),soft:K("Soft"),mailbox_full:K("Mailbox full"),policy:K("Policy"),other:K("Other")};
const SUPPRESSION_ACTIONS={refuse:K("A listed recipient is refused, with the reason."),drop:K("A listed recipient is dropped without a report."),observe:K("A listed recipient is delivered, and only recorded.")};
function suppressionProps(){
  const props=properties("/api/v1/domains/{domain}/suppressions","post"),out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&SUPPRESSION_HINTS[k])out[k].description=SUPPRESSION_HINTS[k];});
  return out;
}
function bounceCategoryHtml(word){
  const label=BOUNCE_CATEGORIES[word];
  if(!label)return "—";
  const tone=word==="hard"?"warn":(word==="policy"||word==="mailbox_full")?"info":"";
  return '<span class="badge '+tone+'">'+escHtml(t(label))+'</span>';
}
async function showSuppressions(domain,search,offset){
  editing=null;
  suppressionView={domain:domain,search:search||"",offset:offset||0};
  await loadSpec();
  const base="/api/v1/domains/"+encodeURIComponent(domain);
  const filter=suppressionView.search?"&search="+encodeURIComponent(suppressionView.search):"";
  let list,counts;
  try{
    list=await api(base+"/suppressions?limit="+SUPPRESSION_PAGE+"&offset="+suppressionView.offset+filter);
    counts=await api(base+"/bounces?limit="+SUPPRESSION_PAGE+filter);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}toast(e.message);return;}
  const items=asList(list,"items"),total=Number(list.total)||0;
  const rows=items.map(x=>`
    <tr><td><b>${escHtml(x.address)}</b>${x.diagnostic?'<div class="hint muted">'+escHtml(x.diagnostic)+'</div>':""}</td>
        <td>${x.source==="manual"?"—":bounceCategoryHtml(x.category)} <code>${escHtml(x.status||"")}</code></td>
        <td>${escHtml(t(SUPPRESSION_SOURCES[x.source]||x.source||""))}${x.remote_mta?'<div class="hint muted">'+escHtml(x.remote_mta)+'</div>':""}</td>
        <td>${escHtml(x.created||"")}</td>
        <td>${x.expires?escHtml(x.expires):t("Never")}${x.expired?' <span class="badge warn">'+t("expired")+'</span>':""}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="suppdel" data-address="${escHtml(x.address)}">${t("Remove")}</button></td></tr>`).join("");
  const countRows=asList(counts,"items").map(c=>`
    <tr><td><b>${escHtml(c.address)}</b>${c.suppressed?' <span class="badge warn">'+t("Listed")+'</span>':""}</td>
        <td>${escHtml(c.hard)}</td><td>${escHtml(c.soft)}</td><td>${escHtml(c.mailbox_full)}</td><td>${escHtml(c.policy)}</td><td>${escHtml(c.other)}</td>
        <td>${escHtml(c.consecutive_hard)}</td>
        <td>${bounceCategoryHtml(c.last_category)} <code>${escHtml(c.last_status||"")}</code></td>
        <td>${escHtml(c.last_bounce||"")}</td><td>${escHtml(c.last_delivered||"—")}</td></tr>`).join("");
  const props=suppressionProps();
  const off=list.processing_enabled?"":'<p class="note"><span class="badge warn">'+t("Off")+'</span> '+(list.list_applies?t("Bounce processing is off, so no bounce is classified or counted - but the entries below ARE still applied, because complaint processing is on and the feedback loops fill this same list. Settings has both switches."):t("Bounce processing is off: nothing is counted, listed or refused, and the entries below are not applied. Settings has the switch."))+'</p>';
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="domains">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("{0} — suppression list",escHtml(domain))}</h2>
      <div class="card flat">
        ${off}
        <p class="note">${escHtml(operation("/api/v1/domains/{domain}/suppressions","get").summary||"")}. ${escHtml(t(SUPPRESSION_ACTIONS[list.action]||""))}</p>
        <div class="row" data-enter="suppsearch" style="margin-bottom:12px">
          <input id="suppSearch" placeholder="${t("Search addresses")}" aria-label="${t("Search addresses")}" value="${escHtml(suppressionView.search)}" style="flex:1;min-width:220px">
          <button class="btn ghost sm" data-act="suppsearch">${t("Search")}</button>
          <button class="btn ghost sm" data-act="supppage" data-by="-${SUPPRESSION_PAGE}">${t("Newer")}</button>
          <button class="btn ghost sm" data-act="supppage" data-by="${SUPPRESSION_PAGE}">${t("Older")}</button>
        </div>
        <div class="err" id="err_supp"></div>
        <div class="tablewrap"><table><thead><tr><th>${t("Address")}</th><th>${t("Why")}</th><th>${t("Source")}</th><th>${t("Since")}</th><th>${t("Expires")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="empty">'+t("No addresses are on this domain's suppression list.")+'</td></tr>'}</tbody></table></div>
        <p class="note" style="margin-top:12px">${tf("{0} to {1} of {2}",total?suppressionView.offset+1:0,suppressionView.offset+items.length,total)}</p>
      </div></div>
    <div class="sect"><h2>${t("Put an address on the list")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/suppressions","post").description||""))}</p>
        <div class="form">${formHtml("suppnew",props,documentedDefaults("/api/v1/domains/{domain}/suppressions","post",props),{required:requiredOf("/api/v1/domains/{domain}/suppressions","post")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="suppnew">${t("Add to the list")}</button>
          <div class="err" id="err_suppnew"></div>
        </div>
      </div></div>
    <div class="sect"><h2>${t("Bounce counts")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/bounces","get").description||""))}</p>
        <div class="tablewrap"><table><thead><tr><th>${t("Address")}</th><th>${t("Hard")}</th><th>${t("Soft")}</th><th>${t("Mailbox full")}</th><th>${t("Policy")}</th><th>${t("Other")}</th>
          <th>${t("In a row")}</th><th>${t("Last status")}</th><th>${t("Last bounce")}</th><th>${t("Last delivered")}</th></tr></thead>
        <tbody>${countRows||'<tr><td colspan="10" class="empty">'+t("No bounces have been counted for this domain.")+'</td></tr>'}</tbody></table></div>
      </div></div></div>`;
}
async function addSuppression(){
  setErr("err_suppnew","");
  const props=suppressionProps();
  let body;
  try{body=readForm("suppnew",props,{});}catch(e){setErr("err_suppnew",e.message);return;}
  if(!String(body.address||"").trim()){setErr("err_suppnew",t("An address is required."));return;}
  Object.keys(body).forEach(k=>{if(body[k]===undefined)delete body[k];});
  try{
    await api("/api/v1/domains/"+encodeURIComponent(suppressionView.domain)+"/suppressions",{method:"POST",body:JSON.stringify(body)});
    toast(tf("Added to the suppression list: {0}",body.address));
    await showSuppressions(suppressionView.domain,suppressionView.search,0);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_suppnew",e.message);}
}
async function removeSuppression(address){
  if(!await deckConfirm(tf("Take {0} off the suppression list? The next message to it will be sent.",address)))return;
  setErr("err_supp","");
  try{
    await api("/api/v1/domains/"+encodeURIComponent(suppressionView.domain)+"/suppressions/"+encodeURIComponent(address),{method:"DELETE"});
    toast(tf("Removed from the suppression list: {0}",address));
    await showSuppressions(suppressionView.domain,suppressionView.search,suppressionView.offset);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_supp",e.message);}
}

/* ---------- OpenPGP keys ----------
   Every OpenPGP PUBLIC key this server holds for a domain's accounts, and the
   Web Key Directory that publishes them - GET /api/v1/domains/{domain}/openpgp,
   and PUT and DELETE under /api/v1/accounts/{address}/openpgp. Reached from a
   domain's row, as its suppression list is.

   Keys that are NOT being served are listed beside the ones that are, because
   "why does this person's key not answer" is the question this page is opened
   to settle, and the two banners above the table say which switch is in the way.
   The upload form is the route's own schema plus the address, which the route
   takes in its path and not in its body. No secret key is ever held, so none is
   ever shown; the page says so where somebody is about to paste one. */
let openPgpView={domain:""};
const OPENPGP_HINTS={
  key:K("The OpenPGP PUBLIC key: an armoured PGP PUBLIC KEY BLOCK, or base64 of its bytes. A SECRET key is refused here and everywhere else."),
  allow_address_mismatch:K("Store a key whose user ids do not carry the account's own address. A server administrator's decision, and the wrong answer for an ordinary mailbox."),
  publish:K("Publish this account's keys as well as storing this one.")
};
function openPgpProps(){
  const props=properties("/api/v1/accounts/{address}/openpgp","put"),out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&OPENPGP_HINTS[k])out[k].description=OPENPGP_HINTS[k];});
  return out;
}
function pgpKeyName(x){
  const bits=Number(x.bits)||0;
  return escHtml(String(x.algorithm_name||("v"+x.version)))+(bits?" "+bits:"");
}
async function showOpenPgp(domain){
  editing=null;
  openPgpView={domain:domain};
  await loadSpec();
  let list;
  try{list=await api("/api/v1/domains/"+encodeURIComponent(domain)+"/openpgp");}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}toast(e.message);return;}
  const keys=asList(list,"keys");
  const rows=keys.map(x=>`
    <tr><td><b>${escHtml(x.address)}</b>${x.user_id?'<div class="hint muted">'+escHtml(x.user_id)+'</div>':""}</td>
        <td><code>${escHtml(x.fingerprint||"")}</code></td>
        <td>${pgpKeyName(x)} <span class="muted">v${escHtml(x.version)}</span></td>
        <td>${escHtml(x.created||"")}</td>
        <td>${x.expires?escHtml(x.expires):t("Never")}</td>
        <td>${x.published?'<span class="badge good">'+t("Published")+'</span>':'<span class="badge warn">'+t("Not published")+'</span>'}
            ${x.advanced_url?'<div class="hint muted">'+escHtml(x.advanced_url)+'</div>':""}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="pgpdel" data-address="${escHtml(x.address)}" data-fingerprint="${escHtml(x.fingerprint)}">${t("Remove")}</button></td></tr>`).join("");
  const props=openPgpProps();
  let banner="";
  if(!list.server_enabled)banner='<p class="note"><span class="badge warn">'+t("Off")+'</span> '+t("The Web Key Directory is off at the server: no key of any domain is served. Settings has the switch.")+'</p>';
  else if(!list.domain_enabled)banner='<p class="note"><span class="badge warn">'+t("Off")+'</span> '+t("This domain does not publish keys, so nothing of it is served whatever an account says. Edit the domain to turn it on.")+'</p>';
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="domains">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("{0} — OpenPGP keys",escHtml(domain))}</h2>
      <div class="card flat">
        ${banner}
        <p class="note">${escHtml(uiDocText(operation("/api/v1/domains/{domain}/openpgp","get").description||""))}</p>
        <div class="err" id="err_pgp"></div>
        <div class="tablewrap"><table><thead><tr><th>${t("Address")}</th><th>${t("Fingerprint")}</th><th>${t("Key")}</th><th>${t("Created")}</th><th>${t("Expires")}</th><th>${t("Published")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="7" class="empty">'+t("No OpenPGP keys are held for this domain's accounts.")+'</td></tr>'}</tbody></table></div>
      </div></div>
    <div class="sect"><h2>${t("Store a key for an account")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/accounts/{address}/openpgp","put").description||""))}</p>
        <div class="row" style="margin-bottom:12px">
          <input id="pgpAddress" placeholder="${t("Account address")}" aria-label="${t("Account address")}" style="flex:1;min-width:220px">
        </div>
        <div class="form">${formHtml("pgpnew",props,documentedDefaults("/api/v1/accounts/{address}/openpgp","put",props),{required:requiredOf("/api/v1/accounts/{address}/openpgp","put")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="pgpnew">${t("Store the key")}</button>
          <div class="err" id="err_pgpnew"></div>
        </div>
      </div></div></div>`;
}
async function storeOpenPgpKey(){
  setErr("err_pgpnew","");
  const props=openPgpProps();
  const address=String(($("#pgpAddress")||{}).value||"").trim();
  if(!address){setErr("err_pgpnew",t("An account address is required."));return;}
  let body;
  try{body=readForm("pgpnew",props,{});}catch(e){setErr("err_pgpnew",e.message);return;}
  if(!String(body.key||"").trim()){setErr("err_pgpnew",t("A key is required."));return;}
  Object.keys(body).forEach(k=>{if(body[k]===undefined)delete body[k];});
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/openpgp",{method:"PUT",body:JSON.stringify(body)});
    toast(tf("Stored an OpenPGP key for {0}",address));
    await showOpenPgp(openPgpView.domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_pgpnew",e.message);}
}
async function removeOpenPgpKey(address,fingerprint){
  if(!await deckConfirm(tf("Remove this key from {0}? Anybody who looks that address up will stop finding it.",address)))return;
  setErr("err_pgp","");
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/openpgp/"+encodeURIComponent(fingerprint),{method:"DELETE"});
    toast(tf("Removed the OpenPGP key of {0}",address));
    await showOpenPgp(openPgpView.domain);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_pgp",e.message);}
}


/* ---------- Complaints ----------
   The abuse reports the large providers' feedback loops have sent about this
   domain's mail - GET /api/v1/domains/{domain}/complaints, which is also what
   Utilities.GetComplaints answers the desktop Control Panel. Reached from a
   domain's row, beside its suppression list, because a complaint's effect is an
   entry on that list.

   The rate is shown above the table rather than under it: it is the number the
   providers throttle on, and a page that lists the rows without the denominator
   shows half the answer. A domain that has sent too little for a rate to mean
   anything says so instead of showing a figure nobody should act on. When
   complaint processing is off, or no mailbox is named, the page says so: an empty
   list and a list nobody is filling look the same otherwise. */
const COMPLAINT_PAGE=50;
let complaintView={domain:"",search:"",offset:0};
const COMPLAINT_TYPES={abuse:K("Abuse"),fraud:K("Fraud"),virus:K("Virus"),
  "not-spam":K("Not spam"),other:K("Other")};
function complaintTypeHtml(word){
  const label=COMPLAINT_TYPES[word];
  const text=label?t(label):(word||"");
  const tone=word==="not-spam"?"":word==="abuse"||word==="fraud"||word==="virus"?"warn":"info";
  return '<span class="badge '+tone+'">'+escHtml(text)+'</span>';
}
async function showComplaints(domain,search,offset){
  editing=null;
  complaintView={domain:domain,search:search||"",offset:offset||0};
  await loadSpec();
  const filter=complaintView.search?"&search="+encodeURIComponent(complaintView.search):"";
  let list;
  try{
    list=await api("/api/v1/domains/"+encodeURIComponent(domain)+"/complaints?limit="+COMPLAINT_PAGE+"&offset="+complaintView.offset+filter);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}toast(e.message);return;}
  const items=asList(list,"items"),total=Number(list.total)||0;
  const rows=items.map(x=>`
    <tr><td>${x.address?escHtml(x.address):'<span class="muted">'+t("Not named")+'</span>'}</td>
        <td>${complaintTypeHtml(x.feedback_type)}${x.counts?"":' <span class="hint muted">'+t("counts towards nothing")+'</span>'}</td>
        <td>${escHtml(x.sender||"")}</td>
        <td>${escHtml(x.subject||"")}${x.message_id?'<div class="hint muted"><code>'+escHtml(x.message_id)+'</code></div>':""}</td>
        <td>${escHtml(x.provider||"")}${x.source_ip?'<div class="hint muted">'+escHtml(x.source_ip)+'</div>':""}</td>
        <td>${escHtml(x.arrival||x.received||"")}</td></tr>`).join("");
  const off=list.processing_enabled?"":'<p class="note"><span class="badge warn">'+t("Off")+'</span> '+t("Complaints are not being read: nothing is recorded, counted or listed. Settings has the switch.")+'</p>';
  const nomailbox=(list.processing_enabled&&!list.mailbox_configured)?'<p class="note"><span class="badge warn">'+t("No mailbox")+'</span> '+t("No complaint mailbox is named, so no report is ever read. Settings has the field; it is the address the feedback loops are registered against.")+'</p>':"";
  const rate=list.rate_judged
    ?tf("{0} complaint(s) in {1} message(s) over {2} days: {3} in a million.",list.complaints,list.sent,list.window_days,list.rate_ppm)
    :tf("{0} complaint(s) in {1} message(s) over {2} days - too little sent for a rate to mean anything.",list.complaints,list.sent,list.window_days);
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="domains">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("{0} — complaints",escHtml(domain))}</h2>
      <div class="card flat">
        ${off}${nomailbox}
        <p class="note">${escHtml(operation("/api/v1/domains/{domain}/complaints","get").summary||"")}. ${escHtml(rate)}</p>
        <div class="row" data-enter="cmpsearch" style="margin-bottom:12px">
          <input id="cmpSearch" placeholder="${t("Search complaints")}" aria-label="${t("Search complaints")}" value="${escHtml(complaintView.search)}" style="flex:1;min-width:220px">
          <button class="btn ghost sm" data-act="cmpsearch">${t("Search")}</button>
          <button class="btn ghost sm" data-act="cmppage" data-by="-${COMPLAINT_PAGE}">${t("Newer")}</button>
          <button class="btn ghost sm" data-act="cmppage" data-by="${COMPLAINT_PAGE}">${t("Older")}</button>
        </div>
        <div class="err" id="err_cmp"></div>
        <div class="tablewrap"><table><thead><tr><th>${t("Who complained")}</th><th>${t("Type")}</th><th>${t("Sender")}</th><th>${t("Message")}</th><th>${t("Reported by")}</th><th>${t("Arrived")}</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="empty">'+t("No abuse report has been recorded for this domain.")+'</td></tr>'}</tbody></table></div>
        <p class="note" style="margin-top:12px">${tf("{0} to {1} of {2}",total?complaintView.offset+1:0,complaintView.offset+items.length,total)}</p>
      </div></div></div>`;
}

/* ---------- DMARC and TLS-RPT reports ----------
   The reports our own domains receive, read: the DMARC aggregate reports and
   the TLS-RPT reports that the receivers of a domain's mail posted to its
   report mailbox - GET /api/v1/domains/{domain}/dmarc-reports/summary, the
   listing under /dmarc-reports, one report by id, and /tls-reports. Reached
   from a domain's row, beside its complaints, because both are what the world
   says about the domain's mail.

   The chart is the point of the page and is what dmarcian sells: who sends as
   the domain, how much, and whether it passed. The bars are the window's days,
   passed against failed, drawn with the reports' own chart; under them the
   sources most messages first, then who reported, then the reports themselves
   a page at a time with a way into one report's records, then the TLS reports.
   With no report mailbox named the page says so, because an empty chart and a
   chart nobody is filling look the same otherwise. A reporter's row says how
   many of its reports arrived in a message this server's own inbound path
   passed for DMARC (checked and authenticated, from the Authentication-Results
   field it writes when that is on), and each report says what it made of the
   message that carried it - the mailbox address is published, so a stranger
   can post rows, and this is how the reader tells a stranger's from google's. */
const DMARC_PAGE=25;
let dmarcView={domain:"",days:30,offset:0};
function dmarcPercent(part,whole){return whole?String(Math.round(Number(part)*1000/Number(whole))/10)+"%":"—";}
function dmarcDate(seconds){const n=Number(seconds);return n>0?new Date(n*1000).toISOString().slice(0,10):"—";}
function dmarcVerdict(word){
  const pass=word==="pass",tone=pass?"good":word==="fail"?"warn":"";
  return '<span class="badge '+tone+'">'+escHtml(word||"—")+'</span>';
}
async function showDmarc(domain,days,offset){
  editing=null;
  dmarcView={domain:domain,days:days||30,offset:offset||0};
  await loadSpec();
  const base="/api/v1/domains/"+encodeURIComponent(domain);
  let summary,list,tls;
  try{
    summary=await api(base+"/dmarc-reports/summary?days="+dmarcView.days);
    list=await api(base+"/dmarc-reports?limit="+DMARC_PAGE+"&offset="+dmarcView.offset);
    tls=await api(base+"/tls-reports?days="+dmarcView.days+"&limit="+DMARC_PAGE+"&offset=0");
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}toast(e.message);return;}
  const byDay=asList(summary,"by_day"),sources=asList(summary,"sources"),reporters=asList(summary,"reporters");
  const items=asList(list,"items"),total=Number(list.total)||0,tlsItems=asList(tls,"items");
  const nomailbox=summary.mailbox_configured?"":'<p class="note"><span class="badge warn">'+t("No mailbox")+'</span> '+t("No report mailbox is named for this domain, so no report is ever read. Edit the domain and name one: it is the address to publish in the domain's DMARC and TLS-RPT records.")+'</p>';
  const where=summary.mailbox_configured?'<p class="note">'+tf("Reports arrive at {0}. Publish that address in the domain's DNS: rua=mailto:{0} in the _dmarc TXT record for DMARC reports and in the _smtp._tls TXT record for TLS reports.",escHtml(summary.report_mailbox||""))+'</p>':"";
  const ranges=[7,30,90,365].map(d=>'<button class="btn '+(d===dmarcView.days?"":"ghost ")+'sm" data-act="dmarcrange" data-days="'+d+'">'+escHtml(tf("{0} days",d))+'</button>').join(" ");
  const chart=summary.messages>0?reportChartHtml(byDay.map(d=>String(d.day).slice(5)),[
    {label:K("Passed DMARC"),colour:"#3fb950",values:byDay.map(d=>Number(d.passed)||0)},
    {label:K("Failed DMARC"),colour:"#f85149",values:byDay.map(d=>Number(d.failed)||0)}]):"";
  const totals=`<div class="tablewrap"><table><thead><tr><th>${t("Messages")}</th><th>${t("Passed DMARC")}</th><th>${t("DKIM aligned")}</th><th>${t("SPF aligned")}</th><th>${t("Quarantined")}</th><th>${t("Rejected")}</th><th>${t("Reports")}</th></tr></thead>
    <tbody><tr><td>${Number(summary.messages)||0}</td><td>${Number(summary.passed)||0} (${dmarcPercent(summary.passed,summary.messages)})</td><td>${Number(summary.dkim_passed)||0}</td><td>${Number(summary.spf_passed)||0}</td><td>${Number(summary.quarantined)||0}</td><td>${Number(summary.rejected)||0}</td><td>${Number(summary.reports)||0}</td></tr></tbody></table></div>`;
  const sourceRows=sources.map(x=>`
    <tr><td><code>${escHtml(x.ip)}</code></td>
        <td>${escHtml(x.header_from||"")}</td>
        <td>${Number(x.messages)||0}</td>
        <td>${dmarcPercent(x.passed,x.messages)}</td>
        <td>${Number(x.dkim_passed)||0}</td>
        <td>${Number(x.spf_passed)||0}</td>
        <td>${(Number(x.quarantined)||0)+(Number(x.rejected)||0)}</td>
        <td>${Number(x.reporters)||0}</td></tr>`).join("");
  const reporterRows=reporters.map(x=>`<tr><td>${escHtml(x.org)}</td><td>${Number(x.reports)||0}</td><td>${Number(x.messages)||0}</td><td>${Number(x.checked)>0?(Number(x.authenticated)||0)+" / "+Number(x.checked):escHtml(t("Not checked"))}</td></tr>`).join("");
  const reportRows=items.map(x=>`
    <tr><td>${escHtml(x.org||"")}${x.email?'<div class="hint muted">'+escHtml(x.email)+'</div>':""}${x.message_dmarc?'<div class="hint muted">'+escHtml(tf("Arrived from {0}",x.message_from||"—"))+" "+dmarcVerdict(x.message_dmarc)+'</div>':""}</td>
        <td>${escHtml(dmarcDate(x.begin))} – ${escHtml(dmarcDate(x.end))}</td>
        <td><code>p=${escHtml(x.p||"")}${x.sp?" sp="+escHtml(x.sp):""} adkim=${escHtml(x.adkim||"r")} aspf=${escHtml(x.aspf||"r")}</code></td>
        <td>${Number(x.messages)||0}</td>
        <td>${dmarcPercent(x.passed,x.messages)}</td>
        <td>${escHtml(dmarcDate(x.received))}</td>
        <td><button class="btn ghost sm" data-act="dmarcreport" data-id="${Number(x.id)||0}">${t("Records ›")}</button></td></tr>`).join("");
  const tlsRows=tlsItems.map(x=>`
    <tr><td>${escHtml(x.org||"")}</td>
        <td>${escHtml(dmarcDate(x.begin))} – ${escHtml(dmarcDate(x.end))}</td>
        <td><code>${escHtml(x.policy_type||"")}</code></td>
        <td>${Number(x.successful)||0}</td>
        <td>${Number(x.failed)||0}</td>
        <td>${asList(x,"failures").map(f=>escHtml((f.result_type||"")+" ×"+(Number(f.count)||0)+(f.receiving_mx_hostname?" ("+f.receiving_mx_hostname+")":""))).join("<br>")||"—"}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="domains">${t("‹ All domains")}</button>
    <div class="sect"><h2>${tf("{0} — DMARC and TLS reports",escHtml(domain))}</h2>
      <div class="card flat">
        ${nomailbox}${where}
        <p class="note">${escHtml(operation("/api/v1/domains/{domain}/dmarc-reports/summary","get").summary||"")}</p>
        <div class="row" style="gap:8px;margin-bottom:12px">${ranges}</div>
        ${chart||'<div class="empty">'+t("No report has been read for this domain in this window.")+'</div>'}
        ${totals}
      </div></div>
    <div class="sect"><h2>${tf("Who sends as {0}",escHtml(domain))}</h2>
      <div class="card flat">
        <div class="tablewrap"><table><thead><tr><th>${t("Source")}</th><th>${t("Sends as")}</th><th>${t("Messages")}</th><th>${t("Pass rate")}</th><th>${t("DKIM aligned")}</th><th>${t("SPF aligned")}</th><th>${t("Held or refused")}</th><th>${t("Reporters")}</th></tr></thead>
        <tbody>${sourceRows||'<tr><td colspan="8" class="empty">'+t("No source has been reported in this window.")+'</td></tr>'}</tbody></table></div>
        ${Number(summary.sources_total)>sources.length?'<p class="note">'+escHtml(tf("{0} of {1} sources are shown, most messages first.",sources.length,summary.sources_total))+'</p>':""}
      </div></div>
    <div class="sect"><h2>${t("Who reports")}</h2>
      <div class="card flat">
        <div class="tablewrap"><table><thead><tr><th>${t("Reporter")}</th><th>${t("Reports")}</th><th>${t("Messages")}</th><th>${t("Message passed DMARC")}</th></tr></thead>
        <tbody>${reporterRows||'<tr><td colspan="4" class="empty">'+t("Nobody has reported in this window.")+'</td></tr>'}</tbody></table></div>
      </div></div>
    <div class="sect"><h2>${t("The reports")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(operation("/api/v1/domains/{domain}/dmarc-reports","get").summary||"")}</p>
        <div class="row" style="margin-bottom:12px">
          <button class="btn ghost sm" data-act="dmarcpage" data-by="-${DMARC_PAGE}">${t("Newer")}</button>
          <button class="btn ghost sm" data-act="dmarcpage" data-by="${DMARC_PAGE}">${t("Older")}</button>
        </div>
        <div class="tablewrap"><table><thead><tr><th>${t("Reporter")}</th><th>${t("Covers")}</th><th>${t("Policy seen")}</th><th>${t("Messages")}</th><th>${t("Pass rate")}</th><th>${t("Read")}</th><th></th></tr></thead>
        <tbody>${reportRows||'<tr><td colspan="7" class="empty">'+t("No DMARC report has been read for this domain.")+'</td></tr>'}</tbody></table></div>
        <p class="note" style="margin-top:12px">${tf("{0} to {1} of {2}",total?dmarcView.offset+1:0,dmarcView.offset+items.length,total)}</p>
      </div></div>
    <div class="sect"><h2>${t("TLS reports")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(tf("{0} session(s) to this domain succeeded and {1} failed, by what the senders that keep TLS-RPT reported over the window.",Number(tls.sessions_succeeded)||0,Number(tls.sessions_failed)||0))}</p>
        <div class="tablewrap"><table><thead><tr><th>${t("Reporter")}</th><th>${t("Covers")}</th><th>${t("Policy type")}</th><th>${t("Succeeded")}</th><th>${t("Failed")}</th><th>${t("Failures")}</th></tr></thead>
        <tbody>${tlsRows||'<tr><td colspan="6" class="empty">'+t("No TLS report has been read for this domain in this window.")+'</td></tr>'}</tbody></table></div>
      </div></div></div>`;
}
async function showDmarcReport(domain,id){
  editing=null;
  await loadSpec();
  let report;
  try{
    report=await api("/api/v1/domains/"+encodeURIComponent(domain)+"/dmarc-reports/"+id);
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}toast(e.message);return;}
  const records=asList(report,"records");
  const rows=records.map(x=>`
    <tr><td><code>${escHtml(x.source_ip)}</code></td>
        <td>${Number(x.count)||0}</td>
        <td>${dmarcVerdict(x.disposition)}</td>
        <td>${dmarcVerdict(x.dkim)}</td>
        <td>${dmarcVerdict(x.spf)}</td>
        <td>${escHtml(x.header_from||"")}${x.envelope_from?'<div class="hint muted">'+escHtml(x.envelope_from)+'</div>':""}</td>
        <td>${x.dkim_auth?'<div><code>'+escHtml(x.dkim_auth)+'</code></div>':""}${x.spf_auth?'<div><code>'+escHtml(x.spf_auth)+'</code></div>':""}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="dmarcback">${t("‹ Back to the reports")}</button>
    <div class="sect"><h2>${tf("{0} — a DMARC report from {1}",escHtml(domain),escHtml(report.org||""))}</h2>
      <div class="card flat">
        <p class="note">${escHtml(tf("Report {0}, covering {1} to {2}, read {3}. The reporter saw p={4}.",report.report_id||"",dmarcDate(report.begin),dmarcDate(report.end),dmarcDate(report.received),report.p||"none"))}</p>
        <div class="tablewrap"><table><thead><tr><th>${t("Source")}</th><th>${t("Count")}</th><th>${t("Disposition")}</th><th>${t("DKIM")}</th><th>${t("SPF")}</th><th>${t("Sends as")}</th><th>${t("Authentication")}</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="7" class="empty">'+t("The report holds no records.")+'</td></tr>'}</tbody></table></div>
      </div></div></div>`;
}

