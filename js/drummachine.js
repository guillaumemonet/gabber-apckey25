// Socle des boîtes à rythmes (TR-909, TR-808) et du séquenceur pas à pas : horloge des pas calée sur le transport du
// moteur (même tempo et même mesure que les boucles des pads), patterns changés à la mesure suivante, shuffle ;
// briques de synthèse analogique, distorsion par instrument, kits de son et potentiomètres.
import { t } from './i18n.js';

export const SHAPES = ['soft', 'hard', 'tube', 'fold', 'crush'];
export const shapeIndex = pos => Math.round(pos * (SHAPES.length - 1));
export const PATTERNS = 8;

const pct = v => `${Math.round(v * 100)}%`;
const mod = (n, m) => ((n % m) + m) % m;

// Courbe de distorsion partagée (boîtes à rythmes, TB-303, designer de kick, table de mixage) : quantité 0..1 et forme.
const curves = new Map();
export function distCurve(amount, shape) {
  const key = `${shape}:${Math.round(amount * 50)}`;
  if (!curves.has(key)) {
    const a = Math.round(amount * 50) / 50;
    const k = 1 + a * a * 60;
    const levels = Math.max(2, Math.round(2 + (1 - a) ** 2 * 60));
    const f = {
      soft: x => Math.tanh(k * x) / Math.tanh(k),
      hard: x => Math.max(-1, Math.min(1, k * x)),
      tube: x => (x >= 0 ? Math.tanh(k * x) : Math.tanh(k * 0.45 * x) * 0.8) + 0.1 * a * x * x,
      fold: x => Math.sin(x * (1 + a * 7) * Math.PI / 2),
      crush: x => Math.round(Math.tanh((1 + a * 6) * x) * levels) / levels,
    }[shape] ?? (x => x);
    const c = Float32Array.from({ length: 2048 }, (_, i) => f((i / 2047) * 2 - 1));
    const peak = c.reduce((m, v) => Math.max(m, Math.abs(v)), 1e-6);
    curves.set(key, c.map(v => v / peak));
  }
  return curves.get(key);
}

/**
 * Horloge des pas : 16 pas par mesure, calés sur la grille du moteur (engine.origin). Les sous-classes jouent chaque pas
 * (playStep) ; `length` donne le nombre de pas du pattern en cours (16 pour les boîtes à rythmes, 16 à 64 pour le
 * séquenceur).
 */
export class StepClock {
  constructor(engine, getState) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    this.running = false;
    this.idx = 0;                // pas de la grille depuis engine.origin
    this.pos = 0;                // pas dans le pattern
    this.queued = null;
    this.onStep = () => {};      // (pas du pattern, ou -1 à l'arrêt)
    this.onPattern = () => {};   // changement de pattern effectué
    this.listeners = [];         // autres séquenceurs calés sur la même horloge : (pas 0-15, instant, durée d'un pas)
    this.onStop = () => {};
  }

  get st() { return this.getState(); }
  get length() { return 16; }
  swing() { return this.st.globals.shuffle; }
  stepDur() { return 60 / this.engine.bpm / 4; }

  timeOf(idx) {
    const swing = idx % 2 ? this.swing() * 0.5 * this.stepDur() : 0;
    return this.engine.origin + idx * this.stepDur() + swing;
  }

  // keepOrigin : la grille a déjà été posée (timeline) ; le séquenceur démarre sur le pas suivant de cette grille.
  start(keepOrigin = false) {
    if (this.running) return;
    const e = this.engine;
    const looping = e.seqRunning || [...e.padVoices.values()].some(v => v.mode === 'loop');
    let startAt;
    if (keepOrigin && e.origin !== null) {
      startAt = e.origin + Math.max(0, Math.ceil((this.ctx.currentTime + 0.02 - e.origin) / this.stepDur())) * this.stepDur();
    } else if (!looping || e.origin === null) {
      e.origin = this.ctx.currentTime + 0.05;
      startAt = e.origin;
    } else {
      startAt = e.nextBar();   // se cale sur la mesure de ce qui joue déjà
    }
    this.idx = Math.round((startAt - e.origin) / this.stepDur());
    this.pos = mod(this.idx, this.length);
    this.running = true;
    e.seqs.add(this);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.engine.seqs.delete(this);
    clearInterval(this.timer);
    this.onStop();
    this.onStep(-1);
  }

  toggle() { if (this.running) this.stop(); else this.start(); }

  // Change de pattern : tout de suite à l'arrêt, sinon au début du pattern suivant.
  selectPattern(k) {
    if (!this.running) { this.st.pattern = k; this.queued = null; this.onPattern(); return; }
    this.queued = k === this.st.pattern ? null : k;
    this.onPattern();
  }

  tick() {
    const now = this.ctx.currentTime;
    // Onglet mis en veille : on rattrape la grille au lieu de rejouer les pas en retard.
    if (this.timeOf(this.idx) < now - 0.1) {
      this.idx = Math.ceil((now - this.engine.origin) / this.stepDur());
      this.pos = mod(this.idx, this.length);
    }
    while (this.timeOf(this.idx) < now + 0.12) {
      if (this.pos >= this.length) this.pos = 0;
      if (this.pos === 0 && this.queued !== null) {
        this.st.pattern = this.queued;
        this.queued = null;
        this.onPattern();
      }
      const time = this.timeOf(this.idx), step = this.pos;
      this.playStep(step, time);
      for (const listen of this.listeners) listen(mod(this.idx, 16), time, this.stepDur());
      const delay = Math.max(0, (time - now) * 1000);
      setTimeout(() => { if (this.running) this.onStep(step); }, delay);
      this.idx++;
      this.pos++;
    }
  }

  playStep() {}
}

/**
 * Boîte à rythmes : instruments synthétisés en direct, chacun avec sa distorsion (Drive, Shape), et groupés vers les voies
 * de la table de mixage. Les sous-classes donnent `voice(id, time, out, level)` (le son de chaque instrument).
 */
export class DrumMachine extends StepClock {
  constructor(engine, getState, instruments, groups = {}) {
    super(engine, getState);
    this.instruments = instruments;
    this.groups = groups;      // instrument -> groupe de la table de mixage ('all' par défaut)
    this.volume = 1;
    this.buses = {};           // groupe -> gain de volume, relié à la voie du mixeur (ou au master)
    this.dests = {};
    this.noise = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.openHat = null;
    this.onKick = () => {};    // (instant) : grosse caisse jouée, pour le sidechain
  }

  p(id, param) { return this.st.params[id]?.[param] ?? 0.5; }

  setVolume(v) {
    this.volume = v * v * 1.3;
    for (const g of Object.values(this.buses)) g.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
  }

  bus(id) {
    const group = this.groups[id] ?? 'all';
    if (!this.buses[group]) {
      this.buses[group] = this.gain(this.volume);
      this.buses[group].connect(this.dests[group] ?? this.engine.master);
    }
    return this.buses[group];
  }

  // Envoie chaque groupe d'instruments vers une voie de la table de mixage.
  setDestinations(dests) {
    this.dests = dests;
    for (const [group, bus] of Object.entries(this.buses)) {
      bus.disconnect();
      bus.connect(dests[group] ?? this.engine.master);
    }
  }

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
  // Oscillateurs carrés aux fréquences inharmoniques, mélangés : le « métal » des cymbales et charleys analogiques.
  metal(time, dur, freqs) {
    const mix = this.gain(0.25);
    for (const f of freqs) this.osc('square', f, time, dur).connect(mix);
    return mix;
  }
  // Le charley fermé coupe l'ouvert, comme sur les machines.
  chokeHat(time) {
    if (!this.openHat) return;
    this.openHat.gain.cancelScheduledValues(time);
    this.openHat.gain.setTargetAtTime(0, time, 0.005);
    this.openHat = null;
  }

  // Joue un instrument à l'instant `time` (secondes, horloge audio) avec une vélocité 0..1.
  trigger(id, time = this.ctx.currentTime, vel = 1) {
    if (id === 'bd') this.onKick(time);
    const level = this.p(id, 'level') * vel;
    const out = this.gain(level);
    // Chaîne de sortie : [distorsion + filtre anti-crissement] -> niveau -> bus.
    const drive = this.p(id, 'drive');
    if (drive > 0.01) {
      const shaper = this.ctx.createWaveShaper();
      shaper.curve = distCurve(drive, SHAPES[shapeIndex(this.p(id, 'shape'))]);
      shaper.oversample = '2x';
      const tame = this.filter('lowpass', 16000 - drive * 8000, 0.7);
      shaper.connect(tame).connect(this.gain(1 - drive * 0.35)).connect(this.bus(id));
      out.connect(shaper);
    } else {
      out.connect(this.bus(id));
    }
    this.voice(id, time, out, level);
  }

  voice() {}

  playStep(step, time) {
    const pat = this.st.patterns[this.st.pattern];
    const accent = this.st.globals.accent;
    for (const { id } of this.instruments) {
      const v = pat[id]?.[step];
      if (v && !this.st.mutes[id]) this.trigger(id, time, v === 2 ? 1 : 1 - accent * 0.45);
    }
  }
}

/**
 * Description d'une boîte à rythmes : instruments, valeurs par défaut, kits, patterns de départ. Donne l'état par défaut,
 * la fusion d'un état sauvegardé, les réglages d'un kit et les potentiomètres de sa page.
 * - prefix : préfixe des textes (`tr`, `tr8`) : noms des instruments, kits, volume ;
 * - init(set, all) : patterns de départ (set(pattern, instrument, pas, valeur)).
 */
export function drumMachineDef({ prefix, instruments, paramDefaults, globalDefaults, kits, cats, kitDefault, init }) {
  const DIST = ['drive', 'shape'];
  const emptyPattern = () => Object.fromEntries(instruments.map(i => [i.id, new Array(16).fill(0)]));
  // Réglages d'un kit (positions 0..1) ; ce qui n'est pas donné garde sa valeur par défaut.
  const kitParams = v => Object.fromEntries(instruments.map(i => [i.id, { ...Object.fromEntries([...i.params, ...DIST].map(p => [p, paramDefaults[p]])), ...(v?.[i.id] ?? {}) }]));

  // État par défaut, avec les patterns de départ (0 = silence, 1 = note, 2 = note accentuée).
  function defaultState() {
    const patterns = Array.from({ length: PATTERNS }, emptyPattern);
    const set = (pat, id, steps, v = 1) => steps.forEach(s => { patterns[pat][id][s] = v; });
    init(set, [...Array(16).keys()]);
    return { params: kitParams(kits.find(k => k.id === kitDefault)?.v), globals: { ...globalDefaults }, patterns, pattern: 0, sel: instruments[0].id, mutes: {}, kit: kitDefault, userKits: [] };
  }

  // Fusionne un état sauvegardé avec les valeurs par défaut (instruments ou champs ajoutés plus tard).
  function mergeState(saved) {
    const base = defaultState();
    if (!saved) return base;
    for (const i of instruments) Object.assign(base.params[i.id], saved.params?.[i.id]);
    Object.assign(base.globals, saved.globals);
    if (Array.isArray(saved.patterns)) {
      base.patterns = base.patterns.map((p, k) => (saved.patterns[k] ? { ...emptyPattern(), ...saved.patterns[k] } : p));
    }
    base.pattern = Number.isInteger(saved.pattern) && saved.pattern >= 0 && saved.pattern < PATTERNS ? saved.pattern : 0;
    base.sel = instruments.some(i => i.id === saved.sel) ? saved.sel : instruments[0].id;
    base.mutes = saved.mutes ?? {};
    base.kit = typeof saved.kit === 'string' || saved.kit === null ? saved.kit : saved.params ? null : kitDefault;
    if (Array.isArray(saved.userKits)) {
      base.userKits = saved.userKits.filter(u => typeof u?.id === 'string' && u.id.startsWith('u:') && typeof u.name === 'string' && u.params)
        .map(u => ({ id: u.id, name: u.name.slice(0, 24), cat: cats.includes(u.cat) ? u.cat : cats[0], params: kitParams(u.params) }));
    }
    return base;
  }

  // Potentiomètres de la page : paramètres de l'instrument choisi (K1-K4), sa distorsion Drive / Shape (K5-K6), puis
  // Shuffle et Volume (K7-K8). Valeurs = positions 0..1.
  function knobDefs(sel) {
    const inst = instruments.find(i => i.id === sel) ?? instruments[0];
    const def = p => ({ id: p, group: 'inst', label: `${inst.id.toUpperCase()} · ${t(`tr.p.${p}`)}`, min: 0, max: 1, def: paramDefaults[p], fmt: pct });
    const defs = inst.params.map(def);
    while (defs.length < 4) defs.push(null);
    defs.push(def('drive'), { ...def('shape'), steps: SHAPES.length, max: SHAPES.length - 1, fmt: v => t('tr.shapes')[v] });
    const glob = g => ({ id: g, group: 'global', label: t(g === 'volume' ? `${prefix}.p.volume` : `tr.p.${g}`), min: 0, max: 1, def: globalDefaults[g], fmt: pct });
    return [...defs, glob('shuffle'), glob('volume')];
  }

  return { prefix, instruments, kits, cats, kitDefault, emptyPattern, kitParams, defaultState, mergeState, knobDefs };
}
