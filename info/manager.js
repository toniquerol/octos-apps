/* Gestor de contenidos local. No publica cambios ni guarda credenciales. */
window.OcToSInfoManager=function(args){
 "use strict";
 const {config,infoLink,storageKey,draftConfig}=args;
 const original=JSON.parse(JSON.stringify(config));
 let work=JSON.parse(JSON.stringify(draftConfig()||config));
 let id=work.items[0].id;
 const form=document.getElementById("manager-form"),list=document.getElementById("manager-list"),message=document.getElementById("manager-message");
 const current=()=>work.items.find(x=>x.id===id);
 function notify(value){message.textContent=value}
 function renderMenu(){
  list.replaceChildren();
  for(const app of work.items){
   const button=document.createElement("button");
   button.type="button";button.textContent=app.name;button.dataset.id=app.id;
   button.addEventListener("click",()=>{
    if(id===app.id)return;
    try{save()}catch(error){notify("Revisa la ficha actual antes de cambiar: "+error.message);return}
    id=app.id;renderForm();
   });
   list.appendChild(button);
  }
  renderForm();
 }
 function renderForm(){
  const app=current();
  document.getElementById("manager-title").textContent="Editar · "+app.name;
  for(const key of ["name","category","eyebrow","headline","lead","summary"])form.elements[key].value=app[key]||"";
  form.elements.tags.value=(app.tags||[]).join(", ");
  form.elements.features.value=(app.features||[]).map(x=>x.title+" | "+x.text).join("\n");
  form.elements.steps.value=(app.steps||[]).join("\n");
  for(const button of list.querySelectorAll("button"))button.setAttribute("aria-current",String(button.dataset.id===id));
  notify(app.independent?"Roads conserva su landing técnica independiente. La ficha de información se gestiona aquí; la landing original se modifica por separado.":"");
 }
 function save(){
  const app=current();
  for(const k of ["name","category","eyebrow","headline","lead","summary"]){
   const value=form.elements[k].value.trim();
   if(!value)throw Error("Campo obligatorio: "+k);
   app[k]=value;
  }
  const lines=form.elements.features.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(lines.length<1||lines.length>8)throw Error("Añade entre 1 y 8 capacidades.");
  app.features=lines.map(line=>{
   const p=line.indexOf("|");
   if(p<1||p===line.length-1)throw Error("Capacidad: usa «Título | Descripción»");
   return {title:line.slice(0,p).trim(),text:line.slice(p+1).trim()};
  });
  app.steps=form.elements.steps.value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(app.steps.length<1||app.steps.length>8)throw Error("Añade entre 1 y 8 pasos.");
  app.tags=form.elements.tags.value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,5);
  work.updated=new Date().toISOString().slice(0,10);
  localStorage.setItem(storageKey,JSON.stringify(work));
  const active=list.querySelector('[data-id="'+id+'"]');if(active)active.textContent=app.name;
  notify("Borrador local guardado. La web pública no se ha modificado.");
 }
 form.addEventListener("submit",e=>{e.preventDefault();try{save()}catch(err){notify(err.message)}});
 document.getElementById("manage-preview").addEventListener("click",()=>{
  try{
   save();
   const app=current(),url=new URL(infoLink(app));
   if(!app.independent)url.searchParams.set("preview","1");
   window.location.assign(url.href); // conserva la sesión maestra y el borrador en esta pestaña
   if(app.independent)notify("La landing técnica de Roads es independiente y no se actualiza con el borrador.");
  }catch(err){notify(err.message)}
 });
 document.getElementById("manage-export").addEventListener("click",()=>{
  try{
   save();
   const blob=new Blob([JSON.stringify(work,null,2)+"\n"],{type:"application/json"});
   const url=URL.createObjectURL(blob),a=document.createElement("a");
   a.href=url;a.download="octos-info-catalog.json";document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),1500);
   notify("JSON exportado. Para publicar, sustituye info/catalog.json en GitHub.");
  }catch(err){notify(err.message)}
 });
 const input=document.getElementById("manage-file");
 document.getElementById("manage-import").addEventListener("click",()=>input.click());
 input.addEventListener("change",async()=>{
  const file=input.files[0];input.value="";if(!file)return;
  try{
   if(file.size>2*1024*1024)throw Error("El archivo supera 2 MB");
   const incoming=JSON.parse(await file.text());
   if(incoming.version!==1||!Array.isArray(incoming.items)||incoming.items.length!==original.items.length)throw Error("Catálogo incompatible");
   const fresh=JSON.parse(JSON.stringify(original));
   for(const originalApp of fresh.items){
    const app=incoming.items.find(x=>x&&x.id===originalApp.id);
    if(!app)throw Error("Falta "+originalApp.id);
    for(const key of ["name","category","eyebrow","headline","lead","summary"]){
     if(typeof app[key]!=="string"||!app[key].trim()||app[key].length>1000)throw Error("Texto inválido en "+originalApp.id);
     originalApp[key]=app[key].trim();
    }
    if(!Array.isArray(app.features)||app.features.length<1||app.features.length>8||app.features.some(x=>typeof x.title!=="string"||typeof x.text!=="string"))throw Error("Capacidades inválidas en "+originalApp.id);
    if(!Array.isArray(app.steps)||app.steps.length<1||app.steps.length>8||app.steps.some(x=>typeof x!=="string"))throw Error("Pasos inválidos en "+originalApp.id);
    if(!Array.isArray(app.tags)||app.tags.length>5||app.tags.some(x=>typeof x!=="string"))throw Error("Etiquetas inválidas en "+originalApp.id);
    originalApp.features=app.features.map(x=>({title:x.title.slice(0,200),text:x.text.slice(0,700)}));
    originalApp.steps=app.steps.map(x=>x.slice(0,500));
    originalApp.tags=app.tags.map(x=>x.slice(0,40));
   }
   work=fresh;localStorage.setItem(storageKey,JSON.stringify(work));
   renderMenu();notify("Catálogo importado como borrador local; todavía no está publicado.");
  }catch(err){notify("Importación rechazada: "+err.message)}
 });
 document.getElementById("manage-reset").addEventListener("click",()=>{
  if(!confirm("¿Descartar el borrador local y restaurar el catálogo publicado?"))return;
  work=JSON.parse(JSON.stringify(original));localStorage.removeItem(storageKey);
  renderMenu();notify("Catálogo publicado recuperado en el editor local.");
 });
 renderMenu();
};
