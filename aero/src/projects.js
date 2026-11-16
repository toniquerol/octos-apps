/* OcToS Aero · Phase 1: lightweight, portable project manifests. */
const AeroProjects=(()=>{
  'use strict';
  const FORMAT='octos-aero-project-v1', KEY='octos-aero-projects-v1';
  const $=id=>document.getElementById(id);
  let current=null,assetPending=false,homeVisible=true;
  const uniqueId=()=>typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():
    'aero-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,10);
  const str=(s,max=140)=>typeof s==='string'?s.slice(0,max):'';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const finite3=(v,def)=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<100000)?v.slice():def.slice();
  const readCache=()=>{try{const list=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(list)?list.slice(0,30):[];}catch{return [];}};
  function makeProject(name){
    const now=new Date().toISOString();
    return {format:FORMAT,id:uniqueId(),name:str(name.trim())||'Proyecto sin título',
      createdAt:now,updatedAt:now,preview:null,vehicle:{name:'Concepto de demostración',fileRef:null,unit:'m'},
      transformations:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],lengthMeters:4.5,coordinateSystem:'X / longitudinal, Y / vertical, Z / transversal'},
      cfd:{configuration:null,fieldRef:null},results:[],viewer:{controls:{},viewModes:['3d'],section:null}};
  }
  function validated(data){
    if(!data||data.format!==FORMAT||typeof data.id!=='string'||!data.id||
       typeof data.name!=='string'||!data.name.trim()||data.name.length>140)
      throw Error('Formato de proyecto OcToS Aero no válido.');
    if(!data.vehicle||typeof data.vehicle!=='object'||!data.transformations||
       typeof data.transformations!=='object'||!data.viewer||typeof data.viewer!=='object')
      throw Error('El proyecto está incompleto.');
    const p=makeProject(data.name);
    p.id=str(data.id,140);p.createdAt=str(data.createdAt,40)||p.createdAt;
    p.updatedAt=str(data.updatedAt,40)||p.updatedAt;
    p.preview=typeof data.preview==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data.preview)&&data.preview.length<180000?data.preview:null;
    p.vehicle={name:str(data.vehicle.name)||'Concepto de demostración',
      fileRef:str(data.vehicle.fileRef)||null,unit:'m'};
    const t=data.transformations;
    p.transformations={position:finite3(t.position,[0,0,0]),rotation:finite3(t.rotation,[0,0,0]),
      scale:finite3(t.scale,[1,1,1]).map(n=>n>0&&n<=10000?n:1),
      lengthMeters:Number.isFinite(t.lengthMeters)&&t.lengthMeters>.01&&t.lengthMeters<1000?t.lengthMeters:4.5,
      coordinateSystem:'X / longitudinal, Y / vertical, Z / transversal'};
    const cfd=data.cfd||{};
    p.cfd={configuration:cfd.configuration&&typeof cfd.configuration==='object'?copy(cfd.configuration):null,
      fieldRef:str(cfd.fieldRef)||null};
    p.results=Array.isArray(data.results)?data.results.slice(0,200).filter(x=>x&&typeof x==='object').map(x=>({
      fileRef:str(x.fileRef),source:str(x.source),referenceSpeed:Number.isFinite(x.referenceSpeed)?x.referenceSpeed:null,
      dimensions:finite3(x.dimensions,[0,0,0])})).filter(x=>x.fileRef):[];
    const v=data.viewer;
    const controls=v.controls&&typeof v.controls==='object'?v.controls:{};
    const names=['quality','precision','flowmode','pointsize','trail','opacity','palette','focus',
      'speed','layout','lines','tunnel','body','grid','emitterWidth','emitterHeight','emitterOffsetY',
      'emitterOffsetZ','emitterShow'];
    p.viewer.controls={};
    for(const key of names){
      const value=controls[key];
      if(typeof value==='string'&&value.length<32||typeof value==='boolean')p.viewer.controls[key]=value;
    }
    p.viewer.viewModes=Array.isArray(v.viewModes)?v.viewModes.slice(0,4).filter(x=>['3d','side','top','front','section'].includes(x)):['3d'];
    p.viewer.section=v.section&&['x','y','z'].includes(v.section.axis)&&Number.isFinite(v.section.value)?
      {axis:v.section.axis,value:v.section.value,enabled:v.section.enabled===true}:null;
    return p;
  }
  function message(value,problem=false){$('projectMessage').textContent=value;$('projectMessage').style.color=problem?'#ff9b7d':'#aeb1ba';}
  function showHome(){
    homeVisible=true;$('projectHome').hidden=false;
    $('projectHomeButton').setAttribute('aria-expanded','true');refresh();
  }
  function showViewer(){
    homeVisible=false;$('projectHome').hidden=true;
    $('projectHomeButton').setAttribute('aria-expanded','false');
    $('projectActiveName').textContent=current?current.name:'Visor sin proyecto';
    window.dispatchEvent(new Event('resize'));
  }
  function cacheProject(project){
    try{
      const list=readCache().filter(p=>p.id!==project.id);
      list.unshift(copy(project));localStorage.setItem(KEY,JSON.stringify(list.slice(0,20)));
      return true;
    }catch{return false;}
  }
  function refresh(){
    $('projectActiveName').textContent=current?current.name:'Visor sin proyecto';
    $('projectName').value=current?current.name:'Proyecto sin título';
    $('projectSave').disabled=!current;
    $('projectSaveAs').disabled=!current;
    $('projectHeaderSave').disabled=!current;
    const list=$('projectRecent');list.textContent='';
    const saved=readCache();
    $('projectRecentCount').textContent=saved.length+' proyectos';
    if(!saved.length){const div=document.createElement('p');div.className='project-empty';div.textContent='Todavía no hay proyectos guardados en este navegador.';list.append(div);}
    for(const project of saved){
      const card=document.createElement('article');card.className='project-card';
      const open=document.createElement('button');open.type='button';open.className='project-card-open';
      open.setAttribute('aria-label','Abrir proyecto '+str(project.name));
      open.addEventListener('click',()=>activate(project));
      const visual=document.createElement('span');visual.className='project-card-visual';
      if(typeof project.preview==='string'&&/^data:image\/jpeg;base64,/.test(project.preview)&&project.preview.length<180000){
        const img=document.createElement('img');img.src=project.preview;img.alt='';img.loading='lazy';
        visual.append(img);
      }else{
        const empty=document.createElement('span');empty.className='project-card-placeholder';
        empty.textContent='OcToS / AERO';visual.append(empty);
      }
      const details=document.createElement('span');details.className='project-card-details';
      const title=document.createElement('strong');title.textContent=str(project.name);
      const vehicle=document.createElement('small');vehicle.textContent=str(project.vehicle?.name)||'Sin vehículo';
      const date=document.createElement('small');date.className='project-card-date';
      const timestamp=Date.parse(project.updatedAt);
      date.textContent=Number.isFinite(timestamp)?new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short',year:'numeric'}).format(timestamp):'Proyecto guardado';
      details.append(title,vehicle,date);open.append(visual,details);card.append(open);list.append(card);
    }
    if(!$('projectLibraryPanel').hidden)renderLibrary();
  }
  function renderLibrary(){
    const panel=$('projectLibraryList');panel.textContent='';
    const projects=current?[current]:readCache();
    let found=0;
    for(const project of projects){
      const results=Array.isArray(project.results)?project.results:[];
      for(const item of results){
        if(!item.fileRef)continue;found++;
        const row=document.createElement('div');row.className='project-recent-item';
        const details=document.createElement('div');details.className='project-recent-title';
        const name=document.createElement('strong');name.textContent=str(item.fileRef);
        const description=document.createElement('small');
        description.textContent=project.name+' · '+(item.source||'Campo CFD referenciado');
        details.append(name,description);row.append(details);panel.append(row);
      }
    }
    if(!found){const blank=document.createElement('p');blank.className='project-empty';
      blank.textContent='No hay resultados CFD referenciados. Se incorporarán al guardar un proyecto con un JSON cargado en el visor.';
      panel.append(blank);}
  }
  function snapshot(){
    if(!current)return;
    const state=window.aeroProjectBridge?.snapshot?.();
    if(!state)return;
    if(!assetPending||state.vehicle.name!=='Concepto de demostración'){
      current.vehicle=state.vehicle;current.transformations=state.transformations;assetPending=false;
    }
    current.viewer=state.viewer;
    if(state.preview)current.preview=state.preview;
    if(state.cfd.fieldRef){current.cfd={...current.cfd,fieldRef:state.cfd.fieldRef};}
    for(const result of state.results||[]){
      if(!current.results.some(x=>x.fileRef===result.fileRef))current.results.push(result);
    }
    current.updatedAt=new Date().toISOString();
  }
  function save(asNew=false){
    if(!current){message('Crea o abre un proyecto antes de guardarlo.',true);return;}
    snapshot();
    if(asNew){
      const next=window.prompt('Nombre de la nueva copia:',current.name+' (copia)');
      if(next===null)return;
      if(!next.trim()){message('El nombre no puede estar vacío.',true);return;}
      current={...copy(current),id:uniqueId(),name:str(next.trim()),createdAt:new Date().toISOString()};
    }else{
      const newName=$('projectName').value.trim();
      if(homeVisible&&newName)current.name=str(newName);
    }
    current.updatedAt=new Date().toISOString();
    const stored=cacheProject(current);refresh();
    message(stored?'Proyecto guardado en este navegador. Ya aparece en Proyectos guardados.':'No se pudo guardar el proyecto: comprueba el espacio y los permisos de almacenamiento del navegador.',!stored);
  }
  async function activate(source){
    const project=validated(source);
    current=project;assetPending=false;
    try{
      const result=await window.aeroProjectBridge?.restore?.(project);
      assetPending=result?.vehicleRestored===false;
      showViewer();refresh();
      const notice=assetPending?
        'Proyecto abierto sin el GLB original: vuelve a importarlo. Los JSON CFD también deben importarse manualmente.':
        'Proyecto abierto. Si hay resultados CFD referenciados, vuelve a importar sus archivos JSON.';
      message(notice);
      $('status').textContent=notice;
    }catch(err){showHome();message('No se pudo restaurar el proyecto: '+err.message,true);}
  }
  async function newProject(){
    const name=$('projectName').value.trim()||'Proyecto sin título';
    current=makeProject(name);assetPending=false;
    try{await window.aeroProjectBridge?.startNew?.();showViewer();refresh();}
    catch(err){showHome();message('No se pudo crear el proyecto: '+err.message,true);}
  }
  async function importFile(e){
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>3*1024*1024)throw Error('El manifiesto supera 3 MB; los GLB y JSON se conservan aparte.');
      const project=validated(JSON.parse(await file.text()));
      await activate(project);
    }catch(err){showHome();message('No se pudo importar: '+err.message,true);}
    finally{e.target.value='';}
  }
  $('projectNew').addEventListener('click',newProject);
  $('projectOpen').addEventListener('click',()=>$('projectFile').click());
  $('projectFile').addEventListener('change',importFile);
  $('projectEnterViewer').addEventListener('click',showViewer);
  $('projectHomeButton').addEventListener('click',showHome);
  $('projectSave').addEventListener('click',()=>save(false));
  $('projectSaveAs').addEventListener('click',()=>save(true));
  $('projectHeaderSave').addEventListener('click',()=>save(false));
  $('projectLibraryButton').addEventListener('click',()=>{
    const panel=$('projectLibraryPanel');panel.hidden=!panel.hidden;
    $('projectLibraryButton').setAttribute('aria-expanded',String(!panel.hidden));
    if(!panel.hidden)renderLibrary();
  });
  refresh();
  return {format:FORMAT,makeProject,validated,goHome:showHome,
    getCurrent:()=>current?copy(current):null,isHome:()=>homeVisible};
})();
