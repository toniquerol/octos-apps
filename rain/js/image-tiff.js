// Visualizador independiente de GeoTIFF RGB/RGBA georreferenciado en EPSG:3857.
// Un TIFF de ortoimagen o sombreado NO es elevación y no se usará en hidrología.
export async function loadVisualTiff(file,{maxSide=1600}={}) {
 if(!globalThis.GeoTIFF)throw Error('La biblioteca GeoTIFF no está disponible.');
 const tif=await GeoTIFF.fromBlob(file);
 const im=await tif.getImage(),keys=await im.getGeoKeys();
 if(Number(keys.ProjectedCSTypeGeoKey)!==3857)throw Error('La capa visual debe estar en EPSG:3857. Para otros CRS usa el MDT numérico.');
 const samples=im.getSamplesPerPixel();
 if(samples!==3&&samples!==4&&samples!==1)throw Error('Esta imagen debe tener 1, 3 o 4 bandas.');
 const fd=im.fileDirectory,scale=fd.ModelPixelScale,tie=fd.ModelTiepoint;
 if(!scale||!tie||!(scale[0]>0)||!(scale[1]>0))throw Error('La imagen no tiene referencia norte-arriba compatible.');
 const x0=tie[3]-tie[0]*scale[0],y0=tie[4]+tie[1]*scale[1];
 const srcW=im.getWidth(),srcH=im.getHeight();
 const k=Math.min(1,maxSide/Math.max(srcW,srcH)),width=Math.max(1,Math.round(srcW*k)),height=Math.max(1,Math.round(srcH*k));
 const rgb=await im.readRasters({width,height,resampleMethod:'nearest',interleave:true});
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d'),out=ctx.createImageData(width,height);
 let lo=Infinity,hi=-Infinity;
 if(samples===1){for(let i=0;i<rgb.length;i++)if(Number.isFinite(rgb[i])){lo=Math.min(lo,rgb[i]);hi=Math.max(hi,rgb[i]);}}
 for(let i=0;i<width*height;i++){
  const j=i*4,q=i*samples;
  if(samples===1){const v=Number.isFinite(rgb[q])?Math.round(255*(rgb[q]-lo)/(hi-lo||1)):0;out.data[j]=out.data[j+1]=out.data[j+2]=v;out.data[j+3]=Number.isFinite(rgb[q])?255:0;}
  else{out.data[j]=rgb[q];out.data[j+1]=rgb[q+1];out.data[j+2]=rgb[q+2];out.data[j+3]=samples===4?rgb[q+3]:255;}
 }
 ctx.putImageData(out,0,0);
 const nw=L.CRS.EPSG3857.unproject(L.point(x0,y0));
 const se=L.CRS.EPSG3857.unproject(L.point(x0+scale[0]*srcW,y0-scale[1]*srcH));
 return {url:canvas.toDataURL('image/png'),bounds:L.latLngBounds(nw,se),width:srcW,height:srcH,bands:samples};
}
