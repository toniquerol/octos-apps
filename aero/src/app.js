(()=>{'use strict';
const $=id=>document.getElementById(id), T=THREE, stage=$('stage');
let renderer;try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'default'});}catch(e){$('status').textContent='WebGL2 no disponible. Abre el archivo en Chrome o Edge con aceleración gráfica.';return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setClearColor(0x101820);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;stage.prepend(renderer.domElement);
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xd9eaff,0x46414b,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-3,7,4);scene.add(light);
const fill=new T.DirectionalLight(0x9acbde,1.4);fill.position.set(4,3,-5);scene.add(fill);
const vehicle=new T.Group();scene.add(vehicle);let flow=null,scenery=null;let content=null,paths=null,points=null,lineMesh=null,playing=true,clock=0,last=0,dirty=true,raf=0,loading=false,token=0;
let L=4.5,H=1.4,W=1.9,extent=8,triangles=0,TRACKS=0,STEPS=0;
let surface=null,pathData=null,focusFlow=null,retiredFocus=null,focusFade=0,retiredFade=0,activeCFD=null;
let generation=0,fieldRevision=0,buildPromise=Promise.resolve(),inspectionPoint=null,focusLocation=null;
const emitter={width:2.6,height:2.0}; // Independent of the CFD field's physical domain.
let cameras=[],views=[],orbit=[],frameCount=0,fpsTime=0;
const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0x171d25,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;scene.add(ground);
const grid=new T.GridHelper(20,40,0x3c505c,0x23323e);grid.position.y=-.015;scene.add(grid);
const arrow=new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(-6,.06,-2.4),2,0xff6a1a,.3,.17);scene.add(arrow);
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function wake(){dirty=true;if(!raf)raf=requestAnimationFrame(tick);}
function dispose(obj){const gs=new Set(),ms=new Set(),ts=new Set();obj.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>{t.dispose();if(t.source?.data?.close)t.source.data.close();});}
function demo(){const g=new T.Group(),mat=new T.MeshStandardMaterial({color:0xaeb8c3,metalness:.65,roughness:.3}),glass=new T.MeshStandardMaterial({color:0x253d50,metalness:.5,roughness:.2});
const shape=new T.Shape();shape.moveTo(-2.25,.28);shape.lineTo(-2.2,.65);shape.lineTo(-1.2,.83);shape.lineTo(-.55,1.32);shape.lineTo(.65,1.38);shape.lineTo(1.35,.9);shape.lineTo(2.2,.78);shape.lineTo(2.25,.32);shape.closePath();
const geom=new T.ExtrudeGeometry(shape,{depth:1.62,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.07,bevelThickness:.08});geom.translate(0,0,-.81);g.add(new T.Mesh(geom,mat));
for(const z of [-.9,.9]){const win=new T.Mesh(new T.BoxGeometry(1.1,.38,.02),glass);win.position.set(.02,1.1,z*.96);g.add(win);for(const x of [-1.42,1.45]){const wheel=new T.Mesh(new T.CylinderGeometry(.34,.34,.22,24),new T.MeshStandardMaterial({color:0x16171b,roughness:.95}));wheel.rotation.x=Math.PI/2;wheel.position.set(x,.34,z);g.add(wheel);const hub=new T.Mesh(new T.CylinderGeometry(.18,.18,.23,16),mat);hub.rotation.x=Math.PI/2;hub.position.copy(wheel.position);g.add(hub);}}
return g;}
function normalize(){vehicle.position.set(0,0,0);vehicle.updateMatrixWorld(true);let b=new T.Box3().setFromObject(vehicle);if(b.isEmpty())throw Error('No hay geometría visible.');const center=b.getCenter(new T.Vector3());vehicle.position.set(-center.x,-b.min.y,-center.z);vehicle.updateMatrixWorld(true);b=new T.Box3().setFromObject(vehicle);const s=b.getSize(new T.Vector3());L=s.x;H=s.y;W=s.z;if(!Number.isFinite(L+H+W)||Math.min(L,H,W)<1e-7)throw Error('Dimensiones no válidas.');extent=Math.max(L*1.65,H*2,W*2);ground.scale.set(extent*2,extent*1.3,1);grid.scale.setScalar(extent/10);arrow.position.set(-extent*.85,.06,-W*.9);arrow.setLength(L*.5,L*.08,L*.04);$('length').value=L.toFixed(2);$('dimensions').textContent=`${L.toFixed(2)} × ${H.toFixed(2)} × ${W.toFixed(2)} m`;}
function releaseFocus(){
  for(const extra of [focusFlow,retiredFocus])if(extra){scene.remove(extra.group);extra.dispose();}
  focusFlow=retiredFocus=null;focusFade=retiredFade=0;focusLocation=null;
}
function clearInspection(){inspectionPoint=null;releaseFocus();if(focusMarker)focusMarker.visible=false;wake();}
function focusSelection(point){
  const scores=[];
  for(let track=0;track<TRACKS;track++){
    let best=Infinity;
    for(let s=0;s<STEPS;s+=3){
      const k=(track*STEPS+s)*3,dx=paths[k]-point.x,dy=paths[k+1]-point.y,dz=paths[k+2]-point.z;
      const d=dx*dx+dy*dy+dz*dz;if(d<best)best=d;
    }
    scores.push([best,track]);
  }
  scores.sort((a,b)=>a[0]-b[0]);
  return scores.slice(0,Math.max(12,Math.ceil(TRACKS*.15))).map(x=>x[1]);
}
function updateFocus(force=false,i=0){
  if(!flow||!paths||loading||!orbit.length)return;
  const view=orbit[i]||orbit[0],close=view.r<extent*.76||view.zoom>1.8;
  if(!inspectionPoint&&!close){
    if(focusFlow){if(retiredFocus){scene.remove(retiredFocus.group);retiredFocus.dispose();}
      retiredFocus=focusFlow;retiredFade=focusFade;focusFlow=null;focusFade=0;focusLocation=null;wake();}
    return;
  }
  const target=inspectionPoint||view.target;
  if(!force&&focusFlow&&focusLocation&&focusLocation.distanceTo(target)<Math.max(L*.12,.08))return;
  if(retiredFocus){scene.remove(retiredFocus.group);retiredFocus.dispose();retiredFocus=null;}
  retiredFocus=focusFlow;retiredFade=focusFade;
  const selected=focusSelection(target);
  focusFlow=AeroFlow.create(paths,TRACKS,STEPS,Math.max(400,Math.floor(+$('quality').value*.45)),L,renderer.getPixelRatio(),selected,pathData?.speeds);
  scene.add(focusFlow.group);focusFade=0;focusLocation=target.clone();
  configureFlow();wake();
}
function setParticles(){
  if(flow){scene.remove(flow.group);flow.dispose();}
  releaseFocus();
  flow=AeroFlow.create(paths,TRACKS,STEPS,+$('quality').value,L,renderer.getPixelRatio(),null,pathData?.speeds);
  points=flow.points;scene.add(flow.group);configureFlow();updateParticles();updateFocus(true);wake();
}
function configureFlow(){
  if(!flow)return;
  const cfg={size:+$('pointsize').value,trailLength:+$('trail').value*.025,
    opacity:+$('opacity').value,color:$('palette').value,mode:$('flowmode').value};
  flow.configure(cfg);
  if(focusFlow)focusFlow.configure({...cfg,opacity:cfg.opacity*focusFade*.75});
  if(retiredFocus)retiredFocus.configure({...cfg,opacity:cfg.opacity*retiredFade*.75});
  $('particlecount').textContent=flow.count.toLocaleString('es')+' TRAZADORES · '+TRACKS+' TRAYECTORIAS';
  $('speedlegend').style.display=cfg.color==='velocity'?'flex':'none';
  $('speedlabel').textContent=pathData?.physical&&activeCFD?'0 – '+activeCFD.displayMaxSpeed.toFixed(1)+' m/s':'VELOCIDAD RELATIVA · NO CFD';
  wake();
}
function updateParticles(){if(flow)flow.setTime(clock);if(focusFlow)focusFlow.setTime(clock);if(retiredFocus)retiredFocus.setTime(clock);}
function installPathGuides(){
  if(lineMesh){scene.remove(lineMesh);dispose(lineMesh);}
  const lines=[];
  for(let p=0;p<TRACKS;p+=15)for(let s=1;s<STEPS;s++){
    const k=(p*STEPS+s)*3;lines.push(...paths.subarray(k-3,k+3));
  }
  lineMesh=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(lines,3)),
    new T.LineBasicMaterial({color:0x7fbcc4,transparent:true,opacity:.065,depthWrite:false}));
  lineMesh.visible=$('lines').checked;scene.add(lineMesh);
}
function buildScenery(){
  if(scenery){scene.remove(scenery);dispose(scenery);}scenery=new T.Group();
  const halfZ=Math.max(W*1.65,L*.55),top=H*2.2,halfX=extent*.96;
  const segments=[];const edge=(a,b)=>segments.push(...a,...b);
  for(const z of [-halfZ,halfZ]){edge([-halfX,.02,z],[halfX,.02,z]);edge([-halfX,top,z],[halfX,top,z]);for(const x of [-halfX,halfX])edge([x,.02,z],[x,top,z]);}
  for(const x of [-halfX,halfX]){edge([x,top,-halfZ],[x,top,halfZ]);edge([x,.02,-halfZ],[x,.02,halfZ]);}
  const frame=new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(segments,3)),new T.LineBasicMaterial({color:0x4e7182,transparent:true,opacity:.28}));scenery.add(frame);
  const ticks=[];for(let i=-6;i<=6;i++){const x=i*L/4;ticks.push(x,.025,-halfZ,x,.025,-halfZ-L*.025);}
  scenery.add(new T.LineSegments(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(ticks,3)),new T.LineBasicMaterial({color:0x90a3ad,transparent:true,opacity:.4})));
  const pad=new T.Mesh(new T.BoxGeometry(L*1.15,.035,W*1.35),new T.MeshStandardMaterial({color:0x202e38,roughness:.85,metalness:.15}));pad.position.y=-.02;scenery.add(pad);
  scenery.visible=$('tunnel').checked;scene.add(scenery);
}
async function performRebuild(geometry=true,reframe=true){
  const seq=++generation;
  loading=true;status(geometry?'Analizando triángulos del modelo…':'Refinando trayectorias…');
  let nextSurface=null;
  try{
    if(geometry||!surface){normalize();geometry=true;nextSurface=await AeroGeometry.fromObject(vehicle,()=>seq===generation);}
    else nextSurface=surface;
    if(!nextSurface||seq!==generation){if(nextSurface&&nextSurface!==surface)nextSurface.dispose();return;}
    const options={L,H,W,extent,precision:$('precision').value,focus:$('focus').value,
      emitterWidth:emitter.width,emitterHeight:emitter.height};
    const result=activeCFD?
      await AeroCFD.build(activeCFD,nextSurface,options,()=>seq===generation):
      await AeroPaths.build(nextSurface,options,()=>seq===generation);
    if(!result||seq!==generation){if(nextSurface!==surface)nextSurface.dispose();return;}
    if(nextSurface!==surface){if(surface)surface.dispose();surface=nextSurface;}
    pathData=result;paths=result.paths;TRACKS=result.tracks;STEPS=result.steps;triangles=surface.triangles;fieldRevision++;
    releaseFocus();installPathGuides();setParticles();if(geometry)buildScenery();if(reframe)resetCameras();
    const warning=surface.openEdges===null?'topología no verificada':surface.openEdges?'malla con '+surface.openEdges+' bordes abiertos':'malla sin bordes abiertos detectados';
    $('badge').textContent=result.physical?'TRAYECTORIAS SOBRE CAMPO CFD IMPORTADO · '+activeCFD.source:'ESTELA CINEMÁTICA ILUSTRATIVA · NO CFD';
    $('flowlegend').querySelector('b').textContent=result.physical?'FLUJO / CFD':'FLUJO / VISUAL';
    $('fieldinfo').textContent=result.physical?activeCFD.source+' · 0–'+activeCFD.displayMaxSpeed.toFixed(1)+' m/s · '+activeCFD.dims.join(' × ')+' nodos':'Sin campo CFD importado. Vórtices y velocidad cromática ilustrativos.';
    status(triangles.toLocaleString('es')+' triángulos · '+TRACKS+' rutas / '+STEPS+' muestras · '+warning+
      (result.repaired||result.stalled?' · '+result.repaired+' rutas corregidas, '+result.stalled+' detenidas':'')+
      (result.physical?' · CFD externo importado (sin validar)':' · visualización, no CFD'));
  }catch(e){if(seq===generation)status('Error de geometría: '+e.message,true);}
  finally{if(seq===generation){loading=false;wake();}}
}
function rebuild(geometry=true,reframe=true){buildPromise=performRebuild(geometry,reframe);return buildPromise;}
function resetField(){
  activeCFD=null;
  $('fieldinfo').textContent='Sin campo CFD importado. Vórtices y velocidad cromática ilustrativos.';
}
function install(obj,name,yaw=0){
  generation++;releaseFocus();resetField();
  if(content){vehicle.remove(content);dispose(content);}
  vehicle.rotation.set(0,yaw,0);vehicle.scale.setScalar(1);
  content=obj;vehicle.add(obj);vehicle.visible=$('body').checked;
  $('filename').textContent=name;clock=0;inspectionPoint=null;focusMarker.visible=false;
  return rebuild(true,true);
}
function resetCameras(){
  orbit=views.map(()=>({theta:2.35,phi:1.13,r:extent*1.12,zoom:1,target:new T.Vector3(0,H*.55,0)}));
  if(focusFlow)releaseFocus();wake();
}
function layout(){const count=+$('layout').value;$('panels').innerHTML='';$('panels').style.gridTemplateColumns=count===1?'1fr':'1fr 1fr';$('panels').style.gridTemplateRows=count===4?'1fr 1fr':'1fr';views=[];cameras=[];for(let i=0;i<count;i++){const div=document.createElement('div');div.className='view';div.innerHTML=`<select aria-label="Cámara ${i+1}"><option value="3d">Perspectiva 3D</option><option value="side">Lateral</option><option value="top">Superior</option><option value="front">Frontal</option></select><small>0${i+1} / VISTA</small>`;$('panels').append(div);div.querySelector('select').value=['3d','side','top','front'][i];div.querySelector('select').onchange=wake;views.push(div);cameras.push({persp:new T.PerspectiveCamera(42,1,.01,10000),ortho:new T.OrthographicCamera(-1,1,1,-1,.01,10000)});}resetCameras();}
function render(){
  const width=stage.clientWidth,height=stage.clientHeight;
  if(renderer.domElement.width!==Math.round(width*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(height*renderer.getPixelRatio()))renderer.setSize(width,height,false);
  renderer.setScissorTest(true);const sr=stage.getBoundingClientRect();
  views.forEach((v,i)=>{
    const rect=v.getBoundingClientRect(),x=rect.left-sr.left,y=height-(rect.bottom-sr.top);
    const aspect=rect.width/Math.max(rect.height,1),type=v.querySelector('select').value,o=orbit[i],target=o.target;
    let cam;
    if(type==='3d'){
      cam=cameras[i].persp;cam.aspect=aspect;
      cam.position.set(target.x+Math.cos(o.theta)*Math.sin(o.phi)*o.r,
        target.y+Math.cos(o.phi)*o.r,target.z+Math.sin(o.theta)*Math.sin(o.phi)*o.r);
      cam.up.set(0,1,0);
    }else{
      cam=cameras[i].ortho;const size=extent*.58/o.zoom;
      cam.left=-size*aspect;cam.right=size*aspect;cam.top=size;cam.bottom=-size;cam.up.set(0,1,0);
      if(type==='side')cam.position.set(target.x,target.y,target.z+extent*3);
      if(type==='front')cam.position.set(target.x-extent*3,target.y,target.z);
      if(type==='top'){cam.position.set(target.x,target.y+extent*3,target.z);cam.up.set(1,0,0);}
    }
    cam.lookAt(target);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
    renderer.setViewport(x,y,rect.width,rect.height);renderer.setScissor(x,y,rect.width,rect.height);renderer.render(scene,cam);
  });dirty=false;
}
const focusMarker=new T.Mesh(new T.SphereGeometry(.032,10,8),new T.MeshBasicMaterial({color:0xff6a1a,depthTest:false}));
focusMarker.visible=false;scene.add(focusMarker);
function tick(t){
  raf=0;const dt=last?Math.min((t-last)/1000,.04):0;last=t;
  if(document.hidden){last=0;return;}
  if(playing&&!loading){clock+=dt*+$('speed').value;updateParticles();dirty=true;}
  if(focusFlow&&focusFade<1){focusFade=Math.min(1,focusFade+dt*4);focusFlow.uniforms.opacity.value=+$('opacity').value*.75*focusFade;dirty=true;}
  if(retiredFocus){retiredFade=Math.max(0,retiredFade-dt*4);retiredFocus.uniforms.opacity.value=+$('opacity').value*.75*retiredFade;
    dirty=true;if(retiredFade===0){scene.remove(retiredFocus.group);retiredFocus.dispose();retiredFocus=null;}}
  if(dirty)render();
  frameCount++;if(t-fpsTime>1000){$('fps').textContent=playing?Math.round(frameCount*1000/(t-fpsTime))+' FPS':'PAUSA';frameCount=0;fpsTime=t;}
  if(playing||focusFlow&&focusFade<1||retiredFocus)raf=requestAnimationFrame(tick);
}
let drag=null;
function viewAt(e){return views.findIndex(v=>{const r=v.getBoundingClientRect();return e.clientX>=r.left&&e.clientX<r.right&&e.clientY>=r.top&&e.clientY<r.bottom;});}
renderer.domElement.addEventListener('pointerdown',e=>{const i=viewAt(e);if(i<0)return;
  drag={i,x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2||views[i].querySelector('select').value!=='3d'};
  renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointermove',e=>{if(!drag)return;
  const o=orbit[drag.i],dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(drag.pan||e.shiftKey){
    const type=views[drag.i].querySelector('select').value,cam=cameras[drag.i][type==='3d'?'persp':'ortho'];
    const right=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,0);
    const up=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,1);
    const unit=type==='3d'?o.r/500:extent/(Math.max(o.zoom,.1)*300);
    o.target.addScaledVector(right,-dx*unit).addScaledVector(up,dy*unit);
  }else{
    o.theta+=dx*.008;o.phi=T.MathUtils.clamp(o.phi+dy*.008,.08,Math.PI*.94);
  }
  drag.x=e.clientX;drag.y=e.clientY;wake();
});
renderer.domElement.addEventListener('pointerup',()=>{if(drag)updateFocus(false,drag.i);drag=null;});
renderer.domElement.addEventListener('pointercancel',()=>drag=null);
renderer.domElement.addEventListener('wheel',e=>{
  e.preventDefault();const i=viewAt(e);if(i<0)return;
  const factor=Math.exp(e.deltaY*.001),o=orbit[i];
  o.r=T.MathUtils.clamp(o.r*factor,L*.025,extent*8);
  o.zoom=T.MathUtils.clamp(o.zoom/factor,.15,48);
  updateFocus(false,i);wake();
},{passive:false});
renderer.domElement.addEventListener('dblclick',e=>{
  const i=viewAt(e);if(i<0||!content)return;
  render();const bounds=views[i].getBoundingClientRect(),type=views[i].querySelector('select').value;
  const cam=cameras[i][type==='3d'?'persp':'ortho'],ray=new T.Raycaster();
  ray.setFromCamera({x:(e.clientX-bounds.left)/bounds.width*2-1,y:-(e.clientY-bounds.top)/bounds.height*2+1},cam);
  const hits=ray.intersectObject(content,true);if(!hits.length)return;
  inspectionPoint=hits[0].point.clone();
  orbit[i].target.copy(inspectionPoint);
  focusMarker.position.copy(inspectionPoint);focusMarker.scale.setScalar(Math.max(L*.35,.1));focusMarker.visible=true;
  updateFocus(true,i);wake();
});
$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Ⅱ Pausar':'▶ Reproducir';$('fps').textContent=playing?'— FPS':'PAUSA';last=0;wake();};
$('reset').onclick=()=>{clock=0;updateParticles();wake();};
$('quality').onchange=setParticles;
$('precision').onchange=()=>rebuild(false,false);
// Change only the particle-seeding rectangle; preserve imported CFD grid and camera state.
function changeEmitter(){
  const width=Number($('emitterWidth').value),height=Number($('emitterHeight').value);
  if(!Number.isFinite(width)||!Number.isFinite(height)||
      width<.2||height<.2||width>20||height>20){
    $('emitterWidth').value=emitter.width.toFixed(1);
    $('emitterHeight').value=emitter.height.toFixed(1);
    status('El plano emisor debe medir entre 0,2 y 20 m de ancho y alto.',true);
    return;
  }
  if(width===emitter.width&&height===emitter.height)return;
  emitter.width=width;emitter.height=height;
  $('emitterWidth').value=width.toFixed(1);
  $('emitterHeight').value=height.toFixed(1);
  rebuild(false,false);
}
$('emitterWidth').onchange=changeEmitter;
$('emitterHeight').onchange=changeEmitter;
for(const id of ['pointsize','trail','opacity','palette','flowmode'])$(id).oninput=configureFlow;
$('focus').onchange=()=>rebuild(false,false);
$('tunnel').onchange=()=>{scenery.visible=$('tunnel').checked;wake();};
$('speed').oninput=()=>{$('speedval').textContent=$('speed').value+'×';};
$('layout').onchange=layout;
$('frame').onclick=()=>{resetCameras();clearInspection();};
$('clearFocus').onclick=clearInspection;
$('lines').onchange=()=>{if(lineMesh)lineMesh.visible=$('lines').checked;wake();};
$('body').onchange=()=>{vehicle.visible=$('body').checked;wake();};
$('grid').onchange=()=>{grid.visible=$('grid').checked;wake();};
$('scale').onclick=()=>{const v=+$('length').value;if(!Number.isFinite(v)||v<.1||v>100){status('Introduce una longitud entre 0,1 y 100 metros.',true);return;}vehicle.scale.multiplyScalar(v/L);resetField();rebuild(true,true);};
document.querySelectorAll('[data-axis]').forEach(b=>b.onclick=()=>{vehicle.rotation[b.dataset.axis]+=Math.PI/2;resetField();rebuild(true,true);});
$('demo').onclick=()=>{token++;loading=false;install(demo(),'Concepto de demostración');};
$('clearCFD').onclick=()=>{resetField();rebuild(false,false);};
$('cfdfile').onchange=async e=>{
  const f=e.target.files[0];if(!f)return;
  const requested=++token,previous=activeCFD;
  try{
    if(f.size>110*1024*1024)throw Error('El archivo supera el máximo de 110 MB.');
    status('Leyendo campo de velocidades CFD…');
    const field=AeroCFD.parse(await f.text());
    if(requested!==token)return;
    activeCFD=field;
    $('palette').value='velocity';
    await rebuild(false,false);
    if(requested!==token)return;
    if(!pathData?.physical)throw Error('El campo no pudo generar trayectorias.');
  }catch(err){
    if(requested===token){
      activeCFD=previous;
      await rebuild(false,false);
      status('Error al importar CFD: '+err.message,true);
    }
  }finally{e.target.value='';}
};
// Validate embedded-only GLB before parsing; external network URLs are rejected.
function validateGLB(buffer){const v=new DataView(buffer);if(v.byteLength<20||v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==v.byteLength)throw Error('No es un GLB 2.0 válido.');let json;for(let p=12;p+8<=v.byteLength;){const n=v.getUint32(p,true),type=v.getUint32(p+4,true);if(p+8+n>v.byteLength)throw Error('GLB incompleto.');if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,p+8,n)));p+=8+n;}if(!json)throw Error('Falta la descripción del modelo.');for(const item of [...json.buffers||[],...json.images||[]])if(item.uri&&!item.uri.startsWith('data:'))throw Error('El GLB contiene recursos externos. Exporta con todo incrustado.');for(const x of json.extensionsUsed||[])if(/draco|meshopt|basisu/i.test(x))throw Error('Exporta sin compresión DRACO, Meshopt o KTX2 para este prototipo.');if(json.skins?.length||json.nodes?.some(n=>n.extensions?.EXT_mesh_gpu_instancing))throw Error('Exporta una malla estática sin esqueletos ni instancias GPU.');}
// The imported model can be kept locally and restored on the next visit.
function modelDB(){return new Promise((resolve,reject)=>{if(typeof indexedDB==='undefined'){resolve(null);return;}const r=indexedDB.open('octos-aero-model',1);r.onupgradeneeded=()=>r.result.createObjectStore('vehicles');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error||Error('No se puede abrir el almacén local.'));r.onblocked=()=>reject(Error('Almacén local bloqueado.'));});}
async function readDefault(){const db=await modelDB();if(!db)return null;return new Promise((resolve,reject)=>{const t=db.transaction('vehicles','readonly'),r=t.objectStore('vehicles').get('default');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);t.oncomplete=()=>db.close();t.onerror=()=>{db.close();reject(t.error);};});}
async function saveDefault(buffer,name,yaw){const db=await modelDB();if(!db)return false;return new Promise((resolve,reject)=>{const t=db.transaction('vehicles','readwrite');t.objectStore('vehicles').put({buffer,name,yaw},'default');t.oncomplete=()=>{db.close();resolve(true);};t.onerror=()=>{db.close();reject(t.error);};});}
async function parseVehicle(buffer){validateGLB(buffer);const manager=new T.LoadingManager();manager.setURLModifier(u=>{if(!/^(blob:|data:)/.test(u))throw Error('Recurso externo bloqueado.');return u;});const gltf=await new LOADERS.GLTFLoader(manager).parseAsync(buffer,'');const box=new T.Box3().setFromObject(gltf.scene),sz=box.getSize(new T.Vector3());if(box.isEmpty()||!Number.isFinite(sz.x+sz.y+sz.z)||Math.min(sz.x,sz.y,sz.z)<=0){dispose(gltf.scene);throw Error('El modelo no contiene un volumen válido.');}return gltf.scene;}
async function restoreDefault(){const t=token;let saved=null;try{saved=await readDefault();}catch(e){/* Private-mode storage may be unavailable. */}if(t!==token)return;
if(!saved&&window.location&&/^https?:$/.test(window.location.protocol)){try{const r=await fetch('models/bmw-e46-touring.glb');if(r.ok)saved={buffer:await r.arrayBuffer(),name:'BMW 3 Series Touring (E46) 2001',yaw:Math.PI};}catch(e){/* Optional hosted GLB is absent or offline. */}}
if(t!==token)return;if(!saved){status('Demo activa · Importa el GLB BMW E46 una vez para establecer el modelo predeterminado.');return;}
loading=true;status('Cargando vehículo predeterminado…');try{const model=await parseVehicle(saved.buffer);if(t!==token){dispose(model);return;}await install(model,saved.name,saved.yaw||0);status('Modelo predeterminado cargado · orientación aplicada.');}catch(e){if(t===token)status('No se pudo cargar el modelo predeterminado: '+e.message,true);}finally{if(t===token)loading=false;wake();}}
$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;const t=++token;loading=true;status('Leyendo GLB local…');await new Promise(r=>setTimeout(r,30));try{const buf=await f.arrayBuffer(),model=await parseVehicle(buf);if(t!==token){dispose(model);return;}const yaw=$('presetBMW').checked?Math.PI:0;await install(model,f.name,yaw);status('GLB cargado · comprueba la longitud real.');try{const saved=await saveDefault(buf,f.name,yaw);if(t===token)status(saved?'GLB cargado y guardado como predeterminado · orientación aplicada.':'GLB cargado · no se pudo guardar en este navegador.');}catch(e){if(t===token)status('GLB cargado · no se pudo guardar para futuros accesos.',true);}}catch(err){if(t===token)status('No se pudo cargar: '+err.message,true);}finally{if(t===token)loading=false;e.target.value='';wake();}};
new ResizeObserver(wake).observe(stage);document.addEventListener('visibilitychange',()=>{last=0;if(!document.hidden)wake();});renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();playing=false;status('Contexto gráfico perdido. Recarga el archivo.',true);});
layout();install(demo(),'Concepto de demostración');restoreDefault();
window.aeroReady=()=>buildPromise;
window.aeroDiagnostics=()=>({triangles,particles:points?.geometry.attributes.position.count||0,views:views.length,playing,
  dimensions:[L,H,W],emitter:[emitter.width,emitter.height],tracks:TRACKS,steps:STEPS,fieldRevision,precision:pathData?.precision||null,
  rawSamples:pathData?.rawSamples||0,repaired:pathData?.repaired||0,stalled:pathData?.stalled||0,
  openEdges:surface?.openEdges??null,gpuAnimation:true,focused:!!focusFlow,cfd:!!pathData?.physical,cfdSource:activeCFD?.source||null,
  trailVertices:flow?.trails.geometry.attributes.position.count||0,particleSize:flow?.uniforms.size.value||0,
  externalResources:performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)).length,vehicleYaw:vehicle.rotation.y});
})();
