# Claims ledger

This file lists every factual claim on the new pages and the source that backs it. Checked 2026-10-23.

Paths are relative to `../DraftMatrix/`. Abbreviations:

- **PK** = `Packages/DraftMatrixCore/Sources`
- **M-FB** = `apps/DraftBoard/AppStoreAssets/metadata.md`, "2.0.1 (submitted listing)" section, lines 100–155
- **M-HP** = `apps/NBADraftMatrix/AppStore/metadata.md`, 2.0.1 section, lines 141–193
- **M-HK** = `apps/NHLDraftMatrix/AppStore/metadata.md`, 2.0.1 section, lines 186–234
- **M-BB** = `apps/MLBDraftMatrix/AppStore/metadata.md` (pre-submission draft, no 2.0.1 section)

The legacy pages (`support.html`, `privacy.html`, `hockey*.html`, `basketball*.html`, `baseball*.html`) are not covered. They are copied unchanged.

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
| Earlier paid buyers get Pro at no charge | "Bought DraftMatrix before it was free? Pro is already yours" in M-FB, M-HP, M-HK; mechanism `ProAccess.swift:14-29, 255-268`; per-app cutoffs `apps/DraftBoard/DraftBoard/DraftMatrixApp.swift:40-51`, `apps/NBADraftMatrix/NBADraftMatrix/NBADraftMatrixApp.swift:36`, `apps/NHLDraftMatrix/NHLDraftMatrix/NHLDraftMatrixApp.swift:36-38` (see concerns) |
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
| Coming February 2027 | Owner's instruction. `CLAUDE.md` and `Notes/freemium-plan.md:31` say "~January" for 2027 ranks and launch; the site uses the owner's date |
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

## Footer

| Claim | Backed by |
|---|---|
| Independence disclaimer | Owner-supplied wording; matches the spirit of M-HP:193 and M-HK:234 |
| © 2026 Grout Technology LLC | Legacy pages' footers |
| Apple trademark notice | Apple's App Store marketing guidelines require it wherever the badge is used |

## Signup copy (promises, not app facts)

- "Get the free cheat sheet each draft season" is the owner's wording.
- "We'll email you the free cheat sheet when draft season starts. Your address is used only for DraftMatrix emails." I wrote this one. It is a commitment, so the owner should confirm it before `SIGNUP_LIVE = true`.
- Baseball page: "…and a note when the app is out." Same caveat.

## Dropped or changed, and why

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

- **Grandfathering is not airtight today.** Hockey's date-based fix is in 2.0.1 build 30, which was submitted 2026-10-23 and isn't live yet. Until it is approved, some $1.99 buyers of hockey builds 24+ hit the paywall. Football's date-based cutoff may only be on the local branch `fix/nfl-grandfather-paid` (`CLAUDE.md`, 2026-10-23), so a few football buyers from the minutes it sold at $1.99 on 2.0 may not be covered. The site's line comes from the submitted listings and points people to Restore Purchases.
- **Football listing name.** The live listing may still read "DraftMatrix" until 2.0.1 clears review. The site uses "DraftMatrix: Fantasy Football" as instructed.
