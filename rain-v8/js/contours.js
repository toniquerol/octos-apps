/** Marching squares at cell centres, with bilinear asymptotic saddle decider.
 * Returns [{elevation, coordinates:[[x1,y1],[x2,y2]]}], in the DEM metric CRS.
 * NoData squares are omitted; boundaries are not extrapolated beyond cell centres.
 */
export function contours(dem,interval,{maxSegments=50000}={}) {
 if(!Number.isFinite(interval)||interval<=0)throw Error('El intervalo de curvas debe ser positivo.');
 if(!Number.isSafeInteger(maxSegments)||maxSegments<1||maxSegments>150000)throw Error('Límite de segmentos inválido.');
 const {width:w,height:h,data:z,dx,dy,x0,y0}=dem,result=[];
 for(let r=0;r<h-1;r++)for(let c=0;c<w-1;c++){
  const i=r*w+c,v=[z[i],z[i+1],z[i+w+1],z[i+w]];
  if(!v.every(Number.isFinite))continue;
  const lo=Math.min(...v),hi=Math.max(...v);if(lo===hi)continue;
  const first=Math.ceil(lo/interval),last=Math.floor(hi/interval);
  if(!Number.isSafeInteger(first)||!Number.isSafeInteger(last))throw Error('Intervalo fuera de la precisión numérica: aumenta el intervalo.');
  if(last-first>maxSegments)throw Error('Demasiadas curvas: aumenta el intervalo.');
  const pts=[[x0+(c+.5)*dx,y0-(r+.5)*dy],[x0+(c+1.5)*dx,y0-(r+.5)*dy],[x0+(c+1.5)*dx,y0-(r+1.5)*dy],[x0+(c+.5)*dx,y0-(r+1.5)*dy]];
  for(let k=first;k<=last;k++){
   const elevation=k*interval,edges=[];
   for(let a=0;a<4;a++){const b=(a+1)%4;if((v[a]>=elevation)===(v[b]>=elevation))continue;const t=(elevation-v[a])/(v[b]-v[a]);edges.push({edge:a,point:[pts[a][0]+t*(pts[b][0]-pts[a][0]),pts[a][1]+t*(pts[b][1]-pts[a][1])]});}
   let pairs=[];
   if(edges.length===2)pairs=[[edges[0].point,edges[1].point]];
   else if(edges.length===4){const f=v.map(x=>x-elevation),q=f[0]*f[2]-f[1]*f[3];pairs=q>=0?[[edges[0].point,edges[1].point],[edges[2].point,edges[3].point]]:[[edges[0].point,edges[3].point],[edges[1].point,edges[2].point]];}
   for(const coordinates of pairs){if(Math.hypot(coordinates[0][0]-coordinates[1][0],coordinates[0][1]-coordinates[1][1])<1e-10)continue;result.push({elevation,coordinates});if(result.length>maxSegments)throw Error('Más de '+maxSegments+' segmentos: aumenta el intervalo de curvas.');}
  }
 }
 return result;
}
