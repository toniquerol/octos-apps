import {createWorld} from './world.js';
import {Game, readSave} from './game.js';
import {createActor} from './actor.js';

const $ = id => document.getElementById(id);
const status = $('status');
const welcome = $('welcome');
const play = $('play');
let world = null;
let game = null;
let actor = null;
let showStatusTimer = 0;

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
}
function showPanel(visible) {
  $('settings-panel').hidden = !visible;
  $('settings-button').setAttribute('aria-expanded',String(visible));
}
$('settings-button').addEventListener('click',() => showPanel($('settings-panel').hidden));
$('close-settings').addEventListener('click',() => showPanel(false));
$('help-button').addEventListener('click',() => $('help-dialog').showModal());
$('close-help').addEventListener('click',() => $('help-dialog').close());
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !$('settings-panel').hidden) showPanel(false);
});

function teleport(lat,lon,place) {
  try {
    game.teleport(lat,lon,place);
    $('latitude').value = String(lat);
    $('longitude').value = String(lon);
    report('Nueva ubicación seleccionada. Cargando datos geográficos…','ok');
  } catch(error) { report(error.message,'warn'); }
}
$('preset').addEventListener('change',event => {
  if (!event.target.value || !game) return;
  const [a,b,...name] = event.target.value.split(',');
  teleport(Number(a), Number(b), name.join(','));
});
$('go-to').addEventListener('click',() => {
  if (!game) return;
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
  if (world) world.updateTerrain(event.target.checked,$('terrain-provider').value);
});
$('terrain-provider').addEventListener('change',event => {
  if (world) {
    world.updateTerrain($('terrain').checked,event.target.value);
    report('Proveedor de elevaciones: ' + event.target.selectedOptions[0].textContent,'ok');
  }
});
$('buildings').addEventListener('change',event => {
  if (world) world.updateBuildings(event.target.checked);
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

async function bootstrap() {
  const start = readSave();
  $('latitude').value = String(start.lat);
  $('longitude').value = String(start.lon);
  $('place-name').textContent = start.place + ' · Mundo real';
  try {
    world = await createWorld(start,report);
    const savedQuality = localStorage.getItem('octos-gta-quality') || 'balanced';
    $('quality').value = ['low','balanced','high'].includes(savedQuality) ? savedQuality : 'balanced';
    const terrainEnabled = $('quality').value !== 'low';
    $('terrain').checked = terrainEnabled;
    world.updateBuildings(true);
    world.updateTerrain(terrainEnabled);
    actor = await createActor(world,start,report);
    game = new Game(world,updateHud);
    game.setQuality($('quality').value);
    updateHud({...start,speed:0,altitude:world.elevation(start.lon,start.lat),view:'follow'});
    report('Escenario preparado · datos geográficos externos en carga.','ok');
    play.disabled = false;
    play.textContent = 'Entrar al mundo';
    play.addEventListener('click',() => {
      welcome.hidden = true;
      showPanel(false);
      game.start();
      play.blur();
    },{once:true});
  } catch(error) {
    console.error('OcToS GTA · inicio:', error);
    $('welcome-error').textContent = error.message;
    play.disabled = false;
    play.textContent = 'Reintentar conexión';
    play.addEventListener('click',() => window.location.reload(),{once:true});
    report('No se ha podido inicializar el escenario.','warn');
  }
}
bootstrap();
