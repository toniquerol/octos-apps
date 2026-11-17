/* GTA · Panel temporal de comparación de capas aprobadas (sin cambiar el estilo base). */
const PREFS_KEY = 'octos-gta-layers-v1';
const DEFAULTS = Object.freeze({
  roads: true, water: true, green: true, poi: true, buildings: true, terrain: true, dem: 'mapterhorn',
  roadWidthMeters: 6, roadColor: '#ff6a1a', roadTint: false,
  labels: false, pnoa: false, pnoaOpacity: 100, lidar: false, lidarOpacity: 15
});
const PNOA = 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg';
const LIDAR = 'https://wmts-mapa-lidar.idee.es/lidar?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=EL.GridCoverageDSM&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

function loadPreferences() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return {...DEFAULTS};
    const saved = {...DEFAULTS};
    for (const name of ['roads','water','green','poi','buildings','terrain','labels','pnoa','lidar']) {
      if (typeof raw[name] === 'boolean') saved[name] = raw[name];
    }
    if (raw.dem === 'mapterhorn' || raw.dem === 'aws') saved.dem = raw.dem;
    // Los porcentajes guardados en versiones anteriores no son metros.
    if (Number.isFinite(raw.roadWidthMeters))
      saved.roadWidthMeters = Math.min(30,Math.max(0.5,raw.roadWidthMeters));
    if (typeof raw.roadColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.roadColor)) saved.roadColor=raw.roadColor;
    if (typeof raw.roadTint === 'boolean') saved.roadTint=raw.roadTint;
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
  let existingRoads=[], waterLayers=[], greenLayers=[], poiLayers=[];
  let roadPaints=new Map();
  const group = (pattern,types) => map.getStyle().layers.filter(layer =>
    types.includes(layer.type) && pattern.test(layer.id)
  ).map(layer=>layer.id);
  function readStyleLayers() {
    existingRoads=group(/^(highway_(?!name)|road_(?!oneway))/i,['line','fill']);
    waterLayers=group(/water|river|lake|canal|ocean|stream/i,['fill','line']);
    greenLayers=group(/park|forest|grass|landcover|wood|vegetation|green/i,['fill','line']);
    poiLayers=group(/poi|landmark|transit_station|airport_label/i,['symbol']);
    roadPaints=new Map();
    for(const id of existingRoads) {
      const layer=map.getLayer(id);
      if(!layer || layer.type!=='line')continue;
      roadPaints.set(id,{
        width:map.getPaintProperty(id,'line-width'),
        color:map.getPaintProperty(id,'line-color')
      });
    }
  }
  readStyleLayers();
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
  // MapLibre expresa line-width en píxeles, no en metros: convertir la anchura
  // física a píxeles según el zoom y la latitud. La interpolación exponencial
  // (base 2) reproduce la variación de escala en Web Mercator sin ejecutar
  // setPaintProperty al cambiar el zoom.
  let roadWidthLatitude=null;
  function metricLineWidth(meters,latitude) {
    const metersPerPixelAtZoom0 =
      156543.03392804097 * Math.max(0.087,Math.cos(latitude*Math.PI/180));
    return ['interpolate',['exponential',2],['zoom'],
      0,meters/metersPerPixelAtZoom0,
      24,meters*Math.pow(2,24)/metersPerPixelAtZoom0];
  }
  function applyRoadStyle() {
    const latitude=Number(map.getCenter()?.lat)||0;
    roadWidthLatitude=latitude;
    const nextWidth=metricLineWidth(prefs.roadWidthMeters,latitude);
    for(const [id,original] of roadPaints) {
      if(!map.getLayer(id))continue;
      try {
        map.setPaintProperty(id,'line-width',nextWidth);
        if(original.color !== undefined) {
          map.setPaintProperty(id,'line-color',prefs.roadTint?prefs.roadColor:original.color);
        }
      } catch(error) {
        console.warn('OcToS GTA · aspecto carretera:',id,error);
      }
    }
  }
  // En recorridos largos actualizar el factor de latitud sin tocar el zoom.
  map.on('moveend',()=>{
    if(roadWidthLatitude===null)return;
    const latitude=map.getCenter()?.lat;
    if(Number.isFinite(latitude)&&Math.abs(latitude-roadWidthLatitude)>.5)
      applyRoadStyle();
  });
  function applyLabels() {
    for (const id of labels) visible(id,prefs.labels);
  }
  function applyGroups() {
    for (const id of waterLayers) visible(id,prefs.water);
    for (const id of greenLayers) visible(id,prefs.green);
    for (const id of poiLayers) visible(id,prefs.poi);
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
    for (const name of ['roads','water','green','poi','buildings','terrain','labels','pnoa','lidar'])
      get(name).checked = prefs[name];
    get('dem').value = prefs.dem;
    get('road-width').value=String(prefs.roadWidthMeters);
    get('road-width-value').textContent=prefs.roadWidthMeters+' m';
    get('road-color').value=prefs.roadColor;
    get('road-tint').checked=prefs.roadTint;
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
    applyRoadStyle();
    applyLabels();
    applyGroups();
    world.updateBuildings(prefs.buildings);
    world.updateTerrain(prefs.terrain,prefs.dem);
    applyRasters();
    render();
  }

  for (const name of ['roads','water','green','poi','buildings','terrain','labels','pnoa','lidar']) {
    get(name).addEventListener('change',event => {
      prefs[name] = Boolean(event.target.checked);
      if (name === 'roads') applyRoads();
      else if (['water','green','poi'].includes(name)) applyGroups();
      else if (name === 'labels') applyLabels();
      else if (name === 'buildings') world.updateBuildings(prefs.buildings);
      else if (name === 'terrain') world.updateTerrain(prefs.terrain,prefs.dem);
      else applyRasters();
      render();
      save();
    });
  }
  get('road-width').addEventListener('input',event => {
    prefs.roadWidthMeters=Math.min(30,Math.max(0.5,Number(event.target.value)||6));
    applyRoadStyle();render();save();
  });
  get('road-color').addEventListener('input',event => {
    if(!/^#[0-9a-f]{6}$/i.test(event.target.value))return;
    prefs.roadColor=event.target.value;
    prefs.roadTint=true;
    applyRoadStyle();render();save();
  });
  get('road-tint').addEventListener('change',event => {
    prefs.roadTint=Boolean(event.target.checked);
    applyRoadStyle();render();save();
  });
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
    refreshStyle() {
      readStyleLayers();
      apply();
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
