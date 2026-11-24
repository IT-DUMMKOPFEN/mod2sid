<p align="center"><img src="build/icon.png" width="160" alt="mod2sid"></p>

# mod2sid

**Amiga-MOD → C64-SID + GoatTracker-SNG** – mit KI-Sample-Erkennung, Instrumenten-Bibliothek, Vorhören und Instrumententausch.
App für **macOS (Apple Silicon + Intel), Windows und Linux (AppImage/deb)**, Oberfläche Deutsch/Englisch. *Done by IT-DUMMKOPFEN.*

[English below](#english)

---

## Funktionen

- **4-Kanal-MODs einlesen**: ProTracker, NoiseTracker, StarTrekker (M.K., M!K!, FLT4, 4CHN …) und alte 15-Sample-SoundTracker-MODs. Alle ProTracker-Effekte werden tickgenau nachgespielt (Arpeggio, Portamento, Tone-Portamento, Vibrato, Lautstärke, Pattern-Break/-Jump, Loops, Delay …).
- **KI-Erkennung der Samples**: Ein trainierter Klassifizierer (Extra-Trees-Ensemble) erkennt 20 Klassen: Bassdrum, Snare, HiHat, Becken, Tom, Perkussion, **Drum-Loop**, Bass, Lead, Fläche, Streicher, Blech, Holzbläser, Gitarre, Tasten, Glocke, Chor, Akkord, Effekt und **Stimme**. Grundlage sind 34 Klang- und Nutzungsmerkmale: Spektrum, Hüllkurve, Tonhöhe (YIN), Akkord-Chroma, Anschläge (Onsets) und wie das Sample im Song gespielt wird.
- **Drum-Loops zerlegen**: Ein Sample mit einem ganzen Beat wird in einzelne Schläge zerlegt. Jeder Schlag wird als Bassdrum, Snare, HiHat, Becken, Tom oder Perkussion eingeordnet; gleich klingende Schläge werden zusammengefasst und teilen sich ein SID-Instrument. Der Beat läuft dann zeilengenau mit verschiedenen SID-Drums.
- **Stimmen mit Tonhöhenverlauf**: Bei Stimmen-Samples misst die KI die Tonhöhe alle 20 ms und baut daraus eine Wavetable – ein „Yeah“, das tief beginnt und nach oben gleitet, klingt auch im SID so. Stimmlose Laute werden zu Rauschen, Pausen zu Gate-aus.
- **Lange Streicher und Flächen** behalten ihr langsames Anschwellen und klingen so lange wie das Original-Sample, mit einem Release wie der Ausklang des Samples.
- **Instrumente nachbauen**: Bibliothek mit 166 SID-Instrumenten in 17 Kategorien (Bass, Lead, Streicher, Blech, Holz, Gitarre, Tasten, Glocken, Flächen, Chor, Synth, Drums, KI-Automatik, Welt/Ethno, Chiptune, Effekte). Die Hüllkurve (ADSR) wird an das Original-Sample angepasst, Akkord-Samples werden zu Arpeggios.
- **1 oder 2 SIDs**: Mit 2 SIDs (6 Stimmen, PSID v3, zweiter SID auf $D420) bekommt jeder Kanal eine eigene Stimme. Die beiden freien Stimmen spielen Akkord-Samples als echte Akkorde und übernehmen Drum-Schläge, damit Bass oder Melodie weiterklingen. Die SNG ist dann für **GoatTracker Stereo**.
- **4 Stimmen auf 3 SID-Stimmen** (1-SID-Modus): Der Arranger bewertet für jedes Pattern alle Möglichkeiten und nutzt C64-Tricks:
  - Drum-Anschlag + Bass/Melodie auf einer Stimme (Rausch-Transient vorne, dann die Note)
  - Drum-Transient über einen gehaltenen Ton, ohne ihn neu anzuschlagen
  - zwei Melodiestimmen als Arpeggio
  - Lücken füllen und Melodie nach einem Drum-Schlag fortsetzen
- **Vorhören** mit eingebautem 6502- und SID-Emulator (6581/8580), A/B-Vergleich mit dem Original-MOD, Stimmen stumm/solo, Oszilloskop.
- **Instrumente tauschen**: Die Änderung wird sofort neu berechnet. Die App **lernt** deine Wahl und schlägt sie bei ähnlichen Samples künftig vor.
- **Neu konvertieren**: Jedes Mal entsteht eine andere Variante (Instrumentwahl und Stimmenverteilung); der Kreativitätsregler steuert, wie stark sie sich unterscheidet.
- **Speichern**: `.sid` (PSID v2, eigener GoatTracker-kompatibler Player ab $1000; läuft in VICE, SIDPlay und auf echten C64) **und** `.sng` (GoatTracker 2, GTS5) zum Weiterbearbeiten.

## Installation

Downloads unter [Releases](https://github.com/IT-DUMMKOPFEN/mod2sid/releases) bzw. in den [Actions-Artefakten](https://github.com/IT-DUMMKOPFEN/mod2sid/actions):

| System | Datei |
|---|---|
| macOS Apple Silicon | `mod2sid-…-mac-arm64.dmg` |
| macOS Intel | `mod2sid-…-mac-x64.dmg` |
| Windows 10/11 | `mod2sid-…-win-x64-setup.exe` (Installer) oder `…-portable.exe` |
| Linux | `mod2sid-…-linux-x86_64.AppImage` (ausführbar machen: `chmod +x`) oder `…-linux-amd64.deb` |

Die Programme sind nicht signiert:
- **macOS:** beim ersten Start Rechtsklick → Öffnen, oder `xattr -cr /Applications/mod2sid.app`
- **Windows:** bei der SmartScreen-Warnung „Weitere Informationen“ → „Trotzdem ausführen“

## Selbst bauen

```bash
npm install
npm start              # App starten
npm run dist:mac       # macOS arm64 + x64 (auf einem Mac)
npm run dist:win       # Windows Installer + Portable
npm run dist:linux     # AppImage + deb
node tools/test/selftest.mjs            # Kern-Selbsttest
node tools/test/run_all.mjs <ordner>    # alle MODs eines Ordners testen
```

GitHub Actions (`.github/workflows/build.yml`) baut bei jedem Push auf `main` für macOS (arm64 + x64), Windows und Linux; ein Tag `v*` erstellt ein Release mit allen Dateien.

## KI-Training

Die Werkzeuge liegen in `tools/train/`:

1. `synth_dataset.py` erzeugt einen synthetischen Datensatz typischer Amiga-Samples (20 Klassen inkl. Drum-Loops, mit Varianten von Klangfarbe, Hüllkurve, Samplerate und Spielweise).
2. `extract.mjs` berechnet die Merkmale mit **demselben Code wie die App** (`src/core/features.js`) – für die synthetischen Samples und für die von Hand beschrifteten echten Samples aus `labels.json`.
3. `extract_wav.mjs` liest eine Sample-Bibliothek (WAV). Beschriftet wird nach dem Dateinamen (`wavlabel.mjs`), aber nur, wenn der Klang dazu passt. Die meisten Amiga-WAVs tragen einen falschen 44,1-kHz-Header; sie werden mit typischen MOD-Abspielraten (8–17 kHz) als 8-Bit-Samples ausgewertet.
4. `train.py` trainiert das Extra-Trees-Modell, prüft es per *Leave-one-MOD-out* (das geprüfte MOD ist nie im Training) und exportiert `src/core/model.json`.

Stand v1.3.2: 6 000 synthetische Samples, 5 304 Samples aus der WAV-Bibliothek (10 651 Dateien, davon 5 721 eindeutig benannt, 417 wegen unpassendem Klang verworfen) und 54 126 echte Samples aus 14 306 MODs. Dazu gehören 11 524 MODs von sechs CD-Images (Amiga Mods Anthology 1–4, SoundMOD I/II); diese wurden mit `isox.py` ausgelesen, auf 4-Kanal-MODs gefiltert und gegen den Bestand dedupliziert. Die meisten MOD-Samples sind per `autolabel.mjs` beschriftet: über Namen wie „st-01:bass“, aber nur, wenn Klang und Spielweise dazu passen, plus eindeutige Klangregeln. Hinweise auf Stimme oder Beat zählen nur bei kurzen, label-artigen Namen, nicht bei Grußtexten. Ergebnisse:
- MODs, die nie im Training waren: **85 % exakte Klasse, 92 % richtige Familie** (Drum / Bass / Melodie / Akkord / FX / Stimme / Beat), gemessen mit 10-fach gruppierter Kreuzvalidierung.
- Zurückgehaltene WAV-Samples: **67 % Klasse / 90 % Familie**.

Für große Sammlungen gibt es `labelfeat.mjs`. Es beschriftet die Samples und berechnet die Merkmale in einem Durchgang. Der Lauf kann in Zeitscheiben und parallel auf mehreren Kernen erfolgen und lässt sich jederzeit fortsetzen.

Was die KI falsch einordnet, korrigierst du per Instrumententausch, und die App merkt es sich.

```bash
python3 tools/train/synth_dataset.py /tmp/synth 300
node tools/train/autolabel.mjs <neue-mods> tools/train/labels_auto.json
node tools/train/extract.mjs /tmp/synth <mod-ordner1>,<mod-ordner2> /tmp/features.json
node tools/train/extract_wav.mjs <wav-ordner> /tmp/wav.json
AUG=5 WAVREP=4 NTREES=50 LEAF=4 python3 tools/train/train.py /tmp/features.json src/core/model.json /tmp/wav.json
```

## Technik

| Teil | Datei |
|---|---|
| MOD-Parser + ProTracker-Replay | `src/core/mod.js` |
| Merkmale, Tonhöhe, Akkorde, Onsets | `src/core/features.js` |
| Drum-Loop-Zerlegung, Stimmen-Tonverlauf | `src/core/beat.js` |
| KI-Klassifizierer (Inferenz) | `src/core/classifier.js`, `model.json` |
| Instrumenten-Bibliothek | `src/core/library.js` |
| Arranger 4→3 Stimmen, Effekte | `src/core/arrange.js` |
| GoatTracker-Songmodell + SNG | `src/core/gtsong.js` |
| 6502-Player (GoatTracker-kompatibel) | `src/core/player.js` |
| Assembler / 6502-CPU / SID-Emulation | `src/core/asm6502.js`, `cpu6502.js`, `sid.js` |
| PSID-Erzeugung | `src/core/sidbuild.js` |
| Electron-App | `src/main/`, `src/renderer/` |

**Grenzen:** Der SID hat keine Lautstärke pro Stimme. Lautstärke-Effekte laufen über das Sustain-Level. Die SID nutzt einen eigenen Player mit GoatTracker-2-Semantik. Für die Original-GoatTracker-Routine öffnest du die `.sng` in GoatTracker und packst sie dort.

## Lizenz

GPL-3.0 – siehe [LICENSE](LICENSE). Das SNG-Format stammt von GoatTracker 2 (Lasse Öörni / Cadaver).

---

## English

**mod2sid** converts 4-channel Amiga MODs into **C64 SID music (PSID)** and **GoatTracker 2 songs (.sng)**. It is an Electron app for **macOS (Apple Silicon + Intel), Windows and Linux (AppImage/deb)** with a German/English interface.

- An **AI classifier** (extra-trees, trained on synthetic and hand-labelled real Amiga samples) recognises 20 instrument classes, including drum loops and voices. It was trained on synthetic samples, a library of more than 5 000 Amiga WAV samples and about 54 000 labelled samples from 14 306 MODs. On MODs it never saw it gets 85 % of classes and 92 % of families right.
- **Drum loops** are split into single hits. Similar hits are clustered and share one SID drum, so kick, snare and hi-hat in a loop become different instruments.
- **Voices** follow their pitch contour, measured every 20 ms: a “yeah” that starts low and slides up does the same on the SID.
- **Long strings/pads** keep their swell and ring for the full sample length.
- **1 or 2 SIDs**: with 2 SIDs (6 voices, PSID v3, second SID at $D420) every channel gets its own voice and chords become real chords; the SNG is for GoatTracker Stereo.
- **Instrument library** with 166 SID instruments. Envelopes are fitted to the original samples, and chord samples become arpeggios.
- An **arranger for 4 → 3 voices** uses classic C64 tricks: combined bass and drum notes, drum transients overlaid on held notes, arpeggio merging and gap filling.
- **Preview** with a built-in 6502 + SID emulator (6581/8580), A/B comparison with the original MOD, mute/solo for each voice.
- **Swap instruments** to re-convert instantly; the app learns your choices. **Convert again** produces a different variant.
- **Save** writes a `.sid` (own GoatTracker-compatible player at $1000) and a `.sng` (GoatTracker 2).

Installation: download the DMG from Releases/Actions, drag the app to Applications, and open it the first time with right-click → Open. If macOS says the app is damaged, run `xattr -cr /Applications/mod2sid.app`.
