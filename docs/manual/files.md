# Files and recording

← [Live: turntables, scenes, visualizer](live.md) · [Contents](README.md) · [Troubleshooting](troubleshooting.md) →

Saving and opening projects, songs and settings; WAV and stems export; kits.

## Saving and opening

GabberKey saves everything automatically in the browser, and you can also keep your work in **`.gabber` files** (to back it up, move it to another computer or share it):
- **Save project** (header): the whole project in one file: timeline, tempo, pads and banks, every tool, mixer, patch, scenes, windows, with your own sounds and recordings inside. **Open…** loads it back (everything is replaced, then the app restarts on it).
- **Song** (the 📁 / 💾 buttons of the timeline toolbar): the timeline alone (tracks, blocks, track effects, length, tempo) with the recordings it uses. Opening a song replaces the timeline (Ctrl+Z brings the previous one back).
- **Settings of a tool**: the 📁 / 💾 buttons in the title bar of the TR-909 (patterns and knobs), TB-303, Synth, Oscillator synth (with your presets), Kick designer, Mixer (with the sidechain and the master section), Patch, Scenes, Generator, Breizh generator, Build-up designer, Voice generator, Pitch correction, Effect designer (your curves), Decks (with their sounds), Launcher, Buses, Visualizer and MIDI (learned controls, devices, clock). In the **Pads** and **Banks** windows, 📁 / 💾 open and save the bank (`.apckit` file, see below).
- Any **Open** button accepts any GabberKey file: it recognises what it contains and loads it where it belongs. Library sounds are referenced by name; imported sounds and recordings are embedded.

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
- The **samples** of the module go on the pads of the **first empty bank** (from the shown bank), with their names; they also join "My sounds" in the library. A module with more than 40 samples takes several banks in a row.
- Each **channel** of the module becomes a **track** (a free one, from the armed track), with **one note block per pattern played**, in song order, from the playhead bar. A pattern played several times gives blocks with **the same name and colour** ("Pattern 3 · channel 2"): repeats show at a glance. A note held from one pattern to the next goes on in the next block where the sound was, without a new attack.
- The blocks are played by the **sample instrument**: it plays the sound of a pad at the pitch of each note, with its loop (ping-pong loops included).
- The module **tempo** is used if the timeline is empty (4 rows per beat at the starting speed); otherwise the song keeps its own and the notes are moved to keep the same length.
- The song is replayed tick by tick like in the tracker: speed and tempo, pattern order, jumps, pattern breaks and loops, volumes, volume and pitch slides, tone portamento, vibrato, tremolo, arpeggios, sample offset, cut, delayed and retriggered notes, panning, global volume, and the **volume envelopes** of XM instruments. These movements are kept in each note. Rare effects that are not played are counted in the message at the end of the import.
- In the **piano roll**, the sound menu of one of these blocks shows **Module samples (pads)**: pick another sound to play it with a synth, come back to it whenever you like. Replacing the sound of a pad also changes the instrument in the blocks that play it.

## Audio input (microphone, sound card)

- The **Audio input** window (plugin bar, System group): **Turn the input on** (the browser asks for permission the first time), choose the **device** (microphone, sound card input), **level** and meter.
- **Record**: choose **Audio input** as the source of an armed track (track panel) or in **Record**, then **REC**. The take becomes an audio block (and a sound in the Recordings section), like the TR-909 or deck takes; it can be recorded at the same time as other tracks.
- **Latency**: when you play along with the song you hear it slightly late, and the input arrives late too. The take is shifted by this latency so it lands in time: **automatic** by default (from what the browser reports), or set by hand if a take is still a little late or early.
- **Monitoring**: sends the input to the speakers (through the mixer's Timeline channel). Keep it off with a microphone near the speakers: feedback.

---

← [Live: turntables, scenes, visualizer](live.md) · [Contents](README.md) · [Troubleshooting](troubleshooting.md) →
