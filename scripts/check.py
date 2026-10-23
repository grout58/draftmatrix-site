#!/usr/bin/env python3
"""Sanity checks on dist/ after `node build.mjs`. Run from the repo root:

    python3 scripts/check.py          # file checks only
    python3 scripts/check.py --serve  # also serve dist/ locally and fetch every page

Checks: legacy pages are byte-identical to their sources, the new pages carry no
league or ranking-publisher names in visible text, alt/aria text or meta tags
(URL slugs like /nfl/ and form values are not visible and are allowed), every local link and image
resolves to a file in dist/, and dist/ stays under the size budget.
"""
import filecmp
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
REQUIRED = NEW + list(LEGACY.values()) + ["_redirects", "sitemap.xml", "robots.txt", "assets/site.css"]
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
LOCAL_REF = re.compile(r'(?:href|src|srcset)="(/[^"#?]*)')
BUDGET = 8 * 1024 * 1024

failures = []


def fail(msg):
    failures.append(msg)
    print("FAIL", msg)


def check_files():
    for name in REQUIRED:
        if not (DIST / name).is_file():
            fail(f"missing dist/{name}")

    for src, out in LEGACY.items():
        same = filecmp.cmp(ROOT / src, DIST / out, shallow=False)
        print(f"cmp {src} dist/{out}: {'identical' if same else 'DIFFERENT'}")
        if not same:
            fail(f"{out} differs from {src}")

    diff = subprocess.run(["git", "diff", "--stat", "--", *LEGACY], cwd=ROOT, capture_output=True, text=True)
    print(f"git diff on legacy sources: {diff.stdout.strip() or 'none'}")
    if diff.stdout.strip():
        fail("legacy sources modified")

    for page in NEW:
        text = (DIST / page).read_text()
        hits = sorted({m.group(0) for m in BRANDS.finditer(visible(text))})
        print(f"brand scan dist/{page}: {hits or 'clean'}")
        if hits:
            fail(f"{page} mentions {hits}")
        for ref in LOCAL_REF.findall(text):
            target = DIST / ref.lstrip("/")
            if ref.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                fail(f"{page} links to missing {ref}")

    size = sum(f.stat().st_size for f in DIST.rglob("*") if f.is_file())
    print(f"dist size: {size / 1024 / 1024:.2f} MB")
    if size > BUDGET:
        fail("dist over 8 MB")


def check_serve():
    port = random.randint(20000, 60000)
    server = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1"],
                              cwd=DIST, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        time.sleep(1)
        paths = ["/", "/nfl/", "/nba/", "/nhl/", "/mlb/"] + [f"/{p}" for p in LEGACY.values()] + \
                ["/_redirects", "/sitemap.xml", "/robots.txt", "/assets/site.css", "/assets/signup.js",
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
    if "--serve" in sys.argv:
        check_serve()
    print("OK" if not failures else f"{len(failures)} failure(s)")
    sys.exit(1 if failures else 0)
