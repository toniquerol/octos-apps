/* OcToS Layers V3: WMS multicapas y comparación */
(function(){
'use strict';
if(window.OcToSLayersV3)return;window.OcToSLayersV3=true;
const oldDivider=document.getElementById('resizePreview'),divider=oldDivider.cloneNode(true);
oldDivider.replaceWith(divider);divider.className='split-v';divider.setAttribute('aria-orientation','vertical');divider.setAttribute('aria-label','Ajustar ancho de ficha técnica');
const container=document.querySelector('.mapcontainer'),ref=document.createElement('div');
ref.id='v3compareReference';ref.setAttribute('aria-hidden','true');
const rail=document.createElement('div');rail.id='v3compareRail';rail.tabIndex=0;rail.setAttribute('role','separator');rail.setAttribute('aria-label','Comparación fondo y capas');rail.setAttribute('aria-orientation','vertical');rail.setAttribute('aria-valuemin','0');rail.setAttribute('aria-valuemax','100');rail.innerHTML='<span>↔</span>';
const left=document.createElement('div');left.id='v3compareLeft';left.className='v3compareLabel';left.textContent='FONDO';
const right=document.createElement('div');right.id='v3compareRight';right.className='v3compareLabel';right.textContent='CAPAS';
container.append(ref,rail,left,right);
const compareButton=document.createElement('button');compareButton.id='v3compareButton';compareButton.textContent='↔';compareButton.title='Comparador de mapa base y capas';compareButton.setAttribute('aria-label',compareButton.title);compareButton.setAttribute('aria-pressed','false');
document.querySelector('.maptools').prepend(compareButton);
const layerField=$('layer');
layerField.closest('label').firstChild.textContent='Identificador(es) WMS · separados por comas';
const names=s=>[...new Set(String(s||'').split(',').map(v=>v.trim()).filter(Boolean))];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const originalSelect=select,originalPreview=preview,originalFocus=installFocus,originalApplyBase=applyBase,originalSwitch3d=switch3d;
let leafOverlays=new Map();
function selectedSpecs(x){
 if(x?.kind!=='WMS')return[];
 const active=Array.isArray(x.wmsEnabled)?x.wmsEnabled:names(x.layer);
 return active.map(name=>({name,opacity:clamp(Number(x.wmsOpacities?.[name]??x.opacity??0.75))}));
}
function clearLeaf(){
 for(const l of leafOverlays.values())if(map?.hasLayer(l))map.removeLayer(l);
 leafOverlays.clear();if(overlay&&map?.hasLayer(overlay))map.removeLayer(overlay);overlay=null;
}
function clearGL(){
 if(!map3d?.isStyleLoaded())return;
 for(const l of map3d.getStyle().layers.filter(v=>v.id.startsWith('octosv3-')))if(map3d.getLayer(l.id))map3d.removeLayer(l.id);
 for(const id of Object.keys(map3d.getStyle().sources).filter(v=>v.startsWith('octosv3-')))if(map3d.getSource(id))map3d.removeSource(id);
}
function tileURL(x,name){
 const u=new URL(x.url);
 for(const [k,v] of Object.entries({SERVICE:'WMS',REQUEST:'GetMap',VERSION:'1.1.1',LAYERS:name,STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',SRS:'EPSG:3857',BBOX:'{bbox-epsg-3857}',WIDTH:'256',HEIGHT:'256'}))u.searchParams.set(k,v);
 return u.href.replace(/%7Bbbox-epsg-3857%7D/gi,'{bbox-epsg-3857}');
}
installFocus=function(){
 const x=data.find(v=>v.id===selected);
 if(x?.kind!=='WMS'){clearGL();return originalFocus()}
 if(!map3d?.isStyleLoaded())return;
 try{
  if(map3d.getLayer('focus'))map3d.removeLayer('focus');if(map3d.getSource('focus'))map3d.removeSource('focus');
  clearGL();const layers=selectedSpecs(x);
  layers.forEach((s,i)=>{const id='octosv3-'+i;map3d.addSource(id,{type:'raster',tiles:[tileURL(x,s.name)],tileSize:256});map3d.addLayer({id,type:'raster',source:id,paint:{'raster-opacity':s.opacity}})});
  setPreviewStatus(layers.length?'Visualizando '+layers.length+' subcapas WMS':'Mapa base · ninguna subcapa activa');
 }catch(e){setPreviewStatus('WMS: '+e.message)}
};
preview=function(){
 const x=data.find(v=>v.id===selected);clearLeaf();
 if(!x){setPreviewStatus('Sin recurso seleccionado');return}
 if(x.kind!=='WMS'){clearGL();return originalPreview()}
 try{
  if(usesMapLibre()){chooseStyle();displayCanvas();return}
  setLeafletBase();displayCanvas();const layers=selectedSpecs(x);
  layers.forEach(s=>{
   const l=L.tileLayer.wms(x.url,{layers:s.name,format:'image/png',transparent:true,opacity:s.opacity,version:'1.3.0'});
   l.on('tileerror',()=>setPreviewStatus('Tesela no disponible: '+s.name));l.addTo(map);leafOverlays.set(s.name,l);
  });
  setPreviewStatus(layers.length?'Cargando '+layers.length+' subcapas WMS':'Mapa base · ninguna subcapa activa');
  requestAnimationFrame(()=>map.invalidateSize());updateScale();
 }catch(e){setPreviewStatus('WMS: '+e.message)}
};
function updateEnabled(x,active){
 x.wmsEnabled=[...new Set(active)];x.wmsOpacities=x.wmsOpacities||{};
 layerField.value=x.wmsEnabled.join(',');persist();
}
function renderCapabilities(layers){
 const x=data.find(v=>v.id===selected);if(!x)return;
 const active=new Set(selectedSpecs(x).map(v=>v.name));
 $('found').innerHTML='<div class="v3capTitle">SUBCAPAS WMS · '+layers.length+' · selección múltiple</div>'+layers.map(v=>{
  const checked=active.has(v.name),value=Math.round(clamp(Number(x.wmsOpacities?.[v.name]??x.opacity??.75))*100);
  return '<div class="v3capRow '+(checked?'checked':'')+'"><label><input type="checkbox" data-v3-layer="'+esc(v.name)+'" '+(checked?'checked':'')+' aria-label="Activar '+esc(v.name)+'"><span class="v3capName">'+esc(v.title||v.name)+'<small>'+esc(v.name)+'</small></span></label><div class="v3capOpacity"><input type="range" min="0" max="100" value="'+value+'" data-v3-opacity="'+esc(v.name)+'" aria-label="Opacidad '+esc(v.name)+'"><output>'+value+'%</output></div></div>';
 }).join('');
 $('found').querySelectorAll('input[data-v3-layer]').forEach(box=>box.addEventListener('change',()=>{
  const current=data.find(v=>v.id===selected);if(!current)return;
  const selectedNames=selectedSpecs(current).map(v=>v.name),name=box.dataset.v3Layer;
  if(box.checked&&!selectedNames.includes(name))selectedNames.push(name);
  if(!box.checked){const index=selectedNames.indexOf(name);if(index>=0)selectedNames.splice(index,1)}
  updateEnabled(current,selectedNames);box.closest('.v3capRow').classList.toggle('checked',box.checked);preview();
 }));
 $('found').querySelectorAll('input[data-v3-opacity]').forEach(range=>{
  range.addEventListener('input',()=>{
   const current=data.find(v=>v.id===selected);if(!current)return;
   const name=range.dataset.v3Opacity,opacity=clamp(Number(range.value)/100);
   current.wmsOpacities=current.wmsOpacities||{};current.wmsOpacities[name]=opacity;
   range.nextElementSibling.textContent=Math.round(opacity*100)+'%';
   leafOverlays.get(name)?.setOpacity(opacity);
   const index=selectedSpecs(current).findIndex(v=>v.name===name);
   if(index>=0&&map3d?.getLayer('octosv3-'+index))map3d.setPaintProperty('octosv3-'+index,'raster-opacity',opacity);
  });range.addEventListener('change',persist);
 });
}
test=async function(){
 const x=data.find(v=>v.id===selected);if(!x)return;
 if(!['WMS','WMTS','WFS','WCS'].includes(x.kind)){setPreviewStatus('GetCapabilities no aplicable a '+x.kind);return}
 const id=selected,u=new URL(x.url),versions={WMS:'1.3.0',WMTS:'1.0.0',WFS:'2.0.0',WCS:'2.0.1'};
 u.searchParams.set('SERVICE',x.kind);u.searchParams.set('REQUEST','GetCapabilities');u.searchParams.set('VERSION',versions[x.kind]);setPreviewStatus('Consultando GetCapabilities…');
 try{
  const r=await fetch(u.toString());if(!r.ok)throw Error('HTTP '+r.status);
  const doc=new DOMParser().parseFromString(await r.text(),'application/xml');
  if(doc.querySelector('parsererror'))throw Error('XML no válido');
  const exception=[...doc.getElementsByTagName('*')].find(v=>['ServiceException','ExceptionText'].includes(v.localName));
  if(exception)throw Error(exception.textContent?.trim().slice(0,150)||'Error del servicio');
  const layers=[...doc.getElementsByTagName('*')].filter(v=>v.localName==='Layer').map(v=>({name:[...v.children].find(c=>['Name','Identifier'].includes(c.localName))?.textContent?.trim(),title:[...v.children].find(c=>c.localName==='Title')?.textContent?.trim()})).filter(v=>v.name);
  if(id!==selected)return;
  x.lastChecked={at:new Date().toISOString(),result:'respuesta OGC',count:layers.length,selectedLayerFound:selectedSpecs(x).every(s=>layers.some(v=>v.name===s.name))};persist();
  setPreviewStatus('GetCapabilities · '+layers.length+' capas ('+x.kind+')');
  if(x.kind==='WMS')renderCapabilities(layers.slice(0,400));
  else{$('found').innerHTML=layers.slice(0,150).map(v=>'<div class="found"><span>'+esc(v.title||v.name)+'</span><button data-layer="'+esc(v.name)+'">Elegir</button></div>').join('');$('found').querySelectorAll('button').forEach(b=>b.onclick=()=>{layerField.value=b.dataset.layer;preview()})}
 }catch(e){if(id!==selected)return;x.lastChecked={at:new Date().toISOString(),result:'no comprobado',error:e.message};persist();setPreviewStatus('GetCapabilities: '+e.message+' (posible CORS)')}
};
select=function(id){clearLeaf();$('found').replaceChildren();originalSelect(id);const x=data.find(v=>v.id===id);if(x?.kind==='WMS'&&Array.isArray(x.wmsEnabled)){layerField.value=x.wmsEnabled.join(',');preview()}};
layerField.addEventListener('change',()=>{const x=data.find(v=>v.id===selected);if(x?.kind!=='WMS')return;updateEnabled(x,names(layerField.value));$('found').replaceChildren();preview()});
$('test').onclick=()=>test();$('preview').onclick=()=>preview();
let compareMap=null,compareSource=null,compareListener=null,compareActive=false;
let position=clamp(Number(localStorage.getItem('octos-layers-compare-v3'))/100||.5,.03,.97);
function drawSplit(){ref.style.clipPath='inset(0 '+((1-position)*100)+'% 0 0)';rail.style.left=(position*100)+'%';rail.setAttribute('aria-valuenow',String(Math.round(position*100)))}
function sync(){
 if(!compareMap||!compareSource)return;
 if(usesMapLibre()){
  const c=map3d?.getCenter();if(c)compareMap.jumpTo({center:c,zoom:map3d.getZoom(),bearing:map3d.getBearing(),pitch:map3d.getPitch()});
 }else if(map)compareMap.setView(map.getCenter(),map.getZoom(),{animate:false});
}
function destroyCompare(){
 if(compareSource&&compareListener)compareSource.off('move',compareListener);
 compareSource=null;compareListener=null;if(compareMap){compareMap.remove();compareMap=null}ref.replaceChildren();
}
function deactivate(){
 compareActive=false;destroyCompare();ref.style.display='none';rail.style.display='none';left.style.display='none';right.style.display='none';compareButton.setAttribute('aria-pressed','false');
}
function activate(){
 if(terrainMode){setPreviewStatus('Comparador disponible en vista 2D');return}
 try{
  const gl=usesMapLibre(),b=baseConfig();if(gl)ensure3d();else ensureMap();
  destroyCompare();ref.style.display='block';rail.style.display='block';left.style.display='block';right.style.display='block';drawSplit();
  if(gl){
   const c=map3d.getCenter();
   compareMap=new maplibregl.Map({container:ref,style:b.url,center:[c.lng,c.lat],zoom:map3d.getZoom(),pitch:map3d.getPitch(),bearing:map3d.getBearing(),interactive:false,attributionControl:false,renderWorldCopies:false});
   if(b.id==='simple')compareMap.on('style.load',()=>{
    for(const layer of compareMap.getStyle()?.layers||[]){
     const n=(layer.id||'').toLowerCase();
     if(layer.type==='background'){compareMap.setPaintProperty(layer.id,'background-color','#fbfcfd');continue}
     if(layer.type==='fill'&&(n.includes('water')||n.includes('ocean')||n.includes('sea'))){compareMap.setPaintProperty(layer.id,'fill-color','#b6d6e5');continue}
     compareMap.setLayoutProperty(layer.id,'visibility','none');
    }
   });compareSource=map3d;
  }else{
   compareMap=L.map(ref,{center:map.getCenter(),zoom:map.getZoom(),zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,touchZoom:false});
   L.tileLayer(b.url,{tms:!!b.tms&&!b.url.includes('{-y}'),maxZoom:19}).addTo(compareMap);compareSource=map;
  }
  compareListener=sync;compareSource.on('move',compareListener);compareActive=true;compareButton.setAttribute('aria-pressed','true');
  requestAnimationFrame(()=>{if(gl)compareMap?.resize();else compareMap?.invalidateSize();sync()});
 }catch(e){deactivate();setPreviewStatus('Comparador: '+e.message)}
}
compareButton.onclick=()=>{if(compareActive){deactivate();localStorage.setItem('octos-layers-compare-enabled-v3','0')}else{activate();localStorage.setItem('octos-layers-compare-enabled-v3','1')}};
rail.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;e.preventDefault();rail.setPointerCapture(e.pointerId);
 const move=ev=>{const r=container.getBoundingClientRect();position=clamp((ev.clientX-r.left)/r.width,.03,.97);drawSplit()};
 const done=()=>{rail.removeEventListener('pointermove',move);localStorage.setItem('octos-layers-compare-v3',String(position*100))};
 rail.addEventListener('pointermove',move);rail.addEventListener('pointerup',done,{once:true});rail.addEventListener('pointercancel',done,{once:true});move(e);
});
rail.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();position=e.key==='Home'?.03:e.key==='End'?.97:clamp(position+(e.key==='ArrowLeft'?-.02:.02),.03,.97);drawSplit();localStorage.setItem('octos-layers-compare-v3',String(position*100))});
applyBase=function(){originalApplyBase();if(compareActive){deactivate();activate()}};
switch3d=function(){if(compareActive)deactivate();originalSwitch3d();compareButton.disabled=terrainMode};
$('toggle3d').onclick=()=>switch3d();
const editor=document.querySelector('.editor'),technical=document.querySelector('.technical');
let width=Number(localStorage.getItem('octos-layers-width-v3'))||260;
function fit(){
 if(matchMedia('(max-width:790px)').matches){technical.style.removeProperty('--layers-v3-width');return}
 width=clamp(width,205,Math.max(205,editor.clientWidth-185));
 technical.style.setProperty('--layers-v3-width',width+'px');map?.invalidateSize();map3d?.resize();
 if(compareMap){if(usesMapLibre())compareMap.resize();else compareMap.invalidateSize()}
}
divider.addEventListener('pointerdown',e=>{
 if(e.button!==0)return;e.preventDefault();divider.setPointerCapture(e.pointerId);
 const start=e.clientX,initial=width;document.body.classList.add('resizing');
 const move=ev=>{width=initial+ev.clientX-start;fit()};
 const done=()=>{divider.removeEventListener('pointermove',move);document.body.classList.remove('resizing');localStorage.setItem('octos-layers-width-v3',String(width))};
 divider.addEventListener('pointermove',move);divider.addEventListener('pointerup',done,{once:true});divider.addEventListener('pointercancel',done,{once:true});
});
divider.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();width+=e.key==='ArrowRight'?16:-16;fit();localStorage.setItem('octos-layers-width-v3',String(width))});
new ResizeObserver(()=>{map?.invalidateSize();map3d?.resize();if(compareMap){if(usesMapLibre())compareMap.resize();else compareMap.invalidateSize()}}).observe(container);
window.addEventListener('resize',fit);requestAnimationFrame(fit);if(selected)requestAnimationFrame(()=>preview());if(localStorage.getItem('octos-layers-compare-enabled-v3')!=='0')requestAnimationFrame(()=>{if(!terrainMode)activate()});

/* V3.1: separar formulario y GetCapabilities con altura ajustable */
{
 const techBody=document.querySelector('.technical .techscroll');
 const results=document.getElementById('found');
 if(techBody && results && !document.getElementById('v31WmsResize')){
  const form=document.createElement('section');
  form.className='v31-form';
  form.setAttribute('aria-label','Campos de la ficha técnica');
  const caps=document.createElement('section');
  caps.className='v31-caps';
  caps.setAttribute('aria-label','Listado de subcapas del servicio');
  const split=document.createElement('div');
  split.id='v31WmsResize';
  split.className='v31-separator';
  split.tabIndex=0;
  split.setAttribute('role','separator');
  split.setAttribute('aria-orientation','horizontal');
  split.setAttribute('aria-label','Ajustar altura del formulario y la lista de capas WMS');
  split.setAttribute('aria-valuemin','0');
  split.setAttribute('aria-valuemax','100');
  for(const child of Array.from(techBody.children))if(child!==results)form.appendChild(child);
  caps.appendChild(results);
  techBody.append(form,split,caps);

  const storageKey='octos-layers-wms-panel-height-v31';
  let formHeight=Number(localStorage.getItem(storageKey))||0;
  const compact=window.matchMedia('(max-width:790px)');
  let dragging=false;
  function dimensions(){
   const total=Math.max(0,techBody.clientHeight-split.offsetHeight);
   return {total,min:Math.min(110,total*.4),max:Math.max(0,total-Math.min(120,total*.4))};
  }
  function applyHeight(){
   if(compact.matches){
    form.style.removeProperty('flex');
    form.style.removeProperty('height');
    return;
   }
   const {total,min,max}=dimensions();
   if(total<1)return;
   if(!formHeight)formHeight=Math.round(total*.43);
   formHeight=Math.max(min,Math.min(max,formHeight));
   form.style.flex='0 0 '+formHeight+'px';
   split.setAttribute('aria-valuenow',String(Math.round(100*formHeight/total)));
  }
  function storeHeight(){
   try{localStorage.setItem(storageKey,String(Math.round(formHeight)))}catch(_){}
  }
  split.addEventListener('pointerdown',event=>{
   if(compact.matches||event.button!==0)return;
   event.preventDefault();
   split.setPointerCapture(event.pointerId);
   const startY=event.clientY,initial=form.getBoundingClientRect().height;
   dragging=true;
   document.body.classList.add('v31-resizing');
   function move(e){formHeight=initial+e.clientY-startY;applyHeight()}
   function stop(){
    split.removeEventListener('pointermove',move);
    split.removeEventListener('pointerup',stop);
    split.removeEventListener('pointercancel',stop);
    document.body.classList.remove('v31-resizing');
    dragging=false;
    storeHeight();
   }
   split.addEventListener('pointermove',move);
   split.addEventListener('pointerup',stop);
   split.addEventListener('pointercancel',stop);
  });
  split.addEventListener('keydown',event=>{
   if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key)||compact.matches)return;
   event.preventDefault();
   const {min,max}=dimensions();
   if(event.key==='Home')formHeight=min;
   else if(event.key==='End')formHeight=max;
   else formHeight+=(event.key==='ArrowDown'?24:-24);
   applyHeight();
   storeHeight();
  });
  split.addEventListener('dblclick',()=>{
   if(compact.matches)return;
   formHeight=Math.round(dimensions().total*.43);
   applyHeight();
   storeHeight();
  });
  new ResizeObserver(()=>{if(!dragging)applyHeight()}).observe(techBody);
  window.addEventListener('resize',applyHeight);
  if(compact.addEventListener)compact.addEventListener('change',applyHeight);
  applyHeight();
 }
}
})();