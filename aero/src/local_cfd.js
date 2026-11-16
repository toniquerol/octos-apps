/* OcToS Aero · preparation package for an external OpenFOAM run.
   No local executable is started by this browser-only module. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const speed=$('cfdCaseSpeed'),note=$('cfdLocalStatus');
 if(!speed||!note)return;
 const clean=name=>(String(name||'vehiculo').replace(/\.glb$/i,'')
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9_-]+/gi,'-').replace(/^-+|-+$/g,'').slice(0,70)||'vehiculo');
 const fileBase=()=>clean(window.aeroProjectBridge?.snapshot?.().vehicle?.name);
 function download(blob,name){
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);
 }
 function manifest(){
  const s=window.aeroProjectBridge?.snapshot?.();
  if(!s)throw Error('No hay vehículo cargado en el visor.');
  const v=Number(speed.value);
  if(!Number.isFinite(v)||v<0.1||v>100)throw Error('Velocidad de entrada: de 0,1 a 100 m/s.');
  const name=fileBase();
  return {
   format:'octos-cfd-case-v1',createdAt:new Date().toISOString(),
   project:{name:window.AeroProjects?.getCurrent?.()?.name||s.vehicle.name,
    vehicle:s.vehicle,transformations:s.transformations},
   geometry:{stl:name+'-aero.stl',unit:'m',
    axis:'X longitudinal (morro -X), Y vertical (suelo Y=0), Z transversal',
    note:'STL exportado con transformaciones aplicadas. Revisar estanqueidad, normales, superficies internas y paso de ruedas antes del mallado.'},
   simulation:{engine:'OpenFOAM',analysis:'External aerodynamics',
    approach:'steady RANS',turbulenceModel:'kOmegaSST',
    velocityMps:v,inletVector:[v,0,0],
    fluid:'air',direction:'+X',
    note:'Configuración preliminar. Dominio, suelo, ruedas, viscosidad, y+, intensidad turbulenta, condiciones de contorno y criterios de convergencia requieren validación.'},
   output:{format:'octos-cfd-v1',grid:'uniform Cartesian',
    axes:'X/Y/Z Aero',units:'m/s',
    instructions:'Resample To Image en ParaView, CSV Points:0/1/2 + U:0/1/2, convertir con aero/tools/cfd_csv_to_json.py e importar desde Campo CFD.'}
  };
 }
 function act(fn){
  try{fn();}
  catch(error){note.textContent='No se pudo preparar CFD: '+error.message;}
 }
 $('cfdExportStl').addEventListener('click',()=>act(()=>{
  const out=window.aeroProjectBridge?.exportGeometrySTL?.();
  if(!out)throw Error('Exportación de geometría no disponible.');
  download(out.blob,fileBase()+'-aero.stl');
  note.textContent='STL exportado: '+out.triangles.toLocaleString('es')+' triángulos. Valida geometría antes del mallado.';
 }));
 $('cfdExportManifest').addEventListener('click',()=>act(()=>{
  download(new Blob([JSON.stringify(manifest(),null,2)],{type:'application/json'}),
   fileBase()+'-cfd-case.json');
 }));
 window.aeroCFDCaseManifest=manifest;
})();