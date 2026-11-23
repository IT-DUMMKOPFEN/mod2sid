// mod2sid – self test: builds a small 4-channel MOD in memory, converts it and runs the SID
import fs from 'fs';
import { loadMod, analyze, convert } from '../../src/core/convert.js';
import { setModel } from '../../src/core/classifier.js';
import { SIDPlayer } from '../../src/core/sid.js';
import { parseSNG } from '../../src/core/gtsong.js';

setModel(JSON.parse(fs.readFileSync(new URL('../../src/core/model.json', import.meta.url))));
const RATE = 8287;
function sampleKick() { const n = 3000, d = new Int8Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / RATE; ph += (45 + 120 * Math.exp(-t / 0.03)) / RATE; d[i] = Math.round(120 * Math.sin(2 * Math.PI * ph) * Math.exp(-t / 0.15)); } return d; }
function sampleBass() { const n = 4000, d = new Int8Array(n); for (let i = 0; i < n; i++) { const t = i / RATE; d[i] = Math.round(100 * ((i * 82.4 / RATE) % 1 * 2 - 1) * Math.exp(-t / 0.4)); } return d; }
function sampleLead() { const n = 2000, d = new Int8Array(n); for (let i = 0; i < n; i++) d[i] = ((i * 261.6 / RATE) % 1) < 0.3 ? 90 : -90; return d; }
function sampleHat() { const n = 900, d = new Int8Array(n); let s = 1; for (let i = 0; i < n; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; d[i] = Math.round(((s >> 16) / 32768 - 0.5) * 200 * Math.exp(-i / 200)); } return d; }
const smps = [sampleKick(), sampleBass(), sampleLead(), sampleHat()];
const names = ['kick', 'bass', 'lead', 'hihat'];
const PER = { C2: 428, E2: 339, G2: 285, A2: 254, C3: 214, E3: 170, G3: 143 };
const npat = 1;
const buf = new Uint8Array(1084 + npat * 1024 + smps.reduce((a, s) => a + s.length, 0));
const txt = (o, s) => { for (let i = 0; i < s.length; i++) buf[o + i] = s.charCodeAt(i); };
txt(0, 'selftest');
smps.forEach((s, i) => { const o = 20 + i * 30; txt(o, names[i]); buf[o + 22] = (s.length / 2) >> 8; buf[o + 23] = (s.length / 2) & 255; buf[o + 25] = 64; buf[o + 29] = 1; if (i === 2) { buf[o + 28] = 0; buf[o + 29] = (s.length / 2) & 255; buf[o + 28] = (s.length / 2) >> 8; } });
buf[950] = 1; buf[951] = 0; buf[952] = 0; txt(1080, 'M.K.');
const put = (r, c, smp, per, e = 0, x = 0) => { const o = 1084 + r * 16 + c * 4; buf[o] = (smp & 0xF0) | (per >> 8); buf[o + 1] = per & 255; buf[o + 2] = ((smp & 15) << 4) | e; buf[o + 3] = x; };
const mel = ['C3', 'E3', 'G3', 'E3', 'A2', 'C3', 'E3', 'G3'];
for (let r = 0; r < 64; r++) {
  if (r % 8 === 0) put(r, 0, 1, PER.C2);
  if (r % 4 === 2) put(r, 1, 2, r % 16 < 8 ? PER.C2 : PER.A2);
  if (r % 8 === 4) put(r, 2, 3, PER[mel[(r / 8) | 0]], 4, 0x46);
  if (r % 2 === 1) put(r, 3, 4, PER.C3);
}
let o = 1084 + 1024; for (const s of smps) { buf.set(new Uint8Array(s.buffer), o); o += s.length; }
const ctx = loadMod(buf);
const an = analyze(ctx);
const res = convert(ctx, an, { title: 'selftest' });
parseSNG(res.sng);
const pl = new SIDPlayer(44100); pl.load(res.sid);
const out = new Float32Array(44100 * 4); pl.generate(out);
let rms = 0; for (const v of out) rms += v * v; rms = Math.sqrt(rms / out.length);
console.log('classes:', an.samples.filter(s => s.used).map(s => `${s.name}→${s.cls}/${s.presetId}`).join(', '));
console.log(`SID ${res.sidInfo.size} bytes, SNG ${res.sng.length} bytes, rms ${rms.toFixed(3)}`);
if (!(rms > 0.01)) { console.error('FAIL: silent output'); process.exit(1); }
console.log('selftest OK');
