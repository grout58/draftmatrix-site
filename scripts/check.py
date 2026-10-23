#!/usr/bin/env python3
"""Sanity checks on dist/ after `node build.mjs`. Run from the repo root:

    python3 scripts/check.py          # file checks only
    python3 scripts/check.py --serve  # also serve dist/ locally and fetch every page

Checks:
- each legacy page in dist/ is its source plus exactly one injected block between
  <!-- dm-added:start --> and <!-- dm-added:end -->; with that block cut out, the
  bytes match the source exactly, after also cutting out the one-line edits
  between <!-- dm-inline:start --> and <!-- dm-inline:end -->: the motif favicon
  links in the two baseball pages' <head>, and on each privacy page the new
  Contact sentence (email + support page), compared against the source with its
  old GitHub Contact sentence cut out. Nothing else may differ. The legacy
  sources themselves are unmodified.
- no "github.com/grout58" text or link is left on the four dist privacy pages
  (support pages keep GitHub as a secondary contact).
- support@draftmatrix.app is a mailto: link on all 4 support and all 4 privacy
  pages (privacy: in the Contact line and in the deletion sentence), and no
  "SUPPORT_EMAIL" placeholder text or comment is left anywhere in dist/.
- /mlb/ and the two baseball legacy pages use the motif favicon (assets/icons/motif*).
- the new pages and the injected blocks carry no league or ranking-publisher names
  in visible text, alt/aria text or meta tags (URL slugs like /nfl/ and form values
  are not visible and are allowed).
- every local link and image in the new pages and injected blocks resolves to a file in dist/.
- the Turnstile script loads on exactly the pages that have a form, each widget
  carries the sitekey, and it is the only third-party script.
- there is no baseball app icon (no assets/icons/mlb-*, no reference to one).
- the privacy blocks don't mention data the worker no longer stores (user-agent).
- dist/_worker.js passes scripts/worker-test.mjs (run in node with fake KV and ASSETS).
- dist/_redirects keeps the /draftmatrix-site rules and has a 301 from /x/ to /x
  for every flat legacy page (and there's no dist/x/index.html to loop with).
- dist/404.html exists (so Pages answers unknown paths with 404, not index.html),
  has <meta name="robots" content="noindex"> and no canonical/og:url, and is not in
  sitemap.xml or linked from any page.
- functions/ is gone, and dist/ stays under the size budget.
"""
import random
import re
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

LEGACY = {
    "index.html": "support.html",
    "privacy.html": "privacy.html",
    "hockey.html": "hockey.html",
    "hockey-privacy.html": "hockey-privacy.html",
    "basketball.html": "basketball.html",
    "basketball-privacy.html": "basketball-privacy.html",
    "baseball.html": "baseball.html",
    "baseball-privacy.html": "baseball-privacy.html",
}
NEW = ["index.html", "nfl/index.html", "nba/index.html", "nhl/index.html", "mlb/index.html", "404.html"]
REQUIRED = NEW + list(LEGACY.values()) + ["_redirects", "_routes.json", "_worker.js", "sitemap.xml",
                                          "robots.txt", "assets/site.css", "assets/signup.js", "assets/feedback.js"]
ADDED = re.compile(rb"<!-- dm-added:start -->\n.*?<!-- dm-added:end -->\n", re.S)
INLINE = re.compile(rb"<!-- dm-inline:start -->[^\n]*?<!-- dm-inline:end -->")
# Expected dm-inline additions per legacy page in dist/, in page order.
INLINE_EXPECTED = {
    "support.html": [], "hockey.html": [], "basketball.html": [],
    "baseball.html": ["favicon"],
    "privacy.html": ["email"], "hockey-privacy.html": ["email"], "basketball-privacy.html": ["email"],
    "baseball-privacy.html": ["favicon", "email"],
}
SUPPORT_EMAIL = "support@draftmatrix.app"
MAILTO = f'<a href="mailto:{SUPPORT_EMAIL}">{SUPPORT_EMAIL}</a>'
# The legacy privacy Contact sentence (same pattern as LEGACY_CONTACT in build.mjs).
LEGACY_CONTACT = re.compile(
    rb'Reach us via <a href="https://github\.com/grout58">github\.com/grout58</a>\s+or the '
    rb'(?:<a href="[\w-]+\.html">support page</a>|support page) linked from the App Store listing\.')
SUPPORT_PAGE = {"privacy.html": "support.html", "hockey-privacy.html": "hockey.html",
                "basketball-privacy.html": "basketball.html", "baseball-privacy.html": "baseball.html"}
MOTIF_ICONS = ['href="/assets/icons/motif.svg"', 'href="/assets/icons/motif-64.png"',
               'rel="apple-touch-icon" href="/assets/icons/motif-180.png"']
BRANDS = re.compile(
    r"\b(NFL|NBA|WNBA|NHL|MLB|ESPN|borischen|Boris Chen|fantasyfootballcalculator|"
    r"Fantasy Football Calculator|FantasyPros|Yahoo)\b", re.I)
VISIBLE_ATTR = re.compile(r'\b(alt|title|aria-label|placeholder|content)="([^"]*)"')
TAG = re.compile(r"<[^>]*>")
SCRIPT = re.compile(r"<script\b.*?</script>", re.S)


def visible(html):
    """Text people (and link previews) see: page text plus alt/aria/meta values, minus URLs."""
    attrs = [v for _, v in VISIBLE_ATTR.findall(html) if not re.match(r"(https?://|/)", v)]
    return TAG.sub(" ", SCRIPT.sub("", html)) + "\n" + "\n".join(attrs)
LOCAL_REF = re.compile(r'(?:href|src)="(/[^"#?]*)')
SRCSET = re.compile(r'srcset="([^"]*)"')
RELATIVE_REF = re.compile(r'(?:href|src)="([\w-]+\.html)')
SCRIPT_SRC = re.compile(r'<script\b[^>]*\bsrc="([^"]+)"')
TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js"
SITEKEY = re.search(r'TURNSTILE_SITEKEY = "([^"]+)"', (ROOT / "build.mjs").read_text()).group(1)
BUDGET = 8 * 1024 * 1024

failures = []


def fail(msg):
    failures.append(msg)
    print("FAIL", msg)


def check_files():
    for name in REQUIRED:
        if not (DIST / name).is_file():
            fail(f"missing dist/{name}")

    scanned = {page: (DIST / page).read_text() for page in NEW}
    for src, out in LEGACY.items():
        source, built = (ROOT / src).read_bytes(), (DIST / out).read_bytes()
        blocks = ADDED.findall(built)
        inline = list(INLINE.finditer(built))
        expected = source
        if out in SUPPORT_PAGE:
            old = LEGACY_CONTACT.findall(source)
            if len(old) != 1:
                fail(f"{src}: expected 1 legacy Contact sentence, found {len(old)}")
            expected = LEGACY_CONTACT.sub(b"", source, count=1)
        same = INLINE.sub(b"", ADDED.sub(b"", built)) == expected
        print(f"cmp {src} dist/{out} minus {len(blocks)} added block(s), {len(inline)} inline: "
              f"{'identical' if same else 'DIFFERENT'}")
        if len(blocks) != 1:
            fail(f"{out} has {len(blocks)} added blocks, expected 1")
        if not same:
            fail(f"{out} differs from {src} outside the added blocks")
        kinds = ["favicon" if b"motif" in m.group(0) else "email" if SUPPORT_EMAIL.encode() in m.group(0) else "?"
                 for m in inline]
        if kinds != INLINE_EXPECTED[out]:
            fail(f"{out} inline additions {kinds}, expected {INLINE_EXPECTED[out]}")
        for m in inline:
            if b"motif" in m.group(0):
                if not built[m.end():].startswith(b"</head>"):
                    fail(f"{out}: favicon links aren't just before </head>")
            else:
                want = (f'Email us at {MAILTO}, or use the <a href="{SUPPORT_PAGE[out]}">support page</a> '
                        f'linked from the App Store listing.')
                if not (built[:m.start()].endswith(b"Questions? ") and b"<h2>Contact</h2>" in built[m.start() - 300:m.start()]
                        and m.group(0) == f"<!-- dm-inline:start -->{want}<!-- dm-inline:end -->".encode()):
                    fail(f"{out}: Contact sentence isn't the expected email + support page replacement")
        if out in SUPPORT_PAGE:
            hits = built.lower().count(b"github.com/grout58")
            print(f"github.com/grout58 in dist/{out}: {hits}")
            if hits:
                fail(f"{out} still mentions github.com/grout58")
        scanned[f"{out} (added block)"] = b"".join(blocks + [m.group(0) for m in inline]).decode()

    redirects = (DIST / "_redirects").read_text().splitlines()
    for rule in ["/draftmatrix-site /support 301", "/draftmatrix-site/ /support 301",
                 "/draftmatrix-site/index.html /support 301", "/draftmatrix-site/* /:splat 301"]:
        if rule not in redirects:
            fail(f"_redirects missing {rule!r}")
    for out in LEGACY.values():
        name = out[: -len(".html")]
        rule = f"/{name}/ /{name} 301"
        if rule not in redirects:
            fail(f"_redirects missing {rule!r}")
        if (DIST / name / "index.html").exists():
            fail(f"dist/{name}/index.html exists, so /{name}/ -> /{name} would loop")
    print(f"_redirects: {len(redirects)} rules")

    if (ROOT / "functions").exists():
        fail("functions/ still exists")

    diff = subprocess.run(["git", "diff", "--stat", "--", *LEGACY], cwd=ROOT, capture_output=True, text=True)
    print(f"git diff on legacy sources: {diff.stdout.strip() or 'none'}")
    if diff.stdout.strip():
        fail("legacy sources modified")

    for page, text in scanned.items():
        hits = sorted({m.group(0) for m in BRANDS.finditer(visible(text))})
        print(f"brand scan dist/{page}: {hits or 'clean'}")
        if hits:
            fail(f"{page} mentions {hits}")
        # Legacy pages all sit at the dist root, so their relative links resolve from there.
        srcset = [part.split()[0] for s in SRCSET.findall(text) for part in s.split(",") if part.strip()]
        for ref in LOCAL_REF.findall(text) + RELATIVE_REF.findall(text) + srcset:
            target = DIST / ref.lstrip("/")
            if ref.endswith("/"):
                target = target / "index.html"
            elif not target.exists() and target.suffix == "":
                target = target.with_name(target.name + ".html")  # Pages serves /x from x.html
            if not target.exists():
                fail(f"{page} links to missing {ref}")

    # Turnstile: script on exactly the pages with a widget; no other third-party script.
    pages = {p: (DIST / p).read_text() for p in NEW + list(LEGACY.values())}
    for page, html in pages.items():
        widgets = re.findall(r'<div class="cf-turnstile"[^>]*>', html)
        scripts = SCRIPT_SRC.findall(html)
        external = [s for s in scripts if not s.startswith("/")]
        forms = len(re.findall(r"<form\b", html))
        print(f"turnstile dist/{page}: {forms} form(s), {len(widgets)} widget(s), script {'yes' if TURNSTILE_SCRIPT in scripts else 'no'}")
        if len(widgets) != forms:
            fail(f"{page}: {forms} form(s) but {len(widgets)} Turnstile widget(s)")
        if any(f'data-sitekey="{SITEKEY}"' not in w for w in widgets):
            fail(f"{page}: Turnstile widget without the sitekey")
        if (TURNSTILE_SCRIPT in scripts) != bool(widgets) or scripts.count(TURNSTILE_SCRIPT) > 1:
            fail(f"{page}: Turnstile script should load once, and only on a page with a form")
        if any(s != TURNSTILE_SCRIPT for s in external):
            fail(f"{page}: unexpected third-party script {external}")
        for tag in re.findall(r'<script\b[^>]*' + re.escape(TURNSTILE_SCRIPT) + r'[^>]*>', html):
            if not re.search(r"\basync\b", tag) or not re.search(r"\bdefer\b", tag):
                fail(f"{page}: Turnstile script must be async defer")

    # Support email on every support and privacy page; no placeholder left.
    for out in LEGACY.values():
        html = pages[out]
        block = b"".join(ADDED.findall((DIST / out).read_bytes())).decode()
        print(f"support email dist/{out}: {html.count(MAILTO)} mailto link(s)")
        if MAILTO not in block:
            fail(f"{out}: added block has no mailto link for {SUPPORT_EMAIL}")
        if "privacy" in out:
            if html.count(MAILTO) != 2:
                fail(f"{out}: expected the email in the Contact line and the deletion sentence")
            if f"ask for deletion by emailing {MAILTO}" not in block:
                fail(f"{out}: deletion sentence doesn't name {SUPPORT_EMAIL}")
    for f in DIST.rglob("*"):
        if f.is_file() and f.suffix in {".html", ".js", ".txt", ".xml", ".json", ".css"} and \
                re.search(r"SUPPORT_EMAIL|not set", f.read_text(errors="replace")):
            fail(f"placeholder text left in dist/{f.relative_to(DIST)}")

    # Baseball pages use the motif favicon.
    for name in ["motif.svg", "motif-64.png", "motif-180.png"]:
        if not (DIST / "assets" / "icons" / name).is_file():
            fail(f"missing dist/assets/icons/{name}")
    for page in ["mlb/index.html", "baseball.html", "baseball-privacy.html"]:
        missing = [m for m in MOTIF_ICONS if m not in pages[page]]
        print(f"motif favicon dist/{page}: {'yes' if not missing else 'MISSING'}")
        if missing:
            fail(f"{page} lacks motif favicon links {missing}")

    # No baseball app icon exists, so none may be shipped or referenced.
    mlb_icons = sorted(p.name for p in (DIST / "assets" / "icons").glob("mlb-*"))
    if mlb_icons:
        fail(f"baseball icon files in dist: {mlb_icons}")
    for page, html in pages.items():
        if "icons/mlb" in html:
            fail(f"{page} references a baseball app icon")

    # Privacy blocks must match what the worker stores.
    for out in [o for o in LEGACY.values() if "privacy" in o]:
        block = b"".join(ADDED.findall((DIST / out).read_bytes())).decode()
        for needed in ["Added October 23, 2026", "collect no data", "Cloudflare Turnstile",
                       "https://www.cloudflare.com/privacypolicy/"]:
            if needed not in block:
                fail(f"{out} privacy block is missing {needed!r}")
        if re.search(r"user.agent|IP address", block, re.I):
            fail(f"{out} privacy block mentions data that isn't stored")

    # 404.html: Pages only serves real 404s when it exists. Not indexed, not in the sitemap.
    not_found = DIST / "404.html"
    if not_found.is_file():
        html = not_found.read_text()
        noindex = '<meta name="robots" content="noindex">' in html
        print(f"404.html: noindex {'yes' if noindex else 'NO'}")
        if not noindex:
            fail("404.html lacks <meta name=\"robots\" content=\"noindex\">")
        if 'rel="canonical"' in html or 'property="og:url"' in html:
            fail("404.html has a canonical link or og:url")
        if re.search(r"/404(\.html)?\b", (DIST / "sitemap.xml").read_text()):
            fail("404 page is in sitemap.xml")
        for page, other in pages.items():
            if re.search(r'href="/404(\.html)?"', other):
                fail(f"{page} links to the 404 page")

    size = sum(f.stat().st_size for f in DIST.rglob("*") if f.is_file())
    print(f"dist size: {size / 1024 / 1024:.2f} MB")
    if size > BUDGET:
        fail("dist over 8 MB")


def check_worker():
    result = subprocess.run(["node", str(ROOT / "scripts" / "worker-test.mjs")], cwd=ROOT,
                            capture_output=True, text=True)
    print(result.stdout.rstrip())
    if result.returncode != 0:
        print(result.stderr.rstrip())
        fail("worker tests failed")


def check_serve():
    port = random.randint(20000, 60000)
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                              cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        paths = ["/", "/nfl/", "/nba/", "/nhl/", "/mlb/"] + [f"/{p}" for p in LEGACY.values()] + \
                ["/_redirects", "/sitemap.xml", "/robots.txt", "/assets/site.css", "/assets/signup.js",
                 "/assets/feedback.js", "/_routes.json",
                 "/assets/og/default.png", "/assets/badges/app-store-black.svg"]
        for path in paths:
            try:
                status = urllib.request.urlopen(f"http://127.0.0.1:{port}{path}", timeout=5).status
            except Exception as e:  # noqa: BLE001
                status = getattr(e, "code", str(e))
            print(f"GET {path}: {status}")
            if status != 200:
                fail(f"GET {path} -> {status}")
    finally:
        server.terminate()
        server.wait()
        print(f"server on port {port} stopped")


if __name__ == "__main__":
    check_files()
    check_worker()
    if "--serve" in sys.argv:
        check_serve()
    print("OK" if not failures else f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)
