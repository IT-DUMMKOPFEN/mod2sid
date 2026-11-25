#!/usr/bin/env python3
"""Does a labelled studio library help? Compares, on the same folds:
  A = MOD rows + synthetic + old WAV library   (current model recipe)
  B = A + new library rows (lib.json)
Reports grouped MOD CV for both, and library accuracy (A: unseen library,
B: pack-wise holdout, i.e. packs never seen in training).
usage: eval_lib.py features.json wav.json lib.json"""
import json, sys, os, numpy as np, warnings
from sklearn.ensemble import ExtraTreesClassifier
warnings.filterwarnings('ignore')
CLASSES = ['kick', 'snare', 'hihat', 'cymbal', 'tom', 'perc', 'bass', 'lead', 'pad', 'strings', 'brass',
           'wood', 'guitar', 'keys', 'bell', 'choir', 'chord', 'fx', 'speech', 'beat']
FAM = {'kick': 'drum', 'snare': 'drum', 'hihat': 'drum', 'cymbal': 'drum', 'tom': 'drum', 'perc': 'drum',
       'bass': 'bass', 'chord': 'chord', 'fx': 'fx', 'speech': 'speech', 'beat': 'beat'}
fam = np.vectorize(lambda c: FAM.get(CLASSES[int(c)], 'melodic'))
AUG, WAVREP, LIBREP = int(os.environ.get('AUG', 3)), int(os.environ.get('WAVREP', 4)), float(os.environ.get('LIBREP', 1))
NTREES, LEAF, FOLDS = int(os.environ.get('NTREES', 50)), int(os.environ.get('LEAF', 4)), int(os.environ.get('FOLDS', 5))
rng = np.random.default_rng(0)

def arr(rows): return np.array([r['x'] for r in rows], float), np.array([r['y'] for r in rows]), np.array([r['src'] for r in rows])
X, y, src = arr(json.load(open(sys.argv[1])))
Xw, yw, _ = arr(json.load(open(sys.argv[2])))
lib = json.load(open(sys.argv[3]))
# BASE=<file>: library rows that both A and B train on (weight 1)
Xb, yb, _ = arr(json.load(open(os.environ['BASE']))) if os.environ.get('BASE') else (np.zeros((0, 34)), np.zeros(0, int), None)
Xl, yl, sl = arr(lib)
packs = np.array([s.split('/')[0] for s in sl])
syn = src == 'synth'; real = ~syn; mods = np.array([s.split('#')[0] for s in src])
sd = X[syn].std(0)

def fit(mask, extra=None):
    Xa = np.repeat(X[mask], AUG, 0); ya = np.repeat(y[mask], AUG)
    Xa = Xa + rng.normal(0, 1, Xa.shape) * sd * 0.08
    parts = [X[syn], Xa, np.repeat(Xw, WAVREP, 0), Xb]; lab = [y[syn], ya, np.repeat(yw, WAVREP), yb]
    if extra is not None:
        ex, ey = extra
        if LIBREP < 1:
            k = rng.random(len(ey)) < LIBREP; ex, ey = ex[k], ey[k]
        else: ex, ey = np.repeat(ex, int(LIBREP), 0), np.repeat(ey, int(LIBREP))
        parts.append(ex); lab.append(ey)
    return ExtraTreesClassifier(NTREES, max_depth=15, min_samples_leaf=LEAF, random_state=0, n_jobs=-1).fit(np.vstack(parts), np.concatenate(lab))

umods = sorted(set(mods[real])); r2 = np.random.default_rng(3); r2.shuffle(umods)
folds = [set(umods[i::FOLDS]) for i in range(FOLDS)]
upacks = sorted(set(packs)); r3 = np.random.default_rng(5); r3.shuffle(upacks)
pfold = [set(upacks[i::FOLDS]) for i in range(FOLDS)]
PA = np.full(len(y), -1); PB = np.full(len(y), -1); LB = np.full(len(yl), -1)
for k, fold in enumerate(folds):
    inf = np.array([m in fold for m in mods]); te = real & inf
    a = fit(real & ~inf); PA[te] = a.predict(X[te])
    lm = np.array([p in pfold[k] for p in packs])
    b = fit(real & ~inf, (Xl[~lm], yl[~lm])); PB[te] = b.predict(X[te]); LB[lm] = b.predict(Xl[lm])
    print(f'fold {k+1}/{FOLDS} done', flush=True)
m = PA >= 0
acc = lambda p, t: f'class {(p == t).mean():.4f}, family {(fam(p) == fam(t)).mean():.4f}'
print(f'MOD CV ({m.sum()} samples)  A: {acc(PA[m], y[m])}')
print(f'MOD CV ({m.sum()} samples)  B: {acc(PB[m], y[m])}')
for tag in ['mm', 'iso', 'new', 'mu']:
    t = m & np.array([s.startswith(tag + ':') for s in src])
    if t.any(): print(f'  {tag:4} A {acc(PA[t], y[t])} | B {acc(PB[t], y[t])}')
a = fit(real)
LA = a.predict(Xl)
print(f'library ({len(yl)} samples, {len(upacks)} packs)  A (never seen): {acc(LA, yl)}')
print(f'library pack-holdout                      B: {acc(LB, yl)}')
for c in sorted(set(yl)):
    t = yl == c
    print(f'  {CLASSES[c]:8} n={t.sum():5}  A {(LA[t] == c).mean():.2f}  B {(LB[t] == c).mean():.2f}')
