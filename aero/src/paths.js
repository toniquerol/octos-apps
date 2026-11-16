// Deterministic geometric streamlines. The velocity model is illustrative, not CFD.
// Shared emitter-plane limits. The emitter constrains only initial tracers, never CFD grid data.
const AeroEmitter = (() => {
  function bounds(width=2.6,height=2.0,focus='all') {
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<.2||height<.2||width>20||height>20)
      throw Error('El ancho y alto del emisor deben estar entre 0,2 y 20 metros.');
    const halfWidth=width*.5*(focus==='center'?.65:1);
    return {yMin:.035,yMax:height,zMin:-halfWidth,zMax:halfWidth};
  }
  function includes(b,y,z) {
    return y>=b.yMin-1e-5 && y<=b.yMax+1e-5 &&
      z>=b.zMin-1e-5 && z<=b.zMax+1e-5;
  }
  return {bounds,includes};
})();
// Conservative visual surface constraint. Keeps displayed paths outside real triangle
// surfaces; does not modify the supplied CFD velocities or assert a new CFD solution.
const AeroSurfaceGuard = (() => {
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
  function create(surface,{L,H,W,extent}){
    const clearance=Math.max(.035,Math.min(.09,L*.011));
    const approach=Math.max(.55,L*.34),xMin=-L*.5-approach,xMax=L*.5+clearance*3;
    const roofTop=H+Math.max(.7,extent*.35),sideEdge=Math.max(W*1.8,extent*.75);
    const hasProbe=typeof surface.closest==='function';
    const isSafe=(from,to)=>{
      if(surface.segment(from,to))return false;
      const near=hasProbe?surface.closest(to,clearance*.92):null;
      return !near||near.distance>=clearance*.92;
    };
    function step(from,desired,seedY,seedZ){
      if(!desired.every(Number.isFinite))return null;
      const x=desired[0];
      if(x<xMin||x>xMax) return isSafe(from,desired)?desired:null;
      // Probe the actual triangle skin, not an enclosing height/width envelope.
      const probeX=Math.max(-L*.5+.015,Math.min(L*.5-.015,x+Math.min(approach,L*.30)));
      const roof=surface.segment([probeX,roofTop,desired[2]],[probeX,-.2,desired[2]]);
      const sideSign=seedZ<0?-1:1;
      const side=surface.segment([probeX,desired[1],sideSign*sideEdge],
        [probeX,desired[1],-sideSign*sideEdge]);
      const needsRoof=!!roof && Math.abs(seedZ)<W*.39;
      const needsSide=!!side && !needsRoof;
      const blend=smooth((x-xMin)/approach);
      const topY=roof?roof.point[1]+clearance:null;
      const edgeZ=side?side.point[2]+sideSign*clearance:null;
      const alternatives=[];
      const add=p=>{if(p.every(Number.isFinite))alternatives.push(p);};
      // Prefer an existing valid trajectory when it already clears the model.
      let guided=desired.slice();
      if(needsRoof)guided[1]=Math.max(guided[1],seedY+(topY-seedY)*blend);
      else if(needsSide)guided[2]=sideSign*Math.max(sideSign*guided[2],
        sideSign*seedZ+(sideSign*edgeZ-sideSign*seedZ)*blend);
      add(guided);
      if(isSafe(from,guided))return guided;
      // Surface-following alternative candidates: leave at least a 3.5–9 cm
      // gap to the triangle skin; reject every crossing segment.
      if(roof){
        for(const extra of [0,clearance*.65,clearance*1.7,clearance*3]){
          add([x,Math.max(desired[1],topY+extra),desired[2]]);
          add([x,Math.max(from[1],topY+extra),from[2]]);
        }
      }
      if(side)for(const extra of [0,clearance,clearance*3]){
        add([x,desired[1],edgeZ+sideSign*extra]);
        add([x,from[1],edgeZ+sideSign*extra]);
      }
      // Try shorter forward steps to avoid jumping across a sharp bumper
      // or windscreen. If no candidate is collision-free, STOP the tracer.
      for(const factor of [1,.7,.4,.15]){
        for(const p of alternatives){
          const candidate=[from[0]+(p[0]-from[0])*factor,p[1],p[2]];
          if(candidate[0]<=from[0]+1e-7)continue;
          if(isSafe(from,candidate))return candidate;
        }
      }
      return null;
    }
    return {step,clearance};
  }
  return {create};
})();
const AeroPaths = (() => {
  const modes={low:{tracks:160,steps:192},balanced:{tracks:360,steps:288},fine:{tracks:640,steps:384}};
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  function velocity(at,surface,{H,L},preferred){
    // Limit the visual influence zone: the previous ~0.6 m radius produced wide, early deflections.
    const range=Math.max(H*.15,L*.045),probe=[at[0]+range*.60,at[1],at[2]];
    const near=surface.closest(probe,range*1.8);
    if(!near)return {direction:[1,0,0],distance:Infinity};
    let dy=probe[1]-near.point[1],dz=probe[2]-near.point[2];
    let lateral=Math.hypot(dy,dz);
    if(lateral<range*.025){dy=preferred===0?1:0;dz=preferred===0?0:preferred;lateral=1;}
    const strength=Math.max(0,1-near.distance/range);
    const multiplier=1.85*strength*strength;
    return {direction:[1,dy/lateral*multiplier,dz/lateral*multiplier],distance:near.distance};
  }
  async function build(surface,{L,H,W,extent,precision='balanced',focus='all',emitterWidth=2.6,emitterHeight=2.0},current=()=>true){
    const {tracks,steps}=modes[precision]||modes.balanced;
    const emitter=AeroEmitter.bounds(emitterWidth,emitterHeight,focus);
    const paths=new Float32Array(tracks*steps*3),centres=new Float32Array(tracks*3),inactive=new Uint8Array(tracks),validEnds=new Float32Array(tracks);
    let seed=71,repaired=0,stalled=0,rawSamples=0,surfaceAdjusted=0;
    const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const cols=Math.round(Math.sqrt(tracks*1.5)),rows=Math.ceil(tracks/cols);
    // Keep a small surface offset (about 3 cm for a 4.6 m vehicle), while retaining segment collision tests.
    const clearance=Math.max(L*.006,H*.018);
    const lo=-extent,hi=extent;
    const guard=AeroSurfaceGuard.create(surface,{L,H,W,extent});
    validEnds.fill(hi);
    // Surface-attached visual lanes sample real triangles (not the vehicle envelope).
    // They complement rather than alter the free-field illustrative velocity model.
    function surfaceLane(track,seedY,seedZ){
      const kind=track%10,roof=kind<4,under=kind===8,side=!roof&&!under;
      const sign=kind<6?-1:1;
      const laneZ=seedZ;
      const laneY=seedY;
      const offsets=new Array(steps).fill(null);
      for(let s=0;s<steps;s++){
        const x=lo+(hi-lo)*s/(steps-1);
        let hit;
        if(roof)hit=surface.segment([x,H+extent*.5,laneZ],[x,-extent*.5,laneZ]);
        else if(under)hit=surface.segment([x,-extent*.5,laneZ],[x,H+extent*.5,laneZ]);
        else hit=surface.segment([x,laneY,sign*extent*.8],[x,laneY,-sign*extent*.8]);
        if(hit){
          const coord=roof?hit.point[1]+clearance:under?hit.point[1]-clearance:hit.point[2]+sign*clearance;
          if(!under||coord>.025)offsets[s]=coord;
        }
      }
      let first=offsets.findIndex(v=>v!==null);
      if(first<0)return false;
      let previous=first;
      for(let s=0;s<first;s++)offsets[s]=offsets[first];
      for(let s=first+1;s<steps;s++)if(offsets[s]!==null){
        const delta=s-previous,a=offsets[previous],b=offsets[s];
        for(let k=previous+1;k<s;k++)offsets[k]=a+(b-a)*(k-previous)/delta;
        previous=s;
      }
      for(let s=previous+1;s<steps;s++)offsets[s]=offsets[previous];
      // If the surface-guided path begins outside the selected emitter, use the free path.
      const startY=roof?offsets[0]:under?Math.max(.025,offsets[0]):laneY;
      const startZ=roof||under?laneZ:offsets[0];
      if(!AeroEmitter.includes(emitter,startY,startZ))return false;
      for(let s=0;s<steps;s++){
        const x=lo+(hi-lo)*s/(steps-1);
        let pos=roof?[x,offsets[s],laneZ]:under?[x,Math.max(.025,offsets[s]),laneZ]:[x,laneY,offsets[s]];
        if(s>0){
          const k=(track*steps+s)*3;
          const from=[paths[k-3],paths[k-2],paths[k-1]];
          let amount=clearance;
          for(let attempt=0;attempt<18 && surface.segment(from,pos);attempt++,amount*=1.35){
            pos=roof?[x,offsets[s]+amount,laneZ]:
              under?[x,Math.max(.025,offsets[s]-amount),laneZ]:
              [x,laneY,offsets[s]+sign*amount];
          }
          if(surface.segment(from,pos))return false;
        }
        paths.set(pos,(track*steps+s)*3);
      }
      return true;
    }
    for(let track=0;track<tracks;track++){
      if(!current())return null;
      // Every trajectory begins within the plane Y:[0,height], Z:[-width/2,width/2].
      const col=track%cols,row=Math.floor(track/cols);
      const seedY=emitter.yMin+(row+random()*.65)/rows*(emitter.yMax-emitter.yMin);
      const seedZ=emitter.zMin+(col+random()*.65)/cols*(emitter.zMax-emitter.zMin);
      // Keep surface-attached paths only when their upstream seed fits the emitter.
      if(track<Math.floor(tracks*.62) && track%10!==9 && surfaceLane(track,seedY,seedZ)){
        rawSamples+=steps;
        const mid=(track*steps+Math.floor(steps/2))*3;
        centres.set([paths[mid],paths[mid+1],paths[mid+2]],track*3);
        if(track%10===0)await pause();
        continue;
      }
      // Free trajectories start from the same emitter, regardless of vehicle dimensions.
      const y0=seedY,z0=seedZ;
      const preferred=z0<-.05?-1:z0>.05?1:0;
      let here=[lo,y0,z0],raw=[here],iterations=0;
      while(here[0]<hi-1e-8 && iterations++<steps*6){
        const field=velocity(here,surface,{L,H},preferred);
        const nominal=2*extent/(steps*.69),nearFactor=Number.isFinite(field.distance)?Math.max(.27,Math.min(1,field.distance/(clearance*2.4))):1;
        const dx=Math.min(hi-here[0],nominal*nearFactor);
        let next=[here[0]+dx,Math.max(.025,here[1]+field.direction[1]*dx),here[2]+field.direction[2]*dx];
        const hit=surface.segment(here,next);
        if(hit){
          // Slide toward free space by taking short, segment-checked lateral steps.
          let accepted=false;
          for(let attempt=0;attempt<16;attempt++){
            const direction=attempt%4;
            const amount=clearance*(.4+Math.floor(attempt/4)*.4);
            const vy=direction===0?amount:direction===1?-amount:0;
            const vz=direction===2?amount:direction===3?-amount:0;
            const candidate=[here[0]+dx/(1+Math.floor(attempt/8)),Math.max(.025,here[1]+vy),here[2]+vz];
            if(!surface.segment(here,candidate) && (surface.closest(candidate,clearance*.17)?.distance??clearance) >=clearance*.17){next=candidate;accepted=true;break;}
          }
          if(!accepted){stalled++;break;}
        }
        if(next.every(Number.isFinite)){here=next;raw.push(next);}else{stalled++;break;}
      }
      rawSamples+=raw.length;
      validEnds[track]=raw[raw.length-1][0];
      // GPU samples are interpolated from adaptive segments and checked for skipped surfaces.
      let j=0,invalid=false;
      for(let s=0;s<steps;s++){
        const x=lo+(hi-lo)*s/(steps-1);
        while(j+1<raw.length-1 && raw[j+1][0]<x)j++;
        const a=raw[j],b=raw[Math.min(j+1,raw.length-1)];
        const t=Math.max(0,Math.min(1,(x-a[0])/Math.max(1e-10,b[0]-a[0])));
        const p=x>b[0]&&j===raw.length-2?b:[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
        const k=(track*steps+s)*3;
        paths.set(p,k);
        if(s>0&&surface.segment([paths[k-3],paths[k-2],paths[k-1]],p)){invalid=true;break;}
      }
      if(invalid){
        repaired++;inactive[track]=1;
        // Retain the seed position but hide an invalid path instead of emitting
        // a fake fallback lane outside the user-defined emitter rectangle.
        for(let s=0;s<steps;s++){
          const k=(track*steps+s)*3;
          paths[k]=lo;paths[k+1]=seedY;paths[k+2]=seedZ;
        }
      }
      const mid=(track*steps+Math.floor(steps/2))*3;
      centres.set([paths[mid],paths[mid+1],paths[mid+2]],track*3);
      if(track%10===0)await pause();
    }
    // Final collision/clearance pass AFTER re-sampling and BEFORE GPU atlas upload.
    // A completed trajectory must never enter the mesh, including through large
    // gaps between GPU samples. Invalid spans are hidden instead of frozen.
    for(let track=0;track<tracks;track++){
      if(!current())return null;
      if(inactive[track])continue;
      const base=track*steps*3;
      const seedY=paths[base+1],seedZ=paths[base+2];
      let previous=[paths[base],seedY,seedZ],stopAt=steps;
      for(let j=1;j<steps;j++){
        const k=base+j*3,proposed=[paths[k],paths[k+1],paths[k+2]];
        if(proposed[0]>validEnds[track]+1e-5){stopAt=j;break;}
        const corrected=guard.step(previous,proposed,seedY,seedZ);
        if(!corrected){stopAt=j;stalled++;break;}
        if(Math.hypot(corrected[0]-proposed[0],corrected[1]-proposed[1],corrected[2]-proposed[2])>1e-5)surfaceAdjusted++;
        paths.set(corrected,k);previous=corrected;
      }
      if(stopAt<steps){
        // Preserve the last free point for interpolation and set alpha=0 in the
        // entire remainder; previous code showed a stationary bright cluster.
        validEnds[track]=Math.min(validEnds[track],previous[0]);
        for(let j=stopAt;j<steps;j++){
          paths.set(previous,base+j*3);
        }
      }
    }
    // Procedural near-wake effect. This is a cinematic illustration, NOT a CFD solution.
    // The original triangle-safe lanes are retained around the body.
    const speeds=new Float32Array(tracks*steps),rear=L*.5+clearance*2;
    for(let track=0;track<tracks;track++){
      const phase=track*2.3999632297,swirl=track%2===0?1:-1;
      for(let s=0;s<steps;s++){
        if(inactive[track] || (s>0&&paths[(track*steps+s)*3]>=validEnds[track]-1e-6 && validEnds[track]<hi-1e-6)){speeds[track*steps+s]=0;continue;}
        const k=(track*steps+s)*3, x=paths[k], y=paths[k+1], z=paths[k+2];
        const downstream=Math.max(0,(x-rear)/L),wake=downstream>0&&downstream<2.2;
        if(wake){
          const radial=Math.exp(-Math.pow((y-H*.62)/(H*.95),2)-Math.pow(z/(W*.95),2));
          const envelope=(1-Math.exp(-downstream*8))*Math.exp(-downstream*1.4);
          const spin=downstream*11+phase;
          const amp=Math.min(H*.17,W*.15)*radial*envelope;
          const candidate=[x,Math.max(.026,y+amp*Math.cos(spin)),z+swirl*amp*Math.sin(spin)];
          const prev=s?[paths[k-3],paths[k-2],paths[k-1]]:candidate;
          if(!surface.segment(prev,candidate)){paths[k+1]=candidate[1];paths[k+2]=candidate[2];}
        }
        const closeRoof= Math.exp(-Math.pow((paths[k+1]-H)/(H*.35),2))*
                         Math.exp(-Math.pow(paths[k+2]/(W*.7),2));
        const bodyZone= Math.exp(-Math.pow(x/(L*.72),4));
        const wakeZone= wake?Math.exp(-Math.pow(downstream/.85,2))*
                               Math.exp(-Math.pow((paths[k+1]-H*.58)/H,2)-
                                        Math.pow(paths[k+2]/W,2)):0;
        speeds[track*steps+s]=Math.max(.12,Math.min(.99,.60+.33*closeRoof*bodyZone-.36*wakeZone+
          .055*Math.sin(x*2.1+phase)*wakeZone));
      }
    }
    return {paths,speeds,centres,tracks,steps,rawSamples,repaired,stalled,surfaceAdjusted,precision,physical:false};
  }
  return {build,velocity,modes};
})();
