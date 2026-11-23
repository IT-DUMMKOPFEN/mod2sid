// mod2sid – minimal two-pass 6502 assembler (enough for the playroutine)
// (c) IT-DUMMKOPFEN, GPL-3.0
export const OPS = {
  ADC: { imm: 0x69, zp: 0x65, zpx: 0x75, abs: 0x6D, absx: 0x7D, absy: 0x79, indy: 0x71 },
  AND: { imm: 0x29, zp: 0x25, zpx: 0x35, abs: 0x2D, absx: 0x3D, absy: 0x39, indy: 0x31 },
  ORA: { imm: 0x09, zp: 0x05, zpx: 0x15, abs: 0x0D, absx: 0x1D, absy: 0x19, indy: 0x11 },
  EOR: { imm: 0x49, zp: 0x45, zpx: 0x55, abs: 0x4D, absx: 0x5D, absy: 0x59, indy: 0x51 },
  CMP: { imm: 0xC9, zp: 0xC5, zpx: 0xD5, abs: 0xCD, absx: 0xDD, absy: 0xD9, indy: 0xD1 },
  SBC: { imm: 0xE9, zp: 0xE5, zpx: 0xF5, abs: 0xED, absx: 0xFD, absy: 0xF9, indy: 0xF1 },
  LDA: { imm: 0xA9, zp: 0xA5, zpx: 0xB5, abs: 0xAD, absx: 0xBD, absy: 0xB9, indy: 0xB1 },
  STA: { zp: 0x85, zpx: 0x95, abs: 0x8D, absx: 0x9D, absy: 0x99, indy: 0x91 },
  LDX: { imm: 0xA2, zp: 0xA6, abs: 0xAE, absy: 0xBE },
  LDY: { imm: 0xA0, zp: 0xA4, zpx: 0xB4, abs: 0xAC, absx: 0xBC },
  STX: { zp: 0x86, abs: 0x8E }, STY: { zp: 0x84, zpx: 0x94, abs: 0x8C },
  CPX: { imm: 0xE0, zp: 0xE4, abs: 0xEC }, CPY: { imm: 0xC0, zp: 0xC4, abs: 0xCC },
  INC: { zp: 0xE6, zpx: 0xF6, abs: 0xEE, absx: 0xFE }, DEC: { zp: 0xC6, zpx: 0xD6, abs: 0xCE, absx: 0xDE },
  ASL: { acc: 0x0A, zp: 0x06, abs: 0x0E, absx: 0x1E }, LSR: { acc: 0x4A, zp: 0x46, abs: 0x4E, absx: 0x5E },
  ROL: { acc: 0x2A, zp: 0x26, abs: 0x2E, absx: 0x3E }, ROR: { acc: 0x6A, zp: 0x66, abs: 0x6E, absx: 0x7E },
  BIT: { zp: 0x24, abs: 0x2C }, JMP: { abs: 0x4C }, JSR: { abs: 0x20 },
};
export const IMPL = { RTS: 0x60, INX: 0xE8, INY: 0xC8, DEX: 0xCA, DEY: 0x88, TAX: 0xAA, TXA: 0x8A, TAY: 0xA8, TYA: 0x98,
  PHA: 0x48, PLA: 0x68, CLC: 0x18, SEC: 0x38, NOP: 0xEA, RTI: 0x40, SEI: 0x78, CLI: 0x58 };
export const BR = { BNE: 0xD0, BEQ: 0xF0, BCC: 0x90, BCS: 0xB0, BPL: 0x10, BMI: 0x30, BVC: 0x50, BVS: 0x70 };

// tiny arithmetic evaluator (no eval – works under a strict Content-Security-Policy)
function calc(src) {
  const tk = src.match(/\d+|[-+*/()]/g) || [];
  if (tk.join('') !== src.replace(/\s+/g, '')) throw new Error('Ausdruck: ' + src);
  let i = 0;
  const prim = () => {
    const t = tk[i++];
    if (t === '(') { const v = sum(); i++; return v; }
    if (t === '-') return -prim();
    if (t === '+') return prim();
    if (t === undefined) throw new Error('Ausdruck: ' + src);
    return Number(t);
  };
  const prod = () => { let v = prim(); while (tk[i] === '*' || tk[i] === '/') { const op = tk[i++]; const r = prim(); v = op === '*' ? v * r : v / r; } return v; };
  const sum = () => { let v = prod(); while (tk[i] === '+' || tk[i] === '-') { const op = tk[i++]; const r = prod(); v = op === '+' ? v + r : v - r; } return v; };
  return sum();
}

export function assemble(src, org, extSyms = {}) {
  const lines = src.split('\n').map(l => l.split(';')[0].replace(/\s+$/, '')).filter(l => l.trim());
  const syms = { ...extSyms };
  const ev = (expr, final) => {
    expr = expr.trim();
    let lo = false, hi = false;
    if (expr[0] === '<') { lo = true; expr = expr.slice(1); } else if (expr[0] === '>') { hi = true; expr = expr.slice(1); }
    const e = expr.replace(/\$[0-9A-Fa-f]+|%[01]+|[A-Za-z_][A-Za-z0-9_]*|\d+/g, t => {
      if (t[0] === '$') return String(parseInt(t.slice(1), 16));
      if (t[0] === '%') return String(parseInt(t.slice(1), 2));
      if (/^\d/.test(t)) return t;
      if (t in syms) return String(syms[t]);
      if (final) throw new Error('Unbekanntes Symbol: ' + t);
      return '0';
    });
    let v = Math.trunc(calc(e));
    if (lo) v &= 0xFF; if (hi) v = (v >> 8) & 0xFF;
    return v;
  };
  const knownZp = (a) => {
    a = a.trim();
    if (a[0] === '<' || a[0] === '>') return true;
    try { return ev(a, true) < 0x100; } catch { return false; }
  };
  let out = [];
  for (let pass = 0; pass < 2; pass++) {
    let pc = org; out = [];
    const final = pass === 1;
    for (let ln of lines) {
      const asg = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.+)$/.exec(ln);
      if (asg) { syms[asg[1]] = ev(asg[2], final); continue; }
      if (!/^\s/.test(ln)) {
        const i = ln.indexOf(':');
        const lab = (i >= 0 ? ln.slice(0, i) : ln).trim();
        if (pass === 0 && lab in syms && syms[lab] !== pc && !(lab in extSyms)) { /* redefinition allowed across passes */ }
        syms[lab] = pc;
        ln = i >= 0 ? ln.slice(i + 1) : '';
        if (!ln.trim()) continue;
      }
      const t = ln.trim(); const sp = t.search(/\s/);
      const op = (sp < 0 ? t : t.slice(0, sp)).toUpperCase();
      let arg = sp < 0 ? '' : t.slice(sp + 1).trim();
      if (op === '.BYTE') { for (const a of arg.split(',')) { if (a.trim()) { out.push(ev(a, final) & 0xFF); pc++; } } continue; }
      if (op === '.WORD') { for (const a of arg.split(',')) { if (a.trim()) { const v = ev(a, final); out.push(v & 0xFF, (v >> 8) & 0xFF); pc += 2; } } continue; }
      if (op in IMPL) { out.push(IMPL[op]); pc++; continue; }
      if (op in BR) {
        const tg = ev(arg, final), off = tg - (pc + 2);
        if (final && (off < -128 || off > 127)) throw new Error('Branch zu weit: ' + t);
        out.push(BR[op], off & 0xFF); pc += 2; continue;
      }
      const modes = OPS[op];
      if (!modes) throw new Error('Unbekannter Befehl: ' + t);
      if (arg === '' || arg.toUpperCase() === 'A') { out.push(modes.acc); pc++; continue; }
      if (arg[0] === '#') { out.push(modes.imm, ev(arg.slice(1), final) & 0xFF); pc += 2; continue; }
      let m = /^\((.+)\)\s*,\s*[yY]$/.exec(arg);
      if (m) { out.push(modes.indy, ev(m[1], final) & 0xFF); pc += 2; continue; }
      let idx = '';
      m = /^(.+),\s*([xXyY])$/.exec(arg);
      if (m) { arg = m[1]; idx = m[2].toLowerCase(); }
      let mode = (knownZp(arg) ? 'zp' : 'abs') + idx;
      if (!(mode in modes)) mode = 'abs' + idx;
      if (!(mode in modes)) throw new Error('Adressierungsart nicht erlaubt: ' + t);
      const v = ev(arg, final);
      if (mode.startsWith('zp')) { out.push(modes[mode], v & 0xFF); pc += 2; }
      else { out.push(modes[mode], v & 0xFF, (v >> 8) & 0xFF); pc += 3; }
    }
  }
  return { code: Uint8Array.from(out), syms };
}
