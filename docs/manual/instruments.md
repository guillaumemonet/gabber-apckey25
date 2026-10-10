# Instruments

← [Timeline, library and piano roll](timeline.md) · [Contents](README.md) · [Generator: chords and melody](generator.md) →

TR-909, TB-303, layered synth, oscillator synth and kick designer.

## TR-909

[![TR-909 window: 16-step sequencer, and the knobs with per-instrument distortion](../screenshots/tr-en.png)](../screenshots/tr-en.png)

A Roland TR-909 emulation with its 11 instruments (bass drum, snare, 3 toms, rim shot, clap, closed / open hi-hat, crash, ride). Each one is synthesised live, like the analogue circuits of the original.

**Knobs** (under the grid of the TR-909 window; also on the APC knobs when the window is active, or with Shift + PLAY):

| K1-K4 | K5 | K6 | K7 | K8 |
|---|---|---|---|---|
| Parameters of the selected instrument (e.g. BD: Tune, Attack, Decay, Level) | **Drive**: distortion amount | **Shape**: Soft, Hard, Tube, Fold (wavefolder), Crush (bitcrusher) | Shuffle | 909 volume |

Every instrument has its own distortion. The bass drum starts with a "Tube" drive for the gabber sound. The accent amount is set with the slider on screen.

**Sound kits** (menu above the grid): the settings of the 11 instruments at once, distortion included: **Hardcore** (Gabber, Rotterdam, Terror, Industrial), **Classic** (Clean 909, House, Techno) and **FX** (Lo-fi crush, Folded). Turning a knob makes the sound custom; type a name, choose a category and **Save** to keep your own (★ in the menu), the bin deletes it. The patterns are not part of a kit.

**Sequencer**: 16 steps, 8 patterns, 4 of them preset (gabber, rave, breakbeat, kick roll). It runs on the same tempo and bar grid as the loops, so it stays in sync with them. A pattern change waits for the next bar. On screen, click a step to cycle note → accent → off, and click an instrument name to play and select it.

**APC grid in 909 mode** (Shift + PLAY):

| Row | Pads |
|---|---|
| 1-2 | The 16 steps of the selected instrument (red = playhead, green = note, yellow = accent) |
| 3 | BD, SD, LT, MT, HT, RS, HC, CH: play and select |
| 4 | OH, CR, RD, then **Accent** (new steps are accented), **Clear** (erases the instrument), **Mute** |
| 5 | Patterns 1-8 |

Pressing a SCENE LAUNCH button brings the grid back to the sampler pads.

## TB-303

[![TB-303 window: grid with octaves, accents and slides, and its knobs](../screenshots/acid-en.png)](../screenshots/acid-en.png)

An acid bass line in the style of the Roland TB-303, synthesised live: oscillator (saw or square), resonant 24 dB low-pass filter driven by an envelope, accent, slide, then distortion with the 909's 5 shapes.

- **Grid**: 16 steps (16th notes) × one octave from F to high F. Click a cell to place a note, again for a rest. The **Oct + / Oct −** rows shift a step by an octave, **Accent** makes it louder with a snappier filter, **Slide** glides into the next note without retriggering the envelope (the famous "squelch").
- **Sound presets**: 15 ready-made sounds in 4 categories: **Acid** (classic, squelch, screamer, Rotterdam, hoover), **Bass** (rubber, sub, dark roller), **Lead** (saw lead, squeal, gabber lead) and **FX** (laser, siren, crushed, zap). Turning a knob makes the sound custom; give it a name and a category and **Save** it to keep your own presets (★), saved with the session and in the TB-303 settings files.
- **Knobs**: tune, cutoff, resonance, envelope amount, decay, accent, **slide** (glide time between linked notes), drive, shape, volume. On the APC, **Shift + REC** opens the TB-303 knob page (K1 cutoff … K8 volume).
- **8 patterns**, 4 of them ready-made in F minor (acid gabber, rolling 16ths, squelchy slides, minimal offbeat). A pattern change waits for the next bar. **Random** writes a new acid line in F minor; **Clear** empties the pattern.
- **Follow 909** (on by default): the 303 plays on the TR-909's clock, shuffle included, and ▶ starts both. Turn it off to play the 303 on its own, on the loops' bar grid.
- **Step entry**: turn on **Step entry** and play the line on the APC keyboard (or the computer keyboard). Each note goes into the selected step and the cursor moves on; a strong hit adds an accent, **Rest** leaves a step empty, clicking a step number moves the cursor.
- The 303 has its own **mixer channel** (K5 on the mixer knob pages), is ducked by the **sidechain** with the melodic sounds, is stored in **scenes** (pattern and transport), and can be **recorded** into the timeline as audio (choose TB-303 as the source).

## Synth

[![Synth window: families, presets, expression knobs, chords and arpeggiator](../screenshots/synth-en.png)](../screenshots/synth-en.png)

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

**Your presets**: the menu under the presets lists them all by family. Turning a knob makes the sound custom; type a name, choose a category and **Save** to keep your own (★ in the menu), the bin deletes it. A preset of yours keeps its starting sound and your 8 knobs.

### Chords and arpeggiator

Below the knobs of the Synth window:
- **Chords**: one key plays a whole chord: minor, major, sus2, sus4, minor 7th, fifth or octave. **In key (F minor)** builds the right chord of the scale on each key (F → Fm, G# → Ab, C# → Db, D# → Eb…), so everything stays in tune with the banks.
- **Arpeggio**: the held notes (or the chord) are played one after another, in time with the tempo and on the same grid as the loops. Speed 1/8, 1/16 or 1/32; order up, down, up-down, random or as played; range 1 to 3 octaves; note length; **Hold** keeps the arpeggio going after the keys are released (the next key starts a new one).
- On the APC: **Shift + F#** = next chord type, **Shift + G#** = arpeggio on / off, **Shift + A#** = arpeggio speed.

When the timeline records the synth, the chords and the arpeggio notes are recorded too, in the note block of the take.

## Oscillator synth

[![Oscillator synth: presets, three oscillators, noise / ring / FM / pitch envelope, filter, two envelopes, tempo-synced LFO and voice settings](../screenshots/osc-en.png)](../screenshots/osc-en.png)

An analogue-style synth to build your own sounds, next to the layered synth.

- **Which synth the keyboard plays**: the APC keyboard (and the computer keyboard) plays the synth of the **active window**. Click the Oscillator synth window to play it, click the Synth window to go back (the **Keyboard here** button shows which one is played). Chord mode and arpeggiator work with both.
- **3 oscillators**: saw, pulse (with its **width**), triangle or sine; octave, semitone, fine tune, level, **unison** (up to 7 detuned copies spread in stereo) and their detune.
- **Noise, ring modulation** (osc 1 × osc 2), **FM** (osc 3 modulates osc 1, for screeches and bells) and a **pitch envelope** (each note starts higher or lower and slides to its pitch: lasers, hoovers).
- **Filter**: low-pass, high-pass or band-pass, **12 or 24 dB**, cutoff, resonance, envelope amount (negative closes it), key tracking, drive before the filter.
- **Two ADSR envelopes** (filter and volume), drawn above their knobs.
- **Tempo-synced LFO**: sine, triangle, saw or square, from 1/1 to 1/32 with triplets, on the pitch, the filter, the pulse width or the volume.
- **Voice**: polyphonic (8 notes), mono or legato (no new attack between linked notes), glide, stereo width, volume.
- **12 presets**: hoover, FM screech, reese, gabber lead, acid bass, sub, supersaw, pluck, brass stab, pad, wobble, laser, as buttons and in a menu by category (**Lead**, **Bass**, **Pad**, **FX**). Turning a knob makes the sound custom; type a name, choose a category and **Save** to keep your own (★ in the menu), the bin deletes it.
- **APC knobs**: K1-K8 = cutoff, resonance, filter envelope, filter decay, drive, LFO depth, release, volume (marked on screen) while the window is active.
- It has its own **mixer channel** (K7 on the mixer pages), is wired in the **Patch** window and ducked by the **sidechain** like the synth. What you record on it becomes a note block with its sound, and in the **piano roll** any note block can use one of its presets.

## Kick designer

[![Kick designer: presets, 12 knobs and the waveform](../screenshots/kick-en.png)](../screenshots/kick-en.png)

Build your own gabber / hardcore kick, computed by the browser in a few milliseconds from 12 knobs:

- **Presets**: Rotterdam, Mainstream, Uptempo, Raw, Terror, Industrial, Early, Frenchcore (buttons), also in a menu by category (Gabber, Hardcore, Mainstream / uptempo) with your own kicks. Turning a knob makes the sound custom; type a name, choose a category and **Save** to keep your own (★ in the menu), the bin deletes it.
- **Tail**: **Tune** (note of the tail, in tune with the banks), **Punch** and **Sweep** (how high the pitch starts and how fast it drops), **Tail drop** (how far it keeps falling), **Length**, **Zaag** (sawtooth for the raw, buzzing tail of uptempo kicks).
- **Distortion**: **Drive** and **Shape** (the 909's 5 shapes), then **Formant** and **Bite**, which make the tail "talk".
- **Attack**: **Click** (noise) and **Attack** (short punchy layer).
- **Auto-listen** plays the kick each time you release a knob; the waveform and the length are shown.
- **→ Pad** puts it on the selected pad, **→ Library** adds it to the **Kicks** category of the library (drag it onto the timeline; right-click it there to remove it), **⤓ WAV** downloads it. Your kicks trigger the sidechain like any other kick.

---

← [Timeline, library and piano roll](timeline.md) · [Contents](README.md) · [Generator: chords and melody](generator.md) →
