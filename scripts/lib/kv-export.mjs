// Shared helpers for scripts/export-signups.mjs and scripts/export-feedback.mjs.
// Dependency-free (Node 18+ fetch). Reads a whole KV namespace through the
// Cloudflare REST API. Credentials come only from the environment:
//   CF_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (needs "Workers KV Storage: Read").

const API = "https://api.cloudflare.com/client/v4";
const CONCURRENCY = 6;

export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing environment variable(s): ${missing.join(", ")}`);
    console.error("See README.md, \"Exporting signups and feedback\".");
    process.exit(1);
  }
  return names.map((n) => process.env[n]);
}

// GET with retries on 429 / 5xx (the API is rate limited per user).
async function request(url, token, attempt = 0) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
    await new Promise((done) => setTimeout(done, wait));
    return request(url, token, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} for ${url.replace(/\/values\/.*/, "/values/…")}\n${await res.text()}`);
  }
  return res;
}

// Every key name in the namespace (optionally under a prefix), following cursors.
export async function listKeys({ account, namespace, token, prefix = "" }) {
  const base = `${API}/accounts/${account}/storage/kv/namespaces/${namespace}`;
  const names = [];
  let cursor = "";
  do {
    const q = new URLSearchParams({ limit: "1000" });
    if (prefix) q.set("prefix", prefix);
    if (cursor) q.set("cursor", cursor);
    const body = await (await request(`${base}/keys?${q}`, token)).json();
    if (!body.success) throw new Error(`list failed: ${JSON.stringify(body.errors)}`);
    names.push(...body.result.map((k) => k.name));
    cursor = body.result_info?.cursor || "";
  } while (cursor);
  return names;
}

// [{key, value}] with each value parsed as JSON (null if it isn't JSON).
export async function readAll({ account, namespace, token }, keys) {
  const base = `${API}/accounts/${account}/storage/kv/namespaces/${namespace}/values/`;
  const out = new Array(keys.length);
  let next = 0;
  async function worker() {
    while (next < keys.length) {
      const i = next++;
      const text = await (await request(base + encodeURIComponent(keys[i]), token)).text();
      let value = null;
      try { value = JSON.parse(text); } catch { value = null; }
      out[i] = { key: keys[i], value };
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

const cell = (v) => {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Text people typed into a form can start with = + - @, which spreadsheets run
// as a formula. A leading apostrophe keeps it plain text.
export const plain = (s) => (/^[=+\-@\t\r]/.test(s) ? `'${s}` : s);

export function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
