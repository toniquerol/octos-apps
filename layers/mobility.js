/* OcToS Layers 3.3 · Movilidad territorial · OpenStreetMap / Overpass
   Datos de puntos observados; conexiones heurísticas, nunca viajes medidos.
   No requiere servidor propio, API keys ni bibliotecas nuevas. */
(function(){
'use strict';
if(window.OcToSMobility)return;
const cfg=[
 {id:'poblacion',title:'Población',selector:'nwr["place"~"^(city|town|village|hamlet|suburb|neighbourhood)$"]',hint:'Núcleos de población OSM. Habitantes solo si existe la etiqueta population.'},
 {id:'viviendas',title:'Viviendas',selector:'nwr["building"~"^(residential|apartments|house|detached|terrace)$"]',hint:'Edificios residenciales cartografiados, no domicilios ni número de hogares.'},
 {id:'empleo',title:'Empleo',selector:'nwr["office"];nwr["shop"];nwr["landuse"~"^(industrial|commercial|retail)$"]',hint:'Centros de actividad potencial; no representan empleo censado.'},
 {id:'sanidad',title:'Sanidad',selector:'nwr["amenity"~"^(hospital|clinic|doctors|pharmacy)$"]',hint:'Hospitales, clínicas, consultas y farmacias.'},
 {id:'turismo',title:'Turismo y ocio',selector:'nwr["tourism"];nwr["historic"="monument"];nwr["leisure"~"^(park|sports_centre)$"]',hint:'Alojamientos, monumentos, atracciones y zonas de ocio.'},
 {id:'transporte',title:'Transporte',selector:'nwr["railway"~"^(station|halt)$"];nwr["amenity"="bus_station"];nwr["highway"="bus_stop"];nwr["public_transport"~"^(station|platform)$"]',hint:'Estaciones y paradas mapeadas en OSM.'}
];
const ids=new Set(cfg.map(c=>c.id));
const host=document.querySelector('.mapcontainer');
if(!host)return;
const enabled=new Set(),cache=new Map();
let active=false,focused=null,showFlows=false,direction='ambos',running=false,queued=false,token=0,sequence=Promise.resolve(),attached=new WeakSet(),lastExtent='';
const panel=document.createElement('section');panel.className='mob-panel';panel.hidden=true;panel.setAttribute('aria-label','Capas de movilidad');
panel.innerHTML='<div class="mob-head"><strong>MOVILIDAD · PUNTOS</strong><button type="button" id="mobCollapse" aria-label="Plegar panel">−</button></div><div class="mob-body"><p class="mob-sub">Ubicaciones reales de OpenStreetMap. Selecciona capas y actualiza el área del mapa.</p><div id="mobCats" class="mob-cats"></div><div class="mob-actions"><button type="button" id="mobLoad">Actualizar zona</button><button type="button" id="mobFlow" aria-pressed="false">Flujos: no</button></div><label class="mob-direction">Sentido <select id="mobDirection"><option value="ambos">Entradas y salidas</option><option value="entradas">Entradas</option><option value="salidas">Salidas</option></select></label><div id="mobState" role="status">Acerca el mapa a una localidad para cargar los puntos.</div><p class="mob-foot">Flujos: conexiones potenciales calculadas por proximidad. No son trayectos, viajeros ni matrices oficiales.</p><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">Datos © OpenStreetMap contributors</a></div>';
const overlay=document.createElementNS('http://www.w3.org/2000/svg','svg');overlay.setAttribute('class','mob-overlay');overlay.setAttribute('aria-label','Puntos y conexiones potenciales');
const details=document.createElement('div');details.className='mob-details';details.hidden=true;
host.append(overlay,panel,details);
const catBox=panel.querySelector('#mobCats'),state=panel.querySelector('#mobState');
const text=(node,value)=>{node.textContent=String(value)};
const safeName=e=>(e.tags?.['name:es']||e.tags?.name||e.tags?.brand||e.tags?.operator||'Punto OSM '+e.id);
const activeMap=()=>usesMapLibre()?map3d:map;
function status(s){text(state,s)}
function currentBounds(){const m=activeMap();return m&&m.getBounds&&m.getBounds()}
function extent(){
 const b=currentBounds(),m=activeMap();
 if(!b||!m)return null;
 const zoom=m.getZoom();
 const w=b.getEast()-b.getWest(),h=b.getNorth()-b.getSouth();
 if(zoom<12||w>0.3||h>0.3||w<=0||h<=0)return null;
 const fmt=n=>Number(n).toFixed(5);
 return {box:[b.getSouth(),b.getWest(),b.getNorth(),b.getEast()].map(fmt).join(','),zoom};
}
function project(lat,lon){
 const m=activeMap();if(!m)return null;
 const p=usesMapLibre()?m.project({lat,lng:lon}):m.latLngToContainerPoint([lat,lon]);
 return Number.isFinite(p.x)&&Number.isFinite(p.y)?p:null;
}
function svgNode(type,attrs){
 const el=document.createElementNS('http://www.w3.org/2000/svg',type);
 Object.entries(attrs||{}).forEach(([key,value])=>el.setAttribute(key,String(value)));
 return el;
}
function collect(){
 const points=[];for(const cat of cfg)if(enabled.has(cat.id)){
  const entries=cache.get(cat.id)?.features||[];
  for(const feature of entries)points.push(feature);
 }
 return points;
}
function distance(a,b){
 const r=Math.PI/180,la=(b.lat-a.lat)*r,lo=(b.lon-a.lon)*r;
 const q=Math.sin(la/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(lo/2)**2;
 return 12742*Math.asin(Math.min(1,Math.sqrt(q)));
}
function candidateLinks(p){
 const residence=p.cat==='viviendas'||p.cat==='poblacion';
 const other=collect().filter(q=>q.key!==p.key&&(residence?!(q.cat==='viviendas'||q.cat==='poblacion'):(q.cat==='viviendas'||q.cat==='poblacion')));
 const ranked=other.map(q=>({q,km:distance(p,q)})).filter(x=>x.km>.03&&x.km<=30)
   .map(x=>({...x,score:1/(1+Math.pow(x.km/4,1.4))}))
   .sort((a,b)=>b.score-a.score).slice(0,8);
 return ranked.map(x=>({point:x.q,km:x.km,score:x.score,residence}));
}
function drawFlows(){
 if(!focused||!showFlows)return;
 const rel=candidateLinks(focused);
 for(const link of rel){
  const modes=direction==='ambos'?['entradas','salidas']:[direction];
  for(const mode of modes){
   const house=link.residence?focused:link.point;
   const destination=link.residence?link.point:focused;
   const a=mode==='entradas'?destination:house,b=mode==='entradas'?house:destination;
   // Entrance: path toward the selected location. Departure: away from it.
   const origin=mode==='entradas'?(link.residence?destination:house):(link.residence?house:destination);
   const target=mode==='entradas'?(link.residence?house:destination):(link.residence?destination:house);
   const p1=project(origin.lat,origin.lon),p2=project(target.lat,target.lon);if(!p1||!p2)continue;
   const dx=p2.x-p1.x,dy=p2.y-p1.y;
   const bend=Math.min(55,Math.max(12,Math.hypot(dx,dy)*.14))*(mode==='entradas'?-1:1);
   const mx=(p1.x+p2.x)/2-dy/(Math.hypot(dx,dy)||1)*bend;
   const my=(p1.y+p2.y)/2+dx/(Math.hypot(dx,dy)||1)*bend;
   const path=svgNode('path',{d:'M '+p1.x+' '+p1.y+' Q '+mx+' '+my+' '+p2.x+' '+p2.y,class:'mob-flow '+(mode==='entradas'?'mob-in':'mob-out'),'stroke-width':(1+link.score*2.5).toFixed(2)});
   const title=svgNode('title');title.textContent=mode+' · '+origin.name+' → '+target.name+' · '+link.km.toFixed(1)+' km en línea recta · conexión hipotética';
   path.append(title);overlay.append(path);
  }
 }
 if(!rel.length)status('Sin destinos compatibles cargados. Activa Viviendas y alguna categoría de servicios para visualizar flujos.');
}
function draw(){
 overlay.replaceChildren();if(!active)return;
 const rect=host.getBoundingClientRect();overlay.setAttribute('viewBox','0 0 '+Math.max(1,rect.width)+' '+Math.max(1,rect.height));
 drawFlows();
 for(const p of collect()){
  const xy=project(p.lat,p.lon);if(!xy||xy.x<0||xy.y<0||xy.x>rect.width||xy.y>rect.height)continue;
  const chosen=focused?.key===p.key;
  const dot=svgNode('circle',{cx:xy.x,cy:xy.y,r:chosen?7:4.5,class:'mob-point'+(chosen?' mob-selected':''),
    tabindex:0,role:'button','aria-label':p.cat+': '+p.name});
  const title=svgNode('title');title.textContent=p.name+' · '+p.cat;dot.append(title);
  const choose=e=>{e.stopPropagation();focused=p;openDetails(p);draw()};
  dot.addEventListener('click',choose);
  dot.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(e)}});
  overlay.append(dot);
 }
}
function openDetails(p){
 details.replaceChildren();details.hidden=false;
 const close=document.createElement('button');close.type='button';close.className='mob-close';close.textContent='×';close.setAttribute('aria-label','Cerrar ficha');close.onclick=()=>{focused=null;details.hidden=true;draw()};
 const h=document.createElement('strong');h.textContent=p.name;
 const sub=document.createElement('p');sub.textContent=cfg.find(c=>c.id===p.cat).title+' · '+p.lat.toFixed(5)+', '+p.lon.toFixed(5);
 const note=document.createElement('p');note.textContent=cfg.find(c=>c.id===p.cat).hint;
 details.append(close,h,sub,note);
 if(p.tags.population){
  const pop=document.createElement('p');pop.textContent='Población etiquetada en OSM: '+p.tags.population+' (sin verificación censal)';details.append(pop);
 }
 const a=document.createElement('a');a.textContent='Abrir objeto en OpenStreetMap';a.href='https://www.openstreetmap.org/'+p.type+'/'+p.id;a.target='_blank';a.rel='noopener noreferrer';details.append(a);
 if(showFlows){const count=document.createElement('p');count.textContent=candidateLinks(p).length+' conexiones potenciales en la zona cargada';details.append(count)}
}
function attach(){
 for(const m of [map,map3d])if(m&&!attached.has(m)){
  attached.add(m);m.on('move zoom rotate pitch resize',draw);
 }
}
function sourceQuery(cat,bbox){
 // Bounding boxes and tag filters are fixed, not built from user input.
 const parts=cat.selector.split(';').map(q=>q.trim()).filter(Boolean)
 .map(q=>q+'('+bbox+');').join('');
 return '[out:json][timeout:20];('+parts+');out center 180;';
}
function fetchOne(cat,box){
 const query=sourceQuery(cat,box);
 return fetch('https://overpass-api.de/api/interpreter',{
  method:'POST',body:new URLSearchParams({data:query}),cache:'no-store'
 }).then(async r=>{
  if(!r.ok)throw Error('Overpass HTTP '+r.status);
  const obj=await r.json();if(!Array.isArray(obj.elements))throw Error('Respuesta sin objetos OSM');
  const seen=new Set();return obj.elements.map(e=>{
   const lat=Number(e.lat??e.center?.lat),lon=Number(e.lon??e.center?.lon);
   const key=e.type+'/'+e.id;
   return {key,id:e.id,type:e.type,lat,lon,cat:cat.id,name:safeName(e),tags:e.tags||{}};
  }).filter(e=>Number.isFinite(e.lat)&&Number.isFinite(e.lon)&&!seen.has(e.key)&&seen.add(e.key));
 });
}
function load(){
 if(!active)return;
 if(running){queued=true;return}
 const area=extent();if(!area){status('Acerca el mapa al menos al zoom 12; se descargan solo áreas locales.');return}
 if(!enabled.size){status('Activa al menos una categoría.');return}
 running=true;const generation=++token;lastExtent=area.box;panel.querySelector('#mobLoad').disabled=true;
 const list=cfg.filter(c=>enabled.has(c.id));
 (async()=>{
  let successes=0,failed=[];
  for(const cat of list){
   if(!active||generation!==token)break;
   if(cache.get(cat.id)?.box===area.box){successes++;continue}
   status('Consultando '+cat.title+' ('+(successes+1)+'/'+list.length+')…');
   try{
    const features=await (sequence=sequence.catch(()=>{}).then(()=>fetchOne(cat,area.box)));
    if(generation!==token||!active)break;
    cache.set(cat.id,{box:area.box,features});successes++;
    const count=panel.querySelector('#mobCount-'+cat.id);if(count)count.textContent=String(features.length);
   }catch(e){failed.push(cat.title+' ('+e.message+')')}
   draw();
  }
  if(active&&generation===token){
   const n=collect().length;
   status(n+' puntos recuperados de OSM. '+(failed.length?'No disponible: '+failed.join(', '):'Selecciona un punto para consultar sus datos.'));
  }
 })().finally(()=>{running=false;panel.querySelector('#mobLoad').disabled=false;draw();if(queued&&active){queued=false;load()}});
}
function buildControls(){
 for(const c of cfg){
  const l=document.createElement('label');l.className='mob-cat';
  const input=document.createElement('input');input.type='checkbox';input.value=c.id;
  const s=document.createElement('span');s.textContent=c.title;
  const n=document.createElement('small');n.id='mobCount-'+c.id;n.textContent='';
  l.append(input,s,n);catBox.append(l);
  input.addEventListener('change',()=>{input.checked?enabled.add(c.id):enabled.delete(c.id);focused=null;details.hidden=true;draw();load()});
 }
 panel.querySelector('#mobLoad').onclick=load;
 panel.querySelector('#mobFlow').onclick=()=>{
  showFlows=!showFlows;const b=panel.querySelector('#mobFlow');b.textContent='Flujos: '+(showFlows?'sí':'no');b.setAttribute('aria-pressed',String(showFlows));draw();
 };
 panel.querySelector('#mobDirection').onchange=e=>{direction=e.target.value;draw()};
 panel.querySelector('#mobCollapse').onclick=()=>{
  panel.classList.toggle('mob-collapsed');panel.querySelector('#mobCollapse').textContent=panel.classList.contains('mob-collapsed')?'+':'−';
 };
}
function activate(x){
 const id=x.layer||x.id.slice(4);if(!ids.has(id))return;
 active=true;panel.hidden=false;overlay.style.display='';
 attach();if(!enabled.has(id)){enabled.add(id);const check=catBox.querySelector('input[value="'+id+'"]');if(check)check.checked=true}
 const m=activeMap();if(m?.once)m.once('idle',draw);
 if(!extent()){status('Acerca el mapa al zoom 12 o superior y pulsa «Actualizar zona».');draw();return}
 load();draw();
}
function hide(){
 if(!active)return;active=false;token++;running=false;focused=null;details.hidden=true;panel.hidden=true;overlay.replaceChildren();overlay.style.display='none';
}
buildControls();
const originalPreview=preview;
preview=function(){
 const x=data.find(y=>y.id===selected),ismob=!!(x&&String(x.id).startsWith('mob-')&&ids.has(x.layer));
 if(!ismob){hide();return originalPreview()}
 originalPreview(); // Preserva la limpieza de capas WMS y el fondo existente.
 activate(x);
 setPreviewStatus('Movilidad · datos OSM en la zona visible · flujos orientativos');
};
const previousSwitch=switch3d;
switch3d=function(){previousSwitch();if(active){attach();requestAnimationFrame(draw)}};
window.OcToSMobility={refresh:load,hide,draw};
if(selected&&String(selected).startsWith('mob-'))requestAnimationFrame(preview);
})();
