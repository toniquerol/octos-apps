// Deterministic geometric streamlines. The velocity model is illustrative, not CFD.
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
  async function build(surface,{L,H,W,extent,precision='balanced',focus='all'},current=()=>true){
    const {tracks,steps}=modes[precision]||modes.balanced;
    const paths=new Float32Array(tracks*steps*3),centres=new Float32Array(tracks*3);
    let seed=71,repaired=0,stalled=0,rawSamples=0;
    const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
    const cols=Math.round(Math.sqrt(tracks*1.5)),rows=Math.ceil(tracks/cols);
    // Keep a small surface offset (about 3 cm for a 4.6 m vehicle), while retaining segment collision tests.
    const clearance=Math.max(L*.006,H*.018);
    const lo=-extent,hi=extent;
    // Surface-attached visual lanes sample real triangles (not the vehicle envelope).
    // They complement rather than alter the free-field illustrative velocity model.
    function surfaceLane(track){
      const kind=track%10,roof=kind<4,under=kind===8,side=!roof&&!under;
      const sign=kind<6?-1:1;
      const u=(track*.61803398875)%1;
      const laneZ=(u-.5)*W*(roof?1.02:.82);
      const laneY=.08+u*H*.86;
      const offsets=new Array(steps).fill(null);
      const base=roof?H+clearance:under?.035:sign*(W*.5+clearance);
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
      // Reserve approximately 55% of routes for roof, sides and underbody clearance.
      if(track<Math.floor(tracks*.62) && track%10!==9 && surfaceLane(track)){
        rawSamples+=steps;
        const mid=(track*steps+Math.floor(steps/2))*3;
        centres.set([paths[mid],paths[mid+1],paths[mid+2]],track*3);
        if(track%10===0)await pause();
        continue;
      }
      const col=track%cols,row=Math.floor(track/cols);
      // Sample the roof, sides and underbody more densely instead of wasting most streams in empty air.
      const y0=.035+(row+random()*.65)/rows*H*1.42;
      const z0=((col+random()*.65)/cols-.5)*W*(focus==='center'?.85:1.8);
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
        repaired++;
        // Safe fallback entirely above the bounding height, not a closed artificial envelope.
        for(let s=0;s<steps;s++){
          const k=(track*steps+s)*3;
          paths[k]=lo+(hi-lo)*s/(steps-1);paths[k+1]=H+clearance*5;paths[k+2]=z0;
        }
      }
      const mid=(track*steps+Math.floor(steps/2))*3;
      centres.set([paths[mid],paths[mid+1],paths[mid+2]],track*3);
      if(track%10===0)await pause();
    }
    return {paths,centres,tracks,steps,rawSamples,repaired,stalled,precision};
  }
  return {build,velocity,modes};
})();
