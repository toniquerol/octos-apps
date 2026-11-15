/* OcToS Roads — VCHI 2005 technical reference, not engineering certification. */
(function(){'use strict';window.OcToSRoadGeometry=(function RoadsGeometryVCHI(){
'use strict';
const table=[[20,.18,15,15],[30,.17,35,30],[40,.17,60,55],[50,.16,100,90],[60,.15,150,135],[70,.14,215,195],[80,.14,280,250],[90,.13,375,335],[100,.12,490,435],[110,.11,null,560],[120,.09,null,755],[130,.08,null,950]];
const spiralLimits={60:300,70:500,80:800,90:1000,100:1300,110:1900,120:2500};
const source={title:'Manual VCHI (2005)',url:'https://limacap.org/normatividad-2019/transportes/Manual%20VCHI%20%282005%29.pdf',spanish:'BOE-A-2016-2217'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),V=(x,y)=>({x,y}),add=(a,b)=>V(a.x+b.x,a.y+b.y),sub=(a,b)=>V(a.x-b.x,a.y-b.y),mul=(a,n)=>V(a.x*n,a.y*n);
const len=a=>Math.hypot(a.x,a.y),dist=(a,b)=>len(sub(a,b)),unit=a=>len(a)?mul(a,1/len(a)):V(0,0),dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
function normProfile(r){return ['vchi','es31ic','off'].includes(r.normProfile)?r.normProfile:'vchi';}
function friction(speed){
 let s=clamp(Number(speed)||50,20,130);for(let k=1;k<table.length;k++){let a=table[k-1],b=table[k];if(s<=b[0])return a[1]+(b[1]-a[1])*(s-a[0])/(b[0]-a[0]);}return .08;
}
function minimumRadius(speed,peralte=.04){
 const s=clamp(Number(speed)||50,20,130),e=clamp(Number(peralte)||0,0,.12),row=table.find(r=>r[0]===s);
 if(row&&Math.abs(e-.04)<1e-9&&row[2])return row[2];
 if(row&&Math.abs(e-.06)<1e-9&&row[3])return row[3];
 return s*s/(127*(e+friction(s)));
}
const requiredSpiral=(speed,r)=>r>0?Math.max(30,Math.pow(Number(speed)/3.6,3)/(r*.5)):null;
function isSpiralRequired(speed,r){
 if(speed<60)return false;const key=Object.keys(spiralLimits).map(Number).sort((a,b)=>a-b).find(v=>speed<=v);
 return key?r<=spiralLimits[key]:true;
}
function overwidth(speed,r,n=2,b=6){
 r=Number(r);b=Number(b);if(!(r>b&&b>0))return null;
 const S=Math.max(1,Number(n)||2)*(r-Math.sqrt(r*r-b*b))+Number(speed)/(10*Math.sqrt(r));
 return Number.isFinite(S)?Math.max(0,S):null;
}
function centerPath(R,L,phi,sign){
 const circle=Math.max(0,phi-L/R);let p=V(0,0),theta=0;
 const out={entry:[],arc:[],exit:[]};
 function start(k){out[k].push(V(p.x,p.y));}
 function step(k,h,heading,next){p=add(p,V(h*Math.cos(heading),h*Math.sin(heading)));theta=next;out[k].push(V(p.x,p.y));}
 if(L>0){
  start('entry');const n=Math.max(1,Math.ceil(L/5)),h=L/n;
  for(let j=1;j<=n;j++){let t=(j-.5)*h,at=j*h;step('entry',h,sign*t*t/(2*R*L),sign*at*at/(2*R*L));}
 }
 start('arc');const n=Math.max(1,Math.ceil(circle*R/5)),h=circle*R/n;
 for(let j=0;j<n;j++)step('arc',h,theta+sign*h/(2*R),theta+sign*h/R);
 if(L>0){
  start('exit');const n=Math.max(1,Math.ceil(L/5)),h=L/n,base=sign*(L/(2*R)+circle);
  const hd=t=>base+sign*(t/R-t*t/(2*R*L));
  for(let j=1;j<=n;j++)step('exit',h,hd((j-.5)*h),hd(j*h));
 }
 return {...out,T:p.x/(1+Math.cos(phi)),end:p,circle};
}
function build(road,toXY,toLL,section){
 const nodes=road.nodes||[];if(nodes.length<2)return {parts:[],arcs:[],curves:[],total:0,minRadius:null};
 const lat0=nodes.reduce((s,n)=>s+n[0],0)/nodes.length,pts=nodes.map(n=>toXY(n,lat0));
 const parts=[],arcs=[],curves=[],speed=Number(road.speed)||90,targetR=Math.max(0,Number(road.radius)||0),sec=section||{lanes:2,laneWidth:3.5};
 let last=pts[0];
 function emit(points,r=0,turn=0,index=0,kind='straight',widening=0,wideningProfile=null){
  if(points.length<2)return;let line=[];
  for(const p of points)if(!line.length||dist(p,line.at(-1))>.005)line.push(p);
  if(line.length<2)return;let distance=0;for(let k=1;k<line.length;k++)distance+=dist(line[k],line[k-1]);
  const maxspeed=r>0?clamp(Math.round(Math.sqrt(127*r*(.06+.11))/10)*10,20,speed):speed;
  parts.push({points:line.map(p=>toLL(p,lat0)),speed:maxspeed,radius:r,length:distance,turn,segmentIndex:index,kind,widening,wideningProfile});
 }
 if(targetR===0){for(let i=0;i<pts.length-1;i++)emit([pts[i],pts[i+1]],0,0,i);return {parts,arcs,curves,total:parts.reduce((s,p)=>s+p.length,0),minRadius:null};}
 for(let i=1;i<pts.length-1;i++){
  const PI=pts[i],prev=pts[i-1],next=pts[i+1],lin=dist(prev,PI),lout=dist(next,PI);
  if(lin<.01||lout<.01)continue;
  const u=unit(sub(PI,prev)),w=unit(sub(next,PI)),phi=Math.acos(clamp(dot(u,w),-1,1)),sign=Math.sign(cross(u,w));
  if(!sign||phi<.0001||phi>Math.PI-.001){emit([last,PI],0,0,i-1);last=PI;continue;}
  const maxT=.45*Math.min(lin,lout),mode=['off','auto','on'].includes(road.transitionMode)?road.transitionMode:'auto';
  let R=targetR,L=0;
  const minimum=requiredSpiral(speed,R);
  if(mode!=='off'&&(mode==='on'||isSpiralRequired(speed,R))&&minimum<.86*R*phi)L=minimum;
  let geom;
  // If the required spiral cannot fit, retain the original radius and try a circular arc.
  if(L&&centerPath(R,L,phi,sign).T>maxT)L=0;
  for(let iteration=0;iteration<14;iteration++){
   geom=centerPath(R,L,phi,sign);
   if(geom.T<=maxT+.005)break;
   R*=clamp(maxT/Math.max(geom.T,.01)*.985,.05,.99);
   if(L>0){const required=requiredSpiral(speed,R);L=required<.86*R*phi?required:0;}
  }
  geom=centerPath(R,L,phi,sign);
  if(!(R>.05&&Number.isFinite(geom.T)&&geom.T<=maxT+.05)){
   emit([last,PI],0,0,i-1);last=PI;continue;
  }
  const TS=sub(PI,mul(u,geom.T)),normal=V(-u.y,u.x);
  const world=p=>add(TS,add(mul(u,p.x),mul(normal,p.y))),extra=overwidth(speed,R,sec.lanes||2,road.wheelbase??6)||0;
  emit([last,TS],0,0,i-1);
  if(L){const p=geom.entry.map(world);emit(p,R,sign,i-1,'clothoid-entry',extra,p.map((_,k)=>extra*k/(p.length-1)));}
  const circular=geom.arc.map(world);
  // Widening is progressively introduced for simple arcs; spirals handle their own gradual ramp.
  const circularWidening=circular.map((_,j)=>{
   if(L)return extra;
   const n=circular.length-1,f=n>0?j/n:0,arcLength=geom.circle*R;
   return extra*clamp(Math.min(f,1-f)*arcLength/Math.min(30,Math.max(1,arcLength/3)),0,1);
  });
  emit(circular,R,sign,i-1,'arc',extra,circularWidening);
  if(L){const p=geom.exit.map(world);emit(p,R,sign,i-1,'clothoid-exit',extra,p.map((_,k)=>extra*(1-k/(p.length-1))));}
  last=world((L?geom.exit:geom.arc).at(-1));
  arcs.push({center:toLL(PI,lat0),middle:toLL(circular[Math.floor(circular.length/2)],lat0),radius:R,speed:parts.at(-1).speed,transition:L,overwidth:extra,kind:L?'clothoid+arc':'circular'});
  curves.push({segmentIndex:i-1,radius:R,desiredRadius:targetR,transition:L,requiredTransition:requiredSpiral(speed,R),
   spiralRequired:isSpiralRequired(speed,R),turnAngle:phi*180/Math.PI,tangent:geom.T,overwidth:extra,kind:L?'clothoid+arc':'circular'});
 }
 emit([last,pts.at(-1)],0,0,pts.length-2);
 return {parts,arcs,curves,total:parts.reduce((s,p)=>s+p.length,0),minRadius:curves.length?Math.min(...curves.map(c=>c.radius)):null};
}
function inspect(road,geo,sec){
 const profile=normProfile(road),checks=[],warnings=[],speed=Number(road.speed)||90;
 const addCheck=(state,label,detail,ref)=>{checks.push({state,label,detail,ref});if(state==='adjust')warnings.push(label+': '+detail);};
 if(profile==='off')return {profile,checks,warnings,minRadius:null,source};
 if(profile==='es31ic')return {profile,checks:[{state:'unknown',label:'Norma 3.1-IC',detail:'Perfil reservado, valores españoles todavía no codificados',ref:'BOE-A-2016-2217'}],warnings,minRadius:null,source};
 const min=minimumRadius(speed,Number(road.superelevation??.04));
 if(geo.minRadius==null)addCheck('unknown','Radio mínimo','Sin curvas para evaluar','VCHI 8.2.2');
 else addCheck(geo.minRadius+.5>=min?'ok':'adjust','Radio mínimo',`R ${geo.minRadius.toFixed(1)} m frente a ${min.toFixed(1)} m de referencia`,'VCHI 8.2.2');
 for(const c of geo.curves||[]){
  if(c.spiralRequired&&c.transition+1<c.requiredTransition)addCheck('adjust','Transición curva '+(c.segmentIndex+1),`${c.transition.toFixed(1)} m frente a ${c.requiredTransition.toFixed(1)} m`,'VCHI 8.2.1/8.2.7');
  if(c.desiredRadius-c.radius>.5)addCheck('adjust','Radio reducido curva '+(c.segmentIndex+1),`${c.desiredRadius.toFixed(1)} → ${c.radius.toFixed(1)} m por espacio disponible`,'Trazado geométrico');
 }
 if(Number(sec.laneWidth)<3&&speed>=60)addCheck('adjust','Anchura de carril','Revisar sección para categoría y velocidad','VCHI 10.2.1');
 else addCheck('ok','Anchura de carril',`${Number(sec.laneWidth).toFixed(2)} m; comprobar categoría y contexto`,'VCHI 10.2.1');
 addCheck('unknown','Alineamiento vertical','Sin cotas verificadas y curvas verticales','VCHI cap. 9');
 addCheck('unknown','Visibilidad de parada','Sin comprobación de pendiente, obstáculos y fricción longitudinal','VCHI cap. 7');
 addCheck('unknown','Vehículos VP/VA','No se ha calculado la envolvente completa de barrido','VCHI caps. 5/11');
 return {profile,checks,warnings,minRadius:min,source};
}
const turningRadius=(a,b)=>[a?.designVehicle,b?.designVehicle].includes('VA')?16:[a?.designVehicle,b?.designVehicle].includes('VP')?12:7;
return Object.freeze({table,spiralLimits,source,normProfile,friction,minimumRadius,requiredSpiral,isSpiralRequired,overwidth,turningRadius,build,inspect});
})();})();
