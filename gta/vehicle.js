/* OcToS GTA · BMW E46 Touring: geometría exacta del prototipo y su cinemática aprobada.
   Sin física adicional en conducción normal; solo se añade un freno de mano arcade. */
export const VEHICLE = Object.freeze({
  wheelbase: 2.715, wheelRadius: .324,
  acceleration: 4.5, reverseAcceleration: 2.82, changeDirectionBrake: 14,
  reverseMax: -12, maxSpeed: 37, steeringSmoothing: 7.5,
  steeringFullHoldSeconds: 0.85
});
const clamp = (v,lo,hi) => Math.max(lo,Math.min(hi,v));
export const initialDriving = () => ({speed:0, steer:0, spin:0, slip:0, steerHold:0, steerDirection:0});

/* Entrada de mando: left/right = 0 o 1; headingDelta está en RADIANES de la prueba.
   Mantener las mismas fórmulas, constantes y secuencia cuando handbrake=false. */
export function stepDriving(car, input, elapsed) {
  const dt = clamp(elapsed,0,.05);
  const before = car.speed;
  if (input.forward) car.speed += dt * (car.speed < 0 ? VEHICLE.changeDirectionBrake : VEHICLE.acceleration);
  else if (input.reverse) car.speed -= dt * (car.speed > 0 ? VEHICLE.changeDirectionBrake : VEHICLE.reverseAcceleration);
  else {
    car.speed *= Math.exp(-dt * (.44 + Math.abs(car.speed) * .009));
    if (Math.abs(car.speed) < .012) car.speed = 0;
  }
  car.speed = clamp(car.speed, -12, 37);
  const direction = Number(!!input.left) - Number(!!input.right);
  // Un toque da un pequeño giro; mantener la tecla aumenta progresivamente
  // el ángulo hasta el máximo. Cambiar de lado reinicia la progresión.
  if (direction === 0) {
    car.steerHold = 0;
    car.steerDirection = 0;
  } else {
    if (car.steerDirection !== direction) car.steerHold = 0;
    car.steerDirection = direction;
    car.steerHold = Math.min(VEHICLE.steeringFullHoldSeconds, (car.steerHold || 0) + dt);
  }
  const hold = direction ? car.steerHold / VEHICLE.steeringFullHoldSeconds : 0;
  const smoothHold = hold * hold * (3 - 2 * hold);
  const steerLimit = .58 / (1 + Math.abs(car.speed) / 28);
  const desired = direction * steerLimit * (.12 + .88 * smoothHold);
  car.steer += (desired - car.steer) * (1 - Math.exp(-dt * VEHICLE.steeringSmoothing));

  // Freno de mano independiente: se modifica el comportamiento SOLO durante su uso.
  // Retención extra y deriva lateral amortiguada; no hay derrape sin freno de mano.
  if (input.handbrake) {
    car.speed *= Math.exp(-dt * 2.6);
    car.slip = clamp(car.slip - car.steer * Math.abs(car.speed) * dt * 1.8, -3.5, 3.5);
  } else {
    car.slip *= Math.exp(-dt * 5.5);
    if (Math.abs(car.slip) < .005) car.slip = 0;
  }
  const headingDelta = car.speed / 2.715 * Math.tan(car.steer) * dt * (input.handbrake ? 1.30 : 1);
  const distance = car.speed * dt;
  car.spin -= distance / .324;
  return {distance, slipDistance:car.slip * dt, headingDelta, changed: car.speed!==before || !!direction};
}

const PARTS=Array.from({length:10},(_,i)=>'./vehicles/bmw_e46.part'+String(i).padStart(2,'0')+'.bin');
const META = './vehicles/bmw_e46.meta.json';
let modelPromise;
async function getGeometryBundle() {
  if (!modelPromise) modelPromise = (async () => {
    const [metaResponse,...partResponses] = await Promise.all([fetch(META),...PARTS.map(url=>fetch(url))]);
    if (!metaResponse.ok || partResponses.some(p=>!p.ok)) throw new Error('No se pudo cargar la carrocería original del BMW E46.');
    if (!('DecompressionStream' in window)) throw new Error('El navegador no admite la descompresión del BMW.');
    const meta=await metaResponse.json();
    const chunks=await Promise.all(partResponses.map(p=>p.arrayBuffer()));
    const raw=await new Response(new Blob(chunks).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    if (raw.byteLength!==meta.rawBytes) throw new Error('Los datos geométricos del BMW están incompletos.');
    return {meta, raw};
  })().catch(err=>{modelPromise=null;throw err;});
  return modelPromise;
}

export async function loadBMW(T) {
  const {meta,raw}=await getGeometryBundle();
  const root=new T.Group();
  const basis=new T.Group();
  basis.rotation.x=Math.PI/2; // Prototipo Y-up -> MapLibre/actor Z-up. Frente: +Y.
  root.add(basis);
  const wheels=meta.wheels.map((pos,i)=>{
    const steering=new T.Group(), rolling=new T.Group();
    steering.position.set(...pos);
    steering.add(rolling);
    basis.add(steering);
    return {steering,rolling,front: i===0||i===3};
  });
  const materials=meta.materials.map(m=>{
    const opacity=(m.name==='windowglass'?.48:m.name==='clearglass'?.50:m.name==='orangeglass'?.69:m.rgba[3]);
    const color=new T.Color().setRGB(m.rgba[0],m.rgba[1],m.rgba[2],T.LinearSRGBColorSpace);
    return new T.MeshStandardMaterial({
      color, metalness:clamp(m.metal,0,1)*.65, roughness:m.metal>.4?.28:.67,
      transparent:opacity<.99, opacity, depthWrite:opacity>=.99,
      side:T.DoubleSide
    });
  });
  const data=new DataView(raw);
  for (const r of meta.records) {
    const positions=new Float32Array(r.vn*3);
    const normals=new Int8Array(r.vn*3);
    for(let i=0;i<r.vn;i++){
      const o=r.vo+i*16,p=i*3;
      positions[p]=data.getFloat32(o,true);positions[p+1]=data.getFloat32(o+4,true);positions[p+2]=data.getFloat32(o+8,true);
      normals[p]=data.getInt8(o+12);normals[p+1]=data.getInt8(o+13);normals[p+2]=data.getInt8(o+14);
    }
    const indices=new Uint16Array(r.in);
    for(let i=0;i<r.in;i++)indices[i]=data.getUint16(r.io+i*2,true);
    const geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(positions,3));
    geometry.setAttribute('normal',new T.BufferAttribute(normals,3,true));
    geometry.setIndex(new T.BufferAttribute(indices,1));
    const mesh=new T.Mesh(geometry,materials[r.mat]);
    mesh.frustumCulled=false;
    (r.wheel<0?basis:wheels[r.wheel].rolling).add(mesh);
  }
  return {
    group:root,
    update(steer,spin){for(const w of wheels){w.steering.rotation.y=w.front?steer:0;w.rolling.rotation.x=spin;}},
    dispose(){root.traverse(item=>item.geometry?.dispose());for(const m of materials)m.dispose();}
  };
}
