// Designer de kick : un kick gabber / hardcore calculé dans un contexte audio hors temps réel, à partir de
// 12 potards. Deux couches, comme dans tools/gabber.py : une queue tonale saturée (sinus + scie « zaag »,
// hauteur qui tombe puis qui plonge) et une attaque courte (blip aigu + clic de bruit).
import { t } from './i18n.js';
import { distCurve, SHAPES, shapeIndex } from './tr909.js';

const expMap = (lo, hi) => p => lo * Math.pow(hi / lo, p);
const ms = v => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);
const pct = v => `${Math.round(v * 100)}%`;
const NOTE_NAMES = () => t('notes');

// Potards : position 0..1 -> valeur réelle ; affichage.
const PARAMS = {
  tune: { def: 0.5, steps: 25, val: p => Math.round(p * 24) - 12, fmt: v => `${NOTE_NAMES()[((5 + v) % 12 + 12) % 12]} (${v > 0 ? '+' : ''}${v})` },
  pitch: { def: 0.45, val: expMap(1.5, 16), fmt: v => `×${v.toFixed(1)}` },
  sweep: { def: 0.3, val: expMap(0.004, 0.09), fmt: ms },
  bend: { def: 0.25, val: p => p, fmt: v => `−${(v * 12).toFixed(1)} st` },
  length: { def: 0.35, val: expMap(0.12, 1.6), fmt: ms },
  zaag: { def: 0, val: p => p, fmt: pct },
  drive: { def: 0.65, val: p => p, fmt: pct },
  shape: { def: 0.5, steps: SHAPES.length, val: p => shapeIndex(p), fmt: v => t('tr.shapes')[v] },
  tone: { def: 0.45, val: expMap(300, 3200), fmt: v => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`) },
  bite: { def: 0.45, val: p => p * 14, fmt: v => `+${v.toFixed(1)} dB` },
  click: { def: 0.4, val: p => p, fmt: pct },
  top: { def: 0.6, val: p => p, fmt: pct },
};
export const KICK_PARAMS = Object.keys(PARAMS);
export const kickValue = (id, p) => PARAMS[id].val(p);
export const kickFmt = (id, p) => PARAMS[id].fmt(PARAMS[id].val(p));
export const kickSteps = id => PARAMS[id].steps;
export const kickDefaults = () => Object.fromEntries(KICK_PARAMS.map(id => [id, PARAMS[id].def]));

// Presets (positions des potards) ; les autres potards gardent leur valeur par défaut.
export const KICK_PRESETS = {
  rotterdam: { pitch: 0.35, sweep: 0.3, bend: 0.15, length: 0.38, zaag: 0, drive: 0.78, shape: 0.5, tone: 0.42, bite: 0.5, click: 0.35, top: 0.45 },
  mainstream: { pitch: 0.5, sweep: 0.22, bend: 0.3, length: 0.45, zaag: 0.12, drive: 0.62, shape: 0.25, tone: 0.5, bite: 0.55, click: 0.6, top: 0.8 },
  uptempo: { pitch: 0.55, sweep: 0.2, bend: 0.3, length: 0.5, zaag: 0.7, drive: 0.55, shape: 0.25, tone: 0.58, bite: 0.65, click: 0.8, top: 0.9 },
  raw: { pitch: 0.5, sweep: 0.25, bend: 0.75, length: 0.45, zaag: 0.45, drive: 0.6, shape: 0.25, tone: 0.35, bite: 0.6, click: 0.7, top: 0.85 },
  terror: { pitch: 0.75, sweep: 0.12, bend: 0.1, length: 0.08, zaag: 0.1, drive: 0.95, shape: 0.25, tone: 0.55, bite: 0.7, click: 0.8, top: 0.6 },
  industrial: { pitch: 0.4, sweep: 0.3, bend: 0.2, length: 0.4, zaag: 0.2, drive: 0.7, shape: 1, tone: 0.5, bite: 0.5, click: 0.5, top: 0.5 },
  early: { pitch: 0.3, sweep: 0.35, bend: 0.1, length: 0.62, zaag: 0, drive: 0.3, shape: 0, tone: 0.3, bite: 0.25, click: 0.25, top: 0.3 },
  frenchcore: { pitch: 0.6, sweep: 0.15, bend: 0.2, length: 0.36, zaag: 0.25, drive: 0.7, shape: 0.25, tone: 0.65, bite: 0.6, click: 0.9, top: 1 },
};

export const KICK_CATS = ['gabber', 'hardcore', 'modern'];
export const KICK_PRESET_CAT = { rotterdam: 'gabber', early: 'gabber', terror: 'hardcore', industrial: 'hardcore', frenchcore: 'hardcore', mainstream: 'modern', uptempo: 'modern', raw: 'modern' };

export function defaultKickState() {
  return { params: { ...kickDefaults(), ...KICK_PRESETS.mainstream }, preset: 'mainstream', auto: true, user: [] };
}

export function mergeKickState(saved) {
  const base = defaultKickState();
  if (!saved || typeof saved !== 'object') return base;
  for (const id of KICK_PARAMS) if (Number.isFinite(saved.params?.[id])) base.params[id] = Math.min(1, Math.max(0, saved.params[id]));
  base.preset = saved.preset in KICK_PRESETS || (typeof saved.preset === 'string' && saved.preset.startsWith('u:')) ? saved.preset : null;
  if (Array.isArray(saved.user)) {
    base.user = saved.user.filter(u => typeof u?.id === 'string' && u.id.startsWith('u:') && typeof u.name === 'string' && u.params).map(u => ({
      id: u.id, name: u.name.slice(0, 24), cat: KICK_CATS.includes(u.cat) ? u.cat : 'gabber',
      params: { ...kickDefaults(), ...Object.fromEntries(KICK_PARAMS.filter(id => Number.isFinite(u.params[id])).map(id => [id, Math.min(1, Math.max(0, u.params[id]))])) },
    }));
  }
  if (base.preset?.startsWith('u:') && !base.user.some(u => u.id === base.preset)) base.preset = null;
  if (typeof saved.auto === 'boolean') base.auto = saved.auto;
  return base;
}

// Rend le kick : Float32Array mono, crête normalisée à -1 dBFS.
export async function renderKick(positions, sampleRate = 44100) {
  const v = id => kickValue(id, positions[id]);
  const len = v('length');
  const dur = Math.min(2.2, 0.06 + len * 1.4);
  const n = Math.ceil(dur * sampleRate);
  const ctx = new OfflineAudioContext(1, n, sampleRate);
  const f0 = 440 * Math.pow(2, (53 + v('tune') - 69) / 12);   // fa3 = 175 Hz : la hauteur des queues des kicks des banques

  // Courbes calculées point par point (hauteur et enveloppe), posées sur les paramètres audio.
  const pts = 512;
  const freq = new Float32Array(pts);
  const amp = new Float32Array(pts);
  const hold = 0.03;
  for (let i = 0; i < pts; i++) {
    const tt = (i / (pts - 1)) * dur;
    freq[i] = f0 * (1 + (v('pitch') - 1) * Math.exp(-tt / v('sweep'))) * Math.pow(2, -v('bend') * Math.min(1, tt / (len * 1.2)));
    const a = tt < 0.002 ? tt / 0.002 : tt < hold ? 1 : Math.exp(-(tt - hold) / (len / 2.2));
    amp[i] = a;
  }

  // Queue : sinus + scie (zaag) -> enveloppe -> saturation -> formant -> filtres.
  const sine = ctx.createOscillator();
  const saw = ctx.createOscillator();
  saw.type = 'sawtooth';
  for (const o of [sine, saw]) o.frequency.setValueCurveAtTime(freq, 0, dur);
  const mixSine = ctx.createGain();
  const mixSaw = ctx.createGain();
  mixSine.gain.value = 1 - v('zaag') * 0.7;
  mixSaw.gain.value = v('zaag') * 0.8;
  const env = ctx.createGain();
  env.gain.value = 0;
  env.gain.setValueCurveAtTime(amp, 0, dur);
  const pre = ctx.createGain();
  pre.gain.value = 1 + v('drive') * 3;
  const shaper = ctx.createWaveShaper();
  shaper.curve = distCurve(Math.max(0.02, v('drive')), SHAPES[v('shape')]);
  shaper.oversample = '4x';
  const formant = ctx.createBiquadFilter();
  formant.type = 'peaking';
  formant.frequency.value = v('tone');
  formant.Q.value = 1;
  formant.gain.value = v('bite');
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7500;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 32;
  // Fin douce : la saturation garde la queue forte, on la referme à la fin.
  const tailEnd = ctx.createGain();
  tailEnd.gain.setValueAtTime(1, 0);
  tailEnd.gain.setValueAtTime(1, dur * 0.8);
  tailEnd.gain.linearRampToValueAtTime(0, dur);
  sine.connect(mixSine).connect(env);
  saw.connect(mixSaw).connect(env);
  env.connect(pre).connect(shaper).connect(formant).connect(lp).connect(hp).connect(tailEnd).connect(ctx.destination);

  // Attaque : blip qui tombe très vite (couche « top ») et clic de bruit filtré.
  const top = ctx.createOscillator();
  top.frequency.setValueAtTime(Math.min(4000, f0 * 2 * v('pitch') * 1.8), 0);
  top.frequency.exponentialRampToValueAtTime(f0 * 2, 0.012);
  const topEnv = ctx.createGain();
  topEnv.gain.setValueAtTime(0, 0);
  topEnv.gain.linearRampToValueAtTime(v('top') * 0.9, 0.001);
  topEnv.gain.setTargetAtTime(0, 0.006, 0.012);
  const topShape = ctx.createWaveShaper();
  topShape.curve = distCurve(0.6, 'hard');
  top.connect(topEnv).connect(topShape).connect(hp);
  const noiseLen = Math.ceil(0.02 * sampleRate);
  const nb = ctx.createBuffer(1, noiseLen, sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (0.0025 * sampleRate));
  const noise = ctx.createBufferSource();
  noise.buffer = nb;
  const nf = ctx.createBiquadFilter();
  nf.type = 'highpass';
  nf.frequency.value = 1800;
  const ng = ctx.createGain();
  ng.gain.value = v('click') * 0.9;
  noise.connect(nf).connect(ng).connect(hp);

  for (const o of [sine, saw, top]) { o.start(0); o.stop(dur); }
  noise.start(0);
  const out = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.89 / peak;
  const fade = Math.min(out.length, Math.round(0.004 * sampleRate));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}
