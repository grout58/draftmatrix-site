# Claims ledger

This file lists every factual claim on the new pages and the source that backs it. Checked 2026-10-23.

Paths are relative to `../DraftMatrix/`. Abbreviations:

- **PK** = `Packages/DraftMatrixCore/Sources`
- **M-FB** = `apps/DraftBoard/AppStoreAssets/metadata.md`, "2.0.1 (submitted listing)" section, lines 100–155
- **M-HP** = `apps/NBADraftMatrix/AppStore/metadata.md`, 2.0.1 section, lines 141–193
- **M-HK** = `apps/NHLDraftMatrix/AppStore/metadata.md`, 2.0.1 section, lines 186–234
- **M-BB** = `apps/MLBDraftMatrix/AppStore/metadata.md` (pre-submission draft, no 2.0.1 section)

The legacy privacy pages' own content (`privacy.html`, `hockey-privacy.html`, `basketball-privacy.html`, `baseball-privacy.html`) is not covered; it is copied unchanged. The old root support pages (`index.html`, `hockey.html`, `basketball.html`, `baseball.html`) are no longer copied into `dist/`; the support pages are now built from `src/pages/support.html` (see "Support page"). The sections the build adds to them are covered below under "Sections added to the legacy pages".

## Pricing and Pro (home, every sport page)

| Claim | Backed by |
|---|---|
| Free to download | M-FB:119, M-HP:155, M-HK:200 ("FREE TO DOWNLOAD"); `CLAUDE.md` 2026-10-19/20 notes (NFL and hoops price set to Free); `CLAUDE.md` 2026-10-23 note (hockey went Free 2026-10-23) |
| DraftMatrix Pro is $4.99, one time, no subscription | `displayPrice` 4.99 and type `NonConsumable` at lines 8/20 of `apps/DraftBoard/DraftBoardTests/Pro.storekit`, `apps/NBADraftMatrix/Pro.storekit`, `apps/NHLDraftMatrix/Pro.storekit`; `Notes/freemium-plan.md:11`; "one-time in-app purchase … No subscription" in M-FB, M-HP, M-HK |
| "$4.99 in the US; local prices vary" | The StoreKit files hold the US price; App Store Connect sets other territories automatically (`CLAUDE.md`, price notes) |
| Pro is unlocked separately in each app | A separate product ID in each app: `com.grouttechnologyllc.draftmatrix.pro`, `dev.grouttechnologyllc.DraftMatrixHoops.pro`, `dev.grouttechnologyllc.NHLDraftMatrix.pro` (Pro.storekit:18) |
| No ads | M-FB:155, M-HP:191, M-HK:232; no ad SDKs in any app (`apps/*/*/PrivacyInfo.xcprivacy`; packages have no dependencies, `Packages/DraftMatrixCore/Package.swift`) |
| Free: board, tiers, search, filters, draft guide | "The board, tiers, search, filters and draft guide are free" in M-FB, M-HP, M-HK (FREE TO DOWNLOAD block) |
| Free: your first three picks to your own team, three in total across all drafts | `PK/DraftMatrixUI/Support/ProAccess.swift:68` (`freePickLimit = 3`, "across every draft"), `:73`, `:204-205`; only `toggleMine` is gated: `PK/DraftMatrixUI/AppModel.swift:367-386` |
| Free: marking other teams' picks | `toggleTaken` is not gated: `PK/DraftMatrixUI/AppModel.swift:365` |
| Pro: unlimited picks to your own team, in every draft | "unlocks unlimited picks in every draft" in M-FB, M-HP, M-HK |
| Restore Purchases is in the Draft panel | `PK/DraftMatrixUI/Views/DraftSidebarView.swift:401`, `PK/DraftMatrixUI/Views/PaywallView.swift:145` |
| No account, no tracking, "Data Not Collected" | M-FB:155, M-HP:191, M-HK:232; `NSPrivacyTracking = false` in each `PrivacyInfo.xcprivacy:5-6`; App Privacy notes in each metadata.md ("Data Not Collected") |

## Platform

| Claim | Backed by |
|---|---|
| iPhone and iPad | `TARGETED_DEVICE_FAMILY = "1,2"` in each app target: `apps/DraftBoard/DraftBoard.xcodeproj/project.pbxproj:561/608`, NBA/MLB `:398/431`, NHL `:399/433` |
| iOS 17 or later | `IPHONEOS_DEPLOYMENT_TARGET = 17.0`: football `project.pbxproj:546/593`, NBA/MLB `:388/421`, NHL `:389/423` |
| Suggest Pick needs iOS 26 and a device with Apple Intelligence | `PK/DraftMatrixIntelligence/DraftRecommender.swift:14` (iOS 26 at runtime); "(Requires a device with Apple Intelligence.)" in each description; `hockey.html` FAQ |

Not claimed: Mac or Vision Pro. No Catalyst or "Designed for iPad" setting is in the repos, so it can't be confirmed.

## In-person / offline (home, every sport page)

| Claim | Backed by |
|---|---|
| "Online draft rooms give you … DraftMatrix brings that online drafting experience to your offline draft" | BUILT FOR IN-PERSON DRAFTS: M-FB:116, M-HP:152, M-HK:197 (lightly trimmed: "is designed to take … and bring it to" became "brings … to") |
| Works offline: cached rankings and a built-in snapshot | M-FB:151, M-HP:188, M-HK:229; football `PK/DraftMatrixNFL/FallbackData.swift:11` and `PK/DraftMatrixCore/Engine/DraftStore.swift:843-860`; hoops/baseball `PK/DraftMatrixCore/Engine/ESPNRankingsProvider.swift:243, 276-278`; hockey `PK/DraftMatrixNHL/NHLRankingsService.swift:51-69` |
| Tap to mark other teams' picks, star yours, undo | "TRACK THE DRAFT" in each description; undo `PK/DraftMatrixUI/AppModel.swift:528` |
| Pick clock: round, overall pick, picks until your turn, snake or linear | TRACK THE DRAFT in each description |
| Live Activity on the Lock Screen and in the Dynamic Island | M-FB:130, M-HP:169, M-HK:210; `PK/DraftMatrixActivity/DraftClockActivity.swift:2,54`; `apps/*/DraftClock/DraftClockBundle.swift:8-10`; `NSSupportsLiveActivities = YES` in each project |
| Keeps the screen awake | M-HP:189, M-HK:230; `PK/DraftMatrixUI/Views/DraftSidebarView.swift:141`, `AppModel.swift:154,164` (shared UI, so football too; it also shows in the football screenshots) |
| Syncs between your devices through your own iCloud | "syncs between your devices through your personal iCloud" in each description; `ubiquity-kvstore-identifier` in `apps/*/*/*.entitlements:7-8`; `PK/DraftMatrixCore/Engine/DraftStore.swift:175, 764` |

## Football page (/nfl/)

| Claim | Backed by |
|---|---|
| Name "DraftMatrix: Fantasy Football" | `apps/DraftBoard/AppStoreAssets/metadata.md:102` (2.0.1 name) |
| Live draft board built around expert tier rankings; tiers show position scarcity; warns when a tier is about to run dry | M-FB:111-114 |
| PPR, Half PPR or Standard; switching reloads the rankings for that format | `PK/DraftMatrixNFL/NFLSport.swift:33-35`; `PK/DraftMatrixUI/AppModel.swift:348-356` → `DraftStore.swift:780` (`refresh(scoring:)`) |
| Tier counters turn orange when low and red on the last player | M-FB:134; `PK/DraftMatrixUI/Views/TierHeaderView.swift:29` |
| Keepers marked drafted without moving the clock | M-FB (TRACK THE DRAFT); `PK/DraftMatrixUI/Views/PlayerRowView.swift:240-242` |
| Bookmark sleepers, filter to targets | M-FB (KNOW WHO'S LEFT); `PlayerRowView.swift:233`, `PositionChipsView.swift:116` |
| Filter by position, search, hide drafted | M-FB (KNOW WHO'S LEFT); `PK/DraftMatrixUI/Views/PositionChipsView.swift:113`, `BoardView.swift:49` |
| Suggest Pick weighs your roster against who's left, explains its pick, on device | M-FB:139-144; `PK/DraftMatrixIntelligence/DraftRecommender.swift`; enabled via `apps/DraftBoard/DraftBoard/Support/NFLTheme.swift:23` |
| Siri and Shortcuts: suggested pick, your team | M-FB:147; `apps/DraftBoard/DraftBoard/AppShortcuts.swift:16-24` |
| First-launch setup guide: scoring, teams, draft slot, roster | M-FB:146; `PK/DraftMatrixUI/RootView.swift:104`, `SetupTipsView.swift:6` |
| Multiple drafts, independent boards | M-FB (MADE FOR DRAFT DAY); `DraftSidebarView.swift:433-482` |
| Import rankings from CSV; share finished roster | M-FB (MADE FOR DRAFT DAY); `DataStatusView.swift:80-82`, `DraftSidebarView.swift:308` |
| FAQ: rankings, bye weeks and ADP from publicly published fantasy football data | M-FB:154-155, with the publisher names removed (rule 3) |

## Hoops page (/nba/)

| Claim | Backed by |
|---|---|
| Name "DraftMatrix: Fantasy Hoops" | `apps/NBADraftMatrix/AppStore/metadata.md` Name section; `CLAUDE.md` app table |
| Categories or Points; board reloads and re-tiers | M-HP:161-163; `PK/DraftMatrixNBA/NBASport.swift:19-28` |
| Positions PG, SG, SF, PF, C | `PK/DraftMatrixNBA/NBASport.swift:27, 77-81` (the description says "point guards, shooting guards, forwards, centers"; the site uses the code's five positions) |
| Tiers computed on your device from published draft ranks blended with ADP | M-HP:163; `PK/DraftMatrixCore/Engine/TierBuilder.swift:67`, `ESPNRankingsProvider.swift:371` |
| Tier counters warn when low and flag the last player | M-HP:173 |
| Best Available at every position; roster needs | M-HP:174-175; `DraftSidebarView.swift:178-225, 233` |
| Weighs your open starter slots | M-HP:179-181 |
| Export the board; keyboard shortcuts on iPad | M-HP:187-189; `DraftSidebarView.swift:352`; `apps/NBADraftMatrix/NBADraftMatrix/NBADraftMatrixApp.swift:17-23` |
| All other feature rows | Same sources as the football rows above, from M-HP |

## Hockey page (/nhl/)

| Claim | Backed by |
|---|---|
| Name "DraftMatrix: Fantasy Hockey" | `apps/NHLDraftMatrix/AppStore/metadata.md` Name section |
| Positions C, LW, RW, D, G; "F" for unmatched forwards | `PK/DraftMatrixNHL/NHLSport.swift:48-51`; `hockey.html` FAQ |
| Tiers computed on device from expert rankings blended with ADP | M-HK:232; `PK/DraftMatrixNHL/NHLRankingsService.swift:140` |
| Setup guide: teams, draft slot, roster (no scoring step) | M-HK:224; hockey has no scoring formats (`NHLSport.swift:119-137`, `SportProfile.swift:63`) |
| Rankings source wording | M-HK:232 |
| Keeps the screen awake, dark mode, iPad keyboard shortcuts | M-HK:230 |
| All other feature rows | Same sources as above, from M-HK |

## Baseball page (/mlb/)

| Claim | Backed by |
|---|---|
| Coming January 2027 | Owner's instruction. Now matches `CLAUDE.md` and `Notes/freemium-plan.md:31`, which say "~January" for 2027 ranks and launch |
| Not on the App Store yet | No App Store Connect record (`apps/MLBDraftMatrix/AppStore/metadata.md:136-142`) |
| Built and waiting on next season's rankings | `CLAUDE.md` app table ("Waits on 2027 ranks (~January) and the ASC record") |
| Roto or Points | `PK/DraftMatrixMLB/MLBSport.swift:24-33`; M-BB "ROTO OR POINTS" |
| Positions C, 1B, 2B, 3B, SS, OF, DH, SP, RP | `PK/DraftMatrixMLB/MLBSport.swift:32` |
| Tiers on device from draft ranks blended with ADP | M-BB:41 |
| Best available, roster needs | M-BB:53-54 |
| Pick tracking, keepers, targets | M-BB "TRACK THE DRAFT" |
| Draft clock with Live Activity | `apps/MLBDraftMatrix/DraftClock/DraftClockBundle.swift`; `NSSupportsLiveActivities` at `apps/MLBDraftMatrix/MLBDraftMatrix.xcodeproj/project.pbxproj:380` |
| Suggest Pick on device | `apps/MLBDraftMatrix/MLBDraftMatrix/Support/MLBTheme.swift:23` |
| Offline snapshot, screen stays awake | M-BB:68-69 |
| Planned: free download with the same Pro purchase | `Notes/freemium-plan.md:31` ("launches free"); Pro wired at `apps/MLBDraftMatrix/MLBDraftMatrix/MLBDraftMatrixApp.swift:31,38`; `apps/MLBDraftMatrix/Pro.storekit` ($4.99). The page says "planned" and gives no price |
| Screenshots are from a pre-release build on last season's rankings | `apps/MLBDraftMatrix/AppStore/metadata.md:127-128` (2026 season fallback until 2027 ranks) |

## Support page (/support, and /hockey, /basketball, /baseball)

Checked 2026-10-23 against the app repos on `main` at 2.0.3 (football build 28, hoops build 12, hockey build 33; `DraftMatrixCore` at `b6b2478`). All three apps share the UI in `PK/DraftMatrixUI`, so each row holds for every app unless it says otherwise. There are no localized string files; the bold UI names are the Swift string literals. **UI** = `PK/DraftMatrixUI`.

| Claim | Backed by |
|---|---|
| The Guide: the "?" on the board, or "Guide: how to run a draft" at the bottom of the Draft panel | `UI/Views/DraftSidebarView.swift` last section; `UI/Views/HelpView.swift` |
| Draft panel: the gear button at the top left on iPhone, the left column on iPad | `UI/Views/BoardView.swift:106` (label "Draft panel and settings"); `UI/RootView.swift:62-68` |
| Pro is a one-time purchase, no subscription; bought separately in each app | Pricing rows above (`Pro.storekit` NonConsumable, one product ID per app) |
| **Restore Purchases** in the Draft panel's last section (shown without Pro) and under the buy button on the Pro screen; it syncs with the App Store | `UI/Views/DraftSidebarView.swift:392-405` (label :401); `UI/Views/PaywallView.swift:145`; `UI/Support/ProAccess.swift:182-185` (`AppStore.sync()`) |
| With Pro the section reads "Pro — unlimited drafts" or "Pro — included with your purchase" | `DraftSidebarView.swift:395` |
| Free: board, tiers, search, filters, Guide, marking other teams' picks, keepers, targets, first three picks to your own team across all drafts; Pro: unlimited picks to your own team | Pricing rows above; keepers `AppModel.swift:398-401` and targets `:389-392` aren't gated |
| Live Activity on the Lock Screen and, on iPhones that have one, the Dynamic Island; starts at the first marked pick, updates per pick, ends when the roster is full, on reset or on switching drafts | `UI/Support/LiveDraftClock.swift:6-8, 21-49`; `AppModel.swift:453-462`; `PK/DraftMatrixActivity/DraftClockActivity.swift`; M-FB:131, M-HP:169, M-HK:210 |
| No in-app switch; turned on/off with the app's **Live Activities** switch in Settings | The app only reads `ActivityAuthorizationInfo().areActivitiesEnabled` (`LiveDraftClock.swift:38`); the per-app Live Activities switch in Settings is standard iOS for apps with `NSSupportsLiveActivities` (not app code). Not claimed: anything about iPad Live Activities |
| Clock counts every marked pick; **Teams**, **My draft slot**, **Snake draft**; **Undo** | `DraftSidebarView.swift:318-348`; `AppModel.swift:437-442, 528`; wording from the legacy hockey/baseball support FAQ |
| Offline: opens with the built-in snapshot, refreshes, then falls back to the last downloaded rankings or the snapshot; picks saved on device | `PK/DraftMatrixCore/Engine/DraftStore.swift:242-247, 734-750, 789-861`; `AppModel.swift:172-180`; M-FB:152, M-HP:188, M-HK:229 |
| Rankings status "Live", "Cached", "Built-in snapshot" (and football's "Last good board", not quoted); **Refresh now** | `AppModel.swift:659-679`; `ESPNRankingsProvider.swift:86-88`; `PK/DraftMatrixNHL/NHLRankedPlayer.swift:112-114`; `NFLRankingsProvider.swift:116`; `DataStatusView.swift:56-68` |
| Restoring needs a connection to the App Store | `AppStore.sync()` is an App Store call (`ProAccess.swift:182-185`) |
| Keepers: long-press → **Keeper…** → **My keeper** / **Another team's keeper**; "K" badge; don't move the clock; **Clear keeper** | `UI/Views/PlayerRowView.swift:146, 237-244`; `HelpView.swift:21`; M-FB:132, M-HP:170, M-HK:211 |
| iCloud: drafts, picks, keepers, targets and roster setup sync on their own, no switch; imported CSV rankings stay on the device | iCloud key-value store (`ubiquity-kvstore-identifier` in each entitlements file); `DraftStore.swift:222, 342, 666-673, 734-760` (sync), `:128` (imports local only); `HelpView.swift:40`; M-FB:150, M-HP:186, M-HK:227. Not claimed: syncing teams, draft slot or scoring (local preferences, `AppModel.swift:87-106`) |
| **Suggest** in the Best available section (⌘I on iPad); **Draft to my team**, **Again**; runs on device; drafting a suggestion counts as a pick | `DraftSidebarView.swift:36-52, 216-229`; `UI/Views/SuggestionCard.swift`; `AppModel.swift:470-521` (pick counted at :517); M-FB:141-144 |
| Suggest needs iOS 26 and a device with Apple Intelligence turned on; "still downloading, try again in a few minutes" | `PK/DraftMatrixIntelligence/DraftRecommender.swift:14-27, 49`; `PK/DraftMatrixCore/Models/Suggestion.swift:45-52`; `HelpView.swift:27` |
| CSV: **Import CSV rankings…** in Rankings; Rank, Name, Tier, Position; header optional, any order with a header, Team optional; no Tier → computed tiers; 2 MB, 2,000 rows; CSV or plain text; **Use imported rankings**, **Remove import**; picks, keepers and targets carry over | `UI/Views/DataStatusView.swift:75, 82, 97-113`; `PK/DraftMatrixCore/Engine/CustomRankingsImporter.swift:49-60, 125-127`; `HelpView.swift:39` |
| Rankings sources (generic): football published expert tier rankings per scoring format plus public ADP and bye weeks; hoops public draft ranks and ADP (category / points), tiers on device; hockey published expert rankings blended with public ADP, positions from public rosters, tiers on device | `NFLRankingsProvider.swift`, `PK/DraftMatrixNBA/NBASport.swift:109-121`, `PK/DraftMatrixNHL/NHLRankingsService.swift:83-147`, `NHLTheme.swift:18`; publisher names left out (rule 3) |
| Refresh on open and every 10 minutes with **Auto-refresh every 10 min**; **Scoring**: Standard, Half PPR, PPR / Categories, Points | `DataStatusView.swift:30-40, 56-68`; `NFLSport.swift:33-35`; `NBASport.swift:19-21` |
| Hockey "F" forwards | Hockey page row above; legacy `hockey.html` FAQ |
| **Reset** → **Reset picks (keep keepers &amp; targets)** / **Reset everything**; "Rankings stay either way, and Undo can bring the board back"; panel title → **New Draft…** | `DraftSidebarView.swift:433-482` (reset dialog :471-476) |
| No account, ads, tracking or data collected; draft on device and in your iCloud | Pricing rows above (privacy manifests, "Data Not Collected") |
| iPhone and iPad, iOS 17 or later; suggestions need iOS 26 | Platform rows above |
| Baseball coming January 2027, not on the App Store yet; email list on /mlb/ | Baseball rows above |
| Contact: support@draftmatrix.app and the feedback form; we reply by email | `SUPPORT_EMAIL` (owner-supplied); `src/feedback.js` success message "we'll reply by email". The apps have no in-app support link (no support URL or email in the Swift sources); the App Store support URL is `https://draftmatrix.app/support` for all three (football metadata.md:64, hoops :87, hockey :80) |

Not claimed on the support page, on purpose:

- **"Bought DraftMatrix before it was free? Pro is already yours."** Still dropped (see "Dropped or changed"). The code is on `main` for all three apps: football cutoff by original purchase date (`apps/DraftBoard/DraftBoard/DraftMatrixApp.swift:40-51`), hockey by date (`PK/DraftMatrixNHL/NHLSport.swift:106`), hoops by original build < 4 (`NBADraftMatrixApp.swift:36`), with the toast "Thanks for buying DraftMatrix — Pro is included, free." (`RootView.swift:143-145`). But 2.0.3 is still in review, and the owner's rule was to wait until the fix has shipped in every app. The FAQ only quotes the "Pro — included with your purchase" label.
- Siri phrases (see Dropped), iPad Live Activities, which iPhones have a Dynamic Island, keyboard shortcuts other than ⌘I.

## Footer

| Claim | Backed by |
|---|---|
| Independence disclaimer | Owner-supplied wording; matches the spirit of M-HP:193 and M-HK:234 |
| © 2026 Grout Technology LLC | Legacy pages' footers |
| X link: @DraftMatrixApp, https://x.com/DraftMatrixApp | Owner-supplied account (2026-10-23). A link, not a claim |
| Apple trademark notice | Apple's App Store marketing guidelines require it wherever the badge is used |

## Signup copy (promises, not app facts)

- "Get the free cheat sheet each draft season" is the owner's wording.
- "We'll email you the free cheat sheet when draft season starts." I wrote this one. It is a commitment.
- "Signing up is optional, and you can unsubscribe anytime." was added in front of the next line on 2026-10-23 (owner's instruction). The unsubscribe promise depends on the email tool (see Open concerns).
- "We only use your email for DraftMatrix emails. Privacy" under every signup form is the owner's wording. It links to `#email-list` on the matching privacy page (`/privacy.html` for home and football, then `/basketball-privacy.html`, `/hockey-privacy.html`, `/baseball-privacy.html`).
- Baseball page: "…and a note when the app is out." Same caveat.

## Sections added to the legacy pages

| Claim | Backed by |
|---|---|
| Privacy pages: Contact line "Questions? Email us at support@draftmatrix.app, or use the support page linked from the App Store listing.", and "ask for deletion by emailing support@draftmatrix.app or through the support page" | Owner approved showing the address on the privacy pages, and decided to drop the github.com/grout58 contact from them (both 2026-10-23). The Contact sentence is replaced in the dist copies only, between `dm-inline` markers; the legacy sources are unchanged |
| Support pages (now built, see "Support page"): the feedback form sends name, email, app and message; no GitHub contact (owner's rule, 2026-10-23) | `src/feedback.js`, `src/_worker.js` (`feedback()`) |
| Privacy: "The DraftMatrix apps themselves still collect no data. This section covers only the optional forms on the draftmatrix.app website." | Same sources as "No account, no tracking, Data Not Collected" above; the forms exist only on the website |
| Privacy: the email list stores the address, which sport page(s), and first and latest signup time | `src/_worker.js` `subscribe()` stores `{sport, sports, ts, firstTs}` under `email:<address>` and nothing else (`sports` is every page, `ts` the latest signup, `firstTs` the first). `worker-test.mjs` asserts the record has exactly these keys |
| Privacy: list used only for the draft-season cheat sheet and DraftMatrix app news; never sold or shared | Owner's commitments |
| Privacy: feedback stores the name (optional), email, the app chosen, the message and the time sent; used only to reply | `src/_worker.js` `feedback()` stores `{name, email, app, message, ts}` and nothing else (the user-agent was dropped on 2026-10-23). `worker-test.mjs` asserts the record has exactly these keys |
| Privacy: kept until you unsubscribe or ask us to delete; unsubscribe anytime or ask for deletion through the support page | Owner's commitments. Nothing deletes automatically, which matches "kept until". Deletion is manual (dashboard or wrangler). The unsubscribe part depends on the email tool (see Open concerns) |
| Privacy: both stored with "Cloudflare, our website host" | KV bindings `SIGNUPS` / `FEEDBACK` on the Pages project; `PROVIDER` in `build.mjs` |
| Privacy, only when `BUTTONDOWN_LIVE` is true (not published today): email address and sport(s) sent to Buttondown, which sends the emails, asks you to confirm by email and handles unsubscribes; Buttondown also receives your IP address to filter spam; "We never sell them, and share them only with the providers named here" replaces "never sold or shared" | `src/_worker.js` `forwardToButtondown()` sends `email_address`, `metadata.sports` and `ip_address` (CF-Connecting-IP), with no `type`, so Buttondown's double opt-in applies; `worker-test.mjs` asserts the body. `scripts/check.py` fails if any page names Buttondown while the flag is false. Turning it on also needs the Pages secret and env var (DEPLOY.md) |
| Privacy: "To block spam, the forms use Cloudflare Turnstile, which checks your browser when you use the forms" | Owner's wording (changed from "when you submit" on 2026-10-23, since the widget runs on page load). Both forms render a Turnstile widget (`build.mjs` `turnstile()`) and the worker verifies the token with siteverify before storing (`verifyTurnstile()`). The token and `CF-Connecting-IP` go to Cloudflare for that check; neither is stored |
| Privacy: "Added October 23, 2026" | Date the section was rewritten (owner's instruction) |
| Support pages: "Email address (used only to reply to you)" on the feedback form | Owner's instruction; matches "We use it only to reply to you" on the privacy pages |

## Brand and artwork (2026-10-23)

Not factual claims, but recorded so nothing looks like it promises more than it does.

| Item | Source / rule |
|---|---|
| App icons on the home cards, sport heroes, favicons, touch icons and OG images | The real 1024px App Store icons supplied in `.work/icon-{nfl,nba,nhl}-1024.png`, resized only (`scripts/icons.py`). Nothing drawn on them |
| Sport page tints | Each icon's background: football `#07170d`→`#284a33`, hoops `#130e08`→`#2f1e13`, hockey `#071019`→`#233851` (owner-supplied values, matching the icons) |
| Baseball: no icon anywhere | No baseball icon has been released. `assets/icons/mlb-*` was removed, and `check.py` fails if one returns. The baseball page, card and OG image use the brand tile motif on the neutral `#0b0f14`→`#1d2430` background. `/mlb/` and the dist copies of `baseball.html` / `baseball-privacy.html` use a motif favicon and touch icon (`assets/icons/motif.svg`, `motif-64.png`, `motif-180.png`, drawn by `scripts/motif_icon.py`), not the football icon and not a baseball app icon |
| The tile motif (CSS, header SVG, OG drawings) | A generic brand pattern after the icons' tier grid, with no sport ball. It's decorative (`aria-hidden`) and not presented as an app icon |
| "Tier 1 / Tier 2 / Tier 3" chips and section chips ("In person", "The apps", "Pricing", "Features", "Screenshots", "FAQ", "Planned") | Decorative labels (the hero chips are `aria-hidden`). They make no claim |
| OG images | Real App Store screenshots and real icons (football, hoops, hockey); baseball uses the motif. Text is the same as before |
| App Store badge | Apple's black badge, unmodified, one per app card, 44px tall |

## Dropped or changed, and why

- **"Bought DraftMatrix before it was free? Pro is already yours."** Dropped from the home pricing card and the football, hoops and hockey FAQs on 2026-10-23, on the owner's instruction, until the grandfather fix has shipped in every app (see Open concerns). It is still in the submitted App Store descriptions (M-FB, M-HP, M-HK). The code that backs it, for when it returns: `ProAccess.swift:14-29, 255-268`; per-app cutoffs `apps/DraftBoard/DraftBoard/DraftMatrixApp.swift:40-51`, `apps/NBADraftMatrix/NBADraftMatrix/NBADraftMatrixApp.swift:36`, `apps/NHLDraftMatrix/NHLDraftMatrix/NHLDraftMatrixApp.swift:36-38`. To restore it, put back the `<li>` in `src/pages/home.html` and the "I paid for … before it was free" `<dt>`/`<dd>` in `src/pages/nfl.html`, `nba.html` and `nhl.html`.

- **Publisher names** (`borischen.co`, Fantasy Football Calculator, ESPN). The football description names them, but rule 3 bars ranking-publisher brands from the site, so the copy says "publicly published fantasy football data". The legacy `support.html` and `privacy.html` still name borischen.co and fantasyfootballcalculator.com, because they are copied verbatim.
- **"Bye weeks and average draft position on every player"** (football, M-FB:137). Dropped as a feature bullet. `CLAUDE.md` (2026-10-18) records that in-season feeds are thin and many rows lack team, bye or ADP. The FAQ only says where that data comes from.
- **Football iPad screenshots and football iPhone shot 4.** Not used. Every football iPad shot has a defense listed by full team name in the sidebar ("Houston Texans"), and iPhone shot 4 shows the publishers' site names in the Rankings panel. Team abbreviations in rows (e.g. "DEN") stay; family policy allows them.
- **Hockey "Centers, Wings, Defense, Goalies".** The description's grouping is kept in the lede (it is still true), but the feature list uses the code's positions C, LW, RW, D, G.
- **Hoops "point guards, shooting guards, forwards, centers".** Replaced with PG, SG, SF, PF, C from the code.
- **Siri phrases.** Not quoted. Siri uses each app's own name (`AppShortcuts.swift:16-24` uses `\(.applicationName)`), so the description's literal "in DraftMatrix" may not match what users say. The site says "Ask for a suggested pick or your team by voice".
- **Mac / Vision Pro.** Not claimed (see Platform).
- **Baseball price.** Not stated. It isn't on sale, and M-BB:145 still carries an old $1.99 note that conflicts with the free-launch plan.
- **Ratings, rankings, downloads, testimonials.** None used. The hoops "#3 for fantasy basketball draft" note in metadata.md is a search rank, not something to advertise.

## Open concerns

- **The in-app paywall overstates Pro** (app copy, not the site): its bullets "Keepers, targets and Suggest Pick included" and "Every draft synced through iCloud" (`UI/Views/PaywallView.swift:77-80`) read as Pro-only, but keepers, targets, asking for a suggestion and iCloud sync are all free in code. The support page describes the code's behavior.
- **Guide shortcut:** the Guide lists ⇧⌘H (hide drafted) in every app (`HelpView.swift:44`), but only football registers it. The site doesn't mention it.
- **Baseball metadata support URL** is still `https://grout58.github.io/draftmatrix-site/baseball.html` (`apps/MLBDraftMatrix/AppStore/metadata.md:88`); it should be `https://draftmatrix.app/support` before submission.

- **Grandfathering is not airtight today.** Hockey's date-based fix is in 2.0.1 build 30, which was submitted 2026-10-23 and isn't live yet. Until it is approved, some $1.99 buyers of hockey builds 24+ hit the paywall. Football's date-based cutoff may only be on the local branch `fix/nfl-grandfather-paid` (`CLAUDE.md`, 2026-10-23), so a few football buyers from the minutes it sold at $1.99 on 2.0 may not be covered. The site no longer makes this claim (see Dropped). The App Store descriptions still do. Update, end of 2026-10-23: on `main` at 2.0.3 the football cutoff is merged (`DraftMatrixApp.swift:40-51`) and hockey's cutoff is 2026-10-24T16:58Z (`NHLSport.swift:106`); 2.0.3 is in review, so it isn't live yet.
- **Football listing name.** The live listing may still read "DraftMatrix" until 2.0.1 clears review. The site uses "DraftMatrix: Fantasy Football" as instructed.

## Review-guideline audit (2026-10-23)

Checked against App Store Review Guidelines concerns (accurate marketing, privacy disclosure, a working support contact) and the owner's standing rules.

**What I checked**

- Every new page (`src/pages/*.html`), the support and privacy sections `build.mjs` injects, and every page in `dist/` after `node build.mjs`, including titles, meta and OG/Twitter tags, alt text and aria labels.
- Platforms: only iPhone and iPad (iOS 17+) are named. No Android, Google Play, web app, Mac, Windows, "everywhere" or "any device" wording anywhere in `dist/`.
- Email: the signup is offered only on the website, and no copy says or implies that the apps ask for or need an email. The apps are still described as "no account" and "Data Not Collected".
- Privacy sections against `src/_worker.js`, one field at a time. Subscribe: key `email:<address>` plus `sport`, `sports`, `ts`, `firstTs`. Feedback: `name`, `email`, `app`, `message`, `ts`, `ua`. No IP address or other headers are stored.
- Support sections: the GitHub link and feedback form are on all four support pages. `SUPPORT_EMAIL` is still `null`: no address is shown, the HTML comment `SUPPORT_EMAIL not set` is in place, and the build prints a warning. No address was made up.
- Brand rule: `scripts/check.py` scan is clean on the new pages and injected blocks. OG image text in `scripts/og.py` is clean too.
- Canonical, `og:url`, `og:image`, `twitter:image`, sitemap and robots all use `https://draftmatrix.app`.
- `python3 scripts/check.py` (without `--serve`) passes: legacy pages byte-identical outside the added block, links resolve, worker tests pass, 1.78 MB.

**What I changed**

- Privacy sections (`build.mjs` `privacySection`): the email list now says "which sport pages you signed up from, and when you first and most recently signed up", because `sports` holds every page and both `ts` and `firstTs` are stored. The old wording was "which sport's page … and when". Feedback now lists "the time you sent it", for `ts`, which was missing.
- Feedback form: the email label reads "Email address (used only to reply to you)".
- Signup forms: the note now starts "Signing up is optional, and you can unsubscribe anytime."
- Home pricing note: "The App Store privacy label for each app on the App Store reads 'Data Not Collected.'" Baseball has no listing, so it has no label.
- Baseball "Same pricing model": "with a DraftMatrix Pro one-time purchase, like the other apps". The old wording ("the same DraftMatrix Pro one-time purchase as the other apps") could be read as one purchase that unlocks every app, but Pro is unlocked separately in each app.

**Borderline, needs the owner's call**

- **Legacy privacy pages open with "DraftMatrix collects no personal data. None."** and are dated "Effective August 29, 2026". The added section says it covers the website only and that the apps still collect nothing, but the website now collects email addresses. The pages' own "Changes" paragraph promises a new effective date when the policy changes. Legacy sources can't be edited under the build rules, so it's your call whether to update the headline and date (in the source) or reword the added section.
- **"We use them only to reply to you"** (feedback) while the user-agent is also stored. It's presumably kept for troubleshooting, which isn't the same as replying. Either widen the purpose ("to reply and to look into the problem") or stop storing `ua`.
- **Cloudflare's own logs.** The worker stores no IP address, but Cloudflare as the host may log requests. The privacy text only describes what we store. Consider a line like the legacy pages' note about third-party server logs.
- **No retention or deletion terms.** Neither section says how long signups or feedback are kept. Deletion is "ask us through the support page", and the only contact today is GitHub or the form itself.
- **Unsubscribe promise.** "Unsubscribe anytime" and "every email will have an unsubscribe link" depend on an email tool that hasn't been chosen.
- **The support contact is a GitHub profile, not an issue tracker or inbox.** Together with the feedback form it should count as a working contact. A real `SUPPORT_EMAIL` would be safer for Guideline 1.5, and the legacy support pages say "contact us and we'll get back to you".
- **Price in the hero pitch.** "DraftMatrix Pro is $4.99 once" doesn't say "in the US". The pricing section and FAQs do ("local prices vary").
- **Legacy football `support.html` / `privacy.html` still name the ranking publishers**, as already noted under Dropped. The legacy basketball, baseball and hockey disclaimers say "Team and league names are the property of their owners". These are legacy copy, left unchanged.

**Follow-up, later on 2026-10-23 (brand redesign, Turnstile, privacy rewrite)**

- *User-agent* (borderline above): resolved. The worker no longer stores `ua`, so "used only to reply" now matches what's kept. Feedback records written before the change may still carry `ua`; delete those or let them age out by hand (nothing expires automatically).
- *Retention* (borderline above): resolved in wording. The section now says "kept until you unsubscribe or ask us to delete them".
- *Cloudflare's own logs* (borderline above): partly addressed. The Turnstile sentence links to Cloudflare's privacy policy. The section still describes only what we store, not what Cloudflare logs as host.
- *Turnstile* is the one third-party script. It loads only on the home, sport and support pages (the pages with forms). It sends the visitor's browser signals to Cloudflare when the widget runs, which is on page load, not only "when you submit" as the owner's sentence says. Managed mode decides by itself whether to show a checkbox. The wording is the owner's, kept as given; consider "when you use the forms" if you want it exact.
- Still open: the legacy "collects no personal data" headline and August effective date, the unsubscribe promise (no email tool yet), and the hero price wording.

**Follow-up, end of 2026-10-23**

- *Support contact* (borderline above): resolved. support@draftmatrix.app is the primary contact on all four support pages and is added to the four privacy pages' Contact line and deletion sentence. The `SUPPORT_EMAIL not set` comment and warning are gone from the built site. Make sure the mailbox actually receives mail before deploying.
- *Turnstile wording*: now "when you use the forms".
- *Baseball favicon*: the brand motif instead of the football icon.
