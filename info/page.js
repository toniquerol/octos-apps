/* OcToS Información · índice y landings públicas sin enlaces a editores privados. */
(function(){
 "use strict";
 const script=document.currentScript;
 if(!script)return;
 const root=new URL("./",script.src);
 const contact="https://octos3dstudio.wordpress.com/contacto/";
 const brandLogo="https://octos3dstudio.wordpress.com/wp-content/uploads/2026/11/octos-monograma-t-blanco-transparente.png";
 const storageKey="octos-info-editor-draft-v1";
 const body=document.body,view=body.dataset.infoView||"hub",slug=body.dataset.app||"";
 const rootElement=document.getElementById("info-root");
 function esc(value){return String(value==null?"":value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
 function safeIcon(icon){
  if(!icon)return "";
  if(/^https:\/\//.test(icon))return icon;
  if(/^[a-z0-9-]+\/icon\.(svg|png|webp)$/i.test(icon))return new URL("../"+icon,root).href;
  return "";
 }
 function permitted(){try{
  const expiry=Number(sessionStorage.getItem("octos-apps-until")||0);
  const role=JSON.parse(sessionStorage.getItem("octos-apps-role")||"null");
  return expiry>Date.now()&&role&&role.kind==="master";
 }catch{return false;}}
 function draftConfig(){
  if(!permitted())return null;
  try{const d=JSON.parse(localStorage.getItem(storageKey)||"null");
   return d&&d.version===1&&Array.isArray(d.items)?d:null;
  }catch{return null;}
 }
 function infoLink(item){
  if(item.id==="roads")return new URL("../roads/info/",root).href;
  return new URL(item.id+"/",root).href;
 }
 function siteHeader(section){
  return `<header class="top"><div class="wrap">
   <a class="brand" href="${root.href}" aria-label="Índice de información OcToS">
    <img src="${brandLogo}" alt="" aria-hidden="true">
    <span>OcToS <em>INFO</em><small>${section==="manage"?"GESTIÓN EDITORIAL":section==="hub"?"CATÁLOGO INFORMATIVO":"INFORMACIÓN DE PRODUCTO"}</small></span>
   </a>
   <nav class="top-nav" aria-label="Información y contacto">
     <a href="${root.href}" ${section==="hub"?'aria-current="page"':""}>Información</a>
     <a href="${contact}" target="_blank" rel="noopener noreferrer">Contacto</a>
   </nav></div></header>`;
 }
 const footer=`<footer><div class="wrap"><span>© 2026 OcToS 3D Studio · Información de aplicaciones</span><span>Fichas públicas · El acceso a los editores se gestiona por separado</span></div></footer>`;
 function iconMarkup(item,cls){
  const url=safeIcon(item.icon);
  return `<span class="${cls}">${url?`<img src="${esc(url)}" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('◈'))">`:`<span class="fallback">${esc((item.name||"O").charAt(0))}</span>`}</span>`;
 }
 function showHub(config,preview){
  const q=new URLSearchParams(location.search).get("q")||"";
  const managerLink=permitted()? `<a class="btn ghost" href="${new URL("manage/",root).href}">Gestionar información</a>` : "";
  rootElement.innerHTML=siteHeader("hub")+`
  <main><div class="wrap">
   <section class="hub-hero">
    <div class="eyebrow">OcToS 3D Studio · Plataforma digital</div>
    <h1>Información</h1>
    <p>Fichas técnicas de las aplicaciones OcToS: alcance, funciones y procesos de trabajo. Una biblioteca centralizada, independiente de los entornos operativos.</p>
   </section>
   <div class="hub-tools"><label for="info-search">Aplicaciones · <span id="info-count">${config.items.length}</span></label>
    <div class="actions">${managerLink}<input id="info-search" class="hub-search" type="search" placeholder="Buscar aplicación o especialidad" aria-label="Buscar en el catálogo" value="${esc(q)}"></div>
   </div>
   <section id="info-cards" class="catalog" aria-label="Landings informativas de OcToS"></section>
   <p class="empty" id="info-empty" hidden>No se han encontrado aplicaciones.</p>
  </div></main>`+footer;
  const holder=document.getElementById("info-cards"), search=document.getElementById("info-search");
  const cards=(items)=>items.map(i=>`<article class="info-card">
    <div class="info-card-top">${iconMarkup(i,"info-icon")}<div><h2>${esc(i.name)}</h2><div class="type">${esc(i.category)}</div></div></div>
    <p>${esc(i.summary)}</p><a class="btn" href="${esc(infoLink(i))}" aria-label="Información de ${esc(i.name)}">Ver información <span aria-hidden="true">↗</span></a>
   </article>`).join("");
  const render=()=>{const key=search.value.trim().toLocaleLowerCase("es");const matches=config.items.filter(i=>(i.name+" "+i.category+" "+i.summary+" "+i.headline).toLocaleLowerCase("es").includes(key));holder.innerHTML=cards(matches);document.getElementById("info-empty").hidden=matches.length!==0;document.getElementById("info-count").textContent=matches.length;};
  search.addEventListener("input",render);render();
 }
 function showDetail(item,preview){
  if(!item){rootElement.innerHTML=siteHeader("detail")+`<main class="wrap"><section class="hub-hero"><h1>Aplicación no encontrada</h1><a class="btn" href="${root.href}">Volver a Información</a></section></main>`+footer;return}
  document.title="OcToS "+item.name+" · Información";
  const external=item.id==="wordpress",cta=external?item.external:contact;
  const ctaText=external?"Visitar sitio web":"Solicitar acceso";
  const steps=(item.steps||[]).map((p,j)=>`<article class="step"><strong>${String(j+1).padStart(2,"0")}</strong><p>${esc(p)}</p></article>`).join("");
  const features=(item.features||[]).map((f,j)=>`<article class="feature-card"><span class="feature-index">${String(j+1).padStart(2,"0")} / ${esc(item.category.toUpperCase())}</span><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></article>`).join("");
  rootElement.innerHTML=siteHeader("detail")+`
  <main><section class="hero"><div class="wrap hero-grid"><div>
   <div class="eyebrow">${esc(item.eyebrow)}</div>
   <h1>${esc(item.headline)}</h1>
   <p class="lead">${esc(item.lead)}</p>
   <div class="tags">${(item.tags||[]).map(v=>`<span>${esc(v)}</span>`).join("")}</div>
   <div class="actions"><a class="btn primary" href="${esc(cta)}" target="_blank" rel="noopener noreferrer">${ctaText}</a><a class="btn ghost" href="#capacidades">Capacidades</a></div>
   <p class="summary">${esc(item.summary)}</p>
  </div><div class="scene" role="img" aria-label="Representación conceptual de ${esc(item.name)}, no es una captura ni permite abrir la aplicación">
    <div class="scene-header"><span>OcToS / ${esc(item.name.toUpperCase())}</span><span>VISTA CONCEPTUAL</span></div>
    <div class="scene-content">${iconMarkup(item,"scene-icon")}
     <div class="scene-lines"><b>${esc(item.category)}</b><small>${esc((item.tags||[]).join(" · "))}</small><div></div><div></div></div>
    </div><span class="scene-footer">IDENTIDAD VISUAL · SIN ACCESO AL EDITOR</span>
  </div></div></section>
  <section class="section" id="capacidades"><div class="wrap">
   <div class="section-heading"><div><div class="eyebrow">01 · Herramientas</div><h2>Capacidades principales</h2></div><p>${esc(item.summary)}</p></div>
   <div class="feature-grid">${features}</div>
  </div></section>
  <section class="section tinted" id="metodologia"><div class="wrap">
   <div class="section-heading"><div><div class="eyebrow">02 · Metodología</div><h2>Flujo de trabajo</h2></div></div>
   <div class="steps">${steps}</div>
  </div></section>
  <section class="section"><div class="wrap"><div class="cta-panel">
   <div><span class="eyebrow">OcToS 3D Studio</span><h2>${esc(item.name)} · ${esc(item.category)}</h2><p>${external?"Información y recursos corporativos.":"Acceso a la aplicación sujeto a autorización."}</p></div>
   <a class="btn primary" href="${esc(cta)}" target="_blank" rel="noopener noreferrer">${ctaText}</a>
  </div></div></section></main>`+footer;
 }
 function showManager(config){
  if(!permitted()){rootElement.innerHTML=siteHeader("manage")+`<main class="wrap"><section class="manager-locked"><div class="eyebrow">Acceso de edición</div><h1>Gestión editorial</h1><p>Abre OcToS Apps y accede con el PIN maestro en este mismo navegador. Después vuelve aquí para editar borradores.</p><p>La sesión es un control de interfaz local, no una autenticación de servidor.</p><a class="btn primary" href="${new URL("../",root).href}">Ir a OcToS Apps</a></section></main>`+footer;return}
  rootElement.innerHTML=siteHeader("manage")+`<main class="wrap">
   <section class="hub-hero"><div class="eyebrow">Editor · Información OcToS</div><h1>Gestión de landings</h1><p>Editor central de contenidos. Guarda borradores locales, previsualiza los cambios y exporta el catálogo completo para publicarlo en GitHub.</p></section>
   <div class="manager-banner">Los cambios guardados aquí sólo afectan a este navegador. La publicación pública requiere actualizar <code>info/catalog.json</code> en el repositorio. Roads conserva además su landing técnica independiente.</div>
   <div class="manager-layout"><aside class="manager-aside"><h2>Aplicaciones</h2><nav class="manager-list" id="manager-list" aria-label="Seleccionar ficha a editar"></nav></aside>
   <div class="manager-editor"><h2 id="manager-title">Editar ficha</h2><p class="manager-hint">Los campos se muestran en la landing de cada aplicación. Se mantienen sus iconos originales y los enlaces de contacto.</p>
   <form class="manager-form" id="manager-form">
    <label>Nombre<input name="name" required maxlength="65"></label>
    <label>Especialidad<input name="category" required maxlength="100"></label>
    <label class="wide">Categoría técnica / entrada<input name="eyebrow" required maxlength="170"></label>
    <label class="wide">Titular principal<input name="headline" required maxlength="180"></label>
    <label class="wide">Descripción destacada<textarea name="lead" rows="3" maxlength="500" required></textarea></label>
    <label class="wide">Resumen de catálogo<textarea name="summary" rows="2" maxlength="350" required></textarea></label>
    <label class="wide">Etiquetas (separadas por comas)<input name="tags" maxlength="180"></label>
    <label class="wide">Capacidades · Una por línea, con formato «Título | Descripción»<textarea class="long" name="features" rows="5" required></textarea></label>
    <label class="wide">Proceso · Un paso por línea<textarea class="long" name="steps" rows="4" required></textarea></label>
    <div class="wide manager-actions"><button class="btn primary" type="submit">Guardar borrador</button>
     <button class="btn" type="button" id="manage-preview">Vista previa</button>
     <button class="btn" type="button" id="manage-export">Exportar JSON</button>
     <button class="btn" type="button" id="manage-import">Importar JSON</button>
     <button class="btn ghost" type="button" id="manage-reset">Restaurar catálogo publicado</button>
     <input id="manage-file" type="file" accept=".json,application/json" hidden>
    </div></form><p class="manager-message" id="manager-message" role="status"></p>
   </div></div></main>`+footer;
  if(typeof window.OcToSInfoManager==="function"){
   try{window.OcToSInfoManager({config,root,infoLink,storageKey,draftConfig,esc})}
   catch(error){
    const status=document.getElementById("manager-message");
    if(status)status.textContent="No se ha podido iniciar el editor: "+error.message;
    console.error("OcToS Info: editor",error);
   }
  }else{
   const status=document.getElementById("manager-message");
   if(status)status.textContent="No se ha cargado el módulo de edición. Actualiza esta página.";
  }
 }
 async function init(){
  try{
   const response=await fetch(new URL("catalog.json",root),{cache:"no-store"});
   if(!response.ok)throw Error("HTTP "+response.status);
   const original=await response.json();
   if(!original||!Array.isArray(original.items))throw Error("Formato de catálogo incorrecto");
   const preview=permitted()&&new URLSearchParams(location.search).has("preview");
   const local=preview?draftConfig():null;
   const config=local||original;
   if(view==="detail")showDetail(config.items.find(i=>i.id===slug),preview);
   else if(view==="manage")showManager(original);
   else showHub(config,preview);
  }catch(error){rootElement.innerHTML=siteHeader("hub")+`<main class="wrap"><section class="hub-hero"><h1>Información no disponible</h1><p>No se ha podido cargar el catálogo informativo. ${esc(error.message)}</p></section></main>`+footer;}
 }
 init();
})();
