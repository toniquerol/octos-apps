import { access, getSession } from './access.mjs';

const siteOrigin = 'https://toniquerol.github.io';
const limit = 5_000_000;
const chunkSize = 512_000;
const glbType = 'model/gltf-binary';
const headers = {
  'Access-Control-Allow-Origin': siteOrigin,
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => Response.json(body, { status, headers });
const fail = (error, status) => json({ error }, status);

function metadata(request) {
  try {
    const value = JSON.parse(decodeURIComponent(request.headers.get('X-Model-Metadata') || ''));
    const name = typeof value.name === 'string' && value.name.trim();
    const category = typeof value.category === 'string' && value.category.trim();
    if (name && name.length <= 120 && category && category.length <= 60 && typeof value.public === 'boolean') {
      const profiles = Array.isArray(value.profiles) ? [...new Set(value.profiles)] : [];
      if (profiles.length > 30 || profiles.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id))) return null;
      return { name, category, public: value.public, profiles };
    }
  } catch {
    return null;
  }
  return null;
}

async function readModel(request) {
  const reader = request.body?.getReader();
  if (!reader) return null;
  const buffer = new Uint8Array(limit);
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (size + value.length > limit) {
      await reader.cancel();
      return null;
    }
    buffer.set(value, size);
    size += value.length;
  }
  const view = new DataView(buffer.buffer);
  if (size < 20 || view.getUint32(0, true) !== 0x46546c67 ||
      view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== size ||
      view.getUint32(16, true) !== 0x4e4f534a || view.getUint32(12, true) + 20 > size) return null;
  return buffer.subarray(0, size);
}

function grantAccess(db, modelId, profiles) {
  return profiles.map(id => db.prepare(`INSERT INTO model_access (model_id, profile_id)
    SELECT ?, id FROM access_profiles WHERE EXISTS (SELECT 1 FROM models WHERE id = ?) AND id = ? AND kind <> 'master'`).bind(modelId, modelId, id));
}

const visibility = `(public = 1 OR ? = 1 OR EXISTS (
  SELECT 1 FROM model_access a WHERE a.model_id = models.id AND a.profile_id = ?
))`;

async function upload(request, db) {
  const details = metadata(request);
  if (!details) return fail('Indica un nombre, una categoría y la visibilidad.', 400);
  const bytes = await readModel(request);
  if (!bytes) return fail('Selecciona un GLB 2.0 válido de hasta 5 MB.', 400);
  const id = crypto.randomUUID();
  const statements = [db.prepare('INSERT INTO models (id, name, category, size, public) VALUES (?, ?, ?, ?, ?)')
    .bind(id, details.name, details.category, bytes.length, Number(details.public))];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    statements.push(db.prepare('INSERT INTO model_chunks (model_id, position, data) VALUES (?, ?, ?)')
      .bind(id, offset / chunkSize, bytes.slice(offset, offset + chunkSize).buffer));
  }
  await db.batch([...statements, ...grantAccess(db, id, details.profiles)]);
  return json({ id }, 201);
}

async function download(db, id, admin, profileId) {
  const row = await db.prepare(`SELECT size FROM models WHERE id = ? AND ${visibility}`)
    .bind(id, Number(admin), profileId).first();
  if (!row) return fail('Modelo no disponible.', 404);
  const chunks = Math.ceil(row.size / chunkSize);
  let position = 0;
  const stream = new ReadableStream({
    async pull(controller) {
      const part = await db.prepare('SELECT data FROM model_chunks WHERE model_id = ? AND position = ?')
        .bind(id, position).first('data');
      if (!part) throw new Error('Falta un fragmento del modelo.');
      controller.enqueue(Uint8Array.from(part));
      position += 1;
      if (position === chunks) controller.close();
    },
  });
  return new Response(stream, {
    headers: { ...headers, 'Content-Type': glbType, 'Content-Length': String(row.size) },
  });
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    const method = request.method;
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        ...headers,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Model-Metadata',
      } });
    }
    try {
      const db = env.LIBRARY;
      const session = await getSession(request, db);
      if (pathname === '/access' || pathname.startsWith('/access/')) return await access(request, env, session, json, fail);
      const admin = session?.kind === 'master';
      const profileId = session?.apps.includes('modelos') ? session.id : '';
      if (!admin && method !== 'GET') return fail('Esta operación requiere el PIN maestro.', 403);
      if (pathname === '/models' && method === 'GET') {
        const { results } = await db.prepare(`SELECT id, name, category, size, public FROM models WHERE ${visibility} ORDER BY created_at DESC, id`)
          .bind(Number(admin), profileId).all();
        if (admin) {
          const grants = (await db.prepare('SELECT model_id, profile_id FROM model_access').all()).results;
          const byModel = new Map();
          for (const grant of grants) {
            if (!byModel.has(grant.model_id)) byModel.set(grant.model_id, []);
            byModel.get(grant.model_id).push(grant.profile_id);
          }
          for (const model of results) model.profiles = byModel.get(model.id) || [];
        }
        return json({ models: results, admin });
      }
      if (pathname === '/models' && method === 'POST') return await upload(request, db);
      const id = /^\/models\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(pathname)?.[1];
      if (!id) return fail('Modelo no disponible.', 404);
      if (method === 'GET') return await download(db, id, admin, profileId);
      if (method === 'PATCH') {
        const details = metadata(request);
        if (!details) return fail('Revisa el nombre, la categoría y la visibilidad.', 400);
        const bytes = request.body ? await readModel(request) : null;
        if (request.body && !bytes) return fail('GLB no válido o superior a 5 MB.', 400);
        const replacement = [];
        if (bytes) {
          const exists = await db.prepare('SELECT id FROM models WHERE id = ?').bind(id).first();
          if (!exists) return fail('Modelo no disponible.', 404);
          replacement.push(db.prepare('DELETE FROM model_chunks WHERE model_id = ?').bind(id));
          for (let offset = 0; offset < bytes.length; offset += chunkSize) {
            replacement.push(db.prepare('INSERT INTO model_chunks (model_id, position, data) SELECT id, ?, ? FROM models WHERE id = ?').bind(offset / chunkSize, bytes.slice(offset, offset + chunkSize).buffer, id));
          }
        }
        const [{ meta }] = await db.batch([
          db.prepare('UPDATE models SET name = ?, category = ?, public = ?, size = COALESCE(?, size) WHERE id = ?')
            .bind(details.name, details.category, Number(details.public), bytes?.length ?? null, id),
          ...replacement,
          db.prepare('DELETE FROM model_access WHERE model_id = ?').bind(id),
          ...grantAccess(db, id, details.profiles),
        ]);
        return meta.changes ? json({ id }) : fail('Modelo no disponible.', 404);
      }
      if (method === 'DELETE') {
        const { meta } = await db.prepare('DELETE FROM models WHERE id = ?').bind(id).run();
        return meta.changes ? json({ id }) : fail('Modelo no disponible.', 404);
      }
      return fail('Operación no disponible.', 405);
    } catch (error) {
      console.error(error?.message);
      return fail('El servicio de la biblioteca no está disponible. Vuelve a intentarlo.', 503);
    }
  },
};
