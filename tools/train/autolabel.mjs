// Conservative rule-based labelling of real MOD samples (only confident cases)
import fs from 'fs';
import { parseMod, replayMod } from '../../src/core/mod.js';
import { analyzeSample, sampleUsage, realNote } from '../../src/core/features.js';
import { nameHint } from '../../src/core/classifier.js';
const dir = process.argv[2], out = process.argv[3];
const labels = {}; let n = 0; const cnt = {};
for (const f of fs.readdirSync(dir)) {
  let m; try { m = parseMod(fs.readFileSync(dir + '/' + f)); } catch { continue; }
  const u = sampleUsage(replayMod(m));
  for (const s of m.samples) {
    const uu = u[s.index]; if (!uu || s.data.length < 16) continue;
    const { info } = analyzeSample(s, uu);
    if (info.empty) continue;
    let cls = null;
    const hint = /\b(bas|prc|syn|snr|hh|bd|kick|snare|bass|lead|solo)\b|bass|snare|hiopen|kick/i.test(s.name) ? nameHint(s.name.replace(/\bbas\./i, 'bass ').replace(/hot base/i, 'kick').replace(/hiopen/i, 'hihat').replace(/syn\.solo/i, 'lead')) : null;
    if (hint) cls = hint;
    else if (s.looped && s.data.length <= 400 && uu.distinct >= 3) {
      const notes = uu.periods.map(p => realNote(info, p)).filter(x => x !== null).sort((a, b) => a - b);
      const med = notes.length ? notes[notes.length >> 1] : null;
      if (med !== null) cls = med < 38 ? 'bass' : med > 46 ? 'lead' : null;
    } else if (!s.looped && uu.distinct <= 2 && info.durS < 0.7) {
      if (info.centroid < 350 && info.low > 0.6 && info.flatness < 0.45) cls = 'kick';
      else if (info.flatness > 0.62 && info.centroid > 2200) cls = 'hihat';
      else if (info.flatness > 0.5 && info.centroid > 700 && info.centroid < 2200 && info.attack < 0.03) cls = 'snare';
    }
    if (cls) { (labels[f] ||= {})[s.index] = cls; n++; cnt[cls] = (cnt[cls] || 0) + 1; }
  }
}
fs.writeFileSync(out, JSON.stringify(labels, null, 1));
console.log('auto-labelled', n, cnt);
