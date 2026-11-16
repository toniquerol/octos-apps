(()=>{'use strict';
const $=id=>document.getElementById(id), T=THREE, stage=$('stage');
// Relocate the existing controls into their floating docks without duplicating IDs or handlers.
$('vehicleDockBody').append($('vehiclePanelContent'));
$('flowDockBody').append($('cfdPanelContent'));
$('flowDockBody').append($('flowPanelContent'));
$('viewDockBody').append($('viewPanelContent'));
let renderer;try{renderer=new T.WebGLRenderer({antialias:true,powerPreference:'default'});}catch(e){$('status').textContent='WebGL2 no disponible. Abre el archivo en Chrome o Edge con aceleración gráfica.';return;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.setClearColor(0x101820);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;stage.prepend(renderer.domElement);
const scene=new T.Scene();scene.add(new T.HemisphereLight(0xd9eaff,0x46414b,2.5));const light=new T.DirectionalLight(0xffffff,3);light.position.set(-3,7,4);scene.add(light);
const fill=new T.DirectionalLight(0x9acbde,1.4);fill.position.set(4,3,-5);scene.add(fill);
const vehicle=new T.Group();scene.add(vehicle);let flow=null,scenery=null;let content=null,paths=null,points=null,lineMesh=null,playing=true,clock=0,last=0,dirty=true,raf=0,loading=false,token=0;
let L=4.5,H=1.4,W=1.9,extent=8,triangles=0,TRACKS=0,STEPS=0;
let surface=null,pathData=null,focusFlow=null,retiredFocus=null,focusFade=0,retiredFade=0,activeCFD=null;
let generation=0,fieldRevision=0,buildPromise=Promise.resolve(),inspectionPoint=null,focusLocation=null;
let currentCFDFile=null;
const emitter={width:0.2,height:2.0,offsetY:0,offsetZ:0,visible:true};
let emitterSelected=false,emitterDrag=null,emitterTimer=null; // XY fixed: translation in YZ only.
let cameras=[],views=[],viewSelects=[],orbit=[],frameCount=0,fpsTime=0;
let sectionEnabled=false,sectionPick=false,sectionAxis='y',sectionValue=H*.5,sectionViewIndex=0;
const sectionFocus=new T.Vector3(0,H*.5,0);
/* Floating panels: each has its own scroll viewport and an independently adjustable width. */
function syncDockScroll(){
  for(const id of ['vehicleDock','flowDock','viewDock']){
    const dock=$(id),scroll=dock.querySelector('.dock-scroll');
    if(!dock.open||!scroll)return;
    const available=Math.floor(dock.getBoundingClientRect().height-42);
    if(available>0){scroll.style.height=available+'px';scroll.style.maxHeight=available+'px';}
  }
}
function setDockWidth(which,width){
  const target=which==='view'?$('viewDock'):$('rightDocks');
  const other=which==='view'?$('rightDocks'):$('viewDock');
  const stageWidth=stage.getBoundingClientRect().width||stage.clientWidth;
  const maximum=Math.min(580,stageWidth-other.getBoundingClientRect().width-44);
  const minimum=Math.min(which==='view'?210:200,Math.max(145,maximum));
  const clamped=Math.max(minimum,Math.min(Math.max(minimum,maximum),width));
  target.style.width=Math.round(clamped)+'px';
  syncDockScroll();wake();
}
function enableDockResize(id,which){
  const handle=$(id);let start=null;
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    start={x:e.clientX,width:(which==='view'?$('viewDock'):$('rightDocks')).getBoundingClientRect().width};
    handle.setPointerCapture(e.pointerId);
  });
  handle.addEventListener('pointermove',e=>{
    if(!start)return;
    const delta=(e.clientX-start.x)*(which==='view'?1:-1);
    setDockWidth(which,start.width+delta);
  });
  const finish=()=>{start=null;};
  handle.addEventListener('pointerup',finish);
  handle.addEventListener('pointercancel',finish);
  handle.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
  handle.addEventListener('keydown',e=>{
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    e.preventDefault();e.stopPropagation();
    const target=which==='view'?$('viewDock'):$('rightDocks');
    const delta=(e.key==='ArrowRight'?20:-20)*(which==='view'?1:-1);
    setDockWidth(which,target.getBoundingClientRect().width+delta);
  });
}
function initDockLayout(){
  enableDockResize('viewResizeHandle','view');
  enableDockResize('rightResizeHandle','right');
  for(const id of ['vehicleDock','flowDock','viewDock']){
    const dock=$(id);
    new ResizeObserver(syncDockScroll).observe(dock);
    dock.addEventListener('toggle',()=>requestAnimationFrame(syncDockScroll));
    const scroll=dock.querySelector('.dock-scroll');
    scroll?.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  }
  syncDockScroll();
}

const ground=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({color:0x171d25,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.y=-.025;scene.add(ground);
const grid=new T.GridHelper(20,40,0x3c505c,0x23323e);grid.position.y=-.015;scene.add(grid);
const arrow=new T.ArrowHelper(new T.Vector3(1,0,0),new T.Vector3(-6,.06,-2.4),2,0xff6a1a,.3,.17);scene.add(arrow);
// Section plane: default horizontal XZ (Y axis), with selectable X/Y/Z normal.
// Keep the opposite half-space to the viewing camera so the cut face is visible.
// Editable thin emission volume, perpendicular to the +X flow.
const emitterGroup=new T.Group();scene.add(emitterGroup);
const emitterBody=new T.Mesh(new T.BoxGeometry(1,1,1),
  new T.MeshBasicMaterial({color:0x27c5d8,transparent:true,opacity:.16,side:T.DoubleSide,
    depthWrite:false,depthTest:false}));
emitterBody.userData.emitterPart='move';emitterGroup.add(emitterBody);
const emitterEdges=new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1,1,1)),
  new T.LineBasicMaterial({color:0x73e2ec,transparent:true,opacity:.78,depthTest:false}));
emitterGroup.add(emitterEdges);
function emitterHandle(part,color){
  const mesh=new T.Mesh(new T.SphereGeometry(.12,14,10),
    new T.MeshBasicMaterial({color,depthTest:false,depthWrite:false}));
  mesh.userData.emitterPart=part;emitterGroup.add(mesh);return mesh;
}
const emitterMove=emitterHandle('move',0xffffff);
const emitterWidthGrip=emitterHandle('width',0x65deed);
const emitterHeightGrip=emitterHandle('height',0xffa344);
const emitterTargets=[emitterMove,emitterWidthGrip,emitterHeightGrip,emitterBody];
function emitterX(){return AeroEmitter.originX(L,extent,activeCFD);}
function emitterCoordinates(){return AeroEmitter.bounds(emitter.width,emitter.height,
  $('focus').value,emitter.offsetY,emitter.offsetZ);}
function updateEmitterVisual(){
  const y=.035+emitter.offsetY+(emitter.height-.035)*.5;
  emitterGroup.position.set(emitterX(),y,emitter.offsetZ);
  emitterBody.scale.set(.065,Math.max(.02,emitter.height-.035),emitter.width);
  emitterEdges.scale.copy(emitterBody.scale);
  emitterMove.position.set(-.13,0,0);
  emitterWidthGrip.position.set(-.13,0,emitter.width*.5);
  emitterHeightGrip.position.set(-.13,(emitter.height-.035)*.5,0);
  const handles=emitterSelected&&emitter.visible;
  for(const h of [emitterMove,emitterWidthGrip,emitterHeightGrip])h.visible=handles;
  emitterGroup.visible=emitter.visible;
  emitterBody.material.opacity=emitterSelected?.29:.14;
  emitterEdges.material.opacity=emitterSelected?1:.72;
  $('emitterWidth').value=emitter.width.toFixed(2);
  $('emitterHeight').value=emitter.height.toFixed(2);
  $('emitterOffsetY').value=emitter.offsetY.toFixed(2);
  $('emitterOffsetZ').value=emitter.offsetZ.toFixed(2);
  $('emitterShow').checked=emitter.visible;
  $('emitterSelect').setAttribute('aria-pressed',emitterSelected?'true':'false');
  $('emitterSelect').textContent=emitterSelected?'Emisor seleccionado':'Seleccionar en 3D';
  $('emitterStatus').textContent='X fijo: '+emitterX().toFixed(2)+' m · Arrastra el centro blanco para mover Y/Z, el punto cian para anchura y el naranja para altura. Partículas regeneradas al terminar.';
  wake();
}
function queueEmitterRebuild(immediate=false){
  if(emitterTimer!==null){clearTimeout(emitterTimer);emitterTimer=null;}
  if(immediate){rebuild(false,false);return;}
  emitterTimer=setTimeout(()=>{emitterTimer=null;rebuild(false,false);},320);
}
function emitterRay(e,i){
  const bounds=views[i].getBoundingClientRect(),type=viewSelects[i].value;
  const cam=cameras[i][type==='3d'?'persp':'ortho'],ray=new T.Raycaster();
  ray.setFromCamera({x:(e.clientX-bounds.left)/bounds.width*2-1,
    y:-(e.clientY-bounds.top)/bounds.height*2+1},cam);
  return ray;
}
function emitterPlaneHit(ray){
  return ray.ray.intersectPlane(new T.Plane(new T.Vector3(1,0,0),-emitterX()),new T.Vector3());
}
function emitterPointerDown(e,i){
  if(!emitter.visible||viewSelects[i].value==='section')return false;
  // Use the real camera of the clicked viewport (all views share one canvas).
  render();
  const ray=emitterRay(e,i),hits=ray.intersectObjects(emitterTargets.filter(t=>t.visible),false);
  if(!hits.length)return false;
  const point=emitterPlaneHit(ray);
  if(!point){status('Selecciona el emisor desde una vista frontal o 3D.',true);return true;}
  emitterSelected=true;
  emitterDrag={i,pointerId:e.pointerId,part:hits[0].object.userData.emitterPart,
    start:point.clone(),offsetY:emitter.offsetY,offsetZ:emitter.offsetZ,
    width:emitter.width,height:emitter.height};
  updateEmitterVisual();
  renderer.domElement.setPointerCapture(e.pointerId);
  e.preventDefault();return true;
}
function emitterPointerMove(e){
  if(!emitterDrag||e.pointerId!==emitterDrag.pointerId)return false;
  const point=emitterPlaneHit(emitterRay(e,emitterDrag.i));
  if(!point)return true;
  const d=emitterDrag;
  if(d.part==='move'){
    emitter.offsetY=T.MathUtils.clamp(d.offsetY+point.y-d.start.y,0,Math.max(0,extent*1.8));
    emitter.offsetZ=T.MathUtils.clamp(d.offsetZ+point.z-d.start.z,-extent*2,extent*2);
  }else if(d.part==='width'){
    emitter.width=T.MathUtils.clamp(2*Math.abs(point.z-emitter.offsetZ),.2,20);
  }else if(d.part==='height'){
    emitter.height=T.MathUtils.clamp(point.y-emitter.offsetY,.2,20);
  }
  updateEmitterVisual();
  queueEmitterRebuild();
  e.preventDefault();return true;
}
function emitterPointerEnd(e){
  if(!emitterDrag||e.pointerId!==emitterDrag.pointerId)return false;
  emitterDrag=null;queueEmitterRebuild(true);updateEmitterVisual();return true;
}
const sectionPlane=new T.Plane(new T.Vector3(0,-1,0),0);
const sectionMarker=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({
  color:0xff6a1a,transparent:true,opacity:.17,depthWrite:false,side:T.DoubleSide}));
sectionMarker.visible=false;scene.add(sectionMarker);
const sectionAxisName={x:'X · transversal YZ',y:'Y · horizontal XZ',z:'Z · longitudinal XY'};
function sectionRange(axis=sectionAxis){
  if(axis==='x')return [-L*.5,L*.5];
  if(axis==='z')return [-W*.5,W*.5];
  return [0,H];
}
function sectionCameraDirection(axis=sectionAxis){
  return axis==='x'?new T.Vector3(-1,0,0):
    axis==='z'?new T.Vector3(0,0,1):new T.Vector3(0,1,0);
}
function resetSectionCamera(i){
  const o=orbit[i];if(!o)return;
  // Spherical coordinates are the same as the freely orbiting perspective view.
  if(sectionAxis==='x'){o.theta=Math.PI;o.phi=Math.PI*.5;}
  else if(sectionAxis==='z'){o.theta=Math.PI*.5;o.phi=Math.PI*.5;}
  else{o.theta=-Math.PI*.5;o.phi=.001;}
  o.r=extent*2;o.zoom=1;
}
function updateSectionUI(){
  $('section').setAttribute('aria-pressed',sectionPick?'true':'false');
  $('section').textContent=sectionPick?'Selecciona un punto…':'Crear sección';
  $('sectionHint').textContent=sectionPick?
    'Eje '+sectionAxis.toUpperCase()+': haz clic sobre el vehículo o el suelo para situar el plano.':
    sectionEnabled?'Sección '+sectionAxis.toUpperCase()+
      ' activa. La cámara comienza perpendicular al plano; arrastra para orbitar y usa la rueda para ampliar.':
      'Elige el eje, pulsa «Crear sección» y haz clic sobre el vehículo. La nueva vista será perpendicular al plano.';
  stage.classList.toggle('section-pick',sectionPick);
}
function updateSectionMarker(){
  const [min,max]=sectionRange();
  sectionValue=T.MathUtils.clamp(sectionValue,min,max);
  sectionFocus[sectionAxis]=sectionValue;
  const n=sectionPlane.normal;
  n.set(sectionAxis==='x'?1:0,sectionAxis==='y'?-1:0,sectionAxis==='z'?-1:0);
  sectionPlane.constant=-n[sectionAxis]*sectionValue;
  sectionMarker.position.copy(sectionFocus);
  sectionMarker.rotation.set(0,0,0);
  if(sectionAxis==='x'){
    sectionMarker.rotation.y=Math.PI*.5;
    sectionMarker.scale.set(Math.max(W*1.6,1.8),Math.max(H*1.45,1.6),1);
  }else if(sectionAxis==='y'){
    sectionMarker.rotation.x=-Math.PI*.5;
    sectionMarker.scale.set(Math.max(L*1.2,2.3),Math.max(W*1.7,2.0),1);
  }else{
    sectionMarker.scale.set(Math.max(L*1.2,2.3),Math.max(H*1.45,1.6),1);
  }
  sectionMarker.visible=sectionEnabled;
  $('sectionPositionLabel').textContent='Posición '+sectionAxis.toUpperCase();
  $('sectionPosition').min=min.toFixed(2);
  $('sectionPosition').max=max.toFixed(2);
  $('sectionPosition').value=sectionValue.toFixed(2);
  $('sectionValue').textContent=sectionValue.toFixed(2).replace('.',',')+' m';
  updateSectionUI();wake();
}
function clearSection(){
  sectionEnabled=false;sectionPick=false;
  for(const select of viewSelects)if(select.value==='section')select.value='3d';
  sectionMarker.visible=false;updateSectionUI();wake();
}
function setSection(value,sourceIndex=0,split=true,hitPoint=null){
  const [min,max]=sectionRange();
  sectionValue=T.MathUtils.clamp(value,min,max);
  if(hitPoint)sectionFocus.copy(hitPoint);
  sectionFocus[sectionAxis]=sectionValue;
  sectionEnabled=true;sectionPick=false;
  if(split&&views.length===1){
    sectionViewIndex=1; // Keep the first perspective and place the cut in view 2.
    $('layout').value='2';layout();
  }else sectionViewIndex=Math.max(0,Math.min(views.length-1,sourceIndex));
  viewSelects[sectionViewIndex].value='section';
  resetSectionCamera(sectionViewIndex);
  updateSectionMarker();
}
function pickSection(e,i){
  if(!content)return;
  // Raycast at the clicked point; use the floor when the model itself isn't hit.
  render();
  const bounds=views[i].getBoundingClientRect(),type=viewSelects[i].value;
  const cam=cameras[i][type==='3d'?'persp':'ortho'],ray=new T.Raycaster();
  ray.setFromCamera({x:(e.clientX-bounds.left)/bounds.width*2-1,y:-(e.clientY-bounds.top)/bounds.height*2+1},cam);
  const hits=ray.intersectObject(content,true);
  const groundHit=ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),0),new T.Vector3());
  const chosen=hits.length?hits[0].point:groundHit;
  if(!chosen){status('No se pudo situar el corte. Haz clic sobre el vehículo o el suelo.',true);return;}
  setSection(chosen[sectionAxis],i,true,chosen);
}
function status(s,error=false){$('status').textContent=s;$('status').classList.toggle('error',error);}
function wake(){dirty=true;if(!raf)raf=requestAnimationFrame(tick);}
function dispose(obj){const gs=new Set(),ms=new Set(),ts=new Set();obj.traverse(o=>{if(o.geometry)gs.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){ms.add(m);for(const v of Object.values(m))if(v?.isTexture)ts.add(v);}});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());ts.forEach(t=>{t.dispose();if(t.source?.data?.close)t.source.data.close();});}
function demo(){const g=new T.Group(),mat=new T.MeshStandardMaterial({color:0xaeb8c3,metalness:.65,roughness:.3}),glass=new T.MeshStandardMaterial({color:0x253d50,metalness:.5,roughness:.2});
const shape=new T.Shape();shape.moveTo(-2.25,.28);shape.lineTo(-2.2,.65);shape.lineTo(-1.2,.83);shape.lineTo(-.55,1.32);shape.lineTo(.65,1.38);shape.lineTo(1.35,.9);shape.lineTo(2.2,.78);shape.lineTo(2.25,.32);shape.closePath();
const geom=new T.ExtrudeGeometry(shape,{depth:1.62,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.07,bevelThickness:.08});geom.translate(0,0,-.81);g.add(new T.Mesh(geom,mat));
for(const z of [-.9,.9]){const win=new T.Mesh(new T.BoxGeometry(1.1,.38,.02),glass);win.position.set(.02,1.1,z*.96);g.add(win);for(const x of [-1.42,1.45]){const wheel=new T.Mesh(new T.CylinderGeometry(.34,.34,.22,24),new T.MeshStandardMaterial({color:0x16171b,roughness:.95}));wheel.rotation.x=Math.PI/2;wheel.position.set(x,.34,z);g.add(wheel);const hub=new T.Mesh(new T.CylinderGeometry(.18,.18,.23,16),mat);hub.rotation.x=Math.PI/2;hub.position.copy(wheel.position);g.add(hub);}}
return g;}
function normalize(){vehicle.position.set(0,0,0);vehicle.updateMatrixWorld(true);let b=new T.Box3().setFromObject(vehicle);if(b.isEmpty())throw Error('No hay geometría visible.');const center=b.getCenter(new T.Vector3());vehicle.position.set(-center.x,-b.min.y,-center.z);vehicle.updateMatrixWorld(true);b=new T.Box3().setFromObject(vehicle);const s=b.getSize(new T.Vector3());L=s.x;H=s.y;W=s.z;if(!Number.isFinite(L+H+W)||Math.min(L,H,W)<1e-7)throw Error('Dimensiones no válidas.');extent=Math.max(L*1.65,H*2,W*2);if(!sectionEnabled){sectionFocus.set(0,H*.5,0);sectionValue=sectionFocus[sectionAxis];}updateSectionMarker();updateEmitterVisual();ground.scale.set(extent*2,extent*1.3,1);grid.scale.setScalar(extent/10);arrow.position.set(-extent*.85,.06,-W*.9);arrow.setLength(L*.5,L*.08,L*.04);$('length').value=L.toFixed(2);$('dimensions').textContent=`${L.toFixed(2)} × ${H.toFixed(2)} × ${W.toFixed(2)} m`;}
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
  loading=true;updateEmitterVisual();status(geometry?'Analizando triángulos del modelo…':'Refinando trayectorias…');
  let nextSurface=null;
  try{
    if(geometry||!surface){normalize();geometry=true;nextSurface=await AeroGeometry.fromObject(vehicle,()=>seq===generation);}
    else nextSurface=surface;
    if(!nextSurface||seq!==generation){if(nextSurface&&nextSurface!==surface)nextSurface.dispose();return;}
    const options={L,H,W,extent,precision:$('precision').value,focus:$('focus').value,
      emitterWidth:emitter.width,emitterHeight:emitter.height,
      emitterOffsetY:emitter.offsetY,emitterOffsetZ:emitter.offsetZ};
    const result=activeCFD?
      await AeroCFD.build(activeCFD,nextSurface,options,()=>seq===generation):
      await AeroPaths.build(nextSurface,options,()=>seq===generation);
    if(!result||seq!==generation){if(nextSurface!==surface)nextSurface.dispose();return;}
    if(nextSurface!==surface){if(surface)surface.dispose();surface=nextSurface;}
    pathData=result;paths=result.paths;TRACKS=result.tracks;STEPS=result.steps;triangles=surface.triangles;fieldRevision++;
    releaseFocus();installPathGuides();setParticles();if(geometry)buildScenery();if(reframe)resetCameras();
    const warning=surface.openEdges===null?'topología no verificada':surface.openEdges?'malla con '+surface.openEdges+' bordes abiertos':'malla sin bordes abiertos detectados';
    $('badge').textContent=result.physical?'CFD IMPORTADO · TRAYECTORIAS RECTIFICADAS VISUALMENTE · '+activeCFD.source:'ESTELA CINEMÁTICA ILUSTRATIVA · NO CFD';
    $('flowlegend').querySelector('b').textContent=result.physical?'FLUJO / CFD':'FLUJO / VISUAL';
    $('fieldinfo').textContent=result.physical?activeCFD.source+' · 0–'+activeCFD.displayMaxSpeed.toFixed(1)+' m/s · '+activeCFD.dims.join(' × ')+' nodos':'Sin campo CFD importado. Vórtices y velocidad cromática ilustrativos.';
    status(triangles.toLocaleString('es')+' triángulos · '+TRACKS+' rutas / '+STEPS+' muestras · '+warning+
      (result.repaired||result.stalled?' · '+result.repaired+' rutas reconstruidas, '+result.stalled+' detenidas':'')+
      (result.surfaceAdjusted?' · '+result.surfaceAdjusted+' pasos separados de la superficie':'')+
      (result.physical?' · CFD externo importado (sin validar)':' · visualización, no CFD'));
  }catch(e){if(seq===generation)status('Error de geometría: '+e.message,true);}
  finally{if(seq===generation){loading=false;wake();}}
}
function rebuild(geometry=true,reframe=true){buildPromise=performRebuild(geometry,reframe);return buildPromise;}
function resetField(){
  activeCFD=null;currentCFDFile=null;
  $('fieldinfo').textContent='Sin campo CFD importado. Vórtices y velocidad cromática ilustrativos.';
}
function install(obj,name,yaw=0){
  generation++;releaseFocus();resetField();clearSection();sectionValue=H*.5;
  if(content){vehicle.remove(content);dispose(content);}
  vehicle.rotation.set(0,yaw,0);vehicle.scale.setScalar(1);
  content=obj;vehicle.add(obj);vehicle.visible=$('body').checked;
  $('filename').textContent=name;clock=0;inspectionPoint=null;focusMarker.visible=false;
  return rebuild(true,true);
}
function resetCameras(){
  orbit=views.map(()=>({theta:2.35,phi:1.13,r:extent*1.12,zoom:1,target:new T.Vector3(0,H*.55,0)}));
  for(let i=0;i<viewSelects.length;i++)if(viewSelects[i].value==='section')resetSectionCamera(i);
  if(focusFlow)releaseFocus();wake();
}
function layout(){
  const count=+$('layout').value,prior=viewSelects.map(select=>select.value);
  $('panels').innerHTML='';$('viewTypes').innerHTML='';
  $('panels').style.gridTemplateColumns=count===1?'1fr':'1fr 1fr';
  $('panels').style.gridTemplateRows=count===4?'1fr 1fr':'1fr';
  views=[];viewSelects=[];cameras=[];
  for(let i=0;i<count;i++){
    const div=document.createElement('div');div.className='view';
    div.innerHTML='<small>0'+(i+1)+' / VISTA</small>';$('panels').append(div);
    const group=document.createElement('div');group.className='view-picker';
    const label=document.createElement('label');label.textContent='Vista '+(i+1);
    const select=document.createElement('select');
    select.setAttribute('aria-label','Tipo de vista '+(i+1));
    select.innerHTML='<option value="3d">Perspectiva 3D</option><option value="side">Lateral</option><option value="top">Superior</option><option value="front">Frontal</option><option value="section">Sección del plano</option>';
    select.value=prior[i]||['3d','side','top','front'][i];
    select.onchange=()=>{
      if(select.value==='section')setSection(sectionValue,i,false);
      else if(sectionViewIndex===i&&!viewSelects.some(v=>v.value==='section'))clearSection();
      wake();
    };
    group.append(label);group.append(select);$('viewTypes').append(group);
    views.push(div);viewSelects.push(select);
    cameras.push({persp:new T.PerspectiveCamera(42,1,.01,10000),
      ortho:new T.OrthographicCamera(-1,1,1,-1,.01,10000)});
  }
  if(sectionEnabled&&!viewSelects.some(select=>select.value==='section')){
    sectionViewIndex=Math.min(sectionViewIndex,count-1);
    viewSelects[sectionViewIndex].value='section';
  }
  resetCameras();
}
function render(){
  const width=stage.clientWidth,height=stage.clientHeight;
  if(renderer.domElement.width!==Math.round(width*renderer.getPixelRatio())||renderer.domElement.height!==Math.round(height*renderer.getPixelRatio()))renderer.setSize(width,height,false);
  renderer.setScissorTest(true);const sr=stage.getBoundingClientRect();
  views.forEach((v,i)=>{
    const rect=v.getBoundingClientRect(),x=rect.left-sr.left,y=height-(rect.bottom-sr.top);
    const aspect=rect.width/Math.max(rect.height,1),type=viewSelects[i].value,o=orbit[i];
    const target=type==='section'?sectionFocus:o.target;
    let cam;
    if(type==='3d'){
      cam=cameras[i].persp;cam.aspect=aspect;
      cam.position.set(target.x+Math.cos(o.theta)*Math.sin(o.phi)*o.r,
        target.y+Math.cos(o.phi)*o.r,target.z+Math.sin(o.theta)*Math.sin(o.phi)*o.r);
      cam.up.set(0,1,0);
    }else{
      cam=cameras[i].ortho;
      const sectionSize=sectionAxis==='x'?Math.max(W*.9,H*1.15,1.25):
        sectionAxis==='y'?Math.max(L*.64,W*.95,1.35):Math.max(L*.64,H*1.15,1.35);
      const size=(type==='section'?sectionSize:extent*.58)/o.zoom;
      cam.left=-size*aspect;cam.right=size*aspect;cam.top=size;cam.bottom=-size;cam.up.set(0,1,0);
      if(type==='side')cam.position.set(target.x,target.y,target.z+extent*3);
      if(type==='front')cam.position.set(target.x-extent*3,target.y,target.z);
      if(type==='top'){cam.position.set(target.x,target.y+extent*3,target.z);cam.up.set(1,0,0);}
      if(type==='section'){
        // Orthogonal projection. Initially directly normal to the chosen section plane.
        // Spherical camera direction permits subsequent free orbit using drag.
        const radius=extent*2;
        cam.position.set(target.x+Math.cos(o.theta)*Math.sin(o.phi)*radius,
          target.y+Math.cos(o.phi)*radius,
          target.z+Math.sin(o.theta)*Math.sin(o.phi)*radius);
        cam.up.set(sectionAxis==='y'?-1:0,sectionAxis==='y'?0:1,0);
      }
    }
    cam.lookAt(target);cam.updateProjectionMatrix();cam.updateMatrixWorld(true);
    const sliced=type==='section'&&sectionEnabled;
    renderer.clippingPlanes=sliced?[sectionPlane]:[];
    sectionMarker.visible=sectionEnabled&&!sliced;
    emitterGroup.visible=emitter.visible&&!sliced;
    for(const group of [flow,focusFlow,retiredFocus])if(group?.setClip)group.setClip(sliced,sectionPlane.normal,sectionPlane.constant);
    renderer.setViewport(x,y,rect.width,rect.height);
    renderer.setScissor(x,y,rect.width,rect.height);
    renderer.render(scene,cam);
  });
  renderer.clippingPlanes=[];
  for(const group of [flow,focusFlow,retiredFocus])if(group?.setClip)group.setClip(false,sectionPlane.normal,sectionPlane.constant);
  sectionMarker.visible=sectionEnabled;emitterGroup.visible=emitter.visible;dirty=false;
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
  if(sectionPick&&e.button===0){pickSection(e,i);return;}
  if(e.button===0&&emitterPointerDown(e,i))return;
  if(emitterSelected&&e.button===0){emitterSelected=false;updateEmitterVisual();}
  drag={i,x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2||!['3d','section'].includes(viewSelects[i].value)};
  renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointermove',e=>{if(emitterPointerMove(e))return;if(!drag)return;
  const o=orbit[drag.i],dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(drag.pan||e.shiftKey){
    const type=viewSelects[drag.i].value,cam=cameras[drag.i][type==='3d'?'persp':'ortho'];
    const right=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,0);
    const up=new T.Vector3().setFromMatrixColumn(cam.matrixWorld,1);
    const unit=type==='3d'?o.r/500:extent/(Math.max(o.zoom,.1)*300);
    o.target.addScaledVector(right,-dx*unit).addScaledVector(up,dy*unit);
  }else{
    o.theta+=dx*.008;o.phi=T.MathUtils.clamp(o.phi+dy*.008,.001,Math.PI-.001);
  }
  drag.x=e.clientX;drag.y=e.clientY;wake();
});
renderer.domElement.addEventListener('pointerup',e=>{
  if(emitterPointerEnd(e))return;
  if(drag)updateFocus(false,drag.i);drag=null;
});
renderer.domElement.addEventListener('pointercancel',e=>{
  if(emitterDrag&&e.pointerId===emitterDrag.pointerId)emitterPointerEnd(e);
  drag=null;
});
renderer.domElement.addEventListener('wheel',e=>{
  e.preventDefault();const i=viewAt(e);if(i<0)return;
  const factor=Math.exp(e.deltaY*.001),o=orbit[i];
  o.r=T.MathUtils.clamp(o.r*factor,L*.025,extent*8);
  o.zoom=T.MathUtils.clamp(o.zoom/factor,.15,48);
  updateFocus(false,i);wake();
},{passive:false});
renderer.domElement.addEventListener('dblclick',e=>{
  const i=viewAt(e);if(i<0||!content||sectionPick)return;
  render();const bounds=views[i].getBoundingClientRect(),type=viewSelects[i].value;
  const cam=cameras[i][type==='3d'?'persp':'ortho'],ray=new T.Raycaster();
  ray.setFromCamera({x:(e.clientX-bounds.left)/bounds.width*2-1,y:-(e.clientY-bounds.top)/bounds.height*2+1},cam);
  const hits=ray.intersectObject(content,true);if(!hits.length)return;
  inspectionPoint=hits[0].point.clone();
  if(type==='section'){sectionFocus.copy(inspectionPoint);sectionFocus[sectionAxis]=sectionValue;}
  else orbit[i].target.copy(inspectionPoint);
  focusMarker.position.copy(inspectionPoint);focusMarker.scale.setScalar(Math.max(L*.35,.1));focusMarker.visible=true;
  updateFocus(true,i);wake();
});
function playback(on){
  playing=on;
  $('play').classList.toggle('primary',on);
  $('pause').classList.toggle('primary',!on);
  $('play').setAttribute('aria-pressed',on?'true':'false');
  $('pause').setAttribute('aria-pressed',on?'false':'true');
  $('fps').textContent=on?'— FPS':'PAUSA';last=0;wake();
}
$('play').onclick=()=>playback(true);
$('pause').onclick=()=>playback(false);
$('section').onclick=()=>{sectionAxis=$('sectionAxis').value;sectionPick=!sectionPick;updateSectionUI();wake();};
$('sectionAxis').onchange=()=>{
  sectionAxis=$('sectionAxis').value;
  sectionValue=sectionEnabled?sectionFocus[sectionAxis]:sectionRange().reduce((a,b)=>a+b)/2;
  for(let i=0;i<viewSelects.length;i++)if(viewSelects[i].value==='section')resetSectionCamera(i);
  updateSectionMarker();
};
$('clearSection').onclick=clearSection;
$('sectionPosition').oninput=()=>{
  sectionValue=Number($('sectionPosition').value);
  if(!sectionEnabled)setSection(sectionValue,0,false);
  updateSectionMarker();
};
$('reset').onclick=()=>{clock=0;updateParticles();wake();};
$('quality').onchange=setParticles;
$('precision').onchange=()=>rebuild(false,false);
// Independent 3D emitter volume: Y/Z translation, Y/Z scale; X cannot move.
function changeEmitter(){
  const width=Number($('emitterWidth').value),height=Number($('emitterHeight').value),
    offsetY=Number($('emitterOffsetY').value),offsetZ=Number($('emitterOffsetZ').value);
  if(![width,height,offsetY,offsetZ].every(Number.isFinite)||
      width<.2||height<.2||width>20||height>20||
      offsetY<0||offsetY>20||Math.abs(offsetZ)>20){
    status('Anchura y altura: 0,2–20 m; Y: 0–20 m; Z: ±20 m.',true);
    updateEmitterVisual();return;
  }
  if(width===emitter.width&&height===emitter.height&&
    offsetY===emitter.offsetY&&offsetZ===emitter.offsetZ)return;
  Object.assign(emitter,{width,height,offsetY,offsetZ});
  updateEmitterVisual();queueEmitterRebuild(true);
}
for(const id of ['emitterWidth','emitterHeight','emitterOffsetY','emitterOffsetZ'])
  $(id).onchange=changeEmitter;
$('emitterSelect').onclick=()=>{
  emitterSelected=!emitterSelected;emitter.visible=true;updateEmitterVisual();
};
$('emitterShow').onchange=()=>{
  emitter.visible=$('emitterShow').checked;
  if(!emitter.visible)emitterSelected=false;
  updateEmitterVisual();
};
$('emitterReset').onclick=()=>{
  Object.assign(emitter,{width:0.2,height:2,offsetY:0,offsetZ:0,visible:true});
  emitterSelected=true;updateEmitterVisual();queueEmitterRebuild(true);
};
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
    currentCFDFile=f.name;
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
initDockLayout();layout();updateSectionUI();updateEmitterVisual();playback(true);install(demo(),'Concepto de demostración');restoreDefault();

/* Project bridge: capture and restore viewer state without changing the BVH/CFD engines. */
const projectControls=['quality','precision','flowmode','pointsize','trail','opacity',
 'palette','focus','speed','layout','lines','tunnel','body','grid',
 'emitterWidth','emitterHeight','emitterOffsetY','emitterOffsetZ','emitterShow'];
const booleanControls=new Set(['lines','tunnel','body','grid','emitterShow']);
const validChoices={quality:['2000','6000','12000','24000'],precision:['low','balanced','fine'],
 flowmode:['both','trails','points'],palette:['velocity','#b8e9ec','#e5edf2','#ffb16d'],
 focus:['all','center'],layout:['1','2','4']};
const validRanges={pointsize:[1,4],trail:[.3,3.5],opacity:[.2,1],speed:[.2,2.5],
 emitterWidth:[.2,20],emitterHeight:[.2,20],emitterOffsetY:[0,20],emitterOffsetZ:[-20,20]};
function projectSnapshot(){
 const controls={};
 for(const id of projectControls)controls[id]=booleanControls.has(id)?$(id).checked:$(id).value;
 const name=$('filename').textContent;
 return {
  vehicle:{name,fileRef:name.endsWith('.glb')?name:null,unit:'m'},
  transformations:{position:vehicle.position.toArray(),rotation:[vehicle.rotation.x,vehicle.rotation.y,vehicle.rotation.z],
    scale:vehicle.scale.toArray(),lengthMeters:L,coordinateSystem:'X / longitudinal, Y / vertical, Z / transversal'},
  cfd:{fieldRef:currentCFDFile},
  results:currentCFDFile&&activeCFD?[{fileRef:currentCFDFile,source:activeCFD.source||'',
    referenceSpeed:activeCFD.referenceSpeed||null,dimensions:activeCFD.dims?.slice()||[0,0,0]}]:[],
  viewer:{controls,viewModes:viewSelects.map(s=>s.value),section:{
    axis:sectionAxis,value:sectionValue,enabled:sectionEnabled}}
 };
}
async function projectRestore(project){
 token++; // Cancel a pending asynchronous default GLB restoration.
 const wanted=project.vehicle?.name||'Concepto de demostración';
 let matching=wanted===$('filename').textContent;
 if(!matching){
   let saved=null;
   try{saved=await readDefault();}catch(e){/* Local model storage optional. */}
   if(saved?.name===wanted&&saved.buffer){
     const obj=await parseVehicle(saved.buffer);
     await install(obj,saved.name,saved.yaw||0);matching=true;
   }else await install(demo(),'Concepto de demostración');
 }
 resetField(); // CFD references alone cannot restore the physical velocity buffer.
 const controls=project.viewer?.controls||{};
 for(const id of projectControls){
   const el=$(id),value=controls[id];
   if(booleanControls.has(id)){if(typeof value==='boolean')el.checked=value;continue;}
   if(value===undefined)continue;
   const s=String(value);
   if(validChoices[id]&&!validChoices[id].includes(s))continue;
   if(validRanges[id]){
     const n=Number(s),[min,max]=validRanges[id];
     if(!Number.isFinite(n)||n<min||n>max)continue;
   }
   el.value=s;
 }
 Object.assign(emitter,{
  width:Number($('emitterWidth').value),height:Number($('emitterHeight').value),
  offsetY:Number($('emitterOffsetY').value),offsetZ:Number($('emitterOffsetZ').value),
  visible:$('emitterShow').checked
 });
 if(matching){
   const t=project.transformations||{};
   if(Array.isArray(t.rotation)&&t.rotation.length===3&&t.rotation.every(Number.isFinite))
     vehicle.rotation.set(...t.rotation);
   if(Array.isArray(t.scale)&&t.scale.length===3&&t.scale.every(n=>Number.isFinite(n)&&n>0&&n<=10000))
     vehicle.scale.set(...t.scale);
 }
 $('speedval').textContent=$('speed').value.replace('.',',')+'×';
 $('layout').value=validChoices.layout.includes(String(controls.layout))?String(controls.layout):'1';
 layout();
 if(Array.isArray(project.viewer?.viewModes))
   for(let i=0;i<viewSelects.length;i++)
     if(['3d','side','top','front'].includes(project.viewer.viewModes[i]))
       viewSelects[i].value=project.viewer.viewModes[i];
 sectionAxis=['x','y','z'].includes(project.viewer?.section?.axis)?project.viewer.section.axis:'y';
 $('sectionAxis').value=sectionAxis;
 clearSection();
 await rebuild(matching,true);
 if(project.viewer?.section?.enabled===true&&Number.isFinite(project.viewer.section.value))
   setSection(project.viewer.section.value,0,true);
 setParticles();configureFlow();
 grid.visible=$('grid').checked;vehicle.visible=$('body').checked;
 if(scenery)scenery.visible=$('tunnel').checked;
 if(lineMesh)lineMesh.visible=$('lines').checked;
 updateEmitterVisual();wake();
 return {vehicleRestored:matching};
}
window.aeroProjectBridge={
 snapshot:projectSnapshot,
 restore:projectRestore,
 startNew:async()=>{
   token++;resetField();currentCFDFile=null;
   await install(demo(),'Concepto de demostración');
 }
};

window.aeroReady=()=>buildPromise;
window.aeroDiagnostics=()=>({triangles,particles:points?.geometry.attributes.position.count||0,views:views.length,playing,
  sectionEnabled,sectionPick,sectionAxis,sectionValue,sectionViewIndex,
  sectionNormal:[sectionPlane.normal.x,sectionPlane.normal.y,sectionPlane.normal.z],
  sectionPlaneConstant:sectionPlane.constant,
  sectionCameraDirection:(()=>{
    const o=orbit[sectionViewIndex];
    return o?[Math.cos(o.theta)*Math.sin(o.phi),Math.cos(o.phi),Math.sin(o.theta)*Math.sin(o.phi)]:null;
  })(),viewModes:viewSelects.map(s=>s.value),
  dimensions:[L,H,W],emitter:[emitter.width,emitter.height],emitterOffset:[emitter.offsetY,emitter.offsetZ],emitterX:emitterX(),emitterSelected,emitterVisible:emitter.visible,tracks:TRACKS,steps:STEPS,fieldRevision,precision:pathData?.precision||null,
  rawSamples:pathData?.rawSamples||0,repaired:pathData?.repaired||0,stalled:pathData?.stalled||0,surfaceAdjusted:pathData?.surfaceAdjusted||0,
  openEdges:surface?.openEdges??null,gpuAnimation:true,focused:!!focusFlow,cfd:!!pathData?.physical,cfdSource:activeCFD?.source||null,
  trailVertices:flow?.trails.geometry.attributes.position.count||0,particleSize:flow?.uniforms.size.value||0,
  externalResources:performance.getEntriesByType('resource').filter(r=>/^https?:/.test(r.name)).length,vehicleYaw:vehicle.rotation.y});
})();
