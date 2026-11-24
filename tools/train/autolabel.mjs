// Conservative rule-based labelling of real MOD samples (only confident cases)
import fs from 'fs';
import { parseMod, replayMod } from '../../src/core/mod.js';
import { analyzeSample, sampleUsage, realNote } from '../../src/core/features.js';
import { nameHint } from '../../src/core/classifier.js';
const dirs = process.argv[2].split(','), out = process.argv[3];
const labels = {}; let n = 0; const cnt = {};
const seen = new Set();
for (const dir of dirs) for (const f of fs.readdirSync(dir)) {
  let m, buf; try { buf = fs.readFileSync(dir + '/' + f); m = parseMod(buf); } catch { continue; }
  const key = buf.length + ':' + m.title; if (seen.has(key)) continue; seen.add(key);
  const u = sampleUsage(replayMod(m));
  for (const s of m.samples) {
    const uu = u[s.index]; if (!uu || s.data.length < 16) continue;
    const { info } = analyzeSample(s, uu);
    if (info.empty) continue;
    let cls = null;
    const notes = uu.periods.map(p => realNote(info, p)).filter(x => x !== null).sort((a, b) => a - b);
    const med = notes.length ? notes[notes.length >> 1] : null;
    const nm = s.name.replace(/^st-?\d+:/i, ' ').replace(/\bbas\./i, 'bass ').replace(/hot base/i, 'kick').replace(/hiopen/i, 'hihat').replace(/syn\.solo/i, 'lead');
    const hint = nameHint(nm);
    // name hints only count when the sound and the way it is played agree
    const drumLike = uu.distinct <= 4 && info.durS < 2.5;
    const ok = {
      kick: drumLike && info.centroid < 1200, snare: drumLike, hihat: drumLike && info.centroid > 900, cymbal: uu.distinct <= 4,
      tom: uu.distinct <= 8, perc: uu.distinct <= 6,
      bass: med !== null && med < 52 && uu.distinct >= 2, lead: uu.distinct >= 3, pad: uu.distinct >= 2, strings: uu.distinct >= 2,
      brass: uu.distinct >= 2, wood: uu.distinct >= 2, guitar: uu.distinct >= 2, keys: uu.distinct >= 2, bell: uu.distinct >= 2,
      choir: uu.distinct >= 1, chord: !!info.chord || uu.distinct <= 6, fx: uu.distinct <= 4,
    };
    if (hint && ok[hint]) cls = hint;
    else if (!hint && s.looped && s.data.length <= 400 && uu.distinct >= 3) {
      if (med !== null) cls = med < 38 ? 'bass' : med > 46 ? 'lead' : null;
    } else if (!hint && !s.looped && uu.distinct <= 2 && info.durS < 0.7) {
      if (info.centroid < 350 && info.low > 0.6 && info.flatness < 0.45) cls = 'kick';
      else if (info.flatness > 0.62 && info.centroid > 2200) cls = 'hihat';
      else if (info.flatness > 0.5 && info.centroid > 700 && info.centroid < 2200 && info.attack < 0.03) cls = 'snare';
    }
    if (cls) { (labels[f] ||= {})[s.index] = cls; n++; cnt[cls] = (cnt[cls] || 0) + 1; }
  }
}
fs.writeFileSync(out, JSON.stringify(labels, null, 1));
console.log('auto-labelled', n, cnt);
