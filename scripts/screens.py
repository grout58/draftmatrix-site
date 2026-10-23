#!/usr/bin/env python3
"""Copy real App Store screenshots (assets/screens/) from the app repos at web size.
App icons come from scripts/icons.py.

Run from the repo root:  python3 scripts/screens.py
Reads (never writes) ../DraftMatrix/apps/*/AppStore/. Output is committed, so the
site build does not need the app repos.

Football iPad shots are skipped on purpose: every one shows a defense listed by
its full team name in the sidebar, and the family rule keeps team brands out of
anything user-visible. Football iPhone shot 4 shows the ranking publishers' site
names in the Rankings panel, so it is skipped too.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT.parent / "DraftMatrix" / "apps"
OUT = ROOT / "assets" / "screens"
MAX_H = 900

# output name -> source path (relative to ../DraftMatrix/apps)
SHOTS = {
    "nfl-iphone-1": "DraftBoard/AppStore/2.0.1/nfl-iphone-1.png",
    "nfl-iphone-2": "DraftBoard/AppStore/2.0.1/nfl-iphone-2.png",
    "nfl-iphone-5": "DraftBoard/AppStore/2.0.1/nfl-iphone-5.png",
    "nfl-iphone-6": "DraftBoard/AppStore/2.0.1/nfl-iphone-6.png",
    "nfl-iphone-7": "DraftBoard/AppStore/2.0.1/nfl-iphone-7.png",
    "nba-iphone-1": "NBADraftMatrix/AppStore/2.0.1/nba-iphone-1.png",
    "nba-iphone-2": "NBADraftMatrix/AppStore/2.0.1/nba-iphone-2.png",
    "nba-iphone-3": "NBADraftMatrix/AppStore/2.0.1/nba-iphone-3.png",
    "nba-iphone-4": "NBADraftMatrix/AppStore/2.0.1/nba-iphone-4.png",
    "nba-iphone-5": "NBADraftMatrix/AppStore/2.0.1/nba-iphone-5.png",
    "nba-iphone-7": "NBADraftMatrix/AppStore/2.0.1/nba-iphone-7.png",
    "nba-ipad-1": "NBADraftMatrix/AppStore/2.0.1/nba-ipad-1.png",
    "nhl-iphone-1": "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-1.png",
    "nhl-iphone-2": "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-2.png",
    "nhl-iphone-3": "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-3.png",
    "nhl-iphone-4": "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-4.png",
    "nhl-iphone-5": "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-5.png",
    "nhl-iphone-7": "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-7.png",
    "nhl-ipad-1": "NHLDraftMatrix/AppStore/2.0.1/nhl-ipad-1.png",
    "mlb-iphone-1": "MLBDraftMatrix/AppStore/2.0/iphone-6.9in-1-board-draft-in-progress.png",
    "mlb-iphone-2": "MLBDraftMatrix/AppStore/2.0/iphone-6.9in-2-overall-list.png",
    "mlb-iphone-3": "MLBDraftMatrix/AppStore/2.0/iphone-6.9in-3-dark-board.png",
    "mlb-ipad-1": "MLBDraftMatrix/AppStore/2.0/ipad-13in-1-board-draft-in-progress.png",
}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, rel in SHOTS.items():
        im = Image.open(APPS / rel).convert("RGB")
        scale = MAX_H / im.height
        im = im.resize((round(im.width * scale), MAX_H), Image.LANCZOS)
        dest = OUT / f"{name}.webp"
        im.save(dest, "WEBP", quality=80, method=6)
        print(f"{dest.relative_to(ROOT)}  {im.width}x{im.height}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
