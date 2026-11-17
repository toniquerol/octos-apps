/* OcToS GTA · personaje y primer vehículo independiente. */
import {stepDriving,initialDriving} from './vehicle.js?v=6';
const STORAGE_KEY = 'octos-gta-v1-save';
const DEFAULT = {lat: 41.3874, lon: 2.1701, heading: 0, mode: 'walk', place: 'Barcelona'};
const RAD = Math.PI / 180;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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
    this.cameraMode = 0;
    this.keys = new Set();
    this.speed = 0; // m/s, con signo si el vehículo circula marcha atrás
    // Las dos vistas permanecen detrás del personaje; V solo varía la distancia.
    this.view = 'follow';
    // Vista a pie próxima; conducción un nivel de zoom más alejada.
    this.cameraZoom = {walk: 23, car: 22.01};
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
      this.updateCamera();
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

  start() {
    if (this.active) return;
    this.active = true;
    this.lastTime = performance.now();
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
    const oldSpeed = this.speed;
    const oldSteer = this.driving.steer;

    const input = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
                  (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const horizontal = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
                       (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const turn = (this.keys.has('KeyE') ? 1 : 0) - (this.keys.has('KeyQ') ? 1 : 0);
    let forward = 0, sideways = 0;
    const previousHeading = this.state.heading;
    if (this.state.mode === 'walk') {
      const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
      const pace = running ? 4.2 : 1.8;
      const diagonal = input && horizontal ? Math.SQRT1_2 : 1;
      forward = input * pace * dt * diagonal;
      sideways = horizontal * pace * dt * diagonal;
      this.speed = input || horizontal ? pace : 0;
      this.state.heading = (this.state.heading + turn * 115 * dt + 360) % 360;
    } else {
      const result=stepDriving(this.driving,{
        forward:input>0, reverse:input<0,
        left:horizontal<0, right:horizontal>0,
        handbrake:this.keys.has('Space')
      },dt);
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
    if (moved || rotated) {
      if (this.state.mode === 'car') Object.assign(this.vehicle,{
        lat:this.state.lat,lon:this.state.lon,heading:this.state.heading
      });
      this.updateCamera();
      this.onFrame({...this.state,vehicle:this.vehicle,drive:this.driving});
      this.emit(now - this.lastHud >= 140);
      if (now - this.lastSave > 5000) this.save();
    } else if (Math.abs(this.speed - oldSpeed) > 0.001 || this.speed !== 0) {
      this.emit(now - this.lastHud >= 140 || this.speed === 0);
    }
    // Actualizar el giro visible de las ruedas incluso con el coche detenido.
    if (!moved && !rotated && this.state.mode === 'car' &&
        Math.abs(this.driving.steer - oldSteer) > 0.000001) {
      this.onFrame({...this.state,vehicle:this.vehicle,drive:this.driving});
    }
  }

  updateCamera() {
    const isCar = this.state.mode === 'car';
    const height = this.map.getContainer?.().clientHeight || 720;
    // El personaje queda en el tercio inferior; el mapa muestra la calle por delante.
    const zoom = isCar
      ? clamp([this.cameraZoom.car, this.cameraZoom.car-.75, this.cameraZoom.car-1.36][this.cameraMode], 20, 24)
      : clamp(this.cameraZoom.walk - (this.view === 'wide' ? .75 : 0), 20, 24);
    let center = [this.state.lon, this.state.lat];
    let topPadding = Math.round(height * (isCar ? (this.cameraMode===2?0:.26) : .34));
    if (!isCar) {
      // Rig geográfico detrás del cuello: pivote a 1,5 m en dirección al rumbo.
      // MapLibre 4 limita la cámara mediante zoom; el offset físico es aproximado.
      const neckOffsetM = 1.5;
      const neckHeightM = 1.5;
      const heading = this.state.heading * RAD;
      const lat = clamp(this.state.lat + Math.cos(heading) * neckOffsetM / 111320, -85, 85);
      const scaleLongitude = Math.max(.087,Math.cos(this.state.lat * RAD));
      const lon = this.state.lon + Math.sin(heading) * neckOffsetM / (111320 * scaleLongitude);
      center = [((lon+180)%360+360)%360-180,lat];
      // Se orienta el encuadre hacia el cuello y no hacia la base del modelo.
      const metersPerPixel = 156543.03392 * Math.max(.087,Math.cos(this.state.lat * RAD)) / (2 ** zoom);
      const neckPixels = Math.min(height*.075,neckHeightM / metersPerPixel * Math.cos(69*RAD));
      topPadding += Math.round(neckPixels);
    }
    this.map.jumpTo({
      center,
      bearing: this.state.heading,
      zoom,
      pitch: isCar ? (this.cameraMode===2 ? 0 : 75) : 69,
      padding: {top: topPadding, bottom: 0, left: 0, right: 0}
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
    this.keys.clear();
    this.updateCamera();
    this.onFrame({...this.state,vehicle:this.vehicle,drive:this.driving});
    this.emit(true);
    this.save();
  }

  cycleCamera() {
    this.cameraMode=(this.cameraMode+1)%3;
    this.updateCamera();
    this.emit(true);
  }

  toggleView() {
    if (this.state.mode==='car') this.cameraMode=(this.cameraMode+1)%3;
    else this.view=this.view==='follow'?'wide':'follow';
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
      speed: Math.abs(this.speed) * 3.6, altitude: elevation, view: this.view});
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
