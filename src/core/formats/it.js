// mod2sid – Impulse Tracker IT loader -> common song model (incl. IT 2.14/2.15 compressed samples)
// (c) IT-DUMMKOPFEN, GPL-3.0
import { F, OFF, CUT, FADE, cleanName, makeSample } from '../song.js';

export function isIT(b) { return b.length > 0xC0 && b[0] === 0x49 && b[1] === 0x4D && b[2] === 0x50 && b[3] === 0x4D; }

// ---------------------------------------------------------------- IT214/215 sample decompression
function itDecompress(b, p, len, is16, it215) {
  const out = is16 ? new Int16Array(len) : new Int8Array(len);
  let o = 0;
  while (o < len && p + 2 <= b.length) {
    const blen = b[p] | (b[p + 1] << 8); p += 2;
    const blk = b.subarray(p, p + blen); p += blen;
    let bp = 0, bbits = 0, bbuf = 0;
    const rd = (n) => {
      let v = 0;
      for (let i = 0; i < n; i++) {
        if (bbits === 0) { bbuf = bp < blk.length ? blk[bp] : 0; bp++; bbits = 8; }
        v |= (bbuf & 1) << i; bbuf >>= 1; bbits--;
      }
      return v >>> 0;
    };
    const count = Math.min(is16 ? 0x4000 : 0x8000, len - o);
    let width = is16 ? 17 : 9, t1 = 0, t2 = 0, k = 0;
    const W = is16 ? 16 : 8, top = is16 ? 18 : 10;
    while (k < count) {
      if (bp > blk.length + 4) return { out, p };
      let v = rd(width);
      if (width < 7) {
        if (v === 1 << (width - 1)) {
          const nw = rd(is16 ? 4 : 3) + 1;
          width = nw < width ? nw : nw + 1; continue;
        }
      } else if (width < W + 1) {
        const i = ((is16 ? 0xFFFF : 0xFF) >> (W + 1 - width)) + (is16 ? 8 : 4), j = i - (is16 ? 16 : 8);
        if (v > j && v <= i) {
          const nw = v - j;
          width = nw < width ? nw : nw + 1; continue;
        }
      } else if (width < top) {
        if (v >= (1 << W)) { width = (v + 1) & 0xFF; continue; }
      } else { k++; continue; }
      // value
      if (width < W) { const sh = 32 - width; v = (v << sh) >> sh; }
      if (is16) { t1 = (t1 + v) << 16 >> 16; t2 = (t2 + t1) << 16 >> 16; out[o + k] = it215 ? t2 : t1; }
      else { t1 = (t1 + v) << 24 >> 24; t2 = (t2 + t1) << 24 >> 24; out[o + k] = it215 ? t2 : t1; }
      k++;
    }
    o += count;
  }
  return { out, p };
}

const VOLPORTA = [0, 1, 4, 8, 16, 32, 64, 96, 128, 255];

function itEffect(cmd, x, linear, out, compatG) {
  const hx = x >> 4, lx = x & 15;
  const u = (v) => (linear ? v * 4 : v);
  switch (cmd) {
    case 1: if (x) out.push([F.SPEED, x]); break; // A
    case 2: out.push([F.JUMP, x]); break; // B
    case 3: out.push([F.BREAK, x]); break; // C (hex)
    case 4: case 11: case 12: { // D, K (H00+D), L (G00+D)
      if (cmd === 11) out.push([F.VIB, 0, 0]);
      if (cmd === 12) out.push([F.TPORTA, null]);
      if (!x) out.push([F.VSLIDE, null, 0]);
      else if (lx === 0xF && hx) out.push([F.FVSLIDE, hx, 0]);
      else if (hx === 0xF && lx) out.push([F.FVSLIDE, 0, lx]);
      else if (lx === 0) out.push([F.VSLIDE, hx, 0]);
      else out.push([F.VSLIDE, 0, lx]);
      break;
    }
    case 5: // E porta down
      if (!x) out.push([F.PDN, null]);
      else if (hx === 0xF) out.push([F.FPDN, u(lx)]);
      else if (hx === 0xE) out.push([F.FPDN, linear ? lx : lx / 4]);
      else out.push([F.PDN, u(x)]);
      break;
    case 6: // F porta up
      if (!x) out.push([F.PUP, null]);
      else if (hx === 0xF) out.push([F.FPUP, u(lx)]);
      else if (hx === 0xE) out.push([F.FPUP, linear ? lx : lx / 4]);
      else out.push([F.PUP, u(x)]);
      break;
    case 7: out.push([F.TPORTA, x ? u(x) : null]); break; // G
    case 8: out.push([F.VIB, hx, lx]); break; // H
    case 10: if (x) out.push([F.ARP, hx, lx]); break; // J
    case 13: out.push([F.CHVOL, Math.min(64, x)]); break; // M
    case 15: out.push([F.OFFSET, x ? x * 256 : null]); break; // O
    case 17: out.push([F.RETRIG, lx || null]); break; // Q
    case 18: out.push([F.TREM, hx, lx]); break; // R
    case 19: // S
      switch (hx) {
        case 3: out.push([F.VIBWAVE, lx]); break;
        case 4: out.push([F.TREMWAVE, lx]); break;
        case 0xB: out.push([F.LOOP, lx]); break;
        case 0xC: out.push([F.CUT, lx || 1]); break;
        case 0xD: out.push([F.NDELAY, lx]); break;
        case 0xE: out.push([F.PDELAY, lx]); break;
      }
      break;
    case 20: if (x >= 0x20) out.push([F.TEMPO, x]); break; // T
    case 21: out.push([F.VIB, hx, Math.max(1, lx >> 2)]); break; // U fine vibrato
  }
}

export function loadIT(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => (o + 2 <= b.length ? dv.getUint16(o, true) : 0), u32 = (o) => (o + 4 <= b.length ? dv.getUint32(o, true) : 0);
  const title = cleanName(b, 4, 26);
  const ordNum = u16(0x20), insNum = u16(0x22), smpNum = u16(0x24), patNum = u16(0x26), cmwt = u16(0x2A), flags = u16(0x2C);
  const useIns = !!(flags & 4), linear = !!(flags & 8);
  const gv = b[0x30], speed = b[0x32] || 6, tempo = b[0x33] || 125;
  const chanVol = Array.from(b.subarray(0x80, 0xC0));
  const chanPan = Array.from(b.subarray(0x40, 0x80));
  let p = 0xC0;
  const ordersRaw = Array.from(b.subarray(p, p + ordNum)); p += ordNum;
  const insOff = [], smpOff = [], patOff = [];
  for (let i = 0; i < insNum; i++) { insOff.push(u32(p)); p += 4; }
  for (let i = 0; i < smpNum; i++) { smpOff.push(u32(p)); p += 4; }
  for (let i = 0; i < patNum; i++) { patOff.push(u32(p)); p += 4; }
  // samples
  const samples = [];
  for (let i = 0; i < smpNum; i++) {
    const o = smpOff[i];
    const name = cleanName(b, o + 0x14, 26);
    const sgv = b[o + 0x11], sflg = b[o + 0x12], vol = b[o + 0x13], cvt = b[o + 0x2E];
    const len = u32(o + 0x30), lb = u32(o + 0x34), le = u32(o + 0x38), c5 = u32(o + 0x3C) || 8363, sp = u32(o + 0x48);
    let d = new Int8Array(0);
    if ((sflg & 1) && len && sp < b.length) {
      const is16 = !!(sflg & 2), stereo = !!(sflg & 4);
      if (sflg & 8) {
        const r = itDecompress(b, sp, len, is16, !!(cvt & 4));
        d = is16 ? Int8Array.from(r.out, v => v >> 8) : r.out;
      } else {
        const signed = !!(cvt & 1), n = Math.min(len, Math.floor((b.length - sp) / (is16 ? 2 : 1)));
        d = new Int8Array(n);
        for (let j = 0; j < n; j++) {
          if (is16) { let v = dv.getInt16(sp + j * 2, true); if (!signed) v = (v ^ 0x8000) << 16 >> 16; d[j] = v >> 8; }
          else { let v = b[sp + j]; if (!signed) v ^= 0x80; d[j] = (v << 24) >> 24; }
        }
      }
      if (stereo) { /* left channel only */ }
    }
    const loop = !!(sflg & 16) || !!(sflg & 32);
    const ls = (sflg & 16) ? lb : u32(o + 0x40), lend = (sflg & 16) ? le : u32(o + 0x44);
    samples.push(makeSample(i + 1, name, d, {
      loopStart: loop ? ls : 0, loopLength: loop ? Math.max(0, lend - ls) : 0, pingpong: !!(sflg & ((sflg & 16) ? 64 : 128)),
      volume: vol, c4: c5, gv: sgv / 64,
    }));
  }
  // instruments
  let instruments = null;
  if (useIns) {
    instruments = [];
    for (let i = 0; i < insNum; i++) {
      const o = insOff[i];
      const inst = { name: cleanName(b, o + 0x20, 26), map: new Array(121).fill(null), volEnv: null, fadeout: 0, gv: 1 };
      if (cmwt >= 0x200) {
        inst.fadeout = u16(o + 0x14) / 1024;
        inst.gv = b[o + 0x18] / 128;
        const e = o + 0x130, ef = b[e], n = Math.min(25, b[e + 1]);
        const pts = [];
        for (let k = 0; k < n; k++) pts.push([u16(e + 6 + k * 3 + 1), Math.min(64, b[e + 6 + k * 3])]);
        if ((ef & 1) && pts.length) inst.volEnv = { on: true, pts, loop: (ef & 2) ? b[e + 2] : -1, loopEnd: (ef & 2) ? b[e + 3] : -1, sus: (ef & 4) ? b[e + 4] : -1, susEnd: (ef & 4) ? b[e + 5] : -1 };
      } else {
        inst.fadeout = u16(o + 0x14) / 512;
      }
      for (let k = 0; k < 120; k++) {
        const nt = b[o + 0x40 + k * 2], sm = b[o + 0x41 + k * 2];
        if (sm && sm <= smpNum) inst.map[k + 1] = { smp: sm, note: Math.min(120, nt + 1) };
      }
      instruments.push(inst);
    }
  }
  // patterns
  const patterns = [];
  let nch = 1;
  for (let i = 0; i < patNum; i++) {
    const o = patOff[i];
    if (!o) { patterns.push({ rows: 64, data: Array.from({ length: 64 }, () => []) }); continue; }
    const plen = u16(o), rows = u16(o + 2) || 64;
    let q = o + 8; const end = q + plen;
    const data = Array.from({ length: rows }, () => []);
    const mask = new Uint8Array(64), last = Array.from({ length: 64 }, () => ({ note: 0, ins: 0, vp: 255, cmd: 0, x: 0 }));
    let r = 0;
    while (q < end && r < rows) {
      const cv = b[q++];
      if (cv === 0) { r++; continue; }
      const c = (cv - 1) & 63;
      if (cv & 128) mask[c] = b[q++];
      const m = mask[c], L = last[c];
      let note = -1, ins = -1, vp = -1, cmd = -1, x = 0;
      if (m & 1) { note = b[q++]; L.note = note; }
      if (m & 2) { ins = b[q++]; L.ins = ins; }
      if (m & 4) { vp = b[q++]; L.vp = vp; }
      if (m & 8) { cmd = b[q++]; x = b[q++]; L.cmd = cmd; L.x = x; }
      if (m & 16) note = L.note;
      if (m & 32) ins = L.ins;
      if (m & 64) vp = L.vp;
      if (m & 128) { cmd = L.cmd; x = L.x; }
      nch = Math.max(nch, c + 1);
      const fx = [];
      let vol = null;
      if (vp >= 0 && vp <= 64) vol = vp;
      else if (vp >= 65 && vp <= 74) fx.push([F.FVSLIDE, vp - 65, 0]);
      else if (vp >= 75 && vp <= 84) fx.push([F.FVSLIDE, 0, vp - 75]);
      else if (vp >= 85 && vp <= 94) fx.push([F.VSLIDE, vp - 85 || null, 0]);
      else if (vp >= 95 && vp <= 104) fx.push([F.VSLIDE, 0, vp - 95]);
      else if (vp >= 105 && vp <= 114) fx.push([F.PDN, (vp - 105) * (linear ? 16 : 4) || null]);
      else if (vp >= 115 && vp <= 124) fx.push([F.PUP, (vp - 115) * (linear ? 16 : 4) || null]);
      else if (vp >= 193 && vp <= 202) fx.push([F.TPORTA, VOLPORTA[vp - 193] ? VOLPORTA[vp - 193] * (linear ? 4 : 1) : null]);
      else if (vp >= 203 && vp <= 212) fx.push([F.VIB, 0, vp - 203]);
      if (cmd > 0) itEffect(cmd, x, linear, fx, !!(flags & 32));
      let n = 0;
      if (note >= 0 && note <= 119) n = note + 1; else if (note === 255) n = OFF; else if (note === 254) n = CUT; else if (note >= 120 && note < 254) n = FADE;
      if (!n && ins <= 0 && vol === null && !fx.length) continue;
      data[r][c] = { note: n, ins: Math.max(0, ins), vol, fx };
    }
    patterns.push({ rows, data });
  }
  // IT note 60 (C-5) plays at C5speed -> our note 61
  for (const pt of patterns) for (const row of pt.data) for (const cl of row) if (cl && cl.note > 0 && cl.note <= 120) cl.note = Math.min(120, cl.note);
  const orders = []; for (const o of ordersRaw) { if (o === 255) break; if (o < 254) orders.push(o); }
  // IT note numbering: note index 60 = C-5 = sample rate c5speed; in the song model note 61 plays at c4 -> same
  return {
    format: 'IT', title, channels: Math.max(1, nch), linear, samples, instruments: instruments || null, orders, restart: 0, patterns, speed, bpm: tempo,
    chanVol: Array.from({ length: Math.max(1, nch) }, (_, c) => (chanPan[c] & 128 ? 0 : Math.min(64, chanVol[c]))),
  };
}
