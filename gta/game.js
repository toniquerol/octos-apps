/* OcToS GTA · personaje y primer vehículo independiente. */
import {stepDriving,initialDriving} from './vehicle.js?v=8';
const STORAGE_KEY = 'octos-gta-v1-save';
const CAMERA_STORAGE_KEY = 'octos-gta-car-cameras';
const DEFAULT = {lat: 41.3874, lon: 2.1701, heading: 0, mode: 'walk', place: 'Barcelona'};
const RAD = Math.PI / 180;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const cameraAngleDelta=(from,to)=>((to-from+540)%360+360)%360-180;
// Cada cámara usa ejes relativos al vehículo y a su rumbo, en metros.
const CAR_CAMERAS=Object.freeze([
  Object.freeze({behind:6,side:0,above:6,orbit:0,lookAhead:0}),
  Object.freeze({behind:12,side:0,above:12,orbit:0,lookAhead:0}),
  Object.freeze({behind:4,side:0,above:24,orbit:0,lookAhead:0})
]);
const CAMERA_LIMITS=Object.freeze({
  behind:[-10,50],side:[-20,20],above:[1,60],orbit:[-180,180],lookAhead:[-10,35]
});
function normalizedCamera(source,fallback){
  const result={};
  for(const key of Object.keys(CAMERA_LIMITS)){
    const value=source && Number.isFinite(source[key])?source[key]:fallback[key];
    result[key]=clamp(value,...CAMERA_LIMITS[key]);
  }
  return result;
}
function readCameraPresets(){
  let saved;
  try{saved=JSON.parse(localStorage.getItem(CAMERA_STORAGE_KEY)||'null');}catch{}
  return CAR_CAMERAS.map((preset,index)=>normalizedCamera(Array.isArray(saved)?saved[index]:null,preset));
}
const CAR_CAMERA=Object.freeze({
  bearingSmooth:4.6, distanceSmooth:4.2,
  screenTopFraction:.40,
  recenterDelayMs:900, recenterSmooth:2.0
});

export function readSave() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (data && Number.isFinite(data.lat) && Number.isFinite(data.lon) &&
      Math.abs(data.lat) <= 85 && Math.abs(data.lon) <= 180) {
      return {
        ...DEFAULT, ...data, lat: data.lat, lon: data.lon,
        mode: data.mode === 'car' ? 'car' : 'walk',
        heading: Number.isFinite(data.heading) ? ((data.heading % 360) + 360) % 360 : 0,
        place: String(data.place || 'Coordenadas').slice(0, 80)
      };
    }
  } catch {}
  return {...DEFAULT};
}

export class Game {
  constructor(world, onUpdate, onFrame = () => {}) {
    this.world = world;
    this.map = world.map;
    this.onUpdate = onUpdate;
    this.onFrame = onFrame;
    this.state = readSave();
    const savedVehicle=this.state.vehicle;
    delete this.state.vehicle;
    this.vehicle = savedVehicle && Number.isFinite(savedVehicle.lat) && Number.isFinite(savedVehicle.lon)
      ? {...savedVehicle, heading:Number(savedVehicle.heading)||0}
      : null;
    this.driving = initialDriving();
    this.controller = null;
    this.padPaused = false;
    this.jumpHeight = 0;
    this.jumpVelocity = 0;
    this.jumpQueued = false;
    this.aiming = false;
    this.cameraOffset = {yaw:0,pitch:0};
    this.carCamera = null;
    this.lastCameraStick = 0;
    this.onAction = () => {};
    this.cameraMode = 0;
    this.carCameras = readCameraPresets();
    this.keys = new Set();
    this.speed = 0; // m/s, con signo si el vehículo circula marcha atrás
    // Las dos vistas permanecen detrás del personaje; V solo varía la distancia.
    this.view = 'follow';
    // Vista a pie próxima; conducción un nivel de zoom más alejada.
    this.cameraZoom = {walk: 23, car: 21.55};
    this.active = false;
    this.timer = null;
    this.lastTime = performance.now();
    this.lastHud = 0;
    this.lastSave = 0;
    this.fps = 30;
    this.onKeyDown = event => {
      if (!this.active || document.body.classList.contains('editing')) return;
      if (event.target?.closest?.('input,select,textarea,button,[contenteditable="true"]')) return;
      if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyC','ShiftLeft','ShiftRight',
        'Space','KeyV','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat && ['KeyE','KeyC','KeyV'].includes(event.code)) return;
      if (event.code === 'KeyE' && (this.state.mode === 'car' || this.nearVehicle())) {
        if (!event.repeat) this.toggleVehicle();
      } else if (event.code === 'KeyC' && this.state.mode === 'car') {
        if (!event.repeat) this.cycleCamera();
      } else if (event.code === 'KeyV') {
        if (!event.repeat) this.toggleView();
      } else if (event.code === 'Space' && this.state.mode === 'walk') {
        if (!event.repeat) this.jumpQueued = true;
      } else if (event.code !== 'Space' || this.state.mode === 'car') {
        this.keys.add(event.code);
      }
    };
    this.onKeyUp = event => this.keys.delete(event.code);
    this.onWheel = event => {
      if (!this.active || !event.target?.closest?.('#map')) return;
      event.preventDefault();
      if (!event.deltaY) return;
      const amount = Math.min(1, Math.max(.25, Math.abs(event.deltaY) / 120)) * .27;
      const mode = this.state.mode;
      this.cameraZoom[mode] = clamp(this.cameraZoom[mode] - Math.sign(event.deltaY) * amount, 20.5, 24);
      this.updateCamera(1/30);
    };
    this.onBlur = () => { this.keys.clear(); this.speed = 0; this.driving.speed=0; this.driving.slip=0; this.driving.yawRate=0; this.driving.rearGripLoss=0; this.driving.driftActive=false; this.driving.rearLocked=false; this.emit(true); };
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('wheel', this.onWheel, {passive: false});
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.onBlur();
    });
  }

  attachController(controller) {
    this.controller = controller;
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.lastTime = performance.now();
    this.carCamera = null; // Reenfocar al volver desde el editor.
    this.timer = setInterval(() => this.tick(), Math.round(1000 / this.fps));
    if (!this.vehicle) this.parkNearPlayer();
    this.updateCamera();
    this.emit(true);
  }

  pause() {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.timer);
    this.timer = null;
    this.keys.clear();
    this.speed = 0;
    this.driving.speed=0; this.driving.slip=0;
    this.driving.yawRate=0; this.driving.rearGripLoss=0; this.driving.driftActive=false; this.driving.rearLocked=false;
    this.padPaused=false;this.jumpQueued=false;this.jumpHeight=0;this.jumpVelocity=0;
    this.emit(true);
  }

  resume() {
    this.start();
  }

  setQuality(level) {
    this.fps = this.world.quality(level);
    if (this.active) {
      clearInterval(this.timer);
      this.lastTime = performance.now();
      this.timer = setInterval(() => this.tick(), Math.round(1000 / this.fps));
    }
  }

  tick() {
    if (!this.active || document.hidden) return;
    const now = performance.now();
    const dt = clamp((now - this.lastTime) / 1000, 0, 0.08);
    this.lastTime = now;
    if (dt <= 0) return;
    // Leer el mando directamente en el ciclo del juego, sin emular WASD.
    const sampled=this.controller?.poll();
    const gamepadAllowed=!document.body.classList.contains('editing') &&
      document.getElementById('settings-panel')?.hidden!==false &&
      document.getElementById('controls-panel')?.hidden!==false &&
      document.getElementById('cameras-panel')?.hidden!==false;
    const pad=gamepadAllowed && sampled?.connected?sampled:null;
    if(pad?.pressed.pause){
      this.padPaused=!this.padPaused;
      this.onAction('pause',this.padPaused);
      this.keys.clear();
      if(!this.padPaused)this.lastTime=now;
    }
    if(this.padPaused)return;
    if(pad?.pressed.enter){this.toggleVehicle();return;}
    if(pad?.pressed.camera){this.cycleCamera();}

    const oldSpeed=this.speed;
    const oldSteer=this.driving.steer;
    const oldJump=this.jumpHeight;
    const keyboardForward=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-
      (this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0);
    const keyboardHorizontal=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-
      (this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0);
    const input=keyboardForward || -(pad?.moveY||0)*
      (this.controller?.config.movementSensitivity||1);
    const horizontal=keyboardHorizontal || (pad?.moveX||0)*
      (this.controller?.config.movementSensitivity||1);
    const turn=(this.keys.has('KeyE')?1:0)-(this.keys.has('KeyQ')?1:0);
    let forward=0,sideways=0;
    const previousHeading=this.state.heading;

    // El stick derecho desplaza la cámara de forma independiente del volante.
    let cameraChanged=false;
    if(pad && (Math.abs(pad.lookX)>.001||Math.abs(pad.lookY)>.001)){
      const sensitivity=this.controller?.config.cameraSensitivity||1;
      this.cameraOffset.yaw=(this.cameraOffset.yaw+pad.lookX*125*sensitivity*dt+540)%360-180;
      this.cameraOffset.pitch=clamp(this.cameraOffset.pitch+pad.lookY*80*sensitivity*dt,-55,45);
      this.lastCameraStick=now;
      cameraChanged=true;
    } else if(this.state.mode==='car' && now-this.lastCameraStick>CAR_CAMERA.recenterDelayMs){
      // La cámara libre vuelve suavemente a mirar al frente al soltar el stick.
      const factor=1-Math.exp(-dt*CAR_CAMERA.recenterSmooth);
      const oldYaw=this.cameraOffset.yaw,oldPitch=this.cameraOffset.pitch;
      this.cameraOffset.yaw*=1-factor;
      this.cameraOffset.pitch*=1-factor;
      if(Math.abs(this.cameraOffset.yaw)<.02)this.cameraOffset.yaw=0;
      if(Math.abs(this.cameraOffset.pitch)<.02)this.cameraOffset.pitch=0;
      cameraChanged=Math.abs(oldYaw-this.cameraOffset.yaw)>.00001||
        Math.abs(oldPitch-this.cameraOffset.pitch)>.00001;
    }

    if(this.state.mode==='walk'){
      if(pad?.pressed.interact) {
        if(this.nearVehicle()){this.toggleVehicle();return;}
        this.onAction('interact');
      }
      if(pad?.pressed.secondary)this.onAction('secondary');
      this.aiming=!!pad?.buttons.aim;
      if((pad?.pressed.jump||this.jumpQueued) && this.jumpHeight<.01){
        this.jumpVelocity=4.3;
      }
      this.jumpQueued=false;
      const running=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||!!pad?.buttons.run;
      const pace=running?4.2:1.8;
      const mag=Math.hypot(input,horizontal);
      const factor=mag>1?1/mag:1;
      forward=input*pace*dt*factor;
      sideways=horizontal*pace*dt*factor;
      this.speed=pace*Math.min(1,mag);
      this.state.heading=(this.state.heading+turn*115*dt+360)%360;
      if(this.jumpVelocity||this.jumpHeight){
        this.jumpHeight=Math.max(0,this.jumpHeight+this.jumpVelocity*dt);
        this.jumpVelocity-=10.8*dt;
        if(!this.jumpHeight)this.jumpVelocity=0;
      }
    }else{
      this.aiming=false;this.jumpQueued=false;this.jumpHeight=0;this.jumpVelocity=0;
      if(pad?.pressed.horn)this.onAction('horn');
      const forwardPower=keyboardForward>0?1:keyboardForward<0?0:(pad?.throttle||0);
      const reversePower=keyboardForward<0?1:keyboardForward>0?0:(pad?.brake||0);
      const analogSteer=keyboardHorizontal?undefined:pad?
        clamp(-pad.moveX*(this.controller?.config.steeringSensitivity||1),-1,1):undefined;
      const driveInput={
        forward:forwardPower>=reversePower?forwardPower:0,
        reverse:reversePower>forwardPower?reversePower:0,
        left:keyboardHorizontal<0,right:keyboardHorizontal>0,
        handbrake:this.keys.has('Space')||!!pad?.buttons.handbrake
      };
      if(analogSteer!==undefined)driveInput.analogSteer=analogSteer;
      const result=stepDriving(this.driving,driveInput,dt);
      this.speed=this.driving.speed;
      this.state.heading=((this.state.heading-result.headingDelta/RAD)%360+360)%360;
      forward=result.distance;
      sideways=result.slipDistance;
    }

    const moved = Math.abs(forward) + Math.abs(sideways) > 0.000001;
    const rotated = Math.abs(previousHeading - this.state.heading) > 0.00001;
    if (moved) {
      const heading = this.state.heading * RAD;
      const east = Math.sin(heading) * forward + Math.cos(heading) * sideways;
      const north = Math.cos(heading) * forward - Math.sin(heading) * sideways;
      this.state.lat = clamp(this.state.lat + north / 111320, -85, 85);
      const longitudeScale = Math.max(0.087, Math.cos(this.state.lat * RAD));
      this.state.lon += east / (111320 * longitudeScale);
      this.state.lon = ((this.state.lon + 180) % 360 + 360) % 360 - 180;
    }
    if (moved || rotated || cameraChanged || Math.abs(this.jumpHeight-oldJump)>.00001) {
      if (this.state.mode === 'car') Object.assign(this.vehicle,{
        lat:this.state.lat,lon:this.state.lon,heading:this.state.heading
      });
      this.updateCamera(dt);
      this.onFrame({...this.state,vehicle:this.vehicle,drive:this.driving,
        jumpHeight:this.jumpHeight,aiming:this.aiming});
      this.emit(now - this.lastHud >= 140);
      if (now - this.lastSave > 5000) this.save();
    } else if (Math.abs(this.speed - oldSpeed) > 0.001 || this.speed !== 0) {
      this.emit(now - this.lastHud >= 140 || this.speed === 0);
    }
    // Continuar el amortiguado de cámara tras detener el vehículo.
    if(this.state.mode==='car'&&!moved&&!rotated&&!cameraChanged)
      this.updateCamera(dt);
    // Actualizar el giro visible de las ruedas incluso con el coche detenido.
    if (!moved && !rotated && this.state.mode === 'car' &&
        Math.abs(this.driving.steer - oldSteer) > 0.000001) {
      this.onFrame({...this.state,vehicle:this.vehicle,drive:this.driving});
    }
  }

  updateCamera(dt=0) {
    const origin=[this.state.lon,this.state.lat]; // Única referencia visual.
    if(this.state.mode!=='car'){
      // El personaje ocupa el centro real de la pantalla.
      this.carCamera=null;
      this.map.jumpTo({
        center:origin,
        bearing:this.state.heading+this.cameraOffset.yaw,
        zoom:clamp(this.cameraZoom.walk-(this.view==='wide'?.75:0),20,24),
        pitch:clamp(69+this.cameraOffset.pitch,0,80),
        padding:{top:0,bottom:0,left:0,right:0}
      });
      return;
    }

    // Los desplazamientos se calculan desde el coche, nunca desde el mapa.
    const preset=this.carCameras[this.cameraMode]||this.carCameras[0];
    // Los ejes longitudinal/lateral giran con la dirección de avance del BMW.
    const distanceScale=2**(21.55-this.cameraZoom.car);
    const desiredBearing=this.state.heading+this.cameraOffset.yaw+preset.orbit;
    const target={behind:preset.behind*distanceScale,side:preset.side*distanceScale,
      above:preset.above*distanceScale,lookAhead:preset.lookAhead};
    let rig=this.carCamera;
    if(!rig||dt<=0){
      rig={bearing:desiredBearing,...target};
      this.carCamera=rig;
    }else{
      const rotation=1-Math.exp(-dt*CAR_CAMERA.bearingSmooth);
      const distance=1-Math.exp(-dt*CAR_CAMERA.distanceSmooth);
      rig.bearing+=cameraAngleDelta(rig.bearing,desiredBearing)*rotation;
      for(const axis of Object.keys(target))rig[axis]+=(target[axis]-rig[axis])*distance;
    }

    const heading=rig.bearing*RAD;
    const carHeading=this.state.heading*RAD;
    const cosLat=Math.max(.087,Math.cos(this.state.lat*RAD));
    const north=-Math.cos(heading)*rig.behind-Math.sin(heading)*rig.side;
    const east=-Math.sin(heading)*rig.behind+Math.cos(heading)*rig.side;
    const cameraLat=clamp(this.state.lat+north/111320,-85,85);
    const cameraLon=((this.state.lon+east/(111320*cosLat)+180)%360+360)%360-180;
    const lookLat=clamp(this.state.lat+Math.cos(carHeading)*rig.lookAhead/111320,-85,85);
    const lookLon=((this.state.lon+Math.sin(carHeading)*rig.lookAhead/(111320*cosLat)+180)%360+360)%360-180;
    const focus=[lookLon,lookLat];
    const terrain=this.world.elevation(this.state.lon,this.state.lat)??0;
    // Conservar el enfoque geométrico real sobre terreno y edificios.
    const options=this.map.calculateCameraOptionsFromTo(
      [cameraLon,cameraLat],terrain+rig.above,focus,terrain
    );
    const screenHeight=this.map.getContainer?.().clientHeight||720;
    this.map.jumpTo({
      center:focus,
      zoom:options.zoom,
      bearing:Number.isFinite(options.bearing)?options.bearing:rig.bearing,
      pitch:clamp(options.pitch+this.cameraOffset.pitch,0,80),
      padding:{top:Math.round(screenHeight*CAR_CAMERA.screenTopFraction),
        bottom:0,left:0,right:0}
    });
  }

  parkNearPlayer() {
    const heading=this.state.heading*RAD;
    const east=Math.sin(heading)*4.3+Math.cos(heading)*1.5;
    const north=Math.cos(heading)*4.3-Math.sin(heading)*1.5;
    const lat=clamp(this.state.lat+north/111320,-85,85);
    const lon=this.state.lon+east/(111320*Math.max(.087,Math.cos(lat*RAD)));
    this.vehicle={lat,lon,heading:this.state.heading};
  }

  nearVehicle() {
    if (!this.vehicle) return false;
    const latScale=111320;
    const east=(this.vehicle.lon-this.state.lon)*latScale*Math.max(.087,Math.cos(this.state.lat*RAD));
    const north=(this.vehicle.lat-this.state.lat)*latScale;
    return Math.hypot(east,north)<=5.5;
  }

  toggleVehicle() {
    if (this.state.mode==='walk') {
      if (!this.nearVehicle()) return;
      this.state.mode='car';
      Object.assign(this.state,{lat:this.vehicle.lat,lon:this.vehicle.lon,heading:this.vehicle.heading});
      this.cameraMode=0;
    } else {
      if (Math.abs(this.driving.speed)>1.2) return; // salir solo a baja velocidad
      const h=this.state.heading*RAD;
      const east=-Math.cos(h)*2.1, north=Math.sin(h)*2.1;
      this.state.mode='walk';
      this.state.lat=clamp(this.vehicle.lat+north/111320,-85,85);
      this.state.lon=this.vehicle.lon+east/(111320*Math.max(.087,Math.cos(this.state.lat*RAD)));
    }
    this.driving=initialDriving();
    this.speed=0;
    this.carCamera=null;this.lastCameraStick=0;
    this.jumpHeight=0;this.jumpVelocity=0;this.jumpQueued=false;
    this.cameraOffset={yaw:0,pitch:0};
    this.keys.clear();
    this.updateCamera();
    this.onFrame({...this.state,vehicle:this.vehicle,drive:this.driving});
    this.emit(true);
    this.save();
  }

  getCameraPresets(){
    return this.carCameras.map(camera=>({...camera}));
  }

  setCameraPreset(index,key,value){
    if(!Number.isInteger(index)||index<0||index>=this.carCameras.length ||
       !Object.hasOwn(CAMERA_LIMITS,key)||!Number.isFinite(value))return false;
    this.carCameras[index][key]=clamp(value,...CAMERA_LIMITS[key]);
    this.saveCameraPresets();
    if(index===this.cameraMode&&this.state.mode==='car'){
      this.carCamera=null;
      this.updateCamera();
    }
    return true;
  }

  resetCameraPreset(index){
    if(!Number.isInteger(index)||index<0||index>=CAR_CAMERAS.length)return false;
    this.carCameras[index]={...CAR_CAMERAS[index]};
    this.saveCameraPresets();
    if(index===this.cameraMode&&this.state.mode==='car'){
      this.carCamera=null;
      this.updateCamera();
    }
    return true;
  }

  saveCameraPresets(){
    try{localStorage.setItem(CAMERA_STORAGE_KEY,JSON.stringify(this.carCameras));}catch{}
  }

  selectCamera(index){
    if(!Number.isInteger(index)||index<0||index>=this.carCameras.length)return;
    this.cameraMode=index;
    this.updateCamera(this.state.mode==='car'?1/30:0);
    this.emit(true);
  }

  cycleCamera(){
    this.selectCamera((this.cameraMode+1)%this.carCameras.length);
  }

  toggleView(){
    if(this.state.mode==='car'){this.cycleCamera();return;}
    this.view=this.view==='follow'?'wide':'follow';
    this.updateCamera();
    this.emit(true);
  }

  teleport(lat, lon, place = 'Coordenadas') {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      Math.abs(lat) > 85 || Math.abs(lon) > 180) throw new Error('Coordenadas fuera del rango admitido.');
    this.state.lat = lat;
    this.state.lon = lon;
    this.state.place = String(place).slice(0, 80);
    this.speed = 0;
    this.driving=initialDriving();
    this.carCamera=null;this.lastCameraStick=0;
    this.jumpHeight=0;this.jumpVelocity=0;this.jumpQueued=false;
    this.cameraOffset={yaw:0,pitch:0};
    this.keys.clear();
    if (this.state.mode==='car') this.vehicle={lat,lon,heading:this.state.heading};
    else this.parkNearPlayer();
    this.updateCamera();
    this.onFrame({...this.state,vehicle:this.vehicle,drive:this.driving});
    this.emit(true);
    this.save();
  }

  emit(force = false) {
    if (!force) return;
    this.lastHud = performance.now();
    const elevation = this.world.elevation(this.state.lon, this.state.lat);
    this.onUpdate({...this.state, vehicle:this.vehicle, drive:this.driving, cameraMode:this.cameraMode,
      speed: Math.abs(this.speed) * 3.6, altitude: elevation, view: this.view,
      jumpHeight:this.jumpHeight,aiming:this.aiming,paused:this.padPaused});
  }

  save() {
    this.lastSave = performance.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({...this.state,vehicle:this.vehicle})); return true; }
    catch { return false; }
  }

  destroy() {
    clearInterval(this.timer);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('blur', this.onBlur);
  }
}
