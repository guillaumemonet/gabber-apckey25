# GabberKey

**A hardcore / gabber music maker played with an Akai APC Key 25, in your browser.**

*By Guillaume Monet* · [Version française](README.fr.md) · <sub>[☕ Support the project](https://paypal.me/holythunderblade)</sub>

GabberKey is built around a **timeline**: drag sounds from a library sorted by category onto tracks, the blocks snap to the bar and everything plays at the same tempo. The other tools (sampler pads, TR-909, synth, mixer, effects…) are **plugins** that open in windows, and the Akai APC Key 25 (mk1 or mk2) plays them live. Nothing to install except a web browser:

- **Timeline**: 16 tracks in bars; drag, lengthen (loops repeat), copy and move blocks; play the pads or the keyboard while recording and every hit or held note becomes a block, live; record the TR-909 as audio.
- **Sound library**: 358 sounds sorted into Kicks, Drums, Bass, Leads, Stabs / keys, Pads / strings, Voices and FX, plus your own sounds and recordings; click to listen, drag to place.
  - four **synthesised hardcore / gabber banks**: distorted Rotterdam and terror kicks, hoovers, rave stabs, screeches, hardcore basses, dramatic strings, oldschool rave pianos, breakbeats, FX and loops at 190 BPM;
  - five banks of **public-domain (CC0)** samples.
- **Plugins** in movable, magnetic windows:
  - **40-pad sampler** with 10 banks, pad LEDs synced to the screen, and drag & drop of your own sounds;
  - **TR-909 emulation**: the 11 instruments synthesised live, per-instrument **distortion (drive + 5 shapes)**, 16-step sequencer with 8 patterns;
  - **Layered synth** on the keyboard: 35 presets in 10 families (strings, pads, choirs, supersaw, hoovers, leads, basses, stabs, keys, FX) with ensemble, stereo width, vibrato and 8 expression knobs, chord mode and a tempo-synced arpeggiator;
  - **Mixer**: one channel per tool with pan, delay and reverb sends, mute / solo, meters and up to 4 insert effects;
  - **Performance effects** (rolls, filter sweeps, tape stop, pump), **master EQ**, **scenes** recalled on the next bar, **MIDI monitor**.
- **WAV recording** of your session and **kit export / import**.
- Interface in **English or French**, following the browser language.

---

## Requirements

- An **Akai APC Key 25**, mk1 or mk2. It is optional: everything also works with mouse and computer keyboard.
- **Google Chrome**, **Microsoft Edge** or **Firefox** (108 or later). Safari does not support Web MIDI.
- **Python 3**, only to serve the page locally (Web MIDI requires `localhost` or HTTPS).

## Installation

```bash
git clone https://github.com/guillaumemonet/gabber-apckey25.git
cd gabber-apckey25
```

Or download the ZIP from GitHub and unzip it.

## Starting

1. Plug in the APC Key 25.
2. Start the local server:
   - **Windows**: double-click `start.bat`.
   - **macOS / Linux**: run `./start.sh`.
   - **Anywhere**: run `python tools/serve.py`, then open http://localhost:8025.
3. In the browser, click **Start**, then **allow MIDI devices** when the browser asks.

The header shows **APC Key 25 (mk1)** or **APC Key 25 mk2** with a green dot once the controller is detected.

## Controls on the APC

| Control | Action |
|---|---|
| **Pads** | Play the sound (the last pad hit becomes the selected pad) |
| **Shift + pad** | Select a pad without playing it |
| **SCENE LAUNCH 1-5** | Banks 1-5 · **Shift +** SCENE LAUNCH = banks 6-10 |
| **Track buttons 1 / 2 / 3 / 4** | Knob page: Synth / Effects / Selected pad / EQ |
| **Track buttons 5 / 6 / 7 / 8** (hold) | Roll 1/8 · Roll 1/16 · Roll 1/32 · Filter down |
| **Shift + track 5 / 6 / 7 / 8** | Roll 1/4 · Tape stop · Filter up · Pump (on/off) |
| **Shift + track 1 / 2 / 3 / 4** | Mixer knob page: volumes / pans / delay sends / reverb sends (K1 Pads, K2 Synth, K3 TR-909, K4 Timeline, K8 master) |
| **Knobs K1-K8** | Parameters of the current page (Shift = fine tuning) |
| **SUSTAIN** | Opens / closes the EQ page (held: EQ while pressed) |
| **Shift + white key** | Preset of the current synth family (C = 1st, D = 2nd…) · **Shift + C# / D#** = previous / next family · **Shift + F# / G# / A#** = chord type / arpeggio on-off / arpeggio speed |
| **Keyboard** | Plays the synth |
| **PLAY** | Start / stop the timeline (the TR-909 has its own ▶ in its window) |
| **Shift + PLAY** | Turn the pad grid into the TR-909 (and back) |
| **REC** | Record the chosen tool into the armed timeline track (and stop) |
| **STOP ALL CLIPS** | Stops everything |
| **Shift + STOP ALL CLIPS** | Turn the pad grid into the 40 scenes (and back) |

**LEDs**: a loaded pad shows its colour, and a playing pad is fully lit or blinks. The mk1 only has three colours (red, green, yellow), so the colour picker shows those three when an mk1 is connected.

Everything can also be done with the mouse. On the computer keyboard, the middle row plays notes and **Z / X** change the octave.

## Banks

| Bank | Content |
|---|---|
| 1 | Starter kit, synthesised in the browser |
| 2 | Drums |
| 3 | Electro |
| 4 | Loops (22 loops at 120 BPM) |
| 5 | Textures & basses |
| 6 | Tabla & misc. |
| 7 | **Gabber**: 8 kicks (Rotterdam, Early, Terror, Industrial, Frenchcore, Reverse…), percussion, hoovers, stabs, screeches, loops at 190 BPM |
| 8 | **Gabber 2**: kicks tuned from C to G, FX (riser, downlifter, laser, impact…), 16 loops, rave stabs |
| 9 | **Hardcore**: harder kicks (terror, uptempo, speedcore, industrial, mainstream…), distorted basses, string chords (Fm, Db, Eb, Cm, Bbm, Ab), staccato and orchestra hit, string / bass loops (ostinato, progression, offbeat, rolling, reese, 4-bar full track) and hardcore drum loops, all at 190 BPM |
| 10 | **Oldschool** (early 90s rave / hardcore): 909 and 808 kicks, breakbeat kit, rave pianos (Fm, Db, Eb, Cm, Bbm, Ab), Mentasm and Belgian stabs, "ahh" choir, vox stab, whistle, air-raid siren, Amen-style and chopped breaks, piano riff, rave arp, 4-bar oldschool track, all at 190 BPM |

To load your own sound, drop an audio file (WAV, MP3, FLAC, OGG…) on a pad or on the editor, or use **Load a sound…**. The **✎ pencil** on each pad opens the **pad editor** on it: name, LED colour, playback mode (**One-shot**, **Hold** or **Loop**) and the pad's **8 knobs** (volume, pitch, pan, filter, start, delay, reverb, mode), also on the APC knobs.

## TR-909

A Roland TR-909 emulation with its 11 instruments (bass drum, snare, 3 toms, rim shot, clap, closed / open hi-hat, crash, ride). Each one is synthesised live, like the analogue circuits of the original.

**Knobs** (TR-909 page of the Knobs plugin, also opened by Shift + PLAY):

| K1-K4 | K5 | K6 | K7 | K8 |
|---|---|---|---|---|
| Parameters of the selected instrument (e.g. BD: Tune, Attack, Decay, Level) | **Drive**: distortion amount | **Shape**: Soft, Hard, Tube, Fold (wavefolder), Crush (bitcrusher) | Shuffle | 909 volume |

Every instrument has its own distortion. The bass drum starts with a "Tube" drive for the gabber sound. The accent amount is set with the slider on screen.

**Sequencer**: 16 steps, 8 patterns, 4 of them preset (gabber, rave, breakbeat, kick roll). It runs on the same tempo and bar grid as the loops, so it stays in sync with them. A pattern change waits for the next bar. On screen, click a step to cycle note → accent → off, and click an instrument name to play and select it.

**APC grid in 909 mode** (Shift + PLAY):

| Row | Pads |
|---|---|
| 1-2 | The 16 steps of the selected instrument (red = playhead, green = note, yellow = accent) |
| 3 | BD, SD, LT, MT, HT, RS, HC, CH: play and select |
| 4 | OH, CR, RD, then **Accent** (new steps are accented), **Clear** (erases the instrument), **Mute** |
| 5 | Patterns 1-8 |

Pressing a SCENE LAUNCH button brings the grid back to the sampler pads.

## Demo

Click **Demo** in the timeline toolbar to load the demo song: about one minute at 190 BPM in F minor, built from the Gabber, Hardcore and Oldschool banks (intro with strings, gabber build-up with hoovers, first drop, oldschool break with Amen break, piano and choir, hardcore second drop with screech and strings, final kick build-up). Press ▶ to listen, then change it as you like. You can also listen to it directly: [`demo/gabberkey-demo.ogg`](demo/gabberkey-demo.ogg) (rendered by `tools/render_demo.py` from `demo/demo.json`).

## Timeline and sound library

The main screen: the **sound library** on the left, the **timeline** on the right (16 tracks, 32 bars to start, − / + to change the length, zoom, **Loop**).

- **Library**: pick a category (Kicks, Drums, Bass, Leads, Stabs / keys, Pads / strings, Voices, FX, My sounds, Recordings) or search by name. **Click** a sound to listen to it (and pick it); the badge shows its length in bars (loops) or "1-shot".
- **Place**: drag a sound onto a track. It snaps to the start of the bar (hold **Shift** to place it on a beat). Clicking an empty cell places the last sound picked.
- **Edit blocks**: drag a block to move it (to another bar or track), drag its **right edge** to lengthen or shorten it (a loop repeats to fill the block), **Alt + drag** copies it, **double-click** listens to it, **right-click** or **Delete** removes it. Each track has a mute.
- **Record by playing**: choose what to record, arm a track (●), set the playhead (click the ruler), then **● Rec** (or REC on the APC). The timeline plays (in a loop if Loop is on) and:
  - **Pads**: every pad hit becomes a block of that pad, where you hit it (snapped to the 16th note). The block replays the pad with its settings.
  - **Synth**: every note becomes a note block that **grows while you hold the key**; it replays with the current synth preset.
  - Blocks appear live as you play. If the armed track is taken at that moment, the block goes to the next free track. With Loop on, you can add hits on every pass.
  - **TR-909**: the 909 starts on the timeline's bars and is recorded as audio into a block (also listed in the library under Recordings).
  - **■ Stop rec** (or REC again) ends the recording.
- **Play**: ▶ (or PLAY on the APC) plays from the playhead; the view follows the playhead. Loops recorded at another tempo follow the global tempo. The timeline has its own channel in the mixer.

## Scenes

40 scenes laid out like the APC grid (1-8 at the bottom). A scene stores:
- the loops that are playing;
- the TR-909 pattern and its muted instruments;
- the mixer levels, pans, sends, mutes and solos;
- the synth preset, the tempo, and whether the transport is playing.

- **Launch**: click a scene. Everything switches **on the next bar**: new loops start, the others stop, patterns change and the mixer follows.
- **Save** the current state: Shift + click, or turn on **Save mode**. Right-click clears a scene.
- **APC**: **Shift + STOP ALL CLIPS** turns the pad grid into the 40 scenes. Pad = launch, Shift + pad = save, Shift + STOP ALL CLIPS again (or a SCENE LAUNCH button) to exit. LEDs: green = stored, red = current, blinking = waiting for the next bar.

## Mixer

One channel per tool: **Pads**, **Synth**, **TR-909** and **Timeline**, then the master (performance effects, master EQ and limiter). The level of each sound stays in its tool (pad volume, 909 instrument levels); the mixer balances the tools.

Each channel has insert effects (**+ FX**, up to 4, applied in order), reverb and delay sends, pan, a fader (0 dB at three quarters), **M**ute, **S**olo and a meter. Available effects:
- **Distortion**: drive and the 5 shapes of the 909.
- **Filter**: low-pass or high-pass, cutoff and resonance.
- **Compressor**: threshold, ratio and gain.
- **Reverb**: size and mix.

Double-click a control to reset it. On the APC, **Shift + track button 1 / 2 / 3 / 4** turns the knobs into the mixer's volumes / pans / delay sends / reverb sends: K1 = Pads, K2 = Synth, K3 = TR-909, K4 = Timeline, K8 = master volume. The mixer settings are saved and included in session exports.

## Plugin windows

The bar under the header opens and closes the plugins: **Pads**, **Pad editor**, **TR-909**, **Synth** (keyboard and presets), **Knobs**, **Performance**, **Mixer**, **Scenes** and **MIDI monitor**. Each one opens in a window above the timeline:
- **Move** it by its title bar, **resize** it by its bottom-right corner; it **snaps** to the screen edges and to the other windows.
- **✕** closes it; the windows you use are remembered with their position.
- **Reset windows** (header) puts them back in their default place and size.

## Synth

The keyboard plays a layered synth built for hardcore: every preset stacks up to 3 **layers** of oscillators (saw, square, triangle, sine or pulse, each with its own unison, octave and level), with **formants** (string body resonance, "a" / "o" choir vowels), a stereo **ensemble**, unison spread across the stereo field, and a vibrato that comes in after a moment.

**35 presets in 10 families** (Synth window, or **Shift + white key** on the APC = preset of the family, **Shift + C# / D#** = previous / next family):

| Family | Presets |
|---|---|
| Strings | Epic, Dark, Staccato, Vintage, High |
| Pads | Thunderdome, Dark, Warm, Glass, Sweep |
| Choirs | Rave, Ooh, Dark |
| Supersaw | Uplifting, Hardstyle lead, Pad, Stab |
| Hoovers | Hoover, Mentasm |
| Leads | Init, Acid 303, Screech, Horn, Gabber lead |
| Basses | Distorted, Reese, Sub |
| Stabs | Rave, Belgian, Orchestra hit |
| Keys | Rave piano, Organ |
| FX | Tuned kick, Siren, Laser |

**8 expression knobs**, adapted to the family (in the Synth window and on the APC's Synth page):
- strings, pads, choirs, supersaw, stabs, keys: Brightness, Resonance, Attack, Release, **Width**, **Vibrato**, **Ensemble**, Reverb;
- hoovers, leads, basses, FX: Brightness, Resonance, Attack, Release, Drive, **Glide**, Detune, Reverb.

Double-click a knob in the Synth window to go back to the preset's value.

### Chords and arpeggiator

Below the knobs of the Synth window:
- **Chords**: one key plays a whole chord: minor, major, sus2, sus4, minor 7th, fifth or octave. **In key (F minor)** builds the right chord of the scale on each key (F → Fm, G# → Ab, C# → Db, D# → Eb…), so everything stays in tune with the banks.
- **Arpeggio**: the held notes (or the chord) are played one after another, in time with the tempo and on the same grid as the loops. Speed 1/8, 1/16 or 1/32; order up, down, up-down, random or as played; range 1 to 3 octaves; note length; **Hold** keeps the arpeggio going after the keys are released (the next key starts a new one).
- On the APC: **Shift + F#** = next chord type, **Shift + G#** = arpeggio on / off, **Shift + A#** = arpeggio speed.

When the timeline records the synth, chords and every arpeggio note become blocks.

## Tempo and loops

The global tempo (header, or the **Tap** button) drives every loop. Each loop starts on the next bar and stays in sync when you change the tempo. For your own loops, enter their original tempo in the editor, or click **Auto**: this assumes the file lasts a whole number of bars. Set the tempo to 190 for the Gabber, Hardcore and Oldschool banks: their loops share the same key (F minor) and lengths, so they stay in sync with each other.

## Knob pages

- **Synth**: the 8 expression knobs of the current synth family (see Synth)
- **Effects**: delay time / feedback / send, reverb send / size, drive, pads volume, master volume
- **Pad**: volume, pitch, pan, filter, start point, delay and reverb sends, and playback mode of the selected pad
- **EQ**: low 100 Hz, low-mid 350 Hz, mid 1.2 kHz, high-mid 3.5 kHz, high 9 kHz (±15 dB), low-pass, high-pass, output gain

Double-click a knob on screen to reset it.

## Performance effects

- **Rolls** (beat repeat) lock to the grid: the repeat starts on the next 16th note.
- **Filter down / up** sweeps a low-pass or high-pass filter over one bar while you hold.
- **Tape stop** slows everything down to a halt.
- **Pump** ducks the synth on every beat.

## Recording and kits

- **● REC** in the header records the master output. Press it again to download a WAV file.
- **Export bank** / **Export all** creates a self-contained `.apckit` file with the sounds and settings. **Import…** loads it back: a bank goes into the displayed bank, and a session replaces everything.

Your banks, sounds and settings are saved automatically in the browser.

## Language

The interface follows the browser language: French if the browser is set to French, English otherwise. To force a language, add `?lang=en` or `?lang=fr` to the address.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "MIDI access denied" | Click the icon left of the address bar → MIDI devices → Allow, then reload. |
| "Port unavailable" | Another app (Ableton, FL Studio…) is using the APC. On Windows a MIDI port cannot be shared, so close that app and reload. |
| Detected but pads do nothing | Unplug the APC, wait 10 seconds, plug it into another USB port, then reload. Windows' MIDI service can stop delivering input after sleep or hot-plugging. |
| No sound | Click **Start** first: browsers block audio until a click. |
| A new sound bank does not appear | Restart `start.bat` / `start.sh`, then reload. New library banks go to their planned bank if it is empty, otherwise to the first empty bank (a message tells you which). |
| See what the APC sends | Open the **MIDI monitor** plugin. |

## Rebuilding the sound banks (optional)

The `sounds/` folder is already included. To regenerate it, for example at another tempo:

```bash
python -m venv tools/.venv
tools/.venv/Scripts/pip install -r tools/requirements.txt    # Windows
# tools/.venv/bin/pip install -r tools/requirements.txt      # macOS / Linux
tools/.venv/Scripts/python tools/build_banks.py --bpm 128 --gabber-bpm 200
```

The script works in two parts:
- **CC0 samples**: it downloads the Sonic Pi samples, trims silence and normalises levels. For loops, it detects the tempo, time-stretches them to the target tempo without changing pitch (WSOLA) and cuts them to an exact number of bars.
- **Gabber, Hardcore and Oldschool banks**: it synthesises them from scratch (`tools/gabber.py`).

After regenerating, click **Reset** in the app.

## Project structure

```
index.html            page
css/style.css         styles
js/main.js            UI and wiring
js/apc.js             APC Key 25 detection, MIDI input, LEDs (mk1 + mk2)
js/audio.js           audio engine: synth, sampler, effects, EQ, tempo
js/tr909.js           TR-909 emulation and sequencer
js/timeline.js        timeline: tracks, blocks, playback
js/mixer.js           mixer: channels, sends, insert effects
js/library.js         sound library (categories)
js/windows.js         plugin windows
js/presets.js         synth presets
js/params.js          knob parameters
js/i18n.js            English / French translations
js/kit.js             starter kit (synthesised)
js/kits.js            kit export / import
js/recorder*.js       WAV recording
js/storage.js         local saving (IndexedDB)
tools/serve.py        local web server (no cache)
tools/build_banks.py  sound bank builder
tools/gabber.py       gabber sound synthesis
sounds/               generated banks + banks.json
```

## Credits

- Design and development: **Guillaume Monet**
- Banks 2-6: [Sonic Pi](https://github.com/sonic-pi-net/sonic-pi) samples, public domain (CC0). See `sounds/CREDITS.md`.
- Gabber banks and starter kit: synthesised by GabberKey's own code.
- APC Key 25 mk2 MIDI protocol: Akai Professional documentation.

## License

Code released under the [MIT License](LICENSE) © 2026 Guillaume Monet. The Sonic Pi samples in banks 2-6 remain public domain (CC0).
