/* ---------- Groups ----------
   A group is a named set of accounts that a folder permission can name as one
   principal - Settings.Groups, Group and Group.Members over COM, the desktop
   Control Panel's Groups page - and it was the last thing the parity census
   counted as writable over REST and reachable from no view here.

   The shape is the domains view's, because the resource has the same shape: a
   table with a create under it, and an editor holding the name as a form row
   built from the create's own schema and the accounts in the group as a small
   list of their own, since a membership is a pair and not a property of
   either side. A member is named by the address, which is what an
   administrator has in front of them; the route takes account_id or account
   and refuses an address that is no account by name, so a typo is the
   server's sentence beside the box rather than a guess made here. */
const GROUP_HINTS={name:K("The group's name, as a folder permission names it. At most 255 characters, and no two groups share one.")};
function groupProps(){
  const props=properties("/api/v1/groups","post"),out={};
  Object.keys(props).forEach(k=>{out[k]=Object.assign({},props[k]);if(!out[k].description&&GROUP_HINTS[k])out[k].description=GROUP_HINTS[k];});
  return out;
}
async function renderGroups(){
  await loadSpec();
  cache.groups=asList(await api("/api/v1/groups"),"groups");
  if(editing&&editing.kind==="group"){await openGroup(editing.id);return;}
  const rows=cache.groups.map(g=>`
    <tr><td><b>${escHtml(g.name)}</b><div class="hint muted">${tf("id {0}",escHtml(g.id))}</div></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn ghost sm" data-act="groupedit" data-id="${escHtml(g.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="groupdel" data-id="${escHtml(g.id)}" data-name="${escHtml(g.name)}">${t("Delete")}</button>
          <div class="err" id="err_group_${escHtml(g.id)}"></div></td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/groups","get").description||""))}</p>
      ${noticeHtml("info",operation("/api/v1/groups/{id}","delete").description||"")}
      <div class="tablewrap"><table><thead><tr><th>${t("Group")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="2" class="empty">'+t("No groups. A group is a named set of accounts that a folder permission can name as one principal.")+'</td></tr>'}</tbody></table></div>
    </div>
    <div class="sect"><h2>${t("New group")}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/groups","post").description||""))}</p>
        <div class="row" data-enter="groupnew">
          <input id="newGroup" placeholder="${t("Group name")}" aria-label="${t("Group name")}" style="flex:1;min-width:220px">
          <button class="btn" data-act="groupnew">${t("Create group")}</button>
          <div class="err" id="err_groupnew"></div>
        </div>
      </div></div></div>`;
}
async function createGroup(){
  setErr("err_groupnew","");
  const name=$("#newGroup").value.trim();
  if(!name){setErr("err_groupnew",t("A group name is required."));return;}
  try{
    await api("/api/v1/groups",{method:"POST",body:JSON.stringify({name:name})});
    toast(tf("Group created: {0}",name));
    // Read back, and then into the editor of the group as the server holds
    // it, which is where its accounts are put in.
    cache.groups=asList(await api("/api/v1/groups"),"groups");
    const made=cache.groups.filter(g=>g.name===name)[0];
    if(made)await openGroup(made.id);else await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_groupnew",e.message);}
}
async function openGroup(id){
  const existing=cache.groups.filter(g=>Number(g.id)===Number(id))[0];
  if(!existing){editing=null;await render();return;}
  editing={kind:"group",id:Number(existing.id),values:JSON.parse(JSON.stringify(existing)),members:[],memberError:""};
  try{editing.members=asList(await api("/api/v1/groups/"+editing.id+"/members"),"members");}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}editing.memberError=e.message;}
  renderGroupEditor();
}
function groupMembersHtml(){
  const list=editing.members.map(m=>`
    <div class="row erow"><code style="flex:1">${escHtml(m.account||tf("id {0}",m.account_id))}</code>
      <button class="btn ghost sm" data-act="memberdel" data-account="${escHtml(m.account_id)}" data-address="${escHtml(m.account||m.account_id)}">${t("Remove")}</button>
      <div class="err" id="err_member_${escHtml(m.account_id)}"></div></div>`).join("")
    ||'<div class="note">'+t("No accounts in this group.")+'</div>';
  return `<p class="note">${escHtml(uiDocText(operation("/api/v1/groups/{id}/members","get").description||""))}</p>
    ${list}
    <div class="row" style="margin-top:14px" data-enter="memberadd">
      <input id="newMember" placeholder="${t("The address of an account to add")}" aria-label="${t("The address of an account to add")}" style="flex:1;min-width:220px">
      <button class="btn ghost sm" data-act="memberadd">${t("Add account")}</button>
      <div class="err" id="err_member">${escHtml(editing.memberError||"")}</div>
    </div>`;
}
function renderGroupEditor(){
  $("#content").innerHTML=`<div class="view">
    <button class="btn ghost sm" data-act="groups">${t("‹ All groups")}</button>
    <div class="sect"><h2>${tf("Group {0}",escHtml(editing.values.name))}</h2>
      <div class="card flat">
        <p class="note">${escHtml(uiDocText(operation("/api/v1/groups/{id}","put").description||""))}</p>
        <div class="form">${formHtml("group",groupProps(),editing.values,{required:requiredOf("/api/v1/groups","post")})}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-act="groupsave">${t("Save group")}</button>
          <button class="btn ghost" data-act="cancel">${t("Cancel")}</button>
          <div class="err" id="err_groupedit"></div>
        </div>
      </div></div>
    <div class="sect"><h2>${t("Members")}</h2>
      <div class="card flat">${groupMembersHtml()}</div></div></div>`;
}
async function saveGroup(){
  setErr("err_groupedit","");
  let body;
  try{body=readForm("group",groupProps(),{});}catch(e){setErr("err_groupedit",e.message);return;}
  try{
    await api("/api/v1/groups/"+editing.id,{method:"PUT",body:JSON.stringify(body)});
    toast(t("Group saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_groupedit",e.message);}
}
async function deleteGroup(id,name){
  if(!await deckConfirm(tf("Delete the group {0}? The accounts stay; the group, the rows that put accounts in it and every folder permission that names it go together.",name)))return;
  setErr("err_group_"+id,"");
  try{
    await api("/api/v1/groups/"+id,{method:"DELETE"});
    editing=null;toast(t("Group deleted"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_group_"+id,e.message);}
}
async function addGroupMember(){
  setErr("err_member","");
  const address=$("#newMember").value.trim();
  if(!address){setErr("err_member",t("An account address is required."));return;}
  try{
    await api("/api/v1/groups/"+editing.id+"/members",{method:"POST",body:JSON.stringify({account:address})});
    toast(tf("{0} added to the group",address));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_member",e.message);}
}
async function deleteGroupMember(accountId,address){
  setErr("err_member_"+accountId,"");
  try{
    await api("/api/v1/groups/"+editing.id+"/members/"+accountId,{method:"DELETE"});
    toast(tf("{0} removed from the group",address));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_member_"+accountId,e.message);}
}

