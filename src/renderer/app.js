// mod2sid – renderer (UI)
// (c) IT-DUMMKOPFEN, GPL-3.0
import { loadMod, analyze, convert } from '../core/convert.js';
import { setModel, modelInfo } from '../core/classifier.js';
import { PRESETS, PRESET_BY_ID, CATEGORIES, CLASS_PRESETS, presetName } from '../core/library.js';
import { PAULA_PAL } from '../core/mod.js';
import { renderSong } from '../core/song.js';
import { FORMAT_NAMES } from '../core/formats/index.js';
import { fitADSR } from '../core/analyze.js';
import { auditionSID } from '../core/audition.js';
import { decomposeBeat, voiceWavetable } from '../core/beat.js';
import { realNote } from '../core/features.js';
import { T, CLASS_NAMES, HELP } from './i18n.js';

const $ = (s) => document.querySelector(s);
const api = window.m2s || {};
const LS = {
  get: (k, d) => { try { const v = localStorage.getItem('m2s.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('m2s.' + k, JSON.stringify(v)); } catch { /* ignore */ } },
};
const S = {
  lang: LS.get('lang', (navigator.language || 'de').startsWith('de') ? 'de' : 'en'),
  theme: LS.get('theme', 'dark'),
  ctx: null, analysis: null, result: null, file: null, seed: 1, variant: 1,
  assign: {}, manual: new Set(),
  mode: 'sid', playing: false, frame: 0, mute: new Array(24).fill(false), solo: -1,
  audio: null, node: null, gain: null, modBuf: null, modSrc: null, modStart: 0, modOffset: 0,
  loaded: 'none', rowStart: [], savedDir: LS.get('savedDir', ''),
};
const t = (k, ...a) => { const v = T[S.lang][k]; return typeof v === 'function' ? v(...a) : (v ?? k); };
const cname = (c) => CLASS_NAMES[S.lang][c] || c;
const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const setStatus = (m) => { $('#status').textContent = m || ''; };
const FPS = 50.1245;

// ------------------------------------------------------------------ i18n / theme
function applyLang() {
  document.documentElement.lang = S.lang;
  document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
  document.querySelectorAll('[data-tt]').forEach(el => { el.title = t(el.dataset.tt); });
  $('#btnLang').textContent = S.lang === 'de' ? 'EN' : 'DE';
  if (!S.ctx) $('#songInfo').textContent = t('notLoaded');
  renderKiInfo(); renderVoiceBtns(); renderLibrary();
  if (S.ctx) { renderSongInfo(); renderSamples(); renderArrangement(); renderStats(); }
}
function applyTheme() { document.body.classList.toggle('light', S.theme === 'light'); document.documentElement.classList.toggle('light', S.theme === 'light'); }

// ------------------------------------------------------------------ volume (0-100 %, saved; 80 % = previous fixed level)
S.volume = Math.max(0, Math.min(100, +LS.get('volume', 80) || 0)); S.volMuted = false;
function volGain() { return S.volMuted ? 0 : 1.4 * Math.pow(S.volume / 100, 2); }
function applyVolume() {
  if (S.gain) S.gain.gain.setTargetAtTime(volGain(), S.audio.currentTime, 0.02);
  const v = $('#volume'); if (v) v.value = S.volume;
  const t2 = $('#volVal'); if (t2) t2.textContent = S.volMuted ? '—' : `${S.volume} %`;
  const ic = $('#volIcon'); if (ic) ic.textContent = (S.volMuted || S.volume === 0) ? '🔇' : S.volume < 40 ? '🔈' : S.volume < 75 ? '🔉' : '🔊';
}

// ------------------------------------------------------------------ audio
async function ensureAudio() {
  if (S.audio) { if (S.audio.state === 'suspended') await S.audio.resume(); return; }
  S.audio = new AudioContext({ sampleRate: 44100, latencyHint: 'playback' });
  await S.audio.audioWorklet.addModule('sid-worklet.js');
  S.node = new AudioWorkletNode(S.audio, 'sid-player', { outputChannelCount: [2] });
  S.gain = S.audio.createGain(); applyVolume();
  S.node.connect(S.gain).connect(S.audio.destination);
  S.node.port.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'pos') { if (S.loaded === 'song') { S.frame = m.frame; updatePos(); } if (m.scope) drawScope(m.scope); }
    else if (m.type === 'ended') { document.querySelectorAll('.pbtn.on').forEach(b => { b.classList.remove('on'); b.textContent = '▶'; }); }
    else if (m.type === 'error') setStatus('SID: ' + m.message);
  };
}
function sidMsg(m) { if (S.node) S.node.port.postMessage(m); }
// SID count: 0 = automatic (enough SIDs for every channel of the module)
function sidCount() {
  const v = +$('#optSids').value;
  if (v) return v;
  const ch = S.ctx ? S.ctx.mod.channels || 4 : 4;
  return [1, 2, 4, 6, 8].find(n => n * 3 >= ch) || 8;
}
const nVoices = () => (S.result ? S.result.voices : sidCount() * 3);
function muteMask() { return Array.from({ length: 24 }, (_, v) => S.solo >= 0 ? v !== S.solo : S.mute[v]); }
async function loadSongIntoPlayer(autoplay, frame = 0) {
  await ensureAudio();
  sidMsg({ type: 'load', psid: S.result.sid, model: $('#optModel').value, mute: muteMask(), autoplay, frame });
  S.loaded = 'song';
}
function songSeconds() { return S.result ? S.result.seconds : 0; }
async function play() {
  if (!S.result) return;
  await ensureAudio();
  stopAudition();
  if (S.mode === 'sid') {
    if (S.loaded !== 'song') await loadSongIntoPlayer(true, S.frame); else sidMsg({ type: 'play' });
  } else {
    if (!S.modBuf) { setStatus('…'); await new Promise(r => setTimeout(r, 20)); buildModBuffer(); setStatus(''); }
    startMod(S.modOffset);
  }
  S.playing = true; $('#btnPlay').textContent = '❚❚';
}
function pause() {
  if (S.mode === 'sid') sidMsg({ type: 'pause' });
  else { S.modOffset = modPos(); stopModSrc(); }
  S.playing = false; $('#btnPlay').textContent = '▶';
}
function stopAll() {
  sidMsg({ type: 'stop' }); S.frame = 0; S.modOffset = 0; stopModSrc();
  S.playing = false; $('#btnPlay').textContent = '▶'; updatePos();
}
function buildModBuffer() {
  const r = renderSong(S.ctx.mod, S.ctx.replay, 22050);
  const b = S.audio.createBuffer(2, Math.max(1, r.left.length), 22050);
  b.copyToChannel(r.left, 0); b.copyToChannel(r.right, 1);
  S.modBuf = b;
}
function startMod(off) {
  stopModSrc();
  const src = S.audio.createBufferSource(); src.buffer = S.modBuf; src.connect(S.gain);
  src.start(0, Math.min(off, S.modBuf.duration - 0.01));
  src.onended = () => { if (S.modSrc === src && S.playing) { S.playing = false; $('#btnPlay').textContent = '▶'; } };
  S.modSrc = src; S.modStart = S.audio.currentTime - off;
  tickMod();
}
function stopModSrc() { if (S.modSrc) { try { S.modSrc.onended = null; S.modSrc.stop(); } catch { /* */ } S.modSrc = null; } }
function modPos() { return S.modSrc ? S.audio.currentTime - S.modStart : S.modOffset; }
function tickMod() { if (S.mode !== 'mod' || !S.modSrc) return; updatePos(); requestAnimationFrame(tickMod); }
function curSeconds() { return S.mode === 'sid' ? S.frame / FPS : modPos(); }
function updatePos() {
  const len = songSeconds(); const now = curSeconds();
  $('#tNow').textContent = fmtTime(len ? now % Math.max(1, len) : 0);
  $('#tLen').textContent = fmtTime(len);
  if (!S.seeking) $('#seek').value = len ? Math.round(((now % len) / len) * 1000) : 0;
  highlightSegment(now % Math.max(1, len));
}
async function seekTo(sec) {
  if (S.mode === 'sid') {
    S.frame = Math.round(sec * FPS);
    if (S.loaded !== 'song') await loadSongIntoPlayer(S.playing, S.frame); else sidMsg({ type: 'seek', frame: S.frame });
  } else { S.modOffset = sec; if (S.playing) startMod(sec); }
  updatePos();
}
function drawScope(d) {
  const c = $('#scope'), g = c.getContext('2d');
  const W = c.width = c.clientWidth * devicePixelRatio, H = c.height = 90 * devicePixelRatio;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent2'); g.lineWidth = 1.5 * devicePixelRatio;
  g.beginPath();
  for (let i = 0; i < d.length; i++) { const x = i / (d.length - 1) * W, y = H / 2 - Math.max(-0.5, Math.min(0.5, d[i] * 2.5)) * H * 0.9; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
}

// ------------------------------------------------------------------ audition
let auditionBtn = null;
function stopAudition() {
  if (auditionBtn) { auditionBtn.classList.remove('on'); auditionBtn.textContent = '▶'; auditionBtn = null; }
  if (S.smpSrc) { try { S.smpSrc.stop(); } catch { /* */ } S.smpSrc = null; }
  if (S.loaded === 'audition') { sidMsg({ type: 'pause' }); S.loaded = 'none'; }
}
async function auditionSample(a, btn) {
  await ensureAudio();
  const was = btn.classList.contains('on'); if (S.playing) pause(); stopAudition(); if (was) return;
  const s = S.ctx.mod.samples[a.index - 1];
  const per = (S.analysis.usage[a.index] || {}).medianPeriod || 214;
  const rate = Math.max(3000, Math.min(96000, PAULA_PAL / per));
  const len = s.looped ? Math.max(s.data.length, Math.round(rate * 2)) : s.data.length;
  const buf = S.audio.createBuffer(1, Math.max(1, len), rate);
  const ch = buf.getChannelData(0);
  const lend = s.looped ? s.loopStart + s.loopLength : s.data.length;
  for (let i = 0; i < len; i++) { let k = i; if (s.looped && k >= lend) k = s.loopStart + ((k - s.loopStart) % s.loopLength); ch[i] = s.data[k] / 128 * 0.8; }
  const src = S.audio.createBufferSource(); src.buffer = buf; src.connect(S.gain); src.start();
  src.onended = () => { if (auditionBtn === btn) stopAudition(); };
  S.smpSrc = src; auditionBtn = btn; btn.classList.add('on'); btn.textContent = '■';
}
async function auditionPreset(presetId, a, btn) {
  await ensureAudio();
  const was = btn.classList.contains('on'); if (S.playing) pause(); stopAudition(); if (was) return;
  const pr = PRESET_BY_ID[presetId];
  let note = 48, env = null, chord = null;
  if (a) {
    note = pr.drum ? 48 : Math.max(12, Math.min(84, Math.round((a.medianNote ?? 48) + (a.noteShift || 0))));
    if ($('#optFitEnv').checked) env = fitADSR(pr, a.info, S.ctx.mod.samples[a.index - 1], a.cls);
    if (a.chord && a.cls === 'chord' && !pr.drum && pr.cat !== 'drums') chord = a.chord;
  } else if (pr.cat === 'bass') note = 28; else if (pr.cat === 'drums') note = 48; else note = 52;
  let voice = null, beat = null, timeScale = 1;
  if (a && pr.auto === 'voice') voice = a.voice || voiceWavetable(S.ctx.mod.samples[a.index - 1], a.info);
  if (a && pr.auto === 'beat') {
    beat = a.beat || decomposeBeat(S.ctx.mod.samples[a.index - 1], a.info);
    const per = S.analysis.usage[a.index] ? S.analysis.usage[a.index].medianPeriod : 0;
    if (per) timeScale = a.info.rate / (3546895 / (2 * per));
  }
  if (voice && voice.ref && a) { const n = realNote({ ...a.info, f0norm: voice.ref }, S.analysis.usage[a.index].medianPeriod); if (n !== null) note = Math.max(12, Math.min(84, Math.round(n + (a.noteShift || 0)))); }
  const psid = auditionSID(pr, { note, env, chord, model: $('#optModel').value, voice, beat, timeScale });
  sidMsg({ type: 'load', psid, model: $('#optModel').value, mute: [false, false, false], autoplay: true, stopAfter: 4.5 });
  S.loaded = 'audition'; auditionBtn = btn; btn.classList.add('on'); btn.textContent = '■';
}

// ------------------------------------------------------------------ load / convert
async function openFile(f) {
  try {
    setStatus(t('analysing'));
    await new Promise(r => setTimeout(r, 10));
    const bytes = new Uint8Array(f.data);
    const ctx = loadMod(bytes);
    if (S.playing) pause();
    S.ctx = ctx; S.file = f; S.seed = 1; S.variant = 1; S.assign = {}; S.manual = new Set(); S.modBuf = null; S.frame = 0; S.modOffset = 0; S.loaded = 'none';
    S.analysis = analyze(ctx, { seed: 1, creativity: 0, memory: LS.get('memory', []), cleanGuitar: $('#optCleanGuitar').checked });
    runConvert();
    $('#drop').classList.add('hidden2');
    ['#btnReconvert', '#btnSave', '#btnPlay', '#btnStop', '#seek'].forEach(s => { $(s).disabled = false; });
    renderSongInfo(); renderSamples();
    setStatus(t('ready'));
  } catch (e) {
    console.error(e); setStatus(t('errLoad') + ': ' + e.message);
  }
}
function runConvert(keepPos = false) {
  setStatus(t('converting'));
  const assignments = {};
  for (const a of S.analysis.samples) if (a.used) assignments[a.index] = S.assign[a.index] || a.presetId;
  S.result = convert(S.ctx, S.analysis, {
    seed: S.seed, creativity: S.variant > 1 ? +$('#optCreativity').value / 100 : 0, assignments, lang: S.lang,
    fitEnvelope: $('#optFitEnv').checked, useFilter: $('#optFilter').checked, model: $('#optModel').value, sids: $('#optTwoVoices').checked ? 1 : sidCount(),
    slides: $('#optSlides').value, vibrato: $('#optVibrato').value, soundMatch: $('#optSoundMatch').checked, noDrums: $('#optNoDrums').checked, twoVoices: $('#optTwoVoices').checked,
    title: S.ctx.mod.title || (S.file && S.file.name.replace(/\.[^.]*$/, '')),
  });
  // row start times for the arrangement view
  let acc = 0; S.rowStart = S.ctx.replay.rows.map(r => { const s = acc; acc += r.ticks.length * 2.5 / r.bpm; return s; });
  renderArrangement(); renderStats(); renderVoiceBtns();
  if (S.loaded === 'song' || keepPos) loadSongIntoPlayer(S.playing && S.mode === 'sid', keepPos ? S.frame : 0);
  else S.loaded = 'none';
  updatePos(); setStatus(t('ready'));
}
function reconvert() {
  if (!S.ctx) return;
  S.seed += 1; S.variant += 1;
  const cr = +$('#optCreativity').value / 100;
  const prev = S.analysis;
  S.analysis = analyze(S.ctx, { seed: S.seed, creativity: cr, memory: LS.get('memory', []), cleanGuitar: $('#optCleanGuitar').checked });
  // keep manually chosen instruments
  for (const a of S.analysis.samples) if (S.manual.has(a.index)) { const p = prev.samples.find(x => x.index === a.index); if (p) a.presetId = S.assign[a.index]; }
  for (const k of Object.keys(S.assign)) if (!S.manual.has(+k)) delete S.assign[k];
  runConvert(true); renderSamples();
  setStatus(t('variant', S.variant));
}
// analyse again with the same variant (e.g. after "play distorted guitars clean" changed)
function reanalyze() {
  if (!S.ctx) return;
  const cr = S.variant > 1 ? +$('#optCreativity').value / 100 : 0;
  S.analysis = analyze(S.ctx, { seed: S.seed, creativity: cr, memory: LS.get('memory', []), cleanGuitar: $('#optCleanGuitar').checked });
  for (const a of S.analysis.samples) if (S.manual.has(a.index)) a.presetId = S.assign[a.index];
  for (const k of Object.keys(S.assign)) if (!S.manual.has(+k)) delete S.assign[k];
  runConvert(true); renderSamples();
}
function setInstrument(a, presetId) {
  S.assign[a.index] = presetId; S.manual.add(a.index);
  // learn: remember the user's choice for similar samples
  const pr = PRESET_BY_ID[presetId];
  const cls = Object.keys(CLASS_PRESETS).find(c => CLASS_PRESETS[c][0] === presetId) || Object.keys(CLASS_PRESETS).find(c => CLASS_PRESETS[c].includes(presetId)) || a.cls;
  const mem = LS.get('memory', []).filter(m => !(m.f && a.features && m.f.every((v, i) => Math.abs(v - a.features[i]) < 1e-6)));
  mem.push({ f: a.features, cls: pr.id === 'mute' ? a.cls : cls, preset: presetId });
  LS.set('memory', mem.slice(-400));
  runConvert(true); renderSamples();
}
async function save() {
  if (!S.result) return;
  const base = ((S.file && S.file.name) || S.ctx.mod.title || 'tune').replace(/^(mod|med|aon[48]?|dbm)\./i, '').replace(/\.[^.]{1,5}$/, '').replace(/[^\w\- .()]+/g, '_').trim() || 'tune';
  const dir = S.file && S.file.path ? S.file.path.replace(/[\\/][^\\/]*$/, '') : S.savedDir;
  const r = await api.saveOutput({ baseName: base, sid: S.result.sid, sng: S.result.sng, songExt: S.result.songExt || 'sng', defaultDir: dir });
  if (r) {
    setStatus(t('saved'));
    $('#warnings').innerHTML = `${t('savedTo')}<br>${esc(r.sid)}<br>${esc(r.sng)}<br><a href="#" id="revealLink">${t('reveal')}</a>`;
    $('#revealLink').onclick = (e) => { e.preventDefault(); api.reveal(r.sid); };
  }
}

// ------------------------------------------------------------------ rendering
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function renderSongInfo() {
  const m = S.ctx.mod, r = S.ctx.replay;
  const secs = r.rows.reduce((a, x) => a + x.ticks.length * 2.5 / x.bpm, 0);
  const used = S.analysis.samples.filter(s => s.used).length;
  $('#songInfo').innerHTML = [
    [t('title'), esc(m.title || (S.file ? S.file.name : '-'))], [t('format'), esc(FORMAT_NAMES[m.format] || m.format) + (m.tag ? ' ' + esc(m.tag) : '') + (m.numSamples === 15 ? ' (15)' : '')], [t('channels'), m.channels || 4],
    [t('length'), fmtTime(secs)], [t('positions'), m.orders.length], [t('tempo'), `${r.rows[0].speed} / ${r.rows[0].bpm} BPM`], [t('samples'), used],
  ].map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
}
function renderKiInfo() {
  const i = modelInfo();
  $('#kiInfo').innerHTML = i ? `<div><span>${t('kiAcc')}</span></div><div><span>${t('classAcc')}</span><span>${Math.round(i.loo_acc * 100)} %</span></div>` +
    `<div><span>${t('family')}</span><span>${Math.round(i.loo_family_acc * 100)} %</span></div>` +
    `<div><span>Training</span><span>${i.synthetic} + ${i.wav || 0} + ${i.real}</span></div>` : '';
}
function renderStats() {
  if (!S.result) return;
  const r = S.result;
  $('#outStats').textContent = t('stats', { sids: r.sids > 1 ? `${r.sids} SIDs ($D400${r.sids === 2 ? '+$D420' : '…$' + (0xD400 + (r.sids - 1) * 32).toString(16).toUpperCase()})` : '1 SID', patterns: r.song.patterns.length, instr: r.song.instr.length, size: r.sidInfo.size, end: r.sidInfo.end.toString(16).toUpperCase() });
  const w = [];
  if (r.truncated) w.push(t('trunc'));
  if (r.sids > 2) w.push(t('ggtNote', r.sids));
  if (r.twoVoices) w.push(t('twoVoicesNote'));
  if (r.overflow) w.push(t('ovf'));
  $('#warnings').textContent = w.join(' ');
}
function renderVoiceBtns() {
  const box = $('#voiceBtns'); box.innerHTML = '';
  const nv = nVoices();
  for (let v = 0; v < nv; v++) {
    const b = document.createElement('button'); b.className = 'vbtn';
    b.innerHTML = `<i style="background:var(--c${v % 6})"></i>${nv > 3 ? 'ABCDEFGH'[Math.floor(v / 3)] + ((v % 3) + 1) : t('voice') + ' ' + (v + 1)}`;
    b.title = `${t('mute')} (Klick) · ${t('solo')} (Doppelklick / double click)`;
    if (S.solo >= 0 ? S.solo !== v : S.mute[v]) b.classList.add('off');
    if (S.solo === v) b.classList.add('solo');
    b.onclick = () => { S.mute[v] = !S.mute[v]; S.solo = -1; sidMsg({ type: 'mute', mute: muteMask() }); renderVoiceBtns(); };
    b.ondblclick = () => { S.solo = S.solo === v ? -1 : v; sidMsg({ type: 'mute', mute: muteMask() }); renderVoiceBtns(); };
    box.appendChild(b);
  }
}
function presetOptions(selected, cls) {
  const rec = new Set(CLASS_PRESETS[cls] || []);
  let h = '';
  if (rec.size) {
    h += `<optgroup label="★ ${esc(cname(cls))}">` + [...rec].map(id => `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(presetName(PRESET_BY_ID[id], S.lang))}</option>`).join('') + '</optgroup>';
  }
  for (const [cat, de, en] of CATEGORIES) {
    const items = PRESETS.filter(p => p.cat === cat && !rec.has(p.id));
    if (!items.length) continue;
    h += `<optgroup label="${esc(S.lang === 'de' ? de : en)}">` + items.map(p => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${esc(presetName(p, S.lang))}</option>`).join('') + '</optgroup>';
  }
  return h;
}
function renderSamples() {
  const body = $('#smpBody'); body.innerHTML = '';
  for (const a of S.analysis.samples) {
    if (!a.used) continue;
    const tr = document.createElement('tr');
    const sel = S.assign[a.index] || a.presetId;
    const top = a.ranking.slice(0, 3);
    const p0 = Math.round(top[0].p * 100);
    const tags = `<span class="tag main ${a.cls === 'speech' ? 'speech' : ''}">${esc(cname(a.cls))}</span><span class="conf" title="${p0}%"><b style="width:${p0}%"></b></span> ` +
      top.filter(x => x.cls !== a.cls).slice(0, 2).map(x => `<span class="tag alt" data-cls="${x.cls}" title="${Math.round(x.p * 100)}%">${esc(cname(x.cls))}</span>`).join('') +
      (S.manual.has(a.index) ? `<span class="tag manual">${t('manual')}</span>` : a.learned ? `<span class="tag manual">${t('learned')}</span>` : '') +
      (a.chord ? `<span class="tag">${esc(a.chord.type)}</span>` : '') +
      (a.distGuitar ? `<span class="tag" title="${esc(t('distGuitarTip'))}">${t(a.cleanGuitar ? 'distGuitarClean' : 'distGuitar')}</span>` : '') +
      (a.beat ? `<span class="tag" title="${a.beat.hits.length} ${t('hitsWord')}">${a.beat.clusters.length} ${t('drumsWord')}</span>` : '');
    tr.innerHTML = `<td>${a.index}</td><td title="${esc(a.name)}">${esc(a.name || '—')}</td><td>${tags}</td>` +
      `<td><select>${presetOptions(sel, a.cls)}</select></td><td><button class="pbtn" data-a="orig">▶</button></td>` +
      `<td><button class="pbtn" data-a="sid">▶</button></td><td class="muted">${a.hits}</td>`;
    tr.querySelector('select').onchange = (e) => setInstrument(a, e.target.value);
    tr.querySelector('[data-a=orig]').onclick = (e) => auditionSample(a, e.currentTarget);
    tr.querySelector('[data-a=sid]').onclick = (e) => auditionPreset(tr.querySelector('select').value, a, e.currentTarget);
    tr.querySelectorAll('.tag.alt').forEach(el => { el.style.cursor = 'pointer'; el.onclick = () => setInstrument(a, (CLASS_PRESETS[el.dataset.cls] || ['lead_pulse'])[0]); });
    body.appendChild(tr);
  }
}
function renderArrangement() {
  const box = $('#arrView'); if (!S.result) { box.innerHTML = ''; return; }
  const segs = S.result.segments; const rows = S.ctx.replay.rows;
  const px = 3;
  const chCol = (c) => `hsl(${(c * 47) % 360} 65% 55%)`;
  let h = '';
  const nv = S.result.voices || 3;
  for (let v = 0; v < nv; v++) {
    const lab = nv > 3 ? `SID${Math.floor(v / 3) + 1}·${(v % 3) + 1}` : `SID ${v + 1}`;
    h += `<div class="arrRow"><div class="arrLabel"><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:var(--c${v % 6});margin-right:6px"></i>${lab}</div>`;
    segs.forEach((s, k) => {
      const grp = s.voices[v]; const w = Math.max(6, (s.end - s.start) * px);
      const inner = grp.length ? grp.map(c => `<div style="background:${chCol(c)}">K${c + 1}</div>`).join('') : (s.spare && s.spare[v - (S.ctx.mod.channels || 4)] ? `<div style="background:var(--c${v % 6})">${S.lang === 'de' ? 'Akkord/Drum' : 'chord/drum'}</div>` : '<div class="empty"></div>');
      h += `<div class="arrSeg" data-k="${k}" style="width:${w}px" title="Pos ${s.pos} · Pattern ${s.pat} · ${grp.map(c => 'K' + (c + 1)).join('+') || '-'}${grp.length > 1 ? ' (' + t('merged') + ')' : ''}">${inner}</div>`;
    });
    h += '</div>';
  }
  h += `<div class="arrRow" style="height:18px"><div class="arrLabel">${t('dropped')}</div>`;
  segs.forEach((s, k) => { const w = Math.max(6, (s.end - s.start) * px); h += `<div class="arrSeg" data-k="${k}" style="width:${w}px">${s.dropped.map(c => `<div style="background:${chCol(c)};opacity:.6">K${c + 1}</div>`).join('')}</div>`; });
  h += '</div>';
  h += `<div class="legend">${Array.from({ length: Math.min(32, S.ctx.mod.channels || 4) }, (_, c) => c).map(c => `<span><i style="background:${chCol(c)}"></i>K${c + 1}</span>`).join('')}</div>`;
  box.innerHTML = h;
  const head = box.parentElement.querySelector('h3'); if (head) head.textContent = t('arrangement').replace('3', String(nv));
  box.querySelectorAll('.arrSeg').forEach(el => { el.onclick = () => { const s = segs[+el.dataset.k]; seekTo(S.rowStart[s.start] || 0); }; });
}
let lastSeg = -1;
function highlightSegment(sec) {
  if (!S.result) return;
  const segs = S.result.segments;
  let k = segs.findIndex(s => (S.rowStart[s.end] ?? 1e9) > sec);
  if (k === lastSeg) return; lastSeg = k;
  document.querySelectorAll('.arrSeg.now').forEach(e => e.classList.remove('now'));
  document.querySelectorAll(`.arrSeg[data-k="${k}"]`).forEach(e => e.classList.add('now'));
}
function renderLibrary() {
  const box = $('#libView'); let h = '';
  for (const [cat, de, en] of CATEGORIES) {
    if (cat === 'mute') continue;
    const items = PRESETS.filter(p => p.cat === cat);
    h += `<div class="libCat"><h4>${esc(S.lang === 'de' ? de : en)}</h4>` + items.map(p => `<div class="libItem"><button class="pbtn" data-p="${p.id}">▶</button>${esc(presetName(p, S.lang))}</div>`).join('') + '</div>';
  }
  box.innerHTML = h;
  box.querySelectorAll('[data-p]').forEach(b => { b.onclick = () => auditionPreset(b.dataset.p, null, b); });
}
function modal(html) { $('#modalBody').innerHTML = html; $('#modal').classList.remove('hidden'); }
async function showInfo() {
  const i = api.appInfo ? await api.appInfo() : { version: '?' };
  const mi = modelInfo() || {};
  modal(`<img class="infoLogo" src="icon.png"><h2>mod2sid ${esc(i.version)}</h2>
  <p>${S.lang === 'de' ? 'Wandelt Tracker-Module (MOD, OctaMED, XM, IT, DigiBooster, Art Of Noise) in C64-SID-Musik (PSID) und GoatTracker- bzw. C64-GrooveGoat-Songs (SNG/GGT) um – mit 1 bis 8 SIDs.' : 'Converts tracker modules (MOD, OctaMED, XM, IT, DigiBooster, Art Of Noise) into C64 SID music (PSID) and GoatTracker or C64 GrooveGoat songs (SNG/GGT) – with 1 to 8 SIDs.'}</p>
  <p><b>Done by IT-DUMMKOPFEN</b><br><a href="#" data-url="https://github.com/IT-DUMMKOPFEN/mod2sid">github.com/IT-DUMMKOPFEN/mod2sid</a></p>
  <h3>${S.lang === 'de' ? 'Lizenz' : 'License'}</h3>
  <p>GNU General Public License v3.0 (GPL-3.0).</p>
  <h3>Credits</h3>
  <ul>
    <li>${S.lang === 'de' ? 'SNG-Format: GoatTracker 2 von Lasse Öörni (Cadaver), GPL' : 'SNG format: GoatTracker 2 by Lasse Öörni (Cadaver), GPL'}</li>
    <li>${S.lang === 'de' ? 'Eigener 6502-Player, 6502-Emulation und SID-Emulation (mod2sid)' : 'Own 6502 player, 6502 emulation and SID emulation (mod2sid)'}</li>
    <li>${S.lang === 'de' ? 'KI-Klassifizierer: Extra-Trees, trainiert mit' : 'AI classifier: extra-trees, trained on'} ${mi.synthetic || '?'} + ${mi.wav || 0} + ${mi.real || '?'} Samples</li>
    <li>Electron (MIT) · electron-builder (MIT)</li>
  </ul>
  <p class="small muted">Electron ${esc(i.electron || '')} · ${esc(i.platform || '')} ${esc(i.arch || '')}</p>`);
  document.querySelectorAll('[data-url]').forEach(a => { a.onclick = (e) => { e.preventDefault(); api.openUrl(a.dataset.url); }; });
}

// ------------------------------------------------------------------ wiring
async function init() {
  applyTheme();
  try { setModel(await (await fetch('../core/model.json')).json()); } catch (e) { console.warn('model', e); }
  const saved = LS.get('opts', {});
  if (saved.model) $('#optModel').value = saved.model;
  if (saved.creativity !== undefined) $('#optCreativity').value = saved.creativity;
  if (saved.fitEnv !== undefined) $('#optFitEnv').checked = saved.fitEnv;
  if (saved.filter !== undefined) $('#optFilter').checked = saved.filter;
  $('#optSlides').value = ['orig', 'soft', 'off'].includes(saved.slides) ? saved.slides : 'soft';
  $('#optVibrato').value = ['orig', 'soft', 'off'].includes(saved.vibrato) ? saved.vibrato : 'orig';
  if (saved.soundMatch !== undefined) $('#optSoundMatch').checked = saved.soundMatch;
  if (saved.noDrums !== undefined) $('#optNoDrums').checked = saved.noDrums;
  if (saved.cleanGuitar !== undefined) $('#optCleanGuitar').checked = saved.cleanGuitar;
  if (saved.twoVoices !== undefined) $('#optTwoVoices').checked = saved.twoVoices;
  const syncTwo = () => { const tv = $('#optTwoVoices').checked; $('#optSids').disabled = tv; $('#optNoDrums').disabled = tv; };
  syncTwo();
  applyLang();
  if (api.appInfo) api.appInfo().then(i => { $('#ver').textContent = 'v' + i.version; document.body.classList.add('os-' + i.platform); });
  if (api.onOpenPath) api.onOpenPath(async (p) => { const r = await api.readFile(p); if (r) openFile(r); });
  if (saved.sids !== undefined && [0, 1, 2, 4, 6, 8].includes(+saved.sids)) $('#optSids').value = saved.sids;
  const saveOpts = () => LS.set('opts', { sids: +$('#optSids').value, model: $('#optModel').value, creativity: +$('#optCreativity').value, fitEnv: $('#optFitEnv').checked, filter: $('#optFilter').checked,
    slides: $('#optSlides').value, vibrato: $('#optVibrato').value, soundMatch: $('#optSoundMatch').checked, noDrums: $('#optNoDrums').checked, twoVoices: $('#optTwoVoices').checked,
    cleanGuitar: $('#optCleanGuitar').checked });
  $('#btnOpen').onclick = async () => { const f = await api.openMod(); if (f) openFile(f); };
  $('#btnReconvert').onclick = reconvert;
  $('#btnSave').onclick = save;
  $('#btnLang').onclick = () => { S.lang = S.lang === 'de' ? 'en' : 'de'; LS.set('lang', S.lang); applyLang(); };
  $('#btnTheme').onclick = () => { S.theme = S.theme === 'light' ? 'dark' : 'light'; LS.set('theme', S.theme); applyTheme(); };
  $('#btnHelp').onclick = () => modal(HELP[S.lang]);
  $('#btnInfo').onclick = showInfo;
  $('#modalClose').onclick = () => $('#modal').classList.add('hidden');
  $('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').classList.add('hidden'); };
  $('#btnPlay').onclick = () => (S.playing ? pause() : play());
  $('#btnStop').onclick = stopAll;
  $('#volume').oninput = (e) => { S.volume = +e.target.value; S.volMuted = false; LS.set('volume', S.volume); applyVolume(); };
  $('#volIcon').onclick = () => { S.volMuted = !S.volMuted; applyVolume(); };
  applyVolume();
  $('#srcSid').onclick = () => switchSrc('sid');
  $('#srcMod').onclick = () => switchSrc('mod');
  $('#seek').oninput = () => { S.seeking = true; };
  $('#seek').onchange = () => { S.seeking = false; seekTo(+$('#seek').value / 1000 * songSeconds()); };
  $('#optModel').onchange = () => { saveOpts(); sidMsg({ type: 'model', model: $('#optModel').value }); if (S.ctx) runConvert(true); };
  $('#optCreativity').onchange = saveOpts;
  $('#optSids').onchange = () => { saveOpts(); S.solo = -1; if (S.ctx) runConvert(true); else renderVoiceBtns(); };
  $('#optFitEnv').onchange = () => { saveOpts(); if (S.ctx) runConvert(true); };
  $('#optFilter').onchange = () => { saveOpts(); if (S.ctx) runConvert(true); };
  $('#optCleanGuitar').onchange = () => { saveOpts(); S.solo = -1; reanalyze(); };
  for (const id of ['#optSlides', '#optVibrato', '#optSoundMatch', '#optNoDrums', '#optTwoVoices']) $(id).onchange = () => { syncTwo(); saveOpts(); S.solo = -1; if (S.ctx) runConvert(true); };
  document.querySelectorAll('.tab').forEach(b => { b.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.toggle('active', x === b));
    $('#pane-arr').classList.toggle('hidden', b.dataset.tab !== 'arr'); $('#pane-lib').classList.toggle('hidden', b.dataset.tab !== 'lib');
  }; });
  // drag & drop
  const main = document.body;
  main.addEventListener('dragover', (e) => { e.preventDefault(); $('#drop').classList.add('over'); });
  main.addEventListener('dragleave', () => $('#drop').classList.remove('over'));
  main.addEventListener('drop', async (e) => {
    e.preventDefault(); $('#drop').classList.remove('over');
    const f = e.dataTransfer.files[0]; if (!f) return;
    const p = api.pathForFile ? api.pathForFile(f) : null;
    if (p && api.readFile) { const r = await api.readFile(p); if (r) return openFile(r); }
    openFile({ name: f.name, path: null, data: new Uint8Array(await f.arrayBuffer()) });
  });
  if (api.onMenu) api.onMenu((a) => { if (a === 'open') $('#btnOpen').click(); if (a === 'save' && S.result) save(); });
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT' && S.result) { e.preventDefault(); $('#btnPlay').click(); } });
}
async function switchSrc(m) {
  if (m === S.mode) return;
  const sec = curSeconds(); const was = S.playing;
  if (S.playing) pause();
  S.mode = m;
  $('#srcSid').classList.toggle('active', m === 'sid'); $('#srcMod').classList.toggle('active', m === 'mod');
  if (m === 'sid') { S.frame = Math.round(sec * FPS); S.loaded = 'none'; } else S.modOffset = sec;
  if (was) play();
}
init();
