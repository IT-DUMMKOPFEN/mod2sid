// mod2sid – SID instrument library (GoatTracker-2 instruments)
// (c) IT-DUMMKOPFEN, GPL-3.0
import { EXTRA_PRESETS, EXTRA_CATEGORIES, CLASS_PRESETS_EXT } from './library_extra.js';
//
// wave:   [left, right] steps. right: number = relative halftones, {a:n} = absolute note, 'k' = keep pitch
//         ['J', i] = jump to step i (0-based), ['S'] = stop
// pulse:  [0x8X, lo] set width, [time, signedSpeed] modulate, ['J', i], ['S']
// filter: ['T', 'lp'|'bp'|'hp', resonance], ['C', cutoff], ['M', time, signedSpeed], ['J', i], ['S']
// vib:    [speed, depth, delay]   (instrument vibrato)
// desc:   bright 0..1, slow (attack) 0..1, sus 0..1 – used to match presets to samples
const PW = (w) => [0x80 | ((w >> 8) & 15), w & 0xFF];
const sweep = (start, t, sp) => [PW(start), [t, sp], [t, -sp], ['J', 1]];
const still = (w) => [PW(w), ['S']];
const A = (n) => ({ a: n });
const p = (o) => Object.assign({ gate: 2, fw: 0x09, pulse: null, filter: null, vib: null, drum: false, prefix: 0 }, o);

const BASE_CATEGORIES = [
  ['bass', 'Bass', 'Bass'], ['lead', 'Lead', 'Lead'], ['strings', 'Streicher', 'Strings'], ['brass', 'Blech', 'Brass'],
  ['wood', 'Holz', 'Woodwinds'], ['guitar', 'Gitarre', 'Guitar'], ['keys', 'Tasten', 'Keys'], ['bell', 'Glocken', 'Bells & Mallets'],
  ['pad', 'Flächen', 'Pads'], ['choir', 'Chor', 'Choir'], ['synth', 'Synth', 'Synth'], ['drums', 'Schlagzeug', 'Drums'],
  ['fx', 'Effekte', 'FX'], ['mute', 'Stumm', 'Muted'],
];

const BASE_PRESETS = [
  // ------------------------------------------------------------------ BASS
  p({ id: 'bass_pulse', cat: 'bass', de: 'Pulse-Bass', en: 'Pulse bass', ad: 0x09, sr: 0x6A, wave: [[0x41, 0], ['S']], pulse: sweep(0x400, 0x20, 0x20), desc: { bright: .5, slow: 0, sus: .5 } }),
  p({ id: 'bass_saw', cat: 'bass', de: 'Saw-Bass', en: 'Saw bass', ad: 0x09, sr: 0x5A, wave: [[0x21, 0], ['S']], desc: { bright: .8, slow: 0, sus: .4 } }),
  p({ id: 'bass_hubbard', cat: 'bass', de: 'Hubbard-Bass', en: 'Hubbard bass', ad: 0x08, sr: 0x89, wave: [[0x41, 12], [0x41, 0], ['S']], pulse: sweep(0x180, 0x30, 0x30), desc: { bright: .6, slow: 0, sus: .6 } }),
  p({ id: 'bass_slap', cat: 'bass', de: 'Slap-Bass', en: 'Slap bass', ad: 0x0A, sr: 0x00, wave: [[0x81, A(84)], [0x41, 12], [0x41, 0], ['S']], pulse: still(0x600), desc: { bright: .7, slow: 0, sus: 0 } }),
  p({ id: 'bass_sub', cat: 'bass', de: 'Sub-Bass (Dreieck)', en: 'Sub bass (triangle)', ad: 0x0A, sr: 0xA8, wave: [[0x11, 0], ['S']], desc: { bright: 0, slow: 0, sus: .7 } }),
  p({ id: 'bass_finger', cat: 'bass', de: 'Finger-Bass', en: 'Finger bass', ad: 0x0B, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: still(0x300), desc: { bright: .4, slow: 0, sus: 0 } }),
  p({ id: 'bass_square', cat: 'bass', de: 'Rechteck-Bass', en: 'Square bass', ad: 0x0A, sr: 0x6A, wave: [[0x41, 0], ['S']], pulse: still(0x800), desc: { bright: .45, slow: 0, sus: .45 } }),
  p({ id: 'bass_filter', cat: 'bass', de: 'Filter-Bass', en: 'Filter bass', ad: 0x09, sr: 0x9A, wave: [[0x21, 0], ['S']], filter: [['T', 'lp', 10], ['C', 0x70], ['M', 0x18, -3], ['S']], desc: { bright: .35, slow: 0, sus: .6 } }),
  p({ id: 'bass_acid', cat: 'bass', de: 'Acid-Bass', en: 'Acid bass', ad: 0x08, sr: 0x88, wave: [[0x21, 0], ['S']], filter: [['T', 'lp', 14], ['C', 0x90], ['M', 0x10, -6], ['S']], desc: { bright: .7, slow: 0, sus: .5 } }),
  p({ id: 'bass_fat', cat: 'bass', de: 'Fetter Bass (Oktave)', en: 'Fat bass (octave)', ad: 0x09, sr: 0x7A, wave: [[0x41, 0], [0x41, 12], ['J', 0]], pulse: still(0x500), desc: { bright: .55, slow: 0, sus: .55 } }),
  // ------------------------------------------------------------------ LEAD
  p({ id: 'lead_pulse', cat: 'lead', de: 'Pulse-Lead', en: 'Pulse lead', ad: 0x08, sr: 0xC9, wave: [[0x41, 0], ['S']], pulse: sweep(0x280, 0x40, 0x10), vib: [3, 0x20, 12], desc: { bright: .55, slow: .1, sus: .8 } }),
  p({ id: 'lead_saw', cat: 'lead', de: 'Saw-Lead', en: 'Saw lead', ad: 0x08, sr: 0xC9, wave: [[0x21, 0], ['S']], vib: [3, 0x20, 14], desc: { bright: .85, slow: .1, sus: .8 } }),
  p({ id: 'lead_square', cat: 'lead', de: 'Rechteck-Lead', en: 'Square lead', ad: 0x08, sr: 0xB9, wave: [[0x41, 0], ['S']], pulse: still(0x800), vib: [3, 0x18, 14], desc: { bright: .45, slow: .1, sus: .75 } }),
  p({ id: 'lead_soft', cat: 'lead', de: 'Weicher Lead (Dreieck)', en: 'Soft lead (triangle)', ad: 0x0A, sr: 0xC9, wave: [[0x11, 0], ['S']], vib: [3, 0x18, 12], desc: { bright: .1, slow: .15, sus: .8 } }),
  p({ id: 'lead_octave', cat: 'lead', de: 'Oktav-Lead', en: 'Octave lead', ad: 0x08, sr: 0xB9, wave: [[0x41, 0], [0x41, 12], ['J', 0]], pulse: still(0x500), desc: { bright: .6, slow: .05, sus: .7 } }),
  p({ id: 'lead_hard', cat: 'lead', de: 'Harter Lead', en: 'Hard lead', ad: 0x07, sr: 0xB9, wave: [[0x21, 0], [0x21, 0], [0x41, 0], ['S']], pulse: sweep(0x300, 0x30, 0x18), vib: [2, 0x28, 10], desc: { bright: .75, slow: 0, sus: .7 } }),
  p({ id: 'lead_chip', cat: 'lead', de: 'Chip-Lead (8-Bit)', en: 'Chip lead (8-bit)', ad: 0x00, sr: 0xF8, wave: [[0x41, 0], ['S']], pulse: still(0x400), desc: { bright: .5, slow: 0, sus: 1 } }),
  p({ id: 'lead_fifth', cat: 'lead', de: 'Quint-Lead', en: 'Fifth lead', ad: 0x08, sr: 0xB9, wave: [[0x41, 0], [0x41, 7], ['J', 0]], pulse: still(0x600), desc: { bright: .6, slow: .05, sus: .7 } }),
  // ------------------------------------------------------------------ STRINGS
  p({ id: 'str_saw', cat: 'strings', de: 'Streicher (Saw)', en: 'Strings (saw)', ad: 0x6A, sr: 0xA9, wave: [[0x21, 0], ['S']], vib: [4, 0x10, 10], desc: { bright: .7, slow: .5, sus: .8 } }),
  p({ id: 'str_pulse', cat: 'strings', de: 'Streicher (Pulse)', en: 'Strings (pulse)', ad: 0x8A, sr: 0xAA, wave: [[0x41, 0], ['S']], pulse: sweep(0x300, 0x60, 0x08), vib: [4, 0x10, 12], desc: { bright: .5, slow: .6, sus: .8 } }),
  p({ id: 'str_slow', cat: 'strings', de: 'Langsame Streicher', en: 'Slow strings', ad: 0xAA, sr: 0xAB, wave: [[0x21, 0], ['S']], vib: [4, 0x0C, 16], desc: { bright: .6, slow: .9, sus: .85 } }),
  p({ id: 'str_pizz', cat: 'strings', de: 'Pizzicato', en: 'Pizzicato', ad: 0x08, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: still(0x280), desc: { bright: .4, slow: 0, sus: 0 } }),
  p({ id: 'str_ensemble', cat: 'strings', de: 'Streich-Ensemble', en: 'String ensemble', ad: 0x7A, sr: 0xAA, wave: [[0x21, 0], [0x21, 12], ['J', 0]], vib: [4, 0x0C, 10], desc: { bright: .75, slow: .55, sus: .85 } }),
  // ------------------------------------------------------------------ BRASS
  p({ id: 'brass', cat: 'brass', de: 'Blechbläser', en: 'Brass section', ad: 0x4A, sr: 0xA9, wave: [[0x41, 0], ['S']], pulse: [PW(0x080), [0x30, 0x14], ['S']], vib: [3, 0x18, 14], desc: { bright: .8, slow: .3, sus: .75 } }),
  p({ id: 'brass_trumpet', cat: 'brass', de: 'Trompete', en: 'Trumpet', ad: 0x2A, sr: 0xBA, wave: [[0x41, 0], ['S']], pulse: [PW(0x100), [0x20, 0x10], ['S']], vib: [3, 0x20, 12], desc: { bright: .85, slow: .2, sus: .8 } }),
  p({ id: 'brass_synth', cat: 'brass', de: 'Synth-Brass', en: 'Synth brass', ad: 0x3A, sr: 0xA9, wave: [[0x21, 0], ['S']], filter: [['T', 'lp', 6], ['C', 0x30], ['M', 0x14, 5], ['S']], desc: { bright: .7, slow: .25, sus: .75 } }),
  p({ id: 'brass_horn', cat: 'brass', de: 'Horn (weich)', en: 'Horn (soft)', ad: 0x5A, sr: 0xA9, wave: [[0x31, 0], ['S']], vib: [4, 0x10, 14], desc: { bright: .45, slow: .4, sus: .75 } }),
  // ------------------------------------------------------------------ WOODWINDS
  p({ id: 'flute', cat: 'wood', de: 'Flöte', en: 'Flute', ad: 0x4A, sr: 0xA8, wave: [[0x11, 0], ['S']], vib: [3, 0x18, 12], desc: { bright: .05, slow: .35, sus: .7 } }),
  p({ id: 'clarinet', cat: 'wood', de: 'Klarinette', en: 'Clarinet', ad: 0x3A, sr: 0xB8, wave: [[0x41, 0], ['S']], pulse: still(0x800), vib: [4, 0x10, 14], desc: { bright: .4, slow: .3, sus: .8 } }),
  p({ id: 'oboe', cat: 'wood', de: 'Oboe', en: 'Oboe', ad: 0x3A, sr: 0xA8, wave: [[0x41, 0], ['S']], pulse: still(0x200), vib: [3, 0x14, 12], desc: { bright: .65, slow: .3, sus: .75 } }),
  p({ id: 'sax', cat: 'wood', de: 'Saxophon', en: 'Saxophone', ad: 0x2A, sr: 0xB9, wave: [[0x41, 0], ['S']], pulse: sweep(0x500, 0x10, 0x20), vib: [3, 0x24, 10], desc: { bright: .6, slow: .2, sus: .85 } }),
  p({ id: 'panflute', cat: 'wood', de: 'Panflöte', en: 'Pan flute', ad: 0x5A, sr: 0x99, wave: [[0x81, A(90)], [0x11, 0], ['S']], vib: [3, 0x14, 16], desc: { bright: .1, slow: .4, sus: .6 } }),
  // ------------------------------------------------------------------ GUITAR
  p({ id: 'gtr_clean', cat: 'guitar', de: 'Gitarre (clean)', en: 'Guitar (clean)', ad: 0x0B, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: [PW(0x300), [0x18, 0x30], ['S']], desc: { bright: .5, slow: 0, sus: .1 } }),
  p({ id: 'gtr_dist', cat: 'guitar', de: 'Verzerrte Gitarre', en: 'Distorted guitar', ad: 0x09, sr: 0xD9, wave: [[0x41, 0], ['S']], pulse: [PW(0x400), [0x08, 0x60], [0x08, -0x60], ['J', 1]], vib: [2, 0x20, 18], desc: { bright: .9, slow: 0, sus: .85 } }),
  p({ id: 'gtr_power', cat: 'guitar', de: 'Power-Akkord', en: 'Power chord', ad: 0x09, sr: 0xC9, wave: [[0x41, 0], [0x41, 7], [0x41, 12], ['J', 0]], pulse: still(0x500), desc: { bright: .8, slow: 0, sus: .75 } }),
  p({ id: 'gtr_muted', cat: 'guitar', de: 'Gedämpfte Gitarre', en: 'Muted guitar', ad: 0x05, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: still(0x200), desc: { bright: .5, slow: 0, sus: 0 } }),
  p({ id: 'gtr_acoustic', cat: 'guitar', de: 'Akustik-Gitarre', en: 'Acoustic guitar', ad: 0x0A, sr: 0x00, wave: [[0x81, A(80)], [0x41, 0], ['S']], pulse: [PW(0x300), [0x40, 0x08], ['S']], desc: { bright: .4, slow: 0, sus: 0 } }),
  // ------------------------------------------------------------------ KEYS
  p({ id: 'piano', cat: 'keys', de: 'Klavier', en: 'Piano', ad: 0x0B, sr: 0x00, wave: [[0x21, 0], [0x41, 0], ['S']], pulse: [PW(0x500), [0x60, 0x04], ['S']], desc: { bright: .5, slow: 0, sus: .1 } }),
  p({ id: 'epiano', cat: 'keys', de: 'E-Piano', en: 'Electric piano', ad: 0x0A, sr: 0x00, wave: [[0x41, 12], [0x11, 0], ['S']], pulse: still(0x800), desc: { bright: .2, slow: 0, sus: .1 } }),
  p({ id: 'organ', cat: 'keys', de: 'Orgel', en: 'Organ', ad: 0x00, sr: 0xF6, wave: [[0x41, 0], ['S']], pulse: still(0x800), desc: { bright: .45, slow: 0, sus: 1 } }),
  p({ id: 'organ_oct', cat: 'keys', de: 'Orgel (Oktaven)', en: 'Organ (octaves)', ad: 0x00, sr: 0xF6, wave: [[0x41, 0], [0x41, 12], ['J', 0]], pulse: still(0x800), desc: { bright: .55, slow: 0, sus: 1 } }),
  p({ id: 'harpsi', cat: 'keys', de: 'Cembalo', en: 'Harpsichord', ad: 0x09, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: still(0x180), desc: { bright: .8, slow: 0, sus: 0 } }),
  p({ id: 'clav', cat: 'keys', de: 'Clavinet', en: 'Clavinet', ad: 0x07, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: [PW(0x100), [0x20, 0x20], ['S']], desc: { bright: .7, slow: 0, sus: 0 } }),
  p({ id: 'synpiano', cat: 'keys', de: 'Synth-Piano', en: 'Synth piano', ad: 0x0A, sr: 0x30, wave: [[0x21, 0], ['S']], desc: { bright: .7, slow: 0, sus: .2 } }),
  // ------------------------------------------------------------------ BELLS & MALLETS
  p({ id: 'bell', cat: 'bell', de: 'Glocke', en: 'Bell', ad: 0x0B, sr: 0x00, wave: [[0x11, 0], [0x11, 19], ['J', 0]], desc: { bright: .3, slow: 0, sus: .2 } }),
  p({ id: 'glock', cat: 'bell', de: 'Glockenspiel', en: 'Glockenspiel', ad: 0x09, sr: 0x00, wave: [[0x11, 12], ['S']], desc: { bright: .2, slow: 0, sus: 0 } }),
  p({ id: 'vibraphone', cat: 'bell', de: 'Vibraphon', en: 'Vibraphone', ad: 0x0B, sr: 0x00, wave: [[0x11, 0], ['S']], vib: [5, 0x10, 4], desc: { bright: .1, slow: 0, sus: .2 } }),
  p({ id: 'marimba', cat: 'bell', de: 'Marimba', en: 'Marimba', ad: 0x07, sr: 0x00, wave: [[0x41, 0], [0x11, 0], ['S']], pulse: still(0x800), desc: { bright: .15, slow: 0, sus: 0 } }),
  p({ id: 'musicbox', cat: 'bell', de: 'Spieluhr', en: 'Music box', ad: 0x09, sr: 0x00, wave: [[0x41, 12], ['S']], pulse: still(0x200), desc: { bright: .6, slow: 0, sus: 0 } }),
  // ------------------------------------------------------------------ PADS
  p({ id: 'pad_soft', cat: 'pad', de: 'Weiches Pad', en: 'Soft pad', ad: 0xAA, sr: 0xAA, wave: [[0x11, 0], ['S']], vib: [5, 0x08, 20], desc: { bright: .05, slow: .9, sus: .8 } }),
  p({ id: 'pad_pwm', cat: 'pad', de: 'PWM-Pad', en: 'PWM pad', ad: 0x9A, sr: 0xAA, wave: [[0x41, 0], ['S']], pulse: sweep(0x200, 0x80, 0x0C), desc: { bright: .45, slow: .8, sus: .8 } }),
  p({ id: 'pad_saw', cat: 'pad', de: 'Saw-Pad', en: 'Saw pad', ad: 0x8A, sr: 0xAB, wave: [[0x21, 0], ['S']], desc: { bright: .7, slow: .75, sus: .85 } }),
  p({ id: 'pad_filter', cat: 'pad', de: 'Filter-Pad', en: 'Filter pad', ad: 0x8A, sr: 0xAA, wave: [[0x21, 0], ['S']], filter: [['T', 'lp', 8], ['C', 0x20], ['M', 0x60, 1], ['M', 0x60, -1], ['J', 2]], desc: { bright: .4, slow: .8, sus: .85 } }),
  p({ id: 'pad_warm', cat: 'pad', de: 'Warmes Pad', en: 'Warm pad', ad: 0x9A, sr: 0xAA, wave: [[0x51, 0], ['S']], pulse: still(0x600), desc: { bright: .25, slow: .8, sus: .8 } }),
  // ------------------------------------------------------------------ CHOIR
  p({ id: 'choir', cat: 'choir', de: 'Chor (Aah)', en: 'Choir (aah)', ad: 0x8A, sr: 0xAA, wave: [[0x51, 0], ['S']], pulse: sweep(0x500, 0x40, 0x06), vib: [4, 0x10, 10], desc: { bright: .3, slow: .7, sus: .85 } }),
  p({ id: 'voice_ooh', cat: 'choir', de: 'Stimme (Ooh)', en: 'Voice (ooh)', ad: 0x7A, sr: 0xAA, wave: [[0x11, 0], ['S']], vib: [4, 0x14, 8], desc: { bright: .05, slow: .6, sus: .85 } }),
  // ------------------------------------------------------------------ SYNTH
  p({ id: 'syn_pluck', cat: 'synth', de: 'Synth-Pluck', en: 'Synth pluck', ad: 0x06, sr: 0x00, wave: [[0x41, 0], ['S']], pulse: [PW(0x100), [0x10, 0x40], ['S']], desc: { bright: .6, slow: 0, sus: 0 } }),
  p({ id: 'syn_arp', cat: 'synth', de: 'Arpeggio-Synth', en: 'Arpeggio synth', ad: 0x08, sr: 0x88, wave: [[0x41, 0], ['S']], pulse: sweep(0x400, 0x20, 0x20), desc: { bright: .55, slow: 0, sus: .5 } }),
  p({ id: 'syn_stab', cat: 'synth', de: 'Synth-Stab', en: 'Synth stab', ad: 0x07, sr: 0x40, wave: [[0x21, 0], ['S']], desc: { bright: .8, slow: 0, sus: .25 } }),
  p({ id: 'syn_wobble', cat: 'synth', de: 'Wobble', en: 'Wobble', ad: 0x08, sr: 0xC9, wave: [[0x41, 0], ['S']], pulse: sweep(0x200, 0x08, 0x80), vib: [2, 0x40, 2], desc: { bright: .6, slow: 0, sus: .8 } }),
  p({ id: 'syn_sync', cat: 'synth', de: 'Ring-Synth', en: 'Ring synth', ad: 0x08, sr: 0xA9, wave: [[0x15, 0], ['S']], desc: { bright: .7, slow: 0, sus: .7 } }),
  // ------------------------------------------------------------------ DRUMS (pitch independent)
  p({ id: 'kick', cat: 'drums', de: 'Bassdrum', en: 'Kick drum', drum: true, prefix: 2, ad: 0x08, sr: 0x00, wave: [[0x81, A(60)], [0x41, A(40)], [0x41, A(35)], [0x41, A(31)], [0x41, A(28)], [0x41, A(25)], [0x11, A(23)], ['S']], pulse: still(0x800), desc: { bright: .3, slow: 0, sus: 0 } }),
  p({ id: 'kick808', cat: 'drums', de: '808-Bassdrum', en: '808 kick', drum: true, prefix: 2, ad: 0x0A, sr: 0x00, wave: [[0x11, A(48)], [0x11, A(40)], [0x11, A(35)], [0x11, A(31)], [0x11, A(28)], [0x11, A(26)], [0x11, A(24)], ['S']], desc: { bright: .1, slow: 0, sus: 0 } }),
  p({ id: 'kick_hard', cat: 'drums', de: 'Harte Bassdrum', en: 'Hard kick', drum: true, prefix: 2, ad: 0x06, sr: 0x00, wave: [[0x81, A(70)], [0x41, A(44)], [0x41, A(36)], [0x41, A(30)], [0x41, A(26)], ['S']], pulse: still(0x800), desc: { bright: .5, slow: 0, sus: 0 } }),
  p({ id: 'snare', cat: 'drums', de: 'Snare', en: 'Snare', drum: true, prefix: 3, ad: 0x07, sr: 0x00, wave: [[0x81, A(76)], [0x41, A(45)], [0x41, A(42)], [0x81, A(70)], [0x81, A(68)], ['S']], pulse: still(0x800), desc: { bright: .6, slow: 0, sus: 0 } }),
  p({ id: 'snare_tight', cat: 'drums', de: 'Snare (kurz)', en: 'Tight snare', drum: true, prefix: 2, ad: 0x05, sr: 0x00, wave: [[0x81, A(78)], [0x81, A(72)], ['S']], desc: { bright: .7, slow: 0, sus: 0 } }),
  p({ id: 'snare_fat', cat: 'drums', de: 'Snare (fett)', en: 'Fat snare', drum: true, prefix: 3, ad: 0x09, sr: 0x00, wave: [[0x81, A(80)], [0x41, A(40)], [0x81, A(67)], ['S']], pulse: still(0x700), desc: { bright: .55, slow: 0, sus: 0 } }),
  p({ id: 'clap', cat: 'drums', de: 'Clap', en: 'Clap', drum: true, prefix: 4, ad: 0x05, sr: 0x00, wave: [[0x81, A(76)], [0x80, 'k'], [0x81, A(76)], [0x80, 'k'], [0x81, A(74)], ['S']], desc: { bright: .65, slow: 0, sus: 0 } }),
  p({ id: 'hihat', cat: 'drums', de: 'HiHat (geschlossen)', en: 'Hi-hat (closed)', drum: true, prefix: 1, ad: 0x02, sr: 0x00, wave: [[0x81, A(94)], ['S']], desc: { bright: 1, slow: 0, sus: 0 } }),
  p({ id: 'hihat_open', cat: 'drums', de: 'HiHat (offen)', en: 'Hi-hat (open)', drum: true, prefix: 1, ad: 0x06, sr: 0x00, wave: [[0x81, A(92)], ['S']], desc: { bright: 1, slow: 0, sus: .1 } }),
  p({ id: 'cymbal', cat: 'drums', de: 'Becken', en: 'Cymbal', drum: true, prefix: 1, ad: 0x0B, sr: 0x00, wave: [[0x81, A(88)], ['S']], desc: { bright: .9, slow: 0, sus: .3 } }),
  p({ id: 'ride', cat: 'drums', de: 'Ride', en: 'Ride', drum: true, prefix: 1, ad: 0x09, sr: 0x00, wave: [[0x81, A(95)], [0x41, A(83)], [0x81, A(95)], ['S']], pulse: still(0x300), desc: { bright: .9, slow: 0, sus: .2 } }),
  p({ id: 'tom', cat: 'drums', de: 'Tom', en: 'Tom', prefix: 2, ad: 0x09, sr: 0x00, wave: [[0x81, A(70)], [0x11, 12], [0x11, 8], [0x11, 5], [0x11, 3], [0x11, 1], [0x11, 0], ['S']], desc: { bright: .2, slow: 0, sus: 0 } }),
  p({ id: 'tom_syn', cat: 'drums', de: 'E-Tom (Syndrum)', en: 'Synth tom', prefix: 2, ad: 0x0A, sr: 0x00, wave: [[0x41, 7], [0x41, 5], [0x41, 4], [0x41, 3], [0x41, 2], [0x41, 1], [0x41, 0], [0x41, -1], [0x41, -2], ['S']], pulse: still(0x800), desc: { bright: .4, slow: 0, sus: 0 } }),
  p({ id: 'rim', cat: 'drums', de: 'Rimshot', en: 'Rimshot', drum: true, prefix: 2, ad: 0x03, sr: 0x00, wave: [[0x81, A(84)], [0x41, A(60)], ['S']], pulse: still(0x800), desc: { bright: .6, slow: 0, sus: 0 } }),
  p({ id: 'cowbell', cat: 'drums', de: 'Kuhglocke', en: 'Cowbell', drum: true, prefix: 2, ad: 0x06, sr: 0x00, wave: [[0x41, A(76)], [0x41, A(83)], ['J', 0]], pulse: still(0x800), desc: { bright: .5, slow: 0, sus: 0 } }),
  p({ id: 'shaker', cat: 'drums', de: 'Shaker', en: 'Shaker', drum: true, prefix: 1, ad: 0x24, sr: 0x00, wave: [[0x81, A(93)], ['S']], desc: { bright: 1, slow: .1, sus: 0 } }),
  p({ id: 'perc_blip', cat: 'drums', de: 'Blip-Perkussion', en: 'Blip percussion', drum: true, prefix: 2, ad: 0x04, sr: 0x00, wave: [[0x41, A(84)], [0x41, A(72)], [0x41, A(60)], ['S']], pulse: still(0x400), desc: { bright: .6, slow: 0, sus: 0 } }),
  // ------------------------------------------------------------------ FX
  p({ id: 'fx_noise', cat: 'fx', de: 'Rausch-Effekt', en: 'Noise FX', ad: 0x6A, sr: 0x8A, wave: [[0x81, 24], ['S']], desc: { bright: .8, slow: .5, sus: .5 } }),
  p({ id: 'fx_up', cat: 'fx', de: 'Sweep hoch', en: 'Sweep up', ad: 0x09, sr: 0x89, wave: [[0x21, 0], [0x21, 2], [0x21, 4], [0x21, 6], [0x21, 8], [0x21, 10], [0x21, 12], [0x21, 14], [0x21, 16], [0x21, 18], [0x21, 20], [0x21, 22], [0x21, 24], ['S']], desc: { bright: .7, slow: 0, sus: .5 } }),
  p({ id: 'fx_down', cat: 'fx', de: 'Sweep runter', en: 'Sweep down', ad: 0x09, sr: 0x89, wave: [[0x21, 24], [0x21, 22], [0x21, 20], [0x21, 18], [0x21, 16], [0x21, 14], [0x21, 12], [0x21, 10], [0x21, 8], [0x21, 6], [0x21, 4], [0x21, 2], [0x21, 0], ['S']], desc: { bright: .7, slow: 0, sus: .5 } }),
  p({ id: 'fx_laser', cat: 'fx', de: 'Laser', en: 'Laser', drum: true, ad: 0x08, sr: 0x00, wave: [[0x41, A(90)], [0x41, A(84)], [0x41, A(78)], [0x41, A(72)], [0x41, A(66)], [0x41, A(60)], [0x41, A(54)], ['S']], pulse: still(0x400), desc: { bright: .7, slow: 0, sus: 0 } }),
  p({ id: 'fx_boom', cat: 'fx', de: 'Explosion', en: 'Explosion', drum: true, ad: 0x0C, sr: 0x00, wave: [[0x81, A(40)], [0x81, A(30)], ['S']], desc: { bright: .3, slow: 0, sus: .2 } }),
  p({ id: 'fx_wind', cat: 'fx', de: 'Wind / Whoosh', en: 'Wind / whoosh', drum: true, ad: 0xA9, sr: 0x00, wave: [[0x81, A(86)], ['S']], desc: { bright: .8, slow: .8, sus: .2 } }),
  p({ id: 'fx_crash', cat: 'fx', de: 'Crash-Effekt', en: 'Crash FX', drum: true, ad: 0x0B, sr: 0x00, wave: [[0x81, A(80)], ['S']], desc: { bright: .8, slow: 0, sus: .1 } }),
  // ------------------------------------------------------------------ MUTE
  p({ id: 'mute', cat: 'mute', de: 'Stumm (nicht übernehmen)', en: 'Muted (skip)', ad: 0, sr: 0, wave: [['S']], desc: { bright: 0, slow: 0, sus: 0 } }),
];

export const CATEGORIES = [...BASE_CATEGORIES.slice(0, -2), ...EXTRA_CATEGORIES, ...BASE_CATEGORIES.slice(-2)];
export const PRESETS = [...BASE_PRESETS.filter(x => x.id !== 'mute'), ...EXTRA_PRESETS, ...BASE_PRESETS.filter(x => x.id === 'mute')];
export const PRESET_BY_ID = Object.fromEntries(PRESETS.map(x => [x.id, x]));

// which presets fit which detected class (first = default)
const BASE_CLASS_PRESETS = {
  kick: ['kick', 'kick_hard', 'kick808'], snare: ['snare', 'snare_fat', 'snare_tight', 'clap'],
  hihat: ['hihat', 'hihat_open', 'shaker'], cymbal: ['cymbal', 'ride', 'fx_crash'], tom: ['tom', 'tom_syn'],
  perc: ['clap', 'rim', 'perc_blip', 'cowbell', 'shaker'],
  bass: ['bass_pulse', 'bass_hubbard', 'bass_saw', 'bass_finger', 'bass_square', 'bass_slap', 'bass_sub', 'bass_fat', 'bass_filter', 'bass_acid'],
  lead: ['lead_pulse', 'lead_saw', 'lead_square', 'lead_hard', 'lead_soft', 'lead_chip', 'lead_octave', 'lead_fifth'],
  pad: ['pad_pwm', 'pad_soft', 'pad_saw', 'pad_warm', 'pad_filter'],
  strings: ['str_saw', 'str_pulse', 'str_ensemble', 'str_slow', 'str_pizz'],
  brass: ['brass', 'brass_trumpet', 'brass_synth', 'brass_horn'],
  wood: ['flute', 'clarinet', 'oboe', 'sax', 'panflute'],
  guitar: ['gtr_clean', 'gtr_dist', 'gtr_acoustic', 'gtr_muted', 'gtr_power'],
  keys: ['piano', 'epiano', 'organ', 'harpsi', 'clav', 'synpiano', 'organ_oct'],
  bell: ['bell', 'glock', 'vibraphone', 'marimba', 'musicbox'],
  choir: ['choir', 'voice_ooh', 'pad_warm'],
  chord: ['pad_pwm', 'str_saw', 'syn_stab', 'organ', 'syn_arp', 'pad_soft', 'piano'],
  fx: ['fx_wind', 'fx_crash', 'fx_noise', 'fx_up', 'fx_down', 'fx_laser', 'fx_boom'],
  speech: ['mute', 'fx_noise', 'choir'],
};

export const CLASS_PRESETS = { ...BASE_CLASS_PRESETS, ...CLASS_PRESETS_EXT };

export function presetName(pr, lang) { return lang === 'en' ? pr.en : pr.de; }
