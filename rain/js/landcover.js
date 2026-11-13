// OcToS Rain V8 · Clasificación y escorrentía por cobertura real del suelo.
// Sólo se leen códigos de GeoTIFF numérico. Las imágenes WMS NO suministran datos al cálculo.
import {loadDEM,toLatLng,fromLatLng,cellCenter} from './dem.js';
import {areaPerCell} from './rainfall.js';
import {demBounds} from './render.js';

export const CATEGORIES=[
 {id:'asfalto',name:'Asfalto y carreteras',c:0.90,color:'#da5652',impervious:true},
 {id:'edificios',name:'Edificios y cubiertas',c:0.95,color:'#912b67',impervious:true},
 {id:'urbano',name:'Superficies urbanizadas',c:0.75,color:'#db9547',impervious:true},
 {id:'cultivos',name:'Cultivos agrícolas',c:0.35,color:'#ebd06e',impervious:false},
 {id:'bosques',name:'Bosques',c:0.20,color:'#298456',impervious:false},
 {id:'natural',name:'Suelo natural',c:0.40,color:'#8cb5a3',impervious:false},
 {id:'agua',name:'Masas de agua',c:null,color:'#499dc9',impervious:false},
 {id:'ignorado',name:'Sin clasificar',c:null,color:'#64717a',impervious:false}
];
export const DEFAULT_C=Object.fromEntries(CATEGORIES.filter(x=>x.c!==null).map(x=>[x.id,x.c]));
function validMap(value){return CATEGORIES.some(x=>x.id===value&&x.c!==null);}
export function clampCoefficients(input){
 const out={};
 for(const cat of CATEGORIES)if(cat.c!==null){
  const n=Number(input?.[cat.id]??cat.c);
  if(!Number.isFinite(n)||n<0||n>1)throw Error('Coeficiente inválido para '+cat.name);
  out[cat.id]=n;
 }
 return out;
}
function rasterIndex(data,x,y){
 const col=Math.floor((x-data.x0)/data.dx),row=Math.floor((data.y0-y)/data.dy);
 return col>=0&&row>=0&&col<data.width&&row<data.height?row*data.width+col:-1;
}
function coverCode(cover,dem,x,y){
 let xx=x,yy=y;
 if(cover.crs!==dem.crs){
  const [lat,lng]=toLatLng(dem,x,y);
  [xx,yy]=fromLatLng(cover,lat,lng);
 }
 const i=rasterIndex(cover,xx,yy),v=i>=0?cover.data[i]:NaN;
 return Number.isFinite(v)?String(v):null;
}
export async function loadCoverGeoTIFF(file,dem,{maxCells=1500000,progress=()=>{}}={}){
 if(!file)throw Error('Selecciona el GeoTIFF de clases de cobertura.');
 if(!dem)throw Error('Importa primero el MDT y delimita la cuenca.');
 const corners=[[dem.x0,dem.y0],[dem.x0+dem.width*dem.dx,dem.y0],[dem.x0,dem.y0-dem.height*dem.dy],[dem.x0+dem.width*dem.dx,dem.y0-dem.height*dem.dy]];
 const ll=corners.map(([x,y])=>toLatLng(dem,x,y));
 const bbox=[Math.min(...ll.map(x=>x[1])),Math.min(...ll.map(x=>x[0])),Math.max(...ll.map(x=>x[1])),Math.max(...ll.map(x=>x[0]))];
 progress('Recortando el GeoTIFF de cobertura a la extensión del terreno…');
 const cover=await loadDEM(file,{maxCells,bounds:bbox});
 if(cover.valid<=0)throw Error('La cobertura no contiene valores en la zona.');
 cover.kind='categorical';cover.product=file.name;
 return cover;
}
export async function analyzeCover(dem,basin,cover,mapping,coefficients,{maxSamples=270000,progress=()=>{},signal}={}){
 if(!dem||!basin?.mask||!cover)throw Error('Faltan MDT, cuenca o clasificación GeoTIFF.');
 if(basin.mask.length!==dem.data.length)throw Error('La cuenca no coincide con el MDT cargado.');
 const coeff=clampCoefficients(coefficients);
 const n=dem.data.length,areaCell=areaPerCell(dem),estimatedBasinCells=Math.round(basin.areaM2/areaCell);
 const stride=Math.max(1,Math.ceil(estimatedBasinCells/maxSamples));
 const classCounts=new Map(),codeCounts=new Map(),sampleIndices=[],sampleCodes=[],sampleCats=[];
 let basinCells=0,matched=0,unknown=0,outside=0,weights=0,knownCells=0,impervious=0;
 let cursor=0,pending=0;
 for(let i=0;i<n;i++){
  if(!basin.mask[i]||!Number.isFinite(dem.data[i]))continue;
  basinCells++;
  if(++pending<stride)continue;
  pending=0;
  const [x,y]=cellCenter(dem,i),code=coverCode(cover,dem,x,y);
  if(code===null){outside++;continue;}
  matched++;codeCounts.set(code,(codeCounts.get(code)||0)+1);
  if(matched%16000===0){if(signal?.aborted)throw Error('Análisis de cobertura cancelado.');progress('Muestreadas '+matched.toLocaleString('es-ES')+' celdas…');await new Promise(resolve=>setTimeout(resolve,0));}
  const cat=mapping[code];
  if(!validMap(cat)){unknown++;continue;}
  knownCells++;classCounts.set(cat,(classCounts.get(cat)||0)+1);
  weights+=coeff[cat];if(CATEGORIES.find(c=>c.id===cat)?.impervious)impervious++;
  sampleIndices.push(i);sampleCodes.push(code);sampleCats.push(cat);
  cursor++;

 }
 if(!matched)throw Error('La capa de cobertura no aporta datos a esta cuenca.');
 const total=basin.areaM2;
 const summary=CATEGORIES.filter(c=>c.c!==null).map(c=>{
  const count=classCounts.get(c.id)||0;
  return {...c,coefficient:coeff[c.id],areaM2:count/Math.max(1,matched)*total,pct:count/Math.max(1,matched)*100};
 }).filter(c=>c.areaM2>0);
 const knownFraction=knownCells/matched,coverage=matched/(matched+outside)||0;
 return {summary,codeCounts,matched,unknown,outside,knownCells,knownFraction,coverage,
  weightedC:knownCells?weights/knownCells:null,
  areaM2:total,imperviousM2:impervious/Math.max(1,matched)*total,
  complete:knownFraction>=.95&&coverage>=.95,
  usedSampling:stride>1,stride,coverName:cover.product,codeMapping:{...mapping},coefficients:coeff,
  sampleIndices,sampleCats,sampleCodes};
}
function rgba(hex){const v=hex.replace('#','');return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)];}
export async function overlayCover(dem,basin,cover,mapping,{width=700}={}){
 const w=Math.max(40,Math.min(width,dem.width)),h=Math.max(1,Math.round(w*dem.height/dem.width));
 const canvas=document.createElement('canvas');canvas.width=w;canvas.height=Math.min(h,1100);
 const hh=canvas.height,ctx=canvas.getContext('2d'),im=ctx.createImageData(w,hh);
 const colors=Object.fromEntries(CATEGORIES.map(c=>[c.id,rgba(c.color)]));
 const mask=basin.mask;
 for(let row=0;row<hh;row++){
  const y=Math.min(dem.height-1,Math.floor((row+.5)*dem.height/hh));
  for(let col=0;col<w;col++){
   const x=Math.min(dem.width-1,Math.floor((col+.5)*dem.width/w)),i=y*dem.width+x;
   if(!mask[i])continue;
   const [mx,my]=cellCenter(dem,i),code=coverCode(cover,dem,mx,my);
   if(code===null)continue;
   const cat=mapping[code]||'ignorado',rgb=colors[cat]||colors.ignorado,k=(row*w+col)*4;
   im.data[k]=rgb[0];im.data[k+1]=rgb[1];im.data[k+2]=rgb[2];im.data[k+3]=205;
  }
  if(row%140===0)await new Promise(resolve=>setTimeout(resolve,0));
 }
 ctx.putImageData(im,0,0);
 return {url:canvas.toDataURL('image/png'),bounds:demBounds(dem)};
}
