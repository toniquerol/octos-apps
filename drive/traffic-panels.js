/* OcToS Drive · fuentes oficiales de vigilancia vial, integración aislada.
 * DATEX II (DGT) y TXT ETRS89/UTM31N (Servei Català de Trànsit).
 * No convertir PK de un PDF en posiciones inferidas.
 */
(function(global){
'use strict';
const SOURCES={
 dgt:{name:'Radares fijos DGT',url:'https://infocar.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml',color:'#ff596f',format:'xml'},
 dgtSections:{name:'Radares de tramo DGT · extremos',url:'https://infocar.dgt.es/datex2/dgt/PredefinedLocationsPublication/radares/content.xml',color:'#ab9cfa',format:'xml'},
 sct:{name:'Radares fijos SCT',url:'https://transit.gencat.cat/web/.content/documents/seguretat_viaria/radars.txt',color:'#ff9f49',format:'txt'},
 sections:{name:'Referencias de radar de tramo SCT',url:'https://transit.gencat.cat/web/.content/documents/seguretat_viaria/radars.txt',color:'#a99afa',format:'txt'},
 trailer:{name:'Cinemómetros de remolque SCT',url:'https://transit.gencat.cat/web/.content/documents/seguretat_viaria/radars-remolc.txt',color:'#66d8cd',format:'txt'}
};
const prefix='octos-official-',dbName='octos-drive-official-traffic-v1';
const now=()=>new Date().toISOString();
const number=s=>Number(String(s||'').replace(',','.'));
const isES=(lat,lon)=>Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=27&&lat<=44.9&&lon>=-19&&lon<=5;
const empty=()=>({type:'FeatureCollection',features:[]});
const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function etrsUtm31ToWgs84(E,N){
 // EPSG:25831 inverse, GRS80. No extrapolar fuera del rango UTM catalán.
 if(!(E>=150000&&E<=850000&&N>=4380000&&N<=4850000))return null;
 const a=6378137,f=1/298.257222101,k0=.9996,e2=f*(2-f),ep2=e2/(1-e2),e=Math.sqrt(e2);
 const x=E-500000,y=N,M=y/k0;
 const mu=M/(a*(1-e2/4-3*e2*e2/64-5*e2**3/256));
 const e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
 const lat1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)
 +(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+151*e1**3/96*Math.sin(6*mu)+1097*e1**4/512*Math.sin(8*mu);
 const C=ep2*Math.cos(lat1)**2,T=Math.tan(lat1)**2,N1=a/Math.sqrt(1-e2*Math.sin(lat1)**2);
 const R1=a*(1-e2)/Math.pow(1-e2*Math.sin(lat1)**2,1.5),D=x/(N1*k0);
 const lat=lat1-(N1*Math.tan(lat1)/R1)*(D*D/2-(5+3*T+10*C-4*C*C-9*ep2)*D**4/24+
 (61+90*T+298*C+45*T*T-252*ep2-3*C*C)*D**6/720);
 const lon=3*Math.PI/180+(D-(1+2*T+C)*D**3/6+
 (5-2*C+28*T-3*C*C+8*ep2+24*T*T)*D**5/120)/Math.cos(lat1);
 const out=[lon*180/Math.PI,lat*180/Math.PI];
 return isES(out[1],out[0])&&out[0]>=-1.5&&out[0]<=4&&out[1]>=39&&out[1]<=43.7?out:null;
}
function parseSCT(textValue,filter){
 const seen=new Set(),features=[],rejected=[];
 const lines=String(textValue).replace(/^\uFEFF/,'').split(/\r?\n/);
 for(let i=0;i<lines.length;i++){
  const line=lines[i].trim();
  if(!line||/^(?:\(?ETRS89\)?|Via\b|Vía\b)/i.test(line))continue;
  // Admitir nombre de vía compuesto y espacios en intervalos PK.
  const m=line.match(/^(.+?)\s+(\d+(?:[.,]\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)\s+(\d+(?:[.,]\d+)?)\s+([-\d,.]+)\s+([-\d,.]+)$/);
  if(!m){rejected.push(i+1);continue}
  const [,road,rawPK,speedToken,xToken,yToken]=m,pk=rawPK.replace(/\s+/g,'');
  const segment=pk.includes('-');
  if(filter==='fixed'&&segment||filter==='section'&&!segment)continue;
  const E=number(xToken),N=number(yToken),speed=number(speedToken);
  const coord=etrsUtm31ToWgs84(E,N);
  if(!coord||!Number.isFinite(speed)||speed<10||speed>140){rejected.push(i+1);continue}
  const key=[road,pk,coord.map(n=>n.toFixed(5)).join(','),filter].join('|');
  if(seen.has(key))continue;seen.add(key);
  const kind=filter==='trailer'?'trailer':segment?'sections':'sct';
  features.push({type:'Feature',geometry:{type:'Point',coordinates:coord},
   properties:{name:kind==='trailer'?'Cinemómetro en remolque SCT':segment?'Referencia radar de tramo SCT':'Radar fijo SCT',
    road,pk,speed,kind,source:'Servei Català de Trànsit',
    note:segment?'Punto de referencia publicado. No representa el trazado completo.':
     kind==='trailer'?'Punto publicado, no certifica actividad actual.':'Ubicación oficial publicada.'}});
 }
 return {data:{type:'FeatureCollection',features},rejected};
}
function extractDGT(xml){
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if(doc.querySelector('parsererror'))throw Error('Archivo XML no válido');
 // DATEX II 1.0 contiene predefinedLocation anidado: usar solo el que tiene id.
 const nodes=Array.from(doc.getElementsByTagName('*')).filter(n=>n.localName==='predefinedLocation'&&n.hasAttribute('id'));
 const all=(node,tag)=>Array.from(node.getElementsByTagName('*')).filter(n=>n.localName===tag);
 const val=(node,tag)=>all(node,tag)[0]?.textContent?.trim()||'';
 const features=[],sections=[],rejected=[];
 for(const node of nodes){
  const id=node.getAttribute('id'),isSection=/^GUID_CVM_/.test(id),isFixed=/^GUID_CABINACINEMOMETRO_/.test(id);
  if(!isSection&&!isFixed)continue;
  const coords=all(node,'pointCoordinates').map(c=>({lat:number(val(c,'latitude')),lon:number(val(c,'longitude'))}));
  if(coords.length!==(isSection?2:1)||coords.some(c=>!isES(c.lat,c.lon))){rejected.push(id);continue}
  const road=val(node,'roadNumber'),dist=number(val(node,'referencePointDistance'));
  const common={id,road,pk:dist>0?String(Math.round(dist)/1000):'',source:'DGT · DATEX II',
   note:isSection?'Extremo de radar de tramo georreferenciado; no se infiere el recorrido entre extremos.':
    'Posición de cabina, no indica actividad del radar.'};
  if(isSection){
   for(const [k,c] of [coords[1],coords[0]].entries())sections.push({type:'Feature',
    geometry:{type:'Point',coordinates:[c.lon,c.lat]},
    properties:{...common,name:'Radar de tramo DGT · '+(k?'Fin':'Inicio'),endpoint:k?'fin':'inicio',kind:'dgtSections'}});
  }else features.push({type:'Feature',geometry:{type:'Point',coordinates:[coords[0].lon,coords[0].lat]},
   properties:{...common,name:'Radar fijo DGT',kind:'dgt'}});
 }
 if(!features.length&&!sections.length)throw Error('XML sin coordenadas geográficas de radares DGT');
 return {data:{type:'FeatureCollection',features},sections:{type:'FeatureCollection',features:sections},rejected};
}
function dbOpen(){
 return new Promise((resolve,reject)=>{
  if(!global.indexedDB){reject(Error('IndexedDB no disponible'));return}
  const req=indexedDB.open(dbName,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('sets'))req.result.createObjectStore('sets',{keyPath:'id'})};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('No se abrió el almacenamiento'));
 });
}
async function dbAction(kind,obj){
 const db=await dbOpen();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('sets',kind==='all'?'readonly':'readwrite');
  const store=tx.objectStore('sets');const req=kind==='all'?store.getAll():store.put(obj);
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error)};
 });
}
function mount({map}){
 const $=id=>document.getElementById(id),entries={};
 const state=Object.fromEntries(Object.keys(SOURCES).map(k=>[k,{data:empty(),loadedAt:null,visible:false,valid:false}]));
 const container=$('trafficPanel'),btn=$('trafficPanelBtn');
 if(!container||!btn)return;
 const layerName=k=>prefix+k+'-points',sourceName=k=>prefix+k+'-source';
 function sourceVisible(key){
  return state[key].visible&&state[key].data.features.length>0;
 }
 function sync(key){
  const name=sourceName(key),layer=layerName(key),info=state[key];
  if(!map.isStyleLoaded())return;
  if(!map.getSource(name))map.addSource(name,{type:'geojson',data:info.data});
  else map.getSource(name).setData(info.data);
  if(!map.getLayer(layer))map.addLayer({id:layer,type:'circle',source:name,
   paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,3.5,10,5,15,7],
    'circle-color':SOURCES[key].color,'circle-stroke-color':'#ffffff',
    'circle-stroke-width':1.4,'circle-opacity':.95},
   layout:{visibility:'none'}});
  map.setLayoutProperty(layer,'visibility',sourceVisible(key)?'visible':'none');
 }
 function syncAll(){for(const key in SOURCES)try{sync(key)}catch(err){setStatus(key,'Error de representación: '+err.message,true)}}
 function setStatus(key,message,error=false){const el=entries[key]?.querySelector('.traffic-item-status');if(el){el.textContent=message;el.classList.toggle('warn',error)}}
 function update(key){
  const value=state[key],element=entries[key];if(!element)return;
  const checkbox=element.querySelector('input[type=checkbox]'),count=element.querySelector('.traffic-count');
  checkbox.checked=value.visible;checkbox.disabled=!value.data.features.length;
  count.textContent=value.data.features.length?value.data.features.length.toLocaleString('es-ES'):'Sin datos';
 }
 async function save(key,data,result,sourceLabel){
  state[key]={data,loadedAt:now(),visible:true,valid:true};
  sync(key);update(key);
  setStatus(key,result.data.features.length+' puntos · '+sourceLabel+
   (result.rejected.length?' · '+result.rejected.length+' filas/ubicaciones descartadas':''));
  try{await dbAction('put',{id:key,data,loadedAt:state[key].loadedAt})}
  catch(err){setStatus(key,'Datos visibles, pero sin almacenamiento persistente: '+err.message,true)}
 }
 async function importText(key,contents,from){
  if(key==='dgt'||key==='dgtSections'){
   const result=extractDGT(contents);
   for(const [k,data] of [['dgt',result.data],['dgtSections',result.sections]]){
    if(data.features.length)await save(k,data,{data,rejected:result.rejected},from);
    else setStatus(k,'Sin registros DGT válidos de esta categoría',true);
   }
   return;
  }
  const type=key==='sct'?'fixed':key==='sections'?'section':'trailer';
  const result=parseSCT(contents,type);
  const keys=key==='sct'||key==='sections'?['sct','sections']:[key];
  for(const k of keys){
   const parsed=k===key?result:parseSCT(contents,k==='sct'?'fixed':'section');
   if(parsed.data.features.length)await save(k,parsed.data,parsed,from);
   else setStatus(k,'Sin registros válidos para esta categoría',true);
  }
  if(!result.data.features.length)throw Error('Archivo sin registros válidos para '+SOURCES[key].name);
 }
 function createItem(key){
  const def=SOURCES[key],section=document.createElement('div');section.className='traffic-item';
  const title=document.createElement('label');title.className='traffic-item-title';
  const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.disabled=true;
  const name=document.createElement('span');name.textContent=def.name;name.style.flex='1';
  const count=document.createElement('small');count.className='traffic-count';count.textContent='Sin datos';
  title.append(checkbox,name,count);section.append(title);
  const actions=document.createElement('div');actions.className='traffic-item-actions';
  const remote=document.createElement('button');remote.type='button';remote.textContent='Actualizar';remote.title='Intentar descarga directa de la fuente oficial';
  const upload=document.createElement('button');upload.type='button';upload.textContent='Importar archivo';
  const file=document.createElement('input');file.type='file';file.accept=def.format==='xml'?'.xml,application/xml,text/xml':'.txt,text/plain';file.hidden=true;
  const link=document.createElement('a');link.href=def.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Fuente';
  actions.append(remote,upload,link,file);section.append(actions);
  const status=document.createElement('div');status.className='traffic-item-status';status.textContent='Pendiente de datos oficiales';
  section.append(status);entries[key]=section;
  checkbox.addEventListener('change',()=>{state[key].visible=checkbox.checked;sync(key)});
  upload.addEventListener('click',()=>file.click());
  file.addEventListener('change',async()=>{
   const selected=file.files?.[0];if(!selected)return;
   try{setStatus(key,'Leyendo archivo '+selected.name+'…');await importText(key,await selected.text(),selected.name)}
   catch(err){setStatus(key,'No se pudo importar: '+err.message,true)}
   finally{file.value=''}
  });
  remote.addEventListener('click',async()=>{
   remote.disabled=true;setStatus(key,'Descargando fuente oficial…');
   try{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    let response;try{response=await fetch(def.url,{signal:controller.signal,cache:'no-store'})}finally{clearTimeout(timer)}
    if(!response.ok)throw Error('HTTP '+response.status);
    const contents=await response.text();
    await importText(key,contents,'Web oficial · '+new Date().toLocaleDateString('es-ES'));
   }catch(err){setStatus(key,'Descarga directa no disponible ('+err.message+'). Utiliza Importar archivo.',true)}
   finally{remote.disabled=false}
  });
  return section;
 }
 for(const key of Object.keys(SOURCES))$('trafficSources').append(createItem(key));
 btn.addEventListener('click',()=>{
  const opening=container.hidden;container.hidden=!opening;
  btn.setAttribute('aria-expanded',String(opening));btn.classList.toggle('on',opening);
 });
 $('trafficClose').addEventListener('click',()=>{container.hidden=true;btn.setAttribute('aria-expanded','false');btn.classList.remove('on')});
 map.on('style.load',syncAll);
 // Evitar clics en capas inexistentes tras cambiar el estilo del mapa.
 map.on('click',event=>{
  const layers=Object.keys(SOURCES).map(layerName).filter(id=>map.getLayer(id));
  if(!layers.length)return;
  const feature=map.queryRenderedFeatures(event.point,{layers})[0];
  if(!feature)return;
  const p=feature.properties||{},coords=feature.geometry?.coordinates;
  if(!coords||coords.length!==2)return;
  const label=html(p.name||'Control de velocidad'),road=html(p.road||'—'),pk=html(p.pk||'—');
  const note=p.note?'<p>'+html(p.note)+'</p>':'';
  new maplibregl.Popup({closeButton:true}).setLngLat(coords)
   .setHTML('<h3>'+label+'</h3><p>Carretera: '+road+' · PK '+pk+'</p>'+
    (p.speed?'<p>Velocidad publicada: '+html(p.speed)+' km/h</p>':'')+
    '<p>Fuente: '+html(p.source||'Organismo oficial')+'</p>'+note)
   .addTo(map);
 });
 map.on('mousemove',event=>{
  const layers=Object.keys(SOURCES).map(layerName).filter(id=>map.getLayer(id)&&map.getLayoutProperty(id,'visibility')==='visible');
  if(layers.length&&map.queryRenderedFeatures(event.point,{layers}).length)map.getCanvas().style.cursor='pointer';
 });
 dbAction('all').then(saved=>{
  for(const item of saved){
   if(!SOURCES[item.id]||item.data?.type!=='FeatureCollection'||!Array.isArray(item.data.features))continue;
   state[item.id]={data:item.data,loadedAt:item.loadedAt,visible:true,valid:true};
   update(item.id);setStatus(item.id,item.data.features.length+' ubicaciones guardadas · carga local '+new Date(item.loadedAt).toLocaleDateString('es-ES'));
  }
  syncAll();
 }).catch(()=>syncAll());
}
global.OcToSTrafficPanels={mount,parseSCT,extractDGT,etrsUtm31ToWgs84};
})(window);
