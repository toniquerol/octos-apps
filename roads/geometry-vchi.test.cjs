'use strict';
/* Run with: node --test roads/geometry-vchi.test.cjs */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const context={window:{},console};
vm.runInNewContext(fs.readFileSync(__dirname+'/geometry-vchi.js','utf8'),context,{filename:'geometry-vchi.js'});
const api=context.window.OcToSRoadGeometry;
const xy=p=>({x:p[1]*100000,y:p[0]*100000}),ll=p=>[p.y/100000,p.x/100000];
const section={lanes:2,laneWidth:3.5,roadWidth:7};
const road=(nodes,speed=60,radius=150,transitionMode='auto')=>({nodes,speed,radius,transitionMode,normProfile:'vchi',superelevation:.04,wheelbase:6});
const build=r=>api.build(r,xy,ll,section);
const epsilon=(a,b,d=.01)=>assert.ok(Math.abs(a-b)<d,'Expected '+a+' ≈ '+b);
test('VCHI 8.2.2 radius table, 4% / 6%',()=>{
 assert.equal(api.minimumRadius(50,.04),100);
 assert.equal(api.minimumRadius(50,.06),90);
 assert.equal(api.minimumRadius(80,.04),280);
 assert.equal(api.minimumRadius(80,.06),250);
});
test('VCHI 8.2 minimum 30 m clothoid length',()=>assert.ok(api.requiredSpiral(60,150)>=30));
test('straight road without radius preserves polyline',()=>{
 const g=build(road([[0,0],[0,.01]],60,0));
 assert.equal(g.parts.length,1);assert.equal(g.minRadius,null);
});
test('three control points make tangential circular arc',()=>{
 const g=build(road([[0,0],[0,.005],[.005,.005]],50,100));
 assert.ok(g.curves.length===1);
 assert.ok(g.parts.some(p=>p.kind==='arc'));
});
test('long enough 90 degree curve contains true clothoid pair',()=>{
 const g=build(road([[0,0],[0,.01],[.01,.01]],60,150));
 assert.deepEqual(Array.from(g.parts,p=>p.kind),['straight','clothoid-entry','arc','clothoid-exit','straight']);
 epsilon(g.curves[0].radius,150);
 assert.ok(g.curves[0].transition>30);
});
test('the generated segments remain connected and finite',()=>{
 const g=build(road([[0,0],[0,.01],[.01,.01],[.01,.02]],70,300));
 for(let i=1;i<g.parts.length;i++){
  const p=g.parts[i-1].points.at(-1),q=g.parts[i].points[0];
  epsilon(p[0],q[0],1e-9);epsilon(p[1],q[1],1e-9);
 }
 assert.ok(g.parts.every(p=>p.length>=0&&p.points.every(q=>q.every(Number.isFinite))));
});
test('widening ramp starts and ends at baseline',()=>{
 const g=build(road([[0,0],[0,.01],[.01,.01]],60,150));
 const entry=g.parts.find(p=>p.kind==='clothoid-entry'),exit=g.parts.find(p=>p.kind==='clothoid-exit');
 epsilon(entry.wideningProfile[0],0);
 epsilon(exit.wideningProfile.at(-1),0);
 assert.ok(entry.widening>0);
});
test('tight curve creates diagnostics without silently claiming compliance',()=>{
 const r=road([[0,0],[0,.005],[.005,.005]],90,160),g=build(r),d=api.inspect(r,g,section);
 assert.ok(d.warnings.length>=1);
 assert.ok(d.checks.some(c=>c.state==='unknown'));
});
test('3.1-IC reserved independently without invented limits',()=>{
 const r={...road([[0,0],[0,.005],[.005,.005]]),normProfile:'es31ic'};
 const d=api.inspect(r,build(r),section);
 assert.equal(d.checks[0].state,'unknown');
});
