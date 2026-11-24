// mod2sid – DigiBooster Pro (DBM0) loader -> common song model
// (c) IT-DUMMKOPFEN, GPL-3.0
import { F, OFF, cleanName, makeSample } from '../song.js';
import { xmEffects } from './xm.js';

export function isDBM(b) { return b.length > 16 && b[0] === 0x44 && b[1] === 0x42 && b[2] === 0x4D && b[3] === 0x30; }

export function loadDBM(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u16 = (o) => (o + 2 <= b.length ? dv.getUint16(o) : 0), u32 = (o) => (o + 4 <= b.length ? dv.getUint32(o) : 0);
  const chunks = {};
  let p = 8;
  while (p + 8 <= b.length) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]), size = u32(p + 4);
    if (!chunks[id]) chunks[id] = { o: p + 8, size };
    p += 8 + size;
  }
  const title = chunks.NAME ? cleanName(b, chunks.NAME.o, Math.min(44, chunks.NAME.size)) : '';
  if (!chunks.INFO) throw new Error('DBM: INFO fehlt / missing');
  const io = chunks.INFO.o;
  const nins = u16(io), nsmp = u16(io + 2), npat = u16(io + 6), nch = u16(io + 8);
  // song 1 order list
  const orders = [];
  if (chunks.SONG) { const so = chunks.SONG.o, len = u16(so + 44); for (let i = 0; i < len; i++) orders.push(u16(so + 46 + i * 2)); }
  // raw samples
  const raw = [];
  if (chunks.SMPL) {
    let q = chunks.SMPL.o;
    for (let i = 0; i < nsmp; i++) {
      const fl = u32(q), len = u32(q + 4); q += 8;
      if (fl & 1) { raw.push(Int8Array.from(b.subarray(q, Math.min(b.length, q + len)), v => (v << 24) >> 24)); q += len; }
      else if (fl & 2) { const n = Math.min(len, (b.length - q) >> 1); const d = new Int8Array(n); for (let j = 0; j < n; j++) d[j] = dv.getInt16(q + j * 2) >> 8; raw.push(d); q += len * 2; }
      else if (fl & 4) { const n = Math.min(len, (b.length - q) >> 2); const d = new Int8Array(n); for (let j = 0; j < n; j++) d[j] = dv.getInt32(q + j * 4) >> 24; raw.push(d); q += len * 4; }
      else raw.push(new Int8Array(0));
    }
  }
  // instruments -> samples (each instrument plays one sample)
  const samples = [];
  const envs = {};
  if (chunks.VENV) {
    const vo = chunks.VENV.o, n = u16(vo);
    for (let i = 0; i < n; i++) {
      const e = vo + 2 + i * 136;
      const ins = u16(e) - 1, flg = b[e + 2] & 7, npt = b[e + 3] + 1, sus = b[e + 4], lps = b[e + 5], lpe = b[e + 6];
      const pts = [];
      for (let k = 0; k < Math.min(32, npt); k++) pts.push([u16(e + 8 + k * 4), Math.max(0, Math.min(64, (u16(e + 10 + k * 4) << 16) >> 16))]);
      if (flg & 1) envs[ins] = { on: true, pts, sus: (flg & 2) ? sus : -1, loop: (flg & 4) ? lps : -1, loopEnd: (flg & 4) ? lpe : -1 };
    }
  }
  const instruments = [];
  for (let i = 0; i < nins; i++) {
    const o = chunks.INST ? chunks.INST.o + i * 50 : 0;
    const name = o ? cleanName(b, o, 30) : '';
    const sn = o ? u16(o + 30) : 0;
    const vol = o ? Math.min(64, u16(o + 32)) : 64, c4 = o ? u32(o + 34) || 8363 : 8363, ls = o ? u32(o + 38) : 0, ll = o ? u32(o + 42) : 0, fl = o ? u16(o + 48) : 0;
    const d = sn > 0 && sn <= raw.length ? raw[sn - 1] : new Int8Array(0);
    samples.push(makeSample(i + 1, name, d, { loopStart: (fl & 3) ? ls : 0, loopLength: (fl & 3) ? ll : 0, pingpong: !!(fl & 2), volume: vol, c4 }));
    const inst = { name, map: new Array(121).fill(null), volEnv: envs[i] || null, fadeout: 0, gv: 1 };
    for (let n = 1; n <= 120; n++) inst.map[n] = { smp: i + 1, note: n };
    instruments.push(inst);
  }
  // patterns
  const patterns = [];
  if (chunks.PATT) {
    let q = chunks.PATT.o;
    for (let i = 0; i < npat; i++) {
      const rows = u16(q) || 64; let sz = u32(q + 2); q += 6;
      const end = q + sz;
      const data = Array.from({ length: rows }, () => new Array(nch).fill(null));
      let r = 0;
      while (q < end) {
        const c = b[q++];
        if (c === 0) { r++; continue; }
        const m = b[q++];
        let note = 0, ins = 0, f1 = 0, p1 = 0, f2 = 0, p2 = 0;
        if (m & 1) note = b[q++]; if (m & 2) ins = b[q++]; if (m & 4) f1 = b[q++]; if (m & 8) p1 = b[q++]; if (m & 16) f2 = b[q++]; if (m & 32) p2 = b[q++];
        if (r >= rows || c - 1 >= nch) continue;
        const fx = [];
        for (const [e, x] of [[f1, p1], [f2, p2]]) {
          if (!e && !x) continue;
          if (e === 0x1C) { if (x) fx.push([F.TEMPO, x]); continue; }
          if (e === 0x0E && (x >> 4) === 4) { fx.push([F.CUT, 0]); continue; }
          if (e === 0x0E && (x >> 4) === 3) continue;
          if (e === 0x0F && x >= 32) { fx.push([F.TEMPO, x]); continue; }
          xmEffects(e, x, false, fx);
        }
        data[r][c - 1] = { note: note === 0x1F ? OFF : (note ? 13 + (note >> 4) * 12 + (note & 15) : 0), ins, vol: null, fx };
      }
      q = end;
      patterns.push({ rows, data });
    }
  }
  return { format: 'DBM', title, channels: nch, linear: false, samples, instruments, orders: orders.filter(o => o < patterns.length), restart: 0, patterns, speed: 6, bpm: 125 };
}
