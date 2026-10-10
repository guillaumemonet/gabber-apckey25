# Mixing and effects

← [Generator: chords and melody](generator.md) · [Contents](README.md) · [Live: turntables, scenes, visualizer](live.md) →

Effect designer, mixer and sidechain, patching effect boxes.

## Effect designer

[![Effect designer: starting shapes, the curve editor with its grid, depth and smoothing](../screenshots/curve-en.png)](../screenshots/curve-en.png)

Draw how a setting of a track moves over **1, 2 or 4 beats**: the shape repeats in a loop, locked to the tempo, for as long as its block lasts on the timeline (a sidechain pump made by hand, a trance gate, a filter wobble, a pan swing…).

- **Setting driven**: volume, low-pass filter, high-pass filter, pan, saturation, reverb send or delay send.
- **Editing**: click to add a point and drag it (snapped to the grid: 1/4, 1/8, 1/16, 1/32 and triplets; **Shift** = free), double-click or right-click a point to delete it. The **diamond** between two points bends the line (drag it up or down); double-click it for a **step**: the value holds until the next point.
- **Depth** brings the curve back towards "no effect" (shown dotted), **Smoothing** rounds off the steps so they never click. For the filters, the extreme cutoff and the resonance.
- **Listen** plays a library loop (drums, bass, strings or hoover) through the curve, with a playhead: every change is heard right away.
- **14 starting shapes**: sidechain pump, double pump, trance gate, 3-3-2 gate, stutter 1/32, breath, filter wobble, filter saw, high-pass sweep, ping-pong, pan swing, drive pulse, reverb tail, offbeat echo. Change one, then **Save to the library**: it becomes your curve.
- **On the timeline**: your curves are in the library, **Effects › Curves**. Drag one onto a track like any track effect, or click **On the timeline** (at the playhead, on the selected block's track). The block shows the shape. Changing your curve changes all its blocks at once, even while the song plays; double-click a curve block to open it in the designer.
- Your curves are saved with the project, travel inside song files and are in the WAV export and the stems.

## Mixer

[![Mixer: channels, insert effects and sidechain, with the performance effects](../screenshots/mixer-en.png)](../screenshots/mixer-en.png)

One channel per tool: **Pads**, **Synth**, **TR-909**, **Timeline**, **TB-303**, **Decks** and **Oscillator synth**, then the master (performance effects, master EQ and limiter). The level of each sound stays in its tool (pad volume, 909 instrument levels); the mixer balances the tools.

Each channel has insert effects (**+ FX**, up to 4, applied in order), reverb and delay sends, pan, a fader (0 dB at three quarters), **M**ute, **S**olo and a meter. Available effects:
- **Distortion**: drive and the 5 shapes of the 909.
- **Filter**: low-pass or high-pass, cutoff and resonance.
- **Compressor**: threshold, ratio and gain.
- **Reverb**: size and mix.

Double-click a control to reset it. On the APC, **Shift + track button 1 / 2 / 3 / 4** turns the knobs into the mixer's volumes / pans / delay sends / reverb sends: K1 = Pads, K2 = Synth, K3 = TR-909, K4 = Timeline, K5 = TB-303, K6 = Decks, K7 = Oscillator synth, K8 = master volume. The mixer settings are saved and included in session exports.

### Sidechain

At the top of the mixer window. When it is **On**, every kick ducks the **synth** and the **oscillator synth** (keyboard, note and chord blocks), the **TB-303** and the **melodic sounds** (pads and timeline blocks in the Bass, Leads, Stabs / keys, Pads / strings and Voices categories), which then come back up smoothly: the track breathes with the kick. Kicks and drums are never ducked.

- **Triggered by**:
  - **Kicks**: the TR-909 bass drum, the kick pads and blocks, and the kicks of the GabberKey loops (their exact positions are stored in the library: a gallop, a roll or a build-up ducks on each of its kicks). A recording of the 909 in the timeline keeps the position of its kicks too.
  - **Every beat**: on each beat of the grid, for loops whose kicks are unknown (Sonic Pi loops, your own loops).
- **Depth** (how far the sound goes down) and **Release** (how long it takes to come back up); double-click to reset.
- **Ducks**: choose the synth, the melodic sounds, or both. The meter shows the ducking in real time.
- The ducking is scheduled at the exact time of each kick (on the audio clock), not detected afterwards: no delay, and it stays in time at any tempo.

## Patch

The **Patch** window wires the tools and **effect boxes** freely, like a rack of hardware. By default every tool goes straight to the master: nothing changes until you touch it.

[![Patch window: tools on the left, effect boxes in the middle, the master on the right](../screenshots/patch-en.png)](../screenshots/patch-en.png)

- On the left, one block per **tool**: pads, synth, TR-909, timeline, TB-303, turntables, oscillator synth. Each tool keeps its **mixer channel** (volume, pan, mute, solo, insert effects, sends); the patch decides where that channel goes. On the right, the **Master**.
- **Effect boxes**: **Distortion** (drive, the 909's 5 shapes, tone, mix), **PCF** (rhythmic LP / BP filter restarted by a 16-step pattern, always on the tempo grid), **Filter** (LP, HP or BP with a tempo-synced LFO), **Delay** (in note values: 1/4, 1/8, dotted 1/8, 1/16, quarter-note triplet), **Reverb**, **Compressor**, **Bitcrusher**. Double-click a box for its settings, ✕ removes it.
- **Wire**: drag from an output (right-hand socket) onto a box or the master. An output can feed several destinations, a box can receive several sources, and boxes can be chained. A cable that would create a loop is refused. **Click a cable** to unplug it. A tool that goes nowhere is silent: the mixer shows where each channel goes, under its name.
- **All to master** wires every tool straight to the master again. The fast WAV export and the stems rebuild exactly the same wiring.

---

← [Generator: chords and melody](generator.md) · [Contents](README.md) · [Live: turntables, scenes, visualizer](live.md) →
