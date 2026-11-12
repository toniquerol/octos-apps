// Synthetic fixture only: a 5x5 mathematical plane, NOT an official IGN observation.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {loadDEM,cellAt,cellCenter,toLatLng,fromLatLng} from '../js/dem.js';
import {terrain} from '../js/terrain.js';
// Browser FileReader adapter; the actual vendored GeoTIFF parser and proj4 run unmodified.
globalThis.FileReader=class {
 readAsArrayBuffer(blob){blob.arrayBuffer().then(result=>{this.result=result;this.onload?.({target:this});},error=>{this.error=error;this.onerror?.({target:this});});}
};
globalThis.Worker=class {constructor(){throw Error('Unexpected Worker use in uncompressed fixture test');}};
for(const name of ['geotiff','proj4'])runInThisContext(await readFile(new URL(`../vendor/${name}.js`,import.meta.url),'utf8'),{filename:name+'.js'});
const values=Float32Array.from({length:25},(_,i)=>100+(i%5)*2+Math.floor(i/5)*4);
values[24]=-9999;
const metadata={width:5,height:5,BitsPerSample:[32],SampleFormat:[3],SamplesPerPixel:1,StripByteCounts:[100],PhotometricInterpretation:1,ModelPixelScale:[2,2,0],ModelTiepoint:[0,0,0,500000,4400000,0],GTModelTypeGeoKey:1,GTRasterTypeGeoKey:1,ProjectedCSTypeGeoKey:25830,GDAL_NODATA:'-9999'};
// The bundled v2 writer emits only Uint8 sample storage. Retain its genuine TIFF
// header/directory and supply the correctly encoded Float32 sample strip ourselves.
const header=GeoTIFF.writeArrayBuffer(values,metadata);
const headerTiff=await GeoTIFF.fromArrayBuffer(header),headerImage=await headerTiff.getImage();
const offset=headerImage.fileDirectory.StripOffsets[0],bytes=new ArrayBuffer(offset+values.length*4);
new Uint8Array(bytes).set(new Uint8Array(header));
const view=new DataView(bytes),little=new Uint8Array(bytes)[0]===73;
values.forEach((v,i)=>view.setFloat32(offset+i*4,v,little));
const fixtureURL=new URL('fixture-utm.tif',import.meta.url);
await writeFile(fixtureURL,new Uint8Array(bytes));
const blob=new Blob([await readFile(fixtureURL)],{type:'image/tiff'});blob.name='SYNTHETIC fixture-utm.tif';
const dem=await loadDEM(blob);
assert.equal(dem.crs,'EPSG:25830');assert.equal(dem.width,5);assert.equal(dem.height,5);
assert.equal(dem.x0,500000);assert.equal(dem.y0,4400000);assert.equal(dem.dx,2);assert.equal(dem.dy,2);
assert.equal(dem.data[0],100);assert.equal(dem.data[23],122);assert.ok(Number.isNaN(dem.data[24]));assert.equal(dem.valid,24);
const center=cellCenter(dem,12),ll=toLatLng(dem,...center),xy=fromLatLng(dem,...ll);
assert.ok(Math.abs(xy[0]-center[0])<1e-6&&Math.abs(xy[1]-center[1])<1e-6);assert.equal(cellAt(dem,...ll),12);
const t=terrain(dem);assert.ok(Math.abs(t.slope[12]-Math.atan(Math.sqrt(5))*180/Math.PI)<1e-8);
const sw=toLatLng(dem,500002.2,4399994.2),ne=toLatLng(dem,500005.8,4399997.8);
const crop=await loadDEM(blob,{bounds:[sw[1],sw[0],ne[1],ne[0]]});
assert.equal(crop.width,2);assert.equal(crop.height,2);assert.deepEqual(Array.from(crop.data),[106,108,110,112]);
await assert.rejects(()=>loadDEM(blob,{maxCells:24}),/superan/);
console.log('Real vendored GeoTIFF parser: synthetic Float32 UTM fixture, crop, NoData, slope and proj4 round-trip passed.');

