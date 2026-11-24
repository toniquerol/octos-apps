const siteOrigin = 'https://toniquerol.github.io';
const ownerId = 322857552;
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

async function isAdmin(request) {
  const authorization = request.headers.get('Authorization');
  if (!authorization || !/^Bearer [A-Za-z0-9_]+$/.test(authorization)) return false;
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: authorization, 'User-Agent': 'OcToS-Modelos' },
    signal: AbortSignal.timeout(7000),
  });
  return response.ok && (await response.json()).id === ownerId;
}

function metadata(request) {
  try {
    const value = JSON.parse(decodeURIComponent(request.headers.get('X-Model-Metadata') || ''));
    const name = typeof value.name === 'string' && value.name.trim();
    const category = typeof value.category === 'string' && value.category.trim();
    if (name && name.length <= 120 && category && category.length <= 60 && typeof value.public === 'boolean') {
      return { name, category, public: value.public };
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
  await db.batch(statements);
  return json({ id }, 201);
}

async function download(db, id, admin) {
  const row = await db.prepare('SELECT size FROM models WHERE id = ? AND (public = 1 OR ? = 1)')
    .bind(id, Number(admin)).first();
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
      const admin = request.headers.has('Authorization') && await isAdmin(request);
      if (!admin && (method !== 'GET' || request.headers.has('Authorization'))) {
        return fail('Se requiere autorización de Toni para esta operación.', 401);
      }
      const db = env.LIBRARY;
      if (pathname === '/models' && method === 'GET') {
        const { results } = await db.prepare('SELECT id, name, category, size, public FROM models WHERE public = 1 OR ? = 1 ORDER BY created_at DESC, id')
          .bind(Number(admin)).all();
        return json({ models: results, admin });
      }
      if (pathname === '/models' && method === 'POST') return await upload(request, db);
      const id = /^\/models\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/.exec(pathname)?.[1];
      if (!id) return fail('Modelo no disponible.', 404);
      if (method === 'GET') return await download(db, id, admin);
      if (method === 'PATCH') {
        const details = metadata(request);
        if (!details) return fail('Revisa el nombre, la categoría y la visibilidad.', 400);
        const { meta } = await db.prepare('UPDATE models SET name = ?, category = ?, public = ? WHERE id = ?')
          .bind(details.name, details.category, Number(details.public), id).run();
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
