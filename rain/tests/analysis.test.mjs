import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze,trace,watershed} from '../js/hydrology.js';
import {grade} from '../js/grading.js';
const dem=(fn,w=7,h=7)=>({width:w,height:h,dx:2,dy:3,data:Float64Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w)))});
function integrity(d){const h=analyze(d);let valid=0,total=0;for(let i=0;i<d.data.length;i++){if(!Number.isFinite(d.data[i]))continue;valid++;const t=trace(h,i,d);assert.ok(t.indices.length<=d.data.length);if(h.receiver[i]<0)total+=h.accumulation[i];}assert.equal(total,valid*d.dx*d.dy);return h;}
test('uniform slope drains down and conserves contributing area',()=>{const d=dem((x,y)=>100-x*2-y*3),h=integrity(d);assert.equal(h.receiver[24],32);assert.equal(h.depth[24],0);assert.ok(trace(h,24,d).drop>0);});
test('V valley converges into thalweg',()=>{const d=dem((x,y)=>10*Math.abs(x-3)+20-y),h=integrity(d);assert.ok(h.accumulation[45]>h.accumulation[43]);});
test('separated basins do not cross the divide',()=>{const d=dem((x,y)=>20-Math.abs(x-3)*5-y),h=integrity(d);const left=watershed(h,42,d),right=watershed(h,48,d);for(let i=0;i<49;i++)assert.ok(!(left.mask[i]&&right.mask[i]));assert.ok(left.area>6&&right.area>6);});
test('closed depression fills to spill elevation',()=>{const d=dem((x,y)=>x===3&&y===3?0:10),h=integrity(d);assert.equal(h.depth[24],10);assert.equal(h.filled[24],10);});
test('flat terrain routes without cycles',()=>{const d=dem(()=>7),h=integrity(d);assert.equal(h.depth[24],0);assert.ok(trace(h,24,d).indices.length>1);});
test('NoData stays invalid and defines open boundary',()=>{const d=dem((x,y)=>x===3&&y===3?NaN:10),h=integrity(d);assert.ok(Number.isNaN(h.accumulation[24]));assert.equal(h.receiver[24],-1);assert.throws(()=>trace(h,24,d));});
test('flow towards edge has clipped watershed',()=>{const d=dem(x=>10-x),h=integrity(d),w=watershed(h,6,d);assert.ok(w.clipped);assert.ok(w.area>=6);});
test('fixed surface has exact cut volume',()=>{const d=dem(()=>10,4,3),r=grade(d,new Uint8Array(12).fill(1),{mode:'fixed',elevation:8});assert.equal(r.stats.cut,144);assert.equal(r.stats.fill,0);assert.equal(r.stats.area,72);});
test('inclined plane and best fit reproduce known surface',()=>{const d=dem((x,y)=>20+.1*(x+.5)*2-.2*(y+.5)*3),mask=new Uint8Array(49).fill(1),r=grade(d,mask,{mode:'bestfit'});assert.ok(Math.abs(r.plane.a-.1)<1e-10);assert.ok(Math.abs(r.plane.b-.2)<1e-10);assert.ok(r.stats.cut+r.stats.fill<1e-8);const flat=dem(()=>10),s=grade(flat,mask,{mode:'inclined',elevation:10,slope:10,bearing:90});assert.ok(Math.abs(s.surface[25]-s.surface[24]-.2)<1e-10);});
test('known cut/fill and balance volumes',()=>{const d=dem(x=>x<2?8:12,4,4),mask=new Uint8Array(16).fill(1),r=grade(d,mask,{mode:'fixed',elevation:10});assert.equal(r.stats.cut,96);assert.equal(r.stats.fill,96);assert.equal(r.stats.balance,0);const b=grade(d,mask,{mode:'balance',slope:3,bearing:25});assert.ok(Math.abs(b.stats.balance)<1e-9);});
