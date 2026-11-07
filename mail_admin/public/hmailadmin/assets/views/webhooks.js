/* ---------- Inbound webhooks ----------
   The other direction: an address, or a whole domain, whose mail this server
   posts to a URL (docs/InboundWebhooks.md). The routes, what each does with the
   mailbox, and its queue in words; below them the last deliveries, with the
   reason one has not arrived, and - for a message the endpoint never accepted
   and the server kept - Retry, Download and Remove.

   The editor is built from the schema of POST /api/v1/inbound-webhooks, as the
   outbound webhooks' is, so its fields, their choices and their help are the
   server's own words, and the secret is a write-only box. What a role may do is
   what it is offered: view_configuration reads, manage_inbound_webhooks acts,
   and the download needs view_mailbox beside it, as the route does. */
const INBOUND_DELIVERIES=25;
let inboundHooks=[];
function inboundStateWord(word){
  if(word==="delivered")return t("delivered");
  if(word==="kept")return t("kept");
  if(word==="bounced")return t("bounced");
  return t("pending");
}
function inboundQueueText(h){
  const parts=[];
  if(Number(h.pending))parts.push(tf("{0} waiting",Number(h.pending)));
  if(Number(h.delivered))parts.push(tf("{0} sent",Number(h.delivered)));
  if(Number(h.kept))parts.push(tf("{0} kept",Number(h.kept)));
  if(Number(h.bounced))parts.push(tf("{0} returned",Number(h.bounced)));
  return parts.length?parts.join(", "):t("nothing yet");
}
async function renderInboundWebhooks(){
  await loadSpec();
  inboundHooks=asList(await api("/api/v1/inbound-webhooks"),"inbound_webhooks");
  if(editing&&editing.kind==="inboundwebhook"){renderInboundWebhookEditor();return;}
  const queue=asList(await api("/api/v1/inbound-webhooks/deliveries?limit="+INBOUND_DELIVERIES),"deliveries");
  const manage=may("manage_inbound_webhooks");
  const rows=inboundHooks.map(h=>`
    <tr><td><b>${escHtml(h.address)}</b>${h.enabled?"":' <span class="badge warn">'+t("Off")+'</span>'}
            <span class="badge info">${h.deliver?t("posted and delivered"):t("posted only")}</span>
            <div class="hint muted"><code>${escHtml(h.url)}</code></div></td>
        <td>${escHtml(inboundQueueText(h))}</td>
        <td style="text-align:right;white-space:nowrap">${manage?`
          <button class="btn ghost sm" data-act="inhookedit" data-id="${escHtml(h.address)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="inhookdel" data-id="${escHtml(h.address)}">${t("Delete")}</button>`:""}
          <div class="err" id="err_inhook_${escHtml(h.address)}"></div></td></tr>`).join("");
  const queueRows=queue.map(d=>`
    <tr><td>${escHtml(auditWhen(d.created))}</td><td>${escHtml(d.route||"—")}</td>
        <td style="word-break:break-all">${escHtml(d.recipients||"")}</td>
        <td>${escHtml(inboundStateWord(d.state))}</td><td>${escHtml(String(d.attempts||0))}</td>
        <td>${escHtml(d.error||"")}<div class="err" id="err_indel_${escHtml(d.id)}"></div></td>
        <td style="text-align:right;white-space:nowrap">${d.message_kept&&may("view_mailbox")?`<a class="btn ghost sm" href="#" data-api-download="/api/v1/inbound-webhooks/deliveries/${encodeURIComponent(d.id)}/message" download="inbound-webhook-delivery-${escHtml(d.id)}.eml">${t("Download")}</a>`:""}${manage&&d.message_kept&&(d.state==="kept"||d.state==="pending")?`
          <button class="btn ghost sm" data-act="inhookretry" data-id="${escHtml(d.id)}">${t("Retry")}</button>`:""}${manage?`
          <button class="btn danger sm" data-act="inhookdrop" data-id="${escHtml(d.id)}">${t("Remove")}</button>`:""}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/inbound-webhooks","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Address")}</th><th>${t("Queue")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="3" class="empty">'+t("No address or domain is routed to a URL, so every message goes to a mailbox as it always has.")+'</td></tr>'}</tbody></table></div>
      ${manage?`<div class="row" style="margin-top:16px">
        <button class="btn" data-act="inhooknew">${t("Add an inbound webhook")}</button>
        ${!confined?`<button class="btn ghost" data-act="inhookrun">${t("Run a delivery pass")}</button>`:""}
        <div class="err" id="err_inhooks"></div>
      </div>`:""}
    </div>
    <div class="sect"><h2>${t("Recent deliveries")}</h2>
      <div class="card flat">
        <div class="tablewrap"><table><thead><tr><th>${t("When")}</th><th>${t("Address")}</th><th>${t("Recipients")}</th>
          <th>${t("State")}</th><th>${t("Attempts")}</th><th>${t("Error")}</th><th></th></tr></thead>
        <tbody>${queueRows||'<tr><td colspan="7" class="empty">'+t("Nothing has been queued yet.")+'</td></tr>'}</tbody></table></div>
      </div></div></div>`;
}
function openInboundWebhook(address){
  const existing=inboundHooks.filter(h=>h.address===address)[0];
  const values=existing
    ? JSON.parse(JSON.stringify(existing))
    : documentedDefaults("/api/v1/inbound-webhooks","post",properties("/api/v1/inbound-webhooks","post"));
  editing={kind:"inboundwebhook",id:address||"",values:values};
  renderInboundWebhookEditor();
}
function inboundWebhookFormOptions(){
  return {required:requiredOf("/api/v1/inbound-webhooks","post"),
          skip:editing.id?["address"]:[],
          passwordHint:t("left unchanged unless filled")};
}
function renderInboundWebhookEditor(){
  const props=properties("/api/v1/inbound-webhooks","post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All inbound webhooks")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit the inbound webhook for {0}",escHtml(editing.id)):t("New inbound webhook")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation(editing.id?"/api/v1/inbound-webhooks/{address}":"/api/v1/inbound-webhooks",editing.id?"put":"post").description||""))}</p>
        <div class="form">${formHtml("inhook",props,editing.values,inboundWebhookFormOptions())}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="inhooksave">${t("Save the inbound webhook")}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_inhookedit"></div>
        </div>
      </div></div></div>`;
}
async function saveInboundWebhook(){
  setErr("err_inhookedit","");
  const props=properties("/api/v1/inbound-webhooks","post");
  let body;
  try{body=readForm("inhook",props,inboundWebhookFormOptions());}catch(e){setErr("err_inhookedit",e.message);return;}
  try{
    if(editing.id)await api("/api/v1/inbound-webhooks/"+encodeURIComponent(editing.id),{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/inbound-webhooks",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("Inbound webhook saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_inhookedit",e.message);}
}
async function deleteInboundWebhook(address){
  if(!await deckConfirm(tf("Remove the inbound webhook for {0}? The messages its queue still holds go with it.",address)))return;
  setErr("err_inhook_"+address,"");
  try{await api("/api/v1/inbound-webhooks/"+encodeURIComponent(address),{method:"DELETE"});toast(t("Inbound webhook removed"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_inhook_"+address,e.message);}
}
async function runInboundWebhookPass(){
  setErr("err_inhooks","");
  try{
    const answer=await api("/api/v1/inbound-webhooks/run",{method:"POST",body:"{}"});
    toast(tf("{0} delivered, {1} removed",Number(answer.delivered)||0,Number(answer.removed)||0));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_inhooks",e.message);}
}
async function retryInboundDelivery(id){
  setErr("err_indel_"+id,"");
  try{
    await api("/api/v1/inbound-webhooks/deliveries/"+encodeURIComponent(id)+"/retry",{method:"POST",body:"{}"});
    toast(t("Queued again"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_indel_"+id,e.message);}
}
async function deleteInboundDelivery(id){
  if(!await deckConfirm(t("Remove this delivery and the message it kept?")))return;
  setErr("err_indel_"+id,"");
  try{
    await api("/api/v1/inbound-webhooks/deliveries/"+encodeURIComponent(id),{method:"DELETE"});
    toast(t("Delivery removed"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_indel_"+id,e.message);}
}

/* ---------- Webhooks ----------
   Which other programs are told what this server's mail does. A subscription is
   an endpoint, a shared secret, the events it wants and the domains and
   addresses it is confined to; the queue below the list is what has been sent to
   them and what is still owed.

   The editor is built from the schema of POST /api/v1/webhooks, as the routes'
   and the ports' are, so a field the record gains appears here without a change
   to this page - and the secret is drawn as a write-only box because the schema
   marks it writeOnly, which is also why leaving it empty on a change keeps the
   one that is set.

   Two buttons do what an administrator does next after configuring one: raise a
   test event through the same path a real one takes, and run a delivery pass
   rather than waiting up to a minute for the scheduled one. */
const WEBHOOK_DELIVERIES=25;
function webhookStateWord(word){
  if(word==="delivered")return t("delivered");
  if(word==="dead-lettered")return t("dead-lettered");
  return t("pending");
}
function webhookQueueText(w){
  const parts=[];
  if(Number(w.pending))parts.push(tf("{0} waiting",Number(w.pending)));
  if(Number(w.delivered))parts.push(tf("{0} sent",Number(w.delivered)));
  if(Number(w.dead_lettered))parts.push(tf("{0} dead-lettered",Number(w.dead_lettered)));
  if(Number(w.dropped))parts.push(tf("{0} dropped",Number(w.dropped)));
  return parts.length?parts.join(", "):t("nothing yet");
}
async function renderWebhooks(){
  await loadSpec();
  const answer=await api("/api/v1/webhooks");
  cache.webhooks=asList(answer,"webhooks");
  if(editing&&editing.kind==="webhook"){renderWebhookEditor();return;}
  const queue=asList(await api("/api/v1/webhooks/deliveries?limit="+WEBHOOK_DELIVERIES),"deliveries");
  const rows=cache.webhooks.map(w=>`
    <tr><td><b>${escHtml(w.name)}</b>${w.enabled?"":' <span class="badge warn">'+t("Off")+'</span>'}
            <div class="hint muted"><code>${escHtml(w.url)}</code></div></td>
        <td>${escHtml(w.events||t("every event"))}</td>
        <td>${escHtml(w.domains||t("every domain"))}${w.addresses?'<div class="hint muted">'+escHtml(w.addresses)+'</div>':""}</td>
        <td>${escHtml(webhookQueueText(w))}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="hookedit" data-id="${escHtml(w.name)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="hookdel" data-id="${escHtml(w.name)}">${t("Delete")}</button>
          <div class="err" id="err_hook_${escHtml(w.name)}"></div></td></tr>`).join("");
  const queueRows=queue.map(d=>`
    <tr><td>${escHtml(auditWhen(d.created))}</td><td>${escHtml(d.webhook||"—")}</td><td><code>${escHtml(d.event)}</code></td>
        <td>${escHtml(webhookStateWord(d.state))}</td><td>${escHtml(String(d.attempts||0))}</td>
        <td>${escHtml(d.error||"")}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/webhooks","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Name")}</th><th>${t("Events")}</th><th>${t("Scope")}</th><th>${t("Queue")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="5" class="empty">'+t("No subscriptions are configured, so no mail event leaves this server.")+'</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px">
        <button class="btn" data-act="hooknew">${t("Add a subscription")}</button>
        <button class="btn ghost" data-act="hooktest">${t("Send a test event")}</button>
        <button class="btn ghost" data-act="hookrun">${t("Run a delivery pass")}</button>
        <div class="err" id="err_hooks"></div>
      </div>
    </div>
    <div class="sect"><h2>${t("Recent deliveries")}</h2>
      <div class="card flat">
        <div class="tablewrap"><table><thead><tr><th>${t("When")}</th><th>${t("Subscription")}</th><th>${t("Event")}</th>
          <th>${t("State")}</th><th>${t("Attempts")}</th><th>${t("Error")}</th></tr></thead>
        <tbody>${queueRows||'<tr><td colspan="6" class="empty">'+t("Nothing has been queued yet.")+'</td></tr>'}</tbody></table></div>
      </div></div></div>`;
}
function openWebhook(name){
  const existing=cache.webhooks.filter(w=>w.name===name)[0];
  const values=existing
    ? JSON.parse(JSON.stringify(existing))
    : documentedDefaults("/api/v1/webhooks","post",properties("/api/v1/webhooks","post"));
  editing={kind:"webhook",id:name||"",values:values};
  renderWebhookEditor();
}
function webhookFormOptions(){
  return {required:requiredOf("/api/v1/webhooks","post"),
          skip:editing.id?["name"]:[],
          passwordHint:t("left unchanged unless filled")};
}
function renderWebhookEditor(){
  const props=properties("/api/v1/webhooks","post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All subscriptions")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit the subscription {0}",escHtml(editing.id)):t("New subscription")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation(editing.id?"/api/v1/webhooks/{name}":"/api/v1/webhooks",editing.id?"put":"post").description||""))}</p>
        <div class="form">${formHtml("hook",props,editing.values,webhookFormOptions())}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="hooksave">${t("Save the subscription")}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_hookedit"></div>
        </div>
      </div></div></div>`;
}
async function saveWebhook(){
  setErr("err_hookedit","");
  const props=properties("/api/v1/webhooks","post");
  let body;
  try{body=readForm("hook",props,webhookFormOptions());}catch(e){setErr("err_hookedit",e.message);return;}
  try{
    if(editing.id)await api("/api/v1/webhooks/"+encodeURIComponent(editing.id),{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/webhooks",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("Subscription saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_hookedit",e.message);}
}
async function deleteWebhook(name){
  if(!await deckConfirm(tf("Delete the subscription {0}?",name)))return;
  setErr("err_hook_"+name,"");
  try{await api("/api/v1/webhooks/"+encodeURIComponent(name),{method:"DELETE"});toast(t("Subscription deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_hook_"+name,e.message);}
}
async function runWebhookPass(){
  setErr("err_hooks","");
  try{
    const answer=await api("/api/v1/webhooks/run",{method:"POST",body:"{}"});
    toast(tf("{0} delivered, {1} removed",Number(answer.delivered)||0,Number(answer.removed)||0));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_hooks",e.message);}
}
async function sendTestWebhook(){
  setErr("err_hooks","");
  try{
    const answer=await api("/api/v1/webhooks/test",{method:"POST",body:"{}"});
    toast(tf("The test event was queued for {0} subscription(s).",Number(answer.queued)||0));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_hooks",e.message);}
}

