// Finite differences in metres; one-sided derivatives at valid raster boundaries.
export function terrain(dem) {
 const {width:w,height:h,data:z,dx,dy}=dem,n=z.length;
 const slope=new Float64Array(n).fill(NaN),percent=new Float64Array(n).fill(NaN),aspect=new Float64Array(n).fill(NaN),gx=new Float64Array(n).fill(NaN),gy=new Float64Array(n).fill(NaN);
 let min=Infinity,max=-Infinity,sum=0,count=0;
 for(let i=0;i<n;i++){
  if(!Number.isFinite(z[i]))continue;
  min=Math.min(min,z[i]);max=Math.max(max,z[i]);sum+=z[i];count++;
  const c=i%w,r=Math.floor(i/w),l=c>0?z[i-1]:NaN,rt=c<w-1?z[i+1]:NaN,u=r>0?z[i-w]:NaN,d=r<h-1?z[i+w]:NaN;
  const derivative=(a,b,step)=>Number.isFinite(a)&&Number.isFinite(b)?(b-a)/(2*step):Number.isFinite(b)?(b-z[i])/step:Number.isFinite(a)?(z[i]-a)/step:NaN;
  gx[i]=derivative(l,rt,dx);gy[i]=-derivative(u,d,dy);
  if(!Number.isFinite(gx[i])||!Number.isFinite(gy[i]))continue;
  const g=Math.hypot(gx[i],gy[i]);slope[i]=Math.atan(g)*180/Math.PI;percent[i]=100*g;
  aspect[i]=g===0?NaN:(Math.atan2(-gx[i],-gy[i])*180/Math.PI+360)%360;
 }
 return {slope,percent,aspect,gx,gy,min:count?min:NaN,max:count?max:NaN,mean:count?sum/count:NaN,count};
}
export function hillshade(t,{azimuth=315,altitude=45,exaggeration=1,intensity=1,contrast=1}={}) {
 const out=new Float64Array(t.gx.length).fill(NaN),rad=Math.PI/180,az=azimuth*rad,alt=altitude*rad;
 for(let i=0;i<out.length;i++)if(Number.isFinite(t.gx[i])&&Number.isFinite(t.gy[i])){
  const x=t.gx[i]*exaggeration,y=t.gy[i]*exaggeration;
  const light=(-x*Math.sin(az)*Math.cos(alt)-y*Math.cos(az)*Math.cos(alt)+Math.sin(alt))/Math.hypot(x,y,1);
  out[i]=Math.max(0,Math.min(1,((light*intensity)-.5)*contrast+.5));
 }return out;
}
