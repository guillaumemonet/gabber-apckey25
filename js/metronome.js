// Métronome : un clic sur chaque temps de la grille (celle des boucles et de la timeline), plus aigu sur le 1er temps
// de la mesure. Il sort directement vers les haut-parleurs : il n'est ni dans l'export WAV, ni dans les enregistrements.
// Décompte : une mesure de clics avant un enregistrement.

export function defaultMetroState() { return { on: false, when: 'always', countIn: true, vol: 0.6 }; }
export function mergeMetroState(saved) {
  const d = defaultMetroState();
  if (!saved || typeof saved !== 'object') return d;
  return {
    on: saved.on === true,
    when: saved.when === 'rec' ? 'rec' : 'always',
    countIn: saved.countIn !== false,
    vol: Number.isFinite(saved.vol) ? Math.min(1, Math.max(0, saved.vol)) : d.vol,
  };
}

export class Metronome {
  // shouldTick() : le métronome doit-il battre en ce moment (allumé, et pendant l'enregistrement s'il le faut).
  constructor(engine, getState, shouldTick) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    this.shouldTick = shouldTick;
    this.out = this.ctx.createGain();
    this.out.connect(this.ctx.destination);
    this.last = -Infinity;    // instant du dernier clic programmé
    this.beats = [];          // clics programmés : { time, beat } (voyants)
    this.timer = setInterval(() => this.tick(), 25);
  }

  get st() { return this.getState(); }

  click(time, accent) {
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'square';
    o.frequency.value = accent ? 1760 : 1175;
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(this.st.vol * (accent ? 0.5 : 0.32), time + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0005, time + 0.05);
    o.connect(g).connect(this.out);
    o.start(time);
    o.stop(time + 0.06);
    o.onended = () => g.disconnect();
  }

  // Programme les clics des prochains temps, calés sur la grille du moteur.
  tick() {
    if (!this.shouldTick()) return;
    const e = this.engine, now = this.ctx.currentTime;
    const bd = 60 / e.bpm;
    if (e.origin === null) e.origin = now + 0.05;
    let n = Math.ceil((now + 0.01 - e.origin) / bd - 1e-6);
    for (; e.origin + n * bd < now + 0.12; n++) {
      const time = e.origin + n * bd;
      if (time < this.last + bd * 0.5) continue;   // déjà programmé (ou tempo qui vient de changer)
      const beat = ((n % 4) + 4) % 4;
      this.click(time, beat === 0);
      this.last = time;
      this.beats.push({ time, beat });
    }
    this.beats = this.beats.filter(b => b.time > now - 1);
  }

  // Temps en cours (0-3) pour les voyants, ou -1.
  current() {
    const now = this.ctx.currentTime;
    let cur = null;
    for (const b of this.beats) if (b.time <= now && now - b.time < 60 / this.engine.bpm) cur = b;
    return cur ? cur.beat : -1;
  }

  // Décompte d'une mesure : 4 clics, le premier aigu ; renvoie l'instant (horloge audio) du temps qui suit.
  countIn() {
    const bd = 60 / this.engine.bpm;
    const t0 = this.ctx.currentTime + 0.1;
    for (let k = 0; k < 4; k++) {
      this.click(t0 + k * bd, k === 0);
      this.beats.push({ time: t0 + k * bd, beat: k });
    }
    this.last = t0 + 3 * bd;
    return t0 + 4 * bd;
  }
}
