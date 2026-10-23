#!/usr/bin/env python3
"""Check that a deployed site serves exactly what's in dist/.

    python3 scripts/verify-deploy.py [dist] [base-url]   # defaults: dist https://draftmatrix.app

Builds nothing. For every file in dist/ except _worker.js, _routes.json and
_redirects, works out the URL Pages serves it at (x/index.html -> /x/,
foo.html -> /foo, index.html -> /), fetches it (following at most one redirect)
and compares the SHA-256 of the bytes. Also checks that /_redirects and
/_routes.json are 404 and that the rules in dist/_redirects answer with their
codes and targets; for exact (non-splat) rules, such as /support/ -> /support,
the target must then answer 200 itself. Prints a table and exits 1 on any failure. Stdlib only.
"""

import hashlib
import sys
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

SKIP = {"_worker.js", "_routes.json", "_redirects"}
UA = "draftmatrix-verify-deploy/1"


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None  # surface 3xx as HTTPError instead of following


OPENER = urllib.request.build_opener(NoRedirect)


def fetch(url):
    """(status, location, body) without following redirects; status 0 on network errors."""
    req = urllib.request.Request(url, headers={"user-agent": UA, "cache-control": "no-cache"})
    try:
        with OPENER.open(req, timeout=30) as r:
            return r.status, r.headers.get("location"), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("location"), e.read()
    except (urllib.error.URLError, OSError) as e:
        ERRORS.add(str(getattr(e, "reason", e)))
        return 0, None, b""


ERRORS = set()  # distinct network errors, reported once at the end


def label(status, ok, good="ok", bad="MISMATCH"):
    return good if ok else "ERROR" if status == 0 else bad


def url_path(rel):
    if rel == "index.html":
        return "/"
    if rel.endswith("/index.html"):
        return "/" + rel[: -len("index.html")]
    if rel.endswith(".html"):
        return "/" + rel[: -len(".html")]
    return "/" + rel


def check_file(base, dist, rel):
    path = url_path(rel)
    url = base + urllib.parse.quote(path)
    status, location, body = fetch(url)
    shown = str(status)
    if 300 <= status < 400 and location:
        url = urllib.parse.urljoin(url, location)
        status, _, body = fetch(url)
        shown += f"->{status}"
    want = hashlib.sha256((dist / rel).read_bytes()).hexdigest()
    ok = status == 200 and hashlib.sha256(body).hexdigest() == want
    return ("/" + rel, url, shown, label(status, ok), ok)


def check_hidden(base, path):
    status, _, _ = fetch(base + path)
    ok = status == 404
    return (path, base + path, str(status), label(status, ok, "ok (404)", "SERVED (want 404)"), ok)


def redirect_cases(dist):
    """(request path, expected code, expected target path) per _redirects rule."""
    f = dist / "_redirects"
    if not f.exists():
        return []
    cases = []
    for line in f.read_text().splitlines():
        parts = line.split()
        if len(parts) < 2 or parts[0].startswith("#"):
            continue
        src, dst = parts[0], parts[1]
        code = int(parts[2]) if len(parts) > 2 else 302
        if src.endswith("/*"):
            # Use a real file so the splat target is meaningful.
            sample = next((p.name for p in sorted(dist.glob("*.html"))), "index.html")
            cases.append((src[:-1] + sample, code, dst.replace(":splat", sample), None))
        else:
            # Exact rules point at bare page paths, which must serve 200 with
            # no further hop (e.g. /support/ -> /support must not loop).
            cases.append((src, code, dst, 200))
    return cases


def check_redirect(base, src, code, dst, final=None):
    """src must answer code -> dst; if final is set, dst itself must then answer final (no further hop)."""
    status, location, _ = fetch(base + src)
    got = urllib.parse.urlparse(urllib.parse.urljoin(base + src, location or "")).path if location else None
    ok = status == code and got == dst
    shown = f"{status} -> {got}"
    if ok and final is not None:
        target, _, _ = fetch(base + urllib.parse.quote(dst))
        ok = target == final
        shown += f" ({target})"
        status = target
    want = f"WANT {code} -> {dst}" + (f" ({final})" if final is not None else "")
    return (src, base + src, shown, label(status, ok, bad=want), ok)


def main():
    dist = Path(sys.argv[1] if len(sys.argv) > 1 else "dist")
    base = (sys.argv[2] if len(sys.argv) > 2 else "https://draftmatrix.app").rstrip("/")
    if not dist.is_dir():
        sys.exit(f"{dist} is not a directory (run `node build.mjs` first)")
    files = sorted(
        p.relative_to(dist).as_posix()
        for p in dist.rglob("*")
        if p.is_file() and p.name != ".DS_Store" and p.relative_to(dist).as_posix() not in SKIP
    )

    with ThreadPoolExecutor(max_workers=8) as pool:
        rows = list(pool.map(lambda rel: check_file(base, dist, rel), files))
        rows += list(pool.map(lambda p: check_hidden(base, p), ["/_redirects", "/_routes.json"]))
        rows += list(pool.map(lambda c: check_redirect(base, *c), redirect_cases(dist)))

    widths = [max(len(r[i]) for r in rows + [("path", "url", "status", "match")]) for i in range(3)]
    print(f"{'path':<{widths[0]}}  {'url':<{widths[1]}}  {'status':<{widths[2]}}  match")
    for r in rows:
        print(f"{r[0]:<{widths[0]}}  {r[1]:<{widths[1]}}  {r[2]:<{widths[2]}}  {r[3]}")
    bad = [r for r in rows if not r[4]]
    print(f"\n{len(rows) - len(bad)}/{len(rows)} ok" + (f", {len(bad)} failed" if bad else ""))
    for e in sorted(ERRORS):
        print(f"network error: {e}", file=sys.stderr)
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
