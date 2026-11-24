const origin = 'https://toniquerol.github.io';
const idleSeconds = 900;
const maxSeconds = 43200;
const pinFormat = /^(?:[0-9]{4}|[0-9]{6})$/;
const appFormat = /^[a-z][a-z0-9-]{0,32}$/;
const encoder = new TextEncoder();

const hex = bytes => Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
const digest = async text => hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
const time = () => Math.floor(Date.now() / 1000);

async function fingerprint(env, pin) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.PIN_PEPPER), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(pin)));
}

export async function configured(db) {
  return Boolean(await db.prepare("SELECT 1 FROM access_profiles WHERE id = 'master'").first());
}

export async function getSession(request, db) {
  const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get('Authorization') || '')?.[1];
  if (!token) return null;
  const key = await digest(token);
  const now = time();
  const row = await db.prepare(`SELECT p.id, p.name, p.kind, p.apps, s.idle_until, s.end_at
    FROM access_sessions s JOIN access_profiles p ON p.id = s.profile_id
    WHERE s.token_key = ? AND s.idle_until > ? AND s.end_at > ?`).bind(key, now, now).first();
  if (!row) return null;
  return { key, id: row.id, name: row.name, kind: row.kind, apps: JSON.parse(row.apps), idleUntil: row.idle_until, endAt: row.end_at };
}

function describe(session) {
  if (!session) return null;
  const { id, name, kind, apps, idleUntil } = session;
  return { id, name, kind, apps, idleUntil };
}

async function openSession(db, profileId, json) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const now = time();
  const key = await digest(token);
  await db.batch([
    db.prepare('DELETE FROM access_sessions WHERE idle_until <= ?').bind(now),
    db.prepare('INSERT INTO access_sessions (token_key, profile_id, idle_until, end_at) VALUES (?, ?, ?, ?)')
      .bind(key, profileId, now + idleSeconds, now + maxSeconds),
  ]);
  const session = await getSession(new Request(origin, { headers: { Authorization: 'Bearer ' + token } }), db);
  return json({ token, session: describe(session) });
}

async function withinLimits(db, request) {
  const now = time();
  const ip = await digest(request.headers.get('CF-Connecting-IP') || 'unknown');
  const expiry = now + 900;
  const increment = db.prepare(`INSERT INTO access_limits (id, expires_at, attempts) VALUES (?, ?, 1)
    ON CONFLICT(id) DO UPDATE SET expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END,
    attempts = CASE WHEN expires_at <= ? THEN 1 ELSE attempts + 1 END
    RETURNING attempts`);
  const [source, global] = await db.batch([
    increment.bind('ip:' + ip, expiry, now, now),
    increment.bind('global', expiry, now, now),
    db.prepare("DELETE FROM access_limits WHERE expires_at <= ? AND id <> 'global'").bind(now),
  ]);
  return source.results[0].attempts <= 8 && global.results[0].attempts <= 25;
}

async function readJSON(request) {
  const body = await request.text();
  if (body.length > 4096) return null;
  try { return JSON.parse(body); } catch { return null; }
}

export async function access(request, env, session, json, fail) {
  const db = env.LIBRARY;
  const path = new URL(request.url).pathname;
  const method = request.method;
  if (path === '/access' && method === 'GET') return json({ configured: await configured(db), session: describe(session) });
  if (request.headers.get('Origin') !== origin) return fail('Origen de acceso no autorizado.', 403);

  if (path === '/access/setup' && method === 'POST') {
    if (await configured(db)) return fail('El acceso con PIN ya está activado.', 409);
    const input = await readJSON(request);
    if (!input || typeof input.code !== 'string' || typeof input.pin !== 'string' ||
        !/^[0-9]{6}$/.test(input.pin) || await digest(input.code.trim()) !== env.SETUP_HASH) {
      return fail('Comprueba el código de activación y el PIN maestro de seis dígitos.', 400);
    }
    const result = await db.prepare("INSERT OR IGNORE INTO access_profiles VALUES ('master', 'Maestro', ?, 'master', '[]')")
      .bind(await fingerprint(env, input.pin)).run();
    if (!result.meta.changes) return fail('El acceso con PIN ya está activado.', 409);
    return openSession(db, 'master', json);
  }

  if (path === '/access/login' && method === 'POST') {
    if (!await configured(db)) return fail('El titular debe activar primero el acceso con PIN.', 409);
    const input = await readJSON(request);
    if (typeof input?.pin !== 'string' || !pinFormat.test(input.pin)) return fail('Introduce un PIN de cuatro o seis dígitos.', 400);
    if (!await withinLimits(db, request)) return fail('Demasiados intentos. Vuelve a intentarlo en 15 minutos.', 429);
    const profile = await db.prepare('SELECT id FROM access_profiles WHERE pin_key = ?')
      .bind(await fingerprint(env, input.pin)).first();
    if (!profile) return fail('PIN incorrecto.', 401);
    await db.prepare('DELETE FROM access_limits WHERE id = ?')
      .bind('ip:' + await digest(request.headers.get('CF-Connecting-IP') || 'unknown')).run();
    return openSession(db, profile.id, json);
  }

  if (path === '/access/logout' && method === 'POST') {
    if (session) await db.prepare('DELETE FROM access_sessions WHERE token_key = ?').bind(session.key).run();
    return json({ session: null });
  }
  if (!session) return fail('Inicia sesión con tu PIN OcToS.', 401);
  if (path === '/access/keepalive' && method === 'POST') {
    const idleUntil = Math.min(time() + idleSeconds, session.endAt);
    await db.prepare('UPDATE access_sessions SET idle_until = ? WHERE token_key = ?').bind(idleUntil, session.key).run();
    return json({ session: describe({ ...session, idleUntil }) });
  }
  if (session.kind !== 'master') return fail('Esta operación requiere el PIN maestro.', 403);
  if (path === '/access/profiles' && method === 'GET') {
    const { results } = await db.prepare("SELECT id, name, kind, apps FROM access_profiles WHERE kind <> 'master' ORDER BY name").all();
    return json({ profiles: results.map(profile => ({ ...profile, apps: JSON.parse(profile.apps) })) });
  }
  if (path === '/access/profiles' && method === 'POST') {
    const input = await readJSON(request);
    const name = typeof input?.name === 'string' ? input.name.trim() : '';
    const pin = typeof input?.pin === 'string' ? input.pin : '';
    const apps = Array.isArray(input?.apps) ? [...new Set(input.apps)] : [];
    if (!name || name.length > 50 || !pinFormat.test(pin) || !apps.length || apps.length > 30 ||
        apps.some(app => typeof app !== 'string' || !appFormat.test(app) || app === 'team')) {
      return fail('Indica un alias, un PIN de cuatro o seis dígitos y sus permisos.', 400);
    }
    const id = crypto.randomUUID();
    const result = await db.prepare(`INSERT OR IGNORE INTO access_profiles (id, name, pin_key, kind, apps)
      SELECT ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM access_profiles) < 31`)
      .bind(id, name, await fingerprint(env, pin), pin.length === 4 ? 'apps' : 'secondary', JSON.stringify(apps)).run();
    return result.meta.changes ? json({ id }, 201) : fail('El PIN ya existe o se alcanzó el límite de 30 perfiles.', 409);
  }
  const id = /^\/access\/profiles\/([0-9a-f-]{36})$/.exec(path)?.[1];
  if (id && method === 'DELETE') {
    const result = await db.prepare("DELETE FROM access_profiles WHERE id = ? AND kind <> 'master'").bind(id).run();
    return result.meta.changes ? json({ id }) : fail('Perfil no disponible.', 404);
  }
  return fail('Operación de acceso no disponible.', 404);
}
