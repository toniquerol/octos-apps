const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const js=html.slice(html.indexOf('<script>')+8,html.lastIndexOf('</script>'));
const ctx={console,setTimeout,clearTimeout};vm.createContext(ctx);
vm.runInContext(js.slice(0,js.indexOf("(()=>{'use strict';"))+
  '\nglobalThis.geometry=AeroGeometry;globalThis.planner=AeroPaths;globalThis.T=THREE;',ctx);
const {geometry,planner,T}=ctx;
const box=(root,x,y,z,w,h,d)=>{const obj=new T.Mesh(new T.BoxGeometry(w,h,d),new T.MeshBasicMaterial());obj.position.set(x,y,z);root.add(obj);};
async function run(){
  const opening=new T.Group();
  // Solid four-sided frame normal to X, with a genuine hole through its centre.
  box(opening,0,.32,0,.5,.64,4);
  box(opening,0,2.68,0,.5,.64,4);
  box(opening,0,1.5,-1.5,.5,1.72,1);
  box(opening,0,1.5,1.5,.5,1.72,1);
  box(opening,.4,.7,1.92,.35,.3,.15); // asymmetric feature
  const surface=await geometry.fromObject(opening);
  assert.equal(surface.triangles,60);
  assert.equal(surface.openEdges,0);
  assert.equal(surface.segment([-2,1.5,0],[2,1.5,0]),null,'opening must not be sealed');
  assert(surface.segment([-2,.3,0],[2,.3,0]),'solid base must block segment');
  assert(surface.segment([-2,1.5,1.5],[2,1.5,1.5]),'side wall must block segment');
  assert(surface.closest([0,1.5,0]).distance>.4,'distance must resolve actual void');
  // Regression: diversion begins close to the surface, not a metre away.
  const nearRoof=planner.velocity([0,3.05,0],surface,{H:3,L:4},0);
  const farRoof=planner.velocity([0,3.70,0],surface,{H:3,L:4},0);
  assert(nearRoof.direction[1]>.2,'streamlines must turn near roof');
  assert(Math.abs(farRoof.direction[1])<1e-7,'streamlines must not deflect far above roof');
  const car=new T.Group();
  box(car,0,.82,0,4.4,1.4,1.85);
  const carSurface=await geometry.fromObject(car);
  const closePaths=await planner.build(carSurface,{L:4.4,H:1.52,W:1.85,extent:7.3,precision:'balanced'});
  let closeRoof=0,closeSides=0,blocked=0;
  for(let track=0;track<closePaths.tracks;track++){
    for(let s=1;s<closePaths.steps;s++){
      const k=(track*closePaths.steps+s)*3;
      const prev=[...closePaths.paths.slice(k-3,k)],point=[...closePaths.paths.slice(k,k+3)];
      assert(!carSurface.segment(prev,point),'closer tracers must not penetrate the car');
      if(Math.abs(point[0])<.09){
        const d=carSurface.closest(point,.16);
        if(d&&d.distance<.16){
          if(point[1]>1.52)closeRoof++;
          if(Math.abs(point[2])>.925)closeSides++;
        }
      }
    }
  }
  assert(closeRoof+closeSides>=5,'car needs near-surface tracers on roof or sides');
  assert(closePaths.stalled<closePaths.tracks*.3,'reducing offset must not stall most trajectories');
  const narrowPaths=await planner.build(carSurface,{L:4.4,H:1.52,W:1.85,extent:7.3,
    precision:'low',emitterWidth:1.2,emitterHeight:.85});
  for(let track=0;track<narrowPaths.tracks;track++){
    const k=track*narrowPaths.steps*3;
    assert(narrowPaths.paths[k+1]>=.034&&narrowPaths.paths[k+1]<=.851,'illustrative seed Y outside emitter');
    assert(Math.abs(narrowPaths.paths[k+2])<=.601,'illustrative seed Z outside emitter');
  }
  console.log('PROXIMITY: roof='+closeRoof+' side='+closeSides+' stalled='+closePaths.stalled+'/'+closePaths.tracks);
  carSurface.dispose();
  const t0=Date.now();
  const low=await planner.build(surface,{L:4,H:3,W:4,extent:6,precision:'low',focus:'all'});
  assert.equal(low.tracks,160);assert.equal(low.steps,192);
  const high=await planner.build(surface,{L:4,H:3,W:4,extent:6,precision:'fine',focus:'all'});
  assert.equal(high.tracks,640);assert.equal(high.steps,384);
  assert(high.rawSamples>low.rawSamples,'precision must change raw integration');
  for(const data of [low,high])for(let track=0;track<data.tracks;track++)
    for(let s=1;s<data.steps;s++){
      const k=(track*data.steps+s)*3,prev=[...data.paths.slice(k-3,k)],next=[...data.paths.slice(k,k+3)];
      assert(!surface.segment(prev,next),'resampled segment penetrates geometry: '+track+','+s);
    }
  const lowAgain=await planner.build(surface,{L:4,H:3,W:4,extent:6,precision:'low',focus:'all'});
  assert.deepStrictEqual(Array.from(lowAgain.paths),Array.from(low.paths),'path field must be deterministic');
  const scanMs=Date.now()-t0;
  const open=new T.Group();open.add(new T.Mesh(new T.PlaneGeometry(2,2),new T.MeshBasicMaterial()));
  const openSurface=await geometry.fromObject(open);assert(openSurface.openEdges>0);
  assert(openSurface.segment([0,0,-2],[0,0,2]));
  openSurface.dispose();
  const scaled=new T.Group();box(scaled,0,0,0,2,1,4);scaled.rotation.y=Math.PI/2;scaled.scale.set(1.5,2,1);
  const transformed=await geometry.fromObject(scaled);
  assert(transformed.segment([-3,0,0],[3,0,0]),'rotated/scaled bounds need a new BVH');
  assert(transformed.closest([0,4,0]).distance>2);
  transformed.dispose();surface.dispose();
  console.log('PASS: BVH, real opening, asymmetry, open mesh warning, world rotation/scale, interpolated path safety, deterministic trajectories, adaptive precision. '+scanMs+' ms');
}
run().catch(e=>{console.error(e);process.exitCode=1;});
