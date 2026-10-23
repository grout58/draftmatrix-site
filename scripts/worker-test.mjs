// Runs dist/_worker.js in Node against fake KV and ASSETS bindings, with a
// mocked fetch standing in for Turnstile's siteverify endpoint.
// Called by scripts/check.py; also runnable alone: `node scripts/worker-test.mjs`.
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const worker = (await import(pathToFileURL(join(ROOT, "dist", "_worker.js")))).default;

// ---- mocked siteverify: only GOOD passes; DOWN makes the endpoint fail ----
const SECRET = "test-secret";
const GOOD = "good-token";
const DOWN = "siteverify-down";
const verifyCalls = [];
globalThis.fetch = async (url, init = {}) => {
  if (url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
    throw new Error(`unexpected fetch ${url}`);
  }
  const form = new URLSearchParams(init.body);
  verifyCalls.push({ method: init.method, form });
  if (form.get("response") === DOWN) return new Response("error", { status: 500 });
  const success = form.get("secret") === SECRET && form.get("response") === GOOD;
  return Response.json({ success, "error-codes": success ? [] : ["invalid-input-response"] });
};

class FakeKV {
  constructor() { this.map = new Map(); }
  async get(key) { return this.map.has(key) ? this.map.get(key) : null; }
  async put(key, value) { this.map.set(key, value); }
}

const assetCalls = [];
const ASSETS = {
  async fetch(request) {
    assetCalls.push(request);
    return new Response("asset " + new URL(request.url).pathname, { status: 200 });
  },
};

const HOST = "https://draftmatrix-site.pages.dev";
let failures = 0;
function check(name, cond, detail = "") {
  console.log(`${cond ? "ok  " : "FAIL"} worker: ${name}${cond || !detail ? "" : " — " + detail}`);
  if (!cond) failures++;
}

// JSON bodies get a valid Turnstile token unless they set their own.
function post(path, body, { headers = {}, raw } = {}) {
  return new Request(HOST + path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: HOST, ...headers },
    body: raw ?? JSON.stringify(body && { turnstileToken: GOOD, ...body }),
  });
}

async function call(request, env) {
  const res = await worker.fetch(request, env);
  const text = await res.text();
  let body = null;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, res };
}

// ---- non-API requests go to ASSETS unchanged ----
{
  const env = { ASSETS };
  for (const path of ["/", "/support", "/support.html", "/nfl/", "/draftmatrix-site/hockey.html", "/apiary"]) {
    const req = new Request(HOST + path);
    const { status, body } = await call(req, env);
    const passed = assetCalls.at(-1) === req;
    check(`GET ${path} delegated to ASSETS with the same Request`, status === 200 && passed && body === "asset " + path);
  }
}

// ---- missing bindings or secret -> 503 ----
{
  let env = { ASSETS, TURNSTILE_SECRET: SECRET };
  let r = await call(post("/api/subscribe", { email: "a@example.com", sport: "nfl" }), env);
  check("subscribe without SIGNUPS -> 503", r.status === 503 && r.body.ok === false);
  r = await call(post("/api/feedback", { email: "a@example.com", message: "hi", app: "hockey" }), env);
  check("feedback without FEEDBACK -> 503", r.status === 503 && r.body.ok === false);

  env = { ASSETS, SIGNUPS: new FakeKV(), FEEDBACK: new FakeKV() };
  const before = verifyCalls.length;
  r = await call(post("/api/subscribe", { email: "a@example.com", sport: "nfl" }), env);
  check("subscribe without TURNSTILE_SECRET -> 503 not live",
    r.status === 503 && r.body.reason === "not live" && env.SIGNUPS.map.size === 0);
  r = await call(post("/api/feedback", { email: "a@example.com", message: "hi" }), env);
  check("feedback without TURNSTILE_SECRET -> 503 not live",
    r.status === 503 && r.body.reason === "not live" && env.FEEDBACK.map.size === 0);
  check("no siteverify call without a secret", verifyCalls.length === before);
}

// ---- Turnstile ----
{
  const env = { ASSETS, SIGNUPS: new FakeKV(), FEEDBACK: new FakeKV(), TURNSTILE_SECRET: SECRET };
  for (const path of ["/api/subscribe", "/api/feedback"]) {
    const body = { email: "t@example.com", message: "hi" };
    let before = verifyCalls.length;
    let r = await call(post(path, { ...body, turnstileToken: "bad-token" }), env);
    check(`${path} bad token -> 403 verification failed`,
      r.status === 403 && r.body.ok === false && r.body.reason === "verification failed" &&
      verifyCalls.length === before + 1, JSON.stringify(r.body));

    before = verifyCalls.length;
    r = await call(post(path, { ...body, turnstileToken: "" }), env);
    check(`${path} empty token -> 403 without calling siteverify`,
      r.status === 403 && r.body.reason === "verification failed" && verifyCalls.length === before);
    r = await call(post(path, { ...body, turnstileToken: undefined }), env);
    check(`${path} missing token -> 403`, r.status === 403 && verifyCalls.length === before);
    r = await call(post(path, { ...body, turnstileToken: "x".repeat(2049) }), env);
    check(`${path} oversized token -> 403`, r.status === 403 && verifyCalls.length === before);

    r = await call(post(path, { ...body, turnstileToken: DOWN }), env);
    check(`${path} siteverify outage -> 502, not a false success`, r.status === 502 && r.body.ok === false);
  }
  check("nothing stored after failed verification", env.SIGNUPS.map.size === 0 && env.FEEDBACK.map.size === 0);

  const before = verifyCalls.length;
  const r = await call(post("/api/subscribe", { email: "ok@example.com" },
    { headers: { "cf-connecting-ip": "203.0.113.7" } }), env);
  const sent = verifyCalls[before];
  check("good token -> stored", r.status === 200 && env.SIGNUPS.map.has("email:ok@example.com"));
  check("siteverify gets POST secret, response, remoteip (form-encoded)",
    sent?.method === "POST" && sent.form.get("secret") === SECRET && sent.form.get("response") === GOOD &&
    sent.form.get("remoteip") === "203.0.113.7");

  const hp = verifyCalls.length;
  await call(post("/api/subscribe", { email: "bot@example.com", company: "Acme", turnstileToken: "" }), env);
  check("honeypot short-circuits before siteverify", verifyCalls.length === hp && !env.SIGNUPS.map.has("email:bot@example.com"));
}

// ---- method and origin ----
{
  const env = { ASSETS, SIGNUPS: new FakeKV(), FEEDBACK: new FakeKV(), TURNSTILE_SECRET: SECRET };
  for (const method of ["GET", "PUT", "DELETE"]) {
    for (const path of ["/api/subscribe", "/api/feedback", "/api/other"]) {
      const r = await call(new Request(HOST + path, { method }), env);
      check(`${method} ${path} -> 405`, r.status === 405 && r.res.headers.get("allow") === "POST");
    }
  }
  let r = await call(post("/api/other", {}), env);
  check("POST /api/other -> 404", r.status === 404);
  r = await call(post("/api/subscribe", { email: "a@example.com" }, { headers: { origin: "https://evil.example" } }), env);
  check("cross-origin POST -> 403", r.status === 403 && env.SIGNUPS.map.size === 0);
  r = await call(post("/api/subscribe", { email: "a@example.com" }, { headers: { origin: "null" } }), env);
  check("Origin: null -> 403", r.status === 403);
  const noOrigin = new Request(HOST + "/api/subscribe", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "noorigin@example.com", sport: "nba", turnstileToken: GOOD }),
  });
  r = await call(noOrigin, env);
  check("POST without Origin header is allowed", r.status === 200 && r.body.ok === true);
}

// ---- subscribe ----
{
  const SIGNUPS = new FakeKV();
  const env = { ASSETS, SIGNUPS, TURNSTILE_SECRET: SECRET };
  let r = await call(post("/api/subscribe", { email: "not-an-email", sport: "nfl" }), env);
  check("subscribe bad email -> 400", r.status === 400 && SIGNUPS.map.size === 0);
  r = await call(post("/api/subscribe", null, { raw: "{" }), env);
  check("subscribe bad JSON -> 400", r.status === 400);
  r = await call(post("/api/subscribe", { email: "bot@example.com", company: "Acme" }), env);
  check("subscribe honeypot -> 200, nothing stored", r.status === 200 && r.body.ok === true && SIGNUPS.map.size === 0);

  r = await call(post("/api/subscribe", { email: " Fan@Example.com ", sport: "nfl" }), env);
  const first = JSON.parse(SIGNUPS.map.get("email:fan@example.com") || "null");
  check("subscribe stores lowercased key", r.status === 200 && r.body.ok === true && first?.sport === "nfl");
  check("subscribe record has sports/ts/firstTs",
    JSON.stringify(first?.sports) === '["nfl"]' && typeof first?.ts === "string" && first?.firstTs === first?.ts);
  check("signup record is exactly {sport, sports, ts, firstTs}",
    Object.keys(first ?? {}).sort().join() === "firstTs,sport,sports,ts", JSON.stringify(first));

  await new Promise((done) => setTimeout(done, 5));
  await call(post("/api/subscribe", { email: "fan@example.com", sport: "mlb" }), env);
  await call(post("/api/subscribe", { email: "FAN@example.com", sport: "nfl" }), env);
  const merged = JSON.parse(SIGNUPS.map.get("email:fan@example.com"));
  check("second sport merges instead of overwriting",
    JSON.stringify(merged.sports) === '["nfl","mlb"]' && merged.sport === "nfl" &&
    merged.firstTs === first.firstTs && merged.ts > first.ts, JSON.stringify(merged));

  SIGNUPS.map.set("email:old@example.com", JSON.stringify({ sport: "nhl", ts: "2026-10-01T00:00:00.000Z" }));
  await call(post("/api/subscribe", { email: "old@example.com", sport: "nba" }), env);
  const legacy = JSON.parse(SIGNUPS.map.get("email:old@example.com"));
  check("old {sport, ts} record is upgraded and merged",
    JSON.stringify(legacy.sports) === '["nhl","nba"]' && legacy.firstTs === "2026-10-01T00:00:00.000Z", JSON.stringify(legacy));

  await call(post("/api/subscribe", { email: "x@example.com", sport: "cricket" }), env);
  check("unknown sport stored as all", JSON.parse(SIGNUPS.map.get("email:x@example.com")).sport === "all");

  const form = new Request(HOST + "/api/subscribe", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: HOST },
    body: `email=form%40example.com&sport=nhl&company=&turnstileToken=${GOOD}`,
  });
  r = await call(form, env);
  check("form-encoded subscribe works", r.status === 200 && SIGNUPS.map.has("email:form@example.com"));
}

// ---- feedback ----
{
  const FEEDBACK = new FakeKV();
  const env = { ASSETS, FEEDBACK, TURNSTILE_SECRET: SECRET };
  const good = { name: "Sam", email: "Sam@Example.com", app: "hoops", message: "Love it", company: "" };
  let r = await call(post("/api/feedback", { ...good, email: "" }), env);
  check("feedback without email -> 400", r.status === 400);
  r = await call(post("/api/feedback", { ...good, message: "   " }), env);
  check("feedback without message -> 400", r.status === 400);
  r = await call(post("/api/feedback", { ...good, message: "x".repeat(4001) }), env);
  check("feedback message > 4000 chars -> 400", r.status === 400 && FEEDBACK.map.size === 0);
  r = await call(post("/api/feedback", { ...good, company: "spam" }), env);
  check("feedback honeypot -> 200, nothing stored", r.status === 200 && r.body.ok === true && FEEDBACK.map.size === 0);
  r = await call(post("/api/feedback", { ...good, message: "y".repeat(4000) }), env);
  check("feedback message of exactly 4000 chars accepted", r.status === 200 && FEEDBACK.map.size === 1);

  r = await call(post("/api/feedback", good, { headers: { "user-agent": "TestUA/1.0" } }), env);
  const keys = [...FEEDBACK.map.keys()];
  const rec = JSON.parse(FEEDBACK.map.get(keys.at(-1)));
  check("feedback -> 200 {ok:true}", r.status === 200 && r.body.ok === true);
  check("feedback key is fb:<ISO ts>:<random>", keys.every((k) => /^fb:\d{4}-\d\d-\d\dT[\d:.]+Z:[0-9a-f]{8}$/.test(k)), keys.join(","));
  check("feedback keys are unique", new Set(keys).size === keys.length);
  check("feedback record is exactly {name, email, app, message, ts} (no user-agent)",
    rec.name === "Sam" && rec.email === "sam@example.com" && rec.app === "hoops" && rec.message === "Love it" &&
    typeof rec.ts === "string" && Object.keys(rec).sort().join() === "app,email,message,name,ts", JSON.stringify(rec));
  await call(post("/api/feedback", { email: "a@example.com", message: "m", app: "nope" }), env);
  const last = JSON.parse([...FEEDBACK.map.values()].at(-1));
  check("feedback: optional name, unknown app -> other", last.name === "" && last.app === "other", JSON.stringify(last));
}

// ---- storage failure -> 500, not a false success ----
{
  const broken = { async get() { throw new Error("down"); }, async put() { throw new Error("down"); } };
  const r = await call(post("/api/subscribe", { email: "a@example.com" }), { ASSETS, SIGNUPS: broken, TURNSTILE_SECRET: SECRET });
  check("KV error -> 500", r.status === 500 && r.body.ok === false);
}

console.log(failures ? `worker: ${failures} failure(s)` : "worker: all passed");
process.exit(failures ? 1 : 0);
