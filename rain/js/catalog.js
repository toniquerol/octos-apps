// Catálogo cartográfico V6: servicios compartidos con OcToS Carto.
// Cada WMS se incorpora exclusivamente al panel temático, por encima del mapa base.
const services=[
 {group:'Hidrografía',items:[
  ['Hidrografía oficial IGN','https://servicios.idee.es/wms-inspire/hidrografia'],
  ['Red de transporte','https://servicios.idee.es/wms-inspire/transportes']]},
 {group:'Relieve y terreno',items:[
  ['Modelos digitales del terreno','https://servicios.idee.es/wms-inspire/mdt'],
  ['Pendientes IGN','https://wms-pendientes.idee.es/pendientes']]},
 {group:'Inundaciones · peligrosidad',items:[
  ['Peligrosidad SNCZI','https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones'],
  ['Zona inundable 10 años','https://gis.miteco.gob.es/geoserver/agua/Zi_laminas_q10/wms'],
  ['Zona inundable 50 años','https://gis.miteco.gob.es/geoserver/agua/Zi_laminas_q50/wms'],
  ['Zona inundable 100 años','https://gis.miteco.gob.es/geoserver/agua/Zi_laminas_q100/wms'],
  ['Zona inundable 500 años','https://gis.miteco.gob.es/geoserver/agua/Zi_laminas_q500/wms']]},
 {group:'Riesgo y zonas de gestión',items:[
  ['Riesgo de inundación','https://gis.miteco.gob.es/geoserver/agua/riesgo/wms'],
  ['Áreas ARPSI','https://gis.miteco.gob.es/geoserver/agua/Zi_arpsi/wms']]},
 {group:'Información geográfica',items:[
  ['Cobertura del suelo','https://servicios.idee.es/wms-inspire/ocupacion-suelo'],
  ['Unidades administrativas','https://www.ign.es/wms-inspire/unidades-administrativas']]}
];
function one(el,tag,txt){const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;el.append(x);return x;}
function namedLayers(xml){
 const parsed=new DOMParser().parseFromString(xml,'application/xml');
 if(parsed.querySelector('parsererror'))throw Error('El servicio no ha entregado XML válido.');
 const layers=[...parsed.getElementsByTagName('*')].filter(x=>x.localName==='Layer');
 return layers.map(l=>{
  const get=n=>[...l.children].find(x=>x.localName===n)?.textContent?.trim();
  return {name:get('Name'),title:get('Title')||get('Name')};
 }).filter(x=>x.name);
}
export function officialCatalog(map,host,onLayer,onError){
 const paneName='rainThematicPane';
 if(!map.getPane(paneName)){const pane=map.createPane(paneName);pane.style.zIndex='480';pane.style.pointerEvents='none';}
 const root=one(host,'details');root.id='officialLayers';root.className='official-services';
 one(root,'summary','06 · CAPAS CARTOGRÁFICAS');
 one(root,'p','Nueve capas oficiales se activan por defecto en V9.5. Utiliza el botón «Capas» superior para ordenarlas, ocultarlas o ajustar su opacidad. Aquí puedes añadir otras subcapas WMS.').className='hint';
 const active=new Map();
 for(const group of services){
  const section=one(root,'details');section.className='service-section';
  one(section,'summary',group.group);
  for(const [name,url] of group.items){
   const service=one(section,'details');service.className='catalog-service';
   const summary=one(service,'summary',name);
   const state=one(service,'p','Abrir para consultar las subcapas oficiales.');state.className='hint';
   const container=one(service,'div');container.className='service-items';
   let loading=false,loaded=false;
   service.addEventListener('toggle',async()=>{
    if(!service.open||loaded||loading)return;
    loading=true;state.textContent='Consultando capas WMS…';
    try{
     const endpoint=new URL(url);
     endpoint.searchParams.set('SERVICE','WMS');endpoint.searchParams.set('REQUEST','GetCapabilities');
     endpoint.searchParams.set('VERSION','1.3.0');
     const response=await fetch(endpoint.href,{mode:'cors'});
     if(!response.ok)throw Error('HTTP '+response.status);
     const layers=namedLayers(await response.text());
     if(!layers.length)throw Error('Sin subcapas publicadas en el servicio.');
     for(const item of layers){
      const key=url+'|'+item.name;
      const row=one(container,'div');row.className='catalog-layer-row';
      const label=one(row,'label');const check=one(label,'input');check.type='checkbox';
      one(label,'span',item.title);
      const opacity=one(row,'input');opacity.type='range';opacity.min='0';opacity.max='1';opacity.step='.05';opacity.value='.75';
      opacity.title='Transparencia de '+item.title;opacity.setAttribute('aria-label','Opacidad de '+item.title);
      const percentage=one(row,'small','75 %');
      const setOpacity=()=>{percentage.textContent=Math.round(+opacity.value*100)+' %';active.get(key)?.setOpacity(+opacity.value);};
      opacity.addEventListener('input',()=>{setOpacity();onLayer?.(active.get(key),item.title,key,'sync');});
      check.addEventListener('change',()=>{
       if(check.checked){
        try{
         const layer=L.tileLayer.wms(url,{layers:item.name,format:'image/png',transparent:true,version:'1.3.0',pane:paneName,opacity:+opacity.value,attribution:name,maxZoom:22});
         layer.on('tileerror',()=>{state.textContent='Algunas teselas no están disponibles: verifica cobertura, escala y servicio.';});
         active.set(key,layer);layer.addTo(map);onLayer?.(layer,item.title,key,'add',{checkbox:check,range:opacity,percentage});
        }catch(e){check.checked=false;onError?.(name+': '+e.message);}
       }else{onLayer?.(active.get(key),item.title,key,'remove');active.get(key)?.remove();active.delete(key);}
      });
     }
     state.textContent=layers.length+' subcapas disponibles. Activa las necesarias.';
     loaded=true;
    }catch(e){
     state.textContent='No se pudo consultar este servicio ('+e.message+'). Puede requerir CORS o estar temporalmente fuera de línea.';
     onError?.(name+': '+e.message);
    }finally{loading=false;}
   });
  }
 }
 return {root,active};
}
