/* OcToS GTA · Iluminación solar y sombras 2D de bajo coste. */
const EMPTY = () => ({type: 'FeatureCollection', features: []});
const RAD = Math.PI / 180;
const SHADOW_SOURCE = 'octos-gta-shadow-data';
const SHADOW_LAYER = 'octos-gta-shadow-fill';

function clock(value) {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  return h + m / 60;
}

function solarPosition(hour) {
  // Ciclo estilizado: amanecer 06:00, ocaso 20:00. No es un cálculo astronómico.
  const day = hour >= 6 && hour < 20;
  const progress = Math.max(0, Math.min(1, (hour - 6) / 14));
  const elevation = day ? 60 * Math.sin(progress * Math.PI) : -8;
  return {day, elevation, azimuth: 90 + progress * 180};
}

function hull(points) {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
    lower.push(point);
  }
  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const point = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
    upper.push(point);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

function metersBetween(a, b, lat) {
  const x = (a[0] - b[0]) * 111320 * Math.max(0.087, Math.cos(lat * RAD));
  const y = (a[1] - b[1]) * 111320;
  return Math.hypot(x, y);
}

function buildingHeight(properties) {
  const height = Number(properties.render_height);
  if (Number.isFinite(height) && height > 0) return height;
  const levels = Number(properties['building:levels']);
  return Number.isFinite(levels) && levels > 0 ? levels * 3 : 9;
}

export function createDaylight(map) {
  let sun = solarPosition(16.5);
  let vectorSource = null;
  let buildingsLayer = null;
  let buildingsVisible = false;
  let quality = 'balanced';
  let lastPosition = null;
  let lastUpdate = 0;
  let lastCount = 0;

  function clearShadows() {
    const source = map.getSource(SHADOW_SOURCE);
    if (source && lastCount) source.setData(EMPTY());
    lastCount = 0;
    lastPosition = null;
    lastUpdate = 0;
  }

  function ensureShadowLayer() {
    if (!map.getSource(SHADOW_SOURCE)) map.addSource(SHADOW_SOURCE, {type: 'geojson', data: EMPTY()});
    if (!map.getLayer(SHADOW_LAYER)) {
      map.addLayer({
        id: SHADOW_LAYER, type: 'fill', source: SHADOW_SOURCE,
        paint: {'fill-color': '#141927', 'fill-opacity': 0.25}
      }, buildingsLayer);
    }
  }

  function setBuildings(sourceId, layerId, visible) {
    vectorSource = sourceId;
    buildingsLayer = layerId;
    buildingsVisible = Boolean(visible);
    if (!buildingsVisible) clearShadows();
    else if (vectorSource && buildingsLayer) {
      try { ensureShadowLayer(); }
      catch (error) { console.warn('OcToS GTA · capa de sombras:', error); }
      lastPosition = null;
    }
  }

  function setQuality(level) {
    quality = ['low', 'balanced', 'high'].includes(level) ? level : 'balanced';
    lastPosition = null;
  }

  function setTime(value) {
    const hour = clock(value);
    if (hour === null) return false;
    sun = solarPosition(hour);
    const twilight = sun.day && sun.elevation < 16;
    const colors = !sun.day
      ? {sky: '#101626', horizon: '#20273a', fog: '#1c2534', light: '#95a7cd', intensity: 0.16}
      : twilight
        ? {sky: '#566e9d', horizon: '#ce9374', fog: '#ad8691', light: '#ffd19f', intensity: 0.46}
        : {sky: '#689cc9', horizon: '#c7d7df', fog: '#a9bccc', light: '#fff2dc', intensity: 0.63};
    try {
      map.setLight({
        anchor: 'map',
        position: [1.4, sun.azimuth, 90 - Math.max(0, sun.elevation)],
        color: colors.light,
        intensity: colors.intensity
      });
      // MapLibre 4.7: setSky configura el cielo y la bruma, sin posprocesado volumétrico.
      if (typeof map.setSky === 'function') {
        map.setSky({
          'sky-color': colors.sky,
          'horizon-color': colors.horizon,
          'fog-color': colors.fog,
          'sky-horizon-blend': 0.45,
          'horizon-fog-blend': 0.48,
          'fog-ground-blend': 0.35,
          'atmosphere-blend': 1
        });
      }
      if (!sun.day || sun.elevation < 7) clearShadows();
      else lastPosition = null;
    } catch (error) {
      console.warn('OcToS GTA · iluminación:', error);
      return false;
    }
    return true;
  }

  function refreshShadows(lon, lat, force = false) {
    if (!buildingsVisible || !vectorSource || !buildingsLayer || !sun.day || sun.elevation < 7) return;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    const now = performance.now();
    if (!force && now - lastUpdate < 4000) return;
    if (!force && lastPosition && lastCount && metersBetween([lon, lat], lastPosition, lat) < 75) return;
    lastUpdate = now;
    lastPosition = [lon, lat];
    const source = map.getSource(SHADOW_SOURCE);
    if (!source) return;

    let buildings;
    try { buildings = map.querySourceFeatures(vectorSource, {sourceLayer: 'building'}); }
    catch { return; } // Esperar a que se descarguen las teselas vectoriales.

    const radius = 260;
    const seen = new Set();
    const candidates = [];
    for (const feature of buildings) {
      const geometry = feature.geometry;
      if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) continue;
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      const height = Math.min(120, Math.max(2, buildingHeight(feature.properties || {})));
      for (const polygon of polygons) {
        const ring = polygon[0];
        if (!ring || ring.length < 4) continue;
        let x = 0, y = 0;
        const count = ring.length - 1;
        for (let i = 0; i < count; i++) { x += ring[i][0]; y += ring[i][1]; }
        const center = [x / count, y / count];
        const distance = metersBetween(center, [lon, lat], lat);
        if (distance > radius) continue;
        const key = center[0].toFixed(5) + ',' + center[1].toFixed(5) + ',' + Math.round(height);
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push({ring, height, center, distance});
      }
    }
    candidates.sort((a, b) => a.distance - b.distance);
    const limit = quality === 'low' ? 100 : quality === 'high' ? 260 : 180;
    const result = EMPTY();
    const opposite = (sun.azimuth + 180) * RAD;
    const directionEast = Math.sin(opposite);
    const directionNorth = Math.cos(opposite);
    const elevation = Math.max(12, sun.elevation) * RAD;
    for (const item of candidates.slice(0, limit)) {
      const length = Math.min(90, item.height / Math.tan(elevation));
      const lonScale = 111320 * Math.max(0.087, Math.cos(item.center[1] * RAD));
      const dx = directionEast * length / lonScale;
      const dy = directionNorth * length / 111320;
      // El contorno y el techo desplazado forman una silueta convexa sin malla 3D.
      const points = [];
      for (let i = 0; i < item.ring.length - 1; i++) {
        const point = item.ring[i];
        points.push([point[0], point[1]], [point[0] + dx, point[1] + dy]);
      }
      const ring = hull(points);
      if (ring.length < 3) continue;
      ring.push(ring[0]);
      result.features.push({
        type: 'Feature',
        properties: {},
        geometry: {type: 'Polygon', coordinates: [ring]}
      });
    }
    source.setData(result);
    lastCount = result.features.length;
  }

  return {setTime, setBuildings, setQuality, refreshShadows};
}
