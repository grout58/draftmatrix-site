#!/usr/bin/env node
// One-time import of existing signups into Buttondown. Node 18+, no dependencies.
// See DEPLOY.md, "Buttondown email list (off until enabled)".
//
//   # Source: the SIGNUPS KV namespace through the Cloudflare API (token needs
//   # "Workers KV Storage: Read"), the same way scripts/export-signups.mjs reads it:
//   CF_ACCOUNT_ID=... SIGNUPS_NAMESPACE_ID=... CLOUDFLARE_API_TOKEN=... \
//     node scripts/buttondown-import.mjs [--dry-run]
//   # ...or the signups.csv that scripts/export-signups.mjs writes
//   # (email, sports ";"-separated, first_signup, last_signup):
//   node scripts/buttondown-import.mjs --from-file signups.csv [--dry-run]
//
//   # Real run: add BUTTONDOWN_API_KEY=... (and no --dry-run).
//
// Options:
//   --dry-run         read and count only, send nothing. The default when
//                     BUTTONDOWN_API_KEY is unset.
//   --limit N         send at most N subscribers this run (default 90: Buttondown
//                     allows about 100 subscriber creations a day for a new newsletter).
//   --skip N          skip the first N (oldest first) to continue an earlier run;
//                     each run prints the --skip value for the next one.
//   --tags            also send tags "<sport>-launch" for each sport. Only on a paid
//                     Buttondown plan with tagging: on the free plan a new tag is a 403.
//
// Each email (deduplicated, lowercased) becomes the same request the worker sends:
// POST https://api.buttondown.com/v1/subscribers with "Authorization: Token <key>",
// "X-Buttondown-Collision-Behavior: add" (an existing subscriber is merged, not an
// error), and {email_address, metadata: {source, sports}}. No "type" is sent, so
// Buttondown emails every imported address a confirmation link and the subscriber
// stays unactivated until they confirm (double opt-in). No ip_address: we don't
// keep visitors' IPs. A tagged request that gets 403 is retried once without tags.
// Requests go one at a time, about one a second, and the run stops at the first 429.
//
// Output is counts only: never an email address, a response body or the key.
// For a large list, Buttondown's CSV import (dashboard, or POST /v1/imports) is
// the better route; scripts/export-signups.mjs writes a CSV for it.
import { readFileSync } from "node:fs";
import { listKeys, readAll, requireEnv } from "./lib/kv-export.mjs";

// Same as src/_worker.js (scripts/check.py compares them).
const SPORTS = new Set(["all", "nfl", "nba", "nhl", "mlb"]);
const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;
const BUTTONDOWN = "https://api.buttondown.com/v1/subscribers";
const TIMEOUT = 15000;
const PAUSE = 1100;

function parseArgs(argv) {
  const opts = { dryRun: false, tags: false, limit: 90, skip: 0, fromFile: null };
  const number = (flag, v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0) usage(`${flag} needs a whole number`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--tags") opts.tags = true;
    else if (arg === "--limit") opts.limit = number(arg, argv[++i]);
    else if (arg === "--skip") opts.skip = number(arg, argv[++i]);
    else if (arg === "--from-file") opts.fromFile = argv[++i] || usage("--from-file needs a path");
    else usage(`unknown argument ${arg}`);
  }
  return opts;
}

function usage(msg) {
  console.error(msg);
  console.error("usage: node scripts/buttondown-import.mjs [--from-file signups.csv] [--dry-run] [--limit N] [--skip N] [--tags]");
  process.exit(2);
}

// Minimal RFC 4180 reader: quoted cells, doubled quotes, CRLF or LF.
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v !== ""));
}

// -> [{email, sports, first}] (raw, not yet validated or deduplicated)
function fromCsv(path) {
  const [header, ...rows] = parseCsv(readFileSync(path, "utf8"));
  const col = (name) => header?.indexOf(name) ?? -1;
  const [e, s, f] = [col("email"), col("sports"), col("first_signup")];
  if (e < 0 || s < 0) usage(`${path} has no email/sports header; expected the CSV from scripts/export-signups.mjs`);
  return rows.map((r) => ({ email: r[e] ?? "", sports: (r[s] ?? "").split(";"), first: f < 0 ? "" : r[f] ?? "" }));
}

async function fromKv() {
  const [account, namespace, token] = requireEnv("CF_ACCOUNT_ID", "SIGNUPS_NAMESPACE_ID", "CLOUDFLARE_API_TOKEN");
  const ctx = { account, namespace, token };
  const keys = await listKeys({ ...ctx, prefix: "email:" });
  return (await readAll(ctx, keys)).map(({ key, value }) => {
    const v = value || {};
    // As in the worker: older records are {sport, ts}; newer ones add sports and firstTs.
    const sports = Array.isArray(v.sports) ? [...v.sports] : [];
    if (v.sport && !sports.includes(v.sport)) sports.push(v.sport);
    return { email: key.slice("email:".length), sports, first: v.firstTs || v.ts || "" };
  });
}

// Validate and dedupe by lowercased email, merging sports. Oldest first, so --skip is stable.
function prepare(raw) {
  const byEmail = new Map();
  let invalid = 0;
  for (const r of raw) {
    const email = String(r.email).trim().toLowerCase();
    if (email.length > 254 || !EMAIL.test(email)) { invalid++; continue; }
    const entry = byEmail.get(email) || { email, sports: [], first: r.first };
    for (const s of r.sports.map((x) => String(x).trim())) if (SPORTS.has(s) && !entry.sports.includes(s)) entry.sports.push(s);
    if (r.first && (!entry.first || r.first < entry.first)) entry.first = r.first;
    byEmail.set(email, entry);
  }
  const list = [...byEmail.values()];
  for (const entry of list) if (!entry.sports.length) entry.sports.push("all");
  list.sort((a, b) => a.first.localeCompare(b.first) || a.email.localeCompare(b.email));
  return { list, invalid };
}

// The worker's request body, with tags for every sport when asked.
function payload(entry, tags) {
  const body = { email_address: entry.email, metadata: { source: "draftmatrix.app", sports: entry.sports.join(",") } };
  if (tags) body.tags = entry.sports.map((s) => `${s}-launch`);
  return body;
}

async function send(key, body) {
  try {
    const res = await fetch(BUTTONDOWN, {
      method: "POST",
      headers: {
        authorization: `Token ${key}`,
        "content-type": "application/json",
        "x-buttondown-collision-behavior": "add",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    await res.arrayBuffer().catch(() => {});
    return res.status;
  } catch (err) {
    return err?.name === "TimeoutError" ? "timeout" : "error";
  }
}

const opts = parseArgs(process.argv.slice(2));
const key = process.env.BUTTONDOWN_API_KEY || "";
const dryRun = opts.dryRun || key === "";

const raw = opts.fromFile ? fromCsv(opts.fromFile) : await fromKv();
const { list, invalid } = prepare(raw);
const perSport = Object.fromEntries([...SPORTS].map((s) => [s, list.filter((e) => e.sports.includes(s)).length]));
console.log(`${opts.fromFile ? "rows" : "keys"} read: ${raw.length}`);
console.log(`unique emails: ${list.length}`);
console.log(`invalid/skipped: ${invalid}`);
console.log(`per sport: ${Object.entries(perSport).map(([s, n]) => `${s} ${n}`).join(", ")}`);

const batch = list.slice(opts.skip, opts.skip + opts.limit);
if (dryRun) {
  console.log(`dry run${key ? "" : " (BUTTONDOWN_API_KEY not set)"}: would send ${batch.length} ` +
    `(--skip ${opts.skip} --limit ${opts.limit}${opts.tags ? " --tags" : ""}); nothing sent`);
  process.exit(0);
}

const counts = {};
let sent = 0;
for (const entry of batch) {
  if (sent) await new Promise((done) => setTimeout(done, PAUSE));
  let status = await send(key, payload(entry, opts.tags));
  if (status === 403 && opts.tags) {
    counts["403 (tags, retried without)"] = (counts["403 (tags, retried without)"] || 0) + 1;
    await new Promise((done) => setTimeout(done, PAUSE));
    status = await send(key, payload(entry, false));
  }
  counts[status] = (counts[status] || 0) + 1;
  if (status === 429) {
    console.log("429 rate limited: stopping. Try again tomorrow; that one wasn't counted as sent.");
    break;
  }
  sent++;
}
console.log(`status counts: ${Object.entries(counts).map(([s, n]) => `${s}: ${n}`).join(", ") || "none"}`);
const next = opts.skip + sent;
console.log(next < list.length ? `${list.length - next} left; next run: --skip ${next}` : "all sent");
