/* OcToS GTA V1 · Modelos 3D ligeros; degradación a marcador si falla Three.js. */
function fallback(map, state, report) {
  const element = document.createElement('div');
  element.className = 'entity-fallback';
  element.setAttribute('aria-label', 'Personaje o vehículo');
  const marker = new window.maplibregl.Marker({element, anchor: 'bottom'})
    .setLngLat([state.lon, state.lat]).addTo(map);
  report('Modo ligero: marcador de jugador (modelos 3D no disponibles).', 'warn');
  return {
    update(next) {
      marker.setLngLat([next.lon, next.lat]);
      element.classList.toggle('car', next.mode === 'car');
    },
    destroy() { marker.remove(); }
  };
}

function buildCharacter(T) {
  const group = new T.Group();
  const fabric = new T.MeshLambertMaterial({color: 0xff6a1a});
  const trousers = new T.MeshLambertMaterial({color: 0x323740});
  const skin = new T.MeshLambertMaterial({color: 0xf2cda3});
  const shoes = new T.MeshLambertMaterial({color: 0x18191c});
  function cube(w, l, h, x, y, z, mat) {
    const mesh = new T.Mesh(new T.BoxGeometry(w,l,h), mat);
    mesh.position.set(x,y,z);group.add(mesh);
  }
  cube(.52,.30,.65,0,0,1.15,fabric);
  cube(.19,.22,.66,-.14,0,.49,trousers);
  cube(.19,.22,.66,.14,0,.49,trousers);
  cube(.19,.33,.12,-.14,.06,.1,shoes);
  cube(.19,.33,.12,.14,.06,.1,shoes);
  cube(.16,.23,.61,-.36,0,1.10,fabric);
  cube(.16,.23,.61,.36,0,1.10,fabric);
  // Altura total: 1,80 m sobre la superficie (1,62 + radio 0,18).
  const head = new T.Mesh(new T.SphereGeometry(.18,10,8), skin);
  head.position.set(0,0,1.62);group.add(head);
  const facing = new T.Mesh(new T.BoxGeometry(.11,.04,.045), shoes);
  facing.position.set(0,.18,1.64);group.add(facing);
  return group;
}

function buildCar(T) {
  const group = new T.Group();
  const body = new T.MeshLambertMaterial({color: 0xf1f1ef});
  const windows = new T.MeshLambertMaterial({color: 0x35495a});
  const tires = new T.MeshLambertMaterial({color: 0x151515});
  const headlamp = new T.MeshBasicMaterial({color: 0xffdc9c});
  const rear = new T.MeshBasicMaterial({color: 0xb52f2b});
  function cube(w,l,h,x,y,z,material) {
    const part = new T.Mesh(new T.BoxGeometry(w,l,h),material);
    part.position.set(x,y,z);group.add(part);
  }
  cube(1.78,4.10,.56,0,0,.64,body);
  cube(1.55,2.1,.60,0,-.17,1.16,windows);
  cube(1.55,1.15,.16,0,-.24,1.5,body);
  cube(1.42,.35,.14,0,1.66,.94,body);
  for (const x of [-.92,.92]) for (const y of [-1.27,1.25]) {
    const wheel = new T.Mesh(new T.CylinderGeometry(.35,.35,.2,12),tires);
    wheel.rotation.z = Math.PI/2;
    wheel.position.set(x,y,.36);
    group.add(wheel);
  }
  for (const x of [-.56,.56]) {
    cube(.35,.08,.18,x,2.07,.62,headlamp);
    cube(.37,.08,.18,x,-2.07,.62,rear);
  }
  return group;
}

export async function createActor(world, start, report) {
  const map = world.map;
  let T;
  try {
    T = await import('https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js');
  } catch (error) {
    console.warn('OcToS GTA · Three.js:', error);
    return fallback(map, start, report);
  }
  const scene = new T.Scene();
  const camera = new T.Camera();
  const sun = new T.DirectionalLight(0xffffff, 1.7);
  sun.position.set(-15,-10,35);
  scene.add(sun, new T.AmbientLight(0xffffff, 1.35));
  const character = buildCharacter(T);
  const car = buildCar(T);
  scene.add(character,car);
  const shadow = new T.Mesh(
    new T.CircleGeometry(1.3,16),
    new T.MeshBasicMaterial({color:0x101010,transparent:true,opacity:.34,depthWrite:false})
  );
  shadow.position.z=.06;
  scene.add(shadow);
  let state = {...start};
  let renderer = null;
  let disabled = false;
  let replacement = null;

  const layer = {
    id: 'octos-gta-actor',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer = new T.WebGLRenderer({canvas: map.getCanvas(), context:gl, antialias:false});
      renderer.autoClear = false;
    },
    render(gl, matrix) {
      if (disabled || !renderer) return;
      try {
        const z = world.elevation(state.lon,state.lat) ?? 0;
        const p = window.maplibregl.MercatorCoordinate.fromLngLat([state.lon,state.lat], z + .06);
        const scale = p.meterInMercatorCoordinateUnits();
        const transform = new T.Matrix4()
          .makeTranslation(p.x,p.y,p.z)
          .scale(new T.Vector3(scale,-scale,scale));
        camera.projectionMatrix = new T.Matrix4().fromArray(matrix).multiply(transform);
        character.visible = state.mode === 'walk';
        car.visible = state.mode === 'car';
        shadow.scale.set(state.mode === 'car' ? 1.3 : .42,state.mode === 'car' ? 2 : .42,1);
        character.rotation.z = -state.heading * Math.PI / 180;
        car.rotation.z = -state.heading * Math.PI / 180;
        renderer.resetState();
        renderer.render(scene,camera);
        renderer.resetState();
      } catch (error) {
        disabled = true;
        console.warn('OcToS GTA · capa de jugador:',error);
        queueMicrotask(() => {
          try { if (map.getLayer(layer.id)) map.removeLayer(layer.id); }
          catch {}
          replacement = fallback(map,state,report);
        });
      }
    }
  };
  try {
    map.addLayer(layer);
  } catch (error) {
    console.warn('OcToS GTA · modelo 3D:',error);
    return fallback(map,start,report);
  }
  return {
    update(next) {
      state = {...next};
      replacement?.update(next);
      if (!disabled) map.triggerRepaint();
    },
    destroy() {
      replacement?.destroy();
      try { if (map.getLayer(layer.id)) map.removeLayer(layer.id); } catch {}
      try { renderer?.dispose(); } catch {}
    }
  };
}
