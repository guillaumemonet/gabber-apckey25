# Files and recording

← [Live: turntables, scenes, visualizer](live.md) · [Contents](README.md) · [Troubleshooting](troubleshooting.md) →

Saving and opening projects, songs and settings; WAV and stems export; kits.

## Saving and opening

Ravebench saves everything automatically in the browser, and you can also keep your work in **`.ravebench` files** (files saved before the change of name, `.gabber`, still open; to back it up, move it to another computer or share it):
- **Save project** (header): the whole project in one file: timeline, tempo, pads and banks, every tool, mixer, patch, scenes, windows, with your own sounds and recordings inside. **Open…** loads it back (everything is replaced, then the app restarts on it).
- **Song** (the 📁 / 💾 buttons of the timeline toolbar): the timeline alone (tracks, blocks, track effects, length, tempo) with the recordings it uses. Opening a song replaces the timeline (Ctrl+Z brings the previous one back).
- **Settings of a tool**: the 📁 / 💾 buttons in the title bar of the TR-909 (patterns and knobs), TB-303, Synth, Oscillator synth (with your presets), Kick designer, Mixer (with the sidechain and the master section), Patch, Scenes, Generator, Breizh generator, Build-up designer, Voice generator, Pitch correction, Effect designer (your curves), Decks (with their sounds), Launcher, Buses, Visualizer and MIDI (learned controls, devices, clock). In the **Pads** and **Banks** windows, 📁 / 💾 open and save the bank (`.apckit` file, see below).
- Any **Open** button accepts any Ravebench file: it recognises what it contains and loads it where it belongs. Library sounds are referenced by name; imported sounds and recordings are embedded.

## Recording and kits

- **⤓ WAV** (timeline toolbar) exports the song as a WAV file, **rendered in a few seconds** instead of playing it in real time: from bar 1 to the end of the last block, with the synth, pads, mixer, insert effects and sidechain exactly as you hear them (about 3 s for the one-minute demo).
- **⤓ Stems** exports each non-empty track as its own full-length WAV file, all in one ZIP archive, ready to be mixed in another program. Stems come out **without the master chain** (no compressor, no limiter): that is up to the final mix.
- When a WAV export ends, the message gives the file's **integrated loudness** (in LUFS) and its **peak**; they stay on display in the mixer's master chain.
- **● REC** in the header records the master output live, including what you play and the performance effects. Press it again to download a WAV file.
- 💾 (title bar of the **Pads** and **Banks** windows) saves the bank, **Export all** (Banks window) the whole session, in a self-contained `.apckit` file with the sounds and settings. 📁 loads it back: a bank goes into the displayed bank, and a session replaces everything.

Your banks, sounds and settings are saved automatically in the browser.

## MIDI files

- **MIDI** (timeline bar, next to WAV and Stems) exports the **note blocks** to a `.mid` file at the song tempo, to open in any other program: one MIDI track per timeline track (patterns unrolled over the whole block length, transpositions included). Pad hits placed on the timeline go to **channel 10** (notes 36 and up). A MIDI file holds notes, not sounds: audio blocks are not in it.
- **Open…** (header or timeline) also imports a `.mid` file: each track of the file becomes a **note block**, placed at the playhead bar on a track that is free for its length (tracks are added if needed). The blocks play with the keyboard synth; edit them in the piano roll or pick their sound in its menu. The song tempo does not change (the file's tempo is shown).

## Tracker modules (.mod, .xm)

**Open…** also imports modules from Amiga and PC trackers: `.mod` (ProTracker and compatibles, 4 to 32 channels) and `.xm` (FastTracker 2).
- The **samples** of the module go on the pads of the **first empty bank** (from the shown bank), with their names; they also join the library (My Sounds › Imports). A module with more than 40 samples takes several banks in a row.
- Each **channel** of the module becomes a **track** (a free one, from the armed track), with **one note block per pattern played**, in song order, from the playhead bar. A pattern played several times gives blocks with **the same name and colour** ("Pattern 3 · channel 2"): repeats show at a glance. A note held from one pattern to the next goes on in the next block where the sound was, without a new attack.
- The blocks are played by the **sample instrument**: it plays the sound of a pad at the pitch of each note, with its loop (ping-pong loops included).
- The module **tempo** is used if the timeline is empty (4 rows per beat at the starting speed); otherwise the song keeps its own and the notes are moved to keep the same length.
- The song is replayed **tick by tick** like in the tracker, and volume and pitch movements are kept in each note (see compatibility below). Effects that are not played are counted in the message at the end of the import.
- In the **piano roll**, the sound menu of one of these blocks shows **Module samples (pads)**: pick another sound to play it with a synth, come back to it whenever you like. Replacing the sound of a pad also changes the instrument in the blocks that play it.

### Compatibility

| Format | Original programs | Supported |
|---|---|---|
| 4-channel `.mod` (signatures `M.K.`, `M!K!`, `M&K!`, `FLT4`, `4CHN`, `N.T.`) | ProTracker, NoiseTracker, 4-channel StarTrekker | yes |
| 15-sample `.mod`, no signature | Ultimate Soundtracker and early Soundtrackers | yes (recognised by the `.mod` extension) |
| 2 to 32-channel `.mod` (`2CHN` to `9CHN`, `10CH` to `32CH`, `OCTA`, `CD81`) | FastTracker 1 and 2, Octalyser, OctaMED (MOD export) | yes |
| 8-channel `FLT8` `.mod` | 8-channel StarTrekker | not guaranteed: its patterns are stored differently |
| `.xm` | FastTracker 2, MilkyTracker, OpenMPT, Renoise (XM export) | yes, linear and Amiga frequencies |
| `.s3m`, `.it`, `.mptm`, `.med`, `.mtm`, `.669`, `.mo3` | Scream Tracker 3, Impulse Tracker, OpenMPT, OctaMED… | not yet |

**Played faithfully**: speed and tempo (including changes during the song), pattern order and jumps (`Bxx`), pattern breaks (`Dxx`), loops (`E6x`) and pattern delay (`EEx`); volume (`Cxx`, XM volume column), volume slides (`Axy`, `EAx`, `EBx`, volume column), global volume (`Gxx`, `Hxy`); pitch slides (`1xx`, `2xx`, `E1x`, `E2x`, `X1x`, `X2x`), tone portamento (`3xx`, `5xy`), vibrato (`4xy`, `6xy`) and tremolo (`7xy`) with their waveform (`E4x`, `E7x`), arpeggios (`0xy`), finetune (`E5x`); sample offset (`9xx`), note cut (`ECx`), delay (`EDx`), retrigger (`E9x`, `Rxy`), key off (`Kxx`, "===" note); panning (`8xx`, `Pxy`, volume column); 8 and 16-bit samples, forward and ping-pong loops, relative note and finetune; XM instruments with several samples (keymap), **volume envelopes** (sustain, loop) and fadeout after key off.

**Not played** (counted in the message): glissando control (`E3x`), Amiga filter (`E0x`), coarse panning (`E8x`), invert loop (`EFx`), envelope position (`Lxx`), tremor (`Txy`). **Ignored without a message**: panning envelopes and auto-vibrato of XM instruments, panning slides of the volume column.

**Good to know**:
- The song stops where it first loops back (the module restart position is not used); 30 minutes at most.
- One timeline tempo: a speed or tempo change during the song keeps the right length, but the following blocks no longer fall exactly on bars.
- `.mod` channels: placed halfway left and right (left, right, right, left), like most current players, rather than hard left and right as on the Amiga.
- Pads keep their slot: swapping pads in the **Banks** window also changes the sound of the blocks that play them.
- Checked on real modules against a reference player (libopenmpt): same length, same level second by second, very close spectrum.

## Audio input (microphone, sound card)

- The **Audio input** window (plugin bar, System group): **Turn the input on** (the browser asks for permission the first time), choose the **device** (microphone, sound card input), **level** and meter.
- **Record**: choose **Audio input** as the source of an armed track (track panel) or in **Record**, then **REC**. The take becomes an audio block (and a sound in the Recordings section), like the TR-909 or deck takes; it can be recorded at the same time as other tracks.
- **Latency**: when you play along with the song you hear it slightly late, and the input arrives late too. The take is shifted by this latency so it lands in time: **automatic** by default (from what the browser reports), or set by hand if a take is still a little late or early.
- **Monitoring**: sends the input to the speakers (through the mixer's Timeline channel). Keep it off with a microphone near the speakers: feedback.

---

← [Live: turntables, scenes, visualizer](live.md) · [Contents](README.md) · [Troubleshooting](troubleshooting.md) →
