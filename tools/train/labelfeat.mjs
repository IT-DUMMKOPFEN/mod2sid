// Auto-label + feature extraction in one pass, resumable in time slices.
// usage: node labelfeat.mjs <modDir> <out.jsonl> <shard/of> [seconds]
// Appends one JSON line per labelled sample ({y, x, src, cls}) and records finished files
// in <out.jsonl>.done, so it can be called again and again until it prints "complete".
import fs from 'fs';
import { loadSong as parseMod } from '../../src/core/formats/index.js';
import { replaySong as replayMod } from '../../src/core/song.js';
import { analyzeSample, sampleUsage, CLASSES } from '../../src/core/features.js';
import { autoLabel } from './autolabel.mjs';

const [dir, out, shardArg = '0/1', secs = '150'] = process.argv.slice(2);
const [shard, of] = shardArg.split('/').map(Number);
const deadline = Date.now() + Number(secs) * 1000;
const doneFile = out + '.done';
const done = new Set(fs.existsSync(doneFile) ? fs.readFileSync(doneFile, 'utf8').split('\n').filter(Boolean) : []);
const files = fs.readdirSync(dir).sort().filter((_, i) => i % of === shard);
let n = 0, rows = 0;
for (const f of files) {
  if (done.has(f)) continue;
  if (Date.now() > deadline) break;
  const lines = [];
  try {
    const buf = fs.readFileSync(dir + '/' + f);
    const m = parseMod(buf);
    const u = sampleUsage(replayMod(m));
    for (const s of m.samples) {
      const uu = u[s.index]; if (!uu || s.data.length < 16) continue;
      const { features, info } = analyzeSample(s, uu);
      if (info.empty) continue;
      const cls = autoLabel(s, uu, info);
      if (cls) lines.push(JSON.stringify({ y: CLASSES.indexOf(cls), x: features, src: f + '#' + s.index, key: buf.length + ':' + m.title }));
    }
  } catch { /* not a playable 4-channel MOD */ }
  if (lines.length) fs.appendFileSync(out, lines.join('\n') + '\n');
  fs.appendFileSync(doneFile, f + '\n');
  done.add(f); n++; rows += lines.length;
}
const left = files.filter(f => !done.has(f)).length;
console.log(`shard ${shard}: +${n} files, +${rows} rows, ${left} left${left ? '' : ' complete'}`);
