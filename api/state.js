import { get, put } from '@vercel/blob';

const PATHNAME = 'amanda-painel/estado.json';
const MAX_BYTES = 5 * 1000 * 1000;

function checkAuth(request) {
  const required = process.env.PANEL_PASSWORD;
  if (!required) return true;
  const provided = request.headers.get('x-panel-password') || '';
  return provided === required;
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default async function handler(request) {
  if (!checkAuth(request)) {
    return json({ error: 'unauthorized' }, 401);
  }

  if (request.method === 'GET') {
    try {
      const result = await get(PATHNAME, { access: 'private' });
      if (!result || (result.statusCode && result.statusCode !== 200)) {
        return json({ state: null });
      }
      const text = await new Response(result.stream).text();
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (parseErr) { parsed = null; }
      return json({ state: parsed });
    } catch (err) {
      return json({ state: null });
    }
  }

  if (request.method === 'POST') {
    let body;
    try {
      body = await request.text();
    } catch (err) {
      return json({ error: 'bad_request' }, 400);
    }
    if (!body || body.length > MAX_BYTES) {
      return json({ error: 'too_large' }, 413);
    }
    try {
      JSON.parse(body);
    } catch (err) {
      return json({ error: 'invalid_json' }, 400);
    }
    try {
      await put(PATHNAME, body, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: 'application/json'
      });
      return json({ ok: true });
    } catch (err) {
      return json({ error: 'save_failed', message: String((err && err.message) || err) }, 500);
    }
  }

  return json({ error: 'method_not_allowed' }, 405);
}
