// mod2sid – GoatTracker 2 song model (instruments, tables, patterns) + .sng writer
// (c) IT-DUMMKOPFEN, GPL-3.0
export const REST = 0xBD, KEYOFF = 0xBE, KEYON = 0xBF, ENDPATT = 0xFF;
export const MAX_PATTERNS = 208, MAX_INSTR = 63, MAX_TABLE = 255;

export class GTSong {
  constructor(nch = 3) {
    this.nch = nch;
    this.name = ''; this.author = ''; this.copyright = '';
    this.instr = [];               // {ad,sr,wv,pu,fi,vp,vd,gt,fw,name}
    this.wt = []; this.pt = []; this.ft = []; this.st = [];   // [l,r] entries
    this.cache = new Map();
    this.patterns = []; this.patKey = new Map();
    this.orders = Array.from({ length: nch }, () => []); this.restart = 0;
    this.overflow = false;
  }
  // ---- tables. steps use 0-based jump targets; returns 1-based start position
  _addSteps(tab, key, steps, enc) {
    const k = key + JSON.stringify(steps);
    if (this.cache.has(k)) return this.cache.get(k);
    const start = tab.length + 1;
    if (tab.length + steps.length > MAX_TABLE) { this.overflow = true; return 0; }
    for (const s of steps) tab.push(enc(s, start));
    this.cache.set(k, start);
    return start;
  }
  addWave(steps) {
    if (!steps || !steps.length || (steps.length === 1 && steps[0][0] === 'S')) return 0;
    return this._addSteps(this.wt, 'W', steps, (s, start) => {
      if (s[0] === 'J') return [0xFF, start + s[1]];
      if (s[0] === 'S') return [0xFF, 0];
      const l = s[0] & 0xFF; let r = s[1];
      if (r === 'k') r = 0x80;
      else if (typeof r === 'object') r = 0x80 + Math.max(1, Math.min(95, r.a));
      else r = r >= 0 ? Math.min(0x5F, r) : 0x80 + Math.max(-32, r);
      return [l, r & 0xFF];
    });
  }
  addPulse(steps) {
    if (!steps || !steps.length) return 0;
    return this._addSteps(this.pt, 'P', steps, (s, start) => {
      if (s[0] === 'J') return [0xFF, start + s[1]];
      if (s[0] === 'S') return [0xFF, 0];
      return [s[0] & 0xFF, s[1] & 0xFF];
    });
  }
  addFilter(steps, voiceMask) {
    if (!steps || !steps.length) return 0;
    const TYPES = { lp: 0x90, bp: 0xA0, hp: 0xC0 };
    return this._addSteps(this.ft, 'F' + voiceMask, steps, (s, start) => {
      if (s[0] === 'J') return [0xFF, start + s[1]];
      if (s[0] === 'S') return [0xFF, 0];
      if (s[0] === 'T') return [TYPES[s[1]] || 0x90, ((s[2] & 15) << 4) | (voiceMask & 7)];
      if (s[0] === 'C') return [0x00, s[1] & 0xFF];
      return [Math.max(1, Math.min(0x7F, s[1])), s[2] & 0xFF];
    });
  }
  addSpeed(l, r) {
    const k = 'S' + l + ',' + r;
    if (this.cache.has(k)) return this.cache.get(k);
    if (this.st.length >= MAX_TABLE) { this.overflow = true; return 0; }
    this.st.push([l & 0xFF, r & 0xFF]);
    this.cache.set(k, this.st.length);
    return this.st.length;
  }
  addSpeed16(v) { v = Math.max(1, Math.min(0x7FFF, Math.round(v))); return this.addSpeed(v >> 8, v & 0xFF); }
  addInstrument(ins) {
    const k = 'I' + JSON.stringify(ins);
    if (this.cache.has(k)) return this.cache.get(k);
    if (this.instr.length >= MAX_INSTR) { this.overflow = true; return this.instr.length; }
    this.instr.push(ins);
    this.cache.set(k, this.instr.length);
    return this.instr.length;
  }
  addPattern(rows) {
    const k = rows.map(r => r.join(',')).join(';');
    if (this.patKey.has(k)) return this.patKey.get(k);
    this.patterns.push(rows);
    const id = this.patterns.length - 1;
    this.patKey.set(k, id);
    return id;
  }
  // ---- GTS5 writer
  toSNG() {
    const out = [];
    const str = (s, n) => { const b = new Uint8Array(n); const t = String(s || ''); for (let i = 0; i < Math.min(n, t.length); i++) { const c = t.charCodeAt(i); b[i] = c < 256 ? c : 63; } out.push(...b); };
    out.push(0x47, 0x54, 0x53, 0x35);
    str(this.name, 32); str(this.author, 32); str(this.copyright, 32);
    out.push(1);
    for (let v = 0; v < this.orders.length; v++) {
      const ol = this.orders[v];
      out.push(ol.length + 1, ...ol, 0xFF, this.restarts && this.restarts[v] !== undefined ? this.restarts[v] : this.restart);
    }
    out.push(this.instr.length);
    for (const i of this.instr) {
      out.push(i.ad & 255, i.sr & 255, i.wv & 255, i.pu & 255, i.fi & 255, i.vp & 255, i.vd & 255, i.gt & 255, i.fw & 255);
      str(i.name, 16);
    }
    for (const tab of [this.wt, this.pt, this.ft, this.st]) {
      out.push(tab.length, ...tab.map(e => e[0]), ...tab.map(e => e[1]));
    }
    out.push(this.patterns.length);
    for (const rows of this.patterns) {
      out.push(rows.length + 1);
      for (const r of rows) out.push(r[0], r[1], r[2], r[3]);
      out.push(ENDPATT, 0, 0, 0);
    }
    return Uint8Array.from(out);
  }
}

// C64 GrooveGoat song (.ggt): "GGT1" header + GoatTracker 2 song body with 3 channels per SID.
// GrooveGoat knows 1, 2, 4 or 8 SIDs: a 6-SID song is stored as 8 SIDs, SID 7 and 8 stay silent.
GTSong.prototype.toGGT = function (sids, { model = '6581' } = {}) {
  const ns = sids <= 1 ? 1 : sids <= 2 ? 2 : sids <= 4 ? 4 : 8;
  const nch = ns * 3;
  const save = { orders: this.orders, patterns: this.patterns, restarts: this.restarts };
  this.restarts = Array.from({ length: nch }, (_, v) => (v < this.orders.length ? (this.restarts ? this.restarts[v] ?? this.restart : this.restart) : 0));
  if (this.orders.length < nch) {
    // silent channels: one empty pattern
    let empty = this.patterns.findIndex(p => p.every(r => r[0] === REST && !r[1] && !r[2] && !r[3]));
    const pats = this.patterns.slice();
    if (empty < 0) { pats.push(Array.from({ length: 64 }, () => [REST, 0, 0, 0])); empty = pats.length - 1; }
    this.patterns = pats;
    this.orders = this.orders.concat(Array.from({ length: nch - this.orders.length }, () => [empty]));
  }
  const body = this.toSNG().subarray(4);
  this.orders = save.orders; this.patterns = save.patterns; this.restarts = save.restarts;
  const lens = new Map(); for (const p of this.patterns) lens.set(p.length, (lens.get(p.length) || 0) + 1);
  const plen = [...lens.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 64;
  const head = [0x47, 0x47, 0x54, 0x31, ns, model === '8580' ? 2 : 0, 1, 0x00, 0x0F];
  for (let k = 0; k < ns; k++) { const a = 0xD400 + k * 0x20; head.push(a & 255, a >> 8); }
  head.push(0);
  const trailer = [0x50, Math.min(128, plen), 2, 0, 0x47, 0x47, 0x58, 0x31]; // 'P' <pattern length>, size, "GGX1"
  const out = new Uint8Array(head.length + body.length + trailer.length);
  out.set(head, 0); out.set(body, head.length); out.set(trailer, head.length + body.length);
  return out;
};

// read back a GTS5 file (used for self-checks)
export function parseSNG(b, nch = 3) {
  let p = 0; const rd = () => b[p++];
  const id = String.fromCharCode(b[0], b[1], b[2], b[3]); p = 4;
  if (id === 'GGT1') {
    const ns = b[4]; nch = ns * 3; p = 4 + 1 + 1 + 1 + 2 + 2 * ns + 1;
    const tl = b[b.length - 6] | (b[b.length - 5] << 8);
    b = b.subarray(0, b.length - 6 - tl);
  } else if (id !== 'GTS5') throw new Error('not GTS5');
  p += 96;
  const subs = rd(); const orders = [];
  for (let s = 0; s < subs; s++) for (let c = 0; c < nch; c++) { const n = rd() + 1; orders.push(Array.from(b.slice(p, p + n))); p += n; }
  const ni = rd(); p += ni * 25;
  const tabs = [];
  for (let t = 0; t < 4; t++) { const n = rd(); tabs.push(n); p += 2 * n; }
  const np = rd(); const lens = [];
  for (let i = 0; i < np; i++) { const n = rd(); lens.push(n); if (b[p + (n - 1) * 4] !== 0xFF) throw new Error('pattern ' + i + ' end mark'); p += n * 4; }
  if (p !== b.length) throw new Error('trailing bytes ' + (b.length - p));
  return { orders, instruments: ni, tables: tabs, patterns: np, lens };
}
