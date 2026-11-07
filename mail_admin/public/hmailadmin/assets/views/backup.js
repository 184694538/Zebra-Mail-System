/* ---------- Backup ----------
   The backup settings are a settings group like the three on the Settings
   view - the form is the schema of PUT /api/v1/settings/backup, Save sends
   what changed and reads the group back - beside the backup manager's status
   and the tail of its log from GET /api/v1/backup, and the button that starts
   a backup with those settings. Since the archive can be encrypted, the group
   also carries the passphrase (write-only: the form draws it as a password box
   and sends it only when it is filled in) and a read-only flag saying whether
   one is set. Emptying that box therefore changes nothing, and its hint is the
   same "left unchanged unless filled" as every other password box on this page
   rather than an invitation to clear it that way: Stop encrypting - which asks
   first - is the only thing that clears it, because a passphrase dropped by a
   form that was saved with an empty box is every future archive written in the
   clear on the strength of a keystroke nobody meant.

   The restore below is the other half, and on Linux it is the only one there
   is: this page and the REST route are how a server with no Control Panel gets
   its mail back. The schedule is four settings the server keeps in its
   database, as every [Settings] key: a hand edit of hMailServer.ini is put
   back, so the note names where they are set. */
async function renderBackup(){
  await loadSpec();
  const props=properties("/api/v1/settings/backup","put");
  const values=await api("/api/v1/settings/backup");
  const restoreProps=properties("/api/v1/backup/restore","post");
  settingsState.backup={path:"/api/v1/settings/backup",props:props,values:values};
  let status=null,statusError="";
  try{status=await api("/api/v1/backup");}catch(e){if(e.message==="auth")throw e;statusError=e.message;}
  const log=status&&Array.isArray(status.log)?status.log:[];
  // The archives in the destination, for the two mailbox pickers below. A
  // destination with none in it is said, not drawn as an empty select.
  let archives=[],archivesError="";
  try{const a=await api("/api/v1/backup/archives");archives=Array.isArray(a.archives)?a.archives:[];}catch(e){if(e.message==="auth")throw e;archivesError=e.message;}
  const archiveOptions=archives.length?archives.map(a=>`<option value="${escHtml(a.name)}">${escHtml(a.name)}${a.encrypted?" ("+t("encrypted")+")":""}</option>`).join(""):
    `<option value="">（备份目录中暂无存档）</option>`;
  const mailboxRestoreProps=operation("/api/v1/backup/{archive}/mailboxes/{address}/restore","post");
  const mailboxListProps=operation("/api/v1/backup/{archive}/mailboxes/{address}","get");
  $("#content").innerHTML=`<div class="view">
    <div class="sect"><h2>${t("Backup")} <code class="muted">PUT /api/v1/settings/backup</code></h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/settings/backup","put").description||""))}</p>
        <div class="form">${formHtml("set_backup",props,values,{passwordHint:t("left unchanged unless filled")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="setsave" data-group="backup">${t("Save backup settings")}</button>
          <button class="btn ghost" data-act="backupstart">${t("Start backup now")}</button>
          ${values.encryption_passphrase_set?`<button class="btn ghost" data-act="backupclearpass">${t("Stop encrypting")}</button>`:""}
          <div class="err" id="err_set_backup"></div>
          <div class="err" id="err_backupstart"></div>
        </div>
        <p class="note" style="margin-top:12px">${t("An encrypted archive is encrypted as it is written, file names included, and the passphrase is kept nowhere but in this server's own settings - never in the archive and never beside it. A restore asks for it. If it is lost, nothing in an archive written with it can be recovered, by anybody.")}</p>
        <p class="note" style="margin-top:12px">${t("Start backup now")}：使用上方保存的设置创建备份。${escHtml(uiDocText(operation("/api/v1/backup","post").description||""))} ${t("The schedule is the settings ScheduledBackupTime, ScheduledBackupIntervalMinutes, ScheduledBackupKeepCount and ScheduledBackupMaxAgeDays, under Scheduled backups in the Control Panel or at PUT /api/v1/settings/ini/ followed by the name; a restore is below.")}</p>
      </div></div>
    <div class="sect"><h2>${t("Restore")} <code class="muted">POST /api/v1/backup/restore</code></h2>
      <div class="card flat">
        <p class="note">将服务器上的备份存档恢复到当前邮件服务器。请选择需要恢复的内容；恢复操作可能覆盖现有配置和邮件数据，请确认存档路径及备份内容。${escHtml(uiDocText(operation("/api/v1/backup/restore","post").description||""))}</p>
        <div class="form">${formHtml("restore",restoreProps,{},{required:requiredOf("/api/v1/backup/restore","post"),passwordHint:t("only for an encrypted archive")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn danger" data-act="backuprestore">${t("Start restore")}</button>
          <div class="err" id="err_backuprestore"></div>
        </div>
      </div></div>
    <div class="sect"><h2>${t("Restore a mailbox")} <code class="muted">POST /api/v1/backup/{archive}/mailboxes/{address}/restore</code></h2>
      <div class="card flat">
        <p class="note">${t("Restore a mailbox")}：从已有备份存档恢复指定邮箱。合并模式不会删除原有邮件；替换模式会先清空现有文件夹，请谨慎操作。${escHtml(uiDocText(mailboxRestoreProps.description||""))}</p>
        ${archivesError?'<div class="err">'+escHtml(archivesError)+'</div>':""}
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <select id="mbr_archive" title="${t("Archive")}">${archiveOptions}</select>
          <input id="mbr_address" placeholder="${t("Account address")}" style="flex:1 1 220px">
          <input id="mbr_passphrase" type="password" placeholder="${t("only for an encrypted archive")}" autocomplete="off" style="flex:1 1 180px">
        </div>
        <div class="row" style="gap:16px;flex-wrap:wrap;margin-top:12px">
          <label><input type="radio" name="mbr_mode" id="mbr_mode_merge" value="merge" checked> ${t("Merge: add the archive's folders and messages that the mailbox lacks; nothing already there is removed")}</label>
          <label><input type="radio" name="mbr_mode" id="mbr_mode_replace" value="replace"> ${t("Replace: empty every folder first, so the mailbox is the archive's - mail that arrived since the backup is gone")}</label>
        </div>
        <div class="row" style="margin-top:18px">
          <button class="btn danger" data-act="mailboxrestore">${t("Restore the mailbox")}</button>
          <div class="err" id="err_mailboxrestore"></div>
        </div>
        <div id="mbr_outcome"></div>
      </div></div>
    <div class="sect"><h2>${t("Restore one message")} <code class="muted">GET /api/v1/backup/{archive}/mailboxes/{address}</code></h2>
      <div class="card flat">
        <p class="note">选择备份存档和邮箱地址，列出其中的邮件，可按需恢复单封邮件。${escHtml(uiDocText(mailboxListProps.description||""))}</p>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <select id="mbm_archive" title="${t("Archive")}">${archiveOptions}</select>
          <input id="mbm_address" placeholder="${t("Account address")}" style="flex:1 1 220px">
          <input id="mbm_passphrase" type="password" placeholder="${t("only for an encrypted archive")}" autocomplete="off" style="flex:1 1 180px">
          <input id="mbm_folder" placeholder="${t("Into this folder (empty: the one it was in)")}" style="flex:1 1 220px">
          <button class="btn" data-act="mailboxlist">${t("List the archive's messages")}</button>
        </div>
        <div class="err" id="err_mailboxlist"></div>
        <div id="mbm_list"></div>
      </div></div>
    <div class="sect"><h2>${t("Status")} <code class="muted">GET /api/v1/backup</code></h2>
      <div class="card flat">
        ${statusError?'<div class="err">'+escHtml(statusError)+'</div>':
          '<p class="note">'+(status.status?escHtml(backupDisplayStatus(status.status)):t("No failure recorded."))+'</p>'+
          '<pre id="backupLog">'+escHtml(log.join("\n")||t("(the backup log is empty)"))+'</pre>'}
        <div class="row" style="margin-top:12px"><button class="btn ghost sm" data-act="backupstatus">${t("Re-read status")}</button></div>
      </div></div></div>`;
}
async function startBackup(){
  setErr("err_backupstart","");
  try{await api("/api/v1/backup",{method:"POST"});toast(t("Backup started"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_backupstart",e.message);}
}
/* The two refusals this page makes itself - no archive named, nothing chosen -
   are the ones that would otherwise cost a round trip to be told the same
   thing. Everything else is the server's own sentence, shown as it is: an
   encrypted archive with no passphrase, a wrong passphrase, a part the archive
   does not hold. */
async function startRestore(){
  setErr("err_backuprestore","");
  let body;
  try{body=readForm("restore",properties("/api/v1/backup/restore","post"),{});}
  catch(e){setErr("err_backuprestore",e.message);return;}
  if(!body.file){setErr("err_backuprestore",t("Give the path of the archive on the server."));return;}
  if(!body.restore_settings&&!body.restore_domains&&!body.restore_messages){
    setErr("err_backuprestore",t("Choose what to restore: the settings, the domains, or the messages with them."));return;}
  if(!await deckConfirm(t("Restore this archive over what is on this server now? Everything it restores is replaced."))) return;
  try{await api("/api/v1/backup/restore",{method:"POST",body:JSON.stringify(body)});toast(t("Restore started"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_backuprestore",e.message);}
}
async function clearBackupPassphrase(){
  setErr("err_set_backup","");
  if(!await deckConfirm(t("Stop encrypting the backup? The archives already written stay encrypted and still need their passphrase."))) return;
  try{await api("/api/v1/settings/backup",{method:"PUT",body:JSON.stringify({encryption_passphrase:""})});
    toast(t("Backups from now on are not encrypted"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_set_backup",e.message);}
}
/* One mailbox, or one message, from an archive in the backup destination.
   The archive is chosen from the listing - never typed as a path - and the
   two refusals the page makes itself are the ones that would cost a round
   trip to be told: no archive, no address. Replace is confirmed in the words
   that say what it destroys; merge is confirmed too, since it writes into
   somebody's mailbox. What became of the job is read back from its status
   route and shown under the button, and can be read again while it runs. */
function mailboxRoute(archive,address,suffix){
  return "/api/v1/backup/"+encodeURIComponent(archive)+"/mailboxes/"+encodeURIComponent(address)+(suffix||"");
}
function outcomeHtml(o){
  const line=tf("Job {0} is {1}: {2} folders, {3} messages added, {4} skipped as still in the mailbox, {5} failed.",o.job,backupDisplayStatus(o.state),o.folders,o.added,o.skipped,o.failed);
  return `<p class="note" id="mbr_outcome_text" style="margin-top:12px">${escHtml(line)}${o.error?" "+escHtml(o.error):""}</p>
    <div class="row"><button class="btn ghost sm" data-act="mailboxrestorestatus" data-job="${escHtml(String(o.job))}">${t("Re-read the outcome")}</button></div>`;
}
async function readMailboxRestoreOutcome(job){
  setErr("err_mailboxrestore","");
  try{const o=await api("/api/v1/backup/restore-mailbox/"+encodeURIComponent(job));$("#mbr_outcome").innerHTML=outcomeHtml(o);}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mailboxrestore",e.message);}
}
async function startMailboxRestore(){
  setErr("err_mailboxrestore","");
  const archive=$("#mbr_archive").value,address=$("#mbr_address").value.trim(),passphrase=$("#mbr_passphrase").value;
  const mode=$("#mbr_mode_replace").checked?"replace":"merge";
  if(!archive){setErr("err_mailboxrestore",t("Choose an archive from the backup destination."));return;}
  if(!address){setErr("err_mailboxrestore",t("Give the address of the account whose mailbox to restore."));return;}
  const question=mode==="replace"
    ?tf("Replace the mailbox of {0} with the archive's? Every folder is emptied first: mail that arrived since the backup is gone, kept only for RecoverDeletedDays, which is off by default.",address)
    :tf("Merge the archive's folders and messages into the mailbox of {0}? Nothing already there is removed.",address);
  if(!await deckConfirm(question)) return;
  const body={mode:mode};
  if(passphrase)body.passphrase=passphrase;
  try{const a=await api(mailboxRoute(archive,address,"/restore"),{method:"POST",body:JSON.stringify(body)});
    toast(t("Mailbox restore started"));$("#mbr_passphrase").value="";await readMailboxRestoreOutcome(a.job);}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mailboxrestore",e.message);}
}
async function listArchivedMailbox(){
  setErr("err_mailboxlist","");
  const archive=$("#mbm_archive").value,address=$("#mbm_address").value.trim(),passphrase=$("#mbm_passphrase").value;
  if(!archive){setErr("err_mailboxlist",t("Choose an archive from the backup destination."));return;}
  if(!address){setErr("err_mailboxlist",t("Give the address of the account whose mailbox to restore."));return;}
  try{
    const opts={};
    if(passphrase)opts.headers={"X-hMailServer-Backup-Passphrase":passphrase};
    const listing=await api(mailboxRoute(archive,address),opts);
    const rows=[];
    (listing.folders||[]).forEach(f=>(f.messages||[]).forEach(m=>rows.push(m)));
    const note=listing.subjects?"":'<p class="note">'+escHtml(listing.subjects_note||"")+"</p>";
    $("#mbm_list").innerHTML=note+(rows.length?`<table class="grid" style="margin-top:12px"><thead><tr><th>${t("Folder")}</th><th>${t("Subject")}</th><th>${t("From")}</th><th>${t("When")}</th><th>${t("Size")}</th><th></th></tr></thead><tbody>`+
      rows.map(m=>`<tr><td>${escHtml(m.folder)}</td><td>${escHtml(m.subject||"")}</td><td>${escHtml(m.from||"")}</td><td>${escHtml(m.date||"")}</td><td>${escHtml(String(m.size))}</td>
        <td style="text-align:right;white-space:nowrap"><button class="btn sm" data-act="messagerestore" data-id="${escHtml(String(m.id))}" data-folder="${escHtml(m.folder)}">${t("Restore")}</button></td></tr>`).join("")+"</tbody></table>"
      :'<p class="note">'+t("The archive holds no messages for this account.")+"</p>");
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mailboxlist",e.message);}
}
async function restoreArchivedMessage(id,archivedFolder){
  setErr("err_mailboxlist","");
  const archive=$("#mbm_archive").value,address=$("#mbm_address").value.trim(),passphrase=$("#mbm_passphrase").value;
  const folder=$("#mbm_folder").value.trim();
  if(!await deckConfirm(tf("Put this message back into the mailbox of {0}?",address))) return;
  const body={message:Number(id)};
  if(folder)body.folder=folder;
  if(passphrase)body.passphrase=passphrase;
  try{const a=await api(mailboxRoute(archive,address,"/restore"),{method:"POST",body:JSON.stringify(body)});
    toast(t("Message restore started"));await readMailboxRestoreOutcome(a.job);}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_mailboxlist",e.message);}
}

/* ---------- Server messages ----------
   The texts the server puts in the mail it writes itself, Settings.ServerMessages
   over COM: a fixed set, named, each editable. GET /api/v1/settings/messages
   lists them and PUT /api/v1/settings/messages/{name} changes one text, in use
   at once; the name is the table's own and is not changed here, which is why
   it is the row's caption and not a control. Each row is a text area with its
   own Save, which sends the text only when it differs from what was read and
   then reads the messages again. */
async function renderMessages(){
  await loadSpec();
  cache.messages=asList(await api("/api/v1/settings/messages"),"messages");
  const rows=cache.messages.map((m,i)=>`
    <div class="fr" data-k="${escHtml((m.name+" "+m.text).toLowerCase())}">
      <div class="lab"><b>${escHtml(m.name)}</b><code>${escHtml(m.name)}</code></div>
      <div class="ctl"><textarea id="msg_${i}" rows="3">${escHtml(m.text)}</textarea>
        <div class="row" style="margin-top:8px"><button class="btn ghost sm" data-act="msgsave" data-name="${escHtml(m.name)}" data-i="${i}">${t("Save")}</button>
        <div class="err" id="err_msg_${i}"></div></div></div>
    </div>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/settings/messages","get").description||""))} ${escHtml(uiDocText(operation("/api/v1/settings/messages/{name}","put").description||""))}</p>
      <input id="msgFilter" placeholder="${t("Filter messages by name or text")}" style="width:100%">
    </div>
    <div class="sect"><div class="card flat"><div class="form">${rows||'<div class="empty">'+t("No server messages.")+'</div>'}</div></div></div></div>`;
  $("#msgFilter").oninput=filterRows;
}
async function saveMessage(name,i){
  setErr("err_msg_"+i,"");
  const el=document.getElementById("msg_"+i);
  const was=cache.messages[i]?cache.messages[i].text:undefined;
  if(!el||el.value===was){toast(t("Nothing changed"));return;}
  try{
    await api("/api/v1/settings/messages/"+encodeURIComponent(name),{method:"PUT",body:JSON.stringify({text:el.value})});
    toast(tf("Message saved: {0}",name));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_msg_"+i,e.message);}
}

