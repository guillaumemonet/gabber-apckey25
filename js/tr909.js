// Émulation Roland TR-909 : 11 instruments synthétisés en direct (comme les circuits analogiques
// de la machine) et séquenceur 16 pas calé sur le transport du moteur (même tempo et même mesure
// que les boucles des pads).
import { t } from './i18n.js';

// Paramètres propres à chaque instrument (K1-K4) ; tous ont en plus Drive et Shape (K5-K6).
export const TR_INSTR = [
  { id: 'bd', params: ['tune', 'attack', 'decay', 'level'] },
  { id: 'sd', params: ['tune', 'tone', 'snappy', 'level'] },
  { id: 'lt', params: ['tune', 'decay', 'level'] },
  { id: 'mt', params: ['tune', 'decay', 'level'] },
  { id: 'ht', params: ['tune', 'decay', 'level'] },
  { id: 'rs', params: ['level'] },
  { id: 'hc', params: ['level'] },
  { id: 'ch', params: ['decay', 'level'] },
  { id: 'oh', params: ['decay', 'level'] },
  { id: 'cr', params: ['tune', 'level'] },
  { id: 'rd', params: ['tune', 'level'] },
];
export const TR_GLOBALS = ['shuffle', 'volume'];   // K7-K8 ; l'accent se règle à l'écran
const DIST = ['drive', 'shape'];
export const SHAPES = ['soft', 'hard', 'tube', 'fold', 'crush'];
const PARAM_DEFAULTS = { tune: 0.5, attack: 0.5, decay: 0.5, level: 0.8, drive: 0, shape: 0, tone: 0.5, snappy: 0.6 };
const GLOBAL_DEFAULTS = { accent: 0.6, shuffle: 0, volume: 0.8 };
export const PATTERNS = 8;

const pct = v => `${Math.round(v * 100)}%`;

const shapeIndex = pos => Math.round(pos * (SHAPES.length - 1));

// Définitions des 8 potards de la page TR-909 : paramètres de l'instrument choisi (K1-K4),
// sa distorsion Drive / Shape (K5-K6), puis Shuffle et Volume (K7-K8). Valeurs = positions 0..1.
export function trKnobDefs(sel) {
  const inst = TR_INSTR.find(i => i.id === sel) ?? TR_INSTR[0];
  const def = p => ({ id: p, group: 'inst', label: `${inst.id.toUpperCase()} · ${t(`tr.p.${p}`)}`, min: 0, max: 1, def: PARAM_DEFAULTS[p], fmt: pct });
  const defs = inst.params.map(def);
  while (defs.length < 4) defs.push(null);
  defs.push(def('drive'), { ...def('shape'), steps: SHAPES.length, max: SHAPES.length - 1, fmt: v => t('tr.shapes')[v] });
  return [...defs, ...TR_GLOBALS.map(g => ({ id: g, group: 'global', label: t(`tr.p.${g}`), min: 0, max: 1, def: GLOBAL_DEFAULTS[g], fmt: pct }))];
}

const emptyPattern = () => Object.fromEntries(TR_INSTR.map(i => [i.id, new Array(16).fill(0)]));

// État par défaut, avec 4 patterns de départ (0 = silence, 1 = note, 2 = note accentuée).
export function defaultTrState() {
  const params = Object.fromEntries(TR_INSTR.map(i => [i.id, Object.fromEntries([...i.params, ...DIST].map(p => [p, PARAM_DEFAULTS[p]]))]));
  params.bd.drive = 0.45;   // grosse caisse saturée « tube » par défaut : le son gabber
  params.bd.shape = 0.5;
  const patterns = Array.from({ length: PATTERNS }, emptyPattern);
  const set = (pat, id, steps, v = 1) => steps.forEach(s => { patterns[pat][id][s] = v; });
  const all = [...Array(16).keys()];
  // 1 : gabber
  set(0, 'bd', [0, 4, 8, 12], 2); set(0, 'oh', [2, 6, 10, 14]); set(0, 'hc', [4, 12]);
  // 2 : rave
  set(1, 'bd', [0, 4, 8, 12], 2); set(1, 'sd', [4, 12]); set(1, 'ch', all.filter(s => s % 4 !== 2));
  set(1, 'oh', [2, 6, 10, 14]); set(1, 'rd', [0, 4, 8, 12]);
  // 3 : breakbeat
  set(2, 'bd', [0, 2, 10, 11]); set(2, 'sd', [7, 9, 15]); set(2, 'sd', [4, 12], 2); set(2, 'ch', all.filter(s => s % 2 === 0));
  // 4 : roll de grosse caisse
  set(3, 'bd', all); set(3, 'bd', [0, 4, 8, 12], 2); set(3, 'cr', [0]);
  return { params, globals: { ...GLOBAL_DEFAULTS }, patterns, pattern: 0, sel: 'bd', mutes: {} };
}

// Fusionne un état sauvegardé avec les valeurs par défaut (instruments ou champs ajoutés plus tard).
export function mergeTrState(saved) {
  const base = defaultTrState();
  if (!saved) return base;
  for (const i of TR_INSTR) Object.assign(base.params[i.id], saved.params?.[i.id]);
  Object.assign(base.globals, saved.globals);
  if (Array.isArray(saved.patterns)) {
    base.patterns = base.patterns.map((p, k) => (saved.patterns[k] ? { ...emptyPattern(), ...saved.patterns[k] } : p));
  }
  base.pattern = saved.pattern ?? 0;
  base.sel = TR_INSTR.some(i => i.id === saved.sel) ? saved.sel : 'bd';
  base.mutes = saved.mutes ?? {};
  return base;
}

export class TR909 {
  constructor(engine, getState) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    this.out = this.ctx.createGain();
    this.out.connect(engine.master);
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.curves = new Map();
    this.openHat = null;
    this.running = false;
    this.idx = 0;
    this.queued = null;
    this.onStep = () => {};      // (pas 0-15, ou -1 à l'arrêt)
    this.onPattern = () => {};   // changement de pattern effectué
  }

  get st() { return this.getState(); }
  p(id, param) { return this.st.params[id]?.[param] ?? 0.5; }

  setVolume(v) { this.out.gain.setTargetAtTime(v * v * 1.3, this.ctx.currentTime, 0.02); }

  // --- briques de synthèse ---
  gain(v = 1) { const g = this.ctx.createGain(); g.gain.value = v; return g; }
  filter(type, f, q = 0.7) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }
  noiseSrc(time, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.start(time, Math.random() * 1.5);
    s.stop(time + dur);
    return s;
  }
  osc(type, f, time, dur) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, time);
    o.start(time);
    o.stop(time + dur);
    return o;
  }
  env(g, time, peak, decay, attack = 0.001) {
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(peak, time + attack);
    g.gain.setTargetAtTime(0, time + attack, decay / 4);
    return g;
  }
  // Courbe de distorsion : quantité 0..1 et forme (soft, hard, tube, fold, crush).
  distCurve(amount, shape) {
    const key = `${shape}:${Math.round(amount * 50)}`;
    if (!this.curves.has(key)) {
      const a = Math.round(amount * 50) / 50;
      const k = 1 + a * a * 60;
      const levels = Math.max(2, Math.round(2 + (1 - a) ** 2 * 60));
      const f = {
        soft: x => Math.tanh(k * x) / Math.tanh(k),
        hard: x => Math.max(-1, Math.min(1, k * x)),
        tube: x => (x >= 0 ? Math.tanh(k * x) : Math.tanh(k * 0.45 * x) * 0.8) + 0.1 * a * x * x,
        fold: x => Math.sin(x * (1 + a * 7) * Math.PI / 2),
        crush: x => Math.round(Math.tanh((1 + a * 6) * x) * levels) / levels,
      }[shape];
      const c = Float32Array.from({ length: 2048 }, (_, i) => f((i / 2047) * 2 - 1));
      const peak = c.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-6);
      this.curves.set(key, c.map(v => v / peak));
    }
    return this.curves.get(key);
  }
  // Six oscillateurs carrés aux rapports inharmoniques, comme les cymbales analogiques.
  metal(time, dur, base) {
    const mix = this.gain(0.25);
    for (const r of [2, 3, 4.16, 5.43, 6.79, 8.21]) this.osc('square', base * r, time, dur).connect(mix);
    return mix;
  }

  // Joue un instrument à l'instant `time` (secondes, horloge audio) avec une vélocité 0..1.
  trigger(id, time = this.ctx.currentTime, vel = 1) {
    const level = this.p(id, 'level') * vel;
    const out = this.gain(level);
    // Chaîne de sortie : [distorsion + filtre anti-crissement] -> niveau -> bus 909.
    const drive = this.p(id, 'drive');
    if (drive > 0.01) {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = this.distCurve(drive, SHAPES[shapeIndex(this.p(id, 'shape'))]);
      shaper.oversample = '2x';
      const tame = this.filter('lowpass', 16000 - drive * 8000, 0.7);
      shaper.connect(tame).connect(this.gain(1 - drive * 0.35)).connect(this.out);
      out.connect(shaper);
    } else {
      out.connect(this.out);
    }
    const tune = this.p(id, 'tune');
    const decay = this.p(id, 'decay');

    switch (id) {
      case 'bd': {
        const f0 = 42 + tune * 30;
        const dec = 0.12 + decay * 1.1;
        const o = this.osc('sine', f0 * 6, time, dec * 2 + 0.1);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.6, time + 0.012);
        o.frequency.exponentialRampToValueAtTime(f0, time + 0.09);
        const body = this.env(this.gain(), time, 1, dec, 0.002);
        const click = this.env(this.gain(), time, this.p('bd', 'attack') * 0.9, 0.01);
        this.noiseSrc(time, 0.03).connect(this.filter('bandpass', 3200, 0.8)).connect(click);
        o.connect(body).connect(out);
        click.connect(out);
        break;
      }
      case 'sd': {
        const k = 0.8 + tune * 0.5;
        const body = this.env(this.gain(), time, 0.8, 0.09);
        for (const f of [180 * k, 330 * k]) {
          const o = this.osc('triangle', f * 1.5, time, 0.3);
          o.frequency.exponentialRampToValueAtTime(f, time + 0.02);
          o.connect(body);
        }
        const snappy = this.p('sd', 'snappy');
        const wires = this.env(this.gain(), time, 0.2 + snappy, 0.1 + snappy * 0.18);
        this.noiseSrc(time, 0.5).connect(this.filter('highpass', 1500)).connect(this.filter('lowpass', 4000 + this.p('sd', 'tone') * 9000)).connect(wires);
        body.connect(out);
        wires.connect(out);
        break;
      }
      case 'lt': case 'mt': case 'ht': {
        const f = { lt: 95, mt: 135, ht: 185 }[id] * (0.75 + tune * 0.5);
        const dec = 0.15 + decay * 0.8;
        const o = this.osc('sine', f * 1.35, time, dec * 2 + 0.1);
        o.frequency.exponentialRampToValueAtTime(f, time + 0.08);
        o.connect(this.env(this.gain(), time, 1, dec)).connect(out);
        this.noiseSrc(time, 0.1).connect(this.filter('lowpass', 2000)).connect(this.env(this.gain(), time, 0.15, 0.03)).connect(out);
        break;
      }
      case 'rs': {
        const g = this.env(this.gain(), time, 1, 0.025);
        this.osc('triangle', 1700, time, 0.1).connect(g);
        this.osc('triangle', 500, time, 0.1).connect(g);
        g.connect(this.filter('bandpass', 1800, 2)).connect(out);
        break;
      }
      case 'hc': {
        const g = this.gain(0);
        const bursts = [0, 0.011, 0.023, 0.034];
        g.gain.setValueAtTime(0, time);
        for (const b of bursts) {
          g.gain.setValueAtTime(1, time + b);
          g.gain.setTargetAtTime(0.1, time + b, 0.003);
        }
        g.gain.setValueAtTime(0.9, time + 0.045);
        g.gain.setTargetAtTime(0, time + 0.045, 0.05);
        this.noiseSrc(time, 0.4).connect(this.filter('bandpass', 1100, 1.5)).connect(g).connect(out);
        out.gain.value = level * 1.6;
        break;
      }
      case 'ch': case 'oh': {
        // Le charley fermé coupe l'ouvert, comme sur la machine.
        if (this.openHat) {
          this.openHat.gain.cancelScheduledValues(time);
          this.openHat.gain.setTargetAtTime(0, time, 0.005);
          this.openHat = null;
        }
        const dec = id === 'ch' ? 0.02 + decay * 0.12 : 0.12 + decay * 0.9;
        const g = this.env(this.gain(), time, 1, dec);
        this.metal(time, dec * 2 + 0.05, 40).connect(this.filter('bandpass', 10000, 0.8)).connect(this.filter('highpass', 7000)).connect(g);
        this.noiseSrc(time, dec * 2).connect(this.filter('highpass', 8000)).connect(this.gain(0.3)).connect(g);
        g.connect(out);
        if (id === 'oh') this.openHat = g;
        break;
      }
      case 'cr': case 'rd': {
        const k = 0.8 + tune * 0.4;
        const dec = id === 'cr' ? 1.6 : 1.1;
        const g = this.env(this.gain(), time, 1, dec);
        const base = (id === 'cr' ? 47 : 58) * k;
        this.metal(time, dec * 2, base).connect(this.filter('bandpass', id === 'cr' ? 8000 : 9500, id === 'cr' ? 0.5 : 2)).connect(g);
        if (id === 'cr') this.noiseSrc(time, dec * 2).connect(this.filter('highpass', 4000 * k)).connect(this.gain(0.5)).connect(g);
        g.connect(out);
        break;
      }
    }
  }

  // --- séquenceur ---
  stepDur() { return 60 / this.engine.bpm / 4; }

  timeOf(idx) {
    const swing = idx % 2 ? this.st.globals.shuffle * 0.5 * this.stepDur() : 0;
    return this.engine.origin + idx * this.stepDur() + swing;
  }

  start() {
    if (this.running) return;
    const e = this.engine;
    const looping = [...e.padVoices.values()].some(v => v.mode === 'loop');
    let startAt;
    if (!looping || e.origin === null) {
      e.origin = this.ctx.currentTime + 0.05;
      startAt = e.origin;
    } else {
      startAt = e.nextBar();   // se cale sur la mesure des boucles en cours
    }
    this.idx = Math.round((startAt - e.origin) / this.stepDur());
    this.running = true;
    e.seqRunning = true;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.engine.seqRunning = false;
    clearInterval(this.timer);
    this.onStep(-1);
  }

  toggle() { if (this.running) this.stop(); else this.start(); }

  // Change de pattern : tout de suite à l'arrêt, sinon au début de la mesure suivante.
  selectPattern(k) {
    if (!this.running) { this.st.pattern = k; this.queued = null; this.onPattern(); return; }
    this.queued = k === this.st.pattern ? null : k;
    this.onPattern();
  }

  tick() {
    const now = this.ctx.currentTime;
    // Onglet mis en veille : on rattrape la grille au lieu de rejouer les pas en retard.
    if (this.timeOf(this.idx) < now - 0.1) this.idx = Math.ceil((now - this.engine.origin) / this.stepDur());
    while (this.timeOf(this.idx) < now + 0.12) {
      const step = ((this.idx % 16) + 16) % 16;
      if (step === 0 && this.queued !== null) {
        this.st.pattern = this.queued;
        this.queued = null;
        this.onPattern();
      }
      const time = this.timeOf(this.idx);
      const pat = this.st.patterns[this.st.pattern];
      const accent = this.st.globals.accent;
      for (const { id } of TR_INSTR) {
        const v = pat[id][step];
        if (v && !this.st.mutes[id]) this.trigger(id, time, v === 2 ? 1 : 1 - accent * 0.45);
      }
      const delay = Math.max(0, (time - now) * 1000);
      setTimeout(() => { if (this.running) this.onStep(step); }, delay);
      this.idx++;
    }
  }
}
