"""
Растеризатор SVG у PNG на PIL — рівно для того підмножини примітивів, якими
малюються деталі карт.

Навіщо: скриншоти браузерної панелі в цьому середовищі недоступні, cairo на
Windows не ставиться, а малювати півсотні SVG-деталей наосліп — вірний спосіб
отримати розсунуті шви. Тут достатньо `rect`, `circle`, `line`, `path` і `g`.

Дуги (`A`/`a`) навмисно не підтримані: у деталях їх бути не повинно, круглі
форми робляться кубічними кривими. Якщо трапиться — впаде з явною помилкою.

Запуск:
    python src/front/scripts/rasterize.py <url> <out.png> [--cols N] [--scale N]
"""

from __future__ import annotations

import math
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

from PIL import Image, ImageDraw

SS = 4  # суперсемплінг: PIL не згладжує, тому малюємо крупніше й зменшуємо
SVG_NS = "{http://www.w3.org/2000/svg}"

# Кольори, які приходять як CSS-змінні: растеризатор про теми не знає.
CSS_VARS = {
    "var(--card-art-veil)": (0, 0, 0, 26),
}


# --------------------------------------------------------------------------- #
# Кольори
# --------------------------------------------------------------------------- #

def parse_color(value: str | None, opacity: float) -> tuple[int, int, int, int] | None:
    if value is None or value == "none" or value == "":
        return None
    v = value.strip()
    if v in CSS_VARS:
        r, g, b, a = CSS_VARS[v]
        return (r, g, b, int(a * opacity))
    if v.startswith("var("):
        return None  # невідома змінна — краще не малювати, ніж збрехати кольором
    if v.startswith("#"):
        h = v[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) != 6:
            return None
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), int(255 * opacity))
    m = re.match(r"rgba?\(([^)]+)\)", v)
    if m:
        parts = [p.strip() for p in m.group(1).replace("/", ",").split(",")]
        r, g, b = (int(float(p)) for p in parts[:3])
        a = float(parts[3]) if len(parts) > 3 else 1.0
        return (r, g, b, int(255 * a * opacity))
    return None


# --------------------------------------------------------------------------- #
# Розбір і сплощення шляхів
# --------------------------------------------------------------------------- #

TOKEN = re.compile(r"([MmLlHhVvCcSsQqTtAaZz])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)")


def tokenize(d: str):
    for cmd, num in TOKEN.findall(d):
        yield ("cmd", cmd) if cmd else ("num", float(num))


def bezier3(p0, p1, p2, p3, steps=16):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ))
    return out


def bezier2(p0, p1, p2, steps=12):
    out = []
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        out.append((
            u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
        ))
    return out


def flatten_path(d: str) -> list[tuple[list[tuple[float, float]], bool]]:
    """Повертає список (точки, чи_замкнутий)."""
    toks = list(tokenize(d))
    i = 0
    subpaths: list[tuple[list[tuple[float, float]], bool]] = []
    pts: list[tuple[float, float]] = []
    cur = (0.0, 0.0)
    start = (0.0, 0.0)
    prev_c2 = None
    prev_q1 = None
    cmd = None

    def flush(closed: bool):
        nonlocal pts
        if len(pts) > 1:
            subpaths.append((pts, closed))
        pts = []

    def nums(n: int) -> list[float]:
        nonlocal i
        vals = []
        while len(vals) < n:
            if i >= len(toks) or toks[i][0] != "num":
                raise ValueError("шлях обірвався: очікували %d чисел" % n)
            vals.append(toks[i][1])
            i += 1
        return vals

    while i < len(toks):
        kind, val = toks[i]
        if kind == "cmd":
            cmd = val
            i += 1
            if cmd in "Zz":
                if pts:
                    pts.append(start)
                    flush(True)
                cur = start
                continue
        if cmd is None:
            raise ValueError("шлях починається не з команди")
        rel = cmd.islower()
        c = cmd.upper()

        if c == "M":
            x, y = nums(2)
            if rel:
                x, y = cur[0] + x, cur[1] + y
            flush(False)
            cur = start = (x, y)
            pts = [cur]
            cmd = "l" if rel else "L"  # наступні пари після M — це лінії
        elif c == "L":
            x, y = nums(2)
            if rel:
                x, y = cur[0] + x, cur[1] + y
            cur = (x, y)
            pts.append(cur)
        elif c == "H":
            (x,) = nums(1)
            x = cur[0] + x if rel else x
            cur = (x, cur[1])
            pts.append(cur)
        elif c == "V":
            (y,) = nums(1)
            y = cur[1] + y if rel else y
            cur = (cur[0], y)
            pts.append(cur)
        elif c in ("C", "S"):
            if c == "C":
                x1, y1, x2, y2, x, y = nums(6)
                if rel:
                    x1, y1 = cur[0] + x1, cur[1] + y1
                    x2, y2 = cur[0] + x2, cur[1] + y2
                    x, y = cur[0] + x, cur[1] + y
            else:
                x2, y2, x, y = nums(4)
                if rel:
                    x2, y2 = cur[0] + x2, cur[1] + y2
                    x, y = cur[0] + x, cur[1] + y
                x1, y1 = (2 * cur[0] - prev_c2[0], 2 * cur[1] - prev_c2[1]) if prev_c2 else cur
            pts.extend(bezier3(cur, (x1, y1), (x2, y2), (x, y)))
            prev_c2 = (x2, y2)
            cur = (x, y)
            continue
        elif c in ("Q", "T"):
            if c == "Q":
                x1, y1, x, y = nums(4)
                if rel:
                    x1, y1 = cur[0] + x1, cur[1] + y1
                    x, y = cur[0] + x, cur[1] + y
            else:
                x, y = nums(2)
                if rel:
                    x, y = cur[0] + x, cur[1] + y
                x1, y1 = (2 * cur[0] - prev_q1[0], 2 * cur[1] - prev_q1[1]) if prev_q1 else cur
            pts.extend(bezier2(cur, (x1, y1), (x, y)))
            prev_q1 = (x1, y1)
            cur = (x, y)
            continue
        elif c == "A":
            raise ValueError("дуги (A) не підтримані — використовуй кубічні криві")
        else:
            raise ValueError("невідома команда шляху: %s" % cmd)
        prev_c2 = prev_q1 = None

    flush(False)
    return subpaths


# --------------------------------------------------------------------------- #
# Малювання
# --------------------------------------------------------------------------- #

# --------------------------------------------------------------------------- #
# Афінні перетворення
#
# Композитор арту масштабує фігуру, дзеркалить її і окремо змінює розмір голови,
# тож без підтримки transform растеризатор показував би зовсім не те, що браузер.
# --------------------------------------------------------------------------- #

IDENTITY = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)


def mat_mul(m, n):
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    )


def apply(m, x, y):
    a, b, c, d, e, f = m
    return (a * x + c * y + e, b * x + d * y + f)


def parse_transform(s: str):
    m = IDENTITY
    for name, args in re.findall(r"(translate|scale|matrix|rotate)\s*\(([^)]*)\)", s or ""):
        v = [float(t) for t in re.split(r"[\s,]+", args.strip()) if t]
        if name == "translate":
            m = mat_mul(m, (1, 0, 0, 1, v[0], v[1] if len(v) > 1 else 0))
        elif name == "scale":
            sx = v[0]
            sy = v[1] if len(v) > 1 else sx
            m = mat_mul(m, (sx, 0, 0, sy, 0, 0))
        elif name == "matrix":
            m = mat_mul(m, tuple(v[:6]))
        elif name == "rotate":
            r = math.radians(v[0])
            cs, sn = math.cos(r), math.sin(r)
            m = mat_mul(m, (cs, sn, -sn, cs, 0, 0))
    return m


def mat_scale(m) -> float:
    """Середній масштаб — для товщини ліній і радіусів кіл."""
    a, b, c, d = m[0], m[1], m[2], m[3]
    return (math.hypot(a, b) + math.hypot(c, d)) / 2


def draw_shape(
    draw: ImageDraw.ImageDraw,
    subpaths: list[tuple[list[tuple[float, float]], bool]],
    fill,
    stroke,
    width: float,
    k: float,
    m,
):
    for pts, closed in subpaths:
        sp = [tuple(v * k for v in apply(m, x, y)) for x, y in pts]
        if fill and len(sp) > 2:
            draw.polygon(sp, fill=fill)
        if stroke and width > 0:
            draw.line(sp, fill=stroke, width=max(1, round(width * k * mat_scale(m))), joint="curve")


def render_element(el, draw, k, inherited, m=IDENTITY):
    tag = el.tag.replace(SVG_NS, "")
    op = float(el.get("opacity", 1)) * inherited["opacity"]
    fill_raw = el.get("fill", inherited["fill"])
    stroke_raw = el.get("stroke", inherited["stroke"])
    sw = float(el.get("stroke-width", inherited["stroke-width"]))
    if el.get("transform"):
        m = mat_mul(m, parse_transform(el.get("transform")))

    fill = parse_color(fill_raw, op * float(el.get("fill-opacity", 1)))
    stroke = parse_color(stroke_raw, op * float(el.get("stroke-opacity", 1)))
    lw = max(1, round(sw * k * mat_scale(m)))

    if tag == "g":
        child_ctx = {"fill": fill_raw, "stroke": stroke_raw, "stroke-width": sw, "opacity": op}
        for child in el:
            render_element(child, draw, k, child_ctx, m)
        return

    if tag == "rect":
        x, y = float(el.get("x", 0)), float(el.get("y", 0))
        w, h = float(el.get("width", 0)), float(el.get("height", 0))
        corners = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        pts = [tuple(v * k for v in apply(m, cx, cy)) for cx, cy in corners]
        if fill:
            draw.polygon(pts, fill=fill)
        if stroke and sw > 0:
            draw.line(pts + [pts[0]], fill=stroke, width=lw)
    elif tag in ("circle", "ellipse"):
        cx, cy = float(el.get("cx", 0)), float(el.get("cy", 0))
        if tag == "circle":
            rx = ry = float(el.get("r", 0))
        else:
            rx, ry = float(el.get("rx", 0)), float(el.get("ry", 0))
        tx, ty = apply(m, cx, cy)
        s = mat_scale(m)
        box = [(tx - rx * s) * k, (ty - ry * s) * k, (tx + rx * s) * k, (ty + ry * s) * k]
        draw.ellipse(box, fill=fill, outline=stroke, width=lw if stroke else 0)
    elif tag == "line":
        x1, y1 = float(el.get("x1", 0)), float(el.get("y1", 0))
        x2, y2 = float(el.get("x2", 0)), float(el.get("y2", 0))
        if stroke:
            p1 = tuple(v * k for v in apply(m, x1, y1))
            p2 = tuple(v * k for v in apply(m, x2, y2))
            draw.line([p1, p2], fill=stroke, width=lw)
    elif tag == "path":
        d = el.get("d")
        if d:
            draw_shape(draw, flatten_path(d), fill, stroke, sw if stroke else 0, k, m)


def render_svg(svg_text: str, out_w: int, bg=(203, 198, 187)) -> Image.Image:
    root = ET.fromstring(svg_text)
    vb = [float(v) for v in root.get("viewBox", "0 0 100 140").split()]
    vw, vh = vb[2], vb[3]
    out_h = round(out_w * vh / vw)
    k = out_w * SS / vw

    # Полотно RGB, а Draw у режимі "RGBA": лише так PIL змішує напівпрозорі
    # заливки замість того, щоб затирати ними все під собою. З RGBA-полотном
    # верхня вуаль стирала б увесь малюнок.
    img = Image.new("RGB", (out_w * SS, out_h * SS), bg)
    draw = ImageDraw.Draw(img, "RGBA")
    ctx = {"fill": "#000000", "stroke": "none", "stroke-width": 1.0, "opacity": 1.0}
    for child in root:
        render_element(child, draw, k, ctx)
    return img.resize((out_w, out_h), Image.LANCZOS)


# --------------------------------------------------------------------------- #

def extract_svgs(html: str) -> list[str]:
    """SVG-и з HTML сторінки. Беремо лише холст деталей 100×140."""
    out = []
    for m in re.finditer(r'<svg[^>]*viewBox="0 0 100 140"[\s\S]*?</svg>', html):
        s = m.group(0)
        if 'xmlns' not in s:
            s = s.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
        out.append(s)
    return out


def contact_sheet(images: list[Image.Image], cols: int, pad: int = 6) -> Image.Image:
    if not images:
        raise SystemExit("жодного SVG не знайдено")
    w = max(i.width for i in images)
    h = max(i.height for i in images)
    rows = math.ceil(len(images) / cols)
    sheet = Image.new("RGB", (cols * (w + pad) + pad, rows * (h + pad) + pad), (34, 32, 30))
    for idx, im in enumerate(images):
        x = pad + (idx % cols) * (w + pad)
        y = pad + (idx // cols) * (h + pad)
        sheet.paste(im, (x, y))
    return sheet


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a.split("=")[0]: a.split("=")[1] for a in sys.argv[1:] if "=" in a and a.startswith("--")}
    if len(args) < 2:
        print(__doc__)
        return 2
    url, out_path = args[0], args[1]
    cols = int(flags.get("--cols", 12))
    scale = int(flags.get("--scale", 100))

    src = url if url.startswith("<svg") else urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "replace")
    svgs = extract_svgs(src)
    print("знайдено SVG: %d" % len(svgs))
    images = []
    for i, s in enumerate(svgs):
        try:
            images.append(render_svg(s, scale))
        except Exception as e:  # одна погана деталь не має валити весь лист
            print("  #%d пропущено: %s" % (i, e))
    contact_sheet(images, cols).save(out_path)
    print("збережено %s (%d зображень)" % (out_path, len(images)))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
