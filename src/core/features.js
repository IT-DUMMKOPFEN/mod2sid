// mod2sid – sample analysis: audio features, pitch, envelope, chord detection
// (c) IT-DUMMKOPFEN, GPL-3.0
import { PAULA_PAL } from './mod.js';

export const CLASSES = ['kick', 'snare', 'hihat', 'cymbal', 'tom', 'perc', 'bass', 'lead', 'pad',
  'strings', 'brass', 'wood', 'guitar', 'keys', 'bell', 'choir', 'chord', 'fx', 'speech', 'beat'];
export const DRUM_CLASSES = new Set(['kick', 'snare', 'hihat', 'cymbal', 'tom', 'perc']);

export const FEATURE_NAMES = ['logDur', 'looped', 'logAttack', 'logDecay', 'sustain', 'logCentroid', 'logRolloff',
  'flatness', 'flatEarly', 'zcr', 'lowRatio', 'midRatio', 'highRatio', 'harmonicity', 'logF0', 'pitchStab',
  'chordness', 'envMod', 'flux', 'useNotes', 'useRange', 'useDur', 'useDensity', 'usePitch', 'pitchDrop',
  'hfDecay', 'centroidVar', 'logLen', 'loopRatio', 'peakiness', 'useBeat', 'onsetRate', 'onsetCount', 'ioiRegularity'];

// ---------------- FFT ----------------
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}

function magSpectrum(x, off, n) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (n - 1));
    re[i] = (x[off + i] || 0) * w;
  }
  fft(re, im);
  const m = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) m[i] = Math.hypot(re[i], im[i]);
  return m;
}

// expand a sample into float audio (loop repeated up to minLen)
export function sampleAudio(s, minLen = 0) {
  const d = s.data; const n = d.length;
  const lend = s.looped ? Math.min(n, s.loopStart + s.loopLength) : n;
  const len = s.looped ? Math.max(lend, minLen) : n;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let k = i;
    if (s.looped && k >= lend) k = s.loopStart + ((k - s.loopStart) % s.loopLength);
    out[i] = (d[k] || 0) / 128;
  }
  return out;
}

// ---------------- pitch (YIN) on native sample indices ----------------
function yin(x, start, W, minLag, maxLag) {
  const d = new Float64Array(maxLag + 1);
  for (let tau = 1; tau <= maxLag; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const a = x[start + i] - x[start + i + tau]; s += a * a; }
    d[tau] = s;
  }
  let run = 0; const cm = new Float64Array(maxLag + 1); cm[0] = 1;
  for (let tau = 1; tau <= maxLag; tau++) { run += d[tau]; cm[tau] = run > 0 ? d[tau] * tau / run : 1; }
  let gmin = 1e9;
  for (let tau = Math.max(2, minLag); tau <= maxLag; tau++) gmin = Math.min(gmin, cm[tau]);
  const thr = Math.max(0.12, gmin * 1.6 + 0.04);
  let best = -1;
  for (let tau = Math.max(2, minLag); tau <= maxLag; tau++) {
    if (cm[tau] <= thr) { while (tau + 1 <= maxLag && cm[tau + 1] < cm[tau]) tau++; best = tau; break; }
  }
  if (best < 0) best = maxLag;
  // parabolic interpolation
  let t = best;
  if (best > 1 && best < maxLag) {
    const a = cm[best - 1], b = cm[best], c = cm[best + 1];
    const den = a - 2 * b + c; if (Math.abs(den) > 1e-12) t = best + 0.5 * (a - c) / den;
  }
  return { period: t, conf: 1 - Math.min(1, cm[best]) };
}

// ---------------- usage statistics from replay ----------------
export function sampleUsage(replay) {
  const use = {};
  const rows = replay.rows;
  const NC = rows.length ? rows[0].ticks[0].length : 4;
  const lastTrig = new Array(NC).fill(null);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (let c = 0; c < NC; c++) {
      const t0 = r.ticks[0][c];
      const trig = r.ticks.some(t => t[c].trig);
      const tt = trig ? r.ticks.find(t => t[c].trig) : null;
      if (trig && tt[c].smp) {
        const u = (use[tt[c].smp] ||= { hits: 0, periods: [], durs: [], chans: new Set(), vols: [], beat: 0 });
        u.hits++; if (r.row % 4 === 0) u.beat++; u.periods.push(tt[c].base); u.chans.add(c); u.vols.push(tt[c].vol);
        if (lastTrig[c]) { const L = lastTrig[c]; use[L.smp].durs.push(i - L.row); }
        lastTrig[c] = { smp: tt[c].smp, row: i };
      }
    }
  }
  for (let c = 0; c < NC; c++) if (lastTrig[c]) use[lastTrig[c].smp].durs.push(8);
  const total = rows.length;
  for (const k in use) {
    const u = use[k];
    const ps = u.periods.slice().sort((a, b) => a - b);
    u.medianPeriod = ps[ps.length >> 1];
    const semis = u.periods.map(p => 12 * Math.log2(428 / p));
    u.distinct = new Set(u.periods.map(p => Math.round(12 * Math.log2(428 / p)))).size;
    u.range = Math.max(...semis) - Math.min(...semis);
    const ds = u.durs.slice().sort((a, b) => a - b);
    u.medianDur = ds.length ? ds[ds.length >> 1] : 4;
    u.density = u.hits / Math.max(1, total);
    u.chans = [...u.chans];
    u.beatFrac = u.beat / Math.max(1, u.hits);
  }
  return use;
}

// ---------------- main analysis ----------------
const TEMPLATES = [
  { name: 'maj', iv: [0, 4, 7] }, { name: 'min', iv: [0, 3, 7] }, { name: 'sus4', iv: [0, 5, 7] },
  { name: 'pow', iv: [0, 7] }, { name: 'maj7', iv: [0, 4, 7, 11] }, { name: 'min7', iv: [0, 3, 7, 10] },
  { name: 'dom7', iv: [0, 4, 7, 10] }, { name: 'dim', iv: [0, 3, 6] }, { name: 'aug', iv: [0, 4, 8] },
];

export function analyzeSample(s, u) {
  const f = new Float64Array(FEATURE_NAMES.length);
  const info = { f0norm: 0, pitchConf: 0, chord: null, attack: 0, decay: 0, sustain: 0, empty: false };
  if (!s.data || s.data.length < 32) { info.empty = true; return { features: Array.from(f), info }; }
  const per = (u && u.medianPeriod) || 214;
  const rate = PAULA_PAL / (2 * per);           // playback rate in Hz
  const audio = sampleAudio(s, Math.round(rate * 1.5));
  const n = audio.length;
  const durS = (s.looped ? Math.max(n, rate * 1.5) : s.data.length) / rate;
  // envelope (5 ms frames)
  const hop = Math.max(8, Math.round(rate * 0.005));
  const env = [];
  for (let i = 0; i + hop <= n; i += hop) {
    let e = 0; for (let k = 0; k < hop; k++) e += audio[i + k] * audio[i + k];
    env.push(Math.sqrt(e / hop));
  }
  if (!env.length) env.push(0);
  let peak = 0, pk = 0; env.forEach((v, i) => { if (v > peak) { peak = v; pk = i; } });
  if (peak < 1e-4) { info.empty = true; return { features: Array.from(f), info }; }
  const attack = (pk + 1) * hop / rate;
  let dk = env.length - 1;
  for (let i = pk; i < env.length; i++) if (env[i] < peak * 0.1) { dk = i; break; }
  const decay = (dk - pk + 1) * hop / rate;
  const tail = env.slice(Math.floor(env.length * 0.7));
  const sustain = tail.reduce((a, b) => a + b, 0) / Math.max(1, tail.length) / peak;
  let envMod = 0;
  for (let i = 1; i < env.length; i++) envMod += Math.abs(env[i] - env[i - 1]);
  envMod /= (env.length * peak);
  // spectra over frames of 1024 at playback rate
  const N = 1024;
  const frames = [];
  const maxFrames = 24;
  const step = Math.max(N / 2, Math.floor((Math.min(n, rate * 1.2) - N) / maxFrames));
  for (let off = 0; off + N <= n && frames.length < maxFrames; off += step) frames.push(off);
  if (!frames.length) frames.push(0);
  const binHz = rate / N;
  let cen = 0, roll = 0, flat = 0, flatE = 0, low = 0, mid = 0, high = 0, flux = 0, wsum = 0;
  const cens = []; let prev = null; let hfFirst = 0, hfLast = 0;
  const chroma = new Float64Array(12);
  frames.forEach((off, fi) => {
    const m = magSpectrum(audio, off, N);
    let tot = 0, c = 0, lg = 0, cnt = 0, lo = 0, mi = 0, hi = 0;
    for (let i = 1; i < m.length; i++) {
      const hz = i * binHz, p = m[i] * m[i];
      tot += p; c += hz * p; lg += Math.log(m[i] + 1e-9); cnt++;
      if (hz < 150) lo += p; else if (hz < 2000) mi += p; else if (hz > 5000) hi += p;
      if (hz > 55 && hz < 4200) {
        const pc = ((Math.round(12 * Math.log2(hz / 261.6256)) % 12) + 12) % 12;
        chroma[pc] += p;
      }
    }
    if (tot <= 0) return;
    const am = m.reduce((a, b) => a + b, 0) / m.length;
    const fl = Math.exp(lg / cnt) / (am + 1e-12);
    let acc = 0, ro = 0;
    for (let i = 1; i < m.length; i++) { acc += m[i] * m[i]; if (acc >= 0.85 * tot) { ro = i * binHz; break; } }
    const w = Math.sqrt(tot);
    cen += (c / tot) * w; roll += ro * w; flat += fl * w; wsum += w;
    cens.push(c / tot);
    if (fi === 0) flatE = fl;
    low += lo / tot * w; mid += mi / tot * w; high += hi / tot * w;
    if (prev) { let fx = 0; for (let i = 0; i < m.length; i++) fx += Math.abs(m[i] - prev[i]); flux += fx / (m.reduce((a, b) => a + b, 0) + 1e-9); }
    prev = m;
    const hf = hi / tot * w; if (fi === 0) hfFirst = hf; hfLast = hf;
  });
  wsum = wsum || 1;
  cen /= wsum; roll /= wsum; flat /= wsum; low /= wsum; mid /= wsum; high /= wsum;
  flux /= Math.max(1, frames.length - 1);
  const cmean = cens.reduce((a, b) => a + b, 0) / Math.max(1, cens.length);
  const cvar = Math.sqrt(cens.reduce((a, b) => a + (b - cmean) ** 2, 0) / Math.max(1, cens.length)) / (cmean + 1);
  // zcr
  let z = 0; for (let i = 1; i < Math.min(n, rate); i++) if ((audio[i] >= 0) !== (audio[i - 1] >= 0)) z++;
  const zcr = z / Math.min(n, rate);
  // pitch on native indices: analyse a steady window
  const raw = sampleAudio(s, 8192);
  const minLag = Math.max(2, Math.floor(rate / 2500 * (raw.length ? 1 : 1)));
  const lagScale = 1; // native index lag == playback sample lag
  const maxLag = Math.min(1400, Math.floor(rate / 28));
  const W = Math.max(256, Math.min(1024, raw.length - maxLag - 2));
  const tracks = [];
  const pstart = Math.min(Math.floor(raw.length * 0.15), Math.max(0, raw.length - W - maxLag - 1));
  for (let k = 0; k < 6; k++) {
    const st = pstart + k * Math.floor(W / 2);
    if (st + W + maxLag >= raw.length) break;
    tracks.push(yin(raw, st, W, minLag * lagScale, maxLag));
  }
  let f0norm = 0, conf = 0, stab = 1;
  if (tracks.length) {
    const good = tracks.filter(t => t.conf > 0.5);
    const use = good.length ? good : tracks;
    const ps = use.map(t => t.period).sort((a, b) => a - b);
    const P = ps[ps.length >> 1];
    f0norm = 1 / P; conf = use.reduce((a, t) => a + t.conf, 0) / use.length;
    const ss = use.map(t => 12 * Math.log2(P / t.period));
    stab = Math.sqrt(ss.reduce((a, b) => a + b * b, 0) / ss.length);
  }
  // octave-error correction: if odd harmonics of f0 carry little energy, the true pitch is 2*f0
  if (f0norm > 0 && raw.length >= 2048) {
    const NN = 4096, m = magSpectrum(raw, Math.max(0, Math.min(raw.length - NN, pstart)), Math.min(NN, 1 << Math.floor(Math.log2(raw.length))));
    const NN2 = m.length * 2;
    for (let it = 0; it < 2; it++) {
      const bin = f0norm * NN2; if (bin < 1.5) break;
      let odd = 0, even = 0;
      for (let k = 1; k <= 12; k++) {
        const c = Math.round(k * bin); if (c >= m.length - 2) break;
        const e = Math.max(m[c - 1], m[c], m[c + 1]) ** 2;
        if (k % 2) odd += e; else even += e;
      }
      if (even > 0 && odd / even < 0.2) f0norm *= 2; else break;
    }
  }
  // pitch drop: early vs later pitch (kick / tom detection)
  let pitchDrop = 0;
  if (raw.length > maxLag * 3) {
    const e = yin(raw, 0, Math.min(W, 256), minLag, Math.min(maxLag, 600));
    const l = yin(raw, Math.min(raw.length - Math.min(maxLag, 600) - 260, Math.floor(rate * 0.06)), 256, minLag, Math.min(maxLag, 600));
    if (e.conf > 0.3 && l.conf > 0.3) pitchDrop = 12 * Math.log2(l.period / e.period);
  }
  const f0Hz = f0norm * rate;
  // chord detection
  const cmax = Math.max(...chroma) || 1;
  const cn = Array.from(chroma, v => v / cmax);
  const strong = cn.filter(v => v > 0.35).length;
  let bestT = null, bestScore = 0, bestRoot = 0;
  for (const T of TEMPLATES) for (let r = 0; r < 12; r++) {
    let inS = 0, outS = 0;
    for (let pc = 0; pc < 12; pc++) { const iv = (pc - r + 12) % 12; if (T.iv.includes(iv)) inS += cn[pc]; else outS += cn[pc]; }
    const sc = inS / T.iv.length - outS / (12 - T.iv.length) * 1.5 + (T.iv.length >= 3 ? 0.05 : 0);
    if (sc > bestScore) { bestScore = sc; bestT = T; bestRoot = r; }
  }
  // onsets (beat / loop detection) on the one-shot audio
  const one = sampleAudio({ ...s, looped: false }, 0);
  const durOne = one.length / rate;
  const onsets = detectOnsets(one, rate);
  let ioiReg = 0;
  if (onsets.length >= 3) {
    const io = []; for (let i = 1; i < onsets.length; i++) io.push(onsets[i].t - onsets[i - 1].t);
    const m = io.reduce((a, b) => a + b, 0) / io.length;
    const sd = Math.sqrt(io.reduce((a, b) => a + (b - m) ** 2, 0) / io.length);
    // regularity: how well the onsets fit a grid of the smallest common step
    const step = Math.min(...io.filter(x => x > 0.04));
    const fit = io.reduce((a, x) => a + Math.abs(x / step - Math.round(x / step)), 0) / io.length;
    ioiReg = Math.max(0, 1 - fit * 2) * (sd / (m + 1e-9) < 2 ? 1 : 0.5);
  }
  // usage
  const usePitch = u ? (f0Hz > 0 ? Math.log2(Math.max(20, f0Hz)) : Math.log2(cen + 1)) : Math.log2(cen + 1);
  const lp = s.looped ? s.loopLength / Math.max(1, s.data.length) : 0;
  let pkn = 0; { let mx = 0, sm = 0; for (let i = 0; i < Math.min(n, rate); i++) { const a = Math.abs(audio[i]); mx = Math.max(mx, a); sm += a * a; } pkn = mx / (Math.sqrt(sm / Math.min(n, rate)) + 1e-9); }
  const vals = [Math.log2(durS + 0.01), s.looped ? 1 : 0, Math.log2(attack + 0.001), Math.log2(decay + 0.001), Math.min(1.5, sustain),
    Math.log2(cen + 1), Math.log2(roll + 1), flat, flatE, zcr, low, mid, high, conf, Math.log2(f0Hz + 1), Math.min(3, stab),
    strong / 12, Math.min(2, envMod * 10), Math.min(2, flux), u ? Math.log2(1 + u.distinct) : 0, u ? Math.min(3, u.range / 24) : 0,
    u ? Math.log2(1 + u.medianDur) : 2, u ? Math.min(1, u.density * 4) : 0, usePitch, Math.max(-24, Math.min(24, pitchDrop)) / 12,
    Math.log2((hfLast + 1e-4) / (hfFirst + 1e-4)) / 4, Math.min(2, cvar * 4), Math.log2(s.data.length + 1), lp, Math.min(8, pkn) / 8, u && u.beatFrac !== undefined ? u.beatFrac : 0.5,
    Math.min(16, onsets.length / Math.max(0.05, durOne)) / 8, Math.log2(1 + onsets.length) / 4, ioiReg];
  vals.forEach((v, i) => { f[i] = Number.isFinite(v) ? v : 0; });
  Object.assign(info, {
    f0norm, f0Hz, pitchConf: conf, rate, refPeriod: per, attack, decay, sustain, centroid: cen, flatness: flat, durS,
    chord: (bestT && bestT.iv.length >= 3 && strong >= 3 && bestScore > 0.42) ? { type: bestT.name, iv: bestT.iv, rootPc: bestRoot, score: bestScore } : null,
    chroma: cn, pitchDrop, low, high, envMod, onsets, durOne,
  });
  return { features: Array.from(f), info };
}

// MIDI-like GT note (0 = C-0) of a sample triggered at Amiga period p
export function realNote(info, period) {
  if (!info.f0norm || !period) return null;
  const hz = info.f0norm * PAULA_PAL / (2 * period);
  return 12 * Math.log2(hz / 440) + 57;
}


// ---------------- onset detection (energy flux, 5 ms hop) ----------------
export function detectOnsets(x, rate, { minGap = 0.045 } = {}) {
  const hop = Math.max(16, Math.round(rate * 0.005));
  const n = Math.floor(x.length / hop);
  if (n < 4) return x.length ? [{ t: 0, strength: 1, i: 0 }] : [];
  const e = new Float64Array(n), hf = new Float64Array(n);
  for (let k = 0; k < n; k++) {
    let s = 0, d = 0, prev = x[k * hop] || 0;
    for (let i = 0; i < hop; i++) { const v = x[k * hop + i] || 0; s += v * v; d += (v - prev) * (v - prev); prev = v; }
    e[k] = Math.log10(1e-6 + s / hop) * 10; hf[k] = Math.log10(1e-6 + d / hop) * 10;
  }
  const peak = Math.max(...e);
  const out = [];
  let last = -1e9;
  for (let k = 0; k < n; k++) {
    let base = Infinity; for (let j = Math.max(0, k - 6); j < k; j++) base = Math.min(base, e[j]);
    if (k === 0) base = -60;
    const rise = e[k] - base, rise2 = k ? hf[k] - Math.min(...Array.from(hf.slice(Math.max(0, k - 6), k))) : 60;
    const t = k * hop / rate;
    if ((rise > 7 || rise2 > 10) && e[k] > peak - 30 && t - last >= minGap) {
      // refine to the local energy maximum within 20 ms
      let best = k; for (let j = k; j < Math.min(n, k + 4); j++) if (e[j] > e[best]) best = j;
      out.push({ t, strength: rise, i: k * hop });
      last = t;
    }
  }
  if (!out.length || out[0].t > 0.03) out.unshift({ t: 0, strength: 10, i: 0 });
  return out;
}

// ---------------- pitch contour, one value per SID frame (20 ms) ----------------
export function pitchContour(s, rate, frameSec = 0.02) {
  const x = sampleAudio({ ...s, looped: false }, 0);
  const hop = Math.max(1, Math.round(rate * frameSec));
  const maxLag = Math.min(1200, Math.floor(rate / 60)), minLag = Math.max(2, Math.floor(rate / 1100));
  const W = Math.max(128, Math.min(512, maxLag));
  const frames = [];
  let peak = 1e-9;
  for (let st = 0; st + 8 < x.length; st += hop) {
    let e = 0, z = 0; const end = Math.min(x.length, st + hop);
    for (let i = st; i < end; i++) { e += x[i] * x[i]; if (i > st && (x[i] >= 0) !== (x[i - 1] >= 0)) z++; }
    const rms = Math.sqrt(e / Math.max(1, end - st)); peak = Math.max(peak, rms);
    let f0 = 0, conf = 0;
    if (st + W + maxLag < x.length) { const y = yin(x, st, W, minLag, maxLag); conf = y.conf; f0 = 1 / y.period; }
    frames.push({ f0, conf, rms, zcr: z / Math.max(1, end - st) });
  }
  return frames.map(f => ({ ...f, level: f.rms / peak }));
}
