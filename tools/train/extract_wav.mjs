// Features for a loose WAV sample library (name labels + acoustic sanity checks).
// The audio is resampled to typical Amiga rates and 8-bit quantised, so the features
// match what the app sees in MODs. Usage statistics are drawn from class-typical ranges.
// usage: node extract_wav.mjs <wavDir> <out.json> [shard/of]
import fs from 'fs';
import { analyzeSample, CLASSES, DRUM_CLASSES } from '../../src/core/features.js';
import { wavLabel } from './wavlabel.mjs';

const PAULA = 3546895;

function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function rngFor(s) { let a = hash(s); return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function readWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let p = 12, fmt = null, data = null, loop = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), len = buf.readUInt32LE(p + 4), b = p + 8;
    if (id === 'fmt ') fmt = { tag: buf.readUInt16LE(b), ch: buf.readUInt16LE(b + 2), rate: buf.readUInt32LE(b + 4), bits: buf.readUInt16LE(b + 14) };
    else if (id === 'data') data = buf.subarray(b, Math.min(buf.length, b + len));
    else if (id === 'smpl' && len >= 36 + 24 && buf.readUInt32LE(b + 28) > 0) loop = { start: buf.readUInt32LE(b + 36 + 8), end: buf.readUInt32LE(b + 36 + 12) };
    p = b + len + (len & 1);
  }
  if (!fmt || !data || fmt.tag !== 1) return null;
  const bps = fmt.bits / 8, n = Math.floor(data.length / (bps * fmt.ch));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let c = 0; c < fmt.ch; c++) {
      const o = (i * fmt.ch + c) * bps;
      v += fmt.bits === 8 ? (data[o] - 128) / 128 : fmt.bits === 16 ? data.readInt16LE(o) / 32768 : fmt.bits === 24 ? (data.readIntLE(o, 3)) / 8388608 : 0;
    }
    x[i] = v / fmt.ch;
  }
  return { x, rate: fmt.rate, loop };
}

// box-filtered linear resampling to an Amiga rate, then 8-bit
export function toAmiga(x, rate, R, maxLen = 131070) {
  const ratio = rate / R, n = Math.min(maxLen, Math.floor(x.length / ratio));
  const out = new Int8Array(n); const w = Math.max(1, Math.round(ratio));
  let peak = 1e-9; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  const g = Math.min(4, 0.95 / peak);
  for (let i = 0; i < n; i++) {
    const c = i * ratio; let s = 0, k = 0;
    for (let j = Math.floor(c - w / 2); j <= Math.floor(c + w / 2); j++) if (j >= 0 && j < x.length) { s += x[j]; k++; }
    out[i] = Math.max(-128, Math.min(127, Math.round(s / Math.max(1, k) * g * 127)));
  }
  return out;
}

const U = (r, a, b) => a + (b - a) * r();
const I = (r, a, b) => Math.floor(U(r, a, b + 1));
export function usageFor(cls, r, R) {
  const per = PAULA / (2 * R);
  let u;
  if (DRUM_CLASSES.has(cls)) u = { distinct: I(r, 1, 2), range: U(r, 0, 2), medianDur: [2, 4, 4, 8][I(r, 0, 3)], density: U(r, 0.03, 0.4) };
  else if (cls === 'beat') u = { distinct: I(r, 1, 2), range: U(r, 0, 2), medianDur: [16, 32, 64][I(r, 0, 2)], density: U(r, 0.005, 0.06) };
  else if (cls === 'speech') u = { distinct: I(r, 1, 2), range: U(r, 0, 3), medianDur: [8, 16, 32, 64][I(r, 0, 3)], density: U(r, 0.001, 0.02) };
  else if (cls === 'fx') u = { distinct: I(r, 1, 3), range: U(r, 0, 5), medianDur: [4, 8, 16, 32][I(r, 0, 3)], density: U(r, 0.002, 0.03) };
  else if (cls === 'chord') u = { distinct: I(r, 1, 5), range: U(r, 0, 7), medianDur: [2, 4, 8, 16][I(r, 0, 3)], density: U(r, 0.02, 0.15) };
  else if (cls === 'bass') u = { distinct: I(r, 3, 12), range: U(r, 7, 24), medianDur: [1, 2, 2, 4][I(r, 0, 3)], density: U(r, 0.1, 0.45) };
  else if (['pad', 'strings', 'choir'].includes(cls)) u = { distinct: I(r, 3, 10), range: U(r, 5, 20), medianDur: [8, 16, 16, 32][I(r, 0, 3)], density: U(r, 0.02, 0.12) };
  else u = { distinct: I(r, 4, 14), range: U(r, 7, 26), medianDur: [1, 2, 4, 8][I(r, 0, 3)], density: U(r, 0.05, 0.3) };
  const beatr = { kick: [0.6, 1], snare: [0.3, 1], hihat: [0.15, 0.6], cymbal: [0.5, 1], pad: [0.6, 1], strings: [0.5, 1], chord: [0.4, 1], speech: [0.4, 1], fx: [0.3, 1], beat: [0.8, 1] }[cls] || [0.2, 0.8];
  return { ...u, medianPeriod: per, hits: 10, beatFrac: U(r, ...beatr) };
}

// acoustic plausibility of a name label (drop when the sound contradicts it)
export function plausible(cls, info, f) {
  const d = info.durS;
  if (info.empty || d < 0.015) return false;
  switch (cls) {
    case 'kick': return d < 2.5 && info.centroid < 2000 && info.low > 0.25;
    case 'snare': return d < 2.5 && info.flatness > 0.15;
    case 'hihat': return d < 2.5 && info.centroid > 1500;
    case 'cymbal': return info.centroid > 1500 && d > 0.15;
    case 'tom': return d < 3 && info.centroid < 3000;
    case 'perc': return d < 3;
    case 'beat': return d > 0.4 && info.onsets && info.onsets.length >= 3;
    case 'speech': return d > 0.2;
    case 'bass': return info.pitchConf > 0.4 && (!info.f0Hz || info.f0Hz < 400);
    case 'chord': return d > 0.1;
    case 'fx': return true;
    case 'pad': case 'strings': case 'choir': return d > 0.3;
    default: return info.pitchConf > 0.35;
  }
}

if (import.meta.url === 'file://' + fs.realpathSync(process.argv[1])) {
const [dir, out, shardArg = '0/1'] = process.argv.slice(2);
const [shard, of] = shardArg.split('/').map(Number);
const files = fs.readdirSync(dir).filter(f => /\.wav$/i.test(f)).sort().filter((_, i) => i % of === shard);
const rows = []; const cnt = {}; let rej = 0; const seen = new Set();
for (const f of files) {
  const cls = wavLabel(f); if (!cls) continue;
  const buf = fs.readFileSync(dir + '/' + f);
  const key = buf.length + ':' + hash(buf.subarray(0, Math.min(buf.length, 4096)).toString('latin1'));
  if (seen.has(key)) continue; seen.add(key);
  const w = readWav(buf); if (!w || w.x.length < 64) continue;
  const r = rngFor(f);
  // Most library WAVs are raw Amiga samples saved with a bogus 44.1 kHz header:
  // their real playback rate is that of a MOD note (8–17 kHz). Keep such data as is.
  const raw = w.rate >= 32000 && w.x.length < 140000;
  const rates = [8287, 8287, 11025, 16574];
  const R = rates[I(r, 0, rates.length - 1)];
  const srcRate = raw ? R : w.rate;
  const data = toAmiga(w.x, srcRate, R);
  let ls = 0, ll = 0;
  if (w.loop && w.loop.end > w.loop.start) { ls = Math.floor(w.loop.start * R / srcRate) & ~1; ll = Math.min(data.length, Math.floor(w.loop.end * R / srcRate)) - ls & ~1; if (ll < 4) ls = ll = 0; }
  const s = { data, length: data.length, loopStart: ls, loopLength: ll, looped: ll > 2, volume: 64, name: f };
  const u = usageFor(cls, r, R);
  const a = analyzeSample(s, u);
  if (!plausible(cls, a.info, a.features)) { rej++; continue; }
  rows.push({ y: CLASSES.indexOf(cls), x: a.features, src: 'wav:' + f });
  cnt[cls] = (cnt[cls] || 0) + 1;
}
fs.writeFileSync(out, JSON.stringify(rows));
console.error('shard', shard, 'rows', rows.length, 'rejected', rej, JSON.stringify(cnt));
}
