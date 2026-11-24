import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Only the scene-root transform changes; preserve all binary chunks, materials,
// accessors, animations, extensions and node indices in the source GLB.
export function rotateGLB(buffer, quaternion) {
  const v = new DataView(buffer);
  if (buffer.byteLength < 20 || v.getUint32(0,true)!==0x46546c67 || v.getUint32(4,true)!==2 || v.getUint32(8,true)!==buffer.byteLength || v.getUint32(16,true)!==0x4e4f534a) throw Error('GLB 2.0 no válido.');
  const end=20+v.getUint32(12,true);
  if(end>buffer.byteLength) throw Error('GLB incompleto.');
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,end-20)));
  if(!Array.isArray(json.scenes)||!json.scenes.length) throw Error('El GLB no tiene escenas.');
  json.nodes ||= [];
  for(const scene of json.scenes){
    if(!scene.nodes?.length) continue;
    const children=scene.nodes;
    scene.nodes=[json.nodes.length];
    json.nodes.push({name:'OcToS orientation',rotation:quaternion.toArray(),children});
  }
  const bytes=new TextEncoder().encode(JSON.stringify(json));
  const padded=Math.ceil(bytes.length/4)*4;
  const result=new Uint8Array(20+padded+buffer.byteLength-end);
  if(result.length>5000000) throw Error('El GLB orientado supera el límite de 5 MB.');
  const out=new DataView(result.buffer);
  out.setUint32(0,0x46546c67,true);out.setUint32(4,2,true);out.setUint32(8,result.length,true);
  out.setUint32(12,padded,true);out.setUint32(16,0x4e4f534a,true);
  result.fill(32,20,20+padded);result.set(bytes,20);result.set(new Uint8Array(buffer,end),20+padded);
  return new Blob([result],{type:'model/gltf-binary'});
}

export async function createOrientation(host, buffer) {
  const canvas=host.querySelector('canvas');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setClearColor(0x101114);
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(40,1,.01,1000);
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;
  const root=new THREE.Group();scene.add(root);
  scene.add(new THREE.HemisphereLight(0xffffff,0x555566,2));
  const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(3,6,4);scene.add(light);
  const draco=new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/libs/draco/gltf/');
  const loader=new GLTFLoader().setDRACOLoader(draco);
  let frame=0,observer,closed=false;
  const inputs=[...host.querySelectorAll('[data-angle]')];
  const handlers=[];
  function on(element,event,fn){element.addEventListener(event,fn);handlers.push(()=>element.removeEventListener(event,fn));}
  function dispose(){
    if(closed)return;closed=true;cancelAnimationFrame(frame);observer?.disconnect();controls.dispose();draco.dispose();
    const materials=new Set(),textures=new Set(),geometries=new Set();
    root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]))if(m){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
    geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
    handlers.forEach(f=>f());renderer.dispose();
  }
  try {
    const gltf=await loader.parseAsync(buffer,'');
    root.add(gltf.scene);
    const bounds=new THREE.Box3().setFromObject(root);
    if(bounds.isEmpty()) throw Error('El modelo no contiene geometría visible.');
    const center=bounds.getCenter(new THREE.Vector3());
    const size=Math.max(bounds.getSize(new THREE.Vector3()).length(),.001);
    // Rotate about the file origin; camera follows the rotated bounding centre.
    const axes=new THREE.AxesHelper(size*.65);scene.add(axes);
    camera.near=Math.max(size*.0001,.000001);camera.far=size*100+center.length()*4;camera.updateProjectionMatrix();
    controls.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,.75,1.3).normalize().multiplyScalar(size*1.8));
    controls.update();
    function apply(){
      const previous=controls.target.clone();
      root.rotation.set(...inputs.map(i=>THREE.MathUtils.degToRad(Number(i.value)||0)),'XYZ');
      controls.target.copy(center).applyQuaternion(root.quaternion);
      camera.position.add(controls.target.clone().sub(previous));controls.update();
    }
    for(const i of inputs){i.value='0';on(i,'input',apply);}
    for(const b of host.querySelectorAll('[data-turn]'))on(b,'click',()=>{const i=inputs[Number(b.dataset.axis)];i.value=String(((Number(i.value)||0)+Number(b.dataset.turn))%360);apply();});
    on(host.querySelector('[data-reset]'),'click',()=>{inputs.forEach(i=>i.value='0');apply();});
    function resize(){const w=canvas.clientWidth,h=canvas.clientHeight;if(w&&h){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}}
    observer=new ResizeObserver(resize);observer.observe(canvas);resize();
    function draw(){if(closed)return;controls.update();renderer.render(scene,camera);frame=requestAnimationFrame(draw);}draw();
    return {dispose, getFile(){if(inputs.some(i=>!Number.isFinite(Number(i.value))))throw Error('Ángulo no válido.');apply();return Math.abs(root.quaternion.w)>1-1e-12?undefined:rotateGLB(buffer,root.quaternion);}};
  } catch(error){dispose();throw error;}
}
