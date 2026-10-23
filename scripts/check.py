#!/usr/bin/env python3
"""Sanity checks on dist/ after `node build.mjs`. Run from the repo root:

    python3 scripts/check.py          # file checks only
    python3 scripts/check.py --serve  # also serve dist/ locally and fetch every page

Checks:
- each legacy page in dist/ is its source plus exactly one injected block between
  <!-- dm-added:start --> and <!-- dm-added:end -->; with that block cut out, the
  bytes match the source exactly. The legacy sources themselves are unmodified.
- the new pages and the injected blocks carry no league or ranking-publisher names
  in visible text, alt/aria text or meta tags (URL slugs like /nfl/ and form values
  are not visible and are allowed).
- every local link and image in the new pages and injected blocks resolves to a file in dist/.
- the Turnstile script loads on exactly the pages that have a form, each widget
  carries the sitekey, and it is the only third-party script.
- there is no baseball app icon (no assets/icons/mlb-*, no reference to one).
- the privacy blocks don't mention data the worker no longer stores (user-agent).
- dist/_worker.js passes scripts/worker-test.mjs (run in node with fake KV and ASSETS).
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
NEW = ["index.html", "nfl/index.html", "nba/index.html", "nhl/index.html", "mlb/index.html"]
REQUIRED = NEW + list(LEGACY.values()) + ["_redirects", "_routes.json", "_worker.js", "sitemap.xml",
                                          "robots.txt", "assets/site.css", "assets/signup.js", "assets/feedback.js"]
ADDED = re.compile(rb"<!-- dm-added:start -->\n.*?<!-- dm-added:end -->\n", re.S)
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
        same = ADDED.sub(b"", built) == source
        print(f"cmp {src} dist/{out} minus {len(blocks)} added block(s): {'identical' if same else 'DIFFERENT'}")
        if len(blocks) != 1:
            fail(f"{out} has {len(blocks)} added blocks, expected 1")
        if not same:
            fail(f"{out} differs from {src} outside the added block")
        scanned[f"{out} (added block)"] = b"".join(blocks).decode()

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
