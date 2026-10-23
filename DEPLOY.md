# Deploying draftmatrix.app

## Current state

- `main` is the source of truth. It is live at https://draftmatrix.app (and www.draftmatrix.app) from the Cloudflare Pages project **draftmatrix-site**.
- **Every push to `main` deploys to production through GitHub Actions** ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)): build, check, `wrangler pages deploy`. The first Actions deploy was on 2026-10-23 (commit `eada2cc`). To redeploy without a change: Actions → Deploy → Run workflow.
- The project is a **Direct Upload** project, created through the Cloudflare API. Cloudflare's docs say a Direct Upload project can't be switched to Git integration later, which is why deploys come from Actions rather than Cloudflare's own Git builds.
- Production bindings on the project: KV `SIGNUPS` and `FEEDBACK`, and the encrypted secret `TURNSTILE_SECRET`. A KV `SITE` binding is still attached but unused; it exists only for the emergency fallback below. Custom domains: `draftmatrix.app`, `www.draftmatrix.app`.
- Don't use [`scripts/kv-preview/`](scripts/kv-preview/README.md) for normal deploys. It's the API/KV path used before the Actions secrets existed, kept only as a documented emergency fallback.

## Deploy path (in use): GitHub Actions + wrangler

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main` (and by hand from the Actions tab): `node build.mjs`, `python3 scripts/check.py`, then `npx wrangler@4 pages deploy dist --project-name draftmatrix-site --branch main`. If the token secret is ever removed, the deploy step is skipped with a notice and the job still passes.

Setup (done on 2026-10-23; repeat when rotating the token):

1. **Create the token.** Cloudflare dashboard → **Manage account** → **Account API tokens** → **Create Token** → **Custom token** → **Get started**. Name it (e.g. "draftmatrix-site GitHub deploy"). Permissions: **Account** / **Cloudflare Pages** / **Edit**. Account Resources: **Include** → this account only. Create it and copy the token (it's shown once).
2. **Copy the account id**: it's the 32-character hex id in the dashboard URL (`dash.cloudflare.com/<account id>/...`), also under the account's menu → **Copy account ID**.
3. **Add the secrets.** GitHub → grout58/draftmatrix-site → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account id
4. Run the workflow once (Actions → Deploy → Run workflow), or push to `main`.

Consequences:

- Keeps the existing project, its custom domains, the KV bindings and `TURNSTILE_SECRET`. Nothing in DNS changes.
- Every push to `main` deploys to production. Deployments show up under the project as usual, with the commit.
- Pages serves `dist/` as real static assets (pretty URLs, `_redirects`, `_routes.json`), and `dist/_worker.js` gets the real `env.ASSETS`. The KV shim isn't used. The `SITE` binding is unused unless the emergency fallback is needed.
- If the deploy step fails with `Authentication failed [code: 9106]` / `Invalid format for Authorization header [code: 6111]`, the `CLOUDFLARE_API_TOKEN` secret value is malformed (stray whitespace or newline, quotes, a `Bearer ` prefix, or the wrong value pasted). Paste the bare token again and re-run the failed run.
- The token can only edit Pages in this account. Rotate it by creating a new one, updating the secret, and deleting the old token.

## Alternative (not in use): recreate as a Git-connected project

1. **Create the project.** Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**. This installs the **Cloudflare Workers & Pages** GitHub app: choose **Only select repositories** → `draftmatrix-site`. Then pick the repo and set:
   - Project name: something other than `draftmatrix-site` (e.g. `draftmatrix-web`), unless the old project is deleted first (below)
   - Production branch: `main`
   - Framework preset: None
   - Build command: `node build.mjs`
   - Build output directory: `dist`
2. **Re-add bindings and the secret** on the new project, for Production (and Preview if wanted): **Settings** → **Bindings** → add KV `SIGNUPS` and `FEEDBACK` pointing at the existing namespaces; **Settings** → **Variables and Secrets** → add `TURNSTILE_SECRET` as an encrypted secret. `SITE` isn't needed. Redeploy so they take effect.
3. **Move the custom domains.** On the old project: **Custom domains** → remove `draftmatrix.app` and `www.draftmatrix.app`. On the new project: **Custom domains** → **Set up a custom domain** → add both. The DNS CNAMEs must point at the new `<name>.pages.dev` (the dashboard updates them if the zone is on Cloudflare; check under DNS → Records).
4. Add the new `<name>.pages.dev` host to the Turnstile widget's hostnames if you want the forms to work there.

Consequences:

- Cloudflare builds and deploys every push to `main`, and every other branch gets a preview URL. No tokens to manage.
- The name `draftmatrix-site` can only be reused by deleting the old project first. Deleting it changes nothing else here (bindings, secret and domains are re-added on the new project anyway) but loses its deployment history.
- Between removing the domains from the old project and the new ones becoming active (certificate issuance), the site can be down for a few minutes. Do it at a quiet time.
- `scripts/export-*.mjs` keep working: the KV namespaces themselves don't move.

## Emergency fallback only: API/KV path

Only if Actions/wrangler can't deploy (e.g. the token is revoked and can't be replaced quickly). Follow [`scripts/kv-preview/README.md`](scripts/kv-preview/README.md) for each deploy: create the temporary upload Worker with an `UPLOAD_NONCE` secret, run `upload.sh`, run `deploy-via-api.js`, delete the upload Worker.

Consequences: no new tokens or apps, but every deploy is manual, it needs a broader token (Workers Scripts + KV + Pages edit), the shim only approximates Pages static serving (pretty URLs, indexes, `_redirects`), every request runs the worker (counts against the Workers request quota) and reads KV, and files deleted from `dist/` stay in KV until deleted by hand.

## Buttondown email list (off until enabled)

Signups are stored in the `SIGNUPS` KV namespace, and that stays the record of truth. Everything needed to also send them to [Buttondown](https://buttondown.com) is built but **off**: nothing goes to Buttondown, and no page mentions it.

What's built:

- **Worker** (`src/_worker.js`, `forwardToButtondown()`): after a signup is stored in KV, the worker also POSTs it to `https://api.buttondown.com/v1/subscribers` in the background (`ctx.waitUntil`), with `Authorization: Token <key>`, `X-Buttondown-Collision-Behavior: add` (a repeat signup merges into the existing subscriber instead of a 400), and `{email_address, metadata: {source: "draftmatrix.app", sports: "nfl,mlb"}, ip_address}`. `ip_address` is the visitor's `CF-Connecting-IP`, so Buttondown's spam firewall sees the real visitor rather than a few Cloudflare server IPs. 8 s timeout. The browser always gets the same 200 `{ok:true}`, whatever Buttondown answers (400, 429, 500, timeout, network error). The worker logs only `buttondown <status>`, `buttondown error` or `buttondown timeout`: never the key, email, IP or response body. `scripts/worker-test.mjs` covers all of this.
- **Site copy** (`BUTTONDOWN_LIVE` in `build.mjs`, `false`): when true, the four privacy pages' email-list paragraph says the address and sport(s) are stored with Cloudflare and sent to Buttondown (which sends the emails, asks you to confirm by email and handles unsubscribes), that Buttondown also gets your IP address to filter spam, and links [Buttondown's privacy policy](https://buttondown.com/legal/privacy). The signup success message becomes "Thanks. Check your inbox and confirm your email to get on the list for the cheat sheet." While false, the build output is unchanged and `scripts/check.py` fails if any built page names Buttondown. It also builds a flag-on copy into a temp dir and checks the copy on all four privacy pages.
- **Import** (`scripts/buttondown-import.mjs`): a one-time import of the signups already in KV (below).

Flags, on the Pages project **draftmatrix-site** (**Settings** → **Variables and Secrets**, Production):

| Name | Type | Value |
|---|---|---|
| `BUTTONDOWN_API_KEY` | **Encrypted** secret | Buttondown → Settings → API → API key. Never in the repo |
| `BUTTONDOWN_ENABLED` | Plain text variable | `true` (exactly). Anything else, or unset, means off |
| `BUTTONDOWN_TAGS` | Plain text variable, optional | `true` only on a paid Buttondown plan with tagging. Adds tag `<sport>-launch` (`nfl-launch`, `all-launch`, …). On the free plan a new tag is a 403 `feature_disabled`; the worker then retries once without tags, but leave this unset |

The worker forwards only when the key is non-empty **and** `BUTTONDOWN_ENABLED` is `true`. The GitHub workflow doesn't need the key: `wrangler pages deploy` uploads only `dist/`, and the secret and variables live on the Pages project and survive deploys.

Double opt-in: we never send `type: "regular"`, because our signups aren't email-verified. So every subscriber created through the API, from the worker **or the import**, starts as `unactivated` and gets Buttondown's confirmation email. They get newsletters only after clicking it. People who signed up before this was on will get that confirmation email out of the blue. If you want, mention it in the first newsletter, or send it soon after the import.

Rate limit: the subscriber-create endpoint allows about 100 requests a day for a new newsletter (more over time). For a big first import, Buttondown recommends its CSV import instead (dashboard, or `POST /v1/imports`); `node scripts/export-signups.mjs` writes `signups.csv` for it. Check in Buttondown's dashboard whether a CSV import sends confirmation emails or marks people as confirmed, because these signups were never email-verified.

Unsubscribes and deletion: Buttondown handles unsubscribes, but they don't reach KV. The privacy pages promise signups are "kept until you unsubscribe or ask us to delete them", so every so often, export the unsubscribed list from Buttondown and delete those `email:<address>` keys from `SIGNUPS` (`npx wrangler kv key delete --namespace-id <SIGNUPS id> "email:<address>" --remote`). A deletion request means deleting the address in both places.

### Running the import

Dry run first. It sends nothing and prints counts only (keys read, unique emails, invalid/skipped, per sport). It never prints an email address:

```sh
CF_ACCOUNT_ID=<id> SIGNUPS_NAMESPACE_ID=<id> CLOUDFLARE_API_TOKEN=<KV read token> \
  node scripts/buttondown-import.mjs --dry-run
# or from an export:
node scripts/export-signups.mjs signups.csv   # same env vars
node scripts/buttondown-import.mjs --from-file signups.csv --dry-run
```

Then the real run: the same command with `BUTTONDOWN_API_KEY=<key>` and without `--dry-run`. (With no key it's always a dry run.) It deduplicates by lowercased email, merges sports, and sends the worker's exact request (no `ip_address`, since we don't keep visitors' IPs), oldest signup first, about one a second. It sends at most `--limit` (default 90) per run and stops at the first 429. It prints only status-code counts and the `--skip N` for the next day's run. Add `--tags` only on a paid plan with tagging (one `<sport>-launch` tag per sport). Failed requests (non-2xx) aren't retried. Re-running over the same people is safe for the data (collision `add`), but it may send them another confirmation email. Don't commit `signups.csv`.

### Enable sequence

1. Buttondown: create the newsletter, check its confirmation email, copy the API key.
2. Pages project **draftmatrix-site** → **Settings** → **Variables and Secrets** → Production: add `BUTTONDOWN_API_KEY` (**Encrypt**) and `BUTTONDOWN_ENABLED` = `true`. Leave `BUTTONDOWN_TAGS` unset unless the plan has tagging. These take effect on the next deployment.
3. PR that sets `const BUTTONDOWN_LIVE = true;` in `build.mjs`, so the privacy pages and the success message say what now happens. `python3 scripts/check.py` then requires the Buttondown copy on all four privacy pages.
4. Merge. GitHub Actions builds and deploys, and the new deployment picks up the secret and variable.
5. Test one real signup with your own address: the page says to check your inbox, Buttondown shows an unactivated subscriber with metadata `sports`, the confirmation email arrives, and confirming activates it. The worker logs (Pages → deployment → Functions → real-time logs) show `buttondown 201`.
6. Run the import (dry run first, as above), one `--limit 90` batch a day, or use Buttondown's CSV import for a large list.

### Turning it off again

- Stop forwarding right away: set `BUTTONDOWN_ENABLED` to anything other than `true` (or delete it, or the key) on the Pages project, then redeploy (Actions → Deploy → Run workflow). Signups keep going to KV as before.
- Then a PR setting `BUTTONDOWN_LIVE = false`, so the site stops naming Buttondown. If subscribers stay in Buttondown, the privacy copy should still say so until they're deleted there. In that case keep the flag on, or update the copy, rather than publishing "never shared".
- Delete the API key in Buttondown if it's no longer needed.

## Verifying a deploy

```sh
node build.mjs
python3 scripts/verify-deploy.py dist https://draftmatrix.app   # both arguments are the defaults
```

It fetches every file in `dist/` (except `_worker.js`, `_routes.json`, `_redirects`) at the URL Pages serves it at, compares SHA-256 hashes, checks `/_redirects` and `/_routes.json` are 404 and that each `_redirects` rule answers with its code and target, prints a table, and exits 1 on any failure. Build from the same commit that was deployed, or the hashes won't match. Point it at a preview URL (`https://<hash>.draftmatrix-site.pages.dev`) to check a deployment before it's on the domain.
