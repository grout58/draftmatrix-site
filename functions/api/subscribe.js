// Cloudflare Pages Function: POST /api/subscribe
//
// Body: JSON {email, sport, company} (or the same fields form-encoded).
// "company" is a honeypot: people never see it, bots fill it in.
//
// Needs a KV namespace bound as SIGNUPS. Without the binding the form is not
// live and every request gets 503 {ok:false, reason:"signup not live"}.
// Stored as key "email:<lowercased email>", value JSON {sport, ts}.

const SPORTS = new Set(["all", "nfl", "nba", "nhl", "mlb"]);
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const MAX_BODY = 2048;

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function readBody(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  const type = request.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      const data = JSON.parse(text);
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }
  return Object.fromEntries(new URLSearchParams(text));
}

export async function onRequestPost({ request, env }) {
  if (!env.SIGNUPS) {
    return json(503, { ok: false, reason: "signup not live" });
  }

  const data = await readBody(request);
  if (!data) return json(400, { ok: false, reason: "bad request" });

  // Honeypot filled in: answer like a success so the bot moves on, store nothing.
  if (typeof data.company === "string" && data.company.trim() !== "") {
    return json(200, { ok: true });
  }

  const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  if (email.length > 254 || !EMAIL.test(email)) {
    return json(400, { ok: false, reason: "invalid email" });
  }

  const sport = SPORTS.has(data.sport) ? data.sport : "all";

  await env.SIGNUPS.put(`email:${email}`, JSON.stringify({ sport, ts: new Date().toISOString() }));
  return json(200, { ok: true });
}

export function onRequest() {
  return json(405, { ok: false, reason: "method not allowed" });
}
