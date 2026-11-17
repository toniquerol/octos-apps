/* OcToS GTA · Editor de mapa sin crear otro motor ni contexto WebGL. */
const STORAGE_KEY = 'octos-gta-map-editor-v1';
const $ = id => document.getElementById(id);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function readConfig() {
  const defaults = {
    view: '2d', zoom: 16, pitch: 45, color: '#707783',
    opacity: 84, center: null, bearing: 0
  };
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!data || typeof data !== 'object') return defaults;
    return {
      view: data.view === '3d' ? '3d' : '2d',
      zoom: Number.isFinite(data.zoom) ? clamp(data.zoom, 5, 19) : 16,
      pitch: Number.isFinite(data.pitch) ? clamp(data.pitch, 0, 70) : 45,
      color: typeof data.color === 'string' && /^#[0-9a-f]{6}$/i.test(data.color) ? data.color : '#707783',
      opacity: Number.isFinite(data.opacity) ? clamp(data.opacity, 15, 100) : 84,
      center: Array.isArray(data.center) && data.center.length === 2 &&
        Number.isFinite(data.center[0]) && Number.isFinite(data.center[1]) &&
        Math.abs(data.center[0]) <= 180 && Math.abs(data.center[1]) <= 85 ?
          data.center : null,
      bearing: Number.isFinite(data.bearing) ? data.bearing : 0
    };
  } catch { return defaults; }
}

export function mountMapEditor({world, game, layerControls, report}) {
  const map = world.map;
  const modeButton = $('map-mode-button');
  const panel = $('map-editor');
  const saveButton = $('editor-save');
  const saveStatus = $('editor-save-status');
  const view = $('editor-view');
  const zoom = $('editor-zoom');
  const pitch = $('editor-pitch');
  const color = $('editor-building-color');
  const opacity = $('editor-building-opacity');
  const saved = readConfig();
  let currentPosition = null;

  view.value = saved.view;
  zoom.value = String(saved.zoom);
  pitch.value = String(saved.pitch);
  color.value = saved.color;
  opacity.value = String(saved.opacity);
  world.setBuildingAppearance(saved.color, saved.opacity);

  function updateLabels() {
    $('editor-zoom-value').textContent = Number(zoom.value).toFixed(1);
    $('editor-pitch-value').textContent = pitch.value + '°';
    $('editor-opacity-value').textContent = opacity.value + '%';
    pitch.disabled = view.value === '2d';
  }

  function appearance() {
    world.setBuildingAppearance(color.value, Number(opacity.value) / 100);
    updateLabels();
    saveStatus.textContent = 'Cambios sin guardar';
  }

  function camera() {
    if (!document.body.classList.contains('editing')) return;
    const zoomValue = clamp(Number(zoom.value), 5, 19);
    const pitchValue = view.value === '2d' ? 0 : clamp(Number(pitch.value), 0, 70);
    map.jumpTo({zoom: zoomValue, pitch: pitchValue});
    updateLabels();
    saveStatus.textContent = 'Cambios sin guardar';
  }

  function enter() {
    game.pause();
    document.body.classList.add('editing');
    panel.hidden = false;
    $('settings-panel').hidden = true;
    $('settings-button').setAttribute('aria-expanded', 'false');
    modeButton.textContent = 'Jugar';
    modeButton.setAttribute('aria-pressed', 'true');
    world.enterEditor();

    // Al entrar se enseña la zona que se está jugando; no un mundo diferente.
    const playerCenter = [game.state.lon, game.state.lat];
    const nearSaved = saved.center &&
      Math.abs(saved.center[0] - playerCenter[0]) < .05 &&
      Math.abs(saved.center[1] - playerCenter[1]) < .05;
    const center = currentPosition?.center || (nearSaved ? saved.center : playerCenter);
    const bearing = currentPosition?.bearing ?? (nearSaved ? saved.bearing : 0);
    map.jumpTo({
      center, zoom:Number(zoom.value),
      pitch:view.value === '2d' ? 0 : Number(pitch.value),
      bearing,
      padding:{top:0,bottom:0,left:0,right:0}
    });
    updateLabels();
    map.resize();
  }

  function exit() {
    currentPosition = {center:map.getCenter().toArray(), bearing:map.getBearing()};
    panel.hidden = true;
    document.body.classList.remove('editing');
    modeButton.textContent = 'Editar mapa';
    modeButton.setAttribute('aria-pressed', 'false');
    world.enterGame();
    game.resume();
  }

  function save() {
    const center = map.getCenter().toArray();
    const data = {
      version:1,
      view:view.value, zoom:Number(zoom.value), pitch:Number(pitch.value),
      color:color.value, opacity:Number(opacity.value),
      center, bearing:map.getBearing(),
      layers:layerControls?.getPreferences() || {},
      savedAt:new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      layerControls?.savePreferences();
      Object.assign(saved, data);
      currentPosition = {center, bearing:data.bearing};
      saveStatus.textContent = 'Mapa guardado en este navegador';
      report('Mapa guardado con sus capas y parámetros.', 'ok');
    } catch {
      saveStatus.textContent = 'No se pudo guardar';
      report('El navegador no permite guardar esta configuración.', 'warn');
    }
  }

  modeButton.disabled = false;
  modeButton.addEventListener('click', () => {
    if (document.body.classList.contains('editing')) exit();
    else enter();
  });
  saveButton.addEventListener('click', save);
  color.addEventListener('input', appearance);
  opacity.addEventListener('input', appearance);
  view.addEventListener('change', camera);
  zoom.addEventListener('input', camera);
  pitch.addEventListener('input', camera);
  map.on('moveend', () => {
    if (!document.body.classList.contains('editing')) return;
    const center = map.getCenter();
    layerControls?.updateLocation(center.lng, center.lat);
    zoom.value = String(clamp(map.getZoom(), 5, 19));
    if (view.value === '3d') pitch.value = String(clamp(map.getPitch(), 0, 70));
    updateLabels();
  });
  updateLabels();
  return {enter, exit};
}
