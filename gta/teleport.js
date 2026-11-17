/* OcToS GTA · Teleportación sobre mapa 2D temporal.
   El segundo contexto WebGL solo existe mientras el diálogo está abierto. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const $ = id => document.getElementById(id);

export function mountTeleport({game, report, teleport}) {
  const dialog = $('teleport-dialog');
  const openButton = $('teleport-open');
  const closeButton = $('teleport-cancel');
  const applyButton = $('teleport-apply');
  const coordinates = $('teleport-selected');
  let miniMap = null;
  let marker = null;
  let destination = null;
  let wasPlaying = false;

  function display(lng, lat) {
    destination = {lat, lon:lng};
    coordinates.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    marker?.setLngLat([lng, lat]);
    applyButton.disabled = false;
  }

  function cleanup() {
    if (miniMap) {
      miniMap.remove();
      miniMap = null;
    }
    marker = null;
    destination = null;
    if (wasPlaying && !document.body.classList.contains('editing')) game.resume();
    wasPlaying = false;
  }

  function open() {
    if (dialog.open || document.body.classList.contains('editing')) return;
    wasPlaying = game.active;
    game.pause();
    dialog.showModal();
    destination = {lat:game.state.lat, lon:game.state.lon};
    coordinates.textContent = game.state.lat.toFixed(5) + ', ' + game.state.lon.toFixed(5);
    applyButton.disabled = false;
    try {
      miniMap = new window.maplibregl.Map({
        container: 'teleport-map',
        style: MAP_STYLE,
        center: [game.state.lon, game.state.lat],
        zoom: 13,
        minZoom: 3, maxZoom: 19,
        pitch: 0, bearing: 0, maxPitch: 0,
        antialias: false,
        attributionControl: false,
        renderWorldCopies: false,
        fadeDuration: 0
      });
      miniMap.addControl(new window.maplibregl.AttributionControl({compact:true}), 'bottom-right');
      marker = new window.maplibregl.Marker({color:'#ff6a1a'})
        .setLngLat([game.state.lon, game.state.lat]).addTo(miniMap);
      miniMap.on('click', event => display(event.lngLat.lng, event.lngLat.lat));
      miniMap.on('load', () => {
        for (const layer of miniMap.getStyle().layers) {
          if (layer.type === 'fill-extrusion' && miniMap.getLayer(layer.id)) {
            miniMap.setLayoutProperty(layer.id, 'visibility', 'none');
          }
        }
      });
    } catch (error) {
      console.warn('OcToS GTA · teletransporte:', error);
      report('El mapa de teletransporte no está disponible.', 'warn');
      dialog.close();
    }
  }

  function apply() {
    if (!destination) return;
    teleport(destination.lat, destination.lon, 'Punto de teletransporte');
    dialog.close();
  }

  openButton.addEventListener('click', open);
  closeButton.addEventListener('click', () => dialog.close());
  applyButton.addEventListener('click', apply);
  dialog.addEventListener('close', cleanup);
  // El navegador puede cerrar el diálogo con Escape; el evento close limpia el mapa.
  return {open};
}
