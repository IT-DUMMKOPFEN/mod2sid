# generates build/icon.png (1024x1024) – mod2sid app icon in the style of C64 GrooveGoat:
# rounded indigo square, diagonal C64 rainbow stripes, white motif with dark outline.
# Motif: a sample wave (Amiga) turning into a pulse wave (SID), and the name MOD2SID.
import math
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 1024
SS = 2  # supersampling
W = S * SS


def px(v):
    return int(round(v * SS))


bg = Image.new('RGBA', (W, W))
d = ImageDraw.Draw(bg)
for y in range(W):
    t = y / W
    c = (int(64 + (32 - 64) * t), int(50 + (26 - 50) * t), int(166 + (98 - 166) * t), 255)
    d.line([(0, y), (W, y)], fill=c)

# rainbow stripes (C64 colours), rising from lower left to upper right
stripes = [(226, 35, 26), (244, 128, 32), (250, 212, 46), (56, 178, 74), (46, 164, 226)]
ang = math.atan2(250 - 700, 900 - 60)
ux, uy = math.cos(ang), math.sin(ang)          # along the stripe
nx, ny = -uy, ux                               # perpendicular (pointing down-right)
if ny < 0:
    nx, ny = -nx, -ny
sw = 62
ov = Image.new('RGBA', (W, W), (0, 0, 0, 0))
o = ImageDraw.Draw(ov)
cx0, cy0 = 60, 700
for k, col in enumerate(stripes):
    a = k * sw - sw / 2 - 40
    b = a + sw
    p1 = (cx0 + nx * a - ux * 2000, cy0 + ny * a - uy * 2000)
    p2 = (cx0 + nx * a + ux * 2000, cy0 + ny * a + uy * 2000)
    p3 = (cx0 + nx * b + ux * 2000, cy0 + ny * b + uy * 2000)
    p4 = (cx0 + nx * b - ux * 2000, cy0 + ny * b - uy * 2000)
    o.polygon([(px(x), px(y)) for x, y in (p1, p2, p3, p4)], fill=col + (255,))
bg.alpha_composite(ov)

# motif: sine -> pulse wave, white with dark outline and soft shadow
pts = []
x0, x1, yc, amp = 150, 874, 400, 165
for i in range(0, 1201):
    t = i / 1200
    x = x0 + (x1 - x0) * t
    ph = t * 2.5 * 2 * math.pi
    sine = math.sin(ph)
    sq = 1 if math.sin(ph) >= 0 else -1
    m = min(1, max(0, (t - 0.38) / 0.24))
    m = m * m * (3 - 2 * m)
    pts.append((px(x), px(yc - amp * ((1 - m) * sine + m * sq))))
shadow = Image.new('RGBA', (W, W), (0, 0, 0, 0))
ImageDraw.Draw(shadow).line([(x + px(14), y + px(18)) for x, y in pts], fill=(10, 8, 40, 150), width=px(78), joint='curve')
shadow = shadow.filter(ImageFilter.GaussianBlur(px(14)))
bg.alpha_composite(shadow)
mot = ImageDraw.Draw(bg)
mot.line(pts, fill=(24, 18, 70, 255), width=px(72), joint='curve')
mot.line(pts, fill=(255, 255, 255, 255), width=px(44), joint='curve')
for (x, y) in (pts[0], pts[-1]):
    mot.ellipse([x - px(36), y - px(36), x + px(36), y + px(36)], fill=(24, 18, 70, 255))
    mot.ellipse([x - px(22), y - px(22), x + px(22), y + px(22)], fill=(255, 255, 255, 255))

# name
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', px(148))
except Exception:
    font = ImageFont.load_default()
txt = 'MOD2SID'
bb = mot.textbbox((0, 0), txt, font=font, stroke_width=px(14))
tx = (W - (bb[2] - bb[0])) / 2
ty = px(705)
ts = Image.new('RGBA', (W, W), (0, 0, 0, 0))
ImageDraw.Draw(ts).text((tx + px(10), ty + px(14)), txt, font=font, fill=(10, 8, 40, 160), stroke_width=px(14), stroke_fill=(10, 8, 40, 160))
ts = ts.filter(ImageFilter.GaussianBlur(px(10)))
bg.alpha_composite(ts)
mot.text((tx, ty), txt, font=font, fill=(255, 255, 255, 255), stroke_width=px(14), stroke_fill=(24, 18, 70, 255))

# rounded square mask
mask = Image.new('L', (W, W), 0)
ImageDraw.Draw(mask).rounded_rectangle([px(24), px(24), W - px(24), W - px(24)], radius=px(190), fill=255)
img = Image.new('RGBA', (W, W), (0, 0, 0, 0))
img.paste(bg, (0, 0), mask)
img = img.resize((S, S), Image.LANCZOS)
img.save('build/icon.png')
img.resize((256, 256), Image.LANCZOS).save('src/renderer/icon.png')
print('ok')
