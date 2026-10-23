#!/usr/bin/env node
// Exports the SIGNUPS KV namespace to signups.csv, ready for an email
// provider's CSV import (e.g. Buttondown or Mailchimp).
//
//   CF_ACCOUNT_ID=... SIGNUPS_NAMESPACE_ID=... CLOUDFLARE_API_TOKEN=... \
//     node scripts/export-signups.mjs [out.csv]
//
// Columns: email, sports (";"-separated sport pages; "all" = the home page),
// first_signup, last_signup (ISO 8601, UTC). Contains personal data: the
// default output file is in .gitignore; don't commit or share it.
import { writeFileSync } from "node:fs";
import { listKeys, readAll, requireEnv, toCsv } from "./lib/kv-export.mjs";

const [account, namespace, token] = requireEnv("CF_ACCOUNT_ID", "SIGNUPS_NAMESPACE_ID", "CLOUDFLARE_API_TOKEN");
const out = process.argv[2] || "signups.csv";
const ctx = { account, namespace, token };

const keys = await listKeys({ ...ctx, prefix: "email:" });
const rows = (await readAll(ctx, keys)).map(({ key, value }) => {
  const v = value || {};
  // Older records are {sport, ts}; newer ones add sports and firstTs.
  const sports = Array.isArray(v.sports) && v.sports.length ? v.sports : v.sport ? [v.sport] : [];
  return [key.slice("email:".length), sports.join(";"), v.firstTs || v.ts || "", v.ts || ""];
});
rows.sort((a, b) => a[2].localeCompare(b[2]));

writeFileSync(out, toCsv(["email", "sports", "first_signup", "last_signup"], rows));
console.log(`Wrote ${rows.length} signup(s) to ${out}`);
