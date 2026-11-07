/* ---------- Boot ----------
   No credential is stored, so the only question at load is whether the browser
   still holds a live session cookie - and that is asked only when this tab has
   signed in before. Asking unconditionally would mean a request answered 401 on
   every first visit, and a 401 from this API carries WWW-Authenticate: Basic,
   which is the browser's cue to put its own password box on the screen in front
   of the page's. */
let deckBootReady=false;
async function bootDeck(){
  if(!localStorage.getItem("Token")){
    window.top.location.replace(new URL("/admin/login",location.href).href);
    return;
  }
  // The shell is a local page and must not wait on the network. Navigate here
  // from the main admin console immediately; only the data is asynchronous.
  deckBootReady=false;
  $("#gate").style.display="none";
  $("#app").style.display="grid";
  $("#viewTitle").textContent=t(titles[view]||"Dashboard");
  connection("info","正在同步");
  $("#content").innerHTML='<div class="grid g4 view" aria-label="服务器概览">'+
    ['邮件处理量','拦截垃圾邮件','清除病毒','服务器状态'].map(label=>
      '<div class="card kpi"><div class="v">—</div><div class="l">'+label+'</div></div>').join("")+'</div>';
  try{
    await startDeck();
  }catch(err){
    if(err.message==="auth"){signedOut(t("The session ended. Sign in again."));return;}
    connection("bad","API 连接失败");
    $("#content").innerHTML='<div class="card"><h2>无法连接到邮件服务器</h2><p class="note">'+escHtml(err.message||t("Check the API address, port and credentials in config/hmailserver_api.php."))+'</p><button class="btn" type="button" id="deckRetry">重试连接</button></div>';
    const retry=$("#deckRetry");if(retry)retry.onclick=()=>bootDeck();
  }
}
// 嵌入主后台切换层时，关闭图层即可返回；独立打开则照常直接跳转 /admin/。
const mainReturnLink=document.querySelector(".deck-main-link");
mainReturnLink.addEventListener("click",event=>{
  if(window.parent===window)return;
  try{
    if(window.parent.location.origin!==location.origin)return;
    event.preventDefault();
    window.parent.postMessage({type:"mail-admin:return"},location.origin);
  }catch(_){/* 非同源父窗口沿用链接行为 */}
});

localiseTree(document.body);
bootDeck();
