// Builds the deployable site into dist/. No dependencies: `node build.mjs`.
//
// - New pages live in src/pages/*.html (body content only). This script wraps
//   each one in the shared head, header and footer.
// - Legacy pages at the repo root are copied byte-for-byte. The old index.html
//   (football support) becomes support.html; the new home page is index.html.
// - functions/ is NOT copied: run `wrangler pages deploy dist` from the repo
//   root and Pages picks up ./functions from the working directory.

import { cpSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Flip to true once the SIGNUPS KV binding exists in the Pages project.
// While false, every signup form carries a visible "Preview" note.
const SIGNUP_LIVE = false;

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = join(ROOT, "dist");
const ORIGIN = "https://draftmatrix.app";
const YEAR = 2026;

const APP_STORE = {
  nfl: "https://apps.apple.com/us/app/id6806661645",
  nba: "https://apps.apple.com/us/app/id6814882709",
  nhl: "https://apps.apple.com/us/app/id6811083062",
};

const APP_NAME = {
  nfl: "DraftMatrix: Fantasy Football",
  nba: "DraftMatrix: Fantasy Hoops",
  nhl: "DraftMatrix: Fantasy Hockey",
  mlb: "DraftMatrix: Fantasy Baseball",
};

// Legacy files: source at the repo root -> path in dist. Never edited.
const LEGACY = {
  "index.html": "support.html",
  "privacy.html": "privacy.html",
  "hockey.html": "hockey.html",
  "hockey-privacy.html": "hockey-privacy.html",
  "basketball.html": "basketball.html",
  "basketball-privacy.html": "basketball-privacy.html",
  "baseball.html": "baseball.html",
  "baseball-privacy.html": "baseball-privacy.html",
};

const PAGES = [
  {
    src: "home.html",
    out: "index.html",
    path: "/",
    nav: "home",
    title: "DraftMatrix — tiered fantasy draft boards for iPhone and iPad",
    description:
      "A live, tiered draft board for in-person fantasy drafts: football, hoops and hockey, with baseball coming. Free to download; DraftMatrix Pro is a one-time purchase.",
    og: "default",
  },
  {
    src: "nfl.html",
    out: "nfl/index.html",
    path: "/nfl/",
    nav: "nfl",
    title: "DraftMatrix: Fantasy Football — tiered draft board for iPhone and iPad",
    description:
      "A fantasy football draft board built on tier rankings, with PPR, Half PPR and Standard scoring, a pick clock, keepers and targets. Works for in-person drafts.",
    og: "nfl",
  },
  {
    src: "nba.html",
    out: "nba/index.html",
    path: "/nba/",
    nav: "nba",
    title: "DraftMatrix: Fantasy Hoops — fantasy basketball draft board",
    description:
      "A fantasy basketball draft board with tiers per position, Categories or Points scoring, roster needs and a draft clock. Built for in-person drafts.",
    og: "nba",
  },
  {
    src: "nhl.html",
    out: "nhl/index.html",
    path: "/nhl/",
    nav: "nhl",
    title: "DraftMatrix: Fantasy Hockey — fantasy hockey draft board",
    description:
      "A fantasy hockey draft board with tiers for centers, wings, defense and goalies, roster needs and a draft clock. Built for in-person drafts.",
    og: "nhl",
  },
  {
    src: "mlb.html",
    out: "mlb/index.html",
    path: "/mlb/",
    nav: "mlb",
    title: "DraftMatrix: Fantasy Baseball — coming February 2027",
    description:
      "DraftMatrix: Fantasy Baseball is coming in February 2027: a tiered fantasy baseball draft board for iPhone and iPad. Get the free cheat sheet each draft season.",
    og: "mlb",
  },
];

// Legacy pages listed in the sitemap, at the URLs Pages serves them on
// (Pages drops .html and redirects to the bare path).
const SITEMAP_LEGACY = [
  "/support", "/privacy",
  "/hockey", "/hockey-privacy",
  "/basketball", "/basketball-privacy",
  "/baseball", "/baseball-privacy",
];

const NAV = [
  ["nfl", "/nfl/", "Football"],
  ["nba", "/nba/", "Hoops"],
  ["nhl", "/nhl/", "Hockey"],
  ["mlb", "/mlb/", "Baseball"],
  ["support", "/support.html", "Support"],
];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function badge(sport) {
  const name = APP_NAME[sport];
  return `<a class="badge" href="${APP_STORE[sport]}" aria-label="Download ${esc(name)} on the App Store">` +
    `<picture><source srcset="/assets/badges/app-store-white.svg" media="(prefers-color-scheme: dark)">` +
    `<img src="/assets/badges/app-store-black.svg" alt="Download on the App Store" width="132" height="44"></picture></a>`;
}

let signupCount = 0;
function signup(sport, heading = "Get the free cheat sheet each draft season") {
  const id = `signup-${++signupCount}`;
  const note = SIGNUP_LIVE ? "" : `\n    <p class="signup-note">Preview: signups aren't live yet.</p>`;
  return `<div class="signup-box">
    <h2 id="${id}-h">${esc(heading)}</h2>
    <p class="muted">We'll email you the free cheat sheet when draft season starts. Your address is used only for DraftMatrix emails.</p>
    <form class="signup-form" action="/api/subscribe" method="post" data-sport="${sport}" aria-labelledby="${id}-h" novalidate>
      <label class="field" for="${id}-email">Email address
        <input id="${id}-email" name="email" type="email" autocomplete="email" inputmode="email" required>
      </label>
      <div class="hp" aria-hidden="true">
        <label for="${id}-company">Company (leave blank)</label>
        <input id="${id}-company" name="company" type="text" tabindex="-1" autocomplete="off">
      </div>
      <input type="hidden" name="sport" value="${sport}">
      <button type="submit">Sign up</button>
    </form>
    <p class="signup-status" role="status" aria-live="polite"></p>${note}
  </div>`;
}

function header(current) {
  const links = NAV.map(([key, href, label]) =>
    `<li><a href="${href}"${key === current ? ' aria-current="page"' : ""}>${label}</a></li>`).join("");
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"${current === "home" ? ' aria-current="page"' : ""}><img src="/assets/icon-64.png" alt="" width="32" height="32">DraftMatrix</a>
    <nav class="site-nav" aria-label="Main"><ul>${links}</ul></nav>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="wrap">
    <ul>
      <li><a href="/support.html">Support</a></li>
      <li><a href="/privacy.html">Privacy</a></li>
      <li><a href="/nfl/">Football</a></li>
      <li><a href="/nba/">Hoops</a></li>
      <li><a href="/nhl/">Hockey</a></li>
      <li><a href="/mlb/">Baseball</a></li>
    </ul>
    <p>DraftMatrix is an independent draft tool, not affiliated with, endorsed by, or sponsored by any professional sports league, team, or ranking publisher.</p>
    <p>Apple, the Apple logo, iPhone and iPad are trademarks of Apple Inc., registered in the U.S. and other countries. App Store is a service mark of Apple Inc.</p>
    <p>© ${YEAR} Grout Technology LLC</p>
  </div>
</footer>`;
}

function layout(page, body) {
  const url = ORIGIN + page.path;
  const og = `${ORIGIN}/assets/og/${page.og}.png`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
<link rel="canonical" href="${url}">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/assets/icon-64.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="/assets/icon-180.png">
<link rel="stylesheet" href="/assets/site.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DraftMatrix">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(page.ogAlt ?? `${page.title.split(" — ")[0]} screenshots`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${og}">
</head>
<body>
${header(page.nav)}
<main id="main">
${body.trim()}
</main>
${footer()}
<script src="/assets/signup.js" defer></script>
</body>
</html>
`;
}

// {{badge:nfl}}  {{signup:nba}}  {{signup:all|Custom heading}}  {{name:nhl}}  {{store:nba}}
function expand(src) {
  return src.replace(/\{\{(\w+):(\w+)(?:\|([^}]*))?\}\}/g, (m, kind, arg, extra) => {
    if (kind === "badge") return badge(arg);
    if (kind === "signup") return signup(arg, extra);
    if (kind === "name") return esc(APP_NAME[arg]);
    if (kind === "store") return APP_STORE[arg];
    throw new Error(`unknown placeholder ${m}`);
  });
}

function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  for (const [src, out] of Object.entries(LEGACY)) copyFileSync(join(ROOT, src), join(DIST, out));

  cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
  copyFileSync(join(ROOT, "src", "site.css"), join(DIST, "assets", "site.css"));
  copyFileSync(join(ROOT, "src", "signup.js"), join(DIST, "assets", "signup.js"));

  for (const page of PAGES) {
    signupCount = 0;
    const body = expand(readFileSync(join(ROOT, "src", "pages", page.src), "utf8"));
    const html = layout(page, body);
    if (/\{\{/.test(html)) throw new Error(`unexpanded placeholder in ${page.src}`);
    const dest = join(DIST, page.out);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, html);
  }

  // Pages already serves /support.html at /support (pretty URLs), so a
  // /support -> /support.html rule would loop. The legacy GitHub Pages paths
  // point straight at the bare paths to save a hop.
  writeFileSync(join(DIST, "_redirects"), [
    "/draftmatrix-site /support 301",
    "/draftmatrix-site/ /support 301",
    "/draftmatrix-site/index.html /support 301",
    "/draftmatrix-site/* /:splat 301",
    "",
  ].join("\n"));

  const urls = [...PAGES.map((p) => p.path), ...SITEMAP_LEGACY];
  writeFileSync(join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`).join("\n") + `\n</urlset>\n`);

  writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

  console.log(`Built ${PAGES.length} pages + ${Object.keys(LEGACY).length} legacy files into dist/ (SIGNUP_LIVE=${SIGNUP_LIVE})`);
}

build();
