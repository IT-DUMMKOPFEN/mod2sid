// mod2sid – conversion pipeline (MOD -> analysis -> arrangement -> SNG + SID)
// (c) IT-DUMMKOPFEN, GPL-3.0
import { replaySong } from './song.js';
import { loadSong } from './formats/index.js';
import { analyzeMod } from './analyze.js';
import { convertSong } from './arrange.js';
import { buildSID } from './sidbuild.js';
import { parseSNG } from './gtsong.js';

export function loadMod(bytes) {
  const mod = loadSong(bytes);
  const replay = replaySong(mod);
  if (!replay.rows.length) throw new Error('MOD enthält keine abspielbaren Patterns / no playable patterns');
  return { mod, replay };
}

export function analyze(ctx, opts = {}) {
  return analyzeMod(ctx.mod, ctx.replay, opts);
}

export function convert(ctx, analysis, opts = {}) {
  const year = new Date().getFullYear();
  let res, sid, limit = 0;
  for (let attempt = 0; attempt < 12; attempt++) {
    res = convertSong(ctx.mod, ctx.replay, analysis, limit ? { ...opts, limitRows: limit } : opts);
    try {
      sid = buildSID(res.song, {
        initTempo: res.initTempo, gate: res.gate, model: opts.model || '6581', load: opts.load || 0x1000,
        name: opts.title || ctx.mod.title || 'mod2sid', author: opts.author || res.song.author, released: opts.released || `${year} mod2sid`,
      });
      break;
    } catch (e) {
      // the C64 memory ($1000-$CFFF) is full: shorten the song step by step
      if (!/too large/.test(e.message)) throw e;
      limit = Math.floor((limit || res.rowsTotal) * 0.85);
      if (attempt === 11) throw e;
    }
  }
  if (limit) res.truncated = true;
  // 1 SID: GoatTracker 2 .sng, 2 SIDs: GoatTracker Stereo .sng, 4/6/8 SIDs: C64 GrooveGoat .ggt
  const ggt = res.sids > 2;
  const sng = ggt ? res.song.toGGT(res.sids, { model: opts.model }) : res.song.toSNG();
  parseSNG(sng, res.voices); // self-check, throws on a malformed file
  return { ...res, sid: sid.psid, sidInfo: { size: sid.size, end: sid.end }, sng, songExt: ggt ? 'ggt' : 'sng' };
}
