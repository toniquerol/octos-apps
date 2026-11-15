/* Panel privado de consumo API de OcToS Team.
 * Solicita solo métricas al Worker; nunca almacena tokens ni claves en el navegador. */
(function(){
 "use strict";
 const section=document.getElementById("api-telemetry");
 if(!section)return;
 const endpoint=document.getElementById("agents-endpoint");
 const auth=document.getElementById("agents-token");
 const period=document.getElementById("api-period");
 const refresh=document.getElementById("api-refresh");
 const state=document.getElementById("api-telemetry-state");
 const trend=document.getElementById("api-trend");
 const agents=document.getElementById("api-agents");
 const recent=document.getElementById("api-recent");
 const fields={
  calls:document.getElementById("api-calls"),
  tasks:document.getElementById("api-tasks"),
  input:document.getElementById("api-input"),
  output:document.getElementById("api-output"),
  cache:document.getElementById("api-cache"),
  expense:document.getElementById("api-expense")
 };
 const labels={chief:"Dirección", "agent-3":"A03 · Cartografía",
  "agent-4":"A04 · Integración"};
 const nf=new Intl.NumberFormat("es-ES");
 function num(n){return nf.format(Number(n)||0)}
 function money(n){
  if(n===null||n===undefined)return "Sin tarifa";
  const value=Number(n)||0;
  return new Intl.NumberFormat("es-ES",{style:"currency",currency:"USD",
   minimumFractionDigits: value>0&&value<0.01?6:2,
   maximumFractionDigits:value>0&&value<0.01?6:4}).format(value);
 }
 function node(tag,className,value){
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(value!==undefined)el.textContent=String(value);
  return el;
 }
 function empty(container,message){
  container.replaceChildren(node("p","api-empty",message));
 }
 function url(){
  const raw=endpoint?.value?.trim()||"";
  let parsed;try{parsed=new URL(raw)}catch{throw Error("Configura la URL del Worker en «Nueva petición / Input».")}
  if(parsed.protocol!=="https:"||parsed.username||parsed.password||parsed.search||parsed.hash)
   throw Error("La URL del Worker debe ser HTTPS y no contener parámetros ni contraseñas.");
  return parsed.origin+parsed.pathname.replace(/\/+$/, "");
 }
 function renderTrend(rows,days){
  trend.replaceChildren();
  if(!rows?.length){empty(trend,"Sin datos de consumo.");return}
  const barWrap=node("div","api-bars");
  const max=Math.max(1,...rows.map(x=>(Number(x.input_tokens)||0)+(Number(x.output_tokens)||0)));
  for(const item of rows){
   const total=(Number(item.input_tokens)||0)+(Number(item.output_tokens)||0);
   const cell=node("div","api-bar-slot");
   const bar=node("div","api-bar");
   bar.style.height=(total?Math.max(4,total/max*100):1)+"%";
   if(!total)bar.classList.add("api-bar-empty");
   bar.title=item.period.replace("T"," ")+" UTC · "+num(total)+" tokens · "+money(item.estimated_usd);
   bar.setAttribute("aria-label",bar.title);
   cell.append(bar);barWrap.append(cell);
  }
  trend.append(barWrap,node("div","api-axis",days===1?
   "Últimas 24 horas · agrupación horaria UTC":
   "Últimos "+days+" días · agrupación diaria UTC"));
 }
 function renderAgents(rows){
  agents.replaceChildren();
  if(!rows?.length){empty(agents,"Todavía no hay llamadas registradas.");return}
  for(const r of rows){
   const line=node("div","api-agent-row");
   const left=node("div","api-agent-name");
   left.append(node("strong","",labels[r.agent]||r.agent),
    node("small","",num(r.calls)+" llamadas · "+num((r.input_tokens||0)+(r.output_tokens||0))+" tokens"));
   line.append(left,node("b","",money(r.estimated_usd)));
   agents.append(line);
  }
 }
 function renderRecent(rows){
  recent.replaceChildren();
  if(!rows?.length){empty(recent,"No hay actividad registrada.");return}
  const table=node("table","api-recent-table");
  const head=node("thead");
  const hr=node("tr");
  for(const name of ["Fecha","Agente","Estado","Tokens","Coste estimado"])hr.append(node("th","",name));
  head.append(hr);table.append(head);
  const body=node("tbody");
  for(const r of rows){
   const tr=node("tr");
   const dt=Date.parse(r.at);
   const row=[
    Number.isFinite(dt)?new Date(dt).toLocaleString("es-ES",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}):"—",
    labels[r.agent]||r.agent,
    ({completed:"Completada",error:"Error",incomplete:"Incompleta"})[r.status]||"Sin datos",
    num((r.input_tokens||0)+(r.output_tokens||0)),
    money(r.estimated_usd)
   ];
   for(const v of row)tr.append(node("td","",v));
   body.append(tr);
  }
  table.append(body);recent.append(table);
 }
 function render(data){
  const t=data.totals||{};
  fields.calls.textContent=num(t.calls);
  fields.tasks.textContent=num(t.tasks_completed)+" / "+num(t.tasks_failed);
  fields.input.textContent=num(t.input_tokens);
  fields.output.textContent=num(t.output_tokens);
  fields.cache.textContent=num(t.cached_tokens);
  fields.expense.textContent=money(t.estimated_usd);
  renderTrend(data.trend,Number(data.days));
  renderAgents(data.agents);
  renderRecent(data.recent);
  const updated=Date.parse(data.generated_at);
  const details=["Worker OcToS", Number.isFinite(updated)?
   "Actualizado "+new Date(updated).toLocaleString("es-ES"): "Actualizado"];
  if(t.unpriced_calls)details.push(num(t.unpriced_calls)+" llamadas sin tarifa: coste parcial");
  if(data.truncated)details.push("Historial parcial: límite de registros alcanzado");
  state.textContent=details.join(" · ");
  state.classList.toggle("api-warning",!!(t.unpriced_calls||data.truncated));
 }
 let controller=null;
 async function load(){
  if(!section.closest(".view.active"))return;
  if(window.octosTeamIsMaster!==true){
   state.textContent="Telemetría reservada al PIN maestro.";
   return;
  }
  let base;
  try{base=url()}catch(err){state.textContent=err.message;return}
  const key=auth?.value?.trim();
  if(!key){
   state.textContent="Introduce la contraseña del servicio en «Nueva petición / Input» para consultar consumos.";
   return;
  }
  if(controller)controller.abort();
  controller=new AbortController();
  const signal=controller.signal;
  refresh.disabled=true;
  state.textContent="Consultando telemetría del Worker…";
  try{
   const response=await fetch(base+"/telemetry?days="+period.value,{
    headers:{"Authorization":"Bearer "+key},cache:"no-store",signal});
   let data={};try{data=await response.json()}catch(_){}
   if(!response.ok)throw Error(data.error||"Error HTTP "+response.status);
   if(data.scope!=="octos-team-worker")throw Error("Respuesta de telemetría no reconocida.");
   render(data);
  }catch(err){
   if(err.name!=="AbortError"){
    state.textContent="Telemetría no disponible: "+err.message;
    state.classList.add("api-warning");
   }
  }finally{
   if(!signal.aborted){refresh.disabled=false;controller=null}
  }
 }
 refresh.addEventListener("click",load);
 period.addEventListener("change",load);
 document.addEventListener("click",event=>{
  if(event.target.closest('[data-page="room"],#nav-home,#team-access-submit'))
   setTimeout(load,100);
 });
 auth?.addEventListener("change",()=>{if(section.closest(".view.active"))load()});
 endpoint?.addEventListener("change",()=>{if(section.closest(".view.active"))load()});
 window.addEventListener("pageshow",()=>setTimeout(load,100));
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)load()});
 setInterval(()=>{if(!document.hidden&&section.closest(".view.active"))load()},60000);
 setTimeout(load,200);
})();
