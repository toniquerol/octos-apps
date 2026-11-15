// World-space triangle BVH. Geometric collision queries; no fluid dynamics.
const AeroGeometry = (() => {
  const pause = () => new Promise(resolve => setTimeout(resolve, 0));
  async function build(faces, current = () => true) {
    if (!faces.length) throw Error('El modelo no contiene triángulos válidos.');
    const ids = Array.from({ length: faces.length }, (_, i) => i), nodes = [];
    const tasks = [{ start: 0, end: ids.length, parent: -1, side: '' }];
    let processed = 0;
    while (tasks.length) {
      if (!current()) return null;
      const job = tasks.pop(), {start, end} = job;
      const bb = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      const cc = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
      for (let i = start; i < end; i++) {
        const f = faces[ids[i]];
        for (let axis = 0; axis < 3; axis++) {
          const lo = Math.min(f[axis], f[axis+3], f[axis+6]), hi = Math.max(f[axis], f[axis+3], f[axis+6]);
          bb[axis] = Math.min(bb[axis], lo); bb[axis+3] = Math.max(bb[axis+3], hi);
          const c = (f[axis]+f[axis+3]+f[axis+6])/3;
          cc[axis] = Math.min(cc[axis],c); cc[axis+3] = Math.max(cc[axis+3],c);
        }
      }
      const node = {bb,start,end,left:-1,right:-1}, n = nodes.push(node)-1;
      if (job.parent >= 0) nodes[job.parent][job.side] = n;
      if (end-start > 12) {
        let axis = 0;
        if (cc[4]-cc[1] > cc[3]-cc[0]) axis=1;
        if (cc[5]-cc[2] > cc[axis+3]-cc[axis]) axis=2;
        const pivot = (cc[axis]+cc[axis+3])/2;
        let i=start,j=end-1;
        while(i<=j){
          const f=faces[ids[i]],center=(f[axis]+f[axis+3]+f[axis+6])/3;
          if (center < pivot) i++; else {const temp=ids[i];ids[i]=ids[j];ids[j]=temp;j--;}
        }
        const cut = i>start && i<end ? i : start+Math.floor((end-start)/2);
        tasks.push({start:cut,end,parent:n,side:'right'}, {start,end:cut,parent:n,side:'left'});
      }
      if (++processed % 256 === 0) await pause();
    }
    const T=THREE,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),p=new T.Vector3(),q=new T.Vector3();
    const triangle=new T.Triangle(),ray=new T.Ray(),hit=new T.Vector3();
    function setFace(f){a.set(f[0],f[1],f[2]);b.set(f[3],f[4],f[5]);c.set(f[6],f[7],f[8]);triangle.set(a,b,c);}
    function boxDistance2(bb,x,y,z){let d=0;for(let k=0;k<3;k++){const v=k===0?x:k===1?y:z;const h=v<bb[k]?bb[k]-v:v>bb[k+3]?v-bb[k+3]:0;d+=h*h;}return d;}
    function closest(point,maxDistance=Infinity){
      const x=point[0],y=point[1],z=point[2];p.set(x,y,z);
      let dist2=maxDistance*maxDistance, best=null;const stack=[0];
      while(stack.length){const id=stack.pop(),node=nodes[id];if(boxDistance2(node.bb,x,y,z)>dist2)continue;
        if(node.left<0){for(let j=node.start;j<node.end;j++){
          setFace(faces[ids[j]]);triangle.closestPointToPoint(p,q);
          const d=q.distanceToSquared(p);if(d<dist2){dist2=d;best=[q.x,q.y,q.z];}
        }}else{
          const l=nodes[node.left],r=nodes[node.right];
          const dl=boxDistance2(l.bb,x,y,z),dr=boxDistance2(r.bb,x,y,z);
          if(dl<dr){if(dr<=dist2)stack.push(node.right);if(dl<=dist2)stack.push(node.left);}
          else{if(dl<=dist2)stack.push(node.left);if(dr<=dist2)stack.push(node.right);}
        }
      }
      return best?{point:best,distance:Math.sqrt(dist2)}:null;
    }
    function overlaps(bb,lo,hi){return bb[0]<=hi[0]&&bb[3]>=lo[0]&&bb[1]<=hi[1]&&bb[4]>=lo[1]&&bb[5]>=lo[2]&&bb[2]<=hi[2];}
    function segment(from,to){
      const delta=new T.Vector3(to[0]-from[0],to[1]-from[1],to[2]-from[2]);
      const len=delta.length();if(len<1e-9)return null;
      const tol=Math.min(len*.01,1e-5);delta.divideScalar(len);
      ray.origin.set(from[0]+delta.x*tol,from[1]+delta.y*tol,from[2]+delta.z*tol);ray.direction.copy(delta);
      const lo=[Math.min(from[0],to[0])-tol,Math.min(from[1],to[1])-tol,Math.min(from[2],to[2])-tol];
      const hi=[Math.max(from[0],to[0])+tol,Math.max(from[1],to[1])+tol,Math.max(from[2],to[2])+tol];
      const stack=[0];let best=null,bestDistance=len+tol;
      while(stack.length){const node=nodes[stack.pop()];if(!overlaps(node.bb,lo,hi))continue;
        if(node.left<0){for(let i=node.start;i<node.end;i++){
          setFace(faces[ids[i]]);if(!ray.intersectTriangle(a,b,c,false,hit))continue;
          const d=hit.distanceTo(ray.origin)+tol;
          if(d>=tol && d<=len+tol && d<bestDistance){bestDistance=d;best={point:[hit.x,hit.y,hit.z],distance:d,face:ids[i]};}
        }}else{stack.push(node.left,node.right);}
      }
      return best;
    }
    // Edge counts are diagnostics; separate overlapping submeshes can be falsely marked open.
    let openEdges=null;
    if(faces.length<=90000){
      const edges=new Map();let max=1;
      for(const f of faces)for(const v of f)max=Math.max(max,Math.abs(v));
      const unit=max*1e-5;
      const key=(f,j)=>[0,1,2].map(k=>Math.round(f[j+k]/unit)).join(',');
      for(let i=0;i<faces.length;i++){
        const f=faces[i],v=[key(f,0),key(f,3),key(f,6)];
        for(let j=0;j<3;j++){
          const k=v[j]<v[(j+1)%3]?v[j]+'|'+v[(j+1)%3]:v[(j+1)%3]+'|'+v[j];
          edges.set(k,(edges.get(k)||0)+1);
        }
        if(i%10000===0){if(!current())return null;await pause();}
      }
      openEdges=0;for(const count of edges.values())if(count===1)openEdges++;
    }
    return {triangles:faces.length,openEdges,closest,segment,dispose(){faces.length=0;nodes.length=0;ids.length=0;}};
  }
  async function fromObject(root,current=()=>true){
    const faces=[],a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
    root.updateMatrixWorld(true);
    const meshes=[];root.traverse(o=>{if(o.isMesh&&o.visible&&o.geometry?.attributes?.position)meshes.push(o);});
    let count=0;
    for(const mesh of meshes){
      const pos=mesh.geometry.attributes.position,idx=mesh.geometry.index;
      const len=idx?idx.count:pos.count;
      for(let k=0;k+2<len;k+=3){
        a.fromBufferAttribute(pos,idx?idx.getX(k):k).applyMatrix4(mesh.matrixWorld);
        b.fromBufferAttribute(pos,idx?idx.getX(k+1):k+1).applyMatrix4(mesh.matrixWorld);
        c.fromBufferAttribute(pos,idx?idx.getX(k+2):k+2).applyMatrix4(mesh.matrixWorld);
        if(Number.isFinite(a.x+a.y+a.z+b.x+b.y+b.z+c.x+c.y+c.z)&&new THREE.Triangle(a,b,c).getArea()>1e-12){
          faces.push([a.x,a.y,a.z,b.x,b.y,b.z,c.x,c.y,c.z]);
        }
        if(++count%4096===0){if(!current())return null;await pause();}
      }
    }
    if(!current())return null;
    return build(faces,current);
  }
  return {build,fromObject};
})();
