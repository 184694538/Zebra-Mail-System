/* ---------- Quarantine ----------
   What the filters held back rather than delivered, newest first, grouped the
   way a burst arrives - by the organization's domain of the sender or of the
   HELO name, which the server computes, or not at all - and each group folds.
   Every message, every group and the header carry the same four actions:
   release, delete, whitelist the sender and release, blacklist the sender and
   delete; the header's act on every checked message, through one request to
   POST /api/v1/quarantine/bulk that answers for each message. Delete asks one
   question whose default is No, in a dialog of the page's own, because the
   browser's confirm() defaults to OK. Whitelist and blacklist ask which list -
   the sender's address on the server's allow and block list, or the domain on
   the domain white and black list - and show what the server says it would
   write before anything is. A sort orders the messages inside each group. The
   headers and a plain-text preview open in a panel, as text: nothing a held
   message says is ever drawn as HTML. The search box above narrows the rows
   as it does everywhere - and while the list holds only the newest thousand,
   where it found nothing older than they (review finding F261), it asks the
   server over every held message, GET /api/v1/quarantine?q=, a moment after
   the typing stops, and draws the rows that answers whole, since the server
   matched them. What an action came to - what a release or a delete left where
   it was, and why, or what Remove expired removed - is a line of its own under
   the one that says how many are held and what the search found, which the
   search writes as it goes and would otherwise write over it. */
const Q={items:[],group:"sender",sort:null,desc:false,folded:new Set(),checked:new Set(),ask:null,list:null,said:"",
  outcome:"",outcomeFor:"",
  held:0,canSearch:false,found:null,foundFor:"",foundTotal:0,searchError:"",searchTimer:null,typed:""};
const QICON={
  release:'<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.1 8.2l2 2 3.9-4.3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  delete:'<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  allow:'<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path class="ql-good" d="M5 6h6M5 8h6M5 10h6" fill="none" stroke-width="1.4" stroke-linecap="round"/></svg>',
  block:'<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false"><rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2" fill="currentColor" stroke="currentColor" stroke-width="1.3"/><path class="ql-bad" d="M5 6h6M5 8h6M5 10h6" fill="none" stroke-width="1.4" stroke-linecap="round"/></svg>',
  headers:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><rect x="2.5" y="1.8" width="11" height="12.4" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M5 5h6M5 7.5h6" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
  preview:'<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M1.5 8s2.4-4.4 6.5-4.4S14.5 8 14.5 8s-2.4 4.4-6.5 4.4S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="8" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
};
async function renderQuarantine(){
  // What the action that asks for this reload came to, said just before it
  // (Q.said), is the outcome's line until the next action is sent, the search's
  // text is changed, Refresh is pressed or the view is opened again - each of
  // which finds Q.said empty here or clears the line itself.
  const said=Q.said;Q.said="";
  // The newest thousand, and how many are held in all, which the bare list
  // does not say. A server older than the search answers the bare list, and
  // that list is searched as it is drawn.
  const answer=await api("/api/v1/quarantine?offset=0&limit=1000");
  Q.items=asList(answer,"messages");
  Q.canSearch=!!answer&&!Array.isArray(answer)&&typeof answer.held==="number";
  Q.held=Q.canSearch?answer.held:Q.items.length;
  // A check survives a refresh for as long as its message is still held - in
  // the list, or in the answer to a search, which is asked again below.
  const present=new Set(Q.items.concat(Q.found||[]).map(m=>String(m.id)));
  Array.from(Q.checked).forEach(id=>{if(!present.has(id))Q.checked.delete(id);});
  Q.outcome=said;Q.outcomeFor=qBoxText();
  clearTimeout(Q.searchTimer);Q.found=null;Q.typed="";Q.searchError="";
  drawQuarantine();
}
/* The search box's text, as the quarantine reads it. */
function qBoxText(){const box=$("#deckSearch");return box?String(box.value||"").trim():"";}
/* The outcome's line, drawn again without the table: an action sent clears it
   before its answer comes, and a change of the search's text clears it. */
function qDrawOutcome(){const line=$("#qOutcome");if(line){line.textContent=Q.outcome;line.hidden=!Q.outcome;}}
/* The messages the table draws: the server's answer to the search in the box
   while it is the answer for that text, the list otherwise. */
function qList(){return Q.found&&Q.foundFor===Q.typed?Q.found:Q.items;}
/* The search box over the quarantine, read as it changes (searchHook, which
   filterRows calls): while the list holds only the newest thousand, its text
   is asked of the server a moment after the typing stops; until the answer
   comes the list's own rows are narrowed as everywhere. */
function qSearchTyped(){
  const text=qBoxText();
  // An action's outcome was said under the text the box held then: the text
  // changed takes it away, and the reload's own asking again, the text as it
  // was, leaves it.
  if(Q.outcome&&text!==Q.outcomeFor){Q.outcome="";qDrawOutcome();}
  if(text===Q.typed)return;
  Q.typed=text;
  clearTimeout(Q.searchTimer);
  Q.searchError="";
  const asks=Q.canSearch&&Q.items.length<Q.held&&text!==""&&text.length<=255;
  if(!asks){
    if(Q.found){Q.found=null;drawQuarantine();}
    else{const said=$("#qSaid");if(said)said.textContent=qSaid();}
    return;
  }
  if(Q.found&&Q.foundFor===text){drawQuarantine();return;}
  // The answer drawn is another text's: the list's own rows take its place
  // until this text's answer comes, narrowed by the box, so that the rows
  // shown are what qList() holds (the redraw's own call back here returns at
  // once, the text being Q.typed already).
  if(Q.found)drawQuarantine();
  else{const said=$("#qSaid");if(said)said.textContent=qSaid();}
  Q.searchTimer=setTimeout(()=>{qSearchServer(text);},400);
}
async function qSearchServer(text){
  try{
    const answer=await api("/api/v1/quarantine?q="+encodeURIComponent(text)+"&limit=1000");
    if(Q.typed!==text||view!=="quarantine")return;
    Q.found=asList(answer,"messages");
    Q.foundFor=text;
    Q.foundTotal=answer&&typeof answer.total==="number"?answer.total:Q.found.length;
    // The checks of messages no longer held, in the list or the answer, go.
    const present=new Set(Q.items.concat(Q.found).map(m=>String(m.id)));
    Array.from(Q.checked).forEach(id=>{if(!present.has(id))Q.checked.delete(id);});
  }catch(e){
    if(Q.typed!==text||view!=="quarantine")return;
    Q.found=null;
    Q.searchError=(e&&e.message)||"";
  }
  drawQuarantine();
}
/* What the line over the table says: how many are held, and while the list
   holds only the newest thousand that a search looks through every one - or
   what the search of them came to. */
function qSaid(){
  const held=Q.held||Q.items.length;
  const partial=Q.canSearch&&Q.items.length<held;
  if(partial&&Q.typed!==""&&Q.typed.length<=255){
    if(Q.searchError)return tf("Could not search every held message on the server, so the search looks at the most recent only: {0}",Q.searchError);
    if(Q.found&&Q.foundFor===Q.typed)return Q.foundTotal>Q.found.length
      ?tf("Searched every held message on the server. Matches: {0}; shown here, the most recent: {1}.",Q.foundTotal,Q.found.length)
      :tf("Searched every held message on the server. Matches: {0}.",Q.foundTotal);
    return t("Searching every held message on the server…");
  }
  if(partial)return tf("Held: {0}. Listed here: the most recent {1}; a search looks through every held message.",held,Q.items.length);
  return held===1?t("1 message held."):tf("{0} messages held.",held);
}
function qKey(m){return String((Q.group==="helo"?m.helo_domain:m.sender_domain)||"").toLowerCase();}
function qGroups(){
  // The server lists newest first, so the order in which the keys are first
  // met is the order of each group's newest message.
  const order=[],members={};
  qList().forEach(m=>{const k=qKey(m);if(!members[k]){members[k]=[];order.push(k);}members[k].push(m);});
  return order.map(k=>({key:k,members:members[k]}));
}
function qSorted(list){
  if(!Q.sort)return list.slice();
  const text=v=>String(v||"").toLowerCase();
  const key=Q.sort==="score"?(m=>Number(m.score)||0):Q.sort==="created"?(m=>String(m.created||"")):(m=>text(m[Q.sort]));
  const dir=Q.desc?-1:1;
  return list.slice().sort((a,b)=>{const x=key(a),y=key(b);return (x<y?-1:x>y?1:(Number(a.id)-Number(b.id)))*dir;});
}
function qOrdered(){return Q.group==="none"?qSorted(qList()):[].concat(...qGroups().map(g=>qSorted(g.members)));}
function qState(members){
  let on=0;members.forEach(m=>{if(Q.checked.has(String(m.id)))on++;});
  return on===0?"false":on===members.length?"true":"mixed";
}
function qBox(state,label,attrs){
  return '<button class="qbox" role="checkbox" aria-checked="'+state+'" data-act="qcheck" '+attrs+' aria-label="'+escHtml(label)+'" title="'+escHtml(label)+'"></button>';
}
function qActs(scope,attrs,tips){
  if(!may("manage_quarantine"))return "";
  const one=(what,cls,tip)=>'<button class="qact '+cls+'" data-act="qact" data-do="'+what+'" data-scope="'+scope+'" '+attrs+' title="'+escHtml(tip)+'" aria-label="'+escHtml(tip)+'">'+QICON[what]+'</button>';
  // Whitelist and blacklist write the server's own lists, which the server asks
  // manage_settings for beside manage_quarantine; a role without it is not
  // offered what it would be refused.
  const lists=may("manage_settings")?one("allow","",tips[2])+one("block","",tips[3]):"";
  return one("release","good",tips[0])+one("delete","bad",tips[1])+lists;
}
function qMessageRow(m,indented,keep){
  const id=String(m.id);
  const recipients=String(m.recipients||"").split(",").map(r=>r.trim()).filter(Boolean);
  const shown=recipients.length>1?tf("{0} + {1} more",recipients[0],recipients.length-1):(recipients[0]||"");
  const sender=String(m.sender||"")||"<>";
  const helo=String(m.helo||"");
  const subject=String(m.subject||"")||t("(no subject)");
  const mail=may("view_mailbox");
  return '<tr class="qmsg'+(indented?" in":"")+'"'+(keep?' data-keep="1"':'')+'><td class="qc">'+qBox(Q.checked.has(id)?"true":"false",t("Check this message"),'data-id="'+escHtml(id)+'"')+'</td>'+
    '<td class="qa">'+qActs("row",'data-id="'+escHtml(id)+'"',[t("Release"),t("Delete"),t("Whitelist the sender, then release"),t("Blacklist the sender, then delete")])+'</td>'+
    '<td style="white-space:nowrap">'+escHtml(m.created||"")+'</td>'+
    '<td class="qtrim" title="'+escHtml(helo||t("No HELO name was recorded"))+'">'+(mail?'<button class="qmini" data-act="qread" data-what="headers" data-id="'+escHtml(id)+'" title="'+escHtml(t("Show the headers"))+'" aria-label="'+escHtml(t("Show the headers"))+'">'+QICON.headers+'</button> ':"")+'<span>'+escHtml(helo||"—")+'</span></td>'+
    '<td class="qtrim" title="'+escHtml(sender)+'">'+escHtml(sender)+'</td>'+
    '<td class="qtrim" title="'+escHtml(recipients.join("\n"))+'">'+escHtml(shown)+'</td>'+
    '<td class="num">'+escHtml(String(Number(m.score)||0))+'</td>'+
    '<td class="qtrim" title="'+escHtml(subject)+'">'+(mail?'<button class="qmini" data-act="qread" data-what="preview" data-id="'+escHtml(id)+'" title="'+escHtml(t("Preview the text"))+'" aria-label="'+escHtml(t("Preview the text"))+'">'+QICON.preview+'</button> ':"")+'<span>'+escHtml(subject)+'</span>'+
      '<span class="qreason">'+escHtml(tf("Held because: {0}",m.reason||""))+'</span></td></tr>';
}
function drawQuarantine(){
  const head=(col,label,cls)=>{
    const on=Q.sort===col;
    return '<th'+(cls?' class="'+cls+'"':"")+' aria-sort="'+(on?(Q.desc?"descending":"ascending"):"none")+'"><button class="thsort" data-act="qsort" data-col="'+col+'">'+escHtml(label)+(on?(Q.desc?" ↓":" ↑"):"")+'</button></th>';
  };
  let body="";
  const shown=qList();
  const found=shown===Q.found;
  if(Q.group==="none"){
    body=qSorted(shown).map(m=>qMessageRow(m,false,found)).join("");
  }else{
    qGroups().forEach(g=>{
      const title=g.key||t("(no domain)");
      const open=!Q.folded.has(g.key);
      const count=g.members.length===1?t("1 message"):tf("{0} messages",g.members.length);
      body+='<tr class="qgroup"'+(found?' data-keep="1"':'')+'><td class="qc">'+qBox(qState(g.members),tf("Check every message from {0}",title),'data-key="'+escHtml(g.key)+'"')+'</td>'+
        '<td class="qa">'+qActs("group",'data-key="'+escHtml(g.key)+'"',[t("Release this group"),t("Delete this group"),t("Whitelist this group's senders, then release"),t("Blacklist this group's senders, then delete")])+'</td>'+
        '<td colspan="6"><button class="qfold" data-act="qfold" data-key="'+escHtml(g.key)+'" aria-expanded="'+(open?"true":"false")+'" title="'+escHtml(open?t("Fold this group"):t("Unfold this group"))+'" aria-label="'+escHtml(open?t("Fold this group"):t("Unfold this group"))+'">'+(open?"▾":"▸")+'</button> '+escHtml(title)+' <span class="muted">'+escHtml(count)+'</span></td></tr>';
      if(open)body+=qSorted(g.members).map(m=>qMessageRow(m,true,found)).join("");
    });
  }
  const total=shown.length;
  const manage=may("manage_quarantine");
  const option=(v,label)=>'<option value="'+v+'"'+(Q.group===v?" selected":"")+'>'+escHtml(label)+'</option>';
  $("#content").innerHTML=`<div class="view"><div class="card view">
    <div class="row" style="margin-bottom:12px">
      <label class="row" for="qGroup">${t("Group by")}</label>
      <select id="qGroup">${option("sender",t("Sender domain"))}${option("helo",t("HELO domain"))}${option("none",t("None"))}</select>
      <span style="flex:1"></span>
      ${manage?`<button class="btn ghost sm" data-act="qexpire">${t("Remove expired")}</button>`:""}
      <button class="btn ghost sm" data-act="qrefresh">${t("Refresh")}</button>
      ${viewShown("settings")?`<button class="btn ghost sm" data-act="qdigest">${t("Digest settings")}</button>`:""}
    </div>
    <p class="note">${escHtml(operation("/api/v1/quarantine","get").summary||"")}. ${escHtml(uiDocText(operation("/api/v1/quarantine/{id}/release","post").description||""))}</p>
    <p class="note" id="qSaid">${escHtml(qSaid())}</p>
    <p class="note" id="qOutcome" role="status"${Q.outcome?"":" hidden"}>${escHtml(Q.outcome)}</p>
    <div class="err" id="err_quarantine"></div>
    <div class="tablewrap"><table class="qtable"><thead><tr>
      <th class="qc">${total?qBox(qState(shown),t("Check every message"),'data-all="1"'):""}</th>
      <th class="qa">${total?qActs("checked","",[t("Release the checked messages"),t("Delete the checked messages"),t("Whitelist the checked messages' senders, then release"),t("Blacklist the checked messages' senders, then delete")]):""}</th>
      ${head("created",t("Held"))}${head("helo",t("HELO"))}${head("sender",t("Sender"))}${head("recipients",t("Recipients"))}${head("score",t("Score"),"num")}${head("subject",t("Subject"))}
    </tr></thead>
    <tbody>${body||'<tr><td colspan="8" class="empty">'+(found?t("No held message matches the search."):t("Nothing is held. ✦"))+'</td></tr>'}</tbody></table></div>
    </div></div>`;
  $("#qGroup").onchange=()=>{Q.group=$("#qGroup").value;drawQuarantine();};
  searchHook=()=>qSearchTyped();
  filterRows();
}
function qCheck(d){
  if(d.all){const all=qState(qList())==="true";Q.checked.clear();if(!all)qList().forEach(m=>Q.checked.add(String(m.id)));}
  else if(d.key!==undefined){
    const g=qGroups().filter(x=>x.key===d.key)[0];if(!g)return;
    const all=qState(g.members)==="true";
    g.members.forEach(m=>{if(all)Q.checked.delete(String(m.id));else Q.checked.add(String(m.id));});
  }else if(Q.checked.has(d.id))Q.checked.delete(d.id);
  else Q.checked.add(d.id);
  drawQuarantine();
}
function qSort(col){
  // The same column again turns the order round; Held and Score start with the
  // largest, which is what anybody sorting by them wants first.
  if(Q.sort===col)Q.desc=!Q.desc;
  else{Q.sort=col;Q.desc=col==="created"||col==="score";}
  drawQuarantine();
}
function qFold(key){if(Q.folded.has(key))Q.folded.delete(key);else Q.folded.add(key);drawQuarantine();}
function qIds(d){
  if(d.scope==="row")return [Number(d.id)];
  if(d.scope==="group"){const g=qGroups().filter(x=>x.key===d.key)[0];return g?g.members.map(m=>Number(m.id)):[];}
  return qOrdered().filter(m=>Q.checked.has(String(m.id))).map(m=>Number(m.id));
}
/* How many of these messages the search box hides. It hides rows, not checks:
   a message checked before the search narrowed the list, or taken in by the
   header's or a group's box while it did, is still checked. A folded group's
   messages have no row, and are hidden when the group's own row is. */
function qUnseen(ids){
  const hidden=new Set();
  document.querySelectorAll("#content tbody tr").forEach(r=>{
    if(!r.hidden)return;
    const b=r.querySelector('button[data-act="qcheck"]');if(!b)return;
    if(b.dataset.id!==undefined)hidden.add(String(b.dataset.id));
    else if(b.dataset.key!==undefined&&Q.folded.has(b.dataset.key))qGroups().filter(g=>g.key===b.dataset.key).forEach(g=>g.members.forEach(m=>hidden.add(String(m.id))));
  });
  return ids.filter(id=>hidden.has(String(id))).length;
}
/* The page's own question, because the browser's confirm() answers OK to Enter:
   No has the keyboard when the dialog opens, Escape is No, and Tab stays in it. */
function qAsk(title,text,yes){
  return new Promise(resolve=>{
    qAnswer(false);
    Q.ask=resolve;
    const host=document.createElement("div");
    host.id="qAsk";host.className="overlay";host.qBack=document.activeElement;
    host.innerHTML='<div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="qAskTitle" aria-describedby="qAskText">'+
      '<h2 id="qAskTitle">'+escHtml(title)+'</h2><p id="qAskText" class="note" style="white-space:pre-line">'+escHtml(text)+'</p>'+
      '<div class="row"><button class="btn ghost" data-act="qaskno">'+t("No")+'</button><button class="btn danger" data-act="qaskyes">'+escHtml(yes)+'</button></div></div>';
    host.onkeydown=e=>qTrap(e,host,()=>qAnswer(false));
    $("#content").appendChild(host);
    host.querySelector('[data-act="qaskno"]').focus();
  });
}
function qAnswer(yes){
  const host=document.getElementById("qAsk");
  if(host&&host.parentNode){host.parentNode.removeChild(host);qBack(host);}
  const r=Q.ask;Q.ask=null;
  if(r)r(!!yes);
}
/* A dialog closed gives the keyboard back to what had it when it opened - the
   icon that opened it - as the shortcut list does; the dialog took the focus
   with it, and a browser puts it on the page's body. After Yes the view is
   drawn again and the icon is gone, and there is nothing to give it back to. */
function qBack(host){const b=host&&host.qBack;if(b&&b.isConnected&&b.focus)b.focus();}
function qTrap(e,host,escape){
  // The page's own keys - Enter opening the row under the cursor, / and ? -
  // act on what the dialog covers, so none of them is let past it.
  e.stopPropagation();
  // F1 is the page's help, and the page's handler is not reached from here:
  // the browser's own help is kept from opening, and the pane waits.
  if(e.key==="F1"){e.preventDefault();return;}
  if(e.key==="Escape"){e.preventDefault();escape();return;}
  const radio=e.target&&e.target.closest?e.target.closest(".qpick"):null;
  if(radio&&(e.key==="ArrowDown"||e.key==="ArrowUp"||e.key==="ArrowLeft"||e.key==="ArrowRight")){
    const other=Array.from(host.querySelectorAll(".qpick")).filter(b=>b!==radio)[0];
    if(other){e.preventDefault();qListPick(other.dataset.list);other.focus();}
    return;
  }
  if(e.key!=="Tab")return;
  const all=Array.from(host.querySelectorAll("button,select,input,pre[tabindex]")).filter(x=>!x.hidden&&!x.disabled);
  if(!all.length)return;
  const first=all[0],last=all[all.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
}
/* Which list, asked of the server before anything is written: a dry run of the
   same request answers the entries it would write and the messages it could
   not list. A public suffix is written only after the box says so. Blacklist
   then deletes, so Cancel has the keyboard, as for every delete here. */
function qListDialog(ids,action){
  return new Promise(resolve=>{
    qListClose(null);
    const block=action==="block";
    const helo=Q.group==="helo";
    Q.list={ids:ids,action:action,resolve:resolve,choice:"address",suffixOk:false,usable:false,domainFrom:helo?"helo":"sender"};
    const host=document.createElement("div");
    host.id="qList";host.className="overlay";host.qBack=document.activeElement;
    const pick=(v,label,note)=>'<button class="qpick" role="radio" data-act="qlistpick" data-list="'+v+'" aria-checked="'+(v==="address"?"true":"false")+'">'+escHtml(label)+'</button><p class="note" style="margin:2px 0 10px 26px">'+escHtml(note)+'</p>';
    host.innerHTML='<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="qListTitle">'+
      '<h2 id="qListTitle">'+escHtml(block?t("Blacklist and delete"):t("Whitelist and release"))+'</h2>'+
      '<div role="radiogroup" aria-labelledby="qListTitle">'+
      pick("address",t("The sender's address, on the server's allow and block list"),block
        ?t("Read at delivery, for every recipient: a blocked sender's mail is held for them where the quarantine is on, and marked as spam where it is not.")
        :t("Read at delivery, for every recipient: an allowed sender's mail is delivered unmarked, and the accounts' own spam thresholds do not run. A message the server-wide spam score holds during the SMTP conversation is still held; the domain list is the one that stops that."))+
      pick("domain",helo?t("The HELO name's domain, on the domain white and black list"):t("The sender's domain, on the domain white and black list"),block
        ?t("Read at MAIL FROM: a black domain is refused with 550 before anything else runs, for every recipient. The entry covers the organization's domain and everything beneath it.")
        :t("Read at MAIL FROM: a white domain is not greylisted, and not refused or held on the spam score, while every test still runs and the mark threshold still marks. The entry covers the organization's domain and everything beneath it."))+
      '</div><pre id="qPlan" class="qplan" tabindex="0"></pre>'+
      '<button class="qbox-line" role="checkbox" aria-checked="false" data-act="qlistsuffix" id="qSuffix" hidden>'+t("List it anyway")+'</button>'+
      '<div class="row" style="margin-top:12px"><button class="btn ghost" data-act="qlistno">'+t("Cancel")+'</button>'+
      '<button class="btn'+(block?" danger":"")+'" data-act="qlistyes" id="qListYes" disabled>'+escHtml(block?t("Blacklist and delete"):t("Whitelist and release"))+'</button></div></div>';
    host.onkeydown=e=>qTrap(e,host,()=>qListClose(null));
    $("#content").appendChild(host);
    host.querySelector('[data-act="'+(block?"qlistno":"qlistpick")+'"]').focus();
    qListPlan();
  });
}
function qListClose(answer){
  const host=document.getElementById("qList");
  if(host&&host.parentNode){host.parentNode.removeChild(host);qBack(host);}
  const l=Q.list;Q.list=null;
  if(l&&l.resolve)l.resolve(answer);
}
async function qListPlan(){
  const l=Q.list;if(!l)return;
  // Each choice asks again, and the answers can come back in either order:
  // the server answers each connection on its own worker. Only the answer
  // to the latest question is drawn; an older one is for a choice that is
  // no longer the dialog's.
  const seq=l.seq=(l.seq||0)+1;
  const plan=$("#qPlan"),yes=$("#qListYes"),box=$("#qSuffix");
  l.usable=false;l.suffixOk=false;
  box.hidden=true;box.setAttribute("aria-checked","false");
  yes.disabled=true;
  plan.textContent="…";
  const body={ids:l.ids,action:l.action,list:l.choice,dry_run:true};
  if(l.choice==="domain")body.domain_from=l.domainFrom;
  try{
    const a=await api("/api/v1/quarantine/bulk",{method:"POST",body:JSON.stringify(body)});
    if(Q.list!==l||l.seq!==seq)return;
    const outcome={add:t("will be added"),change:l.action==="block"?t("is on the list the other way, and will be changed to block"):t("is on the list the other way, and will be changed to allow"),unchanged:t("is already on the list")};
    const entries=asList(a.entries,"entries"),refused=asList(a.results,"results").filter(r=>!r.ok);
    const lines=[];
    if(entries.length){
      lines.push(t("What will be written:"));
      entries.slice(0,12).forEach(e=>lines.push("  "+tf("{0} - {1}",e.value,outcome[e.outcome]||e.outcome)));
      if(entries.length>12)lines.push("  "+tf("and {0} more",entries.length-12));
    }
    if(refused.length)lines.push(refused.length===1?tf("1 message cannot be listed and will be left where it is: {0}",refused[0].error):tf("{0} messages cannot be listed and will be left where they are. The first reason: {1}",refused.length,refused[0].error));
    const suffixes=entries.filter(e=>e.public_suffix).map(e=>e.value);
    if(suffixes.length){lines.push(tf("Warning: {0} is a public suffix. An entry for it covers every domain registered beneath it, which is almost never what is meant.",suffixes.join(", ")));box.hidden=false;}
    plan.textContent=lines.join("\n");
    l.usable=entries.length>0;
  }catch(e){
    if(e.message==="auth"){qListClose(null);signedOut(t("The session ended. Sign in again."));return;}
    if(Q.list!==l||l.seq!==seq)return;
    plan.textContent=e.message;
  }
  qListUpdate();
}
function qListUpdate(){
  const l=Q.list;if(!l)return;
  const box=$("#qSuffix");
  $("#qListYes").disabled=!(l.usable&&(box.hidden||l.suffixOk));
}
function qListPick(v){
  const l=Q.list;if(!l||l.choice===v)return;
  l.choice=v;
  document.querySelectorAll("#qList .qpick").forEach(b=>b.setAttribute("aria-checked",b.dataset.list===v?"true":"false"));
  qListPlan();
}
function qListSuffix(){
  const l=Q.list;if(!l)return;
  l.suffixOk=!l.suffixOk;
  $("#qSuffix").setAttribute("aria-checked",l.suffixOk?"true":"false");
  qListUpdate();
}
function qListYes(){
  const l=Q.list;if(!l||$("#qListYes").disabled)return;
  const choice={list:l.choice};
  if(l.choice==="domain")choice.domain_from=l.domainFrom;
  if(!$("#qSuffix").hidden&&l.suffixOk)choice.confirm_public_suffix=true;
  qListClose(choice);
}
async function qAct(d){
  setErr("err_quarantine","");
  const ids=qIds(d);
  if(!ids.length){setErr("err_quarantine",t("Check the messages first: the header's icons act on every checked message."));return;}
  const action=d.do;
  const body={ids:ids,action:action};
  // Nothing the search hides is released, listed or deleted unasked: a
  // release cannot be taken back either.
  const unseen=qUnseen(ids);
  const hiddenNote=unseen?tf("The search hides {0} of the messages this acts on ({1} in all).",unseen,ids.length):"";
  if(action==="delete"){
    const text=ids.length===1?t("Delete this held message for good?"):tf("Delete these {0} held messages for good?",ids.length);
    if(!await qAsk(t("Delete quarantined message"),(hiddenNote?hiddenNote+"\n\n":"")+text+"\n\n"+t("The sender was told it was accepted, so nothing will retry and there is no other copy."),t("Delete")))return;
  }else if(hiddenNote){
    const yes=action==="release"?t("Release"):action==="allow"?t("Whitelist and release"):t("Blacklist and delete");
    if(!await qAsk(t("Hidden by the search"),hiddenNote+"\n\n"+t("Clear the search to see them first, or go on and act on all of them."),yes))return;
  }
  if(action==="allow"||action==="block"){
    const choice=await qListDialog(ids,action);
    if(!choice)return;
    Object.assign(body,choice);
  }
  // What the action before came to goes as this one is sent, so that a refusal
  // of this one is not read beside it.
  Q.outcome="";qDrawOutcome();
  try{
    const a=await api("/api/v1/quarantine/bulk",{method:"POST",body:JSON.stringify(body)});
    const done=Number(a.succeeded)||0,failed=Number(a.failed)||0;
    const entries=asList(a.entries,"entries").filter(e=>!e.error).length;
    const said=action==="release"?(done===1?t("Released to its recipients"):tf("Released {0} messages to their recipients.",done))
      :action==="delete"?(done===1?t("Deleted"):tf("Deleted {0} messages.",done))
      :action==="allow"?tf("Whitelisted. List entries: {0}. Messages released: {1}.",entries,done)
      :tf("Blacklisted. List entries: {0}. Messages deleted: {1}.",entries,done);
    const refused=asList(a.results,"results").filter(r=>!r.ok);
    Q.said=failed?said+" "+tf("Left where they were: {0}. The first reason: {1}",failed,refused.length?refused[0].error:""):"";
    toast(said);
    await render();
    // The quarantine's reload has read it; another view's - the quarantine left
    // while the request was out - has not, and it goes rather than be shown when
    // the quarantine is next opened.
    Q.said="";
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_quarantine",e.message);}
}
async function qExpire(){
  setErr("err_quarantine","");
  Q.outcome="";qDrawOutcome();
  try{
    const a=await api("/api/v1/quarantine/expire",{method:"POST",body:"{}"});
    const removed=Number(a.removed)||0;
    Q.said=removed?tf("{0} message(s) past the retention window were removed.",removed):t("Nothing was old enough to remove. The window is the QuarantineRetentionDays setting, on the Control Panel's Anti-spam settings page or at PUT /api/v1/settings/ini/QuarantineRetentionDays, and 0 means never.");
    await render();
    Q.said="";
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_quarantine",e.message);}
}
/* The two server-wide settings the digest needs are on the Settings view; this
   goes there with its filter set to them. Which domains send one, and when,
   is on each domain. */
async function qDigest(){
  const b=Array.from(document.querySelectorAll("#nav button[data-view]")).filter(x=>x.dataset.view==="settings")[0];
  if(!b||b.hidden)return;
  document.querySelectorAll("#nav button[data-view]").forEach(x=>x.classList.toggle("on",x===b));
  deckRevealNavView("settings");
  $("#deckSearch").value="";
  view="settings";editing=null;
  await render();
  const f=document.getElementById("setFilter");
  if(f){f.value="quarantine_digest";filterRows();f.focus();}
}
/* One held message's headers or its text, read from the held file and shown
   as text in a panel: textContent, never innerHTML, whatever the message says. */
async function qRead(id,what){
  setErr("err_quarantine","");
  // In the list, or only in the answer to a search, which reaches past it.
  const m=Q.items.concat(Q.found||[]).filter(x=>String(x.id)===String(id))[0]||{};
  try{
    const a=await api("/api/v1/quarantine/"+encodeURIComponent(id)+"/"+(what==="headers"?"headers":"preview"));
    const text=String((what==="headers"?a.headers:a.text)||"");
    const host=document.createElement("div");
    host.id="qRead";host.className="overlay";host.qBack=document.activeElement;
    host.innerHTML='<div class="sheet wide qpanel" role="dialog" aria-modal="true" aria-labelledby="qReadTitle">'+
      '<div class="row"><h2 id="qReadTitle" style="flex:1;margin:0"></h2><button class="btn ghost sm" data-act="qreadclose">'+t("Close")+'</button></div>'+
      '<p class="note" id="qReadNote" hidden></p><pre id="qReadText" tabindex="0"></pre></div>';
    const old=document.getElementById("qRead");if(old&&old.parentNode)old.parentNode.removeChild(old);
    $("#content").appendChild(host);
    $("#qReadTitle").textContent=what==="headers"?tf("Headers of the message from {0}",String(m.sender||"")||"<>"):tf("Preview of \"{0}\"",String(m.subject||"")||t("(no subject)"));
    const note=a.truncated?tf("Only the first {0} characters are shown.",Number(a.limit)||text.length):(what!=="headers"&&!text?t("The message has no text to show."):"");
    if(note){$("#qReadNote").textContent=note;$("#qReadNote").hidden=false;}
    $("#qReadText").textContent=text;
    host.onkeydown=e=>qTrap(e,host,qReadClose);
    $("#qReadText").focus();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_quarantine",e.message);}
}
function qReadClose(){const host=document.getElementById("qRead");if(host&&host.parentNode){host.parentNode.removeChild(host);qBack(host);}}

/* ---------- Held for review ----------
   What the compromised-account detection kept out of the delivery queue: an
   account that submitted in the shape of a takeover has its messages held here
   until somebody releases or discards them, and is locked until unlocked. Below
   the list, one account's review state - the lock, the last shape seen, its
   baseline - with the two choices an administrator makes about it, exempt and
   sensitivity, and the compromise lock cleared on its own. */
let reviewAddress="";
async function renderReview(){
  const answer=await api("/api/v1/review");
  const list=asList(answer,"messages");
  const rows=list.map(m=>`
    <tr><td>${escHtml(auditWhen(m.held))}</td>
        <td style="word-break:break-all">${escHtml(m.account||"")}</td>
        <td style="word-break:break-all">${escHtml(m.recipients||"")}</td>
        <td>${escHtml(m.subject||"")}</td>
        <td>${escHtml(m.reason||"")}<div class="hint muted">${escHtml(m.source||"")}</div></td>
        <td>${escHtml(fmtBytes(m.size))}</td>
        <td style="text-align:right;white-space:nowrap">${may("manage_queue")?`<button class="btn ghost sm" data-act="rvrelease" data-id="${escHtml(m.id)}">${t("Release")}</button>
          <button class="btn danger sm" data-act="rvdiscard" data-id="${escHtml(m.id)}">${t("Discard")}</button>`:""}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view"><div class="card view">
    <p class="note">${escHtml(operation("/api/v1/review","get").summary||"")}. ${escHtml(tf("Mode: {0}",answer.mode||""))}</p>
    <div class="err" id="err_review"></div>
    <div class="tablewrap"><table><thead><tr><th>${t("Held")}</th><th>${t("Account")}</th><th>${t("To")}</th><th>${t("Subject")}</th><th>${t("Reason")}</th><th>${t("Size")}</th><th></th></tr></thead>
    <tbody>${rows||'<tr><td colspan="7" class="empty">'+t("Nothing is held for review. ✦")+'</td></tr>'}</tbody></table></div>
    </div>
    <div class="sect"><h2>${t("An account's review state")}</h2><div class="card flat">
      <div class="row" data-enter="rvlookup"><input id="rv_address" placeholder="${t("Account address")}" value="${escHtml(reviewAddress)}" style="min-width:260px"><button class="btn ghost sm" data-act="rvlookup">${t("Look up")}</button></div>
      <div class="err" id="err_reviewaccount"></div>
      <div id="rv_state"></div>
    </div></div></div>`;
  if(reviewAddress)await reviewLookup();
}
async function reviewLookup(){
  setErr("err_reviewaccount","");
  const box=$("#rv_state");
  reviewAddress=(($("#rv_address")||{}).value||"").trim();
  if(!reviewAddress){if(box)box.innerHTML="";return;}
  try{
    const r=await api("/api/v1/accounts/"+encodeURIComponent(reviewAddress)+"/review");
    const b=r.baseline||{};
    const lock=r.locked?tf("Locked since {0}",auditWhen(r.locked_at)):t("Not locked");
    const opt=(v,label)=>`<option value="${v}"${r.sensitivity===v?" selected":""}>${label}</option>`;
    box.innerHTML=`<div class="tablewrap"><table><tbody>
      <tr><th>${t("Status")}</th><td>${escHtml(lock)}</td></tr>
      <tr><th>${t("Score")}</th><td>${escHtml(String(r.score||0))}</td></tr>
      <tr><th>${t("Signals")}</th><td>${escHtml(r.signals||"—")}</td></tr>
      <tr><th>${t("Reason")}</th><td>${escHtml(r.reason||"—")}</td></tr>
      <tr><th>${escHtml(tf("Submissions in the last {0} days",b.days||0))}</th><td>${escHtml(String(b.history||0))}${b.has_baseline?"":' <span class="hint muted">'+escHtml(tf("No baseline yet: fewer than {0} submissions in the window, so only the volume and recipients floors are judged.",b.minimum_history||0))+"</span>"}</td></tr>
      <tr><th>${t("Busiest hour")}</th><td>${escHtml(String(b.peak_hour||0))}</td></tr>
      <tr><th>${t("Hours of the day seen (UTC)")}</th><td>${escHtml((b.hours||[]).join(", ")||"—")}</td></tr>
      <tr><th>${t("Client networks seen")}</th><td>${escHtml((b.networks||[]).join(", ")||"—")}</td></tr>
      <tr><th>${t("Recipients remembered")}</th><td>${escHtml(String(b.recipients_known||0))}</td></tr>
      <tr><th>${t("Held")}</th><td>${escHtml(String(b.held||0))}</td></tr>
    </tbody></table></div>
    <div class="row" style="margin-top:14px;gap:12px;align-items:center;flex-wrap:wrap">
      <label class="row" style="gap:7px"><input type="checkbox" id="rv_exempt"${r.exempt?" checked":""}> ${t("Exempt from the detection")}</label>
      <label class="row" style="gap:7px">${t("Sensitivity")} <select id="rv_sensitivity">${opt("default",t("Default"))}${opt("relaxed",t("Relaxed"))}${opt("strict",t("Strict"))}</select></label>
      ${may("manage_accounts")?`<button class="btn sm" data-act="rvsave" data-address="${escHtml(r.address)}">${t("Save")}</button>`:""}
      ${may("unlock_account")&&r.locked?`<button class="btn ghost sm" data-act="rvunlock" data-address="${escHtml(r.address)}">${t("Unlock")}</button>`:""}
    </div>`;
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_reviewaccount",e.message);if(box)box.innerHTML="";}
}
async function reviewSave(address){
  setErr("err_reviewaccount","");
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/review",{method:"PUT",body:JSON.stringify({exempt:!!$("#rv_exempt").checked,sensitivity:$("#rv_sensitivity").value})});
    toast(tf("Saved: {0}",address));
    await reviewLookup();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_reviewaccount",e.message);}
}
async function reviewUnlock(address){
  setErr("err_reviewaccount","");
  try{
    await api("/api/v1/accounts/"+encodeURIComponent(address)+"/review/unlock",{method:"POST",body:"{}"});
    toast(tf("Unlocked: {0}",address));
    await reviewLookup();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_reviewaccount",e.message);}
}
async function reviewAct(id,release){
  setErr("err_review","");
  if(!release&&!await deckConfirm(t("Discard this held message for good?")))return;
  try{
    await api("/api/v1/review/"+encodeURIComponent(id)+(release?"/release":""),{method:release?"POST":"DELETE",body:release?"{}":undefined});
    toast(release?t("Released to the delivery queue"):t("Discarded"));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_review",e.message);}
}

/* ---------- Archive and legal holds ----------
   The archive index searched by domain, mailbox, sender, recipient, subject and
   time; a copy put on hold is kept through the retention sweep and an erasure,
   and let go again. */
let archiveQuery={domain:"",mailbox:"",sender:"",recipient:"",subject:"",since:"",until:"",hold:false,limit:200};
let archiveSearched=false;
function archiveQueryString(){
  const q=[];
  ["domain","mailbox","sender","recipient","subject","since","until"].forEach(k=>{if(archiveQuery[k])q.push(k+"="+encodeURIComponent(archiveQuery[k]));});
  if(archiveQuery.hold)q.push("hold=1");
  q.push("limit="+(Number(archiveQuery.limit)||200));
  return q.join("&");
}
async function renderArchive(){
  if(!cache.domains.length){try{cache.domains=asList(await api("/api/v1/domains"),"domains");}catch(_){cache.domains=[];}}
  let entries=[];
  let problem="";
  if(archiveSearched){
    try{entries=asList(await api("/api/v1/archive?"+archiveQueryString()),"entries");}
    catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}problem=e.message;}
  }
  const domainOptions=['<option value="">'+t("Any domain")+'</option>'].concat(cache.domains.map(d=>`<option value="${escHtml(d.name)}"${d.name===archiveQuery.domain?" selected":""}>${escHtml(d.name)}</option>`)).join("");
  const rows=entries.map(x=>`
    <tr><td>${escHtml(x.time||"")}</td><td>${escHtml(x.domain||"")}</td><td>${escHtml(x.mailbox||"")}</td><td>${escHtml(x.direction||"")}</td>
        <td style="word-break:break-all">${escHtml(x.sender||"")}</td><td style="word-break:break-all">${escHtml(x.recipients||"")}</td><td>${escHtml(x.subject||"")}</td>
        <td>${escHtml(fmtBytes(x.size))}</td>
        <td>${x.hold?'<span class="badge info">'+t("On hold")+'</span>':""}</td>
        <td style="text-align:right;white-space:nowrap">${may("manage_archive")?(x.hold?`<button class="btn ghost sm" data-act="arcunhold" data-id="${escHtml(x.id)}">${t("Lift the hold")}</button>`:`<button class="btn ghost sm" data-act="archold" data-id="${escHtml(x.id)}">${t("Put on hold")}</button>`):""}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view">
    <div class="card flat"><p class="note">${escHtml(uiDocText(operation("/api/v1/archive","get").description||""))}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select id="arc_domain" title="${t("Domain")}">${domainOptions}</select>
        <input id="arc_mailbox" placeholder="${t("Mailbox")}" value="${escHtml(archiveQuery.mailbox)}" style="flex:1 1 160px">
        <input id="arc_sender" placeholder="${t("Sender contains")}" value="${escHtml(archiveQuery.sender)}" style="flex:1 1 160px">
        <input id="arc_recipient" placeholder="${t("Recipient contains")}" value="${escHtml(archiveQuery.recipient)}" style="flex:1 1 160px">
        <input id="arc_subject" placeholder="${t("Subject contains")}" value="${escHtml(archiveQuery.subject)}" style="flex:1 1 160px">
        <input id="arc_since" placeholder="${t("Since (YYYY-MM-DD HH:MM:SS)")}" value="${escHtml(archiveQuery.since)}" style="flex:1 1 180px">
        <input id="arc_until" placeholder="${t("Until (YYYY-MM-DD HH:MM:SS)")}" value="${escHtml(archiveQuery.until)}" style="flex:1 1 180px">
        <label class="row" style="gap:6px"><input type="checkbox" id="arc_hold"${archiveQuery.hold?" checked":""}> <span>${t("Held copies only")}</span></label>
        <input id="arc_limit" type="number" min="1" max="1000" value="${Number(archiveQuery.limit)||200}" title="${t("At most")}" style="width:6rem">
        <button class="btn" data-act="arcsearch">${t("Search the archive")}</button>
      </div>
      <div class="err" id="err_archive" style="margin-top:10px">${escHtml(problem)}</div>
    </div>
    <div class="card view" style="margin-top:14px">
      <div class="tablewrap"><table><thead><tr><th>${t("Time")}</th><th>${t("Domain")}</th><th>${t("Mailbox")}</th><th>${t("Direction")}</th><th>${t("From")}</th><th>${t("To")}</th><th>${t("Subject")}</th><th>${t("Size")}</th><th>${t("Hold")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="10" class="empty">'+(archiveSearched?t("Nothing in the archive matches. ✦"):t("Choose what to look for and press Search."))+'</td></tr>'}</tbody></table></div>
    </div></div>`;
}
function readArchiveForm(){
  archiveQuery={domain:$("#arc_domain").value,mailbox:$("#arc_mailbox").value.trim(),sender:$("#arc_sender").value.trim(),recipient:$("#arc_recipient").value.trim(),
    subject:$("#arc_subject").value.trim(),since:$("#arc_since").value.trim(),until:$("#arc_until").value.trim(),hold:$("#arc_hold").checked,limit:Number($("#arc_limit").value)||200};
  archiveSearched=true;
}
async function archiveHold(id,hold){
  setErr("err_archive","");
  try{
    await api("/api/v1/archive/"+encodeURIComponent(id)+"/hold",{method:hold?"POST":"DELETE",body:hold?"{}":undefined});
    toast(hold?t("On hold: kept through the retention sweep and any erasure"):t("Hold lifted"));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_archive",e.message);}
}

/* ---------- eDiscovery ----------
   The cases; a case's searches with their progress and hit counts, the query
   form, its holds with Lift the hold, and its exports with Download
   (docs/Discovery.md). A search and an export are queued on the server and
   done one at a time, so a case with one still going is read again every few
   seconds while it is on screen. What a role may do is what it is offered:
   view_discovery reads, manage_discovery acts, and the download needs
   view_mailbox beside it, as the route does. */
function discoveryState(s){return s==="queued"?t("queued"):s==="running"?t("Running"):s==="done"?t("Done"):t("Failed");}
function discoveryScope(s){return s==="account"?t("Account"):s==="domain"?t("Domain"):s==="archive"?t("Archive"):(s||"");}
async function renderDiscovery(){
  if(discoveryTimer){clearTimeout(discoveryTimer);discoveryTimer=null;}
  const note=escHtml(uiDocText(operation("/api/v1/discovery/cases","get").description||""));
  if(!discoveryCase){
    const cases=asList(await api("/api/v1/discovery/cases"),"cases");
    const rows=cases.map(c=>`
      <tr><td>${escHtml(c.name||"")}</td><td>${c.state==="closed"?'<span class="badge">'+t("Closed")+"</span>":""}</td>
          <td>${escHtml(auditWhen(c.created))}</td><td>${escHtml(c.created_by||"—")}</td><td>${Number(c.live_holds)||0}</td>
          <td style="text-align:right"><button class="btn ghost sm" data-act="dscopen" data-id="${escHtml(c.id)}">${t("Open")}</button></td></tr>`).join("");
    $("#content").innerHTML=`<div class="view">
      <div class="card flat"><p class="note">${note}</p>
        ${may("manage_discovery")?`<div class="row" style="gap:8px;flex-wrap:wrap">
          <input id="dsc_name" placeholder="${t("Case name")}" style="flex:1 1 200px">
          <input id="dsc_description" placeholder="${t("Description")}" style="flex:2 1 300px">
          <button class="btn" data-act="dscnew">${t("Open a case")}</button></div>`:""}
        <div class="err" id="err_discovery" style="margin-top:10px"></div></div>
      <div class="card view" style="margin-top:14px"><div class="tablewrap"><table>
        <thead><tr><th>${t("Name")}</th><th>${t("State")}</th><th>${t("Created")}</th><th>${t("Who")}</th><th>${t("Holds")}</th><th></th></tr></thead>
        <tbody>${rows||'<tr><td colspan="6" class="empty">'+t("Nothing here.")+"</td></tr>"}</tbody></table></div></div></div>`;
    return;
  }
  const c=await api("/api/v1/discovery/cases/"+encodeURIComponent(discoveryCase));
  discoveryName=c.name||"";
  const manage=may("manage_discovery")&&c.state==="open";
  const searches=(c.searches||[]).map(s=>{
    const q=s.query||{};
    return `<tr><td>${escHtml(auditWhen(s.ran))}</td><td>${escHtml(s.ran_by||"—")}</td>
        <td style="word-break:break-all">${escHtml((q.custodians||[]).join(", "))}</td><td>${escHtml(q.words||"")}</td>
        <td>${escHtml(discoveryState(s.state))}</td>
        <td>${escHtml(tf("{0} read, {1} matched, {2} not searched",Number(s.scanned)||0,Number(s.matched)||0,Number(s.unsearched)||0))}${s.error?'<div class="err">'+escHtml(s.error)+"</div>":""}</td>
        <td style="text-align:right;white-space:nowrap">${manage&&s.state==="done"?`<button class="btn ghost sm" data-act="dscexport" data-id="${escHtml(s.id)}">${t("Export")}</button> <button class="btn ghost sm" data-act="dscholdarchive" data-id="${escHtml(s.id)}">${t("Hold its archived copies")}</button>`:""}</td></tr>`;
  }).join("");
  const holds=(c.holds||[]).map(h=>`<tr><td>${escHtml(h.name||"")}</td><td>${escHtml(discoveryScope(h.scope))}</td><td>${escHtml(auditWhen(h.placed))}</td><td>${escHtml(h.placed_by||"—")}</td>
        <td>${h.live?'<span class="badge info">'+t("On hold")+"</span>":escHtml(t("Hold lifted"))}</td>
        <td style="text-align:right">${manage&&h.live?`<button class="btn ghost sm" data-act="dscrelease" data-id="${escHtml(h.id)}">${t("Lift the hold")}</button>`:""}</td></tr>`).join("");
  const exports=(c.exports||[]).map(x=>{
    const download=safeHref(x.download);
    return `<tr><td>${escHtml(auditWhen(x.requested))}</td><td>${escHtml(x.requested_by||"—")}</td>
        <td>${escHtml(discoveryState(x.state))}${x.error?'<div class="err">'+escHtml(x.error)+"</div>":""}</td>
        <td>${x.state==="done"?escHtml(fmtBytes(x.size)):""}</td><td style="word-break:break-all"><code>${escHtml(x.sha256||"")}</code></td>
        <td style="text-align:right">${x.state==="done"&&download&&may("view_mailbox")?`<a class="btn ghost sm" href="${escHtml(download)}" download="case-${escHtml(c.id)}-export-${escHtml(x.id)}.zip">${t("Download")}</a>`:""}</td></tr>`;
  }).join("");
  const table=(head,body,columns)=>`<div class="tablewrap"><table><thead><tr>${head}</tr></thead><tbody>${body||'<tr><td colspan="'+columns+'" class="empty">'+t("Nothing here.")+"</td></tr>"}</tbody></table></div>`;
  $("#content").innerHTML=`<div class="view">
    <div class="card flat">
      <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap">
        <button class="btn ghost sm" data-act="dscback">${t("Back")}</button>
        <h2 style="margin:0;flex:1">${escHtml(c.name||"")} ${c.state==="closed"?'<span class="badge">'+t("Closed")+"</span>":""}</h2>
        <button class="btn ghost sm" data-act="dscrefresh">${t("Refresh")}</button>
        ${manage?`<button class="btn ghost sm" data-act="dscclose">${t("Close the case")}</button>`:""}
      </div>
      <p class="note">${escHtml(c.description||"")}</p>
      ${manage?`<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
        <input id="dsc_custodians" placeholder="${t("Custodians: addresses or domains, comma-separated, or *")}" style="flex:2 1 300px">
        <input id="dsc_words" placeholder="${t("Words that must all be found")}" style="flex:2 1 240px">
        <input id="dsc_from" placeholder="${t("From (YYYY-MM-DD)")}" style="flex:1 1 140px">
        <input id="dsc_to" placeholder="${t("To (YYYY-MM-DD)")}" style="flex:1 1 140px">
        <input id="dsc_attname" placeholder="${t("Attachment name contains")}" style="flex:1 1 180px">
        <input id="dsc_atttype" placeholder="${t("Attachment type, such as application/pdf")}" style="flex:1 1 220px">
        <select id="dsc_scope" title="${t("Scope")}"><option value="both">${t("Mailboxes and the archive")}</option><option value="mailboxes">${t("Mailboxes")}</option><option value="archive">${t("Archive")}</option></select>
        <button class="btn" data-act="dscsearch">${t("Run the search")}</button>
      </div>
      <div class="row" style="gap:8px;flex-wrap:wrap;margin-top:10px">
        <input id="dsc_hold" placeholder="${t("Address or domain to hold")}" style="flex:1 1 260px">
        <button class="btn ghost" data-act="dschold">${t("Hold")}</button>
      </div>`:""}
      <div class="err" id="err_discovery" style="margin-top:10px"></div>
    </div>
    <div class="card view" style="margin-top:14px"><h3>${t("Searches")}</h3>
      ${table(`<th>${t("When")}</th><th>${t("Who")}</th><th>${t("Custodians")}</th><th>${t("Words")}</th><th>${t("State")}</th><th>${t("Status")}</th><th></th>`,searches,7)}</div>
    <div class="card view" style="margin-top:14px"><h3>${t("Holds")}</h3>
      ${table(`<th>${t("Name")}</th><th>${t("Scope")}</th><th>${t("When")}</th><th>${t("Who")}</th><th>${t("State")}</th><th></th>`,holds,6)}</div>
    <div class="card view" style="margin-top:14px"><h3>${t("Exports")}</h3>
      ${table(`<th>${t("When")}</th><th>${t("Who")}</th><th>${t("State")}</th><th>${t("Size")}</th><th>SHA-256</th><th></th>`,exports,6)}</div>
    <p class="note" style="margin-top:12px">${note}</p></div>`;
  const busy=(c.searches||[]).concat(c.exports||[]).some(x=>x.state==="queued"||x.state==="running");
  if(busy)discoveryTimer=setTimeout(()=>{discoveryTimer=null;if(view==="discovery"&&discoveryCase)render(true);},3000);
}
async function discoveryAct(what,id){
  setErr("err_discovery","");
  const caseId=encodeURIComponent(discoveryCase);
  try{
    if(what==="new"){
      const answer=await api("/api/v1/discovery/cases",{method:"POST",body:JSON.stringify({name:$("#dsc_name").value.trim(),description:$("#dsc_description").value.trim()})});
      discoveryCase=Number(answer.id)||0;
    }else if(what==="search"){
      const body={custodians:$("#dsc_custodians").value.split(",").map(s=>s.trim()).filter(Boolean),scope:$("#dsc_scope").value};
      const words=$("#dsc_words").value.trim(),from=$("#dsc_from").value.trim(),to=$("#dsc_to").value.trim();
      const name=$("#dsc_attname").value.trim(),type=$("#dsc_atttype").value.trim();
      if(words)body.words=words;
      if(from)body.from=from;
      if(to)body.to=to;
      if(name||type){body.attachment={};if(name)body.attachment.name=name;if(type)body.attachment.type=type;}
      await api("/api/v1/discovery/cases/"+caseId+"/searches",{method:"POST",body:JSON.stringify(body)});
      toast(t("Queued: the server works through one search or export at a time."));
    }else if(what==="hold"){
      const target=$("#dsc_hold").value.trim();
      await api("/api/v1/discovery/cases/"+caseId+"/holds",{method:"POST",body:JSON.stringify({scope:target.indexOf("@")>=0?"account":"domain",target:target})});
      toast(t("On hold"));
    }else if(what==="holdarchive"){
      await api("/api/v1/discovery/cases/"+caseId+"/holds",{method:"POST",body:JSON.stringify({scope:"archive",search:Number(id)})});
      toast(t("On hold"));
    }else if(what==="release"){
      await api("/api/v1/discovery/cases/"+caseId+"/holds/"+encodeURIComponent(id),{method:"DELETE"});
      toast(t("Hold lifted"));
    }else if(what==="export"){
      await api("/api/v1/discovery/cases/"+caseId+"/searches/"+encodeURIComponent(id)+"/export",{method:"POST",body:"{}"});
      toast(t("Queued: the server works through one search or export at a time."));
    }else if(what==="close"){
      if(!await deckConfirm(tf("Close {0}? Every hold it placed is released, and it runs no search, places no hold and makes no export again.",discoveryName)))return;
      await api("/api/v1/discovery/cases/"+caseId+"/close",{method:"POST",body:"{}"});
    }
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_discovery",e.message);}
}

/* ---------- Metrics history ----------
   One metric over a day, a week or a month, from the samples the server keeps
   when MetricsHistoryDays is on: a counter is drawn as the rate between two
   samples, a gauge as it was. */
const METRIC_NAMES=["sessions_smtp","sessions_imap","processed_messages_total","messages_delivered_total","messages_deferred_total","messages_bounced_total",
  "spam_messages_total","spam_trap_hits_total","viruses_removed_total","auth_success_total","auth_failures_total","tls_handshakes_total","tls_handshake_failures_total","messagestore_missing_files"];
let metricsChoice={metric:"processed_messages_total",range:"24h"};
function metricsChartHtml(points,counter){
  const W=640,H=180,L=44,R=12,T=12,B=28,plotW=W-L-R,plotH=H-T-B;
  if(points.length<2)return '<div class="empty">'+t("Not enough samples yet. The history fills as the server runs.")+'</div>';
  const values=points.map(p=>p.value);
  const max=Math.max.apply(null,values.concat([1]));
  const min=Math.min(0,Math.min.apply(null,values));
  const span=max-min||1;
  const x=i=>L+i/(points.length-1)*plotW;
  const y=v=>T+plotH-(v-min)/span*plotH;
  const line=points.map((p,i)=>x(i).toFixed(1)+","+y(p.value).toFixed(1)).join(" ");
  const dots=points.map((p,i)=>'<circle cx="'+x(i).toFixed(1)+'" cy="'+y(p.value).toFixed(1)+'" r="1.6" fill="#1a73e8"><title>'+escHtml(p.time+": "+p.value)+'</title></circle>').join("");
  const ticks=[0,Math.floor(points.length/2),points.length-1].map(i=>'<text x="'+x(i).toFixed(1)+'" y="'+(H-10)+'" font-size="10" fill="#8b949e" text-anchor="'+(i===0?"start":i===points.length-1?"end":"middle")+'">'+escHtml(String(points[i].time).slice(5,16))+'</text>').join("");
  return '<div class="tablewrap"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" role="img" aria-label="'+escHtml(t("The metric over time"))+'">'+
    '<line x1="'+L+'" y1="'+(T+plotH)+'" x2="'+(W-R)+'" y2="'+(T+plotH)+'" stroke="#8b949e" stroke-width="0.5"></line>'+
    '<text x="'+(L-6)+'" y="'+(T+8)+'" font-size="10" fill="#8b949e" text-anchor="end">'+escHtml(String(Math.round(max*100)/100))+'</text>'+
    '<text x="'+(L-6)+'" y="'+(T+plotH)+'" font-size="10" fill="#8b949e" text-anchor="end">'+escHtml(String(Math.round(min*100)/100))+'</text>'+
    '<polyline points="'+line+'" fill="none" stroke="#1a73e8" stroke-width="1.5"></polyline>'+dots+ticks+'</svg></div>'+
    '<p class="note">'+(counter?t("A counter: each point is the change since the sample before it."):t("A gauge: each point is the value as it was."))+'</p>';
}
async function renderMetrics(){
  const answer=await api("/api/v1/metrics/history?metric="+encodeURIComponent(metricsChoice.metric)+"&range="+encodeURIComponent(metricsChoice.range));
  const samples=asList(answer,"samples");
  const counter=/_total$/.test(metricsChoice.metric);
  let points=samples.map(s=>({time:s.time,value:Number(s.value)||0}));
  if(counter){
    const rates=[];
    for(let i=1;i<points.length;i++)rates.push({time:points[i].time,value:Math.max(0,points[i].value-points[i-1].value)});
    points=rates;
  }
  const values=points.map(p=>p.value);
  const last=values.length?values[values.length-1]:0;
  const total=values.reduce((a,b)=>a+b,0);
  const options=METRIC_NAMES.map(n=>`<option value="${n}"${n===metricsChoice.metric?" selected":""}>${escHtml(n)}</option>`).join("");
  const ranges=[["24h",t("Last 24 hours")],["7d",t("Last 7 days")],["30d",t("Last 30 days")]].map(r=>`<option value="${r[0]}"${r[0]===metricsChoice.range?" selected":""}>${escHtml(r[1])}</option>`).join("");
  $("#content").innerHTML=`<div class="view"><div class="card flat">
      <p class="note">${escHtml(uiDocText(operation("/api/v1/metrics/history","get").description||""))}</p>
      <div class="row" style="gap:8px"><select id="metName">${options}</select><select id="metRange">${ranges}</select><button class="btn" data-act="metload">${t("Show")}</button></div>
      ${answer.enabled===false?'<p class="note" style="margin-top:8px"><span class="badge warn">'+t("Off")+'</span> '+t("The history is not being kept: MetricsHistoryDays is 0. Set it under Settings, Server.")+'</p>':""}
    </div>
    <div class="card view" style="margin-top:14px">
      <h3>${escHtml(metricsChoice.metric)} <code class="muted">${escHtml(metricsChoice.range)}</code></h3>
      ${metricsChartHtml(points,counter)}
      <div class="tablewrap"><table><thead><tr><th>${t("Samples")}</th><th>${counter?t("Total over the window"):t("Last value")}</th><th>${t("Highest")}</th><th>${t("Bucket")}</th></tr></thead>
      <tbody><tr><td>${points.length}</td><td>${escHtml(String(Math.round((counter?total:last)*100)/100))}</td><td>${escHtml(String(values.length?Math.max.apply(null,values):0))}</td><td>${escHtml(String(answer.bucket_minutes||""))} ${t("min")}</td></tr></tbody></table></div>
    </div></div>`;
}

/* ---------- Update ----------
   What the release feed says, the installer downloaded and verified against its
   Sigstore bundle, and the install handed to the helper - the desktop program's
   update page, with the same three verbs. */
const UPDATE_STATES={0:K("Not checked since the service started"),1:K("Up to date"),2:K("A newer release is available"),3:K("The installer is downloaded and verified"),4:K("Installing"),5:K("The last check failed"),
  6:K("An administrator's install is being prepared at the server"),7:K("Ready for the administrator's install at the server")};
async function renderUpdate(){
  const v=await api("/api/v1/update");
  const state=Number(v.state)||0;
  // Maintenance mode beside the update, because the update is what it is for:
  // a reader sees the state, a server administrator has the two buttons.
  const drain=may("view_configuration")?await api("/api/v1/server/drain"):null;
  const badge=state===1?"good":state===5?"bad":state===2||state===3||state===6||state===7?"info":"warn";
  const installer=v.installer||{};
  const downloaded=v.downloaded||{};
  // A snap, a container or a distribution's build is updated by what installed
  // it (liveUpdate false, updateCommand and updateAdvice say how): the page
  // offers no download and no install there. A server from before 6.3.6 sends
  // none of the three, and is offered both as it always was.
  const live=v.liveUpdate!==false;
  // A service that is not an administrator (NT SERVICE\hMailServer, since
  // 6.3.6 a new installation's account) downloads and verifies the release,
  // and an administrator installs it from the Control Panel at the server,
  // after Windows asks them: the page says so where its Install button stood.
  // A server before 6.3.6 sends no installedBy, and is offered the button.
  const byAdministrator=v.installedBy==="administrator";
  const adviceHtml=byAdministrator?(v.serviceAccount&&v.serverName
    ?escHtml(tf("This service runs as {0}, which cannot run an installer, so updates are installed by an administrator at the server: open the hMailServer Control Panel on {1} and click Install update on its Status page. It asks Windows for permission once, checks the installer itself, and installs {2}.",
      v.serviceAccount,v.serverName,v.availableVersion?"hMailServer "+v.availableVersion:t("the new release")))
    :escHtml(v.installAdvice||"")):"";
  const rows=[[t("Running version"),v.runningVersion||""],[t("Channel"),v.channel||""],[t("Scheduled check"),v.checkEnabled?t("On"):t("Off")]];
  if(v.installKind)rows.push([t("Installed as"),v.installKind]);
  if(v.updateCommand)rows.push([t("Update with"),v.updateCommand]);
  rows.push([t("Available version"),v.availableVersion||"—"],[t("Release"),v.releaseName||"—"],[t("Published"),v.publishedAt||"—"],
    [t("Installer"),installer.name?installer.name+" ("+fmtBytes(installer.size)+")":"—"],[t("Verified"),downloaded.verifiedAt||"—"],[t("Signed by"),downloaded.signer||"—"],[t("Last error"),v.lastError||"—"]);
  const applied=v.apply&&typeof v.apply==="object"?Object.keys(v.apply).filter(k=>String(v.apply[k]||"")!==""):[];
  const apply=applied.map(k=>"<tr><td>"+escHtml(humanise(k))+"</td><td>"+escHtml(String(v.apply[k]))+"</td></tr>").join("");
  // The feed names the release page; it is a link only as a web address.
  const releaseHref=safeHref(v.releaseUrl);
  $("#content").innerHTML=`<div class="view"><div class="card view">
    <p class="note">${escHtml(uiDocText(operation("/api/v1/update","get").description||""))}</p>
    ${byAdministrator&&adviceHtml?`<p class="note" id="updateAdvice">${adviceHtml}</p>`:live?`<p class="note">${t("The server drains first: the listeners close and the delivery queue pauses while the sessions and deliveries in flight finish, then the service stops, installs and starts again.")}</p>`:v.updateAdvice?`<p class="note" id="updateAdvice">${escHtml(v.updateAdvice)}</p>`:""}
    <p><span class="badge ${badge}">${escHtml(t(UPDATE_STATES[state]||v.stateName||String(state)))}</span> ${releaseHref?'<a href="'+escHtml(releaseHref)+'" target="_blank" rel="noopener noreferrer">'+t("Release notes")+'</a>':""}</p>
    ${drain?`<h3 style="margin-top:14px">${t("Maintenance mode")}</h3>
    <p class="note" id="drainState">${drain.draining?escHtml(tf("Draining since {0}: {1} session(s) and {2} delivery(ies) in flight.",drain.since||"",String(drain.sessions||0),String(drain.deliveries||0))):t("Not draining: the listeners are open.")}</p>
    <div class="row" style="gap:8px">
      ${may("manage_server")&&!drain.draining?`<button class="btn ghost" data-act="updrain">${t("Drain")}</button>`:""}
      ${may("manage_server")&&drain.draining?`<button class="btn" data-act="upresume">${t("Resume")}</button>`:""}
    </div>`:""}
    <div class="tablewrap"><table><tbody>${rows.map(r=>"<tr><td>"+escHtml(r[0])+"</td><td>"+escHtml(String(r[1]))+"</td></tr>").join("")}</tbody></table></div>
    ${apply?'<h3 style="margin-top:14px">'+t("The last install")+'</h3><div class="tablewrap"><table><tbody>'+apply+'</tbody></table></div>':""}
    <div class="row" style="margin-top:14px;gap:8px">
      ${may("manage_server")?`<button class="btn ghost" data-act="upcheck">${t("Check now")}</button>`:""}
      ${may("manage_server")&&live&&state===2?`<button class="btn" data-act="updownload">${t("Download and verify")}</button>`:""}
      ${may("manage_server")&&live&&!byAdministrator&&state===3?`<button class="btn danger" data-act="upinstall">${t("Install the update")}</button>`:""}
    </div>
    <div class="err" id="err_update" style="margin-top:10px"></div>
    </div></div>`;
}
async function drainAct(enter){
  setErr("err_update","");
  if(enter&&!await deckConfirm(t("Close the SMTP, IMAP, POP3 and ManageSieve listeners and pause delivery? The sessions and deliveries in flight finish; the Deck, the webmail and the DAV services stay up. Resume reopens the listeners.")))return;
  try{
    await api("/api/v1/server/drain",enter?{method:"POST",body:"{}"}:{method:"DELETE"});
    toast(enter?t("Draining"):t("Running"));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_update",e.message);}
}
async function updateAct(verb){
  setErr("err_update","");
  if(verb==="install"&&!await deckConfirm(t("Install the verified update now? The service stops and starts while it runs, and comes back on the new version - or on this one if the install fails.")))return;
  try{
    const v=await api("/api/v1/update/"+verb,{method:"POST",body:"{}"});
    toast(t(UPDATE_STATES[Number(v.state)]||"")||t("Done"));
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_update",e.message);}
}

/* ---------- DNS records ----------
   The records a domain publishes for this server, gathered from the routes that
   derive them: the DKIM keys a rotation keeps or wants, the SRV records for
   client discovery, the TLSA records for the certificates, and the SPF and DMARC
   starting points. Copy all, paste at the registrar. */
async function renderDns(){
  cache.domains=asList(await api("/api/v1/domains"),"domains");
  let srv=[];
  try{srv=asList(await api("/api/v1/srv"),"records");}catch(e){if(e.message==="auth")throw e;}
  let tlsa=[];
  try{tlsa=asList(await api("/api/v1/tlsa"),"records");}catch(e){if(e.message==="auth")throw e;}
  const blocks=[];
  for(const d of cache.domains.filter(x=>x.active!==false)){
    const lines=[];
    lines.push("; "+d.name);
    lines.push(d.name+". IN TXT \"v=spf1 mx -all\"");
    lines.push("_dmarc."+d.name+". IN TXT \"v=DMARC1; p=quarantine; rua=mailto:dmarc@"+d.name+"\"");
    try{
      const rotation=await api("/api/v1/domains/"+encodeURIComponent(d.name)+"/dkim/rotation");
      ["current","next","retiring"].forEach(slot=>{
        const s=rotation[slot];
        if(!s||!Array.isArray(s.records))return;
        s.records.forEach(r=>{lines.push((r.host||"")+". IN "+(r.type||"TXT")+" \""+String(r.value||"").replace(/"/g,'\\"')+"\""+(r.action&&r.action!=="keep"?"  ; "+r.action:""));});
      });
    }catch(e){if(e.message==="auth")throw e;}
    srv.filter(r=>!r.domain||r.domain===d.name).forEach(r=>lines.push(r.record||JSON.stringify(r)));
    blocks.push(lines.join("\n"));
  }
  if(tlsa.length)blocks.push(["; TLSA"].concat(tlsa.map(r=>r.record||JSON.stringify(r))).join("\n"));
  const text=blocks.join("\n\n");
  $("#content").innerHTML=`<div class="view"><div class="card view">
    <p class="note">${t("What each domain publishes for this server: SPF and DMARC starting points, the DKIM keys the rotation keeps or wants, the SRV records that let a phone find the server by the address alone, and the TLSA records for DANE. Copy them to your DNS; the checklist and the DKIM rotation say when they are seen.")}</p>
    <pre id="dnsPre">${escHtml(text||t("No active domain yet."))}</pre>
    <div style="margin-top:12px"><button class="btn ghost sm" data-act="dnscopy">${t("Copy all")}</button></div>
    </div></div>`;
}

/* ---------- Shared folders ----------
   An account's folders and who else may reach each: the ACL a client sets
   with SETACL, edited here by right. */
let foldersFor="",foldersPick=0,foldersList=[],permEditing=null;
/* The one place the path of a folder's access-control list is written. */
function permissionsBase(){return "/api/v1/accounts/"+encodeURIComponent(foldersFor)+"/folders/"+foldersPick+"/permissions";}
const RIGHTS=["lookup","read","write_seen","write_others","insert","post","create","delete_mailbox","write_deleted","expunge","administer"];
function flattenFolders(list,depth,out){
  (list||[]).forEach(f=>{out.push({id:Number(f.id)||0,path:f.path||f.name,depth:depth});flattenFolders(f.subfolders,depth+1,out);});
  return out;
}
async function renderFolders(){
  const shown=escHtml(foldersFor);
  const form=`<div class="card flat">
    <p class="note">${t("Who may reach an account's folders, by folder: the rights a client sets with SETACL. Type an account address and press Show, then pick a folder.")}</p>
    <div class="row" style="gap:8px;flex-wrap:wrap">
      <input id="fldAddress" placeholder="${t("Account address")}" value="${shown}" style="flex:1 1 260px">
      <button class="btn" data-act="fldshow">${t("Show")}</button>
    </div>
    <div class="err" id="err_folders" style="margin-top:10px"></div>
  </div>`;
  if(!foldersFor){
    $("#content").innerHTML=`<div class="view">${form}<div class="card view" style="margin-top:14px"><div class="empty">${t("Type an account address and press Show. ✦")}</div></div></div>`;
    return;
  }
  let tree;
  try{tree=await api("/api/v1/accounts/"+encodeURIComponent(foldersFor)+"/folders");}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    $("#content").innerHTML=`<div class="view">${form}</div>`;setErr("err_folders",e.message);return;}
  foldersList=flattenFolders(tree.folders,0,[]);
  if(!foldersPick&&foldersList.length)foldersPick=foldersList[0].id;
  const picker=`<select data-r="fld-folder" id="fldPick">${foldersList.map(f=>`<option value="${Number(f.id)||0}"${f.id===foldersPick?" selected":""}>${escHtml("\u00a0".repeat(f.depth*2)+f.path)}</option>`).join("")}</select>`;
  let permissions=[];
  if(foldersPick){
    try{permissions=asList(await api(permissionsBase()),"permissions");}
    catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_folders",e.message);}
  }
  const who=p=>p.type==="anyone"?t("anyone"):p.type==="group"?t("group")+" "+(p.group||p.group_id):(p.account||p.account_id);
  const rows=permissions.map(p=>`
    <tr><td>${escHtml(who(p))}</td><td><code>${escHtml(p.rights_text||"")}</code> <span class="muted">${escHtml(RIGHTS.filter(r=>p.rights&&p.rights[r]).join(", "))}</span></td>
        <td style="text-align:right;white-space:nowrap">${may("manage_accounts")?`<button class="btn ghost sm" data-act="permedit" data-id="${escHtml(p.id)}">${t("Edit")}</button>
          <button class="btn danger sm" data-act="permdel" data-id="${escHtml(p.id)}">${t("Revoke")}</button>`:""}</td></tr>`).join("");
  const e=permEditing||{type:"user",account:"",group:"",rights:{}};
  const boxes=RIGHTS.map(r=>`<label class="row" style="gap:4px"><input type="checkbox" data-right="${r}"${e.rights&&e.rights[r]?" checked":""}> <span>${escHtml(r)}</span></label>`).join("");
  const editor=may("manage_accounts")?`<div class="card flat" style="margin-top:14px"><h3>${permEditing&&permEditing.id?t("Change the permission"):t("Grant a permission")}</h3>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <select id="permType"><option value="user"${e.type==="user"?" selected":""}>${t("An account")}</option><option value="group"${e.type==="group"?" selected":""}>${t("A group")}</option><option value="anyone"${e.type==="anyone"?" selected":""}>${t("Anyone")}</option></select>
        <input id="permWho" placeholder="${t("Account address or group name")}" value="${escHtml(e.type==="group"?(e.group||""):(e.account||""))}" style="flex:1 1 240px">
      </div>
      <div class="row" style="gap:10px;flex-wrap:wrap;margin-top:8px">${boxes}</div>
      <div class="row" style="margin-top:10px;gap:8px"><button class="btn" data-act="permsave">${permEditing&&permEditing.id?t("Save the permission"):t("Grant")}</button>${permEditing&&permEditing.id?`<button class="btn quiet" data-act="permcancel">${t("Cancel")}</button>`:""}</div>
    </div>`:"";
  $("#content").innerHTML=`<div class="view">${form}
    <div class="card view" style="margin-top:14px">
      <div class="row" style="gap:8px;margin-bottom:10px"><label>${t("Folder")} ${picker}</label></div>
      <div class="tablewrap"><table><thead><tr><th>${t("Who")}</th><th>${t("Rights")}</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="3" class="empty">'+t("Nobody else reaches this folder. ✦")+'</td></tr>'}</tbody></table></div>
    </div>${editor}</div>`;
}
async function savePermission(){
  setErr("err_folders","");
  const body={type:$("#permType").value,rights:{}};
  const who=$("#permWho").value.trim();
  if(body.type==="user")body.account=who;
  else if(body.type==="group")body.group=who;
  document.querySelectorAll("#content input[data-right]").forEach(b=>{body.rights[b.dataset.right]=!!b.checked;});
  if(body.type!=="anyone"&&!who){setErr("err_folders",t("Name the account or the group."));return;}
  try{
    if(permEditing&&permEditing.id)await api(permissionsBase()+"/"+permEditing.id,{method:"PUT",body:JSON.stringify(body)});
    else await api(permissionsBase(),{method:"POST",body:JSON.stringify(body)});
    permEditing=null;toast(t("Permission saved"));await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_folders",e.message);}
}
async function deletePermission(id){
  if(!await deckConfirm(t("Revoke this permission?")))return;
  setErr("err_folders","");
  try{await api(permissionsBase()+"/"+encodeURIComponent(id),{method:"DELETE"});toast(t("Permission revoked"));await render();}
  catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_folders",e.message);}
}
async function editPermission(id){
  try{
    const list=asList(await api(permissionsBase()),"permissions");
    permEditing=list.filter(p=>String(p.id)===String(id))[0]||null;
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_folders",e.message);}
}

/* ---------- Diagnostics ----------
   The desktop program's diagnostic run - the MX records of a domain, an
   outbound connection on port 25, a connection to this server's own ports, the
   data and backup directories, the IP ranges - over the route that runs it. */
let diagResults=null,diagLocal="",diagTest="";
async function renderDiagnostics(){
  if(!diagLocal&&!cache.domains.length){try{cache.domains=asList(await api("/api/v1/domains"),"domains");}catch(_){cache.domains=[];}}
  if(!diagLocal&&cache.domains.length)diagLocal=cache.domains[0].name;
  if(!diagTest)diagTest="example.com";
  const rows=(diagResults||[]).map(r=>`
    <tr><td>${r.success?'<span class="badge good">'+t("OK")+'</span>':'<span class="badge bad">'+t("Failed")+'</span>'}</td>
        <td><b>${escHtml(r.name||"")}</b><div class="muted">${escHtml(r.description||"")}</div></td>
        <td style="white-space:pre-wrap;word-break:break-word">${escHtml(r.details||"")}</td></tr>`).join("");
  $("#content").innerHTML=`<div class="view"><div class="card flat">
      <p class="note">${escHtml(operation("/api/v1/diagnostics/run","post").description||t("Runs the server's own diagnostic tests: MX records, an outbound connection, connecting to this server, the data and backup directories, the IP ranges."))}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <input id="diagLocal" placeholder="${t("A domain hosted here")}" value="${escHtml(diagLocal)}" style="flex:1 1 200px">
        <input id="diagTest" placeholder="${t("A domain to send to")}" value="${escHtml(diagTest)}" style="flex:1 1 200px">
        <button class="btn" data-act="diagrun">${t("Run the tests")}</button>
      </div>
      <div class="err" id="err_diag" style="margin-top:10px"></div>
    </div>
    <div class="card view" style="margin-top:14px">
      <div class="tablewrap"><table><thead><tr><th></th><th>${t("Test")}</th><th>${t("Details")}</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="3" class="empty">'+(diagResults?t("No results came back."):t("Press Run the tests. They take a few seconds; a connection test waits for its timeout."))+'</td></tr>'}</tbody></table></div>
    </div></div>`;
}
async function runDiagnostics(){
  diagLocal=$("#diagLocal").value.trim();diagTest=$("#diagTest").value.trim();
  setErr("err_diag","");
  $("#err_diag").textContent=t("Running…");
  try{
    const answer=await api("/api/v1/diagnostics/run",{method:"POST",body:JSON.stringify({local_domain:diagLocal,test_domain:diagTest})});
    diagResults=asList(answer,"results");
    await render();
  }catch(e){if(e.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}setErr("err_diag",e.message);}
}

