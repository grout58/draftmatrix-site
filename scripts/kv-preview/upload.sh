#!/bin/sh
# Preview-only deploy path used on 2026-10-23 because wrangler wasn't logged in
# on the Mac. Uploads dist/ to the SITE KV namespace through a temporary,
# nonce-protected upload Worker, and composes the preview _worker.js
# (shim + src/_worker.js). Normal deploys should use:
#   npx wrangler pages deploy dist --project-name draftmatrix-site --branch site-v2
# Usage: UPLOAD_URL=https://<temp-worker> UPLOAD_NONCE=... sh scripts/kv-preview/upload.sh
set -eu
: "${UPLOAD_URL:?}" "${UPLOAD_NONCE:?}"
cd "$(dirname "$0")/../.."
{ cat scripts/kv-preview/shim.js; sed 's/^export default {/const __site = {/' dist/_worker.js; cat scripts/kv-preview/tail.js; } > /tmp/dm-preview-worker.js
ct() { case "$1" in
  *.html) echo 'text/html; charset=utf-8';; *.css) echo 'text/css; charset=utf-8';;
  *.js) echo 'text/javascript; charset=utf-8';; *.json) echo 'application/json';;
  *.svg) echo 'image/svg+xml';; *.png) echo 'image/png';; *.webp) echo 'image/webp';;
  *.jpg|*.jpeg) echo 'image/jpeg';; *.xml) echo 'application/xml';; *.txt) echo 'text/plain; charset=utf-8';;
  *.ico) echo 'image/x-icon';; *) echo 'text/plain; charset=utf-8';; esac; }
(cd dist && find . -type f ! -name '_worker.js' ! -name '_routes.json' ! -name '.DS_Store' | sed 's|^\.||') | while read -r p; do
  curl -fsS -X PUT -H "x-nonce: $UPLOAD_NONCE" -H "content-type: $(ct "$p")" --data-binary "@dist$p" "$UPLOAD_URL$p" >/dev/null && echo "up $p"
done
curl -fsS -X PUT -H "x-nonce: $UPLOAD_NONCE" -H 'content-type: text/javascript' --data-binary @/tmp/dm-preview-worker.js "$UPLOAD_URL/__deploy/worker.js" >/dev/null && echo "up worker"
