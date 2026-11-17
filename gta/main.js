import {createWorld} from './world.js?v=5';
import {Game, readSave} from './game.js?v=4';
import {createActor} from './actor.js?v=2';

const $ = id => document.getElementById(id);
const status = $('status');
const welcome = $('welcome');
const play = $('play');
let world = null;
let game = null;
let actor = null;
let showStatusTimer = 0;
let selection = null;
let selectionMarker = null;
let choosing = false;
let mapClickHandler = null;

function report(message, kind = '') {
  status.textContent = message;
  status.className = 'status ' + kind;
  clearTimeout(showStatusTimer);
  if (kind === 'ok') {
    showStatusTimer = setTimeout(() => { status.textContent = 'Mundo geográfico · V1'; }, 7000);
  }
}
function updateHud(state) {
  $('mode-label').textContent = state.mode === 'car' ? 'Vehículo' : 'A pie';
  $('speed').textContent = Math.round(state.speed);
  $('heading').textContent = String(Math.round(state.heading) % 360).padStart(3,'0') + '°';
  $('coordinates').textContent = state.lat.toFixed(5) + ', ' + state.lon.toFixed(5);
  $('altitude').textContent = state.altitude == null ? 'Sin datos' : Math.round(state.altitude) + ' m';
  $('place-name').textContent = (state.place || 'Coordenadas') + ' · Mundo real';
  actor?.update(state);
  world?.refreshShadows(state.lon, state.lat);
}
function showPanel(visible) {
  $('settings-panel').hidden = !visible;
  $('settings-button').setAttribute('aria-expanded',String(visible));
}
$('settings-button').addEventListener('click',() => showPanel($('settings-panel').hidden));
$('close-settings').addEventListener('click',() => showPanel(false));
$('help-button').addEventListener('click',() => $('help-dialog').showModal());
$('close-help').addEventListener('click',() => $('help-dialog').close());
$('daytime-controls').addEventListener('submit', event => {
  event.preventDefault();
  if (!world) return;
  const time = $('daytime-hour').value;
  if (!world.setTime(time)) {
    report('Selecciona una hora válida.', 'warn');
    return;
  }
  const hour = Number(time.slice(0, 2)) + Number(time.slice(3)) / 60;
  $('daytime-phase').textContent = hour < 6 || hour >= 20 ? 'Noche'
    : hour < 8 ? 'Amanecer' : hour >= 18 ? 'Atardecer' : 'Día';
  if (game) world.refreshShadows(game.state.lon, game.state.lat, true);
  try { localStorage.setItem('octos-gta-time', time); } catch {}
  report('Iluminación aplicada: ' + time, 'ok');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('settings-panel').hidden) showPanel(false);
});

function isValidCoordinate(lat,lon) {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;
}
function chooseLocation(lat,lon,place = 'Punto seleccionado', recenter = false) {
  if (!isValidCoordinate(lat,lon)) throw new Error('Coordenadas fuera del rango permitido.');
  selection = {lat,lon,place};
  $('start-name').textContent = place;
  $('start-coordinates').textContent = lat.toFixed(5) + ', ' + lon.toFixed(5);
  $('latitude').value = String(lat);
  $('longitude').value = String(lon);
  if (selectionMarker) selectionMarker.setLngLat([lon,lat]);
  if (recenter && world) world.map.flyTo({center:[lon,lat],zoom:Math.max(world.map.getZoom(),13),pitch:0,essential:true});
}
function teleport(lat,lon,place) {
  try {
    if (!isValidCoordinate(lat,lon)) throw new Error('Coordenadas fuera del rango permitido.');
    if (!game) chooseLocation(lat,lon,place,true);
    else {
      game.teleport(lat,lon,place);
      $('latitude').value = String(lat);
      $('longitude').value = String(lon);
    }
    report('Ubicación seleccionada.','ok');
  } catch(error) { report(error.message,'warn'); }
}
$('preset').addEventListener('change',event => {
  if (!event.target.value) return;
  const [a,b,...name] = event.target.value.split(',');
  teleport(Number(a), Number(b), name.join(','));
});
$('go-to').addEventListener('click',() => {
  const a = $('latitude').value.trim();
  const b = $('longitude').value.trim();
  if (!a || !b) {report('Introduce latitud y longitud válidas.','warn');return;}
  teleport(Number(a), Number(b), 'Coordenadas');
  $('preset').value = '';
});
$('save-position').addEventListener('click',() => {
  if (game) report(game.save() ? 'Posición guardada en este navegador.' :
    'El navegador no permite guardar datos locales.','ok');
});
$('terrain').addEventListener('change',event => {
  if (world && game) world.updateTerrain(event.target.checked,$('terrain-provider').value);
});
$('terrain-provider').addEventListener('change',event => {
  if (world && game) {
    world.updateTerrain($('terrain').checked,event.target.value);
    report('Proveedor de elevaciones: ' + event.target.selectedOptions[0].textContent,'ok');
  }
});
$('buildings').addEventListener('change',event => {
  if (world && game) world.updateBuildings(event.target.checked);
});
$('quality').addEventListener('change',event => {
  if (!game) return;
  game.setQuality(event.target.value);
  if (event.target.value === 'low') {
    $('terrain').checked = false;
    world.updateTerrain(false,$('terrain-provider').value);
  } else if (event.target.value === 'high') {
    $('terrain').checked = true;
    world.updateTerrain(true,$('terrain-provider').value);
  }
  try {localStorage.setItem('octos-gta-quality',event.target.value);} catch {}
  report('Calidad gráfica: '+event.target.selectedOptions[0].textContent,'ok');
});
window.addEventListener('pagehide',() => game?.save());

$('start-preset').addEventListener('change',event => {
  if (!event.target.value || choosing || game) return;
  const [a,b,...parts] = event.target.value.split(',');
  try {chooseLocation(Number(a),Number(b),parts.join(','),true);}
  catch(error){report(error.message,'warn');}
});
$('pick-center').addEventListener('click',() => {
  if (!world || choosing || game) return;
  const center = world.map.getCenter();
  chooseLocation(center.lat,center.lng,'Centro seleccionado');
});

async function launchScene() {
  if (!world || !selection || choosing || game) return;
  choosing = true;
  play.disabled = true;
  play.textContent = 'Preparando escenario 3D…';
  $('welcome-error').textContent = '';
  try {
    const start = {...selection};
    const quality = $('quality').value;
    const terrainEnabled = $('terrain').checked && quality !== 'low';
    world.updateBuildings($('buildings').checked);
    world.updateTerrain(terrainEnabled,$('terrain-provider').value);
    actor = await createActor(world,start,report);
    game = new Game(world,updateHud,state => actor?.update(state));
    game.setQuality(quality);
    world.enterGame();
    game.teleport(start.lat,start.lon,start.place);
    world.setTime($('daytime-hour').value);
    world.refreshShadows(start.lon, start.lat, true);
    world.map.once('idle', () => {
      if (game) world.refreshShadows(game.state.lon, game.state.lat, true);
    });
    setTimeout(() => {
      if (game) world.refreshShadows(game.state.lon, game.state.lat, true);
    }, 3500);
    if (mapClickHandler) world.map.off('click',mapClickHandler);
    selectionMarker?.remove();
    selectionMarker = null;
    document.body.classList.remove('selecting');
    $('map').setAttribute('aria-label','Escenario geográfico en tres dimensiones');
    welcome.hidden = true;
    showPanel(false);
    game.start();
    play.blur();
    report('Escenario 3D activo.','ok');
  } catch (error) {
    console.error('OcToS GTA · cargar escenario:',error);
    $('welcome-error').textContent = error.message;
    report('No se ha podido cargar el escenario.','warn');
    play.textContent = 'Reintentar cargar escenario';
    play.disabled = false;
  } finally { choosing = false; }
}

async function bootstrap() {
  const start = readSave();
  selection = {lat:start.lat,lon:start.lon,place:start.place};
  $('latitude').value = String(start.lat);
  $('longitude').value = String(start.lon);
  $('start-name').textContent = start.place;
  $('start-coordinates').textContent = start.lat.toFixed(5)+', '+start.lon.toFixed(5);
  $('place-name').textContent = start.place + ' · Mundo real';
  try {
    // El mapa de selección es plano: sin jugador, edificios 3D ni elevaciones.
    world = await createWorld(start,report,{selection:true});
    let savedTime = '16:30';
    try { savedTime = localStorage.getItem('octos-gta-time') || savedTime; } catch {}
    if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(savedTime)) savedTime = '16:30';
    $('daytime-hour').value = savedTime;
    world.setTime(savedTime);
    const timeHour = Number(savedTime.slice(0, 2)) + Number(savedTime.slice(3)) / 60;
    $('daytime-phase').textContent = timeHour < 6 || timeHour >= 20 ? 'Noche'
      : timeHour < 8 ? 'Amanecer' : timeHour >= 18 ? 'Atardecer' : 'Día';
    let savedQuality = 'balanced';
    try { savedQuality = localStorage.getItem('octos-gta-quality') || savedQuality; } catch {}
    $('quality').value = ['low','balanced','high'].includes(savedQuality) ? savedQuality : 'balanced';
    $('terrain').checked = $('quality').value !== 'low';
    selectionMarker = new window.maplibregl.Marker({color:'#ff6a1a'})
      .setLngLat([start.lon,start.lat]).addTo(world.map);
    if (typeof window.maplibregl.NavigationControl === 'function') {
      world.map.addControl(new window.maplibregl.NavigationControl({showCompass:false}), 'top-right');
    }
    mapClickHandler = event => {
      if (choosing || game) return;
      chooseLocation(event.lngLat.lat,event.lngLat.lng,'Punto seleccionado');
      $('start-preset').value = '';
    };
    world.map.on('click',mapClickHandler);
    report('Mapa 2D preparado. Pulsa en cualquier punto para iniciar allí.','ok');
    play.textContent = 'Entrar al escenario 3D';
    play.disabled = false;
    play.addEventListener('click',launchScene);
  } catch(error) {
    console.error('OcToS GTA · inicio:', error);
    $('welcome-error').textContent = error.message;
    play.disabled = false;
    play.textContent = 'Reintentar conexión';
    play.addEventListener('click',() => window.location.reload(),{once:true});
    report('No se ha podido inicializar el mapa.','warn');
  }
}
bootstrap();
