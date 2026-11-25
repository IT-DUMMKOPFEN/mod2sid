## mod2sid 2.1.7

**DE:** KI weiter trainiert. Sie erkennt Gesang, Gitarren, Flächen und Streicher jetzt deutlich besser am Klang.

**EN:** AI trained further. It now recognises vocals, guitars, pads and strings by their sound much better.

## mod2sid 2.1.6

**DE:** KI weiter trainiert, vor allem mit Drums und Perkussion. RAR-Archive können jetzt für das Training gelesen werden.

**EN:** AI trained further, mainly with drums and percussion. RAR archives can now be read for training.

## mod2sid 2.1.5

**DE:** KI weiter trainiert mit beschrifteten Instrument-Samples. Leads, Effekte, Perkussion und Flächen werden besser erkannt.

**EN:** AI trained further with labelled instrument samples. Leads, effects, percussion and pads are recognised better.

## mod2sid 2.1.4

**DE:** KI mit beschrifteten Instrument-Samples trainiert. Toms, Becken, HiHats, Leads und Drum-Loops werden deutlich besser erkannt.

**EN:** AI trained with labelled instrument samples. Toms, cymbals, hi-hats, leads and drum loops are recognised much better.

## mod2sid 2.1.3

**DE:** KI weiter trainiert. Bei unbekannten Modulen sind 86 % der Klassen und 93 % der Familien richtig.

**EN:** AI trained further. On unseen modules it gets 86 % of classes and 93 % of families right.

## mod2sid 2.1.2

**DE:** Songs mit sehr schnellem Tempo (Zeilen mit nur 2 Frames, z. B. Funktempo 3/2) liefen in GoatTracker und C64 GrooveGoat nicht los. Der Gate-Timer der Instrumente (2) war länger als die schnellste Zeile, und dann stoppen beide Programme den Song. Die App wählt jetzt den Gate-Timer 1, wenn das Stück so schnelle Zeilen hat. Ein Tempo von 2 Frames wird außerdem als Funktempo 2/2 geschrieben, weil F02 dort wie F03 wirkt.

**EN:** Songs with a very fast tempo (rows of only 2 frames, e.g. funktempo 3/2) did not start in GoatTracker and C64 GrooveGoat. The instruments' gate timer (2) was longer than the fastest row, and both programs stop the song in that case. The app now uses gate timer 1 when a piece has such fast rows. A tempo of 2 frames is also written as funktempo 2/2, because F02 acts like F03 there.

## mod2sid 2.1.1

**DE:** Fehler im SID-Player behoben: Das Vibrato wurde in jeder Zeile neu gestartet, deshalb liefen gehaltene Noten langsam nach oben weg. Das passierte auch mit ausgeschalteten Slides. Jetzt schwingt das Vibrato sauber um den Ton. Mit „Slides: Aus“ und „Vibrato: Aus“ gibt es keinerlei Tonhöhenbewegung mehr, auch kein Instrument-Vibrato aus der Bibliothek. Vorher wanderten in den Testsongs 22 % der gehaltenen Noten mehr als einen halben Halbton, jetzt sind es 1,4 % mit den Standard-Einstellungen und 0 % mit beiden Optionen auf „Aus“.

**EN:** Fixed a bug in the SID player: vibrato restarted on every row, so held notes slowly drifted upwards, even with slides switched off. Vibrato now swings evenly around the note. With “slides: off” and “vibrato: off” there is no pitch movement at all, not even the instrument vibrato from the library. In the test songs, 22 % of held notes drifted by more than half a semitone before; now it is 1.4 % with the default settings and 0 % with both options off.

## mod2sid 2.1

**DE:**
- **Slides:** Porta-Slides rechnen jetzt mit der Tonhöhe, die die Note gerade hat. Bisher wurde die Geschwindigkeit an der Startnote bemessen, deshalb liefen lange Slides am Ziel vorbei.
- **Neue Klang-Optionen:** Slides (Original, Sanft, Aus; Standard Sanft), Vibrato (Original, Dezent, Aus), „Wellenform am Klang anpassen“, „Keine Drums“ und „2 Stimmen“ (1 SID ohne Drums, Stimme 3 bleibt frei).
- **Am Klang nachgebaut:** Die SID-Wellenform (Dreieck, Sägezahn oder Rechteck mit Pulsbreite) wird aus dem Obertonspektrum jedes Samples bestimmt.
- **Einordnung am Klang:** Die KI ordnet Instrumente am Klang ein. Der Sample-Name hilft nur noch, wenn der Klang schon in dieselbe Richtung zeigt.
- **Stimmen:** Menschliche Stimmen werden weggelassen.
- **Training:** KI weiter trainiert.

**EN:**
- **Slides:** porta slides now follow the pitch the note currently has. Before, their speed was based on the start note, so long slides overshot their target.
- **New sound options:** slides (original, soft, off; default soft), vibrato (original, subtle, off), “match waveform to the sound”, “no drums” and “2 voices” (1 SID without drums, voice 3 stays free).
- **Rebuilt from the sound:** the SID waveform (triangle, saw or pulse with its width) comes from the overtone spectrum of each sample.
- **Classification by sound:** the AI classifies instruments by their sound. A sample name only helps when the sound already points the same way.
- **Voices:** human voices are left out.
- **Training:** AI trained further.

## mod2sid 2.0.1

**DE:** Neuer Lautstärkeregler im Player (gilt für SID, Original und Vorhören). Ein Klick auf den Lautsprecher schaltet stumm. Die Einstellung bleibt gespeichert.

**EN:** New volume slider in the player (for SID, original and auditions). Click the speaker to mute. The setting is remembered.

## mod2sid 2.0

**DE:**
- **Neue Formate:** OctaMED (MMD0–MMD3, mit Synth- und Hybrid-Instrumenten), FastTracker 2 XM, Impulse Tracker IT, DigiBooster Pro (DBM) und Art Of Noise (AON4/AON8). Dazu kommen MODs mit 6 bis 32 Kanälen und mit PowerPacker gepackte Dateien.
- **1, 2, 4, 6 oder 8 SIDs:** 4 bis 8 SIDs werden im C64-GrooveGoat-Format (.ggt) und als PSID v5 gespeichert, 6 SIDs als 8-SID-Song.
- **Patterns:** Sie werden für jede Stimme einzeln geschnitten, damit mehr in die 208 Patterns passt.
- **Synth-Instrumente** behalten ihre Wellenform.
- **Neues Icon** im Stil von C64 GrooveGoat.
- **KI:** weiter trainiert. Bei unbekannten Modulen sind 85 % der Klassen und 92 % der Familien richtig.
- **Vorschau:** Die Vorschau des Originals spielt jetzt in der richtigen Oktave.

**EN:**
- **New formats:** OctaMED (MMD0–MMD3, incl. synth and hybrid instruments), FastTracker 2 XM, Impulse Tracker IT, DigiBooster Pro (DBM) and Art Of Noise (AON4/AON8). Also MODs with 6 to 32 channels and PowerPacker-packed files.
- **1, 2, 4, 6 or 8 SIDs:** 4 to 8 SIDs are saved in the C64 GrooveGoat format (.ggt) and as PSID v5, 6 SIDs as an 8-SID song.
- **Patterns:** they are cut per voice so more fits into the 208 patterns.
- **Synth instruments** keep their waveform.
- **New icon** in the style of C64 GrooveGoat.
- **AI:** trained further. On unseen modules it gets 85 % of classes and 92 % of families right.
- **Preview:** the original preview now plays in the correct octave.

## mod2sid 1.3.2

**DE:** KI weiter trainiert. Bei unbekannten MODs sind 85 % der Klassen und 92 % der Familien richtig. Die WAV-Bibliothek wird stärker gewichtet, damit lose Samples weiter gut erkannt werden.

**EN:** AI trained further. On unseen MODs it gets 85 % of classes and 92 % of families right. The WAV library is weighted higher so that loose samples are still recognised well.

## mod2sid 1.3.1

**DE:** KI weiter trainiert. Bei unbekannten MODs sind 83 % der Klassen und 91 % der Familien richtig (v1.3: 80 % / 88 %). Grußtexte in Sample-Namen („shouts go out to…“) werden nicht mehr als Stimme oder Beat gewertet.

**EN:** AI trained further. On unseen MODs it gets 83 % of classes and 91 % of families right (v1.3: 80 % / 88 %). Greeting texts in sample names (“shouts go out to…”) no longer count as voice or beat hints.

## mod2sid 1.3

**DE:** KI neu trainiert: 80 % Klasse / 88 % Familie bei unbekannten MODs. Neu: Drum-Loops werden in Einzelschläge zerlegt, gleich klingende Schläge teilen sich ein SID-Instrument. Stimmen werden mit ihrem Tonhöhenverlauf nachgebaut statt stummgeschaltet. Lange Streicher und Flächen halten so lange wie das Original. Neue Instrumente „Beat zerlegen (KI)“ und „Stimme mit Tonverlauf (KI)“.

**EN:** AI retrained: 80 % class / 88 % family on unseen MODs. New: drum loops are split into single hits, and similar hits share one SID instrument. Voices are rebuilt with their pitch contour instead of being muted. Long strings and pads ring as long as the original. New instruments “Split beat (AI)” and “Voice with pitch contour (AI)”.

## mod2sid 1.2

**DE:** Neu: Versionen für macOS Apple Silicon + Intel, Windows (Installer + Portable) und Linux (AppImage + deb); kleinere Pakete (nur DE/EN-Sprachdateien, maximale Kompression); KI neu trainiert (79 % Klasse / 89 % Familie); MOD-Dateien per Doppelklick öffnen.

**EN:** New: builds for macOS Apple Silicon + Intel, Windows (installer + portable) and Linux (AppImage + deb); smaller packages; AI retrained (79 % class / 89 % family); open MOD files by double click.

## mod2sid 1.1

**DE:** Neu: Option 1 oder 2 SIDs (6 Stimmen, echte Akkorde, PSID v3 + GoatTracker-Stereo-SNG), 164 SID-Instrumente (+78), KI neu trainiert (73 % Klasse / 86 % Familie).

**EN:** New: 1 or 2 SIDs (6 voices, real chords, PSID v3 + GoatTracker Stereo SNG), 164 SID instruments (+78), AI retrained (73 % class / 86 % family).

## mod2sid – Release

**DE:** Amiga-MOD → C64-SID + GoatTracker-SNG für macOS (Apple Silicon).
KI-Sample-Erkennung (19 Klassen inkl. Sprache), Bibliothek mit über 80 SID-Instrumenten, Arranger für 4→3 Stimmen mit C64-Tricks, Vorhören mit SID-Emulator (6581/8580), A/B mit Original-MOD, Instrumententausch mit Lernfunktion, „Neu konvertieren“ für Varianten, Export als .sid + .sng.

Die App ist nicht notarisiert: beim ersten Start Rechtsklick → Öffnen bzw. `xattr -cr /Applications/mod2sid.app`.

**EN:** Amiga MOD → C64 SID + GoatTracker SNG for macOS (Apple Silicon). AI sample recognition, 80+ SID instruments, 4→3 voice arranger, SID preview, instrument swapping, variants, .sid + .sng export.
Not notarised: right-click → Open on first launch, or run `xattr -cr /Applications/mod2sid.app`.
