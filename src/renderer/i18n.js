// mod2sid – UI texts (Deutsch / English)
export const T = {
  de: {
    open: 'MOD öffnen', reconvert: 'Neu konvertieren', save: 'SID + SNG speichern', help: 'Hilfe', info: 'Info',
    dropTitle: 'Amiga-MOD hier ablegen', dropSub: 'oder „MOD öffnen“ klicken – 4-Kanal-MODs (ProTracker, NoiseTracker, SoundTracker)',
    song: 'Song', title: 'Titel', format: 'Format', length: 'Länge', positions: 'Positionen', tempo: 'Tempo', samples: 'Samples',
    options: 'Einstellungen', model: 'SID-Modell', creativity: 'Kreativität bei „Neu konvertieren“', fitEnv: 'Hüllkurven an Samples anpassen',
    useFilter: 'SID-Filter verwenden', loadAddr: 'Ladeadresse', kiInfo: 'KI-Klassifizierer', kiAcc: 'Trefferquote (echte Samples, nie gesehen)',
    family: 'Familie', classAcc: 'Klasse', player: 'Vorhören', srcSid: 'SID', srcMod: 'Original-MOD', voice: 'Stimme', solo: 'Solo', mute: 'Stumm',
    arrangement: 'Stimmenverteilung (4 Kanäle → 3 SID-Stimmen)', dropped: 'nicht übernommen', instruments: 'Instrumente',
    colNr: '#', colName: 'Sample', colKi: 'KI-Erkennung', colInstr: 'SID-Instrument', colOrig: 'Original', colSid: 'SID', colHits: 'Noten',
    manual: 'manuell', learned: 'gelernt', hitsWord: 'Schläge', drumsWord: 'Drums', converting: 'Konvertiere …', analysing: 'Analysiere Samples …', ready: 'Fertig',
    saved: 'Gespeichert', savedTo: 'Gespeichert:', reveal: 'Im Ordner zeigen', errLoad: 'Fehler beim Laden', notLoaded: 'Noch kein MOD geladen',
    stats: (r) => `${r.sids} · ${r.patterns} Patterns · ${r.instr} Instrumente · SID ${r.size} Bytes ($1000–$${r.end})`,
    variant: (n) => `Variante ${n}`, speechMuted: 'Sprache wird nicht umgewandelt', merged: 'kombiniert', theme: 'Hell/Dunkel', lang: 'Sprache',
    tabArr: 'Stimmen', tabLib: 'Instrumenten-Bibliothek', libHint: 'Klicke auf ▶ um ein Instrument anzuhören.',
    trunc: 'Achtung: Der Song war für das GoatTracker-Format zu lang und wurde gekürzt.', ovf: 'Hinweis: Tabellen fast voll – einige Effekte wurden vereinfacht.',
    close: 'Schließen',
    sidChips: 'SID-Chips', sidHint: '2 SIDs = 6 Stimmen: kein Zusammenlegen nötig, Akkorde als echte Akkorde. Braucht 2 SIDs (VICE: zweiter SID auf $D420).',
  },
  en: {
    open: 'Open MOD', reconvert: 'Convert again', save: 'Save SID + SNG', help: 'Help', info: 'About',
    dropTitle: 'Drop an Amiga MOD here', dropSub: 'or click “Open MOD” – 4-channel MODs (ProTracker, NoiseTracker, SoundTracker)',
    song: 'Song', title: 'Title', format: 'Format', length: 'Length', positions: 'Positions', tempo: 'Tempo', samples: 'Samples',
    options: 'Settings', model: 'SID model', creativity: 'Creativity for “Convert again”', fitEnv: 'Fit envelopes to samples',
    useFilter: 'Use SID filter', loadAddr: 'Load address', kiInfo: 'AI classifier', kiAcc: 'Accuracy (real, unseen samples)',
    family: 'family', classAcc: 'class', player: 'Preview', srcSid: 'SID', srcMod: 'Original MOD', voice: 'Voice', solo: 'Solo', mute: 'Mute',
    arrangement: 'Voice allocation (4 channels → 3 SID voices)', dropped: 'not used', instruments: 'Instruments',
    colNr: '#', colName: 'Sample', colKi: 'AI detection', colInstr: 'SID instrument', colOrig: 'Original', colSid: 'SID', colHits: 'Notes',
    manual: 'manual', learned: 'learned', hitsWord: 'hits', drumsWord: 'drums', converting: 'Converting …', analysing: 'Analysing samples …', ready: 'Ready',
    saved: 'Saved', savedTo: 'Saved:', reveal: 'Show in folder', errLoad: 'Error while loading', notLoaded: 'No MOD loaded yet',
    stats: (r) => `${r.sids} · ${r.patterns} patterns · ${r.instr} instruments · SID ${r.size} bytes ($1000–$${r.end})`,
    variant: (n) => `Variant ${n}`, speechMuted: 'Speech is not converted', merged: 'combined', theme: 'Light/Dark', lang: 'Language',
    tabArr: 'Voices', tabLib: 'Instrument library', libHint: 'Click ▶ to listen to an instrument.',
    trunc: 'Note: the song was too long for the GoatTracker format and has been shortened.', ovf: 'Note: tables nearly full – some effects were simplified.',
    close: 'Close',
    sidChips: 'SID chips', sidHint: '2 SIDs = 6 voices: no merging needed, chords as real chords. Needs 2 SIDs (VICE: second SID at $D420).',
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
<li><b>MOD öffnen</b> oder per Drag &amp; Drop ins Fenster ziehen. Unterstützt werden 4-Kanal-MODs (ProTracker, NoiseTracker, SoundTracker).</li>
<li>Die <b>KI</b> hört sich jedes Sample an: Klangspektrum, Hüllkurve, Tonhöhe, Akkorde und wie es im Song gespielt wird. Daraus erkennt sie Bassdrum, Snare, Drum-Loops, Bass, Lead, Streicher, Gitarre, Stimmen usw.</li>
<li>Für jedes Sample wählt mod2sid ein passendes <b>SID-Instrument</b> aus der Bibliothek und passt die Hüllkurve (ADSR) an das Original an.</li>
<li>Der <b>Arranger</b> verteilt die 4 Amiga-Kanäle auf die 3 SID-Stimmen. Dabei kommen C64-Tricks zum Einsatz: Drums werden als Anschlag in Bass- oder Melodienoten eingebaut, zwei Melodiestimmen werden zu einem Arpeggio, und Lücken werden genutzt.</li>
<li><b>Vorhören:</b> Mit ▶ hörst du die SID-Version (eingebauter SID-Emulator, 6581 oder 8580). Umschalten auf „Original-MOD“ zum Vergleich. Einzelne SID-Stimmen kannst du stumm oder solo schalten.</li>
<li><b>Instrumente tauschen:</b> In der Instrumentenliste das Instrument wählen – die Musik wird sofort neu berechnet. mod2sid merkt sich deine Wahl und schlägt sie bei ähnlichen Samples künftig selbst vor.</li>
<li><b>Neu konvertieren</b> erzeugt eine andere Variante (andere Instrumentwahl und Stimmenverteilung). Der Regler „Kreativität“ bestimmt, wie stark sie sich unterscheidet. Manuell gewählte Instrumente bleiben erhalten.</li>
<li><b>1 oder 2 SIDs:</b> Mit 2 SIDs (6 Stimmen) bekommt jeder MOD-Kanal eine eigene Stimme. Die zwei freien Stimmen spielen Akkord-Samples als echte Akkorde und übernehmen Drum-Schläge, damit Bass oder Melodie weiterklingen. Die SID nutzt dann das PSID-v3-Format mit zweitem SID auf $D420 (VICE, SIDPlay), die SNG ist für GoatTracker Stereo.</li>
<li><b>Speichern</b> legt eine <b>.sid</b> (abspielbar in VICE, SIDPlay, auf dem C64) und eine <b>.sng</b> (GoatTracker 2 zum Weiterbearbeiten) mit gleichem Namen ab.</li>
</ol>
<h3>Gut zu wissen</h3>
<ul>
<li><b>Stimmen</b> (z. B. „Yeah“) baut die KI als Tonhöhenverlauf nach: Sie misst die Tonhöhe alle 20 ms und schreibt sie in die Wavetable – ein „Yeah“, das tief beginnt und nach oben gleitet, macht das auch im SID. Wer lieber Stille möchte, wählt „Stumm“.</li>
<li><b>Drum-Loops</b> (ein Sample mit einem ganzen Beat) zerlegt die KI in einzelne Schläge. Gleich klingende Schläge werden erkannt und teilen sich ein SID-Instrument; Bassdrum, Snare und HiHat im Loop werden zu verschiedenen Instrumenten.</li>
<li><b>Lange Streicher</b> und Flächen behalten ihr langsames Anschwellen und klingen so lange wie das Original-Sample.</li>
<li>Der SID hat keine Lautstärke pro Stimme. Lautstärke-Effekte der MOD werden über die Hüllkurve (Sustain) nachgebildet.</li>
<li>Die SID nutzt einen eigenen, GoatTracker-kompatiblen Player ab $1000. Wer die originale GoatTracker-Routine möchte, öffnet die .sng in GoatTracker und exportiert dort.</li>
</ul>`,
  en: `<h2>How mod2sid works</h2>
<ol>
<li><b>Open a MOD</b> or drag &amp; drop it onto the window. 4-channel MODs (ProTracker, NoiseTracker, SoundTracker) are supported.</li>
<li>The <b>AI</b> listens to every sample: spectrum, envelope, pitch, chords and how it is used in the song. It recognises kick, snare, drum loops, bass, lead, strings, guitar, voices and more.</li>
<li>For every sample mod2sid picks a matching <b>SID instrument</b> from the library and fits its envelope (ADSR) to the original.</li>
<li>The <b>arranger</b> maps the 4 Amiga channels onto the 3 SID voices using classic C64 tricks: drums become the attack of bass or melody notes, two melodic voices become an arpeggio, and gaps are filled.</li>
<li><b>Preview:</b> press ▶ to hear the SID version (built-in SID emulator, 6581 or 8580). Switch to “Original MOD” to compare. Single SID voices can be muted or soloed.</li>
<li><b>Swap instruments:</b> pick another instrument in the list – the music is re-calculated instantly. mod2sid remembers your choice and suggests it for similar samples in the future.</li>
<li><b>Convert again</b> creates a different variant (other instruments and voice allocation). The “creativity” slider controls how different it is. Instruments you picked manually are kept.</li>
<li><b>1 or 2 SIDs:</b> with 2 SIDs (6 voices) every MOD channel gets its own voice. The two spare voices play chord samples as real chords and take drum hits so bass or melody keeps ringing. The SID then uses PSID v3 with the second SID at $D420 (VICE, SIDPlay), the SNG is for GoatTracker Stereo.</li>
<li><b>Save</b> writes a <b>.sid</b> (plays in VICE, SIDPlay, on a real C64) and a <b>.sng</b> (GoatTracker 2, for further editing) with the same name.</li>
</ol>
<h3>Good to know</h3>
<ul>
<li><b>Voices</b> (e.g. “yeah”) are rebuilt as a pitch contour: the AI measures the pitch every 20 ms and writes it into the wavetable – a “yeah” that starts low and slides up does the same on the SID. Pick “Muted” if you prefer silence.</li>
<li><b>Drum loops</b> (a sample containing a whole beat) are split into single hits. Hits that sound alike are recognised and share one SID instrument; kick, snare and hi-hat in the loop become different instruments.</li>
<li><b>Long strings</b> and pads keep their slow swell and ring as long as the original sample.</li>
<li>The SID has no per-voice volume. Volume effects of the MOD are emulated via the envelope (sustain).</li>
<li>The SID uses an own GoatTracker-compatible player at $1000. If you want the original GoatTracker routine, open the .sng in GoatTracker and export from there.</li>
</ul>`,
};
