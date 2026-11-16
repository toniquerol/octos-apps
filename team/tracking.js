/* OcToS Team · coordinación y seguimiento local, sin ejecución de agentes. */
(function(){
"use strict";
const KEY="octos-team-boards-v1";
const states=["Pendiente","En investigación","Informe pendiente","Finalizada"];
const agents={"agent-1":"A01 · Identidad","agent-2":"A02 · Interfaces","agent-3":"A03 · Cartografía","agent-4":"A04 · Integración","agent-5":"A05 · Desarrollo Ruby","agent-6":"A06 · Herramientas 3D","agent-7":"A07 · Investigación","agent-8":"A08 · Prototipos"};
const style=document.createElement("style");
style.textContent=`
.team-ops-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}
.team-ops-actions button{border:1px solid #555760;background:#25262a;color:#f1f1ef;border-radius:8px;padding:12px 8px;font-size:12px}
.team-ops-actions button:hover{border-color:#ff6a1a}
.team-ops-overlay[hidden]{display:none!important}
.team-ops-overlay{position:fixed;inset:0;z-index:9100;background:#000c;display:grid;place-items:center;padding:12px}
.team-ops-dialog{background:#1a1b1e;color:#f1f1ef;border:1px solid #505158;border-radius:14px;width:min(980px,100%);max-height:94dvh;overflow:auto;padding:22px;font-family:"IBM Plex Sans",system-ui,sans-serif}
.team-ops-head{display:flex;justify-content:space-between;align-items:center;gap:12px}
.team-ops-head h2{font:650 23px Manrope,system-ui;margin:6px 0}
.team-ops-dialog button,.team-ops-dialog select{background:#292a2e;border:1px solid #565860;border-radius:7px;color:#f1f1ef;padding:9px;font:inherit}
.team-ops-dialog button:focus-visible,.team-ops-dialog select:focus-visible{outline:2px solid #ff6a1a}
.team-ops-sub{color:#b6b7bd;font-size:12px;line-height:1.6}
.team-ops-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:20px 0}
.team-ops-metrics div{border:1px solid #3e4045;padding:14px;border-radius:9px;background:#222327}
.team-ops-metrics strong{display:block;font-size:24px}.team-ops-metrics small{color:#aaa;font-size:11px}
.team-ops-toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.team-ops-list{display:grid;gap:10px;margin-top:15px}
.team-ops-item{border:1px solid #414249;border-radius:9px;padding:14px;background:#202125}
.team-ops-item strong{font-size:13px}.team-ops-item p{font-size:12px;color:#c1c2c7;white-space:pre-wrap;overflow-wrap:anywhere}
.team-ops-meta{font-size:11px;color:#aaa;margin:8px 0}
.team-ops-item label{display:inline-flex;gap:8px;align-items:center;font-size:11px;margin-top:8px}
@media(max-width:620px){.team-ops-metrics{grid-template-columns:repeat(2,1fr)}.team-ops-dialog{padding:14px}}
`;
document.head.append(style);
const sidebar=document.getElementById("team-board-sidebar-actions");
if(!sidebar)return;
const actions=document.createElement("div");actions.className="team-ops-actions";
const coordinator=document.createElement("button");coordinator.type="button";coordinator.textContent="Coordinador IA";
const tracking=document.createElement("button");tracking.type="button";tracking.textContent="Seguimiento";
actions.append(coordinator,tracking);sidebar.append(actions);
const overlay=document.createElement("div");overlay.className="team-ops-overlay";overlay.hidden=true;
overlay.innerHTML='<section class="team-ops-dialog" role="dialog" aria-modal="true" aria-labelledby="team-ops-title"><div class="team-ops-head"><h2 id="team-ops-title">Seguimiento</h2><button type="button" id="team-ops-close" aria-label="Cerrar">Cerrar</button></div><p class="team-ops-sub" id="team-ops-description"></p><div class="team-ops-metrics" id="team-ops-metrics"></div><div class="team-ops-toolbar"><label>Grupo <select id="team-ops-group"><option value="">Todos</option><option value="group-1">Grupo 01</option><option value="group-2">Grupo 02</option><option value="group-3">Grupo 03</option><option value="group-4">Grupo 04</option></select></label><label>Estado <select id="team-ops-state"><option value="">Todos</option></select></label><button type="button" id="team-ops-export">Exportar registro JSON</button></div><div id="team-ops-list" class="team-ops-list"></div></section>';
document.body.append(overlay);
const $=s=>overlay.querySelector(s),stateSelect=$("#team-ops-state");
for(const state of states){const o=document.createElement("option");o.value=state;o.textContent=state;stateSelect.append(o)}
let lastFocus=null,view="tracking";
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||"[]");return Array.isArray(x)?x.filter(t=>t&&typeof t.id==="string"&&typeof t.message==="string"):[]}catch{return []}}
function save(tasks){try{localStorage.setItem(KEY,JSON.stringify(tasks));return true}catch{return false}}
function render(){
const tasks=read(),counts=states.map(s=>tasks.filter(t=>(t.state||states[0])===s).length);
$("#team-ops-metrics").replaceChildren();
for(let i=0;i<states.length;i++){const box=document.createElement("div"),num=document.createElement("strong"),lab=document.createElement("small");num.textContent=String(counts[i]);lab.textContent=states[i];box.append(num,lab);$("#team-ops-metrics").append(box)}
const group=$("#team-ops-group").value,status=$("#team-ops-state").value;
const shown=tasks.filter(t=>(!group||t.group===group)&&(!status||(t.state||states[0])===status)).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
const list=$("#team-ops-list");list.replaceChildren();
if(!shown.length){const p=document.createElement("p");p.className="team-ops-sub";p.textContent="No hay tareas para estos filtros.";list.append(p)}
for(const t of shown){
const article=document.createElement("article");article.className="team-ops-item";
const title=document.createElement("strong");title.textContent=t.title||t.message.slice(0,90);
const body=document.createElement("p");body.textContent=t.message;
const meta=document.createElement("div");meta.className="team-ops-meta";meta.textContent=(t.group||"Sin grupo")+" · "+(agents[t.agent]||"Sin asignar")+" · "+(t.updatedAt?new Date(t.updatedAt).toLocaleString("es-ES"):"Sin fecha");
const label=document.createElement("label");label.textContent="Estado";
const select=document.createElement("select");select.setAttribute("aria-label","Estado de "+title.textContent);
for(const s of states){const option=document.createElement("option");option.value=s;option.textContent=s;select.append(option)}
select.value=states.includes(t.state)?t.state:states[0];
select.addEventListener("change",()=>{const all=read(),next=all.map(item=>item.id===t.id?{...item,state:select.value,updatedAt:new Date().toISOString()}:item);if(!save(next))alert("No se pudo guardar el estado.");render()});
label.append(select);article.append(title,body,meta,label);list.append(article)
}
}
function open(which,button){
view=which;lastFocus=button;$("#team-ops-title").textContent=which==="coordinator"?"Coordinador IA · Dirección":"Seguimiento de tareas";
$("#team-ops-description").textContent=which==="coordinator"?
"Centro de coordinación. Las órdenes se registran en las pizarras y aquí se supervisan. La asignación y ejecución mediante API aún no están conectadas; no se han iniciado agentes.":
"Registro compartido con las pizarras de OcToS Team. Estados manuales, guardados únicamente en este navegador; no se ejecutan agentes.";
overlay.hidden=false;render();$("#team-ops-close").focus();
}
function close(){overlay.hidden=true;if(lastFocus)lastFocus.focus()}
coordinator.addEventListener("click",()=>open("coordinator",coordinator));
tracking.addEventListener("click",()=>open("tracking",tracking));
$("#team-ops-close").addEventListener("click",close);
overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
overlay.addEventListener("keydown",e=>{if(e.key==="Escape")close()});
$("#team-ops-group").addEventListener("change",render);
stateSelect.addEventListener("change",render);
$("#team-ops-export").addEventListener("click",()=>{const blob=new Blob([JSON.stringify({format:"octos-team-tasks-v1",exportedAt:new Date().toISOString(),tasks:read()},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="octos-team-seguimiento.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
window.addEventListener("storage",e=>{if(e.key===KEY&&!overlay.hidden)render()});
})();
