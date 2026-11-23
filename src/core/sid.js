// mod2sid – compact MOS 6581/8580 SID emulation + PSID player (for in-app preview)
// (c) IT-DUMMKOPFEN, GPL-3.0
import { CPU6502 } from './cpu6502.js';

const PAL_CLOCK = 985248;
const RATE = [9, 32, 63, 95, 149, 220, 267, 313, 392, 977, 1954, 3126, 3907, 11720, 19532, 31251];
const ACC_MASK = 0xFFFFFF;

class Voice {
  constructor() { this.reset(); }
  reset() {
    this.freq = 0; this.pw = 0; this.ctrl = 0; this.ad = 0; this.sr = 0;
    this.acc = 0; this.lfsr = 0x7FFFF8; this.noiseOut = 0;
    this.env = 0; this.state = 'R'; this.rc = 0; this.ec = 0; this.prevMsb = 0; this.msbRise = false;
  }
  setCtrl(v) {
    const gateOld = this.ctrl & 1, gateNew = v & 1;
    if ((v & 8) && !(this.ctrl & 8)) { this.acc = 0; }
    if (!(v & 8) && (this.ctrl & 8)) { /* test released */ }
    if (!gateOld && gateNew) { this.state = 'A'; }
    else if (gateOld && !gateNew) { this.state = 'R'; }
    this.ctrl = v;
  }
  envStep() {
    if (this.state === 'A') {
      this.env = (this.env + 1) & 0xFF;
      if (this.env === 0xFF) { this.state = 'D'; }
      return;
    }
    // exponential counter for decay/release
    const e = this.env;
    const per = e >= 94 ? 1 : e >= 55 ? 2 : e >= 27 ? 4 : e >= 15 ? 8 : e >= 7 ? 16 : 30;
    if (++this.ec < per) return;
    this.ec = 0;
    if (this.state === 'D') {
      const sus = (this.sr >> 4) * 17;
      if (this.env > sus) this.env--;
    } else if (this.state === 'R') {
      if (this.env > 0) this.env--;
    }
  }
  clockEnv(cycles) {
    const r = this.state === 'A' ? (this.ad >> 4) : this.state === 'D' ? (this.ad & 15) : (this.sr & 15);
    const period = RATE[r];
    this.rc += cycles;
    let guard = 0;
    while (this.rc >= period && guard++ < 64) { this.rc -= period; this.envStep(); }
  }
  wave(ringMsb) {
    const c = this.ctrl, acc = this.acc;
    const w = c >> 4;
    if (!w) return -1;
    let out = 0xFFF, any = false;
    if (w & 1) { // triangle
      let msb = (acc >> 23) & 1; if (c & 4) msb ^= ringMsb;
      const t = ((msb ? (acc ^ ACC_MASK) : acc) >> 11) & 0xFFF;
      out &= t; any = true;
    }
    if (w & 2) { out &= (acc >> 12) & 0xFFF; any = true; }
    if (w & 4) { out &= ((c & 8) || ((acc >> 12) >= this.pw)) ? 0xFFF : 0; any = true; }
    if (w & 8) { out &= this.noiseOut; any = true; }
    return any ? out : -1;
  }
}

export class SID {
  constructor(sampleRate = 44100, model = '6581') {
    this.sampleRate = sampleRate;
    this.cps = PAL_CLOCK / sampleRate;
    this.v = [new Voice(), new Voice(), new Voice()];
    this.regs = new Uint8Array(32);
    this.mute = [false, false, false];
    this.setModel(model);
    this.lp = 0; this.bp = 0; this.dc = 0; this.post = 0;
  }
  setModel(m) { this.model = m === '8580' ? '8580' : '6581'; }
  reset() { this.v.forEach(v => v.reset()); this.regs.fill(0); this.lp = this.bp = 0; }
  write(r, val) {
    r &= 0x1F; this.regs[r] = val;
    if (r < 21) {
      const v = this.v[(r / 7) | 0], k = r % 7;
      if (k === 0) v.freq = (v.freq & 0xFF00) | val;
      else if (k === 1) v.freq = (v.freq & 0xFF) | (val << 8);
      else if (k === 2) v.pw = (v.pw & 0xF00) | val;
      else if (k === 3) v.pw = (v.pw & 0xFF) | ((val & 15) << 8);
      else if (k === 4) v.setCtrl(val);
      else if (k === 5) v.ad = val;
      else if (k === 6) v.sr = val;
    }
  }
  cutoffHz() {
    const fc = (this.regs[0x15] & 7) | (this.regs[0x16] << 3);
    if (this.model === '8580') return 30 + fc * 5.8;
    return 180 + 11800 * Math.pow(fc / 2047, 1.7);
  }
  // render count mono samples into out (Float32Array) starting at off
  render(out, off, count) {
    const v = this.v, cyc = this.cps;
    const res = this.regs[0x17] >> 4, route = this.regs[0x17] & 7, mode = this.regs[0x18] >> 4, vol = (this.regs[0x18] & 15) / 15;
    const fhz = Math.min(this.sampleRate * 0.45, this.cutoffHz());
    const f1 = Math.min(1.2, 2 * Math.sin(Math.PI * fhz / (this.sampleRate * 2)));
    const q = (this.model === '8580' ? 0.707 + res / 15 * 1.9 : 0.6 + res / 15 * 2.6);
    const damp = 1 / q;
    for (let i = 0; i < count; i++) {
      // oscillators
      for (let k = 0; k < 3; k++) {
        const V = v[k];
        if (V.ctrl & 8) { V.acc = 0; V.lfsr = 0x7FFFF8; V.msbRise = false; continue; }
        const old = V.acc;
        const nacc = old + V.freq * cyc;
        // noise LFSR is clocked on every rising edge of accumulator bit 19
        let n = Math.floor((nacc - 0x80000) / 0x100000) - Math.floor((old - 0x80000) / 0x100000);
        if (n > 0) {
          n = Math.min(n, 24);
          let l = V.lfsr;
          for (let s = 0; s < n; s++) { const b = ((l >> 22) ^ (l >> 17)) & 1; l = ((l << 1) | b) & 0x7FFFFF; }
          V.lfsr = l;
          V.noiseOut = (((l >> 20) & 1) << 11) | (((l >> 18) & 1) << 10) | (((l >> 14) & 1) << 9) | (((l >> 11) & 1) << 8) |
            (((l >> 9) & 1) << 7) | (((l >> 5) & 1) << 6) | (((l >> 2) & 1) << 5) | ((l & 1) << 4);
        }
        V.msbRise = Math.floor((nacc - 0x800000) / 0x1000000) > Math.floor((old - 0x800000) / 0x1000000);
        V.acc = nacc % 0x1000000;
      }
      // hard sync: voice k synced by voice k-1 (1<-3, 2<-1, 3<-2)
      for (let k = 0; k < 3; k++) {
        const V = v[k], M = v[(k + 2) % 3];
        if ((V.ctrl & 2) && M.msbRise) V.acc = 0;
      }
      let filt = 0, direct = 0;
      for (let k = 0; k < 3; k++) {
        const V = v[k];
        V.clockEnv(cyc);
        const M = v[(k + 2) % 3];
        const w = V.wave((M.acc >> 23) & 1);
        let s = w < 0 ? 0 : (w - 2048) / 2048;
        s *= V.env / 255;
        if (this.mute[k]) s = 0;
        if (route & (1 << k)) filt += s;
        else if (!(k === 2 && (this.regs[0x18] & 0x80))) direct += s;
      }
      // state-variable filter, 2x oversampled
      let lo = this.lp, bp = this.bp, hi = 0;
      for (let o = 0; o < 2; o++) {
        lo += f1 * bp; hi = filt - lo - damp * bp; bp += f1 * hi;
        if (bp > 4) bp = 4; else if (bp < -4) bp = -4;
      }
      this.lp = lo; this.bp = bp;
      let fo = 0;
      if (mode & 1) fo += lo; if (mode & 2) fo += bp; if (mode & 4) fo += hi;
      let s = (direct + fo) * vol * 0.33;
      // DC blocker + gentle output smoothing (SID output stage)
      this.dc += 0.0005 * (s - this.dc); s -= this.dc;
      this.post += 0.6 * (s - this.post);
      out[off + i] = this.post;
    }
  }
}

// ---------------------------------------------------------------- PSID loader / player
export function parsePSID(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const id = String.fromCharCode(b[0], b[1], b[2], b[3]);
  if (id !== 'PSID' && id !== 'RSID') throw new Error('Kein PSID');
  const w = o => (b[o] << 8) | b[o + 1];
  const dataOff = w(6); let load = w(8); const init = w(10), play = w(12), songs = w(14), start = w(16);
  let data = b.subarray(dataOff);
  if (load === 0) { load = data[0] | (data[1] << 8); data = data.subarray(2); }
  const s = (o) => { let r = ''; for (let i = 0; i < 32 && b[o + i]; i++) r += String.fromCharCode(b[o + i]); return r; };
  return { load, init, play, songs, start, data, name: s(0x16), author: s(0x36), released: s(0x56) };
}

export class SIDPlayer {
  constructor(sampleRate = 44100, model = '6581') {
    this.sid = new SID(sampleRate, model);
    this.sampleRate = sampleRate;
    this.spf = sampleRate / 50.1245;
    this.mem = new Uint8Array(65536);
    this.cpu = new CPU6502(this.mem, (r, v) => this.sid.write(r, v));
    this.frame = 0; this.acc = 0; this.tune = null;
  }
  load(psidBytes, song = 0) {
    this.tune = parsePSID(psidBytes);
    this.song = song;
    this.restart();
  }
  restart() {
    const t = this.tune; this.mem.fill(0); this.sid.reset();
    this.mem.set(t.data, t.load);
    this.cpu.call(t.init, this.song);
    this.frame = 0; this.acc = 0;
  }
  seek(frame) {
    this.restart();
    for (let i = 0; i < frame; i++) { this.cpu.call(this.tune.play); this.sid.v.forEach(v => v.clockEnv(19656)); }
    this.frame = frame;
  }
  // fill out (Float32Array) with mono samples
  generate(out) {
    let i = 0;
    while (i < out.length) {
      if (this.acc <= 0) { this.cpu.call(this.tune.play); this.frame++; this.acc += this.spf; }
      const n = Math.min(out.length - i, Math.ceil(this.acc));
      this.sid.render(out, i, n); i += n; this.acc -= n;
    }
  }
}
