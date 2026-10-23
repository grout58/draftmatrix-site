// Cloudflare Pages advanced-mode worker. build.mjs copies this to dist/_worker.js.
// No dependencies, no build step: it is uploaded as-is.
//
//   POST /api/subscribe  {email, sport, company, turnstileToken}
//   POST /api/feedback   {name, email, app, message, company, turnstileToken}
//
// Bodies may be JSON or form-encoded. "company" is a honeypot: people never see
// it, bots fill it in; a filled honeypot gets 200 {ok:true} and nothing is stored.
// Every other request must carry a Cloudflare Turnstile token, which is checked
// with siteverify before anything is stored; a bad token gets 403
// {ok:false, reason:"verification failed"}.
//
// Bindings (KV namespaces) and secrets:
//   SIGNUPS           "email:<lowercased email>" -> {sport, sports:[...], ts, firstTs}
//   FEEDBACK          "fb:<ISO ts>:<random>"     -> {name, email, app, message, ts}
//   TURNSTILE_SECRET  Turnstile secret key (Pages project secret)
// A missing binding or secret makes the endpoint answer 503 {ok:false, reason:"not live"}.
//
// Optional Buttondown forwarding (off unless both of the first two are set; see DEPLOY.md):
//   BUTTONDOWN_API_KEY  Buttondown API key (encrypted Pages secret)
//   BUTTONDOWN_ENABLED  plain env var; must be exactly "true"
//   BUTTONDOWN_TAGS     plain env var; "true" adds a "<sport>-launch" tag (paid Buttondown plan only)
// After a signup is stored in KV, it is also sent to Buttondown in the background
// (ctx.waitUntil). KV stays the record of truth: the response is the same 200
// {ok:true} whatever Buttondown answers, and the forward is skipped without ctx.
// No "type" is sent, so Buttondown emails a confirmation link (double opt-in).
// Logs only "buttondown <status>", "buttondown error" or "buttondown timeout".
//
// Everything outside /api/ is passed to env.ASSETS.fetch(request) unchanged, so
// static files, pretty URLs and _redirects behave as they do without a worker.

const SPORTS = new Set(["all", "nfl", "nba", "nhl", "mlb"]);
const APPS = new Set(["football", "hoops", "hockey", "baseball", "other"]);
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MAX_MESSAGE = 4000;
const MAX_NAME = 200;
// Turnstile tokens can be up to 2048 characters, so both limits leave room for one.
const MAX_BODY = { subscribe: 6144, feedback: 36864 };
const MAX_TOKEN = 2048;
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const BUTTONDOWN = "https://api.buttondown.com/v1/subscribers";
const BUTTONDOWN_TIMEOUT = 8000;

function json(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  });
}

async function readBody(request, limit) {
  const text = await request.text();
  if (text.length > limit) return null;
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      const data = JSON.parse(text);
      return data && typeof data === "object" && !Array.isArray(data) ? data : null;
    } catch {
      return null;
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

const str = (v) => (typeof v === "string" ? v.trim() : "");

function validEmail(v) {
  const email = str(v).toLowerCase();
  return email.length <= 254 && EMAIL.test(email) ? email : null;
}

// Browsers send Origin on cross-site POSTs. If it's there it must be this host.
function sameOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

const buttondownOn = (env) =>
  typeof env.BUTTONDOWN_API_KEY === "string" && env.BUTTONDOWN_API_KEY !== "" && env.BUTTONDOWN_ENABLED === "true";

// Never throws. Without "type", Buttondown creates the subscriber unactivated and
// emails a confirmation link. The collision header merges into an existing
// subscriber instead of failing with 400. Tags need a paid plan (a new tag is a
// 403 on the free plan), so a tagged request that gets 403 is retried once without.
async function forwardToButtondown(env, email, sport, sports, ip) {
  const body = { email_address: email, metadata: { source: "draftmatrix.app", sports: sports.join(",") } };
  if (ip) body.ip_address = ip;
  const send = async (payload) => {
    const res = await fetch(BUTTONDOWN, {
      method: "POST",
      headers: {
        authorization: `Token ${env.BUTTONDOWN_API_KEY}`,
        "content-type": "application/json",
        "x-buttondown-collision-behavior": "add",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(BUTTONDOWN_TIMEOUT),
    });
    console.log("buttondown", res.status);
    return res.status;
  };
  try {
    if (env.BUTTONDOWN_TAGS === "true") {
      if ((await send({ ...body, tags: [`${sport}-launch`] })) !== 403) return;
    }
    await send(body);
  } catch (err) {
    console.log("buttondown", err?.name === "TimeoutError" ? "timeout" : "error");
  }
}

async function subscribe(data, env, request, ctx) {
  const email = validEmail(data.email);
  if (!email) return json(400, { ok: false, reason: "invalid email" });
  const sport = SPORTS.has(data.sport) ? data.sport : "all";

  // Merge with any earlier signup so a second sport page adds to the list
  // instead of overwriting it.
  const key = `email:${email}`;
  const ts = new Date().toISOString();
  let prev = null;
  try {
    prev = JSON.parse((await env.SIGNUPS.get(key)) || "null");
  } catch {
    prev = null;
  }
  const sports = Array.isArray(prev?.sports) ? prev.sports.filter((s) => SPORTS.has(s)) : [];
  if (prev && SPORTS.has(prev.sport) && !sports.includes(prev.sport)) sports.push(prev.sport);
  if (!sports.includes(sport)) sports.push(sport);

  await env.SIGNUPS.put(key, JSON.stringify({ sport, sports, ts, firstTs: prev?.firstTs || prev?.ts || ts }));
  if (buttondownOn(env) && typeof ctx?.waitUntil === "function") {
    try {
      ctx.waitUntil(forwardToButtondown(env, email, sport, sports, request.headers.get("cf-connecting-ip")));
    } catch {
      // The signup is stored; a failed forward must not change the response.
    }
  }
  return json(200, { ok: true });
}

// Returns true only if Cloudflare says the token is valid. An empty or oversized
// token is rejected without asking. A siteverify outage throws (-> 502).
async function verifyTurnstile(token, request, env) {
  if (token === "" || token.length > MAX_TOKEN) return false;
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: token });
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) form.set("remoteip", ip);
  const res = await fetch(SITEVERIFY, { method: "POST", body: form });
  if (!res.ok) throw new Error(`siteverify ${res.status}`);
  const outcome = await res.json();
  return outcome?.success === true;
}

async function feedback(data, env) {
  const email = validEmail(data.email);
  if (!email) return json(400, { ok: false, reason: "invalid email" });
  const message = str(data.message);
  if (message === "") return json(400, { ok: false, reason: "message required" });
  if (message.length > MAX_MESSAGE) return json(400, { ok: false, reason: "message too long" });
  const name = str(data.name);
  if (name.length > MAX_NAME) return json(400, { ok: false, reason: "name too long" });
  const app = APPS.has(data.app) ? data.app : "other";

  const ts = new Date().toISOString();
  const rand = crypto.randomUUID().slice(0, 8);
  await env.FEEDBACK.put(`fb:${ts}:${rand}`, JSON.stringify({ name, email, app, message, ts }));
  return json(200, { ok: true });
}

const ROUTES = {
  "/api/subscribe": { binding: "SIGNUPS", limit: MAX_BODY.subscribe, handle: subscribe },
  "/api/feedback": { binding: "FEEDBACK", limit: MAX_BODY.feedback, handle: feedback },
};

async function api(request, env, path, ctx) {
  if (request.method !== "POST") {
    return json(405, { ok: false, reason: "method not allowed" }, { allow: "POST" });
  }
  const route = ROUTES[path];
  if (!route) return json(404, { ok: false, reason: "not found" });
  if (!sameOrigin(request)) return json(403, { ok: false, reason: "cross-origin request" });
  if (!env[route.binding] || !env.TURNSTILE_SECRET) return json(503, { ok: false, reason: "not live" });

  const data = await readBody(request, route.limit);
  if (!data) return json(400, { ok: false, reason: "bad request" });
  if (str(data.company) !== "") return json(200, { ok: true });

  try {
    if (!(await verifyTurnstile(str(data.turnstileToken), request, env))) {
      return json(403, { ok: false, reason: "verification failed" });
    }
  } catch {
    return json(502, { ok: false, reason: "verification unavailable" });
  }

  try {
    return await route.handle(data, env, request, ctx);
  } catch {
    return json(500, { ok: false, reason: "storage error" });
  }
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === "/api" || path.startsWith("/api/")) return api(request, env, path, ctx);
    return env.ASSETS.fetch(request);
  },
};
