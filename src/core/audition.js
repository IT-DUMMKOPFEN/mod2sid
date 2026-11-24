// mod2sid – tiny demo tunes to audition a single SID instrument
// (c) IT-DUMMKOPFEN, GPL-3.0
import { GTSong, REST, KEYOFF } from './gtsong.js';
import { buildSID } from './sidbuild.js';
import { PRESET_BY_ID } from './library.js';

export function auditionSID(preset, { note = 48, env = null, chord = null, model = '6581', voice = null, beat = null, timeScale = 1 } = {}) {
  const song = new GTSong();
  if (voice) preset = { ...preset, wave: voice.steps };
  if (beat) {
    // a decomposed drum loop: play its hits (tempo 3 = 60 ms rows) twice
    song.name = 'mod2sid audition';
    const ins = beat.clusters.map(cl => { const pr = PRESET_BY_ID[cl.presetId] || PRESET_BY_ID.kick;
      return song.addInstrument({ ad: pr.ad, sr: pr.sr, wv: song.addWave(pr.wave), pu: song.addPulse(pr.pulse), fi: 0, vp: 0, vd: 0, gt: 2, fw: pr.fw, name: 'demo' }); });
    const rows = Array.from({ length: 128 }, () => [REST, 0, 0, 0]); rows[0][2] = 0x0F; rows[0][3] = 3;
    const len = Math.max(1, Math.min(64, Math.round(beat.duration * timeScale / 0.06)));
    for (let rep = 0; rep * len < 128 && rep < 2; rep++) for (const h of beat.hits) {
      const r = rep * len + Math.round(h.t * timeScale / 0.06); if (r < 128 && rows[r][0] === REST) { rows[r][0] = 0x60 + 48; rows[r][1] = ins[h.c]; }
    }
    const p = song.addPattern(rows), empty = song.addPattern(Array.from({ length: 128 }, () => [REST, 0, 0, 0]));
    song.orders = [[p], [empty], [empty]];
    return buildSID(song, { initTempo: 3, gate: 2, model, name: 'audition' }).psid;
  }
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
  if (voice) {
    rows[0][0] = 0x60 + note; rows[0][1] = ins; rows[40][0] = KEYOFF;
  } else if (drum) {
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
