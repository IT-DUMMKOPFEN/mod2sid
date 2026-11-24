// mod2sid – module format detection and loading
// (c) IT-DUMMKOPFEN, GPL-3.0
import { parseMod } from '../mod.js';
import { isXM, loadXM } from './xm.js';
import { isIT, loadIT } from './it.js';
import { isMED, loadMED } from './med.js';
import { isDBM, loadDBM } from './dbm.js';
import { isAON, loadAON } from './aon.js';

export const EXTENSIONS = ['mod', 'med', 'mmd0', 'mmd1', 'mmd2', 'mmd3', 'omed', 'xm', 'it', 'dbm', 'aon', 'aon4', 'aon8'];
export const FORMAT_NAMES = { MOD: 'ProTracker MOD', XM: 'FastTracker 2 XM', IT: 'Impulse Tracker IT', MED: 'OctaMED', DBM: 'DigiBooster Pro', AON: 'Art Of Noise' };

// PowerPacker (PP20) decrunching, many Amiga modules are stored packed
export function pp20(d) {
  if (d.length < 16 || d[0] !== 0x50 || d[1] !== 0x50 || d[2] !== 0x32 || d[3] !== 0x30) return null;
  const offs = d.subarray(4, 8), outlen = (d[d.length - 4] << 16) | (d[d.length - 3] << 8) | d[d.length - 2], skip = d[d.length - 1];
  const src = d.subarray(8, d.length - 4);
  let pos = src.length, buf = 0, left = 0, o = outlen, written = 0;
  const out = new Uint8Array(outlen);
  const bits = (n) => {
    while (left < n) { if (pos <= 0) throw new Error('PP20'); buf |= src[--pos] << left; left += 8; }
    let v = 0; for (let i = 0; i < n; i++) { v = (v << 1) | (buf & 1); buf >>>= 1; }
    left -= n; return v;
  };
  bits(skip);
  while (written < outlen) {
    if (bits(1) === 0) {
      let todo = 1, x; do { x = bits(2); todo += x; } while (x === 3);
      while (todo--) { out[--o] = bits(8); written++; }
      if (written >= outlen) break;
    }
    let x = bits(2), offbits = offs[x], todo = x + 2, off;
    if (x === 3) { if (bits(1) === 0) offbits = 7; off = bits(offbits); let y; do { y = bits(3); todo += y; } while (y === 7); }
    else off = bits(offbits);
    while (todo--) { out[o - 1] = out[o + off]; o--; written++; }
  }
  return out;
}

export function detectFormat(b) {
  if (isXM(b)) return 'XM';
  if (isIT(b)) return 'IT';
  if (isMED(b)) return 'MED';
  if (isDBM(b)) return 'DBM';
  if (isAON(b)) return 'AON';
  return 'MOD';
}

export function loadSong(bytes) {
  let b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const un = pp20(b); if (un) b = un;
  const f = detectFormat(b);
  let song;
  switch (f) {
    case 'XM': song = loadXM(b); break;
    case 'IT': song = loadIT(b); break;
    case 'MED': song = loadMED(b); break;
    case 'DBM': song = loadDBM(b); break;
    case 'AON': song = loadAON(b); break;
    default: song = parseMod(b);
  }
  if (!song.orders.length) throw new Error('Keine Patterns / no patterns');
  song.format = song.format || f;
  return song;
}
