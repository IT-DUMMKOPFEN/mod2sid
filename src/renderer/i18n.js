// mod2sid – UI texts (Deutsch / English)
export const T = {
  de: {
    open: 'Modul öffnen', reconvert: 'Neu konvertieren', save: 'Speichern', help: 'Hilfe', info: 'Info',
    dropTitle: 'Modul hier ablegen', dropSub: 'oder „Modul öffnen“ klicken – MOD, OctaMED (MMD0–3), XM, IT, DigiBooster Pro (DBM) und Art Of Noise (AON4/AON8)',
    song: 'Song', title: 'Titel', format: 'Format', length: 'Länge', positions: 'Positionen', tempo: 'Tempo', samples: 'Samples', channels: 'Kanäle', sidAuto: 'Auto (nach Kanälen)', soundHead: 'Klang', slides: 'Slides', vibrato: 'Vibrato', optOrig: 'Original', optSoft: 'Sanft', slidesTip: 'Original: alle Tonhöhen-Rutscher. Sanft: nur Gleiten zwischen Noten, keine Rutscher auf Drums. Aus: Zielnote direkt.', optSoftVib: 'Dezent', optOff: 'Aus', soundMatch: 'Wellenform am Klang anpassen', soundMatchTip: 'Die KI vergleicht das Obertonspektrum jedes Samples mit Dreieck, Sägezahn und Rechteck verschiedener Pulsbreiten und nimmt die passendste SID-Wellenform.', noDrums: 'Keine Drums', twoVoices: '2 Stimmen (1 SID, ohne Drums)', twoVoicesTip: 'Das Modul wird ohne Drums auf zwei Stimmen eines SIDs umgesetzt; die dritte Stimme bleibt frei (z. B. für Soundeffekte in einem Spiel).', twoVoicesNote: 'Modus „2 Stimmen“: 1 SID, Stimme 3 bleibt frei, keine Drums.', volume: 'Lautstärke (Klick auf den Lautsprecher: stumm)',
    options: 'Einstellungen', model: 'SID-Modell', creativity: 'Kreativität bei „Neu konvertieren“', fitEnv: 'Hüllkurven an Samples anpassen',
    useFilter: 'SID-Filter verwenden', loadAddr: 'Ladeadresse', kiInfo: 'KI-Klassifizierer', kiAcc: 'Trefferquote (echte Samples, nie gesehen)',
    family: 'Familie', classAcc: 'Klasse', player: 'Vorhören', srcSid: 'SID', srcMod: 'Original', voice: 'Stimme', solo: 'Solo', mute: 'Stumm',
    arrangement: 'Stimmenverteilung (Kanäle → 3 SID-Stimmen)', dropped: 'nicht übernommen', instruments: 'Instrumente',
    colNr: '#', colName: 'Sample', colKi: 'KI-Erkennung', colInstr: 'SID-Instrument', colOrig: 'Original', colSid: 'SID', colHits: 'Noten',
    manual: 'manuell', learned: 'gelernt', hitsWord: 'Schläge', drumsWord: 'Drums', converting: 'Konvertiere …', analysing: 'Analysiere Samples …', ready: 'Fertig',
    saved: 'Gespeichert', savedTo: 'Gespeichert:', reveal: 'Im Ordner zeigen', errLoad: 'Fehler beim Laden', notLoaded: 'Noch kein Modul geladen',
    stats: (r) => `${r.sids} · ${r.patterns} Patterns · ${r.instr} Instrumente · SID ${r.size} Bytes ($1000–$${r.end})`,
    variant: (n) => `Variante ${n}`, speechMuted: 'Sprache wird nicht umgewandelt', merged: 'kombiniert', theme: 'Hell/Dunkel', lang: 'Sprache',
    tabArr: 'Stimmen', tabLib: 'Instrumenten-Bibliothek', libHint: 'Klicke auf ▶ um ein Instrument anzuhören.',
    trunc: 'Achtung: Der Song passt nicht ganz in die 208 Patterns des GoatTracker-/GrooveGoat-Formats und wurde gekürzt. Mit weniger SIDs passt meist mehr hinein.', ggtNote: (n) => `${n} SIDs: gespeichert als .sid (PSID v5) und .ggt für C64 GrooveGoat${n === 6 ? ' (als 8-SID-Song, SID 7 und 8 bleiben still)' : ''}.`, ovf: 'Hinweis: Tabellen fast voll – einige Effekte wurden vereinfacht.',
    close: 'Schließen',
    sidChips: 'SID-Chips', sidHint: 'Mehr SIDs = mehr Stimmen (3 je SID): weniger Zusammenlegen, Akkorde als echte Akkorde. 1–2 SIDs: GoatTracker (.sng), 4–8 SIDs: C64 GrooveGoat (.ggt). SIDs liegen ab $D400 in Schritten von $20.',
  },
  en: {
    open: 'Open module', reconvert: 'Convert again', save: 'Save', help: 'Help', info: 'About',
    dropTitle: 'Drop a module here', dropSub: 'or click “Open module” – MOD, OctaMED (MMD0–3), XM, IT, DigiBooster Pro (DBM) and Art Of Noise (AON4/AON8)',
    song: 'Song', title: 'Title', format: 'Format', length: 'Length', positions: 'Positions', tempo: 'Tempo', samples: 'Samples', channels: 'Channels', sidAuto: 'Auto (by channels)', soundHead: 'Sound', slides: 'Slides', vibrato: 'Vibrato', optOrig: 'Original', optSoft: 'Soft', slidesTip: 'Original: all pitch slides. Soft: only glides between notes, no slides on drums. Off: target note straight away.', optSoftVib: 'Subtle', optOff: 'Off', soundMatch: 'Match waveform to the sound', soundMatchTip: 'The AI compares the overtone spectrum of every sample with triangle, saw and pulse waves of different widths and takes the closest SID waveform.', noDrums: 'No drums', twoVoices: '2 voices (1 SID, no drums)', twoVoicesTip: 'The module is converted to two voices of one SID without drums; the third voice stays free (e.g. for sound effects in a game).', twoVoicesNote: '“2 voices” mode: 1 SID, voice 3 stays free, no drums.', volume: 'Volume (click the speaker to mute)',
    options: 'Settings', model: 'SID model', creativity: 'Creativity for “Convert again”', fitEnv: 'Fit envelopes to samples',
    useFilter: 'Use SID filter', loadAddr: 'Load address', kiInfo: 'AI classifier', kiAcc: 'Accuracy (real, unseen samples)',
    family: 'family', classAcc: 'class', player: 'Preview', srcSid: 'SID', srcMod: 'Original', voice: 'Voice', solo: 'Solo', mute: 'Mute',
    arrangement: 'Voice allocation (channels → 3 SID voices)', dropped: 'not used', instruments: 'Instruments',
    colNr: '#', colName: 'Sample', colKi: 'AI detection', colInstr: 'SID instrument', colOrig: 'Original', colSid: 'SID', colHits: 'Notes',
    manual: 'manual', learned: 'learned', hitsWord: 'hits', drumsWord: 'drums', converting: 'Converting …', analysing: 'Analysing samples …', ready: 'Ready',
    saved: 'Saved', savedTo: 'Saved:', reveal: 'Show in folder', errLoad: 'Error while loading', notLoaded: 'No module loaded yet',
    stats: (r) => `${r.sids} · ${r.patterns} patterns · ${r.instr} instruments · SID ${r.size} bytes ($1000–$${r.end})`,
    variant: (n) => `Variant ${n}`, speechMuted: 'Speech is not converted', merged: 'combined', theme: 'Light/Dark', lang: 'Language',
    tabArr: 'Voices', tabLib: 'Instrument library', libHint: 'Click ▶ to listen to an instrument.',
    trunc: 'Note: the song does not fully fit into the 208 patterns of the GoatTracker/GrooveGoat format and has been shortened. With fewer SIDs more of it usually fits.', ggtNote: (n) => `${n} SIDs: saved as .sid (PSID v5) and .ggt for C64 GrooveGoat${n === 6 ? ' (as an 8-SID song, SID 7 and 8 stay silent)' : ''}.`, ovf: 'Note: tables nearly full – some effects were simplified.',
    close: 'Close',
    sidChips: 'SID chips', sidHint: 'More SIDs = more voices (3 per SID): less merging, chords as real chords. 1–2 SIDs: GoatTracker (.sng), 4–8 SIDs: C64 GrooveGoat (.ggt). SIDs from $D400 in steps of $20.',
  },
};

export const CLASS_NAMES = {
  de: { kick: 'Bassdrum', snare: 'Snare', hihat: 'HiHat', cymbal: 'Becken', tom: 'Tom', perc: 'Perkussion', bass: 'Bass', lead: 'Lead',
    pad: 'Fläche', strings: 'Streicher', brass: 'Blechbläser', wood: 'Holzbläser', guitar: 'Gitarre', keys: 'Tasten', bell: 'Glocke',
    choir: 'Chor', chord: 'Akkord', fx: 'Effekt', speech: 'Stimme', beat: 'Drum-Loop' },
  en: { kick: 'Kick', snare: 'Snare', hihat: 'Hi-hat', cymbal: 'Cymbal', tom: 'Tom', perc: 'Percussion', bass: 'Bass', lead: 'Lead',
    pad: 'Pad', strings: 'Strings', brass: 'Brass', wood: 'Woodwind', guitar: 'Guitar', keys: 'Keys', bell: 'Bell',
    choir: 'Choir', chord: 'Chord', fx: 'FX', speech: 'Voice', beat: 'Drum loop' },
};

export const HELP = {
  de: `<h2>So funktioniert mod2sid</h2>
<ol>
<li><b>Modul öffnen</b> oder per Drag &amp; Drop ins Fenster ziehen. Unterstützt werden ProTracker-MODs (4 bis 32 Kanäle), OctaMED (MMD0–MMD3, auch Synth- und Hybrid-Instrumente), FastTracker 2 XM, Impulse Tracker IT, DigiBooster Pro DBM und Art Of Noise (4 und 8 Stimmen). Mit PowerPacker gepackte Dateien werden automatisch entpackt.</li>
<li>Die <b>KI</b> hört sich jedes Sample an: Klangspektrum, Hüllkurve, Tonhöhe, Akkorde und wie es im Song gespielt wird. Daraus erkennt sie Bassdrum, Snare, Drum-Loops, Bass, Lead, Streicher, Gitarre, Stimmen usw.</li>
<li>Für jedes Sample wählt mod2sid ein passendes <b>SID-Instrument</b> aus der Bibliothek und passt die Hüllkurve (ADSR) an das Original an.</li>
<li>Der <b>Arranger</b> verteilt die 4 Amiga-Kanäle auf die 3 SID-Stimmen. Dabei kommen C64-Tricks zum Einsatz: Drums werden als Anschlag in Bass- oder Melodienoten eingebaut, zwei Melodiestimmen werden zu einem Arpeggio, und Lücken werden genutzt.</li>
<li><b>Vorhören:</b> Mit ▶ hörst du die SID-Version (eingebauter SID-Emulator, 6581 oder 8580). Umschalten auf „Original-MOD“ zum Vergleich. Einzelne SID-Stimmen kannst du stumm oder solo schalten.</li>
<li><b>Instrumente tauschen:</b> In der Instrumentenliste das Instrument wählen – die Musik wird sofort neu berechnet. mod2sid merkt sich deine Wahl und schlägt sie bei ähnlichen Samples künftig selbst vor.</li>
<li><b>Neu konvertieren</b> erzeugt eine andere Variante (andere Instrumentwahl und Stimmenverteilung). Der Regler „Kreativität“ bestimmt, wie stark sie sich unterscheidet. Manuell gewählte Instrumente bleiben erhalten.</li>
<li><b>1 bis 8 SIDs:</b> Wähle 1, 2, 4, 6 oder 8 SIDs (3 bis 24 Stimmen) – „Auto“ nimmt so viele, dass jeder Kanal eine eigene Stimme bekommt. Hat ein Modul mehr Kanäle als Stimmen, legt der Arranger Kanäle zusammen oder lässt die leisesten weg. Freie Stimmen spielen Akkorde als echte Akkorde und übernehmen Drum-Schläge. Gespeichert wird bei 1 SID für GoatTracker 2 (.sng), bei 2 SIDs für GoatTracker Stereo (.sng, PSID v3 mit zweitem SID auf $D420) und ab 4 SIDs im Format von <b>C64 GrooveGoat</b> (.ggt, PSID v5, SIDs ab $D400 in Schritten von $20). 6 SIDs werden als 8-SID-Song gespeichert, SID 7 und 8 bleiben still. GoatTracker und GrooveGoat erlauben höchstens 208 Patterns; passt ein Stück mit vielen Stimmen nicht hinein, wird es gekürzt – mit weniger SIDs passt meist mehr hinein.</li>
<li><b>Speichern</b> legt eine <b>.sid</b> (abspielbar in VICE, SIDPlay, auf dem C64) und eine <b>.sng</b> (GoatTracker) bzw. ab 4 SIDs eine <b>.ggt</b> (C64 GrooveGoat) zum Weiterbearbeiten mit gleichem Namen ab.</li>
</ol>
<h3>Gut zu wissen</h3>
<ul>
<li><b>Menschliche Stimmen</b> (Sprache, Gesang, „Yeah“) erkennt die KI am Klang und lässt sie weg – sie werden nicht umgesetzt. Wer sie trotzdem hören will, wählt beim Sample „Stimme mit Tonverlauf (KI)“.</li>
<li><b>Klang</b>: „Slides“ steuert Tonhöhen-Rutscher – <i>Sanft</i> (Standard) behält nur das Gleiten zwischen Noten, <i>Aus</i> spielt die Zielnote direkt. „Vibrato“ lässt sich abschwächen oder abschalten. „Wellenform am Klang anpassen“ vergleicht das Obertonspektrum jedes Samples mit Dreieck, Sägezahn und Rechteck und baut das Instrument mit der passendsten SID-Wellenform. „Keine Drums“ lässt alle Schlagzeug-Samples weg. „2 Stimmen“ setzt das Modul ohne Drums auf zwei Stimmen eines SIDs um, die dritte bleibt frei.</li>
<li><b>Drum-Loops</b> (ein Sample mit einem ganzen Beat) zerlegt die KI in einzelne Schläge. Gleich klingende Schläge werden erkannt und teilen sich ein SID-Instrument; Bassdrum, Snare und HiHat im Loop werden zu verschiedenen Instrumenten.</li>
<li><b>Lange Streicher</b> und Flächen behalten ihr langsames Anschwellen und klingen so lange wie das Original-Sample.</li>
<li>Der SID hat keine Lautstärke pro Stimme. Lautstärke-Effekte der MOD werden über die Hüllkurve (Sustain) nachgebildet.</li>
<li>Die SID nutzt einen eigenen, GoatTracker-kompatiblen Player ab $1000. Wer die originale GoatTracker-Routine möchte, öffnet die .sng in GoatTracker und exportiert dort.</li>
</ul>`,
  en: `<h2>How mod2sid works</h2>
<ol>
<li><b>Open a module</b> or drag &amp; drop it onto the window. Supported: ProTracker MODs (4 to 32 channels), OctaMED (MMD0–MMD3, incl. synth and hybrid instruments), FastTracker 2 XM, Impulse Tracker IT, DigiBooster Pro DBM and Art Of Noise (4 and 8 voices). PowerPacker-packed files are unpacked automatically.</li>
<li>The <b>AI</b> listens to every sample: spectrum, envelope, pitch, chords and how it is used in the song. It recognises kick, snare, drum loops, bass, lead, strings, guitar, voices and more.</li>
<li>For every sample mod2sid picks a matching <b>SID instrument</b> from the library and fits its envelope (ADSR) to the original.</li>
<li>The <b>arranger</b> maps the 4 Amiga channels onto the 3 SID voices using classic C64 tricks: drums become the attack of bass or melody notes, two melodic voices become an arpeggio, and gaps are filled.</li>
<li><b>Preview:</b> press ▶ to hear the SID version (built-in SID emulator, 6581 or 8580). Switch to “Original MOD” to compare. Single SID voices can be muted or soloed.</li>
<li><b>Swap instruments:</b> pick another instrument in the list – the music is re-calculated instantly. mod2sid remembers your choice and suggests it for similar samples in the future.</li>
<li><b>Convert again</b> creates a different variant (other instruments and voice allocation). The “creativity” slider controls how different it is. Instruments you picked manually are kept.</li>
<li><b>1 to 8 SIDs:</b> choose 1, 2, 4, 6 or 8 SIDs (3 to 24 voices) – “Auto” takes enough for every channel to get its own voice. If a module has more channels than voices, the arranger merges channels or drops the quietest. Spare voices play chords as real chords and take drum hits. 1 SID is saved for GoatTracker 2 (.sng), 2 SIDs for GoatTracker Stereo (.sng, PSID v3 with the second SID at $D420), and 4 SIDs or more in the <b>C64 GrooveGoat</b> format (.ggt, PSID v5, SIDs from $D400 in steps of $20). 6 SIDs are stored as an 8-SID song with SID 7 and 8 silent. GoatTracker and GrooveGoat allow at most 208 patterns; a song with many voices that does not fit is shortened – with fewer SIDs more of it usually fits.</li>
<li><b>Save</b> writes a <b>.sid</b> (plays in VICE, SIDPlay, on a real C64) and a <b>.sng</b> (GoatTracker) or, from 4 SIDs, a <b>.ggt</b> (C64 GrooveGoat) for further editing, with the same name.</li>
</ol>
<h3>Good to know</h3>
<ul>
<li><b>Human voices</b> (speech, singing, “yeah”) are recognised by their sound and left out – they are not converted. To hear them anyway, pick “Voice with pitch contour (AI)” for the sample.</li>
<li><b>Sound</b>: “Slides” controls pitch slides – <i>Soft</i> (default) keeps only glides between notes, <i>Off</i> plays the target note straight away. “Vibrato” can be reduced or switched off. “Match waveform to the sound” compares the overtone spectrum of every sample with triangle, saw and pulse waves and builds the instrument with the closest SID waveform. “No drums” leaves out all drum samples. “2 voices” converts the module without drums to two voices of one SID, the third stays free.</li>
<li><b>Drum loops</b> (a sample containing a whole beat) are split into single hits. Hits that sound alike are recognised and share one SID instrument; kick, snare and hi-hat in the loop become different instruments.</li>
<li><b>Long strings</b> and pads keep their slow swell and ring as long as the original sample.</li>
<li>The SID has no per-voice volume. Volume effects of the MOD are emulated via the envelope (sustain).</li>
<li>The SID uses an own GoatTracker-compatible player at $1000. If you want the original GoatTracker routine, open the .sng in GoatTracker and export from there.</li>
</ul>`,
};
