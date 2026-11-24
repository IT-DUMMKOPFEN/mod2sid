// mod2sid – builds a PSID file (own GoatTracker-compatible player + song data)
// (c) IT-DUMMKOPFEN, GPL-3.0
import { assemble } from './asm6502.js';
import { playerAsm } from './player.js';
import { REST, KEYOFF, KEYON } from './gtsong.js';
import { FREQ } from './arrange.js';

// pattern rows -> compact player stream
export function compilePattern(rows) {
  const out = [];
  let i = 0;
  const empty = (r) => r[0] === REST && r[1] === 0 && r[2] === 0;
  while (i < rows.length) {
    const r = rows[i];
    if (empty(r)) {
      let n = 1; while (i + n < rows.length && empty(rows[i + n]) && n < 28) n++;
      out.push(0xE2 + n); i += n; continue;
    }
    let code;
    if (r[0] >= 0x60 && r[0] <= 0xBC) code = r[0] - 0x60;
    else if (r[0] === KEYOFF) code = 0x61; else if (r[0] === KEYON) code = 0x62; else code = 0x60;
    if (r[1]) code |= 0x80;
    out.push(code);
    if (r[1]) out.push(r[1]);
    out.push(r[2] & 15);
    if (r[2]) out.push(r[3]);
    i++;
  }
  out.push(0xFF);
  return out;
}

export function buildSID(song, { initTempo = 6, gate = 2, load = 0x1000, model = '6581', name, author, released } = {}) {
  const nv = song.orders.length;
  const PLAYER_ASM = playerAsm(nv);
  const tab1 = (arr, f) => [0, ...arr.map(f)];
  const data = {};
  const ins = song.instr;
  data.I_AD = tab1(ins, x => x.ad); data.I_SR = tab1(ins, x => x.sr); data.I_WV = tab1(ins, x => x.wv);
  data.I_PU = tab1(ins, x => x.pu); data.I_FI = tab1(ins, x => x.fi); data.I_VP = tab1(ins, x => x.vp);
  data.I_VD = tab1(ins, x => x.vd); data.I_GT = tab1(ins, x => x.gt); data.I_FW = tab1(ins, x => x.fw);
  data.WTL = tab1(song.wt, e => e[0]); data.WTR = tab1(song.wt, e => e[1]);
  data.PTL = tab1(song.pt, e => e[0]); data.PTR = tab1(song.pt, e => e[1]);
  data.FTL = tab1(song.ft, e => e[0]); data.FTR = tab1(song.ft, e => e[1]);
  data.SPDHI = tab1(song.st, e => e[0]); data.SPDLO = tab1(song.st, e => e[1]);
  data.FRQLO = FREQ.map(f => f & 0xFF); data.FRQHI = FREQ.map(f => f >> 8);
  const consts = { INITTEMPO: initTempo, GATE: gate, HRAD: 0x0F, HRSR: 0x00 };
  const names = Object.keys(data).concat(['ORDLO', 'ORDHI', 'PATLO', 'PATHI']);
  // pass 1: code size
  const dummy = Object.fromEntries(names.map(n => [n, 0x9999]));
  const first = assemble(PLAYER_ASM, load, { ...dummy, ...consts });
  const codeLen = first.code.length;
  // lay out data after code
  const bytes = [];
  const sym = { ...consts };
  const base = load + codeLen;
  const put = (n, arr) => { sym[n] = base + bytes.length; bytes.push(...arr.map(v => v & 0xFF)); };
  for (const [n, arr] of Object.entries(data)) put(n, arr);
  const olAddr = [];
  for (let v = 0; v < nv; v++) { olAddr.push(base + bytes.length); bytes.push(...song.orders[v], 0xFF, song.restarts && song.restarts[v] !== undefined ? song.restarts[v] : song.restart); }
  put('ORDLO', olAddr.map(a => a & 0xFF)); put('ORDHI', olAddr.map(a => a >> 8));
  const pats = song.patterns.map(compilePattern);
  const pl = base + bytes.length; bytes.push(...new Array(pats.length * 2).fill(0));
  sym.PATLO = pl; sym.PATHI = pl + pats.length;
  pats.forEach((p, i) => { const a = base + bytes.length; bytes[pl - base + i] = a & 0xFF; bytes[pl - base + pats.length + i] = a >> 8; bytes.push(...p); });
  const fin = assemble(PLAYER_ASM, load, sym);
  if (fin.code.length !== codeLen) throw new Error('player size mismatch');
  const binary = new Uint8Array(codeLen + bytes.length);
  binary.set(fin.code, 0); binary.set(bytes, codeLen);
  if (load + binary.length > 0xD000) throw new Error('SID zu groß / too large');
  // PSID header: v2 (1 SID), v3 (2 SIDs, second at $D420), v5 (4-8 SIDs, +$20 steps, as C64 GrooveGoat writes it)
  const nsid = Math.ceil(nv / 3);
  const ver = nsid === 1 ? 2 : nsid === 2 ? 3 : 5;
  const h = new Uint8Array(0x7C);
  const w16 = (o, v) => { h[o] = (v >> 8) & 255; h[o + 1] = v & 255; };
  h.set([0x50, 0x53, 0x49, 0x44]); w16(4, ver); w16(6, 0x7C); w16(8, 0); w16(10, load); w16(12, load + 3); w16(14, 1); w16(16, 1);
  const str = (o, s) => { const t = String(s || ''); for (let i = 0; i < Math.min(31, t.length); i++) { const c = t.charCodeAt(i); h[o + i] = c < 256 ? c : 63; } };
  str(0x16, name || song.name); str(0x36, author || song.author); str(0x56, released || song.copyright);
  const m = model === '8580' ? 2 : 1;
  w16(0x76, (m << 4) | 0x04 | (ver === 3 ? (m << 6) : 0));
  if (ver === 3) h[0x7A] = 0x42; // second SID at $D420
  if (ver === 5) { h[0x7A] = nsid & 0x0F; h[0x7B] = 0; } // layout 0: $D400, $D420, $D440 ...
  const psid = new Uint8Array(0x7C + 2 + binary.length);
  psid.set(h, 0); psid[0x7C] = load & 255; psid[0x7D] = load >> 8; psid.set(binary, 0x7E);
  return { psid, size: binary.length, codeLen, end: load + binary.length - 1, symbols: fin.syms };
}
