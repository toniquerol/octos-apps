/* Configuración independiente de tres cámaras relativas al vehículo. */
const FIELDS=[
  {key:'behind',label:'Distancia detrás (+) / delante (−)',min:-10,max:50,step:.5,unit:'m'},
  {key:'side',label:'Desplazamiento a la derecha (+)',min:-20,max:20,step:.5,unit:'m'},
  {key:'above',label:'Altura sobre el vehículo',min:1,max:60,step:.5,unit:'m'},
  {key:'orbit',label:'Giro respecto a la marcha',min:-180,max:180,step:1,unit:'°'},
  {key:'lookAhead',label:'Punto de mira hacia delante (+)',min:-10,max:35,step:.5,unit:'m'}
];
export function mountCameraSettings({game,container}){
  let selected=game.cameraMode;
  const tabs=document.createElement('div');
  tabs.className='camera-tabs';
  tabs.setAttribute('role','group');
  tabs.setAttribute('aria-label','Seleccionar cámara');
  const controls=[];
  for(let index=0;index<3;index++){
    const button=document.createElement('button');
    button.type='button';
    button.textContent='Cámara '+(index+1);
    button.addEventListener('click',()=>{selected=index;game.selectCamera(index);render();});
    tabs.append(button);
    controls.push(button);
  }
  const intro=document.createElement('p');
  intro.className='camera-intro';
  intro.textContent='Posiciones relativas al BMW y a su dirección de avance. C o el mando alternan cámaras. Los cambios se guardan automáticamente.';
  container.append(intro,tabs);
  const sliders=new Map();
  for(const field of FIELDS){
    const label=document.createElement('label');
    label.className='camera-field';
    const header=document.createElement('span');
    const title=document.createElement('span');
    title.textContent=field.label;
    const output=document.createElement('output');
    header.append(title,output);
    const range=document.createElement('input');
    range.type='range';
    range.min=String(field.min);
    range.max=String(field.max);
    range.step=String(field.step);
    range.addEventListener('input',()=>{
      const value=Number(range.value);
      if(game.setCameraPreset(selected,field.key,value)){
        output.textContent=value+' '+field.unit;
      }
    });
    label.append(header,range);
    container.append(label);
    sliders.set(field.key,{range,output,unit:field.unit});
  }
  const reset=document.createElement('button');
  reset.type='button';
  reset.className='camera-reset';
  reset.textContent='Restablecer esta cámara';
  reset.addEventListener('click',()=>{game.resetCameraPreset(selected);render();});
  container.append(reset);
  function render(){
    const preset=game.getCameraPresets()[selected];
    if(!preset)return;
    for(let index=0;index<controls.length;index++){
      controls[index].setAttribute('aria-pressed',String(index===selected));
    }
    for(const [key,{range,output,unit}] of sliders){
      range.value=String(preset[key]);
      output.textContent=preset[key]+' '+unit;
    }
  }
  render();
  return {
    sync(mode){
      if(Number.isInteger(mode)&&mode!==selected){
        selected=mode;
        render();
      }
    }
  };
}
