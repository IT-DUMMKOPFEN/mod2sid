// mod2sid – instrument library, extension set (v1.1)
// (c) IT-DUMMKOPFEN, GPL-3.0
const PW = (w) => [0x80 | ((w >> 8) & 15), w & 0xFF];
const sweep = (start, t, sp) => [PW(start), [t, sp], [t, -sp], ['J', 1]];
const still = (w) => [PW(w), ['S']];
const A = (n) => ({ a: n });
const p = (o) => Object.assign({ gate: 2, fw: 0x09, pulse: null, filter: null, vib: null, drum: false, prefix: 0 }, o);

export const EXTRA_CATEGORIES = [['auto', 'KI-Automatik', 'AI automatic'], ['world', 'Welt / Ethno', 'World / ethnic'], ['chip', 'Chiptune', 'Chiptune']];

export const EXTRA_PRESETS = [
  // ---- built per sample by the KI (the wave shown here is only the library demo)
  p({ id: 'beat_auto', cat: 'auto', auto: 'beat', de: 'Beat zerlegen (KI)', en: 'Split beat (AI)', ad: 0x08, sr: 0x00, drum: true, prefix: 3,
    wave: [[0x81, A(80)], [0x41, A(40)], [0x41, A(36)], [0x41, A(30)], ['S']], pulse: still(0x800), desc: { bright: .5, slow: 0, sus: 0 } }),
  p({ id: 'voice_auto', cat: 'auto', auto: 'voice', de: 'Stimme mit Tonverlauf (KI)', en: 'Voice with pitch contour (AI)', ad: 0x10, sr: 0xF4,
    wave: [[0x41, -5], [2, 'k'], [0x41, -3], [2, 'k'], [0x41, 0], [4, 'k'], [0x41, 2], [3, 'k'], [0x41, 4], [8, 'k'], [0x40, 'k'], ['S']],
    pulse: sweep(0x300, 0x20, 0x18), desc: { bright: .5, slow: .1, sus: .8 } }),
  // ---- bass
  p({ id: 'bass_wobble', cat: 'bass', de: 'Wobble-Bass', en: 'Wobble bass', ad: 0x08, sr: 0xA9, wave: [[0x41, 0], ['S']], pulse: sweep(0x100, 0x06, 0x90), desc: { bright: .6, slow: 0, sus: .7 } }),
  p({ id: 'bass_reese', cat: 'bass', de: 'Reese-Bass', en: 'Reese bass', ad: 0x08, sr: 0xB9, wave: [[0x21, 0], [0x41, 0], ['J', 0]], pulse: still(0x700), vib: [2, 0x06, 1], desc: { bright: .7, slow: 0, sus: .8 } }),
  p({ id: 'bass_pluck', cat: 'bass', de: 'Pluck-Bass', en: 'Pluck bass', ad: 0x07, sr: 0x00, wave: [[0x21, 12], [0x41, 0], ['S']], pulse: [PW(0x200), [0x10, 0x40], ['S']], desc: { bright: .65, slow: 0, sus: 0 } }),
  p({ id: 'bass_808', cat: 'bass', de: '808-Bass', en: '808 bass', ad: 0x0C, sr: 0x00, wave: [[0x11, 2], [0x11, 1], [0x11, 0], ['S']], desc: { bright: 0, slow: 0, sus: .1 } }),
  p({ id: 'bass_galway', cat: 'bass', de: 'Galway-Bass (Ring)', en: 'Galway bass (ring)', ad: 0x09, sr: 0x89, wave: [[0x15, 0], [0x41, 0], ['S']], pulse: sweep(0x300, 0x18, 0x40), desc: { bright: .6, slow: 0, sus: .55 } }),
  p({ id: 'bass_fretless', cat: 'bass', de: 'Fretless-Bass', en: 'Fretless bass', ad: 0x3A, sr: 0x99, wave: [[0x11, 0], [0x31, 0], ['S']], vib: [4, 0x0C, 10], desc: { bright: .15, slow: .2, sus: .6 } }),
  // ---- lead
  p({ id: 'lead_sync', cat: 'lead', de: 'Sync-Lead', en: 'Sync lead', ad: 0x08, sr: 0xC9, wave: [[0x23, 0], ['S']], vib: [3, 0x20, 12], desc: { bright: .95, slow: .05, sus: .8 } }),
  p({ id: 'lead_ring', cat: 'lead', de: 'Ring-Lead', en: 'Ring lead', ad: 0x08, sr: 0xB9, wave: [[0x15, 0], ['S']], vib: [3, 0x18, 12], desc: { bright: .7, slow: .05, sus: .75 } }),
  p({ id: 'lead_whistle', cat: 'lead', de: 'Pfeifen', en: 'Whistle', ad: 0x5A, sr: 0xB8, wave: [[0x11, 12], ['S']], vib: [3, 0x20, 8], desc: { bright: 0, slow: .35, sus: .8 } }),
  p({ id: 'lead_hubbard', cat: 'lead', de: 'Hubbard-Lead', en: 'Hubbard lead', ad: 0x09, sr: 0xA9, wave: [[0x41, 12], [0x41, 0], ['S']], pulse: sweep(0x180, 0x28, 0x24), vib: [2, 0x30, 8], desc: { bright: .65, slow: 0, sus: .7 } }),
  p({ id: 'lead_portal', cat: 'lead', de: 'Vibrato-Lead (breit)', en: 'Wide vibrato lead', ad: 0x08, sr: 0xC9, wave: [[0x41, 0], ['S']], pulse: sweep(0x500, 0x20, 0x10), vib: [4, 0x40, 4], desc: { bright: .5, slow: .05, sus: .8 } }),
  p({ id: 'lead_mono', cat: 'lead', de: 'Mono-Synth (Filter)', en: 'Mono synth (filter)', ad: 0x29, sr: 0xA9, wave: [[0x21, 0], ['S']], filter: [['T', 'lp', 8], ['C', 0x50], ['M', 0x20, 2], ['S']], desc: { bright: .7, slow: .15, sus: .7 } }),
  p({ id: 'lead_solo', cat: 'lead', de: 'Solo-Lead (Saw+Puls)', en: 'Solo lead (saw+pulse)', ad: 0x08, sr: 0xC9, wave: [[0x61, 0], ['S']], pulse: still(0x600), vib: [3, 0x28, 14], desc: { bright: .75, slow: .1, sus: .85 } }),
  // ---- strings
  p({ id: 'str_violin', cat: 'strings', de: 'Violine', en: 'Violin', ad: 0x4A, sr: 0xB9, wave: [[0x21, 0], ['S']], vib: [3, 0x24, 8], desc: { bright: .8, slow: .3, sus: .85 } }),
  p({ id: 'str_cello', cat: 'strings', de: 'Cello', en: 'Cello', ad: 0x5A, sr: 0xA9, wave: [[0x41, 0], ['S']], pulse: sweep(0x500, 0x40, 0x08), vib: [4, 0x14, 10], desc: { bright: .5, slow: .35, sus: .85 } }),
  p({ id: 'str_tremolo', cat: 'strings', de: 'Tremolo-Streicher', en: 'Tremolo strings', ad: 0x2A, sr: 0xA9, wave: [[0x21, 0], [0x20, 'k'], ['J', 0]], desc: { bright: .7, slow: .2, sus: .8 } }),
  p({ id: 'str_orchestra', cat: 'strings', de: 'Orchester-Hit', en: 'Orchestra hit', ad: 0x08, sr: 0x00, wave: [[0x81, A(80)], [0x21, 0], [0x21, 12], [0x21, 7], ['J', 1]], desc: { bright: .9, slow: 0, sus: .1 } }),
  // ---- brass
  p({ id: 'brass_tuba', cat: 'brass', de: 'Tuba', en: 'Tuba', ad: 0x5A, sr: 0xA9, wave: [[0x41, 0], ['S']], pulse: still(0x700), vib: [4, 0x10, 16], desc: { bright: .3, slow: .35, sus: .8 } }),
  p({ id: 'brass_trombone', cat: 'brass', de: 'Posaune', en: 'Trombone', ad: 0x4A, sr: 0xA9, wave: [[0x21, 0], ['S']], vib: [4, 0x18, 14], desc: { bright: .7, slow: .35, sus: .8 } }),
  p({ id: 'brass_stab', cat: 'brass', de: 'Brass-Stab', en: 'Brass stab', ad: 0x08, sr: 0x40, wave: [[0x41, 0], ['S']], pulse: [PW(0x080), [0x08, 0x40], ['S']], desc: { bright: .85, slow: 0, sus: .3 } }),
  // ---- woodwinds
  p({ id: 'piccolo', cat: 'wood', de: 'Piccoloflöte', en: 'Piccolo', ad: 0x3A, sr: 0xA8, wave: [[0x11, 12], ['S']], vib: [3, 0x28, 10], desc: { bright: .1, slow: .3, sus: .7 } }),
  p({ id: 'bassoon', cat: 'wood', de: 'Fagott', en: 'Bassoon', ad: 0x4A, sr: 0xA8, wave: [[0x41, 0], ['S']], pulse: still(0x180), vib: [4, 0x10, 14], desc: { bright: .55, slow: .3, sus: .75 } }),
  p({ id: 'recorder', cat: 'wood', de: 'Blockflöte', en: 'Recorder', ad: 0x2A, sr: 0xA8, wave: [[0x51, 0], ['S']], pulse: still(0x800), vib: [4, 0x10, 16], desc: { bright: .05, slow: .2, sus: .75 } }),
  p({ id: 'harmonica', cat: 'wood', de: 'Mundharmonika', en: 'Harmonica', ad: 0x3A, sr: 0xB9, wave: [[0x41, 0], ['S']], pulse: sweep(0x300, 0x08, 0x30), vib: [3, 0x18, 8], desc: { bright: .6, slow: .25, sus: .8 } }),
  // ---- guitar
  p({ id: 'gtr_lead', cat: 'guitar', de: 'Lead-Gitarre', en: 'Lead guitar', ad: 0x08, sr: 0xC9, wave: [[0x41, 0], ['S']], pulse: [PW(0x200), [0x06, 0x80], [0x06, -0x80], ['J', 1]], vib: [2, 0x30, 12], desc: { bright: .9, slow: 0, sus: .9 } }),
  p({ id: 'gtr_funk', cat: 'guitar', de: 'Funk-Gitarre', en: 'Funk guitar', ad: 0x05, sr: 0x00, wave: [[0x81, A(78)], [0x41, 0], ['S']], pulse: still(0x180), desc: { bright: .7, slow: 0, sus: 0 } }),
  p({ id: 'gtr_nylon', cat: 'guitar', de: 'Nylon-Gitarre', en: 'Nylon guitar', ad: 0x0A, sr: 0x00, wave: [[0x41, 0], [0x11, 0], ['S']], pulse: still(0x400), desc: { bright: .3, slow: 0, sus: 0 } }),
  p({ id: 'gtr_harmonics', cat: 'guitar', de: 'Flageolett', en: 'Harmonics', ad: 0x0B, sr: 0x00, wave: [[0x11, 12], [0x11, 24], ['J', 0]], desc: { bright: .2, slow: 0, sus: .1 } }),
  // ---- keys
  p({ id: 'piano_bright', cat: 'keys', de: 'Helles Klavier', en: 'Bright piano', ad: 0x0A, sr: 0x00, wave: [[0x21, 0], [0x21, 0], [0x41, 0], ['S']], pulse: [PW(0x300), [0x40, 0x06], ['S']], desc: { bright: .7, slow: 0, sus: .1 } }),
  p({ id: 'honkytonk', cat: 'keys', de: 'Honky-Tonk', en: 'Honky-tonk', ad: 0x0A, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: still(0x400), vib: [1, 0x08, 1], desc: { bright: .5, slow: 0, sus: .1 } }),
  p({ id: 'organ_church', cat: 'keys', de: 'Kirchenorgel', en: 'Church organ', ad: 0x40, sr: 0xF8, wave: [[0x41, 0], [0x41, 12], [0x41, 19], ['J', 0]], pulse: still(0x800), desc: { bright: .6, slow: .3, sus: 1 } }),
  p({ id: 'organ_perc', cat: 'keys', de: 'Perkussive Orgel', en: 'Percussive organ', ad: 0x00, sr: 0xC6, wave: [[0x41, 24], [0x41, 0], ['S']], pulse: still(0x800), desc: { bright: .5, slow: 0, sus: .8 } }),
  p({ id: 'accordion', cat: 'keys', de: 'Akkordeon', en: 'Accordion', ad: 0x3A, sr: 0xB9, wave: [[0x41, 0], ['S']], pulse: sweep(0x400, 0x04, 0x40), vib: [2, 0x0C, 4], desc: { bright: .55, slow: .25, sus: .85 } }),
  p({ id: 'celesta', cat: 'keys', de: 'Celesta', en: 'Celesta', ad: 0x0A, sr: 0x00, wave: [[0x11, 24], [0x11, 12], ['S']], desc: { bright: .15, slow: 0, sus: .1 } }),
  // ---- bells & mallets
  p({ id: 'tubular', cat: 'bell', de: 'Röhrenglocke', en: 'Tubular bell', ad: 0x0C, sr: 0x00, wave: [[0x15, 0], [0x11, 0], ['S']], desc: { bright: .3, slow: 0, sus: .3 } }),
  p({ id: 'xylophone', cat: 'bell', de: 'Xylophon', en: 'Xylophone', ad: 0x06, sr: 0x00, wave: [[0x11, 12], ['S']], desc: { bright: .2, slow: 0, sus: 0 } }),
  p({ id: 'steeldrum', cat: 'bell', de: 'Steel-Drum', en: 'Steel drum', ad: 0x09, sr: 0x00, wave: [[0x41, 12], [0x11, 0], [0x11, 7], ['J', 1]], pulse: still(0x600), desc: { bright: .3, slow: 0, sus: .1 } }),
  // ---- pads
  p({ id: 'pad_choir', cat: 'pad', de: 'Chor-Pad', en: 'Choir pad', ad: 0xAA, sr: 0xAA, wave: [[0x51, 0], ['S']], pulse: sweep(0x600, 0x60, 0x04), vib: [5, 0x0C, 20], desc: { bright: .3, slow: .9, sus: .85 } }),
  p({ id: 'pad_space', cat: 'pad', de: 'Weltraum-Pad (Filter)', en: 'Space pad (filter)', ad: 0xBA, sr: 0xAB, wave: [[0x21, 0], [0x21, 12], ['J', 0]], filter: [['T', 'bp', 12], ['C', 0x30], ['M', 0x80, 1], ['M', 0x80, -1], ['J', 2]], desc: { bright: .5, slow: 1, sus: .9 } }),
  p({ id: 'pad_glass', cat: 'pad', de: 'Glas-Pad', en: 'Glass pad', ad: 0x9A, sr: 0xAB, wave: [[0x11, 0], [0x11, 12], ['J', 0]], vib: [5, 0x08, 16], desc: { bright: .1, slow: .85, sus: .85 } }),
  p({ id: 'pad_sweep', cat: 'pad', de: 'Sweep-Pad', en: 'Sweep pad', ad: 0x8A, sr: 0xAA, wave: [[0x41, 0], ['S']], pulse: sweep(0x080, 0x70, 0x10), desc: { bright: .5, slow: .8, sus: .85 } }),
  // ---- choir
  p({ id: 'choir_ooh', cat: 'choir', de: 'Chor (Ooh)', en: 'Choir (ooh)', ad: 0x9A, sr: 0xAA, wave: [[0x11, 0], [0x51, 0], ['J', 0]], pulse: still(0x700), vib: [4, 0x0C, 12], desc: { bright: .1, slow: .75, sus: .85 } }),
  p({ id: 'voice_synth', cat: 'choir', de: 'Synth-Stimme', en: 'Synth voice', ad: 0x6A, sr: 0xAA, wave: [[0x61, 0], ['S']], pulse: sweep(0x400, 0x30, 0x08), vib: [4, 0x14, 8], desc: { bright: .5, slow: .5, sus: .85 } }),
  // ---- synth
  p({ id: 'syn_supersaw', cat: 'synth', de: 'Supersaw', en: 'Supersaw', ad: 0x08, sr: 0xB9, wave: [[0x21, 0], [0x21, 12], [0x21, 0], [0x21, 7], ['J', 0]], desc: { bright: .9, slow: 0, sus: .75 } }),
  p({ id: 'syn_poly', cat: 'synth', de: 'Poly-Synth', en: 'Poly synth', ad: 0x29, sr: 0x99, wave: [[0x41, 0], ['S']], pulse: sweep(0x300, 0x40, 0x10), desc: { bright: .5, slow: .15, sus: .6 } }),
  p({ id: 'syn_bell', cat: 'synth', de: 'Synth-Glocke', en: 'Synth bell', ad: 0x0A, sr: 0x00, wave: [[0x15, 12], [0x15, 0], ['S']], desc: { bright: .6, slow: 0, sus: .1 } }),
  p({ id: 'syn_trance', cat: 'synth', de: 'Trance-Gate', en: 'Trance gate', ad: 0x00, sr: 0xF0, wave: [[0x21, 0], [0x21, 0], [0x20, 'k'], [0x20, 'k'], ['J', 0]], desc: { bright: .8, slow: 0, sus: .8 } }),
  // ---- world
  p({ id: 'sitar', cat: 'world', de: 'Sitar', en: 'Sitar', ad: 0x0B, sr: 0x00, wave: [[0x23, 0], [0x41, 0], ['S']], pulse: [PW(0x100), [0x40, 0x04], ['S']], vib: [2, 0x10, 4], desc: { bright: .85, slow: 0, sus: .1 } }),
  p({ id: 'koto', cat: 'world', de: 'Koto', en: 'Koto', ad: 0x09, sr: 0x00, wave: [[0x41, 0], [0x11, 0], ['S']], pulse: still(0x200), desc: { bright: .45, slow: 0, sus: 0 } }),
  p({ id: 'kalimba', cat: 'world', de: 'Kalimba', en: 'Kalimba', ad: 0x07, sr: 0x00, wave: [[0x41, 24], [0x11, 0], ['S']], pulse: still(0x800), desc: { bright: .2, slow: 0, sus: 0 } }),
  p({ id: 'bagpipe', cat: 'world', de: 'Dudelsack', en: 'Bagpipe', ad: 0x2A, sr: 0xD9, wave: [[0x41, 0], ['S']], pulse: still(0x180), vib: [3, 0x10, 6], desc: { bright: .75, slow: .2, sus: .95 } }),
  p({ id: 'banjo', cat: 'world', de: 'Banjo', en: 'Banjo', ad: 0x06, sr: 0x00, wave: [[0x81, A(82)], [0x41, 0], ['S']], pulse: still(0x140), desc: { bright: .75, slow: 0, sus: 0 } }),
  p({ id: 'shamisen', cat: 'world', de: 'Shamisen', en: 'Shamisen', ad: 0x07, sr: 0x00, wave: [[0x21, 0], ['S']], desc: { bright: .8, slow: 0, sus: 0 } }),
  // ---- chiptune
  p({ id: 'chip_square', cat: 'chip', de: 'Chip-Rechteck 50 %', en: 'Chip square 50%', ad: 0x00, sr: 0xF9, wave: [[0x41, 0], ['S']], pulse: still(0x800), desc: { bright: .45, slow: 0, sus: 1 } }),
  p({ id: 'chip_pulse25', cat: 'chip', de: 'Chip-Puls 25 %', en: 'Chip pulse 25%', ad: 0x00, sr: 0xF9, wave: [[0x41, 0], ['S']], pulse: still(0x400), desc: { bright: .55, slow: 0, sus: 1 } }),
  p({ id: 'chip_pulse12', cat: 'chip', de: 'Chip-Puls 12 %', en: 'Chip pulse 12%', ad: 0x00, sr: 0xF9, wave: [[0x41, 0], ['S']], pulse: still(0x200), desc: { bright: .7, slow: 0, sus: 1 } }),
  p({ id: 'chip_tri', cat: 'chip', de: 'Chip-Dreieck', en: 'Chip triangle', ad: 0x00, sr: 0xF9, wave: [[0x11, 0], ['S']], desc: { bright: 0, slow: 0, sus: 1 } }),
  p({ id: 'chip_saw', cat: 'chip', de: 'Chip-Sägezahn', en: 'Chip saw', ad: 0x00, sr: 0xF9, wave: [[0x21, 0], ['S']], desc: { bright: .85, slow: 0, sus: 1 } }),
  p({ id: 'chip_arpmaj', cat: 'chip', de: 'Chip-Arp Dur', en: 'Chip arp major', ad: 0x00, sr: 0xF9, wave: [[0x41, 0], [0x41, 4], [0x41, 7], ['J', 0]], pulse: still(0x600), desc: { bright: .5, slow: 0, sus: 1 } }),
  p({ id: 'chip_arpmin', cat: 'chip', de: 'Chip-Arp Moll', en: 'Chip arp minor', ad: 0x00, sr: 0xF9, wave: [[0x41, 0], [0x41, 3], [0x41, 7], ['J', 0]], pulse: still(0x600), desc: { bright: .5, slow: 0, sus: 1 } }),
  p({ id: 'chip_echo', cat: 'chip', de: 'Chip-Echo-Lead', en: 'Chip echo lead', ad: 0x00, sr: 0xF9, wave: [[0x41, 0], [0x05, 'k'], [0x40, 'k'], [0x02, 'k'], [0x41, 0], ['S']], pulse: still(0x500), desc: { bright: .5, slow: 0, sus: .7 } }),
  // ---- drums
  p({ id: 'kick_click', cat: 'drums', de: 'Klick-Bassdrum', en: 'Click kick', drum: true, prefix: 2, ad: 0x07, sr: 0x00, wave: [[0x81, A(90)], [0x41, A(48)], [0x41, A(38)], [0x41, A(30)], [0x11, A(26)], ['S']], pulse: still(0x800), desc: { bright: .6, slow: 0, sus: 0 } }),
  p({ id: 'kick_deep', cat: 'drums', de: 'Tiefe Bassdrum', en: 'Deep kick', drum: true, prefix: 2, ad: 0x0B, sr: 0x00, wave: [[0x81, A(56)], [0x11, A(36)], [0x11, A(30)], [0x11, A(26)], [0x11, A(23)], [0x11, A(21)], [0x11, A(19)], ['S']], desc: { bright: .05, slow: 0, sus: .1 } }),
  p({ id: 'snare_noise', cat: 'drums', de: 'Rausch-Snare', en: 'Noise snare', drum: true, prefix: 2, ad: 0x08, sr: 0x00, wave: [[0x81, A(82)], [0x81, A(74)], [0x81, A(70)], ['S']], desc: { bright: .75, slow: 0, sus: 0 } }),
  p({ id: 'snare_808', cat: 'drums', de: '808-Snare', en: '808 snare', drum: true, prefix: 3, ad: 0x08, sr: 0x00, wave: [[0x11, A(52)], [0x81, A(76)], [0x11, A(50)], [0x81, A(72)], ['S']], desc: { bright: .55, slow: 0, sus: 0 } }),
  p({ id: 'snare_rim', cat: 'drums', de: 'Snare + Rim', en: 'Snare + rim', drum: true, prefix: 3, ad: 0x07, sr: 0x00, wave: [[0x41, A(72)], [0x81, A(78)], [0x41, A(48)], [0x81, A(70)], ['S']], pulse: still(0x800), desc: { bright: .65, slow: 0, sus: 0 } }),
  p({ id: 'hihat_pedal', cat: 'drums', de: 'HiHat (Pedal)', en: 'Hi-hat (pedal)', drum: true, prefix: 1, ad: 0x03, sr: 0x00, wave: [[0x81, A(88)], ['S']], desc: { bright: .9, slow: 0, sus: 0 } }),
  p({ id: 'hihat_metal', cat: 'drums', de: 'HiHat (metallisch)', en: 'Hi-hat (metallic)', drum: true, prefix: 1, ad: 0x03, sr: 0x00, wave: [[0x81, A(94)], [0x41, A(91)], [0x81, A(94)], ['S']], pulse: still(0x200), desc: { bright: 1, slow: 0, sus: 0 } }),
  p({ id: 'crash', cat: 'drums', de: 'Crash-Becken', en: 'Crash cymbal', drum: true, prefix: 1, ad: 0x0C, sr: 0x00, wave: [[0x81, A(92)], [0x81, A(86)], ['S']], desc: { bright: .95, slow: 0, sus: .4 } }),
  p({ id: 'tom_low', cat: 'drums', de: 'Tiefes Tom', en: 'Low tom', drum: true, prefix: 2, ad: 0x0A, sr: 0x00, wave: [[0x81, A(64)], [0x11, A(43)], [0x11, A(41)], [0x11, A(39)], [0x11, A(38)], [0x11, A(36)], ['S']], desc: { bright: .15, slow: 0, sus: 0 } }),
  p({ id: 'tom_high', cat: 'drums', de: 'Hohes Tom', en: 'High tom', drum: true, prefix: 2, ad: 0x09, sr: 0x00, wave: [[0x81, A(70)], [0x11, A(55)], [0x11, A(53)], [0x11, A(51)], [0x11, A(50)], [0x11, A(48)], ['S']], desc: { bright: .25, slow: 0, sus: 0 } }),
  p({ id: 'conga', cat: 'drums', de: 'Conga', en: 'Conga', drum: true, prefix: 2, ad: 0x07, sr: 0x00, wave: [[0x41, A(62)], [0x11, A(57)], [0x11, A(55)], ['S']], pulse: still(0x800), desc: { bright: .3, slow: 0, sus: 0 } }),
  p({ id: 'tambourine', cat: 'drums', de: 'Tamburin', en: 'Tambourine', drum: true, prefix: 2, ad: 0x06, sr: 0x00, wave: [[0x81, A(94)], [0x80, 'k'], [0x81, A(93)], ['S']], desc: { bright: 1, slow: 0, sus: 0 } }),
  p({ id: 'clave', cat: 'drums', de: 'Clave', en: 'Clave', drum: true, prefix: 1, ad: 0x03, sr: 0x00, wave: [[0x11, A(81)], ['S']], desc: { bright: .3, slow: 0, sus: 0 } }),
  // ---- fx
  p({ id: 'fx_alarm', cat: 'fx', de: 'Alarm', en: 'Alarm', ad: 0x00, sr: 0xF0, wave: [[0x41, 0], [0x41, 0], [0x41, 0], [0x41, 7], [0x41, 7], [0x41, 7], ['J', 0]], pulse: still(0x800), desc: { bright: .6, slow: 0, sus: 1 } }),
  p({ id: 'fx_zap', cat: 'fx', de: 'Zap', en: 'Zap', drum: true, ad: 0x06, sr: 0x00, wave: [[0x21, A(95)], [0x21, A(80)], [0x21, A(70)], [0x21, A(62)], [0x21, A(56)], [0x21, A(50)], ['S']], desc: { bright: .8, slow: 0, sus: 0 } }),
  p({ id: 'fx_riser', cat: 'fx', de: 'Riser', en: 'Riser', ad: 0xC0, sr: 0xF0, wave: [[0x81, 0], [0x81, 2], [0x81, 4], [0x81, 6], [0x81, 8], [0x81, 10], [0x81, 12], [0x81, 14], [0x81, 16], [0x81, 18], [0x81, 20], [0x81, 22], [0x81, 24], ['S']], desc: { bright: .8, slow: 1, sus: .8 } }),
  p({ id: 'fx_bubble', cat: 'fx', de: 'Blubbern', en: 'Bubbles', ad: 0x08, sr: 0x88, wave: [[0x11, 0], [0x11, 12], [0x11, 5], [0x11, 17], ['J', 0]], desc: { bright: .1, slow: 0, sus: .5 } }),
  p({ id: 'fx_coin', cat: 'fx', de: 'Münze / Pickup', en: 'Coin / pickup', ad: 0x08, sr: 0x00, wave: [[0x41, 0], [0x41, 0], [0x41, 5], [0x41, 5], [0x41, 12], ['S']], pulse: still(0x800), desc: { bright: .5, slow: 0, sus: 0 } }),
];

// extended class → preset suggestions (first = default)
export const CLASS_PRESETS_EXT = {
  beat: ['beat_auto', 'mute'],
  speech: ['voice_auto', 'mute', 'fx_noise', 'choir'],
  kick: ['kick', 'kick_hard', 'kick808', 'kick_click', 'kick_deep'],
  snare: ['snare', 'snare_fat', 'snare_tight', 'snare_noise', 'snare_808', 'snare_rim', 'clap'],
  hihat: ['hihat', 'hihat_open', 'hihat_pedal', 'hihat_metal', 'shaker', 'tambourine'],
  cymbal: ['cymbal', 'crash', 'ride', 'fx_crash'],
  tom: ['tom', 'tom_low', 'tom_high', 'tom_syn', 'conga'],
  perc: ['clap', 'rim', 'perc_blip', 'cowbell', 'shaker', 'conga', 'tambourine', 'clave'],
  bass: ['bass_pulse', 'bass_hubbard', 'bass_saw', 'bass_finger', 'bass_square', 'bass_slap', 'bass_sub', 'bass_fat', 'bass_pluck', 'bass_galway', 'bass_reese', 'bass_808', 'bass_fretless', 'bass_wobble', 'bass_filter', 'bass_acid'],
  lead: ['lead_pulse', 'lead_saw', 'lead_square', 'lead_hard', 'lead_hubbard', 'lead_solo', 'lead_soft', 'lead_sync', 'lead_chip', 'lead_octave', 'lead_fifth', 'lead_ring', 'lead_portal', 'lead_whistle', 'lead_mono', 'chip_pulse25', 'chip_square'],
  pad: ['pad_pwm', 'pad_soft', 'pad_saw', 'pad_warm', 'pad_sweep', 'pad_glass', 'pad_choir', 'pad_filter', 'pad_space'],
  strings: ['str_saw', 'str_pulse', 'str_ensemble', 'str_violin', 'str_cello', 'str_slow', 'str_tremolo', 'str_pizz', 'str_orchestra'],
  brass: ['brass', 'brass_trumpet', 'brass_trombone', 'brass_synth', 'brass_horn', 'brass_tuba', 'brass_stab'],
  wood: ['flute', 'clarinet', 'oboe', 'sax', 'panflute', 'piccolo', 'bassoon', 'recorder', 'harmonica'],
  guitar: ['gtr_clean', 'gtr_dist', 'gtr_lead', 'gtr_acoustic', 'gtr_nylon', 'gtr_funk', 'gtr_muted', 'gtr_power', 'gtr_harmonics', 'sitar', 'banjo'],
  keys: ['piano', 'piano_bright', 'epiano', 'organ', 'organ_perc', 'organ_church', 'harpsi', 'clav', 'synpiano', 'organ_oct', 'honkytonk', 'accordion', 'celesta'],
  bell: ['bell', 'glock', 'vibraphone', 'marimba', 'xylophone', 'tubular', 'musicbox', 'steeldrum', 'kalimba', 'syn_bell'],
  choir: ['choir', 'choir_ooh', 'voice_ooh', 'voice_synth', 'pad_choir'],
  chord: ['pad_pwm', 'str_saw', 'syn_stab', 'syn_poly', 'organ', 'syn_arp', 'pad_soft', 'piano', 'brass_stab', 'syn_supersaw'],
  fx: ['fx_wind', 'fx_crash', 'fx_noise', 'fx_up', 'fx_down', 'fx_riser', 'fx_laser', 'fx_zap', 'fx_boom', 'fx_alarm', 'fx_bubble', 'fx_coin'],
};
