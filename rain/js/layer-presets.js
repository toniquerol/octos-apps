// OcToS Rain V9.5 — capas predefinidas y orden de visualización.
// Los servicios WMS proporcionan imágenes; no deben interpretarse como datos de elevación.
const HY='https://servicios.idee.es/wms-inspire/hidrografia';
const MDT='https://servicios.idee.es/wms-inspire/mdt';
export const DEFAULT_LAYERS=Object.freeze([
 {id:'hydro-points',name:'Puntos de interés hidrológico',url:HY,layer:'HY.PhysicalWaters.HydroPointOfInterest',opacity:.75,source:'IGN / IDEE'},
 {id:'hydro-network',name:'Red hidrológica',url:HY,layer:'HY.Network',opacity:.80,source:'IGN / IDEE'},
 {id:'waterbodies',name:'Masas de agua',url:HY,layer:'HY.PhysicalWaters.Waterbodies',opacity:.50,source:'IGN / IDEE'},
 {id:'wetlands',name:'Humedales',url:HY,layer:'HY.PhysicalWaters.Wetland',opacity:.50,source:'IGN / IDEE'},
 {id:'contours',name:'Curvas de nivel',url:MDT,layer:'EL.ContourLine',opacity:1,source:'IGN / IDEE'},
 {id:'mdt',name:'Modelo digital del terreno',url:MDT,layer:'EL.ElevationGridCoverage',opacity:.30,source:'IGN / IDEE'},
 {id:'slope',name:'Modelo digital de pendientes',url:'https://wms-pendientes.idee.es/pendientes',layer:'MDP05',opacity:.20,source:'IGN / CNIG'},
 {id:'flood10',name:'Zona inundable 10 años · ZI alta probabilidad',url:'https://wms.mapama.gob.es/sig/agua/ZI_LaminasQ10/wms.aspx',layer:'NZ.RiskZone',opacity:.25,source:'MITECO / SNCZI'},
 {id:'landcover',name:'Superficie de cobertura terrestre',url:'https://servicios.idee.es/wms-inspire/ocupacion-suelo',layer:'LC.LandCoverSurfaces',opacity:.15,source:'IGN / IDEE'}
]);
export function moveInStack(items,from,to){
 if(from<0||to<0||from>=items.length||to>=items.length)return items.slice();
 const copy=items.slice();copy.splice(to,0,copy.splice(from,1)[0]);return copy;
}
function make(tag,cls,text){
 const el=document.createElement(tag);
 if(cls)el.className=cls;
 if(text!==undefined)el.textContent=text;
 return el;
}
export function initLayerStack(map,host,onStatus=()=>{}){
 let records=[];
 function setOpacity(entry,value){
  entry.opacity=Math.max(0,Math.min(1,Number(value)));
  if(entry.type==='vector')entry.layer.setStyle({opacity:entry.opacity,fillOpacity:entry.opacity*.18});
  else entry.layer.setOpacity(entry.opacity);
  if(entry.external?.range){entry.external.range.value=String(entry.opacity);}
  if(entry.external?.percentage)entry.external.percentage.textContent=Math.round(entry.opacity*100)+' %';
 }
 function syncOrder(){
  // Primer elemento del listado = capa WMS superior.
  records.forEach((entry,i)=>{
   if(entry.type==='wms'&&typeof entry.layer.setZIndex==='function')entry.layer.setZIndex(1050-i);
   else if(entry.type==='vector'&&map.hasLayer(entry.layer)&&typeof entry.layer.bringToFront==='function')entry.layer.bringToFront();
  });
 }
 function setVisible(entry,visible){
  entry.visible=Boolean(visible);
  if(entry.visible){if(!map.hasLayer(entry.layer))entry.layer.addTo(map);}
  else if(map.hasLayer(entry.layer))entry.layer.remove();
  if(entry.external?.checkbox)entry.external.checkbox.checked=entry.visible;
  if(entry.visible)syncOrder();
 }
 function paint(){
  host.replaceChildren();
  records.forEach((entry,i)=>{
   const row=make('div','stack-layer-row');
   const main=make('div','stack-layer-head');
   const arrows=make('div','stack-move');
   for(const [glyph,delta,title] of [['↑',-1,'Subir capa'],['↓',1,'Bajar capa']]){
    const button=make('button','stack-arrow',glyph);button.type='button';button.title=title+' · '+entry.name;
    button.setAttribute('aria-label',button.title);button.disabled=i+delta<0||i+delta>=records.length;
    button.addEventListener('click',()=>{records=moveInStack(records,i,i+delta);syncOrder();paint();});
    arrows.append(button);
   }
   const label=make('label','stack-name');
   const check=make('input');check.type='checkbox';check.checked=entry.visible;
   check.addEventListener('change',()=>{setVisible(entry,check.checked);});
   label.append(check,make('span','',entry.name));main.append(arrows,label);row.append(main);
   const controls=make('div','stack-layer-controls');
   const opacity=make('input');opacity.type='range';opacity.min='0';opacity.max='1';opacity.step='.05';opacity.value=String(entry.opacity);
   opacity.setAttribute('aria-label','Opacidad de '+entry.name);
   const number=make('output','',Math.round(entry.opacity*100)+' %');
   opacity.addEventListener('input',()=>{setOpacity(entry,opacity.value);number.textContent=Math.round(entry.opacity*100)+' %';});
   controls.append(opacity,number);
   if(entry.type==='vector'){
    const color=make('input');color.type='color';color.value=entry.color||'#ff891f';color.title='Color de '+entry.name;
    color.setAttribute('aria-label',color.title);
    color.addEventListener('input',()=>{entry.color=color.value;entry.layer.setStyle({color:entry.color});});
    controls.append(color);
   }
   row.append(controls);
   if(entry.warning)row.append(make('p','stack-warning',entry.warning));
   host.append(row);
  });
 }
 function register(entry){
  const old=records.findIndex(x=>x.id===entry.id);
  if(old!==-1)records.splice(old,1);
  records.push(entry);setVisible(entry,entry.visible);syncOrder();paint();return entry;
 }
 function registerExternal(layer,name,key,external={}){
  if(!layer)return;
  const op=Number.isFinite(Number(external.range?.value))?Number(external.range.value):.75;
  return register({id:'catalog:'+key,name,type:'wms',layer,opacity:op,visible:true,external});
 }
 function registerVector(layer,name,key,color='#ff891f'){
  return register({id:'vector:'+key,name,type:'vector',layer,opacity:1,visible:true,color});
 }
 function syncExternal(key,opacity){
  const entry=records.find(x=>x.id==='catalog:'+key);
  if(entry){setOpacity(entry,opacity);paint();}
 }
 function unregister(key){
  const id=key.startsWith('catalog:')||key.startsWith('vector:')?key:'catalog:'+key;
  records=records.filter(x=>x.id!==id);syncOrder();paint();
 }
 for(const def of DEFAULT_LAYERS){
  const layer=L.tileLayer.wms(def.url,{layers:def.layer,format:'image/png',transparent:true,version:'1.3.0',
   pane:'rainThematicPane',opacity:def.opacity,maxZoom:22,attribution:def.source});
  const entry={...def,type:'wms',layer,visible:true,warning:''};
  let errors=0;
  layer.on('tileerror',()=>{
   if(++errors===2){
    entry.warning='Servicio sin respuesta o fuera de cobertura/escala.';
    paint();onStatus('Alguna capa WMS no responde. Comprueba su disponibilidad desde «Capas».');
   }
  });
  register(entry);
 }
 return {registerExternal,registerVector,unregister,syncExternal,refresh:paint,getLayers:()=>records.map(x=>({id:x.id,name:x.name,opacity:x.opacity,visible:x.visible}))};
}
