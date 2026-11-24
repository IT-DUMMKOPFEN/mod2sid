#!/usr/bin/env python3
"""Synthetic training data for the mod2sid sample classifier.
Generates Amiga-style 8-bit samples for 19 instrument classes plus plausible
usage statistics (how a tracker musician would play that sample).
Output: dataset.bin (int8 concatenated) + dataset.json (index)."""
import json, sys, numpy as np
from scipy.signal import lfilter

rng = np.random.default_rng(1234)
CLASSES = ['kick', 'snare', 'hihat', 'cymbal', 'tom', 'perc', 'bass', 'lead', 'pad', 'strings', 'brass',
           'wood', 'guitar', 'keys', 'bell', 'choir', 'chord', 'fx', 'speech', 'beat']
PAULA = 3546895

def U(a, b): return rng.uniform(a, b)
def env_exp(n, R, t): return np.exp(-np.arange(n) / (R * max(t, 1e-3)))
def adsr(n, R, a, d, s):
    t = np.arange(n) / R
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-3)))
    return e
def noise(n): return rng.uniform(-1, 1, n)
def lp(x, a):
    if np.ndim(a) == 0: return lfilter([a], [1, -(1 - a)], x)
    y = np.empty_like(x); acc = 0.0
    for i, v in enumerate(x): acc += a[i] * (v - acc); y[i] = acc
    return y
def hp(x, a): return x - lp(x, a)
def osc(kind, f, n, R, pw=0.5, phase=None):
    ph = np.cumsum(np.broadcast_to(f, (n,)) / R) if phase is None else phase
    ph = ph % 1.0
    if kind == 'saw': return 2 * ph - 1
    if kind == 'sq': return np.where(ph < pw, 1.0, -1.0)
    if kind == 'tri': return 4 * np.abs(ph - 0.5) - 1
    return np.sin(2 * np.pi * ph)
def additive(f, n, R, amps, vib=0, vibr=5, inharm=0.0, decays=None):
    t = np.arange(n) / R
    fm = f * (1 + vib * np.sin(2 * np.pi * vibr * t))
    ph = np.cumsum(fm / R)
    out = np.zeros(n)
    for k, a in enumerate(amps, 1):
        r = k * (1 + inharm * k * k)
        if r * f > R / 2: break
        comp = a * np.sin(2 * np.pi * r * ph + rng.uniform(0, 6.28))
        if decays is not None: comp *= np.exp(-t / max(1e-3, decays / (1 + 0.3 * k)))
        out += comp
    return out
def formant(x, R, freqs, bws):
    out = np.zeros_like(x)
    for f, bw in zip(freqs, bws):
        r = np.exp(-np.pi * bw / R); th = 2 * np.pi * f / R
        a1, a2 = -2 * r * np.cos(th), r * r
        y = lfilter([1.0], [1.0, a1, a2], x)
        out += y / (np.abs(y).max() + 1e-9)
    return out

def gen(cls):
    R = int(U(7000, 22000))
    loop = False; loop_frac = 0.0
    use = dict(distinct=1, range=0, dur=4, density=0.1)
    f0 = 0.0
    if cls == 'kick':
        n = int(R * U(0.12, 0.6)); t = np.arange(n) / R
        f_hi, f_lo, sw = U(90, 220), U(35, 70), U(0.01, 0.06)
        f = f_lo + (f_hi - f_lo) * np.exp(-t / sw)
        x = np.sin(2 * np.pi * np.cumsum(f) / R) * env_exp(n, R, U(0.06, 0.35))
        if rng.random() < 0.6: x += noise(n) * env_exp(n, R, U(0.003, 0.012)) * U(0.2, 0.8)
        if rng.random() < 0.3: x = np.tanh(x * U(1.5, 4))
        use = dict(distinct=rng.integers(1, 3), range=U(0, 2), dur=rng.choice([2, 4, 4, 8]), density=U(0.05, 0.35))
    elif cls == 'snare':
        n = int(R * U(0.1, 0.45)); t = np.arange(n) / R
        tone = np.sin(2 * np.pi * np.cumsum(U(150, 260) * (1 + 0.5 * np.exp(-t / 0.02))) / R) * env_exp(n, R, U(0.03, 0.1))
        nz = hp(noise(n), U(0.2, 0.6)) * env_exp(n, R, U(0.06, 0.25))
        x = tone * U(0.3, 1) + nz * U(0.6, 1.2)
        use = dict(distinct=rng.integers(1, 3), range=U(0, 3), dur=rng.choice([2, 4, 8]), density=U(0.03, 0.2))
    elif cls == 'hihat':
        opn = rng.random() < 0.35
        n = int(R * (U(0.25, 0.7) if opn else U(0.03, 0.15)))
        base = noise(n) if rng.random() < 0.6 else sum(osc('sq', U(300, 900) * k, n, R) for k in (1, 1.47, 1.65, 2.13, 2.7))
        x = hp(base, U(0.5, 0.9)) * env_exp(n, R, (U(0.08, 0.3) if opn else U(0.01, 0.05)))
        use = dict(distinct=rng.integers(1, 3), range=U(0, 2), dur=rng.choice([1, 2, 2, 4]), density=U(0.1, 0.5))
    elif cls == 'cymbal':
        n = int(R * U(0.8, 3.0))
        base = noise(n) + 0.5 * sum(osc('sq', U(250, 700) * k, n, R) for k in (1, 1.37, 1.83, 2.5))
        x = hp(base, U(0.4, 0.85)) * adsr(n, R, U(0.001, 0.01), U(0.4, 1.5), 0) * (1 + 0.2 * noise(n))
        use = dict(distinct=rng.integers(1, 3), range=U(0, 3), dur=rng.choice([8, 16, 32]), density=U(0.005, 0.05))
    elif cls == 'tom':
        n = int(R * U(0.2, 0.8)); t = np.arange(n) / R
        f0 = U(70, 260); f = f0 * (1 + U(0.2, 0.8) * np.exp(-t / U(0.03, 0.12)))
        x = np.sin(2 * np.pi * np.cumsum(f) / R) * env_exp(n, R, U(0.1, 0.4)) + noise(n) * env_exp(n, R, 0.01) * 0.3
        use = dict(distinct=rng.integers(1, 6), range=U(0, 9), dur=rng.choice([1, 2, 4]), density=U(0.005, 0.06))
    elif cls == 'perc':
        k = rng.integers(0, 5); n = int(R * U(0.05, 0.3))
        if k == 0:  # clap
            e = np.zeros(n)
            for b in range(int(U(2, 5))):
                o = int(b * R * U(0.008, 0.015))
                if o < n: e[o:] += env_exp(n - o, R, U(0.005, 0.02 if b < 3 else 0.1))
            x = formant(noise(n), R, [U(900, 1600)], [U(400, 900)]) * e
        elif k == 1:  # rim / woodblock
            f0 = U(400, 1500); x = np.sin(2 * np.pi * f0 * np.arange(n) / R) * env_exp(n, R, U(0.01, 0.05)) + noise(n) * env_exp(n, R, 0.003)
        elif k == 2:  # cowbell
            x = (osc('sq', 540 * U(0.8, 1.3), n, R) + osc('sq', 800 * U(0.8, 1.3), n, R)) * env_exp(n, R, U(0.04, 0.15))
            x = formant(x, R, [U(700, 1400)], [600])
        elif k == 3:  # shaker
            x = hp(noise(n), 0.7) * adsr(n, R, U(0.01, 0.04), U(0.02, 0.08), 0)
        else:  # blip / zap percussion
            t = np.arange(n) / R; x = osc('sq', U(300, 1500) * np.exp(-t / U(0.01, 0.05)), n, R) * env_exp(n, R, U(0.02, 0.08))
        use = dict(distinct=rng.integers(1, 4), range=U(0, 5), dur=rng.choice([1, 2, 4, 8]), density=U(0.01, 0.2))
    elif cls == 'bass':
        f0 = U(30, 130); n = int(R * U(0.2, 1.5)); kind = rng.choice(['saw', 'sq', 'sin', 'tri', 'add'])
        if kind == 'add': x = additive(f0, n, R, [1, 0.6, 0.4, 0.2, 0.1, 0.05])
        else: x = osc(kind, f0, n, R, pw=U(0.2, 0.5))
        x = lp(x, U(0.05, 0.5))
        sus = rng.random() < 0.5
        x *= adsr(n, R, U(0.001, 0.02), U(0.05, 0.6), U(0.3, 0.9) if sus else 0)
        if rng.random() < 0.3: x += noise(n) * env_exp(n, R, 0.005) * 0.4  # slap
        loop = sus and rng.random() < 0.7
        use = dict(distinct=rng.integers(2, 16), range=U(3, 24), dur=rng.choice([1, 2, 2, 4, 8]), density=U(0.05, 0.4))
    elif cls == 'lead':
        f0 = U(150, 900); n = int(R * U(0.3, 1.5)); kind = rng.choice(['saw', 'sq', 'tri', 'pw'])
        t = np.arange(n) / R; fv = f0 * (1 + U(0, 0.01) * np.sin(2 * np.pi * U(4, 7) * t))
        if kind == 'pw': x = osc('sq', fv, n, R, pw=0.3 + 0.2 * np.sin(2 * np.pi * U(0.5, 3) * t))
        else: x = osc(kind, fv, n, R, pw=U(0.15, 0.5))
        x = lp(x, U(0.2, 0.9)) * adsr(n, R, U(0.001, 0.05), U(0.1, 0.8), U(0.5, 1))
        loop = rng.random() < 0.8
        use = dict(distinct=rng.integers(5, 24), range=U(7, 30), dur=rng.choice([1, 2, 4, 8]), density=U(0.05, 0.4))
    elif cls in ('pad', 'strings'):
        f0 = U(100, 600); n = int(R * U(0.6, 2.5)); t = np.arange(n) / R
        voices = rng.integers(2, 6); x = np.zeros(n)
        for v in range(voices):
            fv = f0 * (1 + U(-0.012, 0.012)) * (1 + 0.004 * np.sin(2 * np.pi * U(4, 6) * t + U(0, 6)))
            x += osc('saw' if cls == 'strings' or rng.random() < 0.5 else 'sq', fv, n, R, pw=U(0.2, 0.5))
        x = lp(x, U(0.03, 0.2) if cls == 'pad' else U(0.15, 0.5))
        x *= adsr(n, R, U(0.15, 1.2) if cls == 'pad' else U(0.05, 0.4), U(0.5, 2), U(0.6, 1))
        loop = True
        use = dict(distinct=rng.integers(3, 14), range=U(5, 20), dur=rng.choice([4, 8, 16, 32]), density=U(0.01, 0.12))
    elif cls == 'brass':
        f0 = U(90, 600); n = int(R * U(0.4, 1.5)); t = np.arange(n) / R
        x = osc('saw', f0 * (1 + 0.006 * np.sin(2 * np.pi * 5 * t) * (t > 0.2)), n, R)
        bright = 0.05 + 0.6 * (1 - np.exp(-t / U(0.03, 0.15)))
        y = np.empty(n); acc = 0.0
        for i in range(n): acc += bright[i] * (x[i] - acc); y[i] = acc
        x = y * adsr(n, R, U(0.02, 0.1), U(0.2, 0.8), U(0.6, 0.95)); loop = rng.random() < 0.7
        use = dict(distinct=rng.integers(3, 16), range=U(5, 20), dur=rng.choice([2, 4, 8]), density=U(0.03, 0.2))
    elif cls == 'wood':
        f0 = U(200, 1200); n = int(R * U(0.4, 1.5)); k = rng.integers(0, 3); t = np.arange(n) / R
        if k == 0:  # flute
            x = additive(f0, n, R, [1, 0.15, 0.05], vib=U(0.002, 0.008), vibr=U(4, 6)) + lp(noise(n), 0.3) * U(0.05, 0.2)
        elif k == 1:  # clarinet
            x = additive(f0 * 0.5, n, R, [1, 0, 0.6, 0, 0.35, 0, 0.2, 0, 0.1], vib=0.003)
        else:  # sax / oboe
            x = formant(osc('saw', f0 * 0.6 * (1 + 0.004 * np.sin(2 * np.pi * 5 * t)), n, R), R, [U(500, 900), U(1200, 2500)], [200, 300])
        x *= adsr(n, R, U(0.03, 0.15), U(0.3, 1), U(0.6, 0.95)); loop = rng.random() < 0.8
        use = dict(distinct=rng.integers(4, 20), range=U(5, 24), dur=rng.choice([2, 4, 8]), density=U(0.03, 0.3))
    elif cls == 'guitar':
        f0 = U(80, 500); n = int(R * U(0.4, 2.0))
        if rng.random() < 0.6:  # Karplus-Strong
            L = max(2, int(R / f0)); buf = noise(L); x = np.empty(n); damp = U(0.990, 0.999)
            for i in range(n):
                x[i] = buf[i % L]; buf[i % L] = damp * 0.5 * (buf[i % L] + buf[(i + 1) % L])
        else:  # distorted
            x = np.tanh(U(3, 10) * (osc('saw', f0, n, R) + 0.5 * osc('saw', f0 * 1.498, n, R)))
            x = lp(x, U(0.2, 0.5)) * adsr(n, R, 0.005, U(0.3, 1.5), U(0.4, 0.8))
            loop = rng.random() < 0.5
        use = dict(distinct=rng.integers(3, 16), range=U(5, 20), dur=rng.choice([1, 2, 4, 8]), density=U(0.03, 0.3))
    elif cls == 'keys':
        f0 = U(100, 900); n = int(R * U(0.4, 2.0)); k = rng.integers(0, 3)
        if k == 0:  # piano
            x = additive(f0, n, R, [1, 0.5, 0.3, 0.2, 0.15, 0.1, 0.06], inharm=0.0004, decays=U(0.4, 1.5)) + noise(n) * env_exp(n, R, 0.004) * 0.3
        elif k == 1:  # organ
            x = additive(f0, n, R, [1, 0.8, 0.5, 0.6, 0, 0.3, 0, 0.3]) * adsr(n, R, 0.005, 0.1, 1.0); loop = True
        else:  # e-piano
            x = additive(f0, n, R, [1, 0.1, 0.05], decays=U(0.5, 1.5)) + additive(f0 * 7, n, R, [0.3], decays=0.05)
        use = dict(distinct=rng.integers(4, 24), range=U(7, 30), dur=rng.choice([2, 4, 8]), density=U(0.03, 0.3))
    elif cls == 'bell':
        f0 = U(300, 1500); n = int(R * U(0.3, 2.5)); t = np.arange(n) / R; x = np.zeros(n)
        long = rng.random() < 0.6
        for r, a in ((1, 1), (2.76, 0.6), (5.4, 0.4), (8.93, 0.25), (13.3, 0.1)):
            if r * f0 < R / 2: x += a * np.sin(2 * np.pi * r * f0 * t) * np.exp(-t / ((U(0.6, 1.5) if long else U(0.05, 0.25)) / r ** 0.5))
        use = dict(distinct=rng.integers(3, 16), range=U(5, 24), dur=rng.choice([1, 2, 4, 8]), density=U(0.02, 0.2))
    elif cls == 'choir':
        f0 = U(110, 500); n = int(R * U(0.6, 2.0)); t = np.arange(n) / R
        src = sum(osc('saw', f0 * (1 + U(-0.01, 0.01)) * (1 + 0.005 * np.sin(2 * np.pi * 5 * t + U(0, 6))), n, R) for _ in range(3))
        vowel = [(800, 1150), (400, 1600), (350, 2000), (450, 800), (325, 700)][rng.integers(0, 5)]
        x = formant(src, R, list(vowel), [80, 100]) * adsr(n, R, U(0.1, 0.5), 1, U(0.7, 1)); loop = True
        use = dict(distinct=rng.integers(2, 10), range=U(3, 14), dur=rng.choice([4, 8, 16]), density=U(0.01, 0.08))
    elif cls == 'chord':
        f0 = U(100, 400); n = int(R * U(0.5, 2.0))
        iv = [[0, 4, 7], [0, 3, 7], [0, 4, 7, 11], [0, 3, 7, 10], [0, 5, 7], [0, 4, 7, 10], [0, 3, 7, 12]][rng.integers(0, 7)]
        kind = rng.choice(['saw', 'sq', 'add', 'tri'])
        x = np.zeros(n)
        for i in iv:
            f = f0 * 2 ** (i / 12)
            x += additive(f, n, R, [1, 0.5, 0.3, 0.2]) if kind == 'add' else osc(kind, f, n, R)
        x = lp(x, U(0.1, 0.6))
        sus = rng.random() < 0.5
        x *= adsr(n, R, U(0.002, 0.3), U(0.2, 1.5), U(0.4, 0.9) if sus else 0); loop = sus and rng.random() < 0.7
        use = dict(distinct=rng.integers(1, 8), range=U(0, 12), dur=rng.choice([2, 4, 8, 16]), density=U(0.02, 0.15))
    elif cls == 'fx':
        n = int(R * U(0.3, 2.5)); t = np.arange(n) / R; k = rng.integers(0, 4)
        if k == 0: x = osc(rng.choice(['saw', 'sq']), U(100, 2000) * np.exp(t * U(-3, 3)), n, R)
        elif k == 1: x = lp(noise(n), 0.02 + 0.5 * (t / t[-1] if rng.random() < .5 else 1 - t / t[-1]))
        elif k == 2: x = np.sin(2 * np.pi * np.cumsum(U(200, 800) * (1 + 0.5 * np.sin(2 * np.pi * U(5, 30) * t))) / R)
        else: x = noise(n) * (0.5 + 0.5 * np.sin(2 * np.pi * U(3, 20) * t)) + osc('sq', U(50, 200), n, R) * 0.3
        x *= adsr(n, R, U(0.001, 0.8), U(0.2, 2), U(0, 0.8))
        use = dict(distinct=rng.integers(1, 4), range=U(0, 5), dur=rng.choice([4, 8, 16, 32]), density=U(0.002, 0.03))
    elif cls == 'beat':
        bpm = U(80, 175); step = 60.0 / bpm / 4; nsteps = int(rng.choice([8, 16, 16, 32]))
        n = int(R * step * nsteps); x = np.zeros(n)
        kit = {}
        for d in ('kick', 'snare', 'hihat'):
            q, m = gen(d); h = q.astype(float) / 127
            idx = (np.arange(int(len(h) * R / m['rate'])) * m['rate'] / R).astype(int)
            kit[d] = h[np.clip(idx, 0, len(h) - 1)]
        pat = {'kick': [i for i in range(nsteps) if i % 8 == 0 or rng.random() < 0.12],
               'snare': [i for i in range(nsteps) if i % 8 == 4 or rng.random() < 0.06],
               'hihat': [i for i in range(nsteps) if (i % 2 == 0 and rng.random() < 0.9) or rng.random() < 0.15]}
        for d, steps in pat.items():
            for st in steps:
                a = int(st * step * R); h = kit[d][:n - a] * U(0.6, 1.0)
                x[a:a + len(h)] += h
        loop = rng.random() < 0.7
        use = dict(distinct=rng.integers(1, 3), range=U(0, 2), dur=rng.choice([16, 32, 64]), density=U(0.005, 0.06))
    elif cls == 'speech':
        n = int(R * U(0.5, 3.0)); t = np.arange(n) / R
        f0c = U(90, 220) * (1 + 0.15 * np.sin(2 * np.pi * U(0.5, 2) * t) + 0.05 * np.sin(2 * np.pi * U(3, 6) * t))
        src = osc('saw', f0c, n, R)
        seg = int(R * U(0.08, 0.2)); x = np.zeros(n)
        vowels = [(800, 1150, 2900), (400, 1600, 2700), (350, 2000, 2800), (450, 800, 2830), (325, 700, 2530), (600, 1700, 2600)]
        for s0 in range(0, n, seg):
            s1 = min(n, s0 + seg); v = vowels[rng.integers(0, len(vowels))]
            chunk = src[s0:s1] if rng.random() < 0.8 else noise(s1 - s0) * 0.6
            x[s0:s1] = formant(chunk, R, list(v), [90, 110, 150])
        syl = np.clip(np.sin(np.pi * (np.cumsum(np.full(n, U(3, 6))) / R)) ** 2, 0, 1)
        x *= syl * (0.3 + 0.7 * (rng.random() < 0.9))
        loop = rng.random() < 0.15
        use = dict(distinct=rng.integers(1, 3), range=U(0, 3), dur=rng.choice([8, 16, 32, 64]), density=U(0.001, 0.02))
    x = np.asarray(x, dtype=float)
    # Amiga-style quantisation, random level, optional low sample rate aliasing
    x = x / (np.abs(x).max() + 1e-9) * U(0.4, 1.0)
    if rng.random() < 0.3: x += noise(len(x)) * U(0.002, 0.02)
    q = np.clip(np.round(x * 127), -128, 127).astype(np.int8)
    L = len(q)
    ls, ll = 0, 0
    if loop:
        ls = (0 if cls == 'beat' else int(L * U(0.2, 0.7))) & ~1; ll = (L - ls) & ~1
        if ll < 4: ls, ll = 0, 0
    beatr = {'kick': (0.6, 1), 'snare': (0.3, 1), 'hihat': (0.15, 0.6), 'cymbal': (0.5, 1), 'pad': (0.6, 1), 'strings': (0.5, 1), 'chord': (0.4, 1), 'speech': (0.4, 1), 'fx': (0.3, 1), 'beat': (0.8, 1)}.get(cls, (0.2, 0.8))
    use['beat'] = U(*beatr)
    use = {k: (int(v) if k in ('distinct', 'dur') else float(v)) for k, v in use.items()}
    period = PAULA / (2 * R)
    return q, dict(cls=cls, rate=R, period=period, loopStart=ls, loopLength=ll, usage=use)

def main(out, per_class=260):
    blobs, idx, off = [], [], 0
    for c in CLASSES:
        for i in range(per_class):
            q, meta = gen(c)
            meta['offset'] = off; meta['length'] = len(q)
            idx.append(meta); blobs.append(q.tobytes()); off += len(q)
        print(c, file=sys.stderr)
    open(out + '.bin', 'wb').write(b''.join(blobs))
    json.dump(idx, open(out + '.json', 'w'))

if __name__ == '__main__':
    main(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 260)
