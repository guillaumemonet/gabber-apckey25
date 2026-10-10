# Timeline, library and piano roll

← [Pads and banks](pads.md) · [Contents](README.md) · [Instruments](instruments.md) →

The main screen: tracks, blocks, sound library, track effects, piano roll and demos.

## Timeline and sound library

The main screen: the **sound library** on the left, the **timeline** on the right (16 tracks and 32 bars to start, − / + to change the length and the number of tracks, from 4 to 64, zoom, **Loop**).

- **Library**: two tabs. **Sounds**: pick a category (Kicks, Drums, Bass, Leads, Stabs / keys, Pads / strings, Voices, Sound FX, Guitars, My sounds, Recordings). **Effects**: the track effects, by family (Volume, Filter, Space, Time, Saturation, 3D, and your Curves from the effect designer). Or search by name. **Click** a sound to listen to it (and pick it); the badge shows its length in bars (loops) or "1-shot".
- **Place**: drag a sound onto a track. It snaps to the start of the bar (hold **Shift** to place it on a beat). Clicking an empty cell places the last sound picked.
- **Edit blocks**: drag a block to move it (to another bar or track), drag its **right edge** to lengthen or shorten it (a loop repeats to fill the block), **Alt + drag** copies it, **double-click** listens to it (a note block opens in the **piano roll**), **right-click** or **Delete** removes it.
- **Playback time** (next to Rec): the time elapsed since the start of the song, the bar.beat position, and the length of the song (up to the end of its last block); it follows the playhead, while playing or when you move it.
- **Listen to a block**: the **▶** button that appears on a block when the mouse is over it (or a double-click on a sound block) plays that block on its own, as it sounds in the song: at the tempo, for its whole length, with its track's knobs (but without its track effects); a bar runs along the block, and **■** stops it. It does not disturb the song if it is playing.
- **Name and colour**: double-click a track's name to rename it; its panel (dial button) also has the name and a background colour for the track.
- **Track knobs**: the dial button of each track opens its panel and knobs: **volume**, **pan**, **low-pass** and **high-pass** filters, **delay** and **reverb** sends. They act on everything the track plays, are saved with the song, undone with Ctrl+Z and included in the WAV export and the stems. The button lights up when a knob is no longer at its default value; **Reset** puts them all back.
- **Mute and solo**: **M** mutes the track, **S** solos it (only soloed tracks are heard; several tracks can be soloed). They act at once, even while playing, and the WAV export follows what you hear. A muted track does not trigger the sidechain.
- **Insert effects**: in a track's panel, **Add effect** puts up to 4 **always-on** effects on the whole track: 3-band EQ, compressor, distortion, filter, reverb. They come before the track's knobs; double-click a setting to reset it. **Effect blocks** (below) only act for their length.
- **Select several blocks**: **Ctrl + click** adds a block to the selection (or removes it), **drag in an empty spot** draws a selection box (Shift or Ctrl adds to the selection), **Ctrl+A** selects everything. Drag one of them to move the whole group (Alt = copy it). Track effect blocks are selected the same way.
- **Copy / paste**: **Ctrl+C** / **Ctrl+X**, then **Ctrl+V** pastes at the playhead, on the same tracks (the playhead moves to the end of what was pasted, so pressing again chains copies); **Ctrl+D** duplicates the selection right after itself; **Delete** removes it; **Esc** deselects.
- **Undo / redo**: **↶ / ↷** in the toolbar, or **Ctrl+Z** / **Ctrl+Shift+Z** (or **Ctrl+Y**). Every change to the timeline can be undone (placed, moved, lengthened or deleted blocks, generated pads, recordings, demo loading…), up to 100 steps.
- **Record by playing (live)**: arm one or **several tracks** (●), choose in each track's panel the **instrument it records** (Pads, Synth, Oscillator synth, TR-909, TB-303, Decks, or Auto = the **Record** menu of the toolbar; the track header shows its icon), set the playhead (click the ruler), then **● Rec** (or REC on the APC). Every armed track records its instrument at the same time, and the timeline plays (in a loop if Loop is on, unless an instrument is recorded as audio):
  - **Pads**: every pad hit becomes a block of that pad, where you hit it (snapped to the 16th note). The block replays the pad with its settings.
  - **Synth**: every note appears live and **grows while you hold the key**; when the recording stops, the notes of the take become **one note block** (from bar to bar), which replays with the synth that was played (current synth preset, or the oscillator synth) and opens in the piano roll.
  - Blocks appear live as you play, on the track that records the instrument. If it is taken at that moment, the block goes to the next free track (never to a track armed for another instrument). The notes go to the track of the synth the keyboard is playing. With Loop on, you can add hits on every pass.
  - **TR-909** / **TB-303** / **Decks**: the instrument starts on the timeline's bars and is recorded as audio into a block (also listed in the library under Recordings).
  - **■ Stop rec** (or REC again) ends the recording.
- **Play**: ▶ (or PLAY on the APC) plays from the playhead, and the same button stops; the view follows the playhead. Loops recorded at another tempo follow the global tempo. The timeline has its own channel in the mixer.

### Track effects

[![Timeline with an effects line under each track, the Effects tab of the library and the settings of a PCF](../screenshots/tlfx-en.png)](../screenshots/tlfx-en.png)

Each track has two parts: the **sounds** on top, and a thin **effects line** underneath. Drag an effect from the **Track FX** category of the library onto a track: it acts on **everything the track plays** (audio blocks, synth notes and chords, pad hits) **for the length of the block**, in time with the tempo. Effects add up: a fade in and a PCF at the same time both apply; overlapping effect blocks stack on several lines.

- **Edit** an effect block like a sound block: drag it (Alt = copy), drag its right edge to change its length, right-click or **Delete** to remove it, **double-click** to open its settings.
- **The effects bank** (30 effects, each with its own settings):

| Family | Effects |
|---|---|
| Volume | Fade in, Fade out, Swell, Gate 1/8 and 1/16, Mute |
| Filter | High-pass rise, Low-pass close, Wobble 1/4 and 1/8, **PCF** 1/8, 1/16, offbeat, gallop, 3-3-2, band-pass |
| Space | Reverb throw, Delay throw (the echoes keep going after the block), Auto-pan |
| Time | Stutter 1/8, 1/16, 1/32, Tape stop |
| Saturation | Drive rise, Bitcrush rise |
| 3D | 3D orbit, 3D fly-by, 3D zoom in / out, 3D spiral (binaural: best with headphones) |

- **PCF** is a rhythmic filter: low-pass (LP) or band-pass (BP), whose envelope restarts on each active step of a 16-step **pattern** (1/8, 1/16, 1/4, offbeat, gallop, 3-3-2, roll), with **Frequency**, **Q**, **Amount** and **Decay**.
- Everything is scheduled on the audio clock: effects stay in time, are undone with Ctrl+Z, and are included in the WAV export and the stems.

## Piano roll

[![Piano roll: a hardstyle lead melody over two bars, with its chords, the velocity lane and the toolbar](../screenshots/roll-en.png)](../screenshots/roll-en.png)

Edits the notes of a **note block** of the timeline (synth recordings, generated pads, chords, arpeggios, or a new block).

- **Open a block**: double-click a note block on the timeline (while the window is open, a click is enough), or **+ New block** (1 bar at the playhead, on the armed track). A **synth recording becomes a single note block**, ready to edit.
- **Draw**: click an empty spot to add a note (drag to set its length), drag a note to move it (**Alt** = copy), drag its right edge for its length, **right-click** to erase. **Shift + drag** selects a group.
- **Keys**: Delete, Ctrl+A / C / X / V (paste at the green cursor, set by clicking the ruler), **Ctrl+D** duplicates after itself, ↑ / ↓ transpose (Shift = octave), ← / → move by one grid step (Shift = one bar), **Q** quantizes, **Space** listens, Ctrl+Z undoes.
- **Velocity**: drag in the bottom lane.
- **Grid** from 1/4 to 1/32, with triplets; **Quantize** snaps the start and end of the notes. The rows of the F minor scale (the key of the banks) are tinted.
- **Length** −/+ sets the length of the **pattern**: on the timeline the block repeats it over its whole length (drag its right edge), like a loop. Notes drawn after the end lengthen the pattern.
- **Sound**: each block can have its own synth preset, or play the sound currently on the keyboard. **Merge** gathers the neighbouring note blocks of the track (same sound) into one.
- **Step input**: the notes played on the APC keyboard (or the computer keyboard) go in at the cursor, chords included, and the cursor moves on by one grid step.
- **▶ Listen** loops the pattern alone; while the timeline plays, the playhead is shown in the piano roll too.

## Demo

Click **Demo** in the timeline toolbar and choose a song. Press ▶ to listen, then change it as you like.

![The Demo menu and demo 2 in the timeline: 909 and 303 takes, oscillator synth and layered synth note blocks, track effects under the blocks](../screenshots/demo2-en.png)

- **Demo 1: library loops**: about one minute at 190 BPM in F minor, built from the Gabber, Hardcore and Oldschool banks (intro with strings, gabber build-up with hoovers, first drop, oldschool break with Amen break, piano and choir, hardcore second drop with screech and strings, final kick build-up). Listen: [`demo/gabberkey-demo.ogg`](../../demo/gabberkey-demo.ogg) (rendered by `tools/render_demo.py` from `demo/demo.json`).
- **Demo 2: every tool**: 64 bars of hardcore at 190 BPM in F minor (Fm, Db, Eb, C), made in the app with as many tools as possible, on 15 named and coloured tracks:
  - **TR-909** (Rotterdam kit) and **TB-303** (Rotterdam sound) recorded live: gabber beat, kick roll, kick alone, acid line and squelch line;
  - **oscillator synth**: hoover hook, reese bass on the offbeats, supersaw an octave up, pluck (every melody is a note block you can open in the **piano roll**);
  - **layered synth**: epic strings and rave piano stabs;
  - a kick from the **kick designer** (Terror) on each drop;
  - library sounds: hats, snare builds, risers, crashes, impacts, shouts, screech, siren, choir;
  - **track effects**: filter rise and close, pumping filter, drive rise, wobble, stutter, tape stop, gate, reverb and delay throws, autopan, and the **3D** orbit, spiral, fly-by and zoom;
  - **track knobs**: volume, pan, filters, delay and reverb sends.

  Intro with strings and air-raid siren, build-up (acid line, snare build, "hey!"), first drop, break with piano and a pluck turning around you in 3D, second drop with supersaw, outro. Listen: [`demo/gabberkey-demo-2.ogg`](../../demo/gabberkey-demo-2.ogg). It is a song file ([`demo/gabberkey-demo-2.gabber`](../../demo/gabberkey-demo-2.gabber)): the 909 / 303 takes and the designer kick travel inside it.
- **Demos 3, 4 and 5**, made only with the new **Anthem** library (64 bars at 190 BPM in F minor, about 1:20 each), with track effects, curves from the effect designer and 3D:
  - **Anthem** (epic progression Fm–Db–Eb–Cm): strings intro, pluck build-up rising through a high-pass filter, a first drop with the supersaw anthem lead, bass and pad pumped by sidechain-pump curves, a break with the pluck orbiting in 3D, a kick-roll build-up, and a second drop with the angry beat, supersaw hook, brass and a 3-3-2 gated screech. Listen: [`demo/gabberkey-demo-3.ogg`](../../demo/gabberkey-demo-3.ogg).
  - **Raw** (dark progression Fm–Bbm–Db–C): dark strings intro, a raw beat opening through a high-pass filter, a first drop with the dark lead, rolling bass and pumping pad, a break opened by a long zaag kick with the strings spiralling in 3D, a kick-roll build-up, and a second drop with the angry beat where the screech (filter-wobble curve, 3D fly-by) and ping-pong stabs come in. Listen: [`demo/gabberkey-demo-4.ogg`](../../demo/gabberkey-demo-4.ogg).
  - **Euphoric** (euphoric progression Fm–Db–Ab–Eb): uptempo beat, euphoric lead, trance hooks with an offbeat-echo curve, a swelling and breathing pad, a pluck zooming in 3D, and a melody played with the tuned kicks before the last drop. Listen: [`demo/gabberkey-demo-5.ogg`](../../demo/gabberkey-demo-5.ogg).

---

← [Pads and banks](pads.md) · [Contents](README.md) · [Instruments](instruments.md) →
