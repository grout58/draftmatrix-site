# Deploying draftmatrix.app

## Current state

- `main` is the source of truth. It is live at https://draftmatrix.app (and www.draftmatrix.app) from the Cloudflare Pages project **draftmatrix-site**.
- The project is a **Direct Upload** project, created through the Cloudflare API. Cloudflare's docs say a Direct Upload project can't be switched to Git integration later, so the dashboard will never offer "Connect to Git" for it.
- The live deployment was made through the API/KV stopgap in [`scripts/kv-preview/`](scripts/kv-preview/README.md), because wrangler wasn't logged in anywhere: the files sit in a KV namespace bound as `SITE` and a shim worker serves them.
- Production bindings on the project: KV `SIGNUPS`, `FEEDBACK` and `SITE`, and the encrypted secret `TURNSTILE_SECRET`. Custom domains: `draftmatrix.app`, `www.draftmatrix.app`.

Pick one of the options below. A is recommended.

## A (recommended): GitHub Actions + wrangler

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every push to `main` (and by hand from the Actions tab): `node build.mjs`, `python3 scripts/check.py`, then `npx wrangler@4 pages deploy dist --project-name draftmatrix-site --branch main`. Until the token secret exists, the deploy step is skipped with a notice and the job still passes.

1. **Create the token.** Cloudflare dashboard → **Manage account** → **Account API tokens** → **Create Token** → **Custom token** → **Get started**. Name it (e.g. "draftmatrix-site GitHub deploy"). Permissions: **Account** / **Cloudflare Pages** / **Edit**. Account Resources: **Include** → this account only. Create it and copy the token (it's shown once).
2. **Copy the account id**: it's the 32-character hex id in the dashboard URL (`dash.cloudflare.com/<account id>/...`), also under the account's menu → **Copy account ID**.
3. **Add the secrets.** GitHub → grout58/draftmatrix-site → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**:
   - `CLOUDFLARE_API_TOKEN` = the token
   - `CLOUDFLARE_ACCOUNT_ID` = the account id
4. Run the workflow once (Actions → Deploy → Run workflow), or push to `main`.

Consequences:

- Keeps the existing project, its custom domains, the KV bindings and `TURNSTILE_SECRET`. Nothing in DNS changes.
- Every push to `main` deploys to production. Deployments show up under the project as usual, with the commit.
- Pages serves `dist/` as real static assets (pretty URLs, `_redirects`, `_routes.json`), and `dist/_worker.js` gets the real `env.ASSETS`. The KV shim isn't used any more. The `SITE` binding and its namespace can be removed once a wrangler deploy is verified; nothing reads them.
- The token can only edit Pages in this account. Rotate it by creating a new one, updating the secret, and deleting the old token.

## B: Recreate as a Git-connected project

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

## C: Keep the API/KV stopgap

Follow [`scripts/kv-preview/README.md`](scripts/kv-preview/README.md) for each deploy: create the temporary upload Worker with an `UPLOAD_NONCE` secret, run `upload.sh`, run `deploy-via-api.js`, delete the upload Worker.

Consequences: no new tokens or apps, but every deploy is manual, the shim only approximates Pages static serving (pretty URLs, indexes, `_redirects`), every request runs the worker (counts against the Workers request quota) and reads KV, and files deleted from `dist/` stay in KV until deleted by hand.

## Verifying a deploy

```sh
node build.mjs
python3 scripts/verify-deploy.py dist https://draftmatrix.app   # both arguments are the defaults
```

It fetches every file in `dist/` (except `_worker.js`, `_routes.json`, `_redirects`) at the URL Pages serves it at, compares SHA-256 hashes, checks `/_redirects` and `/_routes.json` are 404 and that each `_redirects` rule answers with its code and target, prints a table, and exits 1 on any failure. Build from the same commit that was deployed, or the hashes won't match. Point it at a preview URL (`https://<hash>.draftmatrix-site.pages.dev`) to check a deployment before it's on the domain.

> **Status (2026-10-23):** the repo secrets are set, so production deploys now come from GitHub Actions on every push to `main`.
