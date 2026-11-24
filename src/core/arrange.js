// mod2sid – arranger: 4 Amiga channels -> 3 SID voices, effect translation, GoatTracker song
// (c) IT-DUMMKOPFEN, GPL-3.0
import { PAULA_PAL } from './mod.js';
import { realNote, DRUM_CLASSES } from './features.js';
import { PRESET_BY_ID, presetName } from './library.js';
import { GTSong, REST, KEYOFF, MAX_PATTERNS } from './gtsong.js';
import { fitADSR, rng, WEIGHT } from './analyze.js';
import { decomposeBeat, voiceWavetable } from './beat.js';

const PAL = 985248;
export const FREQ = Array.from({ length: 96 }, (_, n) => Math.min(0xFFFF, Math.round(440 * 2 ** ((n - 57) / 12) * 16777216 / PAL)));
const clampNote = (n) => { n = Math.round(n); while (n > 92) n -= 12; while (n < 0) n += 12; return n; };

export function convertSong(mod, replay, analysis, opts = {}) {
  const o = Object.assign({ seed: 1, creativity: 0, assignments: {}, fitEnvelope: true, useFilter: true, lang: 'de', title: mod.title, sids: 1 }, opts);
  const SIDS = [1, 2, 4, 6, 8].includes(+o.sids) ? +o.sids : 1;
  const NV = SIDS * 3;
  const NCH = mod.channels || 4;
  const ALL = Array.from({ length: NCH }, (_, c) => c);
  const R = rng(o.seed * 104729 + 7);
  const rows = replay.rows, N = rows.length;
  // ------------------------------------------------------------ samples
  const S = {};
  // wavetable budget for pitch-contour voices (the table has 255 rows for everything)
  const nVoice = analysis.samples.filter(a => a.used && (PRESET_BY_ID[o.assignments[a.index] || a.presetId] || {}).auto === 'voice').length;
  const voiceBudget = nVoice ? Math.max(12, Math.min(48, Math.floor(110 / nVoice))) : 48;
  for (const a of analysis.samples) {
    if (!a.used) continue;
    const pid = o.assignments[a.index] || a.presetId;
    let preset = PRESET_BY_ID[pid] || PRESET_BY_ID.lead_pulse;
    const smp = mod.samples[a.index - 1];
    let beat = null;
    if (preset.auto === 'voice') {
      // speech: follow the pitch contour of the sample frame by frame
      let vw = a.voice;
      if (!vw || vw.steps.length > voiceBudget) vw = voiceWavetable(smp, a.info, { maxSteps: voiceBudget });
      if (vw) preset = { ...preset, wave: vw.steps, voiceRef: vw.ref };
    } else if (preset.auto === 'beat') {
      if (!a.beat) a.beat = decomposeBeat(smp, a.info);
      beat = a.beat;
      if (!beat) preset = PRESET_BY_ID.kick;
    }
    if (a.synthWave && !preset.drum && preset.cat !== 'drums' && preset.cat !== 'auto' && preset.id !== 'mute' && preset.cat !== 'fx') {
      // synth instrument of the module: use its own waveform (pulse width from the waveform's duty cycle)
      const W = a.synthWave.wave;
      preset = { ...preset, wave: preset.wave.map(st => (typeof st[0] === 'number' && [0x11, 0x21, 0x41].includes(st[0] & 0xF1)) ? [W | (st[0] & 0x0E), st[1]] : st),
        pulse: W === 0x41 ? [[0x80 | ((a.synthWave.pw >> 8) & 15), a.synthWave.pw & 255], ['S']] : preset.pulse };
    }
    const env = o.fitEnvelope ? fitADSR(preset, a.info, smp, a.cls) : { ad: preset.ad, sr: preset.sr };
    const drumAbs = !!preset.drum;
    const isDrum = drumAbs || preset.cat === 'drums';
    const cls = a.cls;
    const chord = (a.chord && !isDrum && preset.cat !== 'fx' && preset.cat !== 'mute' && preset.cat !== 'auto') ? a.chord : null;
    S[a.index] = {
      a, preset, env, drumAbs, isDrum, muted: preset.id === 'mute', chord, weight: a.weight || 5,
      sustained: (env.sr >> 4) > 0, short: isDrum || ((env.sr >> 4) === 0 && (env.ad & 15) <= 8),
      shift: a.noteShift || 0, smp, voiceRef: preset.voiceRef || 0,
    };
    if (beat) {
      // one SID drum per cluster of similar hits: repeated hits share one instrument
      S[a.index].beat = { ...beat, keys: beat.clusters.map((cl, k) => {
        const key = a.index + ':b' + k, pr = PRESET_BY_ID[cl.presetId] || PRESET_BY_ID.kick;
        S[key] = { a, preset: pr, env: { ad: pr.ad, sr: pr.sr }, drumAbs: !!pr.drum, isDrum: true, muted: false, chord: null,
          weight: WEIGHT[cl.type] || 5, sustained: false, short: true, shift: 0, smp, sub: true };
        return key;
      }) };
    }
  }
  // ------------------------------------------------------------ per channel row info + note events
  const rowSec = rows.map(r => r.ticks.length * 2.5 / r.bpm);
  const CH = ALL.map(() => new Array(N));
  const notes = ALL.map(() => []);
  const lastTarget = ALL.map(() => 0), vibMem = ALL.map(() => [0, 0]);
  for (let i = 0; i < N; i++) {
    const r = rows[i];
    for (let c = 0; c < NCH; c++) {
      const cell = r.cells[c] || { s: 0, p: 0, e: 0, x: 0 };
      const tt = r.ticks.findIndex(t => t[c].trig);
      const t0 = r.ticks[0][c], tl = r.ticks[r.ticks.length - 1][c];
      const info = { trig: tt >= 0 && (tt < r.speed), smp: t0.smp, vol0: (tt >= 0 ? r.ticks[tt][c].vol : t0.vol), volEnd: tl.vol, e: cell.e, x: cell.x, per: tt >= 0 ? r.ticks[tt][c].base : t0.base };
      if (cell.e === 0 && cell.x) info.arp = [cell.x >> 4, cell.x & 15];
      if (cell.e === 1 && cell.x) info.porta = { dir: 1, x: cell.x };
      if (cell.e === 2 && cell.x) info.porta = { dir: -1, x: cell.x };
      if (cell.e === 0xE && ((cell.x >> 4) === 1 || (cell.x >> 4) === 2)) { /* fine slides: ignored */ }
      if (cell.e === 3 || cell.e === 5) {
        if (cell.p) lastTarget[c] = cell.p;
        info.tporta = { x: cell.e === 3 && cell.x ? cell.x : (info.tpx || 0), target: lastTarget[c], hasNote: !!cell.p };
      }
      if (cell.e === 4 || cell.e === 6) {
        if (cell.e === 4) { if (cell.x >> 4) vibMem[c][0] = cell.x >> 4; if (cell.x & 15) vibMem[c][1] = cell.x & 15; }
        info.vib = [vibMem[c][0], vibMem[c][1]];
      }
      CH[c][i] = info;
    }
  }
  // tone portamento speed memory
  for (let c = 0; c < NCH; c++) { let mem = 0; for (let i = 0; i < N; i++) { const t = CH[c][i].tporta; if (t) { if (t.x) mem = t.x; t.x = mem; } } }

  const noteOf = (smpIdx, per) => {
    const s = S[smpIdx]; if (!s) return 48;
    if (s.drumAbs) return 48;
    let real = realNote(s.voiceRef ? { ...s.a.info, f0norm: s.voiceRef } : s.a.info, per);
    if (real === null) real = 48 + 12 * Math.log2(428 / per);
    if (s.chord) {
      // root note of the chord at this period
      const sh = Math.round(12 * Math.log2(s.a.info.refPeriod / per));
      const pc = (((s.chord.rootPc + sh) % 12) + 12) % 12;
      let n = Math.round(real + s.shift);
      for (let d = 0; d < 12; d++) { if (((n - d) % 12 + 12) % 12 === pc) { n = n - d; break; } if (((n + d) % 12 + 12) % 12 === pc) { n = n + d; break; } }
      return clampNote(n);
    }
    return clampNote(real + s.shift);
  };
  for (let c = 0; c < NCH; c++) {
    for (let i = 0; i < N; i++) {
      const inf = CH[c][i];
      if (!inf.trig || !inf.smp || !S[inf.smp] || S[inf.smp].muted) continue;
      if (inf.e === 3 || inf.e === 5) continue;
      const bt = S[inf.smp].beat;
      if (bt) {
        // drum loop: replay its hits row by row with the clustered SID drums
        const scale = S[inf.smp].a.info.rate / (PAULA_PAL / (2 * Math.max(57, inf.per)));
        const dur = bt.duration * scale, looped = S[inf.smp].smp.looped;
        let next = N; for (let j = i + 1; j < N; j++) if (CH[c][j].trig) { next = j; break; }
        let t = 0;
        for (let j = i; j < next; j++) {
          const t0 = looped ? t % dur : t, t1 = t0 + rowSec[j];
          if (!looped && t0 >= dur) break;
          let best = null;
          for (const h of bt.hits) { const ht = h.t * scale; if (ht >= t0 - 1e-6 && ht < t1 && (!best || h.level > best.level)) best = h; }
          if (best) notes[c].push({ ch: c, start: j, smp: bt.keys[best.c], per: inf.per, vol: Math.round(inf.vol0 * Math.min(1, 0.4 + best.level)), note: 48, end: N, sub: true });
          t += rowSec[j];
        }
        continue;
      }
      notes[c].push({ ch: c, start: i, smp: inf.smp, per: inf.per, vol: inf.vol0, note: noteOf(inf.smp, inf.per), end: N });
    }
    // note ends: next note, volume 0, or end of a one-shot sample
    const ns = notes[c];
    for (let k = 0; k < ns.length; k++) {
      const ev = ns[k], nextStart = k + 1 < ns.length ? ns[k + 1].start : N;
      let end = nextStart;
      const s = S[ev.smp];
      if (ev.sub) { ev.end = Math.max(ev.start + 1, Math.min(nextStart, ev.start + 2)); ev.w = s.weight; ev.short = true; ev.drum = true; ev.sus = false; continue; }
      const smp = s.smp;
      let lenSec = smp.looped ? 1e9 : smp.data.length / (PAULA_PAL / (2 * ev.per));
      let t = 0;
      for (let i = ev.start; i < nextStart; i++) {
        if (i > ev.start && CH[c][i].trig && CH[c][i].smp && S[CH[c][i].smp] && S[CH[c][i].smp].muted) { end = i; break; }
        if (CH[c][i].volEnd === 0 && CH[c][i].vol0 === 0 && i > ev.start) { end = i; break; }
        t += rowSec[i];
        if (t >= lenSec + rowSec[i] * 0.5) { end = i + 1; break; }
      }
      ev.end = Math.max(ev.start + 1, Math.min(end, nextStart));
      ev.w = s.weight; ev.short = s.short; ev.drum = s.isDrum; ev.sus = s.sustained;
    }
  }
  const trigAt = ALL.map(c => { const m = new Map(); notes[c].forEach(n => m.set(n.start, n)); return m; });
  const soundingAt = (c, i) => { // note sounding on channel c at row i (started earlier)
    const ns = notes[c]; let lo = 0, hi = ns.length - 1, best = null;
    while (lo <= hi) { const m = (lo + hi) >> 1; if (ns[m].start <= i) { best = ns[m]; lo = m + 1; } else hi = m - 1; }
    return best && best.end > i ? best : null;
  };
  // ------------------------------------------------------------ segments
  const segs = [];
  { let st = 0;
    for (let i = 1; i <= N; i++) {
      if (i === N || rows[i].pos !== rows[i - 1].pos || i === replay.loopRow || i - st >= 64 || (rows[i].row === 0 && rows[i - 1].row !== 63 && rows[i].pos === rows[i - 1].pos)) { segs.push({ start: st, end: i }); st = i; }
    } }
  let loopSeg = Math.max(0, segs.findIndex(s => s.start === replay.loopRow));
  // ------------------------------------------------------------ plan per segment
  const mergeCost = (a, b, seg) => {
    let cost = 0;
    for (let i = seg.start; i < seg.end; i++) {
      const ea = trigAt[a].get(i), eb = trigAt[b].get(i);
      if (ea && eb) {
        if (ea.drum !== eb.drum) cost += 0.15 * (ea.drum ? ea.w : eb.w);
        else if (!ea.drum) cost += 0.35 * Math.min(ea.w, eb.w);
        else cost += 0.9 * Math.min(ea.w, eb.w);
      } else if (ea || eb) {
        const x = ea || eb, yc = ea ? b : a, y = soundingAt(yc, i);
        if (!y) continue;
        if (x.drum && !y.drum) cost += y.sus ? 0.1 * x.w : 0.35 * y.w * Math.min(1, (y.end - i) / 6);
        else if (!x.drum && y.drum) cost += 0.15 * y.w;
        else if (!x.drum && !y.drum) cost += 0.3 * Math.min(x.w, y.w) + 0.4 * y.w * Math.min(1, (y.end - i) / 8) * (y.sus ? 0.3 : 1);
        else cost += 0.3 * y.w;
      }
    }
    return cost;
  };
  const activity = (c, seg) => {
    let w = 0;
    for (let i = seg.start; i < seg.end; i++) { const e = trigAt[c].get(i); if (e) w += e.w; else { const s = soundingAt(c, i); if (s && s.sus) w += s.w * 0.15; } }
    return w;
  };
  const plans = [];
  // voices that have no channel of their own (more SID voices than MOD channels) play chords and split drums
  const spareVoices = NCH < NV ? Array.from({ length: NV - NCH }, (_, k) => NCH + k) : [];
  let prevVoiceOf = ALL.map(c => Math.min(c, NV - 1)); // channel -> voice
  const perms3 = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const seg of segs) {
    if (NCH <= NV) {
      const voices = Array.from({ length: NV }, (_, v) => (v < NCH ? [v] : []));
      plans.push({ voices, dropped: [], cost: 0 }); continue;
    }
    const act = ALL.map(c => activity(c, seg));
    const live = ALL.filter(c => act[c] > 0);
    const scale = Math.max(1, (seg.end - seg.start) / 16);
    const noise = () => (o.creativity ? R() * o.creativity * 2 * scale : 0);
    // reduce the live channels to NV groups: merge pairs (bass + drums, two melodies) or drop quiet channels
    let groups = live.map(c => [c]);
    let dropped = [], cost = 0;
    if (groups.length > NV) {
      const pairCost = new Map();
      const pc = (a, b) => { const k = a * 256 + b; if (!pairCost.has(k)) pairCost.set(k, mergeCost(a, b, seg) + noise()); return pairCost.get(k); };
      while (groups.length > NV) {
        let best = null;
        const singles = groups.filter(g => g.length === 1).map(g => g[0]);
        for (let i = 0; i < singles.length; i++) for (let j = i + 1; j < singles.length; j++) {
          const a = singles[i], b = singles[j], c0 = pc(Math.min(a, b), Math.max(a, b));
          if (!best || c0 < best.cost) best = { cost: c0, merge: act[a] >= act[b] ? [a, b] : [b, a] };
        }
        for (const g of groups) for (const d of g) {
          const c0 = act[d] * 1.0 + noise() * 0.5;
          if (!best || c0 < best.cost) best = { cost: c0, drop: d };
        }
        if (!best) break;
        cost += best.cost;
        if (best.merge) {
          const [a, b] = best.merge;
          groups = groups.filter(g => !(g.length === 1 && (g[0] === a || g[0] === b)));
          groups.push([a, b]);
        } else {
          groups = groups.map(g => g.filter(c => c !== best.drop)).filter(g => g.length);
          dropped.push(best.drop);
        }
      }
    }
    // voice assignment: keep channels on their voices to avoid jumps
    let voices;
    if (NV === 3) {
      let bestV = null;
      const gs = groups.slice(); while (gs.length < 3) gs.push([]);
      for (const pm of perms3) {
        const g = [null, null, null]; gs.forEach((grp, k) => { g[pm[k]] = grp; });
        let moves = 0;
        g.forEach((grp, v) => grp.forEach(c => { if (prevVoiceOf[c] !== v) moves += (grp[0] === c ? 1 : 0.5); }));
        const total = moves * 3 * scale + noise() * 0.3;
        if (!bestV || total < bestV.total) bestV = { total, g };
      }
      voices = bestV.g;
    } else {
      voices = Array.from({ length: NV }, () => null);
      const rest = [];
      for (const g of groups.sort((x, y) => act[y[0]] - act[x[0]])) {
        const v = prevVoiceOf[g[0]];
        if (voices[v] === null) voices[v] = g; else rest.push(g);
      }
      for (const g of rest) { const v = voices.indexOf(null); voices[v] = g; }
      voices = voices.map(g => g || []);
    }
    voices.forEach((grp, v) => grp.forEach(c => { prevVoiceOf[c] = v; }));
    plans.push({ voices, dropped, cost });
  }
  // ------------------------------------------------------------ instruments & tables
  const song = new GTSong(NV);
  song.name = (o.title || 'mod2sid').slice(0, 32);
  song.author = (o.author || 'converted with mod2sid').slice(0, 32);
  song.copyright = (o.copyright || (new Date().getFullYear() + ' IT-Dummkopfen mod2sid')).slice(0, 32);
  // tempo / gate
  const fprOf = (r) => r.ticks.length / (1 + (r.delay || 0)) * 125 / r.bpm;
  const minT = Math.min(...rows.map(r => Math.max(2, Math.round(fprOf(r)))));
  const GATE = minT <= 2 ? 1 : 2;
  // filter voice: voice with most filter-instrument rows
  const filterUse = new Array(NV).fill(0);
  if (o.useFilter) plans.forEach((p, k) => p.voices.forEach((grp, v) => grp.forEach(c => {
    for (let i = segs[k].start; i < segs[k].end; i++) { const e = trigAt[c].get(i); if (e && S[e.smp].preset.filter) filterUse[v] += e.w; }
  })));
  const fu3 = filterUse.slice(0, 3);
  const filterVoice = fu3.some(x => x > 0) ? fu3.indexOf(Math.max(...fu3)) : -1;
  const insOf = {}; const waveOf = {}; let degraded = 0;
  const mainWave = (steps) => { const s = steps.find(x => typeof x[0] === 'number' && x[0] >= 0x10); return s ? s[0] : 0x41; };
  const wavesFor = (s) => s.chord ? [...s.chord.iv.map(iv => [mainWave(s.preset.wave), iv]), ['J', 0]] : s.preset.wave;
  const instrFor = (smpIdx, voice, plain = false) => {
    const s = S[smpIdx];
    const useF = s.preset.filter && voice === filterVoice;
    const key = smpIdx + (useF ? 'f' : '') + (plain && s.chord ? 'p' : '');
    if (insOf[key]) return insOf[key];
    const pr = s.preset;
    const steps = (plain && s.chord) ? pr.wave : wavesFor(s);
    const ov = song.overflow;
    let wv = song.addWave(steps);
    if (!wv && steps.length > 1) { // wavetable full: fall back to a plain waveform
      wv = song.addWave(s.drumAbs ? steps.filter(x => typeof x[0] === 'number').slice(0, 2).concat([['S']]) : [[mainWave(steps), 0], ['S']]);
      if (wv) { song.overflow = ov; degraded++; }
    }
    if (!(plain && s.chord)) waveOf[smpIdx] = steps;
    const pu = song.addPulse(pr.pulse);
    const fi = useF ? song.addFilter(pr.filter, 1 << filterVoice) : 0;
    let vp = 0, vd = 0;
    if (pr.vib) { vp = song.addSpeed(pr.vib[0], pr.vib[1]); vd = pr.vib[2] || 1; }
    const nm = (s.chord && !plain ? presetName(pr, o.lang).slice(0, 10) + ' ' + s.chord.type : presetName(pr, o.lang)).slice(0, 16);
    const id = song.addInstrument({ ad: s.env.ad, sr: s.env.sr, wv, pu, fi, vp, vd, gt: GATE, fw: pr.fw, name: nm });
    insOf[key] = id;
    return id;
  };
  const shiftSteps = (steps, off) => steps.map(st => st[0] === 'J' ? ['J', st[1] + off] : st);
  const comboTable = (drumIdx, melIdx) => {
    const d = S[drumIdx].preset, m = S[melIdx];
    const pre = d.wave.filter(x => typeof x[0] === 'number').slice(0, Math.max(1, d.prefix || 2));
    const mel = waveOf[melIdx] || wavesFor(m);
    if (mel.length > 12) return 0; // long tables (voice contours) would be copied for every drum
    // make the melodic part start with an explicit relative note 0 so the pitch returns
    const melSteps = mel.map((st, k) => (k === 0 && typeof st[0] === 'number' && st[1] === 'k') ? [st[0], 0] : st);
    return song.addWave([...pre.map(st => [st[0], typeof st[1] === 'number' ? (S[drumIdx].drumAbs ? st[1] : st[1]) : st[1]]), ...shiftSteps(melSteps, pre.length)]);
  };
  const arpTable = (melIdx, ivs) => {
    const W = mainWave(waveOf[melIdx] || wavesFor(S[melIdx]));
    const steps = ivs.map(iv => [W, Math.max(-32, Math.min(95, iv))]);
    steps.push(['J', 0]);
    return song.addWave(steps);
  };
  const plainTable = (melIdx) => song.addWave([[mainWave(waveOf[melIdx] || wavesFor(S[melIdx])), 0], ['S']]);
  // ------------------------------------------------------------ voice rows
  // cell: {n: gt note byte or null, i: instr, cmds: [{p, c, d}]}
  const V = Array.from({ length: NV }, () => Array.from({ length: N }, () => ({ n: null, i: 0, cmds: [] })));
  const vstate = Array.from({ length: NV }, () => ({ owner: null, arp: false, fxArp: null, susS: 0, keyed: false }));
  // 2SID: spare voices 4+5 for real chords and split-off drums
  const spareBusy = spareVoices.map(() => new Uint8Array(N + 1));
  const spareFree = (k, a, b) => { for (let i = a; i < Math.min(b, N); i++) if (spareBusy[k][i]) return false; return true; };
  const spareNote = (i, ev, note, plain, end) => {
    for (let k = 0; k < spareBusy.length; k++) {
      if (!spareFree(k, i, end)) continue;
      for (let j = i; j < Math.min(end, N); j++) spareBusy[k][j] = 1;
      const v = spareVoices[k], c = V[v][i];
      c.n = 0x60 + clampNote(note); c.i = instrFor(ev.smp, v, plain);
      if (end < N && S[ev.smp].sustained && V[v][end].n === null) V[v][end].n = KEYOFF;
      return true;
    }
    return false;
  };
  const pushCmd = (v, i, p, c, d) => { if ((c === 8 || c === 1 || c === 2 || c === 3 || c === 4 || c === 0x0E) && !d) return; V[v][i].cmds.push({ p, c, d }); };
  const curFreq = (ev) => FREQ[ev.note];
  const emitNote = (v, i, ev, voice) => {
    const cell = V[v][i];
    cell.n = 0x60 + ev.note; cell.i = instrFor(ev.smp, voice);
    const sc = S[ev.smp];
    if (spareVoices.length && sc.chord && !spareVoices.includes(v)) {
      // play the chord with real voices where possible, arpeggio only as fallback
      const ivs = sc.chord.iv.slice(1, 3);
      const free = spareVoices.map((_, k) => k).filter(k => spareFree(k, i, ev.end)).length;
      if (free >= ivs.length) { ivs.forEach(iv => spareNote(i, ev, ev.note + iv, true, ev.end)); cell.i = instrFor(ev.smp, voice, true); }
    }
    const st = vstate[v]; st.owner = ev; st.arp = false; st.fxArp = null; st.keyed = false;
    const s = S[ev.smp];
    st.susS = s.env.sr >> 4;
    if (s.sustained && ev.vol < 60 && ev.vol > 0) {
      const sv = Math.max(1, Math.round(st.susS * ev.vol / 64));
      if (sv < st.susS) { pushCmd(v, i, 1, 6, (sv << 4) | (s.env.sr & 15)); st.susS = sv; }
    }
  };
  const effects = (v, i, c) => {
    const st = vstate[v], ev = st.owner; if (!ev || ev.ch !== c) return;
    const inf = CH[c][i]; const r = rows[i];
    const tpf = r.bpm / 125; // ticks per frame
    // note end for sustained sounds
    if (i >= ev.end && !st.keyed && !trigAt[c].get(i)) {
      if (S[ev.smp].sustained) { V[v][i].n = V[v][i].n ?? KEYOFF; }
      st.keyed = true; return;
    }
    if (st.keyed) return;
    if (inf.arp && !S[ev.smp].isDrum) {
      const key = inf.arp.join(',');
      if (st.fxArp !== key) { pushCmd(v, i, 5, 8, arpTable(ev.smp, [0, inf.arp[0], inf.arp[1]])); st.fxArp = key; }
    } else if (st.fxArp) { pushCmd(v, i, 5, 8, plainTable(ev.smp)); st.fxArp = null; }
    if (inf.porta && inf.per) {
      const df = curFreq(ev) * inf.porta.x / inf.per * tpf;
      pushCmd(v, i, 3, inf.porta.dir > 0 ? 1 : 2, song.addSpeed16(df));
    }
    if (inf.tporta && inf.tporta.target) {
      const tn = noteOf(ev.smp, inf.tporta.target);
      const df = curFreq(ev) * Math.max(1, inf.tporta.x) / Math.max(57, inf.per) * tpf;
      if (inf.tporta.hasNote) { V[v][i].n = 0x60 + tn; }
      pushCmd(v, i, 4, 3, song.addSpeed16(df));
      ev.note = tn;
    }
    if (inf.vib && inf.vib[0] && inf.vib[1]) {
      const sp = Math.max(1, Math.min(127, Math.round(32 / inf.vib[0] * 125 / r.bpm)));
      const df = curFreq(ev) * 2 * inf.vib[1] / Math.max(57, inf.per || 428);
      const depth = Math.max(1, Math.min(255, Math.round(2 * df / sp)));
      pushCmd(v, i, 3, 4, song.addSpeed(sp, depth));
    }
    // volume changes during a sustained note
    if (S[ev.smp].sustained && i > ev.start) {
      const s = S[ev.smp];
      if (inf.volEnd === 0) { V[v][i].n = V[v][i].n ?? KEYOFF; st.keyed = true; return; }
      const sv = Math.max(1, Math.round((s.env.sr >> 4) * inf.volEnd / 64));
      if (sv < st.susS) { pushCmd(v, i, 1, 6, (sv << 4) | (s.env.sr & 15)); st.susS = sv; }
    }
  };
  segs.forEach((seg, k) => {
    const plan = plans[k];
    plan.voices.forEach((grp, v) => {
      const st = vstate[v];
      if (!grp.length) {
        // voice idle: release a hanging note
        if (st.owner && !st.keyed) { V[v][seg.start].n = KEYOFF; st.keyed = true; }
        return;
      }
      if (st.owner && !grp.includes(st.owner.ch) && !st.keyed) {
        // a channel that moved away: make sure its note stops here unless something new starts
        if (!grp.some(c => trigAt[c].get(seg.start))) { V[v][seg.start].n = KEYOFF; st.keyed = true; }
      }
      const [a, b] = grp;
      let resumeAt = -1, resumeEv = null;
      for (let i = seg.start; i < seg.end; i++) {
        if (b === undefined) {
          const ea = trigAt[a].get(i);
          if (ea && spareVoices.length && ea.drum && st.owner && !st.keyed && !st.owner.drum && st.owner.sus && st.owner.end > i + 1 &&
              spareNote(i, ea, ea.note, false, Math.min(ea.end, i + 4))) { effects(v, i, a); continue; }
          if (ea) emitNote(v, i, ea, v);
          effects(v, i, a);
          continue;
        }
        // ---- merged pair: a = primary, b = secondary
        const ea = trigAt[a].get(i), eb = trigAt[b].get(i);
        if (ea && eb) {
          const [d, m] = ea.drum && !eb.drum ? [ea, eb] : (!ea.drum && eb.drum ? [eb, ea] : [null, null]);
          if (d) { // drum + melodic on the same row: drum transient prefix, melodic note
            emitNote(v, i, m, v); pushCmd(v, i, 9, 8, comboTable(d.smp, m.smp));
          } else if (!ea.drum && !eb.drum) {
            emitNote(v, i, ea, v);
            if (ea.sus && eb.sus && Math.abs(eb.note - ea.note) <= 24 && eb.note !== ea.note) { pushCmd(v, i, 8, 8, arpTable(ea.smp, [0, eb.note - ea.note])); vstate[v].arp = true; }
          } else emitNote(v, i, ea.w >= eb.w ? ea : eb, v);
          resumeAt = -1;
        } else if (ea || eb) {
          const x = ea || eb, yc = ea ? b : a, y = soundingAt(yc, i);
          const own = st.owner && !st.keyed ? st.owner : null;
          if (x.drum && y && !y.drum && own === y && y.sus) {
            // overlay the drum transient on the sustained melodic note (no retrigger)
            pushCmd(v, i, 9, 8, comboTable(x.smp, y.smp));
          } else if (!x.drum && y && !y.drum && own === y && x.sus && y.sus && Math.abs(y.note - x.note) <= 24 && y.note !== x.note) {
            emitNote(v, i, x, v); pushCmd(v, i, 8, 8, arpTable(x.smp, [0, y.note - x.note])); vstate[v].arp = true;
          } else {
            emitNote(v, i, x, v);
            if (x.drum && y && !y.drum && y.sus && y.end > i + 2) { resumeAt = i + 2; resumeEv = y; }
          }
        } else {
          // no trigger: arp ends when one partner stops, resume melodic after a drum hit
          if (st.arp && st.owner) {
            const oc = st.owner.ch === a ? b : a; const other = soundingAt(oc, i);
            if (!other) { pushCmd(v, i, 8, 8, plainTable(st.owner.smp)); st.arp = false; }
          }
          if (i === resumeAt && resumeEv && resumeEv.end > i) {
            emitNote(v, i, { ...resumeEv, vol: 64 }, v); vstate[v].owner = resumeEv; resumeAt = -1;
          }
        }
        effects(v, i, st.owner ? st.owner.ch : a);
      }
    });
  });
  // ------------------------------------------------------------ tempo commands
  let lastT = null;
  for (let i = 0; i < N; i++) {
    const f = fprOf(rows[i]);
    const fl = Math.floor(f), frac = f - fl;
    let cmd;
    if (frac > 0.3 && frac < 0.7 && fl >= 2) cmd = [0x0E, song.addSpeed(fl + 1, Math.max(2, fl))];
    else cmd = [0x0F, Math.max(2, Math.round(f))];
    const key = cmd.join(',');
    if (key === lastT) continue;
    lastT = key;
    // place on a voice with a free slot, else override lowest priority
    let placed = false;
    for (let v = 0; v < NV; v++) if (!V[v][i].cmds.length) { pushCmd(v, i, 20, cmd[0], cmd[1]); placed = true; break; }
    if (!placed) { const v = 2; V[v][i].cmds.push({ p: 20, c: cmd[0], d: cmd[1] }); }
  }
  const initTempo = Math.max(2, Math.round(fprOf(rows[0])));
  // ------------------------------------------------------------ resolve rows -> GT patterns
  const resolve = (cell) => {
    let c = 0, d = 0;
    if (cell.cmds.length) { const b = cell.cmds.reduce((x, y) => (y.p > x.p ? y : x)); c = b.c; d = b.d; }
    return [cell.n === null ? REST : cell.n, cell.n !== null && cell.n < 0xBD ? cell.i : 0, c, d & 0xFF];
  };
  let k = 1;
  const build = (k) => {
    song.patterns = []; song.patKey = new Map(); song.orders = Array.from({ length: NV }, () => []);
    const chunks = [];
    for (let s = 0; s < segs.length;) {
      let e = s, len = 0;
      while (e < segs.length && e - s < k && len + (segs[e].end - segs[e].start) <= 128 && !(e > s && e === loopSeg)) { len += segs[e].end - segs[e].start; e++; }
      chunks.push({ start: segs[s].start, end: segs[e - 1].end, first: s });
      s = e;
    }
    for (const ch of chunks) for (let v = 0; v < NV; v++) {
      const prow = [];
      for (let i = ch.start; i < ch.end; i++) prow.push(resolve(V[v][i]));
      song.orders[v].push(song.addPattern(prow));
    }
    song.restart = Math.max(0, chunks.findIndex(c => c.first === loopSeg));
    return chunks;
  };
  // per-voice pattern cutting (each voice has its own order list): repeated bars of drums or bass
  // become shared patterns, which keeps songs with many voices below the 208 pattern limit
  const buildPerVoice = (limit = N) => {
    song.patterns = []; song.patKey = new Map(); song.orders = Array.from({ length: NV }, () => []); song.restarts = [];
    const loopStart = limit < N ? 0 : (segs[loopSeg] ? segs[loopSeg].start : 0);
    const pieces = (L) => {
      const out = [];
      for (const sg of segs) {
        if (sg.start >= limit) break;
        const end = Math.min(sg.end, limit);
        if (!L) { out.push([sg.start, end]); continue; }
        if (L < 0) { // merge whole segments up to -L rows (never across the loop point)
          const last = out[out.length - 1];
          if (last && end - last[0] <= -L && sg.start !== loopStart) last[1] = end; else out.push([sg.start, end]);
          continue;
        }
        for (let a = sg.start; a < end; a += L) out.push([a, Math.min(end, a + L)]);
      }
      return out;
    };
    const cands = [0, 32, 16, 8, -128].map(pieces);
    for (let v = 0; v < NV; v++) {
      let best = null;
      for (const pc of cands) {
        if (pc.length > 254) continue;
        const keys = pc.map(([a, b]) => { const rows = []; for (let i = a; i < b; i++) rows.push(resolve(V[v][i])); return rows; });
        const fresh = new Set(); for (const rows of keys) { const kk = rows.map(r => r.join(',')).join(';'); if (!song.patKey.has(kk)) fresh.add(kk); }
        if (!best || fresh.size < best.fresh) best = { fresh: fresh.size, pc, keys };
      }
      if (!best) return false;
      best.keys.forEach(rows => song.orders[v].push(song.addPattern(rows)));
      song.restarts[v] = Math.max(0, best.pc.findIndex(([a]) => a === loopStart));
    }
    song.restart = song.restarts[0] || 0;
    return song.patterns.length <= MAX_PATTERNS;
  };
  let chunks, cut = 0;
  let L0 = N;
  if (o.limitRows && o.limitRows < N) { const sg = segs.filter(x => x.start <= o.limitRows && x.start > 0).pop(); if (sg) { L0 = sg.start; cut = L0; } }
  if (!buildPerVoice(L0)) {
    // too many different patterns: keep as much of the song as fits (binary search on the end row)
    let lo = 0, hi = segs.length - 1;
    while (hi > 0 && segs[hi].start > L0) hi--;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (buildPerVoice(segs[mid].start)) lo = mid; else hi = mid - 1; }
    cut = lo > 0 ? segs[lo].start : 0;
    if (cut > 0) buildPerVoice(cut);
    else {
      song.restarts = null;
      chunks = build(1);
      while (song.patterns.length > MAX_PATTERNS && k < 8) { k++; chunks = build(k); }
    }
  }
  const truncated = cut > 0 || song.patterns.length > MAX_PATTERNS || song.orders[0].length > 254;
  if (truncated && !cut) {
    // keep as many chunks as fit
    while (song.patterns.length > MAX_PATTERNS || song.orders[0].length > 254) {
      for (let v = 0; v < NV; v++) song.orders[v].pop();
      const used = new Set(song.orders.flat());
      if (used.size <= MAX_PATTERNS && song.orders[0].length <= 254) {
        const remap = new Map(); const pats = [];
        [...used].sort((x, y) => x - y).forEach(p => { remap.set(p, pats.length); pats.push(song.patterns[p]); });
        song.patterns = pats; song.orders = song.orders.map(ol => ol.map(p => remap.get(p)));
        if (song.restart >= song.orders[0].length) song.restart = 0;
        break;
      }
    }
  }
  const segInfo = segs.map((s, k) => {
    const spare = spareVoices.map(v => { let n = 0; for (let i = s.start; i < s.end; i++) if (V[v][i].n !== null && V[v][i].n < 0xBD) n++; return n; });
    return { start: s.start, end: s.end, pos: rows[s.start].pos, pat: rows[s.start].pat, voices: plans[k].voices, dropped: plans[k].dropped, cost: plans[k].cost, spare };
  });
  return {
    song, voices: NV, sids: SIDS, channels: NCH, initTempo, gate: GATE, filterVoice, segments: segInfo, loopSeg, truncated, overflow: song.overflow, degraded,
    rowsTotal: N, seconds: rowSec.reduce((a, b) => a + b, 0),
    instrumentMap: Object.fromEntries(Object.entries(insOf)),
  };
}
