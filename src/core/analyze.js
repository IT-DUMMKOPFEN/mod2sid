// mod2sid – per-sample analysis, classification and instrument choice
// (c) IT-DUMMKOPFEN, GPL-3.0
import { analyzeSample, sampleUsage, realNote, DRUM_CLASSES } from './features.js';
import { classify } from './classifier.js';
import { CLASS_PRESETS, PRESET_BY_ID } from './library.js';
import { decomposeBeat, voiceWavetable } from './beat.js';

export const WEIGHT = { lead: 10, wood: 9, brass: 8, bass: 9, kick: 8, snare: 8, guitar: 8, keys: 7, strings: 6, chord: 6,
  bell: 6, pad: 5, choir: 5, tom: 5, perc: 4, hihat: 3.5, cymbal: 3, fx: 2, speech: 6, beat: 8 };

const ATT_T = [0.002, 0.008, 0.016, 0.024, 0.038, 0.056, 0.068, 0.08, 0.1, 0.25, 0.5, 0.8, 1, 3, 5, 8];
const DEC_T = [0.006, 0.024, 0.048, 0.072, 0.114, 0.168, 0.204, 0.24, 0.3, 0.75, 1.5, 2.4, 3, 9, 15, 24];
const nearest = (tab, v) => { let b = 0, bd = 1e9; tab.forEach((t, i) => { const d = Math.abs(Math.log((t + 1e-4) / (v + 1e-4))); if (d < bd) { bd = d; b = i; } }); return b; };

export function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function descriptor(info, s) {
  const f0 = info.f0Hz > 30 ? info.f0Hz : 200;
  const bright = Math.max(0, Math.min(1, Math.log2(Math.max(1, info.centroid) / f0) / 3.5));
  const slow = Math.max(0, Math.min(1, Math.log2(Math.max(0.005, info.attack) / 0.01) / 6));
  const sus = Math.max(0, Math.min(1, (s.looped ? 1.2 : 1) * info.sustain));
  return { bright, slow, sus };
}

export function rankPresets(cls, d) {
  const list = CLASS_PRESETS[cls] || CLASS_PRESETS.lead;
  return list.map((id, k) => {
    const pd = PRESET_BY_ID[id].desc;
    const dist = Math.hypot(pd.bright - d.bright, (pd.slow - d.slow) * 1.2, (pd.sus - d.sus) * 1.1) + k * 0.04;
    return { id, dist };
  }).sort((a, b) => a.dist - b.dist).map(x => x.id);
}

// fitted ADSR from the sample's envelope
export function fitADSR(preset, info, s, cls) {
  if (preset.cat === 'drums' || preset.drum || preset.cat === 'fx' || preset.cat === 'auto' || preset.id === 'mute') return { ad: preset.ad, sr: preset.sr };
  const longOne = !s.looped && s.data.length / info.rate;
  if ((cls === 'strings' || cls === 'pad' || cls === 'choir' || preset.cat === 'strings' || preset.cat === 'pad') && (s.looped || longOne > 0.6)) {
    // long strings / pads: keep the swell, hold the note for the whole sample, release like its tail
    const a = nearest(ATT_T, Math.max(0.002, info.attack * 0.9));
    const S = Math.max(10, Math.round(Math.min(1, Math.max(0.6, info.sustain * 1.4)) * 15));
    const rel = s.looped ? 0.3 : Math.max(0.1, Math.min(2.4, info.decay * 0.6, longOne * 0.4));
    return { ad: (a << 4) | 0x0, sr: (S << 4) | nearest(DEC_T, rel) };
  }
  const pa = preset.ad >> 4, pdk = preset.ad & 15, ps = preset.sr >> 4, pr = preset.sr & 15;
  const a = info.attack > 0.03 ? nearest(ATT_T, info.attack * 0.8) : Math.min(pa, 1);
  let sus = s.looped ? Math.round(Math.min(1, info.sustain * 1.35) * 15) : (info.sustain > 0.45 ? Math.round(info.sustain * 15) : 0);
  if (s.looped) sus = Math.max(sus, 6);
  const d = nearest(DEC_T, Math.max(0.05, info.decay) * (sus ? 0.7 : 1.1));
  // blend with preset character (keeps presets recognisable)
  const A = Math.round((a * 2 + pa) / 3), D = Math.round((d * 2 + pdk) / 3), S = Math.round((sus * 2 + ps) / 3);
  return { ad: (A << 4) | D, sr: (S << 4) | pr };
}

// single-cycle synth waveforms (OctaMED / Art Of Noise synth instruments): closest SID waveform
export function detectSynthWave(data) {
  const n = data.length;
  if (n < 8 || n > 512) return null;
  let mx = 1e-9, mean = 0; for (const v of data) { mx = Math.max(mx, Math.abs(v)); mean += v; } mean /= n;
  const x = Array.from(data, v => (v - mean) / mx);
  const norm = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0)) || 1;
  const nx = norm(x);
  const corr = (f) => { let best = -1; for (let sh = 0; sh < n; sh += Math.max(1, n >> 6)) { const r = Array.from({ length: n }, (_, i) => f(((i + sh) % n) / n)); const c = Math.abs(r.reduce((s, v, i) => s + v * x[i], 0)) / (nx * norm(r)); best = Math.max(best, c); } return best; };
  const saw = corr(t => 2 * t - 1), tri = corr(t => (t < 0.5 ? 4 * t - 1 : 3 - 4 * t));
  const pos = x.filter(v => v > 0).length / n;
  const flat = x.filter(v => Math.abs(v) > 0.7).length / n;
  const sq = corr(t => (t < pos ? 1 : -1));
  const best = Math.max(saw, tri, sq);
  if (best < 0.6) return null;
  if (sq === best || flat > 0.85) return { wave: 0x41, pw: Math.max(0x100, Math.min(0xF00, Math.round(Math.min(pos, 1 - pos) * 4095))), score: best };
  return saw === best ? { wave: 0x21, pw: 0x800, score: best } : { wave: 0x11, pw: 0x800, score: best };
}

export function analyzeMod(mod, replay, { seed = 1, creativity = 0, memory = [] } = {}) {
  const usage = sampleUsage(replay);
  const R = rng(seed * 7919 + 13);
  const out = [];
  for (const s of mod.samples) {
    const u = usage[s.index];
    if (!u || !s.data || s.data.length < 4) { out.push({ index: s.index, name: s.name, used: false }); continue; }
    const { features, info } = analyzeSample(s, u);
    const ranking = classify(features, info, s.name, memory);
    let cls = ranking[0].cls;
    // re-convert: sometimes take the runner-up class if it is close
    if (creativity > 0 && ranking[1].p > ranking[0].p * (1 - 0.5 * creativity) && R() < 0.5 * creativity) cls = ranking[1].cls;
    if (cls === 'chord' && !info.chord) cls = ranking.find(r => r.cls !== 'chord').cls;
    // only mute as speech when the model is quite sure
    if (cls === 'speech' && ranking[0].p < 0.45) cls = ranking.find(r => r.cls !== 'speech' && r.cls !== 'chord').cls;
    // learned user choice for a very similar sample overrides everything
    let learned = null;
    if (memory && memory.length) {
      let bd = 1e9;
      for (const m of memory) { if (!m.preset) continue; let dd = 0; for (let i = 0; i < features.length; i++) { const q = features[i] - m.f[i]; dd += q * q; } if (dd < bd) { bd = dd; learned = m; } }
      if (!(bd < 0.02 * features.length)) learned = null;
      if (learned) cls = learned.cls || cls;
    }
    // a drum loop that does not split into hits is treated as its loudest drum
    let beat = null, voice = null;
    if (cls === 'beat') {
      // only a real drum loop: confident model, played on few notes, several drum hits
      const pb = ranking.find(r => r.cls === 'beat').p;
      beat = (pb >= 0.4 && u.distinct <= 3 && info.durS > 0.35) ? decomposeBeat(s, info) : null;
      if (beat && (beat.hits.length < 3 || beat.hits.length / Math.max(0.1, beat.duration) > 14)) beat = null;
      if (!beat) cls = ranking.find(r => r.cls !== 'beat' && r.cls !== 'speech').cls;
    }
    if (cls === 'speech') voice = voiceWavetable(s, info);
    const d = descriptor(info, s);
    const presets = rankPresets(cls, d);
    let pick = 0;
    if (creativity > 0) { const r = R(); if (r < 0.45 * creativity) pick = 1; else if (r < 0.6 * creativity) pick = 2; }
    pick = Math.min(pick, presets.length - 1);
    if (cls === 'speech' && voice) { const k = presets.indexOf('voice_auto'); if (k > 0) presets.splice(k, 1); if (k !== 0) presets.unshift('voice_auto'); if (!creativity) pick = 0; }
    if (learned && PRESET_BY_ID[learned.preset]) { presets.unshift(learned.preset); pick = 0; }
    // note mapping: median real note -> sensible octave for the SID
    const ninfo = voice ? { ...info, f0norm: voice.ref } : info;
    const notes = u.periods.map(p => realNote(ninfo, p)).filter(n => n !== null);
    let med = notes.length ? notes.slice().sort((a, b) => a - b)[notes.length >> 1] : null;
    let shift = 0;
    if (med !== null) {
      const [lo, hi] = cls === 'bass' ? [21, 50] : DRUM_CLASSES.has(cls) ? [0, 95] : (cls === 'pad' || cls === 'chord' || cls === 'strings' || cls === 'speech') ? [36, 76] : [40, 84];
      while (med + shift < lo) shift += 12;
      while (med + shift > hi) shift -= 12;
    }
    out.push({
      index: s.index, name: s.name, used: true, features, info, ranking, cls, presets, presetId: presets[pick],
      noteShift: shift, medianNote: med, hits: u.hits, weight: WEIGHT[cls] ?? 5,
      sustained: s.looped || info.sustain > 0.35, lengthSec: s.looped ? 1e9 : s.data.length / info.rate,
      chord: (cls === 'chord' && info.chord) ? info.chord : null, learned: !!learned, beat, voice,
      synthWave: s.synth ? detectSynthWave(s.loopLength > 2 ? s.data.subarray(s.loopStart, s.loopStart + s.loopLength) : s.data) : null,
    });
  }
  return { samples: out, usage };
}
