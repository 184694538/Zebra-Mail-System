/* ---------- Migrations ----------
   Many mailboxes copied from another server into accounts here, one job per
   mailbox (docs/Migration.md, "Five hundred mailboxes: migration jobs"). The
   list is the migrations with their progress; one opened is its jobs with
   theirs, the CSV that adds them, and a job's report. The create dialog is
   built from the schema of POST /api/v1/migrations, as the webhooks' is, so a
   field the route gains appears here without a change to this page. A secret
   is never shown: the CSV goes to the server and the page keeps nothing of it,
   and a sign-in link is shown once, as the server answers it once. */
let migrationOpen=0,migrationReport=null,migrationLinks=[],migrationJobs=[];
const MIGRATION_WORDS={new:K("new"),running:K("running"),paused:K("paused"),finished:K("finished"),
  queued:K("queued"),done:K("done"),failed:K("failed"),cancelled:K("cancelled")};
function migrationWord(word){
  return Object.prototype.hasOwnProperty.call(MIGRATION_WORDS,word)?t(MIGRATION_WORDS[word]):String(word||"");
}
function migrationBadge(word){
  const level=word==="done"||word==="finished"?"good":(word==="failed"?"bad":(word==="running"?"info":"warn"));
  return '<span class="badge '+level+'" data-state="'+escHtml(word)+'">'+escHtml(migrationWord(word))+'</span>';
}
function migrationMeter(done,total){
  const d=Number(done)||0,n=Number(total)||0;
  const percent=n>0?Math.min(100,Math.round(d*100/n)):0;
  return '<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+percent+'"><i style="width:'+percent+'%"></i></div>'+
         '<div class="hint muted">'+escHtml(tf("{0} of {1} messages",d,n))+'</div>';
}
function migrationVerbs(m){
  const id=escHtml(String(m.id));
  if(m.state==="new"||m.state==="finished")return '<button class="btn sm" data-act="migstart" data-id="'+id+'">'+t("Start")+'</button> ';
  if(m.state==="running")return '<button class="btn ghost sm" data-act="migpause" data-id="'+id+'">'+t("Pause")+'</button> ';
  if(m.state==="paused")return '<button class="btn sm" data-act="migresume" data-id="'+id+'">'+t("Resume")+'</button> ';
  return "";
}
async function renderMigrations(){
  await loadSpec();
  if(editing&&editing.kind==="migration"){renderMigrationEditor();return;}
  if(migrationOpen){await renderMigrationJobs();return;}
  const list=asList(await api("/api/v1/migrations"),"migrations");
  const rows=list.map(m=>{
    const jobs=m.jobs||{};
    const id=escHtml(String(m.id));
    return `
    <tr><td><b>${escHtml(m.name)}</b><div class="hint muted"><code>${escHtml(m.kind)}</code> ${escHtml(m.host)}</div></td>
        <td>${migrationBadge(m.state)}</td>
        <td style="min-width:160px">${migrationMeter(m.messages_copied,m.messages_total)}</td>
        <td>${escHtml(tf("{0} jobs: {1} done, {2} failed",Number(jobs.total)||0,Number(jobs.done)||0,Number(jobs.failed)||0))}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="migopen" data-id="${id}">${t("Open")}</button>
          ${migrationVerbs(m)}
          <button class="btn danger sm" data-act="migdel" data-id="${id}" data-name="${escHtml(m.name)}">${t("Delete")}</button>
          <div class="err" id="err_mig_${id}"></div></td></tr>`;
  }).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/migrations","get").description||""))}</p>
      <div class="tablewrap"><table><thead><tr><th>${t("Name")}</th><th>${t("State")}</th><th>${t("Progress")}</th><th>${t("Jobs")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="5" class="empty">'+t("No migration has been made. A migration copies many mailboxes from another server into accounts here, one job per mailbox.")+'</td></tr>'}</tbody></table></div>
      <div class="row" style="margin-top:16px">
        <button class="btn" data-act="mignew">${t("New migration")}</button>
        <div class="err" id="err_migs"></div>
      </div>
    </div></div>`;
}
function openNewMigration(){
  editing={kind:"migration",id:"",values:documentedDefaults("/api/v1/migrations","post",properties("/api/v1/migrations","post"))};
  renderMigrationEditor();
}
function renderMigrationEditor(){
  const props=properties("/api/v1/migrations","post");
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="cancel">${t("‹ All migrations")}</button>
    <div class="sect"><h2>${t("New migration")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/migrations","post").description||""))}</p>
        <div class="form">${formHtml("mig",props,editing.values,{required:requiredOf("/api/v1/migrations","post")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="migsave">${t("Create the migration")}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_migedit"></div>
        </div>
      </div></div></div>`;
}
async function saveMigration(){
  setErr("err_migedit","");
  const props=properties("/api/v1/migrations","post");
  let body;
  try{body=readForm("mig",props,{});}catch(e){setErr("err_migedit",e.message);return;}
  // A box left empty is the server's default, not an empty value.
  Object.keys(body).forEach(k=>{if(body[k]==="")delete body[k];});
  // The port the chosen security is spoken on, when none is typed: 993 for
  // TLS, which Google and Microsoft 365 always are, and 143 for STARTTLS or
  // the clear - what the server would choose, sent so it can be seen.
  if(body.port===undefined)body.port=(body.security||"tls")==="tls"?993:143;
  try{
    const made=await api("/api/v1/migrations",{method:"POST",body:JSON.stringify(body)});
    editing=null;migrationOpen=Number(made.id)||0;migrationReport=null;migrationLinks=[];
    toast(t("Migration created"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_migedit",e.message);}
}
function migrationReportHtml(r){
  const reasons=f=>{const keys=Object.keys(f.skipped_reasons||{});
    return keys.length?'<div class="hint muted">'+escHtml(keys.map(k=>k+": "+f.skipped_reasons[k]).join(", "))+'</div>':"";};
  const folders=(r.folders||[]).map(f=>`
    <tr><td><code>${escHtml(f.source)}</code>${f.target&&f.target!==f.source?' → <code>'+escHtml(f.target)+'</code>':""}${f.note?'<div class="hint muted">'+escHtml(f.note)+'</div>':""}</td>
        <td>${escHtml(String(Number(f.source_messages)||0))}</td>
        <td>${escHtml(String(Number(f.copied)||0))}</td>
        <td>${escHtml(String(Number(f.skipped)||0))}${reasons(f)}</td></tr>`).join("");
  const phase=(label,p)=>{p=p||{};
    const text=p.state==="skipped"?tf("Skipped: {0}",p.reason||""):tf("{0} copied, {1} skipped",Number(p.copied)||0,Number(p.skipped)||0);
    return '<p><b>'+escHtml(label)+'</b> '+escHtml(text)+'</p>';};
  const errors=(r.errors||[]).map(e=>'<li>'+escHtml(auditWhen(e.at))+' — '+escHtml(e.error)+'</li>').join("");
  return `<div class="sect" id="migReport"><h2>${escHtml(tf("Report of {0}",r.source_user||""))}</h2>
    <div class="card flat">
      <div class="tablewrap"><table><thead><tr><th>${t("Folder")}</th><th>${t("In the source")}</th><th>${t("Copied")}</th><th>${t("Skipped")}</th></tr></thead>
      <tbody>${folders}</tbody></table></div>
      ${phase(t("Contacts"),r.contacts)}${phase(t("Calendars"),r.calendars)}
      ${errors?'<p class="note">'+t("Errors met and retried")+'</p><ul>'+errors+'</ul>':""}
    </div></div>`;
}
async function renderMigrationJobs(){
  const id=migrationOpen;
  const m=await api("/api/v1/migrations/"+id);
  migrationJobs=asList(await api("/api/v1/migrations/"+id+"/jobs"),"jobs");
  const rows=migrationJobs.map(j=>{
    const jid=escHtml(String(j.id));
    const retry=j.state==="failed"||j.state==="cancelled"||j.state==="paused";
    const cancel=j.state!=="done"&&j.state!=="cancelled";
    const signIn=j.signs_in&&j.state!=="done"&&j.state!=="running";
    return `
    <tr><td><b>${escHtml(j.source_user)}</b>${j.awaiting_signin?'<div class="hint"><span class="badge warn">'+t("Awaiting its owner's sign-in")+'</span></div>':""}</td>
        <td>${escHtml(j.target)}</td>
        <td>${migrationBadge(j.state)}</td>
        <td style="min-width:160px">${migrationMeter(j.messages_copied,j.messages_total)}</td>
        <td>${escHtml(j.last_error||"")}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="migreport" data-id="${jid}">${t("Report")}</button>
          ${retry?'<input type="password" class="sm" id="migsecret_'+jid+'" autocomplete="new-password" style="width:12em" placeholder="'+t("New password or token (optional)")+'" aria-label="'+t("New password or token (optional)")+'"> <button class="btn sm" data-act="migretry" data-id="'+jid+'">'+t("Retry")+'</button>':""}
          ${cancel?'<button class="btn danger sm" data-act="migcancel" data-id="'+jid+'">'+t("Cancel the job")+'</button>':""}
          ${signIn?'<button class="btn ghost sm" data-act="migsignin" data-id="'+jid+'">'+t("Sign-in link")+'</button>':""}
          <div class="err" id="err_migjob_${jid}"></div></td></tr>`;
  }).join("");
  const links=migrationLinks.length?`
    <div class="sect"><div class="card flat" id="migLinks"><p class="note">${t("Sign-in links, for each mailbox's owner to open once:")}</p>
      <ul>${migrationLinks.map(l=>'<li><b>'+escHtml(l.user)+'</b> <code>'+escHtml(l.url)+'</code></li>').join("")}</ul></div></div>`:"";
  const mid=escHtml(String(m.id));
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="migback">${t("‹ All migrations")}</button>
    <div class="sect"><h2>${escHtml(m.name)} ${migrationBadge(m.state)}</h2>
      <div class="card flat">
        <p class="note"><code>${escHtml(m.kind)}</code> ${escHtml(m.host)}:${escHtml(String(m.port))}</p>
        ${migrationMeter(m.messages_copied,m.messages_total)}
        <div class="row" style="margin-top:12px">
          ${migrationVerbs(m)}
          <a class="btn ghost sm" id="migSummary" href="#" data-api-download="/api/v1/migrations/${mid}/summary.csv" download>${t("Download the summary (CSV)")}</a>
          <div class="err" id="err_mig_${mid}"></div>
        </div>
      </div></div>
    ${links}
    <div class="sect"><h2>${t("Jobs")}</h2>
      <div class="card flat">
        <div class="tablewrap"><table><thead><tr><th>${t("Source")}</th><th>${t("Target")}</th><th>${t("State")}</th><th>${t("Progress")}</th><th>${t("Error")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="empty">'+t("No jobs yet. Add them below.")+'</td></tr>'}</tbody></table></div>
      </div></div>
    ${migrationReport?migrationReportHtml(migrationReport):""}
    <div class="sect"><h2>${t("Add jobs")}</h2>
      <div class="card flat">
        <p class="note">${t("One line per mailbox: sourceuser,secret,target. Paste the lines or choose a file. For Google and Microsoft 365 the secret may be left empty; each such job then gets a sign-in link for the mailbox's owner.")}</p>
        <textarea id="migCsv" rows="6"></textarea>
        <div class="row" style="margin-top:12px">
          <input type="file" id="migCsvFile" data-r="mig-csv-file" accept=".csv,text/csv,text/plain" aria-label="${t("CSV file")}">
          <button class="btn" data-act="migjobs">${t("Add the jobs")}</button>
          <div class="err" id="err_migjobs"></div>
        </div>
      </div></div></div>`;
}
async function migrationVerb(id,verb,done){
  setErr("err_mig_"+id,"");
  try{
    await api("/api/v1/migrations/"+encodeURIComponent(id)+"/"+verb,{method:"POST",body:"{}"});
    toast(t(done));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mig_"+id,e.message);}
}
async function deleteMigration(id,name){
  if(!await deckConfirm(tf("Delete the migration {0}? What it copied stays.",name)))return;
  setErr("err_mig_"+id,"");
  try{
    await api("/api/v1/migrations/"+encodeURIComponent(id),{method:"DELETE"});
    migrationOpen=0;migrationReport=null;migrationLinks=[];
    toast(t("Migration deleted"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mig_"+id,e.message);}
}
async function addMigrationJobs(){
  setErr("err_migjobs","");
  const box=$("#migCsv");
  const text=box?box.value:"";
  if(!String(text).trim())return;
  try{
    // The lines as they are: the server reads a body that is not a JSON
    // object as CSV, and refuses the whole of it, naming the line, when one
    // line is wrong - so nothing is half added.
    const answer=await api("/api/v1/migrations/"+migrationOpen+"/jobs",{method:"POST",body:String(text)});
    migrationLinks=asList(answer,"jobs").filter(j=>j.signin_url).map(j=>({user:j.source_user,url:j.signin_url}));
    toast(tf("{0} job(s) added",Number(answer.created)||0));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_migjobs",e.message);}
}
async function showMigrationReport(job){
  setErr("err_migjob_"+job,"");
  try{
    migrationReport=await api("/api/v1/migrations/"+migrationOpen+"/jobs/"+encodeURIComponent(job)+"/report");
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_migjob_"+job,e.message);}
}
async function migrationJobVerb(job,verb,done){
  if(verb==="cancel"&&!await deckConfirm(t("Cancel this job? What it copied stays.")))return;
  setErr("err_migjob_"+job,"");
  // A retry may carry the mended password, or a new refresh token: a job the
  // source refused the logon of fails again on every retry without it. Read
  // from the box and sent once; the page keeps nothing of it.
  let body="{}";
  if(verb==="retry"){const box=$("#migsecret_"+job);const secret=box?String(box.value||""):"";if(secret)body=JSON.stringify({secret:secret});}
  try{
    await api("/api/v1/migrations/"+migrationOpen+"/jobs/"+encodeURIComponent(job)+"/"+verb,{method:"POST",body:body});
    toast(t(done));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_migjob_"+job,e.message);}
}
async function migrationSignInLink(job){
  setErr("err_migjob_"+job,"");
  try{
    const answer=await api("/api/v1/migrations/"+migrationOpen+"/jobs/"+encodeURIComponent(job)+"/signin",{method:"POST",body:"{}"});
    const owner=migrationJobs.filter(j=>String(j.id)===String(job))[0];
    migrationLinks=[{user:owner?owner.source_user:String(job),url:answer.signin_url}];
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_migjob_"+job,e.message);}
}

