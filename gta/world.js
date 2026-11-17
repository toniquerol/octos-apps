import {createDaylight} from './daylight.js?v=1';

/* OcToS GTA V1 · Escenario geográfico independiente de OcToS Drive. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const TERRAIN = {
  mapterhorn: {
    tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
    tileSize: 512, maxzoom: 13, encoding: 'terrarium',
    attribution: 'Elevaciones: Mapterhorn'
  },
  aws: {
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    tileSize: 256, maxzoom: 12, encoding: 'terrarium',
    attribution: 'Elevaciones: Mapzen / AWS Open Data'
  }
};

export async function createWorld(start, report, {selection = false} = {}) {
  const lib = window.maplibregl;
  if (!lib || typeof lib.Map !== 'function') {
    throw new Error('No se ha cargado MapLibre GL JS. Revisa la conexión.');
  }
  // Algunas distribuciones de MapLibre no exponen supported().
  if (typeof lib.supported === 'function' && !lib.supported()) {
    throw new Error('Este navegador no dispone de WebGL compatible.');
  }
  const map = new lib.Map({
    container: 'map', style: MAP_STYLE,
    center: [start.lon, start.lat], zoom: selection ? 13 : 17.2, pitch: selection ? 0 : 68, bearing: 0,
    maxPitch: 80, minZoom: 4, maxZoom: 19,
    antialias: false, dragPan: selection, dragRotate: false,
    touchZoomRotate: false, attributionControl: false,
    fadeDuration: 0, renderWorldCopies: false
  });
  map.addControl(new lib.AttributionControl({compact: true}), 'bottom-right');
  let terrainActive = false;
  let buildingsActive = false;
  let provider = 'mapterhorn';
  let buildingsId = null;
  let buildingColor = '#707783';
  let buildingOpacity = 0.84;
  const daylight = createDaylight(map);
  let currentTime = '16:30';

  // Mapterhorn se muestra sin bruma atmosférica; el relieve y la luz solar se conservan.
  function clearMapterhornHaze() {
    if (provider === 'mapterhorn' && typeof map.setSky === 'function') map.setSky(undefined);
  }

  function setTime(value) {
    if (!daylight.setTime(value)) return false;
    currentTime = value;
    clearMapterhornHaze();
    return true;
  }

  let tileErrorReported = false;

  map.on('error', event => {
    const message = String(event.error?.message || '');
    if (!tileErrorReported && /tile|terrain|fetch|network|style|failed/i.test(message)) {
      tileErrorReported = true;
      report('Alguna tesela externa no se ha descargado. Puede faltar relieve o cartografía.', 'warn');
    }
    console.warn('OcToS GTA · mapa:', event.error || event);
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('No se ha podido cargar OpenFreeMap. Revisa la conexión.')), 20000);
    map.once('load', () => { clearTimeout(timeout); resolve(); });
    map.once('error', event => {
      const message = String(event.error?.message || '');
      if (/style.*(load|fetch)|Failed to fetch/i.test(message)) {
        clearTimeout(timeout);
        reject(new Error('Error al cargar el estilo geográfico: ' + message));
      }
    });
  });


  // Ocultar únicamente los nombres de calles y carreteras del mapa base.
  for (const id of ['highway_name_other', 'highway_name_motorway']) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', 'none');
  }

  function updateBuildings(visible) {
    buildingsActive = Boolean(visible);
    if (buildingsId && map.getLayer(buildingsId)) {
      map.setLayoutProperty(buildingsId, 'visibility', buildingsActive ? 'visible' : 'none');
      daylight.setBuildings(buildingsId ? map.getLayer(buildingsId)?.source : null, buildingsId, buildingsActive);
      return true;
    }
    if (!buildingsActive) {
      daylight.setBuildings(null, null, false);
      return false;
    }
    const sources = map.getStyle().sources;
    const vectorId = Object.keys(sources).find(id => sources[id].type === 'vector');
    if (!vectorId) {
      report('La cartografía cargada no contiene una fuente vectorial de edificios.', 'warn');
      return false;
    }
    const firstSymbol = map.getStyle().layers.find(layer => layer.type === 'symbol');
    buildingsId = 'octos-gta-buildings';
    try {
      map.addLayer({
        id: buildingsId, type: 'fill-extrusion', source: vectorId, 'source-layer': 'building',
        minzoom: 14, layout: {visibility: 'visible'},
        paint: {
          'fill-extrusion-color': buildingColor,
          'fill-extrusion-height': [
            'max', 2,
            ['to-number', ['get', 'render_height'], ['*', ['to-number', ['get', 'building:levels'], 3], 3]]
          ],
          'fill-extrusion-base': ['to-number', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': buildingOpacity
        }
      }, firstSymbol?.id);
      daylight.setBuildings(vectorId, buildingsId, true);
      return true;
    } catch (error) {
      buildingsId = null;
      daylight.setBuildings(null, null, false);
      report('Edificios 3D no disponibles en este estilo cartográfico.', 'warn');
      console.warn('OcToS GTA · edificios:', error);
      return false;
    }
  }

  function setBuildingAppearance(color, opacity) {
    if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) buildingColor = color;
    if (Number.isFinite(opacity)) buildingOpacity = Math.max(0, Math.min(1, opacity));
    if (buildingsId && map.getLayer(buildingsId)) {
      map.setPaintProperty(buildingsId, 'fill-extrusion-color', buildingColor);
      map.setPaintProperty(buildingsId, 'fill-extrusion-opacity', buildingOpacity);
    }
    return {color:buildingColor, opacity:buildingOpacity};
  }

  function updateTerrain(enabled, nextProvider = provider) {
    const previousProvider = provider;
    provider = TERRAIN[nextProvider] ? nextProvider : 'mapterhorn';
    terrainActive = Boolean(enabled);
    try {
      map.setTerrain(null);
      if (map.getSource('octos-gta-terrain')) map.removeSource('octos-gta-terrain');
      if (terrainActive) {
        map.addSource('octos-gta-terrain', {type: 'raster-dem', ...TERRAIN[provider]});
        map.setTerrain({source: 'octos-gta-terrain', exaggeration: 1});
      }
      // Restaurar el cielo al usar AWS; eliminarlo al usar Mapterhorn.
      if (provider !== previousProvider) setTime(currentTime);
      else clearMapterhornHaze();
      return true;
    } catch (error) {
      terrainActive = false;
      report('Relieve no disponible; el mundo continúa en mapa 3D sin elevaciones.', 'warn');
      console.warn('OcToS GTA · relieve:', error);
      return false;
    }
  }

  function elevation(lon, lat) {
    if (!terrainActive || typeof map.queryTerrainElevation !== 'function') return null;
    try {
      const value = map.queryTerrainElevation([lon, lat]);
      return Number.isFinite(value) ? value : null;
    } catch { return null; }
  }

  function quality(level) {
    daylight.setQuality(level);
    const low = level === 'low';
    map.setMaxPitch(low ? 70 : 80);
    map.setFadeDuration?.(0);
    return low ? 20 : level === 'high' ? 45 : 30;
  }

  function resetAfterStyleChange() {
    // MapLibre descarta las capas del estilo anterior; conservar solo parámetros.
    buildingsId = null;
    daylight.setBuildings(null,null,false);
  }

  function enterEditor() {
    map.setMaxZoom(20);
    map.dragPan.enable();
    map.scrollZoom.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
    map.dragRotate.enable();
  }

  function enterGame() {
    // Se amplía solo al entrar al juego; el selector geográfico conserva su zoom.
    map.setMaxZoom(24);
    map.dragPan.disable();
    map.scrollZoom.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
    map.dragRotate.disable();
  }
  return {
    map, updateBuildings, updateTerrain, setBuildingAppearance,
    elevation, quality, enterGame, enterEditor, resetAfterStyleChange,
    setTime, refreshShadows: daylight.refreshShadows
  };
}
