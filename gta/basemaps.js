/* OcToS GTA · Mapas base del catálogo compartido 2.8, con estados de aprobación.
   En mapas raster mantenemos el mapa vectorial para no perder carreteras/edificios.
   Al cambiar de estilo vectorial se reconstruyen las capas del juego en el mismo WebGL. */
const CHOICE_KEY='octos-gta-basemap-v1';
const DARK=Object.freeze({
  id:'gta-dark',name:'GTA · OpenFreeMap Dark (actual)',
  type:'MAPLIBRE_STYLE',url:'https://tiles.openfreemap.org/styles/dark',
  status:'actual',attribution:'© OpenFreeMap / OpenStreetMap'
});
const LIBERTY=Object.freeze({
  id:'drive-liberty',name:'OcToS Drive · OpenFreeMap Liberty',
  type:'MAPLIBRE_STYLE',url:'https://tiles.openfreemap.org/styles/liberty',
  status:'aprobada',attribution:'© OpenFreeMap / OpenStreetMap'
});
const catalogURL=new URL('../layers/basemaps.json',import.meta.url);
const RASTER_ID='gta-editor-basemap';
const hexSpain=(lon,lat)=>Number.isFinite(lon)&&Number.isFinite(lat)&&lon>=-18.6&&lon<=4.6&&lat>=27.4&&lat<=44.2;
const isSafe=(item)=>item && /^[a-z0-9-]+$/.test(item.id)&&
  (item.type==='TMS'||item.type==='XYZ'||item.type==='MAPLIBRE_STYLE')&&
  typeof item.url==='string'&&item.url.startsWith('https://');

export function mountBasemaps({world,layerControls,actor,report}) {
  const map=world.map;
  const input=document.getElementById('editor-basemap');
  const message=document.getElementById('editor-basemap-status');
  let entries=[DARK,LIBERTY];
  let active='gta-dark';
  let vectorStyle='gta-dark';
  let changing=false;
  let revision=0;
  let onBusy=()=>{};

  function note(value){message.textContent=value;}
  function store(){
    try{localStorage.setItem(CHOICE_KEY,active);}
    catch{ /* Sin almacenamiento disponible; funciona durante la sesión. */ }
  }
  function render(){
    const previous=input.value;
    input.replaceChildren();
    for(const [name,group] of [
      ['Activos / aprobados',entries.filter(e=>e.status==='actual'||e.status==='aprobada')],
      ['Pruebas · pendientes de validar',entries.filter(e=>e.status!=='actual'&&e.status!=='aprobada')]
    ]){
      if(!group.length)continue;
      const holder=document.createElement('optgroup');
      holder.label=name;
      for(const e of group) {
        const option=new Option(e.name+(e.status==='pendiente'?' · pendiente':''),e.id);
        holder.append(option);
      }
      input.append(holder);
    }
    input.value=entries.some(e=>e.id===active)?active:previous;
  }
  const ready=(async()=>{
    try{
      const response=await fetch(catalogURL,{cache:'no-store'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const list=await response.json();
      if(list.schemaVersion!==2||!Array.isArray(list.items))throw Error('Catálogo incompatible');
      const allowed=list.items.filter(isSafe);
      entries=[DARK,...allowed];
      if(!entries.some(item=>item.id==='drive-liberty'))entries.push(LIBERTY);
      note('Catálogo '+list.version+': aprobados y pendientes identificados.');
    }catch(error){
      note('Catálogo compartido no disponible: se muestran Dark y Liberty.');
      console.warn('OcToS GTA · catálogo de mapas:',error);
    }
    render();
  })();

  function removeRaster() {
    if(map.getLayer(RASTER_ID))map.removeLayer(RASTER_ID);
    if(map.getSource(RASTER_ID))map.removeSource(RASTER_ID);
  }
  function addRaster(entry) {
    const center=map.getCenter();
    if(!hexSpain(center.lng,center.lat))throw Error('Los mapas IGN de prueba solo cubren España.');
    removeRaster();
    const url=entry.url;
    const tms=entry.scheme==='tms'&&!url.includes('{-y}');
    // {-y} ya está incluido en los TMS del catálogo. MapLibre resuelve la cuadrícula invertida.
    map.addSource(RASTER_ID,{
      type:'raster',tiles:[url],tileSize:256,maxzoom:19,scheme:tms?'tms':'xyz',
      attribution:entry.attribution||'© IGN / CNIG'
    });
    const roads=map.getStyle().layers.find(layer=>
      layer.type==='line'&&/^(highway_|road_)/.test(layer.id)
    )?.id;
    const label=map.getStyle().layers.find(layer=>layer.type==='symbol')?.id;
    map.addLayer({id:RASTER_ID,type:'raster',source:RASTER_ID},roads||label);
  }
  function awaitStyleLoad(url) {
    return new Promise((resolve,reject)=>{
      let finished=false;
      const finish=error=>{
        if(finished)return;
        finished=true;
        clearTimeout(timer);
        map.off('style.load',loaded);
        map.off('error',failed);
        error?reject(error):resolve();
      };
      const loaded=()=>finish();
      const failed=event=>{
        const msg=String(event.error?.message||'');
        if(/style.*(load|fetch)|failed to fetch.*style|style is not done loading/i.test(msg))
          finish(new Error(msg));
      };
      const timer=setTimeout(()=>finish(new Error('El estilo no respondió dentro del tiempo de espera.')),20000);
      map.on('style.load',loaded);
      map.on('error',failed);
      try{map.setStyle(url,{diff:false});}
      catch(error){finish(error);}
    });
  }
  function rebuild() {
    world.resetAfterStyleChange();
    layerControls.refreshStyle();
    actor?.rebind?.();
    const clock=document.getElementById('daytime-hour')?.value||'16:30';
    world.setTime(clock);
    const current=map.getCenter();
    world.refreshShadows(current.lng,current.lat,true);
  }
  async function change(id,{silent=false}={}) {
    await ready;
    const entry=entries.find(item=>item.id===id);
    if(!entry||changing)return false;
    if(entry.id===active){input.value=active;return true;}
    const previous=active;
    const oldVector=vectorStyle;
    changing=true;
    input.disabled=true;
    onBusy(true);
    note('Aplicando '+entry.name+'…');
    try{
      if(entry.type==='MAPLIBRE_STYLE'){
        if(vectorStyle!==entry.id){
          await awaitStyleLoad(entry.url);
          vectorStyle=entry.id;
          rebuild();
        }else removeRaster();
      }else{
        addRaster(entry);
      }
      active=entry.id;
      input.value=active;
      store();
      note(entry.name+' · '+(entry.status==='pendiente'?'modo de prueba':entry.status));
      if(!silent)report('Mapa base aplicado: '+entry.name,'ok');
      return true;
    }catch(error){
      console.warn('OcToS GTA · mapa base:',error);
      try{
        if(entry.type==='MAPLIBRE_STYLE' && oldVector!==entry.id){
          const old=entries.find(item=>item.id===oldVector)||DARK;
          await awaitStyleLoad(old.url);
          vectorStyle=oldVector;
          rebuild();
        }
        // Puede conservarse el mapa anterior si falla la nueva ortofoto.
        if(previous!==oldVector){
          const previousEntry=entries.find(item=>item.id===previous);
          if(previousEntry?.type!=='MAPLIBRE_STYLE')addRaster(previousEntry);
        }
      }catch(recovery){console.warn('OcToS GTA · restauración mapa base:',recovery);}
      active=previous;
      input.value=active;
      note('No se pudo aplicar: '+error.message);
      if(!silent)report('Mapa base no disponible: '+error.message,'warn');
      return false;
    }finally{
      changing=false;
      input.disabled=false;
      onBusy(false);
      map.resize();
    }
  }
  input.addEventListener('change',()=>{void change(input.value);});
  async function restore() {
    await ready;
    let id;
    try{id=localStorage.getItem(CHOICE_KEY);}catch{}
    if(id && id!==active)await change(id,{silent:true});
  }
  return {
    ready,restore,change,
    getChoice:()=>active,
    setBusyCallback(fn){onBusy=typeof fn==='function'?fn:()=>{};},
    getEntries:()=>entries.slice()
  };
}
