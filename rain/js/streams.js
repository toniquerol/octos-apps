// Une los segmentos D8 conectados para generar polilíneas menos pesadas.
export function extractStreams(d,h,thresholdM2,{maxCells=180000,maxLines=18000}={}) {
  const n=d.data.length,active=new Uint8Array(n),upstream=new Uint8Array(n);
  let count=0;
  for(let i=0;i<n;i++)if(Number.isFinite(h.accumulation[i])&&h.accumulation[i]>=thresholdM2&&h.receiver[i]>=0){active[i]=1;count++;}
  if(!count)return {lines:[],count:0,truncated:false};
  if(count>maxCells)throw Error('Demasiadas celdas de cauce ('+count+'). Aumenta el umbral de superficie hasta delimitar una red legible.');
  for(let i=0;i<n;i++)if(active[i]&&active[h.receiver[i]])upstream[h.receiver[i]]++;
  const visited=new Uint8Array(n),lines=[];
  const point=i=>[d.x0+(i%d.width+.5)*d.dx,d.y0-(Math.floor(i/d.width)+.5)*d.dy];
  const walk=start=>{
    const coords=[point(start)];let i=start,steps=0;
    while(active[i]&&!visited[i]&&steps++<n){
      visited[i]=1;const j=h.receiver[i];if(j<0)break;
      coords.push(point(j));
      if(!active[j]||upstream[j]!==1)break;
      i=j;
    }
    if(coords.length>1)lines.push(coords);
    if(lines.length>maxLines)throw Error('La red produce demasiadas líneas. Aumenta el umbral de cauce.');
  };
  for(let i=0;i<n;i++)if(active[i]&&upstream[i]!==1)walk(i);
  for(let i=0;i<n;i++)if(active[i]&&!visited[i])walk(i);
  return {lines,count,truncated:false};
}
