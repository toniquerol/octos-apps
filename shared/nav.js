/* Navegación común OcToS · Inicio / Aplicaciones / Atrás.
 * Sin dependencias; no modifica el logotipo ni las funciones de cada aplicación. */
(function navFactory(){
  'use strict';
  const script=document.currentScript;
  if(!script)return;
  const root=new URL('../',script.src);
  const ROOT_URL=new URL('./',root).href;
  const LOGO_URL='https://octos3dstudio.wordpress.com/wp-content/uploads/2026/11/octos-monograma-t-blanco-transparente.png';
  const apps=[
    {id:'drive',name:'Drive',category:'Movilidad',path:'drive/',icon:'https://octos3dstudio.wordpress.com/wp-content/uploads/2026/11/octos-drive-symbol.png'},
    {id:'carto',name:'Carto',category:'Cartografía',path:'carto/',icon:'https://octos3dstudio.wordpress.com/wp-content/uploads/2026/11/octos-carto-symbol.png'},
    {id:'meteo',name:'Meteo',category:'Meteorología',path:'meteo/',icon:'https://octos3dstudio.wordpress.com/wp-content/uploads/2026/11/octos-meteo-logo-2026.png'},
    {id:'rain',name:'Rain',category:'Hidrología',path:'rain/',icon:'https://octos3dstudio.wordpress.com/wp-content/uploads/2026/11/octos-rain-logo-transparente.png'},
    {id:'layers',name:'Layers',category:'Cartografía',path:'layers/',icon:'layers/icon.svg'},
    {id:'templates',name:'Templates',category:'Sistema visual',path:'templates/',icon:'templates/icon.svg'},
    {id:'aero',name:'Aero',category:'Simulación 3D',path:'aero/',icon:'aero/icon.svg'},
    {id:'roads',name:'Roads',category:'Infraestructuras',path:'roads/',icon:'roads/icon.svg'},
    {id:'team',name:'Team · Sala',category:'Organización',path:'team/',icon:'team/icon.svg'}
  ];
  const website={id:'wordpress',name:'WordPress',category:'Sitio web',href:'https://octos3dstudio.wordpress.com/'};
  const appNames={
    apps:['APPS','CENTRO DE APLICACIONES'],
    team:['TEAM','COORDINACIÓN INTERNA'],
    drive:['DRIVE','MOVILIDAD Y NAVEGACIÓN'],
    carto:['CARTO','VISOR CARTOGRÁFICO'],
    meteo:['METEO','METEOROLOGÍA'],
    rain:['RAIN','ANÁLISIS DEL TERRENO'],
    layers:['LAYERS','CAPAS CARTOGRÁFICAS'],
    templates:['TEMPLATES','SISTEMA VISUAL'],
    aero:['AERO','LABORATORIO 3D'],
    roads:['ROADS','INFRAESTRUCTURAS']
  };
  const glyph={
    home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 9-8 9 8"/><path d="M5 10v11h14V10"/><path d="M10 21v-7h4v7"/></svg>',
    menu:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>',
    back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5 2 12l7 7"/><path d="M3 12h19"/></svg>'
  };
  const css=`
    .octos-nav-toolbar{display:inline-flex;align-items:center;justify-content:flex-start;gap:5px;flex:none;min-width:0;position:relative;z-index:1305}
    .octos-nav-trigger{box-sizing:border-box!important;width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;display:inline-grid!important;place-items:center!important;flex:none!important;padding:0!important;margin:0!important;border:1px solid #ff6a1a!important;border-radius:8px!important;background:#17181b!important;color:#ff6a1a!important;cursor:pointer;line-height:1}
    .octos-nav-trigger:hover,.octos-nav-trigger[aria-expanded="true"]{background:#34241b!important;border-color:#ffa36a!important;color:#ffa36a!important}
    .octos-nav-trigger:focus-visible{outline:2px solid #ffb181!important;outline-offset:3px}
    .octos-nav-trigger[hidden]{display:none!important}
    .octos-nav-trigger svg{display:block;width:23px;height:23px;flex:none;pointer-events:none}
    .octos-nav-panel{position:fixed!important;box-sizing:border-box!important;z-index:2147483000!important;width:min(314px,calc(100vw - 16px))!important;max-height:min(690px,calc(100dvh - 72px))!important;overflow:auto!important;color:#f1f1ef!important;background:#1b1c20!important;border:1px solid #52545a!important;border-radius:11px!important;box-shadow:0 18px 45px #000c!important;padding:10px!important;font:12px/1.45 "IBM Plex Sans",system-ui,sans-serif!important}
    .octos-nav-panel[hidden],html.pin-locked .octos-nav-panel{display:none!important}
    /* Identidad de cabecera común: monograma T oficial + OcToS / aplicación. */
    .octos-global-brand{position:absolute!important;left:50%!important;top:50%!important;transform:translate(-50%,-50%)!important;z-index:1!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:13px!important;min-width:0!important;max-width:calc(100% - 420px)!important;color:#f1f1ef!important;pointer-events:none!important;white-space:nowrap!important;line-height:1.15!important}
    .octos-global-brand img{display:block!important;width:38px!important;height:38px!important;object-fit:contain!important;flex:none!important;background:transparent!important;border:0!important;padding:0!important}
    .octos-global-brand-copy{display:flex;flex-direction:column;gap:4px;min-width:0;text-align:left}
    .octos-global-brand-name{font:750 19px/1.13 Manrope,system-ui,sans-serif!important;letter-spacing:.045em!important;color:#f1f1ef!important}
    .octos-global-brand-name span{color:#ff6a1a!important}
    .octos-global-brand-sub{font:500 10px/1.3 "IBM Plex Sans",system-ui,sans-serif!important;letter-spacing:.14em!important;color:#92949b!important}
    /* Sólo ocultar marcas duplicadas: los botones y formularios originales permanecen activos. */
    .octos-has-global-nav body>header{position:relative!important}
    .octos-has-global-nav body>header .brand{display:none!important}
    .octos-has-global-nav body>header .ot-head-title{visibility:hidden!important}
    .octos-has-global-nav body>header .ot-head-left>img{display:none!important}
    .octos-has-global-nav body>header .head-left>.logo{display:none!important}
    .octos-has-global-nav[data-octos-global-app="aero"] body>header>img,
    .octos-has-global-nav[data-octos-global-app="aero"] body>header>b,
    .octos-has-global-nav[data-octos-global-app="aero"] body>header>small{display:none!important}
    .octos-has-global-nav #app>header.site-header{position:relative!important}
    .octos-has-global-nav #app>header.site-header>.brand,
    .octos-has-global-nav #app>header.site-header>.brand-copy{display:none!important}
    @media(max-width:1100px){
      .octos-global-brand{max-width:calc(100% - 310px)!important;gap:9px!important}
      .octos-global-brand img{width:33px!important;height:33px!important}
      .octos-global-brand-name{font-size:16px!important}
      .octos-global-brand-sub{font-size:9px!important;letter-spacing:.07em!important}
    }
    .octos-nav-list{display:grid;gap:3px}
    .octos-nav-link{box-sizing:border-box;display:flex!important;align-items:center;gap:12px;width:100%;min-height:45px;padding:7px 10px;border:1px solid transparent;border-radius:8px;background:transparent;color:#f1f1ef!important;text-decoration:none!important;text-align:left;line-height:1.25}
    .octos-nav-link:hover,.octos-nav-link:focus-visible{background:#2c2d31;border-color:#55575d;outline:none}
    .octos-nav-link[aria-current="page"]{background:#ff6a1a17;border-color:#ff6a1a;color:#ffb18b!important}
    .octos-nav-item-icon{box-sizing:border-box;display:grid;place-items:center;width:32px;height:32px;flex:none;border:1px solid #45474c;border-radius:7px;background:#25262a;overflow:hidden;color:#ff6a1a;font-weight:750;font:700 16px Manrope,system-ui,sans-serif}
    .octos-nav-item-icon img{width:100%;height:100%;object-fit:contain;display:block;padding:3px}
    .octos-nav-item-text{display:flex;min-width:0;flex-direction:column;gap:3px}
    .octos-nav-item-text strong{font-size:12px;font-weight:650;color:inherit}
    .octos-nav-item-text small{font-size:10px;font-weight:400;color:#9b9da5;letter-spacing:.02em}
    .octos-nav-divider{border:0;border-top:1px solid #383a40;margin:8px 3px}
    /* En Team sustituimos los dos accesos antiguos para evitar duplicados. */
    .octos-has-global-nav body>header .nav-shortcuts{display:none!important}
    .octos-has-global-nav body>header:has(.nav-shortcuts){padding-left:15px!important}
    .site-header:has(.octos-nav-toolbar){padding-left:15px!important}
    /* El editor del Máster y las apps con cabecera común conservan sus botones propios. */
    .octos-themed .ot-head-left .octos-nav-toolbar{flex:none}
    .octos-themed .ot-head-left{gap:6px!important}
    @media(max-width:790px){
      .octos-nav-toolbar{gap:4px}
      .octos-nav-trigger{width:34px!important;min-width:34px!important;height:34px!important;min-height:34px!important;border-radius:7px!important}
      .octos-nav-trigger svg{width:20px;height:20px}
      .octos-themed body>header{grid-template-columns:minmax(130px,1fr) minmax(0,1fr) minmax(90px,1fr)!important;column-gap:4px!important}
      .octos-themed .ot-head-left>img{width:29px!important;height:29px!important}
      .octos-themed .ot-head-left>button{min-width:29px!important;padding:2px 4px!important}
      .octos-themed .ot-head-title strong{font-size:min(var(--ot-titleSize),17px)!important}
      .site-header .brand-copy{max-width:calc(100% - 220px)}
      .octos-global-brand{max-width:calc(100% - 245px)!important;gap:7px!important}
      .octos-global-brand img{width:30px!important;height:30px!important}
      .octos-global-brand-name{font-size:14px!important}
      .octos-global-brand-sub{display:none!important}
    }
    @media(max-width:540px){
      .octos-nav-toolbar{gap:3px}
      .octos-nav-trigger{width:30px!important;min-width:30px!important;height:30px!important;min-height:30px!important}
      .octos-nav-trigger svg{width:18px;height:18px}
      .octos-themed .ot-head-left>img{display:none!important}
      .octos-themed .ot-head-title{font-size:12px}
      .octos-themed body>header{grid-template-columns:minmax(120px,1fr) minmax(0,1fr) minmax(80px,1fr)!important}
      .octos-nav-panel{max-height:calc(100dvh - 60px)!important}
      .site-header{gap:8px}
      .site-header .brand{margin-right:auto}
      .site-header .brand-mark{width:30px;height:30px}
      .site-header .brand-copy{max-width:calc(100% - 180px)}
      .octos-global-brand{max-width:calc(100% - 170px)!important;gap:5px!important}
      .octos-global-brand img{width:23px!important;height:23px!important}
      .octos-global-brand-name{font-size:11px!important;letter-spacing:0!important}
    }
  `;
  function makeButton(id,label,icon){
    const button=document.createElement('button');
    button.type='button';
    button.className='octos-nav-trigger';
    button.id=id;
    button.title=label;
    button.setAttribute('aria-label',label);
    button.innerHTML=glyph[icon];
    return button;
  }
  function currentApp(){
    const relative=location.pathname.startsWith(root.pathname)?location.pathname.slice(root.pathname.length):'';
    return relative.split('/')[0]||'apps';
  }
  function isInOctos(u){
    try{const url=new URL(u);return url.origin===root.origin&&url.pathname.startsWith(root.pathname)}
    catch{return false}
  }
  function install(){
    if(document.getElementById('octos-app-switcher'))return;
    const header=document.querySelector('body > header, #app > header, header.site-header')||document.querySelector('header');
    if(!header)return;
    const appId=currentApp();
    const homePage=appId==='apps'||appId==='index.html';
    // Cabecera única en todas las aplicaciones, sin modificar el logo original de origen.
    const brand=document.createElement('div');
    brand.className='octos-global-brand';
    brand.id='octos-global-brand';
    const brandImage=document.createElement('img');
    brandImage.src=LOGO_URL;
    brandImage.alt='';
    brandImage.setAttribute('aria-hidden','true');
    const brandCopy=document.createElement('div');
    brandCopy.className='octos-global-brand-copy';
    const brandTitle=document.createElement('div');
    brandTitle.className='octos-global-brand-name';
    const prefix=document.createTextNode('OcToS ');
    const appPart=document.createElement('span');
    const meta=appNames[homePage?'apps':appId]||[appId.toUpperCase(),'APLICACIÓN'];
    appPart.textContent=meta[0];
    brandTitle.append(prefix,appPart);
    const brandSub=document.createElement('div');
    brandSub.className='octos-global-brand-sub';
    brandSub.textContent=meta[1];
    brandCopy.append(brandTitle,brandSub);
    brand.append(brandImage,brandCopy);
    header.appendChild(brand);
    document.documentElement.dataset.octosGlobalApp=homePage?'apps':appId;
    const toolbar=document.createElement('div');
    toolbar.id='octos-app-switcher';
    toolbar.className='octos-nav-toolbar';
    toolbar.setAttribute('role','group');
    toolbar.setAttribute('aria-label','Navegación OcToS');
    const home=makeButton('octos-nav-home','Inicio · Todas las aplicaciones','home');
    const menu=makeButton('octos-nav-menu','Menú de aplicaciones','menu');
    const back=makeButton('octos-nav-back','Volver a la pantalla anterior','back');
    back.hidden=homePage;
    menu.setAttribute('aria-haspopup','true');
    menu.setAttribute('aria-expanded','false');
    menu.setAttribute('aria-controls','octos-app-list');
    toolbar.append(home,menu,back);
    // El menú preexistente de cada aplicación conserva sus eventos.
    const themeLeft=header.querySelector(':scope > .ot-head-left');
    if(themeLeft)themeLeft.prepend(toolbar);
    else {
      const roadsLeft=header.querySelector(':scope > .head-left');
      if(roadsLeft)roadsLeft.prepend(toolbar);
      else header.prepend(toolbar);
    }
    document.documentElement.classList.add('octos-has-global-nav');
    const panel=document.createElement('nav');
    panel.className='octos-nav-panel';
    panel.id='octos-app-list';
    panel.hidden=true;
    panel.setAttribute('aria-label','Cambiar de aplicación OcToS');
    // La lista comienza directamente por las aplicaciones, sin título adicional.
    const list=document.createElement('div');
    list.className='octos-nav-list';
    function item(app){
      const link=document.createElement('a');
      link.className='octos-nav-link';
      link.href=app.href||new URL(app.path,root).href;
      if(app.href){link.target='_blank';link.rel='noopener noreferrer'}
      if(app.id===appId||(app.id==='apps'&&homePage))link.setAttribute('aria-current','page');
      const visual=document.createElement('span');
      visual.className='octos-nav-item-icon';
      if(app.id==='wordpress')visual.textContent='W';
      else if(app.icon||app.id==='apps'){
        const image=document.createElement('img');
        image.src=app.id==='apps'?LOGO_URL:/^https:\/\//.test(app.icon)?app.icon:new URL(app.icon,root).href;
        image.alt='';
        image.loading='lazy';
        image.addEventListener('error',()=>{image.remove();visual.textContent=app.name.charAt(0)}, {once:true});
        visual.append(image);
      }else visual.textContent=app.name.charAt(0);
      const copy=document.createElement('span');
      copy.className='octos-nav-item-text';
      const title=document.createElement('strong');
      title.textContent=app.name;
      const subtitle=document.createElement('small');
      subtitle.textContent=app.category;
      copy.append(title,subtitle);link.append(visual,copy);
      return link;
    }
    list.appendChild(item({id:'apps',name:'Todas las aplicaciones',category:'Inicio · OcToS Apps',path:''}));
    list.appendChild(document.createElement('hr')).className='octos-nav-divider';
    for(const app of apps)list.appendChild(item(app));
    list.appendChild(document.createElement('hr')).className='octos-nav-divider';
    list.appendChild(item(website));
    panel.append(list);
    document.body.appendChild(panel);

    function position(){
      if(panel.hidden)return;
      const rect=menu.getBoundingClientRect();
      const left=Math.max(8,Math.min(rect.left,window.innerWidth-panel.offsetWidth-8));
      const below=rect.bottom+8;
      const top=below+Math.min(panel.scrollHeight,580)<window.innerHeight
        ?below:Math.max(8,Math.min(below,window.innerHeight-panel.offsetHeight-8));
      panel.style.left=left+'px';
      panel.style.top=top+'px';
    }
    function setOpen(value){
      panel.hidden=!value;
      menu.setAttribute('aria-expanded',String(value));
      if(value)position();
    }
    home.addEventListener('click',()=>{window.location.assign(ROOT_URL)});
    menu.addEventListener('click',()=>setOpen(panel.hidden));
    back.addEventListener('click',()=>{
      setOpen(false);
      // Team tiene navegación interna con historial propio y se conserva.
      const localBack=document.getElementById('nav-back');
      if(appId==='team'&&location.hash&&location.hash!=='#room'&&location.hash!=='#home'&&localBack){
        localBack.click();
        return;
      }
      if(window.history.length>1&&isInOctos(document.referrer)){
        window.history.back();
        return;
      }
      window.location.assign(ROOT_URL);
    });
    panel.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false)});
    document.addEventListener('pointerdown',event=>{
      if(!panel.hidden&&!toolbar.contains(event.target)&&!panel.contains(event.target))setOpen(false);
    });
    document.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&!panel.hidden){setOpen(false);menu.focus()}
      if(event.key==='ArrowDown'&&document.activeElement===menu&&!panel.hidden){
        event.preventDefault();panel.querySelector('a')?.focus();
      }
    });
    window.addEventListener('resize',position);
    window.addEventListener('scroll',position,{passive:true,capture:true});
  }
  const style=document.createElement('style');
  style.id='octos-nav-style';
  style.textContent=css;
  document.head.appendChild(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
