// Features for correctly labelled studio sample libraries (folders of WAVs and ZIP
// archives; only WAV folders/files inside archives count). Labels come from the
// folder structure (folderlabel.mjs). Unlike extract_wav.mjs the audio is real
// 44.1/48 kHz material: it is resampled to Amiga rates and 8-bit quantised so the
// features match what the app sees inside modules.
// ALLWAV=1: take every WAV in the archives, not only those in WAV folders
// usage: node extract_lib.mjs <dir[,dir…]> <out.jsonl> <shard/of> [secs] [perDirMelodic] [perDirDrum]
import fs from 'fs';
import zlib from 'zlib';
import { analyzeSample, CLASSES } from '../../src/core/features.js';
import { folderLabel } from './folderlabel.mjs';
import { toAmiga, usageFor, plausible, rngFor } from './extract_wav.mjs';

const MAXREAD = 8 << 20;

export function readWavAny(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let p = 12, fmt = null, data = null, loop = null;
  while (p + 8 <= buf.length) {
    const id = buf.toString('ascii', p, p + 4), len = buf.readUInt32LE(p + 4), b = p + 8;
    if (id === 'fmt ' && b + 16 <= buf.length) {
      let tag = buf.readUInt16LE(b);
      if (tag === 0xFFFE && len >= 40 && b + 26 <= buf.length) tag = buf.readUInt16LE(b + 24);
      fmt = { tag, ch: buf.readUInt16LE(b + 2), rate: buf.readUInt32LE(b + 4), bits: buf.readUInt16LE(b + 14) };
    } else if (id === 'data') { data = buf.subarray(b, Math.min(buf.length, b + len)); }
    else if (id === 'smpl' && len >= 60 && b + 60 <= buf.length && buf.readUInt32LE(b + 28) > 0) loop = { start: buf.readUInt32LE(b + 44), end: buf.readUInt32LE(b + 48) };
    if (data && fmt) break;
    p = b + len + (len & 1);
  }
  if (!fmt || !data || fmt.ch < 1 || !fmt.rate) return null;
  const { tag, ch, bits } = fmt;
  if (!((tag === 1 && [8, 16, 24, 32].includes(bits)) || (tag === 3 && (bits === 32 || bits === 64)))) return null;
  const bps = bits / 8, n = Math.floor(data.length / (bps * ch));
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (let c = 0; c < ch; c++) {
      const o = (i * ch + c) * bps;
      if (tag === 3) v += bits === 32 ? data.readFloatLE(o) : data.readDoubleLE(o);
      else v += bits === 8 ? (data[o] - 128) / 128 : bits === 16 ? data.readInt16LE(o) / 32768 : bits === 24 ? data.readIntLE(o, 3) / 8388608 : data.readInt32LE(o) / 2147483648;
    }
    x[i] = v / ch;
  }
  return { x, rate: fmt.rate, loop };
}

// ---- minimal ZIP reader (stored/deflate, zip64) ----
function zipEntries(path) {
  const fd = fs.openSync(path, 'r'), size = fs.fstatSync(fd).size;
  const tl = Math.min(size, 65557), tail = Buffer.alloc(tl);
  fs.readSync(fd, tail, 0, tl, size - tl);
  let e = -1; for (let i = tl - 22; i >= 0; i--) if (tail.readUInt32LE(i) === 0x06054b50) { e = i; break; }
  if (e < 0) { fs.closeSync(fd); return { fd, list: [] }; }
  let cnt = tail.readUInt16LE(e + 10), cdSize = tail.readUInt32LE(e + 12), cdOff = tail.readUInt32LE(e + 16);
  if (cnt === 0xFFFF || cdOff === 0xFFFFFFFF || cdSize === 0xFFFFFFFF) {
    const l = e - 20;
    if (l >= 0 && tail.readUInt32LE(l) === 0x07064b50) {
      const off = Number(tail.readBigUInt64LE(l + 8)); const r = Buffer.alloc(56); fs.readSync(fd, r, 0, 56, off);
      cnt = Number(r.readBigUInt64LE(32)); cdSize = Number(r.readBigUInt64LE(40)); cdOff = Number(r.readBigUInt64LE(48));
    }
  }
  const cd = Buffer.alloc(cdSize); fs.readSync(fd, cd, 0, cdSize, cdOff);
  const list = []; let p = 0;
  for (let k = 0; k < cnt && p + 46 <= cd.length; k++) {
    if (cd.readUInt32LE(p) !== 0x02014b50) break;
    const flag = cd.readUInt16LE(p + 8), method = cd.readUInt16LE(p + 10);
    let csize = cd.readUInt32LE(p + 20), usize = cd.readUInt32LE(p + 24);
    const nl = cd.readUInt16LE(p + 28), xl = cd.readUInt16LE(p + 30), cl = cd.readUInt16LE(p + 32);
    let off = cd.readUInt32LE(p + 42);
    const name = cd.toString(flag & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nl);
    let q = p + 46 + nl; const xe = q + xl;
    while (q + 4 <= xe) {
      const id = cd.readUInt16LE(q), l = cd.readUInt16LE(q + 2); let r = q + 4;
      if (id === 1) {
        if (usize === 0xFFFFFFFF) { usize = Number(cd.readBigUInt64LE(r)); r += 8; }
        if (csize === 0xFFFFFFFF) { csize = Number(cd.readBigUInt64LE(r)); r += 8; }
        if (off === 0xFFFFFFFF) { off = Number(cd.readBigUInt64LE(r)); r += 8; }
      }
      q += 4 + l;
    }
    list.push({ name, method, csize, usize, off });
    p = xe + cl;
  }
  return { fd, list };
}
function zipRead(fd, ent) {
  const h = Buffer.alloc(30); fs.readSync(fd, h, 0, 30, ent.off);
  if (h.readUInt32LE(0) !== 0x04034b50) return null;
  const start = ent.off + 30 + h.readUInt16LE(26) + h.readUInt16LE(28);
  if (ent.method === 0) { const n = Math.min(ent.csize, MAXREAD); const b = Buffer.alloc(n); fs.readSync(fd, b, 0, n, start); return b; }
  if (ent.method !== 8 || ent.csize > 200 << 20) return null;
  const c = Buffer.alloc(ent.csize); fs.readSync(fd, c, 0, ent.csize, start);
  try { return zlib.inflateRawSync(c, { maxOutputLength: Math.max(MAXREAD, 1 << 20) }); }
  catch (e) { try { return zlib.inflateRawSync(c.subarray(0, Math.min(c.length, 4 << 20)), { finishFlush: zlib.constants.Z_SYNC_FLUSH }); } catch { return null; } }
}

function walk(dir, rel, out, zips) {
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    if (d.name.startsWith('.')) continue;
    const r = rel ? rel + '/' + d.name : d.name;
    if (d.isDirectory()) walk(dir + '/' + d.name, r, out, zips);
    else if (/\.wav$/i.test(d.name)) out.push(r);
    else if (/\.zip$/i.test(d.name)) zips.push(dir + '/' + d.name);
  }
}
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function pitchOf(name) {
  const m = name.replace(/\.wav$/i, '').match(/(?:^|[_ -])([A-G])(#|b)?(-?\d)$/) || name.match(/[_ -]([A-G])(#|b)?(-?\d)(?:[_ .]|$)/);
  return m ? (+m[3]) * 12 + NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : null;
}

// every labelled WAV of the library, grouped by folder and thinned out
export function collect(root, perMel = 10, perDrum = 30) {
  const items = [], zipsFound = [];
  for (const r of root.split(',')) {
    const fl = []; walk(r, '', fl, zipsFound);
    for (const f of fl) items.push({ src: 'dir', file: r + '/' + f, path: f });
  }
  for (const p of zipsFound.sort()) {
    const { fd, list } = zipEntries(p); fs.closeSync(fd);
    list.forEach((e, i) => {
      const base = e.name.replace(/\\/g, '/').split('/').pop();
      if (!/\.wav$/i.test(e.name) || /__macosx/i.test(e.name) || base.startsWith('._') || (!process.env.ALLWAV && !/(^|\/)wav\//i.test(e.name.replace(/\\/g, '/')))) return;
      items.push({ src: 'zip', zip: p, idx: i, path: e.name.replace(/\\/g, '/') });
    });
  }
  const groups = new Map();
  for (const it of items) {
    const lab = folderLabel(it.path); if (!lab) continue;
    it.cls = lab.cls; it.pack = lab.pack;
    const d = it.path.slice(0, it.path.lastIndexOf('/'));
    if (!groups.has(d)) groups.set(d, []); groups.get(d).push(it);
  }
  const sel = [];
  for (const [, g] of [...groups].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
    const drum = ['kick', 'snare', 'hihat', 'cymbal', 'tom', 'perc', 'beat'].includes(g[0].cls);
    let arr = g.slice().sort((a, b) => a.path < b.path ? -1 : 1);
    if (!drum) {
      const wp = arr.map(it => [it, pitchOf(it.path.split('/').pop())]);
      if (wp.filter(x => x[1] !== null).length > arr.length * 0.7) {
        wp.sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0));
        const a0 = Math.floor(wp.length * 0.2), a1 = Math.ceil(wp.length * 0.8);
        arr = wp.slice(a0, Math.max(a0 + 1, a1)).map(x => x[0]);
      }
    }
    const cap = drum ? perDrum : perMel;
    if (arr.length > cap) { const st = arr.length / cap; arr = Array.from({ length: cap }, (_, i) => arr[Math.floor(i * st + st / 2)]); }
    sel.push(...arr);
  }
  return sel;
}

if (import.meta.url === 'file://' + fs.realpathSync(process.argv[1])) {
  const [root, out, shardArg = '0/1', secs = '1e9', pm = '10', pd = '30'] = process.argv.slice(2);
  const [shard, of] = shardArg.split('/').map(Number);
  const t0 = Date.now();
  const listFile = out + '.list.json';
  let sel;
  if (fs.existsSync(listFile)) sel = JSON.parse(fs.readFileSync(listFile, 'utf8'));
  else { sel = collect(root, +pm, +pd); fs.writeFileSync(listFile, JSON.stringify(sel)); }
  const mine = sel.filter((_, i) => i % of === shard);
  const done = new Set();
  if (fs.existsSync(out)) for (const l of fs.readFileSync(out, 'utf8').split('\n')) if (l) { try { done.add(JSON.parse(l).k); } catch { } }
  const zips = new Map();
  let n = 0, rej = 0, bad = 0;
  for (const it of mine) {
    if (Date.now() - t0 > +secs * 1000) break;
    if (done.has(it.path)) continue;
    let buf = null;
    try {
      if (it.src === 'dir') { const fd = fs.openSync(it.file, 'r'); const sz = Math.min(fs.fstatSync(fd).size, MAXREAD); buf = Buffer.alloc(sz); fs.readSync(fd, buf, 0, sz, 0); fs.closeSync(fd); }
      else { if (!zips.has(it.zip)) zips.set(it.zip, zipEntries(it.zip)); const z = zips.get(it.zip); buf = zipRead(z.fd, z.list[it.idx]); }
    } catch { buf = null; }
    let row = { k: it.path, y: -1 };
    const w = buf && readWavAny(buf);
    if (w && w.x.length >= 64) {
      const r = rngFor(it.path);
      const rates = [8287, 8287, 11025, 16574];
      const R = rates[Math.floor(r() * rates.length)];
      const data = toAmiga(w.x, w.rate, R);
      let ls = 0, ll = 0;
      if (w.loop && w.loop.end > w.loop.start) { ls = Math.floor(w.loop.start * R / w.rate) & ~1; ll = Math.min(data.length, Math.floor(w.loop.end * R / w.rate)) - ls & ~1; if (ll < 4 || ls >= data.length) ls = ll = 0; }
      const s = { data, length: data.length, loopStart: ls, loopLength: ll, looped: ll > 2, volume: 64, name: '' };
      try {
        const a = analyzeSample(s, usageFor(it.cls, r, R));
        if (plausible(it.cls, a.info, a.features)) { row = { k: it.path, y: CLASSES.indexOf(it.cls), x: a.features.map(v => +v.toFixed(5)), src: 'lib:' + it.pack }; n++; }
        else rej++;
      } catch { bad++; }
    } else bad++;
    fs.appendFileSync(out, JSON.stringify(row) + '\n');
  }
  const left = mine.filter(it => !done.has(it.path)).length;
  console.log(`shard ${shard}/${of}: selected ${sel.length}, mine ${mine.length}, new rows ${n}, rejected ${rej}, unreadable ${bad}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
