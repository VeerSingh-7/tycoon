#!/usr/bin/env python3
"""Generate PNG app icons (no external deps) for the Tycoon PWA.

Renders a dark rounded tile with a gold ring and a bold gold "$" glyph,
using 4x supersampling for smooth edges. Produces the PNG sizes referenced
by manifest.json. Re-run any time the design changes.
"""
import struct, zlib, math

SS = 4  # supersample factor


def lerp(a, b, t):
    return a + (b - a) * t


def blend(dst, src, alpha):
    return tuple(int(round(lerp(dst[i], src[i], alpha))) for i in range(3))


def rounded_rect_inside(u, v, half, radius):
    """SDF-ish test: is normalized point (u,v) in [-1,1] inside rounded square?"""
    ax, ay = abs(u), abs(v)
    dx, dy = ax - (half - radius), ay - (half - radius)
    if dx <= 0 or dy <= 0:
        return ax <= half and ay <= half
    return math.hypot(dx, dy) <= radius


def in_arc(u, v, cx, cy, r, thick, gap_center_deg, gap_half_deg):
    """Point on an annulus arc (a 'c' shape) with a gap centered at an angle."""
    du, dv = u - cx, v - cy
    d = math.hypot(du, dv)
    if abs(d - r) > thick:
        return False
    ang = math.degrees(math.atan2(dv, du))  # screen space: +y down
    # normalize difference to [-180,180]
    diff = (ang - gap_center_deg + 180) % 360 - 180
    return abs(diff) > gap_half_deg  # outside the gap = part of the arc


def dollar_mask(u, v):
    """Gold coverage for the '$' glyph in normalized coords (origin center)."""
    # Vertical bar through the middle, extending past the S top & bottom.
    if abs(u) < 0.055 and abs(v) < 0.66:
        return True
    # Top bowl: 'c' opening toward lower-right.
    if in_arc(u, v, 0.0, -0.22, 0.22, 0.075, gap_center_deg=45, gap_half_deg=68):
        return True
    # Bottom bowl: reversed 'c' opening toward upper-left.
    if in_arc(u, v, 0.0, 0.22, 0.22, 0.075, gap_center_deg=-135, gap_half_deg=68):
        return True
    return False


def sample(u, v, maskable):
    """Return (r,g,b) for a single (supersampled) point in [-1,1]^2."""
    half = 1.0
    radius = 0.0 if maskable else 0.42
    if not rounded_rect_inside(u, v, half, radius):
        return None  # transparent outside tile

    # Background vertical gradient.
    t = (v + 1) / 2
    bg = (int(lerp(26, 13, t)), int(lerp(31, 15, t)), int(lerp(43, 20, t)))
    color = bg

    gold_t = (v + 0.66) / 1.32
    gold_t = max(0.0, min(1.0, gold_t))
    gold = (int(lerp(247, 212, gold_t)), int(lerp(217, 160, gold_t)), int(lerp(121, 23, gold_t)))

    # Decorative ring (subtle).
    dist = math.hypot(u, v)
    if abs(dist - 0.72) < 0.028:
        color = blend(color, gold, 0.4)

    # The dollar glyph (bright).
    if dollar_mask(u, v):
        color = gold
    return color


def render(size, maskable=False):
    # Content scale: keep glyph inside safe area for maskable icons.
    scale = 0.72 if maskable else 0.92
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SS):
                for sx in range(SS):
                    # pixel center in [-1,1], then scale content
                    u = ((px + (sx + 0.5) / SS) / size * 2 - 1) / scale
                    v = ((py + (sy + 0.5) / SS) / size * 2 - 1) / scale
                    c = sample(u, v, maskable)
                    if c is not None:
                        r += c[0]; g += c[1]; b += c[2]; a += 255
            n = SS * SS
            row += bytes((int(r / n), int(g / n), int(b / n), int(a / n)))
        rows.append(bytes(row))
    return rows


def write_png(path, size, rows):
    raw = bytearray()
    for row in rows:
        raw.append(0)  # filter type 0
        raw += row

    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        return c + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(bytes(raw), 9)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))
    print('wrote', path)


if __name__ == '__main__':
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    for size, name, mask in [
        (192, 'icon-192.png', False),
        (512, 'icon-512.png', False),
        (512, 'icon-512-maskable.png', True),
    ]:
        write_png(os.path.join(here, name), size, render(size, mask))
