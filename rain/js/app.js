import{contours}from'./contours.js';
import{eventEstimate,areaPerCell}from'./rainfall.js';
import{extractStreams}from'./streams.js';
import{loadVisualTiff}from'./image-tiff.js';
import{mosaic}from'./mosaic.js';
import{FlowParticles}from'./flow-particles.js';
import{Terrain3D}from'./terrain3d.js';
import{officialCatalog}from'./catalog.js';
import{loadDEM,toLatLng,fromLatLng,cellAt,cellCenter}from'./dem.js';import{hillshade}from'./terrain.js';import{raster,demBounds,inside,maskGeometry}from'./render.js';import{grade}from'./grading.js';
const $=id=>document.getElementById(id),say=s=>$('status').textContent=s,fmt=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('es-ES',{maximumFractionDigits:d}):'—';let dem,terrain,hydro,grading,mask,worker,abort,mode='',points=[],drawLayer,vertices=[],crop,profile=[],features=[],rows=[],rasterLayer,profileMarker,lastBasin,visualLayer,flowAnimator,terrain3d,zoneMode='',zonePts=[],zoneLayer,zoneBounds,zoneMarker;const map=L.map('map',{zoomControl:false}).setView([40.1,-3.5],6);L.control.zoom({position:'topright'}).addTo(map);L.control.scale({imperial:false}).addTo(map);
// V6: panes fijos para evitar que las capas oficiales queden detrás del fondo.
for(const [name,z] of [['rainLidarPane',270],['rainVisualPane',310],['rainAnalysisPane',350],['rainThematicPane',480],['rainVectorPane',490]]){
 if(!map.getPane(name)){const pane=map.createPane(name);pane.style.zIndex=String(z);if(name==='rainThematicPane')pane.style.pointerEvents='none';}
}
const lidarUrl='https://wmts-mapa-lidar.idee.es/lidar?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=EL.GridCoverageDSM&STYLE=default&FORMAT=image/png&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}';
const bases=[
 'https://tms-ign-base.idee.es/1.0.0/IGNBaseTodo/{z}/{x}/{-y}.jpeg',
 'https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{-y}.jpeg',
 'https://tms-mapa-raster.ign.es/1.0.0/mapa-raster/{z}/{x}/{-y}.jpeg',
 'https://tms-ign-base.idee.es/1.0.0/IGNBaseGris/{z}/{x}/{-y}.jpeg',
 'https://tms-ign-base.idee.es/1.0.0/IGNBaseSimplificado/{z}/{x}/{-y}.png',
 'https://tms-relieve.idee.es/1.0.0/relieve/{z}/{x}/{-y}.jpeg',
 'https://xyz-mdt.idee.es/1.0.0/raster-dem/{z}/{x}/{y}.png',
 lidarUrl
];
let baseLayer;
function base(){
 baseLayer?.remove();
 const id=$('base').selectedIndex;
 baseLayer=L.tileLayer(bases[id],{maxZoom:20,maxNativeZoom:18,attribution:id===7?'LiDAR © IGN':'© IGN / CNIG',opacity:+$('baseOpacity').value});
 baseLayer.addTo(map);
 baseLayer.on('tileerror',()=>say('Alguna tesela del mapa base no está disponible. Prueba otro mapa base.'));
}
base();
$('base').onchange=()=>{base();$('baseMenuName').textContent=$('base').selectedOptions[0]?.textContent||'Mapa';if(terrain3d?.running)terrain3d.loadTexture(bases[$('base').selectedIndex]);};
$('baseOpacity').oninput=()=>{
 const value=+$('baseOpacity').value;
 baseLayer?.setOpacity(value);
 $('baseOpacityValue').textContent=Math.round(value*100)+' %';terrain3d?.setOpacity(value);
};
const lidar=L.tileLayer(lidarUrl,{pane:'rainLidarPane',opacity:.6,maxZoom:20,maxNativeZoom:18,attribution:'LiDAR © IGN'});$('lidar').onchange=()=>{$('lidar').checked?lidar.addTo(map):lidar.remove();rasterLayer?.bringToFront()};$('lidarOpacity').oninput=e=>lidar.setOpacity(+e.target.value);$('menu').onclick=()=>{document.body.classList.toggle('collapsed');map.invalidateSize()};if(innerWidth<760)document.body.classList.add('collapsed');$('gps').onclick=()=>navigator.geolocation?.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],16),e=>say(e.message));
function guard(fn){return async(...args)=>{try{await fn(...args)}catch(e){say(e.message);console.error(e)}}}function need(){if(!dem)throw Error('Importa primero un MDT con elevaciones en metros.')}function needHydro(){need();if(!hydro)throw Error('Calcula primero el drenaje.')}let rejectJob;function job(kind){if(worker)throw Error('Hay un cálculo en curso. Cancélalo antes de iniciar otro.');return new Promise((resolve,reject)=>{rejectJob=reject;worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{if(data.stage)say(data.stage);else{worker.terminate();worker=null;rejectJob=null;data.error?reject(Error(data.error)):resolve(data.result)}};worker.onerror=e=>{worker.terminate();worker=null;rejectJob=null;reject(Error(e.message))};worker.postMessage({kind,dem})})}
function clearResults(){terrain3d?.close();$('switch3d').textContent='3D';$('switch3d').setAttribute('aria-pressed','false');$('controls3d').hidden=true;flowAnimator?.reset();updateFlowControls(false);lastBasin=null;hydro=null;grading=null;mask=null;features=[];profile=[];$('profileBox').hidden=true;for(const r of rows)r.layer.remove();rows=[];$('layers').replaceChildren();rasterLayer?.remove();rasterLayer=null;$('results').textContent=''}
async function load(source){if(worker)throw Error('Cancela la operación actual antes de cargar otro MDT.');abort?.abort();abort=new AbortController();say('Leyendo elevaciones reales…');const next=await loadDEM(source,{maxCells:+$('limit').value,bounds:crop?[crop.getWest(),crop.getSouth(),crop.getEast(),crop.getNorth()]:undefined,signal:abort.signal});clearResults();dem=next;terrain=await job('terrain');$('metadata').textContent=`${dem.source}\n${dem.crs} · ${dem.width} × ${dem.height} celdas\nResolución ${fmt(dem.dx)} × ${fmt(dem.dy)} m\nCotas ${fmt(terrain.min)}–${fmt(terrain.max)} m\n${fmt(terrain.count,0)} celdas válidas. ${dem.resolution.resampled?'Resolución reducida desde '+fmt(dem.resolution.originalX)+' × '+fmt(dem.resolution.originalY)+' m ('+fmt(dem.originalCells,0)+' celdas originales).':'Resolución original conservada.'} ${dem.projectionCaution||''} Precisión: consultar ficha del MDT.`;$('elevation').value=terrain.mean.toFixed(2);$('view').value='data';showRaster();map.fitBounds(demBounds(dem));say('MDT cargado. Pulsa el mapa para consultar una cota.');}
$('visualTiff').onchange=guard(async e=>{const file=e.target.files[0];if(!file)return;say('Procesando imagen LiDAR de referencia…');const visual=await loadVisualTiff(file);visualLayer?.remove();visualLayer=L.imageOverlay(visual.url,visual.bounds,{pane:'rainVisualPane',opacity:0.65,interactive:false}).addTo(map);rasterLayer?.bringToFront();map.fitBounds(visual.bounds);say('Capa visual EPSG:3857 cargada ('+visual.bands+' bandas). No interviene en el drenaje.');});$('hideVisual').onclick=()=>{visualLayer?.remove();visualLayer=null;say('Capa visual importada ocultada.');};
// Zona previa: las coordenadas se mantienen siempre en WGS84 para visualización.
function resetZoneDrawing(){zoneLayer?.remove();zoneLayer=null;zoneMarker?.remove();zoneMarker=null;zonePts=[];}
function setZone(mode){zoneMode=mode;resetZoneDrawing();$('zoneStatus').textContent=mode==='zonePoint'?'Marca el punto de salida en el mapa.':'Marca las esquinas o los vértices del área.';say($('zoneStatus').textContent);}
function closeZone(){
 if(zoneMode==='zonePolygon'&&zonePts.length>=3){zoneLayer?.remove();zoneLayer=L.polygon(zonePts,{color:'#f5a84a',weight:3,fillOpacity:.12}).addTo(map);zoneBounds=zoneLayer.getBounds();$('zoneStatus').textContent='Polígono seleccionado · extensión '+zoneBounds.toBBoxString();zoneMode='';}
 else if(zoneMode==='zonePolygon')throw Error('El polígono necesita al menos tres puntos.');
}
$('zonePoint').onclick=()=>setZone('zonePoint');
$('zoneRectangle').onclick=()=>setZone('zoneRectangle');
$('zonePolygon').onclick=()=>setZone('zonePolygon');
$('zoneFinish').onclick=guard(closeZone);
$('zoneView').onclick=()=>{zoneMode='';resetZoneDrawing();zoneBounds=map.getBounds();zoneLayer=L.rectangle(zoneBounds,{color:'#f5a84a',weight:2}).addTo(map);$('zoneStatus').textContent='Vista actual: '+zoneBounds.toBBoxString();};
$('zoneClear').onclick=()=>{zoneMode='';resetZoneDrawing();zoneBounds=null;$('zoneStatus').textContent='Sin zona seleccionada.';};
map.on('click',e=>{
 if(!zoneMode)return;
 const ll=e.latlng;
 if(zoneMode==='zonePoint'){
  zoneMarker=L.marker(ll).addTo(map);zoneBounds=L.latLngBounds([ll,ll]);zoneMode='';
  $('zoneStatus').textContent='Punto marcado: '+ll.lat.toFixed(5)+', '+ll.lng.toFixed(5)+'. Selecciona la extensión de estudio para elegir hojas.';return;
 }
 zonePts.push(ll);
 if(zoneMode==='zoneRectangle'&&zonePts.length===2){
  zoneBounds=L.latLngBounds(zonePts);zoneLayer=L.rectangle(zoneBounds,{color:'#f5a84a',weight:2}).addTo(map);
  zoneMode='';$('zoneStatus').textContent='Rectángulo: '+zoneBounds.toBBoxString();return;
 }
 if(zoneMode==='zonePolygon'){
  zoneLayer?.remove();zoneLayer=L.polyline(zonePts,{color:'#f5a84a',weight:3}).addTo(map);
 }
});
$('buildMosaic').onclick=guard(async()=>{
 const files=$('mosaicFiles').files;
 if(!files?.length)throw Error('Selecciona dos o más GeoTIFF, o un único GeoTIFF para analizarlo.');
 if(worker)throw Error('Cancela primero el análisis actual.');
 const bounds=zoneBounds&&zoneBounds.getWest()!==zoneBounds.getEast()&&zoneBounds.getSouth()!==zoneBounds.getNorth()
   ?[zoneBounds.getWest(),zoneBounds.getSouth(),zoneBounds.getEast(),zoneBounds.getNorth()]:undefined;
 say('Uniendo GeoTIFF: operación dependiente del tamaño de los ficheros…');
 const next=await mosaic(files,{maxCells:Math.min(12000000,Math.max(1000,+$('limit').value||12000000)),bounds,progress:say});
 clearResults();dem=next;terrain=await job('terrain');$('elevation').value=terrain.mean.toFixed(2);
 $('metadata').textContent=dem.source+'\\n'+dem.crs+' · '+fmt(dem.width,0)+' × '+fmt(dem.height,0)+' celdas · '+fmt(dem.dx)+' m\\n'+fmt(terrain.min)+'–'+fmt(terrain.max)+' m\\n'+(dem.warnings.join(' '))+(dem.projectionCaution||'');
 $('mosaicStatus').textContent=files.length+' hojas importadas · '+fmt(dem.valid,0)+' celdas válidas · '+fmt(dem.nodata,0)+' NoData · '+fmt(dem.overlaps,0)+' solapadas. '+dem.warnings.join(' ');
 $('view').value='data';showRaster();map.fitBounds(demBounds(dem));say('Mosaico cargado. Drenaje y curvas de nivel disponibles sobre todo el mosaico.');
});
$('mosaicFit').onclick=guard(()=>{need();map.fitBounds(demBounds(dem));});

$('file').onchange=guard(e=>e.target.files[0]&&load(e.target.files[0]));$('remote').onclick=guard(()=>{const u=new URL($('url').value);if(u.protocol!=='https:')throw Error('Introduce una URL HTTPS.');return load(u.href)});$('cancel').onclick=()=>{abort?.abort();worker?.terminate();worker=null;rejectJob?.(Error('Operación cancelada.'));rejectJob=null;say('Operación cancelada.')};
function showRaster(){need();let k=$('view').value,v=k==='data'?dem.data:k==='shade'?hillshade(terrain,{azimuth:+$('azimuth').value,altitude:+$('altitude').value}):k==='accumulation'?hydro?.accumulation:k==='depth'?hydro?.depth:k==='cutfill'?grading?.difference:k==='after'?grading?.surface:terrain?.[k];if(!v)throw Error('Calcula primero este resultado.');const r=raster(dem,v,k);if(!r)throw Error('No hay valores válidos.');rasterLayer?.remove();rasterLayer=L.imageOverlay(r.url,r.bounds,{pane:'rainAnalysisPane',opacity:+$('opacity').value,interactive:false}).addTo(map);$('legend').textContent=`${$('view').selectedOptions[0].textContent} · ${fmt(r.min)} → ${fmt(r.max)}`;}
for(const id of ['view','azimuth','altitude'])$(id).onchange=guard(showRaster);$('opacity').oninput=()=>rasterLayer?.setOpacity(+$('opacity').value);$('fit').onclick=guard(()=>{need();map.fitBounds(demBounds(dem))});
function addFeature(geometry,properties,color='#00d4eb'){const f={type:'Feature',geometry,properties:{...properties,source:dem?.source,crs_analysis:dem?.crs,date:new Date().toISOString()}};features.push(f);const layer=L.geoJSON(f,{pane:'rainVectorPane',style:{color,weight:2,fillOpacity:.18}}).addTo(map);rows.push({layer,name:properties.name});refreshLayers();return layer}
function refreshLayers(){$('layers').replaceChildren();rows.forEach((r,i)=>{const div=document.createElement('div');div.className='layer-row';const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=map.hasLayer(r.layer);check.onchange=()=>check.checked?r.layer.addTo(map):r.layer.remove();label.append(check,document.createTextNode(r.name));const range=document.createElement('input');range.type='range';range.min=0;range.max=1;range.step=.05;range.value=1;range.setAttribute('aria-label','Opacidad '+r.name);range.oninput=()=>r.layer.setStyle({opacity:+range.value,fillOpacity:+range.value*.25});const up=document.createElement('button');up.textContent='↑';up.title='Traer al frente';up.onclick=()=>r.layer.bringToFront();div.append(label,range,up);$('layers').append(div)})}
function coord(i){const [x,y]=cellCenter(dem,i);return toLatLng(dem,x,y).reverse()}function begin(m){if(m!=='area')need();mode=m;points=[];drawLayer?.remove();vertices.forEach(v=>v.remove());vertices=[];say(m==='area'?'Marca dos esquinas del recorte.':m==='trace'?'Pulsa un punto para seguir el agua.':m==='basin'?'Pulsa la salida de la cuenca.':'Marca los vértices; después pulsa «Terminar dibujo».')}
for(const id of ['area','trace','basin','profile','parcel'])$(id).onclick=guard(()=>begin(id));$('clearArea').onclick=()=>{crop=null;drawLayer?.remove();mode='';$('areaInfo').textContent='Sin recorte activo.';say('Recorte eliminado.')};
$('refreshArea').onclick=()=>{crop=map.getBounds();drawLayer?.remove();drawLayer=L.rectangle(crop,{color:'#ff891f',weight:2}).addTo(map);mode='';$('areaInfo').textContent='Vista capturada: '+crop.toBBoxString();say('Área de la vista seleccionada. Importa un MDT o vuelve a leer el COG remoto para aplicar el recorte.');};
$('downloadArea').onclick=guard(async()=>{need();if(typeof GeoTIFF.writeArrayBuffer!=='function')throw Error('La biblioteca GeoTIFF instalada no incluye escritura de TIFF.');if(dem.data.length>3000000)throw Error('Para exportar como GeoTIFF limita el área a 3 millones de celdas (el TIFF no se comprime).');say('Preparando GeoTIFF local del recorte…');const epsg=Number(dem.crs.split(':')[1]);const data=Float32Array.from(dem.data,v=>Number.isFinite(v)?v:-9999);const metadata={width:dem.width,height:dem.height,ModelPixelScale:[dem.dx,dem.dy,0],ModelTiepoint:[0,0,0,dem.x0,dem.y0,0],ProjectedCSTypeGeoKey:epsg,GTModelTypeGeoKey:1,ProjLinearUnitsGeoKey:9001,GDAL_NODATA:'-9999',BitsPerSample:[32],SampleFormat:[3]};const buffer=await GeoTIFF.writeArrayBuffer(Array.from(data),metadata);const url=URL.createObjectURL(new Blob([buffer],{type:'image/tiff'}));const a=document.createElement('a');a.href=url;a.download='octos-rain-v2-recorte.tif';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);say('GeoTIFF descargado. Reimpórtalo desde «Importar MDT».');});$('undo').onclick=()=>{points.pop();draw()};function draw(){drawLayer?.remove();if(points.length)drawLayer=(mode==='parcel'?L.polygon(points,{color:'#ff891f'}):L.polyline(points,{color:'#ff891f'})).addTo(map)}
map.on('click',guard(e=>{if(zoneMode)return;if(mode==='area'){points.push(e.latlng);if(points.length===2){crop=L.latLngBounds(points);drawLayer?.remove();drawLayer=L.rectangle(crop,{color:'#ff891f',weight:2}).addTo(map);mode='';$('areaInfo').textContent='Área seleccionada: '+crop.toBBoxString();say('Recorte preparado. Carga el MDT para analizar esta zona.')}return}if(mode==='profile'||mode==='parcel'){points.push(e.latlng);draw();return}if(!dem)return;const i=cellAt(dem,e.latlng.lat,e.latlng.lng);if(i<0||!Number.isFinite(dem.data[i]))throw Error('El punto queda fuera del MDT o es NoData.');if(mode==='trace'){follow(i);return}if(mode==='basin'){basin(i);return}say(`Cota ${fmt(dem.data[i])} m · pendiente ${fmt(terrain.slope[i])}° · ${fmt(terrain.percent[i])} %`)}));
$('analyze').onclick=guard(async()=>{need();flowAnimator?.reset();updateFlowControls(false);lastBasin=null;hydro=await job('hydrology');$('view').value='accumulation';showRaster();say('Drenaje calculado. Acumulación expresada en superficie aportante, no volumen de agua.')});
function follow(start){needHydro();let i=start,list=[],seen=new Set(),distance=0;while(i>=0&&!seen.has(i)){seen.add(i);list.push(i);const j=hydro.receiver[i];if(j>=0)distance+=Math.hypot((j%dem.width-i%dem.width)*dem.dx,(Math.floor(j/dem.width)-Math.floor(i/dem.width))*dem.dy);i=j}if(i>=0)throw Error('Ciclo detectado: trayectoria descartada.');if(list.length<2){say('El punto es una salida del área.');return}addFeature({type:'LineString',coordinates:list.map(coord)},{name:'Trayectoria',distance_m:distance,start_m:dem.data[start],end_m:dem.data[list.at(-1)]});$('results').textContent=`SEGUIR AGUA\nDistancia ${fmt(distance)} m\nCota inicial ${fmt(dem.data[start])} m\nCota final ${fmt(dem.data[list.at(-1)])} m\nDesnivel ${fmt(dem.data[start]-dem.data[list.at(-1)])} m\nFin: borde del MDT o contacto con NoData.\nTrayectoria sobre terreno acondicionado.`;}
function basin(outlet){needHydro();const n=dem.data.length,first=new Int32Array(n).fill(-1),next=new Int32Array(n).fill(-1),m=new Uint8Array(n),q=[outlet];for(let i=0;i<n;i++){let j=hydro.receiver[i];if(j>=0){next[i]=first[j];first[j]=i}}let count=0,min=Infinity,max=-Infinity,slope=0,sc=0,edge=false;for(let k=0;k<q.length;k++){const i=q[k];m[i]=1;count++;min=Math.min(min,dem.data[i]);max=Math.max(max,dem.data[i]);if(Number.isFinite(terrain.slope[i])){slope+=terrain.slope[i];sc++}const x=i%dem.width,y=Math.floor(i/dem.width);if(x===0||y===0||x===dem.width-1||y===dem.height-1)edge=true;for(const j of [i-1,i+1,i-dem.width,i+dem.width])if(j>=0&&j<n&&!Number.isFinite(dem.data[j]))edge=true;for(let j=first[i];j>=0;j=next[j])q.push(j)}addFeature(maskGeometry(dem,m),{name:'Límite de cuenca',area_ha:count*areaPerCell(dem)/10000,edge_truncated:edge});lastBasin={areaM2:count*areaPerCell(dem),edge,mask:m,outlet};$('results').textContent=`CUENCA AGUAS ARRIBA\nÁrea ${fmt(count*areaPerCell(dem)/10000)} ha\nCotas ${fmt(min)}–${fmt(max)} m\nPendiente media ${fmt(slope/sc)}°\n${edge?'Cuenca recortada: toca un límite o NoData.':'Cuenca contenida en el MDT.'}`;}
$('event').onclick=guard(()=>{needHydro();if(!lastBasin)throw Error('Primero pulsa «Cuenca aguas arriba» y marca una salida sobre el MDT.');const result=eventEstimate(lastBasin.areaM2,{rainMm:+$('rainMm').value,durationH:+$('rainHours').value,runoffCoefficient:+$('runoff').value});$('results').textContent='LLUVIA Y ESCORRENTÍA · EVENTO HIPOTÉTICO\nÁrea aportante: '+fmt(result.areaM2/10000)+' ha\nLluvia acumulada: '+fmt(result.rainMm)+' mm\nDuración: '+fmt(result.durationH)+' h\nIntensidad media: '+fmt(result.averageIntensityMmh)+' mm/h\nCoeficiente de escorrentía: '+fmt(result.runoffCoefficient) +'\nVolumen precipitado: '+fmt(result.totalM3)+' m³\nEscorrentía estimada: '+fmt(result.runoffM3)+' m³\nPérdidas/retención supuestas: '+fmt(result.retainedM3)+' m³\nCaudal medio equivalente: '+fmt(result.averageEquivalentM3s,4)+' m³/s\n'+(lastBasin.edge?'AVISO: cuenca truncada por el borde / NoData; resultados subestimables.\n':'')+'SIN CAUDAL PUNTA: no se modelan tiempos de concentración, infiltración dinámica, cauces, almacenamiento ni propagación. No equivale a un mapa de inundación.';say('Evento de lluvia estimado para la cuenca seleccionada.');});
$('streams').onclick=guard(()=>{needHydro();const threshold=+$('threshold').value*10000;if(!(threshold>0))throw Error('El umbral debe ser positivo.');const {lines,count}=extractStreams(dem,hydro,threshold);if(!count)throw Error('No existen celdas de cauce con ese umbral. Prueba 0,1 ha o un recorte mayor.');const geometry={type:'MultiLineString',coordinates:lines.map(line=>line.map(p=>toLatLng(dem,...p).reverse()))};addFeature(geometry,{name:'Cauces potenciales',threshold_m2:threshold,stream_cells:count,lines:lines.length});$('results').textContent='RED DE DRENAJE POTENCIAL\n'+count+' celdas de cauce\n'+lines.length+' tramos conectados\nUmbral: '+fmt(threshold/10000)+' ha\nD8 sobre relieve acondicionado, no red fluvial oficial.';say(lines.length+' tramos conectados extraídos del MDT.');});
function parcel(){const p=points.map(ll=>fromLatLng(dem,ll.lat,ll.lng));mask=new Uint8Array(dem.data.length);let area=0;for(let i=0;i<mask.length;i++){const [x,y]=cellCenter(dem,i);if(Number.isFinite(dem.data[i])&&inside(x,y,p)){mask[i]=1;area+=dem.dx*dem.dy}}if(!area)throw Error('La parcela no contiene centros de celdas válidas.');let perimeter=0;for(let i=0;i<p.length;i++)perimeter+=Math.hypot(p[i][0]-p[(i+1)%p.length][0],p[i][1]-p[(i+1)%p.length][1]);addFeature({type:'Polygon',coordinates:[[...points.map(ll=>[ll.lng,ll.lat]),[points[0].lng,points[0].lat]]]},{name:'Parcela',raster_area_m2:area,perimeter_m:perimeter},'#ff891f');$('results').textContent=`PARCELA\nSuperficie de celdas válidas ${fmt(area/10000)} ha\nPerímetro ${fmt(perimeter)} m`;}
function updateProfile(){profile=[];let total=0,up=0,down=0;for(let k=1;k<points.length;k++){const a=fromLatLng(dem,points[k-1].lat,points[k-1].lng),b=fromLatLng(dem,points[k].lat,points[k].lng),length=Math.hypot(b[0]-a[0],b[1]-a[1]),steps=Math.max(1,Math.ceil(length/Math.min(dem.dx,dem.dy)));if(profile.length+steps>50000)throw Error('Perfil demasiado largo. Acorta el trazado.');for(let j=k===1?0:1;j<=steps;j++){const t=j/steps,ll=toLatLng(dem,a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])),i=cellAt(dem,...ll),z=i>=0?dem.data[i]:NaN;const previous=profile.at(-1),distance=total+t*length;if(previous&&Number.isFinite(z)&&Number.isFinite(previous.z)){const dz=z-previous.z;up+=Math.max(0,dz);down+=Math.max(0,-dz)}profile.push({distance,z,lat:ll[0],lng:ll[1],slope:previous&&distance>previous.distance?(z-previous.z)/(distance-previous.distance)*100:0})}total+=length}const valid=profile.filter(p=>Number.isFinite(p.z));if(!valid.length)throw Error('El perfil no cruza elevaciones válidas.');const canvas=$('chart'),ctx=canvas.getContext('2d'),lo=Math.min(...valid.map(p=>p.z)),hi=Math.max(...valid.map(p=>p.z));ctx.clearRect(0,0,800,180);ctx.strokeStyle='#ff891f';ctx.lineWidth=2;ctx.beginPath();let pen=false;for(const p of profile){if(!Number.isFinite(p.z)){pen=false;continue}const x=40+p.distance/(total||1)*740,y=145-(p.z-lo)/(hi-lo||1)*120;pen?ctx.lineTo(x,y):ctx.moveTo(x,y);pen=true}ctx.stroke();ctx.fillStyle='#ddd';ctx.font='12px sans-serif';ctx.fillText(`${fmt(hi)} m`,5,18);ctx.fillText(`${fmt(lo)} m`,5,162);$('profileBox').hidden=false;$('profileInfo').textContent=`Longitud ${fmt(total)} m · +${fmt(up)} / −${fmt(down)} m · rango ${fmt(lo)}–${fmt(hi)} m`;}
$('finish').onclick=guard(()=>{if(!['parcel','profile'].includes(mode))return;if(points.length<(mode==='parcel'?3:2))throw Error('Faltan vértices.');if(mode==='parcel'){parcel();mode='';return}updateProfile();addFeature({type:'LineString',coordinates:points.map(ll=>[ll.lng,ll.lat])},{name:'Perfil'},'#ff891f');vertices=points.map((ll,i)=>L.marker(ll,{draggable:true,icon:L.divIcon({className:'vertex',iconSize:[12,12]})}).addTo(map).on('dragend',guard(e=>{points[i]=e.target.getLatLng();drawLayer?.setLatLngs(points);updateProfile();const f=features.filter(f=>f.properties.name==='Perfil').at(-1);f.geometry.coordinates=points.map(ll=>[ll.lng,ll.lat])})));mode='';});$('chart').onmousemove=e=>{if(!profile.length)return;const r=e.target.getBoundingClientRect(),t=Math.max(0,Math.min(1,((e.clientX-r.left)/r.width*800-40)/740)),p=profile[Math.round(t*(profile.length-1))];profileMarker?.remove();profileMarker=L.circleMarker([p.lat,p.lng],{radius:5,color:'#fff',fillColor:'#ff891f',fillOpacity:1}).addTo(map);say(`Perfil · ${fmt(p.distance)} m · cota ${fmt(p.z)} m · pendiente ${fmt(p.slope)} %`)};$('closeProfile').onclick=()=>{$('profileBox').hidden=true;profileMarker?.remove()};
$('grade').onclick=guard(()=>{need();if(!mask)throw Error('Dibuja y termina primero una parcela.');grading=grade(dem,mask,{mode:$('gradeMode').value,elevation:+$('elevation').value,slope:+$('gradeSlope').value,bearing:+$('bearing').value});$('view').value='cutfill';showRaster();$('results').textContent='NIVELACIÓN\n'+`Desmonte ${fmt(grading.stats.cut)} m³
Terraplén ${fmt(grading.stats.fill)} m³
Balance ${fmt(grading.stats.balance)} m³
Superficie ${fmt(grading.stats.area)} m²
Desmonte máximo ${fmt(grading.stats.maxCut)} m
Terraplén máximo ${fmt(grading.stats.maxFill)} m
Espesor medio ${fmt(grading.stats.meanThickness)} m`});
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}$('geojson').onclick=guard(()=>{if(!features.length)throw Error('No hay geometrías calculadas.');download('octos-rain.geojson',JSON.stringify({type:'FeatureCollection',features}),'application/geo+json')});$('csv').onclick=guard(()=>{need();const lines=profile.length?['distancia_m,cota_m,pendiente_porcentaje,latitud,longitud',...profile.map(p=>[p.distance,Number.isFinite(p.z)?p.z:'',Number.isFinite(p.slope)?p.slope:'',p.lat,p.lng].join(','))]:['magnitud,valor','cota_min_m,'+terrain.min,'cota_max_m,'+terrain.max,'cota_media_m,'+terrain.mean,...Object.entries(grading?.stats||{}).filter(([,v])=>typeof v==='number').map(([k,v])=>k+','+v)];download('octos-rain.csv',lines.join('\n'),'text/csv')});$('elevations').onclick=guard(()=>{need();const lines=['x_m,y_m,cota_m'];for(let i=0;i<dem.data.length;i++)if(Number.isFinite(dem.data[i]))lines.push([...cellCenter(dem,i),dem.data[i]].join(','));download('octos-rain-elevaciones.csv',lines.join('\n'),'text/csv')});$('print').onclick=guard(()=>{need();$('report').textContent=`OcToS Rain V7.5 · ${new Date().toLocaleString('es-ES')}\n${$('metadata').textContent}\n${$('results').textContent}\n${$('profileInfo').textContent}\nAnálisis topográfico orientativo. Sin lluvia, infiltración, alcantarillado o caudales. Los límites del MDT y NoData pueden truncar las cuencas. Resolución de cálculo: la original del MDT. Fuente declarada por el archivo; verificar su ficha técnica.\nMapa: IGN / CNIG. Ráster de cálculo importado por el usuario.`;const chartImage=document.createElement('img');chartImage.src=$('chart').toDataURL();chartImage.style.width='100%';if(profile.length)$('report').append(chartImage);window.print()});

// Asistente: mantiene el motor de terreno y los cálculos V3/V4.
function updateFlowControls(ready){
 for(const id of ['flowPlay','flowPause','flowStop'])$(id).disabled=!ready;
}
function wizardSection(id){const el=$(id);el.open=true;el.scrollIntoView({behavior:'smooth',block:'start'});}
$('guideArea').onclick=()=>wizardSection('selectionSection');
$('guideTerrain').onclick=()=>wizardSection('terrainSection');
$('guideDrain').onclick=()=>{wizardSection('drainSection');$('analyze').click();};
$('guideBasin').onclick=()=>{if(!hydro){say('Calcula antes el drenaje D8.');return;}wizardSection('drainSection');$('basin').click();$('flowGuideStatus').textContent='Pulsa el mapa para elegir el punto de salida de la cuenca.';};
$('guidePrepare').onclick=guard(()=>{
 needHydro();
 const rainMm=+$('guideRain').value,durationH=+$('guideHours').value,runoffCoefficient=+$('guideRunoff').value;
 const validArea=lastBasin?.areaM2||dem.valid*areaPerCell(dem);
 const result=eventEstimate(validArea,{rainMm,durationH,runoffCoefficient});
 flowAnimator??=new FlowParticles(map);
 const stats=flowAnimator.prepare(dem,hydro,{mask:lastBasin?.mask,count:+$('flowCount').value,speed:+$('flowSpeed').value});
 updateFlowControls(true);
 if(terrain3d?.running){terrain3d.hydro=hydro;terrain3d.animator=flowAnimator;}
 const warn=lastBasin?.edge?' AVISO: la cuenca llega al borde de los datos y puede estar incompleta.':'';
 $('flowGuideStatus').textContent='Preparado: '+fmt(stats.particles,0)+' partículas; '+fmt(stats.paths,0)+' celdas de emisión. Escorrentía estimada: '+fmt(result.runoffM3,2)+' m³; caudal medio equivalente: '+fmt(result.averageEquivalentM3s,3)+' m³/s.'+warn+' Play reproduce rutas D8, no velocidades físicas.';
 $('results').textContent='ESTUDIO DE LLUVIA · MODELO VOLUMÉTRICO\\nÁrea considerada '+fmt(validArea/10000)+' ha\\nLluvia '+fmt(result.rainMm)+' mm durante '+fmt(result.durationH)+' h\\nCoeficiente '+fmt(result.runoffCoefficient)+'\\nAgua precipitada '+fmt(result.totalM3)+' m³\\nEscorrentía estimada '+fmt(result.runoffM3)+' m³\\nCaudal medio equivalente '+fmt(result.averageEquivalentM3s,3)+' m³/s\\nAnimación topográfica D8: sin cálculo hidráulico de velocidad, calado o inundación.';
 say('Animación preparada. Pulsa Play para ver las trayectorias.');
});
$('flowPlay').onclick=guard(()=>{flowAnimator?.play();$('flowGuideStatus').textContent='Reproduciendo partículas D8 sobre el terreno. Velocidad visual, no velocidad hidráulica.';});
$('flowPause').onclick=()=>{flowAnimator?.pause();$('flowGuideStatus').textContent='Animación en pausa.';};
$('flowStop').onclick=()=>{flowAnimator?.pause();flowAnimator?.draw();$('flowGuideStatus').textContent='Animación detenida. Para reiniciar partículas, vuelve a preparar.';};
$('flowSpeed').oninput=()=>flowAnimator?.setSpeed(+$('flowSpeed').value);
$('flowCount').onchange=()=>flowAnimator?.setCount(+$('flowCount').value);
updateFlowControls(false);

// V7: botón 2D/3D. Mantiene el mismo MDT de cálculo y reutiliza el mapa seleccionado.
$('switch3d').onclick=guard(async()=>{
 if(terrain3d?.running){
  terrain3d.close();$('controls3d').hidden=true;$('switch3d').textContent='3D';
  $('switch3d').setAttribute('aria-pressed','false');say('Vista 2D restaurada.');map.invalidateSize();return;
 }
 need();
 $('switch3d').disabled=true;say('Preparando terreno real en 3D…');
 try{
  terrain3d??=new Terrain3D(document.querySelector('.mapwrap'));
  await terrain3d.open(dem,{baseUrl:bases[$('base').selectedIndex],baseOpacity:+$('baseOpacity').value,
   hydro,animator:flowAnimator,exaggeration:+$('terrainExag').value,
   onStatus:message=>{$('terrain3dStatus').textContent=message;}});
  setNav3D('rotate');$('controls3d').hidden=false;$('switch3d').textContent='2D';
  $('switch3d').setAttribute('aria-pressed','true');
  say('Terreno 3D activo. Arrastra para rotar y usa la rueda para acercar.');
 }catch(e){
  terrain3d?.close();$('controls3d').hidden=true;
  $('switch3d').setAttribute('aria-pressed','false');$('switch3d').textContent='3D';
  throw e;
 }finally{$('switch3d').disabled=false;}
});
$('terrainExag').oninput=()=>{
 const n=+$('terrainExag').value;$('terrainExagValue').textContent=n+'×';
 terrain3d?.setExaggeration(n);
};
function setNav3D(mode){
 terrain3d?.setInteractionMode(mode);
 $('nav3dRotate').setAttribute('aria-pressed',String(mode==='rotate'));
 $('nav3dPan').setAttribute('aria-pressed',String(mode==='pan'));
}
$('nav3dRotate').onclick=()=>setNav3D('rotate');
$('nav3dPan').onclick=()=>setNav3D('pan');
$('resetCamera3d').onclick=()=>{if(!terrain3d?.running)return;terrain3d.resetCamera();say('Cámara 3D centrada en el mosaico.');};

officialCatalog(map,$('thematicCatalog')||document.querySelector('aside'),()=>{},say);


$('finishParcel').onclick=()=> $('finish').click();
$('contours').onclick=guard(()=>{need();const interval=+$('contourInterval').value;let segments;try{segments=contours(dem,interval,{maxSegments:120000});}catch(e){throw Error(e.message+' Para terreno extenso, aumenta el intervalo (ej. 10–20 m) o recorta el MDT.');}if(!segments.length)throw Error('No hay curvas en el rango de elevaciones: reduce el intervalo.');const coordinates=segments.map(seg=>seg.coordinates.map(p=>toLatLng(dem,...p).reverse()));addFeature({type:'MultiLineString',coordinates},{name:'Curvas de nivel · '+fmt(interval)+' m',interval_m:interval,segments:segments.length},'#f3e7cc');$('results').textContent='CURVAS DE NIVEL\nIntervalo '+fmt(interval)+' m\n'+segments.length+' segmentos\nUna capa vectorial de curvas para evitar cientos de capas individuales. No se extrapola a través de NoData.';say(segments.length+' segmentos de curvas generados.');});
