/* OcToS Kitchen · Biblioteca de proyectos locales v1. No requiere servidor. */
(function () {
"use strict";
const api=window.octosKitchen;
if(!api){console.error("Kitchen: editor no disponible");return;}
const $=id=>document.getElementById(id);
const DB_NAME="octos-kitchen-projects-v1",STORE="projects";
const LIST_KEY="octos-kitchen-project-list-v1",KEY_PREFIX="octos-kitchen-project:";
const MIGRATED="octos-kitchen-library-migrated-v1",SESSION="octos-kitchen-session-v1",RECOVERY="octos-kitchen-recovery-v1";
let db=null,records=[],activeId=null,saveTimer=null,queue=Promise.resolve(),ready=false,suppress=false,storageError=false;
const cleanText=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const snapshot=v=>JSON.parse(JSON.stringify(v));
function note(value){$("khome-status").textContent=value;}
function recordId(){return "k"+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
function persistSession(tab){
 if(!activeId)return;
 try{sessionStorage.setItem(SESSION,JSON.stringify({id:activeId,tab:tab||"plan"}));}catch{}
}
function readSession(){try{return JSON.parse(sessionStorage.getItem(SESSION)||"null");}catch{return null;}}
function clearSession(){try{sessionStorage.removeItem(SESSION);}catch{}}
function openDB(){return new Promise((resolve,reject)=>{
 if(!window.indexedDB){reject(Error("IndexedDB no disponible"));return;}
 const r=indexedDB.open(DB_NAME,1);
 r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:"id"});};
 r.onsuccess=()=>resolve(r.result);
 r.onerror=()=>reject(r.error||Error("No se pudo abrir la biblioteca"));
 r.onblocked=()=>reject(Error("Biblioteca bloqueada por otra pestaña"));
});}
function dbAction(method,value){return new Promise((resolve,reject)=>{
 try{
  const tx=db.transaction(STORE,method==="getAll"?"readonly":"readwrite");
  const req=method==="getAll"?tx.objectStore(STORE).getAll():method==="put"?tx.objectStore(STORE).put(value):tx.objectStore(STORE).delete(value);
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error||Error("Error leyendo proyecto"));
  tx.onerror=()=>reject(tx.error||Error("Error de biblioteca"));
 }catch(e){reject(e);}
});}
function localIds(){try{const value=JSON.parse(localStorage.getItem(LIST_KEY)||"[]");return Array.isArray(value)?value:[];}catch{return [];}}
function localRead(){return localIds().map(id=>{try{return JSON.parse(localStorage.getItem(KEY_PREFIX+id)||"null");}catch{return null;}}).filter(Boolean);}
function localWrite(record){
 const ids=localIds(),value=JSON.stringify(record);
 localStorage.setItem(KEY_PREFIX+record.id,value);
 if(!ids.includes(record.id))localStorage.setItem(LIST_KEY,JSON.stringify(ids.concat(record.id)));
}
function localDelete(id){localStorage.removeItem(KEY_PREFIX+id);localStorage.setItem(LIST_KEY,JSON.stringify(localIds().filter(x=>x!==id)));}
async function readAll(){return db?dbAction("getAll"):localRead();}
async function storeRecord(record){return db?dbAction("put",record):localWrite(record);}
async function deleteRecord(id){return db?dbAction("delete",id):localDelete(id);}
function validRecord(r){return r&&typeof r.id==="string"&&r.id.length<100&&typeof r.name==="string"&&r.project&&typeof r.project==="object";}
function getRecord(id){return records.find(r=>r.id===id);}
function saveCurrent(){
 if(!ready||suppress||!activeId)return queue;
 const previous=getRecord(activeId);
 if(!previous)return queue;
 const project=snapshot(api.getProject()),now=Date.now();
 const rec={id:activeId,name:(project.name||previous.name||"Mi cocina").slice(0,80),createdAt:previous.createdAt||now,updatedAt:now,project};
 records=records.map(r=>r.id===rec.id?rec:r);
 queue=queue.catch(()=>{}).then(()=>storeRecord(rec)).catch(e=>{storageError=true;note("Error al guardar: "+e.message+". Exporta una copia JSON.");});
 return queue;
}
function scheduleSave(){
 if(!ready||suppress||!activeId)return;
 try{localStorage.setItem(RECOVERY,JSON.stringify({id:activeId,time:Date.now(),project:api.getProject()}));}catch{}
 clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveTimer=null;saveCurrent();},180);
}
async function flush(){
 if(saveTimer){clearTimeout(saveTimer);saveTimer=null;saveCurrent();}
 await queue;
 if(!storageError)try{const rec=JSON.parse(localStorage.getItem(RECOVERY)||"null");if(rec&&rec.id===activeId)localStorage.removeItem(RECOVERY);}catch{}
}
function fileDownload(obj,name){
 const safe=String(name||"cocina").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"cocina";
 const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
 const url=URL.createObjectURL(blob),a=document.createElement("a");
 a.href=url;a.download="OcToS-Kitchen-"+safe+".json";document.body.appendChild(a);a.click();
 setTimeout(()=>{a.remove();URL.revokeObjectURL(url);},1600);
}
function floorPreview(data){
 const pts=Array.isArray(data.walls)?data.walls:[];
 if(!data.closed||pts.length<3)return '<svg viewBox="0 0 200 110" aria-hidden="true"><path d="M28 82 V26 H170 V82" fill="none" stroke="#c7c5c0" stroke-width="6"/><path d="M46 68 H150" stroke="#ff6a1a" stroke-dasharray="6 5" stroke-width="2"/></svg>';
 const xs=pts.map(p=>Number(p.x)||0),ys=pts.map(p=>Number(p.y)||0);
 const minx=Math.min.apply(null,xs)-55,miny=Math.min.apply(null,ys)-55;
 const w=Math.max(130,Math.max.apply(null,xs)-Math.min.apply(null,xs)+110);
 const h=Math.max(110,Math.max.apply(null,ys)-Math.min.apply(null,ys)+110);
 const points=pts.map(p=>Number(p.x)+","+Number(p.y)).join(" ");
 const objects=(data.objects||[]).slice(0,200).map(o=>{
  const x=Number(o.x)||0,y=Number(o.y)||0,ww=Math.min(500,Math.max(20,Number(o.w)||60)),dd=Math.min(180,Math.max(20,Number(o.depth)||60)),rot=Number(o.rot)||0;
  return '<rect x="'+(-ww/2)+'" y="'+(-dd/2)+'" width="'+ww+'" height="'+dd+'" rx="2" fill="'+(o.finish==="white"?"#f0efe7":o.finish==="graphite"?"#6c7176":"#d8b382")+'" stroke="#38393d" stroke-width="2" transform="translate('+x+' '+y+') rotate('+rot+')"/>';
 }).join("");
 return '<svg viewBox="'+minx+' '+miny+' '+w+' '+h+'" aria-hidden="true" preserveAspectRatio="xMidYMid meet"><rect x="'+minx+'" y="'+miny+'" width="'+w+'" height="'+h+'" fill="#1a1d20"/><polygon points="'+points+'" fill="#34383c" stroke="#eeeae2" stroke-width="13" stroke-linejoin="miter"/>'+objects+'</svg>';
}
function render(){
 const sorted=records.slice().sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
 $("khome-count").textContent=sorted.length+" proyecto"+(sorted.length===1?"":"s");
 $("khome-list").innerHTML=sorted.length?sorted.map(p=>{
  const date=new Date(p.updatedAt||Date.now()).toLocaleString("es-ES",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
  const count=(p.project.objects||[]).length;
  return '<article class="khome-item'+(p.id===activeId?' current':'')+'">'+
   '<button class="khome-thumb" type="button" data-act="open" data-id="'+cleanText(p.id)+'" aria-label="Abrir '+cleanText(p.name)+'">'+floorPreview(p.project)+'</button>'+
   '<div class="khome-meta"><button class="khome-title" data-act="open" data-id="'+cleanText(p.id)+'">'+cleanText(p.name)+'</button>'+
   '<small>'+cleanText(date)+'<br>'+count+' módulos · '+(p.project.closed?"Planta definida":"Sin planta")+'</small>'+
   (p.id===activeId?'<span class="khome-tag">ÚLTIMO PROYECTO</span>':'')+'</div>'+
   '<div class="khome-item-actions"><button data-act="open" data-id="'+cleanText(p.id)+'">Abrir</button>'+
   '<button data-act="export" data-id="'+cleanText(p.id)+'">JSON</button>'+
   '<button data-act="rename" data-id="'+cleanText(p.id)+'">Renombrar</button>'+
   '<button class="khome-danger" data-act="delete" data-id="'+cleanText(p.id)+'">Eliminar</button></div></article>';
 }).join(""):'<div class="khome-empty">Todavía no hay proyectos. Crea uno nuevo o importa un archivo JSON.</div>';
}
async function showHome(){
 if(!ready)return;
 await flush();
 clearSession();
 $("kitchen-home").hidden=false;render();
 note("Proyectos guardados en este navegador. Exporta JSON como copia de seguridad.");
}
async function enterEditor(record,resume=false){
 if(!ready||!record)return;
 await flush();
 const s=resume?readSession():null;
 let data=record.project;
 if(resume){try{const recovery=JSON.parse(localStorage.getItem(RECOVERY)||"null");if(recovery&&recovery.id===record.id&&recovery.time>=(record.updatedAt||0))data=recovery.project;}catch{}}
 suppress=true;
 try{
  api.loadProject(data);
  activeId=record.id;
  persistSession("plan");
  $("kitchen-home").hidden=true;
  if(resume&&s&&["plan","design","3d"].includes(s.tab)&&s.tab!=="plan"){api.setTab(s.tab);persistSession(s.tab);}
  render();
 }catch(e){
  $("kitchen-home").hidden=false;note("No se pudo abrir el proyecto: "+e.message);
 }finally{suppress=false;}
 if(resume&&data!==record.project)scheduleSave();
}
async function createProject(name,data){
 await flush();
 const now=Date.now(),id=recordId(),title=String(name||"Mi cocina").trim().slice(0,80)||"Mi cocina";
 const project=data?api.validateProject(data):{version:1,name:title,walls:[],closed:false,wallHeight:250,wallThick:15,objects:[],openings:[],autoCounters:true};
 project.name=title;
 const rec={id,name:title,createdAt:now,updatedAt:now,project};
 try{await storeRecord(rec);records.push(rec);await enterEditor(rec);note("Proyecto "+title+" creado.");}
 catch(e){note("No se pudo crear el proyecto: "+e.message);}
}
async function renameProject(id){
 const rec=getRecord(id);if(!rec)return;
 const name=prompt("Nombre del proyecto",rec.name);
 if(name===null||!name.trim())return;
 await flush();
 const latest=getRecord(id)||rec;
 const updated={...latest,name:name.trim().slice(0,80),updatedAt:Date.now(),project:{...latest.project,name:name.trim().slice(0,80)}};
 try{await storeRecord(updated);records=records.map(r=>r.id===id?updated:r);render();}
 catch(e){note("No se pudo renombrar: "+e.message);}
}
async function removeProject(id){
 const rec=getRecord(id);if(!rec||!confirm("¿Eliminar definitivamente «"+rec.name+"» de este navegador?"))return;
 await flush();
 try{
  await deleteRecord(id);records=records.filter(r=>r.id!==id);
  if(activeId===id){activeId=null;clearSession();try{localStorage.removeItem(RECOVERY);localStorage.removeItem("octos-kitchen-v1");}catch{}}
  render();note("Proyecto eliminado.");
 }catch(e){note("Error al eliminar: "+e.message);}
}
async function importFile(file){
 if(!file)return;
 if(file.size>5*1024*1024){note("El archivo supera 5 MB.");return;}
 try{
  const parsed=JSON.parse(await file.text());
  const project=api.validateProject(parsed);
  const title=project.name==="Mi cocina"||!project.name?file.name.replace(/\.json$/i,"").slice(0,80):project.name;
  await createProject(title,project);
 }catch(e){note("No se pudo importar el JSON: "+e.message);}
}
function askNewProject(){
 const dlg=$("kitchen-project-dialog"),input=$("khome-new-name");
 input.value="Cocina "+String(records.length+1).padStart(2,"0");
 if(typeof dlg.showModal==="function"){dlg.showModal();setTimeout(()=>{input.focus();input.select();},0);}
 else{const name=prompt("Nombre del nuevo proyecto",input.value);if(name)createProject(name);}
}
$("khome-new").addEventListener("click",askNewProject);
$("khome-new-form").addEventListener("submit",e=>{
 e.preventDefault();const name=$("khome-new-name").value.trim();if(!name)return;
 $("kitchen-project-dialog").close();createProject(name);
});
$("khome-new-cancel").addEventListener("click",()=>$("kitchen-project-dialog").close());
$("khome-import").addEventListener("click",()=>$("import-file").click());
$("import-file").addEventListener("change",async e=>{const f=e.target.files[0];e.target.value="";if(f)await importFile(f);});
$("khome-list").addEventListener("click",e=>{
 const button=e.target.closest("button[data-act]");if(!button)return;
 const id=button.dataset.id,act=button.dataset.act,rec=getRecord(id);
 if(!rec)return;
 if(act==="open")enterEditor(rec);
 if(act==="export")fileDownload(rec.project,rec.name);
 if(act==="rename")renameProject(id);
 if(act==="delete")removeProject(id);
});
$("kitchen-projects").addEventListener("click",showHome);
document.addEventListener("click",e=>{
 if(!e.target.closest("#octos-nav-back"))return;
 e.preventDefault();e.stopImmediatePropagation();showHome();
},true);
window.octosKitchenGoHome=showHome;
window.octosKitchenNew=async()=>{await showHome();askNewProject();};
window.octosKitchenSave=async()=>{if(!activeId)return api.exportProject();saveCurrent();await flush();api.message(storageError?"No se pudo guardar. Exporta JSON.":"Proyecto guardado en este navegador.");};
window.addEventListener("octos-kitchen-change",scheduleSave);
window.addEventListener("octos-kitchen-tab",e=>{if(activeId&&ready&&!$("kitchen-home").hidden)persistSession(e.detail.tab);});
window.addEventListener("pagehide",()=>{if(saveTimer){clearTimeout(saveTimer);saveTimer=null;saveCurrent();}});
(async function initialize(){
 try{db=await openDB();records=(await readAll()).filter(validRecord);}
 catch(e){console.warn("Kitchen: usando localStorage",e);db=null;try{records=localRead().filter(validRecord);}catch(err){note("No se puede leer el almacenamiento local: "+err.message);}}
 try{
  if(!localStorage.getItem(MIGRATED)){
   const old=JSON.parse(localStorage.getItem("octos-kitchen-v1")||"null");
   if(old&&(old.closed||(Array.isArray(old.objects)&&old.objects.length))){
    const project=api.validateProject(old),now=Date.now();
    const rec={id:recordId(),name:project.name||"Proyecto recuperado",createdAt:now,updatedAt:now,project};
    await storeRecord(rec);records.push(rec);
   }
   localStorage.setItem(MIGRATED,"1");
  }
 }catch(e){console.warn("Kitchen: migración anterior no realizada",e);note("No se pudo recuperar el proyecto anterior: "+e.message);}
 ready=true;render();
 const previous=readSession();
 if(previous&&typeof previous.id==="string"&&getRecord(previous.id)){
  await enterEditor(getRecord(previous.id),true);
 }else{
  clearSession();$("kitchen-home").hidden=false;
  note(db?"Biblioteca local preparada. Los proyectos se guardan automáticamente.":"Biblioteca local en modo compatible. Exporta JSON como copia de seguridad.");
 }
})();
})();