#!/usr/bin/env python3
"""Trains the mod2sid sample classifier and exports it as compact JSON for the
in-app JavaScript inference (src/core/model.json).

Model: Extra-Trees ensemble, trained on synthetic Amiga-style samples plus
hand-labelled real samples from test MODs (heavily up-weighted with jitter).
Evaluation: leave-one-MOD-out on the real labelled samples."""
import json, sys, numpy as np, warnings
from sklearn.ensemble import ExtraTreesClassifier
warnings.filterwarnings('ignore')

CLASSES = ['kick', 'snare', 'hihat', 'cymbal', 'tom', 'perc', 'bass', 'lead', 'pad', 'strings', 'brass',
           'wood', 'guitar', 'keys', 'bell', 'choir', 'chord', 'fx', 'speech', 'beat']
FAM = {'kick': 'drum', 'snare': 'drum', 'hihat': 'drum', 'cymbal': 'drum', 'tom': 'drum', 'perc': 'drum',
       'bass': 'bass', 'chord': 'chord', 'fx': 'fx', 'speech': 'speech', 'beat': 'beat'}
fam = lambda c: FAM.get(CLASSES[int(c)], 'melodic')

rows = json.load(open(sys.argv[1])); out = sys.argv[2]
if len(sys.argv) > 3: rows += json.load(open(sys.argv[3]))  # WAV sample library (training only)
X = np.array([r['x'] for r in rows], float); y = np.array([r['y'] for r in rows]); src = np.array([r['src'] for r in rows])
wav = np.array([s.startswith('wav:') for s in src]); syn = (src == 'synth') | wav; real = ~syn; mods = np.array([s.split('#')[0] for s in src])
rng = np.random.default_rng(0)
import os
AUG = int(os.environ.get("AUG", 200))
NTREES, DEPTH, LEAF = int(os.environ.get("NTREES", 60)), int(os.environ.get("DEPTH", 15)), int(os.environ.get("LEAF", 3))

def make(): return ExtraTreesClassifier(NTREES, max_depth=DEPTH, min_samples_leaf=LEAF, random_state=0, n_jobs=-1)
def trainset(mask):
    Xa = np.repeat(X[mask], AUG, 0); ya = np.repeat(y[mask], AUG)
    Xa = Xa + rng.normal(0, 1, Xa.shape) * X[syn].std(0) * 0.08
    return np.vstack([X[syn], Xa]), np.concatenate([y[syn], ya])

h = fh = n = 0
conf = {}
umods = sorted(set(mods[real])); rng2 = np.random.default_rng(3); rng2.shuffle(umods)
folds = [set(umods[i::10]) for i in range(10)] if len(umods) > 20 else [{m} for m in umods]
for fold in folds:
    inf = np.array([m in fold for m in mods])
    te = real & inf
    if not te.any(): continue
    clf = make().fit(*trainset(real & ~inf))
    p = clf.predict(X[te])
    h += (p == y[te]).sum(); fh += sum(fam(a) == fam(b) for a, b in zip(p, y[te])); n += te.sum()
    for a, b in zip(p, y[te]): conf[(CLASSES[b], CLASSES[a])] = conf.get((CLASSES[b], CLASSES[a]), 0) + 1
print(f'grouped CV (test MODs never in training) on {n} real samples from {len(umods)} MODs: class accuracy {h/n:.2f}, family accuracy {fh/n:.2f}')
# WAV library: hold out 20 % of the files, train on the rest (+ all MOD data)
if wav.any():
    hold = wav & (rng.random(len(y)) < 0.2)
    clf = make().fit(np.vstack([X[syn & ~hold], np.repeat(X[real], 1, 0)]), np.concatenate([y[syn & ~hold], y[real]]))
    p = clf.predict(X[hold])
    print(f'WAV-library holdout ({hold.sum()} samples): class accuracy {(p == y[hold]).mean():.2f}, family {np.mean([fam(a) == fam(b) for a, b in zip(p, y[hold])]):.2f}')
print('most common confusions:', sorted(((v, k) for k, v in conf.items() if k[0] != k[1]), reverse=True)[:8])

clf = make().fit(*trainset(real))
trees = []
for est in clf.estimators_:
    t = est.tree_
    val = t.value[:, 0, :]
    val = val / val.sum(1, keepdims=True)
    leaves = {}
    nodes = []
    for i in range(t.node_count):
        if t.children_left[i] == -1:
            sp = [[int(c), int(round(float(v) * 100))] for c, v in enumerate(val[i]) if v >= 0.01]
            nodes.append([-1, sp])
        else:
            nodes.append([int(t.feature[i]), round(float(t.threshold[i]), 5), int(t.children_left[i]), int(t.children_right[i])])
    trees.append(nodes)
# map sklearn class order to CLASSES order
model = dict(type='extratrees', classes=[CLASSES[c] for c in clf.classes_], trees=trees,
             info=dict(synthetic=int((src == 'synth').sum()), wav=int(wav.sum()), real=int(real.sum()), loo_acc=round(h / n, 3), loo_family_acc=round(fh / n, 3)))
s = json.dumps(model, separators=(',', ':'))
open(out, 'w').write(s)
print('saved', out, len(s) // 1024, 'KB')
