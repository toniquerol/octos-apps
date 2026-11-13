import test from 'node:test';
import assert from 'node:assert/strict';
import {identify,shapefileParts} from '../js/formats.js';
import {Terrain3D} from '../js/terrain3d.js';
import {sampleCoverage} from '../js/data-manager.js';
test('coverage excludes NoData and points outside the study polygon',()=>{
 globalThis.proj4=Object.assign((a,b,p)=>p,{defs(){}});
 const d={width:2,height:2,x0:0,y0:2,dx:1,dy:1,crs:'EPSG:25830',data:[1,NaN,2,3]};
 assert.equal(sampleCoverage(d,[0,0,2,2],null,2).percent,75);
 assert.equal(sampleCoverage(d,[0,0,2,2],[[0,0],[1,0],[1,2],[0,2]],2).percent,100);
 assert.equal(sampleCoverage(d,[3,3,4,4],null,2).percent,0);
});
test('identification reads signature, rejects renamed TIFF, groups companions',async()=>{
 const f=new Blob([new Uint8Array([73,73,42,0,0,0,0,0])]);f.name='unknown.bin';assert.equal((await identify(f)).readable,true);
 const wrong=new Blob(['not a TIFF']);wrong.name='terrain.tif';await assert.rejects(()=>identify(wrong),/firma/);
 assert.deepEqual(shapefileParts([{name:'A.SHP'},{name:'a.dbf'}]),[{name:'a',missing:['shx','prj']}]);
});
test('north is negative Z, east positive X; D8 particles share terrain orientation',()=>{
 class Vector3{constructor(x,y,z){Object.assign(this,{x,y,z});}}
 const view=Object.create(Terrain3D.prototype);
 Object.assign(view,{THREE:{Vector3},dem:{width:2,height:2,dx:10,dy:10,x0:0,y0:20,data:[10,20,30,40]},cx:10,cy:10,unit:1,zMin:10,exaggeration:1,hydro:{receiver:[2,-1,-1,-1]}});
 const nw=view.mapPoint(0),ne=view.mapPoint(1),sw=view.mapPoint(2);
 assert.ok(nw.z<0&&sw.z>0);assert.ok(ne.x>nw.x);assert.equal(view.mapPoint(0,1).z,sw.z);assert.equal(view.mapPoint(0,1).y,sw.y);
});
