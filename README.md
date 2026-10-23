# draftmatrix-site

The marketing and support site for the DraftMatrix apps, for Cloudflare Pages at https://draftmatrix.app.

## Stack

- Plain HTML and one shared stylesheet (`src/site.css`). The only JavaScript is the signup form (`src/signup.js`) and the feedback form (`src/feedback.js`).
- One dependency-free Pages worker (`src/_worker.js`, Pages "advanced mode") for the two form endpoints.
- `build.mjs` is a dependency-free Node script. It wraps the page bodies in `src/pages/` with the shared head, header and footer, and writes the deployable site to `dist/`. No npm and no `package.json`.
- No external fonts, analytics or tracking. The one third-party script is Cloudflare Turnstile (`https://challenges.cloudflare.com/turnstile/v0/api.js`, `async defer`), the spam check on the two forms. It loads only on pages with a form: the home and sport pages (signup) and the four support pages (feedback). The privacy pages don't load it. `scripts/check.py` enforces this.
- There is no Content-Security-Policy today. If you add one (in a `_headers` file), Turnstile needs `script-src https://challenges.cloudflare.com` and `frame-src https://challenges.cloudflare.com`. Everything else the pages load is same-origin.
- Dark UI throughout (`color-scheme: dark`), styled after the app icons: a dark sport-tinted background, pink `#ff5e7d` / green `#3fde9b` / blue `#4eb9ff` tier accents and chips, and a 3×3 glossy tile motif (CSS on the pages, SVG in the header next to the wordmark). The motif is a generic brand pattern, not an app icon. Text colors were checked for WCAG AA against the lightest tint (football `#284a33`) with the card overlay.

| Page | Tint (top → bottom) | Artwork | Favicon / touch icon |
|---|---|---|---|
| `/` | `#1d2430` → `#0b0f14` | tile motif, all three real icons on the app cards | football icon |
| `/nfl/` | `#284a33` → `#07170d` | football icon | football icon |
| `/nba/` | `#2f1e13` → `#130e08` | hoops icon | hoops icon |
| `/nhl/` | `#233851` → `#071019` | hockey icon | hockey icon |
| `/mlb/` | `#1d2430` → `#0b0f14` | tile motif (there is no baseball app icon) | tile motif (`assets/icons/motif.svg`, `motif-64.png`, `motif-180.png`) |

```
build.mjs              build script (SIGNUP_LIVE, SUPPORT_EMAIL, PROVIDER, TURNSTILE_SITEKEY at the top)
src/pages/*.html       page bodies: home, nfl, nba, nhl, mlb
src/site.css           shared styles (copied to dist/assets/site.css)
src/signup.js          signup form handler (copied to dist/assets/signup.js)
src/feedback.js        feedback form handler (copied to dist/assets/feedback.js)
src/_worker.js         Pages worker: POST /api/subscribe, POST /api/feedback (copied to dist/_worker.js)
assets/                screenshots, icons, OG images, App Store badges (committed)
scripts/screens.py     regenerates assets/screens from ../DraftMatrix
scripts/icons.py       regenerates assets/icons from .work/icon-<sport>-1024.png
scripts/motif_icon.py  draws assets/icons/motif.svg, motif-64.png, motif-180.png (baseball favicon)
scripts/og.py          regenerates assets/og/*.png (1200x630)
scripts/export-signups.mjs   SIGNUPS KV -> signups.csv (Cloudflare REST API)
scripts/export-feedback.mjs  FEEDBACK KV -> feedback.csv
scripts/check.py       checks dist/ (legacy pages, brand scan, links, worker tests, size)
scripts/worker-test.mjs  runs dist/_worker.js in node with fake KV and ASSETS
scripts/verify-deploy.py compares a deployed site with dist/ by SHA-256 (DEPLOY.md)
scripts/kv-preview/    stopgap API/KV deploy path (its README.md)
.github/workflows/deploy.yml  build, check and wrangler deploy on push to main
DEPLOY.md              how the site is deployed and the options
*.html at the root     legacy support/privacy pages, never edited
CLAIMS.md              every factual claim on the site and the source that backs it
```

## Build

```sh
node build.mjs                    # writes dist/
python3 scripts/check.py --serve  # optional: verify dist/ and fetch every page locally
```

`dist/` is not committed; it's in `.gitignore`.

What ends up in `dist/`:

| Path | Source |
|---|---|
| `/` (`index.html`) | new home page |
| `/nfl/`, `/nba/`, `/nhl/`, `/mlb/` | new sport pages (`<slug>/index.html`) |
| `/support.html` | the old `index.html` (football support) plus an added Contact us section |
| `/hockey.html`, `/basketball.html`, `/baseball.html` | copied, plus an added Contact us section |
| `/privacy.html`, `/hockey-privacy.html`, `/basketball-privacy.html`, `/baseball-privacy.html` | copied, plus an added email-list section |
| `/_redirects`, `/_routes.json`, `/sitemap.xml`, `/robots.txt` | generated |
| `/_worker.js` | `src/_worker.js` |
| `/assets/` | `assets/` plus the CSS and JS |

### Sections added to the legacy pages

The sources at the repo root are never edited. The build copies each one and inserts one block, between `<!-- dm-added:start -->` and `<!-- dm-added:end -->`, just before the page's closing lines (the `<footer>` on `support.html` and `privacy.html`, the independence disclaimer on the others). Each block has its own small `<style>` scoped to `.dm-added`, so the rest of the page looks exactly as before. `scripts/check.py` cuts the block (and the inline additions below) out and checks that what's left is byte-identical to the source.

- **Support pages: "Contact us"**, with `SUPPORT_EMAIL` (support@draftmatrix.app) as a `mailto:` link as the primary contact, then a feedback form (name optional, email, app preselected for the page, message up to 4,000 characters, honeypot) that posts to `/api/feedback`, and github.com/grout58 as a secondary contact. If `SUPPORT_EMAIL` is ever set to `null`, the section falls back to GitHub and the form and the build prints a warning (nothing placeholder-like goes into the pages).
- **Privacy pages: "Website email list and feedback form"**, dated "Added October 23, 2026", anchor `#email-list`. It opens by saying the apps still collect no data and the section covers only the website's optional forms, then lists exactly the fields the worker stores, what each is used for, retention ("until you unsubscribe or ask us to delete"), and the Turnstile note with a link to Cloudflare's privacy policy. It names where the data is stored from `PROVIDER` in `build.mjs` (now "Cloudflare, our website host"); change that when an email provider is chosen. If the worker ever stores another field, update this section in the same change. Its deletion sentence names the support email.
- **Inline edits**, each one line between `<!-- dm-inline:start -->` and `<!-- dm-inline:end -->`: on the four privacy pages, the Contact sentence is replaced (owner's decision, 2026-10-23: no GitHub on the privacy pages) with "Email us at support@draftmatrix.app, or use the support page linked from the App Store listing.", with the email as a `mailto:` link and "support page" linking to that app's support page; on `baseball.html` and `baseball-privacy.html`, the motif favicon links just before `</head>` (those pages had no favicon). `scripts/check.py` cuts these out too (for the privacy pages it also cuts the old GitHub sentence out of the source before comparing), checks where each sits and what the new sentence says, checks no "github.com/grout58" is left on the privacy pages, and checks the email is on all eight pages with no placeholder left. The support pages keep GitHub as a secondary contact.

The legacy pages link to each other relatively (`privacy.html`, `hockey.html`), and those links still resolve because every legacy file sits at the root.

To regenerate images (needs Python 3 with Pillow, and `../DraftMatrix` checked out beside this repo):

```sh
python3 scripts/screens.py   # screenshots from the app repos
python3 scripts/icons.py     # app icons: 512/256/128 webp+png, 180 touch, 64 favicon
python3 scripts/og.py        # Open Graph images (needs the icons first)
```

`scripts/icons.py` reads the 1024px App Store icons from `.work/icon-nfl-1024.png`, `icon-nba-1024.png` and `icon-nhl-1024.png`. `.work/` is not committed, so copy them there first (the current files are JPEG data with a `.png` name; Pillow reads them either way). Baseball has no released icon: there must be no `assets/icons/mlb-*`, and `scripts/check.py` fails if one appears or is referenced. The baseball page, its home card and its OG image use the tile motif instead, and `/mlb/` plus the two baseball legacy pages use the motif favicon from `python3 scripts/motif_icon.py` (no inputs; same geometry as the header SVG).

## Deploy

See [DEPLOY.md](DEPLOY.md) for how the live site is deployed, the options for automating it (GitHub Actions + wrangler is recommended), and `scripts/verify-deploy.py`.

`dist/` is the complete deployable site, including `dist/_worker.js`. There is no `functions/` directory: the site uses Pages "advanced mode", which works with Direct Upload because the worker is a single dependency-free ES module that needs no compiling.

```sh
node build.mjs
npx wrangler@4 pages deploy dist --project-name draftmatrix-site --branch main
```

### How the worker and static files fit together

- `dist/_routes.json` (`{"include": ["/api/*"]}`) tells Pages to run the worker only for `/api/*`. Every other request is served as a static asset without touching the worker, so it doesn't count as a worker invocation.
- If the worker does run for a non-API path, it hands the request to `env.ASSETS.fetch(request)` unchanged.
- Static asset serving, which is what `env.ASSETS` is, applies `_redirects` and pretty URLs (`/support.html` → `/support`). Requests the worker answers itself (`/api/*`) don't go through `_redirects` or `_headers`, and none of the rules touch `/api/`.
- I couldn't open Cloudflare's docs from here, so this comes from memory, not a fresh read. After the first preview deploy, confirm it:

  ```sh
  curl -sI https://<preview>.pages.dev/draftmatrix-site/hockey.html   # 301 -> /hockey.html
  curl -sI https://<preview>.pages.dev/support.html                   # 308 -> /support
  curl -s  https://<preview>.pages.dev/api/subscribe                  # 405 JSON
  ```

## Redirects

`dist/_redirects`:

```
/draftmatrix-site /support 301
/draftmatrix-site/ /support 301
/draftmatrix-site/index.html /support 301
/draftmatrix-site/* /:splat 301
```

The old GitHub Pages root was the football support page, so it goes to `/support`. Every other old path keeps its name: `/draftmatrix-site/hockey.html` → `/hockey.html`, which Pages then serves at `/hockey`.

There is deliberately **no** `/support -> /support.html` rule. Pages "pretty URLs" already serve `support.html` at `/support` and redirect `/support.html` to `/support`. A rule sending `/support` back to `/support.html` would loop. For the same reason the redirect targets are the bare paths (`/support`, not `/support.html`), which saves a hop. Only requests that reach Cloudflare use these rules. Old `grout58.github.io/draftmatrix-site/...` links keep going to GitHub Pages until that site is changed.

## Forms and the worker

`src/_worker.js` (deployed as `dist/_worker.js`) handles two endpoints. Both take JSON (or form-encoded) bodies and answer JSON with `cache-control: no-store`.

| Request | Response |
|---|---|
| Anything but POST on `/api/*` | 405, `Allow: POST` |
| POST to an unknown `/api/*` path | 404 |
| `Origin` header present and not this host | 403 |
| Binding missing (`SIGNUPS` for subscribe, `FEEDBACK` for feedback), or `TURNSTILE_SECRET` missing | 503 `{ok:false, reason:"not live"}` |
| Bad JSON, or body too large | 400 |
| Honeypot `company` filled in | 200 `{ok:true}`, nothing stored, Turnstile not called |
| `turnstileToken` missing, empty, over 2,048 characters, or rejected by siteverify | 403 `{ok:false, reason:"verification failed"}`, nothing stored |
| siteverify unreachable or answering non-2xx | 502 `{ok:false, reason:"verification unavailable"}`, nothing stored |
| Invalid input | 400 |
| KV error | 500 |
| Stored | 200 `{ok:true}` |

**Turnstile.** Both forms carry a managed Turnstile widget (`data-sitekey` from `TURNSTILE_SITEKEY` in `build.mjs`; the sitekey is public). The front end sends the widget's token as `turnstileToken` in the JSON and resets the widget after every submit, since tokens are single-use. Before storing anything, the worker POSTs form-encoded `secret=env.TURNSTILE_SECRET`, `response=<token>` and `remoteip=<CF-Connecting-IP>` to `https://challenges.cloudflare.com/turnstile/v0/siteverify` and stores only if the answer has `success: true`. On a 403 "verification failed" both forms say "Couldn't verify you're human — please try again." The widget only renders on hostnames listed for the sitekey in the Turnstile dashboard, so add `draftmatrix.app`, the `*.pages.dev` preview host and, for local testing, `localhost`.

**`POST /api/subscribe`** `{email, sport, company, turnstileToken}`, where `sport` is `all`, `nfl`, `nba`, `nhl` or `mlb` (anything else becomes `all`). Stored in KV `SIGNUPS` under `email:<lowercased email>` as `{sport, sports, ts, firstTs}`: `sport` and `ts` are the latest signup, `sports` collects every sport page the address signed up from (no duplicates), and `firstTs` is the first signup. Signing up again merges into this record instead of overwriting it. Records in the older `{sport, ts}` shape are upgraded on the next signup.

**`POST /api/feedback`** `{name, email, app, message, company, turnstileToken}`. Email and message are required, the message can be up to 4,000 characters, and the name up to 200. `app` is `football`, `hoops`, `hockey`, `baseball` or `other`. Stored in KV `FEEDBACK` under `fb:<ISO time>:<8 random hex>` as `{name, email, app, message, ts}`. The User-Agent is no longer stored. Records written before this change (2026-10-23) may still have a `ua` field; the export leaves it out.

Neither endpoint stores an IP address or any other header. The `CF-Connecting-IP` is only passed to siteverify.

The forms only report success on 200 with `ok: true`. On 503 the signup form says "Signups open soon — this form isn't live yet." and the feedback form says "The form isn't live yet — please use the contact link above." Anything else gets a generic try-again message; the feedback one points to the contact link.

Setup:

1. Create two KV namespaces, for example `wrangler kv namespace create draftmatrix-signups` and `wrangler kv namespace create draftmatrix-feedback`.
2. In the Pages project, under **Settings → Bindings**, add KV bindings `SIGNUPS` and `FEEDBACK` for Preview and Production.
3. Under **Settings → Variables and Secrets**, add the Turnstile secret key as an encrypted secret `TURNSTILE_SECRET` for Preview and Production (or `npx wrangler pages secret put TURNSTILE_SECRET --project-name draftmatrix-site`). Never commit it. Until it's set, both endpoints answer 503 "not live".
4. `SIGNUP_LIVE` in `build.mjs` is `true`, so the forms carry no "Preview" note. Set it back to `false` to show "Preview: signups aren't live yet." again. Without a binding or the secret the endpoints still answer 503, whatever the flag says.

Feedback isn't emailed anywhere yet. Read it in the dashboard (KV → `FEEDBACK`) or export it (below).

Locally, `python3 -m http.server` can't run the worker, so the forms show their generic error there. `npx wrangler pages dev dist` runs it (put `TURNSTILE_SECRET` in `.dev.vars`; Cloudflare publishes test keys that always pass or fail). `node scripts/worker-test.mjs` tests it against fake bindings and a mocked siteverify.

## Exporting signups and feedback

Two dependency-free Node 18+ scripts read a whole KV namespace through the Cloudflare REST API and write CSV. Credentials come only from environment variables; nothing is hardcoded. The token needs **Account → Workers KV Storage → Read**.

```sh
export CF_ACCOUNT_ID=<account id>
export CLOUDFLARE_API_TOKEN=<api token>

SIGNUPS_NAMESPACE_ID=<id> node scripts/export-signups.mjs    # -> signups.csv
FEEDBACK_NAMESPACE_ID=<id> node scripts/export-feedback.mjs  # -> feedback.csv
```

Pass a path as the first argument to write somewhere else. Namespace IDs are in the dashboard (Storage & Databases → KV) or from `npx wrangler kv namespace list`.

- `signups.csv`: `email,sports,first_signup,last_signup`, oldest first. `sports` is `;`-separated (`all` means the home page form), times are ISO 8601 UTC. It's ready for an email provider's CSV import (Buttondown, Mailchimp and the like): map `email` to the address field and, if you want them, the other columns to custom fields or tags.
- `feedback.csv`: `sent,name,email,app,message`, oldest first. Names and messages starting with `=`, `+`, `-` or `@` get a leading `'` so spreadsheets don't run them as formulas.

Both files hold personal data. They're in `.gitignore`; don't commit or share them, and delete them once imported.

The wrangler alternative, one key at a time (Wrangler 4 needs `--remote` to read the deployed namespace rather than a local one; I couldn't check the current docs from here):

```sh
npx wrangler kv key list --namespace-id <SIGNUPS id> --prefix email: --remote
npx wrangler kv key get  --namespace-id <SIGNUPS id> "email:someone@example.com" --remote
npx wrangler kv key list --namespace-id <FEEDBACK id> --prefix fb: --remote
```

## Rules for copy

- No professional league, team or ranking-publisher brand in anything visible: text, titles, meta descriptions, alt text. The URL slugs `/nfl/` and the others are the only exception. `scripts/check.py` scans for this.
- Every claim must be backed by the app code or the submitted 2.0.1 App Store descriptions. Record it in `CLAIMS.md`.
- Use only real screenshots, never drawn UI. Use only the real app icons for football, hoops and hockey; never draw or invent a baseball icon.
- App Store badges are Apple's artwork, unmodified, at least 40px tall, one per app card. The site is dark, so it uses the black badge, which has its own gray border for dark backgrounds (the white badge in `assets/badges/` is the allowed alternative).
