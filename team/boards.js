/* OcToS Team · pizarras locales por grupo. No ejecuta agentes ni envía tareas a la API. */
(function(){
"use strict";
const KEY="octos-team-boards-v1";
const groups=[
 {id:"group-1",name:"Grupo 01 · Identidad e interfaces",agents:[["agent-1","A01 · Identidad"],["agent-2","A02 · Interfaces"]]},
 {id:"group-2",name:"Grupo 02 · Cartografía e integración",agents:[["agent-3","A03 · Cartografía"],["agent-4","A04 · Integración"]]},
 {id:"group-3",name:"Grupo 03 · SketchUp y Ruby",agents:[["agent-5","A05 · Desarrollo Ruby"],["agent-6","A06 · Herramientas 3D"]]},
 {id:"group-4",name:"Grupo 04 · I+D+i",agents:[["agent-7","A07 · Investigación"],["agent-8","A08 · Prototipos"]]}
];
const states=["Pendiente","En investigación","Informe pendiente","Finalizada"];
const css=document.createElement("style");
css.textContent=[
 ".team-board-launch{display:block;width:100%;border:1px solid #ff6a1a;color:#ffb485;background:#ff6a1a12;border-radius:9px;padding:12px 13px;margin:0 0 15px;font-size:12px;text-align:left;font-weight:650}",
 ".team-board-launch:hover{background:#ff6a1a20}",
 ".team-board-overlay[hidden]{display:none!important}",
 ".team-board-overlay{position:fixed;inset:0;z-index:9000;display:grid;place-items:center;padding:18px;background:#000b}",
 ".team-board-window{width:min(980px,100%);max-height:min(92dvh,980px);overflow:auto;background:#1a1b1e;color:#f1f1ef;border:1px solid #56585e;border-radius:15px;box-shadow:0 22px 85px #000b;padding:clamp(16px,2.5vw,30px);font:13px 'IBM Plex Sans',system-ui,sans-serif}",
 ".team-board-head{display:flex;align-items:start;justify-content:space-between;gap:18px;margin-bottom:18px}",
 ".team-board-head h2{font:650 23px Manrope,system-ui,sans-serif;margin:5px 0}",
 ".team-board-head p,.team-board-help{font-size:11px;color:#a9abb1;line-height:1.6;margin:5px 0}",
 ".team-board-eyebrow{color:#ff6a1a;font-size:10px;letter-spacing:.15em;text-transform:uppercase;font-weight:700}",
 ".team-board-close{font-size:20px;min-width:38px;min-height:38px}",
 ".team-board-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:0 0 19px}",
 ".team-board-tabs button,.team-board-close,.team-board-action,.team-board-form button{border:1px solid #555760;border-radius:8px;background:#292a2e;color:#f1f1ef;padding:10px 12px;font:inherit}",
 ".team-board-tabs button[aria-selected=true]{border-color:#ff6a1a;background:#ff6a1a14;color:#ffb485}",
 ".team-board-tabs button{font-size:11px;text-align:center}",
 ".team-board-layout{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:15px;align-items:start}",
 ".team-board-compose,.team-board-tasks{padding:17px;border:1px solid #383a40;border-radius:11px;background:#202125;min-width:0}",
 ".team-board-compose h3,.team-board-tasks h3{margin:0 0 14px;font-size:14px;font-weight:650}",
 ".team-board-compose label{display:block;font-size:11px;color:#dbdce0;margin:12px 0 6px}",
 ".team-board-compose input,.team-board-compose select,.team-board-compose textarea,.team-board-card select{width:100%;background:#101114;border:1px solid #54565c;border-radius:7px;color:#f1f1ef;font:13px 'IBM Plex Sans',system-ui,sans-serif;padding:10px;min-width:0}",
 ".team-board-compose textarea{resize:vertical;min-height:112px}",
 ".team-board-dictation{display:flex;align-items:center;gap:9px;margin:9px 0}",
 ".team-board-dictation button{width:42px;height:42px;display:grid;place-items:center;flex:0 0 42px;padding:0}",
 ".team-board-dictation button[aria-pressed=true]{border-color:#ff6a1a;color:#ff6a1a}",
 ".team-board-dictation button:disabled{opacity:.45;cursor:not-allowed}",
 ".team-board-dictation small{color:#b0b2b9;font-size:11px;line-height:1.4}",
 ".team-board-form-actions{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 0}",
 ".team-board-form button.primary{color:#0e0e10;background:#ff6a1a;border-color:#ff6a1a;font-weight:700}",
 ".team-board-feedback{min-height:16px;color:#ffb485;font-size:11px;line-height:1.5;margin:10px 0 0}",
 ".team-board-count{font-size:11px;color:#a9abb1}",
 ".team-board-list{display:grid;gap:10px;margin-top:13px}",
 ".team-board-card{background:#16171a;border:1px solid #3c3e44;border-radius:9px;padding:14px;min-width:0}",
 ".team-board-card strong{display:block;font-size:13px;overflow-wrap:anywhere}",
 ".team-board-card p{font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;color:#c4c5ca;margin:9px 0}",
 ".team-board-meta{color:#a5a7ad;font-size:10px;margin-top:8px}",
 ".team-board-card-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px}",
 ".team-board-card-actions label{font-size:10px;color:#b9bac0;flex:1 1 120px}",
 ".team-board-card select{margin-top:5px;padding:7px;font-size:11px}",
 ".team-board-action{padding:8px 10px;font-size:11px}",
 ".team-board-delete{border-color:#8b5a56}",
 ".team-board-empty{font-size:12px;color:#a9abb1;line-height:1.6}",
 "@media(max-width:760px){.team-board-overlay{padding:8px}.team-board-window{max-height:96dvh}.team-board-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.team-board-layout{grid-template-columns:1fr}}"
].join("\n");
document.head.append(css);

const overlay=document.createElement("section");
overlay.id="team-board-overlay";
overlay.className="team-board-overlay";
overlay.hidden=true;
overlay.setAttribute("role","dialog");
overlay.setAttribute("aria-modal","true");
overlay.setAttribute("aria-label","Pizarras de encargos de OcToS Team");
overlay.innerHTML=
 '<div class="team-board-window">'+
 '<div class="team-board-head"><div><div class="team-board-eyebrow">OcToS Team / Encargos</div><h2>Pizarras de investigación</h2><p>Una pizarra por grupo. Los estados se gestionan manualmente.</p></div><button class="team-board-close" type="button" aria-label="Cerrar pizarra">×</button></div>'+
 '<div class="team-board-tabs" role="tablist" aria-label="Grupo de trabajo"></div>'+
 '<div class="team-board-layout">'+
 '<form class="team-board-compose"><h3 id="team-board-form-title">Nueva tarea</h3>'+
 '<label for="team-board-title">Título (opcional)</label><input id="team-board-title" maxlength="100" placeholder="Título breve">'+
 '<label for="team-board-agent">Asignar a</label><select id="team-board-agent"></select>'+
 '<label for="team-board-message">Encargo o investigación</label><textarea id="team-board-message" maxlength="2500" rows="6" required placeholder="Escribe o dicta lo que quieres que investiguen…"></textarea>'+
 '<div class="team-board-dictation"><button id="team-board-mic" type="button" aria-label="Iniciar dictado" aria-pressed="false" aria-controls="team-board-message"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg></button><small id="team-board-speech-status" role="status" aria-live="polite">Micrófono para transcribir, no para enviar.</small></div>'+
 '<p class="team-board-help">El audio puede procesarse mediante el servicio de voz del navegador. Revisa el texto antes de guardar.</p>'+
 '<div class="team-board-form-actions"><button class="primary" id="team-board-save" type="submit">Añadir tarea</button><button type="button" id="team-board-cancel" hidden>Cancelar edición</button></div>'+
 '<p class="team-board-feedback" role="status" aria-live="polite"></p>'+
 '</form>'+
 '<div class="team-board-tasks"><h3>Tareas de la pizarra <span class="team-board-count"></span></h3><p class="team-board-help">Las notas se guardan solo en este navegador. No activan los agentes ni ejecutan investigaciones automáticas.</p><div class="team-board-list"></div></div>'+
 '</div></div>';
document.body.append(overlay);
const el=s=>overlay.querySelector(s);
const tabs=el(".team-board-tabs"),form=el(".team-board-compose"),list=el(".team-board-list"),count=el(".team-board-count");
const title=el("#team-board-title"),agent=el("#team-board-agent"),message=el("#team-board-message");
const save=el("#team-board-save"),cancel=el("#team-board-cancel"),feedback=el(".team-board-feedback");
const mic=el("#team-board-mic"),speechStatus=el("#team-board-speech-status");
const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let active="group-2",editing=null,lastTrigger=null,speech=null,records=[];
try{
 const parsed=JSON.parse(localStorage.getItem(KEY)||"[]");
 if(Array.isArray(parsed))records=parsed.filter(x=>x&&typeof x.id==="string"&&groups.some(g=>g.id===x.group)&&typeof x.message==="string");
}catch(_){}
const current=()=>groups.find(g=>g.id===active);
const currentTasks=()=>records.filter(t=>t.group===active).sort((a,b)=>(b.updatedAt||"").localeCompare(a.updatedAt||""));
function status(text){feedback.textContent=text}
function persist(next){
 try{localStorage.setItem(KEY,JSON.stringify(next));records=next;return true}
 catch(_){status("No se pudo guardar en este navegador. Comprueba el almacenamiento disponible.");return false}
}
function stopSpeech(abort){
 if(!speech)return;
 const s=speech;
 if(abort){speech=null;clearTimeout(s.timer);try{s.recognition.abort()}catch(_){}speechControls();return}
 if(s.stopping)return;
 s.stopping=true;clearTimeout(s.timer);
 speechStatus.textContent="Terminando la transcripción…";
 try{s.recognition.stop()}catch(_){speech=null;speechControls()}
 s.timer=setTimeout(()=>{if(speech===s){speech=null;speechControls()}},5000);
}
function speechControls(){
 const activeSpeech=!!speech;
 mic.setAttribute("aria-pressed",String(activeSpeech));
 mic.setAttribute("aria-label",activeSpeech?"Detener dictado":"Iniciar dictado");
 mic.title=activeSpeech?"Detener dictado":"Iniciar dictado";
 mic.disabled=!SpeechRecognition;
 message.readOnly=activeSpeech;
 if(!SpeechRecognition)speechStatus.textContent="Dictado no disponible en este navegador.";
}
mic.addEventListener("click",()=>{
 if(speech){stopSpeech(false);return}
 if(!SpeechRecognition)return;
 if(message.value.length>=2500){speechStatus.textContent="Límite de 2500 caracteres alcanzado.";return}
 let recognition;
 try{recognition=new SpeechRecognition()}catch(_){speechStatus.textContent="No se pudo iniciar el dictado.";return}
 const s={recognition,base:message.value,timer:null,stopping:false};
 speech=s;speechControls();
 recognition.lang="es-ES";recognition.continuous=true;recognition.interimResults=true;
 speechStatus.textContent="Iniciando micrófono… Autoriza el permiso si aparece.";
 recognition.onstart=()=>{if(speech===s)speechStatus.textContent="Escuchando. Pulsa el micrófono para detener.";};
 recognition.onresult=event=>{
  if(speech!==s)return;
  const finals=[],partials=[];
  for(let i=0;i<event.results.length;i++){
   const t=event.results[i][0].transcript.trim();
   if(t)(event.results[i].isFinal?finals:partials).push(t);
  }
  const all=finals.join(" ");
  message.value=(s.base+(s.base&&all&&!/\s$/.test(s.base)?" ":"")+all).slice(0,2500);
  speechStatus.textContent=partials.length?"Escuchando: "+partials.join(" "):"Escuchando. Texto confirmado añadido.";
  if(message.value.length>=2500)stopSpeech(false);
 };
 recognition.onerror=event=>{
  if(speech!==s)return;
  const problems={"not-allowed":"Permiso de micrófono denegado.","audio-capture":"No se detecta micrófono.","network":"Error del servicio de reconocimiento de voz.","no-speech":"No se ha detectado voz."};
  speechStatus.textContent=problems[event.error]||"Dictado interrumpido.";
  stopSpeech(true);
 };
 recognition.onend=()=>{if(speech!==s)return;speech=null;clearTimeout(s.timer);speechControls();if(!s.stopping)speechStatus.textContent="Dictado finalizado. Revisa el texto.";else speechStatus.textContent="Dictado detenido. Revisa el texto.";};
 s.timer=setTimeout(()=>stopSpeech(false),90000);
 try{recognition.start()}catch(_){stopSpeech(true);speechStatus.textContent="No se pudo iniciar el micrófono."}
});
function clearForm(){
 stopSpeech(true);editing=null;form.reset();title.value="";message.value="";
 save.textContent="Añadir tarea";cancel.hidden=true;el("#team-board-form-title").textContent="Nueva tarea";
 renderAgents();status("");
}
function renderAgents(selected){
 agent.replaceChildren();
 for(const [id,name] of current().agents){
  const option=document.createElement("option");option.value=id;option.textContent=name;agent.append(option);
 }
 if(selected&&current().agents.some(([id])=>id===selected))agent.value=selected;
}
function renderTabs(){
 tabs.replaceChildren();
 for(const g of groups){
  const b=document.createElement("button");b.type="button";b.textContent=g.name.replace(/ · .*/,"");
  b.setAttribute("role","tab");b.setAttribute("aria-selected",String(g.id===active));
  b.addEventListener("click",()=>{if(g.id===active)return;active=g.id;clearForm();renderTabs();renderList();});
  tabs.append(b);
 }
}
function create(tag,className,text){
 const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;
}
function renderList(){
 const tasks=currentTasks();
 count.textContent="("+tasks.length+")";
 list.replaceChildren();
 if(!tasks.length){list.append(create("p","team-board-empty","Todavía no hay tareas en este grupo."));return}
 for(const t of tasks){
  const card=create("article","team-board-card");
  card.append(create("strong","",t.title||t.message.slice(0,85)));
  card.append(create("p","",t.message));
  const assigned=current().agents.find(([id])=>id===t.agent);
  card.append(create("div","team-board-meta",(assigned?assigned[1]:"Sin asignar")+" · "+new Date(t.createdAt||Date.now()).toLocaleDateString("es-ES")));
  const actions=create("div","team-board-card-actions"),label=create("label");
  label.textContent="Estado manual";
  const select=create("select");select.setAttribute("aria-label","Estado de "+(t.title||"tarea"));
  for(const value of states){const option=create("option","",value);option.value=value;select.append(option)}
  select.value=states.includes(t.state)?t.state:states[0];
  select.addEventListener("change",()=>{
   const next=records.map(x=>x.id===t.id?{...x,state:select.value,updatedAt:new Date().toISOString()}:x);
   if(persist(next))status("Estado actualizado.");else select.value=t.state||states[0];
  });
  label.append(select);actions.append(label);
  const edit=create("button","team-board-action","Editar");edit.type="button";
  edit.addEventListener("click",()=>{
   stopSpeech(true);editing=t.id;title.value=t.title||"";message.value=t.message;renderAgents(t.agent);
   save.textContent="Guardar cambios";cancel.hidden=false;el("#team-board-form-title").textContent="Editar tarea";
   status("Editando la tarea. Los cambios se guardan al confirmar.");message.focus();
  });
  const del=create("button","team-board-action team-board-delete","Eliminar");del.type="button";
  del.addEventListener("click",()=>{
   if(!confirm("¿Eliminar esta tarea de la pizarra?"))return;
   if(persist(records.filter(x=>x.id!==t.id))){if(editing===t.id)clearForm();renderList();status("Tarea eliminada.");}
  });
  actions.append(edit,del);card.append(actions);list.append(card);
 }
}
form.addEventListener("submit",event=>{
 event.preventDefault();stopSpeech(true);
 const description=message.value.trim().slice(0,2500);
 if(!description){status("Escribe o dicta un encargo antes de guardarlo.");message.focus();return}
 const now=new Date().toISOString();
 const data={title:title.value.trim().slice(0,100),message:description,agent:agent.value,group:active,updatedAt:now};
 let next;
 if(editing){
  next=records.map(x=>x.id===editing?{...x,...data}:x);
 }else{
  const id=(crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+"-"+Math.random().toString(36).slice(2);
  next=[...records,{...data,id,state:"Pendiente",createdAt:now}];
 }
 if(persist(next)){const edited=!!editing;clearForm();renderList();status(edited?"Tarea actualizada en este navegador.":"Tarea añadida en este navegador.");}
});
cancel.addEventListener("click",clearForm);
function open(groupId,trigger){
 if(groupId&&groups.some(g=>g.id===groupId))active=groupId;
 lastTrigger=trigger||document.activeElement;
 clearForm();renderTabs();renderList();overlay.hidden=false;
 document.body.style.overflow="hidden";
 el(".team-board-close").focus();
}
function close(){
 stopSpeech(true);overlay.hidden=true;document.body.style.overflow="";
 if(lastTrigger&&typeof lastTrigger.focus==="function")lastTrigger.focus();
}
el(".team-board-close").addEventListener("click",close);
overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
document.addEventListener("keydown",e=>{if(!overlay.hidden&&e.key==="Escape"){e.preventDefault();close()}});
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopSpeech(true)});
const launch=document.createElement("button");launch.type="button";launch.className="mini";
launch.textContent="Pizarras";launch.title="Abrir pizarras de encargos";
const topActions=document.querySelector("#room>.room-top .actions");
if(topActions){const first=topActions.querySelector("button");first?first.insertAdjacentElement("afterend",launch):topActions.append(launch);}
launch.addEventListener("click",()=>open(null,launch));
const previous=window.octosTeamShowConfig;
window.octosTeamShowConfig=function(id,item){
 if(previous)previous(id,item);
 const groupId=groups.some(g=>g.id===id)?id:/^agent-[1-8]$/.test(id)?"group-"+Math.ceil(Number(id.split("-")[1])/2):null;
 if(!groupId)return;
 const panel=document.getElementById("team-config-container");if(!panel)return;
 const b=create("button","team-board-launch","Abrir pizarra del grupo");
 b.type="button";
 b.addEventListener("click",()=>open(groupId,b));
 panel.prepend(b);panel.hidden=false;
};
speechControls();
})();