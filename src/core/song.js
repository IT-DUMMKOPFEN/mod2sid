// mod2sid – common song model for all tracker formats + tick-accurate replay + preview renderer
// (c) IT-DUMMKOPFEN, GPL-3.0
//
// Song model (produced by every loader in src/core/formats/):
//   { format, title, channels, linear, samples[], instruments?, orders[], restart, patterns[], speed, bpm, chanVol[] }
//   samples[i]  = { index:i+1, name, data:Int8Array, length, loopStart, loopLength, looped, volume(0-64),
//                   finetune(-8..7, Amiga), c4 (Hz at note 61), xpo (semitones), gv (0-1), synth? }
//   instruments = [{ name, map[121] -> {smp, note}, volEnv?, fadeout, gv }]  (XM/IT/DBM only)
//   patterns[p] = { rows, data: [row][ch] -> cell | null }
//   cell        = { note: 0 | 1..120 | OFF | CUT | FADE, per?: raw Amiga period, ins: 0.., vol: null|0..64, fx: [[code, a, b], ...] }
// Note 61 plays a sample at its c4 rate (= ProTracker period 428 for c4 = 8287 Hz).
// Pitch inside the replay is an Amiga period (3546895 / Hz), slides use Amiga period
// units or, for songs with linear frequencies, 1/64 semitone units.

export const PAULA_CLOCK = 3546895;
export const OFF = 200, CUT = 201, FADE = 202;
export const F = {
  ARP: 1, PUP: 2, PDN: 3, FPUP: 4, FPDN: 5, TPORTA: 6, VIB: 7, TREM: 8, VSLIDE: 9, FVSLIDE: 10, VOL: 11, OFFSET: 12,
  JUMP: 13, BREAK: 14, SPEED: 15, TEMPO: 16, LOOP: 17, PDELAY: 18, NDELAY: 19, CUT: 20, RETRIG: 21, KEYOFF: 22,
  FINETUNE: 23, CHVOL: 24, VIBWAVE: 25, TREMWAVE: 26, GLISS: 27,
};
const SINE = [0, 24, 49, 74, 97, 120, 141, 161, 180, 197, 212, 224, 235, 244, 250, 253,
  255, 253, 250, 244, 235, 224, 212, 197, 180, 161, 141, 120, 97, 74, 49, 24];
const MIN_PER = 14, MAX_PER = 13696;

export function cleanName(b, o, n) {
  let s = '';
  for (let i = 0; i < n && o + i < b.length; i++) { const c = b[o + i]; if (!c) break; s += (c >= 32 && c < 127) ? String.fromCharCode(c) : ' '; }
  return s.replace(/\s+$/, '');
}

export function makeSample(index, name, data, o = {}) {
  const n = data.length;
  let ls = Math.max(0, Math.min(n, o.loopStart || 0)), ll = Math.max(0, Math.min(n - ls, o.loopLength || 0));
  let d = data;
  if (o.pingpong && ll > 2) { // unroll ping-pong loops (forward + backward)
    const e = new Int8Array(ls + ll * 2);
    e.set(data.subarray(0, ls + ll));
    for (let i = 0; i < ll; i++) e[ls + ll + i] = data[ls + ll - 1 - i];
    d = e; ll *= 2;
  }
  return {
    index, name: name || '', data: d, length: d.length, loopStart: ls, loopLength: ll, looped: ll > 2,
    volume: Math.max(0, Math.min(64, o.volume ?? 64)), finetune: o.finetune || 0,
    c4: o.c4 || PAULA_CLOCK / 428, xpo: o.xpo || 0, gv: o.gv ?? 1, synth: o.synth || null,
  };
}

// 16-bit / float to 8-bit
export function to8(arr16) { const o = new Int8Array(arr16.length); for (let i = 0; i < arr16.length; i++) o[i] = arr16[i] >> 8; return o; }

export function periodOf(s, note) {
  const hz = s.c4 * Math.pow(2, (note + (s.xpo || 0) - 61) / 12 + (s.finetune || 0) / 96);
  return Math.max(MIN_PER, Math.min(MAX_PER, PAULA_CLOCK / Math.max(1, hz)));
}

// --------------------------------------------------------------------------------------------
// Envelope (XM/IT/DBM): { pts:[[tick,val0..64]...], sus:-1|i, susEnd, loop:-1|i, loopEnd, on }
function envValue(env, C) {
  const p = env.pts; if (!p.length) return 64;
  let t = C.envT;
  const last = p[p.length - 1][0];
  if (t >= last) return p[p.length - 1][1];
  let k = 0; while (k + 1 < p.length && p[k + 1][0] <= t) k++;
  const [t0, v0] = p[k], [t1, v1] = p[Math.min(k + 1, p.length - 1)];
  return t1 > t0 ? v0 + (v1 - v0) * (t - t0) / (t1 - t0) : v0;
}
function envAdvance(env, C) {
  const p = env.pts; if (!p.length) return;
  if (C.keyOn && env.sus >= 0) {
    const se = env.susEnd ?? env.sus;
    if (C.envT >= p[Math.min(se, p.length - 1)][0]) { C.envT = p[Math.min(env.sus, p.length - 1)][0]; return; }
  }
  C.envT++;
  if (env.loop >= 0 && env.loopEnd >= 0 && C.envT > p[Math.min(env.loopEnd, p.length - 1)][0]) C.envT = p[Math.min(env.loop, p.length - 1)][0];
}

// --------------------------------------------------------------------------------------------
export function replaySong(song, { maxRows = 30000 } = {}) {
  const N = song.channels;
  const linear = !!song.linear;
  const insMode = !!song.instruments;
  const ch = Array.from({ length: N }, (_, c) => ({
    ins: 0, smp: 0, s: null, note: 0, per: 0, target: 0, vol: 0, cv: (song.chanVol ? song.chanVol[c] : 64),
    portaSpeed: 0, vibPos: 0, vibSpeed: 0, vibDepth: 0, vibWave: 0, tremPos: 0, tremSpeed: 0, tremDepth: 0,
    loopRow: 0, loopCount: 0, ft: 0, offset: 0, tremWave: 0, mem: {}, keyOn: false, envT: 0, fade: 1, inst: null, active: false,
  }));
  let speed = song.speed || 6, bpm = song.bpm || 125;
  let pos = 0, row = 0;
  const visited = new Map();
  const out = [];
  let loopTarget = -1;
  const slide = (C, u) => { // u > 0: pitch up
    if (!C.per) return;
    C.per = linear ? C.per * Math.pow(2, -u / 768) : C.per - u;
    C.per = Math.max(MIN_PER, Math.min(MAX_PER, C.per));
  };
  const memo = (C, key, v) => { if (v === null || v === undefined) return C.mem[key] ?? 0; C.mem[key] = v; return v; };
  while (out.length < maxRows) {
    if (pos >= song.orders.length) break;
    const pi = song.orders[pos];
    const pat = song.patterns[pi];
    if (!pat || !pat.rows) { // empty / skipped pattern
      pos++; row = 0; if (pos >= song.orders.length) break; continue;
    }
    if (row >= pat.rows) row = 0;
    const key = pos * 4096 + row;
    if (visited.has(key) && ch.every(c => c.loopCount === 0)) { loopTarget = visited.get(key); break; }
    if (!visited.has(key)) visited.set(key, out.length);
    const cells = pat.data[row] || [];
    let nextPos = pos, nextRow = row + 1, jumped = false, breakRow = -1, jumpPos = -1, patDelay = 0;
    for (let c = 0; c < N; c++) {
      const cl = cells[c]; if (!cl) continue;
      for (const [code, a] of cl.fx) {
        if (code === F.SPEED && a > 0) speed = a;
        else if (code === F.TEMPO && a > 0) bpm = a;
        else if (code === F.PDELAY) patDelay = Math.max(patDelay, a);
      }
    }
    const outCells = new Array(N);
    const rowRec = { pos, pat: pi, row, speed, bpm, cells: outCells, ticks: [], delay: patDelay };
    const totalTicks = speed * (1 + patDelay);
    const trigTick = new Array(N).fill(0);
    for (let c = 0; c < N; c++) {
      const cl = cells[c];
      if (cl) for (const [code, a] of cl.fx) if (code === F.NDELAY && a < speed) trigTick[c] = a;
      outCells[c] = { s: 0, p: 0, e: 0, x: 0 };
    }
    for (let t = 0; t < totalTicks; t++) {
      const tr = t % speed;
      const tickState = new Array(N);
      for (let c = 0; c < N; c++) {
        const C = ch[c], cl = cells[c] || null;
        const fx = cl ? cl.fx : [];
        let trig = false, arpSemi = 0, vibOff = 0, tremOff = 0;
        if (cl && t === trigTick[c] && t < speed) {
          // ------------------------------------------------ new row data
          const isTP = fx.some(f => f[0] === F.TPORTA);
          let s = C.s;
          if (cl.ins) {
            C.ins = cl.ins;
            if (insMode) C.inst = song.instruments[cl.ins - 1] || null;
          }
          const nt = cl.note;
          let noteSmp = null, playNote = nt;
          if (nt > 0 && nt <= 120) {
            if (insMode) {
              const inst = C.inst;
              const m = inst && inst.map[nt];
              if (m && m.smp && song.samples[m.smp - 1]) { noteSmp = song.samples[m.smp - 1]; playNote = m.note || nt; }
            } else if (C.ins && song.samples[C.ins - 1]) noteSmp = song.samples[C.ins - 1];
          } else if (cl.ins && !insMode && song.samples[cl.ins - 1]) {
            noteSmp = null; s = song.samples[cl.ins - 1];
          }
          if (cl.ins) {
            // instrument given: reset volume (and envelope) of the sample that will play
            const vs = noteSmp || (insMode ? C.s : song.samples[cl.ins - 1]);
            if (vs) { C.vol = vs.volume; C.ft = vs.finetune; }
            C.envT = 0; C.fade = 1; C.keyOn = true;
            if (!noteSmp && !insMode && s) { C.s = s; C.smp = s.index; }
          }
          for (const [code, a] of fx) if (code === F.FINETUNE) C.ft = a;
          if (nt > 0 && nt <= 120 && noteSmp) {
            const p = cl.per ? cl.per * Math.pow(2, -C.ft / 96) : periodOf({ ...noteSmp, finetune: C.ft }, playNote);
            if (isTP && C.per) { C.target = p; }
            else {
              if (!cl.ins) { C.ft = noteSmp.finetune; }
              const p2 = cl.per ? cl.per * Math.pow(2, -C.ft / 96) : periodOf({ ...noteSmp, finetune: C.ft }, playNote);
              C.s = noteSmp; C.smp = noteSmp.index; C.note = playNote;
              C.per = p2; C.target = p2; trig = true; C.offset = 0; C.active = true; C.keyOn = true; C.envT = 0; C.fade = 1;
              if (insMode && !cl.ins && C.inst) { /* XM/IT keep volume on note without instrument */ }
              if (C.vibWave < 4) C.vibPos = 0;
              if (C.tremWave < 4) C.tremPos = 0;
            }
            outCells[c].p = isTP ? C.target : C.per; outCells[c].s = C.smp;
          } else if (nt === OFF) {
            C.keyOn = false;
            const env = C.inst && C.inst.volEnv;
            if (!env || !env.on) C.vol = 0;
          } else if (nt === CUT) { C.vol = 0; C.active = false; }
          else if (nt === FADE) { C.keyOn = false; }
          if (cl.vol !== null && cl.vol !== undefined) C.vol = Math.max(0, Math.min(64, cl.vol));
          // tick-0 effects
          for (const [code, a, b] of fx) {
            switch (code) {
              case F.VOL: C.vol = Math.max(0, Math.min(64, a)); break;
              case F.FPUP: slide(C, memo(C, 'fpu', a)); break;
              case F.FPDN: slide(C, -memo(C, 'fpd', a)); break;
              case F.FVSLIDE: { const v = memo(C, 'fvs', a === null ? null : [a, b]); const [u, d] = Array.isArray(v) ? v : [0, 0]; C.vol = Math.max(0, Math.min(64, C.vol + u - d)); break; }
              case F.TPORTA: { const v = memo(C, 'tp', a); if (v) C.portaSpeed = v; break; }
              case F.VIB: if (a) C.vibSpeed = a; if (b) C.vibDepth = b; break;
              case F.TREM: if (a) C.tremSpeed = a; if (b) C.tremDepth = b; break;
              case F.OFFSET: { const v = memo(C, 'off', a); if (trig) C.offset = v; break; }
              case F.VIBWAVE: C.vibWave = a; break;
              case F.TREMWAVE: C.tremWave = a; break;
              case F.CHVOL: C.cv = Math.max(0, Math.min(64, a)); break;
              case F.CUT: if (a === 0) C.vol = 0; break;
              case F.KEYOFF: if (a === 0) { C.keyOn = false; const env = C.inst && C.inst.volEnv; if (!env || !env.on) C.vol = 0; } break;
              case F.PUP: memo(C, 'pu', a); break;
              case F.PDN: memo(C, 'pd', a); break;
              case F.VSLIDE: memo(C, 'vs', a === null ? null : [a, b]); break;
              case F.RETRIG: memo(C, 'rt', a); break;
            }
          }
        } else if (tr > 0 && t > trigTick[c]) {
          // ------------------------------------------------ tick > 0 effects
          for (const [code, a, b] of fx) {
            switch (code) {
              case F.PUP: slide(C, memo(C, 'pu', null)); break;
              case F.PDN: slide(C, -memo(C, 'pd', null)); break;
              case F.TPORTA:
                if (C.target && C.per !== C.target && C.portaSpeed) {
                  if (linear) {
                    const r = Math.pow(2, C.portaSpeed / 768);
                    C.per = C.per < C.target ? Math.min(C.target, C.per * r) : Math.max(C.target, C.per / r);
                  } else {
                    C.per = C.per < C.target ? Math.min(C.target, C.per + C.portaSpeed) : Math.max(C.target, C.per - C.portaSpeed);
                  }
                }
                break;
              case F.VIB: C.vibPos = (C.vibPos + C.vibSpeed) & 63; break;
              case F.TREM: C.tremPos = (C.tremPos + C.tremSpeed) & 63; break;
              case F.VSLIDE: { const v = memo(C, 'vs', null); const [u, d] = Array.isArray(v) ? v : [0, 0]; C.vol = Math.max(0, Math.min(64, C.vol + (u ? u : -d))); break; }
              case F.RETRIG: { const iv = memo(C, 'rt', null); if (iv && tr % iv === 0 && C.s) { trig = true; C.offset = 0; C.envT = 0; } break; }
              case F.CUT: if (tr === a) C.vol = 0; break;
              case F.KEYOFF: if (tr === a) { C.keyOn = false; const env = C.inst && C.inst.volEnv; if (!env || !env.on) C.vol = 0; } break;
            }
          }
        }
        // ------------------------------------------------ output
        let per = C.per;
        for (const [code, a, b] of fx) {
          if (code === F.ARP && (a || b) && per) {
            const k = tr % 3; arpSemi = k === 0 ? 0 : k === 1 ? a : b;
            per = per * Math.pow(2, -arpSemi / 12);
          } else if (code === F.VIB && tr > 0 && per) {
            const s = SINE[C.vibPos & 31] * C.vibDepth / 128;
            const off = (C.vibPos & 32) ? -s : s;
            if (linear) { const p2 = per * Math.pow(2, -(off * 4) / 768); vibOff = p2 - per; per = p2; } else { vibOff = off; per += off; }
          } else if (code === F.TREM && tr > 0) {
            const s = SINE[C.tremPos & 31] * C.tremDepth / 64;
            tremOff = (C.tremPos & 32) ? -s : s;
          }
        }
        let env = 64;
        const ve = C.inst && C.inst.volEnv;
        if (ve && ve.on && C.active) { env = envValue(ve, C); envAdvance(ve, C); }
        if (!C.keyOn && C.inst) {
          if (ve && ve.on) C.fade = Math.max(0, C.fade - (C.inst.fadeout || 0));
          else if (C.inst.fadeout) C.fade = Math.max(0, C.fade - C.inst.fadeout);
        }
        const gv = (C.s ? (C.s.gv ?? 1) : 1) * (C.inst ? (C.inst.gv ?? 1) : 1);
        let vol = Math.max(0, Math.min(64, C.vol + tremOff)) * env / 64 * C.fade * C.cv / 64 * gv;
        if (!C.active) vol = 0;
        tickState[c] = { per: C.active ? per : 0, base: C.per, vol: Math.round(vol * 100) / 100, smp: C.smp, trig, off: C.offset, arp: arpSemi, vib: vibOff };
      }
      rowRec.ticks.push(tickState);
    }
    // PT-style cell summary for the arranger (effects in ProTracker numbering)
    for (let c = 0; c < N; c++) {
      const cl = cells[c]; if (!cl) continue;
      const C = ch[c], oc = outCells[c], ref = C.per || 428;
      const toPT = (u) => linear ? Math.max(1, Math.round(ref * (Math.pow(2, u / 768) - 1))) : Math.round(u);
      for (const [code, a, b] of cl.fx) {
        if (code === F.ARP && (a || b)) { oc.e = 0; oc.x = (a << 4) | b; }
        else if (code === F.PUP) { const v = C.mem.pu || 0; if (v) { oc.e = 1; oc.x = Math.min(255, toPT(v)); } }
        else if (code === F.PDN) { const v = C.mem.pd || 0; if (v) { oc.e = 2; oc.x = Math.min(255, toPT(v)); } }
        else if (code === F.TPORTA) { const v = C.mem.tp || 0; oc.e = cl.fx.some(f => f[0] === F.VSLIDE) ? 5 : 3; oc.x = Math.min(255, toPT(v)); }
        else if (code === F.VIB) {
          let d = C.vibDepth; if (linear) d = Math.max(1, Math.round(d * 4 * ref * Math.LN2 / 768));
          if (oc.e !== 3 && oc.e !== 5) { oc.e = cl.fx.some(f => f[0] === F.VSLIDE) ? 6 : 4; oc.x = (Math.min(15, C.vibSpeed) << 4) | Math.min(15, d); }
        } else if (code === F.VOL && !oc.e) { oc.e = 0xC; oc.x = a; }
      }
    }
    out.push(rowRec);
    // ------------------------------------------------ row-end flow control
    for (let c = 0; c < N; c++) {
      const cl = cells[c]; if (!cl) continue;
      const C = ch[c];
      for (const [code, a] of cl.fx) {
        if (code === F.JUMP) jumpPos = a;
        else if (code === F.BREAK) breakRow = a;
        else if (code === F.LOOP) {
          if (a === 0) C.loopRow = row;
          else if (C.loopCount === 0) { C.loopCount = a; nextRow = C.loopRow; jumped = true; }
          else if (--C.loopCount > 0) { nextRow = C.loopRow; jumped = true; }
        }
      }
    }
    if (!jumped) {
      if (jumpPos >= 0) { nextPos = jumpPos; nextRow = breakRow >= 0 ? breakRow : 0; }
      else if (breakRow >= 0) { nextPos = pos + 1; nextRow = breakRow; }
      else if (nextRow >= pat.rows) { nextPos = pos + 1; nextRow = 0; }
    } else nextPos = pos;
    if (nextPos >= song.orders.length) {
      const k = (song.restart || 0) * 4096;
      loopTarget = visited.has(k) ? visited.get(k) : -1;
      if (loopTarget < 0 && !song.restart) loopTarget = 0;
      break;
    }
    const np = song.patterns[song.orders[nextPos]];
    if (np && np.rows && nextRow >= np.rows) nextRow = 0;
    pos = nextPos; row = nextRow;
  }
  return { rows: out, loopRow: Math.max(0, loopTarget), channels: N };
}

// --------------------------------------------------------------------------------------------
// Preview renderer (Paula-like mixer, linear interpolation), returns {left, right}
export function renderSong(song, replay, sampleRate = 44100, { maxSeconds = 600 } = {}) {
  const N = song.channels;
  let total = 0;
  for (const r of replay.rows) total += r.ticks.length * Math.round(sampleRate * 2.5 / r.bpm);
  total = Math.min(total, sampleRate * maxSeconds);
  const L = new Float32Array(total), R = new Float32Array(total);
  const st = Array.from({ length: N }, () => ({ smp: 0, pos: 0, active: false }));
  const pan = Array.from({ length: N }, (_, c) => ((c & 3) === 0 || (c & 3) === 3) ? 0.75 : 0.25);
  const gain = 0.5 / Math.sqrt(Math.max(4, N));
  let o = 0;
  for (const r of replay.rows) {
    const spt = Math.round(sampleRate * 2.5 / r.bpm);
    for (const tk of r.ticks) {
      for (let c = 0; c < N; c++) {
        const t = tk[c], S = st[c];
        if (t.trig && t.smp) { S.smp = t.smp; S.pos = t.off || 0; S.active = true; }
        else if (t.smp !== S.smp && t.smp && !t.trig) S.smp = t.smp;
        const smp = song.samples[S.smp - 1];
        if (!S.active || !smp || !smp.data.length || !t.per || !t.vol) continue;
        const step = PAULA_CLOCK / t.per / sampleRate;
        const g = t.vol / 64 * gain;
        const d = smp.data, n = d.length;
        const lend = smp.looped ? smp.loopStart + smp.loopLength : n;
        for (let i = 0; i < spt && o + i < total; i++) {
          if (S.pos >= lend) {
            if (smp.looped) S.pos = smp.loopStart + ((S.pos - smp.loopStart) % smp.loopLength);
            else { S.active = false; break; }
          }
          const ip = S.pos | 0, fr = S.pos - ip;
          const a = d[ip] / 128, bn = ip + 1 < lend ? d[ip + 1] / 128 : (smp.looped ? d[smp.loopStart] / 128 : 0);
          const v = (a + (bn - a) * fr) * g;
          L[o + i] += v * pan[c]; R[o + i] += v * (1 - pan[c]);
          S.pos += step;
        }
      }
      o += spt;
      if (o >= total) break;
    }
    if (o >= total) break;
  }
  return { left: L, right: R, sampleRate };
}
