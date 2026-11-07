/* ---------- Dashboard ---------- */
function animateNum(el,target){
  const start=parseInt(el.dataset.v||"0",10),diff=target-start;if(!diff){el.textContent=target.toLocaleString();return}
  const t0=performance.now();
  (function step(t){const k=Math.min(1,(t-t0)/600),e=1-Math.pow(1-k,3);
    el.textContent=Math.round(start+diff*e).toLocaleString();
    if(k<1)requestAnimationFrame(step);else el.dataset.v=target})(t0);
}

async function renderDash(update){
  const s=firstDashboardStatus||await api("/api/v1/status",{timeoutMs:7500});
  firstDashboardStatus=null;
  if(!update||!$("#kpiProcessed")){
    $("#content").innerHTML=`
    <div class="grid g4 view">
      <div class="card kpi"><div class="v" id="kpiProcessed" data-v="0">0</div><div class="l">${t("Messages processed")}</div><div class="bar"></div></div>
      <div class="card kpi"><div class="v" id="kpiSpam" data-v="0">0</div><div class="l">${t("Spam blocked")}</div><div class="bar"></div></div>
      <div class="card kpi"><div class="v" id="kpiVirus" data-v="0">0</div><div class="l">${t("Viruses removed")}</div><div class="bar"></div></div>
      <div class="card kpi"><div class="v" id="kpiState">—</div><div class="l">${t("Server state")}</div><div class="bar"></div></div>
    </div>
    <div class="sect view"><h2>${t("Live sessions")}</h2>
      <div class="grid g4">
        <div class="card kpi"><div class="v" id="sesSmtp" data-v="0">0</div><div class="l">${t("SMTP sessions")}</div></div>
        <div class="card kpi"><div class="v" id="sesImap" data-v="0">0</div><div class="l">${t("IMAP sessions")}</div></div>
        <div class="card kpi"><div class="v" id="sesPop3" data-v="0">0</div><div class="l">${t("POP3 sessions")}</div></div>
      </div>
    </div>
    <div class="card flat view" id="accountNote" hidden></div>
    <div class="sect view" id="storeSect" hidden><h2>${t("Message store")}</h2>
      <div class="grid g4">
        <div class="card kpi"><div class="v" id="storeLogical">—</div><div class="l">${t("Message size")}</div></div>
        <div class="card kpi"><div class="v" id="storeStored">—</div><div class="l">${t("Stored on disk")}</div></div>
        <div class="card kpi"><div class="v" id="storeBlobs">—</div><div class="l">${t("Parts held once")}</div></div>
        <div class="card kpi"><div class="v" id="storeSaved">—</div><div class="l">${t("Space saved")}</div></div>
      </div>
      <p class="note" id="storeNote"></p>
    </div>`;
  }
  animateNum($("#kpiProcessed"),s.processedMessages);
  animateNum($("#kpiSpam"),s.spamMessages);
  animateNum($("#kpiVirus"),s.virusesRemoved);
  animateNum($("#sesSmtp"),s.sessions.smtp);
  animateNum($("#sesImap"),s.sessions.imap);
  animateNum($("#sesPop3"),s.sessions.pop3);
  // The account the server runs as (docs/ServiceAccount.md): said here, as
  // information and never as an error, while it is the most privileged one on
  // the machine - LocalSystem, or root - with anything that account cannot do,
  // from the checklist's own item without its DNS lookups. Asked when the
  // dashboard is drawn, not at every refresh; an older server, or a role that
  // may not read the checklist, leaves it hidden.
  if(!update&&may("view_configuration")&&$("#accountNote")){
    void (async()=>{
    let list=null;
    try{list=await api("/api/v1/setup/checklist?dns=0",{timeoutMs:4500});}catch(_){list=null;}
    const item=list&&Array.isArray(list.items)?list.items.filter(x=>x.key==="service_account")[0]:null;
    const said=item&&item.state==="action_needed"?(item.findings||[]).filter(f=>f.state==="action_needed"):[];
    if(view==="dash"&&said.length&&$("#accountNote")){
      await ensureDeckView("checklist");
      $("#accountNote").innerHTML='<div class="row" style="gap:10px;align-items:center;flex-wrap:wrap"><span class="pill" data-level="info"><span class="mark">●</span>'+escHtml(t(CHECKLIST_TITLE.service_account))+'</span>'+
        '<button class="btn ghost sm" data-act="checklistopen">'+escHtml(t("Checklist"))+'</button></div>'+
        said.map(f=>'<p class="note">'+escHtml(checklistText(f))+'</p>').join("");
      $("#accountNote").hidden=false;
    }
    })().catch(()=>{});
  }
  const states={0:K("Unknown"),1:K("Stopped"),2:K("Starting"),3:K("Running"),4:K("Stopping"),5:K("Draining")};
  $("#kpiState").innerHTML=s.state===3?'<span class="badge good">'+t("Running")+'</span>':'<span class="badge warn">'+escHtml(states[s.state]?t(states[s.state]):tf("State {0}",s.state))+'</span>';
  // The message store (GET /api/v1/store, docs/MessageStore.md): what the
  // messages are beside what their files and the parts held once take. The
  // server measures on its own time, so the first look may say it is still
  // measuring; an older server, or a refusal, leaves the section hidden, and
  // so does a server that has nothing measured and is measuring nothing - it
  // walks the store only while compression is on or a part is held once.
  // Store measurements are optional and relatively expensive; do not
  // re-request them on every dashboard heartbeat.
  if(!update&&may("view_configuration")&&$("#storeSect")){
    void (async()=>{
    let st=null;
    try{st=await api("/api/v1/store",{timeoutMs:4500});}catch(_){st=null;}
    if(view!=="dash"||!$("#storeSect"))return;
    if(st&&typeof st.logical_bytes==="number"){
      $("#storeSect").hidden=!(st.measured||st.measuring);
    }
    if(st&&typeof st.logical_bytes==="number"&&(st.measured||st.measuring)){
      $("#storeLogical").textContent=fmtBytes(st.logical_bytes);
      $("#storeStored").textContent=fmtBytes(st.stored_bytes);
      $("#storeBlobs").textContent=fmtBytes(st.blob_bytes);
      $("#storeSaved").textContent=st.measured&&st.logical_bytes>0?Number(st.saved_percent).toFixed(1)+"%":"—";
      $("#storeNote").textContent=st.measured
        ?tf(st.compression?K("Measured {0}; new mail is stored compressed."):K("Measured {0}; new mail is stored as it came."),new Date(st.measured*1000).toLocaleString())
        :t("Measuring the message store; the figures follow on the next refresh.");
    }
    })().catch(()=>{});
  }
}

