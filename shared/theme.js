(function(){
 'use strict';
 const own=document.currentScript,root=new URL('./',own.src),app=own.dataset.app;
 const names={layers:'Layers',drive:'Drive',carto:'Carto',rain:'Rain',meteo:'Meteo',templates:'Templates'};
 let current,footer,title,logo,readyDOM=false,previewing=false;
 function apply(c){OcToSThemeCore.validate(c);current=c;const html=document.documentElement;html.classList.add('octos-themed');html.dataset.octosApp=app;html.dataset.popupPosition=c.tokens.popupPosition;for(const[k,v]of Object.entries(c.tokens))html.style.setProperty('--ot-'+k,typeof v==='number'?v+'px':v);if(!readyDOM)return;
  title.querySelector('small').textContent='V'+(c.apps[app]||c.version)+' · Máster '+c.version;
  document.title='OcToS '+names[app]+' · V'+(c.apps[app]||c.version);
  logo.src=c.tokens.logoUrl||new URL('../templates/icon.svg',root).href;
  const menu=document.querySelector('.ot-head-left button');if(menu)menu.textContent=c.tokens.iconMenu;
  for(const[id,key]of Object.entries({zoomIn:'iconZoomIn',zoomOut:'iconZoomOut',zoomInControl:'iconZoomIn',zoomOutControl:'iconZoomOut',toggle3d:'icon3d',close:'iconClose'})){const e=document.getElementById(id);if(e)e.textContent=c.tokens[key]}
  window.dispatchEvent(new Event('resize'));
 }
 function setup(){const header=document.querySelector('body>header');if(!header)return;const children=[...header.children],left=document.createElement('div'),right=document.createElement('div');left.className='ot-head-left';right.className='ot-head-right';title=document.createElement('div');title.className='ot-head-title';title.innerHTML='<strong>OcToS <em>'+names[app]+'</em></strong><small></small>';
  let menu=children.find(e=>e.tagName==='BUTTON'&&e.id==='menu');if(!menu){menu=document.createElement('button');menu.type='button';menu.setAttribute('aria-label','Mostrar menú');menu.onclick=()=>{const candidate=document.getElementById('topPanel')||document.getElementById('collapseSidebar')||document.getElementById('menu');if(candidate&&candidate!==menu)candidate.click();else document.querySelector('aside')?.classList.toggle('closed')}}left.append(menu);
  logo=document.createElement('img');logo.alt='OcToS';left.append(logo);
  for(const e of children){if(e===menu)continue;if(e.tagName==='IMG'||((e.textContent.includes('OcToS')||e.classList.contains('brand'))&&!e.querySelector('button,select,input'))){e.hidden=true;continue}right.append(e)}
  header.replaceChildren(left,title,right);footer=document.createElement('footer');footer.className='ot-footer';const link=document.createElement('a');link.href=new URL('../templates/',root);link.textContent='Plantilla OcToS';const credits=document.createElement('div');credits.className='ot-credits';credits.setAttribute('aria-label','Fuentes y atribuciones');footer.append(link,credits);document.body.append(footer);
  let scheduled=false;function collect(){scheduled=false;for(const e of document.querySelectorAll('.leaflet-control-attribution,.maplibregl-ctrl-attrib,.maplibregl-ctrl-logo'))if(!footer.contains(e))credits.append(e)}
  new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(collect)}}).observe(document.body,{childList:true,subtree:true});collect();readyDOM=true;if(current)apply(current);
 }
 window.OcToSTheme={apply,get current(){return current}};
 function refresh(){if(previewing)return;fetch(new URL('theme.json',root),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Plantilla no disponible');return r.json()}).then(c=>{if(!previewing&&(!current||c.revision>current.revision))apply(c)}).catch(e=>console.warn(e.message))}refresh();setInterval(refresh,60000);window.addEventListener('focus',refresh);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&parent!==window&&new URLSearchParams(location.search).has('templatePreview')&&e.data?.type==='octos-theme-preview'){try{apply(e.data.theme);previewing=true}catch{}}});
})();

