// mod2sid – distorted electric guitars: detection and pitch of the played note
// A distorted guitar sample cannot be rebuilt on the SID (the clipping noise turns
// into a harsh buzz). When it is detected, the converter plays a clean guitar
// instead, on the note the distorted guitar plays.
// (c) IT-DUMMKOPFEN, GPL-3.0
import { sampleAudio, magSpectrum } from './features.js';

const DIST_NAME = /dist|fuzz|overdr|crunch|chug|power ?ch|heavy ?g|metal ?g|rock ?g/i;
const GTR_NAME = /guit|gtr|gitar|e[ .-]?git|elec(tric)?[ ._-]?g|^\W*(st-\d+:)?electric\W*$/i;
const OTHER_NAME = /piano|pian|organ|orgel|sax|brass|brazz|horn|trump|flute|string|drum|\bbd\b|kick|\btom|snare|bell|\bpad\b|choir|synth|bass(?!\s*guit)/i;

// how distorted the sustained part of the sample sounds:
// clipping flattens the waveform (low crest factor, many samples near the peak)
// and fills the spectrum between the harmonics (high spectral flatness)
export function distortionInfo(s, info) {
  const R = info.rate || 8287;
  const x = sampleAudio(s, 8192);
  const st = Math.min(Math.floor(R * 0.03), Math.max(0, x.length - 2048));
  const n = Math.min(4096, x.length - st);
  if (n < 512) return null;
  let pk = 0, ss = 0, cl = 0;
  for (let i = st; i < st + n; i++) { const v = Math.abs(x[i]); if (v > pk) pk = v; ss += x[i] * x[i]; }
  const rms = Math.sqrt(ss / n);
  if (rms < 1e-4) return null;
  for (let i = st; i < st + n; i++) if (Math.abs(x[i]) > 0.8 * pk) cl++;
  const N = 2048, m = magSpectrum(x, st, N);
  const kHz = N / R * 1000;
  let geo = 0, ar = 0, cnt = 0;
  for (let i = Math.max(1, Math.floor(0.3 * kHz)); i < Math.min(N / 2, 4 * kHz); i++) { const v = m[i] + 1e-9; geo += Math.log(v); ar += v; cnt++; }
  const flat = cnt ? Math.exp(geo / cnt) / (ar / cnt) : 0;
  return { crest: pk / rms, clip: cl / n, flat };
}

// is this a distorted electric guitar?  ranking: classifier output, name: sample name
export function isDistortedGuitar(s, info, ranking, name, d, u) {
  if (!d || info.empty || info.durS < 0.12) return false;
  const p = c => (ranking.find(r => r.cls === c) || { p: 0 }).p;
  const top = ranking[0].cls;
  const nm = name || '';
  const distName = DIST_NAME.test(nm), gtrName = GTR_NAME.test(nm);
  // clearly something else
  if (/vox|voice|vocal|choir|ahh|ooh/i.test(nm)) return false;
  if (OTHER_NAME.test(nm) && !gtrName && !distName) return false;
  if (/bass/i.test(nm) && !/bass ?drum/i.test(nm) && (!gtrName || /bass ?guit|bass ?gtr/i.test(nm))) return false;
  // a noisy, clipped sound that the module plays as a melody (many different notes)
  // is no drum: a short palm-muted distorted guitar ("chug")
  const melodic = u && u.distinct >= 5 && u.range >= 7 && info.pitchConf >= 0.45;
  const buzz = melodic && ['snare', 'fx', 'chord', 'guitar'].includes(top) && p('guitar') >= 0.05 && d.flat >= 0.6 && (d.crest <= 3.3 || d.clip >= 0.05) && info.durS <= 0.6;
  if (['kick', 'hihat', 'cymbal', 'tom', 'perc', 'beat', 'speech', 'bell', 'choir'].includes(top) && !distName && !gtrName && !buzz) return false;
  if (top === 'bass' && !gtrName && !distName) return false;
  if (top === 'snare' && p('guitar') < 0.15 && !distName && !gtrName && !buzz) return false;
  const guitarish = top === 'guitar' || p('guitar') >= (top === 'chord' || top === 'keys' || top === 'lead' ? 0.12 : 0.15) || gtrName || distName || buzz;
  if (!guitarish) return false;
  // a square wave or an organ also has a low crest factor; for sounds the classifier
  // does not already call a guitar the spectrum must be filled up between the harmonics
  const distorted = top === 'guitar' || gtrName ? (d.crest <= 2.35 || d.clip >= 0.1 || d.flat >= 0.5) : d.flat >= 0.5 && (d.crest <= 2.6 || d.clip >= 0.06);
  return distorted || distName || buzz;
}

// the note a (distorted) guitar plays. Distortion and power chords (root + fifth)
// confuse a plain period detector: it locks onto the fifth or onto the difference
// tone an octave below. The pitch class comes from the spectrum (chroma), where a
// root r shows up together with its fifth and third harmonics; the octave is the
// one nearest to the period detector.
export function guitarPitch(s, info) {
  const R = info.rate || 8287;
  const x = sampleAudio(s, 16384);
  const N = 4096;
  const chroma = new Float64Array(12);
  const st0 = Math.floor(R * 0.02);
  const span = Math.max(1, Math.min(x.length - st0 - N, Math.floor(R * 1.2)));
  const frames = x.length - st0 >= N ? 5 : 1;
  for (let k = 0; k < frames; k++) {
    const off = frames > 1 ? st0 + Math.floor(k * span / (frames - 1 || 1)) : Math.max(0, Math.min(st0, x.length - 256));
    const m = magSpectrum(x, off, N);
    let mx = 0; for (let i = 2; i < N / 2; i++) if (m[i] > mx) mx = m[i];
    if (mx <= 0) continue;
    for (let i = 2; i < N / 2 - 1; i++) {
      const hz = i * R / N;
      if (hz < 50 || hz > 2600) continue;
      if (m[i] < 0.05 * mx || m[i] < m[i - 1] || m[i] < m[i + 1]) continue;
      // parabolic peak position
      const a = m[i - 1], b = m[i], c = m[i + 1], den = a - 2 * b + c;
      const fi = i + (Math.abs(den) > 1e-12 ? 0.5 * (a - c) / den : 0);
      const midi = 69 + 12 * Math.log2(fi * R / N / 440);
      const pc = ((Math.round(midi) % 12) + 12) % 12;
      // low partials count more: they carry the played note
      chroma[pc] += (m[i] / mx) / Math.sqrt(1 + hz / 400);
    }
  }
  const tot = chroma.reduce((u, v) => u + v, 0);
  if (!(tot > 0)) return null;
  let best = -1, bs = -1, second = -1;
  for (let r = 0; r < 12; r++) {
    const sc = chroma[r] + 0.6 * chroma[(r + 7) % 12] + 0.25 * chroma[(r + 4) % 12] - 0.2 * chroma[(r + 1) % 12];
    if (sc > bs) { second = bs; bs = sc; best = r; } else if (sc > second) second = sc;
  }
  const power = chroma[(best + 7) % 12] > 0.45 * chroma[best];
  // octave nearest to the period detector (or around 110-440 Hz if it found nothing)
  const ref = info.f0Hz > 20 ? info.f0Hz : 220;
  const refMidi = 69 + 12 * Math.log2(ref / 440);
  const midi = best + 12 * Math.round((refMidi - best) / 12);
  const hz = 440 * Math.pow(2, (midi - 69) / 12);
  return { f0norm: hz / R, f0Hz: hz, pc: best, power, conf: (bs - Math.max(0, second)) / (bs + 1e-9) };
}
