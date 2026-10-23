#!/usr/bin/env python3
"""Draw the brand tile motif as the baseball pages' favicon (committed).

Run from the repo root:  python3 scripts/motif_icon.py
Baseball has no released app icon, so /mlb/ and the dist copies of
baseball.html / baseball-privacy.html use this generic brand pattern instead:
a 3x3 grid of glossy tiles, top row pink / green / blue, lower rows fading, on
the neutral brand background (#1d2430 -> #0b0f14). Same geometry as mark() in
build.mjs. It is not an app icon and must not be presented as one.

Outputs in assets/icons/:
  motif.svg      SVG favicon
  motif-180.png  apple-touch-icon (full square; iOS rounds the corners)
  motif-64.png   PNG favicon (rounded corners, transparent outside)
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icons"

TIERS = ["#ff5e7d", "#3fde9b", "#4eb9ff"]
ROW_OPACITY = [1, 0.5, 0.24]
BG_TOP, BG_BOTTOM = "#1d2430", "#0b0f14"
# In a 64-unit box, matching mark() in build.mjs.
TILE_W, TILE_H, TILE_R = 13, 9, 3


def tiles():
    for row, opacity in enumerate(ROW_OPACITY):
        for col, fill in enumerate(TIERS):
            yield 10 + col * 15.5, 15 + row * 13, fill, opacity


def svg():
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
        '<defs>',
        f'<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{BG_TOP}"/>'
        f'<stop offset="1" stop-color="{BG_BOTTOM}"/></linearGradient>',
        '<linearGradient id="gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".45"/>'
        '<stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient>',
        '</defs>',
        '<rect width="64" height="64" rx="14" fill="url(#bg)"/>',
    ]
    for x, y, fill, opacity in tiles():
        rect = f'x="{x:g}" y="{y:g}" width="{TILE_W}" height="{TILE_H}" rx="{TILE_R}"'
        parts.append(f'<g opacity="{opacity:g}"><rect {rect} fill="{fill}"/><rect {rect} fill="url(#gloss)"/></g>')
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def rgb(hex_color):
    return tuple(int(hex_color[i:i + 2], 16) for i in (1, 3, 5))


def vertical(size, top, bottom, alpha_top=255, alpha_bottom=255):
    w, h = size
    col = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(round(a + (b - a) * t) for a, b in zip(top, bottom))
        col.putpixel((0, y), c + (round(alpha_top + (alpha_bottom - alpha_top) * t),))
    return col.resize((w, h))


def png(size, rounded):
    k = size * 8 / 64  # draw 8x large, then downsample for smooth edges
    s = round(64 * k)
    im = vertical((s, s), rgb(BG_TOP), rgb(BG_BOTTOM))
    if rounded:
        mask = Image.new("L", (s, s), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, s - 1, s - 1), round(14 * k), fill=255)
        im.putalpha(mask)
    w, h, r = round(TILE_W * k), round(TILE_H * k), round(TILE_R * k)
    shape = Image.new("L", (w, h), 0)
    ImageDraw.Draw(shape).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    for x, y, fill, opacity in tiles():
        tile = Image.new("RGBA", (w, h), rgb(fill) + (255,))
        gloss_h = round(h * .55)
        tile.alpha_composite(vertical((w, gloss_h), (255, 255, 255), (255, 255, 255), round(255 * .45), 0))
        tile.putalpha(shape.point(lambda a: round(a * opacity)))
        im.alpha_composite(tile, (round(x * k), round(y * k)))
    return im.resize((size, size), Image.LANCZOS)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "motif.svg").write_text(svg())
    png(180, rounded=False).convert("RGB").save(OUT / "motif-180.png", optimize=True)
    png(64, rounded=True).save(OUT / "motif-64.png", optimize=True)
    print("wrote assets/icons/motif.svg, motif-180.png, motif-64.png")


if __name__ == "__main__":
    main()
