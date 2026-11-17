/* OcToS GTA · Transición aérea de teletransporte y descenso a la cámara del coche. */
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/dark';
const $ = id => document.getElementById(id);

export function mountTeleport({world,game,report,teleport}) {
  const dialog=$('teleport-dialog');
  const openButton=$('teleport-open');
  const closeButton=$('teleport-cancel');
  const applyButton=$('teleport-apply');
  const coordinates=$('teleport-selected');
  let miniMap=null,marker=null,destination=null,wasPlaying=false,transitioning=false;

  function display(lng,lat) {
    destination={lat,lon:lng};
    coordinates.textContent=lat.toFixed(5)+', '+lng.toFixed(5);
    marker?.setLngLat([lng,lat]);
    applyButton.disabled=false;
  }
  function cleanup() {
    if(miniMap){miniMap.remove();miniMap=null;}
    marker=null;
    destination=null;
    // La partida no se reanuda mientras la cámara esté en vuelo.
    if(!transitioning){
      if(wasPlaying&&!document.body.classList.contains('editing'))game.resume();
      wasPlaying=false;
    }
  }
  function open() {
    if(transitioning||dialog.open||document.body.classList.contains('editing'))return;
    wasPlaying=game.active;
    game.pause();
    dialog.showModal();
    destination={lat:game.state.lat,lon:game.state.lon};
    coordinates.textContent=game.state.lat.toFixed(5)+', '+game.state.lon.toFixed(5);
    applyButton.disabled=false;
    try {
      miniMap=new window.maplibregl.Map({
        container:'teleport-map',style:MAP_STYLE,
        center:[game.state.lon,game.state.lat],zoom:13,
        minZoom:3,maxZoom:19,pitch:0,bearing:0,maxPitch:0,
        antialias:false,attributionControl:false,
        renderWorldCopies:false,fadeDuration:0
      });
      miniMap.addControl(new window.maplibregl.AttributionControl({compact:true}),'bottom-right');
      marker=new window.maplibregl.Marker({color:'#ff6a1a'})
        .setLngLat([game.state.lon,game.state.lat]).addTo(miniMap);
      miniMap.on('click',event=>display(event.lngLat.lng,event.lngLat.lat));
      miniMap.on('load',()=>{
        for(const layer of miniMap.getStyle().layers) {
          if(layer.type==='fill-extrusion'&&miniMap.getLayer(layer.id))
            miniMap.setLayoutProperty(layer.id,'visibility','none');
        }
      });
    }catch(error){
      console.warn('OcToS GTA · teleport:',error);
      report('El mapa de teletransporte no está disponible.','warn');
      dialog.close();
    }
  }

  // Duraciones acotadas para recuperar los controles aunque el navegador
  // interrumpa una transición o no emita el evento moveend.
  function animate(map,method,options,duration) {
    return new Promise((resolve,reject)=>{
      let finished=false;
      const finish=()=>{
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        map.off('moveend',finish);
        resolve();
      };
      const timer=setTimeout(finish,duration+900);
      map.once('moveend',finish);
      try{map[method]({...options,duration,essential:true});}
      catch(error){
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        map.off('moveend',finish);
        reject(error);
      }
    });
  }
  async function apply() {
    if(!destination||transitioning)return;
    const target={...destination};
    transitioning=true;
    applyButton.disabled=true;
    dialog.close();
    const map=world.map;
    let positioned=false;
    try{
      world.setRenderRadiusSuspended(true);
      map.stop();
      const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if(!reducedMotion){
        // 1. Zoom out y elevación desde el vehículo hasta la vista cenital.
        await animate(map,'easeTo',{
          center:[game.state.lon,game.state.lat],zoom:12.5,pitch:0,bearing:0,
          padding:{top:0,bottom:0,left:0,right:0}
        },1200);
        // 2. Tránsito geográfico con elevación automática si hay distancia.
        await animate(map,'flyTo',{
          center:[target.lon,target.lat],zoom:12.5,pitch:0,bearing:0,
          padding:{top:0,bottom:0,left:0,right:0},curve:1.4
        },1450);
      }
      // 3. Situar el BMW y descender exactamente a su cámara guardada.
      teleport(target.lat,target.lon,'Punto de teletransporte',{preserveCamera:true});
      positioned=true;
      const landing=game.updateCamera(0,true);
      if(landing&&!reducedMotion)await animate(map,'easeTo',landing,1700);
    }catch(error){
      console.warn('OcToS GTA · vuelo de teleport:',error);
      if(!positioned)teleport(target.lat,target.lon,'Punto de teletransporte',{preserveCamera:true});
      report('Animación aérea interrumpida; destino aplicado.','warn');
    }finally{
      map.stop();
      game.updateCamera();
      world.setRenderRadiusSuspended(false);
      if(wasPlaying&&!document.body.classList.contains('editing'))game.resume();
      transitioning=false;
      wasPlaying=false;
    }
  }
  openButton.addEventListener('click',open);
  closeButton.addEventListener('click',()=>dialog.close());
  applyButton.addEventListener('click',()=>{void apply();});
  dialog.addEventListener('close',cleanup);
  return {open};
}
