import assert from 'node:assert/strict';
import {contours} from '../js/contours.js';
const d={width:3,height:3,dx:2,dy:2,x0:100,y0:200,data:Float64Array.from([0,2,4,0,2,4,0,2,4])};
const segments=contours(d,1);
assert.ok(segments.length>0);
for(const s of segments)for(const p of s.coordinates){assert.ok(Math.abs((p[0]-101)-s.elevation)<1e-12);assert.ok(p[1]>=195&&p[1]<=199);}
assert.equal(contours({...d,data:new Float64Array(9).fill(10)},2).length,0);
assert.equal(contours({...d,data:new Float64Array(9).fill(NaN)},2).length,0);
assert.throws(()=>contours(d,0),/positivo/);
assert.throws(()=>contours(d,.1,{maxSegments:1}),/Demasiadas|segmentos/);
const saddle=contours({width:2,height:2,dx:1,dy:1,x0:0,y0:2,data:Float64Array.from([1,-1,-1,1])},1).filter(s=>s.elevation===0);
assert.equal(saddle.length,2);
console.log('Marching-squares planar, flat, NoData, cap and saddle tests passed.');
