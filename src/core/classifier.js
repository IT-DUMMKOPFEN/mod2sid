// mod2sid – sample classifier ("KI"): Extra-Trees ensemble + name hints + learned user corrections
// (c) IT-DUMMKOPFEN, GPL-3.0
import { CLASSES } from './features.js';

let MODEL = null;
export function setModel(m) { MODEL = m; }
export function modelInfo() { return MODEL ? MODEL.info : null; }

function treePredict(nodes, x, acc) {
  let i = 0;
  for (;;) {
    const n = nodes[i];
    if (n[0] === -1) { for (const [c, p] of n[1]) acc[c] += p; return; }
    i = x[n[0]] <= n[1] ? n[2] : n[3];
  }
}

const NAME_HINTS = [
  [/\b(bd|kick|bassdrum|bass[ ._-]?drum|bdrum|kik)\b|bassdr/i, 'kick'],
  [/\b(sn|sd|snare|snr|snar)\b|snare/i, 'snare'],
  [/\b(hh|hihat|hi[ ._-]?hat|chh|ohh|hat|cl\.?hat|op\.?hat)\b|hihat|hi-hat/i, 'hihat'],
  [/\b(cym|crash|ride|splash|china)\b|cymbal|crash/i, 'cymbal'],
  [/\btom|toms\b/i, 'tom'],
  [/\b(clap|rim|perc|cowbell|shaker|conga|bongo|clave|tamb|block|quack)\b|cowbell|tambourine/i, 'perc'],
  [/bass(?!\s*drum|dr)/i, 'bass'],
  [/\b(lead|solo|synlead)\b/i, 'lead'],
  [/\b(pad|atmo|sphere)\b/i, 'pad'],
  [/string|strng|strg|violin|cello|viola|orchest/i, 'strings'],
  [/brass|horn|trump|trombone|tuba/i, 'brass'],
  [/flute|flöte|clarin|oboe|sax|bassoon|piccolo|recorder/i, 'wood'],
  [/guit|gtr|gitar|dist\.?gt|banjo|sitar|harp\b/i, 'guitar'],
  [/piano|pian|organ|orgel|rhodes|harpsi|clav|cembal|keys|synpia|e\.?p\b/i, 'keys'],
  [/bell|glock|vibra|marimb|xylo|celest|chime/i, 'bell'],
  [/choir|chor(?!d)|voice|vox|aah|ooh/i, 'choir'],
  [/chord|maj7|min7|major|minor|\bmaj\b|\bmin\b|dim7|aug|sus4/i, 'chord'],
  [/\b(fx|sfx|zoom|sweep|laser|noise|wind|boom|explo)\b/i, 'fx'],
];

export function nameHint(name) {
  if (!name) return null;
  for (const [re, c] of NAME_HINTS) if (re.test(name)) return c;
  return null;
}

// returns sorted [{cls, p}]
export function classify(features, info, name, memory = []) {
  const K = CLASSES.length;
  const probs = new Float64Array(K);
  if (info && info.empty) { probs[CLASSES.indexOf('fx')] = 1; }
  else if (MODEL) {
    const acc = new Float64Array(MODEL.classes.length);
    for (const t of MODEL.trees) treePredict(t, features, acc);
    MODEL.classes.forEach((c, i) => { probs[CLASSES.indexOf(c)] += acc[i]; });
  } else probs[CLASSES.indexOf('lead')] = 1;
  let s = probs.reduce((a, b) => a + b, 0) || 1;
  for (let i = 0; i < K; i++) probs[i] /= s;
  // name hint (sample names are often greetings, so only a moderate boost)
  const h = nameHint(name);
  if (h) { probs[CLASSES.indexOf(h)] += 0.6; }
  // chord detection from chroma strengthens 'chord' for melodic sounds
  if (info && info.chord && info.chord.score > 0.5) probs[CLASSES.indexOf('chord')] += 0.25;
  // learned corrections (user swapped instruments before): nearest neighbour in feature space
  if (memory && memory.length) {
    let best = null, bd = 1e9;
    for (const m of memory) {
      let d = 0; for (let i = 0; i < features.length; i++) { const q = (features[i] - m.f[i]); d += q * q; }
      if (d < bd) { bd = d; best = m; }
    }
    if (best && bd < 0.05 * features.length) { const ci = CLASSES.indexOf(best.cls); if (ci >= 0) probs[ci] += 2.0; }
  }
  s = probs.reduce((a, b) => a + b, 0) || 1;
  return CLASSES.map((c, i) => ({ cls: c, p: probs[i] / s })).sort((a, b) => b.p - a.p);
}
