// Structured CFD velocity volumes; imported data are never computed by this viewer.
// OCTOS-CFD-V1: uniform Cartesian grid in scene metres, velocities in m/s.
// Index: (((z * ny) + y) * nx + x) * 3; X varies fastest.
const AeroCFD = (() => {
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  function parse(input) {
    const data = typeof input === 'string' ? JSON.parse(input) : input;
    if (!data || data.format !== 'octos-cfd-v1') throw Error('Formato incorrecto: se requiere octos-cfd-v1.');
    const dims = data.dimensions, origin = data.origin, spacing = data.spacing;
    if (![dims,origin,spacing].every(Array.isArray) ||
        dims.length !== 3 || origin.length !== 3 || spacing.length !== 3)
      throw Error('El campo necesita dimensions, origin y spacing [x,y,z].');
    if (!dims.every(v=>Number.isInteger(v)&&v>=2&&v<=512) ||
        dims[0]*dims[1]*dims[2]>2000000)
      throw Error('Dimensiones de rejilla no válidas o superiores a 2 millones de celdas.');
    if (![...origin,...spacing].every(Number.isFinite) || !spacing.every(v=>v>0))
      throw Error('Origen o separación de rejilla no válidos.');
    if (data.units !== 'm/s') throw Error('Las velocidades CFD deben expresarse en m/s.');
    const expected = dims[0]*dims[1]*dims[2]*3;
    if (!Array.isArray(data.velocity) || data.velocity.length !== expected)
      throw Error('velocity debe contener tres componentes por nodo (orden X, Y, Z).');
    const velocity = Float32Array.from(data.velocity);
    let max=0;
    for (let i=0;i<velocity.length;i+=3) {
      const x=velocity[i],y=velocity[i+1],z=velocity[i+2];
      if (![x,y,z].every(Number.isFinite)) throw Error('El campo contiene velocidades no finitas.');
      max=Math.max(max,Math.hypot(x,y,z));
    }
    if (max<1e-5) throw Error('El campo CFD no contiene velocidades distintas de cero.');
    const maxSpeed = data.displayMaxSpeed === undefined ? max : Number(data.displayMaxSpeed);
    if (!Number.isFinite(maxSpeed) || maxSpeed <= 0) throw Error('displayMaxSpeed debe ser positivo.');
    const referenceSpeed = data.referenceSpeed === undefined ? max*.65 : Number(data.referenceSpeed);
    if (!Number.isFinite(referenceSpeed) || referenceSpeed <= 0) throw Error('referenceSpeed debe ser positivo.');
    function sample(p) {
      const f=p.map((v,i)=>(v-origin[i])/spacing[i]);
      if (f.some((v,i)=>v<0||v>dims[i]-1)) return null;
      const lo=f.map((v,i)=>Math.min(dims[i]-2,Math.floor(v)));
      const t=f.map((v,i)=>v-lo[i]);
      const out=[0,0,0], nx=dims[0],ny=dims[1];
      for(let dz=0;dz<=1;dz++)for(let dy=0;dy<=1;dy++)for(let dx=0;dx<=1;dx++){
        const w=(dx?t[0]:1-t[0])*(dy?t[1]:1-t[1])*(dz?t[2]:1-t[2]);
        const k=(((lo[2]+dz)*ny+(lo[1]+dy))*nx+lo[0]+dx)*3;
        for(let c=0;c<3;c++)out[c]+=velocity[k+c]*w;
      }
      return out;
    }
    const bounds=origin.map((v,i)=>[v,v+(dims[i]-1)*spacing[i]]);
    return {dims,origin,spacing,velocity,maxSpeed,displayMaxSpeed:maxSpeed,
      referenceSpeed,bounds,source:String(data.source||'Campo CFD importado').slice(0,100),sample};
  }
  async function build(field,surface,{L,H,W,extent,precision='balanced',focus='all',emitterWidth=2.6,emitterHeight=2.0},current=()=>true){
    const {tracks,steps}=AeroPaths.modes[precision]||AeroPaths.modes.balanced;
    const paths=new Float32Array(tracks*steps*3),speeds=new Float32Array(tracks*steps);
    const x0=Math.max(-extent,field.bounds[0][0]+field.spacing[0]);
    if(x0>=-L*.5) throw Error('El campo debe incluir el aire aguas arriba del vehículo (−X).');
    const xEnd=Math.min(extent,field.bounds[0][1]-field.spacing[0]);
    if(xEnd<L*.5) throw Error('La rejilla termina antes de la parte posterior del vehículo.');
    // Intersect the user-defined emitter plane with the existing CFD coverage.
    // Neither grid origin, spacing, dimensions nor imported velocity values change.
    const emitter=AeroEmitter.bounds(emitterWidth,emitterHeight,focus);
    const yMin=Math.max(field.bounds[1][0]+field.spacing[1]*.5,emitter.yMin);
    const yMax=Math.min(field.bounds[1][1]-field.spacing[1]*.5,emitter.yMax);
    const zMin=Math.max(field.bounds[2][0]+field.spacing[2]*.5,emitter.zMin);
    const zMax=Math.min(field.bounds[2][1]-field.spacing[2]*.5,emitter.zMax);
    if(yMax<=yMin||zMax<=zMin) throw Error('El campo CFD no cubre el plano emisor seleccionado.');
    const dt=(xEnd-x0)/(steps-1)/Math.max(field.referenceSpeed,0.05);
    let seed=173,rawSamples=0,stalled=0;
    const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const cols=Math.max(1,Math.round(Math.sqrt(tracks*1.3))),rows=Math.ceil(tracks/cols);
    const add=(p,v,m)=>[p[0]+v[0]*m,p[1]+v[1]*m,p[2]+v[2]*m];
    for(let i=0;i<tracks;i++){
      if(!current()) return null;
      const col=i%cols,row=Math.floor(i/cols);
      const z=zMin+(col+.12+random()*.76)/cols*(zMax-zMin);
      const y=yMin+(row+.12+random()*.76)/rows*(yMax-yMin);
      let p=[x0,y,z],active=true;
      for(let s=0;s<steps;s++){
        const idx=i*steps+s,k=idx*3;
        paths.set(p,k);
        if(!active){speeds[idx]=0;continue;}
        const a=field.sample(p);
        if(!a){speeds[idx]=0;active=false;stalled++;continue;}
        const mag=Math.hypot(...a);
        speeds[idx]=Math.min(1,mag/field.displayMaxSpeed);
        rawSamples++;
        if(s===steps-1||mag<.01){active=false;continue;}
        // RK4 temporal advection on the measured/interpolated velocity field.
        const b=field.sample(add(p,a,dt*.5));
        const c=b&&field.sample(add(p,b,dt*.5));
        const d=c&&field.sample(add(p,c,dt));
        if(!b||!c||!d){active=false;continue;}
        const q=p.map((v,j)=>v+dt*(a[j]+2*b[j]+2*c[j]+d[j])/6);
        if(q.some(v=>!Number.isFinite(v))||surface.segment(p,q)){
          active=false;stalled++;continue;
        }
        p=q;
      }
      if(i%12===0)await pause();
    }
    return {paths,speeds,tracks,steps,precision,rawSamples,repaired:0,stalled,physical:true,
      displayMaxSpeed:field.displayMaxSpeed};
  }
  return {parse,build};
})();
