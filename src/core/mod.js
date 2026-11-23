// mod2sid – Amiga ProTracker MOD parser + tick-accurate replay
// (c) IT-DUMMKOPFEN, GPL-3.0

export const PAULA_PAL = 3546895;

const FINETUNE_RATIO = (ft) => Math.pow(2, -ft / 96); // period multiplier

// ProTracker sine table for vibrato/tremolo
const SINE = [0, 24, 49, 74, 97, 120, 141, 161, 180, 197, 212, 224, 235, 244, 250, 253,
  255, 253, 250, 244, 235, 224, 212, 197, 180, 161, 141, 120, 97, 74, 49, 24];

const PERIODS = [ // finetune 0, C-1 .. B-3 (ProTracker octaves 1-3), extended by octave 0/4
  1712, 1616, 1525, 1440, 1357, 1281, 1209, 1141, 1077, 1017, 961, 907,
  856, 808, 762, 720, 678, 640, 604, 570, 538, 508, 480, 453,
  428, 404, 381, 360, 339, 320, 302, 285, 269, 254, 240, 226,
  214, 202, 190, 180, 170, 160, 151, 143, 135, 127, 120, 113,
  107, 101, 95, 90, 85, 80, 76, 71, 67, 64, 60, 57];

export function periodToIndex(p) {
  // returns fractional semitone index relative to PERIODS[0]
  return 12 * Math.log2(1712 / p);
}

function str(b, o, n) {
  let s = '';
  for (let i = 0; i < n; i++) { const c = b[o + i]; if (!c) break; s += (c >= 32 && c < 127) ? String.fromCharCode(c) : ' '; }
  return s.replace(/\s+$/, '');
}

export function parseMod(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b.length < 600) throw new Error('Datei zu klein / file too small');
  const tag = String.fromCharCode(b[1080], b[1081], b[1082], b[1083]);
  let nsmp = 31, nch = 4, hdr = 1084;
  const known4 = ['M.K.', 'M!K!', 'FLT4', '4CHN', 'N.T.', 'M&K!', 'FEST', 'LARD', 'NSMS'];
  const chMatch = /^(\d)CHN$/.exec(tag) || /^(\d\d)CH$/.exec(tag) || /^(\d\d)CN$/.exec(tag);
  if (known4.includes(tag)) nch = 4;
  else if (tag === 'FLT8' || tag === 'OKTA' || tag === 'CD81') nch = 8;
  else if (chMatch) nch = parseInt(chMatch[1], 10);
  else { nsmp = 15; hdr = 600; nch = 4; }
  if (nch !== 4) {
    const e = new Error(`Nur 4-Kanal-MODs werden unterstützt (Datei hat ${nch} Kanäle) / only 4-channel MODs are supported (file has ${nch})`);
    e.code = 'CHANNELS'; throw e;
  }
  const title = str(b, 0, 20);
  const samples = [];
  for (let i = 0; i < nsmp; i++) {
    const o = 20 + i * 30;
    const len = ((b[o + 22] << 8) | b[o + 23]) * 2;
    let ft = b[o + 24] & 15; if (ft > 7) ft -= 16;
    const vol = Math.min(64, b[o + 25]);
    let ls = ((b[o + 26] << 8) | b[o + 27]) * 2;
    let ll = ((b[o + 28] << 8) | b[o + 29]) * 2;
    if (nsmp === 15) ls >>= 1; // Soundtracker loop start in bytes
    samples.push({ index: i + 1, name: str(b, o, 22), length: len, finetune: ft, volume: vol, loopStart: ls, loopLength: ll, data: null });
  }
  const olo = nsmp === 31 ? 950 : 470;
  const songLength = Math.max(1, Math.min(128, b[olo]));
  let restart = b[olo + 1];
  const orders = Array.from(b.slice(olo + 2, olo + 2 + 128));
  let npat = 0;
  for (let i = 0; i < 128; i++) if (orders[i] < 128) npat = Math.max(npat, orders[i] + 1);
  // guard against garbage beyond songLength
  const avail = Math.floor((b.length - hdr) / 1024);
  if (npat > avail) npat = Math.max(...orders.slice(0, songLength)) + 1;
  const patterns = [];
  for (let p = 0; p < npat; p++) {
    const rows = [];
    for (let r = 0; r < 64; r++) {
      const row = [];
      for (let c = 0; c < 4; c++) {
        const o = hdr + p * 1024 + r * 16 + c * 4;
        if (o + 3 >= b.length) { row.push({ s: 0, p: 0, e: 0, x: 0 }); continue; }
        row.push({ s: (b[o] & 0xF0) | (b[o + 2] >> 4), p: ((b[o] & 15) << 8) | b[o + 1], e: b[o + 2] & 15, x: b[o + 3] });
      }
      rows.push(row);
    }
    patterns.push(rows);
  }
  let off = hdr + npat * 1024;
  for (const s of samples) {
    const n = Math.max(0, Math.min(s.length, b.length - off));
    const d = new Int8Array(n);
    for (let i = 0; i < n; i++) d[i] = (b[off + i] << 24) >> 24;
    s.data = d; s.length = n; off += s.length;
    if (s.loopStart + s.loopLength > n) s.loopLength = Math.max(0, n - s.loopStart);
    s.looped = s.loopLength > 2;
  }
  if (restart >= songLength || restart === 127 || restart === 120) restart = 0;
  return { title, tag, numSamples: nsmp, samples, songLength, restart, orders: orders.slice(0, songLength), patterns };
}

// ---------------------------------------------------------------------------
// Replay: linearises the song (pattern breaks, jumps, loops, delays) and produces
// for every row and every tick the state of all 4 channels.
// rows[i] = { pos, pat, row, speed, bpm, cells[4], ticks: [[{per,vol,smp,trig,off}x4] x speed] }
export function replayMod(mod, { maxRows = 20000 } = {}) {
  const ch = [0, 1, 2, 3].map(() => ({
    smp: 0, per: 0, target: 0, vol: 0, portaSpeed: 0, vibPos: 0, vibSpeed: 0, vibDepth: 0, vibWave: 0,
    tremPos: 0, tremSpeed: 0, tremDepth: 0, loopRow: 0, loopCount: 0, ft: 0, note: -1, offset: 0, lastOffset: 0,
  }));
  let speed = 6, bpm = 125;
  let pos = 0, row = 0;
  const visited = new Map();
  const out = [];
  let loopTarget = -1;
  let patDelay = 0;
  while (out.length < maxRows) {
    if (pos >= mod.songLength) { loopTarget = -1; break; }
    const key = pos * 64 + row;
    const pat = mod.patterns[mod.orders[pos]];
    if (!pat) break;
    // loop detection only for row states without active E6 loops
    if (visited.has(key) && ch.every(c => c.loopCount === 0)) { loopTarget = visited.get(key); break; }
    if (!visited.has(key)) visited.set(key, out.length);
    const cells = pat[row];
    let nextPos = pos, nextRow = row + 1, jumped = false;
    let breakRow = -1, jumpPos = -1;
    // tick 0 pre-pass for speed changes
    for (let c = 0; c < 4; c++) {
      const { e, x } = cells[c];
      if (e === 0xF) { if (x === 0) { /* stop */ } else if (x < 32) speed = x; else bpm = x; }
    }
    const rowRec = { pos, pat: mod.orders[pos], row, speed, bpm, cells, ticks: [], delay: 0 };
    patDelay = 0;
    for (let c = 0; c < 4; c++) if (cells[c].e === 0xE && (cells[c].x >> 4) === 0xE) patDelay = cells[c].x & 15;
    const totalTicks = speed * (1 + patDelay);
    const trigTick = [0, 0, 0, 0];
    for (let c = 0; c < 4; c++) {
      const cl = cells[c];
      trigTick[c] = (cl.e === 0xE && (cl.x >> 4) === 0xD) ? (cl.x & 15) : 0;
    }
    for (let t = 0; t < totalTicks; t++) {
      const tr = t % speed; // tick within row repetition
      const tickState = [];
      for (let c = 0; c < 4; c++) {
        const C = ch[c], cl = cells[c];
        const e = cl.e, x = cl.x, hx = x >> 4, lx = x & 15;
        let trig = false;
        if (t === trigTick[c] && (t < speed)) {
          // new row data
          if (cl.s && mod.samples[cl.s - 1]) {
            C.smp = cl.s; C.vol = mod.samples[cl.s - 1].volume; C.ft = mod.samples[cl.s - 1].finetune;
          }
          if (e === 0xE && hx === 5) C.ft = lx > 7 ? lx - 16 : lx;
          if (cl.p) {
            const p = cl.p * FINETUNE_RATIO(C.ft);
            if (e === 3 || e === 5) { C.target = p; }
            else {
              C.per = p; C.target = p; trig = true; C.offset = 0;
              if (C.vibWave < 4) C.vibPos = 0;
              if (e === 9) { if (x) C.lastOffset = x * 256; C.offset = C.lastOffset; }
            }
          } else if (cl.s && !cl.p && e !== 3 && e !== 5) {
            // instrument without note: volume reset only
          }
          // tick-0 effects
          if (e === 0xC) C.vol = Math.min(64, x);
          if (e === 0xE) {
            if (hx === 1) C.per = Math.max(57, C.per - lx);
            if (hx === 2) C.per = Math.min(1712 * 2, C.per + lx);
            if (hx === 4) C.vibWave = lx;
            if (hx === 0xA) C.vol = Math.min(64, C.vol + lx);
            if (hx === 0xB) C.vol = Math.max(0, C.vol - lx);
          }
          if (e === 3 && x) C.portaSpeed = x;
          if (e === 4) { if (hx) C.vibSpeed = hx; if (lx) C.vibDepth = lx; }
          if (e === 7) { if (hx) C.tremSpeed = hx; if (lx) C.tremDepth = lx; }
        } else if (tr > 0 && t > trigTick[c]) {
          // tick>0 effects
          switch (e) {
            case 0: if (x) { /* arpeggio handled in output */ } break;
            case 1: C.per = Math.max(57, C.per - x); break;
            case 2: C.per = Math.min(3424, C.per + x); break;
            case 3: case 5: {
              if (C.target && C.per !== C.target) {
                if (C.per < C.target) C.per = Math.min(C.target, C.per + C.portaSpeed);
                else C.per = Math.max(C.target, C.per - C.portaSpeed);
              }
              if (e === 5) volSlide(C, x);
              break;
            }
            case 4: case 6: C.vibPos = (C.vibPos + C.vibSpeed) & 63; if (e === 6) volSlide(C, x); break;
            case 7: C.tremPos = (C.tremPos + C.tremSpeed) & 63; break;
            case 0xA: volSlide(C, x); break;
            case 0xE:
              if (hx === 9 && lx && tr % lx === 0) { trig = true; C.offset = 0; }
              if (hx === 0xC && tr === lx) C.vol = 0;
              break;
          }
        }
        if (e === 0xE && hx === 0xC && lx === 0 && t === 0) C.vol = 0;
        // output period with arpeggio / vibrato
        let per = C.per;
        if (e === 0 && x && per) {
          const k = tr % 3; const semi = k === 0 ? 0 : k === 1 ? hx : lx;
          per = per * Math.pow(2, -semi / 12);
        }
        let arpSemi = 0;
        if (e === 0 && x) { const k = tr % 3; arpSemi = k === 0 ? 0 : k === 1 ? hx : lx; }
        let vibOff = 0;
        if ((e === 4 || e === 6) && tr > 0) {
          const s = SINE[C.vibPos & 31] * C.vibDepth / 128;
          vibOff = (C.vibPos & 32) ? -s : s;
          per += vibOff;
        }
        let vol = C.vol;
        if (e === 7 && tr > 0) {
          const s = SINE[C.tremPos & 31] * C.tremDepth / 64;
          vol = Math.max(0, Math.min(64, vol + ((C.tremPos & 32) ? -s : s)));
        }
        tickState.push({ per, base: C.per, vol, smp: C.smp, trig, off: C.offset, arp: arpSemi, vib: vibOff });
      }
      rowRec.ticks.push(tickState);
    }
    rowRec.delay = patDelay;
    out.push(rowRec);
    // row-end flow control
    for (let c = 0; c < 4; c++) {
      const { e, x } = cells[c];
      const C = ch[c];
      if (e === 0xB) { jumpPos = x; }
      if (e === 0xD) { breakRow = (x >> 4) * 10 + (x & 15); if (breakRow > 63) breakRow = 0; }
      if (e === 0xE && (x >> 4) === 6) {
        const n = x & 15;
        if (n === 0) C.loopRow = row;
        else {
          if (C.loopCount === 0) { C.loopCount = n; nextRow = C.loopRow; jumped = true; }
          else if (--C.loopCount > 0) { nextRow = C.loopRow; jumped = true; }
        }
      }
    }
    if (!jumped) {
      if (jumpPos >= 0) { nextPos = jumpPos; nextRow = breakRow >= 0 ? breakRow : 0; }
      else if (breakRow >= 0) { nextPos = pos + 1; nextRow = breakRow; }
      else if (nextRow >= 64) { nextPos = pos + 1; nextRow = 0; }
    } else nextPos = pos;
    if (nextPos >= mod.songLength) {
      // natural end: loop to restart position
      const k = mod.restart * 64;
      loopTarget = visited.has(k) ? visited.get(k) : -1;
      if (loopTarget < 0 && mod.restart === 0) loopTarget = 0;
      break;
    }
    pos = nextPos; row = nextRow;
  }
  return { rows: out, loopRow: Math.max(0, loopTarget) };
}

function volSlide(C, x) {
  const up = x >> 4, dn = x & 15;
  if (up) C.vol = Math.min(64, C.vol + up); else C.vol = Math.max(0, C.vol - dn);
}

// Render MOD to audio (for A/B comparison in the app). Simple Paula mixer with
// linear interpolation and Amiga-style stereo (LRRL), returns {left,right}.
export function renderMod(mod, replay, sampleRate = 44100, { maxSeconds = 600 } = {}) {
  let total = 0;
  for (const r of replay.rows) total += r.ticks.length * Math.round(sampleRate * 2.5 / r.bpm);
  total = Math.min(total, sampleRate * maxSeconds);
  const L = new Float32Array(total), R = new Float32Array(total);
  const st = [0, 1, 2, 3].map(() => ({ smp: 0, pos: 0, active: false }));
  const pan = [0.8, 0.2, 0.2, 0.8];
  let o = 0;
  for (const r of replay.rows) {
    const spt = Math.round(sampleRate * 2.5 / r.bpm);
    for (const tk of r.ticks) {
      for (let c = 0; c < 4; c++) {
        const t = tk[c];
        const S = st[c];
        if (t.trig && t.smp) { S.smp = t.smp; S.pos = t.off || 0; S.active = true; }
        else if (t.smp !== S.smp && t.smp && !t.trig) { S.smp = t.smp; }
        const smp = mod.samples[S.smp - 1];
        if (!S.active || !smp || !smp.data.length || !t.per) continue;
        const step = PAULA_PAL / (2 * t.per) / sampleRate;
        const g = t.vol / 64 * 0.25;
        const d = smp.data, n = d.length;
        const lend = smp.looped ? smp.loopStart + smp.loopLength : n;
        for (let i = 0; i < spt && o + i < total; i++) {
          if (S.pos >= lend) {
            if (smp.looped) S.pos = smp.loopStart + ((S.pos - smp.loopStart) % smp.loopLength);
            else { S.active = false; break; }
          }
          const ip = S.pos | 0, fr = S.pos - ip;
          const a = d[ip] / 128, bnext = ip + 1 < lend ? d[ip + 1] / 128 : (smp.looped ? d[smp.loopStart] / 128 : 0);
          const v = (a + (bnext - a) * fr) * g;
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
