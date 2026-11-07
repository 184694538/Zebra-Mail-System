/* ---------- Logs ---------- */
/* ---------- Roles ---------- */
async function renderRoles(){
  const catalogue=await api("/api/v1/roles");
  const held=await api("/api/v1/role-assignments");
  const roles=catalogue.roles||[];
  const roleRows=roles.map(r=>`
    <tr><td><code class="ro">${escHtml(r.name)}</code></td>
        <td>${escHtml(r.description||"")}</td>
        <td>${r.builtin?'<span class="badge info">'+t("Built in")+'</span>':""}</td>
        <td style="word-break:break-word">${escHtml((r.permissions||"").split(",").join(", "))}</td>
        <td style="text-align:right">${may("manage_roles")&&!r.builtin?`<button class="btn danger sm" data-act="roledel" data-name="${escHtml(r.name)}">${t("Delete")}</button>`:""}</td></tr>`).join("");
  const options=roles.map(r=>`<option value="${escHtml(r.name)}">${escHtml(r.name)}</option>`).join("");
  const heldRows=(held.assignments||[]).map(a=>`
    <tr><td>${escHtml(a.address)}</td><td><code class="ro">${escHtml(a.role)}</code></td>
        <td>${escHtml(a.every_domain?t("every domain"):(a.domains||t("the account's own domain")))}</td>
        <td style="text-align:right">${may("manage_roles")?`<button class="btn danger sm" data-act="unassign" data-address="${escHtml(a.address)}">${t("Remove")}</button>`:""}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="card view">
    <div class="tablewrap"><table><thead><tr><th>${t("Role")}</th><th>${t("What it is for")}</th><th></th><th>${t("Permissions")}</th><th></th></tr></thead>
    <tbody>${roleRows}</tbody></table></div></div>
    <div class="card view" style="margin-top:14px">
    <div class="tablewrap"><table><thead><tr><th>${t("Account")}</th><th>${t("Role")}</th><th>${t("Domains")}</th><th></th></tr></thead>
    <tbody>${heldRows||'<tr><td colspan="4" class="empty">'+t("Nobody has been given a role yet. An account without one holds the authority its admin level gives it. ✦")+'</td></tr>'}</tbody></table></div>
    ${may("manage_roles")?`<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
      <input id="roleAddress" placeholder="${t("Account address")}" style="flex:1 1 220px">
      <select id="roleName" style="flex:0 1 180px">${options}</select>
      <input id="roleDomains" placeholder="${t("Domains, comma separated")}" style="flex:1 1 200px">
      <button class="btn" data-act="assign">${t("Give the role")}</button>
    </div>`:""}
    <div class="err" id="err_roles" style="margin-top:10px"></div></div>`;
}
async function assignRole(){
  setErr("err_roles","");
  const address=($("#roleAddress").value||"").trim();
  if(!address){setErr("err_roles",t("An account address is required."));return;}
  try{
    await api("/api/v1/role-assignments/"+encodeURIComponent(address),{method:"PUT",body:JSON.stringify({role:$("#roleName").value,domains:($("#roleDomains").value||"").trim()})});
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_roles",e.message);}
}
async function unassignRole(address){
  setErr("err_roles","");
  try{
    await api("/api/v1/role-assignments/"+encodeURIComponent(address),{method:"DELETE"});
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_roles",e.message);}
}
/* A custom role nobody holds is deleted. One somebody holds is refused by the
   server - deleting it would hand each holder what its admin level gives - with
   a sentence saying how many accounts hold it, shown here beside who holds what. */
async function deleteRole(name){
  setErr("err_roles","");
  if(!await deckConfirm(tf("Delete the role {0}?",name)))return;
  try{
    await api("/api/v1/roles/"+encodeURIComponent(name),{method:"DELETE"});
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_roles",e.message);}
}

/* ---------- Devices ----------
   Every client that has signed in to an account, by protocol, address and last
   use, and the one press that ends what one of them holds. The list is read for
   an address the administrator types, because there is no server-wide listing:
   a device belongs to an account, and a page that showed every client on the
   server would be a page about traffic rather than about people. */
var devicesFor="";
async function renderDevices(){
  const shown=escHtml(devicesFor);
  const form=`<div class="card flat">
    <p class="note">${t("Every client that has signed in to an account: what it speaks, where from, which of the account's credentials it used, and when it was first and last seen. Revoking one ends the session it holds now - its browser session, and its live IMAP, POP3 and SMTP connections - and can disable the app password behind it. It is not a ban: the client can sign in again with a credential that still works.")}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <input id="devAddress" placeholder="${t("Account address")}" value="${shown}" style="flex:1 1 260px">
      <button class="btn" data-act="devshow">${t("Show")}</button>
    </div>
    <div class="err" id="err_devices" style="margin-top:10px"></div>
  </div>`;
  if(!devicesFor){
    $("#content").innerHTML=`<div class="view">${form}
      <div class="card view" style="margin-top:14px"><div class="empty">${t("Type an account address and press Show. ✦")}</div></div></div>`;
    return;
  }
  let list=[];
  try{list=asList(await api("/api/v1/accounts/"+encodeURIComponent(devicesFor)+"/devices"),"devices");}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    $("#content").innerHTML=`<div class="view">${form}</div>`;setErr("err_devices",e.message);return;}
  const rows=list.map(d=>`
    <tr><td>${escHtml(d.protocol||"")}</td>
        <td>${escHtml(d.address||"")}</td>
        <td style="word-break:break-word">${escHtml(d.agent||"—")}</td>
        <td>${escHtml(d.credential||"")}${d.credential_name?" <code class=\"ro\">"+escHtml(d.credential_name)+"</code>":""}</td>
        <td>${escHtml(d.first_seen||"")}</td>
        <td>${escHtml(d.last_seen||"")}</td>
        <td>${Number(d.sign_ins||0)}</td>
        <td>${d.revoked?'<span class="badge warn">'+t("Revoked")+"</span>":""}</td>
        <td style="text-align:right;white-space:nowrap">${may("manage_accounts")?`<button class="btn danger sm" data-act="devrevoke" data-id="${escHtml(d.id)}">${t("Revoke")}</button>`:""}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">${form}
    <div class="card view" style="margin-top:14px">
    ${may("manage_accounts")?`<label class="row" style="gap:8px;margin-bottom:10px"><input type="checkbox" id="devCredential"> <span>${t("Also disable the app password the client used")}</span></label>`:""}
    <div class="tablewrap"><table><thead><tr><th>${t("Protocol")}</th><th>${t("Address")}</th><th>${t("Client")}</th><th>${t("Credential")}</th><th>${t("First seen")}</th><th>${t("Last seen")}</th><th>${t("Sign-ins")}</th><th></th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="9" class="empty">'+t("Nothing has signed in to this account yet. ✦")+"</td></tr>"}</tbody></table></div>
    </div></div>`;
}
async function showDevices(){
  devicesFor=(($("#devAddress")||{}).value||"").trim();
  await render();
}
async function revokeDevice(id){
  setErr("err_devices","");
  const credential=(($("#devCredential")||{}).checked)?"?credential=revoke":"";
  try{
    const answer=await api("/api/v1/accounts/"+encodeURIComponent(devicesFor)+"/devices/"+encodeURIComponent(id)+credential,{method:"DELETE"});
    toast(tf("Revoked: {0} session(s) ended, {1} connection(s) dropped.",Number(answer.sessions_ended||0),Number(answer.connections_dropped||0)));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_devices",e.message);}
}

/* ---------- Logs: the files, and one connection followed live ----------
   GET /api/v1/logs/sessions lists every SMTP, POP3 and IMAP session open now
   and the last ones that ended, each with the id its log lines carry. Follow
   asks GET /api/v1/logs/sessions/{id}?after=<cursor>&wait=10 in a loop; the
   server holds each request until the session's next line arrives, so the
   lines appear as they are written. It is a cursor and a wait rather than an
   event stream because the listener writes a response whole (HttpServer.cpp).
   `follow` is the loop's ticket: a new Follow, Stop, or leaving the view
   changes it, and the loop that no longer holds it ends. The ticket number
   comes from a counter that only ever grows, never from the ticket being
   replaced - two Follows either side of a Stop would otherwise both be
   number 1, and the first one's answers would land in the second one's pane.

   The pane holds the most recent FOLLOW_PANE_LINES lines and no more. The
   server bounds one answer (500) and its ring (4,096), but a follow left
   running on a busy debug-logged session appends answer after answer for as
   long as the tab is open, and nothing in the page would ever have let go of
   one: the tab would grow until it was unusable and Copy would put megabytes
   on the clipboard. What falls off the front is in the log file, which is on
   the same page. */
let follow=null,followGen=0;
const FOLLOW_PANE_LINES=5000;
async function renderLogs(){
  follow=null;
  const files=asList(await api("/api/v1/logs"),"files");
  let sessions=null;
  try{sessions=await api("/api/v1/logs/sessions");}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}sessions={sessions:[],error:e.message};}
  const rows=files.map(f=>`
    <tr><td>${escHtml(f.name)}</td><td>${escHtml(fmtBytes(f.size))}</td><td>${escHtml(f.created||"—")}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn ghost sm" data-act="log" data-name="${escHtml(f.name)}" data-lines="200">${t("Last 200")}</button>
        <button class="btn ghost sm" data-act="log" data-name="${escHtml(f.name)}" data-lines="2000">${t("Last 2000")}</button></td></tr>`).join("");
  $("#content").innerHTML=`<div class="card view">
    <div class="sect"><h2>${t("Connections")} <code class="muted">GET /api/v1/logs/sessions</code> <button class="btn ghost sm" data-act="sessrefresh">${t("Refresh")}</button></h2>
    <p class="note">${t("Every connection this server has open now - the SMTP, POP3 and IMAP sessions it answers, and the ones it opens itself - and the last ones that ended. Follow one and its log lines appear below as the server writes them - what a grep through the day's log for its session id stands in for.")}</p>
    ${sessionsHtml(sessions)}
    <div class="err" id="err_sessions">${escHtml(sessions.error||"")}</div>
    <div id="followBox" hidden>
      <div class="actions"><strong id="followTitle"></strong> <button class="btn ghost sm" data-act="followcopy">${t("Copy")}</button> <button class="btn ghost sm" data-act="followstop">${t("Stop following")}</button></div>
      <div class="hint" id="followNote"></div>
      <div class="err" id="err_follow"></div>
      <pre id="followPre" style="margin-top:10px;max-height:50vh;overflow:auto;white-space:pre-wrap"></pre>
    </div></div>
    <div class="sect"><h2>${t("Log files")}</h2>
    <div class="tablewrap"><table><thead><tr><th>${t("Log file")}</th><th>${t("Size")}</th><th>${t("Created")}</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="4" class="empty">'+t("No log files. Logging may be off, or the folder is empty.")+'</td></tr>'}</tbody></table></div>
    <div class="err" id="err_log" style="margin-top:10px"></div>
    <pre id="logPre" style="margin-top:14px;max-height:60vh;overflow:auto;white-space:pre-wrap" hidden></pre></div></div>`;
}
function sessionsHtml(answer){
  const list=asList(answer,"sessions");
  if(!list.length)return '<p class="empty">'+t("No SMTP, POP3 or IMAP session is open, and none has ended since the server started.")+'</p>';
  const open=list.filter(s=>s.open),ended=list.filter(s=>!s.open);
  const table=(items,whenHeading)=>`<div class="tablewrap"><table><thead><tr><th>${t("Session")}</th><th>${t("Protocol")}</th><th>${t("Address")}</th><th>${t("Port")}</th><th>${t("Account")}</th><th>${whenHeading}</th><th></th></tr></thead><tbody>${items.map(s=>`
    <tr><td><code>${escHtml(s.id)}</code></td><td>${escHtml(s.protocol)}</td><td>${escHtml(s.peer)}</td><td>${escHtml(s.port||"")}</td><td>${escHtml(s.account||"—")}</td><td>${escHtml(s.open?s.started:s.ended)}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn ghost sm" data-act="follow" data-id="${escHtml(s.id)}">${t("Follow")}</button></td></tr>`).join("")}</tbody></table></div>`;
  // The route lists the newest sessions and says so when it left some out; a
  // page that drew the thousand and nothing else would be describing a server
  // with a thousand connections open as though that were all of them.
  const truncated=answer.truncated?'<p class="note">'+tf("More connections are open than this list holds; the newest {0} are shown.",open.length)+'</p>':"";
  return `<h3>${t("Open now")} (${open.length})</h3>`+(open.length?table(open,t("Started")):'<p class="empty">'+t("None open.")+'</p>')+truncated+
    (ended.length?`<h3>${t("Ended recently")} (${ended.length})</h3>`+table(ended,t("Ended")):"");
}
async function followSession(id){
  const gen=++followGen;
  follow={id:id,cursor:0,gen:gen};
  const box=$("#followBox");if(!box)return;
  box.hidden=false;
  $("#followTitle").textContent=tf("Following session {0}",id);
  $("#followNote").textContent=t("Waiting for the next line…");
  setErr("err_follow","");
  const pre=$("#followPre");pre.textContent="";
  while(follow&&follow.gen===gen&&view==="logs"){
    let answer;
    try{answer=await api("/api/v1/logs/sessions/"+encodeURIComponent(id)+"?after="+encodeURIComponent(follow.cursor)+"&wait=10");}
    catch(e){
      if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
      if(follow&&follow.gen===gen){setErr("err_follow",tf("Could not follow session {0}: {1}",id,e.message));follow=null;}
      return;
    }
    if(!follow||follow.gen!==gen)return;
    follow.cursor=Number(answer.cursor)||0;
    const lines=answer.lines||[];
    if(lines.length){
      const atEnd=pre.scrollTop+pre.clientHeight>=pre.scrollHeight-8;
      let text=pre.textContent+lines.map(l=>l.time+"  "+l.category+"  "+l.message).join("\n")+"\n";
      const held=text.split("\n");
      // held ends with "" because the text ends in a newline, so the count of
      // lines is one less than the count of pieces.
      if(held.length-1>FOLLOW_PANE_LINES){text=held.slice(held.length-1-FOLLOW_PANE_LINES).join("\n");follow.trimmed=true;}
      pre.textContent=text;
      if(atEnd)pre.scrollTop=pre.scrollHeight;
    }
    if(answer.dropped)$("#followNote").textContent=t("Lines arrived faster than they were read; the server holds only the most recent few thousand, and the ones between are gone.");
    else if(answer.open===false){$("#followNote").textContent=t("The session ended.");if(!lines.length){follow=null;return;}}
    else if(answer.logged===false)$("#followNote").textContent=t("Logging is off for this session's protocol, so no line will appear. Turn it on under Settings, Logging.");
    else if(follow.trimmed)$("#followNote").textContent=tf("Only the most recent {0} lines are kept here, and Copy takes those; the ones before them are in the log file below.",FOLLOW_PANE_LINES);
    else $("#followNote").textContent=t("Waiting for the next line…");
    // The server answers at once, rather than waiting, when another follow is
    // already waiting on it - one at a time, since a waiting follow holds one
    // of the four worker threads that also serve the webmail; a pause here is
    // what keeps that from becoming a tight loop.
    if(!lines.length&&!answer.waited)await new Promise(r=>setTimeout(r,1000));
  }
}
function stopFollow(){follow=null;const box=$("#followBox");if(box)box.hidden=true;}

/* ---------- Audit trail ----------
   Who changed what, when, from where, and over which interface. The rows are
   written below the interfaces (see AuditTrail.h in the server), so a change
   made over COM by the Control Panel and the same change made here appear side
   by side with only the interface column telling them apart.

   The page reads and never writes: the record is append-only, and a page that
   could edit it would be the first thing to use. */
let auditOffset=0;
const AUDIT_PAGE=50;

/* ---------- Changed from stock ----------
   Every setting whose value is not the one this version ships with, with the
   shipped value beside it. One route answers the whole page and the page holds
   no opinion of its own about what a difference is: the server decides, from
   the defaults its own source was built with, and COM's
   Settings.GetChangedFromDefault is given the same document - so the Deck, the
   Control Panel and hmctl cannot describe the same server differently.

   It reads and never writes. A setting is changed where it is set, which is the
   Settings view and the pages of the thing it belongs to; a page that could
   edit from here would be a second place to do it and a second set of rules
   about who may.

   The route answers the administrator password alone, as GET
   /api/v1/settings/ini does, so the button carries data-admin rather than a
   permission and a role account is not offered a page it would be refused. */
async function renderChanged(){
  const answer=await api("/api/v1/settings/changed");
  const settings=answer.settings||[];
  const considered=Number(answer.considered)||0;
  const rows=settings.map(s=>`
    <tr><td>${escHtml(s.store||"")}</td><td>${escHtml(s.name||"")}</td>
        <td>${escHtml(s.value||"")}${s.overridden?' <span class="note">'+t("Forced from [SettingsOverride] in hMailServer.ini")+'</span>':''}${environmentBadge(s.environment)}</td>
        <td>${s.known===false?'<span class="note">'+t("This server has no default for it")+'</span>':escHtml(s.default||"")}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="card view">
    <p class="note">${t("Every setting whose value is not the one this version of the server ships with. It is the first thing to look at when a server behaves oddly, and the first thing to put in a support message. A setting whose value is a secret is named here and never shown.")}</p>
    <div class="tablewrap"><table><thead><tr><th>${t("Store")}</th><th>${t("Setting")}</th><th>${t("Value")}</th><th>${t("Shipped default")}</th></tr></thead>
    <tbody>${rows||'<tr><td colspan="4" class="empty">'+t("Nothing has been changed. Every setting on this server is what this version ships with.")+'</td></tr>'}</tbody></table></div>
    <p class="note" style="margin-top:12px">${tf("{0} of {1} settings are not what this version ships with.",settings.length,considered)}</p></div>`;
}

async function renderAudit(){
  const filter=(auditFilter||"").trim();
  const query="?limit="+AUDIT_PAGE+"&offset="+auditOffset+(filter?"&actor="+encodeURIComponent(filter):"");
  const answer=await api("/api/v1/audit"+query);
  const entries=answer.entries||[];
  const total=Number(answer.total)||0;
  // A setting's change carries the value it had, so it can be put back - by
  // a credential that may change settings, as one more row in the trail.
  const canPutBack=e=>e.object_type==="setting"&&(e.action==="updated"||e.action==="deleted")&&may("manage_settings");
  const rows=entries.map(e=>`
    <tr><td>${escHtml(auditWhen(e.time))}</td><td>${escHtml(e.actor||"—")}</td><td>${escHtml(e.interface||"—")}</td>
        <td>${escHtml(e.address||"—")}</td><td>${escHtml(e.object_type||"—")}</td><td>${escHtml(e.object||"—")}</td>
        <td>${escHtml(e.action||"—")}</td><td>${escHtml(e.detail||"")}</td>
        <td>${canPutBack(e)?'<button class="btn ghost sm" data-act="auditrevert" data-id="'+escHtml(e.id)+'">'+t("Put back")+"</button>":""}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="card view">
    <div class="row" style="gap:10px;align-items:center;margin-bottom:12px">
      <input id="auditFilter" placeholder="${t("Filter by administrator or API key")}" value="${escHtml(filter)}" style="flex:1">
      <button class="btn ghost sm" data-act="auditverify">${t("Verify the chain")}</button>
      <button class="btn ghost sm" data-act="auditpage" data-by="-${AUDIT_PAGE}">${t("Newer")}</button>
      <button class="btn ghost sm" data-act="auditpage" data-by="${AUDIT_PAGE}">${t("Older")}</button>
    </div>
    <div class="err" id="err_audit"></div>
    <div class="tablewrap"><table><thead><tr><th>${t("When")}</th><th>${t("Who")}</th><th>${t("Interface")}</th><th>${t("From")}</th>
      <th>${t("Object")}</th><th>${t("Name")}</th><th>${t("Action")}</th><th>${t("Detail")}</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="9" class="empty">'+t("Nothing has been recorded yet. Every administrative change appears here.")+'</td></tr>'}</tbody></table></div>
    <p class="note" style="margin-top:12px">${tf("{0} to {1} of {2}",total?auditOffset+1:0,auditOffset+entries.length,total)}</p></div>`;
  const box=$("#auditFilter");
  if(box)box.onchange=e=>{auditFilter=e.target.value;auditOffset=0;render();};
}
let auditFilter="";
async function revertAuditedChange(id){
  setErr("err_audit","");
  try{
    const answer=await api("/api/v1/audit/"+encodeURIComponent(id)+"/revert",{method:"POST",body:"{}"});
    toast(tf("Put back: {0} is {1} again.",answer.setting||"",answer.value||""));
    render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_audit",refusalText(e));}
}
async function verifyAuditChain(){
  setErr("err_audit","");
  try{
    const answer=await api("/api/v1/audit/verify");
    if(answer.intact)toast(tf("The chain is intact. {0} row(s) checked.",Number(answer.rows_checked)||0));
    else setErr("err_audit",tf("The chain is broken at row {0}. {1}",Number(answer.first_broken_id)||0,answer.reason||""));
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_audit",e.message);}
}
