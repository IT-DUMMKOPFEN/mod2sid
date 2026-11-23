// mod2sid – conversion pipeline (MOD -> analysis -> arrangement -> SNG + SID)
// (c) IT-DUMMKOPFEN, GPL-3.0
import { parseMod, replayMod } from './mod.js';
import { analyzeMod } from './analyze.js';
import { convertSong } from './arrange.js';
import { buildSID } from './sidbuild.js';
import { parseSNG } from './gtsong.js';

export function loadMod(bytes) {
  const mod = parseMod(bytes);
  const replay = replayMod(mod);
  if (!replay.rows.length) throw new Error('MOD enthält keine abspielbaren Patterns / no playable patterns');
  return { mod, replay };
}

export function analyze(ctx, opts = {}) {
  return analyzeMod(ctx.mod, ctx.replay, opts);
}

export function convert(ctx, analysis, opts = {}) {
  const res = convertSong(ctx.mod, ctx.replay, analysis, opts);
  const year = new Date().getFullYear();
  const sid = buildSID(res.song, {
    initTempo: res.initTempo, gate: res.gate, model: opts.model || '6581', load: opts.load || 0x1000,
    name: opts.title || ctx.mod.title || 'mod2sid', author: opts.author || res.song.author, released: opts.released || `${year} mod2sid`,
  });
  const sng = res.song.toSNG();
  parseSNG(sng); // self-check, throws on a malformed file
  return { ...res, sid: sid.psid, sidInfo: { size: sid.size, end: sid.end }, sng };
}
