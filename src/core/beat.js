// mod2sid – drum-loop ("beat") decomposition and voice pitch-contour instruments
// (c) IT-DUMMKOPFEN, GPL-3.0
import { sampleAudio, detectOnsets, pitchContour } from './features.js';

function fftMag(x, off, N) {
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) re[i] = (x[off + i] || 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
  for (let i = 1, j = 0; i < N; i++) { let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; } }
  for (let len = 2; len <= N; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < N; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2, tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti; re[p] += tr; im[p] += ti;
        const n = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = n;
      }
    }
  }
  const m = new Float64Array(N / 2); for (let i = 0; i < N / 2; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}

function segmentFeatures(x, a, b, rate) {
  const N = 512;
  const m = fftMag(x, a, N);
  let tot = 0, c = 0, lo = 0, hi = 0, lg = 0;
  for (let i = 1; i < m.length; i++) {
    const hz = i * rate / N, p = m[i] * m[i];
    tot += p; c += hz * p; lg += Math.log(m[i] + 1e-9);
    if (hz < 220) lo += p; if (hz > 3500) hi += p;
  }
  const am = m.reduce((s, v) => s + v, 0) / m.length;
  const flat = Math.exp(lg / (m.length - 1)) / (am + 1e-12);
  // decay: time until the envelope drops 20 dB below its segment peak
  const hop = Math.max(8, Math.round(rate * 0.005));
  let peak = 0, pk = a; const env = [];
  for (let i = a; i < b; i += hop) { let e = 0; for (let k = 0; k < hop && i + k < b; k++) e += x[i + k] * x[i + k]; e = Math.sqrt(e / hop); env.push(e); if (e > peak) { peak = e; pk = i; } }
  let dec = (b - a) / rate;
  for (let k = 0; k < env.length; k++) if (k * hop + a > pk && env[k] < peak * 0.1) { dec = (k * hop + a - pk) / rate; break; }
  return { cen: tot ? c / tot : 0, lo: tot ? lo / tot : 0, hi: tot ? hi / tot : 0, flat, dec, peak };
}

const DRUM_PICK = {
  kick: (f) => f.dec > 0.25 ? (f.cen < 250 ? 'kick_deep' : 'kick808') : (f.cen > 900 ? 'kick_click' : 'kick'),
  snare: (f) => f.flat > 0.55 ? (f.dec < 0.12 ? 'snare_tight' : 'snare_noise') : (f.dec > 0.2 ? 'snare_fat' : 'snare'),
  hihat: (f) => f.dec > 0.18 ? 'hihat_open' : (f.flat < 0.35 ? 'hihat_metal' : 'hihat'),
  cymbal: (f) => f.dec > 0.8 ? 'crash' : 'cymbal',
  tom: (f) => f.cen < 400 ? 'tom_low' : 'tom_high',
  perc: (f) => f.flat > 0.4 ? 'clap' : (f.cen > 1500 ? 'rim' : 'perc_blip'),
};

function drumType(f) {
  if (f.lo > 0.45 && f.cen < 700) return 'kick';
  if (f.hi > 0.35 && f.flat > 0.3) return f.dec > 0.6 ? 'cymbal' : 'hihat';
  if (f.flat > 0.28 && f.cen > 600) return 'snare';
  if (f.lo > 0.2 && f.cen < 1000) return 'tom';
  return 'perc';
}

// returns { hits:[{t, c, level}], clusters:[{type, presetId, count, f}] } or null
export function decomposeBeat(s, info) {
  const rate = info.rate;
  const x = sampleAudio({ ...s, looped: false }, 0);
  const on = (info.onsets && info.onsets.length) ? info.onsets : detectOnsets(x, rate);
  if (on.length < 2) return null;
  const segs = [];
  let maxPeak = 1e-9;
  for (let k = 0; k < on.length; k++) {
    const a = Math.round(on[k].t * rate), b = Math.min(x.length, k + 1 < on.length ? Math.round(on[k + 1].t * rate) : a + Math.round(rate * 0.5));
    if (b - a < 32) continue;
    const f = segmentFeatures(x, a, b, rate);
    maxPeak = Math.max(maxPeak, f.peak);
    segs.push({ t: on[k].t, f, type: drumType(f) });
  }
  const clusters = [];
  const vec = (f) => [Math.log2(Math.max(60, f.cen) / 1000), f.flat * 2, f.lo * 2, f.hi * 2, Math.log2(Math.max(0.02, f.dec) / 0.1) / 2];
  const hits = [];
  for (const sg of segs) {
    if (sg.f.peak < maxPeak * 0.12) continue; // ghost notes / reverb tails
    const v = vec(sg.f);
    let best = -1, bd = 1e9;
    clusters.forEach((c, i) => { if (c.type !== sg.type) return; const d = Math.hypot(...v.map((x, j) => x - c.v[j])); if (d < bd) { bd = d; best = i; } });
    if (best < 0 || (bd > 0.55 && clusters.length < 6)) {
      clusters.push({ type: sg.type, v, f: sg.f, count: 0, presetId: DRUM_PICK[sg.type](sg.f) });
      best = clusters.length - 1;
    }
    clusters[best].count++;
    hits.push({ t: sg.t, c: best, level: sg.f.peak / maxPeak });
  }
  if (hits.length < 2) return null;
  // clusters that end up on the same SID drum share one instrument
  const byPreset = new Map(), remap = [], out = [];
  clusters.forEach((c, i) => {
    if (!byPreset.has(c.presetId)) { byPreset.set(c.presetId, out.length); out.push({ type: c.type, presetId: c.presetId, count: 0, f: c.f }); }
    remap[i] = byPreset.get(c.presetId); out[remap[i]].count += c.count;
  });
  hits.forEach(h => { h.c = remap[h.c]; });
  return { hits, clusters: out, duration: x.length / rate };
}

// ---------------- voice: pitch contour -> wavetable ----------------
// steps in library wave notation, relative to the note that triggers the sample
export function voiceWavetable(s, info, { maxSteps = 48 } = {}) {
  const rate = info.rate;
  for (const frameSec of [0.02, 0.04, 0.06, 0.1, 0.16, 0.25, 0.4]) {
    const fr = pitchContour(s, rate, frameSec);
    if (!fr.length) return null;
    const isV = (f) => f.conf > 0.45 && f.f0 > 0 && f.level > 0.08;
    const voiced = fr.filter(isV).map(f => f.f0).sort((a, b) => a - b);
    // reference pitch: median of the voiced frames (the global estimate is unreliable for speech)
    const ref = voiced.length >= 2 ? voiced[voiced.length >> 1] : (info.pitchConf > 0.5 ? info.f0norm : 0);
    if (!ref) return null;
    let prev = ref;
    let st = fr.map(f => {
      if (f.level < 0.06) return 'gap';
      if (isV(f)) {
        let r = f.f0 / prev; // octave errors: fold jumps of about an octave back
        if (r > 1.8 && r < 2.25) r /= 2; else if (r < 0.56 && r > 0.44) r *= 2;
        const f0 = prev * r; prev = f0;
        return Math.max(-24, Math.min(36, Math.round(12 * Math.log2(f0 / ref))));
      }
      return f.zcr > 0.25 ? 'noise' : 'hold';
    });
    // median smoothing of pitch values
    st = st.map((v, i) => {
      if (typeof v !== 'number') return v;
      const w = [st[i - 1], v, st[i + 1]].filter(x => typeof x === 'number').sort((a, b) => a - b);
      return w[w.length >> 1];
    });
    const per = Math.max(1, Math.round(frameSec / 0.02)); // SID frames per contour frame
    const steps = []; let last = null; let run = 0;
    const flush = () => {
      if (last === null) return;
      if (last === 'gap') steps.push([0x40, 'k']);
      else if (last === 'noise') steps.push([0x81, { a: 84 }]);
      else if (last === 'hold') steps.push([0x00, 'k']);
      else steps.push([0x41, last]);
      let rest = run * per - 1;
      while (rest > 0) {
        const d = Math.min(15, rest - 1);
        if (d >= 1) { steps.push([d, 'k']); rest -= d + 1; } else { steps.push([0x00, 'k']); rest -= 1; }
      }
    };
    // trailing silence is cut, the envelope release does the rest
    while (st.length && st[st.length - 1] === 'gap') st.pop();
    for (const v of st) { if (v === last) run++; else { flush(); last = v; run = 1; } }
    flush();
    steps.push([0x40, 'k'], ['S']);
    if (steps.length <= maxSteps) return { steps, frames: fr.length, frameSec, ref };
  }
  return null;
}
