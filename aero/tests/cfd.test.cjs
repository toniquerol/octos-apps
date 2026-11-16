const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const ctx={console,setTimeout,clearTimeout};
vm.createContext(ctx);
vm.runInContext(js.slice(0,js.indexOf("(()=>{'use strict';"))+'\nglobalThis.CFD=AeroCFD;globalThis.Geo=AeroGeometry;globalThis.T=THREE;',ctx);
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
  // Changing emitter dimensions changes *seeds*, not the imported CFD grid.
  const originalSpacing=Array.from(field.spacing),originalDims=Array.from(field.dims);
  const narrower=await ctx.CFD.build(field,{segment:()=>null},{
    L:4,H:2,W:2,extent:4,precision:'low',emitterWidth:1.2,emitterHeight:.9});
  assert.notEqual(narrower.paths[1],result.paths[1]);
  for(let i=0;i<narrower.tracks;i++){
    const k=i*narrower.steps*3;
    assert(narrower.paths[k+1]>=.034&&narrower.paths[k+1]<=.901,'seed Y outside emitter');
    assert(Math.abs(narrower.paths[k+2])<=.601,'seed Z outside emitter');
  }
  assert.deepEqual(Array.from(field.spacing),originalSpacing);
  assert.deepEqual(Array.from(field.dims),originalDims);
  assert.throws(()=>ctx.CFD.parse({...make(),spacing:[0,1,1]}));

  // A constant straight CFD vector crosses this solid car. The display-only
  // geometric correction must go around it instead of running through it.
  const model=new ctx.T.Group(),box=new ctx.T.Mesh(
    new ctx.T.BoxGeometry(4,1.4,1.8),new ctx.T.MeshBasicMaterial());
  box.position.set(0,.8,0);model.add(box);
  const surface=await ctx.Geo.fromObject(model);
  const before=Array.from(field.velocity);
  const constrained=await ctx.CFD.build(field,surface,{L:4,H:1.5,W:1.8,extent:4,precision:'low'});
  assert(constrained.physical&&constrained.surfaceAdjusted>0,
    'straight CFD flow must be visually redirected near body');
  let activeSteps=0;
  for(let track=0;track<constrained.tracks;track++)for(let step=1;step<constrained.steps;step++){
    const i=track*constrained.steps+step,k=i*3;
    if(constrained.speeds[i]<=0)continue;
    const from=[...constrained.paths.slice(k-3,k)];
    const to=[...constrained.paths.slice(k,k+3)];
    assert(!surface.segment(from,to),'CFD renderer path crosses triangle shell');
    assert(!(Math.abs(to[0])<1.99&&to[1]>.11&&to[1]<1.49&&Math.abs(to[2])<.89),
      'CFD renderer path entered the solid vehicle interior');
    activeSteps++;
  }
  assert(activeSteps>5000,'surface correction cannot remove most CFD particles');
  assert.deepEqual(Array.from(field.velocity),before,'never mutate imported CFD field');
  surface.dispose();
  console.log('PASS: CFD interpolation, RK4, mesh-aware visible surface flow and immutable original CFD grid.');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
