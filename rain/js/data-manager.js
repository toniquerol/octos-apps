import {identify,shapefileParts} from './formats.js';
import {cellAt} from './dem.js';
import {inside} from './render.js';
export const PRODUCTS=[
 {id:'mdt',name:'CNIG · MDT02 · Terreno',format:'COG / GeoTIFF',use:'Recomendado para drenaje y cuencas. Una banda, elevaciones en metros.',url:'https://centrodedescargas.cnig.es/CentroDescargas/catalogo.do?Serie=MDT02',grid:true},
 {id:'mds',name:'CNIG · Superficies y edificación',format:'Consultar ficha oficial',use:'Representación de superficies. No sustituir automáticamente el MDT hidrológico.',url:'https://centrodedescargas.cnig.es/CentroDescargas/modelos-digitales-elevaciones'},
 {id:'icgc',name:'ICGC · Elevaciones y ortofotos',format:'Consultar producto y edición',use:'Seleccionar elevaciones para análisis; ortofotos solo para visualización. La disponibilidad se consulta en el visor oficial.',url:'https://visors.icgc.cat/appdownloads/'}
];
export function sampleCoverage(d,bounds,ring,size=80){
 let total=0,valid=0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const lon=bounds[0]+(x+.5)/size*(bounds[2]-bounds[0]),lat=bounds[1]+(y+.5)/size*(bounds[3]-bounds[1]);
  if(ring&&!inside(lon,lat,ring))continue;total++;
  const i=cellAt(d,lat,lon);if(i>=0&&Number.isFinite(d.data[i]))valid++;
 }
 return {total,valid,percent:total?100*valid/total:null};
}
export function initDataManager({map,getArea,getDEM,loadFiles,onError}){
 const el=document.createElement('details');el.id='dataManager';el.open=true;
 const add=(tag,text,parent=el)=>{const n=document.createElement(tag);if(text)n.textContent=text;parent.append(n);return n;};
 add('summary','02 · PREPARAR DATOS');
 const area=add('p','Define primero un rectángulo o polígono de estudio.');area.className='hint';
 const select=add('select');select.setAttribute('aria-label','Producto cartográfico');
 for(const p of PRODUCTS){const o=add('option',p.name,select);o.value=p.id;}
 const advice=add('p');advice.className='hint';
 const link=add('a','Abrir descarga oficial ↗');link.target='_blank';link.rel='noopener';
 const gridButton=add('button','Mostrar cuadrícula oficial MTN25');gridButton.type='button';
 const note=add('p','Las cuadrículas son unidades oficiales de referencia. Su visualización no confirma que cada archivo esté disponible o cargado. La consulta automática de archivos por hoja está pendiente.');note.className='hint';
 let grid=null;
 const updateProduct=()=>{const p=PRODUCTS.find(p=>p.id===select.value);advice.textContent=p.format+' · '+p.use;link.href=p.url;gridButton.hidden=!p.grid;if(grid){grid.remove();grid=null;}gridButton.textContent='Mostrar cuadrícula oficial MTN25';};select.onchange=updateProduct;updateProduct();
 gridButton.onclick=()=>{if(grid){grid.remove();grid=null;gridButton.textContent='Mostrar cuadrícula oficial MTN25';return;}
  const a=getArea();if(!a){onError('Define un área de estudio antes de consultar cuadrículas.');return;}
  grid=L.tileLayer.wms('https://www.ign.es/wms-inspire/cuadriculas',{layers:'cuadricula-mtn25-oficial',format:'image/png',transparent:true,version:'1.1.1',pane:'rainVectorPane',attribution:'Cuadrícula MTN25 © IGN'}).addTo(map);
  grid.on('tileerror',()=>onError('El servicio de cuadrículas no responde. Utiliza el catálogo oficial.'));gridButton.textContent='Ocultar cuadrícula MTN25';map.fitBounds([[a.bounds[1],a.bounds[0]],[a.bounds[3],a.bounds[2]]]);
 };
 const label=add('label','Cargar MDT · uno o varios GeoTIFF');const input=add('input',null,label);input.type='file';input.multiple=true;
 const drop=add('div','También puedes soltar aquí los archivos de terreno.');drop.className='data-drop';drop.tabIndex=0;
 const records=add('div');records.setAttribute('role','status');
 let busy=false;
 const ingest=async files=>{
  if(busy)return;files=Array.from(files);if(!files.length)return;
  if(files.length>32){onError('Máximo 32 archivos por operación.');return;}
  busy=true;input.disabled=true;records.replaceChildren();
  try{
   const accepted=[],seen=new Set();
   for(const group of shapefileParts(files))add('p',group.name+': '+(group.missing.length?'faltan '+group.missing.join(', '):'componentes presentes')+'; lector Shapefile no disponible.',records);
   for(const f of files){const p=add('p',f.name+' · comprobando…',records),key=[f.name,f.size,f.lastModified].join('|');
    if(seen.has(key)){p.textContent=f.name+' · duplicado candidato omitido';continue;}seen.add(key);
    try{const info=await identify(f);p.textContent=f.name+' · '+info.message;if(info.readable)accepted.push({file:f,p});}
    catch(e){p.textContent=f.name+' · '+e.message;}
   }
   if(accepted.length){try{await loadFiles(accepted.map(x=>x.file));for(const a of accepted)a.p.textContent=a.file.name+' · procesado en el conjunto MDT; consulta omisiones y cobertura en el estado del mosaico';}
    catch(e){for(const a of accepted)a.p.textContent=a.file.name+' · conjunto no incorporado: '+e.message;throw e;}}
   refresh();
  }catch(e){onError(e.message);}finally{busy=false;input.disabled=false;}
 };
 input.onchange=()=>ingest(input.files);drop.ondragover=e=>e.preventDefault();drop.ondrop=e=>{e.preventDefault();ingest(e.dataTransfer.files);};
 const coverage=add('p');coverage.className='hint';const refreshButton=add('button','Comprobar cobertura del área');refreshButton.onclick=()=>refresh();
 const exportButton=add('button','Exportar ficha de preparación');
 exportButton.onclick=()=>{const p=PRODUCTS.find(p=>p.id===select.value),a=getArea(),d=getDEM();const blob=new Blob([JSON.stringify({version:9,area:a,product:p,terrain:d?{source:d.source,crs:d.crs,resolution:d.resolution}:null,coverage:coverage.textContent,files:[...records.children].map(x=>x.textContent)},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=u;anchor.download='OcToS-Rain-V9-datos.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 function refresh(){const a=getArea(),d=getDEM();if(!a){area.textContent='Define primero un rectángulo o polígono de estudio.';coverage.textContent='Cobertura pendiente de área.';return;}
  const b=a.bounds,km2=6371**2*Math.abs((b[2]-b[0])*Math.PI/180*(Math.sin(b[3]*Math.PI/180)-Math.sin(b[1]*Math.PI/180)));
  area.textContent='Extensión WGS84: '+b.map(n=>n.toFixed(5)).join(', ')+' · rectángulo envolvente '+km2.toFixed(2)+' km²'+(a.ring?' (el polígono puede ocupar menos superficie).':'.');
  if(!d){coverage.textContent='Sin MDT cargado. Descargar un archivo no lo incorpora al estudio.';return;}
  const c=sampleCoverage(d,b,a.ring);coverage.textContent=c.percent===null?'El área es demasiado pequeña para el muestreo.':'Cobertura estimada por muestreo: '+c.percent.toFixed(1)+' % de '+c.total+' puntos del área con elevación válida. '+(c.percent<100?'Faltan datos o hay NoData.':'El muestreo no detecta huecos; no garantiza cobertura completa entre puntos.')+' Resolución de análisis: '+d.dx.toFixed(2)+' × '+d.dy.toFixed(2)+' m.';
 }
 document.getElementById('selectionSection').after(el);
 new MutationObserver(()=>refresh()).observe(document.getElementById('zoneStatus'),{childList:true,characterData:true,subtree:true});
 new MutationObserver(()=>refresh()).observe(document.getElementById('metadata'),{childList:true,characterData:true,subtree:true});refresh();
}
