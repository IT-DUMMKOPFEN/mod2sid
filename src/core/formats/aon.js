// mod2sid – Art Of Noise (AON4 / AON8) loader -> common song model
// Synth instruments become looped single-cycle waveforms marked as synth.
// (c) IT-DUMMKOPFEN, GPL-3.0
import { F, cleanName, makeSample, PAULA_CLOCK } from '../song.js';

export function isAON(b) { return b.length > 54 && b[0] === 0x41 && b[1] === 0x4F && b[2] === 0x4E && (b[3] === 0x34 || b[3] === 0x38); }

export function loadAON(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u32 = (o) => (o + 4 <= b.length ? dv.getUint32(o) : 0);
  const nch = b[3] === 0x38 ? 8 : 4;
  const ch = {};
  let p = 46;
  while (p + 8 <= b.length) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]), size = u32(p + 4);
    if (!ch[id]) ch[id] = { o: p + 8, size };
    p += 8 + size;
  }
  if (!ch.PLST || !ch.PATT || !ch.INST) throw new Error('AON: chunks fehlen / missing');
  const title = ch.NAME ? cleanName(b, ch.NAME.o, ch.NAME.size) : '';
  const npos = ch.INFO ? b[ch.INFO.o + 1] : ch.PLST.size, restart = ch.INFO ? b[ch.INFO.o + 2] : 0;
  const orders = Array.from(b.subarray(ch.PLST.o, ch.PLST.o + Math.min(npos || ch.PLST.size, ch.PLST.size)));
  const arps = [];
  for (let i = 0; i < 16; i++) arps.push(ch.ARPG ? Array.from(b.subarray(ch.ARPG.o + i * 4, ch.ARPG.o + i * 4 + 4)) : [0, 0, 0, 0]);
  // waveforms
  const waves = [];
  if (ch.WLEN) {
    let q = ch.WAVE ? ch.WAVE.o : b.length;
    for (let i = 0; i < ch.WLEN.size / 4; i++) {
      const l = u32(ch.WLEN.o + i * 4);
      waves.push(Int8Array.from(b.subarray(q, Math.min(b.length, q + l)), v => (v << 24) >> 24)); q += l;
    }
  }
  // instruments
  const nins = Math.floor(ch.INST.size / 32);
  const samples = [];
  for (let i = 0; i < nins; i++) {
    const o = ch.INST.o + i * 32;
    const type = b[o], vol = Math.min(64, b[o + 1]), ft = b[o + 2] & 15, wf = b[o + 3];
    const name = ch.INAM ? cleanName(b, ch.INAM.o + i * 32, 32) : '';
    const w = waves[wf] || new Int8Array(0);
    const finetune = ft > 7 ? ft - 16 : ft;
    if (type === 0) {
      const so = u32(o + 4) * 2, len = u32(o + 8) * 2, ls = u32(o + 12) * 2, ll = u32(o + 16) * 2;
      const d = w.subarray(Math.min(so, w.length), Math.min(w.length, so + len));
      samples.push(makeSample(i + 1, name, d, { loopStart: ll > 2 ? ls : 0, loopLength: ll > 2 ? ll : 0, volume: vol, finetune, c4: PAULA_CLOCK / 428 }));
    } else {
      const len = b[o + 4] * 2;
      const d = w.subarray(0, Math.min(w.length, Math.max(2, len)));
      samples.push(makeSample(i + 1, name, Int8Array.from(d), { loopStart: 0, loopLength: d.length, volume: vol, finetune, c4: PAULA_CLOCK / 428, synth: { type: 'aon', waveSpeed: b[o + 12], waveLength: b[o + 13] } }));
    }
  }
  // patterns: 64 rows x channels x 4 bytes
  const patterns = [];
  const npat = Math.floor(ch.PATT.size / (4 * nch * 64));
  for (let i = 0; i < npat; i++) {
    const data = Array.from({ length: 64 }, () => new Array(nch).fill(null));
    for (let r = 0; r < 64; r++) for (let c = 0; c < nch; c++) {
      const q = ch.PATT.o + ((i * 64 + r) * nch + c) * 4;
      const b1 = b[q], b2 = b[q + 1], b3 = b[q + 2], x = b[q + 3];
      const ins = b2 & 0x3F, note = b1 & 0x3F, arp = ((b3 & 0xC0) >> 4) | ((b2 & 0xC0) >> 6), e = b3 & 0x3F;
      if (!ins && !note && !e && !x && !arp) continue;
      const hx = x >> 4, lx = x & 15, fx = [];
      let n = note ? note + 24 : 0; // AoN note 37 = period 428 -> note 61
      switch (e) {
        case 0x0: if (x) fx.push([F.ARP, hx, lx]); break;
        case 0x1: if (x) fx.push([F.PUP, x]); break;
        case 0x2: if (x) fx.push([F.PDN, x]); break;
        case 0x3: fx.push([F.TPORTA, x || null]); break;
        case 0x4: fx.push([F.VIB, hx, lx]); break;
        case 0x5: fx.push([F.TPORTA, null]); if (x) fx.push([F.VSLIDE, hx, lx]); break;
        case 0x6: fx.push([F.VIB, 0, 0]); if (x) fx.push([F.VSLIDE, hx, lx]); break;
        case 0x9: fx.push([F.OFFSET, x ? x * 256 : null]); break;
        case 0xA: if (x) fx.push([F.VSLIDE, hx, lx]); break;
        case 0xB: fx.push([F.JUMP, x]); break;
        case 0xC: fx.push([F.VOL, Math.min(64, x)]); break;
        case 0xD: fx.push([F.BREAK, hx * 10 + lx]); break;
        case 0xE:
          if (hx === 1) fx.push([F.FPUP, lx]); else if (hx === 2) fx.push([F.FPDN, lx]);
          else if (hx === 6) fx.push([F.LOOP, lx]); else if (hx === 9) fx.push([F.RETRIG, lx]);
          else if (hx === 0xA) fx.push([F.FVSLIDE, lx, 0]); else if (hx === 0xB) fx.push([F.FVSLIDE, 0, lx]);
          else if (hx === 0xC) fx.push([F.CUT, lx]); else if (hx === 0xD) fx.push([F.NDELAY, lx]); else if (hx === 0xE) fx.push([F.PDELAY, lx]);
          break;
        case 0xF: if (x) fx.push(x <= 32 ? [F.SPEED, x] : [F.TEMPO, Math.min(200, x)]); break;
        case 0x14: fx.push([F.VOL, Math.min(64, x)], [F.VIB, 0, 0]); break; // K: set volume + vibrato
        case 0x15: fx.push([F.TPORTA, null]); if (x) fx.push([F.PUP, x]); break; // L
        case 0x16: fx.push([F.TPORTA, null]); if (x) fx.push([F.PDN, x]); break; // M
        case 0x19: fx.push([F.VIB, 0, 0]); if (x) fx.push([F.FVSLIDE, hx, lx]); break; // P
        case 0x1B: fx.push([F.VOL, Math.min(64, x)], [F.TPORTA, null]); break; // R
        case 0x1C: fx.push([F.TPORTA, null]); if (x) fx.push([F.FVSLIDE, hx, lx]); break; // S
        case 0x1D: fx.push([F.CHVOL, Math.min(64, x)]); break; // T: track volume
      }
      if (arp && n && !fx.some(f => f[0] === F.ARP)) {
        const a = arps[arp], cnt = a[0] >> 4, offs = [a[0] & 15];
        for (let k = 1; offs.length < cnt && k < 4; k++) { offs.push(a[k] >> 4); if (offs.length < cnt) offs.push(a[k] & 15); }
        if (offs.length >= 2) { n += offs[0]; fx.push([F.ARP, Math.max(0, offs[1] - offs[0]), Math.max(0, (offs[2] ?? offs[0]) - offs[0])]); }
        else if (offs.length === 1) n += offs[0];
      }
      data[r][c] = { note: Math.min(120, n), ins, vol: null, fx };
    }
    patterns.push({ rows: 64, data });
  }
  return { format: 'AON', title, channels: nch, linear: false, samples, orders: orders.filter(o => o < patterns.length), restart: restart < orders.length ? restart : 0, patterns, speed: 6, bpm: 125 };
}
