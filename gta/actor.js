/* OcToS GTA · personaje y BMW E46 independientes sobre la misma capa 3D. */
import {loadBMW} from './vehicle.js?v=2';
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
  // La geometría exacta del prototipo se carga sin crear otro renderizador.
  const vehicle=await loadBMW(T);
  const car=vehicle.group;
  scene.add(character,car);
  const shadow = new T.Mesh(
    new T.CircleGeometry(1.3,16),
    new T.MeshBasicMaterial({color:0x101010,transparent:true,opacity:.34,depthWrite:false})
  );
  shadow.position.z=.06;
  scene.add(shadow);
  const carShadow=new T.Mesh(
    new T.CircleGeometry(1,24),
    new T.MeshBasicMaterial({color:0x101010,transparent:true,opacity:.28,depthWrite:false})
  );
  carShadow.scale.set(1.25,2.35,1);
  carShadow.position.z=.018;
  scene.add(carShadow);
  let state = {...start};
  let renderer = null;
  let disabled = false;
  let replacement = null;

  const layer = {
    id: 'octos-gta-actor',
    type: 'custom',
    renderingMode: '3d',
    onAdd(_map, gl) {
      renderer?.dispose();
      renderer = new T.WebGLRenderer({canvas: map.getCanvas(), context:gl, antialias:false});
      renderer.autoClear = false;
    },
    onRemove() {
      renderer?.dispose();
      renderer = null;
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
        shadow.visible=character.visible;
        shadow.scale.set(.42,.42,1);
        character.rotation.z = -state.heading * Math.PI / 180;
        const vehicleLocation=state.vehicle;
        car.visible=carShadow.visible=!!vehicleLocation;
        if (vehicleLocation) {
          const carHeight=world.elevation(vehicleLocation.lon,vehicleLocation.lat) ?? z;
          const vp=window.maplibregl.MercatorCoordinate.fromLngLat(
            [vehicleLocation.lon,vehicleLocation.lat],carHeight+.06
          );
          car.position.set((vp.x-p.x)/scale,-(vp.y-p.y)/scale,(vp.z-p.z)/scale);
          car.rotation.z=-vehicleLocation.heading*Math.PI/180;
          carShadow.position.set(car.position.x,car.position.y,car.position.z+.018);
          vehicle.update(state.drive?.steer||0,state.drive?.spin||0,state.drive?.rearSpin??state.drive?.spin??0);
        }
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
    rebind() {
      // La geometría y la misma instancia Three.js sobreviven al cambio de estilo.
      if (disabled || map.getLayer(layer.id)) return;
      try { map.addLayer(layer); map.triggerRepaint(); }
      catch (error) { console.warn('OcToS GTA · restaurar jugador 3D:',error); }
    },
    destroy() {
      replacement?.destroy();
      try { if (map.getLayer(layer.id)) map.removeLayer(layer.id); } catch {}
      try { renderer?.dispose(); } catch {}
      vehicle.dispose();
    }
  };
}
