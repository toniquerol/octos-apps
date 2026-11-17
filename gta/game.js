/* OcToS GTA V1 · Controles y física cinemática ligera (sin colisiones). */
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
    this.keys = new Set();
    this.speed = 0; // m/s, con signo si el vehículo circula marcha atrás
    // Las dos vistas permanecen detrás del personaje; V solo varía la distancia.
    this.view = 'follow';
    // Tres incrementos de rueda (3 × 0,27); la vista cercana topa en zoom 24.
    this.cameraZoom = {walk: 24, car: 23.01};
    this.active = false;
    this.timer = null;
    this.lastTime = performance.now();
    this.lastHud = 0;
    this.lastSave = 0;
    this.fps = 30;
    this.onKeyDown = event => {
      if (event.target?.closest?.('input,select,textarea,button,[contenteditable="true"]')) return;
      if (['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight',
        'Space','KeyV','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code)) event.preventDefault();
      if (event.repeat && ['Space','KeyV'].includes(event.code)) return;
      if (event.code === 'Space') this.toggleVehicle();
      else if (event.code === 'KeyV') this.toggleView();
      else this.keys.add(event.code);
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
    this.onBlur = () => { this.keys.clear(); this.speed = 0; this.emit(true); };
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
    this.updateCamera();
    this.emit(true);
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
      if (input > 0) this.speed += 8 * dt;
      if (input < 0) this.speed -= (this.speed > 0 ? 13 : 4) * dt;
      if (input === 0) {
        const drag = 3.8 * dt;
        this.speed = Math.abs(this.speed) < drag ? 0 : this.speed - Math.sign(this.speed) * drag;
      }
      this.speed = clamp(this.speed, -5, 23);
      const steering = horizontal * Math.min(56, 23 + 440 / (8 + Math.abs(this.speed)));
      if (Math.abs(this.speed) > 0.15) {
        this.state.heading = (this.state.heading + steering * Math.sign(this.speed) * dt + 360) % 360;
      }
      forward = this.speed * dt;
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
      this.updateCamera();
      this.onFrame(this.state);
      this.emit(now - this.lastHud >= 140);
      if (now - this.lastSave > 5000) this.save();
    } else if (Math.abs(this.speed - oldSpeed) > 0.001 || this.speed !== 0) {
      this.emit(now - this.lastHud >= 140 || this.speed === 0);
    }
  }

  updateCamera() {
    const isCar = this.state.mode === 'car';
    const height = this.map.getContainer?.().clientHeight || 720;
    // El personaje queda en el tercio inferior; el mapa muestra la calle por delante.
    const topPadding = Math.round(height * (isCar ? .26 : .34));
    const zoom = clamp(this.cameraZoom[this.state.mode] - (this.view === 'wide' ? .75 : 0), 20, 24);
    this.map.jumpTo({
      center: [this.state.lon, this.state.lat],
      bearing: this.state.heading,
      zoom,
      pitch: isCar ? 65 : 69,
      padding: {top: topPadding, bottom: 0, left: 0, right: 0}
    });
  }

  toggleVehicle() {
    this.state.mode = this.state.mode === 'car' ? 'walk' : 'car';
    this.speed = 0;
    this.updateCamera();
    this.emit(true);
    this.save();
  }

  toggleView() {
    this.view = this.view === 'follow' ? 'wide' : 'follow';
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
    this.keys.clear();
    this.updateCamera();
    this.onFrame(this.state);
    this.emit(true);
    this.save();
  }

  emit(force = false) {
    if (!force) return;
    this.lastHud = performance.now();
    const elevation = this.world.elevation(this.state.lon, this.state.lat);
    this.onUpdate({...this.state, speed: Math.abs(this.speed) * 3.6,
      altitude: elevation, view: this.view});
  }

  save() {
    this.lastSave = performance.now();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); return true; }
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
