// Serves dist/ locally the way Cloudflare Pages serves static assets, closely
// enough to run scripts/verify-deploy.py against it. No dependencies, no worker:
//
//     node scripts/serve-dist.mjs [dist] [port]     # defaults: dist 8788
//     python3 scripts/verify-deploy.py dist http://127.0.0.1:8788
//
// What it copies from Pages (from memory of how Pages behaves, so treat it as an
// approximation and confirm on a preview deploy):
// - dist/_redirects rules, checked first: exact paths and a trailing /* splat.
// - Pretty URLs: /x serves x.html, /x.html -> 308 /x, /x/ serves x/index.html,
//   /x/index.html -> 308 /x/, /index.html -> 308 /, and /x -> 308 /x/ when only
//   x/index.html exists.
// - _headers rules (an exact path or a trailing /* splat, then indented
//   "Name: value" lines) add their headers to the 200s they match.
// - _redirects, _headers, _routes.json and _worker.js are never served.
// - Anything else answers 404 with dist/404.html as the body.
// /api/* answers 404 here; scripts/worker-test.mjs covers the worker.

import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const DIST = resolve(process.argv[2] || "dist");
const PORT = Number(process.argv[3] || 8788);
const HIDDEN = new Set(["/_redirects", "/_headers", "/_routes.json", "/_worker.js"]);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json", ".xml": "application/xml", ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg",
};

const rules = existsSync(join(DIST, "_redirects"))
  ? readFileSync(join(DIST, "_redirects"), "utf8").split("\n")
    .map((line) => line.trim().split(/\s+/)).filter((p) => p.length >= 2 && !p[0].startsWith("#"))
    .map(([from, to, code]) => ({ from, to, code: Number(code || 302) }))
  : [];

// [{ from, headers: {name: value} }] from dist/_headers.
const headerRules = [];
if (existsSync(join(DIST, "_headers"))) {
  for (const line of readFileSync(join(DIST, "_headers"), "utf8").split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    if (!/^\s/.test(line)) headerRules.push({ from: line.trim(), headers: {} });
    else if (headerRules.length) {
      const [name, ...value] = line.trim().split(":");
      headerRules.at(-1).headers[name.trim().toLowerCase()] = value.join(":").trim();
    }
  }
}
const extraHeaders = (path) => Object.assign({}, ...headerRules
  .filter(({ from }) => from.endsWith("/*") ? path.startsWith(from.slice(0, -1)) : from === path)
  .map(({ headers }) => headers));

const isFile = (rel) => {
  const p = join(DIST, rel);
  return p.startsWith(DIST) && existsSync(p) && statSync(p).isFile();
};

function redirect(path) {
  for (const { from, to, code } of rules) {
    if (from.endsWith("/*") && path.startsWith(from.slice(0, -1))) {
      return { code, to: to.replace(":splat", path.slice(from.length - 1)) };
    }
    if (from === path) return { code, to };
  }
  return null;
}

// -> { file } to serve, { code, to } to redirect, or null for 404.
function resolvePath(path) {
  if (HIDDEN.has(path)) return null;
  const rule = redirect(path);
  if (rule) return rule;
  if (path.endsWith("/index.html")) return isFile(path) ? { code: 308, to: path.slice(0, -"index.html".length) } : null;
  if (path.endsWith(".html")) return isFile(path) ? { code: 308, to: path.slice(0, -".html".length) } : null;
  if (path.endsWith("/")) return isFile(path + "index.html") ? { file: path + "index.html" } : null;
  if (isFile(path + ".html")) return { file: path + ".html" };
  if (isFile(path)) return { file: path };
  if (isFile(path + "/index.html")) return { code: 308, to: path + "/" };
  return null;
}

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);
  const hit = resolvePath(path);
  if (hit?.to) {
    res.writeHead(hit.code, { location: hit.to + url.search });
    res.end();
  } else if (hit?.file) {
    res.writeHead(200, { ...extraHeaders(path), "content-type": TYPES[extname(hit.file)] || "application/octet-stream" });
    res.end(req.method === "HEAD" ? undefined : readFileSync(join(DIST, hit.file)));
  } else {
    res.writeHead(404, { "content-type": TYPES[".html"] });
    res.end(isFile("/404.html") ? readFileSync(join(DIST, "404.html")) : "not found");
  }
}).listen(PORT, "127.0.0.1", () => console.log(`serving ${DIST} at http://127.0.0.1:${PORT}`));
