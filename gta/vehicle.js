/* OcToS GTA · BMW E46 Touring: control arcade con deriva de dos ejes.
   Neumáticos con ángulo de deslizamiento y agarre lateral limitado,
   además de inercia de guiñada y velocidad lateral independiente.
   No usa datos ni código propietario de Assetto Corsa. */
export const VEHICLE = Object.freeze({
  wheelbase: 2.715, wheelRadius: .324,
  powerCV: 300, drivetrainEfficiency: .85, peakDriveForce: 14500,
  reverseAcceleration: 2.82, changeDirectionBrake: 14,
  reverseMax: -12, maxSpeed: 63, steeringSmoothing: 7.5,
  steeringFullHoldSeconds: .85,
  rearLockDeceleration: 1.1,
  rearLockGrip: .16
});
const DYNAMICS=Object.freeze({
  mass:1600, yawInertia:3250, rearDriveGripForce: 9300,
  frontArm:1.33, rearArm:VEHICLE.wheelbase-1.33,
  frontCornering:49000, rearCornering:53000,
  frontPeakForce:7800, rearPeakForce:7700,
  maxYawAcceleration:1.5, maxDriftYawRate:.9,
  lateralDamping:2.0, yawRecovery:3.0, stabilityAssist:.2
});
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export const initialDriving=()=>({
  speed:0,steer:0,spin:0,rearSpin:0,rearLocked:false,
  slip:0,yawRate:0,rearGripLoss:0,wheelSlip:0,driftActive:false,steerHold:0,steerDirection:0
});
/* Al pisar Space, la inercia del coche continúa hacia delante mientras
   se bloquea la rotación de ruedas traseras y baja su adherencia lateral.
   Las ruedas delanteras conservan agarre, giro y rotación libres.
   "slip" es velocidad lateral del centro de masas en m/s (derecha+).
   "yawRate" es velocidad angular en rad/s (giro a la izquierda+). */
export function stepDriving(car,input,elapsed) {
  const dt=clamp(elapsed,0,.05);
  const before=car.speed;
  const handbrake=Boolean(input.handbrake);
  const throttle=clamp(Number(input.forward)||0,0,1);
  const reverse=clamp(Number(input.reverse)||0,0,1);
  let wheelSlipTarget=0;
  if(handbrake){
    // Freno de mano solo trasero: bloqueo y ausencia de impulso.
    const deceleration=Math.min(Math.abs(car.speed),VEHICLE.rearLockDeceleration*dt);
    car.speed-=Math.sign(car.speed)*deceleration;
  } else if(throttle){
    if(car.speed<0){
      car.speed+=VEHICLE.changeDirectionBrake*throttle*dt;
    }else{
      // 300 CV al cigüeñal, pérdidas de transmisión y fuerza limitada por
      // potencia a velocidad alta: F = P / v. El par domina la salida.
      const powerWatts=VEHICLE.powerCV*735.5*VEHICLE.drivetrainEfficiency;
      const demandForce=throttle*Math.min(
        VEHICLE.peakDriveForce,powerWatts/Math.max(car.speed,8)
      );
      // Solo las ruedas traseras transmiten la fuerza al suelo.
      // Al girar hay menos agarre longitudinal disponible.
      const cornerLoad=clamp(Math.abs(car.steer)/.45,0,1);
      const tractionForce=DYNAMICS.rearDriveGripForce*(1-.29*cornerLoad);
      const deliveredForce=Math.min(demandForce,tractionForce);
      const excessForce=Math.max(0,demandForce-tractionForce);
      wheelSlipTarget=clamp(excessForce/tractionForce*1.12,0,1);
      const aeroAndRollingDrag=180+.48*car.speed*car.speed;
      car.speed=Math.max(0,car.speed+(deliveredForce-aeroAndRollingDrag)/DYNAMICS.mass*dt);
    }
  } else if(reverse){
    car.speed-=dt*(car.speed>0?VEHICLE.changeDirectionBrake:VEHICLE.reverseAcceleration)*reverse;
  } else {
    // Inercia real: al levantar el acelerador no pierde 30 km/h en un segundo.
    const speedAbs=Math.abs(car.speed);
    const rollingAndDrag=.25+.0011*speedAbs*speedAbs;
    car.speed-=Math.sign(car.speed)*Math.min(speedAbs,rollingAndDrag*dt);
    if(Math.abs(car.speed)<.012)car.speed=0;
  }
  car.speed=clamp(car.speed,VEHICLE.reverseMax,VEHICLE.maxSpeed);
  // Inercia de las ruedas motrices: patinan al pisar fuerte R2/W, y recuperan
  // adherencia al levantar el pie. No se aplica a las ruedas delanteras.
  car.wheelSlip??=0;
  car.wheelSlip+=(wheelSlipTarget-car.wheelSlip)*
    (1-Math.exp(-dt*(wheelSlipTarget>car.wheelSlip?11:4.5)));
  car.wheelSlip=clamp(car.wheelSlip,0,1);
  // Teclado y joystick comparten la misma dirección progresiva (~0,85 s).
  // El joystick conserva todo su recorrido analógico y su sensibilidad:
  // el desplazamiento controla la magnitud; el tiempo limita su entrada.
  const analog=Number.isFinite(input.analogSteer);
  const direction=analog?clamp(input.analogSteer,-1,1):
    Number(!!input.left)-Number(!!input.right);
  const steerSign=Math.sign(direction);
  if(!steerSign){car.steerHold=0;car.steerDirection=0;}
  else {
    // Una inversión del stick reinicia el crecimiento, sin salto de volante.
    if(car.steerDirection!==steerSign)car.steerHold=0;
    car.steerDirection=steerSign;
    car.steerHold=Math.min(VEHICLE.steeringFullHoldSeconds,(car.steerHold||0)+dt);
  }
  const hold=steerSign?car.steerHold/VEHICLE.steeringFullHoldSeconds:0;
  const smoothHold=hold*hold*(3-2*hold);
  const steerLimit=.58/(1+Math.abs(car.speed)/28);
  const desired=direction*steerLimit*(.12+.88*smoothHold);
  car.steer+=(desired-car.steer)*(1-Math.exp(-dt*VEHICLE.steeringSmoothing));
  car.rearLocked=handbrake;
  car.rearGripLoss??=0;
  car.yawRate??=car.speed/VEHICLE.wheelbase*Math.tan(car.steer);
  // El bloqueo del freno de mano y el exceso de gas reducen agarre trasero.
  // Un patinaje longitudinal real también disminuye la fuerza lateral.
  const target=handbrake?1:clamp(car.wheelSlip*.78,0,.78);
  car.rearGripLoss+=(target-car.rearGripLoss)*
    (1-Math.exp(-dt*(target>car.rearGripLoss?9:2.7)));
  car.rearGripLoss=clamp(car.rearGripLoss,0,1);
  // Derrape por potencia sin necesidad de tocar el freno de mano.
  if(car.rearGripLoss>.025)car.driftActive=true;
  const v=car.speed;
  const idealYaw=v/VEHICLE.wheelbase*Math.tan(car.steer);

  if(!car.driftActive) {
    // Sin derrape: respuesta V1 idéntica incluso a baja velocidad y marcha atrás.
    car.yawRate=idealYaw;
    car.slip*=Math.exp(-dt*5.5);
  } else if(v<2.5) {
    // Durante un derrape y a muy baja velocidad se recupera estabilidad.
    car.yawRate+=(idealYaw-car.yawRate)*(1-Math.exp(-dt*5.5));
    car.slip*=Math.exp(-dt*5.5);
    if(!handbrake&&car.rearGripLoss<.025)car.driftActive=false;
  } else if(car.rearGripLoss<.015 && Math.abs(car.slip)<.11 &&
            Math.abs(car.yawRate-idealYaw)<.11) {
    // Recuperación terminada: volver al comportamiento validado sin salto.
    car.driftActive=false;
    car.yawRate=idealYaw;
    car.slip*=Math.exp(-dt*5.5);
  } else {
    // Modelo dinámico de dos ejes: fuerzas laterales delanteras y traseras
    // separadas, saturación de agarre, inercia y asistencia de estabilidad.
    const substeps=Math.max(1,Math.ceil(dt/.0125));
    const h=dt/substeps;
    for(let i=0;i<substeps;i++){
      const u=Math.max(Math.abs(v),2.5);
      const frontAngle=car.steer+Math.atan2(car.slip-DYNAMICS.frontArm*car.yawRate,u);
      const rearAngle=Math.atan2(car.slip+DYNAMICS.rearArm*car.yawRate,u);
      const frontForce=clamp(DYNAMICS.frontCornering*frontAngle,
        -DYNAMICS.frontPeakForce,DYNAMICS.frontPeakForce);
      const rearLimit=DYNAMICS.rearPeakForce*
        (1-(1-VEHICLE.rearLockGrip)*car.rearGripLoss);
      const rearForce=clamp(DYNAMICS.rearCornering*rearAngle,-rearLimit,rearLimit);
      // La ayuda de contravolante permite estabilizar el coche sin eliminar
      // el desplazamiento lateral: no se fuerza el vector de movimiento al eje.
      let yawAccel=(DYNAMICS.frontArm*frontForce-DYNAMICS.rearArm*rearForce)/
        DYNAMICS.yawInertia-.42*car.yawRate;
      yawAccel+=DYNAMICS.yawRecovery*(idealYaw-car.yawRate)*
        (1-.5*car.rearGripLoss)-DYNAMICS.stabilityAssist*car.slip;
      const nextYaw=car.yawRate+clamp(yawAccel,
        -DYNAMICS.maxYawAcceleration,DYNAMICS.maxYawAcceleration)*h;
      // Si al entrar al drift se giraba más rápido que este límite,
      // reducir la rotación progresivamente, sin salto instantáneo.
      const yawCap=Math.max(DYNAMICS.maxDriftYawRate,
        Math.abs(car.yawRate)-DYNAMICS.maxYawAcceleration*h);
      car.yawRate=clamp(nextYaw,-yawCap,yawCap);
      const lateralAccel=v*car.yawRate-
        (frontForce+rearForce)/DYNAMICS.mass-DYNAMICS.lateralDamping*car.slip;
      car.slip=clamp(car.slip+lateralAccel*h,-Math.abs(v)*.5,Math.abs(v)*.5);
    }
  }
  if(!Number.isFinite(car.yawRate)||!Number.isFinite(car.slip)){
    car.yawRate=idealYaw;car.slip=0;
  }
  const distance=v*dt;
  car.spin-=distance/VEHICLE.wheelRadius;
  // El eje delantero acompaña la marcha; el trasero gira más deprisa
  // cuando pierde tracción. En bloqueo por freno de mano permanece parado.
  if(!car.rearLocked) {
    const tireSpinDistance=car.wheelSlip*18*dt;
    car.rearSpin-=(distance+tireSpinDistance)/VEHICLE.wheelRadius;
  }
  return {
    distance,slipDistance:car.slip*dt,headingDelta:car.yawRate*dt,
    slipAngle:Math.atan2(car.slip,Math.max(Math.abs(v),.1)),
    changed:car.speed!==before||!!direction
  };
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
    update(steer,spin,rearSpin=spin){
      for(const w of wheels){
        w.steering.rotation.y=w.front?steer:0;
        w.rolling.rotation.x=w.front?spin:rearSpin;
      }
    },
    dispose(){root.traverse(item=>item.geometry?.dispose());for(const m of materials)m.dispose();}
  };
}
