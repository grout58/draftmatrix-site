# API/KV deploy path (stopgap)

This is how the live site was first deployed, on 2026-10-23, when wrangler wasn't logged in anywhere and the only tool available could call `api.cloudflare.com` with its own auth. It is a **stopgap**. Use the GitHub Actions + wrangler deploy in [`DEPLOY.md`](../../DEPLOY.md) instead once its secrets are set; that path serves `dist/` as real Pages static assets and doesn't use anything in this directory.

How it works: every file in `dist/` (except `_worker.js` and `_routes.json`) lives in a KV namespace bound to the Pages project as `SITE`. The deployment has no static assets (`manifest="{}"`), only a `_worker.js` made of `shim.js` + `dist/_worker.js` (with `export default {` renamed to `const __site = {`) + `tail.js`. The shim serves files out of `SITE` with Pages-like pretty URLs, directory indexes and `_redirects`, never serves anything under `/_`, and passes the real worker a fake `env.ASSETS` backed by KV.

| File | Role |
|---|---|
| `upload-worker.js` | temporary Worker that writes into the namespace (`PUT`/`DELETE` a path, `GET /__list`), guarded by an `x-nonce` header checked against the `UPLOAD_NONCE` secret |
| `upload.sh` | uploads `dist/` through that Worker and stages the composed worker at `/__deploy/worker.js` |
| `deploy-via-api.js` | reads `/__deploy/worker.js`, creates the Pages deployment, deletes the staged key |
| `shim.js`, `tail.js` | wrapped around `dist/_worker.js` to make the deployed worker |

Nothing here holds an id, token or nonce. Account id, namespace ids and tokens come from environment variables; the nonce lives only in the Worker secret and your shell.

## Steps

You need: the account id (`CF_ACCOUNT_ID`), the id of the namespace bound as `SITE` in the Pages project (`SITE_NAMESPACE_ID`), and an API token with **Account → Workers Scripts → Edit**, **Account → Workers KV Storage → Edit** and **Account → Cloudflare Pages → Edit** (`CLOUDFLARE_API_TOKEN`).

1. **Build and check.**

   ```sh
   node build.mjs && python3 scripts/check.py
   ```

2. **Create the upload Worker** `dm-upload-staging` from `upload-worker.js`, with the `SITE` namespace bound as `STAGE` and a fresh random nonce as the secret `UPLOAD_NONCE`. With wrangler:

   ```sh
   export UPLOAD_NONCE="$(openssl rand -hex 32)"
   cat > /tmp/dm-upload.toml <<EOF
   name = "dm-upload-staging"
   main = "$PWD/scripts/kv-preview/upload-worker.js"
   compatibility_date = "2026-10-01"
   workers_dev = true
   kv_namespaces = [{ binding = "STAGE", id = "$SITE_NAMESPACE_ID" }]
   EOF
   npx wrangler@4 deploy --config /tmp/dm-upload.toml
   printf %s "$UPLOAD_NONCE" | npx wrangler@4 secret put UPLOAD_NONCE --config /tmp/dm-upload.toml
   ```

   Or through the REST API: `PUT /accounts/{CF_ACCOUNT_ID}/workers/scripts/dm-upload-staging` (multipart: `metadata` = `{"main_module":"upload-worker.js","compatibility_date":"2026-10-01","bindings":[{"type":"kv_namespace","name":"STAGE","namespace_id":"<SITE_NAMESPACE_ID>"},{"type":"secret_text","name":"UPLOAD_NONCE","text":"<nonce>"}]}`, plus the file part `upload-worker.js` with type `application/javascript+module`), then `POST /accounts/{CF_ACCOUNT_ID}/workers/scripts/dm-upload-staging/subdomain` with `{"enabled":true}` to put it on `workers.dev`. Don't save the nonce anywhere.

   Without the secret the Worker answers 503 to everything; with a wrong `x-nonce`, 403.

3. **Upload `dist/`.** `UPLOAD_URL` is the Worker's `https://dm-upload-staging.<subdomain>.workers.dev` URL, no trailing slash.

   ```sh
   UPLOAD_URL=https://dm-upload-staging.<subdomain>.workers.dev UPLOAD_NONCE="$UPLOAD_NONCE" sh scripts/kv-preview/upload.sh
   curl -s -H "x-nonce: $UPLOAD_NONCE" "$UPLOAD_URL/__list"   # every key, including /__deploy/worker.js
   ```

   `upload.sh` only adds and overwrites. To remove a file that's gone from `dist/`, `curl -X DELETE -H "x-nonce: $UPLOAD_NONCE" "$UPLOAD_URL/<path>"`.

4. **Create the deployment.**

   ```sh
   CF_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... SITE_NAMESPACE_ID=... node scripts/kv-preview/deploy-via-api.js main
   ```

   It prints the deployment id and URL. It takes the commit hash and subject from `git`, and marks the deployment dirty if the working tree has changes. A connector can import `deployViaApi` instead and pass its own `request` function; the header of `deploy-via-api.js` describes the contract. The staged key is only deleted after the deployment is created, so a failed run can be retried as is.

5. **Delete the upload Worker** (`npx wrangler@4 delete --config /tmp/dm-upload.toml`, or `DELETE /accounts/{CF_ACCOUNT_ID}/workers/scripts/dm-upload-staging`), then `unset UPLOAD_NONCE` and `rm /tmp/dm-upload.toml`. The KV contents stay; they are the live site.

6. **Verify.**

   ```sh
   python3 scripts/verify-deploy.py dist https://draftmatrix.app
   ```

   KV reads are eventually consistent and the shim sends `cache-control: public, max-age=60`, so give it a minute or two before treating a mismatch as real.
