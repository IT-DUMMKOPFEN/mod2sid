// mod2sid – AudioWorklet: runs the 6502 playroutine + SID emulation in real time
import { SIDPlayer } from '../core/sid.js';

class SidProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.pl = null; this.playing = false; this.n = 0; this.mute = [false, false, false]; this.model = '6581';
    this.scope = new Float32Array(512); this.si = 0; this.stopAt = 0;
    this.port.onmessage = (e) => this.onMsg(e.data);
  }
  onMsg(m) {
    try {
      switch (m.type) {
        case 'load':
          this.model = m.model || this.model;
          this.pl = new SIDPlayer(sampleRate, this.model);
          this.pl.load(m.psid);
          this.pl.sid.mute = m.mute || this.mute;
          if (m.frame) this.pl.seek(m.frame);
          this.playing = !!m.autoplay; this.stopAt = m.stopAfter ? Math.round(m.stopAfter * 50) + (m.frame || 0) : 0;
          this.port.postMessage({ type: 'loaded', id: m.id });
          break;
        case 'play': this.playing = true; break;
        case 'pause': this.playing = false; break;
        case 'stop': this.playing = false; if (this.pl) this.pl.restart(); this.port.postMessage({ type: 'pos', frame: 0 }); break;
        case 'seek': if (this.pl) { this.pl.seek(m.frame); this.port.postMessage({ type: 'pos', frame: this.pl.frame }); } break;
        case 'mute': this.mute = m.mute; if (this.pl) this.pl.sid.mute = m.mute; break;
        case 'model': this.model = m.model; if (this.pl) this.pl.sid.setModel(m.model); break;
      }
    } catch (err) { this.port.postMessage({ type: 'error', message: String(err && err.message || err) }); }
  }
  process(_in, outputs) {
    const out = outputs[0], L = out[0];
    if (!this.pl || !this.playing) { L.fill(0); if (out[1]) out[1].fill(0); return true; }
    try { this.pl.generate(L); } catch (err) { this.playing = false; this.port.postMessage({ type: 'error', message: String(err.message || err) }); return true; }
    if (out[1]) out[1].set(L);
    for (let i = 0; i < L.length; i += 2) { this.scope[this.si] = L[i]; this.si = (this.si + 1) & 511; }
    if (++this.n % 12 === 0) this.port.postMessage({ type: 'pos', frame: this.pl.frame, scope: this.scope.slice() });
    if (this.stopAt && this.pl.frame >= this.stopAt) { this.playing = false; this.stopAt = 0; this.port.postMessage({ type: 'ended' }); }
    return true;
  }
}
registerProcessor('sid-player', SidProcessor);
