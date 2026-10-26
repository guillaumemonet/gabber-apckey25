// Instrument échantillon : un bloc de notes qui joue le son d'un pad à la hauteur de chaque note (modules de tracker
// importés, js/tracker.js). Le pad garde ce qu'il faut pour le jouer en note : pad.smp = { root, loop } (note MIDI jouée
// à vitesse normale, boucle [début, fin[ en secondes ou null). Chaque note peut porter ses volumes et écarts de hauteur
// en cours de note (pv, pp), son départ dans le son (ofs) et son panoramique (pan).

const GAIN = 0.35;       // plusieurs voies de tracker qui jouent ensemble : de la marge avant la saturation
const RELEASE = 0.015;   // une note de tracker s'arrête net

/** Réglages d'une note du bloc : son et réglages du pad joué (null si le pad manque ou n'est pas encore décodé). */
export function sampleVoice(pad) {
  if (!pad?.buffer) return null;
  return { buffer: pad.buffer, root: pad.smp?.root ?? 60, loop: pad.smp?.loop ?? null };
}

/** pad.smp lu d'un fichier : { root, loop } valides, sinon null. */
export function cleanSmp(s) {
  if (!s || typeof s !== 'object') return null;
  const root = Number.isFinite(s.root) ? Math.min(180, Math.max(-60, s.root)) : 60;
  const ok = Array.isArray(s.loop) && s.loop.length === 2 && s.loop.every(Number.isFinite) && s.loop[0] >= 0 && s.loop[1] > s.loop[0];
  return { root, loop: ok ? [s.loop[0], s.loop[1]] : null };
}

export class SampleSynth {
  constructor(ctx, out) {
    this.ctx = ctx;
    this.out = out;            // sortie par défaut (écoute dans le piano roll)
    this.voices = new Map();   // clé -> voix
    this.all = new Set();
  }

  isMono() { return false; }

  // V : sampleVoice(pad) ; ev : { pv, pp, ofs, pan } de la note, bd = durée d'un temps, skip = secondes déjà passées
  // (lecture partie du milieu de la note).
  noteOn(note, vel = 0.85, when, key = note, V, out, from, ev = {}) {
    out ??= this.out;
    if (!V?.buffer || !out) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const t0 = Math.max(when ?? now, now);
    const bd = ev.bd ?? 0.5, skip = ev.skip ?? 0;
    this.kill(key, t0);
    const src = ctx.createBufferSource();
    src.buffer = V.buffer;
    const base = 2 ** ((note - V.root) / 12);
    const rateAt = semis => base * 2 ** (semis / 12);
    if (V.loop && V.loop[1] - V.loop[0] > 0.0005) { src.loop = true; src.loopStart = V.loop[0]; src.loopEnd = V.loop[1]; }
    const amp = ctx.createGain();
    const pan = ev.pan && ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = ev.pan;
    src.connect(amp);
    (pan ? amp.connect(pan) : amp).connect(out);
    // Volumes et hauteurs au fil de la note : ceux d'avant le départ réel donnent la valeur de départ.
    const timed = (param, pts, first, map) => {
      let v = first;
      for (const [dt, x] of pts ?? []) if (dt * bd <= skip) v = x;
      param.setValueAtTime(map(v), t0);
      for (const [dt, x] of pts ?? []) if (dt * bd > skip) param.setValueAtTime(map(x), t0 + dt * bd - skip);
    };
    timed(amp.gain, ev.pv, vel, v => v * GAIN);
    timed(src.playbackRate, ev.pp, 0, rateAt);
    // Départ dans le son : décalage de la note (9xx) puis temps déjà passé, à la vitesse de départ.
    let offset = (ev.ofs ?? 0) + skip * base;
    if (src.loop && offset >= V.loop[1]) offset = V.loop[0] + (offset - V.loop[0]) % (V.loop[1] - V.loop[0]);
    if (offset >= V.buffer.duration) return;
    src.start(t0, offset);
    const v = { key, src, amp, nodes: [src, amp, pan].filter(Boolean), released: false };
    src.onended = () => { this.all.delete(v); for (const n of v.nodes) n.disconnect(); if (this.voices.get(key) === v) this.voices.delete(key); };
    this.voices.set(key, v);
    this.all.add(v);
  }

  release(v, t, fade = RELEASE) {
    if (v.released) return;
    v.released = true;
    v.amp.gain.cancelScheduledValues(t);
    v.amp.gain.setTargetAtTime(0, t, fade / 3);
    try { v.src.stop(t + fade * 2); } catch { /* déjà arrêté */ }
  }

  noteOff(note, immediate = false, when, key = note) {
    const v = this.voices.get(key);
    if (!v) return;
    this.voices.delete(key);
    this.release(v, Math.max(when ?? this.ctx.currentTime, this.ctx.currentTime), immediate ? 0.005 : RELEASE);
  }

  kill(key, t) {
    const v = this.voices.get(key);
    if (!v) return;
    this.voices.delete(key);
    this.release(v, t, 0.003);
  }

  allNotesOff() {
    for (const v of this.voices.values()) this.release(v, this.ctx.currentTime, 0.005);
    this.voices.clear();
  }

  // Coupe tout de suite les voix dont la clé commence par `prefix` (même programmées plus tard).
  cut(prefix) {
    const now = this.ctx.currentTime;
    for (const v of this.all) {
      if (!String(v.key).startsWith(prefix)) continue;
      v.released = false;
      this.release(v, now, 0.003);
      if (this.voices.get(v.key) === v) this.voices.delete(v.key);
    }
  }
}
