// GeoTIFF numeric ingestion. Pixel coordinates in this application always refer to cell edges.
const definitions=new Set();
function projection(crs) {
  if (!globalThis.proj4) throw new Error('No se ha cargado proj4.');
  const n=Number(String(crs).replace('EPSG:',''));
  if(definitions.has(n))return `EPSG:${n}`;
  let def;
  if(n>=25828&&n<=25831) def=`+proj=utm +zone=${n-25800} +ellps=GRS80 +units=m +no_defs`;
  else if(n>=32628&&n<=32631) def=`+proj=utm +zone=${n-32600} +datum=WGS84 +units=m +no_defs`;
  else if(n===4083) def='+proj=utm +zone=28 +ellps=GRS80 +units=m +no_defs';
  else throw new Error(`EPSG:${n} no admitido: reproyecta el MDT a UTM métrico de España.`);
  globalThis.proj4.defs(`EPSG:${n}`,def);
  definitions.add(n);
  return `EPSG:${n}`;
}
export function toLatLng(dem,x,y) {const [lng,lat]=globalThis.proj4(projection(dem.crs),'EPSG:4326',[x,y]);return [lat,lng];}
export function fromLatLng(dem,lat,lng) {return globalThis.proj4('EPSG:4326',projection(dem.crs),[lng,lat]);}
export function cellAt(dem,lat,lng) {const [x,y]=fromLatLng(dem,lat,lng),c=Math.floor((x-dem.x0)/dem.dx),r=Math.floor((dem.y0-y)/dem.dy);return c>=0&&r>=0&&c<dem.width&&r<dem.height?r*dem.width+c:-1;}
export function cellCenter(dem,i) {return [dem.x0+(i%dem.width+.5)*dem.dx,dem.y0-(Math.floor(i/dem.width)+.5)*dem.dy];}
export async function loadDEM(input,{maxCells=1000000,bounds,signal}={}) {
  if(!globalThis.GeoTIFF) throw new Error('No se ha cargado geotiff.js.');
  if(!Number.isSafeInteger(maxCells)||maxCells<1||maxCells>16000000)throw new Error('Límite de celdas inválido (1–16 millones).');
  const tiff=typeof input==='string'?await GeoTIFF.fromUrl(input,{allowFullFile:false},signal):await GeoTIFF.fromBlob(input);
  try {
    const im=await tiff.getImage(),keys=await im.getGeoKeys(),fd=im.fileDirectory;
    const tag=async n=>fd.loadValue?await fd.loadValue(n):fd[n];
    const crs=projection(keys.ProjectedCSTypeGeoKey);
    if(keys.ProjLinearUnitsGeoKey&&keys.ProjLinearUnitsGeoKey!==9001)throw new Error('El MDT no usa metros.');
    if(keys.VerticalUnitsGeoKey&&keys.VerticalUnitsGeoKey!==9001)throw new Error('Las elevaciones no están en metros.');
    if(im.getSamplesPerPixel()!==1)throw new Error('Se requiere un MDT numérico de una banda; no una imagen RGB.');
    const matrix=await tag('ModelTransformation'),scale=await tag('ModelPixelScale'),tie=await tag('ModelTiepoint');
    let x0,y0,dx,dy;
    if(matrix){
      if(matrix[1]||matrix[4]||matrix[2]||matrix[6]||matrix[12]||matrix[13]||matrix[14]||matrix[15]!==1)throw new Error('MDT rotado o transformación no compatible. Reproyecta a una malla norte-arriba.');
      dx=matrix[0];dy=-matrix[5];x0=matrix[3];y0=matrix[7];
    }else if(scale&&tie){dx=scale[0];dy=scale[1];x0=tie[3]-tie[0]*dx;y0=tie[4]+tie[1]*dy;}
    else throw new Error('El archivo no contiene georreferenciación válida.');
    if(![dx,dy,x0,y0].every(Number.isFinite)||dx<=0||dy<=0)throw new Error('Resolución o orientación de malla no compatible.');
    if(keys.GTRasterTypeGeoKey===2){x0-=dx/2;y0+=dy/2;}
    let window=[0,0,im.getWidth(),im.getHeight()];
    if(bounds){
      if(bounds.length!==4||!bounds.every(Number.isFinite)||bounds[0]>=bounds[2]||bounds[1]>=bounds[3])throw new Error('Recorte inválido; usa [oeste,sur,este,norte].');
      // Densify edges to account for curved meridians in UTM.
      const pts=[];for(let t=0;t<=20;t++){const f=t/20,lon=bounds[0]+f*(bounds[2]-bounds[0]),lat=bounds[1]+f*(bounds[3]-bounds[1]);for(const p of [[lon,bounds[1]],[lon,bounds[3]],[bounds[0],lat],[bounds[2],lat]])pts.push(globalThis.proj4('EPSG:4326',crs,p));}
      window=[Math.max(0,Math.floor((Math.min(...pts.map(p=>p[0]))-x0)/dx)),Math.max(0,Math.floor((y0-Math.max(...pts.map(p=>p[1])))/dy)),Math.min(im.getWidth(),Math.ceil((Math.max(...pts.map(p=>p[0]))-x0)/dx)),Math.min(im.getHeight(),Math.ceil((y0-Math.min(...pts.map(p=>p[1])))/dy))];
    }
    const width=window[2]-window[0],height=window[3]-window[1];
    if(width<1||height<1)throw new Error('El terreno seleccionado no intersecta este MDT.');
    if(width*height>maxCells)throw new Error(`${width*height} celdas superan el límite de ${maxCells}. Selecciona una zona menor antes de importar.`);
    const raw=await im.readRasters({window,samples:[0],interleave:true,signal}),nodata=await im.getGDALNoData();
    const metadata=await im.getGDALMetadata(0)||{};
    const factor=metadata.SCALE===undefined?1:Number(metadata.SCALE),offset=metadata.OFFSET===undefined?0:Number(metadata.OFFSET);
    if(!Number.isFinite(factor)||!Number.isFinite(offset))throw new Error('Escala de elevaciones inválida.');
    const data=new Float64Array(raw.length);let valid=0;
    for(let i=0;i<raw.length;i++){data[i]=!Number.isFinite(raw[i])||(nodata!==null&&nodata!==undefined&&raw[i]===nodata)?NaN:raw[i]*factor+offset;if(Number.isFinite(data[i]))valid++;}
    if(!valid)throw new Error('El recorte contiene únicamente NoData.');
    return {width,height,data,dx,dy,x0:x0+window[0]*dx,y0:y0-window[1]*dy,crs,source:typeof input==='string'?input:input.name,valid,nodata:width*height-valid,resolution:{x:dx,y:dy,unit:'m',resampled:false},verticalDatum:keys.VerticalCSTypeGeoKey||'No indicado: consultar ficha del producto',window};
  }finally{if(tiff.close)await tiff.close();}
}
