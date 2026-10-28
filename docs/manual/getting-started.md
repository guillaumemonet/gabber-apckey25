# Getting started

[Contents](README.md) · [The APC Key 25 controller](controller.md) →

What you need, installation, starting the app, a first song in seconds and the interface language.

## Requirements

- An **Akai APC Key 25**, mk1 or mk2. It is optional: everything also works with mouse and computer keyboard.
- **Google Chrome**, **Microsoft Edge** or **Firefox** (108 or later). Safari does not support Web MIDI.
- **Python 3**, only to serve the page locally (Web MIDI requires `localhost` or HTTPS).
- **WebGL** (in every recent browser) for the 3D modes and the filters of the visualizer; without it, the 2D modes still work.

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

The header shows **1 device connected** with a green dot once the controller is detected; click it to see the device list (APC Key 25 mk1 or mk2, other MIDI devices).

## New song: start from a style

**New song…** (header, or the plugin bar, Tools group) starts a song in a few seconds.

[![New song window: style, tempo, progression, the parts of the Club plan and what is filled in](../screenshots/start-en.png)](../screenshots/start-en.png)

1. **Style**: it sets the tempo, the chord progression, the kick (kick designer preset), the drum pattern, the bass line, the chord and lead sounds. The **tempo** and the **chord progression** can be changed before creating.

   | Style | Tempo | Kick | Bass | Melody |
   |---|---|---|---|---|
   | Early hardcore | 175 | Early | the kick | riff, early hoover |
   | Gabber (Rotterdam) | 185 | Rotterdam | the kick | riff, hoover |
   | Anthem / mainstream | 190 | Mainstream | held sub in breaks | anthem, hardstyle lead |
   | Frenchcore | 200 | Frenchcore | offbeat | riff, screech |
   | Uptempo | 210 | Uptempo | the kick | dense riff, screech |
   | Industrial | 160 | Industrial | the kick | sparse riff, alarm |
   | Terror | 240 | Terror | the kick | dense riff, screech |
   | Happy hardcore | 175 (major key) | 909 | octaves | dense anthem, supersaw |
   | Rave | 145 | 909 | walk (reese) | riff, mentasm |
   | Hardstyle | 150 | Raw | reverse bass | anthem, hardstyle lead |
   | Breizhcore | 190 | Mainstream | offbeat | the tune of the Breizh generator |
   | Dark hardcore | 170 (F minor, G♭ and E) | Dark (long tail on F) | the kick | riff, hoover, from the intro |

2. **Plan**: **Club** (intro 16, build-up 16, drop 32, break 32, build-up 16, drop 32, outro 16: about 3:30 at 190 BPM), **Short** (a sketch of about 1:20) **DJ** (32-bar intro and outro, kick and drums only, for mixing) or **Chained drops** (melodic intro without kick, drops relaunched by cuts, a single short break: the plan of Dark hardcore, offered when it is picked). Each part (Intro, Build-up, Drop, Break, Cut, Outro) has its length (1 to 32 bars; a **Cut** of 1 or 2 bars stops the kick, drums and bass to relaunch the next drop); ↑ / ↓ move it, ✕ removes it, **Add a part** adds one. The total length is shown.
3. **Fill in** (all ticked by default):
   - **Kick**: a kick melody (one kick per beat, on the roots of the chords) in the intro, drops and outro;
   - **Drums**: hats and claps from the "Anthem drums" or "Early hardcore" banks, a crash at the start of each drop;
   - **Bass**: the bass generator line in the drops (the anthem sub in the breaks); for the styles where the kick tail is the bass, the box is unticked: tick it to add an offbeat bass in the drops anyway;
   - **Chords**: build-ups, drops and breaks;
   - **Lead**: drops, and a sparser version in the breaks;
   - **Build-ups**: the **build-up designer** right before each drop (rising noise and tone, snare and kick rolls, sub drop, impact, rising filter on the other tracks, silence before the drop).
4. **Create the song** replaces the timeline (after a confirmation; **Ctrl+Z** brings it back in one go): one named track per element, one block per part, a **marker** at the start of each part. The **Generator**, the **kick designer** and the **keyboard synth** take the settings of the style: regenerate a melody or a bass line, change the kick, everything is then edited as usual.

[![The song created in the timeline: named tracks, kick melody, drums, chords, lead, build-up elements before the drop, markers for each part](../screenshots/start-song-en.png)](../screenshots/start-song-en.png)

## AI composer (optional)

**AI composer** (plugin bar, Tools group) composes a song from a request in a few words, for example "dark frenchcore at 200 BPM, a long melancholic break with strings, a very distorted kick". A language model running **on your computer** writes a **song plan** with the tools of the studio: style, tempo, chord progression, kick settings, drums, bass, sounds, parts and what plays in each. Nothing is sent over the Internet.

[![AI composer window: the request, then the proposed plan with its parts, its sounds and the Change, Another version and Create the song buttons](../screenshots/ai-en.png)](../screenshots/ai-en.png)

### Installing the AI server

The AI server is a Docker container, installed once. GabberKey works without it: only this window needs it.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/). With an NVIDIA graphics card, also install its latest driver: Docker uses it directly.
2. In the GabberKey folder, run:

   ```
   docker compose -f ai/docker-compose.yml up -d
   ```

   The first start downloads the server (about 2 GB) and the model (`qwen2.5:7b`, about 4.7 GB, Apache 2.0 license). The server then restarts by itself with Docker.
3. Without an NVIDIA graphics card, the model runs on the processor, more slowly (one to two minutes per plan):

   ```
   docker compose -f ai/docker-compose.yml -f ai/docker-compose.cpu.yml up -d
   ```

With an 8 GB graphics card, a plan comes in 3 to 10 seconds (the very first request loads the model and takes longer). To stop the server: `docker compose -f ai/docker-compose.yml down`; to also delete the downloaded model, add `-v`.

### Installing the music AI (optional)

The **music AI** writes the **lead** and the **bass line** of the song itself: it is a model trained on MIDI music ([Anticipatory Music Transformer](https://github.com/jthickstun/anticipation), Stanford, Apache 2.0 license). It is given the chords and the kick of the plan; it writes a part that goes with them, note by note. Without it, the generators of the studio write the melody.

It needs an NVIDIA graphics card and about **11 GB** of disk (the container with PyTorch, about 9 GB, built on the spot; the model, 1.4 GB, downloaded on the first start):

```
docker compose -f ai/docker-compose.yml --profile music up -d
```

A lead takes from 10 seconds to about a minute (dense riffs take longest), a bass line 10 to 30 seconds.

### Composing

1. **AI server** and **Model**: `http://localhost:11434` and `qwen2.5:7b` by default. **Test** checks that the server answers and that the model is there. Another model of the Ollama library can be used: download it with `docker exec gabberkey-ai-ollama-1 ollama pull <model>`, then type its name.
2. **Your request**, a **Style** if you want to impose one, then **Compose**. The progress is shown; **Stop** gives up the request.
3. The plan is **checked** before it is shown: a value the studio does not know is replaced by the style's (the number is shown, the details on hover), a song with no drop gets one, and the bass does not play in the styles where the kick tail is the bass, unless the request wants one. The summary gives the style, tempo, chords, length, sounds and each part with what plays in it.
4. **Change**: describe the change in your words ("a longer break", "no bass in the first drop", "faster"); the AI sends back the changed plan. **Another version** asks for the same song again.
5. **Create the song** builds it like [New song](#new-song-start-from-a-style): the timeline is replaced (**Ctrl+Z** brings it back), the Generator, the kick designer and the keyboard synth take the settings of the plan.

With **Melody and bass written by the music AI** (ticked by default, the state of the music AI is shown next to it), "Create the song" first has it write the lead and the bass of each chord progression, with the progress; the lead style chosen by the plan guides its writing (dense 16th-note riff, anthem melody, arpeggio, call and response), and each creation gives a new melody. The notes stay in the Generator, editable in the piano roll. Without the music AI (unticked, missing or not answering), the generators of the studio write the melody and the bass, in the style and density chosen by the AI. The model is small: it may forget a build-up or misread a request. The plan is a starting point, edited like any other song.

## Language

The interface follows the browser language: French if the browser is set to French, English otherwise. To force a language, add `?lang=en` or `?lang=fr` to the address.

## Hardware compatibility

GabberKey is developed and tested with an **Akai APC Key 25 mk1**. The **mk2** is supported from Akai Professional's MIDI documentation, but has not been tested on a real unit yet. Everything also works with the mouse and the computer keyboard.

---

[Contents](README.md) · [The APC Key 25 controller](controller.md) →
