/* GTA · Panel temporal de comparación de capas aprobadas (sin cambiar el estilo base). */
const PREFS_KEY = 'octos-gta-layers-v1';
const DEFAULTS = Object.freeze({
  roads: true, buildings: true, terrain: true, dem: 'mapterhorn',
  labels: false, pnoa: false, pnoaOpacity: 100, lidar: false, lidarOpacity: 15
});
const PNOA = 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg';
const LIDAR = 'https://wmts-mapa-lidar.idee.es/lidar?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=EL.GridCoverageDSM&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

function loadPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return {...DEFAULTS};
    const saved = {...DEFAULTS};
    for (const name of ['roads','buildings','terrain','labels','pnoa','lidar']) {
      if (typeof raw[name] === 'boolean') saved[name] = raw[name];
    }
    if (raw.dem === 'mapterhorn' || raw.dem === 'aws') saved.dem = raw.dem;
    for (const name of ['pnoaOpacity','lidarOpacity']) {
      if (Number.isFinite(raw[name])) saved[name] = Math.min(100,Math.max(0,raw[name]));
    }
    return saved;
  } catch { return {...DEFAULTS}; }
}

// Cobertura geográfica aproximada: la existencia de teselas la determina IGN.
function isSpanishExtent(lon,lat) {
  return Number.isFinite(lon) && Number.isFinite(lat) &&
    lon >= -18.6 && lon <= 4.6 && lat >= 27.4 && lat <= 44.2;
}

export function mountLayerPanel(world, {report, setSettings}) {
  const map = world.map;
  const get = name => document.getElementById('layer-' + name);
  const prefs = loadPreferences();
  const existingRoads = map.getStyle().layers.filter(layer =>
    /^(highway_(?!name)|road_(?!oneway))/.test(layer.id) &&
    ['line','fill'].includes(layer.type)
  ).map(layer => layer.id);
  const labels = ['highway_name_other','highway_name_motorway'];
  let location = null;

  function save() {
    try { localStorage.setItem(PREFS_KEY,JSON.stringify(prefs)); }
    catch { /* Modo sin almacenamiento persistente: se mantiene la sesión. */ }
  }
  function visible(id, enabled) {
    if (map.getLayer(id)) map.setLayoutProperty(id,'visibility',enabled ? 'visible' : 'none');
  }
  function applyRoads() {
    for (const id of existingRoads) visible(id,prefs.roads);
  }
  function applyLabels() {
    for (const id of labels) visible(id,prefs.labels);
  }
  function addRaster(sourceId,layerId,tiles,opacity,attribution) {
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId,{type:'raster',tiles:[tiles],tileSize:256,maxzoom:19,attribution});
    }
    if (!map.getLayer(layerId)) {
      const beforeId = existingRoads.find(id=>map.getLayer(id)) ||
        map.getStyle().layers.find(layer=>layer.type==='symbol')?.id;
      map.addLayer({
        id:layerId,type:'raster',source:sourceId,
        layout:{visibility:'none'},paint:{'raster-opacity':opacity/100}
      },beforeId);
    }
  }
  function applyRasters() {
    const inSpain = location && isSpanishExtent(location.lon,location.lat);
    const pnoaEnabled = Boolean(prefs.pnoa && inSpain);
    const lidarEnabled = Boolean(prefs.lidar && inSpain);
    try {
      if (pnoaEnabled) {
        addRaster('gta-pnoa','gta-pnoa-layer',PNOA,prefs.pnoaOpacity,'© IGN/CNIG PNOA');
      }
      if (lidarEnabled) {
        addRaster('gta-lidar','gta-lidar-layer',LIDAR,prefs.lidarOpacity,'© IGN/CNIG LiDAR');
      }
      visible('gta-pnoa-layer',pnoaEnabled);
      visible('gta-lidar-layer',lidarEnabled);
      if (map.getLayer('gta-pnoa-layer')) map.setPaintProperty('gta-pnoa-layer','raster-opacity',prefs.pnoaOpacity/100);
      if (map.getLayer('gta-lidar-layer')) map.setPaintProperty('gta-lidar-layer','raster-opacity',prefs.lidarOpacity/100);
    } catch(error) {
      report('Las imágenes IGN no se han podido activar; el mapa vectorial sigue disponible.','warn');
      console.warn('GTA · capas IGN:',error);
    }
  }
  function render() {
    for (const name of ['roads','buildings','terrain','labels','pnoa','lidar'])
      get(name).checked = prefs[name];
    get('dem').value = prefs.dem;
    get('pnoa-opacity').value = String(prefs.pnoaOpacity);
    get('lidar-opacity').value = String(prefs.lidarOpacity);
    get('pnoa-percent').textContent = prefs.pnoaOpacity + '%';
    get('lidar-percent').textContent = prefs.lidarOpacity + '%';
    const inSpain = location && isSpanishExtent(location.lon,location.lat);
    get('pnoa').disabled = !inSpain;
    get('lidar').disabled = !inSpain;
    get('pnoa-opacity').disabled = !inSpain || !prefs.pnoa;
    get('lidar-opacity').disabled = !inSpain || !prefs.lidar;
    get('coverage-note').textContent = inSpain ?
      'PNOA y LiDAR: cobertura de España · datos IGN.' :
      'PNOA y LiDAR: solo disponibles dentro de la cobertura de España.';
    if (typeof setSettings === 'function') setSettings({...prefs});
  }
  function apply() {
    applyRoads();
    applyLabels();
    world.updateBuildings(prefs.buildings);
    world.updateTerrain(prefs.terrain,prefs.dem);
    applyRasters();
    render();
  }

  for (const name of ['roads','buildings','terrain','labels','pnoa','lidar']) {
    get(name).addEventListener('change',event => {
      prefs[name] = Boolean(event.target.checked);
      if (name === 'roads') applyRoads();
      else if (name === 'labels') applyLabels();
      else if (name === 'buildings') world.updateBuildings(prefs.buildings);
      else if (name === 'terrain') world.updateTerrain(prefs.terrain,prefs.dem);
      else applyRasters();
      render();
      save();
    });
  }
  get('dem').addEventListener('change',event => {
    prefs.dem = event.target.value === 'aws' ? 'aws' : 'mapterhorn';
    if (prefs.terrain) world.updateTerrain(true,prefs.dem);
    render();
    save();
  });
  for (const [id,key] of [['pnoa-opacity','pnoaOpacity'],['lidar-opacity','lidarOpacity']]) {
    get(id).addEventListener('input',event => {
      prefs[key] = Math.min(100,Math.max(0,Number(event.target.value)||0));
      applyRasters();
      render();
      save();
    });
  }

  return {
    initialize(lon,lat) {
      location = {lon,lat};
      apply();
    },
    updateLocation(lon,lat) {
      const before = location && isSpanishExtent(location.lon,location.lat);
      location = {lon,lat};
      if (before !== isSpanishExtent(lon,lat)) {
        applyRasters();
        render();
      }
    },
    getPreferences() { return {...prefs}; },
    savePreferences() { save(); },
    syncSettings({buildings,terrain,dem} = {}) {
      if (typeof buildings === 'boolean') prefs.buildings = buildings;
      if (typeof terrain === 'boolean') prefs.terrain = terrain;
      if (dem === 'mapterhorn' || dem === 'aws') prefs.dem = dem;
      render();save();
    }
  };
}
