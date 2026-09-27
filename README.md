# GabberKey

**A hardcore / gabber groovebox for the Akai APC Key 25, running in your browser.**

*By Guillaume Monet* · [Version française](README.fr.md)

GabberKey turns the Akai APC Key 25 (mk1 or mk2) into a standalone instrument. It has no DAW, no plugin and nothing to install except a web browser:

- **40-pad sampler** with 10 banks, pad LEDs synced to the screen, and drag & drop of your own sounds
- **358 ready-to-play sounds**:
  - four **synthesised hardcore / gabber banks**: distorted Rotterdam and terror kicks, hoovers, rave stabs, screeches, hardcore basses, dramatic strings, oldschool rave pianos, breakbeats, FX and loops at 190 BPM;
  - five banks of **public-domain (CC0)** samples.
- **TR-909 emulation**: the 11 instruments synthesised live, with a per-instrument **distortion (drive + 5 shapes)** on the knobs and a 16-step sequencer (8 patterns) synced with the loops.
- **Mixer**: one channel per source (pads, synth, 909 kick / snare / toms / hats / cymbals) with volume, pan, delay and reverb sends, mute / solo, meters and up to 4 insert effects (distortion, filter, compressor, reverb).
- **Polyphonic synth** on the keyboard with 8 gabber presets: Hoover, Acid 303, Screech, Rave stab, Distorted bass, Horn, Tuned kick…
- **Tempo-synced loops**: every loop starts on the next bar and follows the global tempo (with a Tap button).
- **Performance effects**: beat-repeat rolls (1/4 to 1/32), filter sweeps, tape stop, pump.
- **Master EQ** (5 bands + low-pass / high-pass) on the knobs, opened with the SUSTAIN button.
- **WAV recording** of your session.
- **Kit export / import**: share a bank or a whole session as a single file.
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
| **Shift + track 1 / 2 / 3 / 4** | Mixer knob page: volumes / pans / delay sends / reverb sends (K1-K7 = channels, K8 = master) |
| **Knobs K1-K8** | Parameters of the current page (Shift = fine tuning) |
| **SUSTAIN** | Opens / closes the EQ page (held: EQ while pressed) |
| **Shift + piano key** | Synth preset: C Hoover, D Acid 303, E Screech, F Rave stab, G Dist. bass, A Horn, B Tuned kick, C# Init |
| **Keyboard** | Plays the synth |
| **PLAY** | Start / stop the TR-909 sequencer |
| **Shift + PLAY** | Turn the pad grid into the TR-909 (and back) |
| **REC** | Start / stop recording (downloads a WAV) |
| **STOP ALL CLIPS** | Stops everything |

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
| 10 | **Oldschool** (early 90s rave / hardcore): 909 and 808 kicks, breakbeat kit, M1-style rave pianos (Fm, Db, Eb, Cm, Bbm, Ab), Mentasm and Belgian stabs, "ahh" choir, vox stab, whistle, air-raid siren, Amen-style and chopped breaks, piano riff, rave arp, 4-bar oldschool track, all at 190 BPM |

To load your own sound, drop an audio file (WAV, MP3, FLAC, OGG…) on a pad or on the editor, or use **Load a sound…**. In the editor you can also set the name, the LED colour and the playback mode (**One-shot**, **Hold** or **Loop**).

## TR-909

A Roland TR-909 emulation with its 11 instruments (bass drum, snare, 3 toms, rim shot, clap, closed / open hi-hat, crash, ride). Each one is synthesised live, like the analogue circuits of the original.

**Knobs** (TR-909 page, opened by Shift + PLAY or the "TR-909" tab):

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

## Mixer

Every source goes through its own channel before the master (then the performance effects, master EQ and limiter):

| Channel | Source |
|---|---|
| Pads | the 40-pad sampler |
| Synth | the keyboard synth |
| 909 Kick | bass drum |
| 909 Snare | snare, clap, rim shot |
| 909 Toms | low, mid and high toms |
| 909 Hats | closed and open hi-hats |
| 909 Cymbals | crash and ride |

Each channel has insert effects (**+ FX**, up to 4, applied in order), reverb and delay sends, pan, a fader (0 dB at three quarters), **M**ute, **S**olo and a meter. Available effects:
- **Distortion**: drive and the 5 shapes of the 909.
- **Filter**: low-pass or high-pass, cutoff and resonance.
- **Compressor**: threshold, ratio and gain.
- **Reverb**: size and mix.

Double-click a control to reset it. On the APC, **Shift + track button 1 / 2 / 3 / 4** turns the knobs into the mixer's volumes / pans / delay sends / reverb sends: K1-K7 control the 7 channels and K8 the master volume. The mixer settings are saved and included in session exports.

## Tempo and loops

The global tempo (header, or the **Tap** button) drives every loop. Each loop starts on the next bar and stays in sync when you change the tempo. For your own loops, enter their original tempo in the editor, or click **Auto**: this assumes the file lasts a whole number of bars. Set the tempo to 190 for the Gabber, Hardcore and Oldschool banks: their loops share the same key (F minor) and lengths, so they stay in sync with each other.

## Knob pages

- **Synth**: wave, detune, cutoff, resonance, filter envelope, attack, release, volume
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

- **● REC** (or the REC button on the APC) records the master output. Press it again to download a WAV file.
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
| See what the APC sends | Open **MIDI monitor** at the bottom of the page. |

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
js/mixer.js           mixer: channels, sends, insert effects
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
