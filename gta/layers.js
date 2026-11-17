/* GTA · Panel temporal de comparación de capas aprobadas (sin cambiar el estilo base). */
const PREFS_KEY = 'octos-gta-layers-v2';
const LEGACY_PREFS_KEY = 'octos-gta-layers-v1';
const DEFAULTS = Object.freeze({
  roads: true, water: true, green: true, poi: true, buildings: true, terrain: true, dem: 'mapterhorn',
  roadWidthMeters: 16, roadColor: '#202225', roadTint: true, roadTwoLanes: true,
  waterColor: '#407ca3', waterTint: false, waterOpacity: 100,
  greenColor: '#42634a', greenTint: false, greenOpacity: 100,
  poiColor: '#d0b89e', poiTint: false, poiOpacity: 100,
  labels: false, pnoa: false, pnoaOpacity: 100, lidar: true, lidarOpacity: 5
});
const PNOA = 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg';
const LIDAR = 'https://wmts-mapa-lidar.idee.es/lidar?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=EL.GridCoverageDSM&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';

function loadPreferences() {
  try {
    const current = localStorage.getItem(PREFS_KEY);
    const raw = JSON.parse(current || localStorage.getItem(LEGACY_PREFS_KEY) || 'null');
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
    if (typeof raw.roadTwoLanes === 'boolean') saved.roadTwoLanes=raw.roadTwoLanes;
    // El antiguo marrón predefinido pasa a un negro asfalto; respetar colores editados.
    if (saved.roadColor.toLowerCase() === '#26160d') saved.roadColor='#202225';
    for (const name of ['water','green','poi']) {
      const color = raw[name+'Color'];
      if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) saved[name+'Color'] = color;
      if (typeof raw[name+'Tint'] === 'boolean') saved[name+'Tint'] = raw[name+'Tint'];
    }
    for (const name of ['pnoaOpacity','lidarOpacity','waterOpacity','greenOpacity','poiOpacity']) {
      if (Number.isFinite(raw[name])) saved[name] = Math.min(100,Math.max(0,raw[name]));
    }
    // Migración v1 -> v2: mantener otras preferencias, pero aplicar los nuevos
    // valores de arranque aprobados una sola vez incluso si había datos v1.
    if (!current) Object.assign(saved, {
      roads:true, water:true, buildings:true, terrain:true,
      roadWidthMeters:16, roadColor:'#202225', roadTint:true, roadTwoLanes:true,
      lidar:true, lidarOpacity:5
    });
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
  let roadOverlayIds=[];
  const ASPHALT='#202225';
  const EDGE='#73777b';
  const ROAD_EXCLUDED=/(?:casing|outline|border|shadow|name|oneway|foot|pedestrian|cycle|path|bridle|track|steps|construction|proposed|rail|ferry|sidewalk)/i;
  const driveableRoad = layer => layer?.type==='line' && Boolean(layer.source) &&
    !ROAD_EXCLUDED.test(layer.id);
  let groupPaints = {water:new Map(),green:new Map(),poi:new Map()};
  function captureGroup(name, ids) {
    const snapshot = new Map();
    for (const id of ids) {
      const layer = map.getLayer(id);
      if (!layer) continue;
      const fields = layer.type === 'symbol' ?
        ['text-color','text-opacity','icon-color','icon-opacity'] :
        layer.type === 'fill' ? ['fill-color','fill-opacity'] :
        layer.type === 'line' ? ['line-color','line-opacity'] : [];
      const original = {};
      for (const field of fields) original[field] = map.getPaintProperty(id,field);
      snapshot.set(id,{type:layer.type,original});
    }
    groupPaints[name] = snapshot;
  }
  const group = (pattern,types) => map.getStyle().layers.filter(layer =>
    types.includes(layer.type) && pattern.test(layer.id)
  ).map(layer=>layer.id);
  function readStyleLayers() {
    existingRoads=group(/^(highway_(?!name)|road_(?!oneway))/i,['line','fill']);
    waterLayers=group(/water|river|lake|canal|ocean|stream/i,['fill','line']);
    greenLayers=group(/park|forest|grass|landcover|wood|vegetation|green/i,['fill','line']);
    poiLayers=group(/poi|landmark|transit_station|airport_label/i,['symbol']);
    captureGroup('water',waterLayers);
    captureGroup('green',greenLayers);
    captureGroup('poi',poiLayers);
    roadPaints=new Map();
    roadOverlayIds=[];
    for(const id of existingRoads) {
      const layer=map.getLayer(id);
      if(!layer || layer.type!=='line')continue;
      roadPaints.set(id,{
        width:map.getPaintProperty(id,'line-width'),
        color:map.getPaintProperty(id,'line-color'),
        opacity:map.getPaintProperty(id,'line-opacity'),
        visible:map.getLayoutProperty(id,'visibility')!=='none',
        layer:map.getStyle().layers.find(item=>item.id===id)
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
    for (const id of existingRoads) {
      const original=roadPaints.get(id);
      const permitted=!prefs.roadTwoLanes ||
        (original && original.visible && driveableRoad(original.layer));
      visible(id,Boolean(prefs.roads && permitted));
    }
    for (const id of roadOverlayIds) visible(id,prefs.roads && prefs.roadTwoLanes);
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
  // Usar las mismas geometrías y filtros vectoriales del estilo OSM original.
  // Los trazos se añaden bajo las etiquetas, sin duplicar fuentes ni teselas.
  function ensureRoadOverlays() {
    const roadLines=[...roadPaints].filter(([,data])=>driveableRoad(data.layer));
    const styleLayers=map.getStyle().layers.filter(layer=>!layer.id.startsWith('gta-road-'));
    const lastRoad=styleLayers.reduce((last,layer,index)=>
      existingRoads.includes(layer.id) ? index : last,-1);
    // Superponer la pintura sobre las líneas de OpenStreetMap originales.
    const beforeRoadPaint=styleLayers[lastRoad+1]?.id;
    for (let index=0;index<roadLines.length;index++) {
      const [,data]=roadLines[index];
      const base=data.layer;
      const common={type:'line',source:base.source};
      if (base['source-layer']) common['source-layer']=base['source-layer'];
      if (base.filter) common.filter=base.filter;
      if (Number.isFinite(base.minzoom)) common.minzoom=base.minzoom;
      if (Number.isFinite(base.maxzoom)) common.maxzoom=base.maxzoom;
      const asphaltId='gta-road-asphalt-'+index;
      if (!map.getLayer(asphaltId)) {
        map.addLayer({...common,id:asphaltId,
          layout:{visibility:'none','line-cap':'round','line-join':'round'},
          paint:{'line-color':ASPHALT,'line-opacity':1,'line-width':1}
        },beforeRoadPaint);
      }
      if (!roadOverlayIds.includes(asphaltId)) roadOverlayIds.push(asphaltId);
    }
    for (let index=0;index<roadLines.length;index++) {
      const [,data]=roadLines[index];
      const base=data.layer;
      const centerId='gta-road-center-'+index;
      if (Number.isFinite(base.maxzoom) && base.maxzoom<=14) continue;
      if (!map.getLayer(centerId)) {
        const common={type:'line',source:base.source,minzoom:Math.max(14,base.minzoom||0)};
        if (base['source-layer']) common['source-layer']=base['source-layer'];
        if (base.filter) common.filter=base.filter;
        if (Number.isFinite(base.maxzoom)) common.maxzoom=base.maxzoom;
        map.addLayer({...common,id:centerId,
          layout:{visibility:'none','line-cap':'butt','line-join':'round'},
          paint:{
            'line-color':'#f2f2ea','line-opacity':0.92,
            'line-width':1,'line-dasharray':[7,10]
          }
        },beforeRoadPaint);
      }
      if (!roadOverlayIds.includes(centerId)) roadOverlayIds.push(centerId);
    }
  }
  function applyRoadStyle() {
    const latitude=Number(map.getCenter()?.lat)||0;
    roadWidthLatitude=latitude;
    const width=prefs.roadWidthMeters;
    const nextWidth=metricLineWidth(width,latitude);
    if(prefs.roadTwoLanes) {
      try { ensureRoadOverlays(); }
      catch(error) { console.warn('OcToS GTA · capas de carretera:',error); }
    }
    for(const [id,original] of roadPaints) {
      if(!map.getLayer(id))continue;
      try {
        map.setPaintProperty(id,'line-width',nextWidth);
        map.setPaintProperty(id,'line-color',
          prefs.roadTwoLanes && driveableRoad(original.layer) ? EDGE :
          prefs.roadTint ? prefs.roadColor : original.color ?? null);
        map.setPaintProperty(id,'line-opacity',
          prefs.roadTwoLanes && driveableRoad(original.layer) ? 1 : original.opacity ?? null);
      } catch(error) {
        console.warn('OcToS GTA · aspecto carretera:',id,error);
      }
    }
    const asphaltWidth=metricLineWidth(Math.max(0.2,width-2.2),latitude);
    const centerWidth=metricLineWidth(Math.min(0.6,width*0.045),latitude);
    for(const id of roadOverlayIds) {
      if(!map.getLayer(id))continue;
      try {
        if(id.startsWith('gta-road-asphalt-')) {
          map.setPaintProperty(id,'line-color',prefs.roadTint?prefs.roadColor:ASPHALT);
          map.setPaintProperty(id,'line-width',asphaltWidth);
        } else {
          map.setPaintProperty(id,'line-width',centerWidth);
        }
      } catch(error) {console.warn('OcToS GTA · pintura vial:',id,error);}
    }
    applyRoads();
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
  // La opacidad es un porcentaje relativo a la opacidad original del estilo.
  // Con 100% se restaura exactamente el aspecto de origen del mapa base.
  function applyGroupAppearance(name) {
    const factor = prefs[name+'Opacity'] / 100;
    for (const [id,{type,original}] of groupPaints[name]) {
      if (!map.getLayer(id)) continue;
      const keys = type === 'symbol' ?
        [['text-color','text-opacity'],['icon-color','icon-opacity']] :
        type === 'fill' ? [['fill-color','fill-opacity']] :
        type === 'line' ? [['line-color','line-opacity']] : [];
      for (const [colorKey,opacityKey] of keys) {
        try {
          const originalColor=original[colorKey];
          map.setPaintProperty(id,colorKey,prefs[name+'Tint'] ?
            prefs[name+'Color'] : originalColor ?? null);
          const base=original[opacityKey];
          const newOpacity=factor===1 ? base ?? null :
            base==null ? factor :
            typeof base==='number' ? base*factor :
            Array.isArray(base) ? ['*',base,factor] : factor;
          map.setPaintProperty(id,opacityKey,newOpacity);
        } catch(error) {
          console.warn('OcToS GTA · aspecto de '+name+':',id,error);
        }
      }
    }
  }
  function applyGroupAppearances() {
    for (const name of ['water','green','poi']) applyGroupAppearance(name);
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
    get('road-two-lanes').checked=prefs.roadTwoLanes;
    for (const name of ['water','green','poi']) {
      get(name+'-tint').checked=prefs[name+'Tint'];
      get(name+'-color').value=prefs[name+'Color'];
      get(name+'-opacity').value=String(prefs[name+'Opacity']);
      get(name+'-percent').textContent=prefs[name+'Opacity']+'%';
    }
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
    applyGroupAppearances();
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
  get('road-two-lanes').addEventListener('change',event => {
    prefs.roadTwoLanes=Boolean(event.target.checked);
    applyRoadStyle();render();save();
  });
  for (const name of ['water','green','poi']) {
    get(name+'-color').addEventListener('input',event => {
      if (!/^#[0-9a-f]{6}$/i.test(event.target.value)) return;
      prefs[name+'Color']=event.target.value;
      prefs[name+'Tint']=true;
      applyGroupAppearance(name);render();save();
    });
    get(name+'-tint').addEventListener('change',event => {
      prefs[name+'Tint']=Boolean(event.target.checked);
      applyGroupAppearance(name);render();save();
    });
    get(name+'-opacity').addEventListener('input',event => {
      prefs[name+'Opacity']=Math.min(100,Math.max(0,Number(event.target.value)||0));
      applyGroupAppearance(name);render();save();
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
      save(); // Persistir la migración de valores predeterminados v2.
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
