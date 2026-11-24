// mod2sid – MED / OctaMED loader (MMD0, MMD1, MMD2, MMD3) -> common song model
// Synth and hybrid instruments become looped waveform samples (first waveform) marked as synth.
// (c) IT-DUMMKOPFEN, GPL-3.0
import { F, CUT, cleanName, makeSample, PAULA_CLOCK } from '../song.js';

export function isMED(b) { return b.length > 52 && b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x44 && b[3] >= 0x30 && b[3] <= 0x33; }

const TEMPO_COMPAT = [195, 97, 65, 49, 39, 32, 28, 24, 22, 20];
const TEMPO_8CH = [179, 164, 152, 141, 131, 123, 116, 110, 104, 99];

// effective BPM in ProTracker units (tick = 2.5 s / bpm)
function medBpm(tempo, bpmOn, bpmLen, ch8) {
  if (tempo <= 0) tempo = 1;
  if (ch8) return TEMPO_8CH[Math.min(10, tempo) - 1];
  if (bpmOn) return tempo * bpmLen / 4;
  const t = tempo <= 10 ? TEMPO_COMPAT[tempo - 1] : tempo;
  return t * 10 / 2.64;
}

function medEffects(cmd, x, hexvol, bpmOn, bpmLen, ch8, hasNote, out, flags) {
  const hx = x >> 4, lx = x & 15;
  switch (cmd) {
    case 0x00: if (x) out.push([F.ARP, hx, lx]); break;
    case 0x01: if (x) out.push([F.PUP, x]); break;
    case 0x02: if (x) out.push([F.PDN, x]); break;
    case 0x03: out.push([F.TPORTA, x || null]); break;
    case 0x04: out.push([F.VIB, hx, lx * 2]); break; // twice as deep as ProTracker
    case 0x05: out.push([F.TPORTA, null]); if (x) out.push([F.VSLIDE, hx, lx]); break;
    case 0x06: out.push([F.VIB, 0, 0]); if (x) out.push([F.VSLIDE, hx, lx]); break;
    case 0x07: out.push([F.TREM, hx, lx]); break;
    case 0x09: if (x >= 1 && x <= 0x20) out.push([F.SPEED, x]); break;
    case 0x0A: case 0x0D: if (x) out.push([F.VSLIDE, hx, lx]); break;
    case 0x0B: out.push([F.JUMP, x]); break;
    case 0x0C: out.push([F.VOL, Math.min(64, hexvol ? x : hx * 10 + lx)]); break;
    case 0x0F:
      if (x === 0) out.push([F.BREAK, 0]);
      else if (x <= 0xF0) out.push([F.TEMPO, medBpm(x, bpmOn, bpmLen, ch8)]);
      else if (x === 0xF1) out.push([F.RETRIG, 3]);
      else if (x === 0xF2) out.push([F.NDELAY, 3]);
      else if (x === 0xF3) out.push([F.RETRIG, 2]);
      else if (x === 0xFF) flags.cut = true;
      break;
    case 0x11: out.push([F.FPUP, x]); break;
    case 0x12: out.push([F.FPDN, x]); break;
    case 0x14: out.push([F.VIB, hx, lx]); break;
    case 0x15: out.push([F.FINETUNE, ((x << 24) >> 24)]); break;
    case 0x16: out.push([F.LOOP, Math.min(15, x)]); break;
    case 0x18: out.push([F.CUT, Math.min(15, x)]); break;
    case 0x19: out.push([F.OFFSET, x ? x * 256 : null]); break;
    case 0x1A: if (x) out.push([F.FVSLIDE, x, 0]); break;
    case 0x1B: if (x) out.push([F.FVSLIDE, 0, x]); break;
    case 0x1D: out.push([F.BREAK, x]); break;
    case 0x1E: out.push([F.PDELAY, x]); break;
    case 0x1F: if (x && hasNote) { if (hx) out.push([F.NDELAY, hx]); if (lx) out.push([F.RETRIG, lx]); } break;
  }
}

export function loadMED(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const u8 = (o) => b[o] || 0, s8 = (o) => ((b[o] || 0) << 24) >> 24;
  const u16 = (o) => (o + 2 <= b.length ? dv.getUint16(o) : 0), u32 = (o) => (o + 4 <= b.length ? dv.getUint32(o) : 0);
  const ver = b[3] - 0x30; // 0..3
  const songOff = u32(8), blockArr = u32(16), smplArr = u32(24), expOff = u32(32);
  // song structure
  const smp = [];
  for (let i = 0; i < 63; i++) { const o = songOff + i * 8; smp.push({ rep: u16(o), replen: u16(o + 2), svol: u8(o + 6), strans: s8(o + 7) }); }
  let o = songOff + 63 * 8;
  const numBlocks = u16(o); let orders = [];
  let deftempo, playtransp, flags, flags2, tempo2, numSamples, trkvol = new Array(64).fill(64);
  if (ver <= 1) {
    const songLen = u16(o + 2);
    orders = Array.from(b.subarray(o + 4, o + 4 + Math.min(256, songLen)));
    o += 4 + 256;
    deftempo = u16(o); playtransp = s8(o + 2); flags = u8(o + 3); flags2 = u8(o + 4); tempo2 = u8(o + 5);
    for (let i = 0; i < 16; i++) trkvol[i] = Math.min(64, u8(o + 6 + i));
    numSamples = u8(o + 23);
  } else {
    const seqTable = u32(o + 4), trackVols = u32(o + 12), numTracks = u16(o + 16);
    o += 4 + 4 + 4 + 4 + 2 + 2 + 4 + 4 + 2 + 2 + 1 + 1 + 2 + 1 + 223;
    deftempo = u16(o); playtransp = s8(o + 2); flags = u8(o + 3); flags2 = u8(o + 4); tempo2 = u8(o + 5);
    numSamples = u8(o + 6 + 16 + 1);
    const ps = u32(seqTable);
    const len = u16(ps + 40);
    for (let i = 0; i < len; i++) { const v = u16(ps + 42 + i * 2); if (v < 0x8000) orders.push(v); }
    if (trackVols) for (let i = 0; i < Math.min(64, numTracks); i++) trkvol[i] = Math.min(64, u8(trackVols + i));
  }
  const hexvol = !!(flags & 0x10), ch8 = !!(flags & 0x40), bpmOn = !!(flags2 & 0x20), bpmLen = 1 + (flags2 & 0x1F);
  // expansion data: sample extras, instrument names, song name
  const ext = [];
  let title = '';
  const names = [];
  if (expOff) {
    const expSmp = u32(expOff + 4), sEntries = u16(expOff + 8), sSize = u16(expOff + 10);
    const iinfo = u32(expOff + 20), iEntries = u16(expOff + 24), iSize = u16(expOff + 26);
    const songName = u32(expOff + 44), songNameLen = u32(expOff + 48);
    for (let i = 0; i < sEntries && expSmp; i++) {
      const e = expSmp + i * sSize;
      ext.push({
        finetune: sSize >= 4 ? s8(e + 3) : 0, flags: sSize >= 8 ? u8(e + 5) : -1,
        lrep: sSize >= 18 ? u32(e + 10) : -1, lreplen: sSize >= 18 ? u32(e + 14) : -1,
      });
    }
    for (let i = 0; i < iEntries && iinfo; i++) names.push(cleanName(b, iinfo + i * iSize, 40));
    if (songName && songNameLen) title = cleanName(b, songName, Math.min(64, songNameLen));
  }
  // instruments -> samples (one sample per instrument slot)
  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const so = u32(smplArr + i * 4);
    const name = names[i] || '';
    const s = smp[i], ex = ext[i] || { finetune: 0, flags: -1, lrep: -1, lreplen: -1 };
    if (!so || so >= b.length) { samples.push(makeSample(i + 1, name, new Int8Array(0), { volume: 0 })); continue; }
    const len = u32(so), type = (u16(so + 4) << 16) >> 16;
    let d = new Int8Array(0), ls = 0, ll = 0, synth = null, xpo = s.strans + playtransp;
    if (type === -1 || type === -2) {
      // synth / hybrid: waveforms follow the 20 byte synth header + tables
      const base = so + 6; // pos after InstrHdr
      const wforms = u16(base + 14);
      const wf0 = u32(base + 16 + 256);
      if (wforms > 0 && wforms < 256) {
        if (type === -2) { // hybrid: first waveform is a normal sample
          const wo = so + wf0; const l2 = u32(wo);
          d = Int8Array.from(b.subarray(wo + 6, Math.min(b.length, wo + 6 + l2)), (v) => (v << 24) >> 24);
          ls = s.rep * 2; ll = s.replen > 1 ? s.replen * 2 : 0;
        } else {
          const wo = so + wf0; const l2 = u16(wo) * 2;
          d = Int8Array.from(b.subarray(wo + 2, Math.min(b.length, wo + 2 + l2)), (v) => (v << 24) >> 24);
          ls = 0; ll = d.length; xpo -= 24;
          synth = { type: 'med', vol: Array.from(b.subarray(base + 16, base + 16 + 128)), wf: Array.from(b.subarray(base + 16 + 128, base + 16 + 256)) };
        }
      }
    } else if (type >= 1 && type <= 6) {
      // multi-octave IFF instrument: use the highest octave (the shortest part) as the sample
      const oct = [5, 3, 2, 4, 6, 7][type - 1], part = Math.floor(len / ((1 << oct) - 1));
      d = Int8Array.from(b.subarray(so + 6, Math.min(b.length, so + 6 + part)), (v) => (v << 24) >> 24);
      ls = s.rep * 2; ll = s.replen > 1 ? s.replen * 2 : 0;
      if (ls + ll > d.length) { ls = 0; ll = 0; }
    } else {
      const is16 = !!(type & 0x10), stereo = !!(type & 0x20);
      const n = is16 ? len >> 1 : len;
      const cnt = Math.max(0, Math.min(stereo ? n >> 1 : n, is16 ? (b.length - so - 6) >> 1 : b.length - so - 6));
      d = new Int8Array(cnt);
      for (let j = 0; j < cnt; j++) d[j] = is16 ? (dv.getInt16(so + 6 + j * 2) >> 8) : ((b[so + 6 + j] << 24) >> 24);
      if (ver >= 3 && ex.lrep >= 0) { ls = ex.lrep; ll = ex.lreplen; } else { ls = s.rep * 2; ll = s.replen * 2; }
      if (is16) { ls >>= 0; }
      const loopOn = ex.flags >= 0 && ver >= 2 ? !!(ex.flags & 1) : s.replen > 1;
      if (!loopOn) ll = 0;
      if (ver >= 3 && (type & 7) === 0) xpo -= 24;
      if ((type & 7) === 7) xpo -= 24;
    }
    const smpObj = makeSample(i + 1, name, d, {
      loopStart: ls, loopLength: ll, pingpong: ex.flags >= 0 && ver >= 2 && !!(ex.flags & 8),
      volume: (ex.flags >= 0 && (ex.flags & 4)) ? 0 : Math.min(64, s.svol), finetune: ex.finetune, c4: PAULA_CLOCK / 428, xpo,
      synth,
    });
    smpObj.medOctaves = (type === 0 || (type & 7) === 0) && ver < 3 ? 3 : (type & 7) === 7 ? 5 : 0;
    samples.push(smpObj);
  }
  // blocks
  const patterns = [];
  let nch = 1;
  for (let i = 0; i < numBlocks; i++) {
    const bo = u32(blockArr + i * 4);
    if (!bo) { patterns.push({ rows: 64, data: Array.from({ length: 64 }, () => []) }); continue; }
    let tracks, lines, q;
    if (ver === 0) { tracks = u8(bo); lines = u8(bo + 1) + 1; q = bo + 2; } else { tracks = u16(bo); lines = u16(bo + 2) + 1; q = bo + 8; }
    nch = Math.max(nch, tracks);
    const data = Array.from({ length: lines }, () => new Array(tracks).fill(null));
    for (let r = 0; r < lines; r++) for (let c = 0; c < tracks; c++) {
      let note, ins, cmd, x;
      if (ver === 0) {
        const a = u8(q), b1 = u8(q + 1), b2 = u8(q + 2); q += 3;
        note = a & 0x3F; ins = (b1 >> 4) | ((a & 0x80) >> 3) | ((a & 0x40) >> 1); cmd = b1 & 15; x = b2;
      } else {
        note = u8(q) & 0x7F; ins = u8(q + 1) & 0x3F; cmd = u8(q + 2); x = u8(q + 3); q += 4;
      }
      if (!note && !ins && !cmd && !x) continue;
      const fx = [], fl = {};
      medEffects(cmd, x, hexvol, bpmOn, bpmLen, ch8, !!note, fx, fl);
      let n = 0;
      if (note > 0 && note <= 0x7F) {
        n = note + 48; // MED C-2 (note 13) = ProTracker period 428 -> note 61
        const s = samples[(ins || 0) - 1];
        if (s && s.medOctaves === 3) { // MED plays normal samples in 3 octaves, higher notes wrap down
          const oct = Math.floor((note - 1 + playtransp) / 12);
          if (oct > 2) n -= 12 * (oct - 2);
        }
      }
      if (fl.cut) n = CUT;
      data[r][c] = { note: Math.max(0, Math.min(120, n)) || (fl.cut ? CUT : 0), ins, vol: null, fx };
      if (fl.cut) data[r][c].note = CUT;
    }
    patterns.push({ rows: lines, data });
  }
  return {
    format: 'MED', title: title || 'OctaMED', channels: nch, linear: false, samples, orders: orders.filter(x => x < patterns.length), restart: 0, patterns,
    speed: tempo2 || 6, bpm: medBpm(deftempo, bpmOn, bpmLen, ch8), chanVol: trkvol.slice(0, nch),
  };
}
