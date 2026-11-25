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
  [/steel ?(drum|pan)|tubular|bell|glock|vibes|vibra|marimb|xylo|celest|chime|kalimba|mbira|thumb piano|metallophone|tongue drum|mallet/i, 'bell'],
  [/\bfx\b|sfx|_fx|fx\d|siren|alarm|helicopter|birds|zap|laser|noise fx/i, 'fx'],
  [/timpani|\btimps?\b|\bsyn ?toms?\b/i, 'tom'],
  [/orchestra ?hit|stab|(?<!harpsi)chord|fifths/i, 'chord'],
  [/female|ensemblemale|\bmale\b|choir|\bvox\b/i, 'choir'],
  [/string|violin|viola|(?<!guitar )cello|arp omni/i, 'strings'],
  [/flute|clarinet|oboe|bassoon|piccolo|english horn|recorder|whistler|tin whistle|bansuri|\bdizi\b|quena|ocarina|hulusi|uilleann|woodwind|pan ?pipe/i, 'wood'],
  [/brass|horn|trumpet|trombone|tuba|sax/i, 'brass'],
  [/bass|sub(?![a-z])|sub\d|\bsub/i, 'bass'],
  [/(?<!thumb |toy )piano|pianet|organ|rhodes|wurli|harpsi|clav|harmonium|accordion|concertina|\bkeys\b|e ?piano/i, 'keys'],
  [/guitar|\bgtr|banjo|sitar|\bharp(?!si)|mandolin|koto|strat\b|zither|santur|tumbi|ukulele|\blute\b|shamisen|yuehchin|les paul|fender/i, 'guitar'],
  [/\bpads?\b|pad(?![a-z])|atmo|ambient/i, 'pad'],
  [/lead|saw|square|sine|pulse|pwm|triangle|_tri\b|\btri\b|sync/i, 'lead'],
];

const clean = s => s.replace(/\.wav$/i, '').replace(/[_-]?[A-G](#|b)?-?\d\b/g, ' ').replace(/^\d+[._\s]*/, '').replace(/_/g, ' ').trim();

// Cymatics-style packs: flat folders, the type is the first word of the file name
// ("Cymatics - BELL Genesis (C).wav", "Cymatics - INSTR Ukulele - C.wav", "… - 120 BPM A Min.wav")
const CY_TYPE = { BASS: 'bass', '808': 'bass', REESE: 'bass', DONK: 'bass', BELL: 'bell', KEYS: 'keys', PAD: 'pad', LEAD: 'lead', SYNTH: 'lead' };
function cymaticsLabel(parts, pack) {
  const file = parts[parts.length - 1].replace(/\.wav$/i, ''), dirs = parts.slice(0, -1).join('/');
  const m = file.match(/^cymatics[^-]*-\s*(.*)$/i); const rest = m ? m[1] : file;
  const typ = (rest.match(/(?:^|\s)(BASS|808|REESE|DONK|BELL|KEYS|PAD|LEAD|SYNTH|INSTR|PLUCK|VOX|FX)\b/) || [])[1];
  // song stems: "<title> - 120 BPM A Min Bass.wav"
  const stem = (file.match(/\b(?:min|maj|minor|major)\b\s+([a-z][\w ]*?)\s*\d*$/i) || [])[1];
  if (stem) {
    if (/vocal|vox|voice|acapella/i.test(stem)) return { cls: 'speech', pack };
    if (/drum|kick|snare|hat|perc|clap|top/i.test(stem)) return { cls: 'beat', pack };
    if (/bass|808/i.test(stem)) return { cls: 'bass', pack };
    if (/guitar/i.test(stem) && !/revers/i.test(stem)) return { cls: 'guitar', pack };
    if (/piano|keys|rhodes|organ/i.test(stem)) return { cls: 'keys', pack };
    if (/string|violin|cello/i.test(stem)) return { cls: 'strings', pack };
    if (/brass|trumpet|horn|sax/i.test(stem)) return { cls: 'brass', pack };
    if (/flute|woodwind/i.test(stem)) return { cls: 'wood', pack };
    if (/bell|glock|kalimba|marimba/i.test(stem)) return { cls: 'bell', pack };
    if (/chord/i.test(stem)) return { cls: 'chord', pack };
    return null;
  }
  const loop = /\bbpm\b|loop|\bfill\b|break|composition|melod/i.test(file + '/' + dirs);
  if (/vocal|vox/i.test(dirs + ' ' + (typ || ''))) return { cls: 'speech', pack };
  if (loop) {
    if (/drum|hihat|hi-hat|perc|top|break/i.test(dirs + ' ' + file) && !/melod|guitar/i.test(dirs)) return { cls: 'beat', pack };
    if (/guitar/i.test(dirs) && !/drum/i.test(dirs)) return { cls: 'guitar', pack };
    if (/piano/i.test(dirs)) return { cls: 'keys', pack };
    return null;
  }
  if (typ === 'PLUCK' || typ === 'FX') return typ === 'FX' ? { cls: 'fx', pack } : null;
  if (typ === 'INSTR' || /instruments\//i.test(dirs + '/')) {
    const t = typ === 'INSTR' ? rest.slice(rest.indexOf('INSTR') + 5) : dirs.split('/').slice(-2).join(' ') + ' ' + rest;
    for (const [re, cls] of MEL_RULES.slice(1)) if (re.test(t)) return { cls, pack };
    return null;
  }
  if (typ && CY_TYPE[typ]) return { cls: CY_TYPE[typ], pack };
  if (/foley|accent|texture|ambien|pedal|phrase|impact/i.test(dirs + ' ' + rest)) return null;
  if (/drum|kit|kick|snare|hat|perc|cymbal|ride|rim|clap|one shots\b/i.test(dirs) || /kick|snare|hat|clap|rim|perc|cymbal|ride|crash|shaker|\btom\b|snap/i.test(rest)) {
    const r = rest.replace(/\(.*?\)/g, '');
    if (/\bsnap\b/i.test(r)) return { cls: 'perc', pack };
    if (/kick|\bbd\b/i.test(r)) return { cls: 'kick', pack };
    for (const [re, cls] of DRUM_RULES.slice(2, 7)) if (re.test(r)) return { cls, pack };
    if (/\bopen\b|\bhat\b/i.test(r)) return { cls: 'hihat', pack };
    if (/bass/i.test(r)) return { cls: 'bass', pack };
    return null;
  }
  for (const [re, cls] of MEL_RULES.slice(1)) if (re.test(rest)) return { cls, pack };
  return null;
}

// returns { cls, pack, note } or null
export function folderLabel(path) {
  path = path.replace(/\\/g, '/');
  if (/cymatics|beta pack|gemini iii/i.test(path)) {
    const ps = path.split('/').filter(Boolean);
    return cymaticsLabel(ps, ps[0] || '');
  }
  const parts = path.split('/').filter(Boolean);
  const wi = parts.findIndex(p => /^wav$/i.test(p));
  const pack = (parts[0] === 'samples' ? parts[1] : parts[0]) || '';
  const inner = wi >= 0 ? parts.slice(wi + 1) : parts.slice(parts[0] === 'samples' ? 2 : 1);
  if (!inner.length) return null;
  const lower = inner.join('/');
  const drumPack = DRUM_PACKS.test(pack.replace(/^essential.*/i, ''));
  const essentialDrums = /^Drums$/i.test(inner[0]);
  const melodicDir = inner.slice(0, -1).some(p => /^(sounds|instrument sample notes|kraftwerk string)$/i.test(p));
  const drum = !melodicDir && (drumPack || essentialDrums || DRUM_CTX.test(inner.slice(0, -1).join('/')) || /drum|\bkit\b|percussion/i.test(pack)
    || inner.slice(0, -1).some(d => /^(kicks?|bass drums?|snares?( & claps?)?|hi[ -]?hats?|hats|cymbals?|crash|ride|claps?|(assorted )?percussion|tambourines?|toms?)$/i.test(clean(d).replace(/^\d+-/, ''))));
  const synthCtx = /^synths$/i.test(inner[0]) || /synths/i.test(lower);
  // drum loops → beat
  if (drum && !synthCtx && (/\bloops?\b|whole beats|full loops/i.test(lower) || /loops/i.test(pack)) && !/acid loops/i.test(lower)) return { cls: 'beat', pack };
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
