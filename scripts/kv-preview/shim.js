// Preview-only shim: serves dist/ files from the SITE KV namespace with
// Cloudflare Pages-like semantics (pretty URLs, directory indexes, _redirects),
// then hands /api/* and everything else to the real site worker (src/_worker.js)
// by giving it a fake env.ASSETS. Used only because the preview was deployed
// through the Cloudflare API without wrangler. A normal `wrangler pages deploy dist`
// uses Pages static assets and does not need this file.
async function kvGet(env, key) {
  const r = await env.SITE.getWithMetadata(key, 'arrayBuffer');
  return r && r.value ? r : null;
}
let __rules = null;
async function redirectRules(env) {
  if (__rules) return __rules;
  const r = await kvGet(env, '/_redirects');
  const text = r ? new TextDecoder().decode(r.value) : '';
  __rules = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => l.split(/\s+/)).filter(p => p.length >= 2)
    .map(([from, to, code]) => ({ from, to, code: Number(code || 302) }));
  return __rules;
}
function matchRule(rule, path) {
  if (rule.from.endsWith('/*')) {
    const base = rule.from.slice(0, -1);
    if (path.startsWith(base)) return rule.to.replace(':splat', path.slice(base.length));
    return null;
  }
  return rule.from === path ? rule.to : null;
}
function respond(r, status = 200) {
  const ct = (r.metadata && r.metadata.ct) || 'application/octet-stream';
  return new Response(r.value, { status, headers: { 'content-type': ct, 'cache-control': 'public, max-age=60' } });
}
async function serveKV(request, env) {
  const url = new URL(request.url);
  let path = decodeURIComponent(url.pathname);
  for (const rule of await redirectRules(env)) {
    const to = matchRule(rule, path);
    if (to !== null && to !== path) return Response.redirect(new URL(to, url).toString(), rule.code);
  }
  // Like real Pages, never serve control files (/_redirects, /_routes.json) or
  // anything else under /_ (e.g. the staged /__deploy/worker.js). /_redirects is
  // still read above through kvGet, which this check doesn't touch.
  if (path.startsWith('/_')) return notFound(env);
  // Pretty URLs: /x.html -> /x, /dir/index.html -> /dir/
  if (path.endsWith('/index.html')) return Response.redirect(new URL(path.slice(0, -10) + url.search, url).toString(), 308);
  if (path.endsWith('.html')) return Response.redirect(new URL(path.slice(0, -5) + url.search, url).toString(), 308);
  let r;
  if (path.endsWith('/')) r = await kvGet(env, path + 'index.html');
  else {
    r = await kvGet(env, path);
    if (!r) {
      const asHtml = await kvGet(env, path + '.html');
      if (asHtml) r = asHtml;
      else if (await kvGet(env, path + '/index.html')) return Response.redirect(new URL(path + '/' + url.search, url).toString(), 308);
    }
  }
  if (r) return respond(r);
  return notFound(env);
}
async function notFound(env) {
  const nf = await kvGet(env, '/404.html');
  return nf ? respond(nf, 404) : new Response('Not found', { status: 404 });
}
