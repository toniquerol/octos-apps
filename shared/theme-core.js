(function(g){
 'use strict';
 const ranges={headerHeight:[60,130],footerHeight:[28,70],sidebarWidth:[220,480],listWidth:[220,500],editorHeight:[180,520],fontSize:[11,18],titleSize:[16,30],buttonHeight:[30,56],radius:[0,20],gap:[4,24],logoSize:[24,60],mobileButtonHeight:[44,64],mobileHeaderHeight:[100,160],popupWidth:[240,480]};
 function validate(c){
  if(!c||c.schemaVersion!==1||!Number.isInteger(c.revision)||c.revision<1||!c.tokens||!c.apps)throw Error('Plantilla no compatible');
  const t=c.tokens;
  for(const [k,[min,max]] of Object.entries(ranges))if(!Number.isFinite(t[k])||t[k]<min||t[k]>max)throw Error('Valor fuera de rango: '+k);
  for(const k of ['accent','background','panel','text'])if(!/^#[0-9a-f]{6}$/i.test(t[k]))throw Error('Color no válido: '+k);
  for(const k of ['textAlign','headingAlign'])if(!['left','center','right'].includes(t[k]))throw Error('Alineación no válida');
  if(!['left','center','right'].includes(t.popupPosition))throw Error('Posición no válida');
  if(t.logoUrl){const u=new URL(t.logoUrl);if(u.protocol!=='https:')throw Error('El logo necesita una URL HTTPS')}
  for(const k of ['iconMenu','iconClose','iconZoomIn','iconZoomOut','icon3d'])if(typeof t[k]!=='string'||!t[k].trim()||t[k].length>6)throw Error('Icono no válido');
  for(const v of Object.values(c.apps))if(!/^\d+\.\d+$/.test(v))throw Error('Versión no válida');
  return c;
 }
 function bump(v){const [a,b]=v.split('.').map(Number);return (a+Math.floor((b+1)/10))+'.'+((b+1)%10)}
 function release(current,draft){validate(current);validate(draft);return validate({...current,revision:current.revision+1,version:bump(current.version),publishedAt:new Date().toISOString(),tokens:structuredClone(draft.tokens),apps:Object.fromEntries(Object.entries(current.apps).map(([k,v])=>[k,bump(v)])),history:[{revision:current.revision,version:current.version,tokens:current.tokens},...(current.history||[])].slice(0,10)})}
 g.OcToSThemeCore={validate,bump,release,ranges};
})(typeof window!=='undefined'?window:globalThis);

