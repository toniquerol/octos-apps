// Tránsito visual por trayectorias D8 calculadas. NO es un solver hidráulico.
// Velocidad de reproducción arbitraria; profundidad y velocidad hidráulica no calculadas.
// Dibuja sobre Canvas y utiliza georreferenciación para seguir el mapa en zoom/pan.
import {toLatLng,cellCenter} from './dem.js';
export class FlowParticles {
 constructor(map){
  this.map=map;this.d=null;this.h=null;this.mask=null;this.particles=[];this.candidates=[];
  this.running=false;this.speed=3;this.count=450;this.maxAge=180;this.last=0;this.frame=0;
  this.canvas=document.createElement('canvas');this.canvas.className='flow-particles';
  this.canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:450';
  map.getContainer().appendChild(this.canvas);
  this.ctx=this.canvas.getContext('2d',{alpha:true});
  this.resize=()=>{const rect=map.getContainer().getBoundingClientRect();const dpr=Math.min(2,window.devicePixelRatio||1);this.canvas.width=Math.max(1,Math.round(rect.width*dpr));this.canvas.height=Math.max(1,Math.round(rect.height*dpr));this.ctx.setTransform(dpr,0,0,dpr,0,0);this.w=rect.width;this.hpx=rect.height;this.draw();};
  map.on('moveend zoomend resize',this.resize);this.resize();
 }
 prepare(d,h,{mask,count=450,speed=3}={}){
  this.pause();if(!h?.receiver||h.receiver.length!==d.data.length)throw Error('El resultado D8 no corresponde al MDT activo.');
  this.d=d;this.h=h;this.mask=mask||null;this.speed=+speed;this.count=Math.max(20,Math.min(1600,Math.round(+count)||450));
  this.candidates=[];const n=d.data.length;
  const stride=Math.max(1,Math.floor(n/80000));
  for(let i=0;i<n;i+=stride){
   const j=h.receiver[i];if(j<0||!Number.isFinite(d.data[i])||!Number.isFinite(d.data[j]))continue;
   if(mask&&!mask[i])continue;
   this.candidates.push(i);
  }
  if(!this.candidates.length)throw Error('No hay trayectorias de flujo dentro del área seleccionada.');
  this.particles=Array.from({length:this.count},()=>this.spawn());
  this.draw();
  return {paths:this.candidates.length,particles:this.count,maskApplied:!!mask};
 }
 spawn(){const p={i:this.candidates[Math.floor(Math.random()*this.candidates.length)],t:Math.random(),age:Math.random()*25};return p;}
 next(p){
  let i=p.i,j=this.h.receiver[i];if(j<0||!Number.isFinite(this.d.data[j])||(this.mask&&!this.mask[j]))return false;
  p.i=j;return this.h.receiver[j]>=0;
 }
 play(){if(!this.h)throw Error('Prepara el recorrido de partículas antes de reproducirlo.');if(this.running)return;this.running=true;this.last=0;this.frame=requestAnimationFrame(t=>this.tick(t));}
 pause(){this.running=false;if(this.frame)cancelAnimationFrame(this.frame);this.frame=0;}
 reset(){this.pause();this.d=null;this.h=null;this.mask=null;this.particles=[];this.candidates=[];this.draw();}
 setSpeed(v){this.speed=Math.max(.1,Math.min(25,+v||3));}
 setCount(v){this.count=Math.max(20,Math.min(1600,Math.round(+v||450)));if(this.h)this.particles=Array.from({length:this.count},()=>this.spawn());}
 xy(i){
  const [x,y]=cellCenter(this.d,i);const [lat,lng]=toLatLng(this.d,x,y);
  return this.map.latLngToContainerPoint([lat,lng]);
 }
 draw(){
  const ctx=this.ctx;if(!ctx)return;
  ctx.clearRect(0,0,this.w||1,this.hpx||1);
  if(!this.h)return;
  ctx.lineCap='round';ctx.lineWidth=1.55;
  for(const p of this.particles){
   const j=this.h.receiver[p.i];if(j<0)continue;
   const a=this.xy(p.i),b=this.xy(j);
   const x=a.x+(b.x-a.x)*p.t,y=a.y+(b.y-a.y)*p.t;
   if(x< -10||y< -10||x>this.w+10||y>this.hpx+10)continue;
   const tx=b.x-a.x,ty=b.y-a.y,len=Math.hypot(tx,ty)||1;
   ctx.strokeStyle='rgba(23,194,255,.84)';ctx.beginPath();ctx.moveTo(x-tx/len*6,y-ty/len*6);ctx.lineTo(x,y);ctx.stroke();
   ctx.fillStyle='rgba(219,250,255,.93)';ctx.beginPath();ctx.arc(x,y,1.35,0,Math.PI*2);ctx.fill();
  }
 }
 tick(t){
  if(!this.running)return;
  const dt=this.last?Math.min(.07,Math.max(0,(t-this.last)/1000)):0;this.last=t;
  for(let k=0;k<this.particles.length;k++){
   const p=this.particles[k];p.age+=dt;
   p.t+=dt*this.speed;
   let hops=0;
   while(p.t>=1&&hops++<5){p.t-=1;if(!this.next(p)){this.particles[k]=this.spawn();break;}}
   if(p.age>this.maxAge)this.particles[k]=this.spawn();
  }
  this.draw();this.frame=requestAnimationFrame(tt=>this.tick(tt));
 }
 destroy(){this.pause();this.map.off('moveend zoomend resize',this.resize);this.canvas.remove();}
}
