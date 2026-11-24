import { api as request, getAccess, libraryURL, signIn, signOut } from '../shared/access.mjs';

if (document.getElementById('models')) {
  const get = (id) => document.getElementById(id);
  const status = get('status');
  const editor = get('editor');
  const login = get('login');
  const fields = editor.elements;
  const categories = ['Vehículos', 'Cocina', 'Vallas y barreras', 'Otros'];
  const sizeFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
  const profileForm = get('profile');
  const apps = Object.entries({
    modelos: 'Biblioteca de modelos', assets3d: '3D Assets', kitchen: 'Kitchen', aero: 'Aero',
    drive: 'Drive', carto: 'Carto', meteo: 'Meteo', rain: 'Rain', layers: 'Layers',
    templates: 'Templates', garage: 'Garage', gta: 'GTA', roads: 'Roads', wordpress: 'WordPress',
  });
  let session;
  let profiles = [];
  let configured = true;
  let models = [];
  let local = [];
  let editId = '';
  let busy = false;
  let orientation = null;
  let previewGeneration = 0;
  const preview = get('orientation');
  function closePreview() {
    ++previewGeneration;
    orientation?.dispose(); orientation = null;
    preview.hidden = true;
    get('submit').disabled = false;
  }
  async function openPreview(id) {
    const generation = previewGeneration;
    preview.hidden = false;
    get('orientation-status').textContent = 'Cargando modelo…';
    get('orientation-controls').disabled = true;
    get('submit').disabled = true;
    try {
      const [{createOrientation}, response] = await Promise.all([import('./orientation.js?v=1'), request('/models/' + id)]);
      const buffer = await response.arrayBuffer();
      if (generation !== previewGeneration) return;
      const canvas = preview.querySelector('canvas');
      canvas.replaceWith(canvas.cloneNode(false));
      const view = await createOrientation(preview, buffer);
      if (generation !== previewGeneration) { view.dispose(); return; }
      orientation = view;
      get('orientation-controls').disabled = false;
      get('orientation-status').textContent = 'Giro respecto al origen del GLB · X rojo, Y verde, Z azul.';
    } catch (error) {
      if (generation === previewGeneration) get('orientation-status').textContent = 'Vista 3D no disponible: ' + error.message + '. Puedes editar los metadatos.';
    } finally {
      if (generation === previewGeneration) get('submit').disabled = false;
    }
  }

  function message(text, error = false) {
    status.textContent = text;
    status.toggleAttribute('data-error', error);
  }

  function action(label, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', handler);
    return button;
  }

  function render() {
    const root = get('models');
    root.replaceChildren();
    const query = get('search').value.trim().toLocaleLowerCase('es');
    const filter = get('filter').value;
    for (const model of models) {
      if (filter && model.category !== filter) continue;
      if (query && !model.name.toLocaleLowerCase('es').includes(query)) continue;
      const row = document.createElement('article');
      const info = document.createElement('div');
      const title = document.createElement('h3');
      const meta = document.createElement('small');
      title.textContent = model.name;
      meta.textContent = model.category + ' · ' + sizeFormat.format(model.size / 1_000_000) + ' MB · ' + (model.public ? 'Público' : 'Privado');
      info.append(title, meta);
      const actions = document.createElement('div');
      actions.className = 'actions';
      const open = document.createElement('a');
      open.className = 'button';
      open.href = '../assets3d/?modelo=' + model.id;
      open.textContent = 'Abrir en visor';
      actions.append(open);
      if (model.public) actions.append(action('Copiar enlace GLB', () => run(async () => {
        await navigator.clipboard.writeText(libraryURL + '/models/' + model.id);
        message('Enlace GLB copiado.');
      })));
      actions.append(action('Descargar GLB', () => run(async () => {
        const file = await (await request('/models/' + model.id)).blob();
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = model.name.replace(/[\\/:*?"<>|]/g, '_') + '.glb';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      })));
      if (session?.kind === 'master') actions.append(action('Editar', () => { if (!busy) edit(model); }), action('Borrar', () => {
        if (confirm('¿Borrar de la biblioteca online «' + model.name + '»?')) {
          run(async () => {
            await request('/models/' + model.id, { method: 'DELETE' });
            await refresh();
            message('Modelo borrado.');
          });
        }
      }));
      row.append(info, actions);
      root.append(row);
    }
    const empty = document.createElement('p');
    if (!root.children.length) {
      empty.textContent = models.length ? 'Sin resultados para este filtro.' : 'Todavía no hay modelos disponibles.';
      root.append(empty);
    }
  }

  async function refresh() {
    const result = await (await request('/models')).json();
    models = result.models;
    const available = [...new Set([...categories, ...models.map(model => model.category)])].sort((a, b) => a.localeCompare(b, 'es'));
    get('categories').replaceChildren(...available.map(name => new Option(name)));
    const filter = get('filter');
    const selected = filter.value;
    filter.replaceChildren(new Option('Todas las categorías', ''), ...available.map(name => new Option(name)));
    if (available.includes(selected)) filter.value = selected;
    render();
  }

  function readLocalModels() {
    return new Promise((resolve, reject) => {
      const open = indexedDB.open('octos-3d-assets-v1', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('models', { keyPath: 'id' });
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const query = db.transaction('models').objectStore('models').getAll();
        query.onsuccess = () => { db.close(); resolve(query.result.filter(model => model.file instanceof Blob && model.file.size <= 5_000_000)); };
        query.onerror = () => { db.close(); reject(query.error); };
      };
    });
  }

  function edit(model) {
    closePreview();
    editId = model?.id || '';
    editor.reset();
    fields.source.closest('label').hidden = Boolean(editId);
    get('file-label').hidden = Boolean(editId);
    get('cancel').hidden = !editId;
    get('editor-title').textContent = editId ? 'Editar modelo' : 'Añadir modelo';
    get('submit').textContent = editId ? 'Guardar cambios' : 'Subir modelo';
    fields.name.value = model?.name || '';
    fields.category.value = model?.category || '';
    fields.visibility.value = model?.public ? 'public' : 'private';
    renderModelProfiles(model?.profiles || []);
    if (editId) { fields.name.focus(); editor.scrollIntoView({block:'nearest'}); void openPreview(editId); }
  }

  async function run(task) {
    if (busy) return;
    busy = true;
    message('');
    try { await task(); }
    catch (error) { message(error.message, true); }
    finally { busy = false; }
  }

  get('search').addEventListener('input', render);
  get('filter').addEventListener('change', render);
  get('cancel').addEventListener('click', () => edit());
  function checkbox(value, text, checked = false) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = value;
    input.checked = checked;
    label.append(input, text);
    return label;
  }

  get('app-access').append(...apps.map(([id, label]) => checkbox(id, label, id === 'modelos')));
  const selected = root => [...root.querySelectorAll('input:checked')].map(input => input.value);

  function renderModelProfiles(grants) {
    const allowed = profiles.filter(profile => profile.apps.includes('modelos'));
    get('model-profiles').replaceChildren(...allowed.map(profile => checkbox(profile.id, profile.name, grants.includes(profile.id))));
    get('model-access').hidden = fields.visibility.value === 'public' || !allowed.length;
  }

  async function readProfiles() {
    profiles = (await (await request('/access/profiles')).json()).profiles;
    get('profiles').replaceChildren(...profiles.map(profile => {
      const row = document.createElement('article');
      const name = document.createElement('span');
      name.textContent = profile.name + ' · ' + profile.apps.map(id => apps.find(app => app[0] === id)?.[1] || id).join(', ');
      row.append(name, action('Revocar PIN', () => {
        if (!confirm('¿Revocar el PIN de «' + profile.name + '»?')) return;
        run(async () => {
          await request('/access/profiles/' + profile.id, { method: 'DELETE' });
          await readProfiles();
          await refresh();
          message('PIN revocado.');
        });
      }));
      return row;
    }));
    renderModelProfiles(selected(get('model-profiles')));
  }

  async function showSession(value) {
    session = value;
    if (session) login.hidden = true;
    const admin = session?.kind === 'master';
    get('manage').textContent = session ? 'Cerrar sesión' : (configured ? 'Acceder con PIN' : 'Activar acceso');
    editor.hidden = !admin;
    get('permissions').hidden = !admin;
    if (admin) {
      local = await readLocalModels().catch(() => []);
      fields.source.replaceChildren(new Option('Archivo GLB', 'file'), ...local.map((model, index) => new Option('Local · ' + model.name, String(index))));
      await readProfiles();
    } else {
      edit();
      profiles = [];
      models = models.filter(model => model.public);
      render();
    }
    await refresh();
  }

  get('manage').addEventListener('click', () => {
    if (busy) return;
    if (session) {
      run(async () => { await signOut(); await showSession(null); });
    } else {
      login.hidden = !login.hidden;
      if (!login.hidden) (configured ? login.elements.pin : login.elements.code).focus();
    }
  });

  login.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      const value = await signIn(login.elements.pin.value, configured ? '' : login.elements.code.value.trim());
      login.reset();
      configured = true;
      get('activation').hidden = true;
      login.elements.code.required = false;
      await showSession(value);
    });
  });

  profileForm.addEventListener('submit', event => {
    event.preventDefault();
    run(async () => {
      await request('/access/profiles', { method: 'POST', body: {
        name: profileForm.elements.alias.value,
        pin: profileForm.elements.pin.value,
        apps: selected(get('app-access')),
      }});
      profileForm.reset();
      await readProfiles();
      message('PIN registrado.');
    });
  });

  fields.visibility.addEventListener('change', () => renderModelProfiles(selected(get('model-profiles'))));
  window.addEventListener('octos-access', event => {
    if (busy || event.detail?.id === session?.id) return;
    run(() => showSession(event.detail));
  });

  fields.source.addEventListener('change', () => {
    get('file-label').hidden = fields.source.value !== 'file';
    if (fields.source.value !== 'file') fields.name.value = local[Number(fields.source.value)].name;
  });
  fields.file.addEventListener('change', () => {
    if (!fields.name.value && fields.file.files[0]) fields.name.value = fields.file.files[0].name.replace(/\.glb$/i, '');
  });

  editor.addEventListener('submit', (event) => {
    event.preventDefault();
    if (get('submit').disabled) return;
    run(async () => {
      const details = { name: fields.name.value.trim(), category: fields.category.value.trim(), public: fields.visibility.value === 'public', profiles: selected(get('model-profiles')) };
      const original = models.find(model => model.id === editId);
      if (details.public && !original?.public && !confirm('Cualquier persona con el enlace podrá descargar este GLB. ¿Publicarlo?')) return;
      if (editId) await request('/models/' + editId, { method: 'PATCH', details, body: orientation?.getFile() });
      else {
        const body = fields.source.value === 'file' ? fields.file.files[0] : local[Number(fields.source.value)]?.file;
        if (!body || body.size > 5_000_000) throw new Error('Selecciona un GLB de hasta 5 MB.');
        await request('/models', { method: 'POST', details, body });
      }
      const edited = Boolean(editId);
      edit();
      await refresh();
      message(edited ? 'Cambios guardados.' : 'Modelo subido.');
    });
  });

  run(async () => {
    const access = await getAccess();
    configured = access.configured;
    get('activation').hidden = configured;
    login.elements.code.required = !configured;
    await showSession(access.session);
  });
}
