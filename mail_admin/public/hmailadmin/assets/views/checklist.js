/* ---------- Outbound reputation ----------
   The addresses this server sends from, against the DNS block lists other
   servers use. The page decides nothing: the API answers listed as true, false
   or null, and the third one - the list did not say, because it refused the
   query, was not answering, or could not be reached - is drawn as its own thing
   rather than as clean. A page that drew "nobody answered" the way it draws
   "not listed" would be the reason somebody believed a check that never ran.

   What is checked, and which lists, are settings (reputation_watch_addresses,
   reputation_watch_lists) and so live on the Settings page with every other one;
   this view is the answer and the button that asks again. */
/* The first-hour checklist: thirteen items the server judges itself (SetupChecklist.cpp),
   the first of them a setting profile (docs/Profiles.md), the stored-secrets key
   made and exported (docs/SecretsAtRest.md) next to last, and the last the account
   the server runs as (docs/ServiceAccount.md), which the dashboard names as well.
   Every finding carries a code and its arguments beside the server's English
   sentence, so the sentence is rendered from the catalogue here and the server's
   own is the fallback for a code this page does not know. */
const CHECKLIST_TITLE={profile:K("A profile for this server"),domain:K("A domain"),account:K("An account"),submission:K("TLS on the submission port"),
  sign_in_tls:K("Passwords only over TLS"),delivery_port_auth:K("No password on port 25"),spf:K("An SPF record"),dkim:K("DKIM signing"),dmarc:K("A DMARC record"),backup:K("A backup destination"),
  second_factor:K("A second factor for the administrator"),stored_secrets_key:K("The stored-secrets key"),service_account:K("The account the server runs as")};
const CHECKLIST_PURPOSE={
  profile:K("A profile sets the thirty or so settings one kind of server needs - which, to what and why - shows the difference from this server before anything changes, and keeps what it replaces so that it can be put back."),
  domain:K("Mail is addressed to a domain, so the server needs one before it can receive anything."),
  account:K("An account is a mailbox in a domain: the address people write to, and what a client signs in as."),
  submission:K("Mail clients send through the submission port, and without TLS their passwords cross the network in the clear."),
  sign_in_tls:K("A mail client signs in with a password, and from any address but this computer's the password should cross the network only inside TLS."),
  delivery_port_auth:K("Port 25 is where other servers deliver mail, and no mail client should sign in there: an AUTH on it is a password being guessed."),
  spf:K("SPF tells receivers which servers may send this domain's mail; without it the mail is more likely to be refused or filed as spam."),
  dkim:K("DKIM signs outgoing mail so receivers can verify it left this domain unchanged; the public key has to be published in DNS."),
  dmarc:K("DMARC tells receivers what to do with mail that fails SPF and DKIM, and where to report it."),
  backup:K("The backup writes the database and the message store to a folder; until one is set there is no backup."),
  second_factor:K("The administrator password opens everything; a one-time code beside it keeps a leaked password from being enough."),
  stored_secrets_key:K("The key an account's second factor and the [Settings] secrets are sealed under in the database. It exists on the server alone, so a copy has to be exported and kept with the database backups."),
  service_account:K("The server reads mail from anybody on the internet; the less its account may do, the less a flaw in it is worth to an attacker.")};
const CHECKLIST_STATE={done:K("Done"),action_needed:K("Action needed"),cannot_tell:K("Cannot tell"),not_needed:K("Not needed")};
const CHECKLIST_TEXT={
  profile_none:K("No profile has been applied. A profile sets about thirty settings for the kind of server this is - a small office, behind a filtering gateway, an outbound relay, a high-volume sender - and shows every change before it is made."),
  profile_in_service:K("This server holds {0} accounts, so it is in service: a profile is offered to a new server, and any of the four can still be compared with this one."),
  profile_applied:K("The {0} profile was applied on {1}."),
  profile_kept:K("The {0} profile was applied on {1}; its way back was discarded and its settings kept."),
  profile_reverted:K("The {0} profile was applied and then reverted on {1}; the settings are the ones it replaced."),
  profile_declined:K("The settings this version ships with were chosen on {0}, and no profile applied; any of the four can still be compared with this server."),
  profile_failed:K("The {0} profile could not be applied in full on {1}: some of its settings were not written. Put back what it wrote, or keep it, and apply it again."),
  domain_none:K("No domain has been added yet."),
  domain_none_active:K("{0} domains, none of them active."),
  domain_count:K("Active domains: {0} of {1}."),
  sample_domain:K("{0} is the sample domain and is not counted here; remove it when you are done with it."),
  account_none:K("No account has been added in any domain."),
  account_count:K("Accounts: {0}."),
  submission_none:K("No port takes message submission, so mail clients cannot send through this server."),
  submission_plain:K("Port {0} takes submission without TLS, so passwords and mail would cross the network in the clear."),
  submission_no_certificate:K("Port {0} is set to TLS but has no certificate, so TLS cannot start."),
  submission_tls:K("Port {0} offers TLS with the certificate {1}."),
  submission_self_signed:K("Port {0} offers TLS with {1}, the self-signed certificate this installation made: mail clients warn about it until it is replaced with one a certificate authority issued, which ACME can fetch from Let's Encrypt."),
  sign_in_plain:K("The IP range {0} takes a password without TLS on port {1}, so a client there that signs in before STARTTLS sends it across the network in the clear."),
  sign_in_no_tls:K("The IP range {0} takes a password without TLS, and port {1} has no TLS a client could start: give those ports a certificate and STARTTLS first, then require TLS for sign-in from the range."),
  sign_in_tls_required:K("The IP range {0} takes a password only over TLS."),
  sign_in_tls_ports:K("Every port the IP range {0} may use starts TLS before it takes a password."),
  sign_in_local_only:K("Only this computer may connect, so no password crosses a network."),
  delivery_port_auth_on:K("Port {0} still accepts AUTH: it is where other servers deliver mail, and a password tried there is a guess. Set its SMTP authentication to Honeypot or Off, and sign mail clients in on 587."),
  delivery_port_auth_honeypot:K("Port {0} takes no password: EHLO offers AUTH there as bait, and an address that sends one is refused and banned."),
  delivery_port_auth_off:K("Port {0} takes no password: EHLO does not offer AUTH there, and an address that sends one anyway is refused and banned."),
  delivery_port_auth_no_ban:K("Port {0} takes no password, but AutoBanMinutes is 0, so an address that sends AUTH there is refused and not banned."),
  delivery_port_auth_disabled:K("Port {0} does not offer AUTH: DisableAUTHList names it, and an AUTH sent there is refused without a ban."),
  delivery_port_none:K("No SMTP listener is on port 25, so no delivery port takes a password."),
  no_active_domain:K("No active domain, so there is nothing to publish yet."),
  record_published:K("{0}: the {1} record at {2} is published."),
  record_missing:K("{0}: no {1} record at {2}."),
  record_not_looked_up:K("{0}: the {1} record at {2} was not looked up."),
  lookup_failed:K("{0}: the lookup for {2} failed, which says nothing about the {1} record."),
  domains_not_looked_up:K("{0} more active domains were not looked up."),
  dkim_off:K("{0}: signing is off, so receivers cannot verify the mail as this domain's."),
  dkim_no_selector:K("{0}: signing is on but no selector is set."),
  dkim_key_missing:K("{0}: signing is on but the key file {1} was not found."),
  backup_none:K("No backup destination is set."),
  backup_folder_missing:K("The backup destination {0} does not exist on the server."),
  backup_set:K("Backups go to {0}."),
  second_factor_on:K("The administrator's password is backed by a one-time code."),
  second_factor_off:K("The administrator signs in with a password alone."),
  stored_secrets_off:K("ProtectStoredSecretsWithDPAPI is 0, so an account's second factor and the [Settings] secrets are stored as written, and no stored-secrets key is needed."),
  stored_secrets_key_none:K("No stored-secrets key has been made, so an account's second factor and the [Settings] secrets are stored as written. Make one on the server with {0}, then export it."),
  stored_secrets_key_not_held:K("The database's second factors and [Settings] secrets are sealed under the stored-secrets key {0}, which this server does not hold, so they do not open here. Import it on the server from one that holds it: {1}."),
  stored_secrets_key_not_exported:K("The stored-secrets key {0} has never been exported. Export it on the server with {1} and keep the file with the database backups: a database restored without it opens no second factor and no [Settings] secret."),
  stored_secrets_key_exported:K("The stored-secrets key {0} was exported on {1}; keep that file with the database backups."),
  stored_secrets_key_unreadable:K("The database's record of its stored-secrets key could not be read, so whether this server holds the database's key cannot be told."),
  service_account_local_system:K("The service runs as LocalSystem, the most privileged account on the machine, so a flaw reachable through SMTP, IMAP or POP3 would have full control of it. The virtual account a new installation uses contains that; running the installer again, or the Control Panel, moves the service to it."),
  service_account_root:K("The server runs as root, so a flaw reachable through SMTP, IMAP or POP3 would have full control of the machine. The packages run it as a user of its own."),
  service_account_own:K("The service runs as {0}."),
  autoban_firewall_not_permitted:K("AutoBanFirewall is on, but {0} cannot write Windows Defender Firewall rules: banned addresses are refused by the server and not blocked in the firewall. Run the service as LocalSystem, or reach a firewall through AutoBanCommand."),
  update_apply_by_administrator:K("{0} cannot run an installer, so updates are checked, downloaded and verified here and installed by an administrator with Install update in the Control Panel on this server.")};
function checklistLevel(state){
  if(state==="done")return "good";
  if(state==="action_needed")return "warn";
  return "info";
}
function checklistPill(state){
  const level=state==="not_needed"?"":' data-level="'+checklistLevel(state)+'"';
  return '<span class="pill"'+level+'><span class="mark">●</span>'+escHtml(t(CHECKLIST_STATE[state]||state))+"</span>";
}
function checklistText(finding){
  const key=CHECKLIST_TEXT[finding.code];
  return key?tf(key,...(finding.args||[])):(finding.text||finding.code||"");
}
/* A finding the server can put right in one step carries it as fix - the REST
   request that takes it, {method, path, body} - and is drawn with a button that
   sends it, after a confirmation that says what it changes. The page takes only
   the fixes it knows by their code and their shape - today sign_in_plain's, the
   PUT that makes an IP range require TLS for authentication
   (docs/SecureDefaults.md) - so that it never sends a request it cannot name,
   and draws the button only for a sign-in that may change settings; the route
   decides, as it does for any request. The server offers that fix only while
   every listener the range uses can start TLS; where one cannot, the finding is
   sign_in_no_tls, which says to give those listeners a certificate and STARTTLS
   first, and its button opens the Ports view where that is done. So does the
   button of delivery_port_auth_on, a port 25 that still takes AUTH (GitLab work
   item #54): the server offers no fix for it, since changing the listener is what
   arms the ban, and the step is the administrator's, in the port's editor. */
const CHECKLIST_FIX={sign_in_plain:K("Require TLS for sign-in from this range")};
const CHECKLIST_FIX_CONFIRM={sign_in_plain:K("Require TLS for sign-in from the IP range {0}? From then on a client there that signs in before STARTTLS is refused.")};
let checklistFixes_=[];
function checklistFixRange(finding){
  const fix=finding&&finding.fix;
  if(!fix||finding.code!=="sign_in_plain"||String(fix.method||"").toUpperCase()!=="PUT")return "";
  const match=/^\/api\/v1\/ipranges\/(\d+)$/.exec(String(fix.path||""));
  return match?match[1]:"";
}
function checklistFixButton(finding){
  if(finding&&(finding.code==="sign_in_no_tls"||finding.code==="delivery_port_auth_on"))
    return ' <button class="btn ghost sm" data-act="checklistgo" data-to="ports">'+escHtml(t("Ports"))+"</button>";
  if(!checklistFixRange(finding)||!may("manage_settings"))return "";
  checklistFixes_.push(finding);
  return ' <button class="btn ghost sm" data-act="checklistfix" data-i="'+(checklistFixes_.length-1)+'">'+escHtml(t(CHECKLIST_FIX[finding.code]))+"</button>";
}
async function applyChecklistFix(index){
  const finding=checklistFixes_[Number(index)];
  const range=checklistFixRange(finding);
  if(!range)return;
  if(!await deckConfirm(tf(CHECKLIST_FIX_CONFIRM[finding.code],...(finding.args||[]))))return;
  setErr("err_checklist","");
  try{
    await api("/api/v1/ipranges/"+range,{method:"PUT",body:JSON.stringify(finding.fix.body||{})});
    toast(t("Done"));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_checklist",e.message);}
}
/* ---------- setting profiles ----------
   The four profiles the server ships (docs/Profiles.md), under the checklist
   because a profile is where the first hour starts. The page decides nothing:
   the server answers each entry with the value it holds now, whether applying
   would change it and whether that change asks for a confirmation - it closes a
   listener, trusts an address range, turns a filter or a check off, or shortens
   a window of data - and refuses an apply without the box ticked when one does.
   The apply names the diff it was made from (diff_token), and the server refuses
   it when the settings have moved since. What an apply replaces is kept, and put
   back from here. The profiles' titles, paragraphs, reasons and notes are the
   server's own English, as a finding's text is for a code the page does not
   know. */
let profileShown_="";
const PROFILE_CAUTION={closes_listener:K("Closes a listener"),trusts_addresses:K("Trusts an address range"),turns_filter_off:K("Turns a filter or a check off"),purges:K("Shortens how long data is kept")};
function profileRows(diff){
  return (diff.entries||[]).map(e=>{
    const environment=e.environment?'<div class="hint muted">'+escHtml(t("Set by the environment"))+" ("+escHtml(e.environment)+")</div>":"";
    const refused=e.refused?'<div class="err">'+escHtml(tf("Refused: {0}",e.refused))+"</div>":"";
    const caution=e.caution&&e.confirm?' <span class="pill" data-level="warn"><span class="mark">●</span>'+escHtml(t(PROFILE_CAUTION[e.caution]||e.caution))+"</span>":"";
    const value=e.changes?"<b>"+escHtml(e.value)+"</b>":escHtml(e.value);
    const note=e.note?'<div class="hint muted">'+escHtml(e.note)+"</div>":"";
    return `<tr class="profilerow" data-name="${escHtml(e.name)}" data-changes="${e.changes?1:0}"><td><code>${escHtml(e.name)}</code>${environment}</td><td>${escHtml(e.current)}</td><td>${value}${caution}</td><td>${escHtml(e.why)}${note}${refused}</td></tr>`;
  }).join("");
}
function profilesCard(list,diff){
  if(!list)return "";
  const mayChange=may("manage_settings");
  // Any way back is held, readable or not: one that cannot be read cannot be put
  // back, and discarding it is the only way to apply a profile again.
  const snapshot=list.snapshot&&typeof list.snapshot==="object"?list.snapshot:null;
  const readable=!!(snapshot&&snapshot.readable!==false&&snapshot.profile);
  let held="";
  if(snapshot&&readable)held=`<p class="note">${escHtml(tf("The {0} profile is applied. What it replaced is kept, and can be put back.",snapshot.profile))}</p>`+
    (mayChange?`<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn ghost sm" data-act="profilerevert" data-name="${escHtml(snapshot.profile)}">${t("Put back what it changed")}</button>
      <button class="btn ghost sm" data-act="profilediscard">${t("Keep its settings, forget the way back")}</button></div>`:"");
  else if(snapshot)held=`<p class="note">${t("A way back from a profile is held and cannot be read, so it cannot be put back. Discard it to apply a profile; the audit trail names each value the profile replaced.")}</p>`+
    (mayChange?`<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn ghost sm" data-act="profilediscard">${t("Discard the way back")}</button></div>`:"");
  // Keeping the shipped settings is a choice too: recorded, the checklist stops
  // asking. Offered while no profile is in effect and no way back is held.
  const decline=mayChange&&!snapshot&&(!list.applied||list.applied.state==="reverted"||list.applied.state==="failed")?`<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
      <button class="btn ghost sm" data-act="profiledecline">${t("Keep the shipped settings")}</button></div>`:"";
  const profiles=(list.profiles||[]).map(p=>{
    const shown=profileShown_===p.name&&diff&&diff.name===p.name;
    let detail="";
    if(shown){
      const needs=(diff.confirmation_needed||[]).length>0;
      const steps=(diff.steps||[]).map(step=>"<li>"+escHtml(step)+"</li>").join("");
      detail=`<div class="tablewrap"><table class="profilediff"><thead><tr><th>${t("Setting")}</th><th>${t("This server now")}</th><th>${t("The profile")}</th><th>${t("Why")}</th></tr></thead>
        <tbody>${profileRows(diff)}</tbody></table></div>`+
        (steps?`<p class="note"><b>${t("What it cannot do for you")}</b></p><ul class="findings">${steps}</ul>`:"")+
        (mayChange&&diff.applicable?`<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">`+
          (needs?`<label class="row" style="gap:7px"><input type="checkbox" id="profileConfirm"> ${t("I confirm the changes marked above: they close a listener, trust an address range, turn a filter or a check off, or shorten how long data is kept on this server - and what a shorter window deletes, a revert does not bring back.")}</label>`:"")+
          `<button class="btn sm" data-act="profileapply" data-name="${escHtml(p.name)}" data-changes="${Number(diff.changes)||0}" data-needs="${needs?1:0}" data-token="${escHtml(diff.diff_token||"")}">${t("Apply this profile")}</button></div>`:"")+
        (diff.blocked?`<p class="note">${escHtml(diff.blocked)}</p>`:"");
    }
    return `<div class="card flat profilecard" data-name="${escHtml(p.name)}">
      <div class="row" style="gap:10px;align-items:center"><b>${escHtml(p.title||p.name)}</b> <span class="muted">${escHtml(p.name)}</span></div>
      <p class="note">${escHtml(p.summary||"")}</p>
      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><span class="muted">${escHtml(tf("{0} of its {1} settings would change on this server.",Number(p.changes)||0,Number(p.entries)||0))}</span>
        <button class="btn ghost sm" data-act="${shown?"profilehide":"profileshow"}" data-name="${escHtml(p.name)}">${shown?t("Hide the changes"):t("Show the changes")}</button></div>
      ${detail}</div>`;
  }).join("");
  return `<div class="card flat" id="profilesCard">
    <div class="row" style="gap:10px;align-items:center"><b>${t("Setting profiles")}</b></div>
    <p class="note">${t("Each profile sets the settings one kind of server needs. Showing one lists every setting beside the value this server holds now; nothing changes until it is applied.")}</p>
    ${held}${profiles}${decline}
    <div class="err" id="err_profiles"></div></div>`;
}
async function applyProfile(name,changes,needs,token){
  setErr("err_profiles","");
  const box=document.getElementById("profileConfirm");
  const confirmed=!!(box&&box.checked);
  if(needs&&!confirmed){setErr("err_profiles",t("Tick the confirmation first: this profile closes a listener, trusts an address range, turns a filter or a check off, or shortens how long data is kept here."));return;}
  if(!await deckConfirm(tf("Apply the {0} profile? {1} settings change, and what they held is kept so that they can be put back.",name,changes)))return;
  try{
    // The token names the diff shown above: the server refuses the apply when the
    // settings moved since, and the page shows the diff again.
    const answer=await api("/api/v1/settings/profiles/"+encodeURIComponent(name)+"/apply",{method:"POST",body:JSON.stringify({confirm:confirmed,diff_token:token})});
    const waiting=answer.waiting||{};
    toast(tf("{0}: {1} set, {2} unchanged, {3} skipped; {4} wait for a reinitialise and {5} for a restart.",name,Number(answer.set)||0,Number(answer.unchanged)||0,Number(answer.skipped)||0,Number(waiting.reinitialize)||0,Number(waiting.restart)||0));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_profiles",e.message);await render();setErr("err_profiles",e.message);}
}
async function revertProfile(name){
  setErr("err_profiles","");
  if(!await deckConfirm(tf("Put back the values the {0} profile replaced? A setting changed since is left as it is, and a filter the profile turned on may be turned off again.",name)))return;
  try{
    const answer=await api("/api/v1/settings/profiles/revert",{method:"POST",body:"{}"});
    const waiting=answer.waiting||{};
    toast(tf("{0}: {1} put back, {2} left as they were; {3} wait for a reinitialise and {4} for a restart.",name,Number(answer.set)||0,Number(answer.skipped)||0,Number(waiting.reinitialize)||0,Number(waiting.restart)||0));
    profileShown_="";
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_profiles",e.message);}
}
async function declineProfiles(){
  setErr("err_profiles","");
  if(!await deckConfirm(t("Keep the settings this version ships with, and apply no profile? The checklist stops asking; any profile can still be applied later.")))return;
  try{
    await api("/api/v1/settings/profiles/decline",{method:"POST",body:"{}"});
    toast(t("The shipped settings are kept; no profile is applied."));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_profiles",e.message);}
}
async function discardProfile(){
  setErr("err_profiles","");
  try{
    await api("/api/v1/settings/profiles/discard",{method:"POST",body:"{}"});
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_profiles",e.message);}
}
/* ---------- the sample domain ----------
   A throwaway example.test with three mailboxes, a distribution list, a rule
   and a handful of delivered messages, so that every view here has something
   in it while somebody is learning - and one button that takes all of it away
   again and says what went.

   It sits under the checklist because that is the view somebody opens in the
   first hour, and the checklist deliberately leaves the sample out of its
   counts: a sample domain is not this server's first domain. The card has
   four shapes - none here, ours here, a domain of that name that this server
   did not make, which is refused in both directions and says so, and a server
   whose domain table could not be read, where nothing is offered at all.

   THE PASSWORD is minted by the server when the sample is made and is in the
   answer to that one call; nothing stores it and no later read can tell us
   what it was. So it is held here, in this page's memory, for as long as this
   tab is open, and shown on the card - not in the toast, which goes away
   while somebody is still writing it down. A reload loses it, which is the
   truth rather than a defect.

   It is held WITH the domain id it was minted for, and shown only when the
   sample on the server is still that one. Otherwise a tab that made a sample,
   and then watched somebody else remove it and make another, would print the
   first sample's password beside the second sample's mailboxes. */
let samplePassword_="",samplePasswordFor_=0;
function sampleDomainCard(sample){
  if(!sample)return "";
  const state=sample.state||"absent";
  const mayChange=may("manage_server");
  let body="",button="";
  if(state==="present"){
    body=`<p class="note">${escHtml(tf("{0} is here: {1}, the list {2}, and one rule that files invoices.",
      sample.domain||"",(sample.accounts||[]).join(", "),sample.list||""))}</p>`+
      (samplePassword_&&samplePasswordFor_===Number(sample.domain_id)
        ?`<p class="note"><b>${escHtml(tf("All of the mailboxes sign in with the password {0}. It is shown here once - write it down, because this server did not keep it.",samplePassword_))}</b></p>`
        :`<p class="note">${escHtml(t("The one password for all of the mailboxes was shown when the sample was made and was not kept; remove the sample and make it again to be given another."))}</p>`)+
      `<p class="note">${escHtml(t("It is left out of the checklist above, because a sample domain is not this server's first domain."))}</p>`;
    button=mayChange?'<button class="btn danger sm" data-act="sampleremove">'+t("Remove the sample domain")+"</button>":"";
  }else if(state==="foreign"){
    body=`<p class="note">${escHtml(tf("A domain named {0} is on this server and the sample did not make it, so nothing here creates it or removes it. Delete that domain yourself if it is not wanted.",sample.domain||""))}</p>`;
  }else if(state==="unknown"){
    body=`<p class="note">${escHtml(t("This server could not read its domain table, so it cannot say whether the sample is here. Nothing is offered until it can."))}</p>`;
  }else{
    body=`<p class="note">${escHtml(tf("Nothing on this server to look at yet? This makes {0} with three mailboxes, a distribution list, a rule and a handful of delivered messages, so that every view has something in it while you learn.",sample.domain||""))}</p>`+
      `<p class="note">${escHtml(t("Every mailbox signs in with one password, which this server mints now and shows once, so write it down - and remove the sample before this server takes real mail."))}</p>`;
    button=mayChange?'<button class="btn ghost sm" data-act="samplecreate">'+t("Make a sample domain")+"</button>":"";
  }
  return `<div class="card flat" id="sampleCard">
    <div class="row" style="gap:10px;align-items:center"><b>${escHtml(t("A sample domain to learn on"))}</b></div>
    ${body}
    <div class="row" style="gap:10px;align-items:center">${button}</div>
    <div class="err" id="err_sample"></div></div>`;
}
async function createSampleDomain(){
  setErr("err_sample","");
  try{
    const answer=await api("/api/v1/setup/sample-domain",{method:"POST",body:"{}"});
    samplePassword_=answer.password||"";
    samplePasswordFor_=Number(answer.domain_id)||0;
    toast(tf("{0} made: {1} mailboxes, and {2} messages on their way",answer.domain||"",Number(answer.accounts_created)||0,Number(answer.messages)||0));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_sample",e.message);}
}
async function removeSampleDomain(){
  if(!await deckConfirm(t("Remove the sample domain with every mailbox, message and rule in it? Anything added to it goes too.")))return;
  setErr("err_sample","");
  try{
    const answer=await api("/api/v1/setup/sample-domain",{method:"DELETE"});
    samplePassword_="";samplePasswordFor_=0;
    toast(tf("{0} removed: {1} mailboxes and {2} messages",answer.domain||"",Number(answer.accounts)||0,Number(answer.messages)||0));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_sample",e.message);}
}
async function renderChecklist(){
  const answer=await api("/api/v1/setup/checklist");
  // The profiles beside the list, as the sample is: a server that cannot answer
  // them still draws the items it could.
  let profiles=null,profileDiff=null;
  try{
    profiles=await api("/api/v1/settings/profiles");
    if(profileShown_)profileDiff=await api("/api/v1/settings/profiles/"+encodeURIComponent(profileShown_));
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}profiles=null;}
  // The sample is asked for beside the list rather than inside it: a server
  // that cannot answer this one still draws the eight items it could.
  let sample=null;
  try{sample=await api("/api/v1/setup/sample-domain");}catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}sample=null;}
  const items=answer.items||[];
  checklistFixes_=[];
  const cards=items.map(item=>{
    const findings=(item.findings||[]).map(f=>'<li>'+checklistPill(f.state)+' '+escHtml(checklistText(f))+checklistFixButton(f)+'</li>').join("");
    return `<div class="card flat checkitem" data-key="${escHtml(item.key)}">
      <div class="row" style="gap:10px;align-items:center">${checklistPill(item.state)}<b>${escHtml(t(CHECKLIST_TITLE[item.key]||item.key))}</b></div>
      <p class="note">${escHtml(t(CHECKLIST_PURPOSE[item.key]||""))}</p>
      <ul class="findings">${findings}</ul></div>`;
  });
  const summary=tf("{0} done, {1} need action, {2} cannot be told, {3} not needed.",
    Number(answer.done)||0,Number(answer.action_needed)||0,Number(answer.cannot_tell)||0,Number(answer.not_needed)||0);
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${t("The first hour: what this server still needs before it is a mail server anybody can use, judged by the server itself. The record items look SPF, DKIM and DMARC up in DNS for every active domain.")}</p>
      <div class="row" style="gap:10px;align-items:center;flex-wrap:wrap">
        <span class="muted" id="checklistSummary">${escHtml(summary)}</span>
        <span class="muted">${escHtml(answer.generated?tf("Checked {0}",auditWhen(answer.generated)):"")}</span>
        <button class="btn ghost sm" data-act="checklistagain">${t("Check again")}</button>
      </div>
      <div class="err" id="err_checklist"></div>
    </div>
    ${cards.join("")}
    ${profilesCard(profiles,profileDiff)}
    ${sampleDomainCard(sample)}</div>`;
}

const REPUTATION_STATUS={listed:K("Listed"),not_listed:K("Not listed"),refused:K("Refused"),
  lookup_failed:K("Lookup failed"),unexpected_answer:K("Unexpected answer"),
  list_not_answering:K("List not answering"),list_lists_everything:K("List lists everything"),
  not_applicable:K("Not covered"),not_checked:K("Not checked yet")};
function reputationLevel(status){
  if(status==="listed")return "bad";
  if(status==="not_listed")return "good";
  if(status==="not_applicable"||status==="not_checked")return "info";
  return "warn";
}
async function renderReputation(){
  const answer=await api("/api/v1/reputation");
  const addresses=answer.addresses||[];
  const skipped=answer.skipped||[];
  const rows=[];
  addresses.forEach(a=>{
    const sources=(a.sources||[]).join(", ");
    (a.results||[]).forEach(r=>{
      rows.push(`<tr><td><b>${escHtml(a.address)}</b><div class="hint muted">${escHtml(sources)}</div></td>
        <td>${escHtml(r.list)}</td>
        <td><span class="pill" data-level="${reputationLevel(r.status)}"><span class="mark">●</span>${escHtml(t(REPUTATION_STATUS[r.status]||r.status))}</span>
          ${r.listed_since?'<div class="hint muted">'+escHtml(tf("listed since {0}",auditWhen(r.listed_since)))+'</div>':""}</td>
        <td>${escHtml(r.code||"—")}</td>
        <td>${escHtml(r.reason||"")}</td>
        <td>${escHtml(r.checked?auditWhen(r.checked):"—")}</td></tr>`);
    });
  });
  const skippedRows=skipped.map(s=>`<tr><td><b>${escHtml(s.address)}</b></td><td>${escHtml(s.source)}</td>
    <td>${escHtml(s.detail||s.reason)}</td></tr>`).join("");
  const when=answer.last_checked?tf("Last checked {0}, next {1}",auditWhen(answer.last_checked),
    answer.next_check?auditWhen(answer.next_check):"—"):t("Not checked yet");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${t("The addresses this server sends from, checked once a day against the DNS block lists other servers use. Which addresses, and which lists, are on the Settings page.")}</p>
      ${answer.enabled?"":'<p class="note">'+t("The watch is off. reputation_watch_enabled on the Settings page turns it on.")+"</p>"}
      <div class="row" style="gap:10px;align-items:center">
        <span class="muted">${escHtml(when)}</span>
        ${may("manage_server")?'<button class="btn ghost sm" data-act="repwatchcheck">'+t("Check now")+"</button>":""}
      </div>
      <div class="err" id="err_repwatch">${escHtml(answer.lists_problem||"")}</div>
    </div>
    <div class="tablewrap"><table><thead><tr><th>${t("Address")}</th><th>${t("List")}</th><th>${t("Status")}</th>
      <th>${t("Answer")}</th><th>${t("Reason")}</th><th>${t("When")}</th></tr></thead>
    <tbody>${rows.join("")||'<tr><td colspan="6" class="empty">'+t("No outbound address is configured, so nothing is checked: set the delivery bind address, or name this server\'s public address in reputation_watch_addresses on the Settings page.")+"</td></tr>"}</tbody></table></div>
    ${skippedRows?'<div class="sect"><h2>'+t("Not looked up")+'</h2><div class="card flat"><div class="tablewrap"><table><thead><tr><th>'+t("Address")+"</th><th>"+t("Source")+"</th><th>"+t("Detail")+'</th></tr></thead><tbody>'+skippedRows+"</tbody></table></div></div></div>":""}
    </div>`;
}
async function runReputationCheck(){
  setErr("err_repwatch","");
  try{
    const answer=await api("/api/v1/reputation/check",{method:"POST",body:"{}"});
    const run=answer.run||{};
    toast(tf("Checked {0} address(es) against {1} list(s)",Number(run.addresses)||0,Number(run.lists)||0));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_repwatch",e.message);}
}
async function showLog(name,lines){
  setErr("err_log","");
  try{
    const answer=await api("/api/v1/logs/"+encodeURIComponent(name)+"?lines="+encodeURIComponent(lines||200));
    const pre=$("#logPre");if(!pre)return;
    pre.hidden=false;
    pre.textContent=(answer.lines||[]).join("\n")||t("(empty)");
    pre.scrollTop=pre.scrollHeight;
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_log",tf("Could not read {0}: {1}",name,e.message));}
}


