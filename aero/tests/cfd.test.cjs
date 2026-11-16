const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const ctx={console,setTimeout,clearTimeout};
vm.createContext(ctx);
vm.runInContext(js.slice(0,js.indexOf("(()=>{'use strict';"))+'\nglobalThis.CFD=AeroCFD;',ctx);
const dims=[9,5,5],velocity=[];
for(let z=0;z<dims[2];z++)for(let y=0;y<dims[1];y++)for(let x=0;x<dims[0];x++)
  velocity.push(12,0,0);
const make=()=>({format:'octos-cfd-v1',units:'m/s',origin:[-4,0,-2],spacing:[1,1,1],dimensions:dims,
  referenceSpeed:12,displayMaxSpeed:20,source:'Test CFD',velocity});
const field=ctx.CFD.parse(JSON.stringify(make()));
assert.equal(field.sample([0,2,0])[0],12);
assert.equal(field.sample([-4,0,-2])[0],12);
assert.equal(field.sample([5,2,0]),null);
assert.equal(field.maxSpeed,20);
for(const bad of [
  {...make(),velocity:[1,2,3]},
  {...make(),units:'km/h'},
  {...make(),dimensions:[-1,2,3]},
  {...make(),spacing:[1,0,1]},
  {...make(),origin:[NaN,0,0]}
])assert.throws(()=>ctx.CFD.parse(bad));
async function run(){
  const result=await ctx.CFD.build(field,{segment:()=>null},{L:4,H:2,W:2,extent:4,precision:'low'});
  assert(result.physical);
  assert.equal(result.tracks,160);assert.equal(result.steps,192);
  assert.equal(result.paths.length,160*192*3);
  assert.equal(result.speeds.length,160*192);
  assert(result.speeds[0]>.59&&result.speeds[0]<.61);
  assert(Array.from(result.paths).every(Number.isFinite));
  assert(Array.from(result.speeds).every(v=>Number.isFinite(v)&&v>=0&&v<=1));
  assert(result.rawSamples>160*100);
  console.log('PASS: CFD uniform grid validation, trilinear samples, finite RK4 trajectories and speed atlas.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
