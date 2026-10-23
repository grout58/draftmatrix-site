// Stopgap deploy step for the API/KV path (see README.md here). After
// upload.sh has put dist/ and /__deploy/worker.js into the SITE KV namespace,
// this creates the Pages deployment for project "draftmatrix-site":
//
//   1. reads /__deploy/worker.js (shim + dist/_worker.js + tail) from that namespace,
//   2. POSTs a multipart deployment to
//      /accounts/{accountId}/pages/projects/draftmatrix-site/deployments
//      with manifest="{}", branch, commit_hash, commit_message, commit_dirty
//      and the script as the `_worker.js` file part,
//   3. deletes the staged /__deploy/worker.js key (only after the POST succeeded,
//      so a failed deploy can be retried without re-running upload.sh).
//
// As a library (e.g. from a connector that can only call api.cloudflare.com):
//
//   import { deployViaApi } from './deploy-via-api.js';
//   const deployment = await deployViaApi({
//     request,            // see below
//     accountId, filesNamespaceId,   // SITE namespace id
//     branch: 'main', commitHash, commitMessage, commitDirty: false,
//   });
//
//   request({ method, path, body, contentType, rawBody }) sends one call to
//   https://api.cloudflare.com/client/v4 + path with the caller's own auth.
//   `body` is a JSON value (sent as application/json); `rawBody` is a string or
//   Uint8Array sent as-is with `contentType`. It may resolve to a fetch
//   Response, or to the already-read body (string or parsed JSON).
//
// From the command line (Node 22+; credentials only from the environment):
//
//   CF_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... SITE_NAMESPACE_ID=... \
//     node scripts/kv-preview/deploy-via-api.js [branch]
//
//   The token needs Account > Cloudflare Pages > Edit and
//   Account > Workers KV Storage > Edit. Commit hash/message come from git.

const PROJECT = 'draftmatrix-site';
const STAGED_KEY = '/__deploy/worker.js';

async function readText(res) {
  if (typeof res === 'string') return res;
  if (res instanceof Uint8Array) return new TextDecoder().decode(res);
  if (res && typeof res.text === 'function') {
    if (res.ok === false) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.text();
  }
  throw new Error(`unexpected response: ${JSON.stringify(res)?.slice(0, 300)}`);
}

async function readJson(res) {
  if (res && typeof res.text === 'function') return JSON.parse(await res.text());
  if (typeof res === 'string') return JSON.parse(res);
  return res;
}

function checkApi(what, body) {
  if (!body || body.success !== true) throw new Error(`${what} failed: ${JSON.stringify(body?.errors ?? body)}`);
  return body.result;
}

function multipart(fields, file) {
  const boundary = `----dm${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const enc = new TextEncoder();
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  parts.push(enc.encode(
    `--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.name}"\r\n` +
    `Content-Type: ${file.type}\r\n\r\n`));
  parts.push(enc.encode(file.content));
  parts.push(enc.encode(`\r\n--${boundary}--\r\n`));
  const bytes = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) { bytes.set(p, at); at += p.length; }
  return { bytes, contentType: `multipart/form-data; boundary=${boundary}` };
}

export async function deployViaApi({
  request, accountId, filesNamespaceId, branch = 'main', commitHash, commitMessage, commitDirty = false,
}) {
  if (!request || !accountId || !filesNamespaceId) throw new Error('request, accountId and filesNamespaceId are required');
  const valuePath = `/accounts/${accountId}/storage/kv/namespaces/${filesNamespaceId}/values/${encodeURIComponent(STAGED_KEY)}`;

  const script = await readText(await request({ method: 'GET', path: valuePath }));
  if (!script.includes('const __site = {') || !script.includes('async function serveKV')) {
    throw new Error(`${STAGED_KEY} doesn't look like the composed preview worker; re-run upload.sh`);
  }

  const form = multipart({
    manifest: '{}',
    branch,
    commit_hash: commitHash || '',
    commit_message: commitMessage || '',
    commit_dirty: String(Boolean(commitDirty)),
  }, { name: '_worker.js', type: 'application/javascript', content: script });
  const deployment = checkApi('deployment', await readJson(await request({
    method: 'POST',
    path: `/accounts/${accountId}/pages/projects/${PROJECT}/deployments`,
    rawBody: form.bytes,
    contentType: form.contentType,
  })));

  checkApi('deleting staged worker', await readJson(await request({ method: 'DELETE', path: valuePath })));
  return deployment;
}

// ---- CLI ----

async function main() {
  const { execFileSync } = await import('node:child_process');
  const env = process.env;
  const missing = ['CF_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN', 'SITE_NAMESPACE_ID'].filter((n) => !env[n]);
  if (missing.length) {
    console.error(`Missing environment variable(s): ${missing.join(', ')}. See scripts/kv-preview/README.md.`);
    process.exit(1);
  }
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const request = ({ method, path, body, contentType, rawBody }) => fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      ...(rawBody !== undefined ? { 'content-type': contentType } : body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined,
  });
  const d = await deployViaApi({
    request,
    accountId: env.CF_ACCOUNT_ID,
    filesNamespaceId: env.SITE_NAMESPACE_ID,
    branch: process.argv[2] || 'main',
    commitHash: git('rev-parse', 'HEAD'),
    commitMessage: git('log', '-1', '--format=%s'),
    commitDirty: git('status', '--porcelain') !== '',
  });
  console.log(`deployment ${d.id} (${d.environment}) ${d.url}`);
}

if (typeof process !== 'undefined' && process.argv?.[1]) {
  const { pathToFileURL } = await import('node:url');
  if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    main().catch((e) => { console.error(e.message || e); process.exit(1); });
  }
}
