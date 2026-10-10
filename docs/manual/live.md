# Live: turntables, scenes, visualizer

← [Mixing and effects](mixing.md) · [Contents](README.md) · [Files and recording](files.md) →

The tools for playing live: turntables, scenes, visualizer and plugin windows.

## Turntables

[![Turntables: two decks with scratchable records, EQ, filter and crossfader](../screenshots/decks-en.png)](../screenshots/decks-en.png)

Two decks to mix and scratch any sound: library loops, your recordings, your own audio files.

- **Load**: drag a sound from the library (or an audio file) onto a deck, or click a sound in the library then **Load**.
- **▶ / ❚❚** play / pause. **Cue**: while playing, back to the cue point and pause; when stopped, sets the cue point. Click the waveform to jump.
- **Sync**: the deck follows the global tempo (when the sound's tempo is known: library loops, or guessed for long files), keeps following it when you change the tempo, and starts on the next bar. Without Sync, the **Pitch** slider changes the speed by ±8 %.
- **Scratch**: hold the record with the mouse and move it, forwards or backwards; release it to let it play again. Like on a real turntable, the record follows the **position** of the hand (not its speed), with a little inertia that smooths the mouse out; when you let go, it keeps the hand's momentum and the motor brings it back to speed in a tenth of a second. The sound is read by a dedicated audio processor (4-point interpolation, anti-aliasing when it goes fast): it really plays backwards and follows the hand.
- **Display**: a zoomed waveform that scrolls past the playhead, 4 bars with the beat grid and the bars numbered, bass in orange (to line up the kicks by eye); the whole sound underneath (click to jump); the platter with its strobe dots, the record and its label, and the tone arm.
- **Auto transition** (next to the crossfader): mixes from the deck that plays to the other one, choosing the best way. The incoming deck starts exactly on the next **phrase** of the playing one (8 bars, or 4 if 8 would make you wait too long), phase-aligned. The transition lasts **16 bars** when the incoming sound starts calm (an intro), **8** otherwise, less if the outgoing sound ends before. The incoming deck comes in without bass and slightly filtered, the crossfader moves to the middle, the **basses swap** sharply on the middle bar, then the outgoing deck fades away (high-pass filter, treble down) and stops; its settings go back to neutral. You see the knobs move. Without a known tempo: an 8-second fade. Touching the decks (crossfader, a knob, the record, ▶) takes over; clicking the button again stops it.
- Per deck: **Volume**, **Bass**, **Mid**, **Treble** (all the way left = cut) and a DJ **Filter** (left = low-pass, right = high-pass); a constant-power **crossfader** between A and B.
- On the APC, **Shift + REC** twice opens the turntable knob page (K1-K3 = deck A volume, bass, filter; K4-K6 = deck B; K7 = crossfader; K8 = master). The decks have their own mixer channel (K6 on the mixer pages) and can be recorded into the timeline (source Decks).

## Scenes

[![Scenes window with stored scenes, and the performance effects](../screenshots/scenes-en.png)](../screenshots/scenes-en.png)

40 scenes laid out like the APC grid (1-8 at the bottom). A scene stores:
- the loops that are playing;
- the TR-909 pattern and its muted instruments;
- the mixer levels, pans, sends, mutes and solos;
- the synth preset, the tempo, and whether the transport is playing.

- **Launch**: click a scene. Everything switches **on the next bar**: new loops start, the others stop, patterns change and the mixer follows.
- **Save** the current state: Shift + click, or turn on **Save mode**. Right-click clears a scene.
- **APC**: **Shift + STOP ALL CLIPS** turns the pad grid into the 40 scenes. Pad = launch, Shift + pad = save, Shift + STOP ALL CLIPS again (or a SCENE LAUNCH button) to exit. LEDs: green = stored, red = current, blinking = waiting for the next bar.

## Visualizer

[![Visualizer, 3D landscape mode: a synthwave grid whose relief is the spectrum, under a striped sun](../screenshots/viz3d-en.png)](../screenshots/viz3d-en.png)

A nod to Winamp, in the **Studio** group: music visualizations that follow the master output, made to be projected in **full screen** during a live set.

- **Spectrum**: LED bars from bass to treble (green, yellow, red) with peaks that fall back slowly, and their reflection.
- **Oscilloscope**: the glowing waveform with its trail, and a stereo figure in the corner.
- **Milk**: each image is fed back, zoomed and rotated, under a circle made of the waveform and spinning shapes: swirls and trails that punch on every kick.
- **VU meters**: two hi-fi needle meters (left / right, with peak lights) and an LED bar per mixer channel and for the master.
- **Text slam**: your own words (separated by commas), one per bar, slammed on every kick with colour splits.
- **3D (WebGL)**: a neon **tunnel** that flies by at the tempo, a synthwave **landscape** whose relief is the spectrum of the last two bars, a **blob** (a sphere deformed by the sound), **hyperspace** (stars flying at you, warp jump on every kick), a **3D fractal** (a flight inside an endless Menger sponge) and **lasers** sweeping the smoke above a jumping crowd.
- **Particles** (a sphere of points that bursts on every kick), **Amiga bars** with a sine scroller, **spectrogram**, and more 3D / GPU modes: **spectrum city** (neon towers made of the spectrum history), **LED wall**, **metaballs**, **plasma**, **rotozoomer**, **fluid** and **reaction-diffusion**.
- **Stackable filters** over any mode: **CRT**, **kaleidoscope**, **glitch** and **strobe** (at most 3 flashes per second). Changing mode makes a transition (fade, zoom or slices).
- **Knobs** (on screen, and on the APC while the window is active): speed, hue, flash strength, sensitivity and the amount of each filter.
- **Drop detection**: when the bass comes back after a break, the image explodes (and changes mode in Auto).
- **Projector**: the visuals alone in a **second window**, to drag to the projector screen and put in full screen (double-click) while you keep playing in the main window.
- Colours move on with the tempo and every **kick** makes a flash. **Auto** changes mode every 8 bars. **Full screen** (or F, or a double-click): a click shows the next mode, Esc leaves. Keys 1-9 and 0 choose the mode. Nothing is drawn while the window is closed.

## Plugin windows

The bar under the header opens and closes the plugins, in four groups: **Instruments** (Pads, TR-909, TB-303, Synth, Oscillator synth, Decks), **Tools** (Piano roll, Pad editor, Kick designer, Effect designer, Generator), **Studio** (Mixer, Patch, Scenes, Performance, Visualizer) and **System** (MIDI: keyboards, MIDI learn, monitor). Each one opens in a window above the timeline:
- Each window has a title bar: the **title** on the left, **?** and **✕** on the right.
- The **active window** (in front) is highlighted; windows open and close with a 3D transition.
- **Move** it by its title bar, **resize** it by its bottom-right corner; it **snaps** to the screen edges and to the other windows.
- **?** opens the **help** for the window's content, next to it (**?** again, ✕ or Esc closes it).
- **✕** closes it; the windows you use are remembered with their position.
- The tools whose settings can be saved (TR-909, TB-303, Synth, Oscillator synth, Kick designer, Mixer, Patch, Scenes) also have **📁 / 💾** buttons in their title bar (see Saving and opening).
- The **Reset windows** button (four squares, in the header) puts them back in their default place and size.

---

← [Mixing and effects](mixing.md) · [Contents](README.md) · [Files and recording](files.md) →
