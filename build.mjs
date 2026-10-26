// Builds the deployable site into dist/. No dependencies: `node build.mjs`.
//
// - New pages live in src/pages/*.html (body content only). This script wraps
//   each one in the shared head, header and footer.
// - The support page (src/pages/support.html) is built four times: support.html
//   for all apps, and hockey.html, basketball.html and baseball.html (the old
//   per-sport support URLs) with that app first, its Smart App Banner and the
//   feedback form preselected. The root index.html, hockey.html, basketball.html
//   and baseball.html (the old support pages) are no longer copied into dist/;
//   they stay at the repo root for the GitHub Pages copy of the site.
// - The four legacy privacy pages at the repo root are copied unchanged, except
//   for an email-list section between <!-- dm-added:start --> and
//   <!-- dm-added:end --> just before the closing lines.
// - Small inline edits, each wrapped in <!-- dm-inline:start --> and
//   <!-- dm-inline:end --> on one line: each privacy page's Contact sentence is
//   replaced by one naming only the support email and support page (no GitHub),
//   and the motif favicon links go just before </head> on baseball-privacy.html.
// - src/_worker.js becomes dist/_worker.js (Pages advanced mode) and handles
//   /api/subscribe and /api/feedback. There is no functions/ directory.
// - Both forms carry a Turnstile widget; the Turnstile script is added only to
//   pages that have a form.
// - BUTTONDOWN_LIVE (off) adds Buttondown to the privacy pages' email-list copy and
//   changes the signup success message in dist/assets/signup.js to "confirm by email".

import { cpSync, copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// True once the SIGNUPS KV binding exists in the Pages project.
// While false, every signup form carries a visible "Preview" note.
const SIGNUP_LIVE = true;

// True once the worker forwards signups to Buttondown (BUTTONDOWN_API_KEY and
// BUTTONDOWN_ENABLED="true" on the Pages project; see DEPLOY.md). It only changes
// copy: the privacy pages then name Buttondown, and the signup success message
// asks people to confirm by email. While false, the output is as before.
const BUTTONDOWN_LIVE = true;
const BUTTONDOWN_PRIVACY = "https://buttondown.com/legal/privacy";
// scripts/check.py also builds with Buttondown on, into a temp dir: DM_BUTTONDOWN_LIVE=1
// counts only together with DM_DIST (the output directory), so it never changes dist/.
const BUTTONDOWN = BUTTONDOWN_LIVE || (!!process.env.DM_DIST && process.env.DM_BUTTONDOWN_LIVE === "1");
// The signup success message in src/signup.js, and its replacement with BUTTONDOWN on
// (Buttondown emails a confirmation link first).
const SIGNUP_OK = `ok: "Thanks. You're on the list for the cheat sheet."`;
const SIGNUP_OK_CONFIRM = `ok: "Thanks. Check your inbox and confirm your email to get on the list for the cheat sheet."`;

// Support email: the contact on the support pages, and added to the privacy
// pages' Contact line and deletion sentence. Required.
const SUPPORT_EMAIL = "support@draftmatrix.app";

// Where signups and feedback are stored, as named on the privacy pages.
const PROVIDER = "Cloudflare, our website host";

// Cloudflare Turnstile public sitekey (managed widget) for both forms. Public by
// design; the matching secret is TURNSTILE_SECRET in the Pages project settings.
const TURNSTILE_SITEKEY = "0x4AAAAAAFjE4WGiG4z1Gaww";
const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DIST = process.env.DM_DIST || join(ROOT, "dist");
const ORIGIN = "https://draftmatrix.app";
const YEAR = 2026;

const APP_STORE = {
  nfl: "https://apps.apple.com/us/app/id6806661645",
  nba: "https://apps.apple.com/us/app/id6814882709",
  nhl: "https://apps.apple.com/us/app/id6811083062",
};

// Safari's Smart App Banner, on pages with `appId` (a key of APP_STORE).
function appBanner(sport) {
  const id = APP_STORE[sport]?.match(/\/id(\d+)$/)?.[1];
  if (!id) throw new Error(`no App Store id for ${sport}`);
  return `<meta name="apple-itunes-app" content="app-id=${id}">`;
}

// <meta name="theme-color"> per page tint (the darker end of each gradient).
const THEME_COLOR = { brand: "#0b0f14", nfl: "#07170d", nba: "#130e08", nhl: "#071019" };

const APP_NAME = {
  nfl: "DraftMatrix: Fantasy Football",
  nba: "DraftMatrix: Fantasy Hoops",
  nhl: "DraftMatrix: Fantasy Hockey",
  mlb: "DraftMatrix: Fantasy Baseball",
};

// X account for twitter:site on every new page.
const TWITTER_SITE = "@DraftMatrixApp";

// JSON-LD per page path: WebSite on the home page, SoftwareApplication on the
// three released apps' pages. Free to download (Pro is an in-app purchase), so
// the offer is 0 USD. No ratings or review counts. No baseball (not released).
const appLd = (sport) => ({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_NAME[sport],
  operatingSystem: "iOS",
  applicationCategory: "SportsApplication",
  url: `https://apps.apple.com/app/id${APP_STORE[sport].match(/\/id(\d+)$/)[1]}`,
  image: `${ORIGIN}/assets/icons/${sport}-512.png`,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
});
const STRUCTURED_DATA = {
  "/": { "@context": "https://schema.org", "@type": "WebSite", name: "DraftMatrix", url: `${ORIGIN}/` },
  "/nfl/": appLd("nfl"),
  "/nba/": appLd("nba"),
  "/nhl/": appLd("nhl"),
};
// "<" escaped so the JSON can't close the <script> early.
const jsonLd = (data) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>\n`;

// dist/_headers: image folders under /assets/ and their browser cache lifetime (7 days).
const IMAGE_DIRS = ["screens", "icons", "og", "badges"];
const IMAGE_MAX_AGE = 604800;

// Legacy privacy pages: source at the repo root -> path in dist. The sources are
// never edited; the dist copy gets the email-list section. `support` is the
// support page its Contact line links to (relative, like the legacy links).
const LEGACY = {
  "privacy.html": { out: "privacy.html", support: "support.html" },
  "hockey-privacy.html": { out: "hockey-privacy.html", support: "hockey.html" },
  "basketball-privacy.html": { out: "basketball-privacy.html", support: "basketball.html" },
  "baseball-privacy.html": { out: "baseball-privacy.html", support: "baseball.html", icon: "motif" },
};

// Privacy page whose email-list section each signup form links to.
const PRIVACY = {
  all: "/privacy",
  nfl: "/privacy",
  nba: "/basketball-privacy",
  nhl: "/hockey-privacy",
  mlb: "/baseball-privacy",
};

// Each app's section id on the support page.
const SUPPORT_ANCHOR = { nfl: "football", nba: "hoops", nhl: "hockey", mlb: "baseball" };

// Feedback form "App" values (src/_worker.js accepts these) per sport key.
const FEEDBACK_APP = { nfl: "football", nba: "hoops", nhl: "hockey", mlb: "baseball" };
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
    theme: "brand",
    icon: "nfl",
    appId: "nfl",
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
    theme: "nfl",
    icon: "nfl",
    appId: "nfl",
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
    theme: "nba",
    icon: "nba",
    appId: "nba",
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
    theme: "nhl",
    icon: "nhl",
    appId: "nhl",
  },
  {
    src: "mlb.html",
    out: "mlb/index.html",
    path: "/mlb/",
    nav: "mlb",
    title: "DraftMatrix: Fantasy Baseball — coming January 2027",
    description:
      "DraftMatrix: Fantasy Baseball is coming in January 2027: a tiered fantasy baseball draft board for iPhone and iPad. Get the free cheat sheet each draft season.",
    og: "mlb",
    ogAlt: "DraftMatrix: Fantasy Baseball, coming January 2027: pre-release screenshots of the tiered draft board",
    theme: "brand",
    icon: "motif", // baseball has no released app icon; the tile motif (scripts/motif_icon.py)
  },
  // The support page, for all apps. /support is the App Store support URL for
  // all three apps; its Smart App Banner stays the football one, as before.
  {
    src: "support.html",
    out: "support.html",
    path: "/support",
    nav: "support",
    focus: null,
    title: "DraftMatrix Support — help for the football, hoops and hockey draft boards",
    description:
      "Help for DraftMatrix: Fantasy Football, Fantasy Hoops and Fantasy Hockey on iPhone and iPad: restoring Pro, the Lock Screen draft clock, offline drafting, iCloud sync and how to reach us.",
    og: "default",
    ogAlt: "DraftMatrix",
    theme: "brand",
    icon: "nfl",
    appId: "nfl",
  },
  // The old per-sport support URLs (the 2.0.2 listings link to them): the same
  // page with that app first. Canonical is /support, so they stay out of the sitemap.
  ...[
    ["hockey.html", "nhl", "nhl", "nhl", "nhl"],
    ["basketball.html", "nba", "nba", "nba", "nba"],
    ["baseball.html", "mlb", "brand", "motif", null],
  ].map(([out, sport, theme, icon, appId]) => ({
    src: "support.html",
    out,
    path: "/" + out.slice(0, -".html".length),
    canonical: "/support",
    nav: "support",
    focus: sport,
    title: `${APP_NAME[sport]} Support`,
    description: sport === "mlb"
      ? "Support for DraftMatrix: Fantasy Baseball, coming January 2027, and for the DraftMatrix football, hoops and hockey apps on iPhone and iPad."
      : `Help for ${APP_NAME[sport]} on iPhone and iPad: restoring Pro, the Lock Screen draft clock, offline drafting, iCloud sync and how to reach us.`,
    og: sport,
    ogAlt: APP_NAME[sport],
    theme,
    icon,
    appId,
  })),
];

// Pages serves dist/404.html, with status 404, for any path it has no file for.
// Without it, Pages treats the site as a single-page app and answers every
// unknown path with index.html and 200. Not in PAGES, so it stays out of the
// sitemap; noindex, with no canonical or og:url since it's served at any path.
const NOT_FOUND = {
  src: "404.html",
  out: "404.html",
  noindex: true,
  title: "Page not found — DraftMatrix",
  description: "This page doesn't exist on draftmatrix.app.",
  og: "default",
  ogAlt: "DraftMatrix",
  theme: "brand",
  icon: "nfl",
};

// Legacy pages listed in the sitemap, at the URLs Pages serves them on
// (Pages drops .html and redirects to the bare path).
const SITEMAP_LEGACY = ["/privacy", "/hockey-privacy", "/basketball-privacy", "/baseball-privacy"];

const NAV = [
  ["nfl", "/nfl/", "Football"],
  ["nba", "/nba/", "Hoops"],
  ["nhl", "/nhl/", "Hockey"],
  ["mlb", "/mlb/", "Baseball"],
  ["support", "/support", "Support"],
];

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The site is dark, so it always uses Apple's black badge, which carries its own
// gray border for dark backgrounds. One badge per app card.
function badge(sport) {
  const name = APP_NAME[sport];
  return `<a class="badge" href="${APP_STORE[sport]}" aria-label="Download ${esc(name)} on the App Store">` +
    `<img src="/assets/badges/app-store-black.svg" alt="Download on the App Store" width="132" height="44"></a>`;
}

// A real app icon (football, hoops and hockey only), webp with a png fallback.
// Decorative: the app's name is always in the heading next to it.
function icon(sport, px, lazy) {
  if (!APP_STORE[sport]) throw new Error(`no released app icon for ${sport}`);
  const base = `/assets/icons/${sport}`;
  return `<picture><source type="image/webp" srcset="${base}-128.webp 128w, ${base}-256.webp 256w, ${base}-512.webp 512w" sizes="${px}px">` +
    `<img class="app-icon" src="${base}-256.png" width="${px}" height="${px}" alt=""${lazy ? ' loading="lazy"' : ""}></picture>`;
}

// The brand tile pattern: a 3x3 grid, top row pink / green / blue, lower rows
// fading. A generic brand decoration, not an app icon.
const MOTIF = `<div class="motif" aria-hidden="true">${"<i></i>".repeat(9)}</div>`;

// The same pattern as a small SVG, next to the wordmark in the header.
function mark() {
  const colors = ["#ff5e7d", "#3fde9b", "#4eb9ff"];
  const tiles = [];
  [1, 0.5, 0.24].forEach((opacity, row) => colors.forEach((fill, col) => {
    const x = 10 + col * 15.5, y = 15 + row * 13;
    tiles.push(`<g opacity="${opacity}"><rect x="${x}" y="${y}" width="13" height="9" rx="3" fill="${fill}"/>` +
      `<rect x="${x}" y="${y}" width="13" height="9" rx="3" fill="url(#dm-gloss)"/></g>`);
  }));
  return `<svg viewBox="0 0 64 64" width="32" height="32" aria-hidden="true" focusable="false">` +
    `<defs><linearGradient id="dm-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/>` +
    `<stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>` +
    `<rect x="1" y="1" width="62" height="62" rx="15" fill="#1d2430" stroke="#fff" stroke-opacity=".25"/>` +
    tiles.join("") + `</svg>`;
}

// Managed Turnstile widget. Its script is added only to pages that have one.
const turnstile = (theme) =>
  `<div class="cf-turnstile" data-sitekey="${TURNSTILE_SITEKEY}" data-theme="${theme}"></div>`;

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
      ${turnstile("dark")}
    </form>
    <p class="signup-status" role="status" aria-live="polite"></p>
    <p class="signup-note">Signing up is optional, and you can unsubscribe anytime. We only use your email for DraftMatrix emails. <a href="${PRIVACY[sport]}#email-list">Privacy</a></p>${note}
  </div>`;
}

// ---------- sections added to the legacy pages ----------

const ADDED_START = "<!-- dm-added:start -->";
const ADDED_END = "<!-- dm-added:end -->";

const MAILTO = `<a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>`;

// The feedback form (src/feedback.js posts it to /api/feedback), with the app
// preselected on the per-sport support pages. Styled by .feedback in site.css.
function feedbackForm(sport) {
  const app = FEEDBACK_APP[sport] ?? "football";
  const options = FEEDBACK_APPS.map(([value, label]) =>
    `<option value="${value}"${value === app ? " selected" : ""}>${label}</option>`).join("");
  return `<form class="dm-feedback feedback" action="/api/feedback" method="post" data-app="${app}" aria-labelledby="feedback-h" novalidate>
      <label for="dm-name">Name <span>(optional)</span>
        <input id="dm-name" name="name" type="text" autocomplete="name" maxlength="200"></label>
      <label for="dm-email">Email address <span>(used only to reply to you)</span>
        <input id="dm-email" name="email" type="email" autocomplete="email" inputmode="email" required></label>
      <label for="dm-app">App
        <select id="dm-app" name="app">${options}</select></label>
      <label for="dm-message">Message
        <textarea id="dm-message" name="message" maxlength="4000" required></textarea></label>
      <div class="hp" aria-hidden="true">
        <label for="dm-company">Company (leave blank)</label>
        <input id="dm-company" name="company" type="text" tabindex="-1" autocomplete="off">
      </div>
      ${turnstile("dark")}
      <button type="submit">Send</button>
      <p class="dm-status" role="status" aria-live="polite"></p>
    </form>`;
}

// With BUTTONDOWN on: who else gets signups, matching forwardToButtondown() in
// src/_worker.js (email address, sports, IP address).
const BUTTONDOWN_EMAIL_LIST = `Your email address and sport(s) are stored with ${esc(PROVIDER)}, and sent to Buttondown, our email provider, which sends the emails, asks you to confirm your subscription by email, and handles unsubscribes (every email has an unsubscribe link). Buttondown also receives your IP address to filter spam; see <a href="${BUTTONDOWN_PRIVACY}">Buttondown's privacy policy</a>.`;

// Must list exactly the fields src/_worker.js stores (see CLAIMS.md).
function privacySection(support) {
  return `<section class="dm-added" aria-labelledby="email-list">
<style>
  .dm-added { margin-top: 2.5rem; padding-top: .5rem; border-top: 1px solid #c7c7cc; }
  @media (prefers-color-scheme: dark) { .dm-added { border-top-color: #3a3a3c; } }
</style>
<h2 id="email-list">Website email list and feedback form</h2>
<p><em>Added October 23, 2026</em></p>
<p>The DraftMatrix apps themselves still collect no data. This section covers only the optional forms on the draftmatrix.app website.</p>
<p><strong>Email list.</strong> If you sign up, we store your email address, which sport page(s) you signed up from, and when you first and most recently signed up. We use it only to send the draft-season cheat sheet and DraftMatrix app news.${BUTTONDOWN ? ` ${BUTTONDOWN_EMAIL_LIST}` : ""}</p>
<p><strong>Feedback form.</strong> If you send feedback, we store your name (optional), your email address, the app you chose, your message, and the time you sent it. We use it only to reply to you.</p>
<p>Both are stored with ${esc(PROVIDER)}, and kept until you unsubscribe or ask us to delete them. You can unsubscribe anytime, or ask for deletion by emailing ${MAILTO} or through the <a href="${support}">support page</a>. ${BUTTONDOWN ? "We never sell them, and share them only with the providers named here." : "We never sell or share them."}</p>
<p>To block spam, the forms use Cloudflare Turnstile, which checks your browser when you use the forms; see <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare's privacy policy</a>.</p>
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

// One-line insertion at a fixed point, wrapped in dm-inline markers so
// scripts/check.py can cut it out again.
function insertInline(src, html, at, text) {
  if (at < 0) throw new Error(`no inline insertion point in ${src}`);
  return html.slice(0, at) + `<!-- dm-inline:start -->${text}<!-- dm-inline:end -->` + html.slice(at);
}

// The legacy Contact sentence, which scripts/check.py matches in the source too.
// privacy.html wraps it over two lines and doesn't link the support page.
const LEGACY_CONTACT = /Reach us via <a href="https:\/\/github\.com\/grout58">github\.com\/grout58<\/a>\s+or the (?:<a href="[\w-]+\.html">support page<\/a>|support page) linked from the App Store listing\./;

// Replaces the Contact sentence with one naming only the support email and the
// support page: "Questions? Email us at …, or use the support page linked from
// the App Store listing." The replacement sits between dm-inline markers.
function replaceContact(src, html, support) {
  const contact = html.indexOf("<h2>Contact</h2>");
  const m = contact < 0 ? null : LEGACY_CONTACT.exec(html.slice(contact));
  if (!m) throw new Error(`no Contact sentence in ${src}`);
  const at = contact + m.index;
  return insertInline(src, html.slice(0, at) + html.slice(at + m[0].length), at,
    `Email us at ${MAILTO}, or use the <a href="${support}">support page</a> linked from the App Store listing.`);
}

function iconLinks(icon) {
  return (icon === "motif" ? `<link rel="icon" href="/assets/icons/motif.svg" type="image/svg+xml">` : "") +
    `<link rel="icon" href="/assets/icons/${icon}-64.png" type="image/png" sizes="64x64">` +
    `<link rel="apple-touch-icon" href="/assets/icons/${icon}-180.png">`;
}

function header(current) {
  const links = NAV.map(([key, href, label]) =>
    `<li><a href="${href}"${key === current ? ' aria-current="page"' : ""}>${label}</a></li>`).join("");
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"${current === "home" ? ' aria-current="page"' : ""}>${mark()}DraftMatrix</a>
    <nav class="site-nav" aria-label="Main"><ul>${links}</ul></nav>
  </div>
</header>`;
}

// DraftMatrix on X, in the footer of every built page. The accessible name
// keeps the visible handle (WCAG "label in name") and says it opens a new tab.
const X_URL = "https://x.com/DraftMatrixApp";
function xLink() {
  return `<a class="social" href="${X_URL}" rel="me noopener" target="_blank" aria-label="DraftMatrix on X, @DraftMatrixApp (opens in a new tab)">` +
    `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path fill="currentColor" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` +
    `@DraftMatrixApp</a>`;
}

function footer() {
  return `<footer class="site-footer">
  <div class="wrap">
    <ul>
      <li><a href="/support">Support</a></li>
      <li><a href="/privacy">Privacy</a></li>
      <li><a href="/nfl/">Football</a></li>
      <li><a href="/nba/">Hoops</a></li>
      <li><a href="/nhl/">Hockey</a></li>
      <li><a href="/mlb/">Baseball</a></li>
      <li>${xLink()}</li>
    </ul>
    <p>DraftMatrix is an independent draft tool, not affiliated with, endorsed by, or sponsored by any professional sports league, team, or ranking publisher.</p>
    <p>Apple, the Apple logo, iPhone and iPad are trademarks of Apple Inc., registered in the U.S. and other countries. App Store is a service mark of Apple Inc.</p>
    <p>© ${YEAR} Grout Technology LLC</p>
  </div>
</footer>`;
}

function layout(page, body) {
  const url = ORIGIN + (page.canonical ?? page.path);
  const og = `${ORIGIN}/assets/og/${page.og}.png`;
  const ogAlt = page.ogAlt ?? `${page.title.split(" — ")[0]} screenshots`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${page.appId ? `${appBanner(page.appId)}\n` : ""}<title>${esc(page.title)}</title>
<meta name="description" content="${esc(page.description)}">
${page.noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${url}">`}
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="${THEME_COLOR[page.theme]}">
${iconLinks(page.icon)}
<link rel="stylesheet" href="/assets/site.css">
<meta property="og:type" content="website">
<meta property="og:site_name" content="DraftMatrix">
<meta property="og:title" content="${esc(page.title)}">
<meta property="og:description" content="${esc(page.description)}">
${page.noindex ? "" : `<meta property="og:url" content="${url}">\n`}<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:type" content="image/png">
<meta property="og:image:alt" content="${esc(ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="${TWITTER_SITE}">
<meta name="twitter:title" content="${esc(page.title)}">
<meta name="twitter:description" content="${esc(page.description)}">
<meta name="twitter:image" content="${og}">
<meta name="twitter:image:alt" content="${esc(ogAlt)}">
${STRUCTURED_DATA[page.path] ? jsonLd(STRUCTURED_DATA[page.path]) : ""}${body.includes("cf-turnstile") ? `<script src="${TURNSTILE_SCRIPT}" async defer></script>\n` : ""}</head>
<body class="theme-${page.theme}">
${header(page.nav)}
<main id="main">
${body.trim()}
</main>
${footer()}
<script src="/assets/signup.js" defer></script>
${body.includes("dm-feedback") ? `<script src="/assets/feedback.js" defer></script>\n` : ""}</body>
</html>
`;
}

// {{badge:nfl}}  {{signup:nba}}  {{signup:all|Custom heading}}  {{name:nhl}}  {{store:nba}}
// {{icon:nfl|88}}  {{icon:nba|72|lazy}}  {{motif:brand}}
// Support page only: {{support:heading}}  {{support:focus}}  {{feedback:form}}
function expand(src, page) {
  return src.replace(/\{\{(\w+):(\w+)(?:\|([^}]*))?\}\}/g, (m, kind, arg, extra) => {
    if (kind === "badge") return badge(arg);
    if (kind === "icon") return icon(arg, ...(extra ?? "").split("|"));
    if (kind === "motif") return MOTIF;
    if (kind === "signup") return signup(arg, extra);
    if (kind === "name") return esc(APP_NAME[arg]);
    if (kind === "store") return APP_STORE[arg];
    if (kind === "support" && arg === "heading") return esc(page.focus ? `${APP_NAME[page.focus]} Support` : "DraftMatrix Support");
    if (kind === "support" && arg === "focus") return supportFocus(page.focus);
    if (kind === "feedback" && arg === "form") return feedbackForm(page.focus);
    throw new Error(`unknown placeholder ${m}`);
  });
}

// The support page's app sections sit between <!-- app:<sport> --> and
// <!-- /app:<sport> -->. On a per-sport support page that app's section moves first.
const APP_BLOCK = /<!-- app:(\w+) -->[\s\S]*?<!-- \/app:\1 -->\n?/g;
function orderApps(src, focus) {
  if (!focus) return src;
  const blocks = [...src.matchAll(APP_BLOCK)];
  const first = blocks.find((b) => b[1] === focus);
  if (!first) throw new Error(`no app section for ${focus} in support.html`);
  const ordered = [first, ...blocks.filter((b) => b !== first)].map((b) => b[0]).join("");
  const start = blocks[0].index, end = blocks.at(-1).index + blocks.at(-1)[0].length;
  return src.slice(0, start) + ordered + src.slice(end);
}

// The line under the heading on a per-sport support page.
function supportFocus(focus) {
  if (!focus) return "";
  const anchor = SUPPORT_ANCHOR[focus];
  return `<p class="small">This page covers every DraftMatrix app. <a href="#${anchor}">${esc(APP_NAME[focus])}</a> is first; the others follow.</p>`;
}

function build() {
  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });

  if (!SUPPORT_EMAIL) throw new Error("SUPPORT_EMAIL must be set");
  for (const [src, page] of Object.entries(LEGACY)) {
    const html = readFileSync(join(ROOT, src), "utf8");
    let out = replaceContact(src, inject(src, html, privacySection(page.support)), page.support);
    if (page.icon) out = insertInline(src, out, out.indexOf("</head>"), iconLinks(page.icon));
    writeFileSync(join(DIST, page.out), out);
  }

  cpSync(join(ROOT, "assets"), join(DIST, "assets"), { recursive: true });
  copyFileSync(join(ROOT, "src", "site.css"), join(DIST, "assets", "site.css"));
  if (BUTTONDOWN) {
    const js = readFileSync(join(ROOT, "src", "signup.js"), "utf8");
    if (!js.includes(SIGNUP_OK)) throw new Error("signup success message not found in src/signup.js");
    writeFileSync(join(DIST, "assets", "signup.js"), js.replace(SIGNUP_OK, SIGNUP_OK_CONFIRM));
  } else {
    copyFileSync(join(ROOT, "src", "signup.js"), join(DIST, "assets", "signup.js"));
  }
  copyFileSync(join(ROOT, "src", "feedback.js"), join(DIST, "assets", "feedback.js"));

  // Pages advanced mode. _routes.json limits the worker to /api/*, so static
  // requests skip it entirely (and don't count as worker invocations).
  copyFileSync(join(ROOT, "src", "_worker.js"), join(DIST, "_worker.js"));
  writeFileSync(join(DIST, "_routes.json"),
    JSON.stringify({ version: 1, include: ["/api/*"], exclude: [] }, null, 2) + "\n");

  for (const page of [...PAGES, NOT_FOUND]) {
    signupCount = 0;
    const body = expand(orderApps(readFileSync(join(ROOT, "src", "pages", page.src), "utf8"), page.focus), page);
    const html = layout(page, body);
    if (/\{\{/.test(html)) throw new Error(`unexpanded placeholder in ${page.src}`);
    const dest = join(DIST, page.out);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, html);
  }

  // Pages already serves /support.html at /support (pretty URLs), so a
  // /support -> /support.html rule would loop. The legacy GitHub Pages paths
  // point straight at the bare paths to save a hop.
  // Flat pages at the root (support.html, hockey.html, privacy.html etc.) have no
  // /x/index.html, so /x/ is a 404 on Pages; send it to /x. No loop: /x serves
  // x.html directly.
  const slashRules = [...PAGES.map((page) => page.out), ...Object.values(LEGACY).map((page) => page.out)]
    .filter((out) => out.endsWith(".html") && !out.includes("/") && out !== "index.html")
    .map((out) => out.slice(0, -".html".length))
    .map((name) => `/${name}/ /${name} 301`);
  // Old GitHub Pages paths of those pages go straight to the bare path, ahead of
  // the splat: through it, /draftmatrix-site/x.html (or x/) would take two hops
  // (-> /x.html, then Pages' 308 -> /x; or -> /x/, then the slash rule -> /x).
  const legacyRules = slashRules.map((rule) => rule.split(" ")[1])
    .flatMap((bare) => [`/draftmatrix-site${bare}.html ${bare} 301`, `/draftmatrix-site${bare}/ ${bare} 301`]);
  writeFileSync(join(DIST, "_redirects"), [
    "/draftmatrix-site /support 301",
    "/draftmatrix-site/ /support 301",
    "/draftmatrix-site/index.html /support 301",
    ...legacyRules,
    "/draftmatrix-site/* /:splat 301",
    ...slashRules,
    "",
  ].join("\n"));

  // Pages whose canonical is another URL (the per-sport support pages) stay out.
  const urls = [...PAGES.filter((p) => !p.canonical).map((p) => p.path), ...SITEMAP_LEGACY];
  writeFileSync(join(DIST, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${ORIGIN}${u}</loc></url>`).join("\n") + `\n</urlset>\n`);

  writeFileSync(join(DIST, "robots.txt"), `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`);

  // Longer browser caching for images only. Asset names aren't fingerprinted (a
  // regenerated screenshot keeps its name), so a week rather than immutable; CSS,
  // JS and HTML keep Pages' defaults so a change reaches visitors right away.
  // Static assets only: the worker's /api/* responses don't get _headers. No CSP.
  writeFileSync(join(DIST, "_headers"), IMAGE_DIRS.map((dir) =>
    `/assets/${dir}/*\n  Cache-Control: public, max-age=${IMAGE_MAX_AGE}\n`).join("\n"));

  console.log(`Built ${PAGES.length} pages + 404.html + ${Object.keys(LEGACY).length} legacy privacy pages into ${DIST === join(ROOT, "dist") ? "dist/" : DIST} (SIGNUP_LIVE=${SIGNUP_LIVE}, BUTTONDOWN_LIVE=${BUTTONDOWN})`);
}

build();
