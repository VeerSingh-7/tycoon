#!/usr/bin/env python3
"""Generate PNG app icons (no external deps) for the Tycoon PWA.

Renders a clean WHITE rounded tile with a bold accent-blue upward-trend mark
(a rising line + arrow head), matching the app's light theme. Uses 4x
supersampling for smooth edges. Produces the PNG sizes referenced by
manifest.json. Re-run any time the design changes.
"""
import struct, zlib, math

SS = 4  # supersample factor

WHITE = (255, 255, 255)
BORDER = (230, 233, 239)   # --line
ACCENT = (37, 99, 235)     # --gold (light-theme accent)

# Mark geometry in normalized coords ([-1,1], +y down). A rising polyline plus
# an arrow head at the top-right. Strokes are round-capped (distance to segment).
STROKE_HALF = 0.085
SEGMENTS = [
    ((-0.53, 0.34), (-0.16, -0.03)),   # up
    ((-0.16, -0.03), (0.12, 0.22)),    # dip
    ((0.12, 0.22), (0.53, -0.34)),     # up to peak
    ((0.02, -0.34), (0.53, -0.34)),    # arrow head: horizontal
    ((0.53, -0.34), (0.53, 0.14)),     # arrow head: vertical
]


def lerp(a, b, t):
    return a + (b - a) * t


def blend(dst, src, alpha):
    return tuple(int(round(lerp(dst[i], src[i], alpha))) for i in range(3))


def rounded_rect_inside(u, v, half, radius):
    """Is normalized point (u,v) inside the rounded square (radius in units)?"""
    ax, ay = abs(u), abs(v)
    dx, dy = ax - (half - radius), ay - (half - radius)
    if dx <= 0 or dy <= 0:
        return ax <= half and ay <= half
    return math.hypot(dx, dy) <= radius


def dist_to_segment(px, py, ax, ay, bx, by):
    """Distance from point to line segment AB."""
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    t = max(0.0, min(1.0, t))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def on_mark(u, v):
    for (ax, ay), (bx, by) in SEGMENTS:
        if dist_to_segment(u, v, ax, ay, bx, by) <= STROKE_HALF:
            return True
    return False


def sample(u, v, maskable):
    """Return (r,g,b) for a single (supersampled) point in [-1,1]^2."""
    half = 1.0
    radius = 0.0 if maskable else 0.42
    if not rounded_rect_inside(u, v, half, radius):
        return None  # transparent outside tile

    color = WHITE
    # Subtle border ring on the non-maskable icon so a white tile still reads
    # against a white home screen.
    if not maskable:
        dist_edge = half - max(abs(u), abs(v))
        if dist_edge < 0.02:
            color = BORDER

    if on_mark(u, v):
        color = ACCENT
    return color


def render(size, maskable=False):
    # Content scale: keep the mark inside the safe area for maskable icons.
    scale = 0.66 if maskable else 0.92
    rows = []
    for py in range(size):
        row = bytearray()
        for px in range(size):
            r = g = b = a = 0.0
            for sy in range(SS):
                for sx in range(SS):
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
