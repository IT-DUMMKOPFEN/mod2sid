// Labels for professionally sorted sample libraries (folder structure + file name).
// Path components are checked from the deepest (file name) upwards; the first clear
// instrument word wins. Drum words count only inside drum folders, and a "Bass"
// category folder in a melodic pack always means bass.
const DRUM_PACKS = /^(505|606|626|707|727|808|909|cr78|dmx|drumtrax|drumulator|jupiter drums|lindrum|linn60|lm1|dx from|dr bohm|101 drums|ekko|mpc|sp ?1200|sds|synare|tom from)/i;
const DRUM_CTX = /individual hits|\bkits?\b|one hits|one shots|\bhits\b|\bdrums?\b|loops|percussion/i;

const DRUM_RULES = [
  [/kick[ ._-]?tom|tom[ ._-]?combo|combo|rolling|charleston|envelope|\bnoise\b|\brev\b|modulation|\bother\b|whole beats|various tops/i, null],
  [/bass[ ._-]?drum|\bbd\b|\bkick|\bkik\b|^bass\b|\d+\. bass$|\bbass[ _]|^bass_|kick and sub|hi kick/i, 'kick'],
  [/snare|\bsd\b|\bsnr\b/i, 'snare'],
  [/hi[ ._-]?hat|\bhh\b|\bch\b|\boh\b|\bhats?\b/i, 'hihat'],
  [/cymbal|\bcym\b|crash|\bride\b|china|\bcup\b|splash/i, 'cymbal'],
  [/\btoms?\b|timpani/i, 'tom'],
  [/clap|\brim|cowbell|conga|bongo|timbal|agogo|shaker|cabasa|tambo|clave|maraca|quijada|block|triangle|whistle|\bperc|synth drum|cuica|guiro|chime/i, 'perc'],
  [/\bfx\b/i, 'fx'],
];
const MEL_RULES = [
  [/stack|textures?|morphbot|\bmisc\b|voices?$|\bhello\b|return home|vocal|\bloops?\b/i, null],
  [/steel ?drum|tubular|bell|glock|vibes|vibra|marimb|xylo|celest|chime|kalimba|mallet/i, 'bell'],
  [/\bfx\b|sfx|_fx|fx\d|siren|alarm|helicopter|birds|zap|laser|noise fx/i, 'fx'],
  [/timpani|\btimps?\b|\bsyn ?toms?\b/i, 'tom'],
  [/orchestra ?hit|stab|(?<!harpsi)chord|fifths/i, 'chord'],
  [/female|ensemblemale|\bmale\b|choir|\bvox\b/i, 'choir'],
  [/string|violin|viola|cello|arp omni/i, 'strings'],
  [/flute|clarinet|oboe|bassoon|piccolo|english horn|recorder|whistler/i, 'wood'],
  [/brass|horn|trumpet|trombone|tuba|sax/i, 'brass'],
  [/bass|sub(?![a-z])|sub\d|\bsub/i, 'bass'],
  [/piano|pianet|organ|rhodes|wurli|harpsi|clav|harmonium|accordion|\bkeys\b|e ?piano/i, 'keys'],
  [/guitar|\bgtr|banjo|sitar|\bharp(?!si)|mandolin|koto|strat\b/i, 'guitar'],
  [/\bpads?\b|pad(?![a-z])|atmo|ambient/i, 'pad'],
  [/lead|saw|square|sine|pulse|pwm|triangle|_tri\b|\btri\b|sync/i, 'lead'],
];

const clean = s => s.replace(/\.wav$/i, '').replace(/[_-]?[A-G](#|b)?-?\d\b/g, ' ').replace(/^\d+[._\s]*/, '').replace(/_/g, ' ').trim();

// returns { cls, pack, note } or null
export function folderLabel(path) {
  const parts = path.split('/').filter(Boolean);
  const wi = parts.findIndex(p => /^wav$/i.test(p));
  const pack = (parts[0] === 'samples' ? parts[1] : parts[0]) || '';
  const inner = wi >= 0 ? parts.slice(wi + 1) : parts.slice(parts[0] === 'samples' ? 2 : 1);
  if (!inner.length) return null;
  const lower = inner.join('/');
  const drumPack = DRUM_PACKS.test(pack.replace(/^essential.*/i, ''));
  const essentialDrums = /^Drums$/i.test(inner[0]);
  const drum = drumPack || essentialDrums || DRUM_CTX.test(inner.slice(0, -1).join('/'));
  const synthCtx = /^synths$/i.test(inner[0]) || /synths/i.test(lower);
  // drum loops → beat
  if (drum && !synthCtx && /\bloops?\b|whole beats|full loops/i.test(lower) && !/acid loops/i.test(lower)) return { cls: 'beat', pack };
  const note = (inner[inner.length - 1].match(/[_ -]([A-G](#|b)?)(-?\d)\b/) || [])[3];
  const comps = inner.map(clean).reverse();      // file name first
  if (drum && !synthCtx) {
    // folder names first (file names often carry the pack name, e.g. "TOM From Mars")
    for (const c of [...comps.slice(1), comps[0]]) for (const [re, cls] of DRUM_RULES) if (re.test(c)) { if (!cls) return null; return { cls, pack }; }
    return null;
  }
  if (comps.some(c => MEL_RULES[0][0].test(c))) return null;
  if (inner.some(p => /^\d*\.?\s*bass$/i.test(p.trim()))) return { cls: 'bass', pack, note };
  if (inner.slice(0, -1).some(p => /^\d*\.?\s*fx$/i.test(p.trim()))) return { cls: 'fx', pack, note };
  for (const c of comps) for (const [re, cls] of MEL_RULES) if (re.test(c)) { if (!cls) return null; return { cls, pack, note }; }
  // category folders as fallback
  for (const c of comps) {
    if (/^leads?$/i.test(c)) return { cls: 'lead', pack, note };
    if (/^keys$|^organs?$/i.test(c)) return { cls: 'keys', pack, note };
    if (/^pads$/i.test(c)) return { cls: 'pad', pack, note };
    if (/^guitars$/i.test(c)) return { cls: 'guitar', pack, note };
  }
  return null;
}
