// Computes classifier features (same code as the app) for synthetic + labelled real samples
import fs from 'fs';
import { parseMod, replayMod } from '../../src/core/mod.js';
import { analyzeSample, sampleUsage, CLASSES } from '../../src/core/features.js';
const [synthBase, modDir, out] = process.argv.slice(2);
const idx = JSON.parse(fs.readFileSync(synthBase + '.json'));
const bin = fs.readFileSync(synthBase + '.bin');
const rows = [];
for (const m of idx) {
  const data = new Int8Array(bin.buffer, bin.byteOffset + m.offset, m.length);
  const s = { data, length: m.length, loopStart: m.loopStart, loopLength: m.loopLength, looped: m.loopLength > 2, volume: 64 };
  const u = { medianPeriod: m.period, distinct: m.usage.distinct, range: m.usage.range, medianDur: m.usage.dur, density: m.usage.density, hits: 10, beatFrac: m.usage.beat };
  const a = analyzeSample(s, u);
  rows.push({ y: CLASSES.indexOf(m.cls), x: a.features, src: 'synth' });
}
const labels = JSON.parse(fs.readFileSync(new URL('./labels.json', import.meta.url)));
for (const [file, lab] of Object.entries(labels)) {
  const mod = parseMod(fs.readFileSync(modDir + '/' + file));
  const u = sampleUsage(replayMod(mod));
  for (const [k, cls] of Object.entries(lab)) {
    const s = mod.samples[+k - 1]; if (!u[+k]) continue;
    rows.push({ y: CLASSES.indexOf(cls), x: analyzeSample(s, u[+k]).features, src: file + '#' + k });
  }
}
fs.writeFileSync(out, JSON.stringify(rows));
console.log('rows', rows.length);
