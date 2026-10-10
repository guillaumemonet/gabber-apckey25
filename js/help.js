// Aide de chaque fenêtre (bouton ? de la barre de titre), en français et en anglais.
import { lang } from './i18n.js';

export const HELP = {
  en: {
    pads: `
      <p>The 40-pad sampler, laid out like the APC grid (pads 1-8 at the bottom).</p>
      <ul>
        <li><b>Click</b> a pad (or hit it on the APC) to play it; <b>Shift + click</b> selects it without playing.</li>
        <li><b>Knobs</b> under the grid: volume, pitch, pan, filter, start point, delay and reverb sends, and mode of the selected pad (also on the APC knobs K1-K8 when this window is active).</li>
        <li><b>✎</b> (shown when the mouse is over a pad) opens the <b>pad editor</b>: name, colour, playback mode, knobs, loop tempo.</li>
        <li><b>Drag a sound from the library</b> onto a pad to replace its sound, or <b>drop an audio file</b> (WAV, MP3, FLAC, OGG…) on it. <b>Clear bank</b> empties the displayed bank.</li>
        <li><b>Start</b>: Free, or pads locked to the grid (1, 2, 3 beats, 1, 2, 4 bars): a pad starts on the next division, a loop pressed again stops at the end of it; it blinks fast while it waits.</li>
        <li>Playback modes: <b>one-shot</b> (plays to the end), <b>hold</b> (as long as the pad is pressed), <b>loop</b> (starts on the next bar, press again to stop).</li>
        <li><b>Banks 1-25</b> (columns on the right). APC: SCENE LAUNCH 1-5 = banks 1-5, Shift + SCENE LAUNCH = 6-10, then 11-15, 16-20 and 21-25 on each new press.</li>
        <li><b>Export bank / Export all / Import…</b>: <code>.apckit</code> files with the sounds and their settings.</li>
      </ul>`,
    editor: `
      <p>Settings of the selected pad.</p>
      <ul>
        <li><b>Name</b> and <b>LED colour</b> (with an mk1, only its 3 colours are offered).</li>
        <li><b>Load a sound…</b>, <b>Play</b>, <b>Clear</b>. You can also drop an audio file here.</li>
        <li><b>Mode</b>: one-shot, hold or loop.</li>
        <li><b>8 knobs</b>: volume, pitch, pan, filter, start point, delay and reverb sends, mode. They are also on the APC knobs (Pad page, track button 3). Double-click = default value.</li>
        <li><b>Loop tempo</b>: original tempo of the sound, so the loop follows the global tempo. <b>Auto</b> guesses it, assuming the file lasts a whole number of bars.</li>
      </ul>`,
    tr: `
      <p>TR-909 emulation: 11 synthesised instruments and a 16-step sequencer in sync with the timeline and the loops.</p>
      <ul>
        <li><b>Click a step</b>: note → accent → off. <b>Click an instrument name</b> to play and select it.</li>
        <li><b>Patterns 1-8</b> (4 presets: gabber, rave, breakbeat, kick roll). A change waits for the next bar.</li>
        <li><b>Sound kits</b> (menu above the grid): the settings of the 11 instruments at once: Hardcore (Gabber, Rotterdam, Terror, Industrial), Classic (Clean 909, House, Techno), FX (Lo-fi crush, Folded). Turning a knob makes the sound custom; type a name, choose a category and <b>Save</b> to keep yours (★), the bin deletes it.</li>
        <li><b>Accent</b>: how much louder the accented steps are.</li>
        <li><b>Knobs</b> (under the grid, also on the APC knobs K1-K8 when this window is active): K1-K4 = parameters of the selected instrument, K5 = <b>drive</b>, K6 = distortion <b>shape</b> (soft, hard, tube, fold, crush), K7 = shuffle, K8 = 909 volume.</li>
        <li><b>APC grid</b> (Shift + PLAY): rows 1-2 = the 16 steps, row 3-4 = instruments, Accent, Clear, Mute, row 5 = patterns. A SCENE LAUNCH button brings the pads back.</li>
        <li>The bass drum also triggers the <b>sidechain</b> (Mixer window).</li>
      </ul>`,
    acid: `
      <p>An acid bass line in the style of the TB-303: oscillator, resonant 24 dB low-pass filter driven by an envelope, accent, slide, and distortion.</p>
      <ul>
        <li><b>Grid</b>: one column per 16th note, one row per note from F to high F. Click a cell to place a note, click it again for a rest. The <b>Oct + / Oct −</b> rows shift a step by an octave; <b>Accent</b> makes it louder and snappier; <b>Slide</b> glides into the next note without retriggering the envelope.</li>
        <li><b>Sound presets</b> (menu above the knobs): 15 ready-made sounds in 4 categories (Acid: classic, squelch, screamer, Rotterdam, hoover; Bass: rubber, sub, dark roller; Lead: saw lead, squeal, gabber lead; FX: laser, siren, crushed, zap). Turn a knob and the sound becomes custom; type a name, choose a category and <b>Save</b> to keep it (★ in the menu), the bin deletes it.</li>
        <li><b>Knobs</b>: tune, cutoff, resonance, envelope amount, decay, accent, <b>slide</b> (glide time between linked notes), drive, distortion shape (the 909's 5 shapes), volume. On the APC: <b>Shift + REC</b> opens the TB-303 knob page (K1-K8). Double-click = default value.</li>
        <li><b>Patterns 1-8</b> (4 ready-made lines in F minor). A change waits for the next bar. <b>Random</b> writes a new line in F minor, <b>Clear</b> empties the pattern.</li>
        <li><b>Follow 909</b>: the 303 plays on the TR-909's clock (shuffle included); ▶ starts both. Turn it off to play the 303 alone.</li>
        <li><b>Step entry</b>: play notes on the APC keyboard (or the computer keyboard); each one goes into the selected step and the cursor moves on. A strong hit adds an accent, <b>Rest</b> leaves a step empty. Click a step number to move the cursor.</li>
        <li>The 303 has its own <b>mixer channel</b> (K5 on the mixer pages), is ducked by the <b>sidechain</b> with the melodic sounds, and can be <b>recorded</b> into the timeline (choose TB-303 as the source).</li>
      </ul>`,
    osc: `
      <p>An analogue-style synth to build your own sounds, played on the APC keyboard.</p>
      <ul>
        <li><b>Keyboard</b>: the APC keyboard (and the computer keyboard) plays the synth of the active window: click this window (or <b>Play on keyboard</b>) to play it, click the Synth window to go back. Chords and arpeggiator work too.</li>
        <li><b>Osc 1-3</b>: wave (saw, pulse, triangle, sine), octave, semitone, fine tune, level, pulse <b>width</b>, <b>unison</b> (up to 7 detuned copies) and their detune. An oscillator at level 0 is off.</li>
        <li><b>Noise, ring, FM, pitch</b>: white noise, ring modulation (osc 1 × osc 2), FM of osc 1 by osc 3 (osc 3 can stay silent), and a pitch envelope (each note starts higher or lower and slides to its pitch: lasers, hoovers).</li>
        <li><b>Filter</b>: low-pass, high-pass or band-pass, 12 or 24 dB, cutoff, resonance, envelope amount (negative = closes), key tracking, drive before the filter.</li>
        <li><b>Envelopes</b>: ADSR of the filter and of the volume, drawn above their knobs.</li>
        <li><b>LFO</b>: sine, triangle, saw or square, in sync with the tempo (1/1 to 1/32, triplets), on the pitch, the filter, the pulse width or the volume.</li>
        <li><b>Voice</b>: poly (8 notes), mono or legato (no new attack between linked notes), glide, stereo width of the unison, volume.</li>
        <li><b>Presets</b>: 12 ready-made sounds (hoover, FM screech, reese, gabber lead, acid bass, sub, supersaw, pluck, brass stab, pad, wobble, laser), as buttons and in a menu by category (Lead, Bass, Pad, FX). Turning a knob makes the sound custom; type a name, choose a category and <b>Save</b> to keep yours (★), the bin deletes it.</li>
        <li><b>APC knobs</b>: the knobs marked K1-K8 (cutoff, resonance, filter envelope, filter decay, drive, LFO depth, release, volume) follow the APC knobs while this window is active.</li>
        <li>It has its own <b>mixer channel</b> (K7 on the mixer pages), can be wired in the <b>Patch</b> window, and is ducked by the <b>sidechain</b> like the synth. Recordings of it become note blocks with its sound; in the <b>piano roll</b>, any note block can use one of its presets.</li>
      </ul>`,
    viz: `
      <p>A nod to Winamp: music visualizations that follow the master output. They look their best in full screen, projected during a live set.</p>
      <ul>
        <li><b>Spectrum</b>: LED bars from the bass (left) to the treble, with peaks that fall back slowly, and their reflection.</li>
        <li><b>Oscilloscope</b>: the waveform with a glowing trail, and a stereo figure (Lissajous) in the corner.</li>
        <li><b>Milk</b>: each image is fed back, zoomed and rotated, under a circle made of the waveform and spinning shapes: swirls and trails, the whole thing punching on every kick.</li>
        <li><b>VU meters</b>: two hi-fi needle meters (left / right, with a peak light) and an LED bar per mixer channel and for the master.</li>
        <li><b>3D (WebGL)</b>: <b>3D tunnel</b> (neon rings that fly by at the tempo, rays lit by the spectrum), <b>3D landscape</b> (you fly over a synthwave grid whose relief is the spectrum of the last two bars, bass in the middle, under a striped sun that pulses on the kicks) and <b>3D blob</b> (a sphere deformed by the bass, the mids and the spectrum, with neon lighting).</li>
        <li><b>Text slam</b>: the words you type (separated by commas), one per bar, slammed on every kick with colour splits.</li>
        <li><b>Hyperspace</b> (stars that fly at you, with a warp jump on every kick), <b>3D fractal</b> (a flight inside an endless Menger sponge that folds with the music) and <b>Lasers</b> (beams sweeping the smoke above a jumping crowd).</li>
        <li><b>Particles</b> (a sphere of points that bursts on every kick), <b>Amiga bars</b> (copper bars and a sine scroller with your words) and <b>Spectrogram</b> (the sound scrolling as a waterfall of colours).</li>
        <li>More 3D / GPU modes: <b>Spectrum city</b> (the spectrum history as neon towers coming at you), <b>LED wall</b> (a stage screen whose pattern changes every bar), <b>Metaballs</b>, <b>Plasma</b>, <b>Rotozoomer</b>, <b>Fluid</b> (ink stirred by the sound, a splash on every kick) and <b>Reaction-diffusion</b> (organic patterns that grow by themselves).</li>
        <li><b>Filters</b>, stackable over any mode: <b>CRT</b> (scan lines, curved glass, colour fringes), <b>Kaleido</b> (6 to 12 branches), <b>Glitch</b> and <b>Strobe</b> (white flashes on the kicks, at most 3 per second; caution with flashing lights). Changing mode makes a transition (fade, zoom or slices).</li>
        <li><b>Knobs</b> under the image, also on the APC knobs while the window is active (page Visualizer): speed, hue, flash strength, sensitivity, then the amount of each filter.</li>
        <li><b>Drop</b>: when the bass comes back after a break of more than 2 bars, the image explodes (and changes mode in Auto).</li>
        <li><b>Projector</b>: opens the visuals alone in a second window. Drag it to the projector screen and double-click it for full screen; you keep playing in the main window. Keys 1-9 / ← / → also work in it.</li>
        <li>The colours move on with the tempo (one step per beat) and every <b>kick</b> (909, pads, blocks, loops) makes a flash.</li>
        <li><b>Auto</b> changes mode every 8 bars. <b>Full screen</b> (or F, or a double-click): a click shows the next mode, Esc leaves.</li>
        <li>Keys while the window is active: 1-9 and 0 = mode, ← / → = previous / next, F = full screen. Nothing is drawn while the window is closed.</li>
      </ul>`,
    roll: `
      <p>Edit the notes of a note block of the timeline: pitch, start, length and velocity.</p>
      <ul>
        <li><b>Open a block</b>: double-click a note block on the timeline (while this window is open, a click is enough), or <b>+ New block</b> (1 bar at the playhead, on the armed track). A synth recording becomes a single note block.</li>
        <li><b>Notes</b>: click an empty spot to add a note (drag to set its length), drag a note to move it (<b>Alt</b> = copy), drag its right edge to change its length, <b>right-click</b> (or right-drag) to erase. <b>Shift + drag</b> selects a group, Shift + click adds a note to the selection.</li>
        <li><b>Keys</b>: Delete, Ctrl+A / C / X / V (paste at the green cursor, set by clicking the ruler), Ctrl+D (duplicate after itself), ↑ / ↓ transpose (Shift = octave), ← / → move by one grid step (Shift = one bar), Q quantize, Space = listen, Ctrl+Z = undo.</li>
        <li><b>Velocity</b>: drag in the bottom lane (only the selected notes if there is a selection).</li>
        <li><b>Grid</b> from 1/4 to 1/32 (and triplets); <b>Quantize</b> snaps the start and end of the notes. Rows of the F minor scale (the key of the banks) are tinted.</li>
        <li><b>Length</b> −/+: length of the pattern. The block repeats it over its whole length on the timeline (drag its right edge there). Notes drawn after the end lengthen the pattern.</li>
        <li><b>Sound</b>: a synth preset of its own, or the sound currently played on the keyboard. <b>Merge</b> gathers the neighbouring note blocks of the track (same sound) into this one.</li>
        <li><b>Step input</b>: the notes you play on the APC keyboard (or the computer keyboard) go in at the cursor (chords too), which moves on by one grid step.</li>
      </ul>`,
    curve: `
      <p>Draw how a setting of a track moves over 1, 2 or 4 beats: the shape repeats in a loop, locked to the tempo, for as long as its block lasts on the timeline.</p>
      <ul>
        <li><b>Setting</b>: volume (sidechain pump, gate, stutter made by hand), low-pass or high-pass filter, pan, saturation, reverb send or delay send.</li>
        <li><b>Editing</b>: click to add a point, drag it (snapped to the grid: 1/4 to 1/32 and triplets, <b>Shift</b> = free), double-click or right-click to delete it. The diamond between two points bends the line (drag it up or down); double-click it for a step: the value holds until the next point.</li>
        <li><b>Depth</b> brings the curve back towards "no effect" (dotted line), <b>Smoothing</b> rounds off the steps (no clicks). For the filters: the extreme cutoff and the resonance.</li>
        <li><b>Listen</b> plays a library loop (drums, bass, strings or hoover) through the curve; every change is heard right away.</li>
        <li><b>Starting shapes</b>: sidechain pumps, trance gate, 3-3-2 gate, stutter, breath, wobble, filter saw, high-pass sweep, ping-pong, pan swing, drive pulse, reverb tail, offbeat echo. Change one, then <b>Save to the library</b>: it becomes your curve (★).</li>
        <li><b>Your curves</b> are in the library, <b>Effects › Curves</b>: drag one onto a track like any track effect, or click <b>On the timeline</b>. Changing your curve changes all its blocks at once, even while the song plays. Double-click a curve block to open it here.</li>
        <li>Your curves are saved with the project, travel in song files and are in the WAV export.</li>
      </ul>`,
    kick: `
      <p>Build your own gabber / hardcore kick, computed in a few milliseconds, then use it anywhere.</p>
      <ul>
        <li><b>Presets</b>: Rotterdam, Mainstream, Uptempo, Raw, Terror, Industrial, Early, Frenchcore. Start from one, then shape it. The menu under the buttons sorts them by category (Gabber, Hardcore, Mainstream / uptempo) with your own kicks. Turning a knob makes the sound custom; type a name, choose a category and <b>Save</b> to keep yours (★), the bin deletes it.</li>
        <li><b>Tail</b>: <b>Tune</b> (note of the tail, F = the key of the banks), <b>Punch</b> and <b>Sweep</b> (how high the pitch starts and how fast it drops), <b>Tail drop</b> (how far it keeps falling), <b>Length</b>, <b>Zaag</b> (sawtooth for a raw, buzzing tail).</li>
        <li><b>Distortion</b>: <b>Drive</b> and <b>Shape</b> (the 909's 5 shapes), then <b>Formant</b> and <b>Bite</b>, which make the tail "talk".</li>
        <li><b>Attack</b>: <b>Click</b> (noise) and <b>Attack</b> (short punchy layer).</li>
        <li><b>Auto-listen</b> plays the kick each time you release a knob. The waveform and the length are shown below the knobs.</li>
        <li><b>→ Pad</b> puts it on the selected pad, <b>→ Library</b> adds it to the Kicks category of the library (drag it onto the timeline; right-click it there to remove it), <b>⤓ WAV</b> downloads it.</li>
      </ul>`,
    decks: `
      <p>Two turntables to mix and scratch any sound: library loops, your recordings, your own files.</p>
      <ul>
        <li><b>Load</b>: drag a sound from the library (or an audio file) onto a deck, or click a sound in the library then <b>Load</b>.</li>
        <li><b>▶ / ❚❚</b> play / pause. <b>Cue</b>: while playing, back to the cue point and pause; when stopped, sets the cue point. Click the waveform to jump.</li>
        <li><b>Sync</b>: the deck follows the global tempo (when the sound's tempo is known: library loops, or guessed for long files) and starts on the next bar. Without Sync, the <b>Pitch</b> slider changes the speed by ±8 % (double-click = 0).</li>
        <li><b>Scratch</b>: hold the record with the mouse and move it, forwards or backwards; release it to let it play again. The record follows the position of your hand, like a real one.</li>
        <li><b>Auto transition</b>: from the deck that plays to the other one: it starts on the next phrase, in phase, comes in without bass, the basses swap on the middle bar, then the old sound leaves through a high-pass filter and stops (16 bars after a calm intro, 8 otherwise). Touch the decks to take over.</li>
        <li><b>Volume, Bass, Mid, Treble</b> (all the way left = cut) and <b>Filter</b> (left = low-pass, right = high-pass) per deck, and the <b>crossfader</b> between A and B.</li>
        <li>On the APC: <b>Shift + REC</b> twice opens the turntable knob page (A volume, A bass, A filter, B volume, B bass, B filter, crossfader, master). The decks have their own mixer channel (K6) and can be recorded into the timeline (source Decks).</li>
      </ul>`,
    patch: `
      <p>Wire the tools and effect boxes freely. By default every tool goes straight to the master: nothing changes until you touch it.</p>
      <ul>
        <li>On the left, one block per <b>tool</b> (its mixer channel: pads, synth, TR-909, timeline, TB-303, turntables). On the right, the <b>Master</b>.</li>
        <li><b>+ Distortion, + PCF, + Filter, + Delay, + Reverb, + Compressor, + Bitcrusher</b> add an <b>effect box</b>. Double-click a box to open its settings; ✕ removes it.</li>
        <li><b>Wire</b>: drag from an output (right-hand socket) to a box or to the master. An output can feed several destinations, and a box can receive several sources (they are mixed). A cable that would create a loop is refused.</li>
        <li><b>Unplug</b>: click a cable. A tool that goes nowhere is silent (the mixer shows it in red under its name).</li>
        <li>The <b>PCF</b> box follows the tempo grid all the time, the <b>Delay</b> and the <b>Filter</b> LFO are set in note values: everything stays in sync. The WAV export rebuilds exactly the same wiring.</li>
        <li><b>All to master</b> wires every tool straight to the master again.</li>
      </ul>`,
    piano: `
      <p>The keyboard synth: 35 presets in 10 families, 8 expression knobs, chord mode and arpeggiator.</p>
      <ul>
        <li><b>Families and presets</b>: click, or on the APC <b>Shift + white key</b> = preset of the family, <b>Shift + C# / D#</b> = previous / next family.</li>
        <li><b>8 knobs</b> adapted to the family (brightness, resonance, attack, release, width, vibrato, ensemble or drive, glide, detune, reverb). Double-click = back to the preset's value.</li>
        <li><b>Your presets</b> (menu under the presets, by family): a preset of yours keeps its starting sound and your 8 knobs. Turning a knob makes the sound custom; type a name, choose a category and <b>Save</b> to keep yours (★), the bin deletes it.</li>
        <li><b>Chords</b>: one key plays a whole chord; <b>In key (F minor)</b> builds the right chord of the scale on each key. APC: Shift + F#.</li>
        <li><b>Arpeggio</b>: the held notes are played one after another in time with the tempo (1/8, 1/16, 1/32; order; 1-3 octaves; note length; <b>Hold</b>). APC: Shift + G# = on / off, Shift + A# = speed.</li>
        <li>Computer keyboard: middle row (A S D F… on QWERTY), Z / X = octave.</li>
      </ul>`,
    gen: `
      <p>From a chord progression, lays on the timeline chord blocks (strings, pads, choirs…) or a melody that follows the chords.</p>
      <ul>
        <li><b>Progression</b>: type the chords separated by spaces or dashes (<code>Fm Db Eb Cm</code>), or click a ready-made one. Recognised: major, minor (<code>m</code>), <code>7</code>, <code>m7</code>, <code>maj7</code>, <code>sus2</code>, <code>sus4</code>, <code>dim</code>, <code>aug</code>, <code>5</code>, <code>add9</code>. <b>Bars per chord</b> and <b>Repeat</b> apply to both tabs.</li>
        <li><b>Chords</b>: sound (strings, pads, choirs, supersaw, stabs, keys or the current synth preset), register, rhythm (held, every beat, offbeat, 8th notes) and bass (sub, hardcore offbeat, reese) on a second track. One block per chord, each with its own preset.</li>
        <li><b>Melody (lead)</b>: a lead that follows the chords. <b>Style</b>: Anthem (a hook replayed on each chord, strong beats on the chord notes), Arpeggio, Hardcore riff (short notes, octaves and fifths), Call and response (a phrase that rises, an answer that falls). <b>Density</b>, <b>register</b> and <b>octave doubling</b>.</li>
        <li><b>New idea</b> draws another melody and plays it; <b>Listen</b> plays exactly what <b>Generate</b> will lay down (click again to stop).</li>
        <li>The melody is a single note block, repeated over the whole length: double-click it to edit it in the piano roll.</li>
        <li><b>Notes</b>: the piano roll under the settings shows the draft of the tab (one pass of the progression); edit it before laying it. Once edited by hand, the settings no longer change it: <b>Recompute</b> starts again from the settings. Listen and Generate use the draft as shown.</li>
        <li>Blocks are laid from the playhead bar, on the first track that is free for the whole length, starting from the armed track; the song gets longer if needed.</li>
      </ul>`,
    buses: `
      <p>Four buses (A to D) group tracks of the timeline so you can process them together: all the drums through one compressor, all the leads through one reverb…</p>
      <ul>
        <li><b>Send a track to a bus</b>: in the track's panel (dial button in its header), choose <b>Bus</b>. The bus letter then shows in the track header; the bus lists its tracks.</li>
        <li><b>Insert effects</b> (up to 4: EQ, compressor, distortion, filter, reverb), <b>pan</b> and <b>volume</b> act on the whole group; double-click a setting to reset it.</li>
        <li><b>M</b> mutes every track of the bus, <b>S</b> solos the bus (with the soloed tracks).</li>
        <li>A bus keeps sending each sound where it went before (synth, pads, sidechain…): putting a track in a bus does not change its level.</li>
        <li>Buses are saved with the project and in song files, and the WAV export goes through them.</li>
      </ul>`,
    knobs: `
      <p>The 8 on-screen knobs follow the APC knobs K1-K8, page by page.</p>
      <ul>
        <li><b>Synth</b>: the 8 expression knobs of the current synth family.</li>
        <li><b>Effects</b>: delay time, feedback and send, reverb send and size, synth volume, pad volume, master volume.</li>
        <li><b>Pad</b>: the knobs of the selected pad.</li>
        <li><b>EQ</b>: 5 bands (±15 dB), low-pass, high-pass, output gain. SUSTAIN on the APC opens it (held = only while pressed).</li>
        <li><b>TR-909</b> and <b>mixer</b> pages (Shift + track 1-4 on the APC).</li>
        <li>APC: track buttons 1-4 = Synth / Effects / Pad / EQ. <b>Shift + knob</b> = fine tuning; double-click on screen = default value.</li>
      </ul>`,
    perf: `
      <p>Live effects on the whole mix, in time with the grid. Hold to use them (Pump is on / off).</p>
      <ul>
        <li><b>Rolls</b> 1/4, 1/8, 1/16, 1/32: repeat the sound, starting on the next 16th note.</li>
        <li><b>Filter ↓ / ↑</b>: low-pass or high-pass sweep over one bar.</li>
        <li><b>Tape stop</b>: slows everything down to a stop.</li>
        <li><b>Pump</b>: the synth fades out on every beat (for a real sidechain triggered by the kicks, see the Mixer window).</li>
        <li>APC: track buttons 5-8 (held), Shift + 5-8 for the second row.</li>
      </ul>`,
    mix: `
      <p>One channel per tool (Pads, Synth, TR-909, Timeline), then the master.</p>
      <ul>
        <li>Each channel: insert effects (<b>+ FX</b>, up to 4: distortion, filter, compressor, reverb), reverb and delay sends, pan, fader, <b>M</b>ute, <b>S</b>olo, meter. Double-click = reset.</li>
        <li><b>Sidechain</b> (top): every kick ducks the synth and the melodic sounds (bass, pads, leads, keys, voices), which come back up smoothly. Triggered by <b>the kicks</b> (909, kick pads and blocks, kicks of the GabberKey loops) or on <b>every beat</b> (for other loops). Depth, release, targets; the meter shows the ducking.</li>
        <li><b>Master</b> (bottom): master EQ (5 bands, low-pass, high-pass, gain) and global effects and volumes (delay time and feedback, reverb size, sends and volumes of the synth and pads, master volume).</li>
        <li>APC: Shift + track 1 / 2 / 3 / 4 = volumes / pans / delay / reverb (K1 Pads, K2 Synth, K3 TR-909, K4 Timeline, K5 TB-303, K6 Decks, K8 master).</li>
      </ul>`,
    scenes: `
      <p>40 snapshots of the session, laid out like the APC grid.</p>
      <ul>
        <li>A scene stores the playing loops, the 909 pattern and mutes, the mixer, the synth preset, the tempo and the transport.</li>
        <li><b>Click</b> = launch on the next bar. <b>Shift + click</b> (or <b>Save mode</b>) = store the current state. <b>Right-click</b> = clear.</li>
        <li>APC: <b>Shift + STOP ALL CLIPS</b> turns the pads into scenes (pad = launch, Shift + pad = save). LEDs: green = stored, red = current, blinking = waiting for the next bar.</li>
      </ul>`,
    monitor: `
      <p>Other MIDI keyboards and controllers, MIDI learn, and every MIDI message received (to check a connection).</p>
      <ul>
        <li><b>Any MIDI keyboard</b> (plugged in by USB, no driver needed for most of them) plays the synth of the active window, like the APC keyboard, and is recorded on the timeline; its sustain pedal holds the notes.</li>
        <li><b>MIDI learn</b>: click <b>Learn</b> next to a target, then move a knob or fader, or press a button on the device. Targets: knobs K1-K8 of the active page (like the APC knobs), mixer faders, master volume, bus volumes, play / stop, record, loop. The bin removes an assignment. A key assigned to a button no longer plays a note. Assignments are saved with the project.</li>
        <li><b>MIDI clock</b>: <b>Send to</b> a device (24 pulses per beat, Start / Stop, position: it follows the timeline), or <b>Follow</b> a device (its tempo, Start and Stop).</li>
        <li>The ports in use are shown at the top. If the pads and the keyboard are swapped, use the swap button.</li>
        <li>Nothing arrives? Unplug and plug the APC back in, then reload the page (Windows can freeze its MIDI driver).</li>
      </ul>`,
  },
  fr: {
    pads: `
      <p>Le sampler de 40 pads, disposé comme la grille de l'APC (pads 1 à 8 en bas).</p>
      <ul>
        <li><b>Clic</b> sur un pad (ou frappe sur l'APC) pour le jouer ; <b>Maj + clic</b> le sélectionne sans le jouer.</li>
        <li><b>Potentiomètres</b> sous la grille : volume, hauteur, panoramique, filtre, point de départ, envois delay et reverb, et mode du pad sélectionné (aussi sur les potentiomètres K1-K8 de l'APC quand cette fenêtre est active).</li>
        <li><b>✎</b> (visible au survol d'un pad) ouvre l'<b>éditeur de pad</b> : nom, couleur, mode de lecture, potentiomètres, tempo de boucle.</li>
        <li><b>Glissez un son de la bibliothèque</b> sur un pad pour remplacer son son, ou <b>un fichier audio</b> (WAV, MP3, FLAC, OGG…). <b>Vider la banque</b> vide la banque affichée.</li>
        <li><b>Départ</b> : Libre, ou pads calés sur la grille (1, 2, 3 temps, 1, 2, 4 mesures) : un pad part à la division suivante, une boucle rappuyée s'arrête à la fin de celle-ci ; il clignote vite pendant l'attente.</li>
        <li>Modes : <b>one-shot</b> (joue jusqu'au bout), <b>maintenu</b> (tant que le pad est appuyé), <b>boucle</b> (démarre à la mesure suivante, un nouvel appui l'arrête).</li>
        <li><b>Banques 1 à 25</b> (colonnes de droite). APC : SCENE LAUNCH 1-5 = banques 1-5, Maj + SCENE LAUNCH = 6-10, puis 11-15, 16-20 et 21-25 à chaque nouvel appui.</li>
        <li><b>Exporter la banque / Exporter tout / Importer…</b> : fichiers <code>.apckit</code> avec les sons et leurs réglages.</li>
      </ul>`,
    editor: `
      <p>Les réglages du pad sélectionné.</p>
      <ul>
        <li><b>Nom</b> et <b>couleur de la LED</b> (avec un mk1, seules ses 3 couleurs sont proposées).</li>
        <li><b>Charger un son…</b>, <b>Jouer</b>, <b>Vider</b>. Vous pouvez aussi glisser un fichier audio ici.</li>
        <li><b>Mode</b> : one-shot, maintenu ou boucle.</li>
        <li><b>8 potentiomètres</b> : volume, hauteur, panoramique, filtre, point de départ, envois delay et reverb, mode. Ils sont aussi sur les potentiomètres de l'APC (page Pad, bouton de piste 3). Double-clic = valeur par défaut.</li>
        <li><b>Tempo de la boucle</b> : tempo d'origine du son, pour que la boucle suive le tempo global. <b>Auto</b> le devine, en supposant que le fichier dure un nombre entier de mesures.</li>
      </ul>`,
    tr: `
      <p>Émulation de la TR-909 : 11 instruments synthétisés et un séquenceur de 16 pas calé sur la timeline et les boucles.</p>
      <ul>
        <li><b>Clic sur un pas</b> : note → accent → silence. <b>Clic sur le nom d'un instrument</b> pour le jouer et le choisir.</li>
        <li><b>Patterns 1 à 8</b> (4 préréglés : gabber, rave, breakbeat, roulement de kick). Un changement attend la mesure suivante.</li>
        <li><b>Kits de son</b> (menu au-dessus de la grille) : les réglages des 11 instruments d'un coup : Hardcore (Gabber, Rotterdam, Terror, Industriel), Classique (909 propre, House, Techno), FX (Lo-fi écrasé, Replié). Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et <b>Enregistrer</b> pour garder le vôtre (★), la corbeille le supprime.</li>
        <li><b>Accent</b> : de combien les pas accentués sont plus forts.</li>
        <li><b>Potentiomètres</b> (sous la grille, aussi sur les potentiomètres K1-K8 de l'APC quand cette fenêtre est active) : K1-K4 = paramètres de l'instrument choisi, K5 = <b>drive</b>, K6 = <b>forme</b> de distorsion (douce, dure, lampe, repli, crush), K7 = shuffle, K8 = volume 909.</li>
        <li><b>Grille de l'APC</b> (Maj + PLAY) : rangées 1-2 = les 16 pas, rangées 3-4 = instruments, Accent, Effacer, Muet, rangée 5 = patterns. Un bouton SCENE LAUNCH ramène les pads.</li>
        <li>La grosse caisse déclenche aussi le <b>sidechain</b> (fenêtre Mixeur).</li>
      </ul>`,
    acid: `
      <p>Une ligne de basse acid façon TB-303 : oscillateur, filtre passe-bas 24 dB résonant piloté par une enveloppe, accent, slide et distorsion.</p>
      <ul>
        <li><b>Grille</b> : une colonne par double-croche, une ligne par note de fa à fa aigu. Clic sur une case pour poser une note, un second clic pour un silence. Les lignes <b>Oct + / Oct −</b> décalent un pas d'une octave ; <b>Accent</b> le rend plus fort et plus claquant ; <b>Slide</b> glisse vers la note suivante sans relancer l'enveloppe.</li>
        <li><b>Presets de son</b> (menu au-dessus des potentiomètres) : 15 sons tout prêts en 4 catégories (Acid : classique, squelch, screamer, Rotterdam, hoover ; Basse : caoutchouc, sub, roulante sombre ; Lead : lead scie, couinement, lead gabber ; FX : laser, sirène, écrasée, zap). Tournez un potentiomètre et le son devient personnalisé ; tapez un nom, choisissez une catégorie et <b>Enregistrer</b> pour le garder (★ dans le menu), la corbeille le supprime.</li>
        <li><b>Potentiomètres</b> : accord, coupure, résonance, quantité d'enveloppe, déclin, accent, <b>slide</b> (durée du glissé entre notes liées), drive, forme de distorsion (les 5 formes de la 909), volume. Sur l'APC : <b>Maj + REC</b> ouvre la page de potentiomètres TB-303 (K1-K8). Double-clic = valeur par défaut.</li>
        <li><b>Patterns 1 à 8</b> (4 lignes toutes prêtes en fa mineur). Un changement attend la mesure suivante. <b>Aléatoire</b> écrit une nouvelle ligne en fa mineur, <b>Effacer</b> vide le pattern.</li>
        <li><b>Suivre la 909</b> : la 303 joue sur l'horloge de la TR-909 (shuffle compris) ; ▶ lance les deux. Désactivez-le pour jouer la 303 seule.</li>
        <li><b>Saisie</b> : jouez les notes au clavier de l'APC (ou de l'ordinateur) ; chacune va dans le pas choisi et le curseur avance. Une frappe forte ajoute un accent, <b>Silence</b> laisse un pas vide. Clic sur un numéro de pas pour déplacer le curseur.</li>
        <li>La 303 a sa propre <b>voie de mixage</b> (K5 sur les pages mixeur), est baissée par le <b>sidechain</b> avec les sons mélodiques, et peut être <b>enregistrée</b> dans la timeline (source TB-303).</li>
      </ul>`,
    osc: `
      <p>Un synthé façon analogique pour fabriquer vos propres sons, joué au clavier de l'APC.</p>
      <ul>
        <li><b>Clavier</b> : le clavier de l'APC (et celui de l'ordinateur) joue le synthé de la fenêtre active : cliquez sur cette fenêtre (ou <b>Jouer au clavier</b>) pour le jouer, cliquez sur la fenêtre Synthé pour revenir. Les accords et l'arpégiateur marchent aussi.</li>
        <li><b>Osc 1 à 3</b> : onde (scie, impulsion, triangle, sinus), octave, demi-ton, désaccord fin, niveau, <b>largeur</b> de l'impulsion, <b>unisson</b> (jusqu'à 7 copies désaccordées) et leur désaccord. Un oscillateur au niveau 0 est éteint.</li>
        <li><b>Bruit, anneau, FM, hauteur</b> : bruit blanc, modulation en anneau (osc 1 × osc 2), FM de l'osc 1 par l'osc 3 (l'osc 3 peut rester muet), et une enveloppe de hauteur (chaque note part plus haut ou plus bas et glisse jusqu'à sa hauteur : lasers, hoovers).</li>
        <li><b>Filtre</b> : passe-bas, passe-haut ou passe-bande, 12 ou 24 dB, coupure, résonance, quantité d'enveloppe (négative = ferme), suivi du clavier, saturation avant le filtre.</li>
        <li><b>Enveloppes</b> : ADSR du filtre et du volume, dessinées au-dessus de leurs potentiomètres.</li>
        <li><b>LFO</b> : sinus, triangle, scie ou carré, calé sur le tempo (1/1 à 1/32, triolets), sur la hauteur, le filtre, la largeur d'impulsion ou le volume.</li>
        <li><b>Voix</b> : poly (8 notes), mono ou legato (pas de nouvelle attaque entre notes liées), glissé, largeur stéréo de l'unisson, volume.</li>
        <li><b>Presets</b> : 12 sons tout prêts (hoover, screech FM, reese, lead gabber, basse acid, sub, supersaw, pluck, stab cuivré, nappe, wobble, laser), en boutons et dans un menu par catégorie (Lead, Basse, Nappe, FX). Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et <b>Enregistrer</b> pour garder le vôtre (★), la corbeille le supprime.</li>
        <li><b>Potentiomètres de l'APC</b> : les potentiomètres marqués K1-K8 (coupure, résonance, enveloppe du filtre, déclin du filtre, saturation, quantité du LFO, relâche, volume) suivent les potentiomètres de l'APC quand cette fenêtre est active.</li>
        <li>Il a sa propre <b>voie de mixage</b> (K7 sur les pages mixeur), se câble dans la fenêtre <b>Câblage</b> et est baissé par le <b>sidechain</b> comme le synthé. Ses enregistrements deviennent des blocs de notes avec son son ; dans le <b>piano roll</b>, tout bloc de notes peut prendre un de ses presets.</li>
      </ul>`,
    viz: `
      <p>Un clin d'œil à Winamp : des visualisations de la musique qui suivent la sortie générale. Elles sont à leur meilleur en plein écran, projetées pendant un live.</p>
      <ul>
        <li><b>Spectre</b> : des barres de LED des graves (à gauche) aux aigus, avec des crêtes qui retombent doucement, et leur reflet.</li>
        <li><b>Oscilloscope</b> : la forme d'onde avec une traînée lumineuse, et une figure stéréo (Lissajous) dans le coin.</li>
        <li><b>Milk</b> : chaque image est réinjectée, zoomée et tournée, sous un cercle fait de la forme d'onde et des formes qui tournent : tourbillons et traînées, le tout qui cogne à chaque kick.</li>
        <li><b>Vumètres</b> : deux vumètres à aiguille façon hi-fi (gauche / droite, avec voyant de crête) et une barre de LED par voie de mixage et pour le master.</li>
        <li><b>3D (WebGL)</b> : <b>Tunnel 3D</b> (des anneaux de néon qui défilent au tempo, des rayons éclairés par le spectre), <b>Paysage 3D</b> (on survole une grille synthwave dont le relief est le spectre des deux dernières mesures, graves au milieu, sous un soleil rayé qui pulse sur les kicks) et <b>Blob 3D</b> (une sphère déformée par les graves, les médiums et le spectre, éclairée en néon).</li>
        <li><b>Texte qui cogne</b> : les mots que vous tapez (séparés par des virgules), un par mesure, écrasés sur chaque kick avec des couleurs séparées.</li>
        <li><b>Hyperespace</b> (des étoiles qui filent vers vous, avec un saut à chaque kick), <b>Fractale 3D</b> (un vol dans une éponge de Menger infinie qui se replie avec la musique) et <b>Lasers</b> (des faisceaux qui balaient la fumée au-dessus d'une foule qui saute).</li>
        <li><b>Particules</b> (une sphère de points qui éclate à chaque kick), <b>Barres Amiga</b> (barres de couleur et défileur sinusoïdal avec vos mots) et <b>Spectrogramme</b> (le son qui défile en cascade de couleurs).</li>
        <li>D'autres modes 3D / GPU : <b>Ville de spectre</b> (l'historique du spectre en tours de néon qui arrivent vers vous), <b>Mur de LED</b> (un écran de scène dont le motif change à chaque mesure), <b>Metaballs</b>, <b>Plasma</b>, <b>Rotozoomer</b>, <b>Fluide</b> (de l'encre remuée par le son, une giclée à chaque kick) et <b>Réaction-diffusion</b> (des motifs organiques qui poussent tout seuls).</li>
        <li><b>Filtres</b>, empilables sur n'importe quel mode : <b>CRT</b> (lignes de balayage, verre bombé, franges de couleur), <b>Kaléido</b> (6 à 12 branches), <b>Glitch</b> et <b>Strobo</b> (flashs blancs sur les kicks, 3 par seconde au plus ; attention aux lumières clignotantes). Changer de mode fait une transition (fondu, zoom ou bandes).</li>
        <li><b>Potentiomètres</b> sous l'image, aussi sur les potentiomètres de l'APC quand la fenêtre est active (page Visualiseur) : vitesse, teinte, force des flashs, sensibilité, puis la quantité de chaque filtre.</li>
        <li><b>Drop</b> : quand les graves reviennent après un break de plus de 2 mesures, l'image explose (et change de mode en Auto).</li>
        <li><b>Projecteur</b> : ouvre les visuels seuls dans une deuxième fenêtre. Glissez-la sur l'écran du projecteur et double-cliquez pour le plein écran ; vous continuez de jouer dans la fenêtre principale. Les touches 1-9 / ← / → y marchent aussi.</li>
        <li>Les couleurs avancent avec le tempo (un cran par temps) et chaque <b>kick</b> (909, pads, blocs, boucles) fait un flash.</li>
        <li><b>Auto</b> change de mode toutes les 8 mesures. <b>Plein écran</b> (ou F, ou un double-clic) : un clic passe au mode suivant, Échap pour sortir.</li>
        <li>Touches quand la fenêtre est active : 1 à 9 et 0 = mode, ← / → = précédent / suivant, F = plein écran. Rien n'est dessiné quand la fenêtre est fermée.</li>
      </ul>`,
    roll: `
      <p>Éditez les notes d'un bloc de notes de la timeline : hauteur, début, durée et vélocité.</p>
      <ul>
        <li><b>Ouvrir un bloc</b> : double-clic sur un bloc de notes de la timeline (quand cette fenêtre est ouverte, un clic suffit), ou <b>+ Nouveau bloc</b> (1 mesure à la tête de lecture, sur la piste armée). Un enregistrement du synthé devient un seul bloc de notes.</li>
        <li><b>Notes</b> : clic dans le vide pour poser une note (glisser pour sa durée), glisser une note pour la déplacer (<b>Alt</b> = copie), glisser son bord droit pour sa durée, <b>clic droit</b> (ou glisser en clic droit) pour effacer. <b>Maj + glisser</b> sélectionne un groupe, Maj + clic ajoute une note à la sélection.</li>
        <li><b>Touches</b> : Suppr, Ctrl+A / C / X / V (collage au curseur vert, placé d'un clic sur la règle), Ctrl+D (duplique à la suite), ↑ / ↓ transposent (Maj = octave), ← / → déplacent d'une case (Maj = une mesure), Q quantifie, Espace = écouter, Ctrl+Z = annuler.</li>
        <li><b>Vélocité</b> : glisser dans la bande du bas (seulement les notes sélectionnées s'il y a une sélection).</li>
        <li><b>Grille</b> de 1/4 à 1/32 (et triolets) ; <b>Quantifier</b> cale le début et la fin des notes. Les lignes de la gamme de fa mineur (la tonalité des banques) sont teintées.</li>
        <li><b>Longueur</b> −/+ : longueur du motif. Le bloc le répète sur toute sa longueur dans la timeline (tirer son bord droit). Des notes posées après la fin allongent le motif.</li>
        <li><b>Son</b> : un preset du synthé rien qu'à lui, ou le son joué en ce moment au clavier. <b>Regrouper</b> rassemble dans ce bloc les blocs de notes voisins de la piste (même son).</li>
        <li><b>Pas à pas</b> : les notes jouées au clavier de l'APC (ou de l'ordinateur) sont posées au curseur (accords compris), qui avance d'une case.</li>
      </ul>`,
    curve: `
      <p>Dessinez comment un réglage d'une piste bouge sur 1, 2 ou 4 temps : la forme se répète en boucle, calée sur le tempo, tant que son bloc dure sur la timeline.</p>
      <ul>
        <li><b>Réglage</b> : volume (pompe sidechain, gate, stutter faits main), filtre passe-bas ou passe-haut, panoramique, saturation, envoi reverb ou envoi delay.</li>
        <li><b>Édition</b> : clic pour ajouter un point, glissez-le (aimanté à la grille : 1/4 à 1/32 et triolets, <b>Maj</b> = libre), double-clic ou clic droit pour le supprimer. Le losange entre deux points courbe le trait (glissez-le vers le haut ou le bas) ; double-clic dessus pour un palier : la valeur reste jusqu'au point suivant.</li>
        <li><b>Profondeur</b> ramène la courbe vers « sans effet » (pointillés), <b>Lissage</b> arrondit les paliers (pas de clic). Pour les filtres : la coupure extrême et la résonance.</li>
        <li><b>Écouter</b> joue une boucle de la bibliothèque (batterie, basse, cordes ou hoover) à travers la courbe ; chaque retouche s'entend tout de suite.</li>
        <li><b>Formes de départ</b> : pompes sidechain, gate trance, gate 3-3-2, stutter, respiration, wobble, dent de scie filtre, balayage passe-haut, ping-pong, balancier, impulsion saturée, queue de reverb, écho à contretemps. Modifiez-en une, puis <b>Enregistrer dans la bibliothèque</b> : elle devient votre courbe (★).</li>
        <li><b>Vos courbes</b> sont dans la bibliothèque, <b>Effets › Courbes</b> : glissez-en une sur une piste comme un effet de piste, ou cliquez sur <b>Sur la timeline</b>. Retoucher votre courbe change tous ses blocs d'un coup, même pendant la lecture. Double-clic sur un bloc de courbe pour l'ouvrir ici.</li>
        <li>Vos courbes sont sauvegardées avec le projet, voyagent dans les fichiers morceau et sont dans l'export WAV.</li>
      </ul>`,
    kick: `
      <p>Fabriquez votre propre kick gabber / hardcore, calculé en quelques millisecondes, puis utilisez-le partout.</p>
      <ul>
        <li><b>Presets</b> : Rotterdam, Mainstream, Uptempo, Raw, Terror, Industrial, Early, Frenchcore. Partez de l'un d'eux, puis sculptez-le. Le menu sous les boutons les range par catégorie (Gabber, Hardcore, Mainstream / uptempo) avec vos propres kicks. Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et <b>Enregistrer</b> pour garder le vôtre (★), la corbeille le supprime.</li>
        <li><b>Queue</b> : <b>Note</b> (fa = la tonalité des banques), <b>Punch</b> et <b>Chute</b> (de combien la hauteur part haut et à quelle vitesse elle tombe), <b>Plongée</b> (de combien elle continue de descendre), <b>Longueur</b>, <b>Zaag</b> (scie pour une queue brute qui bourdonne).</li>
        <li><b>Distorsion</b> : <b>Drive</b> et <b>Forme</b> (les 5 formes de la 909), puis <b>Formant</b> et <b>Mordant</b>, qui font « parler » la queue.</li>
        <li><b>Attaque</b> : <b>Clic</b> (bruit) et <b>Attaque</b> (couche courte et percutante).</li>
        <li><b>Écoute auto</b> joue le kick à chaque potentiomètre relâché. La forme d'onde et la longueur s'affichent sous les potentiomètres.</li>
        <li><b>→ Pad</b> le met sur le pad sélectionné, <b>→ Bibliothèque</b> l'ajoute à la catégorie Kicks de la bibliothèque (à glisser sur la timeline ; clic droit dessus pour le retirer), <b>⤓ WAV</b> le télécharge.</li>
      </ul>`,
    decks: `
      <p>Deux platines pour mixer et scratcher n'importe quel son : boucles de la bibliothèque, vos enregistrements, vos propres fichiers.</p>
      <ul>
        <li><b>Charger</b> : glissez un son de la bibliothèque (ou un fichier audio) sur un deck, ou cliquez sur un son de la bibliothèque puis sur <b>Charger</b>.</li>
        <li><b>▶ / ❚❚</b> lecture / pause. <b>Cue</b> : en lecture, retour au point de cue et pause ; à l'arrêt, place le point de cue. Clic sur la forme d'onde pour s'y rendre.</li>
        <li><b>Sync</b> : le deck suit le tempo global (quand le tempo du son est connu : boucles de la bibliothèque, ou deviné pour les longs fichiers) et démarre à la mesure suivante. Sans Sync, le curseur <b>Pitch</b> change la vitesse de ±8 % (double-clic = 0).</li>
        <li><b>Scratch</b> : tenez le disque à la souris et bougez-le, en avant ou en arrière ; relâchez-le pour qu'il reparte. Le disque suit la position de votre main, comme un vrai.</li>
        <li><b>Transition auto</b> : du deck qui joue vers l'autre : départ sur la prochaine phrase, en phase, entrée sans basses, échange des basses sur la mesure du milieu, puis l'ancien son part au filtre passe-haut et s'arrête (16 mesures après une intro calme, 8 sinon). Touchez les platines pour reprendre la main.</li>
        <li><b>Volume, Basses, Médiums, Aigus</b> (tout à gauche = coupé) et <b>Filtre</b> (à gauche = passe-bas, à droite = passe-haut) pour chaque deck, et le <b>crossfader</b> entre A et B.</li>
        <li>Sur l'APC : <b>Maj + REC</b> deux fois ouvre la page de potentiomètres des platines (volume A, basses A, filtre A, volume B, basses B, filtre B, crossfader, master). Les platines ont leur voie de mixage (K6) et peuvent être enregistrées dans la timeline (source Platines).</li>
      </ul>`,
    patch: `
      <p>Reliez librement les outils et des boîtes à effets. Par défaut, chaque outil va directement au master : rien ne change tant que vous n'y touchez pas.</p>
      <ul>
        <li>À gauche, un bloc par <b>outil</b> (sa voie de mixage : pads, synthé, TR-909, timeline, TB-303, platines). À droite, le <b>Master</b>.</li>
        <li><b>+ Distorsion, + PCF, + Filtre, + Delay, + Reverb, + Compresseur, + Bitcrusher</b> ajoutent une <b>boîte à effet</b>. Double-clic sur une boîte pour ses réglages ; ✕ la retire.</li>
        <li><b>Câbler</b> : tirez depuis une sortie (prise de droite) vers une boîte ou vers le master. Une sortie peut aller à plusieurs endroits, et une boîte peut recevoir plusieurs sources (elles sont mélangées). Un câble qui créerait une boucle est refusé.</li>
        <li><b>Débrancher</b> : clic sur un câble. Un outil qui ne va nulle part est muet (le mixeur l'indique en rouge sous son nom).</li>
        <li>La boîte <b>PCF</b> suit en permanence la grille du tempo, le <b>Delay</b> et le LFO du <b>Filtre</b> se règlent en valeurs de note : tout reste calé. L'export WAV reconstruit exactement le même câblage.</li>
        <li><b>Tout sur le master</b> recâble chaque outil directement sur le master.</li>
      </ul>`,
    piano: `
      <p>Le synthé du clavier : 35 presets en 10 familles, 8 potentiomètres d'expression, mode accords et arpégiateur.</p>
      <ul>
        <li><b>Familles et presets</b> : clic, ou sur l'APC <b>Maj + touche blanche</b> = preset de la famille, <b>Maj + do# / ré#</b> = famille précédente / suivante.</li>
        <li><b>8 potentiomètres</b> adaptés à la famille (brillance, résonance, attaque, relâche, largeur, vibrato, ensemble ou saturation, glissé, désaccord, réverb). Double-clic = retour à la valeur du preset.</li>
        <li><b>Vos presets</b> (menu sous les presets, par famille) : un preset personnel garde son son de départ et vos 8 potentiomètres. Tourner un potentiomètre rend le son personnalisé ; tapez un nom, choisissez une catégorie et <b>Enregistrer</b> pour garder le vôtre (★), la corbeille le supprime.</li>
        <li><b>Accords</b> : une touche joue un accord complet ; <b>Dans la tonalité (fa mineur)</b> construit sur chaque touche l'accord juste de la gamme. APC : Maj + fa#.</li>
        <li><b>Arpège</b> : les notes tenues sont jouées l'une après l'autre, calées sur le tempo (1/8, 1/16, 1/32 ; ordre ; 1 à 3 octaves ; durée des notes ; <b>Tenue</b>). APC : Maj + sol# = oui / non, Maj + la# = vitesse.</li>
        <li>Clavier de l'ordinateur : rangée du milieu (Q S D F… en AZERTY), W / X = octave.</li>
      </ul>`,
    gen: `
      <p>À partir d'une suite d'accords, pose sur la timeline des blocs d'accords (cordes, nappes, chœurs…) ou une mélodie qui suit les accords.</p>
      <ul>
        <li><b>Suite d'accords</b> : tapez les accords séparés par des espaces ou des tirets (<code>Fm Db Eb Cm</code>), ou cliquez sur une suite toute prête. Reconnus : majeur, mineur (<code>m</code>), <code>7</code>, <code>m7</code>, <code>maj7</code>, <code>sus2</code>, <code>sus4</code>, <code>dim</code>, <code>aug</code>, <code>5</code>, <code>add9</code>. <b>Mesures par accord</b> et <b>Répétitions</b> valent pour les deux onglets.</li>
        <li><b>Accords</b> : son (cordes, nappes, chœurs, supersaw, stabs, claviers ou le preset du synthé en cours), registre, rythme (tenu, chaque temps, contretemps, croches) et basse (sub, hardcore en contretemps, reese) sur une deuxième piste. Un bloc par accord, chacun avec son propre preset.</li>
        <li><b>Mélodie (lead)</b> : une mélodie qui suit les accords. <b>Style</b> : Hymne (un motif repris sur chaque accord, temps forts sur les notes de l'accord), Arpège, Riff hardcore (notes courtes, octaves et quintes), Question / réponse (une phrase qui monte, une réponse qui descend). <b>Densité</b>, <b>registre</b> et <b>doublage à l'octave</b>.</li>
        <li><b>Nouvelle idée</b> tire une autre mélodie et la fait écouter ; <b>Écouter</b> joue exactement ce que <b>Générer</b> posera (un deuxième clic arrête).</li>
        <li>La mélodie est un seul bloc de notes, répété sur toute la durée : double-cliquez dessus pour la retoucher dans le piano roll.</li>
        <li><b>Notes</b> : le piano roll sous les réglages montre le brouillon de l'onglet (un passage de la suite) ; modifiez-le avant de le poser. Retouché à la main, les réglages ne le changent plus : <b>Recalculer</b> repart des réglages. Écouter et Générer utilisent le brouillon tel qu'il est.</li>
        <li>Les blocs sont posés à partir de la mesure de la tête de lecture, sur la première piste libre sur toute la durée, en partant de la piste armée ; le morceau s'allonge si besoin.</li>
      </ul>`,
    buses: `
      <p>Quatre bus (A à D) regroupent des pistes de la timeline pour les traiter ensemble : toutes les percussions dans un même compresseur, tous les leads dans une même reverb…</p>
      <ul>
        <li><b>Envoyer une piste vers un bus</b> : dans le panneau de la piste (bouton cadran de son en-tête), choisissez le <b>Bus</b>. La lettre du bus s'affiche alors dans l'en-tête de la piste ; le bus liste ses pistes.</li>
        <li><b>Effets d'insert</b> (jusqu'à 4 : égaliseur, compresseur, distorsion, filtre, reverb), <b>panoramique</b> et <b>volume</b> agissent sur tout le groupe ; double-clic sur un réglage = valeur par défaut.</li>
        <li><b>M</b> coupe toutes les pistes du bus, <b>S</b> met le bus en solo (avec les pistes en solo).</li>
        <li>Un bus envoie chaque son là où il allait avant (synthé, pads, sidechain…) : mettre une piste dans un bus ne change pas son niveau.</li>
        <li>Les bus sont enregistrés avec le projet et dans les fichiers morceau, et l'export WAV passe par eux.</li>
      </ul>`,
    knobs: `
      <p>Les 8 potentiomètres à l'écran suivent les potentiomètres K1-K8 de l'APC, page par page.</p>
      <ul>
        <li><b>Synthé</b> : les 8 potentiomètres d'expression de la famille du synthé.</li>
        <li><b>Effets</b> : temps, répétitions et envoi du delay, envoi et taille de la reverb, volume du synthé, volume des pads, volume général.</li>
        <li><b>Pad</b> : les potentiomètres du pad sélectionné.</li>
        <li><b>EQ</b> : 5 bandes (±15 dB), passe-bas, passe-haut, gain de sortie. SUSTAIN sur l'APC l'ouvre (maintenu = le temps de l'appui).</li>
        <li>Pages <b>TR-909</b> et <b>mixeur</b> (Maj + piste 1-4 sur l'APC).</li>
        <li>APC : boutons de piste 1-4 = Synthé / Effets / Pad / EQ. <b>Maj + potentiomètre</b> = réglage fin ; double-clic à l'écran = valeur par défaut.</li>
      </ul>`,
    perf: `
      <p>Effets en direct sur tout le mix, calés sur la grille. Maintenez pour les utiliser (Pump est en marche / arrêt).</p>
      <ul>
        <li><b>Rolls</b> 1/4, 1/8, 1/16, 1/32 : répètent le son, à partir de la double-croche suivante.</li>
        <li><b>Filtre ↓ / ↑</b> : balayage passe-bas ou passe-haut sur une mesure.</li>
        <li><b>Tape-stop</b> : ralentit tout jusqu'à l'arrêt.</li>
        <li><b>Pump</b> : le synthé s'efface à chaque temps (pour un vrai sidechain déclenché par les kicks, voir la fenêtre Mixeur).</li>
        <li>APC : boutons de piste 5-8 (maintenus), Maj + 5-8 pour la 2e ligne.</li>
      </ul>`,
    mix: `
      <p>Une voie par outil (Pads, Synthé, TR-909, Timeline), puis le master.</p>
      <ul>
        <li>Chaque voie : effets d'insert (<b>+ FX</b>, jusqu'à 4 : distorsion, filtre, compresseur, reverb), envois reverb et delay, panoramique, fader, <b>M</b>uet, <b>S</b>olo, vumètre. Double-clic = remise à zéro.</li>
        <li><b>Sidechain</b> (en haut) : chaque kick fait baisser le synthé et les sons mélodiques (basses, nappes, leads, claviers, voix), qui remontent en douceur. Déclenché par <b>les kicks</b> (909, pads et blocs de kick, kicks des boucles GabberKey) ou à <b>chaque temps</b> (pour les autres boucles). Profondeur, relâche, cibles ; le témoin montre la baisse.</li>
        <li><b>Master</b> (en bas) : l'EQ du master (5 bandes, passe-bas, passe-haut, gain) et les effets globaux et volumes (temps et répétitions du delay, taille de la reverb, envois et volumes du synthé et des pads, volume général).</li>
        <li>APC : Maj + piste 1 / 2 / 3 / 4 = volumes / panos / delay / reverb (K1 Pads, K2 Synthé, K3 TR-909, K4 Timeline, K5 TB-303, K6 Platines, K8 master).</li>
      </ul>`,
    scenes: `
      <p>40 instantanés de la session, disposés comme la grille de l'APC.</p>
      <ul>
        <li>Une scène garde les boucles en cours, le pattern et les muets de la 909, le mixeur, le preset du synthé, le tempo et le transport.</li>
        <li><b>Clic</b> = lancer à la mesure suivante. <b>Maj + clic</b> (ou <b>Mode enregistrement</b>) = garder l'état actuel. <b>Clic droit</b> = effacer.</li>
        <li>APC : <b>Maj + STOP ALL CLIPS</b> transforme les pads en scènes (pad = lancer, Maj + pad = enregistrer). LEDs : vert = enregistrée, rouge = en cours, clignotant = attend la mesure suivante.</li>
      </ul>`,
    monitor: `
      <p>Les autres claviers et contrôleurs MIDI, le MIDI learn, et tous les messages MIDI reçus (pour vérifier une connexion).</p>
      <ul>
        <li><b>N'importe quel clavier MIDI</b> (branché en USB, sans pilote pour la plupart) joue le synthé de la fenêtre active, comme le clavier de l'APC, et s'enregistre dans la timeline ; sa pédale de sustain tient les notes.</li>
        <li><b>MIDI learn</b> : cliquez sur <b>Apprendre</b> à côté d'une cible, puis tournez un potentiomètre, bougez un fader ou appuyez sur un bouton de l'appareil. Cibles : potentiomètres K1-K8 de la page active (comme ceux de l'APC), faders du mixeur, volume général, volumes des bus, lecture / arrêt, enregistrement, boucle. La corbeille retire une assignation. Une touche assignée à un bouton ne joue plus de note. Les assignations sont enregistrées avec le projet.</li>
        <li><b>Horloge MIDI</b> : <b>Envoyer vers</b> un appareil (24 impulsions par temps, Start / Stop, position : il suit la timeline), ou <b>Suivre</b> un appareil (son tempo, son Start et son Stop).</li>
        <li>Les ports utilisés sont affichés en haut. Si les pads et le clavier sont inversés, utilisez le bouton d'inversion.</li>
        <li>Rien n'arrive ? Débranchez et rebranchez l'APC, puis rechargez la page (Windows peut bloquer son pilote MIDI).</li>
      </ul>`,
  },
};

export const helpHtml = id => HELP[lang]?.[id] ?? HELP.en[id] ?? '';
