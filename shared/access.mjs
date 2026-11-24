export const libraryURL = 'https://octos-assets-library.toniquerolalegre.workers.dev';
const key = 'octos-pin-session-v1';
let lastUpdate = Date.now();
let session;

function storedToken() {
  try { return localStorage.getItem(key); }
  catch { return null; }
}

function saveToken(token) {
  try {
    if (token) localStorage.setItem(key, token);
    else localStorage.removeItem(key);
  } catch { /* Browsing mode may limit storage. */ }
}

export async function api(path, { method = 'GET', body, details } = {}) {
  const headers = {};
  const token = storedToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  if (details) headers['X-Model-Metadata'] = encodeURIComponent(JSON.stringify(details));
  if (body instanceof Blob) headers['Content-Type'] = 'model/gltf-binary';
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(libraryURL + path, { method, body, headers });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || 'No se pudo conectar con OcToS.');
  return response;
}

function apply(value) {
  session = value;
  if (!value && storedToken()) saveToken(null);
  window.dispatchEvent(new CustomEvent('octos-access', { detail: value }));
}

export async function getAccess() {
  const token = storedToken();
  const data = await (await api('/access')).json();
  if (token === storedToken()) apply(data.session);
  return data;
}

export async function signIn(pin, code) {
  const { token, session: value } = await (await api('/access/' + (code ? 'setup' : 'login'), {
    method: 'POST', body: code ? { pin, code } : { pin },
  })).json();
  saveToken(token);
  lastUpdate = Date.now();
  apply(value);
  return value;
}

export async function signOut() {
  await api('/access/logout', { method: 'POST' });
  apply(null);
}

async function touch() {
  const token = storedToken();
  if (!token || Date.now() - lastUpdate < 30000) return;
  lastUpdate = Date.now();
  try {
    const response = await fetch(libraryURL + '/access/keepalive', {
      method: 'POST', headers: { Authorization: 'Bearer ' + token },
    });
    if (storedToken() !== token) return;
    if (response.status === 401) apply(null);
    if (response.ok) session = (await response.json()).session;
  } catch { /* Server-side expiration still applies. */ }
}

for (const event of ['pointerdown', 'keydown']) window.addEventListener(event, touch, { passive: true });
window.addEventListener('storage', event => {
  if (event.key === key) getAccess().catch(() => {});
});
setInterval(() => {
  if (storedToken() && session && session.idleUntil * 1000 <= Date.now()) getAccess().catch(() => {});
}, 15000);
