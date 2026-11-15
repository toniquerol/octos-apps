/* OcToS Roads · control de orientación 3D personalizable (GLB local) */
(() => {
  'use strict';
  const DB_NAME='octos-roads-nav3d-v1', STORE='preferences', KEY='custom', MAX_SIZE=25*1024*1024;
  const defaults=()=>({x:0,y:0,z:0,scale:1,size:92});
  let settings=defaults(), map=null, renderer=null, scene=null, camera=null, THREE=null, root=null;
  let buffer=null, filename='', database=null, loadId=0, saveTimer=0, restored=false;
  const host=document.getElementById('mapWrap');
  if(!host)return;
  const widget=document.createElement('div');
  widget.className='octos-nav3d';
  widget.hidden=true;
  widget.innerHTML=[
    '<div class="octos-nav3d-head">',
    '<button type="button" class="octos-nav3d-preview" aria-label="Orientar al norte. Arrastrar para rotar el modelo" title="Pulsar: norte · arrastrar: orientar modelo" hidden><canvas aria-hidden="true"></canvas><span class="octos-nav3d-north">N</span></button>',
    '<button type="button" class="octos-nav3d-toggle" aria-expanded="false" title="Personalizar icono 3D" aria-label="Personalizar icono de navegación 3D">3D <span>⚙</span></button>',
    '</div>',
    '<section class="octos-nav3d-panel" hidden aria-label="Personalización del icono de navegación">',
    '<div class="octos-nav3d-title">ICONO DE NAVEGACIÓN 3D</div>',
    '<label class="octos-nav3d-file">Importar modelo GLB<input type="file" accept=".glb,model/gltf-binary" aria-label="Seleccionar archivo GLB"></label>',
    '<div class="octos-nav3d-name">Sin GLB · brújula estándar activa</div>',
    '<div class="octos-nav3d-sliders"></div>',
    '<div class="octos-nav3d-actions"><button type="button" data-action="reset">Restablecer ajustes</button><button type="button" data-action="remove">Quitar GLB</button></div>',
    '<p class="octos-nav3d-status" aria-live="polite">Orientación relativa a la cámara del mapa. Configuración conservada en este navegador.</p>',
    '</section>'
  ].join('');
  host.append(widget);
  const find=(selector)=>widget.querySelector(selector);
  const preview=find('.octos-nav3d-preview');
  const canvas=find('canvas');
  const panel=find('.octos-nav3d-panel');
  const toggle=find('.octos-nav3d-toggle');
  const file=find('input[type="file"]');
  const status=find('.octos-nav3d-status');
  const name=find('.octos-nav3d-name');
  const descriptions=[
    ['x','Rotación X','°',-180,180,1],
    ['y','Rotación Y','°',-180,180,1],
    ['z','Rotación Z','°',-180,180,1],
    ['scale','Escala del modelo','×',.2,2.5,.05],
    ['size','Tamaño del icono','px',52,144,2]
  ];
  const sliders=find('.octos-nav3d-sliders');
  descriptions.forEach(([key,title,unit,min,max,step])=>{
    const label=document.createElement('label');
    label.className='octos-nav3d-slider';
    const head=document.createElement('span'),input=document.createElement('input'),output=document.createElement('output');
    head.textContent=title;
    input.type='range';input.min=min;input.max=max;input.step=step;input.dataset.setting=key;
    output.dataset.value=key;
    label.append(head,output,input);sliders.append(label);
    input.addEventListener('input',()=>{
      settings[key]=Math.min(max,Math.max(min,Number(input.value)));
      updateInputs();draw();scheduleSave();
    });
  });
  const statusMessage=(message,error=false)=>{status.textContent=message;status.classList.toggle('error',error);};
  const updateInputs=()=>{
    for(const [key,,unit] of descriptions){
      find('[data-setting="'+key+'"]').value=String(settings[key]);
      find('[data-value="'+key+'"]').textContent=(key==='scale'?Number(settings[key]).toFixed(2):Math.round(settings[key]))+' '+unit;
    }
    widget.style.setProperty('--octos-nav3d-size',Math.round(settings.size)+'px');
    if(renderer)renderer.setSize(Math.round(settings.size),Math.round(settings.size),false);
  };
  updateInputs();
  toggle.addEventListener('click',()=>{
    panel.hidden=!panel.hidden;
    toggle.setAttribute('aria-expanded',String(!panel.hidden));
  });
  const openDB=()=>new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(Error('IndexedDB no disponible'));return;}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||Error('No se pudo abrir el almacenamiento'));
  });
  async function databaseHandle(){
    if(!database)database=await openDB().catch(e=>{database=null;throw e;});
    return database;
  }
  async function storeRecord(value){
    const db=await databaseHandle();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readwrite');
      const object=transaction.objectStore(STORE);
      if(value)object.put(value,KEY);else object.delete(KEY);
      transaction.oncomplete=()=>resolve();
      transaction.onerror=()=>reject(transaction.error||Error('No se pudo guardar el GLB'));
    });
  }
  async function restoreRecord(){
    const db=await databaseHandle();
    return new Promise((resolve,reject)=>{
      const transaction=db.transaction(STORE,'readonly');
      const request=transaction.objectStore(STORE).get(KEY);
      request.onsuccess=()=>resolve(request.result||null);
      request.onerror=()=>reject(request.error||Error('No se pudo recuperar el GLB'));
    });
  }
  function scheduleSave(){
    clearTimeout(saveTimer);
    if(!buffer)return;
    saveTimer=setTimeout(()=>storeRecord({buffer,name:filename,settings:{...settings}}).catch(()=>{
      statusMessage('Modelo activo. No se ha podido conservar en este navegador.',true);
    }),250);
  }
  function validateGLB(data){
    if(data.byteLength<20||data.byteLength>MAX_SIZE)throw Error('El GLB debe medir entre 20 bytes y 25 MB.');
    const view=new DataView(data);
    if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.byteLength)
      throw Error('Archivo GLB 2.0 no válido.');
    let meta=null;
    for(let offset=12;offset+8<=view.byteLength;){
      const length=view.getUint32(offset,true),kind=view.getUint32(offset+4,true);
      if(offset+8+length>view.byteLength)throw Error('GLB incompleto.');
      if(kind===0x4e4f534a)meta=JSON.parse(new TextDecoder().decode(new Uint8Array(data,offset+8,length)));
      offset+=8+length;
    }
    if(!meta)throw Error('Falta el contenido glTF del archivo.');
    for(const item of [...(meta.buffers||[]),...(meta.images||[])]){
      if(item.uri&&!item.uri.startsWith('data:'))throw Error('El GLB debe incluir sus recursos y texturas incrustados.');
    }
    if((meta.extensionsRequired||[]).some(x=>/draco|meshopt|basisu/i.test(x)))
      throw Error('Exporta el GLB sin DRACO, Meshopt o KTX2.');
  }
  async function ensureThree(){
    if(THREE)return THREE;
    const three=await import('three');
    const loaders=await import('three/addons/loaders/GLTFLoader.js');
    THREE={...three,GLTFLoader:loaders.GLTFLoader};
    return THREE;
  }
  function disposeModel(){
    if(!root)return;
    root.traverse(node=>{
      if(node.geometry)node.geometry.dispose();
      if(node.material)for(const material of [node.material].flat()){
        for(const entry of Object.values(material))if(entry&&entry.isTexture)entry.dispose();
        material.dispose();
      }
    });
    scene?.remove(root);root=null;
  }
  function setupRenderer(){
    if(renderer)return;
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(39,1,.05,100);
    scene.add(new THREE.HemisphereLight(0xffffff,0x566477,2.1));
    const sun=new THREE.DirectionalLight(0xffffff,2.6);
    sun.position.set(3,5,4);scene.add(sun);
    renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    updateInputs();
  }
  function draw(){
    if(!root||!map||!renderer)return;
    const radians=Math.PI/180;
    root.rotation.set(settings.x*radians,(settings.y+map.getBearing())*radians,settings.z*radians,'XYZ');
    root.scale.setScalar(settings.scale);
    const pitch=Math.max(0,Math.min(85,map.getPitch()))*radians;
    camera.position.set(0,3.7*Math.cos(pitch),3.7*Math.sin(pitch)+.0001);
    camera.up.set(0,0,-1);
    camera.lookAt(0,0,0);
    renderer.render(scene,camera);
  }
  async function loadGLB(data,label,restoreSettings=null){
    const current=++loadId;
    validateGLB(data);
    const three=await ensureThree();
    const loader=new three.GLTFLoader();
    loader.manager.setURLModifier(url=>{
      if(/^(data:|blob:)/i.test(url))return url;
      throw Error('Referencia externa bloqueada: el GLB debe estar completo.');
    });
    const parsed=await loader.parseAsync(data,'');
    const object=parsed.scene;
    const box=new three.Box3().setFromObject(object),measure=box.getSize(new three.Vector3());
    const largest=Math.max(measure.x,measure.y,measure.z);
    if(box.isEmpty()||!Number.isFinite(largest)||largest<=.000001)throw Error('El GLB no contiene una malla visible.');
    if(current!==loadId)return;
    disposeModel();
    setupRenderer();
    const center=box.getCenter(new three.Vector3());
    object.position.sub(center);
    const normalizer=new three.Group();
    normalizer.add(object);
    normalizer.scale.setScalar(1.45/largest);
    root=new three.Group();
    root.add(normalizer);
    scene.add(root);
    buffer=data;filename=label;
    settings={...defaults(),...(restoreSettings||{})};
    for(const [key,, ,min,max] of descriptions){
      settings[key]=Math.max(min,Math.min(max,Number(settings[key])||((key==='scale'||key==='size')?defaults()[key]:0)));
    }
    name.textContent=label;
    preview.hidden=false;
    host.classList.add('octos-nav3d-custom');
    updateInputs();draw();
  }
  async function restore(){
    if(restored)return;
    restored=true;
    const initial=loadId;
    try{
      const item=await restoreRecord();
      if(item&&item.buffer&&loadId===initial){
        await loadGLB(item.buffer,item.name||'Modelo guardado',item.settings||{});
        statusMessage('Modelo recuperado. Orientación y escala guardadas.');
      }
    }catch(e){
      statusMessage('No se pudo recuperar el modelo guardado: '+e.message,true);
    }
  }
  file.addEventListener('change',async()=>{
    const selected=file.files?.[0];file.value='';
    if(!selected)return;
    if(!selected.name.toLowerCase().endsWith('.glb')){
      statusMessage('Selecciona un archivo con extensión .glb.',true);return;
    }
    if(selected.size>MAX_SIZE){statusMessage('Tamaño máximo del archivo: 25 MB.',true);return;}
    statusMessage('Validando el archivo GLB…');
    try{
      const data=await selected.arrayBuffer();
      await loadGLB(data,selected.name);
      try{clearTimeout(saveTimer);await storeRecord({buffer:data,name:selected.name,settings:{...settings}});
        statusMessage('Modelo GLB importado y guardado en este navegador.');
      }catch(e){statusMessage('Modelo cargado. No se pudo guardar permanentemente: '+e.message,true);}
    }catch(e){statusMessage('No se pudo importar el GLB: '+e.message,true);}
  });
  find('[data-action="reset"]').addEventListener('click',()=>{
    settings=defaults();updateInputs();draw();scheduleSave();
    statusMessage('Orientación, escala y tamaño restablecidos.');
  });
  find('[data-action="remove"]').addEventListener('click',async()=>{
    clearTimeout(saveTimer);++loadId;disposeModel();buffer=null;filename='';
    settings=defaults();updateInputs();preview.hidden=true;
    host.classList.remove('octos-nav3d-custom');
    name.textContent='Sin GLB · brújula estándar activa';
    try{await storeRecord(null);statusMessage('Modelo eliminado. Brújula original restaurada.');}
    catch(e){statusMessage('El icono se ha quitado, pero no se ha podido borrar el GLB guardado.',true);}
  });
  let drag=null;
  preview.addEventListener('pointerdown',event=>{
    if(!root)return;
    drag={x:event.clientX,y:event.clientY,baseX:settings.x,baseY:settings.y,moved:false};
    preview.setPointerCapture(event.pointerId);
  });
  preview.addEventListener('pointermove',event=>{
    if(!drag)return;
    const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
    if(Math.abs(dx)+Math.abs(dy)>4)drag.moved=true;
    if(!drag.moved)return;
    settings.y=Math.max(-180,Math.min(180,Math.round(drag.baseY+dx*.85)));
    settings.x=Math.max(-180,Math.min(180,Math.round(drag.baseX+dy*.85)));
    updateInputs();draw();
  });
  preview.addEventListener('pointerup',()=>{
    if(!drag)return;
    const moved=drag.moved;drag=null;
    if(moved)scheduleSave();else map?.easeTo({bearing:0,duration:350});
  });
  preview.addEventListener('pointercancel',()=>{drag=null;});
  function attach(next){
    if(map){
      map.off('rotate',draw);map.off('pitch',draw);
    }
    map=next||null;
    widget.hidden=!map;
    if(!map){panel.hidden=true;toggle.setAttribute('aria-expanded','false');return;}
    map.on('rotate',draw);map.on('pitch',draw);
    restore();draw();
  }
  window.addEventListener('octos:terrain-map',event=>attach(event.detail?.map||null));
  window.addEventListener('resize',draw);
})();