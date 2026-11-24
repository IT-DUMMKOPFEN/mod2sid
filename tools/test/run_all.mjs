// Headless test: convert every MOD in a folder, run the SID in the 6502/SID emulator
import fs from 'fs';
import { loadMod, analyze, convert } from '../../src/core/convert.js';
import { setModel } from '../../src/core/classifier.js';
import { SIDPlayer } from '../../src/core/sid.js';
setModel(JSON.parse(fs.readFileSync(new URL('../../src/core/model.json', import.meta.url))));
const dir = process.argv[2], outDir = process.argv[3];
if (outDir) fs.mkdirSync(outDir, { recursive: true });
let ok = 0;
for (const f of fs.readdirSync(dir).filter(f => !/\.(txt|info|guide|jpg|diz|nfo|torrent|xml|conf)$/i.test(f))) {
  const t0 = Date.now();
  try {
    const ctx = loadMod(fs.readFileSync(dir + '/' + f));
    const an = analyze(ctx, { seed: 1 });
    const res = convert(ctx, an, { seed: 1, title: ctx.mod.title, sids: +(process.env.SIDS || 1) });
    const t1 = Date.now();
    const pl = new SIDPlayer(44100); pl.load(res.sid);
    const secs = Math.min(30, res.seconds);
    const buf = new Float32Array(Math.round(44100 * secs)); pl.generate(buf);
    let rms = 0; for (const v of buf) rms += v * v; rms = Math.sqrt(rms / buf.length);
    // full-length 6502 run (no audio) to catch player crashes
    const frames = Math.round(res.seconds * 50);
    let maxI = 0; for (let i = 0; i < frames; i++) { const n = pl.cpu.call(pl.tune.play); if (n > maxI) maxI = n; }
    const cls = an.samples.filter(s => s.used).map(s => s.cls);
    const summary = Object.entries(cls.reduce((m, c) => (m[c] = (m[c] || 0) + 1, m), {})).map(([k, v]) => k + v).join(' ');
    console.log(`OK ${f.padEnd(32)} ${res.seconds.toFixed(0)}s pat${res.song.patterns.length} ins${res.song.instr.length} wt${res.song.wt.length} sid${res.sidInfo.size}B rms${rms.toFixed(3)} maxInstr${maxI} conv${t1 - t0}ms filterV${res.filterVoice}${res.truncated ? ' TRUNC' : ''}${res.overflow ? ' OVF' : ''} | ${summary}`);
    if (outDir) { const b = f.replace(/\.mod$/i, ''); fs.writeFileSync(`${outDir}/${b}.sid`, res.sid); fs.writeFileSync(`${outDir}/${b}.${res.songExt}`, res.sng); }
    ok++;
  } catch (e) { console.log('FAIL', f, e.stack.split('\n').slice(0, 3).join(' | ')); }
}
console.log('done', ok);
