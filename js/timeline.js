// Timeline : des pistes découpées en mesures et en temps, sur lesquelles on pose des clips audio
// (un son d'une banque, ou l'enregistrement d'un outil). Lecture calée sur le tempo global.

export const TL_TRACKS = 6;
export const BEATS_PER_BAR = 4;

export function defaultTlState() {
  return {
    bars: 8,
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
  for (const k of ['bars', 'loop', 'playhead', 'source', 'armed']) if (saved[k] !== undefined) base[k] = saved[k];
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
  clipBeats(clip) {
    const buf = this.bufferOf(clip.sampleId);
    return buf ? buf.duration / this.beatDur : 1;
  }

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
    for (const track of st.tracks) {
      if (track.mute) continue;
      for (const clip of track.clips) {
        const buf = this.bufferOf(clip.sampleId);
        if (!buf) continue;
        const end = clip.start + buf.duration / this.beatDur;
        if (end <= beat || clip.start >= len) continue;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const gain = this.ctx.createGain();
        gain.gain.value = clip.gain ?? 1;
        src.connect(gain).connect(this.output);
        src.start(time + Math.max(0, clip.start - beat) * this.beatDur, Math.max(0, beat - clip.start) * this.beatDur);
        src.onended = () => { this.sources = this.sources.filter(s => s.src !== src); };
        this.sources.push({ src, gain });
      }
    }
    const endTime = time + (len - beat) * this.beatDur;
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
