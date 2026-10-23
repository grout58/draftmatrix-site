#!/usr/bin/env python3
"""Resize the real app icons into assets/icons/ (committed).

Run from the repo root:  python3 scripts/icons.py
Inputs are the 1024px App Store icons in .work/icon-<sport>-1024.png (not
committed; copy them there from the app repos first). Only football, hoops and
hockey have a released icon. Baseball has none, so there is no mlb icon: the
site uses the CSS/SVG tile motif for baseball instead.

Outputs per sport:
  <sport>-512/256/128.webp + .png  artwork (cards, sport heroes, OG images)
  <sport>-180.png                  apple-touch-icon
  <sport>-64.png                   favicon
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".work"
OUT = ROOT / "assets" / "icons"
SPORTS = ["nfl", "nba", "nhl"]


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for sport in SPORTS:
        # The .work files are JPEG data with a .png name; PIL reads either.
        src = Image.open(SRC / f"icon-{sport}-1024.png").convert("RGB")
        for size in (512, 256, 128):
            im = src.resize((size, size), Image.LANCZOS)
            im.save(OUT / f"{sport}-{size}.png", optimize=True)
            im.save(OUT / f"{sport}-{size}.webp", "WEBP", quality=86, method=6)
        for size in (180, 64):
            src.resize((size, size), Image.LANCZOS).save(OUT / f"{sport}-{size}.png", optimize=True)
    for f in sorted(OUT.iterdir()):
        print(f"{f.relative_to(ROOT)}  {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
