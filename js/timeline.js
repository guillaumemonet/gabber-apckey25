// Timeline façon eJay : des pistes découpées en mesures, sur lesquelles on pose des blocs
// (un son de la bibliothèque, ou l'enregistrement d'un outil). Lecture calée sur le tempo global.
// Un bloc : { id, start, len (en temps), sampleId, name, cat, color, bpm, loop }.
// - bpm : tempo d'origine du son ; il est lu plus vite / plus lentement pour suivre le tempo global.
// - loop : le son se répète pour remplir toute la longueur du bloc.

export const TL_TRACKS = 16;
export const BEATS_PER_BAR = 4;

export function defaultTlState() {
  return {
    bars: 32,
    zoom: 64,           // largeur d'une mesure (px)
    loop: true,
    playhead: 0,        // en temps (noires)
    source: 'master',   // outil enregistré : master, pads, synth, tr
    armed: 0,           // piste qui reçoit l'enregistrement
    tracks: Array.from({ length: TL_TRACKS }, () => ({ mute: false, clips: [] })),
  };
}

export function mergeTlState(saved) {
  const base = defaultTlState();
  if (!saved) return base;
  for (const k of ['bars', 'zoom', 'loop', 'playhead', 'source', 'armed']) if (saved[k] !== undefined) base[k] = saved[k];
  base.bars = Math.max(base.bars, 16);
  if (Array.isArray(saved.tracks)) {
    base.tracks = base.tracks.map((tr, i) => ({ mute: !!saved.tracks[i]?.mute, clips: Array.isArray(saved.tracks[i]?.clips) ? saved.tracks[i].clips : [] }));
  }
  return base;
}

export class Timeline {
  // bufferOf(sampleId) -> AudioBuffer | null ; output : nœud de sortie (voie « Timeline » du mixeur).
  constructor(engine, getState, bufferOf, output) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    this.bufferOf = bufferOf;
    this.output = output;
    this.playing = false;
    this.recording = false;   // pendant un enregistrement : lecture linéaire, sans boucle
    this.sources = [];
    this.cycles = [];         // débuts de lecture programmés : { time, beat }
    this.timer = null;
    this.onStop = () => {};
  }

  get st() { return this.getState(); }
  get beatDur() { return 60 / this.engine.bpm; }
  get length() { return this.st.bars * BEATS_PER_BAR; }
  // Durée naturelle du son, en temps (au tempo d'origine du son s'il en a un).
  naturalBeats(clip) {
    const buf = this.bufferOf(clip.sampleId);
    if (!buf) return BEATS_PER_BAR;
    return clip.bpm ? buf.duration * clip.bpm / 60 : buf.duration / this.beatDur;
  }
  clipBeats(clip) { return clip.len ?? Math.max(1, Math.ceil(this.naturalBeats(clip))); }

  // Démarre la lecture au temps `beat` ; renvoie l'instant (horloge audio) où ce temps sonne.
  play(beat = this.st.playhead) {
    this.stop(true);
    const start = this.ctx.currentTime + 0.08;
    // Boucles des pads et 909 calées sur les mesures de la timeline.
    this.engine.origin = start - beat * this.beatDur;
    this.playing = true;
    this.cycles = [];
    this.scheduleCycle(start, beat);
    return start;
  }

  scheduleCycle(time, beat) {
    const st = this.st;
    const len = this.length;
    this.cycles.push({ time, beat });
    if (this.cycles.length > 3) this.cycles.shift();
    const bd = this.beatDur;
    const endTime = time + (len - beat) * bd;
    for (const track of st.tracks) {
      if (track.mute) continue;
      for (const clip of track.clips) {
        const buf = this.bufferOf(clip.sampleId);
        if (!buf) continue;
        const end = clip.start + this.clipBeats(clip);
        if (end <= beat || clip.start >= len) continue;
        const rate = clip.bpm ? this.engine.bpm / clip.bpm : 1;
        const into = Math.max(0, beat - clip.start) * bd * rate;   // secondes déjà écoulées dans le son
        if (!clip.loop && into >= buf.duration) continue;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        if (clip.loop) { src.loop = true; src.loopStart = 0; src.loopEnd = buf.duration; }
        const gain = this.ctx.createGain();
        const level = clip.gain ?? 1;
        src.connect(gain).connect(this.output);
        const when = time + Math.max(0, clip.start - beat) * bd;
        let stopAt = time + (end - beat) * bd;
        if (st.loop && !this.recording) stopAt = Math.min(stopAt, endTime);
        gain.gain.setValueAtTime(level, when);
        gain.gain.setValueAtTime(level, Math.max(when, stopAt - 0.006));
        gain.gain.linearRampToValueAtTime(0, stopAt);   // fin du bloc sans clic
        src.start(when, clip.loop ? into % buf.duration : into);
        src.stop(stopAt + 0.01);
        src.onended = () => { this.sources = this.sources.filter(s => s.src !== src); };
        this.sources.push({ src, gain });
      }
    }
    clearTimeout(this.timer);
    if (this.recording) return;   // l'enregistrement continue au-delà de la fin
    const lead = (endTime - this.ctx.currentTime - 0.25) * 1000;
    if (st.loop) this.timer = setTimeout(() => { if (this.playing) this.scheduleCycle(endTime, 0); }, Math.max(0, lead));
    else this.timer = setTimeout(() => this.stop(), Math.max(0, (endTime - this.ctx.currentTime) * 1000));
  }

  // Position actuelle (en temps) de la tête de lecture.
  position() {
    if (!this.playing) return this.st.playhead;
    const now = this.ctx.currentTime;
    const cycle = [...this.cycles].reverse().find(c => c.time <= now) ?? this.cycles[0];
    return cycle.beat + Math.max(0, now - cycle.time) / this.beatDur;
  }

  stop(silent = false) {
    clearTimeout(this.timer);
    const t = this.ctx.currentTime;
    for (const { src, gain } of this.sources) {
      gain.gain.setTargetAtTime(0, t, 0.01);
      src.stop(t + 0.05);
    }
    this.sources = [];
    const was = this.playing;
    this.playing = false;
    if (was && !silent) this.onStop();
  }
}
