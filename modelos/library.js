export const libraryURL = 'https://octos-assets-library.toniquerolalegre.workers.dev';

if (document.getElementById('models')) {
  const get = (id) => document.getElementById(id);
  const status = get('status');
  const editor = get('editor');
  const login = get('login');
  const fields = editor.elements;
  const categories = ['Vehículos', 'Cocina', 'Vallas y barreras', 'Otros'];
  const sizeFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });
  let token = '';
  let models = [];
  let local = [];
  let editId = '';
  let busy = false;

  function message(text, error = false) {
    status.textContent = text;
    status.toggleAttribute('data-error', error);
  }

  async function request(path, { method = 'GET', body, details } = {}) {
    const headers = {};
    if (token) headers.Authorization = 'Bearer ' + token;
    if (details) headers['X-Model-Metadata'] = encodeURIComponent(JSON.stringify(details));
    if (body) headers['Content-Type'] = 'model/gltf-binary';
    const response = await fetch(libraryURL + path, { method, body, headers });
    if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'No se pudo conectar con la biblioteca.');
    return response;
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
      if (model.public) {
        const open = document.createElement('a');
        open.className = 'button';
        open.href = '../assets3d/?modelo=' + model.id;
        open.textContent = 'Abrir en visor';
        actions.append(open, action('Copiar enlace GLB', () => run(async () => {
          await navigator.clipboard.writeText(libraryURL + '/models/' + model.id);
          message('Enlace GLB copiado.');
        })));
      }
      actions.append(action('Descargar GLB', () => run(async () => {
        const file = await (await request('/models/' + model.id)).blob();
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = model.name.replace(/[\\/:*?"<>|]/g, '_') + '.glb';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 30000);
      })));
      if (token) actions.append(action('Editar', () => edit(model)), action('Borrar', () => {
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
    if (editId) fields.name.focus();
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
  get('manage').addEventListener('click', () => {
    if (busy) return;
    if (!token) {
      login.hidden = !login.hidden;
      if (!login.hidden) login.elements.token.focus();
      return;
    }
    token = '';
    models = models.filter(model => model.public);
    render();
    editor.hidden = true;
    get('manage').textContent = 'Gestionar biblioteca';
    run(refresh);
  });

  login.addEventListener('submit', (event) => {
    event.preventDefault();
    run(async () => {
      token = login.elements.token.value.trim();
      login.reset();
      try { await refresh(); }
      catch (error) { token = ''; throw error; }
      login.hidden = true;
      editor.hidden = false;
      get('manage').textContent = 'Cerrar gestión';
      edit();
      local = await readLocalModels().catch(() => []);
      fields.source.replaceChildren(new Option('Archivo GLB', 'file'), ...local.map((model, index) => new Option('Local · ' + model.name, String(index))));
    });
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
    run(async () => {
      const details = { name: fields.name.value.trim(), category: fields.category.value.trim(), public: fields.visibility.value === 'public' };
      const original = models.find(model => model.id === editId);
      if (details.public && !original?.public && !confirm('Cualquier persona con el enlace podrá descargar este GLB. ¿Publicarlo?')) return;
      if (editId) await request('/models/' + editId, { method: 'PATCH', details });
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

  run(refresh);
}
