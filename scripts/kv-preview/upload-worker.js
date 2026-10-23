// Temporary upload Worker for the API/KV deploy path (see README.md here).
// Deploy it as "dm-upload-staging" with the SITE KV namespace bound as STAGE
// and a secret UPLOAD_NONCE; delete it again once the Pages deployment is done.
//
//   PUT    /<path>   body = raw file bytes, stored at key "/<path>" with
//                    metadata {ct: <request content-type>}
//   DELETE /<path>   deletes key "/<path>"
//   GET    /__list   JSON array of every key name in STAGE
//
// Every request needs header x-nonce equal to env.UPLOAD_NONCE. If the secret
// isn't set, every request is rejected.

async function sameSecret(given, expected) {
  // Compare digests so the lengths always match for timingSafeEqual.
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([given, expected].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))));
  return crypto.subtle.timingSafeEqual(a, b);
}

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

async function listKeys(kv) {
  const names = [];
  let cursor;
  do {
    const page = await kv.list({ cursor, limit: 1000 });
    names.push(...page.keys.map((k) => k.name));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return names;
}

export default {
  async fetch(request, env) {
    if (!env.UPLOAD_NONCE) return json({ ok: false, error: 'UPLOAD_NONCE is not set' }, 503);
    if (!env.STAGE) return json({ ok: false, error: 'STAGE binding is missing' }, 503);
    if (!(await sameSecret(request.headers.get('x-nonce') || '', env.UPLOAD_NONCE))) {
      return json({ ok: false, error: 'forbidden' }, 403);
    }

    const url = new URL(request.url);
    let key;
    try {
      key = decodeURIComponent(url.pathname);
    } catch {
      return json({ ok: false, error: 'bad path' }, 400);
    }

    if (request.method === 'GET' && key === '/__list') return json(await listKeys(env.STAGE));
    if (key === '/' || key === '/__list') return json({ ok: false, error: 'bad path' }, 400);

    if (request.method === 'PUT') {
      const ct = request.headers.get('content-type') || 'application/octet-stream';
      const body = await request.arrayBuffer();
      await env.STAGE.put(key, body, { metadata: { ct } });
      return json({ ok: true, key, bytes: body.byteLength, ct });
    }
    if (request.method === 'DELETE') {
      await env.STAGE.delete(key);
      return json({ ok: true, key });
    }
    return new Response('Method not allowed', { status: 405, headers: { allow: 'PUT, DELETE, GET' } });
  },
};
