/* OcToS shared basemap catalogue 2.8. No credentials or remote writes. */
(function(){
 'use strict';
 const script=document.currentScript, source=new URL('../layers/basemaps.json',script?script.src:location.href);
 const localKey='octos-layers-v2';
 function local(){try{const a=JSON.parse(localStorage.getItem(localKey)||'[]');return Array.isArray(a)?a:[]}catch{return []}}
 const ready=fetch(source,{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Catálogo HTTP '+r.status);return r.json()}).then(c=>{if(c.schemaVersion!==2||!Array.isArray(c.items))throw Error('Catálogo incompatible');return c});
 function entries(c){const drafts=local();return c.items.map(b=>{const d=drafts.find(x=>x.basemapId===b.id);return d?{...b,name:d.name,url:d.url,status:d.status,scope:'local'}:{...b,scope:'publicado'}})}
 function scriptLoad(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=url;s.onload=resolve;s.onerror=()=>reject(Error('No se pudo cargar el motor de mapa'));document.head.append(s)})}
 let bridge;
 async function leafletLayer(b,pane){if(b.type==='MAPLIBRE_STYLE'){
  bridge ||= (async()=>{if(!window.maplibregl){const css=document.createElement('link');css.rel='stylesheet';css.href='https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';document.head.append(css);await scriptLoad('https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js')}if(!L.maplibreGL)await scriptLoad('https://unpkg.com/@maplibre/maplibre-gl-leaflet@0.0.22/leaflet-maplibre-gl.js')})();await bridge;
  return L.maplibreGL({style:b.url,pane,attribution:b.attribution});
 }return L.tileLayer(b.url,{pane,tms:b.scheme==='tms'&&!b.url.includes('{-y}'),maxZoom:19,attribution:b.attribution})}
 async function mount({app,map,apply}){
  const box=document.createElement('details');box.className='octos-shared-bases';box.style.cssText='position:absolute;left:10px;top:75px;z-index:1001;background:#242426;color:white;padding:8px;border:1px solid #777;border-radius:7px;max-width:min(300px,85vw);font:12px system-ui';
  const title=document.createElement('summary');title.textContent='Mapas base · biblioteca 2.8';title.style.cursor='pointer';box.append(title);
  const select=document.createElement('select');select.setAttribute('aria-label','Mapa base compartido');select.style.cssText='display:block;max-width:100%;margin:8px 0;min-height:36px';box.append(select);
  const label=document.createElement('label'),trial=document.createElement('input');trial.type='checkbox';label.append(trial,document.createTextNode(' Incluir pendientes para pruebas'));box.append(label);
  const status=document.createElement('div');status.style.cssText='max-width:270px;margin-top:8px';status.setAttribute('role','status');box.append(status);
  const host=map.getContainer();host.append(box);if(window.L&&app!=='drive'){L.DomEvent.disableClickPropagation(box);L.DomEvent.disableScrollPropagation(box)}
  let c,items=[],revision=0;
  function render(){items=entries(c).filter(b=>b.compatibility[app]&&(trial.checked||b.status==='aprobada'));select.replaceChildren(new Option('Elegir mapa compartido…',''));for(const b of items)select.add(new Option(b.name+' · '+b.status,b.id));status.textContent='Catálogo publicado '+c.version+'. Las revisiones locales se comparten en este navegador.'}
  try{c=await ready;render()}catch(e){status.textContent=e.message;return}
  trial.onchange=render;
  select.onchange=async()=>{const b=items.find(x=>x.id===select.value);if(!b)return;const n=++revision;select.disabled=true;status.textContent='Cargando '+b.name;try{await apply(b);if(n===revision){status.textContent=b.name+' · '+b.status+' · '+b.scope;localStorage.setItem('octos-basemap-choice-'+app,b.id)}}catch(e){status.textContent='No se pudo aplicar: '+e.message}finally{select.disabled=false}};
  window.addEventListener('storage',e=>{if(e.key===localKey)render()});
  const saved=localStorage.getItem('octos-basemap-choice-'+app);if(items.some(b=>b.id===saved)){select.value=saved;select.onchange()}
 }
 window.OcToSBasemaps={ready,entries,leafletLayer,mount};
 ready.catch(()=>{});
})();

