// mod2sid – FastTracker 2 XM loader -> common song model
// (c) IT-DUMMKOPFEN, GPL-3.0
import { F, OFF, cleanName, makeSample } from '../song.js';

export function isXM(b) { return b.length > 80 && cleanName(b, 0, 17) === 'Extended Module:'; }

// FT2 effects (effect number, parameter) -> common effects; memory = null
export function xmEffects(e, x, linear, out) {
  const hx = x >> 4, lx = x & 15, u = (v) => (linear ? v * 4 : v);
  const m = (v, f) => (v ? f(v) : null);
  switch (e) {
    case 0: if (x) out.push([F.ARP, hx, lx]); break;
    case 1: out.push([F.PUP, m(x, u)]); break;
    case 2: out.push([F.PDN, m(x, u)]); break;
    case 3: out.push([F.TPORTA, m(x, u)]); break;
    case 4: out.push([F.VIB, hx, lx]); break;
    case 5: out.push([F.TPORTA, null], [F.VSLIDE, x ? hx : null, lx]); break;
    case 6: out.push([F.VIB, 0, 0], [F.VSLIDE, x ? hx : null, lx]); break;
    case 7: out.push([F.TREM, hx, lx]); break;
    case 9: out.push([F.OFFSET, x ? x * 256 : null]); break;
    case 0xA: out.push([F.VSLIDE, x ? hx : null, lx]); break;
    case 0xB: out.push([F.JUMP, x]); break;
    case 0xC: out.push([F.VOL, Math.min(64, x)]); break;
    case 0xD: out.push([F.BREAK, hx * 10 + lx]); break;
    case 0xE:
      switch (hx) {
        case 1: out.push([F.FPUP, lx ? u(lx) : null]); break;
        case 2: out.push([F.FPDN, lx ? u(lx) : null]); break;
        case 4: out.push([F.VIBWAVE, lx]); break;
        case 5: out.push([F.FINETUNE, lx - 8]); break;
        case 6: out.push([F.LOOP, lx]); break;
        case 7: out.push([F.TREMWAVE, lx]); break;
        case 9: out.push([F.RETRIG, lx]); break;
        case 0xA: out.push([F.FVSLIDE, lx, 0]); break;
        case 0xB: out.push([F.FVSLIDE, 0, lx]); break;
        case 0xC: out.push([F.CUT, lx]); break;
        case 0xD: out.push([F.NDELAY, lx]); break;
        case 0xE: out.push([F.PDELAY, lx]); break;
      }
      break;
    case 0xF: if (x) out.push(x < 32 ? [F.SPEED, x] : [F.TEMPO, x]); break;
    case 20: out.push([F.KEYOFF, x]); break; // Kxx
    case 27: out.push([F.RETRIG, lx || null]); break; // Rxy (volume change ignored)
    case 33: // X1x / X2x extra fine porta
      if (hx === 1) out.push([F.FPUP, linear ? lx : lx / 4]);
      if (hx === 2) out.push([F.FPDN, linear ? lx : lx / 4]);
      break;
  }
}

function volColumn(v, linear, out) {
  if (v >= 0x10 && v <= 0x50) return v - 0x10;
  const hv = v >> 4, lv = v & 15;
  switch (hv) {
    case 6: out.push([F.VSLIDE, 0, lv]); break;
    case 7: out.push([F.VSLIDE, lv, 0]); break;
    case 8: out.push([F.FVSLIDE, 0, lv]); break;
    case 9: out.push([F.FVSLIDE, lv, 0]); break;
    case 0xA: out.push([F.VIB, lv, 0]); break;
    case 0xB: out.push([F.VIB, 0, lv]); break;
    case 0xF: out.push([F.TPORTA, lv ? (linear ? lv * 64 : lv * 16) : null]); break;
  }
  return null;
}

export function loadXM(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => (o + 2 <= b.length ? dv.getUint16(o, true) : 0), u32 = (o) => (o + 4 <= b.length ? dv.getUint32(o, true) : 0);
  const title = cleanName(b, 17, 20);
  const hsize = u32(60);
  const songLen = u16(64), restart = u16(66), nch = u16(68), npat = u16(70), nins = u16(72), flags = u16(74);
  const speed = u16(76) || 6, bpm = u16(78) || 125;
  const linear = !!(flags & 1);
  const orders = Array.from(b.subarray(80, 80 + Math.min(256, songLen)));
  let p = 60 + hsize;
  const patterns = [];
  for (let i = 0; i < npat; i++) {
    const hl = u32(p), rows = u16(p + 5) || 64, psz = u16(p + 7);
    let q = p + hl; const end = q + psz;
    const data = Array.from({ length: rows }, () => new Array(nch).fill(null));
    if (psz) for (let r = 0; r < rows; r++) for (let c = 0; c < nch; c++) {
      if (q >= end) break;
      let note = 0, ins = 0, vol = 0, e = 0, x = 0;
      const k = b[q++];
      if (k & 0x80) {
        if (k & 1) note = b[q++]; if (k & 2) ins = b[q++]; if (k & 4) vol = b[q++]; if (k & 8) e = b[q++]; if (k & 16) x = b[q++];
      } else { note = k; ins = b[q++]; vol = b[q++]; e = b[q++]; x = b[q++]; }
      if (!note && !ins && !vol && !e && !x) continue;
      const fx = [];
      const v = vol ? volColumn(vol, linear, fx) : null;
      xmEffects(e, x, linear, fx);
      data[r][c] = { note: note === 97 ? OFF : (note > 0 && note < 97 ? note + 12 : 0), ins, vol: v, fx };
    }
    patterns.push({ rows, data });
    p += hl + psz;
  }
  const samples = [], instruments = [];
  for (let i = 0; i < nins; i++) {
    if (p + 29 > b.length) break;
    const isz = u32(p) || 29, name = cleanName(b, p + 4, 22), ns = u16(p + 27);
    const inst = { name, map: new Array(121).fill(null), volEnv: null, fadeout: 0, gv: 1 };
    let q = p + isz;
    if (ns > 0 && p + 29 + 4 <= b.length) {
      const shs = u32(p + 29);
      const keymap = b.subarray(p + 33, p + 33 + 96);
      const pts = [];
      const nvp = b[p + 225], vs = b[p + 227], vls = b[p + 228], vle = b[p + 229], vt = b[p + 233];
      for (let k = 0; k < Math.min(12, nvp); k++) pts.push([u16(p + 129 + k * 4), Math.min(64, u16(p + 131 + k * 4))]);
      if ((vt & 1) && pts.length) inst.volEnv = { on: true, pts, sus: (vt & 2) ? vs : -1, loop: (vt & 4) ? vls : -1, loopEnd: (vt & 4) ? vle : -1 };
      inst.fadeout = u16(p + 239) / 32768;
      const hdrs = [];
      for (let k = 0; k < ns; k++) { hdrs.push(q); q += shs; }
      const first = samples.length;
      for (let k = 0; k < ns; k++) {
        const h = hdrs[k];
        const len = u32(h), ls = u32(h + 4), ll = u32(h + 8), vol = b[h + 12], ft = (b[h + 13] << 24) >> 24, type = b[h + 14], rel = (b[h + 16] << 24) >> 24;
        const sname = cleanName(b, h + 18, 22);
        const is16 = !!(type & 16);
        const n = is16 ? len >> 1 : len;
        const d = new Int8Array(Math.max(0, Math.min(n, is16 ? (b.length - q) >> 1 : b.length - q)));
        if (is16) { let acc = 0; for (let j = 0; j < d.length; j++) { acc = (acc + (q + j * 2 + 2 <= b.length ? dv.getInt16(q + j * 2, true) : 0)) << 16 >> 16; d[j] = acc >> 8; } }
        else { let acc = 0; for (let j = 0; j < d.length; j++) { acc = (acc + b[q + j]) & 255; d[j] = (acc << 24) >> 24; } }
        q += len;
        const lt = type & 3;
        samples.push(makeSample(samples.length + 1, sname || name, d, {
          loopStart: is16 ? ls >> 1 : ls, loopLength: lt ? (is16 ? ll >> 1 : ll) : 0, pingpong: lt === 2, volume: vol,
          c4: 8363 * Math.pow(2, (rel + ft / 128) / 12),
        }));
        if (!samples[samples.length - 1].name) samples[samples.length - 1].name = name;
      }
      for (let nt = 1; nt <= 120; nt++) {
        const k = keymap[Math.max(0, Math.min(95, nt - 13))];
        if (k < ns) inst.map[nt] = { smp: first + k + 1, note: nt };
      }
    }
    instruments.push(inst);
    p = q;
  }
  return { format: 'XM', title, channels: nch, linear, samples, instruments, orders: orders.filter(o => o < patterns.length), restart, patterns, speed, bpm };
}
