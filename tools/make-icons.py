"""Generuje ikony aplikacji (krzyż maltański na błękitnym tle). Uruchom: python3 tools/make-icons.py"""
import math, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icons')
os.makedirs(ROOT, exist_ok=True)
S = 1024

def make(scale):
    img = Image.new('RGB', (S, S))
    top, bot = (16, 120, 176), (8, 58, 98)
    d = ImageDraw.Draw(img)
    for y in range(S):
        t = y / (S - 1)
        d.line([(0, y), (S, y)], fill=tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    # delikatne "morze" na dole
    for k in range(3):
        y0 = int(S * (0.80 + k * 0.055))
        d.rectangle([0, y0, S, y0 + 10], fill=(255, 255, 255, 40) if False else tuple(min(255, c + 18 + k * 6) for c in bot))
    cx, cy = S / 2, S * 0.46
    R = S * 0.36 * scale
    w, n, g = 0.40 * R, 0.30 * R, 0.035 * R
    arm = [(0, -g), (w, -R), (0, -R + n), (-w, -R)]
    for k in range(4):
        a = k * math.pi / 2
        pts = [(cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)) for x, y in arm]
        d.polygon(pts, fill=(255, 255, 255))
    return img

base = make(1.0)
for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
    base.resize((size, size), Image.LANCZOS).save(os.path.join(ROOT, name), optimize=True)
make(0.78).resize((512, 512), Image.LANCZOS).save(os.path.join(ROOT, 'icon-maskable-512.png'), optimize=True)
print('ok')
