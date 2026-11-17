/* OcToS GTA · Instrumentación arcade inspirada en la referencia del usuario.
   Velocidad y GPS son datos del juego; RPM y turbo son indicadores estimados. El nivel de combustible no se simula.
   No se altera la física ni se extraen imágenes del videojuego de referencia. */
const GPS_STYLE='https://tiles.openfreemap.org/styles/dark';
const GPS_ZOOM=14.6; // Más territorio visible por delante
const GPS_PITCH=52; // Perspectiva de navegación suave

const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const point=(cx,cy,r,angle)=>{
  const a=angle*Math.PI/180;
  return {x:cx+Math.sin(a)*r,y:cy-Math.cos(a)*r};
};
const arc=(cx,cy,r,from,to)=>{
  const a=point(cx,cy,r,from),b=point(cx,cy,r,to);
  return 'M '+a.x.toFixed(2)+' '+a.y.toFixed(2)+
    ' A '+r+' '+r+' 0 '+(to-from>180?1:0)+' 1 '+b.x.toFixed(2)+' '+b.y.toFixed(2);
};
function makeTachometer() {
  const cx=150,cy=150;
  let ticks='',labels='';
  for(let i=0;i<=45;i++) {
    const major=i%5===0,angle=207+i*5.42;
    const a=point(cx,cy,major?101:109,angle);
    const b=point(cx,cy,120,angle);
    ticks+=`<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${i>=35?'#f37d78':'#f4f5f5'}" stroke-width="${major?3.5:1.3}" opacity="${major?1:.75}"/>`;
    if(major) {
      const p=point(cx,cy,82,angle);
      labels+=`<text x="${p.x.toFixed(2)}" y="${(p.y+7).toFixed(2)}" fill="${i>=35?'#ffb6b3':'#f5f6f6'}" font-family="Arial,sans-serif" font-size="23" font-style="italic" font-weight="800" text-anchor="middle">${i/5}</text>`;
    }
  }
  return `<svg class="gta-tach-svg" viewBox="0 0 300 300" aria-hidden="true">
    <defs>
      <linearGradient id="gta-gauge-shell" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#9fa5a3" stop-opacity=".85"/>
        <stop offset=".46" stop-color="#30372d" stop-opacity=".9"/>
        <stop offset="1" stop-color="#768074" stop-opacity=".72"/>
      </linearGradient>
      <radialGradient id="gta-gauge-core"><stop stop-color="#161d19" stop-opacity=".98"/>
        <stop offset=".72" stop-color="#202720" stop-opacity=".96"/>
        <stop offset="1" stop-color="#333c31" stop-opacity=".95"/></radialGradient>
      <filter id="gta-gauge-glow"><feGaussianBlur stdDeviation="2.6"/></filter>
    </defs>
    <circle cx="150" cy="150" r="147" fill="#141912" opacity=".60" stroke="url(#gta-gauge-shell)" stroke-width="4"/>
    <circle cx="150" cy="150" r="136" fill="url(#gta-gauge-core)" stroke="#687064" stroke-width="5"/>
    <circle cx="150" cy="150" r="126" fill="none" stroke="#0e1310" stroke-width="7"/>
    <path d="${arc(cx,cy,129,207,387)}" fill="none" stroke="#24b9ff" stroke-width="9" opacity=".75" stroke-linecap="butt"/>
    <path d="${arc(cx,cy,129,388,452)}" fill="none" stroke="#e86968" stroke-width="9" opacity=".9" stroke-linecap="butt"/>
    <path d="${arc(cx,cy,138,199,457)}" fill="none" stroke="#a8b1a4" stroke-width="1.6" opacity=".50"/>
    ${ticks}${labels}
    <text x="150" y="115" fill="#d6d8d5" font-size="13" letter-spacing="3.5" text-anchor="middle">RPM × 1000</text>
    <line id="gta-tach-needle-shadow" x1="150" y1="173" x2="150" y2="54" stroke="#000" opacity=".6" stroke-width="8" stroke-linecap="round" transform="rotate(207 150 150)"/>
    <line id="gta-tach-needle" x1="150" y1="173" x2="150" y2="54" stroke="#f5f5ed" stroke-width="3.7" stroke-linecap="round" transform="rotate(207 150 150)"/>
    <circle cx="150" cy="150" r="27" fill="#2c322b" stroke="#697166" stroke-width="6"/>
    <circle cx="150" cy="150" r="17" fill="#121814" stroke="#c4c7c4" stroke-width="2.1"/>
    <circle cx="150" cy="150" r="7" fill="#d9e0db"/>
    <text id="gta-rpm-value" x="150" y="228" text-anchor="middle" font-family="Arial,sans-serif" fill="#fff" font-size="39" font-style="italic" font-weight="900">0.0</text>
    <text x="148" y="271" text-anchor="middle" fill="#8d9990" font-size="9" letter-spacing="2">OCTOS DRIVE</text>
  </svg>`;
}
function makeSpeedometer(){
  let ticks='',labels='';
  for(let i=0;i<=40;i++){
    const angle=207+i*6.15,major=i%5===0;
    const a=point(150,150,major?102:112,angle),b=point(150,150,120,angle);
    ticks+='<line x1="'+a.x.toFixed(2)+'" y1="'+a.y.toFixed(2)+'" x2="'+b.x.toFixed(2)+'" y2="'+b.y.toFixed(2)+'" stroke="#f1f4f1" stroke-width="'+(major?3.4:1.4)+'"/>';
    if(major){
      const p=point(150,150,86,angle);
      labels+='<text x="'+p.x.toFixed(1)+'" y="'+(p.y+6).toFixed(1)+'" text-anchor="middle" font-size="21" font-weight="800" fill="#f1f3ef">'+(i*6)+'</text>';
    }
  }
  return `<svg class="gta-speed-svg" viewBox="0 0 300 300" aria-hidden="true">
    <circle cx="150" cy="150" r="147" fill="#121912" stroke="#77837c" stroke-width="5"/>
    <circle cx="150" cy="150" r="136" fill="#202922" stroke="#46554e" stroke-width="5"/>
    <circle cx="150" cy="150" r="126" fill="none" stroke="#121c1a" stroke-width="8"/>
    <path d="${arc(150,150,130,207,453)}" fill="none" stroke="#41b9dc" stroke-width="8" opacity=".85"/>
    ${ticks}${labels}
    <text x="150" y="105" fill="#d1d9d1" font-size="14" letter-spacing="4" text-anchor="middle">KM/H</text>
    <line id="gta-speed-needle" x1="150" y1="170" x2="150" y2="49" stroke="#f8f8f0" stroke-width="4" stroke-linecap="round" transform="rotate(207 150 150)"/>
    <circle cx="150" cy="150" r="24" fill="#19221d" stroke="#b0b7ac" stroke-width="5"/>
    <circle cx="150" cy="150" r="8" fill="#c5cfc9"/>
    <text x="150" y="225" fill="#f4f7f4" font-size="36" text-anchor="middle" font-weight="800" id="gta-speed-face">0</text>
    <text x="150" y="266" fill="#94a39b" font-size="10" letter-spacing="2" text-anchor="middle">OCTOS DRIVE</text>
  </svg>`;
}
function makeSmallGauge(kind,label,unit){
  let ticks='';
  for(let i=0;i<=12;i++){
    const angle=216+i*20;
    const p1=point(75,75,i%3===0?52:58,angle),p2=point(75,75,64,angle);
    ticks+='<line x1="'+p1.x.toFixed(1)+'" y1="'+p1.y.toFixed(1)+'" x2="'+p2.x.toFixed(1)+'" y2="'+p2.y.toFixed(1)+'" stroke="#e6ede8" stroke-width="'+(i%3===0?3:1.7)+'"/>';
  }
  const tickAngle=kind==='fuel'?336:216;
  return `<svg class="gta-small-svg" viewBox="0 0 150 150" aria-hidden="true">
    <circle cx="75" cy="75" r="73" fill="#141c18" stroke="#86908a" stroke-width="5"/>
    <circle cx="75" cy="75" r="66" fill="#242d27" stroke="#4b5c50" stroke-width="4"/>
    <path d="${arc(75,75,69,216,456)}" fill="none" stroke="${kind==='turbo'?'#f29b60':'#d2b47b'}" stroke-width="5" opacity=".8"/>
    ${ticks}
    <text x="75" y="48" text-anchor="middle" fill="#d8e0db" font-size="12" font-weight="800" letter-spacing="1">${label}</text>
    <line id="gta-${kind}-needle" x1="75" y1="88" x2="75" y2="24" stroke="#f2f5ed" stroke-width="3" stroke-linecap="round" transform="rotate(${tickAngle} 75 75)"${kind==='fuel'?' opacity=".36"':''}/>
    <circle cx="75" cy="75" r="12" fill="#151d18" stroke="#b3bdb2" stroke-width="4"/>
    <text id="gta-${kind}-value" x="75" y="115" text-anchor="middle" font-size="19" fill="#f3f5ef" font-weight="800">${kind==='fuel'?'—':'0.0'}</text>
    <text x="75" y="131" text-anchor="middle" font-size="10" fill="#aab8ac">${unit}</text>
  </svg>`;
}
export function mountDriveHud({report}={}) {
  const shell=$('gta-drive-display');
  if(!shell)throw new Error('No se encuentra el HUD de conducción.');
  const tach=$('gta-tachometer');
  const speedometer=$('gta-speedometer');
  const fuel=$('gta-fuel');
  const turbo=$('gta-turbo');
  tach.innerHTML=makeTachometer();
  speedometer.innerHTML=makeSpeedometer();
  fuel.innerHTML=makeSmallGauge('fuel','GASOIL','SIN DATOS');
  turbo.innerHTML=makeSmallGauge('turbo','TURBO','BAR EST.');
  const speedLabel=$('gta-speed-digital');
  const speedFace=$('gta-speed-face');
  const speedNeedle=$('gta-speed-needle');
  const rpmValue=$('gta-rpm-value');
  const rpmNeedle=$('gta-tach-needle');
  const rpmShadow=$('gta-tach-needle-shadow');
  const turboNeedle=$('gta-turbo-needle');
  const turboValue=$('gta-turbo-value');
  const gps=$('gta-gps-map');
  const gpsStatus=$('gta-gps-status');
  const gpsHeading=$('gta-gps-heading');
  const gpsCoords=$('gta-gps-coords');
  let mini=null,lastGps=0,lastPos=null;
  let lastSpeed=0,lastMeasure=0,smoothedAccel=0;
  let lastRpm=0,lastTurbo=0;
  let gpsFailed=false;
  // La posición de la flecha queda a ~63 % de la altura para enseñar el recorrido por delante.
  const cameraPadding=()=>({top:Math.round((gps.clientHeight||176)*.24),bottom:0,left:0,right:0});

  function initGPS(state){
    if(mini||gpsFailed||!window.maplibregl?.Map)return;
    try {
      mini=new window.maplibregl.Map({
        container:gps,style:GPS_STYLE,
        center:[state.lon,state.lat],zoom:GPS_ZOOM,bearing:state.heading||0,
        pitch:GPS_PITCH,minZoom:13,maxZoom:18,
        interactive:false,attributionControl:false,
        antialias:false,renderWorldCopies:false,fadeDuration:0,
        scrollZoom:false,dragPan:false,dragRotate:false,
        doubleClickZoom:false,boxZoom:false,keyboard:false,
        touchZoomRotate:false
      });
      mini.once('load',()=>{
        try{
          const layers=mini.getStyle()?.layers||[];
          for(const layer of layers){
            if(layer.type==='symbol'){
              mini.setLayoutProperty(layer.id,'visibility','none');
            }else if(layer.type==='line' && /^(highway_|road_)/i.test(layer.id) &&
              !/(casing|outline|oneway)/i.test(layer.id)){
              mini.setPaintProperty(layer.id,'line-color','#dce6e4');
              mini.setPaintProperty(layer.id,'line-opacity',.91);
            }
          }
          gpsStatus.hidden=true;
          mini.resize();
        }catch(error){console.warn('OcToS GTA · personalización GPS:',error);}
      });
      mini.on('error',event=>{
        const detail=String(event.error?.message||'');
        if(/style.*(load|fetch)|failed to fetch.*style/i.test(detail)){
          gpsStatus.textContent='GPS SIN MAPA';
          gpsStatus.hidden=false;
        }
        // Una tesela aislada puede fallar sin invalidar el resto del mapa.
        console.warn('OcToS GTA · tesela GPS:',event.error||event);
      });
    }catch(error){
      mini?.remove?.();mini=null;gpsFailed=true;
      gpsStatus.textContent='GPS SIN MAPA';gpsStatus.hidden=false;
      console.warn('OcToS GTA · GPS:',error);
      report?.('El GPS no dispone de mapa; los relojes continúan operativos.','warn');
    }
  }
  function estimatedRpm(speedKmH,inCar){
    if(!inCar)return 0;
    const caps=[35,58,86,117,153];
    const gear=caps.findIndex(limit=>speedKmH<limit);
    const maxForGear=caps[gear<0?caps.length-1:gear];
    return clamp(800+speedKmH/maxForGear*3500,800,4700);
  }
  function update(state){
    if(!Number.isFinite(state?.lat)||!Number.isFinite(state?.lon))return;
    const now=performance.now();
    const inCar=state.mode==='car';
    const kmh=inCar?Math.max(0,Number(state.speed)||0):0;
    speedLabel.textContent=String(Math.round(kmh));
    speedFace.textContent=String(Math.round(kmh));
    speedNeedle.setAttribute('transform',
      'rotate('+(207+clamp(kmh/240,0,1)*246).toFixed(2)+' 150 150)');
    const rpm=estimatedRpm(kmh,inCar);
    // Solo indicadores: el juego no simula rpm ni un sensor de presión.
    lastRpm+=(rpm-lastRpm)*.40;
    const angle=207+clamp(lastRpm/9000,0,1)*243.9;
    const rotation='rotate('+angle.toFixed(2)+' 150 150)';
    rpmNeedle.setAttribute('transform',rotation);
    rpmShadow.setAttribute('transform',rotation);
    rpmValue.textContent=(lastRpm/1000).toFixed(1);
    if(lastMeasure && now>lastMeasure){
      const seconds=clamp((now-lastMeasure)/1000,.03,1);
      const a=(kmh-lastSpeed)/3.6/seconds;
      smoothedAccel=smoothedAccel*.78+clamp(a,-4,4)*.22;
    }
    if(!inCar)smoothedAccel*=.75;
    lastMeasure=now;lastSpeed=kmh;
    // Estimación visual de presión de turbo: no existe sensor mecánico en GTA.
    const turboEstimate=inCar?clamp(Math.max(0,smoothedAccel)*.32,0,1.5):0;
    lastTurbo+=(turboEstimate-lastTurbo)*.45;
    turboNeedle.setAttribute('transform',
      'rotate('+(216+clamp(lastTurbo/1.5,0,1)*240).toFixed(2)+' 75 75)');
    turboValue.textContent=lastTurbo.toFixed(1);
    gpsHeading.textContent=String(Math.round((state.heading||0)+360)%360).padStart(3,'0')+'°';
    gpsCoords.textContent=state.lat.toFixed(4)+', '+state.lon.toFixed(4);
    initGPS(state);
    if(mini && (now-lastGps>240 || !lastPos || Math.abs(lastPos.lat-state.lat)>.000025 ||
      Math.abs(lastPos.lon-state.lon)>.000025)){
      try{
        mini.jumpTo({center:[state.lon,state.lat],bearing:state.heading||0,
          pitch:GPS_PITCH,zoom:GPS_ZOOM,padding:cameraPadding()});
        lastGps=now;lastPos={lat:state.lat,lon:state.lon};
      }catch(error){console.warn('OcToS GTA · actualizar GPS:',error);}
    }
  }
  document.body.classList.add('gta-hud-active');
  return {update,destroy(){
    mini?.remove?.();mini=null;
    document.body.classList.remove('gta-hud-active');
  }};
}
