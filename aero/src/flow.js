// GPU tracers: immutable path atlas, small soft sprites and tapered line trails.
// This is a visual transport renderer, not a fluid solver.
const AeroFlow = (() => {
  const T = THREE;
  const vertex = `
    uniform sampler2D atlas;
    uniform vec2 atlasSize;
    uniform float time, size, pixelRatio, trailLength, modelLength, opacity, spectrum, cutActive, cutX;
    uniform vec3 tint;
    attribute float track, phase, rate, age;
    varying float alpha;
    varying vec3 color;
    varying float speedMetric;
    varying float worldX;
    vec4 samplePath(float t) {
      float s = clamp(t, 0.0, 1.0) * (atlasSize.x - 1.0);
      float j = floor(s);
      vec2 uv = vec2((j + 0.5) / atlasSize.x, (track + 0.5) / atlasSize.y);
      vec4 a = texture2D(atlas, uv);
      vec4 b = texture2D(atlas, vec2(min(j + 1.5, atlasSize.x - 0.5) / atlasSize.x, uv.y));
      return mix(a, b, fract(s));
    }
    vec3 spectrumColor(float v){
      v=clamp(v,0.0,1.0);
      vec3 blue=vec3(.035,.16,.76),cyan=vec3(.03,.83,.94),green=vec3(.14,.91,.41);
      vec3 yellow=vec3(1.0,.79,.15),red=vec3(1.0,.19,.09);
      if(v<.25)return mix(blue,cyan,smoothstep(0.,.25,v));
      if(v<.50)return mix(cyan,green,smoothstep(.25,.50,v));
      if(v<.75)return mix(green,yellow,smoothstep(.50,.75,v));
      return mix(yellow,red,smoothstep(.75,1.,v));
    }
    void main() {
      float head = fract(phase + time * 0.072 * rate);
      float t = head - age * trailLength;
      vec4 data = samplePath(t);
      worldX = data.x;
      vec4 mv = modelViewMatrix * vec4(data.xyz, 1.0);
      gl_Position = projectionMatrix * mv;
      float perspectiveScale = projectionMatrix[3][3] == 0.0 ? clamp(modelLength * 2.0 / max(-mv.z, 0.001), 0.65, 1.25) : 1.0;
      gl_PointSize = clamp(size * pixelRatio * perspectiveScale, 1.0, 3.2 * pixelRatio);
      float fade = smoothstep(0.0, 0.045, t) * (1.0 - smoothstep(0.94, 1.0, t));
      speedMetric = data.w;
      alpha = fade * pow(1.0 - age, 1.6) * opacity * step(0.0, t) * step(0.00001, data.w);
      vec3 classic=mix(tint, vec3(1.0, 0.48, 0.19), step(0.94, fract(track * 0.381966)) * 0.8);
      color = mix(classic,spectrumColor(data.w),spectrum);
    }`;
  const pointFragment = `varying float alpha; varying vec3 color; varying float worldX;
    uniform float cutActive, cutX;
    void main(){if(cutActive>0.5 && worldX<cutX)discard;
      vec2 p=gl_PointCoord*2.0-1.0;float d=dot(p,p);if(d>1.0)discard;
      gl_FragColor=vec4(color,alpha*exp(-2.4*d)*(1.0-smoothstep(0.65,1.0,d)));}`;
  const trailFragment = `varying float alpha; varying vec3 color; varying float worldX;
    uniform float cutActive, cutX;
    void main(){if(cutActive>0.5 && worldX<cutX)discard;
      gl_FragColor=vec4(color,alpha*0.38);}`;

  function create(paths, tracks, steps, count, length, pixelRatio, selection=null, speeds=null) {
    const rgba = new Float32Array(tracks * steps * 4);
    for (let i=0; i<tracks*steps; i++) {
      rgba.set(paths.subarray(i*3,i*3+3),i*4);
      rgba[i*4+3]=speeds ? Math.max(0,Math.min(1,speeds[i])) : .65;
    }
    const atlas = new T.DataTexture(rgba,steps,tracks,T.RGBAFormat,T.FloatType);
    atlas.needsUpdate=true;
    const uniforms={atlas:{value:atlas},atlasSize:{value:new T.Vector2(steps,tracks)},time:{value:0},size:{value:1.6},pixelRatio:{value:pixelRatio},trailLength:{value:.018},modelLength:{value:length},opacity:{value:.82},spectrum:{value:0},cutActive:{value:0},cutX:{value:0},tint:{value:new T.Color(0xb8e9ec)}};
    function geometry(n,trail) {
      const stride=trail?6:1, total=n*stride, g=new T.BufferGeometry();
      const track=new Float32Array(total),phase=new Float32Array(total),rate=new Float32Array(total),age=new Float32Array(total);
      for(let i=0;i<n;i++) for(let j=0;j<stride;j++) {
        const k=i*stride+j;
        track[k]=selection?.length?selection[i%selection.length]:i%tracks;
        phase[k]=(i*.61803398875)%1;
        rate[k]=.86+((i*73)%101)/101*.25;
        age[k]=trail?[0,1/3,1/3,2/3,2/3,1][j]:0;
      }
      g.setAttribute('position',new T.BufferAttribute(new Float32Array(total*3),3));
      for(const [name,data] of Object.entries({track,phase,rate,age}))g.setAttribute(name,new T.BufferAttribute(data,1));
      return g;
    }
    function material(fragment){return new T.ShaderMaterial({uniforms,vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,depthTest:true,toneMapped:false});}
    const points=new T.Points(geometry(count,false),material(pointFragment));
    const trails=new T.LineSegments(geometry(count,true),material(trailFragment));
    points.frustumCulled=trails.frustumCulled=false;
    const group=new T.Group();group.add(trails,points);
    return {group,points,trails,uniforms,count,
      setTime(t){uniforms.time.value=t;},
      setClip(active,x){uniforms.cutActive.value=active?1:0;uniforms.cutX.value=x;},
      configure({size,trailLength,opacity,color,mode}){
        uniforms.size.value=size;uniforms.trailLength.value=trailLength;uniforms.opacity.value=opacity;
        uniforms.spectrum.value=color==='velocity'?1:0;
        uniforms.tint.value.set(color==='velocity'?'#b8e9ec':color);
        points.visible=mode!=='trails';trails.visible=mode!=='points';
      },
      dispose(){atlas.dispose();points.geometry.dispose();points.material.dispose();trails.geometry.dispose();trails.material.dispose();}
    };
  }
  return {create};
})();
