// mod2sid – Amiga ProTracker MOD parser + tick-accurate replay
// (c) IT-DUMMKOPFEN, GPL-3.0

import { F, PAULA_CLOCK, replaySong, renderSong } from './song.js';
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
  const avail = Math.floor((b.length - hdr) / (256 * nch));
  if (npat > avail) npat = Math.max(...orders.slice(0, songLength)) + 1;
  const patterns = [];
  for (let p = 0; p < npat; p++) {
    const rows = [];
    for (let r = 0; r < 64; r++) {
      const row = [];
      for (let c = 0; c < nch; c++) {
        const o = hdr + p * 256 * nch + r * 4 * nch + c * 4;
        if (o + 3 >= b.length) { row.push({ s: 0, p: 0, e: 0, x: 0 }); continue; }
        row.push({ s: (b[o] & 0xF0) | (b[o + 2] >> 4), p: ((b[o] & 15) << 8) | b[o + 1], e: b[o + 2] & 15, x: b[o + 3] });
      }
      rows.push(row);
    }
    patterns.push(rows);
  }
  let off = hdr + npat * 256 * nch;
  for (const s of samples) {
    const n = Math.max(0, Math.min(s.length, b.length - off));
    const d = new Int8Array(n);
    for (let i = 0; i < n; i++) d[i] = (b[off + i] << 24) >> 24;
    s.data = d; s.length = n; off += s.length;
    if (s.loopStart + s.loopLength > n) s.loopLength = Math.max(0, n - s.loopStart);
    s.looped = s.loopLength > 2;
  }
  if (restart >= songLength || restart === 127 || restart === 120) restart = 0;
  return modToSong({ title, tag, channels: nch, numSamples: nsmp, samples, songLength, restart, orders: orders.slice(0, songLength), patterns });
}

// MOD patterns -> common song model (src/core/song.js)
export function modEffects(e, x) {
  const hx = x >> 4, lx = x & 15, fx = [];
  switch (e) {
    case 0: if (x) fx.push([F.ARP, hx, lx]); break;
    case 1: if (x) fx.push([F.PUP, x]); break;
    case 2: if (x) fx.push([F.PDN, x]); break;
    case 3: fx.push([F.TPORTA, x || null]); break;
    case 4: fx.push([F.VIB, hx, lx]); break;
    case 5: fx.push([F.TPORTA, null]); if (x) fx.push([F.VSLIDE, hx, lx]); break;
    case 6: fx.push([F.VIB, 0, 0]); if (x) fx.push([F.VSLIDE, hx, lx]); break;
    case 7: fx.push([F.TREM, hx, lx]); break;
    case 9: fx.push([F.OFFSET, x ? x * 256 : null]); break;
    case 0xA: if (x) fx.push([F.VSLIDE, hx, lx]); break;
    case 0xB: fx.push([F.JUMP, x]); break;
    case 0xC: fx.push([F.VOL, Math.min(64, x)]); break;
    case 0xD: { const r = hx * 10 + lx; fx.push([F.BREAK, r > 63 ? 0 : r]); break; }
    case 0xE:
      switch (hx) {
        case 1: fx.push([F.FPUP, lx]); break;
        case 2: fx.push([F.FPDN, lx]); break;
        case 4: fx.push([F.VIBWAVE, lx]); break;
        case 5: fx.push([F.FINETUNE, lx > 7 ? lx - 16 : lx]); break;
        case 6: fx.push([F.LOOP, lx]); break;
        case 7: fx.push([F.TREMWAVE, lx]); break;
        case 9: fx.push([F.RETRIG, lx]); break;
        case 0xA: fx.push([F.FVSLIDE, lx, 0]); break;
        case 0xB: fx.push([F.FVSLIDE, 0, lx]); break;
        case 0xC: fx.push([F.CUT, lx]); break;
        case 0xD: fx.push([F.NDELAY, lx]); break;
        case 0xE: fx.push([F.PDELAY, lx]); break;
      }
      break;
    case 0xF: if (x) fx.push(x < 32 ? [F.SPEED, x] : [F.TEMPO, x]); break;
  }
  return fx;
}

export function modToSong(mod) {
  const patterns = mod.patterns.map(rows => ({
    rows: rows.length,
    data: rows.map(row => row.map(cl => {
      if (!cl.s && !cl.p && !cl.e && !cl.x) return null;
      return { note: cl.p ? Math.max(1, Math.min(120, 61 + Math.round(12 * Math.log2(428 / cl.p)))) : 0, per: cl.p || 0, ins: cl.s, vol: null, fx: modEffects(cl.e, cl.x) };
    })),
  }));
  for (const s of mod.samples) { s.c4 = PAULA_CLOCK / 428; s.xpo = 0; s.gv = 1; }
  return { format: 'MOD', title: mod.title, channels: mod.channels, linear: false, samples: mod.samples, orders: mod.orders, restart: mod.restart, patterns, speed: 6, bpm: 125, tag: mod.tag };
}

export function replayMod(song, opts) { return replaySong(song.patterns && song.patterns[0] && song.patterns[0].data ? song : modToSong(song), opts); }
export function renderMod(song, replay, sampleRate, opts) { return renderSong(song, replay, sampleRate, opts); }
