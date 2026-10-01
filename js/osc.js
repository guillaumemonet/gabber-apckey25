// Synthé à oscillateurs, façon analogique : 3 oscillateurs (scie, impulsion à largeur variable, triangle, sinus ;
// octave, demi-ton, désaccord, niveau, unisson), bruit, FM (osc 3 -> osc 1), modulation en anneau (osc 1 × osc 2),
// enveloppe de hauteur, saturation puis filtre passe-bas / passe-haut / passe-bande 12 ou 24 dB (coupure, résonance,
// enveloppe, suivi du clavier), 2 enveloppes ADSR, un LFO calé sur le tempo (hauteur, filtre, largeur d'impulsion, volume),
// jeu polyphonique (8 voix), mono ou legato avec glissé.
// Les réglages sont des positions 0..1 (comme les potards) ; `oscValues` donne les valeurs réelles.
// L'impulsion = scie − la même scie retardée (le retard fixe la largeur, modulable par le LFO).
import { t } from './i18n.js';

const midiToFreq = n => 440 * Math.pow(2, (n - 69) / 12);
export const OSC_WAVES = ['saw', 'pulse', 'tri', 'sine'];
export const FILTER_TYPES = ['lp', 'hp', 'bp'];
export const LFO_SHAPES = ['sine', 'tri', 'saw', 'square'];
export const LFO_DESTS = ['pitch', 'filter', 'pwm', 'amp'];
export const LFO_RATES = [4, 2, 1, 0.5, 0.25, 0.125, 2 / 3, 1 / 3, 1 / 6];   // durée d'un cycle, en temps
export const LFO_RATE_LABELS = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
export const VOICE_MODES = ['poly', 'mono', 'legato'];
const MAX_VOICES = 8;

const pct = v => `${Math.round(v * 100)}%`;
const sec = v => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`);
const hz = v => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`) + 'Hz';
const signed = u => v => `${v > 0 ? '+' : ''}${Math.round(v)}${u}`;

const P = (min, max, def, fmt, opts = {}) => ({ min, max, def, fmt, ...opts });
const osc = (k, wave, lvl, extra = {}) => ({
  [`o${k}w`]: P(0, 3, wave, v => t(`osc.wave.${OSC_WAVES[v]}`), { steps: 4 }),
  [`o${k}oct`]: P(-2, 2, 0, signed(''), { steps: 5 }),
  [`o${k}semi`]: P(-12, 12, 0, signed(' st'), { steps: 25 }),
  [`o${k}fine`]: P(-50, 50, extra.fine ?? 0, signed(' ct')),
  [`o${k}lvl`]: P(0, 1, lvl, pct),
  [`o${k}pw`]: P(0.05, 0.95, 0.5, pct),
  [`o${k}uni`]: P(1, 7, 1, v => `×${v}`, { steps: 7 }),
  [`o${k}det`]: P(0, 60, 15, v => `${Math.round(v)} ct`),
});
export const OSC_PARAMS = {
  ...osc(1, 0, 0.8), ...osc(2, 0, 0.5, { fine: 7 }), ...osc(3, 3, 0),
  noise: P(0, 1, 0, pct), ring: P(0, 1, 0, pct), fm: P(0, 1, 0, pct),
  pbend: P(-24, 24, 0, signed(' st'), { steps: 49 }), ptime: P(0.005, 2, 0.1, sec, { curve: 'exp' }),
  ftype: P(0, 2, 0, v => FILTER_TYPES[v].toUpperCase(), { steps: 3 }),
  fslope: P(0, 1, 1, v => (v ? '24 dB' : '12 dB'), { steps: 2 }),
  cutoff: P(30, 18000, 3000, hz, { curve: 'exp' }),
  reso: P(0.5, 25, 1, v => v.toFixed(1), { curve: 'exp' }),
  fenv: P(-1, 1, 0.3, v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`),
  ktrack: P(0, 1, 0.3, pct),
  drive: P(0, 1, 0, pct),
  fa: P(0.001, 4, 0.003, sec, { curve: 'exp' }), fd: P(0.005, 4, 0.3, sec, { curve: 'exp' }),
  fs: P(0, 1, 0.3, pct), fr: P(0.005, 6, 0.3, sec, { curve: 'exp' }),
  aa: P(0.001, 4, 0.003, sec, { curve: 'exp' }), ad: P(0.005, 4, 0.4, sec, { curve: 'exp' }),
  as: P(0, 1, 0.8, pct), ar: P(0.005, 6, 0.25, sec, { curve: 'exp' }),
  lshape: P(0, 3, 0, v => t(`osc.lfo.${LFO_SHAPES[v]}`), { steps: 4 }),
  lrate: P(0, 8, 2, v => LFO_RATE_LABELS[v], { steps: 9 }),
  ldest: P(0, 3, 1, v => t(`osc.dest.${LFO_DESTS[v]}`), { steps: 4 }),
  ldepth: P(0, 1, 0, pct),
  mode: P(0, 2, 0, v => t(`osc.mode.${VOICE_MODES[v]}`), { steps: 3 }),
  glide: P(0, 1, 0.06, sec),
  width: P(0, 1, 0.5, pct),
  vol: P(0, 1, 0.7, pct),
};
export const OSC_IDS = Object.keys(OSC_PARAMS);
for (const [id, d] of Object.entries(OSC_PARAMS)) d.id = id;
// Page de potards de l'APC (K1-K8).
export const OSC_KNOBS = ['cutoff', 'reso', 'fenv', 'fd', 'drive', 'ldepth', 'ar', 'vol'];

export function oscToValue(d, p) {
  p = Math.min(1, Math.max(0, p));
  if (d.steps) return Math.round(d.min + Math.round(p * (d.steps - 1)) * (d.max - d.min) / (d.steps - 1));
  if (d.curve === 'exp') return d.min * Math.pow(d.max / d.min, p);
  return d.min + p * (d.max - d.min);
}
export function oscToPos(d, v) {
  const p = d.curve === 'exp' ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min);
  return Math.min(1, Math.max(0, p));
}
export const oscFmt = (id, p) => OSC_PARAMS[id].fmt(oscToValue(OSC_PARAMS[id], p));
export const oscDefaults = () => Object.fromEntries(OSC_IDS.map(id => [id, oscToPos(OSC_PARAMS[id], OSC_PARAMS[id].def)]));
export const oscValues = pos => Object.fromEntries(OSC_IDS.map(id => [id, oscToValue(OSC_PARAMS[id], pos?.[id] ?? oscToPos(OSC_PARAMS[id], OSC_PARAMS[id].def))]));

export function oscKnobDefs() {
  return OSC_KNOBS.map(id => ({ ...OSC_PARAMS[id], osc: true, label: t(`osc.p.${id}`) }));
}

// Presets (valeurs réelles ; ce qui n'est pas donné garde sa valeur par défaut).
const W = { saw: 0, pulse: 1, tri: 2, sine: 3 };
export const OSC_PRESETS = [
  { id: 'init', v: {} },
  { id: 'hoover', v: { o1w: W.saw, o1uni: 5, o1det: 35, o1lvl: 0.7, o2w: W.pulse, o2pw: 0.2, o2oct: -1, o2lvl: 0.6, o2uni: 3, o2det: 25, cutoff: 5000, reso: 1.5, fenv: 0.2, fa: 0.01, fd: 0.5, fs: 0.5, aa: 0.01, ad: 0.3, as: 0.9, ar: 0.4, pbend: -12, ptime: 0.12, lshape: 0, lrate: 3, ldest: 0, ldepth: 0.12, mode: 2, glide: 0.12, width: 0.8, drive: 0.3 } },
  { id: 'fm_screech', v: { o1w: W.sine, o1lvl: 0.8, o2lvl: 0, o3w: W.sine, o3oct: 1, o3semi: 7, o3lvl: 0, fm: 0.75, cutoff: 6500, reso: 6, fenv: 0.1, drive: 0.7, ldest: 0, lshape: 3, lrate: 4, ldepth: 0.04, mode: 1, glide: 0.05, aa: 0.002, as: 1, ar: 0.15 } },
  { id: 'reese', v: { o1w: W.saw, o1oct: -1, o1uni: 3, o1det: 20, o2w: W.saw, o2oct: -1, o2fine: 12, o2lvl: 0.8, cutoff: 700, reso: 2, fenv: 0, lshape: 0, lrate: 0, ldest: 1, ldepth: 0.35, mode: 1, glide: 0.08, as: 1, ar: 0.3, drive: 0.25, width: 0.7 } },
  { id: 'gabber_lead', v: { o1w: W.saw, o1uni: 3, o1det: 20, o2w: W.pulse, o2oct: 1, o2lvl: 0.4, drive: 0.85, cutoff: 4000, reso: 3, fenv: 0.5, fd: 0.25, fs: 0.4, mode: 1, glide: 0.03, aa: 0.002, as: 0.9, ar: 0.15 } },
  { id: 'acid_bass', v: { o1w: W.saw, o1oct: -1, o1lvl: 0.9, o2lvl: 0, cutoff: 400, reso: 14, fenv: 0.8, fa: 0.002, fd: 0.22, fs: 0, ktrack: 0.5, drive: 0.5, mode: 2, glide: 0.06, aa: 0.002, ad: 0.3, as: 0.8, ar: 0.08 } },
  { id: 'sub', v: { o1w: W.sine, o1oct: -1, o1lvl: 0.9, o2w: W.tri, o2oct: -1, o2fine: 0, o2lvl: 0.3, cutoff: 400, reso: 0.7, fenv: 0, ktrack: 0, mode: 1, glide: 0.04, aa: 0.004, as: 1, ar: 0.12, drive: 0.1 } },
  { id: 'supersaw', v: { o1w: W.saw, o1uni: 7, o1det: 40, o1lvl: 0.8, o2w: W.saw, o2uni: 5, o2det: 25, o2oct: 1, o2lvl: 0.35, cutoff: 7000, reso: 1, fenv: 0.1, width: 1, aa: 0.02, ad: 0.6, as: 0.8, ar: 0.6 } },
  { id: 'pluck', v: { o1w: W.saw, o1lvl: 0.7, o2w: W.pulse, o2pw: 0.3, o2oct: 1, o2lvl: 0.3, cutoff: 900, reso: 3, fenv: 0.7, fa: 0.001, fd: 0.18, fs: 0, fr: 0.2, aa: 0.001, ad: 0.35, as: 0, ar: 0.25, ktrack: 0.6 } },
  { id: 'brass_stab', v: { o1w: W.saw, o1uni: 3, o1det: 12, o2w: W.saw, o2fine: -8, o2lvl: 0.7, cutoff: 1500, reso: 1.2, fenv: 0.6, fa: 0.04, fd: 0.3, fs: 0.3, aa: 0.01, ad: 0.25, as: 0.5, ar: 0.2, drive: 0.2 } },
  { id: 'pad', v: { o1w: W.saw, o1uni: 5, o1det: 20, o1lvl: 0.6, o2w: W.pulse, o2pw: 0.4, o2uni: 3, o2lvl: 0.4, cutoff: 2000, reso: 1.2, fenv: 0.2, fa: 1.2, fd: 1.5, fs: 0.6, aa: 1, ad: 1, as: 0.9, ar: 2.5, lshape: 1, lrate: 0, ldest: 2, ldepth: 0.5, width: 1 } },
  { id: 'wobble', v: { o1w: W.saw, o1oct: -1, o1uni: 3, o1det: 15, o2w: W.pulse, o2oct: -1, o2lvl: 0.6, cutoff: 300, reso: 6, fenv: 0, lshape: 0, lrate: 3, ldest: 1, ldepth: 0.8, mode: 1, glide: 0.05, drive: 0.5, as: 1, ar: 0.1 } },
  { id: 'laser', v: { o1w: W.saw, o1lvl: 0.8, o2lvl: 0, o3w: W.sine, o3oct: 1, fm: 0.4, pbend: 24, ptime: 0.3, cutoff: 8000, reso: 5, fenv: -0.5, fd: 0.3, fs: 0, aa: 0.001, ad: 0.3, as: 0, ar: 0.1, mode: 1, glide: 0, drive: 0.4 } },
];
export const OSC_CATS = ['lead', 'bass', 'pad', 'fx'];
export const OSC_PRESET_CAT = { init: 'lead', hoover: 'lead', fm_screech: 'lead', reese: 'bass', gabber_lead: 'lead', acid_bass: 'bass', sub: 'bass',
  supersaw: 'pad', pluck: 'lead', brass_stab: 'lead', pad: 'pad', wobble: 'bass', laser: 'fx' };
export const presetPositions = v => {
  const pos = oscDefaults();
  for (const [id, val] of Object.entries(v ?? {})) if (OSC_PARAMS[id] && Number.isFinite(val)) pos[id] = oscToPos(OSC_PARAMS[id], val);
  return pos;
};

export function defaultOscState() {
  return { params: presetPositions(OSC_PRESETS[1].v), preset: 'hoover', user: [] };
}

export function mergeOscState(saved) {
  const base = defaultOscState();
  if (!saved || typeof saved !== 'object') return base;
  for (const id of OSC_IDS) if (Number.isFinite(saved.params?.[id])) base.params[id] = Math.min(1, Math.max(0, saved.params[id]));
  if (typeof saved.preset === 'string' || saved.preset === null) base.preset = saved.preset;
  if (Array.isArray(saved.user)) {
    base.user = saved.user.filter(u => typeof u?.id === 'string' && u.id.startsWith('u:') && typeof u.name === 'string' && u.params && typeof u.params === 'object')
      .map(u => ({ id: u.id, name: u.name.slice(0, 24), cat: OSC_CATS.includes(u.cat) ? u.cat : 'lead', params: { ...oscDefaults(), ...Object.fromEntries(OSC_IDS.filter(id => Number.isFinite(u.params[id])).map(id => [id, Math.min(1, Math.max(0, u.params[id]))])) } }));
  }
  return base;
}

let noiseBuf = null;
function noiseBuffer(ctx) {
  if (noiseBuf?.sampleRate === ctx.sampleRate && noiseBuf.ctx === ctx) return noiseBuf.buf;
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = { ctx, sampleRate: ctx.sampleRate, buf };
  return buf;
}

const driveCurves = new Map();
function driveCurve(amount) {
  const k = Math.round(amount * 40) / 40;
  if (!driveCurves.has(k)) {
    const n = 1024, c = new Float32Array(n), g = 1 + k * 30;
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(g * x) / Math.tanh(g); }
    driveCurves.set(k, c);
  }
  return driveCurves.get(k);
}

export class OscSynth {
  constructor(ctx, getBpm = () => 120) {
    this.ctx = ctx;
    this.getBpm = getBpm;
    this.out = ctx.createGain();
    this.voices = new Map();   // clé -> voix
    this.stack = [];           // notes tenues (mono / legato)
    this.values = oscValues(null);
  }

  setValues(values) {
    this.values = values;
    const now = this.ctx.currentTime;
    for (const v of this.voices.values()) if (v.live && !v.released) v.update(values, now);
  }

  isMono(V) { return V.mode > 0; }

  // `when` : instant de départ (séquenceur) ; `V` : réglages (ceux d'un bloc, sinon ceux du synthé) ;
  // `from` : note d'où glisser (lignes mono de la timeline).
  noteOn(note, vel = 0.85, when, key = note, V = this.values, out = this.out, from) {
    const now = this.ctx.currentTime;
    const t0 = Math.max(when ?? now, now);
    const live = when === undefined && V === this.values;
    if (live && V.mode > 0) {
      this.stack = this.stack.filter(n => n !== note).concat(note);
      const v = this.voices.get('mono');
      if (v && !v.released) {
        v.setPitch(note, t0, V.glide);
        if (V.mode === 1) v.retrigger(t0, vel);
        return;
      }
      this.voices.set('mono', this.makeVoice(note, vel, t0, V, out, undefined, true));
      return;
    }
    this.kill(key, t0);
    const active = [...this.voices.entries()].filter(([, v]) => !v.released);
    if (active.length >= MAX_VOICES) { const [k, v] = active.sort((a, b) => a[1].t0 - b[1].t0)[0]; v.release(t0, 0.01); this.voices.delete(k); }
    this.voices.set(key, this.makeVoice(note, vel, t0, V, out, from, live));
  }

  noteOff(note, immediate = false, when, key = note) {
    const now = this.ctx.currentTime;
    const t = Math.max(when ?? now, now);
    const mono = this.voices.get('mono');
    if (mono && this.stack.includes(note) && !this.voices.has(key)) {
      this.stack = this.stack.filter(n => n !== note);
      if (this.stack.length && !immediate) { mono.setPitch(this.stack[this.stack.length - 1], t, mono.V.glide); return; }
      this.voices.delete('mono');
      mono.release(t, immediate ? 0.01 : undefined);
      return;
    }
    const v = this.voices.get(key);
    if (!v) return;
    this.voices.delete(key);
    v.release(t, immediate ? 0.01 : undefined);
  }

  kill(key, t) {
    const v = this.voices.get(key);
    if (!v) return;
    this.voices.delete(key);
    v.release(t, 0.005);
  }

  allNotesOff() {
    const now = this.ctx.currentTime;
    for (const v of this.voices.values()) v.release(now, 0.01);
    this.voices.clear();
    this.stack = [];
  }

  makeVoice(note, vel, t0, V, out, from, live) {
    const ctx = this.ctx;
    const nodes = [];
    const sources = [];
    const node = n => { nodes.push(n); return n; };
    const src = n => { sources.push(n); return nodes.push(n) && n; };
    const f = midiToFreq(note);
    const mix = node(ctx.createGain());
    // Oscillateurs : chaque unisson a son panoramique ; « raw » = signal brut pour la FM et l'anneau.
    const oscs = [];
    const need = [V.o1lvl > 0 || V.ring > 0 || V.fm > 0, V.o2lvl > 0 || V.ring > 0, V.o3lvl > 0 || V.fm > 0];
    const lfo = V.ldepth > 0 ? src(ctx.createOscillator()) : null;
    const pitchMod = lfo && V.ldest === 0 ? node(ctx.createGain()) : null;
    const pwmMod = lfo && V.ldest === 2 ? node(ctx.createGain()) : null;
    for (let k = 1; k <= 3; k++) {
      if (!need[k - 1]) { oscs.push(null); continue; }
      const wave = OSC_WAVES[V[`o${k}w`]];
      const ratio = Math.pow(2, V[`o${k}oct`] + V[`o${k}semi`] / 12 + V[`o${k}fine`] / 1200);
      const uni = V[`o${k}uni`];
      const raw = node(ctx.createGain());
      raw.gain.value = 1 / uni;
      const lvl = node(ctx.createGain());
      lvl.gain.value = V[`o${k}lvl`] / Math.sqrt(uni);
      const o = { ratio, freqs: [], delays: [], raw, pw: V[`o${k}pw`], pulse: wave === 'pulse' };
      for (let u = 0; u < uni; u++) {
        const spread = uni > 1 ? (u / (uni - 1)) * 2 - 1 : 0;
        const s = src(ctx.createOscillator());
        s.type = wave === 'pulse' || wave === 'saw' ? 'sawtooth' : wave === 'tri' ? 'triangle' : 'sine';
        s.detune.value = spread * V[`o${k}det`] / 2;
        if (pitchMod) pitchMod.connect(s.detune);
        o.freqs.push(s.frequency);
        let voiceOut = s;
        if (o.pulse) {
          const sum = node(ctx.createGain());
          sum.gain.value = 0.5;
          const d = node(ctx.createDelay(0.1));
          const inv = node(ctx.createGain());
          inv.gain.value = -1;
          s.connect(sum);
          s.connect(d).connect(inv).connect(sum);
          o.delays.push(d);
          if (pwmMod) pwmMod.connect(d.delayTime);
          voiceOut = sum;
        }
        voiceOut.connect(raw);
        const pan = node(ctx.createStereoPanner());
        pan.pan.value = spread * V.width;
        voiceOut.connect(pan).connect(lvl);
      }
      lvl.connect(mix);
      oscs.push(o);
    }
    // FM : osc 3 module la fréquence de l'osc 1 ; anneau : osc 1 × osc 2.
    let fmGain = null;
    if (V.fm > 0 && oscs[0] && oscs[2]) {
      fmGain = node(ctx.createGain());
      oscs[2].raw.connect(fmGain);
      for (const p of oscs[0].freqs) fmGain.connect(p);
    }
    if (V.ring > 0 && oscs[0] && oscs[1]) {
      const ring = node(ctx.createGain());
      ring.gain.value = 0;
      oscs[0].raw.connect(ring);
      oscs[1].raw.connect(ring.gain);
      const rl = node(ctx.createGain());
      rl.gain.value = V.ring;
      ring.connect(rl).connect(mix);
    }
    if (V.noise > 0) {
      const n = src(ctx.createBufferSource());
      n.buffer = noiseBuffer(ctx);
      n.loop = true;
      const g = node(ctx.createGain());
      g.gain.value = V.noise * 0.6;
      n.connect(g).connect(mix);
    }
    // Saturation, filtre (12 ou 24 dB), ampli, trémolo.
    let chain = mix;
    let shaper = null;
    if (V.drive > 0.01) {
      shaper = node(ctx.createWaveShaper());
      shaper.curve = driveCurve(V.drive);
      shaper.oversample = '2x';
      chain.connect(shaper);
      chain = shaper;
    }
    const type = { lp: 'lowpass', hp: 'highpass', bp: 'bandpass' }[FILTER_TYPES[V.ftype]];
    const filters = [node(ctx.createBiquadFilter())];
    if (V.fslope) filters.push(node(ctx.createBiquadFilter()));
    const base = Math.min(20000, Math.max(20, V.cutoff * Math.pow(f / 261.63, V.ktrack)));
    filters.forEach((fl, i) => {
      fl.type = type;
      fl.frequency.value = base;
      fl.Q.value = i ? 0.707 : V.reso;
      chain.connect(fl);
      chain = fl;
    });
    const vca = node(ctx.createGain());
    vca.gain.value = 0;
    chain.connect(vca);
    let last = vca;
    if (lfo && V.ldest === 3) {
      const trem = node(ctx.createGain());
      trem.gain.value = 1 - V.ldepth / 2;
      const amt = node(ctx.createGain());
      amt.gain.value = V.ldepth / 2;
      lfo.connect(amt).connect(trem.gain);
      vca.connect(trem);
      last = trem;
    }
    last.connect(out);
    // LFO calé sur le tempo.
    if (lfo) {
      lfo.type = { sine: 'sine', tri: 'triangle', saw: 'sawtooth', square: 'square' }[LFO_SHAPES[V.lshape]];
      lfo.frequency.value = (this.getBpm() / 60) / LFO_RATES[V.lrate];
      if (pitchMod) { pitchMod.gain.value = V.ldepth * 300; lfo.connect(pitchMod); }
      if (pwmMod) { pwmMod.gain.value = V.ldepth * 0.4 / (f * (oscs.find(o => o?.pulse)?.ratio ?? 1)); lfo.connect(pwmMod); }
      if (V.ldest === 1) {
        const amt = node(ctx.createGain());
        amt.gain.value = V.ldepth * 2400;
        lfo.connect(amt);
        for (const fl of filters) amt.connect(fl.detune);
      }
    }

    const voice = {
      V, t0, note, released: false, live, sources, nodes, filters, vca, oscs, fmGain,
      vp: (0.3 + 0.7 * vel) * 0.35, vol: V.vol,
      get peak() { return voice.vp * voice.vol; },
      // Hauteur de chaque oscillateur (et du retard des impulsions, de la FM) pour la note `n` à l'instant `t`.
      setPitch: (n, t, glide = 0, start) => {
        voice.note = n;
        const fn = midiToFreq(n);
        for (const o of oscs) {
          if (!o) continue;
          const target = fn * o.ratio;
          for (const p of o.freqs) {
            p.cancelScheduledValues(t);
            if (start) { p.setValueAtTime(start * o.ratio, t); p.exponentialRampToValueAtTime(target, t + Math.max(0.005, glide)); }
            else if (glide > 0.001) p.setTargetAtTime(target, t, glide / 3);
            else p.setValueAtTime(target, t);
          }
          for (const d of o.delays) {
            d.delayTime.cancelScheduledValues(t);
            if (glide > 0.001 && !start) d.delayTime.setTargetAtTime(o.pw / target, t, glide / 3);
            else d.delayTime.setValueAtTime(o.pw / target, t);
          }
        }
        if (fmGain) {
          fmGain.gain.cancelScheduledValues(t);
          fmGain.gain.setValueAtTime(V.fm * fn * (oscs[0]?.ratio ?? 1) * 4, t);
        }
      },
      // Enveloppes : ampli (gain) et filtre (désaccord en centièmes, 4 octaves au maximum).
      retrigger: (t, v = vel) => {
        voice.vp = (0.3 + 0.7 * v) * 0.35;
        voice.envStart = t;
        const g = vca.gain;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value > 0 && t > t0 ? g.value : 0, t);
        g.linearRampToValueAtTime(voice.peak, t + V.aa);
        g.setTargetAtTime(voice.peak * V.as, t + V.aa, V.ad / 3);
        const e = V.fenv * 4800;
        for (const fl of filters) {
          const d = fl.detune;
          d.cancelScheduledValues(t);
          d.setValueAtTime(0, t);
          d.linearRampToValueAtTime(e, t + V.fa);
          d.setTargetAtTime(e * V.fs, t + V.fa, V.fd / 3);
        }
      },
      release: (t, fast) => {
        if (voice.released) return;
        voice.released = true;
        const r = fast ?? V.ar;
        const s = voice.envStart;
        const g = vca.gain;
        if (t < s + V.aa) {   // relâchée pendant l'attaque : on repart du niveau atteint
          g.cancelScheduledValues(s);
          g.setValueAtTime(0, s);
          g.linearRampToValueAtTime(voice.peak * Math.max(0, (t - s) / V.aa), t);
        } else g.cancelScheduledValues(t);
        g.setTargetAtTime(0, t, r / 4);
        const fr = fast ?? V.fr;
        for (const fl of filters) { fl.detune.cancelScheduledValues(Math.max(t, s + V.fa)); fl.detune.setTargetAtTime(0, Math.max(t, s + V.fa), fr / 4); }
        const end = t + r * 1.5 + 0.05;
        for (const n of sources) { try { n.stop(end); } catch { /* déjà arrêtée */ } }
        sources[0].onended = () => { for (const n of nodes) n.disconnect(); };
      },
      // Potards tournés pendant qu'une note joue.
      update: (N, t) => {
        const b = Math.min(20000, Math.max(20, N.cutoff * Math.pow(midiToFreq(voice.note) / 261.63, N.ktrack)));
        filters.forEach((fl, i) => { fl.frequency.setTargetAtTime(b, t, 0.02); if (!i) fl.Q.setTargetAtTime(N.reso, t, 0.02); });
        voice.vol = N.vol;
        if (t > voice.envStart + V.aa + V.ad) vca.gain.setTargetAtTime(voice.peak * V.as, t, 0.03);
        if (shaper && N.drive > 0.01) shaper.curve = driveCurve(N.drive);
      },
    };
    // Départ : glissé depuis `from`, sinon enveloppe de hauteur (pbend), sinon directement la note.
    const startF = from !== undefined && V.glide > 0.001 ? midiToFreq(from) : V.pbend ? f * Math.pow(2, V.pbend / 12) : null;
    voice.setPitch(note, t0, startF ? (from !== undefined ? V.glide : V.ptime) : 0, startF);
    voice.retrigger(t0, vel);
    for (const n of sources) n.start(t0);
    return voice;
  }
}
