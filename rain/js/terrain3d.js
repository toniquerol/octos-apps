// OcToS Rain V7 — superficie 3D del MDT y partículas D8 animadas.
// WebGL Three.js desde CDN. La topografía proviene exclusivamente del GeoTIFF cargado.
// La textura intenta reutilizar las teselas del mapa base elegido; falla con CORS -> sombreado seguro.
import {toLatLng} from './dem.js';
export class Terrain3D {
 constructor(host){
  this.host=host;this.running=false;this.dem=null;this.hydro=null;this.animator=null;this.exaggeration=3;this.baseUrl='';this.textureRequest=0;
  this.el=document.createElement('div');this.el.className='rain-3d-view';
  this.el.setAttribute('aria-label','Terreno en tres dimensiones');
  this.host.append(this.el);
  this.onResize=()=>this.resize();
  window.addEventListener('resize',this.onResize);
 }
 async init(){
  if(this.THREE)return;
  try{this.THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');}
  catch(e){throw Error('No se ha podido cargar Three.js. Requiere Internet y WebGL: '+e.message);}
  const T=this.THREE;
  if(!this.el.isConnected)this.host.append(this.el);
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false});
  this.renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));
  this.renderer.setClearColor(0x172431,1);
  this.el.append(this.renderer.domElement);
  this.scene=new T.Scene();this.scene.background=new T.Color(0x172431);
  this.camera=new T.PerspectiveCamera(53,1,0.5,10000);
  this.scene.add(new T.HemisphereLight(0xf0f7ff,0x444d4b,2.0));
  const sun=new T.DirectionalLight(0xffffff,1.7);sun.position.set(-250,600,400);this.scene.add(sun);
  this.el.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;this.dragging=true;this.dragX=e.clientX;this.dragY=e.clientY;this.el.setPointerCapture(e.pointerId);});
  this.el.addEventListener('pointermove',e=>{if(!this.dragging)return;this.theta-=(e.clientX-this.dragX)*0.008;this.phi=Math.max(.1,Math.min(1.48,this.phi+(e.clientY-this.dragY)*.008));this.dragX=e.clientX;this.dragY=e.clientY;this.updateCamera();});
  for(const ev of ['pointerup','pointercancel'])this.el.addEventListener(ev,()=>this.dragging=false);
  this.el.addEventListener('wheel',e=>{e.preventDefault();this.radius=Math.max(20,Math.min(3500,this.radius*Math.exp(e.deltaY*.001)));this.updateCamera();},{passive:false});
  this.el.addEventListener('contextmenu',e=>e.preventDefault());
  this.resize();
 }
 updateCamera(){
  if(!this.camera||!this.target)return;
  const t=this.target;
  this.camera.position.set(t.x+this.radius*Math.sin(this.phi)*Math.sin(this.theta),t.y+this.radius*Math.cos(this.phi),t.z+this.radius*Math.sin(this.phi)*Math.cos(this.theta));
  this.camera.lookAt(t);
 }
 resize(){
  if(!this.renderer)return;
  const w=Math.max(1,this.el.clientWidth),h=Math.max(1,this.el.clientHeight);
  this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.renderer.setSize(w,h,false);
 }
 async open(dem,{baseUrl,baseOpacity=1,hydro,animator,exaggeration=3,onStatus=()=>{}}={}){
  if(!dem)throw Error('Importa primero un MDT real para mostrar el relieve en 3D.');
  await this.init();this.dem=dem;this.hydro=hydro;this.animator=animator;
  this.baseUrl=baseUrl;this.baseOpacity=baseOpacity;this.exaggeration=exaggeration;this.status=onStatus;
  this.el.classList.add('shown');
  this.construct();
  this.radius=1000;this.theta=-.7;this.phi=1.02;
  const maxSize=Math.max(dem.width*dem.dx,dem.height*dem.dy);
  this.radius=Math.max(300,Math.min(2100,550+250*Math.log10(Math.max(1,maxSize/1000))));
  this.updateCamera();this.resize();
  this.running=true;this.tick();
  this.loadTexture(baseUrl).catch(e=>this.status('Textura no disponible: '+e.message));
 }
 mapPoint(i,t=0){
  const d=this.dem;const j=this.hydro?.receiver?.[i]??-1;
  const i2=(j>=0&&j<d.data.length&&Number.isFinite(d.data[j]))?j:i;
  const x1=d.x0+(i%d.width+.5)*d.dx,y1=d.y0-(Math.floor(i/d.width)+.5)*d.dy;
  const x2=d.x0+(i2%d.width+.5)*d.dx,y2=d.y0-(Math.floor(i2/d.width)+.5)*d.dy;
  const a=d.data[i],b=d.data[i2],z=Number.isFinite(a)&&Number.isFinite(b)?a+(b-a)*t:this.zMin;
  return new this.THREE.Vector3(((x1+(x2-x1)*t)-this.cx)/this.unit,Math.max(0,z-this.zMin)*this.exaggeration/this.unit+1,((y1+(y2-y1)*t)-this.cy)/this.unit);
 }
 construct(){
  const T=this.THREE,d=this.dem;
  this.clearTexture();this.surface?.geometry?.dispose();this.surface?.material?.dispose();
  if(this.surface)this.scene.remove(this.surface);
  if(this.points){this.scene.remove(this.points);this.points.geometry.dispose();this.points.material.dispose();this.points=null;}
  this.cx=d.x0+d.width*d.dx/2;this.cy=d.y0-d.height*d.dy/2;
  this.unit=Math.max(d.width*d.dx,d.height*d.dy)/850;
  let lo=Infinity,hi=-Infinity;for(const z of d.data)if(Number.isFinite(z)){lo=Math.min(lo,z);hi=Math.max(hi,z);}
  if(!Number.isFinite(lo))throw Error('El MDT carece de elevaciones válidas.');
  this.zMin=lo;this.zMax=hi;
  const nx=Math.max(2,Math.min(256,d.width)),ny=Math.max(2,Math.min(256,d.height));
  const pos=new Float32Array(nx*ny*3),color=new Float32Array(nx*ny*3),uv=new Float32Array(nx*ny*2),valid=new Uint8Array(nx*ny);
  for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
   const col=Math.min(d.width-1,Math.round(x/(nx-1)*(d.width-1))),row=Math.min(d.height-1,Math.round(y/(ny-1)*(d.height-1)));
   const idx=row*d.width+col,z=d.data[idx],k=y*nx+x;
   const px=d.x0+(col+.5)*d.dx,py=d.y0-(row+.5)*d.dy;
   pos[k*3]=(px-this.cx)/this.unit;pos[k*3+1]=(Number.isFinite(z)?z-lo:0)*this.exaggeration/this.unit;pos[k*3+2]=(py-this.cy)/this.unit;
   valid[k]=Number.isFinite(z)?1:0;
   const t=Number.isFinite(z)?Math.min(1,Math.max(0,(z-lo)/(hi-lo||1))):0;
   color[k*3]=.25+.38*t;color[k*3+1]=.39+.38*t;color[k*3+2]=.31+.24*t;
   uv[k*2]=x/(nx-1);uv[k*2+1]=1-y/(ny-1);
  }
  const indices=[];
  for(let y=0;y<ny-1;y++)for(let x=0;x<nx-1;x++){
   const a=y*nx+x,b=a+1,c=a+nx,d1=c+1;
   if(valid[a]&&valid[b]&&valid[c])indices.push(a,b,c);
   if(valid[b]&&valid[c]&&valid[d1])indices.push(b,d1,c);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));
  geometry.setAttribute('color',new T.BufferAttribute(color,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const mat=new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,side:T.DoubleSide,transparent:false,opacity:1});
  this.surface=new T.Mesh(geometry,mat);this.scene.add(this.surface);
  this.target=new T.Vector3(0,Math.max(0,(hi-lo)*this.exaggeration/this.unit)*.24,0);
 }
 setExaggeration(v){
  this.exaggeration=Math.max(.5,Math.min(15,+v||3));
  if(this.dem){const theta=this.theta,phi=this.phi,radius=this.radius;this.construct();this.theta=theta;this.phi=phi;this.radius=radius;this.updateCamera();if(this.baseUrl)this.loadTexture(this.baseUrl);}
 }
 setOpacity(v){this.baseOpacity=Math.max(0,Math.min(1,+v));if(this.textureMesh)this.textureMesh.material.opacity=this.baseOpacity;}
 clearTexture(){if(this.textureMesh){this.scene.remove(this.textureMesh);this.textureMesh.material.map?.dispose();this.textureMesh.material.dispose();this.textureMesh=null;}}
 async loadTexture(url){
  if(!this.surface||!this.dem||!url)return;
  const d=this.dem,T=this.THREE,stamp=this.surface,opacity=this.baseOpacity;
  const requestId=++this.textureRequest;
  this.clearTexture();this.status('Preparando mapa de fondo para el terreno 3D…');
  // Imagen de 1024 px sobre el mismo rectángulo del MDT: composición de teselas web Mercator.
  const lonlat=(x,y)=>{const v=toLatLng(d,x,y);return [v[1],v[0]];};
  const corners=[[d.x0,d.y0],[d.x0+d.width*d.dx,d.y0],[d.x0,d.y0-d.height*d.dy],[d.x0+d.width*d.dx,d.y0-d.height*d.dy]].map(([x,y])=>lonlat(x,y));
  const tile=(lon,lat,z)=>{
   const n=2**z,px=(lon+180)/360*n,py=(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,lat))*Math.PI/180))/Math.PI)/2*n;
   return [px,py];
  };
  let zoom=14,bbox;for(;zoom>=2;zoom--){const ps=corners.map(([lon,lat])=>tile(lon,lat,zoom)),xs=ps.map(p=>p[0]),ys=ps.map(p=>p[1]);bbox=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];if((Math.ceil(bbox[2])-Math.floor(bbox[0]))*(Math.ceil(bbox[3])-Math.floor(bbox[1]))<=36)break;}
  const minX=Math.floor(bbox[0]),minY=Math.floor(bbox[1]),maxX=Math.ceil(bbox[2]),maxY=Math.ceil(bbox[3]);
  const width=1024,height=1024,canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#506355';ctx.fillRect(0,0,width,height);
  const tasks=[];let painted=0;
  for(let x=minX;x<maxX;x++)for(let y=minY;y<maxY;y++){
   const zz=2**zoom;
   const src=url.replaceAll('{z}',String(zoom)).replaceAll('{x}',String(x)).replaceAll('{-y}',String(zz-1-y)).replaceAll('{y}',String(y));
   const px=(x-bbox[0])/(bbox[2]-bbox[0])*width,py=(y-bbox[1])/(bbox[3]-bbox[1])*height;
   const tw=width/(bbox[2]-bbox[0]),th=height/(bbox[3]-bbox[1]);
   tasks.push(new Promise(resolve=>{
    const img=new Image();img.crossOrigin='anonymous';let settled=false;
    const finish=()=>{if(!settled){settled=true;clearTimeout(timeout);resolve();}};
    const timeout=setTimeout(()=>{img.onload=null;img.onerror=null;finish();},6000);
    img.onload=()=>{if(!settled){try{ctx.drawImage(img,px,py,tw+.7,th+.7);painted++;}catch{}}finish();};
    img.onerror=finish;img.src=src;
   }));
  }
  await Promise.all(tasks);
  if(this.surface!==stamp||this.textureRequest!==requestId)return;
  if(!painted){this.status('Textura 3D no disponible desde ese servicio. Se mantiene el relieve con sombreado.');return;}
  try{
   // Si el servidor no permite CORS, la comprobación detecta canvas contaminado.
   canvas.toDataURL('image/png');
   const uv=stamp.geometry.getAttribute('uv'),arr=uv.array,verts=stamp.geometry.getAttribute('position'),p=verts.array;
   for(let i=0;i<uv.count;i++){
    const x=this.cx+p[i*3]*this.unit,y=this.cy+p[i*3+2]*this.unit;
    const [lon,lat]=lonlat(x,y),[tx,ty]=tile(lon,lat,zoom);
    arr[i*2]=(tx-bbox[0])/(bbox[2]-bbox[0]);
    arr[i*2+1]=1-(ty-bbox[1])/(bbox[3]-bbox[1]);
   }
   uv.needsUpdate=true;
   const tex=new T.CanvasTexture(canvas);tex.colorSpace=T.SRGBColorSpace;
   const textureMaterial=new T.MeshBasicMaterial({map:tex,transparent:true,opacity:opacity,side:T.DoubleSide,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
   this.textureMesh=new T.Mesh(stamp.geometry,textureMaterial);this.scene.add(this.textureMesh);
   this.status('Terreno 3D texturizado con el mapa base seleccionado.');
  }catch(e){this.status('El proveedor no permite usar sus teselas como textura WebGL. El relieve 3D se muestra con colores de altitud.');}
 }
 drawParticles(){
  const a=this.animator, h=this.hydro,d=this.dem;
  if(!a?.particles?.length||!h?.receiver||a.d!==d){
   if(this.points)this.points.visible=false;return;
  }
  const T=this.THREE,positions=new Float32Array(a.particles.length*3);
  for(let k=0;k<a.particles.length;k++){
   const p=a.particles[k],v=this.mapPoint(p.i,p.t);
   positions[k*3]=v.x;positions[k*3+1]=v.y+2;positions[k*3+2]=v.z;
  }
  if(!this.points||this.points.geometry.getAttribute('position').count!==a.particles.length){
   if(this.points){this.scene.remove(this.points);this.points.geometry.dispose();this.points.material.dispose();}
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(positions,3));
   this.points=new T.Points(geo,new T.PointsMaterial({color:0x45d6ff,size:6,sizeAttenuation:false,transparent:true,opacity:.92,depthWrite:false}));
   this.scene.add(this.points);
  }else{const buf=this.points.geometry.getAttribute('position');buf.array.set(positions);buf.needsUpdate=true;}
  this.points.visible=true;
 }
 tick(){
  if(!this.running)return;
  this.drawParticles();this.renderer.render(this.scene,this.camera);
  this.frame=requestAnimationFrame(()=>this.tick());
 }
 close(){this.running=false;if(this.frame)cancelAnimationFrame(this.frame);this.el.classList.remove('shown');}
 destroy(){
  this.close();window.removeEventListener('resize',this.onResize);
  this.clearTexture();this.surface?.geometry.dispose();this.surface?.material.dispose();
  this.points?.geometry.dispose();this.points?.material.dispose();
  this.renderer?.dispose();this.el.remove();
 }
}
