// Aide de chaque fenêtre (bouton ? de la barre de titre), en français et en anglais.
import { lang } from './i18n.js';

const HELP = {
  en: {
    pads: `
      <p>The 40-pad sampler, laid out like the APC grid (pads 1-8 at the bottom).</p>
      <ul>
        <li><b>Click</b> a pad (or hit it on the APC) to play it; <b>Shift + click</b> selects it without playing.</li>
        <li><b>Knobs</b> under the grid: volume, pitch, pan, filter, start point, delay and reverb sends, and mode of the selected pad (also on the APC knobs K1-K8 when this window is active).</li>
        <li><b>✎</b> (shown when the mouse is over a pad) opens the <b>pad editor</b>: name, colour, playback mode, knobs, loop tempo.</li>
        <li><b>Drop an audio file</b> (WAV, MP3, FLAC, OGG…) on a pad to load it.</li>
        <li>Playback modes: <b>one-shot</b> (plays to the end), <b>hold</b> (as long as the pad is pressed), <b>loop</b> (starts on the next bar, press again to stop).</li>
        <li><b>Banks 1-15</b> (column on the right). APC: SCENE LAUNCH 1-5 = banks 1-5, Shift + SCENE LAUNCH = 6-10, a second time = 11-15.</li>
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
        <li><b>Accent</b>: how much louder the accented steps are.</li>
        <li><b>Knobs</b> (under the grid, also on the APC knobs K1-K8 when this window is active): K1-K4 = parameters of the selected instrument, K5 = <b>drive</b>, K6 = distortion <b>shape</b> (soft, hard, tube, fold, crush), K7 = shuffle, K8 = 909 volume.</li>
        <li><b>APC grid</b> (Shift + PLAY): rows 1-2 = the 16 steps, row 3-4 = instruments, Accent, Clear, Mute, row 5 = patterns. A SCENE LAUNCH button brings the pads back.</li>
        <li>The bass drum also triggers the <b>sidechain</b> (Mixer window).</li>
      </ul>`,
    acid: `
      <p>An acid bass line in the style of the TB-303: oscillator, resonant 24 dB low-pass filter driven by an envelope, accent, slide, and distortion.</p>
      <ul>
        <li><b>Grid</b>: one column per 16th note, one row per note from F to high F. Click a cell to place a note, click it again for a rest. The <b>Oct + / Oct −</b> rows shift a step by an octave; <b>Accent</b> makes it louder and snappier; <b>Slide</b> glides into the next note without retriggering the envelope.</li>
        <li><b>Knobs</b>: tune, cutoff, resonance, envelope amount, decay, accent, drive, distortion shape (the 909's 5 shapes), volume. On the APC: <b>Shift + REC</b> opens the TB-303 knob page (K1-K8). Double-click = default value.</li>
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
        <li><b>Presets</b>: 12 ready-made sounds (hoover, FM screech, reese, gabber lead, acid bass, sub, supersaw, pluck, brass stab, pad, wobble, laser). Type a name and <b>Save</b> to keep your own; the bin deletes it.</li>
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
        <li><b>CRT</b>: a filter over any mode (scan lines, curved glass, colour fringes).</li>
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
    kick: `
      <p>Build your own gabber / hardcore kick, computed in a few milliseconds, then use it anywhere.</p>
      <ul>
        <li><b>Presets</b>: Rotterdam, Mainstream, Uptempo, Raw, Terror, Industrial, Early, Frenchcore. Start from one, then shape it.</li>
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
        <li><b>Scratch</b>: hold the record with the mouse and move it, forwards or backwards; release it to let it play again.</li>
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
      <p>The keyboard synth: 35 presets in 10 families, 8 expression knobs, chord mode, arpeggiator and pad generator.</p>
      <ul>
        <li><b>Families and presets</b>: click, or on the APC <b>Shift + white key</b> = preset of the family, <b>Shift + C# / D#</b> = previous / next family.</li>
        <li><b>8 knobs</b> adapted to the family (brightness, resonance, attack, release, width, vibrato, ensemble or drive, glide, detune, reverb). Double-click = back to the preset's value.</li>
        <li><b>Chords</b>: one key plays a whole chord; <b>In key (F minor)</b> builds the right chord of the scale on each key. APC: Shift + F#.</li>
        <li><b>Arpeggio</b>: the held notes are played one after another in time with the tempo (1/8, 1/16, 1/32; order; 1-3 octaves; note length; <b>Hold</b>). APC: Shift + G# = on / off, Shift + A# = speed.</li>
        <li><b>Pad generator → timeline</b>: type a progression (<code>Fm Db Eb Cm</code>), choose a sound, register, bars per chord, repeats, rhythm and bass, then <b>Generate</b>: the chord blocks are placed from the playhead, each with its own preset.</li>
        <li>Computer keyboard: middle row (A S D F… on QWERTY), Z / X = octave.</li>
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
      <p>Every MIDI message received from the APC, to check the connection.</p>
      <ul>
        <li>The ports in use are shown at the top. If the pads and the keyboard are swapped, use the swap button.</li>
        <li>Nothing arrives? Unplug and plug the APC back in, then reload the page (Windows can freeze its MIDI driver).</li>
      </ul>`,
  },
  fr: {
    pads: `
      <p>Le sampler de 40 pads, disposé comme la grille de l'APC (pads 1 à 8 en bas).</p>
      <ul>
        <li><b>Clic</b> sur un pad (ou frappe sur l'APC) pour le jouer ; <b>Maj + clic</b> le sélectionne sans le jouer.</li>
        <li><b>Potards</b> sous la grille : volume, hauteur, panoramique, filtre, point de départ, envois delay et reverb, et mode du pad sélectionné (aussi sur les potards K1-K8 de l'APC quand cette fenêtre est active).</li>
        <li><b>✎</b> (visible au survol d'un pad) ouvre l'<b>éditeur de pad</b> : nom, couleur, mode de lecture, potards, tempo de boucle.</li>
        <li><b>Glisse un fichier audio</b> (WAV, MP3, FLAC, OGG…) sur un pad pour le charger.</li>
        <li>Modes : <b>one-shot</b> (joue jusqu'au bout), <b>maintenu</b> (tant que le pad est appuyé), <b>boucle</b> (démarre à la mesure suivante, un nouvel appui l'arrête).</li>
        <li><b>Banques 1 à 15</b> (colonne de droite). APC : SCENE LAUNCH 1-5 = banques 1-5, Maj + SCENE LAUNCH = 6-10, une deuxième fois = 11-15.</li>
        <li><b>Exporter la banque / Exporter tout / Importer…</b> : fichiers <code>.apckit</code> avec les sons et leurs réglages.</li>
      </ul>`,
    editor: `
      <p>Les réglages du pad sélectionné.</p>
      <ul>
        <li><b>Nom</b> et <b>couleur de la LED</b> (avec un mk1, seules ses 3 couleurs sont proposées).</li>
        <li><b>Charger un son…</b>, <b>Jouer</b>, <b>Vider</b>. Tu peux aussi glisser un fichier audio ici.</li>
        <li><b>Mode</b> : one-shot, maintenu ou boucle.</li>
        <li><b>8 potards</b> : volume, hauteur, panoramique, filtre, point de départ, envois delay et reverb, mode. Ils sont aussi sur les potards de l'APC (page Pad, bouton de piste 3). Double-clic = valeur par défaut.</li>
        <li><b>Tempo de la boucle</b> : tempo d'origine du son, pour que la boucle suive le tempo global. <b>Auto</b> le devine, en supposant que le fichier dure un nombre entier de mesures.</li>
      </ul>`,
    tr: `
      <p>Émulation de la TR-909 : 11 instruments synthétisés et un séquenceur de 16 pas calé sur la timeline et les boucles.</p>
      <ul>
        <li><b>Clic sur un pas</b> : note → accent → silence. <b>Clic sur le nom d'un instrument</b> pour le jouer et le choisir.</li>
        <li><b>Patterns 1 à 8</b> (4 préréglés : gabber, rave, breakbeat, roulement de kick). Un changement attend la mesure suivante.</li>
        <li><b>Accent</b> : de combien les pas accentués sont plus forts.</li>
        <li><b>Potards</b> (sous la grille, aussi sur les potards K1-K8 de l'APC quand cette fenêtre est active) : K1-K4 = paramètres de l'instrument choisi, K5 = <b>drive</b>, K6 = <b>forme</b> de distorsion (douce, dure, lampe, repli, crush), K7 = shuffle, K8 = volume 909.</li>
        <li><b>Grille de l'APC</b> (Maj + PLAY) : rangées 1-2 = les 16 pas, rangées 3-4 = instruments, Accent, Effacer, Muet, rangée 5 = patterns. Un bouton SCENE LAUNCH ramène les pads.</li>
        <li>La grosse caisse déclenche aussi le <b>sidechain</b> (fenêtre Mixeur).</li>
      </ul>`,
    acid: `
      <p>Une ligne de basse acid façon TB-303 : oscillateur, filtre passe-bas 24 dB résonant piloté par une enveloppe, accent, slide et distorsion.</p>
      <ul>
        <li><b>Grille</b> : une colonne par double-croche, une ligne par note de fa à fa aigu. Clic sur une case pour poser une note, un second clic pour un silence. Les lignes <b>Oct + / Oct −</b> décalent un pas d'une octave ; <b>Accent</b> le rend plus fort et plus claquant ; <b>Slide</b> glisse vers la note suivante sans relancer l'enveloppe.</li>
        <li><b>Potards</b> : accord, coupure, résonance, quantité d'enveloppe, déclin, accent, drive, forme de distorsion (les 5 formes de la 909), volume. Sur l'APC : <b>Maj + REC</b> ouvre la page de potards TB-303 (K1-K8). Double-clic = valeur par défaut.</li>
        <li><b>Patterns 1 à 8</b> (4 lignes toutes prêtes en fa mineur). Un changement attend la mesure suivante. <b>Aléatoire</b> écrit une nouvelle ligne en fa mineur, <b>Effacer</b> vide le pattern.</li>
        <li><b>Suivre la 909</b> : la 303 joue sur l'horloge de la TR-909 (shuffle compris) ; ▶ lance les deux. Désactive-le pour jouer la 303 seule.</li>
        <li><b>Saisie</b> : joue les notes au clavier de l'APC (ou de l'ordinateur) ; chacune va dans le pas choisi et le curseur avance. Une frappe forte ajoute un accent, <b>Silence</b> laisse un pas vide. Clic sur un numéro de pas pour déplacer le curseur.</li>
        <li>La 303 a sa propre <b>voie de mixage</b> (K5 sur les pages mixeur), est baissée par le <b>sidechain</b> avec les sons mélodiques, et peut être <b>enregistrée</b> dans la timeline (source TB-303).</li>
      </ul>`,
    osc: `
      <p>Un synthé façon analogique pour fabriquer tes propres sons, joué au clavier de l'APC.</p>
      <ul>
        <li><b>Clavier</b> : le clavier de l'APC (et celui de l'ordinateur) joue le synthé de la fenêtre active : clique sur cette fenêtre (ou <b>Jouer au clavier</b>) pour le jouer, clique sur la fenêtre Synthé pour revenir. Les accords et l'arpégiateur marchent aussi.</li>
        <li><b>Osc 1 à 3</b> : onde (scie, impulsion, triangle, sinus), octave, demi-ton, désaccord fin, niveau, <b>largeur</b> de l'impulsion, <b>unisson</b> (jusqu'à 7 copies désaccordées) et leur désaccord. Un oscillateur au niveau 0 est éteint.</li>
        <li><b>Bruit, anneau, FM, hauteur</b> : bruit blanc, modulation en anneau (osc 1 × osc 2), FM de l'osc 1 par l'osc 3 (l'osc 3 peut rester muet), et une enveloppe de hauteur (chaque note part plus haut ou plus bas et glisse jusqu'à sa hauteur : lasers, hoovers).</li>
        <li><b>Filtre</b> : passe-bas, passe-haut ou passe-bande, 12 ou 24 dB, coupure, résonance, quantité d'enveloppe (négative = ferme), suivi du clavier, saturation avant le filtre.</li>
        <li><b>Enveloppes</b> : ADSR du filtre et du volume, dessinées au-dessus de leurs potards.</li>
        <li><b>LFO</b> : sinus, triangle, scie ou carré, calé sur le tempo (1/1 à 1/32, triolets), sur la hauteur, le filtre, la largeur d'impulsion ou le volume.</li>
        <li><b>Voix</b> : poly (8 notes), mono ou legato (pas de nouvelle attaque entre notes liées), glissé, largeur stéréo de l'unisson, volume.</li>
        <li><b>Presets</b> : 12 sons tout prêts (hoover, screech FM, reese, lead gabber, basse acid, sub, supersaw, pluck, stab cuivré, nappe, wobble, laser). Tape un nom puis <b>Enregistrer</b> pour garder le tien ; la corbeille le supprime.</li>
        <li><b>Potards de l'APC</b> : les potards marqués K1-K8 (coupure, résonance, enveloppe du filtre, déclin du filtre, saturation, quantité du LFO, relâche, volume) suivent les potards de l'APC quand cette fenêtre est active.</li>
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
        <li><b>Texte qui cogne</b> : les mots que tu tapes (séparés par des virgules), un par mesure, écrasés sur chaque kick avec des couleurs séparées.</li>
        <li><b>Hyperespace</b> (des étoiles qui filent vers toi, avec un saut à chaque kick), <b>Fractale 3D</b> (un vol dans une éponge de Menger infinie qui se replie avec la musique) et <b>Lasers</b> (des faisceaux qui balaient la fumée au-dessus d'une foule qui saute).</li>
        <li><b>CRT</b> : un filtre sur n'importe quel mode (lignes de balayage, verre bombé, franges de couleur).</li>
        <li><b>Projecteur</b> : ouvre les visuels seuls dans une deuxième fenêtre. Glisse-la sur l'écran du projecteur et double-clique pour le plein écran ; tu continues de jouer dans la fenêtre principale. Les touches 1-9 / ← / → y marchent aussi.</li>
        <li>Les couleurs avancent avec le tempo (un cran par temps) et chaque <b>kick</b> (909, pads, blocs, boucles) fait un flash.</li>
        <li><b>Auto</b> change de mode toutes les 8 mesures. <b>Plein écran</b> (ou F, ou un double-clic) : un clic passe au mode suivant, Échap pour sortir.</li>
        <li>Touches quand la fenêtre est active : 1 à 9 et 0 = mode, ← / → = précédent / suivant, F = plein écran. Rien n'est dessiné quand la fenêtre est fermée.</li>
      </ul>`,
    roll: `
      <p>Édite les notes d'un bloc de notes de la timeline : hauteur, début, durée et vélocité.</p>
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
    kick: `
      <p>Fabrique ton propre kick gabber / hardcore, calculé en quelques millisecondes, puis utilise-le partout.</p>
      <ul>
        <li><b>Presets</b> : Rotterdam, Mainstream, Uptempo, Raw, Terror, Industrial, Early, Frenchcore. Pars de l'un d'eux, puis sculpte-le.</li>
        <li><b>Queue</b> : <b>Note</b> (fa = la tonalité des banques), <b>Punch</b> et <b>Chute</b> (de combien la hauteur part haut et à quelle vitesse elle tombe), <b>Plongée</b> (de combien elle continue de descendre), <b>Longueur</b>, <b>Zaag</b> (scie pour une queue brute qui bourdonne).</li>
        <li><b>Distorsion</b> : <b>Drive</b> et <b>Forme</b> (les 5 formes de la 909), puis <b>Formant</b> et <b>Mordant</b>, qui font « parler » la queue.</li>
        <li><b>Attaque</b> : <b>Clic</b> (bruit) et <b>Attaque</b> (couche courte et percutante).</li>
        <li><b>Écoute auto</b> joue le kick à chaque potard relâché. La forme d'onde et la longueur s'affichent sous les potards.</li>
        <li><b>→ Pad</b> le met sur le pad sélectionné, <b>→ Bibliothèque</b> l'ajoute à la catégorie Kicks de la bibliothèque (à glisser sur la timeline ; clic droit dessus pour le retirer), <b>⤓ WAV</b> le télécharge.</li>
      </ul>`,
    decks: `
      <p>Deux platines pour mixer et scratcher n'importe quel son : boucles de la bibliothèque, tes enregistrements, tes propres fichiers.</p>
      <ul>
        <li><b>Charger</b> : glisse un son de la bibliothèque (ou un fichier audio) sur un deck, ou clique sur un son de la bibliothèque puis sur <b>Charger</b>.</li>
        <li><b>▶ / ❚❚</b> lecture / pause. <b>Cue</b> : en lecture, retour au point de cue et pause ; à l'arrêt, place le point de cue. Clic sur la forme d'onde pour s'y rendre.</li>
        <li><b>Sync</b> : le deck suit le tempo global (quand le tempo du son est connu : boucles de la bibliothèque, ou deviné pour les longs fichiers) et démarre à la mesure suivante. Sans Sync, le curseur <b>Pitch</b> change la vitesse de ±8 % (double-clic = 0).</li>
        <li><b>Scratch</b> : tiens le disque à la souris et bouge-le, en avant ou en arrière ; relâche-le pour qu'il reparte.</li>
        <li><b>Volume, Basses, Médiums, Aigus</b> (tout à gauche = coupé) et <b>Filtre</b> (à gauche = passe-bas, à droite = passe-haut) pour chaque deck, et le <b>crossfader</b> entre A et B.</li>
        <li>Sur l'APC : <b>Maj + REC</b> deux fois ouvre la page de potards des platines (volume A, basses A, filtre A, volume B, basses B, filtre B, crossfader, master). Les platines ont leur voie de mixage (K6) et peuvent être enregistrées dans la timeline (source Platines).</li>
      </ul>`,
    patch: `
      <p>Relie librement les outils et des boîtes à effets. Par défaut, chaque outil va directement au master : rien ne change tant que tu n'y touches pas.</p>
      <ul>
        <li>À gauche, un bloc par <b>outil</b> (sa voie de mixage : pads, synthé, TR-909, timeline, TB-303, platines). À droite, le <b>Master</b>.</li>
        <li><b>+ Distorsion, + PCF, + Filtre, + Delay, + Reverb, + Compresseur, + Bitcrusher</b> ajoutent une <b>boîte à effet</b>. Double-clic sur une boîte pour ses réglages ; ✕ la retire.</li>
        <li><b>Câbler</b> : tire depuis une sortie (prise de droite) vers une boîte ou vers le master. Une sortie peut aller à plusieurs endroits, et une boîte peut recevoir plusieurs sources (elles sont mélangées). Un câble qui créerait une boucle est refusé.</li>
        <li><b>Débrancher</b> : clic sur un câble. Un outil qui ne va nulle part est muet (le mixeur l'indique en rouge sous son nom).</li>
        <li>La boîte <b>PCF</b> suit en permanence la grille du tempo, le <b>Delay</b> et le LFO du <b>Filtre</b> se règlent en valeurs de note : tout reste calé. L'export WAV reconstruit exactement le même câblage.</li>
        <li><b>Tout sur le master</b> recâble chaque outil directement sur le master.</li>
      </ul>`,
    piano: `
      <p>Le synthé du clavier : 35 presets en 10 familles, 8 potards d'expression, mode accords, arpégiateur et générateur de nappes.</p>
      <ul>
        <li><b>Familles et presets</b> : clic, ou sur l'APC <b>Maj + touche blanche</b> = preset de la famille, <b>Maj + do# / ré#</b> = famille précédente / suivante.</li>
        <li><b>8 potards</b> adaptés à la famille (brillance, résonance, attaque, relâche, largeur, vibrato, ensemble ou saturation, glissé, désaccord, réverb). Double-clic = retour à la valeur du preset.</li>
        <li><b>Accords</b> : une touche joue un accord complet ; <b>Dans la tonalité (fa mineur)</b> construit sur chaque touche l'accord juste de la gamme. APC : Maj + fa#.</li>
        <li><b>Arpège</b> : les notes tenues sont jouées l'une après l'autre, calées sur le tempo (1/8, 1/16, 1/32 ; ordre ; 1 à 3 octaves ; durée des notes ; <b>Tenue</b>). APC : Maj + sol# = oui / non, Maj + la# = vitesse.</li>
        <li><b>Générateur de nappes → timeline</b> : tape une suite d'accords (<code>Fm Db Eb Cm</code>), choisis le son, le registre, les mesures par accord, les répétitions, le rythme et la basse, puis <b>Générer</b> : les blocs d'accords sont posés à partir de la tête de lecture, chacun avec son propre preset.</li>
        <li>Clavier de l'ordinateur : rangée du milieu (Q S D F… en AZERTY), W / X = octave.</li>
      </ul>`,
    knobs: `
      <p>Les 8 potards à l'écran suivent les potards K1-K8 de l'APC, page par page.</p>
      <ul>
        <li><b>Synthé</b> : les 8 potards d'expression de la famille du synthé.</li>
        <li><b>Effets</b> : temps, répétitions et envoi du delay, envoi et taille de la reverb, volume du synthé, volume des pads, volume général.</li>
        <li><b>Pad</b> : les potards du pad sélectionné.</li>
        <li><b>EQ</b> : 5 bandes (±15 dB), passe-bas, passe-haut, gain de sortie. SUSTAIN sur l'APC l'ouvre (maintenu = le temps de l'appui).</li>
        <li>Pages <b>TR-909</b> et <b>mixeur</b> (Maj + piste 1-4 sur l'APC).</li>
        <li>APC : boutons de piste 1-4 = Synthé / Effets / Pad / EQ. <b>Maj + potard</b> = réglage fin ; double-clic à l'écran = valeur par défaut.</li>
      </ul>`,
    perf: `
      <p>Effets en direct sur tout le mix, calés sur la grille. Maintiens pour les utiliser (Pump est en marche / arrêt).</p>
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
      <p>Tous les messages MIDI reçus de l'APC, pour vérifier la connexion.</p>
      <ul>
        <li>Les ports utilisés sont affichés en haut. Si les pads et le clavier sont inversés, utilise le bouton d'inversion.</li>
        <li>Rien n'arrive ? Débranche et rebranche l'APC, puis recharge la page (Windows peut bloquer son pilote MIDI).</li>
      </ul>`,
  },
};

export const helpHtml = id => HELP[lang]?.[id] ?? HELP.en[id] ?? '';
