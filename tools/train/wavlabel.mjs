// Name-based labels for loose sample libraries (WAV). Only clear names are used.
// Order matters: more specific patterns first.
const RULES = [
  [/(drum|dr)[ ._-]?(beat|loop)|beat[ ._-]?\d|\bbeat\b|\bloop\b|break[ ._-]?beat|\bbreak\d*\b|groove|amen\b|funky[ ._-]?drum|jungle[ ._-]?loop|rh?yth?m(?!.*(brass|bass|guit|gtr|key|organ|str|piano|chord))|drumloop|\bdrums\b/i, 'beat'],
  [/voice|vocal|\bvox\b|speak|speech|\bsay\b|yeah|\bye+a?h\b|\bhey\b|\bsing(?!le)|scream|laugh|shout|\btalk|\bwoo+\b|come[ ._-]?on|get[ ._-]?up|\bgo+\b|\bhuh\b/i, 'speech'],
  [/choir|chor(?!d)|\booh\b|\baah\b/i, 'choir'],
  [/(bass|b)[ ._-]?drum|bdrum|\bbd\d*\b|\bkick|kik\b|\bbass[ ._-]?d\b|bassd\b|bd[ ._-]/i, 'kick'],
  [/snare|\bsnr|\bsd\d*\b|sdrum|snaredrum|\bsn\d*\b/i, 'snare'],
  [/hi[ ._-]?hat|hihat|\bhh\d*\b|\bhat\b|ohat|chat\b|hhat|o\.?hat|c\.?hat/i, 'hihat'],
  [/crash|cymbal|\bcym|\bride\b|splash|china/i, 'cymbal'],
  [/\btom|tomtom|tomdrum|\btoms\b/i, 'tom'],
  [/clap|cowbell|bongo|conga|shaker|tambo|\brim\b|rimshot|clave|block|cabasa|agogo|timbal|triangle|guiro|cong\b|\bbng\b|perc/i, 'perc'],
  [/string|\bstr\d*\b|strg|violin|viola|cello|orchestr|distrings/i, 'strings'],
  [/chord|\bmaj\d*\b|\bmin\d*\b|minor|major|\bdim\b|\bsus\d?\b|stab/i, 'chord'],
  [/bass|\bbas\b|\bbs\d*\b/i, 'bass'],
  [/piano|pian|organ|orgel|rhodes|harpsi|clavi|cembal|\bkeys?\b|e\.?piano|epno/i, 'keys'],
  [/brass|horn|trump|trombone|tuba|sax/i, 'brass'],
  [/flute|flöte|clarin|oboe|bassoon|piccolo|recorder|pan[ ._-]?pipe|panflute|whistle/i, 'wood'],
  [/guit|gtr|gitar|banjo|sitar|harp\b|pluck|mandolin|koto/i, 'guitar'],
  [/bell|glock|vibra|marimb|xylo|celest|chime|kalimba|steel/i, 'bell'],
  [/\bpad\b|atmo|sphere|\bwarm\b|ambient/i, 'pad'],
  [/lead|solo|\bsaw\b|sawsynth|squarewave|square\b|\bsine\b|\bsyn\d*\b/i, 'lead'],
  [/\bfx\b|sfx|zap|laser|explo|boom|wind|noise|sweep|riser|siren|alarm|scratch|shot|crash[ ._-]?fx|whoosh|blip|beep|zoom/i, 'fx'],
];
export function wavLabel(name) {
  const n = name.replace(/\.wav$/i, '').replace(/\.ss$/i, '').replace(/^[\d\s()._-]+/, ' ');
  for (const [re, c] of RULES) if (re.test(n)) return c;
  return null;
}
