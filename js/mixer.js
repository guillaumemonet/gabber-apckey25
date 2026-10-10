// Table de mixage : une voie par outil (pads, synthé, TR-909) avec effets en insert,
// panoramique, fader, envois delay / reverb, muet / solo et vumètre, puis le master du moteur.
import { t } from './i18n.js';
import { distCurve, SHAPES } from './tr909.js';

// Les niveaux de chaque son restent dans leur outil (volume des pads, niveaux de la 909).
export const CHANNELS = ['pads', 'synth', 'tr', 'tl', 'acid', 'decks', 'osc'];   // TB-303, platines, synthé à oscillateurs : K5, K6, K7 sur les pages mixeur
export const MIX_FIELDS = ['vol', 'pan', 'delay', 'reverb'];   // pages de potentiomètres Maj + piste 1 à 4
export const MAX_FX = 4;

// Effets d'insert : paramètres en valeurs réelles (min, max, pas, défaut).
export const FX_TYPES = {
  dist: { drive: [0, 1, 0.01, 0.5], shape: [0, SHAPES.length - 1, 1, 2] },
  filter: { mode: [0, 1, 1, 0], cutoff: [0, 1, 0.005, 1], reso: [0, 1, 0.01, 0.2] },
  comp: { threshold: [-60, 0, 1, -24], ratio: [1, 20, 0.5, 4], makeup: [0, 24, 0.5, 6] },
  reverb: { size: [0.3, 6, 0.1, 2], mix: [0, 1, 0.01, 0.3] },
};

const UNITY = 0.75;   // position du fader à 0 dB
export const faderGain = pos => (pos / UNITY) ** 2;
const toDb = g => (g < 0.001 ? '-∞' : `${(20 * Math.log10(g)).toFixed(1)} dB`);
const pct = v => `${Math.round(v * 100)}%`;
const panFmt = v => (Math.abs(v - 0.5) < 0.01 ? 'C' : v < 0.5 ? `${t('fmt.left')}${Math.round((0.5 - v) * 200)}` : `${t('fmt.right')}${Math.round((v - 0.5) * 200)}`);
const cutoffHz = pos => 40 * Math.pow(500, pos);   // 40 Hz .. 20 kHz

export function defaultMixState() {
  return {
    channels: Object.fromEntries(CHANNELS.map(id => [id, { vol: UNITY, pan: 0.5, delay: 0, reverb: 0, mute: false, solo: false, fx: [] }])),
  };
}

export function mergeMixState(saved) {
  const base = defaultMixState();
  for (const id of CHANNELS) Object.assign(base.channels[id], saved?.channels?.[id]);
  return base;
}

export function newFx(type) {
  return { type, p: Object.fromEntries(Object.entries(FX_TYPES[type]).map(([k, [, , , d]]) => [k, d])) };
}

export function fxParamLabel(type, key, v, p = {}) {
  if (type === 'dist' && key === 'shape') return t('tr.shapes')[v];
  if (type === 'filter' && key === 'mode') return v ? 'HP' : 'LP';
  if (type === 'filter' && key === 'cutoff') { const f = p.mode ? cutoffHz(1 - v) : cutoffHz(v); return f >= 1000 ? `${(f / 1000).toFixed(1)}k` : `${Math.round(f)}`; }
  if (type === 'comp' && key !== 'ratio') return `${v} dB`;
  if (type === 'comp') return `${v}:1`;
  if (type === 'reverb' && key === 'size') return `${v.toFixed(1)}s`;
  return pct(v);
}

// Potentiomètres d'une page mixeur : une voie par outil pour le réglage `field` (K1, K2, K3…).
export function mixKnobDefs(field) {
  return CHANNELS.map(ch => ({
    id: field, ch, label: t(`mix.short.${ch}`), min: 0, max: 1,
    def: field === 'vol' ? UNITY : field === 'pan' ? 0.5 : 0,
    fmt: field === 'vol' ? v => toDb(faderGain(v)) : field === 'pan' ? panFmt : pct,
  }));
}

export function impulse(ctx, seconds) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

// Un effet d'insert : { input, output, update(p) }.
function buildFx(ctx, fx) {
  const input = ctx.createGain();
  const output = ctx.createGain();
  const now = () => ctx.currentTime;
  switch (fx.type) {
    case 'dist': {
      const shaper = ctx.createWaveShaper();
      shaper.oversample = '2x';
      const tame = ctx.createBiquadFilter();
      tame.type = 'lowpass';
      const trim = ctx.createGain();
      input.connect(shaper).connect(tame).connect(trim).connect(output);
      return { input, output, update(p) {
        shaper.curve = distCurve(p.drive, SHAPES[p.shape]);
        tame.frequency.setTargetAtTime(16000 - p.drive * 8000, now(), 0.02);
        trim.gain.setTargetAtTime(1 - p.drive * 0.35, now(), 0.02);
      } };
    }
    case 'filter': {
      const f = ctx.createBiquadFilter();
      input.connect(f).connect(output);
      return { input, output, update(p) {
        f.type = p.mode ? 'highpass' : 'lowpass';
        f.frequency.setTargetAtTime(p.mode ? cutoffHz(1 - p.cutoff) : cutoffHz(p.cutoff), now(), 0.02);
        f.Q.setTargetAtTime(0.5 + p.reso * 14, now(), 0.02);
      } };
    }
    case 'comp': {
      const c = ctx.createDynamicsCompressor();
      c.attack.value = 0.005;
      c.release.value = 0.12;
      const makeup = ctx.createGain();
      input.connect(c).connect(makeup).connect(output);
      return { input, output, update(p) {
        c.threshold.setTargetAtTime(p.threshold, now(), 0.02);
        c.ratio.setTargetAtTime(p.ratio, now(), 0.02);
        makeup.gain.setTargetAtTime(Math.pow(10, p.makeup / 20), now(), 0.02);
      } };
    }
    case 'reverb': {
      const conv = ctx.createConvolver();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      input.connect(dry).connect(output);
      input.connect(conv).connect(wet).connect(output);
      let size = null, timer;
      return { input, output, update(p) {
        dry.gain.setTargetAtTime(1 - p.mix * 0.6, now(), 0.02);
        wet.gain.setTargetAtTime(p.mix, now(), 0.02);
        if (p.size !== size) {
          size = p.size;
          clearTimeout(timer);   // régénérer la réponse coûte cher : on attend la fin du geste
          timer = setTimeout(() => { conv.buffer = impulse(ctx, size); }, conv.buffer ? 150 : 0);
        }
      } };
    }
  }
  input.connect(output);
  return { input, output, update() {} };
}

class Strip {
  constructor(mixer, id) {
    const { ctx, engine } = mixer;
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.pan = ctx.createStereoPanner();
    this.fader = ctx.createGain();
    this.mute = ctx.createGain();
    this.dSend = ctx.createGain();
    this.rSend = ctx.createGain();
    this.meter = ctx.createAnalyser();
    this.meter.fftSize = 256;
    this.data = new Float32Array(this.meter.fftSize);
    this.fx = [];
    this.out = ctx.createGain();   // sortie de la voie : reliée par la page de câblage (master par défaut, voir js/patch.js)
    this.pan.connect(this.fader).connect(this.mute).connect(this.out);
    this.mute.connect(this.dSend).connect(engine.delayIn);
    this.mute.connect(this.rSend).connect(engine.reverbIn);
    this.mute.connect(this.meter);
    this.input.connect(this.pan);
  }

  // Reconstruit la chaîne d'effets : entrée -> fx... -> panoramique.
  rebuild(list) {
    this.input.disconnect();
    for (const f of this.fx) f.output.disconnect();
    this.fx = list.map(fx => { const node = buildFx(this.ctx, fx); node.update(fx.p); return node; });
    let prev = this.input;
    for (const f of this.fx) { prev.connect(f.input); prev = f.output; }
    prev.connect(this.pan);
  }

  apply(ch, muted) {
    const now = this.ctx.currentTime;
    this.fader.gain.setTargetAtTime(faderGain(ch.vol), now, 0.015);
    this.pan.pan.setTargetAtTime(ch.pan * 2 - 1, now, 0.015);
    this.mute.gain.setTargetAtTime(muted ? 0 : 1, now, 0.008);
    this.dSend.gain.setTargetAtTime(ch.delay, now, 0.015);
    this.rSend.gain.setTargetAtTime(ch.reverb, now, 0.015);
  }

  level() {
    this.meter.getFloatTimeDomainData(this.data);
    let peak = 0;
    for (const v of this.data) peak = Math.max(peak, Math.abs(v));
    return peak;
  }
}

export class Mixer {
  constructor(engine, getState) {
    this.engine = engine;
    this.ctx = engine.ctx;
    this.getState = getState;
    this.strips = Object.fromEntries(CHANNELS.map(id => [id, new Strip(this, id)]));
    this.reload();
  }

  get st() { return this.getState(); }
  input(id) { return this.strips[id].input; }
  level(id) { return this.strips[id].level(); }

  // Volumes, panoramiques, envois, muet / solo (le solo d'une voie coupe les autres).
  update() {
    const chans = this.st.channels;
    const solo = CHANNELS.some(id => chans[id].solo);
    for (const id of CHANNELS) this.strips[id].apply(chans[id], chans[id].mute || (solo && !chans[id].solo));
  }

  rebuild(id) { this.strips[id].rebuild(this.st.channels[id].fx); }
  updateFx(id, k) { this.strips[id].fx[k]?.update(this.st.channels[id].fx[k].p); }

  // Après un chargement d'état complet (démarrage, import de session).
  reload() {
    for (const id of CHANNELS) this.rebuild(id);
    this.update();
  }
}
