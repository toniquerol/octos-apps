(function navFactory() {
  'use strict';
  const script = document.currentScript;
  if (!script) return;
  const root = new URL('../', script.src);
  const apps = [
    { id: 'apps', name: 'OcToS Apps', path: '' },
    { id: 'team', name: 'Team · Sala', path: 'team/' },
    { id: 'drive', name: 'Drive', path: 'drive/' },
    { id: 'carto', name: 'Carto', path: 'carto/' },
    { id: 'meteo', name: 'Meteo', path: 'meteo/' },
    { id: 'rain', name: 'Rain', path: 'rain/' },
    { id: 'layers', name: 'Layers', path: 'layers/' },
    { id: 'roads', name: 'Roads', path: 'roads/' },
    { id: 'aero', name: 'Aero', path: 'aero/' },
    { id: 'templates', name: 'Templates', path: 'templates/' },
    { id: 'wordpress', name: 'WordPress', href: 'https://octos3dstudio.wordpress.com/' }
  ];
  const css = `
    .octos-nav-control { position: relative; flex: none; display: inline-flex; align-items: center; z-index: 1301; }
    .octos-nav-trigger { box-sizing: border-box; width: 40px; height: 40px; min-width: 40px;
      display: inline-grid; place-items: center; border: 1px solid #55575d; border-radius: 9px;
      background: #232428; color: #f1f1ef; padding: 0; cursor: pointer; line-height: 1; }
    .octos-nav-trigger:hover, .octos-nav-trigger[aria-expanded="true"] { border-color: #ff6a1a; background: #353034; }
    .octos-nav-trigger:focus-visible { outline: 2px solid #ff6a1a; outline-offset: 3px; }
    .octos-nav-trigger svg { width: 21px; height: 21px; display: block; stroke: currentColor; }
    .octos-nav-panel { position: fixed; box-sizing: border-box; z-index: 2147483000; width: min(255px, calc(100vw - 16px));
      max-height: min(620px, calc(100dvh - 82px)); overflow-y: auto; overflow-x: hidden; color: #f1f1ef;
      background: #1b1c20; border: 1px solid #474950; border-radius: 11px; box-shadow: 0 18px 45px #000b;
      padding: 9px; font: 12px/1.4 "IBM Plex Sans", system-ui, sans-serif; }
    .octos-nav-panel[hidden] { display: none !important; }
    .octos-nav-heading { font-size: 10px; font-weight: 700; letter-spacing: .13em; color: #a5a6af; padding: 9px 10px 11px; }
    .octos-nav-list { display: grid; gap: 3px; }
    .octos-nav-link { box-sizing: border-box; width: 100%; display: flex; align-items: center; min-height: 36px;
      padding: 7px 11px; border-radius: 7px; border: 1px solid transparent; background: transparent;
      color: #f1f1ef !important; text-decoration: none !important; font-weight: 550; text-align: left; white-space: normal; }
    .octos-nav-link:hover, .octos-nav-link:focus-visible { background: #292b30; border-color: #53565d; outline: none; }
    .octos-nav-link[aria-current="page"] { border-color: #ff6a1a; background: #ff6a1a17; color: #ffad80 !important; }
    .octos-nav-link[aria-current="page"]::before { content: ""; width: 5px; height: 5px; border-radius: 50%;
      background: #ff6a1a; margin-right: 9px; flex: none; }
    .octos-nav-divider { border: 0; border-top: 1px solid #383a40; margin: 7px 2px; }
    @media (max-width: 790px) {
      .octos-nav-trigger { width: 32px; height: 32px; min-width: 32px; border-radius: 7px; }
      .octos-nav-trigger svg { width: 18px; height: 18px; }
      .octos-themed body > header { grid-template-columns: 113px minmax(0,1fr) 113px !important; column-gap: 4px !important; }
      .octos-themed .ot-head-left { gap: 4px !important; }
      .octos-themed .ot-head-left > button { min-width: 29px !important; width: 29px; padding: 2px 4px !important; }
      .octos-themed .ot-head-left > img { width: 30px !important; height: 30px !important; }
      .octos-themed .ot-head-title strong { font-size: min(var(--ot-titleSize), 17px) !important; }
    }
    @media (min-width: 791px) and (max-width: 1100px) {
      .octos-themed body > header { grid-template-columns: 124px minmax(0,1fr) 124px !important; column-gap: 4px !important; }
      .octos-themed .ot-head-left { gap: 5px !important; }
    }
  `;
  const style = document.createElement('style');
  style.id = 'octos-nav-style';
  style.textContent = css;
  document.head.appendChild(style);

  function install() {
    if (document.getElementById('octos-app-switcher')) return;
    const header = document.querySelector('body > header');
    if (!header) return;
    // The official monogram remains untouched; navigation is immediately to its left.
    const logo = header.querySelector(
      '.ot-head-left > img, .brand-mark, .brand > .mark, .head-left > .logo, .brand > img, img[src*="octos-monograma-t-blanco"], img.icon'
    );
    if (!logo) return;

    const wrap = document.createElement('div');
    wrap.className = 'octos-nav-control';
    wrap.id = 'octos-app-switcher';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'octos-nav-trigger';
    button.title = 'Cambiar de aplicación';
    button.setAttribute('aria-label', 'Abrir navegación entre aplicaciones OcToS');
    button.setAttribute('aria-haspopup', 'true');
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'octos-app-list');
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/><path d="m17 9 3 3-3 3"/></svg>';
    wrap.appendChild(button);
    logo.before(wrap);

    const panel = document.createElement('nav');
    panel.className = 'octos-nav-panel';
    panel.id = 'octos-app-list';
    panel.setAttribute('aria-label', 'Ir a otra aplicación OcToS');
    panel.hidden = true;
    const heading = document.createElement('div');
    heading.className = 'octos-nav-heading';
    heading.textContent = 'NAVEGACIÓN OCTOS';
    panel.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'octos-nav-list';
    const relativePath = location.pathname.startsWith(root.pathname)
      ? location.pathname.slice(root.pathname.length) : '';
    const current = relativePath.split('/')[0] || 'apps';

    for (const app of apps) {
      if (app.id === 'wordpress') {
        const divider = document.createElement('hr');
        divider.className = 'octos-nav-divider';
        list.appendChild(divider);
      }
      const link = document.createElement('a');
      link.className = 'octos-nav-link';
      link.textContent = app.name;
      link.href = app.href || new URL(app.path, root).href;
      if (current === app.id || (app.id === 'apps' && current === 'index.html')) {
        link.setAttribute('aria-current', 'page');
      }
      list.appendChild(link);
    }
    panel.appendChild(list);
    document.body.appendChild(panel);

    function position() {
      if (panel.hidden) return;
      const rect = button.getBoundingClientRect();
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - panel.offsetWidth - 8));
      panel.style.left = left + 'px';
      panel.style.top = Math.max(8, Math.min(rect.bottom + 7, window.innerHeight - Math.min(180, panel.offsetHeight) - 8)) + 'px';
    }
    function setOpen(open) {
      panel.hidden = !open;
      button.setAttribute('aria-expanded', String(open));
      if (open) position();
    }
    button.addEventListener('click', () => setOpen(panel.hidden));
    document.addEventListener('pointerdown', (event) => {
      if (!panel.hidden && !wrap.contains(event.target) && !panel.contains(event.target)) setOpen(false);
    });
    document.addEventListener('keydown', (event) => {
      if (panel.hidden) return;
      if (event.key === 'Escape') { setOpen(false); button.focus(); }
      if (event.key === 'ArrowDown' && document.activeElement === button) {
        event.preventDefault();
        panel.querySelector('a')?.focus();
      }
    });
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true, capture: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
