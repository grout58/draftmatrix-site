// Builds the deployable site into dist/. No dependencies: `node build.mjs`.
//
// - New pages live in src/pages/*.html (body content only). This script wraps
//   each one in the shared head, header and footer.
// - Legacy pages at the repo root are copied unchanged, except that the four
//   support pages get a "Contact us" + feedback section and the four privacy
//   pages get an email-list section, each between <!-- dm-added:start --> and
//   <!-- dm-added:end --> just before the closing footer lines. The old
//   index.html (football support) becomes support.html; the new home page is
//   index.html.
// - src/_worker.js becomes dist/_worker.js (Pages advanced mode) and handles
//   /api/subscribe and /api/feedback. There is no functions/ directory.

import { cpSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// True once the SIGNUPS KV binding exists in the Pages project.
// While false, every signup form carries a visible "Preview" note.
const SIGNUP_LIVE = true;

// Support email for the "Contact us" sections. While null, those sections
// point to GitHub and the feedback form, and the build warns.
const SUPPORT_EMAIL = null;

// Where signups and feedback are stored, as named on the privacy pages.
const PROVIDER = "Cloudflare, our website host";

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

// Legacy files: source at the repo root -> path in dist. The sources are never
// edited; `add` names the section injected into the dist copy.
const LEGACY = {
  "index.html": { out: "support.html", add: "contact", app: "football" },
  "privacy.html": { out: "privacy.html", add: "privacy", support: "support.html" },
  "hockey.html": { out: "hockey.html", add: "contact", app: "hockey" },
  "hockey-privacy.html": { out: "hockey-privacy.html", add: "privacy", support: "hockey.html" },
  "basketball.html": { out: "basketball.html", add: "contact", app: "hoops" },
  "basketball-privacy.html": { out: "basketball-privacy.html", add: "privacy", support: "basketball.html" },
  "baseball.html": { out: "baseball.html", add: "contact", app: "baseball" },
  "baseball-privacy.html": { out: "baseball-privacy.html", add: "privacy", support: "baseball.html" },
};

// Privacy page whose email-list section each signup form links to.
const PRIVACY = {
  all: "/privacy.html",
  nfl: "/privacy.html",
  nba: "/basketball-privacy.html",
  nhl: "/hockey-privacy.html",
  mlb: "/baseball-privacy.html",
};

const FEEDBACK_APPS = [
  ["football", "Fantasy Football"],
  ["hoops", "Fantasy Hoops"],
  ["hockey", "Fantasy Hockey"],
  ["baseball", "Fantasy Baseball"],
  ["other", "Other"],
];

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
    <p class="muted">We'll email you the free cheat sheet when draft season starts.</p>
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
    <p class="signup-status" role="status" aria-live="polite"></p>
    <p class="signup-note">Signing up is optional, and you can unsubscribe anytime. We only use your email for DraftMatrix emails. <a href="${PRIVACY[sport]}#email-list">Privacy</a></p>${note}
  </div>`;
}

// ---------- sections added to the legacy pages ----------

const ADDED_START = "<!-- dm-added:start -->";
const ADDED_END = "<!-- dm-added:end -->";

// Self-contained styles, scoped to .dm-added so the legacy page look is untouched.
const ADDED_CSS = `<style>
  .dm-added { color-scheme: light dark; margin-top: 2.5rem; padding-top: .5rem; border-top: 1px solid #c7c7cc; }
  .dm-added form { margin-top: 1rem; }
  .dm-added label { display: block; margin-top: 14px; font-weight: 600; font-size: .95rem; }
  .dm-added label span { font-weight: 400; color: #6e6e73; }
  .dm-added input, .dm-added select, .dm-added textarea {
    display: block; width: 100%; box-sizing: border-box; margin-top: 4px; font: inherit;
    border: 1px solid #8e8e93; border-radius: 10px; padding: 10px 12px; min-height: 46px;
  }
  .dm-added textarea { min-height: 140px; resize: vertical; }
  .dm-added button {
    margin-top: 16px; font: inherit; font-weight: 600; cursor: pointer;
    background: #0a5bd6; color: #fff; border: 0; border-radius: 10px; padding: 11px 20px; min-height: 46px;
  }
  .dm-added button[disabled] { opacity: .6; cursor: progress; }
  .dm-added .dm-hp { position: absolute !important; left: -10000px !important; width: 1px; height: 1px; overflow: hidden; }
  .dm-added .dm-status { min-height: 1.5em; margin: 10px 0 0; font-weight: 500; }
  .dm-added .dm-status.ok { color: #157a46; }
  .dm-added .dm-status.warn { color: #9a5b00; }
  .dm-added .dm-status.err { color: #b3261e; }
  @media (prefers-color-scheme: dark) {
    .dm-added { border-top-color: #3a3a3c; }
    .dm-added label span { color: #8e8e93; }
    .dm-added button { background: #4cb8ff; color: #06101f; }
    .dm-added .dm-status.ok { color: #4cd08a; }
    .dm-added .dm-status.warn { color: #f0b45a; }
    .dm-added .dm-status.err { color: #ff8a80; }
  }
</style>`;

const GITHUB = `<a href="https://github.com/grout58">github.com/grout58</a>`;

function contactSection(app) {
  const options = FEEDBACK_APPS.map(([value, label]) =>
    `<option value="${value}"${value === app ? " selected" : ""}>${label}</option>`).join("");
  const reach = SUPPORT_EMAIL
    ? `<p>Email us at <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>, or send a message with the form below.</p>`
    : `<!-- SUPPORT_EMAIL not set: set SUPPORT_EMAIL in build.mjs to show an email link here. -->
<p>Reach us on GitHub at ${GITHUB}, or send a message with the form below.</p>`;
  return `<section class="dm-added" id="dm-contact" aria-labelledby="dm-contact-h">
${ADDED_CSS}
<h2 id="dm-contact-h">Contact us</h2>
${reach}
<form class="dm-feedback" action="/api/feedback" method="post" data-app="${app}" novalidate>
  <label for="dm-name">Name <span>(optional)</span>
    <input id="dm-name" name="name" type="text" autocomplete="name" maxlength="200"></label>
  <label for="dm-email">Email address <span>(used only to reply to you)</span>
    <input id="dm-email" name="email" type="email" autocomplete="email" inputmode="email" required></label>
  <label for="dm-app">App
    <select id="dm-app" name="app">${options}</select></label>
  <label for="dm-message">Message
    <textarea id="dm-message" name="message" maxlength="4000" required></textarea></label>
  <div class="dm-hp" aria-hidden="true">
    <label for="dm-company">Company (leave blank)</label>
    <input id="dm-company" name="company" type="text" tabindex="-1" autocomplete="off">
  </div>
  <button type="submit">Send</button>
  <p class="dm-status" role="status" aria-live="polite"></p>
</form>
</section>
<script src="/assets/feedback.js" defer></script>`;
}

function privacySection(support) {
  return `<section class="dm-added" aria-labelledby="email-list">
<style>
  .dm-added { margin-top: 2.5rem; padding-top: .5rem; border-top: 1px solid #c7c7cc; }
  @media (prefers-color-scheme: dark) { .dm-added { border-top-color: #3a3a3c; } }
</style>
<h2 id="email-list">Email list and feedback form (added October 2026)</h2>
<p>This section covers the draftmatrix.app website only. The apps themselves still collect no data.</p>
<p><strong>Email list.</strong> If you join the email list, we collect only your email address, which sport pages you signed up from, and when you first and most recently signed up. We use it only to send the draft-season cheat sheet and DraftMatrix app news. You can unsubscribe anytime: every email will have an unsubscribe link, or you can ask us to remove you through the <a href="${support}">support page</a>.</p>
<p><strong>Feedback form.</strong> If you send feedback, we receive the name (optional), email address and message you send, the app you pick, the time you sent it, and your browser's user-agent string. We use them only to reply to you.</p>
<p>Both are stored with ${esc(PROVIDER)}. We never sell or share your email address or messages.</p>
</section>`;
}

// Inserts the section before the page's closing lines: the <footer> on the
// older pages, the independence disclaimer on the rest.
function inject(src, html, section) {
  const at = [/^<footer>/m, /^ *<p class="muted">DraftMatrix is an independent/m]
    .map((re) => html.search(re)).find((i) => i >= 0);
  if (at === undefined) throw new Error(`no injection point in ${src}`);
  return html.slice(0, at) + `${ADDED_START}\n${section}\n${ADDED_END}\n` + html.slice(at);
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

  for (const [src, page] of Object.entries(LEGACY)) {
    const html = readFileSync(join(ROOT, src), "utf8");
    const section = page.add === "contact" ? contactSection(page.app) : privacySection(page.support);
    writeFileSync(join(DIST, page.out), inject(src, html, section));
  }
  if (!SUPPORT_EMAIL) console.warn("WARNING: SUPPORT_EMAIL not set; support pages show GitHub + the feedback form.");

  cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
  copyFileSync(join(ROOT, "src", "site.css"), join(DIST, "assets", "site.css"));
  copyFileSync(join(ROOT, "src", "signup.js"), join(DIST, "assets", "signup.js"));
  copyFileSync(join(ROOT, "src", "feedback.js"), join(DIST, "assets", "feedback.js"));

  // Pages advanced mode. _routes.json limits the worker to /api/*, so static
  // requests skip it entirely (and don't count as worker invocations).
  copyFileSync(join(ROOT, "src", "_worker.js"), join(DIST, "_worker.js"));
  writeFileSync(join(DIST, "_routes.json"),
    JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n");

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
