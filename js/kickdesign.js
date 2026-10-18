// Designer de kick : un kick gabber / hardcore calculé dans un contexte audio hors temps réel. Trois couches :
// - clic : clic de bruit filtré et blip aigu qui tombe très vite ;
// - corps : un sinus propre dont la hauteur plonge (le « punch »), accordé une octave sous la queue ;
// - queue : tonale et saturée (sinus + scie « zaag », hauteur qui tombe puis qui plonge), accordée sur une note,
//   avec « deboom » (on retire le grave de la queue pour laisser la place à la basse) et départ retardé.
// Le mode simple montre 12 potentiomètres ; le mode expert, ceux de chaque couche. Les réglages experts ont une
// valeur neutre par défaut : un kick fait en mode simple sonne pareil dans les deux modes.
import { t } from './i18n.js';
import { distCurve, SHAPES, shapeIndex } from './tr909.js';

const expMap = (lo, hi) => p => lo * Math.pow(hi / lo, p);
const ms = v => (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(2)} s`);
const pct = v => `${Math.round(v * 100)}%`;
const NOTE_NAMES = () => t('notes');
const around = (mid, ratio) => p => mid * Math.pow(ratio, (p - 0.5) * 2);   // 0.5 = mid, 0 / 1 = mid ÷ / × ratio
export const KICK_BASE_NOTE = 41;   // fa2 = 87 Hz : la hauteur des queues des kicks des banques (tools/gabber.py, « Note » = 0)
export const kickNoteName = note => `${NOTE_NAMES()[note % 12]}${Math.floor(note / 12) - 1}`;

// Potentiomètres : position 0..1 -> valeur réelle ; affichage.
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
  // Mode expert
  clickTone: { def: 0.5, val: around(1800, 5), fmt: v => (v >= 1000 ? `${(v / 1000).toFixed(1)} kHz` : `${Math.round(v)} Hz`) },
  clickDecay: { def: 0.5, val: around(0.0025, 4), fmt: v => `${(v * 1000).toFixed(1)} ms` },
  topPitch: { def: 0.5, val: around(1, 4), fmt: v => `×${v.toFixed(2)}` },
  body: { def: 0, val: p => p, fmt: pct },
  bodyPitch: { def: 0.5, val: expMap(150, 1500), fmt: v => `${Math.round(v)} Hz` },
  bodySweep: { def: 0.5, val: around(0.02, 4), fmt: ms },
  bodyDecay: { def: 0.4, val: expMap(0.03, 0.4), fmt: ms },
  bodyDrive: { def: 0.2, val: p => p, fmt: pct },
  tail: { def: 1, val: p => p, fmt: pct },
  deboom: { def: 0, val: p => (p < 0.01 ? 0 : 30 * Math.pow(12, p)), fmt: v => (v ? `${Math.round(v)} Hz` : '—') },
  tailDelay: { def: 0, val: p => p * 0.06, fmt: v => (v ? `${Math.round(v * 1000)} ms` : '—') },
  // Sens : 0 = normal, 1 = inversé (tout le kick à l'envers), 2 = queue inversée (reverse kick : la queue à l'envers
  // qui monte, puis l'impact). Un bouton à trois positions, pas un potentiomètre.
  rev: { def: 0, steps: 3, val: p => Math.round(p * 2), fmt: v => t(`kick.rev.${v}`) },
};
export const KICK_PARAMS = Object.keys(PARAMS);
// Potentiomètres du mode simple, et ceux de chaque couche en mode expert.
export const KICK_SIMPLE = ['tune', 'pitch', 'sweep', 'bend', 'length', 'zaag', 'drive', 'shape', 'tone', 'bite', 'click', 'top'];
export const KICK_LAYERS = {
  click: ['click', 'clickTone', 'clickDecay', 'top', 'topPitch'],
  body: ['body', 'bodyPitch', 'bodySweep', 'bodyDecay', 'bodyDrive'],
  tail: ['tail', 'tune', 'pitch', 'sweep', 'bend', 'length', 'zaag', 'drive', 'shape', 'tone', 'bite', 'deboom', 'tailDelay'],
};
// Note de la queue (MIDI) réglée par le potentiomètre « Note ».
export const kickTailNote = positions => KICK_BASE_NOTE + kickValue('tune', positions.tune ?? PARAMS.tune.def);
export const kickValue = (id, p) => PARAMS[id].val(p);
export const kickFmt = (id, p) => PARAMS[id].fmt(PARAMS[id].val(p));
export const kickSteps = id => PARAMS[id].steps;
export const kickDefaults = () => Object.fromEntries(KICK_PARAMS.map(id => [id, PARAMS[id].def]));

// Presets (positions des potentiomètres) ; les autres potentiomètres gardent leur valeur par défaut.
// Notes des queues comme les kicks des banques : Rotterdam +2, Early +5, Terror +7 demi-tons au-dessus de fa2.
export const KICK_PRESETS = {
  rotterdam: { tune: 0.58, pitch: 0.35, sweep: 0.3, bend: 0.15, length: 0.38, zaag: 0, drive: 0.78, shape: 0.5, tone: 0.42, bite: 0.5, click: 0.35, top: 0.45 },
  mainstream: { pitch: 0.5, sweep: 0.22, bend: 0.3, length: 0.45, zaag: 0.12, drive: 0.62, shape: 0.25, tone: 0.5, bite: 0.55, click: 0.6, top: 0.8 },
  uptempo: { pitch: 0.55, sweep: 0.2, bend: 0.3, length: 0.5, zaag: 0.7, drive: 0.55, shape: 0.25, tone: 0.58, bite: 0.65, click: 0.8, top: 0.9 },
  raw: { pitch: 0.5, sweep: 0.25, bend: 0.75, length: 0.45, zaag: 0.45, drive: 0.6, shape: 0.25, tone: 0.35, bite: 0.6, click: 0.7, top: 0.85 },
  terror: { tune: 0.79, pitch: 0.75, sweep: 0.12, bend: 0.1, length: 0.08, zaag: 0.1, drive: 0.95, shape: 0.25, tone: 0.55, bite: 0.7, click: 0.8, top: 0.6 },
  industrial: { pitch: 0.4, sweep: 0.3, bend: 0.2, length: 0.4, zaag: 0.2, drive: 0.7, shape: 1, tone: 0.5, bite: 0.5, click: 0.5, top: 0.5 },
  early: { tune: 0.71, pitch: 0.3, sweep: 0.35, bend: 0.1, length: 0.62, zaag: 0, drive: 0.3, shape: 0, tone: 0.3, bite: 0.25, click: 0.25, top: 0.3 },
  frenchcore: { pitch: 0.6, sweep: 0.15, bend: 0.2, length: 0.36, zaag: 0.25, drive: 0.7, shape: 0.25, tone: 0.65, bite: 0.6, click: 0.9, top: 1 },
  // 909 : queue vers 55 Hz (la), balayage court depuis ~250 Hz, presque pas de distorsion, attaque douce.
  tr909: { tune: 0.17, pitch: 0.47, sweep: 0.52, bend: 0.05, length: 0.5, zaag: 0, drive: 0.1, shape: 0, tone: 0.3, bite: 0.1, click: 0.3, top: 0.2 },
};

export const KICK_CATS = ['gabber', 'hardcore', 'modern'];
export const KICK_PRESET_CAT = { rotterdam: 'gabber', early: 'gabber', tr909: 'gabber', terror: 'hardcore', industrial: 'hardcore', frenchcore: 'hardcore', mainstream: 'modern', uptempo: 'modern', raw: 'modern' };

export function defaultKickState() {
  return { params: { ...kickDefaults(), ...KICK_PRESETS.mainstream }, preset: 'mainstream', auto: true, user: [], expert: false, solo: null };
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
  base.expert = saved.expert === true;
  return base;
}

// Réglages d'un kick (positions) valides : ceux d'un bloc de mélodie de kick ou d'une ancienne sauvegarde.
export function cleanKickParams(p) {
  const out = kickDefaults();
  if (p && typeof p === 'object') for (const id of KICK_PARAMS) if (Number.isFinite(p[id])) out[id] = Math.min(1, Math.max(0, p[id]));
  return out;
}

// Rend le kick : Float32Array mono, crête normalisée à -1 dBFS.
// opts.note : note MIDI de la queue (mélodie de kick ; sinon celle du potentiomètre « Note ») ;
// opts.only : 'click' | 'body' | 'tail' : une seule couche, au niveau qu'elle a dans le kick entier (écoute en solo, dessin).
export async function renderKick(positions, sampleRate = 44100, opts = {}) {
  const rev = kickValue('rev', positions.rev ?? PARAMS.rev.def);
  const all = reverseKick(await renderKickRaw(positions, sampleRate, opts.note), sampleRate, rev);
  const peak = peakOf(all);
  return finishKick(opts.only ? reverseKick(await renderKickRaw(positions, sampleRate, opts.note, opts.only), sampleRate, rev) : all, sampleRate, peak);
}

// Sens du kick. 1 : tout à l'envers (il monte et finit sur l'attaque). 2 : queue inversée (comme le kick « Reverse »
// des banques) : la queue sans les 30 premières ms, à l'envers et en montée (0,2 -> 1), puis l'impact (120 ms).
const REV_SKIP = 0.03, REV_PUNCH = 0.12;
export function reverseKick(data, sampleRate, rev) {
  if (!rev) return data;
  if (rev === 1) return Float32Array.from(data).reverse();
  const skip = Math.min(data.length, Math.round(REV_SKIP * sampleRate));
  const punchLen = Math.min(data.length, Math.round(REV_PUNCH * sampleRate));
  const tail = data.slice(skip).reverse();
  const out = new Float32Array(tail.length + punchLen);
  for (let i = 0; i < tail.length; i++) out[i] = tail[i] * (0.2 + 0.8 * i / Math.max(1, tail.length - 1));
  const fade = Math.round(0.02 * sampleRate);
  for (let i = 0; i < punchLen; i++) out[tail.length + i] = data[i] * Math.min(1, (punchLen - i) / fade);
  return out;
}
const peakOf = d => { let p = 0; for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i])); return p; };
function finishKick(out, sampleRate, peak) {
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.89 / peak;
  const fade = Math.min(out.length, Math.round(0.004 * sampleRate));
  for (let i = 0; i < fade; i++) out[out.length - 1 - i] *= i / fade;
  return out;
}

async function renderKickRaw(positions, sampleRate, note, only = null) {
  const v = id => kickValue(id, positions[id] ?? PARAMS[id].def);
  const on = layer => !only || only === layer;
  const len = v('length');
  const dur = Math.min(2.2, 0.06 + len * 1.4);
  const n = Math.ceil(dur * sampleRate);
  const ctx = new OfflineAudioContext(1, n, sampleRate);
  const f0 = 440 * Math.pow(2, ((note ?? KICK_BASE_NOTE + v('tune')) - 69) / 12);

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
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 32;
  // Fin douce : la saturation garde la queue forte, on la referme à la fin.
  const tailEnd = ctx.createGain();
  tailEnd.gain.setValueAtTime(1, 0);
  tailEnd.gain.setValueAtTime(1, dur * 0.8);
  tailEnd.gain.linearRampToValueAtTime(0, dur);
  hp.connect(tailEnd).connect(ctx.destination);
  const oscs = [];

  // Queue : sinus + scie (zaag) -> enveloppe -> saturation -> formant -> filtres (-> deboom) -> niveau de la queue.
  if (on('tail') && v('tail') > 0) {
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
    sine.connect(mixSine).connect(env);
    saw.connect(mixSaw).connect(env);
    let node = env.connect(pre).connect(shaper).connect(formant).connect(lp);
    if (v('deboom') > 0) {   // deboom : passe-haut raide (deux fois deux pôles) sous la queue
      for (let k = 0; k < 2; k++) {
        const f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = v('deboom');
        f.Q.value = 0.9;
        node = node.connect(f);
      }
    }
    const level = ctx.createGain();
    level.gain.value = v('tail');
    if (v('tailDelay') > 0) {   // la queue entre en fondu : le clic et le corps font l'attaque
      level.gain.setValueAtTime(0, 0);
      level.gain.linearRampToValueAtTime(v('tail'), v('tailDelay'));
    }
    node.connect(level).connect(hp);
    oscs.push(sine, saw);
  }

  // Corps : sinus qui plonge de « Hauteur » à une octave sous la note de la queue, légèrement saturé.
  if (on('body') && v('body') > 0) {
    const body = ctx.createOscillator();
    const end = f0 / 2;
    body.frequency.setValueAtTime(Math.max(end, v('bodyPitch')), 0);
    body.frequency.setTargetAtTime(end, 0, v('bodySweep') / 2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, 0);
    env.gain.linearRampToValueAtTime(v('body'), 0.001);
    env.gain.setValueAtTime(v('body'), 0.004);
    env.gain.setTargetAtTime(0, 0.004, v('bodyDecay') / 3);
    const sh = ctx.createWaveShaper();
    sh.curve = distCurve(Math.max(0.02, v('bodyDrive')), 'soft');
    sh.oversample = '2x';
    body.connect(env).connect(sh).connect(hp);
    oscs.push(body);
  }

  // Clic : blip qui tombe très vite (« Blip ») et clic de bruit filtré.
  if (on('click')) {
    // Blip : saturé AVANT son enveloppe, pour qu'il s'éteigne vraiment en quelques millisecondes (saturé après, il
    // restait à plein niveau pendant ~50 ms : un bourdonnement carré une octave au-dessus de la queue).
    const top = ctx.createOscillator();
    top.frequency.setValueAtTime(Math.min(4000, f0 * 2 * v('pitch') * 1.8 * v('topPitch')), 0);
    top.frequency.exponentialRampToValueAtTime(f0 * 2, 0.008);
    const topShape = ctx.createWaveShaper();
    topShape.curve = distCurve(0.6, 'hard');
    const topEnv = ctx.createGain();
    topEnv.gain.setValueAtTime(0, 0);
    topEnv.gain.linearRampToValueAtTime(v('top') * 0.9, 0.0005);
    topEnv.gain.setValueAtTime(v('top') * 0.9, 0.0015);
    topEnv.gain.setTargetAtTime(0, 0.0015, Math.max(0.0015, v('clickDecay') * 0.9));
    top.connect(topShape).connect(topEnv).connect(hp);
    oscs.push(top);
    const noiseLen = Math.ceil(Math.max(0.02, v('clickDecay') * 8) * sampleRate);
    const nb = ctx.createBuffer(1, noiseLen, sampleRate);
    const nd = nb.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) nd[i] = (Math.random() * 2 - 1) * Math.exp(-i / (v('clickDecay') * sampleRate));
    const noise = ctx.createBufferSource();
    noise.buffer = nb;
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = v('clickTone');
    const ng = ctx.createGain();
    ng.gain.value = v('click') * 0.9;
    noise.connect(nf).connect(ng).connect(hp);
    noise.start(0);
  }

  for (const o of oscs) { o.start(0); o.stop(dur); }
  return (await ctx.startRendering()).getChannelData(0);
}
