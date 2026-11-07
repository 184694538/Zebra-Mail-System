/* ---------- Delivery queue ---------- */
async function renderQueue(){
  /* The queue, and beside it what the queue is holding back from: the
     destinations that asked this server to slow down (each with its window
     and the reply that opened it, and a Resume that clears the window now)
     and the connections open under a ceiling. Both from
     /api/v1/queue/shaping, read with the queue. And what is held for a
     sandbox's verdict on its attachments (/api/v1/sandbox/held): listed by
     the queue too, marked held, and drawn in a box of its own with the two
     decisions an administrator can make, since the queue's Retry and Delete
     do not reach a held message. And the IP warm-up's
     schedules (docs/IpWarmup.md) from /api/v1/warmup: per schedule the day it
     is on and, per provider, today's recipients sent against the ceiling and
     deferred over it; Edit and Add open a small editor in this view. The
     queue is drawn whether or not the warm-up can be read: a listing the
     server could not answer is said in the box, and the rest stands. */
  if(editing&&editing.kind==="warmup"){renderWarmupEditor();return;}
  const [q,shaping,sandbox,warmup]=await Promise.all([api("/api/v1/queue"),api("/api/v1/queue/shaping"),api("/api/v1/sandbox/held?limit=1000"),
    api("/api/v1/warmup").catch(e=>{if(e.message==="auth")throw e;return null;})]);
  cache.warmup=(warmup&&warmup.schedules)||[];
  const rows=(q.messages||[]).filter(x=>!x.held).map(x=>`
    <tr><td>${escHtml(x.id)}</td><td>${escHtml(x.from||"—")}</td><td>${escHtml(x.recipients||"—")}</td><td>${escHtml(x.next_try||"—")}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="retry" data-id="${escHtml(x.id)}">${t("Retry now")}</button>
          <button class="btn danger sm" data-act="delmsg" data-id="${escHtml(x.id)}">${t("Delete")}</button>
          <div class="err" id="err_queue_${escHtml(x.id)}"></div></td></tr>`).join("");
  const backoffs=(shaping&&shaping.backoffs)||[];
  const conns=(shaping&&shaping.connections)||{};
  const counts=obj=>Object.keys(obj||{}).map(k=>escHtml(k)+": "+escHtml(String(obj[k]))).join(", ");
  const slowed=backoffs.map(b=>`
    <div class="row" style="justify-content:space-between;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)">
      <div style="flex:1;min-width:0"><b style="word-break:break-all">${escHtml(b.destination||"")}</b>${b.probing?' <span class="badge info">'+t("probing")+'</span>':""}
        <div class="hint">${escHtml(tf("Since {0}, until {1}; window {2} min; {3} deferred",b.since||"",b.until||"",b.window_minutes||0,b.deferred||0))}</div>
        <div class="hint"><code>${escHtml(b.reply||"")}</code>${b.host?' <span class="muted">'+escHtml(b.host)+'</span>':""}</div>
        <div class="err" id="err_shaping_${escHtml(b.destination||"")}"></div></div>
      ${may("manage_queue")?`<button class="btn ghost sm" data-act="shresume" data-id="${escHtml(b.destination||"")}">${t("Resume")}</button>`:""}</div>`).join("");
  /* The machine words the list answers with, in the reader's language. */
  const sbWords={not_submitted:t("not submitted yet"),submitted:t("submitted, waiting for the verdict"),answered:t("answered"),not_submittable:t("not submitted: too large or unreadable"),clean:t("clean"),malicious:t("malicious"),suspicious:t("suspicious"),error:t("error")};
  const sbWord=w=>escHtml(sbWords[w]||w||"");
  const file=f=>`<div class="hint"><code style="word-break:break-all">${escHtml(f.filename||"")}</code> ${sbWord(f.state)}${f.verdict?" · "+sbWord(f.verdict)+" "+escHtml(String(f.score||0)):""}${f.submission?" · "+escHtml(f.submission):""}${f.errors?" · "+escHtml(String(f.errors))+" ✗":""}</div>`;
  const heldTotal=(sandbox&&typeof sandbox.total==="number")?sandbox.total:asList(sandbox,"messages").length;
  const heldShown=asList(sandbox,"messages").length;
  const held=asList(sandbox,"messages").map(m=>`
    <div class="row" style="justify-content:space-between;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)">
      <div style="flex:1;min-width:0"><b>${escHtml(String(m.queue_id))}</b> <span style="word-break:break-all">${escHtml(m.from||"—")} → ${escHtml(m.recipients||"—")}</span>
        <div class="hint">${escHtml(tf("Held for {0} s; {1} file(s)",m.held_seconds||0,(m.files||[]).length))}</div>
        ${(m.files||[]).map(file).join("")}
        <div class="err" id="err_sandbox_${escHtml(String(m.queue_id))}"></div></div>
      ${may("manage_queue")?`<div style="white-space:nowrap"><button class="btn ghost sm" data-act="sbrelease" data-id="${escHtml(String(m.queue_id))}">${t("Release")}</button>
        <button class="btn danger sm" data-act="sbdiscard" data-id="${escHtml(String(m.queue_id))}">${t("Discard")}</button></div>`:""}</div>`).join("");
  $("#content").innerHTML=`<div class="view"><div class="card view">
    <div class="tablewrap"><table><thead><tr><th>${t("ID")}</th><th>${t("From")}</th><th>${t("To")}</th><th>${t("Next try")}</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="5" class="empty">'+t("The delivery queue is empty. ✦")+'</td></tr>'}</tbody></table></div></div>
    <div class="sect"><h2>${t("Slowed destinations")}</h2><div class="card flat">
      <p class="note">${t("A destination that answered a slow-down reply - a 421, a rate-limit code or words to that effect - is not connected to until its window ends; then one delivery probes it, and the same answer doubles the window. Resume clears the window now.")}</p>
      ${slowed||'<div class="empty">'+t("No destination has asked this server to slow down.")+'</div>'}
      <div class="hint">${t("Connections in use when the page was drawn")} — ${t("destinations")}: ${counts(conns.destinations)||"—"}; ${t("tenants")}: ${counts(conns.tenants)||"—"}</div>
    </div></div>
    <div class="sect"><h2>${t("Held for a sandbox")}</h2><div class="card flat">
      <p class="note">${t("A message with an attachment of a submitted type waits here - in no mailbox and not in the quarantine - until the sandbox has answered for each file: clean is delivered, malicious is quarantined. Release delivers it now without the verdict; Discard deletes it and tells nobody.")}</p>
      ${held||'<div class="empty">'+t("Nothing is held for a sandbox.")+'</div>'}
      ${heldTotal>heldShown?'<div class="hint">'+escHtml(tf("{0} of {1} held messages are shown, oldest first.",heldShown,heldTotal))+'</div>':""}
    </div></div>
    <div class="sect"><h2>${t("Warm-up")}</h2><div class="card flat" id="warmupBox">
      <p class="note">${t("A schedule holds a new outbound address to a daily ceiling of recipients at each large provider, rising day by day. The queue sends up to the ceiling and holds the rest: once the day's ceiling is reached, usually until the next UTC day; while deliveries in progress hold the room, a few minutes. The log says when each is tried again. The counts are today's.")}</p>
      ${warmup?(cache.warmup.map(warmupEntry).join("")||'<div class="empty">'+t("No outbound address is being warmed up.")+'</div>'):'<div class="err" id="err_warmup">'+t("The warm-up schedules could not be read; the rest of the page is shown.")+'</div>'}
      ${may("manage_queue")?`<div class="row" style="margin-top:12px"><button class="btn" data-act="warmnew">${t("Add a schedule")}</button></div>`:""}
    </div></div></div>`;
}
async function sandboxAct(id,release){
  if(!await deckConfirm(release?tf("Deliver message {0} now, without the sandbox's verdict?",id):tf("Discard message {0}? It is deleted and nobody is told.",id)))return;
  try{
    await api("/api/v1/sandbox/held/"+encodeURIComponent(id)+(release?"/release":""),{method:release?"POST":"DELETE",body:release?"{}":undefined});
    toast(release?t("Released to the delivery queue"):t("Discarded"));
    renderQueue();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_sandbox_"+id,e.message);}
}
/* One warm-up schedule in the queue view: its address, plan and day, a
   warning when SMTPDeliveryBindToIP does not bind the address as a delivery
   reads it, and one line per provider - sent of the ceiling, and what was
   deferred over it. */
const WARMUP_PROVIDERS={google:"Google",microsoft:"Microsoft",yahoo:"Yahoo",apple:"Apple",proton:"Proton"};
const warmupPlanName=p=>p==="gentle"?t("Gentle"):p==="fast"?t("Fast"):t("Standard");
function warmupEntry(s){
  const lines=(s.providers||[]).map(p=>{
    const name=WARMUP_PROVIDERS[p.provider]||t("Other providers");
    const ceiling=p.ceiling===null||p.ceiling===undefined?t("no ceiling"):String(p.ceiling);
    return `<div class="hint" data-provider="${escHtml(p.provider)}"><b>${escHtml(name)}</b>: ${escHtml(String(p.sent||0))} / ${escHtml(ceiling)}${p.deferred?" · "+escHtml(tf("{0} deferred",p.deferred)):""}</div>`;
  }).join("");
  return `<div class="row" style="justify-content:space-between;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line)">
      <div style="flex:1;min-width:0"><b style="word-break:break-all">${escHtml(s.address||"")}</b> <span class="badge info">${escHtml(warmupPlanName(s.plan))}</span>${s.enabled?"":' <span class="badge warn">'+t("Disabled")+'</span>'}
        <div class="hint">${s.complete?t("The warm-up is complete: nothing is held or counted."):escHtml(tf("Day {0} of {1}",s.day,s.last_day))} · ${escHtml(tf("day 1 was {0}",s.started||""))}</div>
        ${s.in_bind_setting?"":'<div class="hint" data-warn="bind">'+t("SMTPDeliveryBindToIP does not bind this address - a delivery binds only the first entry of each family: unless a global rule binds it, no delivery leaves from it and nothing is counted.")+'</div>'}
        ${lines}</div>
      ${may("manage_queue")?`<button class="btn ghost sm" data-act="warmedit" data-id="${escHtml(String(s.id))}">${t("Edit")}</button>`:""}</div>`;
}
function openWarmup(id){
  const existing=(cache.warmup||[]).filter(s=>Number(s.id)===Number(id))[0];
  editing={kind:"warmup",id:existing?Number(existing.id):0,
    values:existing?{address:existing.address,plan:existing.plan,started:existing.started,enabled:!!existing.enabled}:{address:"",plan:"standard",started:"",enabled:true}};
  renderWarmupEditor();
}
function renderWarmupEditor(){
  const v=editing.values;
  const field=(caption,hint,control)=>`<div class="fr"><div class="lab"><b>${caption}</b>${hint?'<div class="hint">'+hint+'</div>':""}</div><div class="ctl">${control}</div></div>`;
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ Delivery queue")}</button>
    <div class="sect"><h2>${editing.id?escHtml(tf("Edit the warm-up of {0}",v.address)):t("New warm-up schedule")}</h2>
      <div class="card flat"><div class="form">
        ${field(t("Outbound address"),t("The IPv4 or IPv6 address mail leaves from. It must be configured on this host and named by SMTPDeliveryBindToIP or a rule; the server cannot check the first."),`<input id="warm_address" value="${escHtml(v.address||"")}"${editing.id?" readonly":""}>`)}
        ${field(t("Plan"),t("Standard rises over 30 days; gentle has half of each ceiling over 60; fast has twice each over 15. Every other provider gets five times the ceiling."),
          `<select id="warm_plan"><option value="standard">${t("Standard")}</option><option value="gentle">${t("Gentle")}</option><option value="fast">${t("Fast")}</option></select>`)}
        ${field(t("Day 1"),t("The UTC date the warm-up began, YYYY-MM-DD: today or earlier. Empty is today."),`<input id="warm_started" value="${escHtml(v.started||"")}">`)}
        ${field(t("Enabled"),"",`<input type="checkbox" id="warm_enabled"${v.enabled?" checked":""}>`)}
      </div></div></div>
    <div class="sect"><div class="row">
      <button class="btn" data-act="warmsave">${t("Save schedule")}</button>
      ${editing.id?`<button class="btn danger" data-act="warmdel" data-id="${escHtml(String(editing.id))}">${t("Delete")}</button>`:""}
      <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
      <div class="err" id="err_warmedit"></div>
    </div></div></div>`;
  $("#warm_plan").value=v.plan||"standard";
}
async function saveWarmup(){
  setErr("err_warmedit","");
  const address=$("#warm_address").value.trim();
  if(!address){setErr("err_warmedit",t("An outbound address is required."));return;}
  /* A PUT leaves the address out - the server refuses a change to it - and
     says Day 1 always: an emptied field is today, as the hint says, where a
     field left out of a PUT would keep the start it had. */
  const body={plan:$("#warm_plan").value,enabled:!!$("#warm_enabled").checked};
  if(!editing.id)body.address=address;
  const started=$("#warm_started").value.trim();
  if(started)body.started=started;
  else if(editing.id)body.started=new Date().toISOString().slice(0,10);
  try{
    if(editing.id)await api("/api/v1/warmup/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/warmup",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("Warm-up schedule saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_warmedit",e.message);}
}
async function deleteWarmup(id){
  if(!await deckConfirm(tf("Delete the warm-up schedule for {0}? Its counts go with it, and the address is no longer held.",editing.values.address)))return;
  setErr("err_warmedit","");
  try{
    await api("/api/v1/warmup/"+id,{method:"DELETE"});
    editing=null;toast(t("Warm-up schedule deleted"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_warmedit",e.message);}
}
async function resumeDestination(destination){
  if(!await deckConfirm(tf("Resume deliveries to {0} now? The next slow-down reply opens a new window.",destination)))return;
  try{await api("/api/v1/queue/shaping/"+encodeURIComponent(destination),{method:"DELETE"});toast(t("Back-off cleared"));renderQueue();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_shaping_"+destination,e.message);}
}
async function retryMsg(id){
  try{await api("/api/v1/queue/"+encodeURIComponent(id)+"/retry",{method:"POST"});toast(t("Delivery retriggered"));renderQueue();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_queue_"+id,e.message);}
}
async function delMsg(id){
  if(!await deckConfirm(tf("Remove message {0} from the queue?",id)))return;
  try{await api("/api/v1/queue/"+encodeURIComponent(id),{method:"DELETE"});toast(t("Message removed"));renderQueue();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_queue_"+id,e.message);}
}

/* ---------- DANE / TLSA ---------- */
async function renderTlsa(){
  const answer=await api("/api/v1/tlsa");
  const recs=(answer.records||[]).map(r=>r.record||JSON.stringify(r)).join("\n");
  $("#content").innerHTML=`<div class="view">
    <div class="card"><p class="note">
      ${t("Publish-ready DANE TLSA records for your certificates. Add these to DNS (with DNSSEC) to enable DANE validation by sending servers.")}</p>
      <pre id="tlsaPre">${escHtml(recs||t("No TLSA records available — assign an SSL certificate first."))}</pre>
      <div style="margin-top:12px"><button class="btn ghost sm" data-act="copy">${t("Copy all")}</button></div>
    </div></div>`;
}

/* ---------- API keys ----------
   The credentials other programs hold: listed without their tokens, made with
   a scope or a role and the domains they may reach, revoked. The token is
   shown once, when it is made, and never again - which is what the route does. */
let apiKeyToken="";
async function renderApiKeys(){
  const answer=await api("/api/v1/apikeys");
  const keys=asList(answer,"keys");
  const rows=keys.map(k=>`
    <tr><td>${escHtml(k.label||"")}${k.expired?' <span class="badge warn">'+t("Expired")+'</span>':""}</td>
        <td>${escHtml(k.role||k.scope||"")}</td>
        <td>${escHtml(k.domains||t("every domain"))}</td>
        <td>${escHtml(k.expires||"—")}</td>
        <td>${escHtml(k.allowed_from||t("anywhere"))}</td>
        <td>${k.send_from?escHtml(k.send_from)+(k.send_per_minute||k.send_per_day?'<br><span class="note">'+escHtml(tf("{0} a minute, {1} a day",k.send_per_minute||0,k.send_per_day||0))+'</span>':""):t("does not send")}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn danger sm" data-act="keyrevoke" data-id="${escHtml(k.id)}" data-label="${escHtml(k.label||"")}">${t("Revoke")}</button></td></tr>`).join("");
  const token=apiKeyToken?`<div class="card" style="margin-bottom:14px"><h3>${t("Your new key")}</h3>
      <p class="note">${t("Copy it now: the server keeps only a hash, and it is not shown again.")}</p>
      <pre id="keyToken">${escHtml(apiKeyToken)}</pre>
      <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-act="keycopy">${t("Copy the key")}</button><button class="btn quiet sm" data-act="keyhide">${t("Hide it")}</button></div></div>`:"";
  $("#content").innerHTML=`<div class="view">${token}
    <div class="card flat"><h3>${t("Make a key")}</h3>
      <p class="note">${escHtml(uiDocText(operation("/api/v1/apikeys","post").description||""))}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input id="key_label" placeholder="${t("Label")}" maxlength="64" style="flex:1 1 200px">
        <select id="key_scope" title="${t("Scope")}"><option value="full">${t("Full access")}</option><option value="readonly">${t("Read-only")}</option></select>
        <input id="key_role" placeholder="${t("Role (optional)")}" style="flex:1 1 140px">
        <input id="key_domains" placeholder="${t("Domains, comma-separated (empty: all)")}" style="flex:2 1 220px">
        <input id="key_expires" placeholder="${t("Expires (YYYY-MM-DD, optional)")}" style="flex:1 1 180px">
        <input id="key_allowed" placeholder="${t("Allowed from (addresses or CIDR, optional)")}" style="flex:2 1 220px">
        <input id="key_send_from" placeholder="${t("Sends as (address or *@domain, optional)")}" style="flex:2 1 220px">
        <input id="key_send_minute" inputmode="numeric" placeholder="${t("Sends a minute (0: the server's limits)")}" style="flex:1 1 180px">
        <input id="key_send_day" inputmode="numeric" placeholder="${t("Sends a day (0: the server's limits)")}" style="flex:1 1 180px">
        <button class="btn" data-act="keynew">${t("Make the key")}</button>
      </div>
      <div class="err" id="err_keys" style="margin-top:10px"></div>
    </div>
    <div class="card view" style="margin-top:14px">
      <div class="tablewrap"><table><thead><tr><th>${t("Label")}</th><th>${t("Scope or role")}</th><th>${t("Domains")}</th><th>${t("Expires")}</th><th>${t("Allowed from")}</th><th>${t("The key sends as")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" class="empty">'+t("No API keys. Make one above for a program that should reach this server without the administrator password.")+'</td></tr>'}</tbody></table></div>
    </div></div>`;
}
async function createApiKey(){
  setErr("err_keys","");
  const body={label:$("#key_label").value.trim(),scope:$("#key_scope").value};
  if($("#key_role").value.trim())body.role=$("#key_role").value.trim();
  if($("#key_domains").value.trim())body.domains=$("#key_domains").value.trim();
  if($("#key_expires").value.trim())body.expires=$("#key_expires").value.trim();
  if($("#key_allowed").value.trim())body.allowed_from=$("#key_allowed").value.trim();
  if($("#key_send_from").value.trim())body.send_from=$("#key_send_from").value.trim();
  if(!body.label){setErr("err_keys",t("Give the key a label."));return;}
  // The key's own sending ceilings (docs/SendApi.md): whole numbers, sent as
  // numbers, and only beside a sender - the route refuses them without one.
  for(const [field,name] of [["key_send_minute","send_per_minute"],["key_send_day","send_per_day"]]){
    const text=$("#"+field).value.trim();
    if(!text)continue;
    if(!/^[0-9]{1,9}$/.test(text)){setErr("err_keys",t("The sends a minute and a day are whole numbers."));return;}
    body[name]=Number(text);
  }
  try{
    const made=await api("/api/v1/apikeys",{method:"POST",body:JSON.stringify(body)});
    apiKeyToken=made.key||made.token||"";
    toast(t("Key made"));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_keys",e.message);}
}
async function revokeApiKey(id,label){
  if(!await deckConfirm(tf("Revoke the key {0}? Programs holding it are refused from now on.",label||id)))return;
  setErr("err_keys","");
  try{await api("/api/v1/apikeys/"+encodeURIComponent(id),{method:"DELETE"});toast(t("Key revoked"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_keys",e.message);}
}

/* ---------- Passkeys ----------
   The administrator's own WebAuthn credentials: made here while signed in with
   the administrator password, and used at the sign-in card instead of it. The
   browser does the cryptography; this page carries base64url both ways and
   nothing else. A browser without WebAuthn, or a page not served over HTTPS,
   says so rather than offering a button that cannot work. */
function passkeysHere(){
  try{return !!(window.PublicKeyCredential&&navigator.credentials&&navigator.credentials.create);}catch(_){return false;}
}
function fromB64u(text){
  const padded=String(text||"").replace(/-/g,"+").replace(/_/g,"/")+"===".slice((String(text||"").length+3)%4);
  const raw=atob(padded),bytes=new Uint8Array(raw.length);
  for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
  return bytes;
}
function toB64u(buffer){
  const bytes=new Uint8Array(buffer);let text="";
  for(let i=0;i<bytes.length;i++)text+=String.fromCharCode(bytes[i]);
  return btoa(text).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function whenSeconds(seconds){
  if(!Number(seconds))return "\u2014";
  try{return new Date(Number(seconds)*1000).toLocaleString();}catch(_){return String(seconds);}
}
async function renderPasskeys(){
  const answer=await api("/api/v1/passkeys");
  const list=asList(answer,"passkeys");
  const rows=list.map(p=>`
    <tr><td>${escHtml(p.name||"")}</td>
        <td>${escHtml(whenSeconds(p.created))}</td>
        <td>${escHtml(whenSeconds(p.last_used))}</td>
        <td>${escHtml(p.transports||"")}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn danger sm" data-act="passkeydel" data-id="${escHtml(p.id)}" data-name="${escHtml(p.name||"")}">${t("Remove")}</button></td></tr>`).join("");
  const warning=!passkeysHere()
    ?'<div class="note">'+t("This browser cannot make a passkey: it does not offer WebAuthn, or the page was not opened over HTTPS.")+'</div>'
    :(answer.enabled===false?'<div class="note">'+t("Passkeys are switched off on this server.")+'</div>':"");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat"><h3>${t("Add a passkey")}</h3>
      <p class="note">${t("A passkey signs the administrator in with this device - its fingerprint reader, its face or its PIN - instead of the administrator password. The key stays on the device and never reaches this server.")}</p>
      <p class="note">${t("Adding one asks for the administrator password again, so a session somebody else is holding cannot add a way in that outlives it.")}</p>
      ${warning}
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input id="pk_name" placeholder="${t("What the device is called")}" maxlength="255" style="flex:1 1 200px">
        <input id="pk_pass" type="password" placeholder="${t("The administrator password")}" autocomplete="current-password" style="flex:1 1 200px">
        <input id="pk_otp" placeholder="${t("One-time code")}" inputmode="numeric" autocomplete="one-time-code" style="flex:0 1 140px">
        <button class="btn" data-act="passkeynew">${t("Add a passkey")}</button>
      </div>
      <div class="err" id="err_passkeys" style="margin-top:10px"></div>
    </div>
    <div class="card view" style="margin-top:14px">
      <div class="tablewrap"><table><thead><tr><th>${t("Device")}</th><th>${t("Added")}</th><th>${t("Last used")}</th><th>${t("Reached by")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="5" class="empty">'+t("No passkeys yet. Add one for this device and sign in with it next time.")+'</td></tr>'}</tbody></table></div>
    </div></div>`;
}
async function createPasskey(){
  setErr("err_passkeys","");
  if(!passkeysHere()){setErr("err_passkeys",t("This browser cannot make a passkey: it does not offer WebAuthn, or the page was not opened over HTTPS."));return;}
  const name=$("#pk_name").value.trim(),password=$("#pk_pass").value,code=$("#pk_otp").value.trim();
  if(!name){setErr("err_passkeys",t("Give the device a name."));return;}
  const headers=code?{"X-hMailServer-OTP":code}:{};
  try{
    const options=await api("/api/v1/passkeys/options",{method:"POST",body:"{}",headers:headers});
    const made=await navigator.credentials.create({publicKey:{
      challenge:fromB64u(options.challenge),
      rp:options.rp,
      user:{id:fromB64u(options.user.id),name:options.user.name,displayName:options.user.displayName},
      pubKeyCredParams:options.pubKeyCredParams,
      timeout:options.timeout,
      attestation:options.attestation,
      authenticatorSelection:options.authenticatorSelection,
      excludeCredentials:(options.excludeCredentials||[]).map(c=>({type:c.type,id:fromB64u(c.id)}))
    }});
    const body={name:name,password:password,credential:{id:made.id,response:{
      clientDataJSON:toB64u(made.response.clientDataJSON),
      attestationObject:toB64u(made.response.attestationObject),
      transports:(made.response.getTransports?made.response.getTransports():[])||[]
    }}};
    await api("/api/v1/passkeys",{method:"POST",body:JSON.stringify(body),headers:headers});
    toast(t("Passkey added"));
    await render();
  }catch(e){
    if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    setErr("err_passkeys",e.message||t("That did not work. Sign in with the administrator password."));
  }
}
async function removePasskey(id,name){
  if(!await deckConfirm(tf("Remove the passkey {0}? That device will no longer sign you in.",name||id)))return;
  setErr("err_passkeys","");
  try{await api("/api/v1/passkeys/"+encodeURIComponent(id),{method:"DELETE"});toast(t("Passkey removed"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_passkeys",e.message);}
}
/* The sign-in card's other two ways in. Both are asked for before anybody has
   signed in, and neither carries a credential: /api/v1/signin-methods says
   whether to draw the buttons, and the passkey challenge is random bytes. */
async function passkeySignIn(){
  $("#loginErr").textContent="";
  try{
    const offered=await fetch("/api/v1/passkeys/challenge",{method:"POST",headers:{"X-Requested-With":"hMailServer"},credentials:"same-origin"});
    if(!offered.ok)throw new Error(t("That did not work. Sign in with the administrator password."));
    const challenge=JSON.parse(await offered.text());
    const assertion=await navigator.credentials.get({publicKey:{
      challenge:fromB64u(challenge.challenge),
      rpId:challenge.rp_id,
      timeout:challenge.timeout,
      /* Required, not preferred: the server refuses an assertion whose
         authenticator did not verify the person, because a passkey stands in
         for the one-time code only when it did. Asking here means the device
         asks for the PIN rather than the person being refused afterwards. */
      userVerification:"required",
      allowCredentials:[]
    }});
    const body={passkey:{id:assertion.id,response:{
      clientDataJSON:toB64u(assertion.response.clientDataJSON),
      authenticatorData:toB64u(assertion.response.authenticatorData),
      signature:toB64u(assertion.response.signature),
      userHandle:assertion.response.userHandle?toB64u(assertion.response.userHandle):""
    }}};
    const res=await fetch("/api/v1/session",{method:"POST",headers:{"X-Requested-With":"hMailServer","Content-Type":"application/json"},body:JSON.stringify(body),credentials:"same-origin"});
    if(res.status!==201)throw new Error(t("That did not work. Sign in with the administrator password."));
    try{sessionStorage.setItem("hmsSession","1");}catch(_){}
    await startDeck();
  }catch(e){
    $("#loginErr").textContent=e.message||t("That did not work. Sign in with the administrator password.");
  }
}
async function loadSignInMethods(){
  try{
    const res=await fetch("/api/v1/signin-methods",{credentials:"same-origin"});
    if(!res.ok)return;
    const methods=JSON.parse(await res.text());
    $("#passkeyBtn").hidden=!(methods.passkeys&&passkeysHere());
    if(methods.oidc){$("#ssoBtn").textContent=tf("Sign in with {0}",methods.oidc_label||"");}
    $("#ssoBtn").hidden=!methods.oidc;
    /* A SAML identity provider is a button of its own beside the OpenID Connect
       one, with words of its own (saml_button_label) so the two never read
       alike: the default said in the reader's language, anything else as
       written. It comes back with the same ticket, read by singleSignOnReturn. */
    if(methods.saml){const samlLabel=String(methods.saml_label||"");$("#samlBtn").textContent=(samlLabel===""||samlLabel==="Sign in with SAML")?tf("Sign in with {0}","SAML"):samlLabel;}
    $("#samlBtn").hidden=!methods.saml;
  }catch(_){/* the password is always there */}
}
/* A sign-in this tab started at an identity provider, and when. The fragment
   is whatever the address bar holds, and any link can put one there, so the
   server's sentence about a sign-in that did not complete is shown only to a
   tab that went to the identity provider in the last hour, and inside a
   sentence of the page's own. An hour, not the ten minutes a sign-in lives on
   the server: a slower return is answered with the server's own sentence that
   the sign-in took longer than ten minutes, and that is one this tab must
   show. The mark is spent by the next load of this page, whatever its address
   holds, so a sign-in abandoned at the identity provider leaves none behind.
   The webmail reads the same mark under the same name: the server sends a
   sign-in it no longer knows there, whichever page started it. */
const SSO_PENDING="hmsSsoPending",SSO_PENDING_MS=60*60*1000;
function markSsoPending(){try{sessionStorage.setItem(SSO_PENDING,String(Date.now()));}catch(_){}}
function takeSsoPending(){
  let at=0;
  try{at=Number(sessionStorage.getItem(SSO_PENDING))||0;sessionStorage.removeItem(SSO_PENDING);}catch(_){at=0;}
  const age=Date.now()-at;
  return at>0&&age>=0&&age<=SSO_PENDING_MS;
}
/* The identity provider sent the browser back with a one-use ticket in the
   fragment, or with a sentence saying why it did not. The fragment is taken out
   of the address first, so a reload cannot try to spend a ticket twice. */
async function singleSignOnReturn(){
  const hash=String(location.hash||"");
  const ticket=/^#sso=([A-Za-z0-9_-]+)$/.exec(hash);
  const failed=/^#sso_error=(.*)$/.exec(hash);
  if(!ticket&&!failed){takeSsoPending();return false;}
  try{history.replaceState(null,"",location.pathname);}catch(_){location.hash="";}
  const started=takeSsoPending();
  /* decodeURIComponent throws on a broken escape, and the fragment is whatever
     the address bar holds: a crafted link must not be able to reject this
     promise and leave the resumed session unstarted. */
  if(failed){
    if(!started)return false;
    let sentence;
    try{sentence=decodeURIComponent(String(failed[1]).replace(/\+/g," "));}
    catch(_){sentence=String(failed[1]).replace(/\+/g," ");}
    $("#loginErr").textContent=tf("Single sign-on did not complete: {0}",sentence.slice(0,400));
    return false;
  }
  try{
    const res=await fetch("/api/v1/session",{method:"POST",headers:{"X-Requested-With":"hMailServer","Content-Type":"application/json"},body:JSON.stringify({sso_ticket:ticket[1]}),credentials:"same-origin"});
    if(res.status!==201)throw new Error(t("That did not work. Sign in with the administrator password."));
    try{sessionStorage.setItem("hmsSession","1");}catch(_){}
    await startDeck();
    return true;
  }catch(e){$("#loginErr").textContent=e.message||"";return false;}
}
$("#passkeyBtn").onclick=()=>{passkeySignIn();};
$("#ssoBtn").onclick=()=>{markSsoPending();location.href="/portal/oidc/start?deck=1";};
$("#samlBtn").onclick=()=>{markSsoPending();location.href="/portal/saml/start?deck=1";};

