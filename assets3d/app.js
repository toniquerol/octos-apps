import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const $ = id => document.getElementById(id);
const DB_NAME = 'octos-3d-assets-v1', STORE = 'models';
const canvas = $('canvas'), stage = $('stage');
const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42,1,.01,50000);
camera.position.set(5,3,7);
const controls = new OrbitControls(camera,canvas);
controls.enableDamping=true;controls.dampingFactor=.08;
scene.add(new THREE.HemisphereLight(0xffffff,0x445268,2.6));
const floorMat=new THREE.MeshStandardMaterial({color:0x565c65,roughness:.95,metalness:0,side:THREE.DoubleSide});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),floorMat);
floor.rotation.x=-Math.PI/2;
floor.name='OcToS · Suelo 10 × 10 m';
floor.renderOrder=-1;
const floorGrid=new THREE.GridHelper(10,10,0x9ca3aa,0x7c8590);
floorGrid.material.transparent=true;
floorGrid.material.opacity=.25;
floorGrid.material.depthWrite=false;
floorGrid.renderOrder=0;
scene.add(floor,floorGrid);
const floorSettingsKey='octos-3d-assets-floor-v1';
function saveFloorPrefs(){
 try{localStorage.setItem(floorSettingsKey,JSON.stringify({enabled:$('floorEnabled').checked,color:$('floorColor').value}))}catch(e){}
}
function updateFloor(){
 const enabled=$('floorEnabled').checked;
 floor.visible=enabled;floorGrid.visible=enabled;
 floorMat.color.set($('floorColor').value);
 saveFloorPrefs();
}
function positionFloor(){
 if(!shown){floor.position.set(0,0,0);floorGrid.position.set(0,.003,0);return}
 const box=new THREE.Box3().setFromObject(shown);
 if(box.isEmpty())return;
 const center=box.getCenter(new THREE.Vector3());
 // Model units follow glTF 2.0 (metres). Never scale the 10 m platform.
 const y=box.min.y-.005;
 floor.position.set(center.x,y,center.z);
 floorGrid.position.set(center.x,y+.003,center.z);
}
try{
 const prefs=JSON.parse(localStorage.getItem(floorSettingsKey)||'null');
 if(prefs){
  if(typeof prefs.enabled==='boolean')$('floorEnabled').checked=prefs.enabled;
  if(typeof prefs.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(prefs.color))$('floorColor').value=prefs.color;
 }
}catch(e){}
updateFloor();
$('floorEnabled').addEventListener('change',updateFloor);
$('floorColor').addEventListener('input',updateFloor);

const keyLight=new THREE.DirectionalLight(0xffffff,3.2);keyLight.position.set(5,9,7);scene.add(keyLight);
const fillLight=new THREE.DirectionalLight(0x8ca9ff,1.4);fillLight.position.set(-6,2,-4);scene.add(fillLight);
let shown=null,mixer=null,active=null,models=[],autoRotate=false,busy=false,dirty=false;
let dbPromise=null,draco=null,meshoptPromise=null;
const clock=new THREE.Clock();
function status(message,error=false){$('message').textContent=message;$('message').style.borderColor=error?'#ff6565':'#ff6a1a'}
function fmt(n){return n==null?'—':(n/1048576).toLocaleString('es-ES',{maximumFractionDigits:2})+' MB'}
function integer(n){return n.toLocaleString('es-ES')}
function safeName(str){return String(str||'modelo').replace(/[\\/:*?"<>|]+/g,'-').slice(0,100)}
function esc(str){return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function tagsFromInput(){return [...new Set($('modelTags').value.split(',').map(v=>v.trim()).filter(Boolean))].slice(0,30)}
function uid(){return crypto.randomUUID ? crypto.randomUUID() : Date.now()+'-'+Math.random().toString(36).slice(2)}
function setBusy(value){
 busy=value;updateButtons();
 $('renderStatus').textContent=value?'Procesando…':'Listo';
}
function updateButtons(){
 const has=!!active,hasGeometry=!!active?.file;
 for(const id of ['save','export'])$(id).disabled=busy||!has;
 for(const id of ['getGLB','optimize'])$(id).disabled=busy||!hasGeometry;
 $('remove').disabled=busy||!active?.id;
 $('import').disabled=busy;
 $('fit').disabled=busy||!hasGeometry;
 $('rotate').disabled=busy||!hasGeometry;
}
async function db(){
 if(dbPromise)return dbPromise;
 dbPromise=new Promise((resolve,reject)=>{
  const req=indexedDB.open(DB_NAME,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:'id'})};
  req.onsuccess=()=>resolve(req.result);
  req.onerror=()=>reject(req.error);
 });
 return dbPromise;
}
async function transact(mode,fn){
 const database=await db();
 return new Promise((resolve,reject)=>{
  const tx=database.transaction(STORE,mode),store=tx.objectStore(STORE);
  let value;
  try{const req=fn(store);req.onsuccess=()=>value=req.result;req.onerror=()=>reject(req.error)}
  catch(e){reject(e);return}
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });
}
const getAll=()=>transact('readonly',s=>s.getAll());
const getOne=id=>transact('readonly',s=>s.get(id));
const put=record=>transact('readwrite',s=>s.put(record));
const del=id=>transact('readwrite',s=>s.delete(id));
function validateGLB(buffer,size){
 const view=new DataView(buffer);
 if(buffer.byteLength<12||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==size)throw new Error('Archivo no válido: se requiere un GLB 2.0 completo.');
}
async function gltfLoader(){
 const loader=new GLTFLoader();
 if(!draco){
  draco=new DRACOLoader();
  draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/');
 }
 loader.setDRACOLoader(draco);
 try{
  if(!meshoptPromise)meshoptPromise=import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/meshopt_decoder.module.js');
  const module=await meshoptPromise;
  if(module.MeshoptDecoder)loader.setMeshoptDecoder(module.MeshoptDecoder);
 }catch(e){/* Los GLB sin meshopt siguen siendo compatibles. */}
 return loader;
}
function clearHTML(){const frame=$('htmlViewer');frame.hidden=true;frame.removeAttribute('srcdoc');$('canvas').hidden=false;$('viewHint').innerHTML='Arrastrar · Orbitar &nbsp; | &nbsp; Rueda · Zoom'}
function clearModel(){
 if(shown){shown.traverse(o=>{if(o.geometry)o.geometry.dispose();const mats=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of mats){for(const v of Object.values(m)){if(v&&v.isTexture)v.dispose()}m.dispose()}});scene.remove(shown);shown=null}
 mixer=null;positionFloor();
}
function centerView(){
 if(!shown)return;
 const box=new THREE.Box3().setFromObject(shown);
 if(box.isEmpty())return;
 const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const length=Math.max(size.length(),.1),distance=length*1.15;
 controls.target.copy(center);
 camera.position.copy(center).add(new THREE.Vector3(distance*.8,distance*.5,distance));
 camera.near=Math.max(length/10000,.001);camera.far=Math.max(length*100,500);
 camera.updateProjectionMatrix();controls.update();
}
async function preview(blob){
 const bytes=await blob.arrayBuffer();
 validateGLB(bytes,blob.size);
 const loader=await gltfLoader();
 const gltf=await loader.parseAsync(bytes,'');
 if(!gltf.scene)throw new Error('El modelo no contiene una escena visible.');
 clearHTML();clearModel();
 shown=gltf.scene;scene.add(shown);positionFloor();
 if(gltf.animations&&gltf.animations.length){
  mixer=new THREE.AnimationMixer(shown);
  for(const clip of gltf.animations)mixer.clipAction(clip).play();
 }
 centerView();
 let triangles=0,meshes=0;
 shown.traverse(o=>{
  if(o.isMesh||o.isSkinnedMesh){
   meshes++;
   const geo=o.geometry;
   if(geo&&geo.getAttribute('position')){
    triangles+=Math.floor((geo.index?geo.index.count:geo.getAttribute('position').count)/3);
   }
  }
 });
 $('triangles').textContent=integer(triangles);
 $('meshes').textContent=integer(meshes);
 $('size').textContent=fmt(blob.size);
 $('emptyStage').hidden=true;
 $('renderStatus').textContent=integer(triangles)+' triángulos';
 return {triangles,meshes};
}
async function previewHTML(blob){
 const html=await blob.text();
 if(!/<!doctype\s+html|<html\b|<head\b|<body\b|<canvas\b|<script\b/i.test(html))throw new Error('El archivo no contiene HTML reconocible.');
 clearModel();
 $('htmlViewer').srcdoc=html;
 $('htmlViewer').hidden=false;
 $('canvas').hidden=true;
 $('emptyStage').hidden=true;
 $('viewHint').textContent='Vista previa HTML aislada · Los controles dependen del archivo';
 $('triangles').textContent='—';$('meshes').textContent='—';$('size').textContent=fmt(blob.size);
 $('renderStatus').textContent='HTML';
}
async function choose(model){
 if(busy)return;
 setBusy(true);
 try{
  const item=await getOne(model.id);
  if(!item)throw new Error('No se encuentra el objeto guardado.');
  if(item.file)await preview(item.file);
  else if(item.html)await previewHTML(item.html);
  else throw new Error('La ficha no contiene un archivo.');
  active=item;dirty=false;
  syncInspector();status('Objeto abierto desde la biblioteca.');drawLibrary();
 }catch(e){status('No se pudo abrir el objeto: '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
function syncInspector(){
  const convertLink=document.querySelector('#octos-app-switcher a[href*="/assets3d/convertir.html"]');
  if(convertLink)convertLink.href='./convertir.html'+(active?.id?'?id='+encodeURIComponent(active.id):'');
 $('modelName').value=active?active.name:'';
 $('modelTags').value=active?(active.tags||[]).join(', '):'';
 $('stageTitle').textContent=active?active.name:'Visor 3D · Sin modelo';
 $('origin').textContent=active?((active.id?'Biblioteca local · ':'Importado · ')+(active.sourceKind==='html'?'HTML':active.sourceKind==='glb-html'?'HTML con GLB':'GLB')):'—';
 $('sizeLabel').textContent=active?.file?'Archivo GLB':'Archivo HTML';
 updateButtons();
}
function markDirty(){
 if(!active)return;
 dirty=true;
 active.name=$('modelName').value.trim()||'Sin nombre';
 active.tags=tagsFromInput();
 $('stageTitle').textContent=active.name;
 status('Cambios pendientes de guardar.');
}
function drawLibrary(){
 const search=$('search').value.trim().toLowerCase(),tag=$('tagFilter').value;
 const list=models.filter(m=>(!tag||(m.tags||[]).includes(tag))&&(!search||(m.name+' '+(m.tags||[]).join(' ')).toLowerCase().includes(search)));
 const root=$('assetList');root.replaceChildren();
 $('count').textContent=integer(models.length)+' modelos';
 if(!list.length){const p=document.createElement('p');p.className='nothing';p.textContent='No hay modelos para este filtro.';root.append(p);return}
 for(const model of list.sort((a,b)=>b.updated-a.updated)){
  const card=document.createElement('div');card.className='asset'+(active&&active.id===model.id?' active':'');
  const button=document.createElement('button');button.type='button';button.className='asset-open';button.setAttribute('aria-label','Abrir '+model.name);
  const img=document.createElement('img');img.className='thumb';img.alt='';img.src=model.thumbnail||'./icon.svg';
  const body=document.createElement('span'),title=document.createElement('span'),sub=document.createElement('span'),chips=document.createElement('span');
  title.className='asset-title';title.textContent=model.name;
  sub.className='asset-sub';sub.textContent=(model.sourceKind==='html'?'HTML · ':'GLB · ')+fmt(model.size)+' · '+new Date(model.updated).toLocaleDateString('es-ES');
  chips.className='chips';
  (model.tags||[]).slice(0,3).forEach(label=>{const c=document.createElement('span');c.className='chip';c.textContent=label;chips.append(c)});
  body.append(title,sub,chips);button.append(img,body);
  button.addEventListener('click',()=>choose(model));
  const actions=document.createElement('div');actions.className='asset-actions';
  const rename=document.createElement('button');rename.className='asset-action';rename.type='button';rename.textContent='✎';rename.title='Renombrar';rename.setAttribute('aria-label','Renombrar '+model.name);
  rename.addEventListener('click',()=>renameLibraryModel(model));
  const removeCard=document.createElement('button');removeCard.className='asset-action danger';removeCard.type='button';removeCard.textContent='×';removeCard.title='Eliminar';removeCard.setAttribute('aria-label','Eliminar '+model.name);
  removeCard.addEventListener('click',()=>removeLibraryModel(model));
  actions.append(rename,removeCard);card.append(button,actions);root.append(card);
 }
}
async function renameLibraryModel(model){
 if(busy)return;
 const name=prompt('Nuevo nombre para "'+model.name+'"',model.name);
 if(name===null)return;
 const cleaned=name.trim().slice(0,120);
 if(!cleaned||cleaned===model.name)return;
 setBusy(true);
 try{
  const record=await getOne(model.id);
  if(!record)throw new Error('No se encontró el objeto.');
  record.name=cleaned;record.updatedAt=Date.now();
  await put(record);
  if(active?.id===model.id){active.name=cleaned;$('modelName').value=cleaned;$('stageTitle').textContent=cleaned;}
  await refresh();status('Modelo renombrado: '+cleaned);
 }catch(e){status('Error al cambiar el nombre: '+e.message,true)}
 finally{setBusy(false)}
}
async function removeLibraryModel(model){
 if(busy)return;
 if(!confirm('¿Eliminar "'+model.name+'" de la biblioteca local?'))return;
 setBusy(true);
 try{
  await del(model.id);
  if(active?.id===model.id){
   active=null;dirty=false;clearModel();clearHTML();$('emptyStage').hidden=false;
   $('triangles').textContent='—';$('meshes').textContent='—';$('size').textContent='—';
   syncInspector();
  }
  await refresh();status('Modelo eliminado de la biblioteca.');
 }catch(e){status('Error al eliminar: '+e.message,true)}
 finally{setBusy(false)}
}
async function refresh(){
 const all=await getAll();
 models=all.map(m=>({id:m.id,name:m.name,tags:m.tags,size:m.file?.size??m.html?.size??0,sourceKind:m.sourceKind||'glb',thumbnail:m.thumbnail,updated:m.updatedAt}));
 const tags=[...new Set(models.flatMap(m=>m.tags||[]))].sort((a,b)=>a.localeCompare(b,'es'));
 const selected=$('tagFilter').value,sel=$('tagFilter');
 sel.replaceChildren(new Option('Todas las etiquetas',''));
 tags.forEach(t=>sel.add(new Option(t,t)));
 if(tags.includes(selected))sel.value=selected;
 drawLibrary();
}
async function recoverGLB(file){
 const html=await file.text();
 const doc=new DOMParser().parseFromString(html,'text/html');
 const payload=doc.getElementById('payload');
 if(!payload || !payload.hasAttribute('data-gzip'))return null;
 const encoded=payload.textContent.trim();
 if(!encoded || encoded.length>350000000)throw new Error('Paquete 3D integrado inválido.');
 const decoded=await base64ToBytes(encoded);
 let buffer=decoded.buffer;
 if(payload.getAttribute('data-gzip')==='1'){
  if(typeof DecompressionStream==='undefined')throw new Error('El navegador no admite descompresión GZIP.');
  buffer=await new Response(new Blob([decoded]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
 }
 validateGLB(buffer,buffer.byteLength);
 return new Blob([buffer],{type:'model/gltf-binary'});
}
async function importFiles(files){
 if(busy)return;
 const items=[...files].filter(f=>/\.(glb|html|htm)$/i.test(f.name));
 if(items.length!==1){status(items.length?'Importa un archivo cada vez.':'Formatos admitidos: .GLB, .HTML y .HTM.',true);return}
 const file=items[0],isHTML=/\.html?$/i.test(file.name);
 if(file.size>250*1048576){status('Límite de importación: 250 MB.',true);return}
 setBusy(true);
 try{
  const name=file.name.replace(/\.(glb|html|htm)$/i,'');
  let record;
  if(isHTML){
   const original=new Blob([file],{type:'text/html;charset=utf-8'});
   let recovered=null;
   try{recovered=await recoverGLB(file)}catch(e){status('No se pudo extraer GLB: '+e.message+'. Se conservará el HTML original.')}
   if(recovered){
    const stats=await preview(recovered);
    record={sourceKind:'glb-html',file:recovered,html:original,triangles:stats.triangles,meshes:stats.meshes};
   }else{
    await previewHTML(original);
    record={sourceKind:'html',file:null,html:original,triangles:null,meshes:null};
   }
  }else{
   const stats=await preview(file);
   record={sourceKind:'glb',file:new Blob([file],{type:'model/gltf-binary'}),html:null,triangles:stats.triangles,meshes:stats.meshes};
  }
  active={id:null,name,tags:[],filename:file.name,createdAt:Date.now(),updatedAt:Date.now(),thumbnail:null,...record};
  dirty=true;syncInspector();
  status(isHTML
   ? (record.file?'HTML importado. GLB recuperado y disponible para optimizar.':'HTML importado para visualizar y guardar. Sin GLB extraíble, no se puede optimizar geometría.')
   : 'GLB importado. Revisa la ficha y pulsa Guardar objeto.');
  drawLibrary();
 }catch(e){status(file.name+': '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
function bytesToBase64(bytes){
 let data='';
 const block=0x4000;
 for(let i=0;i<bytes.length;i+=block)data+=String.fromCharCode.apply(null,bytes.subarray(i,i+block));
 return btoa(data);
}
async function base64ToBytes(encoded){
 const data=atob(encoded),array=new Uint8Array(data.length);
 for(let i=0;i<data.length;i++)array[i]=data.charCodeAt(i);
 return array;
}
async function compress(blob){
 const bytes=new Uint8Array(await blob.arrayBuffer());
 if(typeof CompressionStream==='undefined')return {data:bytesToBase64(bytes),compressed:false};
 const compressed=new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
 const packed=new Uint8Array(await new Response(compressed).arrayBuffer());
 return {data:bytesToBase64(packed),compressed:true};
}
async function makeHTML(blob,name){
 const packed=await compress(blob);
 const map='{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"}}';
 const out=[
 '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
 '<title>'+esc(name)+' · OcToS 3D Assets</title>',
 '<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#141922;color:#fff;font:13px system-ui}canvas{display:block;width:100%;height:100%}header{position:absolute;top:14px;left:16px;z-index:2;padding:9px 13px;background:#141922bd;border:1px solid #ffffff33;border-radius:9px}small{display:block;color:#b5c0cb;margin-top:4px}#state{position:absolute;bottom:14px;left:16px;color:#b7c3ce}button{position:absolute;right:16px;top:16px;z-index:2;background:#252e39;color:white;border:1px solid #627083;border-radius:7px;padding:9px 13px;cursor:pointer}</style>',
 '<script type="importmap">'+map+'</script></head><body>',
 '<header><b>'+esc(name)+'</b><small>OcToS 3D Assets · Visor 3D</small></header><button id="fit">Centrar</button><canvas id="view"></canvas><div id="state">Cargando modelo...</div>',
 '<script id="payload" type="text/plain" data-gzip="'+(packed.compressed?'1':'0')+'">'+packed.data+'</script>',
 '<script type="module">',
 'import * as THREE from "three";',
 'import {OrbitControls} from "three/addons/controls/OrbitControls.js";',
 'import {GLTFLoader} from "three/addons/loaders/GLTFLoader.js";',
 'import {DRACOLoader} from "three/addons/loaders/DRACOLoader.js";',
 'const canvas=document.getElementById("view"),state=document.getElementById("state");',
 'const renderer=new THREE.WebGLRenderer({canvas,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;',
 'const scene=new THREE.Scene();scene.background=new THREE.Color(0x18202b);const camera=new THREE.PerspectiveCamera(42,1,.001,50000);',
 'const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;scene.add(new THREE.HemisphereLight(0xffffff,0x445268,2.6));',
 'const a=new THREE.DirectionalLight(0xffffff,3.2);a.position.set(5,9,7);scene.add(a);const b=new THREE.DirectionalLight(0x8ca9ff,1.4);b.position.set(-6,2,-4);scene.add(b);',
 'function fit(obj){const box=new THREE.Box3().setFromObject(obj);const size=box.getSize(new THREE.Vector3());const center=box.getCenter(new THREE.Vector3());const d=Math.max(size.length(),.1)*1.15;controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(d*.8,d*.5,d));camera.near=Math.max(d/10000,.001);camera.far=Math.max(d*100,500);camera.updateProjectionMatrix();controls.update()}',
 'function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}window.addEventListener("resize",resize);resize();',
 'const clock=new THREE.Clock();let mixer=null;function loop(){requestAnimationFrame(loop);const dt=clock.getDelta();if(mixer)mixer.update(dt);controls.update();renderer.render(scene,camera)}loop();',
 'async function decode(){const node=document.getElementById("payload"),s=node.textContent.trim();const chars=atob(s),data=new Uint8Array(chars.length);for(let i=0;i<chars.length;i++)data[i]=chars.charCodeAt(i);if(node.dataset.gzip!=="1")return data.buffer;if(!("DecompressionStream" in window))throw Error("Este navegador no admite descompresión GZIP.");return await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer()}',
 'try{const decoder=new DRACOLoader();decoder.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/");const loader=new GLTFLoader();loader.setDRACOLoader(decoder);try{const m=await import("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/meshopt_decoder.module.js");if(m.MeshoptDecoder)loader.setMeshoptDecoder(m.MeshoptDecoder)}catch(e){}',
 'const obj=await loader.parseAsync(await decode(),"");scene.add(obj.scene);fit(obj.scene);document.getElementById("fit").onclick=()=>fit(obj.scene);if(obj.animations.length){mixer=new THREE.AnimationMixer(obj.scene);obj.animations.forEach(clip=>mixer.clipAction(clip).play())}state.textContent="Arrastrar: girar · Rueda: zoom";}catch(e){state.textContent="Error al abrir el modelo: "+e.message;console.error(e)}',
 '<\/script></body></html>'
 ];
 return new Blob([out.join('\n')],{type:'text/html;charset=utf-8'});
}
function download(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function capture(){
 if(!shown||$('canvas').hidden)return null;
 await new Promise(resolve=>requestAnimationFrame(resolve));
 try{
  renderer.render(scene,camera);
  const thumb=document.createElement('canvas');thumb.width=320;thumb.height=200;
  const ctx=thumb.getContext('2d');if(!ctx)return null;
  ctx.fillStyle='#19212b';ctx.fillRect(0,0,320,200);
  const factor=Math.min(320/canvas.width,200/canvas.height),w=canvas.width*factor,h=canvas.height*factor;
  ctx.drawImage(canvas,(320-w)/2,(200-h)/2,w,h);
  return thumb.toDataURL('image/webp',.78);
 }catch(e){return null}
}
async function save(){
 if(!active)return;
 setBusy(true);
 try{
  const html=active.html || (active.file?await makeHTML(active.file,active.name):null);
  if(!html)throw new Error('El objeto no contiene HTML para guardar.');
  const record={...active,id:active.id||uid(),name:$('modelName').value.trim()||active.name,tags:tagsFromInput(),updatedAt:Date.now(),html};
  if(record.file)record.thumbnail=await capture()||record.thumbnail;
  await put(record);active=record;dirty=false;
  await refresh();syncInspector();
  status('Objeto guardado en la biblioteca: '+record.name+'. HTML independiente generado.');
 }catch(e){status('No se pudo guardar: '+e.message+'. Comprueba el espacio disponible.',true)}
 finally{setBusy(false);updateButtons()}
}
async function exportHTML(){
 if(!active)return;setBusy(true);
 try{
  const record=active;
  const html=record.html || (record.file?await makeHTML(record.file,$('modelName').value.trim()||record.name):null);
  if(!html)throw new Error('No hay contenido HTML para exportar.');
  download(html,safeName(record.name)+'.html');
  status(record.sourceKind==='html'?'HTML original exportado.':'HTML exportado. Los motores 3D externos pueden requerir conexión.');
 }catch(e){status('Error al exportar: '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
async function optimize(){
 if(!active?.file)return;
 setBusy(true);status('Analizando geometría; el modelo original permanece guardado hasta confirmar.');
 try{
  const ratio=Number($('quality').value);
  const [core,ext,fn,meshopt]=await Promise.all([
   import('https://esm.sh/@gltf-transform/core@4.2.1'),
   import('https://esm.sh/@gltf-transform/extensions@4.2.1'),
   import('https://esm.sh/@gltf-transform/functions@4.2.1'),
   import('https://esm.sh/meshoptimizer@0.24.0')
  ]);
  const deps={'meshopt.decoder':meshopt.MeshoptDecoder,'meshopt.encoder':meshopt.MeshoptEncoder};
  await Promise.all([meshopt.MeshoptEncoder.ready,meshopt.MeshoptDecoder.ready,meshopt.MeshoptSimplifier.ready]);
  const io=new core.WebIO().registerExtensions(ext.KHRONOS_EXTENSIONS).registerDependencies(deps);
  const document=await io.readBinary(new Uint8Array(await active.file.arrayBuffer()));
  if(ratio===1)await document.transform(fn.dedup(),fn.prune());
  else await document.transform(fn.weld(),fn.simplify({simplifier:meshopt.MeshoptSimplifier,ratio,error:.002}),fn.dedup(),fn.prune());
  const output=await io.writeBinary(document);
  const optimized=new Blob([output],{type:'model/gltf-binary'});
  if(optimized.size>=active.file.size&&ratio===1){
   status('La geometría original ya estaba optimizada. No se han aplicado cambios.');
  }else{
   const old=active.file;
   const originalTriangles=$('triangles').textContent;
   try{
    const stats=await preview(optimized);
    active.file=optimized;active.triangles=stats.triangles;active.meshes=stats.meshes;active.html=null;active.sourceKind='glb';active.thumbnail=null;dirty=true;
    status('Optimización aplicada sin guardar. '+fmt(old.size)+' → '+fmt(optimized.size)+'; triángulos '+originalTriangles+' → '+integer(stats.triangles)+'.');
   }catch(e){await preview(old);throw new Error('Resultado incompatible, se conserva el original. '+e.message)}
  }
 }catch(e){status('No se pudo optimizar; se conserva el modelo actual. '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
async function remove(){
 if(active?.id)await removeLibraryModel({id:active.id,name:active.name});
}
async function backup(){
 setBusy(true);
 try{
  const records=await getAll(),out=[];
  for(const x of records){
   out.push({id:x.id,name:x.name,tags:x.tags,filename:x.filename,createdAt:x.createdAt,updatedAt:x.updatedAt,
    thumbnail:x.thumbnail,sourceKind:x.sourceKind||'glb',
    file:x.file?bytesToBase64(new Uint8Array(await x.file.arrayBuffer())):null,
    html:x.html && (x.sourceKind==='html'||x.sourceKind==='glb-html')
      ?bytesToBase64(new Uint8Array(await x.html.arrayBuffer())):null});
  }
  download(new Blob([JSON.stringify({format:'octos-3d-assets-backup',version:1,models:out})],{type:'application/json'}),'ocToS-3D-assets-backup.json');
  status('Copia de seguridad creada: '+records.length+' objetos.');
 }catch(e){status('Error al crear copia: '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
async function restore(file){
 setBusy(true);
 try{
  const obj=JSON.parse(await file.text());
  if(obj.format!=='octos-3d-assets-backup'||obj.version!==1||!Array.isArray(obj.models))throw new Error('Formato de copia no reconocido.');
  if(obj.models.length>300)throw new Error('La copia excede el límite de 300 objetos.');
  let count=0;
  for(const row of obj.models){
   if(row.file!=null&&(typeof row.file!=='string'||row.file.length>350000000))throw new Error('Modelo GLB inválido.');
   if(row.html!=null&&(typeof row.html!=='string'||row.html.length>350000000))throw new Error('HTML inválido.');
   let binary=null,html=null;
   if(row.file){
    const bytes=await base64ToBytes(row.file);validateGLB(bytes.buffer,bytes.byteLength);
    binary=new Blob([bytes],{type:'model/gltf-binary'});
   }
   if(row.html)html=new Blob([await base64ToBytes(row.html)],{type:'text/html;charset=utf-8'});
   if(!html && binary)html=await makeHTML(binary,String(row.name||'Modelo'));
   if(!html && !binary)throw new Error('Objeto sin archivo válido.');
   const name=String(row.name||'Modelo').slice(0,120);
   await put({id:uid(),name,tags:Array.isArray(row.tags)?row.tags.slice(0,30).map(String):[],
    filename:String(row.filename||name+(binary?'.glb':'.html')),sourceKind:row.sourceKind||(binary?'glb':'html'),
    file:binary,html,thumbnail:row.thumbnail||null,createdAt:Date.now(),updatedAt:Date.now()});
   count++;
  }
  await refresh();status('Copia restaurada: '+count+' objetos añadidos.');
 }catch(e){status('No se pudo restaurar la copia: '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
function resize(){
 const w=stage.clientWidth,h=stage.clientHeight;
 if(w<=0||h<=0)return;
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
const observer=new ResizeObserver(resize);observer.observe(stage);resize();
function animate(){
 requestAnimationFrame(animate);
 const delta=clock.getDelta();
 if(mixer)mixer.update(Math.min(delta,.08));
 controls.autoRotate=autoRotate;controls.update();
 renderer.render(scene,camera);
}
animate();
$('fit').addEventListener('click',centerView);
$('rotate').addEventListener('click',()=>{autoRotate=!autoRotate;$('rotate').textContent=autoRotate?'Detener':'Girar'});
$('file').addEventListener('change',e=>{importFiles(e.target.files);e.target.value=''});
$('import').addEventListener('click',()=>$('file').click());
$('search').addEventListener('input',drawLibrary);
$('tagFilter').addEventListener('change',drawLibrary);
$('modelName').addEventListener('input',markDirty);
$('modelTags').addEventListener('input',markDirty);
$('save').addEventListener('click',save);
$('export').addEventListener('click',exportHTML);
$('getGLB').addEventListener('click',()=>{if(active)download(active.file,safeName(active.name)+'.glb')});
$('optimize').addEventListener('click',optimize);
$('remove').addEventListener('click',remove);
$('backup').addEventListener('click',backup);
$('importBackup').addEventListener('click',()=>$('restoreFile').click());
$('restoreFile').addEventListener('change',e=>{if(e.target.files[0])restore(e.target.files[0]);e.target.value=''});
let dragDepth=0;
stage.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;$('drop').classList.add('show')});
stage.addEventListener('dragover',e=>e.preventDefault());
stage.addEventListener('dragleave',e=>{e.preventDefault();dragDepth=Math.max(0,dragDepth-1);if(!dragDepth)$('drop').classList.remove('show')});
stage.addEventListener('drop',e=>{e.preventDefault();dragDepth=0;$('drop').classList.remove('show');importFiles(e.dataTransfer.files)});
window.addEventListener('beforeunload',e=>{if(dirty&&active){e.preventDefault();e.returnValue=''}});
refresh().then(()=>status('Biblioteca local lista para importar GLB o HTML.')).catch(e=>status('IndexedDB no disponible: '+e.message,true));
