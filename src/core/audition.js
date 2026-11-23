// mod2sid – tiny demo tunes to audition a single SID instrument
// (c) IT-DUMMKOPFEN, GPL-3.0
import { GTSong, REST, KEYOFF } from './gtsong.js';
import { buildSID } from './sidbuild.js';

export function auditionSID(preset, { note = 48, env = null, chord = null, model = '6581' } = {}) {
  const song = new GTSong();
  song.name = 'mod2sid audition';
  const W = (preset.wave.find(x => typeof x[0] === 'number' && x[0] >= 0x10) || [0x41])[0];
  const steps = chord ? [...chord.iv.map(iv => [W, iv]), ['J', 0]] : preset.wave;
  const wv = song.addWave(steps);
  const pu = song.addPulse(preset.pulse);
  const fi = preset.filter ? song.addFilter(preset.filter, 1) : 0;
  let vp = 0, vd = 0;
  if (preset.vib) { vp = song.addSpeed(preset.vib[0], preset.vib[1]); vd = preset.vib[2] || 1; }
  const e = env || { ad: preset.ad, sr: preset.sr };
  const ins = song.addInstrument({ ad: e.ad, sr: e.sr, wv, pu, fi, vp, vd, gt: 2, fw: preset.fw, name: 'demo' });
  const rows = Array.from({ length: 64 }, () => [REST, 0, 0, 0]);
  rows[0][2] = 0x0F; rows[0][3] = 6;
  const drum = preset.cat === 'drums' || preset.drum;
  if (drum) {
    [0, 8, 16, 20, 24, 32, 40, 44, 48].forEach(r => { rows[r][0] = 0x60 + note; rows[r][1] = ins; });
  } else {
    const seq = [[0, 0], [8, 4], [16, 7], [24, 12], [40, 7], [48, 0]];
    seq.forEach(([r, iv], k) => {
      rows[r][0] = 0x60 + Math.max(0, Math.min(92, note + iv)); rows[r][1] = ins;
      const off = (k === seq.length - 1 ? 60 : seq[k + 1][0] - 2);
      if ((e.sr >> 4) > 0 && off < 64) rows[off][0] = KEYOFF;
    });
  }
  const p = song.addPattern(rows);
  const empty = song.addPattern(Array.from({ length: 64 }, () => [REST, 0, 0, 0]));
  song.orders = [[p], [empty], [empty]];
  return buildSID(song, { initTempo: 6, gate: 2, model, name: 'audition' }).psid;
}
