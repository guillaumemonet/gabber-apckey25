// Sidechain : chaque kick fait « respirer » les sons tenus (synthé, nappes, basses, leads).
// Chaque kick lance une petite enveloppe (tampon audio) ; les enveloppes s'additionnent, passent dans un
// façonneur qui les limite à « profondeur », et baissent le gain des bus visés, précisément à l'instant du kick.
// Sources : les kicks (909, pads et blocs classés « kick », kicks connus des boucles de GabberKey)
// ou chaque temps de la grille (pour les autres boucles de batterie).

export const SC_SOURCES = ['kicks', 'beat'];
// Catégories de sons baissés par le sidechain (jamais les kicks ni la batterie).
export const SC_DUCKED = new Set(['bass', 'pad', 'lead', 'keys', 'voice']);

export function defaultScState() {
  return { on: false, source: 'kicks', depth: 0.7, release: 0.22, synth: true, samples: true };
}

export function mergeScState(saved) {
  const d = defaultScState();
  if (!saved || typeof saved !== 'object') return d;
  const num = (v, lo, hi, def) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
  return {
    on: saved.on === true,
    source: SC_SOURCES.includes(saved.source) ? saved.source : d.source,
    depth: num(saved.depth, 0, 1, d.depth),
    release: num(saved.release, 0.05, 0.6, d.release),
    synth: saved.synth !== undefined ? !!saved.synth : d.synth,
    samples: saved.samples !== undefined ? !!saved.samples : d.samples,
  };
}

const ATTACK = 0.003;
const HOLD = 0.015;

export class Sidechain {
  constructor(engine, getState) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    const ctx = this.ctx;
    // Bus baissés : synthé, pads mélodiques, blocs mélodiques de la timeline.
    this.synth = ctx.createGain();
    this.pads = ctx.createGain();
    this.tl = ctx.createGain();
    this.acid = ctx.createGain();   // TB-303 : une basse, baissée avec les sons mélodiques
    this.osc = ctx.createGain();    // synthé à oscillateurs : baissé comme le synthé
    this.env = ctx.createGain();
    this.shaper = ctx.createWaveShaper();
    this.env.connect(this.shaper);
    this.synthAmt = ctx.createGain();
    this.sampleAmt = ctx.createGain();
    this.shaper.connect(this.synthAmt).connect(this.synth.gain);
    this.synthAmt.connect(this.osc.gain);
    this.shaper.connect(this.sampleAmt);
    this.sampleAmt.connect(this.pads.gain);
    this.sampleAmt.connect(this.tl.gain);
    this.sampleAmt.connect(this.acid.gain);
    this.pending = new Set();
    this.onKick = () => {};             // chaque kick (visualiseur) ; branché par l'application
    this.isRunning = () => false;       // la grille tourne (timeline, 909, boucle) ; branché par l'application
    this.loopKicks = () => [];          // boucles de pads qui contiennent des kicks ; branché par l'application
    this.marks = new Map();             // boucle -> dernier temps programmé
    this.lastBeat = null;
    this.apply();
    this.timer = setInterval(() => this.tick(), 25);
  }

  get st() { return this.getState(); }

  // Réglages : profondeur (courbe du façonneur), relâche (forme de l'enveloppe), bus visés.
  apply() {
    const s = this.st;
    const n = 1025;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = x > 0 ? -s.depth * Math.min(1, x) : 0;
    }
    this.shaper.curve = curve;
    if (this.bufRelease !== s.release) {
      this.bufRelease = s.release;
      const sr = this.ctx.sampleRate;
      const len = Math.ceil((ATTACK + HOLD + s.release) * sr) + 1;
      const buf = this.ctx.createBuffer(1, len, sr);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        if (t < ATTACK) d[i] = t / ATTACK;
        else if (t < ATTACK + HOLD) d[i] = 1;
        else d[i] = 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (t - ATTACK - HOLD) / s.release));   // remontée douce
      }
      d[len - 1] = 0;
      this.buffer = buf;
    }
    const t = this.ctx.currentTime;
    this.synthAmt.gain.setTargetAtTime(s.on && s.synth ? 1 : 0, t, 0.01);
    this.sampleAmt.gain.setTargetAtTime(s.on && s.samples ? 1 : 0, t, 0.01);
  }

  // Un kick à l'instant `time` (horloge audio). En mode « chaque temps », seuls les temps de la grille comptent.
  kick(time = this.ctx.currentTime) {
    this.onKick(time);
    if (this.st.source !== 'kicks') return;
    this.duck(time);
  }

  duck(time) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    src.connect(this.env);
    src.onended = () => { this.pending.delete(src); src.disconnect(); };
    // Déclenché un poil avant le kick : le son est déjà baissé quand l'attaque arrive.
    src.start(Math.max(this.ctx.currentTime, time - ATTACK));
    this.pending.add(src);
  }

  // Arrêt du transport : les enveloppes programmées dans le futur sont annulées.
  clear() {
    for (const src of this.pending) { try { src.stop(); } catch { /* déjà fini */ } }
    this.pending.clear();
    this.lastBeat = null;
    this.marks.clear();
  }

  // Mode « chaque temps » : chaque temps de la grille. Mode « kicks » : les kicks des boucles jouées sur les pads
  // (la timeline et la 909 programment eux-mêmes leurs kicks).
  tick() {
    const s = this.st;
    const e = this.engine;
    const now = this.ctx.currentTime;
    if (!s.on || e.origin === null) { this.lastBeat = null; this.marks.clear(); return; }
    const bd = 60 / e.bpm;
    const horizon = now + 0.1;
    if (s.source === 'beat') {
      if (!this.isRunning()) { this.lastBeat = null; return; }
      let next = this.lastBeat === null ? e.gridTime(4) : this.lastBeat + bd;
      if (next < now - 0.05) next = e.gridTime(4);
      while (next < horizon) {
        this.duck(next);
        this.lastBeat = next;
        next += bd;
      }
      return;
    }
    // Boucles des pads : { key, startBeat, beats (longueur), kicks (en temps) }, positions en temps de la grille.
    const loops = this.loopKicks();
    const seen = new Set();
    const bNow = (now - e.origin) / bd;
    const bEnd = (horizon - e.origin) / bd;
    for (const L of loops) {
      seen.add(L.key);
      let from = this.marks.get(L.key);
      if (from === undefined || from < bNow - 0.5) from = bNow - 1e-3;
      for (let r = Math.max(0, Math.floor((from - L.startBeat) / L.beats)); L.startBeat + r * L.beats <= bEnd; r++) {
        for (const k of L.kicks) {
          const b = L.startBeat + r * L.beats + k;
          if (b > from && b <= bEnd) this.duck(e.origin + b * bd);
        }
      }
      this.marks.set(L.key, bEnd);
    }
    for (const key of [...this.marks.keys()]) if (!seen.has(key)) this.marks.delete(key);
  }
}
