/* ---------- Rules ----------
   The rule vocabulary - which words a criterion's field and its match take,
   which action types there are and what parameters each one carries - is in the
   OpenAPI document, but written as prose in the description of POST /api/v1/rules
   rather than as enumerations, so it is read out of that sentence here. The
   fallback below keeps the editor usable if the wording is ever reshaped; if it
   is being used, the document and this page have drifted apart and the document
   is the one to fix. */
const RULE_FALLBACK={
  fields:["from","to","cc","subject","body","message_size","recipient_list","delivery_attempts","attachment_name","sensitive_content","attachment_type","external_recipient","content","header"],
  matches:["equals","not_equals","contains","not_contains","less_than","greater_than","regex","wildcard"],
  actions:{forward:["to"],reply:["from_name","from_address","subject","body"],move_to_folder:["folder"],
    script_function:["script_function"],set_header:["header","value"],send_using_route:["route_id"],
    bind_to_address:["value"],add_disclaimer:["body"],reject:["value"],warn_sender:["value"],require_tls:[],quarantine:[],"delete":[],stop:[],copy:[]}
};
/* Whose rules the page shows: the server's, or one domain's - the same
   documents at /api/v1/domains/{name}/rules, run for that domain's mail after
   the server's. */
let ruleScope="";
function rulesBase(){return ruleScope?"/api/v1/domains/"+encodeURIComponent(ruleScope)+"/rules":"/api/v1/rules";}
function ruleScopeHtml(){
  const options=[`<option value=""${ruleScope?"":" selected"}>${t("The server")}</option>`]
    .concat((cache.domains||[]).map(d=>`<option value="${escHtml(d.name)}"${d.name===ruleScope?" selected":""}>${escHtml(d.name)}</option>`));
  return `<div class="row" style="margin-bottom:12px"><label>${t("Rules of")} <select data-r="rule-scope">${options.join("")}</select></label></div>`;
}
function ruleWords(){
  const text=operation("/api/v1/rules","post").description||"";
  const tokens=s=>String(s).split(/,| and /)
    .map(p=>{const m=/([a-z][a-z0-9_]*)/.exec(p.replace(/^\s*or\s+/,""));return m?m[1]:"";})
    .filter(Boolean);
  const inside=label=>{const m=new RegExp(label+"\\s*\\(([^)]*)\\)").exec(text);return m?tokens(m[1]):[];};
  const fields=inside("field"), matches=inside("match");
  const actions={};
  const m=/the parameters that type takes\s*-\s*([^.]*)\./.exec(text);
  if(m){
    /* An explanation in brackets after a parameter - "value (the text of
       the 550 ...)" - is prose, not parameters; without this its words became
       inputs. */
    m[1].replace(/\([^)]*\)/g,"").split(";").forEach(segment=>{
      const colon=segment.indexOf(":");
      if(colon>=0){
        const type=tokens(segment.slice(0,colon))[0];
        if(type)actions[type]=tokens(segment.slice(colon+1));
      }else if(/takes? none/.test(segment)){
        tokens(segment.replace(/takes? none/,"")).forEach(t=>{actions[t]=[];});
      }
    });
  }
  const words={
    fields:fields.length?fields:RULE_FALLBACK.fields,
    matches:matches.length?matches:RULE_FALLBACK.matches,
    actions:Object.keys(actions).length?actions:RULE_FALLBACK.actions
  };
  words.types=Object.keys(words.actions);
  return words;
}
async function renderRules(){
  await loadSpec();
  if(!cache.domains){try{cache.domains=asList(await api("/api/v1/domains"),"domains");}catch(_){cache.domains=[];}}
  cache.rules=asList(await api(rulesBase()),"rules");
  try{cache.routes=asList(await api("/api/v1/routes"),"routes");}catch(_){cache.routes=[];}
  if(editing&&editing.kind==="rule"){renderRuleEditor();return;}
  const words=ruleWords();
  const criteriaText=r=>(r.criteria||[]).map(c=>
      escHtml(humanise(c.field))+(c.header?" "+escHtml(c.header):"")+" "+escHtml(c.match)+" “"+escHtml(c.value)+"”"
    ).join(" "+(r.all_criteria?t("AND"):t("OR"))+" ")||"—";
  const actionsText=r=>(r.actions||[]).map(a=>{
      // A flag parameter reads as its caption when set and as nothing when not.
      const params=(words.actions[a.type]||[]).map(p=>typeof a[p]==="boolean"?(a[p]?humanise(p):""):a[p]).filter(v=>v!==undefined&&v!=="");
      const detail=params.length?params.join(", "):(a.value||"");
      return escHtml(humanise(a.type))+(detail?" → "+escHtml(detail):"");
    }).join("; ")||"—";
  const rows=cache.rules.map(r=>`
    <tr><td><b>${escHtml(r.name)}</b><div class="hint muted">${tf("id {0}",escHtml(r.id))}</div></td>
        <td>${r.active?'<span class="badge good">'+t("On")+'</span>':'<span class="badge warn">'+t("Off")+'</span>'}</td>
        <td>${criteriaText(r)}</td><td>${actionsText(r)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="ruleedit" data-id="${escHtml(r.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="ruledel" data-id="${escHtml(r.id)}" data-name="${escHtml(r.name)}">${t("Delete")}</button>
          <div class="err" id="err_rule_${escHtml(r.id)}"></div></td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/rules","get").description||""))}</p>
      ${ruleScopeHtml()}
      <div class="tablewrap"><table><thead><tr><th>${t("Rule")}</th><th>${t("Active")}</th><th>${t("When")}</th><th>${t("Then")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="5" class="empty">'+(ruleScope?t("No rules are defined for this domain."):t("No global rules are defined."))+'</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px"><button class="btn" data-act="rulenew">${t("New rule")}</button></div>
    </div></div>`;
}
function openRule(id){
  const existing=cache.rules.filter(r=>Number(r.id)===Number(id))[0];
  const rule=existing
    ? JSON.parse(JSON.stringify(existing))
    : {name:"",active:true,all_criteria:true,criteria:[],actions:[]};
  rule.criteria=rule.criteria||[];rule.actions=rule.actions||[];
  editing={kind:"rule",id:Number(id)||0,rule:rule};
  renderRuleEditor();
}
function renderRuleEditor(){
  const words=ruleWords(), d=editing.rule;
  const routeChoices=[{value:0,label:t("(choose a route)")}].concat(
    cache.routes.map(r=>({value:r.id,label:r.domain_name+" → "+r.target_smtp_host+":"+r.target_smtp_port})));
  const criteria=d.criteria.map((c,i)=>`
    <div class="row erow">
      <select data-r="crit-field" data-i="${i}">${optionsHtml(words.fields,c.field)}</select>
      <input data-r="crit-header" data-i="${i}" placeholder="${t("Header name")}" value="${escHtml(c.header||"")}"${c.field==="header"?"":" hidden"}>
      <select data-r="crit-match" data-i="${i}">${optionsHtml(words.matches,c.match)}</select>
      <input data-r="crit-value" data-i="${i}" placeholder="${t("Value")}" value="${escHtml(c.value||"")}" style="flex:1;min-width:200px">
      <button class="btn ghost sm" data-act="critdel" data-i="${i}">${t("Remove")}</button>
    </div>`).join("")||'<div class="note">'+t("No criteria: the rule matches every message.")+'</div>';
  const actions=d.actions.map((a,i)=>{
    const params=words.actions[a.type]||[];
    const controls=params.map(p=>{
      const value=a[p]!==undefined?a[p]:(params.length===1?(a.value||""):"");
      if(p==="route_id")
        return '<select data-r="act-'+p+'" data-i="'+i+'">'+optionsHtml(routeChoices,value)+'</select>';
      // The one flag among the parameters, with the desktop dialog's caption.
      if(p==="abort_spam_flagged")
        return '<label class="row" style="gap:7px"><input type="checkbox" data-r="act-'+p+'" data-i="'+i+'"'+(value===true?" checked":"")+'> '+t("Abort on messages marked as spam")+'</label>';
      if(p==="body")
        return '<textarea data-r="act-'+p+'" data-i="'+i+'" rows="3" placeholder="'+escHtml(t("Body"))+'" style="flex:1;min-width:240px">'+escHtml(value)+'</textarea>';
      return '<input data-r="act-'+p+'" data-i="'+i+'" placeholder="'+escHtml(humanise(p))+'" value="'+escHtml(value)+'" style="flex:1;min-width:170px">';
    }).join("")||'<span class="muted" style="font-size:12.5px">'+t("This action takes no parameters.")+'</span>';
    return `<div class="row erow">
      <select data-r="act-type" data-i="${i}">${optionsHtml(words.types,a.type)}</select>
      ${controls}
      <button class="btn ghost sm" data-act="actdel" data-i="${i}">${t("Remove")}</button>
    </div>`;
  }).join("")||'<div class="note">'+t("No actions: the rule does nothing.")+'</div>';
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All rules")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit rule {0}",escHtml(editing.id)):t("New rule")}</h2>
      <div class="card flat">
        <div class="row">
          <input id="ruleName" placeholder="${t("Rule name")}" value="${escHtml(d.name||"")}" style="flex:1;min-width:240px">
          <label class="row" style="gap:7px"><input type="checkbox" id="ruleActive"${d.active?" checked":""}> ${t("Active")}</label>
          <select id="ruleAll">${optionsHtml([{value:"all",label:t("Every criterion must match")},{value:"any",label:t("Any one criterion matches")}],d.all_criteria?"all":"any")}</select>
        </div>
      </div>
    </div>
    <div class="sect"><h2>${t("When")}</h2><div class="card flat">${criteria}
      <div class="row" style="margin-top:14px"><button class="btn ghost sm" data-act="critadd">${t("Add criterion")}</button></div></div></div>
    <div class="sect"><h2>${t("Then")}</h2><div class="card flat">${actions}
      <div class="row" style="margin-top:14px"><button class="btn ghost sm" data-act="actadd">${t("Add action")}</button></div></div></div>
    <div class="sect"><div class="row">
      <button class="btn" data-act="rulesave">${t("Save rule")}</button>
      <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
      <div class="err" id="err_ruleedit"></div>
    </div></div>
  </div>`;
}
function readRuleForm(){
  const d=editing.rule;
  d.name=$("#ruleName").value;
  d.active=$("#ruleActive").checked;
  d.all_criteria=$("#ruleAll").value==="all";
  document.querySelectorAll("#content [data-r]").forEach(el=>{
    const i=Number(el.dataset.i), r=el.dataset.r;
    if(r.indexOf("crit-")===0){if(d.criteria[i])d.criteria[i][r.slice(5)]=el.value;}
    else if(r.indexOf("act-")===0){if(d.actions[i])d.actions[i][r.slice(4)]=el.type==="checkbox"?el.checked:el.value;}
  });
}
async function saveRule(){
  readRuleForm();
  setErr("err_ruleedit","");
  const words=ruleWords(), d=editing.rule;
  const body={
    name:d.name,active:!!d.active,all_criteria:!!d.all_criteria,
    criteria:d.criteria.map(c=>{
      const o={field:c.field,match:c.match,value:c.value||""};
      if(c.field==="header")o.header=c.header||"";
      return o;
    }),
    // Only the parameters that carry something: the create refuses a parameter
    // its action does not take, and an omitted optional one is simply empty.
    actions:d.actions.map(a=>{
      const o={type:a.type};
      (words.actions[a.type]||[]).forEach(p=>{
        const v=a[p];
        if(v===undefined||v===""||v===null)return;
        o[p]=(p==="route_id")?Number(v):v;
      });
      return o;
    })
  };
  try{
    if(editing.id)await api(rulesBase()+"/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api(rulesBase(),{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("Rule saved"));await render();
  }catch(e){
    if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    setErr("err_ruleedit",e.message);
  }
}
async function deleteRule(id,name){
  if(!await deckConfirm(tf("Delete the rule “{0}”?",name)))return;
  setErr("err_rule_"+id,"");
  try{await api(rulesBase()+"/"+id,{method:"DELETE"});toast(t("Rule deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_rule_"+id,e.message);}
}

/* ---------- Certificates ---------- */
async function renderCerts(){
  await loadSpec();
  cache.certificates=asList(await api("/api/v1/certificates"),"certificates");
  const rows=cache.certificates.map(c=>`
    <tr><td><b>${escHtml(c.name)}</b><div class="hint muted">${tf("id {0}",escHtml(c.id))}</div></td>
        <td><code>${escHtml(c.certificate_file||"—")}</code></td>
        <td><code>${escHtml(c.private_key_file||"—")}</code></td>
        <td style="text-align:right">
          <button class="btn danger sm" data-act="certdel" data-id="${escHtml(c.id)}" data-name="${escHtml(c.name)}">${t("Delete")}</button>
          <div class="err" id="err_cert_${escHtml(c.id)}"></div></td></tr>`).join("");
  const props=properties("/api/v1/certificates","post");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/certificates","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Name")}</th><th>${t("Certificate file")}</th><th>${t("Private key file")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="4" class="empty">'+t("No certificates are configured.")+'</td></tr>'}</tbody></table></div>
    </div>
    <div class="sect"><h2>${t("Add a certificate")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/certificates","post").description||""))}</p>
        <div class="form">${formHtml("cert",props,{},{required:requiredOf("/api/v1/certificates","post"),passwordHint:t("only if the key is encrypted")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="certadd">${t("Add certificate")}</button>
          <div class="err" id="err_certadd"></div>
        </div>
      </div></div>
  </div>`;
}
async function addCertificate(){
  setErr("err_certadd","");
  const props=properties("/api/v1/certificates","post");
  let body;
  try{body=readForm("cert",props,{});}catch(e){setErr("err_certadd",e.message);return;}
  try{
    await api("/api/v1/certificates",{method:"POST",body:JSON.stringify(body)});
    toast(t("Certificate added"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_certadd",e.message);}
}
async function deleteCertificate(id,name){
  if(!await deckConfirm(tf("Delete the certificate “{0}”?",name)))return;
  setErr("err_cert_"+id,"");
  try{await api("/api/v1/certificates/"+id,{method:"DELETE"});toast(t("Certificate deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_cert_"+id,e.message);}
}

/* ---------- Ports ----------
   The listeners are built when the server starts, so this view says what the
   document says about that and carries the button that restarts the services in
   place (POST /api/v1/server/reinitialize). That restart also ends every browser
   session, this one included, so the page returns to the sign-in card. */
async function renderPorts(){
  await loadSpec();
  cache.ports=asList(await api("/api/v1/ports"),"ports");
  cache.certificates=asList(await api("/api/v1/certificates"),"certificates");
  if(editing&&editing.kind==="port"){renderPortEditor();return;}
  const certName=id=>{
    const c=cache.certificates.filter(x=>Number(x.id)===Number(id))[0];
    return c?c.name:(Number(id)?tf("id {0}",id):"—");
  };
  const rows=cache.ports.map(p=>`
    <tr><td><b>${escHtml(humanise(p.protocol))}</b><div class="hint muted">${tf("id {0}",escHtml(p.id))}</div></td>
        <td><code>${escHtml(p.address)}:${escHtml(p.port)}</code></td>
        <td>${escHtml(humanise(p.connection_security))}</td>
        <td>${escHtml(certName(p.certificate_id))}</td>
        <td>${escHtml(humanise(p.client_certificate_policy))}${p.client_certificate_ca_file?'<div class="hint muted">'+escHtml(p.client_certificate_ca_file)+'</div>':""}</td>
        <td>${p.protocol==="smtp"&&p.smtp_authentication?escHtml(humanise(p.smtp_authentication)):"—"}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="portedit" data-id="${escHtml(p.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="portdel" data-id="${escHtml(p.id)}" data-label="${escHtml(p.protocol+" "+p.address+":"+p.port)}">${t("Delete")}</button>
          <div class="err" id="err_port_${escHtml(p.id)}"></div></td></tr>`).join("");
  // 固定中文提示，避免将服务端 OpenAPI 文档中多段英文重启警告直接拼接到界面。
  const restartWording="服务端口监听器仅在服务器启动时创建。新增或修改端口后，需要重启邮件服务才能生效。删除端口后，该端口会立即从列表中移除，但实际监听仍会持续到服务重启后才停止。";
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">端口监听配置由邮件服务管理；新增、删除或修改监听器后请重启邮件服务。</p>
      ${noticeHtml("warn",restartWording)}
      <div class="tablewrap"><table><thead><tr><th>${t("Protocol")}</th><th>${t("Listens on")}</th><th>${t("Security")}</th><th>${t("Certificate")}</th><th>${t("Client certificate")}</th><th>${t("SMTP authentication")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" class="empty">'+t("No listeners are configured.")+'</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px">
        <button class="btn" data-act="portnew">${t("Add a port")}</button>
        <button class="btn ghost" data-act="portapply">${t("Restart the services now")}</button>
        <div class="err" id="err_portapply"></div>
      </div>
      <p class="note" style="margin-top:12px">${escHtml(uiDocText(operation("/api/v1/server/reinitialize","post").description||""))}</p>
    </div></div>`;
}
function portFormOptions(){
  return {
    required:requiredOf("/api/v1/ports","post"),
    choices:{certificate_id:[{value:0,label:t("(none)")}].concat(
      cache.certificates.map(c=>({value:c.id,label:c.name})))},
    labels:{client_certificate_policy:"客户端证书验证策略",client_certificate_ca_file:"客户端证书 CA 证书文件"},
    descriptions:{
      client_certificate_policy:"设置连接时是否验证客户端提供的 TLS 证书。",
      client_certificate_ca_file:"用于验证客户端证书的 CA 证书文件路径，应填写邮件服务器上的文件路径。"
    }
  };
}
function openPort(id){
  const existing=cache.ports.filter(p=>Number(p.id)===Number(id))[0];
  const values=existing
    ? JSON.parse(JSON.stringify(existing))
    : documentedDefaults("/api/v1/ports","post",properties("/api/v1/ports","post"));
  editing={kind:"port",id:Number(id)||0,values:values};
  renderPortEditor();
}
function renderPortEditor(){
  const props=properties("/api/v1/ports","post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All ports")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit port {0}",escHtml(editing.id)):t("New port")}</h2>
      <div class="card flat">
        <p class="note">修改端口配置后，需要重启邮件服务才能生效。</p>
        <div class="form">${formHtml("port",props,editing.values,portFormOptions())}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="portsave">${t("Save port")}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_portedit"></div>
        </div>
      </div></div></div>`;
}
async function savePort(){
  setErr("err_portedit","");
  const props=properties("/api/v1/ports","post");
  let body;
  try{body=readForm("port",props,portFormOptions());}catch(e){setErr("err_portedit",e.message);return;}
  try{
    if(editing.id)await api("/api/v1/ports/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/ports",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("Port saved — it reaches the wire when the services restart"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_portedit",e.message);}
}
async function deletePort(id,label){
  if(!await deckConfirm(tf("Delete the listener {0}?",label)))return;
  setErr("err_port_"+id,"");
  try{await api("/api/v1/ports/"+id,{method:"DELETE"});toast(t("Port deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_port_"+id,e.message);}
}
async function applyRestart(){
  setErr("err_portapply","");
  if(!await deckConfirm(t("Restart the server's services now? Connections in progress are dropped, and this browser session ends with them.")))return;
  try{await api("/api/v1/server/reinitialize",{method:"POST"});}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_portapply",e.message);return;}
  toast(t("Restarting the services…"));
  await waitForTheRestart(t("The services restarted, which ended this session. Sign in again."));
}
/* Apply now on the Settings view's pending banner: the same reinitialise, asked
   for in its own words - and in different ones while the server is draining,
   because a reinitialise ends maintenance mode and opens the listeners again.
   The answer says drained when it did. */
async function applyPending(){
  setErr("err_pending","");
  let draining=false;
  try{draining=!!(await api("/api/v1/server/drain")).draining;}catch(_){}
  // A reinitialise takes the keys marked reinitialize and not those marked
  // restart, and this session ends with it, so what it will leave waiting is
  // counted now and said when the page comes back.
  let stillForRestart=0;
  try{stillForRestart=asList(await api("/api/v1/server/settings/pending"),"pending").filter(p=>p.applies==="restart").length;}catch(_){}
  if(!await deckConfirm(draining
      ?t("The server is draining. A reinitialize ends maintenance mode: the listeners open again and delivery resumes, and this browser session ends. Reinitialize the server now?")
      :t("Reinitialize the server now? Every service stops and starts again in place: connections in progress are dropped, and this browser session ends with them.")))return;
  let answer={};
  try{answer=await api("/api/v1/server/reinitialize",{method:"POST"});}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_pending",e.message);return;}
  toast(answer&&answer.drained?t("Reinitializing - maintenance mode ends with it…"):t("Reinitializing the server…"));
  await waitForTheRestart(stillForRestart
    ?tf("The server reinitialized and took the settings that waited for a reinitialize; {0} still wait for a service restart. That ended this session. Sign in again.",stillForRestart)
    :t("The server reinitialized and took the saved settings, which ended this session. Sign in again."));
}
async function waitForTheRestart(signedOutMessage){
  if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  for(let attempt=0;attempt<60;attempt++){
    await new Promise(resolve=>setTimeout(resolve,1000));
    try{
      await api("/api/v1/status");
      toast(signedOutMessage||t("The mail service is back online."));
      await render();
      return;
    }catch(err){
      if(err.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    }
  }
  setErr("err_pending",t("The mail service did not answer after the restart. Check the service and refresh this page."));
}
/* ---------- Routes ---------- */
function routeFormOptions(){
  return {
    required:requiredOf("/api/v1/routes","post"),
    // treat_security_as_local_domain is the COM spelling of
    // treat_recipient_as_local_domain and the document gives both for the same
    // flag; one control writes it, so only one is drawn.
    skip:["treat_security_as_local_domain"],
    passwordHint:t("left unchanged unless filled")
  };
}
async function renderRoutes(){
  await loadSpec();
  cache.routes=asList(await api("/api/v1/routes"),"routes");
  if(editing&&editing.kind==="route"){renderRouteEditor();return;}
  const addressCount=n=>n===1?tf("{0} address",n):tf("{0} addresses",n);
  const rows=cache.routes.map(r=>`
    <tr><td><b>${escHtml(r.domain_name)}</b>${r.description?'<div class="hint muted">'+escHtml(r.description)+'</div>':""}<div class="hint muted">${tf("id {0}",escHtml(r.id))}</div></td>
        <td><code>${escHtml(r.target_smtp_host)}:${escHtml(r.target_smtp_port)}</code></td>
        <td>${escHtml(humanise(r.connection_security))}</td>
        <td>${r.relayer_requires_authentication?escHtml(r.relayer_auth_username||t("(no user name)")):'<span class="muted">'+t("none")+'</span>'}</td>
        <td>${r.all_addresses?'<span class="muted">'+t("every recipient")+'</span>':escHtml(addressCount((r.addresses||[]).length))}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="routeedit" data-id="${escHtml(r.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="routedel" data-id="${escHtml(r.id)}" data-name="${escHtml(r.domain_name)}">${t("Delete")}</button>
          <div class="err" id="err_route_${escHtml(r.id)}"></div></td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/routes","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Domain")}</th><th>${t("Target")}</th><th>${t("Security")}</th><th>${t("Authentication")}</th><th>${t("Recipients")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6" class="empty">'+t("No routes are configured; every domain is delivered to by its MX records.")+'</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px"><button class="btn" data-act="routenew">${t("Add a route")}</button></div>
    </div></div>`;
}
function openRoute(id){
  const existing=cache.routes.filter(r=>Number(r.id)===Number(id))[0];
  const values=existing
    ? JSON.parse(JSON.stringify(existing))
    : documentedDefaults("/api/v1/routes","post",properties("/api/v1/routes","post"));
  editing={kind:"route",id:Number(id)||0,values:values};
  renderRouteEditor();
}
function renderRouteEditor(){
  const props=properties("/api/v1/routes","post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All routes")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit route {0}",escHtml(editing.id)):t("New route")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation(editing.id?"/api/v1/routes/{id}":"/api/v1/routes",editing.id?"put":"post").description||""))}</p>
        <div class="form">${formHtml("route",props,editing.values,routeFormOptions())}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="routesave">${t("Save route")}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_routeedit"></div>
        </div>
      </div></div></div>`;
}
async function saveRoute(){
  setErr("err_routeedit","");
  const props=properties("/api/v1/routes","post");
  let body;
  try{body=readForm("route",props,routeFormOptions());}catch(e){setErr("err_routeedit",e.message);return;}
  try{
    if(editing.id)await api("/api/v1/routes/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/routes",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("Route saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_routeedit",e.message);}
}
async function deleteRoute(id,name){
  if(!await deckConfirm(tf("Delete the route for {0}?",name)))return;
  setErr("err_route_"+id,"");
  try{await api("/api/v1/routes/"+id,{method:"DELETE"});toast(t("Route deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_route_"+id,e.message);}
}

/* ---------- Remote domains ----------
   What this server will do when it talks to a named remote domain: the TLS it
   demands of it outbound and inbound, the size and concurrency it will attempt,
   and whether a recipient is verified with the domain's own server before mail
   for it is accepted.

   Beside the routes and deliberately not part of them: a route says WHERE mail
   for a domain goes, a policy says what this server will and will not do when
   it gets there, and a domain may have both. The form is built from the schema
   of POST /api/v1/remote-domains, as the routes' is, so a field the record
   gains appears here without a change to this page.

   Gateway encryption is on the same record: encrypt, the partner's key and
   the fallback. The key is write-only - the schema marks it so, the box opens
   empty and is sent only when a key is pasted into it, and the server keeps
   the one it holds when the box is left empty - and what is held is shown by
   the read-only fields the listing answers beside it: the fingerprint to read
   out to the partner, the expiry, whom it names, and why no message can be
   encrypted to it when none can. The list says the same in its own column. */
function remoteDomainFormOptions(){
  // The two methods by the names their standards give them, rather than the
  // words the API spells them with.
  return {required:requiredOf("/api/v1/remote-domains","post"),
    choices:{encrypt:[{value:"none",label:humanise("none")},{value:"openpgp",label:"OpenPGP"},{value:"smime",label:"S/MIME"}]}};
}
async function renderRemoteDomains(){
  await loadSpec();
  cache.remotedomains=asList(await api("/api/v1/remote-domains"),"remote-domains");
  if(editing&&editing.kind==="remotedomain"){renderRemoteDomainEditor();return;}
  const limits=p=>{
    const parts=[];
    if(p.max_message_size_kb)parts.push(tf("{0} KB",p.max_message_size_kb));
    if(p.max_connections)parts.push(tf("{0} connections",p.max_connections));
    if(p.max_messages_per_minute)parts.push(tf("{0}/minute",p.max_messages_per_minute));
    return parts.length?parts.join(", "):t("none");
  };
  const encryption=p=>{
    if(!p.encrypt||p.encrypt==="none")return '<span class="muted">'+t("none")+'</span>';
    const method=p.encrypt==="smime"?"S/MIME":"OpenPGP";
    if(p.encrypt_key_problem)
      return escHtml(method)+' <span class="badge warn">'+t("cannot encrypt")+'</span><div class="hint">'+escHtml(p.encrypt_key_problem)+'</div>';
    return escHtml(method)+(p.encrypt_key_fingerprint?'<div class="hint muted"><code>'+escHtml(String(p.encrypt_key_fingerprint).slice(0,16))+'</code></div>':"");
  };
  const rows=cache.remotedomains.map(p=>`
    <tr><td><b>${escHtml(p.domain_name)}</b>${p.description?'<div class="hint muted">'+escHtml(p.description)+'</div>':""}<div class="hint muted">${tf("id {0}",escHtml(p.id))}${p.active?"":" · "+t("Off")}</div></td>
        <td>${escHtml(humanise(p.outbound_tls))}</td>
        <td>${p.require_inbound_tls?t("required"):'<span class="muted">'+t("none")+'</span>'}</td>
        <td>${escHtml(limits(p))}</td>
        <td>${p.callout_enabled?t("On"):'<span class="muted">'+t("Off")+'</span>'}</td>
        <td>${encryption(p)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="rdedit" data-id="${escHtml(p.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="rddel" data-id="${escHtml(p.id)}" data-name="${escHtml(p.domain_name)}">${t("Delete")}</button>
          <div class="err" id="err_rd_${escHtml(p.id)}"></div></td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/remote-domains","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Domain")}</th><th>${t("Outbound TLS")}</th><th>${t("Inbound TLS")}</th><th>${t("Limits")}</th><th>${t("Verification")}</th><th>${t("Encryption")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" class="empty">'+t("No remote domain policies are configured; mail to every domain is sent as this server's own settings decide.")+'</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px"><button class="btn" data-act="rdnew">${t("Add a policy")}</button>
        <button class="btn ghost" data-act="rdclearcache">${t("Forget the remembered verdicts")}</button>
        <div class="err" id="err_rdcache"></div></div>
    </div></div>`;
}
function openRemoteDomain(id){
  const existing=cache.remotedomains.filter(p=>Number(p.id)===Number(id))[0];
  const values=existing
    ? JSON.parse(JSON.stringify(existing))
    : documentedDefaults("/api/v1/remote-domains","post",properties("/api/v1/remote-domains","post"));
  editing={kind:"remotedomain",id:Number(id)||0,values:values};
  renderRemoteDomainEditor();
}
function renderRemoteDomainEditor(){
  const props=properties("/api/v1/remote-domains","post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All remote domains")}</button>
    <div class="sect"><h2>${editing.id?tf("Edit policy {0}",escHtml(editing.id)):t("New policy")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation(editing.id?"/api/v1/remote-domains/{id}":"/api/v1/remote-domains",editing.id?"put":"post").description||""))}</p>
        <div class="form">${formHtml("rd",props,editing.values,remoteDomainFormOptions())}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="rdsave">${t("Save policy")}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_rdedit"></div>
        </div>
      </div></div></div>`;
}
async function saveRemoteDomain(){
  setErr("err_rdedit","");
  const props=properties("/api/v1/remote-domains","post");
  let body;
  try{body=readForm("rd",props,remoteDomainFormOptions());}catch(e){setErr("err_rdedit",e.message);return;}
  try{
    if(editing.id)await api("/api/v1/remote-domains/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api("/api/v1/remote-domains",{method:"POST",body:JSON.stringify(body)});
    editing=null;toast(t("Policy saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_rdedit",e.message);}
}
async function deleteRemoteDomain(id,name){
  if(!await deckConfirm(tf("Delete the remote domain policy for {0}?",name)))return;
  setErr("err_rd_"+id,"");
  try{await api("/api/v1/remote-domains/"+id,{method:"DELETE"});toast(t("Policy deleted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_rd_"+id,e.message);}
}
async function clearVerificationCache(){
  setErr("err_rdcache","");
  try{
    const answer=await api("/api/v1/remote-domains/verification-cache/clear",{method:"POST",body:"{}"});
    toast(tf("{0} verdict(s) forgotten",(answer&&answer.cleared)||0));
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_rdcache",e.message);}
}

