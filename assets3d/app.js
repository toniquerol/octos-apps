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
function setBusy(value){busy=value;for(const id of ['save','export','getGLB','remove','optimize','import']){const el=$(id);el.disabled=value||(!active&&id!=='import')} $('renderStatus').textContent=value?'Procesando…':'Listo'}
function updateButtons(){if(!busy){for(const id of ['save','export','getGLB','remove','optimize'])$(id).disabled=!active;$('import').disabled=false}}
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
  if(!meshoptPromise)meshoptPromise=import('https://cdn.jsdelivr.net/npm/meshoptimizer@0.24.0/meshopt_decoder.module.js');
  const module=await meshoptPromise;
  if(module.MeshoptDecoder)loader.setMeshoptDecoder(module.MeshoptDecoder);
 }catch(e){/* Los GLB sin meshopt siguen siendo compatibles. */}
 return loader;
}
function clearModel(){
 if(shown){scene.remove(shown);shown=null}
 mixer=null;
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
 clearModel();
 shown=gltf.scene;scene.add(shown);
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
async function choose(model){
 if(busy)return;
 setBusy(true);
 try{
  const item=await getOne(model.id);
  if(!item)throw new Error('No se encuentra el modelo guardado.');
  await preview(item.file);
  active=item;dirty=false;
  syncInspector();
  status('Modelo cargado desde la biblioteca.');
  drawLibrary();
 }catch(e){status('No se pudo abrir el modelo: '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
function syncInspector(){
 $('modelName').value=active?active.name:'';
 $('modelTags').value=active?(active.tags||[]).join(', '):'';
 $('stageTitle').textContent=active?active.name:'Visor 3D · Sin modelo';
 $('origin').textContent=active?(active.id?'Biblioteca local':'Nuevo modelo'):'—';
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
  const button=document.createElement('button');button.className='asset'+(active&&active.id===model.id?' active':'');
  const img=document.createElement('img');img.className='thumb';img.alt='';img.src=model.thumbnail||'./icon.svg';
  const body=document.createElement('span'),title=document.createElement('span'),sub=document.createElement('span'),chips=document.createElement('span');
  title.className='asset-title';title.textContent=model.name;
  sub.className='asset-sub';sub.textContent=fmt(model.size)+' · '+new Date(model.updated).toLocaleDateString('es-ES');
  chips.className='chips';
  (model.tags||[]).slice(0,3).forEach(label=>{const c=document.createElement('span');c.className='chip';c.textContent=label;chips.append(c)});
  body.append(title,sub,chips);button.append(img,body);
  button.addEventListener('click',()=>choose(model));
  root.append(button);
 }
}
async function refresh(){
 const all=await getAll();
 models=all.map(m=>({id:m.id,name:m.name,tags:m.tags,size:m.file.size,thumbnail:m.thumbnail,updated:m.updatedAt}));
 const tags=[...new Set(models.flatMap(m=>m.tags||[]))].sort((a,b)=>a.localeCompare(b,'es'));
 const selected=$('tagFilter').value,sel=$('tagFilter');
 sel.replaceChildren(new Option('Todas las etiquetas',''));
 tags.forEach(t=>sel.add(new Option(t,t)));
 if(tags.includes(selected))sel.value=selected;
 drawLibrary();
}
async function importFiles(files){
 const items=[...files].filter(f=>/\.glb$/i.test(f.name));
 if(!items.length){status('Formato admitido: .GLB. GML es un formato distinto.',true);return}
 for(const file of items){
  if(file.size>250*1048576){status(file.name+': límite de importación de 250 MB.',true);continue}
  setBusy(true);
  try{
   const result=await preview(file);
   active={id:null,name:file.name.replace(/\.glb$/i,''),tags:[],file:new Blob([file],{type:'model/gltf-binary'}),filename:file.name,createdAt:Date.now(),updatedAt:Date.now(),thumbnail:null,triangles:result.triangles,meshes:result.meshes,html:null};
   dirty=true;syncInspector();
   status('Importado '+file.name+'. Revisa la ficha y pulsa Guardar objeto.');
  }catch(e){status(file.name+': '+e.message,true)}
  finally{setBusy(false);updateButtons()}
 }
 drawLibrary();
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
 'try{const decoder=new DRACOLoader();decoder.setDecoderPath("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/");const loader=new GLTFLoader();loader.setDRACOLoader(decoder);try{const m=await import("https://cdn.jsdelivr.net/npm/meshoptimizer@0.24.0/meshopt_decoder.module.js");if(m.MeshoptDecoder)loader.setMeshoptDecoder(m.MeshoptDecoder)}catch(e){}',
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
 await new Promise(resolve=>requestAnimationFrame(resolve));
 try{return canvas.toDataURL('image/webp',.78)}catch(e){return null}
}
async function save(){
 if(!active)return;
 setBusy(true);
 try{
  const html=await makeHTML(active.file,active.name);
  const record={...active,id:active.id||uid(),name:$('modelName').value.trim()||active.name,tags:tagsFromInput(),updatedAt:Date.now(),html};
  if(!record.thumbnail)record.thumbnail=await capture();
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
  const html=!dirty&&record.html?record.html:await makeHTML(record.file,$('modelName').value.trim()||record.name);
  download(html,safeName(record.name)+'.html');
  status('HTML generado. Contiene el modelo integrado; necesita conexión para Three.js.');
 }catch(e){status('Error al exportar: '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
async function optimize(){
 if(!active)return;
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
    active.file=optimized;active.triangles=stats.triangles;active.meshes=stats.meshes;active.html=null;active.thumbnail=null;dirty=true;
    status('Optimización aplicada sin guardar. '+fmt(old.size)+' → '+fmt(optimized.size)+'; triángulos '+originalTriangles+' → '+integer(stats.triangles)+'.');
   }catch(e){await preview(old);throw new Error('Resultado incompatible, se conserva el original. '+e.message)}
  }
 }catch(e){status('No se pudo optimizar; se conserva el modelo actual. '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
async function remove(){
 if(!active||!active.id)return;
 if(!confirm('¿Eliminar "'+active.name+'" de la biblioteca local?'))return;
 setBusy(true);
 try{
  await del(active.id);active=null;clearModel();$('emptyStage').hidden=false;
  $('triangles').textContent='—';$('meshes').textContent='—';$('size').textContent='—';
  syncInspector();await refresh();status('Modelo eliminado de la biblioteca.');
 }catch(e){status('Error al eliminar: '+e.message,true)}
 finally{setBusy(false);updateButtons()}
}
async function backup(){
 setBusy(true);
 try{
  const records=await getAll();
  const out=[];
  for(const x of records){
   out.push({id:x.id,name:x.name,tags:x.tags,filename:x.filename,createdAt:x.createdAt,updatedAt:x.updatedAt,thumbnail:x.thumbnail,
    file:bytesToBase64(new Uint8Array(await x.file.arrayBuffer()))});
  }
  const blob=new Blob([JSON.stringify({format:'octos-3d-assets-backup',version:1,models:out})],{type:'application/json'});
  download(blob,'ocToS-3D-assets-backup.json');
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
   if(typeof row.file!=='string'||row.file.length>350000000)throw new Error('Modelo inválido o demasiado grande.');
   const bytes=await base64ToBytes(row.file);validateGLB(bytes.buffer,bytes.byteLength);
   const binary=new Blob([bytes],{type:'model/gltf-binary'});
   const name=String(row.name||'Modelo').slice(0,120);
   const html=await makeHTML(binary,name);
   await put({id:uid(),name,tags:Array.isArray(row.tags)?row.tags.slice(0,30).map(String):[],filename:String(row.filename||name+'.glb'),
    file:binary,html,thumbnail:row.thumbnail||null,createdAt:Date.now(),updatedAt:Date.now()});
   count++;
  }
  await refresh();
  status('Copia restaurada: '+count+' modelos añadidos.');
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
refresh().then(()=>status('Biblioteca local lista para importar GLB.')).catch(e=>status('IndexedDB no disponible: '+e.message,true));
