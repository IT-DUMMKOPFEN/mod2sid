<p align="center"><img src="build/icon.png" width="160" alt="mod2sid"></p>

# mod2sid

**Amiga-MOD → C64-SID + GoatTracker-SNG** – mit KI-Sample-Erkennung, Instrumenten-Bibliothek, Vorhören und Instrumententausch.
App für **macOS (Apple Silicon)**, Oberfläche Deutsch/Englisch. *Done by IT-DUMMKOPFEN.*

[English below](#english)

---

## Funktionen

- **4-Kanal-MODs einlesen**: ProTracker, NoiseTracker, StarTrekker (M.K., M!K!, FLT4, 4CHN …) und alte 15-Sample-SoundTracker-MODs. Alle ProTracker-Effekte werden tickgenau nachgespielt (Arpeggio, Portamento, Tone-Portamento, Vibrato, Lautstärke, Pattern-Break/-Jump, Loops, Delay …).
- **KI-Erkennung der Samples**: Ein trainierter Klassifizierer (Extra-Trees-Ensemble) erkennt 19 Klassen: Bassdrum, Snare, HiHat, Becken, Tom, Perkussion, Bass, Lead, Fläche, Streicher, Blech, Holzbläser, Gitarre, Tasten, Glocke, Chor, Akkord, Effekt und **Sprache** (Sprache wird nicht umgewandelt). Grundlage sind 31 Klang- und Nutzungsmerkmale: Spektrum, Hüllkurve, Tonhöhe (YIN), Akkord-Chroma und wie das Sample im Song gespielt wird.
- **Instrumente nachbauen**: Bibliothek mit 164 SID-Instrumenten in 16 Kategorien (Bass, Lead, Streicher, Blech, Holz, Gitarre, Tasten, Glocken, Flächen, Chor, Synth, Welt/Ethno, Chiptune, Drums, Effekte). Die Hüllkurve (ADSR) wird an das Original-Sample angepasst, Akkord-Samples werden zu Arpeggios.
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

## Installation (macOS, Apple Silicon)

1. Unter [Releases](https://github.com/IT-DUMMKOPFEN/mod2sid/releases) bzw. in den [Actions-Artefakten](https://github.com/IT-DUMMKOPFEN/mod2sid/actions) die `mod2sid-…-arm64.dmg` laden.
2. DMG öffnen und `mod2sid` in **Programme** ziehen.
3. Die App ist nicht von Apple notarisiert: Beim ersten Start **Rechtsklick → Öffnen**. Meldet macOS „beschädigt“, hilft im Terminal:
   `xattr -cr /Applications/mod2sid.app`

## Selbst bauen

```bash
npm install
npm start              # App starten
npm run dist           # DMG + ZIP für Apple Silicon (auf einem Mac)
node tools/test/selftest.mjs            # Kern-Selbsttest
node tools/test/run_all.mjs <ordner>    # alle MODs eines Ordners testen
```

GitHub Actions (`.github/workflows/build-mac.yml`) baut bei jedem Push auf `main` eine DMG; ein Tag `v*` erstellt ein Release.

## KI-Training

Die Werkzeuge liegen in `tools/train/`:

1. `synth_dataset.py` erzeugt einen synthetischen Datensatz typischer Amiga-Samples (19 Klassen, mit Varianten von Klangfarbe, Hüllkurve, Samplerate und Spielweise).
2. `extract.mjs` berechnet die Merkmale mit **demselben Code wie die App** (`src/core/features.js`) – für die synthetischen Samples und für die von Hand beschrifteten echten Samples aus `labels.json`.
3. `train.py` trainiert das Extra-Trees-Modell, prüft es per *Leave-one-MOD-out* (das geprüfte MOD ist nie im Training) und exportiert `src/core/model.json`.

Stand v1.1: 5 700 synthetische + 184 echte Samples aus 35 Test-MODs (davon 79 regelbasiert und streng beschriftet, `autolabel.mjs`). Treffer bei völlig unbekannten MODs: **73 % exakte Klasse, 86 % richtige Familie** (Drum / Bass / Melodie / Akkord / FX / Sprache). Was die KI falsch einordnet, korrigierst du per Instrumententausch – und die App merkt es sich.

```bash
python3 tools/train/synth_dataset.py /tmp/synth 300
node tools/train/autolabel.mjs <neue-mods> tools/train/labels_auto.json
node tools/train/extract.mjs /tmp/synth <mod-ordner1>,<mod-ordner2> /tmp/features.json
python3 tools/train/train.py /tmp/features.json src/core/model.json
```

## Technik

| Teil | Datei |
|---|---|
| MOD-Parser + ProTracker-Replay | `src/core/mod.js` |
| Merkmale, Tonhöhe, Akkorde | `src/core/features.js` |
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

**mod2sid** converts 4-channel Amiga MODs into **C64 SID music (PSID)** and **GoatTracker 2 songs (.sng)**. It is an Electron app for **macOS on Apple Silicon** with a German/English interface.

- An **AI classifier** (extra-trees, trained on synthetic and hand-labelled real Amiga samples) recognises 19 instrument classes, including speech. Speech is not converted.
- **1 or 2 SIDs**: with 2 SIDs (6 voices, PSID v3, second SID at $D420) every channel gets its own voice and chords become real chords; the SNG is for GoatTracker Stereo.
- **Instrument library** with 164 SID instruments. Envelopes are fitted to the original samples, and chord samples become arpeggios.
- An **arranger for 4 → 3 voices** uses classic C64 tricks: combined bass and drum notes, drum transients overlaid on held notes, arpeggio merging and gap filling.
- **Preview** with a built-in 6502 + SID emulator (6581/8580), A/B comparison with the original MOD, mute/solo for each voice.
- **Swap instruments** to re-convert instantly; the app learns your choices. **Convert again** produces a different variant.
- **Save** writes a `.sid` (own GoatTracker-compatible player at $1000) and a `.sng` (GoatTracker 2).

Installation: download the DMG from Releases/Actions, drag the app to Applications, and open it the first time with right-click → Open. If macOS says the app is damaged, run `xattr -cr /Applications/mod2sid.app`.
