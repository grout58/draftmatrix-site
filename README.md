# draftmatrix-site

The marketing and support site for the DraftMatrix apps, for Cloudflare Pages at https://draftmatrix.app.

## Stack

- Plain HTML and one shared stylesheet (`src/site.css`). The signup form is the only JavaScript (`src/signup.js`).
- `build.mjs` is a dependency-free Node script. It wraps the page bodies in `src/pages/` with the shared head, header and footer, and writes the deployable site to `dist/`. No npm and no `package.json`.
- No external fonts, scripts, analytics or cookies.

```
build.mjs              build script (SIGNUP_LIVE flag at the top)
src/pages/*.html       page bodies: home, nfl, nba, nhl, mlb
src/site.css           shared styles (copied to dist/assets/site.css)
src/signup.js          signup form handler (copied to dist/assets/signup.js)
functions/api/subscribe.js   Cloudflare Pages Function for POST /api/subscribe
assets/                screenshots, icons, OG images, App Store badges (committed)
scripts/screens.py     regenerates assets/screens + assets/icons from ../DraftMatrix
scripts/og.py          regenerates assets/og/*.png (1200x630)
scripts/check.py       checks dist/ (legacy byte-identity, brand scan, links, size)
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
| `/support.html` | the old `index.html` (football support), copied byte-for-byte |
| `/privacy.html`, `/hockey.html`, `/hockey-privacy.html`, `/basketball.html`, `/basketball-privacy.html`, `/baseball.html`, `/baseball-privacy.html` | copied byte-for-byte |
| `/_redirects`, `/sitemap.xml`, `/robots.txt` | generated |
| `/assets/` | `assets/` plus the CSS and JS |

The legacy pages link to each other relatively (`privacy.html`, `hockey.html`), and those links still resolve because every legacy file sits at the root.

To regenerate images (needs Python 3 with Pillow, and `../DraftMatrix` checked out beside this repo):

```sh
python3 scripts/screens.py   # screenshots + icons from the app repos
python3 scripts/og.py        # Open Graph images
```

## Deploy

Run from the **repo root**, not from `dist/`. Pages looks for `functions/` in the current working directory, and `dist` is the output directory:

```sh
node build.mjs
npx wrangler pages deploy dist --project-name draftmatrix-site --branch site-v2
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

## Email signup (not live yet)

Every page has a form that posts JSON `{email, sport, company}` to `/api/subscribe`. `company` is a hidden honeypot field, and `sport` is one of `all`, `nfl`, `nba`, `nhl`, `mlb`.

`functions/api/subscribe.js`:

- **No KV binding named `SIGNUPS`:** returns `503 {ok:false, reason:"signup not live"}`. The form then shows "Signups open soon — this form isn't live yet."
- **With the binding:** validates the email and stores key `email:<lowercased email>` with value `{"sport": "...", "ts": "<ISO time>"}`, then returns `200 {ok:true}`. A bad email gets 400.
- **Honeypot filled in:** returns 200 and stores nothing.

The form only reports success on a 200 with `ok: true`.

To go live:

1. Create a KV namespace, for example `wrangler kv namespace create draftmatrix-signups`.
2. In the Pages project, go to **Settings → Bindings** and add a KV namespace binding named `SIGNUPS` for Production (and Preview if wanted).
3. In `build.mjs`, set `SIGNUP_LIVE = true`. This removes the "Preview: signups aren't live yet." note under each form.
4. Rebuild and deploy.

Each address keeps one record, so signing up again (say, from a different sport page) overwrites the earlier `sport`.

Locally, `python3 -m http.server` can't run the function, so the form shows its generic error there. `npx wrangler pages dev dist` runs the function.

## Rules for copy

- No professional league, team or ranking-publisher brand in anything visible: text, titles, meta descriptions, alt text. The URL slugs `/nfl/` and the others are the only exception. `scripts/check.py` scans for this.
- Every claim must be backed by the app code or the submitted 2.0.1 App Store descriptions. Record it in `CLAIMS.md`.
- Use only real screenshots, never drawn UI. App Store badges are Apple's artwork, unmodified: black in light mode, white in dark mode, at least 40px tall.
