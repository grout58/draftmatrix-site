#!/usr/bin/env node
// Exports the FEEDBACK KV namespace to feedback.csv.
//
//   CF_ACCOUNT_ID=... FEEDBACK_NAMESPACE_ID=... CLOUDFLARE_API_TOKEN=... \
//     node scripts/export-feedback.mjs [out.csv]
//
// Columns: sent (ISO 8601, UTC), name, email, app, message. Rows are oldest
// first. Contains personal data: the default output file is in .gitignore;
// don't commit or share it.
import { writeFileSync } from "node:fs";
import { listKeys, plain, readAll, requireEnv, toCsv } from "./lib/kv-export.mjs";

const [account, namespace, token] = requireEnv("CF_ACCOUNT_ID", "FEEDBACK_NAMESPACE_ID", "CLOUDFLARE_API_TOKEN");
const out = process.argv[2] || "feedback.csv";
const ctx = { account, namespace, token };

// Keys are fb:<ISO time>:<random>, so key order is time order.
const keys = (await listKeys({ ...ctx, prefix: "fb:" })).sort();
const rows = (await readAll(ctx, keys)).map(({ value }) => {
  const v = value || {};
  // Only the documented fields; anything else in an old record is left out.
  return [v.ts || "", plain(v.name || ""), v.email || "", v.app || "", plain(v.message || "")];
});

writeFileSync(out, toCsv(["sent", "name", "email", "app", "message"], rows));
console.log(`Wrote ${rows.length} message(s) to ${out}`);
