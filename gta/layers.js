/* OcToS GTA · Catálogo compartido OcToS Layers: 46 entradas de la lista inicial.
   La lista se obtiene del JSON oficial, sin duplicar ni inventar servicios. */
const CATALOG_URL = new URL('../layers/catalog.json', import.meta.url);
const STORE = 'octos-gta-catalog-v1';
const LEGACY = 'octos-gta-layers-v2';
const IDS = new Set(Array.from({length:46},(_,i)=>'octos-'+String(i+1).padStart(3,'0')));
const LIDAR_TILES = 'https://wmts-mapa-lidar.idee.es/lidar?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=EL.GridCoverageDSM&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const inSpain = (lng,lat) => Number.isFinite(lng) && Number.isFinite(lat) &&
  lng>=-18.6 && lng<=4.6 && lat>=27.4 && lat<=44.2;
const safeText = value => String(value??'');
const clamp = value => Math.max(0,Math.min(100,Number(value)||0));
const canDisplay = item =>
  ['TMS','XYZ'].includes(item.kind) && /^https:\/\//.test(item.url) ||
  item.kind==='WMS' && Boolean(item.layer) && /^https:\/\//.test(item.url) ||
  item.id==='octos-012' || ['octos-010','octos-011','octos-009'].includes(item.id);

function load() {
  let old={};
  try { old=JSON.parse(localStorage.getItem(LEGACY)||'{}')||{}; } catch {}
  const defaults={
    buildings:typeof old.buildings==='boolean'?old.buildings:true,
    terrain:typeof old.terrain==='boolean'?old.terrain:true,
    dem:old.dem==='aws'?'aws':'mapterhorn',
    enabled:{'octos-012':old.lidar!==false},
    opacity:{'octos-012':Number.isFinite(old.lidarOpacity)?clamp(old.lidarOpacity):5}
  };
  if(old.pnoa)defaults.enabled['octos-005']=true;
  if(defaults.terrain)defaults.enabled[defaults.dem==='aws'?'octos-011':'octos-010']=true;
  try {
    const saved=JSON.parse(localStorage.getItem(STORE)||'null');
    if(!saved||typeof saved!=='object')return defaults;
    return {
      buildings:typeof saved.buildings==='boolean'?saved.buildings:defaults.buildings,
      terrain:typeof saved.terrain==='boolean'?saved.terrain:defaults.terrain,
      dem:saved.dem==='aws'?'aws':'mapterhorn',
      enabled:saved.enabled&&typeof saved.enabled==='object'?saved.enabled:defaults.enabled,
      opacity:saved.opacity&&typeof saved.opacity==='object'?saved.opacity:defaults.opacity
    };
  } catch {return defaults;}
}


// Curva visual Catmull-Rom/Hermite: interpola entre vértices existentes sin
// alterar las coordenadas, los ejes originales ni el trazado para conducción.
function smoothRoadGeometry(points) {
  if (!Array.isArray(points) || points.length < 3) return points;
  const clean=[];
  for (const p of points) {
    if (!Array.isArray(p) || !Number.isFinite(p[0]) || !Number.isFinite(p[1])) continue;
    if (!clean.length || Math.hypot(p[0]-clean.at(-1)[0],p[1]-clean.at(-1)[1])>1e-10)
      clean.push(p);
  }
  if (clean.length<3) return clean;
  const cos=Math.max(.087,Math.cos(clean[0][1]*Math.PI/180));
  const dist=(a,b)=>Math.hypot((b[0]-a[0])*111320*cos,(b[1]-a[1])*111320);
  const curve=[clean[0]];
  for (let i=0;i<clean.length-1;i++) {
    const p0=clean[Math.max(0,i-1)],p1=clean[i],p2=clean[i+1];
    const p3=clean[Math.min(clean.length-1,i+2)];
    const length=dist(p1,p2);
    if (length<.01) {curve.push(p2);continue;}
    const before=dist(p0,p1),after=dist(p2,p3);
    const m1=length/Math.max(.01,before+length);
    const m2=length/Math.max(.01,length+after);
    const steps=Math.max(3,Math.min(10,Math.ceil(length/5)));
    for (let j=1;j<=steps;j++) {
      if(j===steps){curve.push(p2);continue;}
      const t=j/steps,t2=t*t,t3=t2*t;
      const h00=2*t3-3*t2+1,h10=t3-2*t2+t;
      const h01=-2*t3+3*t2,h11=t3-t2;
      curve.push([0,1].map(axis=>
        h00*p1[axis]+h10*(p2[axis]-p0[axis])*m1+
        h01*p2[axis]+h11*(p3[axis]-p1[axis])*m2
      ));
    }
  }
  return curve;
}

export function mountLayerPanel(world,{report,setSettings}={}) {
  const map=world.map;
  const panel=document.getElementById('gta-catalog-tree');
  const message=document.getElementById('gta-catalog-status');
  const counter=document.getElementById('gta-catalog-count');
  const prefs=load();
  const byId=new Map();
  let records=[],location=null;
  let ready=false;
  let renderStyleRoads=()=>{};
  let removeRoadSmoothingListeners=()=>{};

  function save() {
    try {localStorage.setItem(STORE,JSON.stringify(prefs));} catch {}
  }
  function updateSettings() {
    if(typeof setSettings==='function')setSettings({
      buildings:prefs.buildings,terrain:prefs.terrain,dem:prefs.dem
    });
  }
  function isEnabled(item) {
    return Boolean(prefs.enabled[item.id]);
  }
  function displayable(item) {
    return canDisplay(item) && (
      !['TMS','XYZ','WMS','WMTS'].includes(item.kind) ||
      location && inSpain(location.lng,location.lat) ||
      !/\b(IGN|ICGC|IDEE|MITECO)\b/i.test(item.provider||'')
    );
  }
  function sourceId(item) {return 'gta-catalog-'+item.id;}
  function tilesFor(item) {
    if(item.id==='octos-012')return LIDAR_TILES;
    if(item.kind==='TMS'||item.kind==='XYZ')return item.url;
    if(item.kind==='WMS') {
      const url=new URL(item.url);
      for(const [key,value] of Object.entries({
        SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetMap',LAYERS:item.layer,
        STYLES:'',FORMAT:'image/png',TRANSPARENT:'TRUE',
        SRS:'EPSG:3857',BBOX:'{bbox-epsg-3857}',WIDTH:'256',HEIGHT:'256'
      }))url.searchParams.set(key,value);
      // MapLibre sustituye la plantilla BBOX, que URLSearchParams escaparía.
      return url.toString().replace('%7Bbbox-epsg-3857%7D','{bbox-epsg-3857}');
    }
    return null;
  }
  function applyRaster(item) {
    const id=sourceId(item),shown=isEnabled(item)&&displayable(item);
    if(!shown) {
      if(map.getLayer(id))map.setLayoutProperty(id,'visibility','none');
      return;
    }
    try {
      const tile=tilesFor(item);
      if(!tile)return;
      if(!map.getSource(id))map.addSource(id,{
        type:'raster',tiles:[tile],tileSize:256,maxzoom:19,
        attribution:item.provider||'OcToS Layers'
      });
      if(!map.getLayer(id)) {
        const before=map.getStyle().layers.find(layer=>layer.type==='symbol')?.id;
        map.addLayer({id,type:'raster',source:id,
          layout:{visibility:'visible'},
          paint:{'raster-opacity':clamp(prefs.opacity[id]??prefs.opacity[item.id]??item.opacity*100)/100}
        },before);
      }
      map.setLayoutProperty(id,'visibility','visible');
      map.setPaintProperty(id,'raster-opacity',clamp(prefs.opacity[item.id]??item.opacity*100)/100);
    } catch(error) {
      console.warn('OcToS GTA · capa '+item.id+':',error);
      report?.('No se pudo dibujar '+item.name+'.','warn');
    }
  }
  function updateElevation() {
    world.updateTerrain(prefs.terrain,prefs.dem);
    updateSettings();
  }
  function refreshEntries() {
    for(const item of records)
      if(!['octos-010','octos-011'].includes(item.id) &&
         ['TMS','XYZ','WMS','WMTS'].includes(item.kind))applyRaster(item);
  }
  function setEnabled(item,on) {
    if(!displayable(item))return;
    if(item.id==='octos-009') {
      const select=document.getElementById('editor-basemap');
      if(select&&Array.from(select.options).some(o=>o.value==='drive-liberty')){
        prefs.enabled[item.id]=on;
        select.value=on?'drive-liberty':'gta-dark';
        select.dispatchEvent(new Event('change',{bubbles:true}));
        save();render();
      }else report?.('Mapa base Liberty todavía no disponible.','warn');
      return;
    }
    if(item.id==='octos-010'||item.id==='octos-011') {
      prefs.enabled['octos-010']=false;prefs.enabled['octos-011']=false;
      prefs.enabled[item.id]=on;
      prefs.terrain=on;
      if(on)prefs.dem=item.id==='octos-011'?'aws':'mapterhorn';
      updateElevation();
    }else {
      prefs.enabled[item.id]=on;
      applyRaster(item);
    }
    save();render();
  }
  function render(){
    if(!ready)return;
    const previousOpen=new Map([...panel.querySelectorAll('details')].map(el=>
      [el.dataset.groupKey||el.dataset.providerKey,el.open]));
    panel.replaceChildren();
    const groups=[...new Set(records.map(item=>item.group||'Otras'))]
      .sort((a,b)=>a==='Mapas base'?-1:b==='Mapas base'?1:a.localeCompare(b,'es'));
    const initialFragment=document.createDocumentFragment();
    for(const group of groups) {
      const entries=records.filter(item=>(item.group||'Otras')===group);
      const section=document.createElement('details');
      section.className='gta-catalog-group';
      section.dataset.groupKey=group;
      section.open=previousOpen.get(group)??(group==='Mapas base'||group==='Elevaciones');
      const heading=document.createElement('summary');
      heading.textContent=group+' · '+entries.length;
      section.append(heading);
      const providers=[...new Set(entries.map(x=>x.provider||'Sin proveedor'))].sort((a,b)=>a.localeCompare(b,'es'));
      for(const provider of providers) {
        const subset=entries.filter(x=>(x.provider||'Sin proveedor')===provider);
        const sub=document.createElement('details');
        sub.className='gta-catalog-provider';
        sub.dataset.providerKey=group+'::'+provider;
        sub.open=previousOpen.get(sub.dataset.providerKey)??
          (group==='Mapas base'||group==='Elevaciones');
        const title=document.createElement('summary');
        title.textContent=provider+' ('+subset.length+')';sub.append(title);
        for(const item of subset) {
          const row=document.createElement('div');
          row.className='gta-catalog-entry';
          const label=document.createElement('label');
          label.className='gta-catalog-choice';
          const check=document.createElement('input');
          check.type='checkbox';
          check.checked=isEnabled(item);
          const allowed=displayable(item);
          check.disabled=!allowed;
          check.title=!canDisplay(item)?'Servicio sin capa de visualización directa configurada':
            !allowed?'Fuera de la cobertura geográfica estimada':'';
          const name=document.createElement('span');
          name.textContent=item.name;
          label.append(check,name);
          row.append(label);
          const meta=document.createElement('small');
          meta.textContent=item.kind+' · '+(allowed?item.status:'sin vista directa');
          row.append(meta);
          if(allowed && !['STYLE','TILEJSON'].includes(item.kind) && item.id!=='octos-011') {
            const slider=document.createElement('input');
            slider.type='range';slider.min='0';slider.max='100';slider.step='1';
            slider.className='gta-catalog-opacity';
            slider.setAttribute('aria-label','Opacidad de '+item.name);
            slider.value=String(clamp(prefs.opacity[item.id]??(item.id==='octos-012'?5:item.opacity*100)));
            slider.disabled=!check.checked || ['octos-010'].includes(item.id);
            const output=document.createElement('output');
            output.textContent=slider.value+'%';
            slider.addEventListener('input',()=>{
              prefs.opacity[item.id]=clamp(slider.value);
              output.textContent=slider.value+'%';
              applyRaster(item);save();
            });
            row.append(slider,output);
          }
          check.addEventListener('change',()=>setEnabled(item,check.checked));
          sub.append(row);
        }
        section.append(sub);
      }
      initialFragment.append(section);
    }
    panel.append(initialFragment);
    counter.textContent=records.length+' ENTRADAS';
    message.textContent='Catálogo original · categorías y proveedores · visualización según servicio.';
  }
  // Conserva las carreteras de dos carriles del juego sin recuperar el editor antiguo.
  function installRoadAppearance() {
    removeRoadSmoothingListeners();
    const roads=map.getStyle().layers.filter(l=>l.type==='line' &&
      /^(highway_(?!name)|road_(?!oneway))/i.test(l.id) &&
      !/(?:casing|outline|border|name|foot|path|cycle|track|rail|steps|construction)/i.test(l.id)
      && l.source);
    const all=map.getStyle().layers;
    const lastIndex=all.reduce((n,l,i)=>roads.some(r=>r.id===l.id)?i:n,-1);
    const before=all[lastIndex+1]?.id;
    let latitude=null;
    const width=(meters,lat)=> {
      const scale=156543.03392804097*Math.max(.087,Math.cos(lat*Math.PI/180));
      return ['interpolate',['exponential',2],['zoom'],0,meters/scale,24,meters*Math.pow(2,24)/scale];
    };
    const styles=[];
    for(let i=0;i<roads.length;i++){
      const base=roads[i];
      const shared={type:'line',source:base.source};
      if(base['source-layer'])shared['source-layer']=base['source-layer'];
      if(base.filter)shared.filter=base.filter;
      if(Number.isFinite(base.minzoom))shared.minzoom=base.minzoom;
      if(Number.isFinite(base.maxzoom))shared.maxzoom=base.maxzoom;
      for(const [suffix,paint] of [
        ['asfalto',{'line-color':'#202225','line-width':1}],
        ['centro',{'line-color':'#f2f2ea','line-width':1,'line-dasharray':[7,10],'line-opacity':.92}]
      ]){
        if(suffix==='centro'&&Number.isFinite(base.maxzoom)&&base.maxzoom<=14)continue;
        const id='gta-carretera-'+suffix+'-'+i;
        if(!map.getLayer(id)){
          const layer={...shared,id,
            layout:{'line-cap':suffix==='centro'?'butt':'round','line-join':'round'},
            paint};
          if(suffix==='centro')layer.minzoom=Math.max(14,base.minzoom||0);
          map.addLayer(layer,before);
        }
        styles.push({id,suffix});
      }
    }
    // Capa GeoJSON exclusivamente visual para suavizar los vértices de
    // los ejes; las carreteras originales permanecen inalteradas.
    const curvedId='gta-road-centers-curved';
    const empty={type:'FeatureCollection',features:[]};
    if(roads.length && !map.getSource(curvedId))
      map.addSource(curvedId,{type:'geojson',data:empty});
    if(roads.length && !map.getLayer(curvedId)){
      const firstSymbol=map.getStyle().layers.find(l=>l.type==='symbol')?.id;
      map.addLayer({
        id:curvedId,type:'line',source:curvedId,minzoom:14,
        layout:{'line-cap':'round','line-join':'round'},
        paint:{'line-color':'#f2f2ea','line-width':width(.6,map.getCenter().lat),
          'line-dasharray':[7,10],'line-opacity':.92}
      },firstSymbol);
    }
    const baseCenterIds=styles.filter(x=>x.suffix==='centro').map(x=>x.id);
    const setFallback=visible=>{
      for(const id of baseCenterIds)
        if(map.getLayer(id))map.setLayoutProperty(id,'visibility',visible?'visible':'none');
    };
    let lastUpdate=0,lastCenter=null,lastZoom=null,timer=null;
    const rebuildCurves=()=>{
      timer=null;
      const source=map.getSource(curvedId);
      if(!source||!map.isStyleLoaded())return;
      const position=map.getCenter(),zoom=map.getZoom(),now=performance.now();
      const moved=lastCenter?Math.hypot(
        (position.lng-lastCenter.lng)*111320*Math.cos(position.lat*Math.PI/180),
        (position.lat-lastCenter.lat)*111320):Infinity;
      // Evitar recalcular las curvas con cada fotograma del seguimiento 3D.
      if(now-lastUpdate<650 || moved<18 && Math.abs(zoom-lastZoom)<.4 && now-lastUpdate<2200)return;
      lastUpdate=now;lastCenter=position;lastZoom=zoom;
      if(zoom<14){source.setData(empty);setFallback(true);return;}
      let rendered;
      try{rendered=map.queryRenderedFeatures({layers:roads.map(x=>x.id)});}
      catch(error){console.warn('OcToS GTA · curvas de carretera:',error);return;}
      const seen=new Set(),features=[];
      for(const feature of rendered.slice(0,1600)){
        const geom=feature.geometry;
        if(!geom || !['LineString','MultiLineString'].includes(geom.type))continue;
        const lines=geom.type==='LineString'?[geom.coordinates]:geom.coordinates;
        for(const line of lines){
          if(!Array.isArray(line)||line.length<2)continue;
          const key=line.length+':'+line[0].join(',')+':'+line.at(-1).join(',');
          if(seen.has(key))continue;
          seen.add(key);
          const smoothed=smoothRoadGeometry(line);
          if(smoothed.length>=2)features.push({
            type:'Feature',properties:{},geometry:{type:'LineString',coordinates:smoothed}
          });
        }
      }
      source.setData({type:'FeatureCollection',features});
      setFallback(features.length===0);
    };
    const queueCurves=()=>{
      if(timer!==null)return;
      timer=setTimeout(rebuildCurves,220);
    };
    const onSourceData=event=>{
      if(roads.some(x=>x.source===event.sourceId))queueCurves();
    };
    map.on('sourcedata',onSourceData);
    map.on('moveend',queueCurves);
    removeRoadSmoothingListeners=()=>{
      map.off('sourcedata',onSourceData);
      map.off('moveend',queueCurves);
      if(timer!==null)clearTimeout(timer);
      timer=null;
    };
    const draw=()=>{
      const lat=map.getCenter()?.lat??0;
      if(!Number.isFinite(lat))return;
      latitude=lat;
      for(const road of roads){
        if(!map.getLayer(road.id))continue;
        map.setPaintProperty(road.id,'line-width',width(16,lat));
        map.setPaintProperty(road.id,'line-color','#73777b');
      }
      for(const {id,suffix} of styles)if(map.getLayer(id))
        map.setPaintProperty(id,'line-width',width(suffix==='asfalto'?13.8:.6,lat));
      if(map.getLayer(curvedId))map.setPaintProperty(curvedId,'line-width',width(.6,lat));
    };
    renderStyleRoads=draw;
    draw();
    queueCurves();
  }
  map.on('moveend',()=>{
    const lat=map.getCenter()?.lat;
    if(Number.isFinite(lat))renderStyleRoads();
  });
  const readyPromise=fetch(CATALOG_URL,{cache:'no-store'})
    .then(response=>{if(!response.ok)throw Error('HTTP '+response.status);return response.json();})
    .then(data=>{
      if(!Array.isArray(data.items))throw Error('Catálogo no válido');
      records=data.items.filter(item=>IDS.has(item.id));
      if(records.length!==46)throw Error('Se esperaban 46 fichas, recibidas '+records.length);
      for(const record of records)byId.set(record.id,record);
      ready=true;render();refreshEntries();
    })
    .catch(error=>{
      message.textContent='Catálogo OcToS Layers no disponible: '+error.message;
      console.warn('GTA · catálogo:',error);
    });
  return {
    ready:readyPromise,
    initialize(lng,lat) {
      location={lng,lat};
      updateSettings();
      updateElevation();
      world.updateBuildings(prefs.buildings);
      installRoadAppearance();
      save();
    },
    updateLocation(lng,lat){
      const previous=location&&inSpain(location.lng,location.lat);
      location={lng,lat};
      if(previous!==inSpain(lng,lat)){refreshEntries();render();}
    },
    refreshStyle(){
      installRoadAppearance();
      updateElevation();
      world.updateBuildings(prefs.buildings);
      refreshEntries();
    },
    getPreferences(){return {buildings:prefs.buildings,terrain:prefs.terrain,dem:prefs.dem,
      catalog:{enabled:{...prefs.enabled},opacity:{...prefs.opacity}}};},
    savePreferences(){save();},
    syncSettings({buildings,terrain,dem}={}){
      if(typeof buildings==='boolean')prefs.buildings=buildings;
      if(typeof terrain==='boolean')prefs.terrain=terrain;
      if(dem==='mapterhorn'||dem==='aws')prefs.dem=dem;
      prefs.enabled['octos-010']=prefs.terrain&&prefs.dem==='mapterhorn';
      prefs.enabled['octos-011']=prefs.terrain&&prefs.dem==='aws';
      save();render();
    }
  };
}
