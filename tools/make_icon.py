# generates build/icon.png (1024x1024) – mod2sid app icon
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
S = 1024
img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
bg = Image.new('RGBA', (S, S))
d = ImageDraw.Draw(bg)
for y in range(S):  # vertical gradient C64 blue -> deep night
    t = y / S
    c = (int(53 + (20 - 53) * t), int(40 + (16 - 40) * t), int(121 + (48 - 121) * t), 255)
    d.line([(0, y), (S, y)], fill=c)
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([40, 40, S - 40, S - 40], radius=200, fill=255)
img.paste(bg, (0, 0), mask)
glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
g = ImageDraw.Draw(glow)
# waveform: sine (Amiga sample) morphing into a pulse wave (SID)
pts = []
x0, x1, yc, amp = 150, 874, 470, 150
for i in range(0, 1001):
    t = i / 1000
    x = x0 + (x1 - x0) * t
    ph = t * 3.0 * 2 * math.pi
    sine = math.sin(ph)
    sq = 1 if math.sin(ph) >= 0 else -1
    m = min(1, max(0, (t - 0.35) / 0.3))
    pts.append((x, yc - amp * ((1 - m) * sine + m * sq)))
for w, col in ((46, (255, 140, 40, 90)), (22, (255, 170, 60, 255))):
    g.line(pts[:520], fill=col, width=w, joint='curve')
for w, col in ((46, (90, 220, 255, 90)), (22, (120, 230, 255, 255))):
    g.line(pts[480:], fill=col, width=w, joint='curve')
glow = glow.filter(ImageFilter.GaussianBlur(2))
img.alpha_composite(glow)
dr = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 150)
except Exception:
    font = ImageFont.load_default()
txt = 'MOD2SID'
bb = dr.textbbox((0, 0), txt, font=font)
dr.text(((S - (bb[2] - bb[0])) / 2, 720), txt, font=font, fill=(240, 240, 255, 255))
img.save('build/icon.png')
img.resize((256, 256), Image.LANCZOS).save('src/renderer/icon.png')
print('ok')
