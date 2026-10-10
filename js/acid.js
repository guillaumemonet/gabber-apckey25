// Basse acid façon TB-303 : oscillateur (scie ou carré) -> passe-bas 24 dB résonant piloté par une enveloppe
// -> VCA -> distorsion (formes de la 909) -> volume. Séquenceur de 16 pas : note, octave, accent, slide.
// Horloge : la sienne (grille des mesures), ou celle de la 909 (« Suivre la 909 », shuffle compris).
import { t } from './i18n.js';
import { distCurve, SHAPES, shapeIndex } from './tr909.js';

export const ACID_PATTERNS = 8;
export const ACID_BASE = 41;   // fa2 : première ligne de la grille (tonalité des banques)
export const ACID_ROWS = 13;   // de fa à fa (une octave)

// Potentiomètres : positions 0..1 ; valeur réelle calculée par `acidValue`.
const PARAMS = {
  tune: { def: 0.5, val: p => Math.round((p - 0.5) * 24), fmt: v => (v > 0 ? `+${v}` : `${v}`) },
  cutoff: { def: 0.35, val: p => 60 * Math.pow(7000 / 60, p), fmt: v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)) + 'Hz' },
  reso: { def: 0.65, val: p => p, fmt: v => `${Math.round(v * 100)}%` },
  env: { def: 0.6, val: p => p, fmt: v => `${Math.round(v * 100)}%` },
  decay: { def: 0.35, val: p => 0.06 * Math.pow(2 / 0.06, p), fmt: v => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`) },
  accent: { def: 0.6, val: p => p, fmt: v => `${Math.round(v * 100)}%` },
  slide: { def: 0.46, val: p => 0.015 * Math.pow(20, p), fmt: v => `${Math.round(v * 1000)}ms` },   // durée du glissé entre deux notes liées
  drive: { def: 0.35, val: p => p, fmt: v => `${Math.round(v * 100)}%` },
  shape: { def: 0.5, val: p => shapeIndex(p), fmt: v => t('tr.shapes')[v], steps: SHAPES.length },
  volume: { def: 0.75, val: p => p, fmt: v => `${Math.round(v * 100)}%` },
};
export const ACID_PARAMS = Object.keys(PARAMS);
export const ACID_KNOBS = ['cutoff', 'reso', 'env', 'decay', 'accent', 'drive', 'shape', 'volume'];   // page de potentiomètres (APC)
export const acidValue = (id, p) => PARAMS[id].val(p);
export const acidFmt = (id, p) => PARAMS[id].fmt(PARAMS[id].val(p));
export const acidSteps = id => PARAMS[id].steps;

// Presets de son (réglages des potentiomètres + onde), rangés par catégorie. Positions 0..1 des potentiomètres ;
// ce qui n'est pas donné garde la valeur par défaut. Les tiens s'y ajoutent (state.acid.user).
export const ACID_CATS = ['acid', 'bass', 'lead', 'fx'];
const S = (id, cat, wave, v) => ({ id, cat, wave, v });
export const ACID_SOUNDS = [
  S('classic', 'acid', 'sawtooth', {}),
  S('squelch', 'acid', 'sawtooth', { cutoff: 0.25, reso: 0.85, env: 0.8, decay: 0.3, accent: 0.75, drive: 0.3, slide: 0.5 }),
  S('screamer', 'acid', 'sawtooth', { cutoff: 0.45, reso: 0.95, env: 0.9, decay: 0.22, accent: 0.9, drive: 0.75, shape: 0.25, slide: 0.4 }),
  S('rotterdam', 'acid', 'sawtooth', { cutoff: 0.3, reso: 0.7, env: 0.7, decay: 0.28, accent: 0.8, drive: 0.9, shape: 0.5, volume: 0.7 }),
  S('hoover', 'acid', 'square', { cutoff: 0.4, reso: 0.6, env: 0.5, decay: 0.6, accent: 0.5, drive: 0.55, shape: 0.75, slide: 0.8 }),
  S('rubber', 'bass', 'square', { cutoff: 0.2, reso: 0.35, env: 0.35, decay: 0.5, accent: 0.4, drive: 0.15, shape: 0, slide: 0.4 }),
  S('sub', 'bass', 'square', { cutoff: 0.1, reso: 0.15, env: 0.15, decay: 0.7, accent: 0.3, drive: 0.1, shape: 0, volume: 0.85 }),
  S('dark', 'bass', 'sawtooth', { cutoff: 0.18, reso: 0.55, env: 0.45, decay: 0.3, accent: 0.55, drive: 0.4, shape: 0.5 }),
  S('sawlead', 'lead', 'sawtooth', { tune: 1, cutoff: 0.55, reso: 0.55, env: 0.5, decay: 0.55, accent: 0.6, drive: 0.45, slide: 0.55 }),
  S('squeal', 'lead', 'sawtooth', { tune: 1, cutoff: 0.5, reso: 0.95, env: 0.85, decay: 0.4, accent: 0.8, drive: 0.5, shape: 0.25 }),
  S('gabberlead', 'lead', 'square', { tune: 1, cutoff: 0.5, reso: 0.7, env: 0.6, decay: 0.35, accent: 0.7, drive: 0.95, shape: 0.25 }),
  S('laser', 'fx', 'sawtooth', { tune: 1, cutoff: 0.3, reso: 0.95, env: 1, decay: 0, accent: 1, drive: 0.6, slide: 0.3 }),
  S('siren', 'fx', 'square', { tune: 0.75, cutoff: 0.5, reso: 0.85, env: 0.3, decay: 1, accent: 0.5, drive: 0.4, slide: 1 }),
  S('crush', 'fx', 'sawtooth', { cutoff: 0.4, reso: 0.7, env: 0.7, decay: 0.3, accent: 0.7, drive: 0.8, shape: 1 }),
  S('zap', 'fx', 'sawtooth', { tune: 0.25, cutoff: 0.15, reso: 1, env: 1, decay: 0.1, accent: 1, drive: 0.6, shape: 0.75 }),
];
export const soundParams = v => ({ ...Object.fromEntries(ACID_PARAMS.map(id => [id, PARAMS[id].def])), ...v });

export function acidKnobDefs() {
  return ACID_KNOBS.map(id => ({ id, acid: true, label: t(`acid.p.${id}`), min: 0, max: 1, def: PARAMS[id].def, steps: PARAMS[id].steps ? PARAMS[id].steps : undefined, fmt: v => acidFmt(id, v) }));
}

const rest = () => ({ note: 0, gate: false, acc: false, slide: false, oct: 0 });
const emptyPattern = () => Array.from({ length: 16 }, rest);

// Lignes de départ en fa mineur. Chaque pas : [note (0 = fa … 12 = fa aigu), drapeaux « a » accent, « s » slide, « + » / « - » octave], ou null = silence.
const PRESETS = [
  // 1 : acid gabber
  [[0, 'a'], [0], [12], [0], [3, 'a'], [0, 's'], [3], [0], [0, 'a'], [7], [12, 's'], [10], [3, 'a'], [0], [10, 's'], [12]],
  // 2 : roulement en doubles-croches, accents à contretemps
  [[0], [0], [0, 'a'], [0, '+'], [0], [0], [0, 'a'], [0], [0], [0], [0, 'a'], [0, '+'], [0], [3], [0, 'a'], [5]],
  // 3 : glissés « squelch »
  [[0, 'as'], [3, 's'], [7], null, [12, 'a'], [10, 's'], [7, 's'], [3], [0, 'a'], null, [3, 's'], [5, 's'], [7, 'a'], null, [8, 's'], [7]],
  // 4 : hardcore minimal, à contretemps
  [null, null, [0, 'a'], null, null, null, [0, 'a+'], null, null, null, [0, 'a'], null, null, [3], [0, 'a+'], [12]],
];

function presetPattern(list) {
  return list.map(s => {
    if (!s) return rest();
    const [note, flags = ''] = s;
    return { note, gate: true, acc: flags.includes('a'), slide: flags.includes('s'), oct: flags.includes('+') ? 1 : flags.includes('-') ? -1 : 0 };
  });
}

export function defaultAcidState() {
  return {
    params: Object.fromEntries(ACID_PARAMS.map(id => [id, PARAMS[id].def])),
    wave: 'sawtooth',
    sound: 'classic',  // preset de son en cours (null = réglage perso)
    user: [],          // presets perso : { id: 'u:…', name, cat, wave, params }
    link: true,        // suit l'horloge de la 909
    pattern: 0,
    patterns: Array.from({ length: ACID_PATTERNS }, (_, k) => (PRESETS[k] ? presetPattern(PRESETS[k]) : emptyPattern())),
  };
}

export function mergeAcidState(saved) {
  const base = defaultAcidState();
  if (!saved || typeof saved !== 'object') return base;
  for (const id of ACID_PARAMS) if (Number.isFinite(saved.params?.[id])) base.params[id] = Math.min(1, Math.max(0, saved.params[id]));
  if (saved.wave === 'square' || saved.wave === 'sawtooth') base.wave = saved.wave;
  if (typeof saved.sound === 'string' || saved.sound === null) base.sound = saved.sound;
  else if (saved.params) base.sound = null;   // ancienne sauvegarde : ses réglages sont gardés tels quels
  if (Array.isArray(saved.user)) {
    base.user = saved.user.filter(u => typeof u?.id === 'string' && u.id.startsWith('u:') && typeof u.name === 'string' && u.params).map(u => ({
      id: u.id, name: u.name.slice(0, 24), cat: ACID_CATS.includes(u.cat) ? u.cat : 'acid', wave: u.wave === 'square' ? 'square' : 'sawtooth',
      params: soundParams(Object.fromEntries(ACID_PARAMS.filter(id => Number.isFinite(u.params[id])).map(id => [id, Math.min(1, Math.max(0, u.params[id]))]))),
    }));
  }
  if (typeof saved.link === 'boolean') base.link = saved.link;
  if (Number.isInteger(saved.pattern) && saved.pattern >= 0 && saved.pattern < ACID_PATTERNS) base.pattern = saved.pattern;
  if (Array.isArray(saved.patterns)) {
    base.patterns = base.patterns.map((pat, k) => {
      const sp = saved.patterns[k];
      if (!Array.isArray(sp) || sp.length !== 16) return pat;
      return sp.map(s => ({
        note: Number.isInteger(s?.note) ? Math.min(ACID_ROWS - 1, Math.max(0, s.note)) : 0,
        gate: !!s?.gate, acc: !!s?.acc, slide: !!s?.slide, oct: [-1, 0, 1].includes(s?.oct) ? s.oct : 0,
      }));
    });
  }
  return base;
}

// Ligne acid au hasard en fa mineur (gamme + quelques octaves, accents et glissés).
export function randomPattern() {
  const scale = [0, 3, 5, 7, 8, 10, 12];
  return Array.from({ length: 16 }, (_, s) => {
    const gate = s % 4 === 0 || Math.random() < 0.7;
    if (!gate) return rest();
    const r = Math.random();
    return {
      note: r < 0.4 ? 0 : scale[Math.floor(Math.random() * scale.length)],
      gate: true,
      acc: Math.random() < 0.3,
      slide: Math.random() < 0.22,
      oct: Math.random() < 0.15 ? 1 : Math.random() < 0.08 ? -1 : 0,
    };
  });
}

const midiToFreq = n => 440 * Math.pow(2, (n - 69) / 12);

export class Acid303 {
  constructor(engine, getState) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    const ctx = this.ctx;
    this.osc = ctx.createOscillator();
    this.f1 = ctx.createBiquadFilter();
    this.f2 = ctx.createBiquadFilter();
    this.f1.type = this.f2.type = 'lowpass';
    this.vca = ctx.createGain();
    this.vca.gain.value = 0;
    this.shaper = ctx.createWaveShaper();
    this.shaper.oversample = '2x';
    this.hp = ctx.createBiquadFilter();
    this.hp.type = 'highpass';
    this.hp.frequency.value = 30;
    this.out = ctx.createGain();   // sortie : branchée à la voie « TB-303 » de la table de mixage
    this.osc.connect(this.f1).connect(this.f2).connect(this.vca).connect(this.shaper).connect(this.hp).connect(this.out);
    this.osc.start();
    this.running = false;       // horloge propre en marche
    this.linked = false;        // joue sur l'horloge de la 909
    this.idx = 0;
    this.open = false;          // VCA ouvert (note tenue ou glissée)
    this.onStep = () => {};     // (pas 0-15, ou -1 à l'arrêt) : tête de lecture à l'écran
    this.onPattern = () => {};
    this.queued = null;         // pattern qui démarrera à la mesure suivante
    this.update();
  }

  get st() { return this.getState(); }
  p(id) { return acidValue(id, this.st.params[id]); }
  get pattern() { return this.st.patterns[this.st.pattern]; }
  get playing() { return this.running || this.linked; }

  // Réglages continus (coupure, résonance, distorsion, volume, onde).
  update() {
    const now = this.ctx.currentTime;
    this.osc.type = this.st.wave;
    this.osc.detune.setTargetAtTime(this.p('tune') * 100, now, 0.01);
    if (!this.envActive(now)) this.f1.frequency.setTargetAtTime(this.p('cutoff'), now, 0.02);
    this.f2.frequency.setTargetAtTime(this.p('cutoff') * 1.4, now, 0.02);
    this.f1.Q.setTargetAtTime(0.7 + this.p('reso') ** 1.5 * 22, now, 0.02);
    this.f2.Q.value = 0.5;
    const drive = this.p('drive');
    this.shaper.curve = drive > 0.01 ? distCurve(drive, SHAPES[this.p('shape')]) : null;
    this.out.gain.setTargetAtTime(this.p('volume') ** 2 * 0.9 * (1 - drive * 0.3), now, 0.02);
  }

  envActive(now) { return this.envUntil && now < this.envUntil; }

  stepDur() { return 60 / this.engine.bpm / 4; }

  // Horloge propre : démarre sur la mesure suivante si quelque chose joue déjà, sinon tout de suite.
  start(busy = false) {
    if (this.running || this.linked) return;
    const e = this.engine;
    const now = this.ctx.currentTime;
    let startAt;
    if ((busy || e.seqRunning || [...e.padVoices.values()].some(v => v.mode === 'loop')) && e.origin !== null) {
      const bar = this.stepDur() * 16;
      startAt = e.origin + Math.max(0, Math.ceil((now + 0.02 - e.origin) / bar)) * bar;
    } else {
      e.origin = now + 0.05;
      startAt = e.origin;
    }
    this.idx = Math.round((startAt - e.origin) / this.stepDur());
    this.running = true;
    e.seqs.add(this);
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
  }

  stop() {
    if (!this.running && !this.linked) return;
    this.running = false;
    this.linked = false;
    this.engine.seqs.delete(this);
    clearInterval(this.timer);
    this.gateOff(this.ctx.currentTime);
    this.onStep(-1);
  }

  tick() {
    const now = this.ctx.currentTime;
    const e = this.engine;
    if (e.origin + this.idx * this.stepDur() < now - 0.1) this.idx = Math.ceil((now - e.origin) / this.stepDur());
    while (e.origin + this.idx * this.stepDur() < now + 0.12) {
      this.playStep(((this.idx % 16) + 16) % 16, e.origin + this.idx * this.stepDur(), this.stepDur());
      this.idx++;
    }
  }

  // Horloge de la 909 (écouteur de son séquenceur) : un pas à l'instant `time`.
  onClock(step, time, dur) {
    if (!this.st.link || this.running) return;
    if (!this.linked) { this.linked = true; this.engine.seqs.add(this); }
    this.playStep(step, time, dur);
  }

  // La 909 s'est arrêtée : la 303 qui la suivait s'arrête aussi.
  clockStopped() { if (this.linked) this.stop(); }

  playStep(step, time, dur) {
    if (step === 0 && this.queued !== null) {
      this.st.pattern = this.queued;
      this.queued = null;
      this.onPattern();
    }
    const pat = this.pattern;
    const s = pat[step];
    const prev = pat[(step + 15) % 16];
    const tied = prev.gate && prev.slide && this.open;
    if (!s.gate) {
      if (this.open) this.gateOff(time);
    } else {
      this.note(s, time, dur, tied);
    }
    const delay = Math.max(0, (time - this.ctx.currentTime) * 1000);
    setTimeout(() => { if (this.playing) this.onStep(step); }, delay);
  }

  // Joue une note à l'instant `time` ; tied = glissé depuis la note précédente (sans redéclencher l'enveloppe).
  note(s, time, dur, tied = false) {
    const freq = midiToFreq(ACID_BASE + s.note + 12 * s.oct);
    const f = this.osc.frequency;
    const acc = s.acc ? this.p('accent') : 0;
    if (tied) {
      f.setTargetAtTime(freq, time, this.p('slide') / 3);   // glissé (potentiomètre Slide)
    } else {
      f.setValueAtTime(freq, time);
      // Enveloppe du filtre : pic au-dessus de la coupure, puis retour (plus court et plus haut avec l'accent).
      const cut = this.p('cutoff');
      const peak = Math.min(16000, cut * (1 + this.p('env') * 9 * (1 + acc * 0.8)));
      const decay = acc ? Math.min(this.p('decay'), 0.2) : this.p('decay');
      const fq = this.f1.frequency;
      fq.cancelScheduledValues(time);
      fq.setValueAtTime(peak, time);
      fq.setTargetAtTime(cut, time + 0.004, decay / 3);
      this.envUntil = time + decay * 2;
      const g = this.vca.gain;
      g.cancelScheduledValues(time);
      g.setValueAtTime(this.open ? g.value : 0, time);
      g.linearRampToValueAtTime(0.55 + acc * 0.45, time + 0.003);
    }
    this.open = true;
    // Fin de la note : à la moitié du pas, sauf si elle glisse vers la suivante.
    if (!s.slide) this.gateOff(time + dur * 0.55);
  }

  gateOff(time) {
    const g = this.vca.gain;
    g.cancelScheduledValues(time);
    g.setTargetAtTime(0, time, 0.008);
    this.open = false;
  }

  // Joue une note tout de suite (saisie au clavier, clic dans la grille).
  preview(s) {
    const now = this.ctx.currentTime + 0.005;
    this.note({ ...s, slide: false }, now, 0.25);
  }

  selectPattern(k) {
    if (!this.playing) { this.st.pattern = k; this.queued = null; this.onPattern(); return; }
    this.queued = k === this.st.pattern ? null : k;
    this.onPattern();
  }
}
