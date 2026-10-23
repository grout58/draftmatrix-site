#!/usr/bin/env python3
"""Compose the 1200x630 Open Graph images in assets/og/ from real app screenshots.

Run from the repo root after scripts/screens.py:  python3 scripts/og.py
Inputs are the real App Store screenshots in ../DraftMatrix/apps (read only) and
the real app icons in assets/icons/. The only things drawn here are the
background, the text and the drop shadows. No app UI is drawn.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT.parent / "DraftMatrix" / "apps"
OUT = ROOT / "assets" / "og"
W, H = 1200, 630
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"  # index 1 = Bold

CARDS = {
    "default": {
        "bg": ((17, 24, 39), (6, 9, 16)),
        "icon": "nfl",
        "title": "DraftMatrix",
        "lines": ["Tiered draft boards for", "in-person fantasy drafts"],
        "foot": "Football · Hoops · Hockey · Baseball",
        "text": 34,
        "shots": [
            "DraftBoard/AppStore/2.0.1/nfl-iphone-2.png",
            "NBADraftMatrix/AppStore/2.0.1/nba-iphone-2.png",
            "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-2.png",
        ],
    },
    "nfl": {
        "bg": ((16, 44, 30), (5, 16, 11)),
        "icon": "nfl",
        "title": "Fantasy Football",
        "lines": ["A tiered draft board", "for your in-person draft"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "DraftBoard/AppStore/2.0.1/nfl-iphone-1.png",
            "DraftBoard/AppStore/2.0.1/nfl-iphone-2.png",
        ],
    },
    "nba": {
        "bg": ((52, 33, 22), (18, 11, 7)),
        "icon": "nba",
        "title": "Fantasy Hoops",
        "lines": ["A tiered basketball draft", "board, Categories or Points"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "NBADraftMatrix/AppStore/2.0.1/nba-iphone-1.png",
            "NBADraftMatrix/AppStore/2.0.1/nba-iphone-2.png",
        ],
    },
    "nhl": {
        "bg": ((18, 36, 62), (6, 12, 22)),
        "icon": "nhl",
        "title": "Fantasy Hockey",
        "lines": ["A tiered hockey draft board", "for your in-person draft"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-1.png",
            "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-2.png",
        ],
    },
    "mlb": {
        "bg": ((20, 40, 28), (6, 14, 9)),
        "icon": "mlb",
        "title": "Fantasy Baseball",
        "lines": ["Coming February 2027", "A tiered baseball draft board"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "MLBDraftMatrix/AppStore/2.0/iphone-6.9in-1-board-draft-in-progress.png",
            "MLBDraftMatrix/AppStore/2.0/iphone-6.9in-3-dark-board.png",
        ],
    },
}


def gradient(top, bottom):
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / (H - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        for x in range(W):
            px[x, y] = c
    return img


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def paste_with_shadow(canvas, im, xy):
    shadow = Image.new("RGBA", (im.width + 60, im.height + 60), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((30, 36, im.width + 30, im.height + 30), 28, fill=(0, 0, 0, 140))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    canvas.alpha_composite(shadow, (xy[0] - 30, xy[1] - 30))
    canvas.alpha_composite(im, xy)


def card(name, spec):
    canvas = gradient(*spec["bg"]).convert("RGBA")
    bold = lambda s: ImageFont.truetype(FONT, s, index=1)
    regular = lambda s: ImageFont.truetype(FONT, s, index=0)
    d = ImageDraw.Draw(canvas)

    icon = Image.open(ROOT / "assets" / "icons" / f"{spec['icon']}-256.png").resize((112, 112), Image.LANCZOS)
    canvas.alpha_composite(rounded(icon, 26), (64, 70))

    d.text((64, 222), spec["title"], font=bold(60), fill=(255, 255, 255))
    y = 310
    for line in spec["lines"]:
        d.text((64, y), line, font=regular(spec.get("text", 38)), fill=(220, 226, 235))
        y += round(spec.get("text", 38) * 1.37)
    d.text((64, 540), spec["foot"], font=regular(spec.get("text", 38) - 12), fill=(170, 180, 195))

    shots = spec["shots"]
    shot_h = 560 if len(shots) == 2 else 440
    x = W - 40
    imgs = []
    for rel in reversed(shots):
        im = Image.open(APPS / rel).convert("RGB")
        im = im.resize((round(im.width * shot_h / im.height), shot_h), Image.LANCZOS)
        x -= im.width
        imgs.append((rounded(im, 22), x))
        x -= 18
    for i, (im, sx) in enumerate(reversed(imgs)):
        sy = (H - shot_h) // 2 + (0 if len(shots) == 2 else (24 if i != 1 else -10))
        paste_with_shadow(canvas, im, (sx, sy))

    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"{name}.png"
    canvas.convert("RGB").save(dest, optimize=True)
    print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for name, spec in CARDS.items():
        card(name, spec)
