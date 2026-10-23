#!/usr/bin/env python3
"""Compose the 1200x630 Open Graph images in assets/og/ from real app screenshots.

Run from the repo root after scripts/icons.py:  python3 scripts/og.py
Inputs are the real App Store screenshots in ../DraftMatrix/apps (read only) and
the real app icons in assets/icons/ (football, hoops, hockey only). Drawn here:
the sport-tinted background, the brand tile motif (baseball has no app icon, so
its card uses the motif), the tier chips, the text and the drop shadows. No app
UI is drawn.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
APPS = ROOT.parent / "DraftMatrix" / "apps"
OUT = ROOT / "assets" / "og"
W, H = 1200, 630
FONT = "/System/Library/Fonts/HelveticaNeue.ttc"  # index 1 = Bold

# Same values as src/site.css: (top/light, bottom/dark) from each app icon.
BG = {
    "brand": ((0x1D, 0x24, 0x30), (0x0B, 0x0F, 0x14)),
    "nfl": ((0x28, 0x4A, 0x33), (0x07, 0x17, 0x0D)),
    "nba": ((0x2F, 0x1E, 0x13), (0x13, 0x0E, 0x08)),
    "nhl": ((0x23, 0x38, 0x51), (0x07, 0x10, 0x19)),
}
TIERS = [(0xFF, 0x5E, 0x7D), (0x3F, 0xDE, 0x9B), (0x4E, 0xB9, 0xFF)]

CARDS = {
    "default": {
        "bg": "brand",
        "icons": ["nfl", "nba", "nhl"],
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
        "bg": "nfl",
        "icons": ["nfl"],
        "title": "Fantasy Football",
        "lines": ["A tiered draft board", "for your in-person draft"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "DraftBoard/AppStore/2.0.1/nfl-iphone-1.png",
            "DraftBoard/AppStore/2.0.1/nfl-iphone-2.png",
        ],
    },
    "nba": {
        "bg": "nba",
        "icons": ["nba"],
        "title": "Fantasy Hoops",
        "lines": ["A tiered basketball draft", "board, Categories or Points"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "NBADraftMatrix/AppStore/2.0.1/nba-iphone-1.png",
            "NBADraftMatrix/AppStore/2.0.1/nba-iphone-2.png",
        ],
    },
    "nhl": {
        "bg": "nhl",
        "icons": ["nhl"],
        "title": "Fantasy Hockey",
        "lines": ["A tiered hockey draft board", "for your in-person draft"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-1.png",
            "NHLDraftMatrix/AppStore/2.0.1/nhl-iphone-2.png",
        ],
    },
    "mlb": {
        "bg": "brand",
        "icons": [],  # no released baseball icon: the brand motif instead
        "title": "Fantasy Baseball",
        "lines": ["Coming February 2027", "A tiered baseball draft board"],
        "foot": "DraftMatrix · iPhone and iPad",
        "shots": [
            "MLBDraftMatrix/AppStore/2.0/iphone-6.9in-1-board-draft-in-progress.png",
            "MLBDraftMatrix/AppStore/2.0/iphone-6.9in-3-dark-board.png",
        ],
    },
}


def gradient(top, bottom, size=(W, H)):
    w, h = size
    col = Image.new("RGB", (1, h))
    for y in range(h):
        t = y / (h - 1)
        col.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return col.resize((w, h))


def rounded(im, radius):
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def shadow(canvas, box, radius, blur=16, alpha=140, dy=6):
    x0, y0, x1, y1 = box
    pad = blur * 3
    layer = Image.new("RGBA", (x1 - x0 + 2 * pad, y1 - y0 + 2 * pad), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle((pad, pad + dy, pad + x1 - x0, pad + y1 - y0 + dy), radius,
                                            fill=(0, 0, 0, alpha))
    canvas.alpha_composite(layer.filter(ImageFilter.GaussianBlur(blur)), (x0 - pad, y0 - pad))


def motif(size, hi):
    """The brand tile pattern: 3x3 glossy tiles, top row colored, lower rows fading."""
    s = size * 4  # draw large, then downsample for smooth edges
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    tile = rounded(gradient(tuple(min(255, c + 30) for c in hi), hi, (s, s)), round(s * .23))
    im.alpha_composite(tile)
    ImageDraw.Draw(im).rounded_rectangle((0, 0, s - 1, s - 1), round(s * .23), outline=(255, 255, 255, 60), width=4)
    pad_x, pad_y, gap = s * .14, s * .2, s * .07
    tw = (s - 2 * pad_x - 2 * gap) / 3
    th = tw * 2 / 3
    for row, alpha in enumerate((1, .5, .24)):
        for col, color in enumerate(TIERS):
            x = round(pad_x + col * (tw + gap))
            y = round(pad_y + row * (th + gap * 1.15))
            w, h = round(tw), round(th)
            t = Image.new("RGBA", (w, h), color + (255,))
            gloss = gradient((255, 255, 255), color, (w, h // 2))
            t.paste(gloss.convert("RGBA"), (0, 0), Image.new("L", (w, h // 2), 95))
            t = rounded(t, round(h * .38))
            t.putalpha(t.getchannel("A").point(lambda a: round(a * alpha)))
            im.alpha_composite(t, (x, y))
    return im.resize((size, size), Image.LANCZOS)


def chips(canvas, x, y, bold):
    d = ImageDraw.Draw(canvas)
    for i, color in enumerate(TIERS):
        label = f"Tier {i + 1}"
        f = bold(20)
        w = d.textlength(label, font=f) + 28
        d.rounded_rectangle((x, y, x + w, y + 34), 17, fill=color)
        d.text((x + 14, y + 6), label, font=f, fill=(11, 15, 20))
        x += w + 10


def card(name, spec):
    hi, lo = BG[spec["bg"]]
    canvas = gradient(hi, lo).convert("RGBA")

    bold = lambda s: ImageFont.truetype(FONT, s, index=1)
    regular = lambda s: ImageFont.truetype(FONT, s, index=0)
    d = ImageDraw.Draw(canvas)

    size = 104 if len(spec["icons"]) <= 1 else 88
    x = 64
    for sport in spec["icons"] or [None]:
        if sport:
            im = Image.open(ROOT / "assets" / "icons" / f"{sport}-512.png").resize((size, size), Image.LANCZOS)
            im = rounded(im, round(size * .225))
        else:
            im = motif(size, hi)
        shadow(canvas, (x, 64, x + size, 64 + size), round(size * .225), blur=12, alpha=150)
        canvas.alpha_composite(im, (x, 64))
        x += size + 18

    chips(canvas, 64, 196, bold)
    d.text((64, 248), spec["title"], font=bold(60), fill=(255, 255, 255))
    y = 330
    for line in spec["lines"]:
        d.text((64, y), line, font=regular(spec.get("text", 38)), fill=(226, 231, 238))
        y += round(spec.get("text", 38) * 1.37)
    d.text((64, 540), spec["foot"], font=regular(spec.get("text", 38) - 12), fill=(190, 198, 210))

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
        shadow(canvas, (sx, sy, sx + im.width, sy + im.height), 22, blur=18, alpha=170, dy=10)
        canvas.alpha_composite(im, (sx, sy))

    OUT.mkdir(parents=True, exist_ok=True)
    dest = OUT / f"{name}.png"
    canvas.convert("RGB").save(dest, optimize=True)
    print(f"{dest.relative_to(ROOT)}  {dest.stat().st_size // 1024} KB")


if __name__ == "__main__":
    for name, spec in CARDS.items():
        card(name, spec)
