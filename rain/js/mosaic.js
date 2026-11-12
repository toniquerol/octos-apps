import {loadDEM,toLatLng,fromLatLng} from './dem.js';
// Mosaico estricto: una sola cuadrícula UTM, misma resolución, sin interpolación ni huecos inventados.
// Cada TIFF se decodifica secuencialmente. Se rechazan desfases y CRS incompatibles.
// El mosaico en memoria está limitado para que la hidrología clásica D8 no agote el navegador.
export async function mosaic(files,{maxCells=12000000,bounds,progress}={}){
 const src=Array.from(files||[]);
 if(!src.length)throw Error('Selecciona al menos un GeoTIFF.');
 if(src.length>32)throw Error('Máximo 32 hojas por operación. Divide la zona en proyectos.');
 if(!(maxCells>0&&maxCells<=12000000))throw Error('Límite de mosaico fuera de rango (hasta 12 millones de celdas).');
 const tiles=[];
 for(let i=0;i<src.length;i++){
  progress?.('Leyendo hoja '+(i+1)+'/'+src.length+': '+(src[i].name||'archivo'));
  let d;
  try{d=await loadDEM(src[i],{maxCells:12000000,bounds});}
  catch(e){if(bounds&&String(e.message).includes('no intersecta')){progress?.('Hoja fuera del área, omitida: '+src[i].name);continue;}throw e;}
  if(d.resolution.resampled)throw Error('La hoja '+d.source+' supera 12 millones de celdas sin reducir resolución. Selecciona primero un recorte más pequeño.');
  tiles.push(d);
 }
 if(!tiles.length)throw Error('Ninguna hoja importada intersecta la zona seleccionada.');
 const a=tiles[0],tolerance=1e-5;
 for(const b of tiles){
  if(b.crs!==a.crs)throw Error('EPSG diferentes. Todas las hojas del mosaico deben estar en el mismo CRS; reproyecta las incompatibles previamente.');
  if(Math.abs(b.dx-a.dx)>tolerance||Math.abs(b.dy-a.dy)>tolerance)throw Error('Resoluciones distintas. No se reinterpola el MDT automáticamente.');
  const ox=(b.x0-a.x0)/a.dx,oy=(a.y0-b.y0)/a.dy;
  if(Math.abs(ox-Math.round(ox))>1e-3||Math.abs(oy-Math.round(oy))>1e-3)
   throw Error('Las celdas no están alineadas. Comprueba la procedencia y el georreferenciado del archivo '+b.source);
 }
 const minX=Math.min(...tiles.map(d=>d.x0)),maxY=Math.max(...tiles.map(d=>d.y0));
 const maxX=Math.max(...tiles.map(d=>d.x0+d.width*d.dx)),minY=Math.min(...tiles.map(d=>d.y0-d.height*d.dy));
 const width=Math.round((maxX-minX)/a.dx),height=Math.round((maxY-minY)/a.dy);
 const total=width*height;
 if(!Number.isSafeInteger(total)||total<=0)throw Error('Geometría del mosaico inválida.');
 if(total>maxCells)throw Error('El mosaico requiere '+total.toLocaleString('es-ES')+' celdas; el motor D8 en memoria admite '+maxCells.toLocaleString('es-ES')+'. Recorta el área o divide el estudio. El procesamiento hidrológico global por bloques aún no está disponible.');
 const values=new Float64Array(total);values.fill(NaN);let overlaps=0,conflicts=0,valid=0;
 for(const d of tiles){
  const col=Math.round((d.x0-minX)/a.dx),row=Math.round((maxY-d.y0)/a.dy);
  for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){
   const v=d.data[y*d.width+x];if(!Number.isFinite(v))continue;
   const j=(row+y)*width+col+x;
   if(Number.isFinite(values[j])){overlaps++;if(Math.abs(values[j]-v)>0.2)conflicts++;continue;}
   values[j]=v;valid++;
  }
 }
 const holes=total-valid;
 const warnings=[];
 if(holes)warnings.push(holes.toLocaleString('es-ES')+' celdas sin datos. Las cuencas podrían quedar truncadas.');
 if(conflicts)warnings.push(conflicts.toLocaleString('es-ES')+' celdas superpuestas con cotas diferentes >0,2 m; se conserva la primera hoja.');
 const lat=toLatLng({crs:a.crs},(minX+maxX)/2,(minY+maxY)/2)[0];
 const areaFactor=a.crs==='EPSG:3857'?Math.cos(lat*Math.PI/180)**2:1;
 return {width,height,data:values,dx:a.dx,dy:a.dy,x0:minX,y0:maxY,crs:a.crs,source:tiles.map(d=>d.source).join(' + '),
  valid,nodata:holes,areaFactor,projectionCaution:a.projectionCaution,
  resolution:{x:a.dx,y:a.dy,unit:'m',resampled:false,originalX:a.dx,originalY:a.dy},
  originalCells:total,verticalDatum:a.verticalDatum,tiles:tiles.map(d=>({name:d.source,width:d.width,height:d.height,x0:d.x0,y0:d.y0})),warnings,overlaps,conflicts};
}
