/* OcToS Gamepad Controller · módulo compartido para juegos en GitHub Pages.
   Lee valores analógicos directamente desde navigator.getGamepads().
   Configuración independiente por proyecto y por dispositivo, sin dependencias. */
export const DEFAULT_GAMEPAD_BINDINGS=Object.freeze({
  moveX:'a0', moveY:'a1', lookX:'a2', lookY:'a3',
  throttle:'b7', brake:'b6',
  jump:'b0', aim:'b6', handbrake:'b0',
  interact:'b2', camera:'b2', enter:'b3',
  secondary:'b1', horn:'b1', run:'b10', pause:'b9'
});
export const GAMEPAD_ACTIONS=Object.freeze([
  ['moveX','Stick izquierdo · horizontal'],
  ['moveY','Stick izquierdo · vertical'],
  ['lookX','Cámara · horizontal'],['lookY','Cámara · vertical'],
  ['throttle','R2 · acelerador'],['brake','L2 · freno / retroceso'],
  ['jump','X · saltar'],['aim','L2 · apuntar'],
  ['handbrake','X · freno de mano'],['interact','Cuadrado · interactuar'],
  ['camera','Cuadrado · cámara'],['enter','Triángulo · entrar / salir'],
  ['secondary','Círculo · acción secundaria'],['horn','Círculo · claxon'],
  ['run','L3 · correr'],['pause','Options · pausa']
]);
const AXIS_ACTIONS=new Set(['moveX','moveY','lookX','lookY']);
const BUTTON_ACTIONS=GAMEPAD_ACTIONS.map(x=>x[0]).filter(x=>!AXIS_ACTIONS.has(x));
const DEFAULTS={
  deadzone:.14, movementSensitivity:1, steeringSensitivity:1, cameraSensitivity:1,
  invert:{moveX:false,moveY:false,lookX:false,lookY:false},
  bindings:{...DEFAULT_GAMEPAD_BINDINGS}
};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function normalConfig(data) {
  const d=data&&typeof data==='object'?data:{};
  const clampNumber=(v,f,a,b)=>Number.isFinite(Number(v))?clamp(Number(v),a,b):f;
  const bindings={...DEFAULT_GAMEPAD_BINDINGS};
  for(const action of Object.keys(bindings)) {
    const value=d.bindings?.[action];
    if(typeof value==='string' && /^(?:[abtu][0-9]{1,2})$/.test(value))
      bindings[action]=value;
  }
  return {
    deadzone:clampNumber(d.deadzone,.14,0,.45),
    movementSensitivity:clampNumber(d.movementSensitivity,1,.25,2),
    steeringSensitivity:clampNumber(d.steeringSensitivity,1,.25,2),
    cameraSensitivity:clampNumber(d.cameraSensitivity,1,.25,3),
    invert:Object.fromEntries(Object.keys(DEFAULTS.invert).map(k=>[k,!!d.invert?.[k]])),
    bindings
  };
}
const EMPTY_BUTTONS=Object.freeze(Object.fromEntries(BUTTON_ACTIONS.map(k=>[k,false])));
const NEUTRAL=Object.freeze({
  connected:false, id:'',index:-1, moveX:0,moveY:0,lookX:0,lookY:0,
  throttle:0,brake:0,buttons:EMPTY_BUTTONS,pressed:EMPTY_BUTTONS
});
export class OcToSGamepadController {
  constructor({project='gta',navigatorRef=globalThis.navigator,storage=globalThis.localStorage}={}) {
    this.project=String(project).replace(/[^a-z0-9-]/gi,'-');
    this.storageKey='octos-gamepad-controller-v1:'+this.project;
    this.navigatorRef=navigatorRef;
    this.storage=storage;
    let data={};
    try {data=JSON.parse(storage?.getItem(this.storageKey)||'{}')||{};}catch{}
    this.saved=data && typeof data==='object'?data:{};
    this.saved.profiles??={};
    this.defaultConfig=normalConfig(this.saved.defaults);
    this.config=normalConfig(this.defaultConfig);
    this.activeIndex=-1;
    this.activeSignature='';
    this.manualIndex=null;
    this.prevPressed={};
    this.last=NEUTRAL;
    this.onChange=()=>{};
    this._event=()=>this.refresh();
    if(typeof globalThis.window?.addEventListener==='function'){
      window.addEventListener('gamepadconnected',this._event);
      window.addEventListener('gamepaddisconnected',this._event);
    }
    this.refresh();
  }
  list() {
    if(typeof this.navigatorRef?.getGamepads!=='function')return [];
    try {return Array.from(this.navigatorRef.getGamepads()||[])
      .filter(x=>x&&x.connected!==false);}catch{return [];}
  }
  signature(pad) {
    return [pad.id||'Gamepad',pad.mapping||'unknown',
      pad.axes?.length||0,pad.buttons?.length||0].join('|');
  }
  refresh(){
    const all=this.list();
    let selected=all.find(p=>p.index===this.manualIndex);
    if(!selected)selected=all.find(p=>p.index===this.activeIndex)||all[0]||null;
    const nextIndex=selected?.index??-1;
    const signature=selected?this.signature(selected):'';
    if(nextIndex!==this.activeIndex||signature!==this.activeSignature) {
      this.activeIndex=nextIndex;
      this.activeSignature=signature;
      this.prevPressed={};
      this.config=normalConfig(this.saved.profiles[signature]||this.defaultConfig);
      this.last=NEUTRAL;
      this.onChange({connected:!!selected,id:selected?.id||'',index:nextIndex});
    }
    return selected;
  }
  select(index){
    this.manualIndex=Number.isInteger(index)?index:null;
    this.refresh();
  }
  sample(){
    const pad=this.refresh();
    return pad?{connected:true,id:pad.id,index:pad.index,
      axes:Array.from(pad.axes||[]),buttons:Array.from(pad.buttons||[],b=>typeof b==='number'?b:Number(b?.value??(b?.pressed?1:0)))}:
      {connected:false,id:'',index:-1,axes:[],buttons:[]};
  }
  read(pad,binding) {
    if(!pad||typeof binding!=='string')return 0;
    const type=binding[0],index=Number(binding.slice(1));
    if(type==='b'){
      const button=pad.buttons?.[index];
      return clamp(typeof button==='number'?button:Number(button?.value??(button?.pressed?1:0))||0,0,1);
    }
    const raw=Number(pad.axes?.[index]);
    if(!Number.isFinite(raw))return 0;
    const axis=clamp(raw,-1,1);
    if(type==='t')return (axis+1)/2;
    if(type==='u')return (1-axis)/2;
    return axis;
  }
  axis(pad,name) {
    const value=this.read(pad,this.config.bindings[name]);
    const deadzone=this.config.deadzone;
    const scaled=Math.abs(value)<=deadzone?0:
      Math.sign(value)*(Math.abs(value)-deadzone)/(1-deadzone);
    return clamp(scaled*(this.config.invert[name]?-1:1),-1,1);
  }
  poll(){
    const pad=this.refresh();
    if(!pad)return this.last=NEUTRAL;
    const state={
      connected:true,id:pad.id||'Gamepad',index:pad.index,
      moveX:this.axis(pad,'moveX'),moveY:this.axis(pad,'moveY'),
      lookX:this.axis(pad,'lookX'),lookY:this.axis(pad,'lookY'),
      throttle:this.read(pad,this.config.bindings.throttle),
      brake:this.read(pad,this.config.bindings.brake),
      buttons:{},pressed:{}
    };
    for(const action of BUTTON_ACTIONS){
      const down=this.read(pad,this.config.bindings[action])>.55;
      state.buttons[action]=down;
      state.pressed[action]=down&&!this.prevPressed[action];
      this.prevPressed[action]=down;
    }
    return this.last=state;
  }
  update(patch) {
    const next=normalConfig({...this.config,...patch,
      invert:{...this.config.invert,...patch?.invert},
      bindings:{...this.config.bindings,...patch?.bindings}});
    this.config=next;
    if(this.activeSignature)this.saved.profiles[this.activeSignature]=next;
    else this.defaultConfig=next;
    this.save();
    return next;
  }
  reset(){
    this.config=normalConfig(DEFAULTS);
    if(this.activeSignature)this.saved.profiles[this.activeSignature]=this.config;
    else this.defaultConfig=this.config;
    this.save();
    return this.config;
  }
  save(){
    this.saved.defaults=this.defaultConfig;
    if(this.activeSignature)this.saved.profiles[this.activeSignature]=this.config;
    try {this.storage?.setItem(this.storageKey,JSON.stringify(this.saved));return true;}
    catch{return false;}
  }
  destroy(){
    if(typeof globalThis.window?.removeEventListener==='function'){
      window.removeEventListener('gamepadconnected',this._event);
      window.removeEventListener('gamepaddisconnected',this._event);
    }
  }
}
export function mountGamepadSettings({controller,container}){
  if(!controller||!container)return {destroy(){}};
  const panel=document.createElement('details');
  panel.className='octos-gp-panel';panel.id='octos-gp-settings';
  const heading=document.createElement('summary');heading.textContent='Mandos';
  const body=document.createElement('div');body.className='octos-gp-body';
  const device=document.createElement('select');device.setAttribute('aria-label','Mando activo');
  const status=document.createElement('p');status.className='octos-gp-status';
  const live=document.createElement('div');live.className='octos-gp-live';
  live.setAttribute('aria-live','off');
  const note=document.createElement('p');note.className='octos-gp-note';
  note.textContent='Pulsa un botón del mando para que Chrome o Edge lo detecte. Los ejes y botones sin asignar pueden calibrarse aquí.';
  const title=document.createElement('strong');title.textContent='Asignaciones de controles';
  const form=document.createElement('div');form.className='octos-gp-bindings';
  const numberSettings=new Map(),inverts=new Map(),assignment=new Map();
  function range(name,label,min,max,step){
    const wrap=document.createElement('label');wrap.className='octos-gp-setting';
    const caption=document.createElement('span');caption.textContent=label;
    const slider=document.createElement('input');slider.type='range';
    slider.min=String(min);slider.max=String(max);slider.step=String(step);
    const value=document.createElement('output');
    slider.addEventListener('input',()=>{
      const next=Number(slider.value);value.textContent=next.toFixed(2);
      controller.update({[name]:next});
    });
    wrap.append(caption,slider,value);numberSettings.set(name,{slider,value});
    return wrap;
  }
  const extras=document.createElement('div');extras.className='octos-gp-options';
  extras.append(
    range('deadzone','Zona muerta',0,.45,.01),
    range('movementSensitivity','Sensibilidad de movimiento',.25,2,.05),
    range('steeringSensitivity','Sensibilidad de dirección',.25,2,.05),
    range('cameraSensitivity','Sensibilidad de cámara',.25,3,.05)
  );
  for(const name of ['moveX','moveY','lookX','lookY']){
    const wrap=document.createElement('label');wrap.className='octos-gp-invert';
    const check=document.createElement('input');check.type='checkbox';
    const label=document.createElement('span');
    label.textContent='Invertir '+({moveX:'mov. horizontal',moveY:'mov. vertical',
      lookX:'cámara horizontal',lookY:'cámara vertical'}[name]);
    check.addEventListener('change',()=>controller.update({invert:{[name]:check.checked}}));
    wrap.append(check,label);inverts.set(name,check);extras.append(wrap);
  }
  function choices(selected){
    const options=[];
    for(let i=0;i<20;i++)options.push(['b'+i,'Botón '+i]);
    for(let i=0;i<12;i++) {
      options.push(['a'+i,'Eje '+i]);
      options.push(['t'+i,'Gatillo por eje '+i]);
      options.push(['u'+i,'Gatillo eje '+i+' invertido']);
    }
    if(!options.some(o=>o[0]===selected))options.push([selected,selected]);
    return options;
  }
  for(const [action,label] of GAMEPAD_ACTIONS) {
    const row=document.createElement('label');row.className='octos-gp-assignment';
    const caption=document.createElement('span');caption.textContent=label;
    const select=document.createElement('select');
    for(const [value,text] of choices(controller.config.bindings[action])){
      const option=document.createElement('option');option.value=value;option.textContent=text;
      select.append(option);
    }
    select.addEventListener('change',()=>controller.update({bindings:{[action]:select.value}}));
    row.append(caption,select);form.append(row);assignment.set(action,select);
  }
  const buttons=document.createElement('div');buttons.className='octos-gp-actions';
  const save=document.createElement('button');save.type='button';save.textContent='Guardar ajustes';
  save.addEventListener('click',()=>{status.textContent=controller.save()?
    'Ajustes guardados en este navegador.':'No se pueden guardar los ajustes.'});
  const reset=document.createElement('button');reset.type='button';reset.textContent='Restaurar valores';
  reset.addEventListener('click',()=>{controller.reset();paint()});
  buttons.append(save,reset);
  body.append(device,status,live,note,extras,title,form,buttons);
  panel.append(heading,body);container.append(panel);
  device.addEventListener('change',()=>{controller.select(Number(device.value));paint()});
  function paint(){
    const config=controller.config;
    for(const [name,{slider,value}] of numberSettings){
      slider.value=String(config[name]);value.textContent=Number(config[name]).toFixed(2);
    }
    for(const [name,check] of inverts)check.checked=config.invert[name];
    for(const [action,select] of assignment)select.value=config.bindings[action];
  }
  const prevChange=controller.onChange;
  controller.onChange=(state)=>{prevChange?.(state);paint()};
  let optionSignature='';
  function show(){
    if(!panel.open)return;
    const pads=controller.list();
    const active=controller.activeIndex;
    const nextSignature=pads.map(p=>p.index+'|'+p.id).join(';')||'none';
    if(nextSignature!==optionSignature){
      optionSignature=nextSignature;
      device.replaceChildren();
      if(!pads.length){
        const o=document.createElement('option');o.value='-1';o.textContent='Sin mando detectado';
        device.append(o);
      }else for(const p of pads){
        const o=document.createElement('option');o.value=String(p.index);o.textContent=p.id||'Mando '+p.index;
        device.append(o);
      }
    }
    if(device.value!==String(active))device.value=String(active);
    const sample=controller.sample();
    status.textContent=sample.connected?
      'Conectado · '+sample.id+' · '+sample.axes.length+' ejes / '+sample.buttons.length+' botones':
      'Desconectado · teclado y ratón disponibles';
    live.textContent=sample.connected?
      'Ejes: '+sample.axes.map((v,i)=>i+': '+v.toFixed(2)).join(' | ')+
      '\nBotones: '+sample.buttons.map((v,i)=>i+': '+v.toFixed(2)).join(' | '):
      'Conecta un mando USB o Bluetooth para ver la lectura en tiempo real.';
  }
  paint();
  let frame=null,disposed=false;
  function loop(){
    if(disposed)return;
    if(panel.open)show();
    frame=requestAnimationFrame(loop);
  }
  frame=requestAnimationFrame(loop);
  return {panel,destroy(){
    disposed=true;if(frame!=null)cancelAnimationFrame(frame);
    controller.onChange=prevChange;panel.remove();
  }};
}
