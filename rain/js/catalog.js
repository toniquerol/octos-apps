import {DEFAULT_LAYERS} from './layer-presets.js';
// OcToS Rain V9.6: árbol de servicios WMS oficiales IDEE / IGN / ICGC / MITECO.
// Los servicios son visuales. Las imágenes WMS no se utilizan para cálculos hidrológicos.
const HY='https://servicios.idee.es/wms-inspire/hidrografia';
const MDT='https://servicios.idee.es/wms-inspire/mdt';
const COVER='https://servicios.idee.es/wms-inspire/ocupacion-suelo';
const ICGC='https://geoserveis.ide.cat/servei/catalunya/';
const services=[
 {group:'Nombres geográficos',items:[
  ['Nomenclátor IGN','https://www.ign.es/wms-inspire/ngbe',[],['GN.GeographicalNames']]]},
 {group:'Unidades administrativas',items:[
  ['Límites administrativos IGN','https://www.ign.es/wms-inspire/unidades-administrativas',[],['AU.AdministrativeUnit']]]},
 {group:'Parcelas catastrales',items:[
  ['Catastro INSPIRE','https://ovc.catastro.meh.es/cartografia/INSPIRE/spadgcwms.aspx',['CP.CadastralParcel'],['CP.CadastralParcel']]]},
 {group:'Direcciones',items:[
  ['CartoCiudad · direcciones','https://www.cartociudad.es/wms-inspire/direcciones-ccpp']]},
 {group:'Hidrografía',items:[
  ['Red hidrográfica IGN',HY]]},
 {group:'Transporte',items:[
  ['Redes de transporte IGN','https://servicios.idee.es/wms-inspire/transportes']]},
 {group:'Lugares protegidos',items:[
  ['Natura 2000 Cataluña',ICGC+'inspire-natura-2000/wms',[],['PS.ProtectedSite']],
  ['Espacios de protección especial',ICGC+'inspire-espais-naturals-proteccio-especial/wms',[],['PS.ProtectedSite']]]},
 {group:'Cubierta terrestre',items:[
  ['Ocupación del suelo · cubierta IGN',COVER,['LC.LandCoverSurfaces'],['LC.LandCoverSurfaces']],
  ['Cubiertas de Cataluña · ICGC',ICGC+'inspire-coberta-terrestre/wms',[],['LC.LandCoverSurfaces']]]},
 {group:'Usos del suelo',items:[
  ['Uso existente · SIOSE / CORINE',COVER,['LU.ExistingLandUse'],['LU.ExistingLandUse']]]},
 {group:'Elevaciones',items:[
  ['Modelos digitales del terreno · IGN',MDT],
  ['Cotas altimétricas INSPIRE · ICGC',ICGC+'inspire-elevacions/wms',[],['EL.SpotElevation']],
  ['Pendientes IGN','https://wms-pendientes.idee.es/pendientes']]},
 {group:'Geología',items:[
  ['Geología INSPIRE · ICGC',ICGC+'inspire-geologia/wms',[],['GE.Borehole','GE.GeologicFault','GE.GeologicFold','GE.GeologicUnit','GE.GeomorphologicFeature']]]},
 {group:'Ortoimágenes',items:[
  ['Ortoimágenes INSPIRE · ICGC',ICGC+'inspire-ortoimatges/wms',[],['OI.OrthoimageCoverage']]]},
 {group:'Edificios',items:[
  ['Edificaciones INSPIRE · ICGC',ICGC+'inspire-edificis/wms',[],['BU.Building']]]},
 {group:'Inundaciones · peligrosidad',items:[
  ['Peligrosidad SNCZI','https://servicios.idee.es/wms-inspire/riesgos-naturales/inundaciones'],
  ['Zona inundable 50 años','https://gis.miteco.gob.es/geoserver/agua/Zi_laminas_q50/wms'],
  ['Zona inundable 100 años','https://gis.miteco.gob.es/geoserver/agua/Zi_laminas_q100/wms'],
  ['Zona inundable 500 años','https://gis.miteco.gob.es/geoserver/agua/Zi_laminas_q500/wms']]},
 {group:'Riesgo y gestión',items:[
  ['Riesgo de inundación','https://gis.miteco.gob.es/geoserver/agua/riesgo/wms'],
  ['Áreas ARPSI','https://gis.miteco.gob.es/geoserver/agua/Zi_arpsi/wms']]}
];
function one(parent,tag,txt){
 const el=document.createElement(tag);
 if(txt!==undefined)el.textContent=txt;
 parent.append(el);
 return el;
}
function keyOf(url,layer){
 return url.trim().replace(/\/+$/,'').toLowerCase()+'|'+layer.trim().toLowerCase();
}
const presetKeys=new Set(DEFAULT_LAYERS.map(layer=>keyOf(layer.url,layer.layer)));
function namedLayers(xml){
 const doc=new DOMParser().parseFromString(xml,'application/xml');
 if([...doc.getElementsByTagName('*')].some(x=>x.localName==='parsererror'))throw Error('XML no válido.');
 const layers=[...doc.getElementsByTagName('*')].filter(x=>x.localName==='Layer');
 return layers.map(el=>{
  const direct=n=>[...el.children].find(child=>child.localName===n)?.textContent?.trim();
  return {name:direct('Name'),title:direct('Title')||direct('Name')};
 }).filter(x=>x.name);
}
export function officialCatalog(map,host,onLayer,onError){
 const pane='rainThematicPane';
 if(!map.getPane(pane)){
  const el=map.createPane(pane);el.style.zIndex='480';el.style.pointerEvents='none';
 }
 const root=one(host,'details');root.id='officialLayers';root.className='official-services';root.open=true;
 one(root,'summary','Catálogo de capas INSPIRE / IDEE');
 one(root,'p','Despliega un tema y un servicio para consultar subcapas WMS. Las nueve capas iniciales aparecen arriba, sin duplicarse aquí.').className='hint';
 const active=new Map();
 const shownKeys=new Set();
 const addService=(parent,name,url,pick=[],fallback=[])=>{
  const service=one(parent,'details');service.className='catalog-service';
  one(service,'summary',name);
  const state=one(service,'p','Despliega para consultar el WMS oficial.');state.className='hint';
  const link=one(service,'a','Consultar GetCapabilities del servicio');
  link.className='catalog-service-link';link.target='_blank';link.rel='noopener noreferrer';
  const endpoint=new URL(url);
  endpoint.searchParams.set('SERVICE','WMS');endpoint.searchParams.set('REQUEST','GetCapabilities');
  endpoint.searchParams.set('VERSION','1.3.0');
  link.href=endpoint.href;
  const container=one(service,'div');container.className='service-items';
  let loading=false,loaded=false;
  const draw=(items)=>{
   let added=0,excluded=0;
   for(const item of items){
    if(pick.length&&!pick.includes(item.name))continue;
    const key=keyOf(url,item.name);
    if(presetKeys.has(key)||shownKeys.has(key)){excluded++;continue;}
    shownKeys.add(key);added++;
    const row=one(container,'div');row.className='catalog-layer-row';
    const label=one(row,'label');const check=one(label,'input');check.type='checkbox';
    one(label,'span',item.title||item.name);
    const opacity=one(row,'input');opacity.type='range';opacity.min='0';opacity.max='1';opacity.step='.05';opacity.value='.75';
    opacity.title='Opacidad de '+(item.title||item.name);
    opacity.setAttribute('aria-label',opacity.title);
    const percentage=one(row,'small','75 %');
    opacity.addEventListener('input',()=>{
     percentage.textContent=Math.round(+opacity.value*100)+' %';
     const overlay=active.get(key);
     overlay?.setOpacity(+opacity.value);
     if(overlay)onLayer?.(overlay,item.title||item.name,key,'sync',{range:opacity,percentage});
    });
    check.addEventListener('change',()=>{
     if(check.checked){
      try{
       const overlay=L.tileLayer.wms(url,{layers:item.name,format:'image/png',transparent:true,version:'1.3.0',pane,opacity:+opacity.value,attribution:name,maxZoom:22});
       overlay.on('tileerror',()=>{state.textContent='Algunas teselas no están disponibles. Comprueba cobertura y escala.';});
       active.set(key,overlay);overlay.addTo(map);
       onLayer?.(overlay,item.title||item.name,key,'add',{checkbox:check,range:opacity,percentage});
      }catch(error){check.checked=false;onError?.(name+': '+error.message);}
     }else{
      const overlay=active.get(key);
      if(overlay){onLayer?.(overlay,item.title||item.name,key,'remove');overlay.remove();active.delete(key);}
     }
    });
   }
   return {added,excluded};
  };
  service.addEventListener('toggle',async()=>{
   if(!service.open||loading||loaded)return;
   loading=true;state.textContent='Consultando GetCapabilities…';
   try{
    const response=await fetch(endpoint.href,{mode:'cors'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const list=namedLayers(await response.text());
    if(!list.length)throw Error('No se encontraron subcapas en GetCapabilities.');
    const summary=draw(list);
    state.textContent=summary.added+' subcapas nuevas disponibles'+(summary.excluded?' ('+summary.excluded+' ya presentes)':'')+'.';
    loaded=true;
   }catch(error){
    if(fallback.length){
     const summary=draw(fallback.map(name=>({name,title:name})));
     state.textContent='No se pudo leer GetCapabilities desde el navegador ('+error.message+'). '+summary.added+' subcapas oficiales preconfiguradas; consulta el enlace del servicio para verificar su respuesta.';
     loaded=true;
    }else{
     state.textContent='GetCapabilities no accesible desde el navegador ('+error.message+'). Abre el enlace oficial para consultar las subcapas; puede requerirse CORS.';
     onError?.(name+': '+error.message);
    }
   }finally{loading=false;}
  });
  return service;
 };
 for(const group of services){
  const section=one(root,'details');section.className='service-section';
  one(section,'summary',group.group);
  for(const item of group.items)addService(section,...item);
 }
 const extra=one(root,'details');extra.className='service-section';
 one(extra,'summary','Añadir otro servicio WMS');
 const input=one(extra,'input');input.type='url';input.placeholder='https://servidor/.../wms';input.setAttribute('aria-label','URL oficial del servicio WMS');
 const add=one(extra,'button','Añadir servicio');add.type='button';
 const addedServices=one(extra,'div');
 add.addEventListener('click',()=>{
  try{
   const url=new URL(input.value.trim());
   if(url.protocol!=='https:')throw Error('La URL debe comenzar por https.');
   const base=url.origin+url.pathname;
   if([...addedServices.querySelectorAll('[data-service-url]')].some(el=>el.dataset.serviceUrl===base))throw Error('Este servicio ya está añadido.');
   const section=addService(addedServices,url.hostname+' · '+url.pathname,base);
   section.dataset.serviceUrl=base;section.open=true;input.value='';
  }catch(error){onError?.('WMS: '+error.message);}
 });
 return {root,active};
}
