/* ---------- Reports ----------
   What happened on this server, per domain and per day. One request draws the
   whole page - GET /api/v1/reports/summary - because seven requests for seven
   tables of the same window is seven chances for them to disagree about what
   the window was.

   Every table is drawn from the server's own columns and rows rather than from
   a shape written here: the route answers a list of column names and a list of
   row objects, so a section that gains a column gains it in this page without
   an edit. The headings are looked up in REPORT_COLUMNS and shown in the
   server's own word when the table has no translation for one, which is the
   same rule the rest of this page follows for a value it did not write.

   The notes are the server's sentences, shown as they come. They are the part
   of a report that keeps it honest - "the message trace is switched off, so
   this section is empty" is not the same statement as an empty table, and a
   page that quietly drew the empty table would be lying by omission.

   The CSV is a link and not a button: it is the same route with format=csv, a
   same-origin navigation that carries the session cookie, so the file an
   administrator opens in a spreadsheet is written by the server from the very
   rows this page drew rather than by this page from what it happens to hold. */
const REPORT_SECTIONS=[
  {id:"traffic",title:K("Traffic"),chart:true},
  {id:"failures",title:K("Delivery failures")},
  {id:"senders",title:K("Top senders")},
  {id:"recipients",title:K("Top recipients")},
  {id:"mailboxes",title:K("Largest mailboxes")},
  {id:"quota",title:K("Near their quota")},
  {id:"volume",title:K("Volume")},
  {id:"storage",title:K("Storage"),chart:true},
  {id:"countries",title:K("Country refusals")}
];
const REPORT_COLUMNS={day:K("Day"),domain:K("Domain"),incoming:K("Incoming"),outgoing:K("Outgoing"),
  failed_incoming:K("Failed incoming"),failed_outgoing:K("Failed outgoing"),status:K("Status"),reason:K("Reason"),
  total:K("Total"),sender:K("Sender"),recipient:K("Recipient"),messages:K("Messages"),failed:K("Failed"),
  address:K("Address"),bytes:K("Bytes"),megabytes:K("Megabytes"),processed:K("Processed"),delivered:K("Delivered"),
  deferred:K("Deferred"),bounced:K("Bounced"),spam:K("Spam"),viruses:K("Viruses"),mailboxes:K("Mailboxes"),
  refused:K("Refused"),country:K("Country"),quota_megabytes:K("Quota (MB)"),percent:K("Percent used"),
  warns_at:K("Warns at (%)"),sending_stops_at:K("Sending stops at (%)"),state:K("State")};
let report={from:"",to:"",domain:"",top:10};
function reportQuery(extra){
  const parts=[];
  if(report.from)parts.push("from="+encodeURIComponent(report.from));
  if(report.to)parts.push("to="+encodeURIComponent(report.to));
  if(report.domain)parts.push("domain="+encodeURIComponent(report.domain));
  parts.push("top="+encodeURIComponent(report.top));
  if(extra)parts.push(extra);
  return parts.join("&");
}
/* A day string moved by whole days, in UTC, so that a browser in a zone with
   a daylight-saving change cannot turn "seven days back" into six or eight. */
function reportShiftDay(day,by){
  const parts=String(day||"").split("-");
  if(parts.length!==3)return day;
  const at=Date.UTC(Number(parts[0]),Number(parts[1])-1,Number(parts[2]));
  const moved=new Date(at+by*86400000);
  const pad=n=>(n<10?"0":"")+n;
  return moved.getUTCFullYear()+"-"+pad(moved.getUTCMonth()+1)+"-"+pad(moved.getUTCDate());
}
function reportColumnName(key){
  return REPORT_COLUMNS[key]?t(REPORT_COLUMNS[key]):key;
}
/* Grouped bars, drawn as SVG in the page itself: no library, nothing fetched,
   and a value under the pointer. A chart is here because a month of daily
   counts is the one thing in this report that a table genuinely does not
   show - the shape of it - and not because a chart is decorative. */

function reportSectionChart(id,answer){
  const rows=answer.rows||[];
  if(!rows.length)return "";
  if(id==="traffic"){
    /* One bar per day, so a domain picked apart across several rows of the same
       day is added up first - the chart is of the window, not of the rows. */
    const byDay={},order=[];
    rows.forEach(r=>{
      if(!byDay[r.day]){byDay[r.day]={i:0,o:0};order.push(r.day);}
      byDay[r.day].i+=Number(r.incoming)||0;
      byDay[r.day].o+=Number(r.outgoing)||0;
    });
    return reportChartHtml(order,[
      {label:K("Incoming"),colour:"#36c2ff",values:order.map(d=>byDay[d].i)},
      {label:K("Outgoing"),colour:"#7c5cff",values:order.map(d=>byDay[d].o)}
    ]);
  }
  return reportChartHtml(rows.map(r=>r.day),[
    {label:K("Megabytes"),colour:"#3fb950",values:rows.map(r=>Number(r.megabytes)||0)}
  ]);
}
function reportSectionHtml(section,answer){
  if(!answer)return "";
  const columns=answer.columns||[],rows=answer.rows||[];
  const head=columns.map(c=>"<th>"+escHtml(reportColumnName(c))+"</th>").join("");
  const body=rows.map(r=>"<tr>"+columns.map(c=>"<td>"+escHtml(r[c]===undefined||r[c]===null?"—":r[c])+"</td>").join("")+"</tr>").join("");
  const badge=answer.enabled?"":'<span class="badge warn">'+t("Not recorded")+"</span>";
  const truncated=answer.truncated?'<span class="badge warn">'+t("Partial")+"</span>":"";
  const csv="/api/v1/reports/"+encodeURIComponent(section.id)+"?"+reportQuery("format=csv");
  return '<div class="sect"><h2>'+escHtml(t(section.title))+' <code class="muted">GET /api/v1/reports/'+escHtml(section.id)+"</code> "+badge+truncated+
    '<span class="sp"></span><a class="btn ghost sm" id="csv_'+escHtml(section.id)+'" href="'+escHtml(csv)+'" download>'+t("CSV")+"</a></h2>"+
    '<div class="card flat"><p class="note">'+escHtml(answer.note||"")+"</p>"+
    (section.chart?reportSectionChart(section.id,answer):"")+
    '<div class="tablewrap"><table><thead><tr>'+head+"</tr></thead><tbody>"+
    (body||'<tr><td colspan="'+Math.max(1,columns.length)+'" class="empty">'+t("Nothing in this range.")+"</td></tr>")+
    "</tbody></table></div>"+reportByCountryHtml(answer)+"</div></div>";
}
/* The countries section carries a second table the others do not: the refusals
   split by country. It is drawn separately because it is a different period -
   the counters as they stand since the server started, not the window above -
   and the section's own note from the server says so. */
function reportByCountryHtml(answer){
  const rows=answer.by_country||[];
  if(!rows.length)return "";
  const body=rows.map(r=>"<tr><td>"+escHtml(r.country||"")+"</td><td>"+escHtml(String(r.refused))+"</td></tr>").join("");
  return '<p class="note" style="margin-top:14px"><b>'+t("By country, since the server started")+"</b></p>"+
    '<div class="tablewrap"><table><thead><tr><th>'+t("Country")+"</th><th>"+t("Refused")+"</th></tr></thead><tbody>"+body+"</tbody></table></div>";
}
async function renderReports(){
  const index=await api("/api/v1/reports");
  if(!report.to){report.from=index.from;report.to=index.to;}
  cache.domains=asList(await api("/api/v1/domains"),"domains");
  const answer=await api("/api/v1/reports/summary?"+reportQuery());
  const sections=answer.sections||{};
  const omitted=(answer.omitted||[]).map(o=>"<li>"+escHtml(o.section+" — "+o.reason)+"</li>").join("");
  const notAnswerable=(index.not_answerable||[]).map(s=>"<li>"+escHtml(s)+"</li>").join("");
  const sources=index.sources||{};
  const sourceRow=(name,key)=>{
    const s=sources[key]||{};
    return "<tr><td>"+escHtml(name)+"</td><td>"+(s.enabled?'<span class="badge good">'+t("Active")+"</span>":'<span class="badge warn">'+t("Not recorded")+"</span>")+
      "</td><td>"+escHtml(s.retention_days?String(s.retention_days):"—")+"</td><td>"+escHtml(s.oldest||"—")+"</td></tr>";
  };
  const domainOptions='<option value="">'+t("All domains")+"</option>"+
    cache.domains.map(d=>'<option value="'+escHtml(d.name)+'"'+(d.name===report.domain?" selected":"")+">"+escHtml(d.name)+"</option>").join("");
  $("#content").innerHTML='<div class="view">'+
    '<div class="card flat"><div class="row">'+
      "<label>"+t("From")+' <input id="repFrom" type="date" value="'+escHtml(report.from||"")+'"></label>'+
      "<label>"+t("To")+' <input id="repTo" type="date" value="'+escHtml(report.to||"")+'"></label>'+
      "<label>"+t("Domain")+' <select id="repDomain">'+domainOptions+"</select></label>"+
      "<label>"+t("Rows")+' <input id="repTop" type="number" min="1" max="200" value="'+escHtml(String(report.top))+'"></label>'+
      '<button class="btn" data-act="repshow">'+t("Show")+"</button>"+
      '<button class="btn ghost sm" data-act="repdays" data-days="7">'+t("Last 7 days")+"</button>"+
      '<button class="btn ghost sm" data-act="repdays" data-days="30">'+t("Last 30 days")+"</button>"+
      '<button class="btn ghost sm" data-act="repdays" data-days="90">'+t("Last 90 days")+"</button>"+
      '<div class="err" id="err_reports"></div></div></div>'+
    '<div class="sect"><h2>'+t("What this server keeps")+' <code class="muted">GET /api/v1/reports</code></h2>'+
      '<div class="card flat"><div class="tablewrap"><table><thead><tr><th>'+t("Source")+"</th><th>"+t("Status")+"</th><th>"+
      t("Retention")+"</th><th>"+t("Oldest")+"</th></tr></thead><tbody>"+
      sourceRow(t("Message trace"),"message_trace")+sourceRow(t("Metric history"),"metric_history")+sourceRow(t("Message store"),"message_store")+
      "</tbody></table></div>"+
      '<p class="note" style="margin-top:14px"><b>'+t("What cannot be answered")+"</b></p><ul class=\"note\">"+notAnswerable+omitted+"</ul></div></div>"+
    REPORT_SECTIONS.map(s=>reportSectionHtml(s,sections[s.id])).join("")+
    "</div>";
}
function reportShow(){
  const from=document.getElementById("repFrom"),to=document.getElementById("repTo");
  const domain=document.getElementById("repDomain"),top=document.getElementById("repTop");
  if(from)report.from=from.value;
  if(to)report.to=to.value;
  if(domain)report.domain=domain.value;
  if(top){const n=Number(top.value);report.top=n>=1&&n<=200?Math.round(n):10;}
  render();
}
function reportLastDays(days){
  report.to=report.to||"";
  report.from=reportShiftDay(report.to,-(Number(days)-1));
  render();
}

