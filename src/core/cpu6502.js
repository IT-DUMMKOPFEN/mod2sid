// mod2sid – small 6502 CPU core (documented opcodes) used to run the SID playroutine
// (c) IT-DUMMKOPFEN, GPL-3.0
import { OPS, IMPL, BR } from './asm6502.js';

const TABLE = new Array(256).fill(null);
for (const [op, modes] of Object.entries(OPS)) for (const [md, code] of Object.entries(modes)) TABLE[code] = [op, md];
for (const [op, code] of Object.entries(IMPL)) TABLE[code] = [op, 'imp'];
for (const [op, code] of Object.entries(BR)) TABLE[code] = [op, 'rel'];
// additional common opcodes used by foreign tunes (indexed-indirect etc.)
const EXTRA = { 0xA1: ['LDA', 'indx'], 0x81: ['STA', 'indx'], 0xB6: ['LDX', 'zpy'], 0x96: ['STX', 'zpy'], 0x6C: ['JMP', 'ind'],
  0x08: ['PHP', 'imp'], 0x28: ['PLP', 'imp'], 0xB8: ['CLV', 'imp'], 0xD8: ['CLD', 'imp'], 0xF8: ['SED', 'imp'], 0x9A: ['TXS', 'imp'], 0xBA: ['TSX', 'imp'],
  0x61: ['ADC', 'indx'], 0xE1: ['SBC', 'indx'], 0xC1: ['CMP', 'indx'], 0x01: ['ORA', 'indx'], 0x21: ['AND', 'indx'], 0x41: ['EOR', 'indx'],
  0x16: ['ASL', 'zpx'], 0x56: ['LSR', 'zpx'], 0x36: ['ROL', 'zpx'], 0x76: ['ROR', 'zpx'] };
for (const [c, v] of Object.entries(EXTRA)) TABLE[+c] = v;

export class CPU6502 {
  constructor(mem, onWrite) {
    this.m = mem; this.onWrite = onWrite || null;
    this.a = 0; this.x = 0; this.y = 0; this.sp = 0xFF; this.c = 0; this.z = 0; this.n = 0; this.v = 0; this.d = 0; this.i = 1; this.pc = 0;
  }
  wr(a, v) { a &= 0xFFFF; v &= 0xFF; this.m[a] = v; if (this.onWrite && a >= 0xD400 && a <= 0xD7FF) this.onWrite(a & 0x1F, v); }
  push(v) { this.m[0x100 + this.sp] = v & 0xFF; this.sp = (this.sp - 1) & 0xFF; }
  pop() { this.sp = (this.sp + 1) & 0xFF; return this.m[0x100 + this.sp]; }
  nz(v) { v &= 0xFF; this.z = v === 0 ? 1 : 0; this.n = v >> 7; return v; }
  // call a subroutine and run until it returns
  call(addr, a = 0, maxSteps = 500000) {
    this.a = a & 0xFF; this.x = 0; this.y = 0;
    this.sp = 0xFD; this.m[0x1FF] = 0xFF; this.m[0x1FE] = 0xFE; // RTS -> $FFFF
    this.pc = addr; let n = 0;
    while (this.pc !== 0xFFFF) {
      this.step();
      if (++n > maxSteps) throw new Error('6502 runaway at $' + this.pc.toString(16));
    }
    return n;
  }
  step() {
    const m = this.m, pc = this.pc, code = m[pc];
    const ent = TABLE[code];
    if (!ent) throw new Error('Ungültiger Opcode $' + code.toString(16) + ' bei $' + pc.toString(16));
    const op = ent[0], md = ent[1];
    let addr = 0;
    switch (md) {
      case 'imp': case 'acc': this.pc = pc + 1; break;
      case 'imm': addr = pc + 1; this.pc = pc + 2; break;
      case 'zp': addr = m[pc + 1]; this.pc = pc + 2; break;
      case 'zpx': addr = (m[pc + 1] + this.x) & 0xFF; this.pc = pc + 2; break;
      case 'zpy': addr = (m[pc + 1] + this.y) & 0xFF; this.pc = pc + 2; break;
      case 'indy': { const z = m[pc + 1]; addr = ((m[z] | (m[(z + 1) & 0xFF] << 8)) + this.y) & 0xFFFF; this.pc = pc + 2; break; }
      case 'indx': { const z = (m[pc + 1] + this.x) & 0xFF; addr = m[z] | (m[(z + 1) & 0xFF] << 8); this.pc = pc + 2; break; }
      case 'rel': { let o = m[pc + 1]; if (o > 127) o -= 256; this.pc = pc + 2; addr = (this.pc + o) & 0xFFFF; break; }
      case 'ind': { const p = m[pc + 1] | (m[pc + 2] << 8); addr = m[p] | (m[(p & 0xFF00) | ((p + 1) & 0xFF)] << 8); this.pc = pc + 3; break; }
      default: {
        const base = m[pc + 1] | (m[pc + 2] << 8); this.pc = pc + 3;
        addr = md === 'abs' ? base : (base + (md === 'absx' ? this.x : this.y)) & 0xFFFF;
      }
    }
    switch (op) {
      case 'LDA': this.a = this.nz(m[addr]); break;
      case 'LDX': this.x = this.nz(m[addr]); break;
      case 'LDY': this.y = this.nz(m[addr]); break;
      case 'STA': this.wr(addr, this.a); break;
      case 'STX': this.wr(addr, this.x); break;
      case 'STY': this.wr(addr, this.y); break;
      case 'ADC': { const v = m[addr]; const r = this.a + v + this.c; this.v = ((this.a ^ r) & (v ^ r) & 0x80) ? 1 : 0; this.c = r > 0xFF ? 1 : 0; this.a = this.nz(r); break; }
      case 'SBC': { const v = m[addr] ^ 0xFF; const r = this.a + v + this.c; this.v = ((this.a ^ r) & (v ^ r) & 0x80) ? 1 : 0; this.c = r > 0xFF ? 1 : 0; this.a = this.nz(r); break; }
      case 'CMP': { const r = this.a - m[addr]; this.c = r >= 0 ? 1 : 0; this.nz(r); break; }
      case 'CPX': { const r = this.x - m[addr]; this.c = r >= 0 ? 1 : 0; this.nz(r); break; }
      case 'CPY': { const r = this.y - m[addr]; this.c = r >= 0 ? 1 : 0; this.nz(r); break; }
      case 'AND': this.a = this.nz(this.a & m[addr]); break;
      case 'ORA': this.a = this.nz(this.a | m[addr]); break;
      case 'EOR': this.a = this.nz(this.a ^ m[addr]); break;
      case 'BIT': { const v = m[addr]; this.z = (this.a & v) ? 0 : 1; this.n = v >> 7; this.v = (v >> 6) & 1; break; }
      case 'INC': { const v = (m[addr] + 1) & 0xFF; this.wr(addr, v); this.nz(v); break; }
      case 'DEC': { const v = (m[addr] - 1) & 0xFF; this.wr(addr, v); this.nz(v); break; }
      case 'ASL': case 'LSR': case 'ROL': case 'ROR': {
        let v = md === 'acc' ? this.a : m[addr], c;
        if (op === 'ASL') { c = v >> 7; v = (v << 1) & 0xFF; }
        else if (op === 'LSR') { c = v & 1; v >>= 1; }
        else if (op === 'ROL') { c = v >> 7; v = ((v << 1) | this.c) & 0xFF; }
        else { c = v & 1; v = (v >> 1) | (this.c << 7); }
        this.c = c; this.nz(v);
        if (md === 'acc') this.a = v; else this.wr(addr, v);
        break;
      }
      case 'INX': this.x = this.nz(this.x + 1); break;
      case 'INY': this.y = this.nz(this.y + 1); break;
      case 'DEX': this.x = this.nz(this.x - 1); break;
      case 'DEY': this.y = this.nz(this.y - 1); break;
      case 'TAX': this.x = this.nz(this.a); break;
      case 'TXA': this.a = this.nz(this.x); break;
      case 'TAY': this.y = this.nz(this.a); break;
      case 'TYA': this.a = this.nz(this.y); break;
      case 'TXS': this.sp = this.x; break;
      case 'TSX': this.x = this.nz(this.sp); break;
      case 'PHA': this.push(this.a); break;
      case 'PLA': this.a = this.nz(this.pop()); break;
      case 'PHP': this.push(this.c | (this.z << 1) | (this.i << 2) | (this.d << 3) | 0x30 | (this.v << 6) | (this.n << 7)); break;
      case 'PLP': { const p = this.pop(); this.c = p & 1; this.z = (p >> 1) & 1; this.i = (p >> 2) & 1; this.d = (p >> 3) & 1; this.v = (p >> 6) & 1; this.n = p >> 7; break; }
      case 'CLC': this.c = 0; break; case 'SEC': this.c = 1; break; case 'CLV': this.v = 0; break;
      case 'CLD': this.d = 0; break; case 'SED': this.d = 1; break; case 'SEI': this.i = 1; break; case 'CLI': this.i = 0; break;
      case 'NOP': break;
      case 'JMP': this.pc = addr; break;
      case 'JSR': { const r = this.pc - 1; this.push(r >> 8); this.push(r & 0xFF); this.pc = addr; break; }
      case 'RTS': { const lo = this.pop(), hi = this.pop(); this.pc = (((hi << 8) | lo) + 1) & 0xFFFF; break; }
      case 'RTI': { this.pop(); const lo = this.pop(), hi = this.pop(); this.pc = (hi << 8) | lo; break; }
      case 'BNE': if (!this.z) this.pc = addr; break;
      case 'BEQ': if (this.z) this.pc = addr; break;
      case 'BCC': if (!this.c) this.pc = addr; break;
      case 'BCS': if (this.c) this.pc = addr; break;
      case 'BPL': if (!this.n) this.pc = addr; break;
      case 'BMI': if (this.n) this.pc = addr; break;
      case 'BVC': if (!this.v) this.pc = addr; break;
      case 'BVS': if (this.v) this.pc = addr; break;
      default: throw new Error('op ' + op);
    }
  }
}
