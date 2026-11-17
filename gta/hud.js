/* OcToS GTA · Instrumentación arcade inspirada en la referencia del usuario.
   Velocidad y GPS son datos del juego; RPM y aceleración son indicadores estimados.
   No se altera la física ni se extraen imágenes del videojuego de referencia. */
const GPS_STYLE='https://tiles.openfreemap.org/styles/dark';
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
    <text id="gta-speed-value" x="211" y="212" text-anchor="middle" font-family="Arial,sans-serif" fill="#fff" font-size="47" font-style="italic" font-weight="900">0</text>
    <text id="gta-speed-unit" x="211" y="237" text-anchor="middle" fill="#d5d9d6" font-size="19" font-style="italic">KM/H</text>
    <text x="148" y="271" text-anchor="middle" fill="#8d9990" font-size="9" letter-spacing="2">OCTOS DRIVE</text>
  </svg>`;
}
function makeAuxiliaryGauge(){
  let ticks='',labels='';
  for(let i=0;i<=6;i++){
    const angle=212+i*38;
    const a=point(75,75,60,angle),b=point(75,75,66,angle);
    ticks+=`<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${i>4?'#ed837e':'#e9eeee'}" stroke-width="2.6"/>`;
    if(i%3===0){
      const p=point(75,75,48,angle);
      labels+=`<text x="${p.x.toFixed(1)}" y="${(p.y+4).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="700" fill="#ebefef">${(i-3)*10}</text>`;
    }
  }
  return `<svg class="gta-aux-svg" viewBox="0 0 150 150" aria-hidden="true">
    <circle cx="75" cy="75" r="73" fill="#161a17" opacity=".93" stroke="#7a837c" stroke-width="5"/>
    <circle cx="75" cy="75" r="66" fill="#242a25" stroke="#424c43" stroke-width="4"/>
    <path d="${arc(75,75,68,210,330)}" fill="none" stroke="#dfe7e6" stroke-width="6" opacity=".75"/>
    <path d="${arc(75,75,68,338,440)}" fill="none" stroke="#ef7676" stroke-width="6" opacity=".85"/>
    ${ticks}${labels}
    <text x="75" y="108" text-anchor="middle" font-size="11" fill="#d7dfd7" letter-spacing="1">ACEL.</text>
    <line id="gta-aux-needle" x1="75" y1="89" x2="75" y2="30" stroke="#f0f5f6" stroke-width="3.3" stroke-linecap="round" transform="rotate(326 75 75)"/>
    <circle cx="75" cy="75" r="14" fill="#151b16" stroke="#a7b0a9" stroke-width="4"/>
  </svg>`;
}
export function mountDriveHud({report}={}) {
  const shell=$('gta-drive-display');
  if(!shell)throw new Error('No se encuentra el HUD de conducción.');
  const tach=$('gta-tachometer');
  const aux=$('gta-auxiliary');
  tach.innerHTML=makeTachometer();
  aux.innerHTML=makeAuxiliaryGauge();
  const speedLabel=$('gta-speed-value');
  const rpmNeedle=$('gta-tach-needle');
  const rpmShadow=$('gta-tach-needle-shadow');
  const auxNeedle=$('gta-aux-needle');
  const gps=$('gta-gps-map');
  const gpsStatus=$('gta-gps-status');
  const gpsHeading=$('gta-gps-heading');
  const gpsCoords=$('gta-gps-coords');
  let mini=null,lastGps=0,lastPos=null;
  let lastSpeed=0,lastMeasure=0,smoothedAccel=0;
  let lastRpm=0,lastAux=0;
  let gpsFailed=false;

  function initGPS(state){
    if(mini||gpsFailed||!window.maplibregl?.Map)return;
    try {
      mini=new window.maplibregl.Map({
        container:gps,style:GPS_STYLE,
        center:[state.lon,state.lat],zoom:16.2,bearing:state.heading||0,
        pitch:0,minZoom:14,maxZoom:18,
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
    const rpm=estimatedRpm(kmh,inCar);
    // Solo indicadores: el juego no simula rpm ni un sensor de presión.
    lastRpm+=(rpm-lastRpm)*.40;
    const angle=207+clamp(lastRpm/9000,0,1)*243.9;
    const rotation='rotate('+angle.toFixed(2)+' 150 150)';
    rpmNeedle.setAttribute('transform',rotation);
    rpmShadow.setAttribute('transform',rotation);
    if(lastMeasure && now>lastMeasure){
      const seconds=clamp((now-lastMeasure)/1000,.03,1);
      const a=(kmh-lastSpeed)/3.6/seconds;
      smoothedAccel=smoothedAccel*.78+clamp(a,-4,4)*.22;
    }
    if(!inCar)smoothedAccel*=.75;
    lastMeasure=now;lastSpeed=kmh;
    lastAux+=(clamp(smoothedAccel*7.5,-30,30)-lastAux)*.48;
    auxNeedle.setAttribute('transform','rotate('+(212+(lastAux+30)/60*228).toFixed(2)+' 75 75)');
    gpsHeading.textContent=String(Math.round((state.heading||0)+360)%360).padStart(3,'0')+'°';
    gpsCoords.textContent=state.lat.toFixed(4)+', '+state.lon.toFixed(4);
    initGPS(state);
    if(mini && (now-lastGps>240 || !lastPos || Math.abs(lastPos.lat-state.lat)>.000025 ||
      Math.abs(lastPos.lon-state.lon)>.000025)){
      try{
        mini.jumpTo({center:[state.lon,state.lat],bearing:state.heading||0,pitch:0});
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
