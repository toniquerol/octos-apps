const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const context={console};vm.createContext(context);
vm.runInContext(js.slice(0,js.indexOf("(()=>{'use strict';")),context);
vm.runInContext(`
  const tracks=3,steps=5,p=new Float32Array(tracks*steps*3);
  for(let i=0;i<tracks*steps;i++){p[i*3]=i%steps;p[i*3+1]=1;p[i*3+2]=Math.floor(i/steps);}
  globalThis.subject=AeroFlow.create(p,tracks,steps,24000,4.5,1.25);
`,context);
const flow=context.subject,geo=flow.points.geometry;
assert.equal(geo.attributes.position.count,24000);
assert.equal(flow.trails.geometry.attributes.position.count,144000);
const snapshot=Array.from(geo.attributes.phase.array);
flow.setTime(120);
assert.equal(flow.uniforms.time.value,120);
assert.deepEqual(Array.from(geo.attributes.phase.array),snapshot,'animation must not rewrite particle buffers');
assert.equal(flow.uniforms.atlas.value.image.data.length,3*5*4);
assert(Array.from(flow.uniforms.atlas.value.image.data).every(Number.isFinite));
flow.configure({size:1.2,trailLength:.03,opacity:.6,color:'#ffb16d',mode:'trails'});
assert.equal(flow.points.visible,false);assert.equal(flow.trails.visible,true);
flow.configure({size:1.5,trailLength:.02,opacity:.8,color:'#b8e9ec',mode:'points'});
assert.equal(flow.points.visible,true);assert.equal(flow.trails.visible,false);
let released=0;
for(const resource of [flow.uniforms.atlas.value,flow.points.geometry,flow.points.material,flow.trails.geometry,flow.trails.material])resource.addEventListener('dispose',()=>released++);
flow.dispose();assert.equal(released,5);
console.log('PASS: 24.000 particles / 144.000 trail vertices, immutable animation buffers, atlas, modes and GPU resource disposal.');
