// Designer de montée : les éléments d'un build-up avant un drop, calculés hors temps réel (OfflineAudioContext) :
// riser de bruit, uplifter (montée tonale), roulement de caisse claire qui se resserre jusqu'au drop, roulement de kick,
// sub drop et impact au drop. Chaque élément donne un son stéréo (AudioBuffer), calé sur le tempo.

export const BU_BARS = [2, 4, 8, 16];
export const BU_GAPS = [0, 0.5, 1, 2];   // silence avant le drop (temps)
export const BU_SUB_LENS = [2, 4, 8];    // durée du sub drop (temps)
export const BU_ROLL_FROM = [4, 2, 1];   // densité de départ du roulement : 4 = noires, 2 = croches, 1 = doubles croches (en 16e)

export const defaultBuildup = () => ({
  bars: 8, gap: 1,
  noise: true, noiseLevel: 0.8,
  tone: true, toneRange: 24,
  snare: true, snareFrom: 4, snarePitch: 7,
  kickroll: false,
  sub: true, subLen: 4, subDrive: 0.3,
  impact: true,
  filter: true,
});

export function mergeBuildup(saved) {
  const b = defaultBuildup();
  if (!saved || typeof saved !== 'object') return b;
  for (const k of ['noise', 'tone', 'snare', 'kickroll', 'sub', 'impact', 'filter']) if (typeof saved[k] === 'boolean') b[k] = saved[k];
  if (BU_BARS.includes(saved.bars)) b.bars = saved.bars;
  if (BU_GAPS.includes(saved.gap)) b.gap = saved.gap;
  if (BU_SUB_LENS.includes(saved.subLen)) b.subLen = saved.subLen;
  if (BU_ROLL_FROM.includes(saved.snareFrom)) b.snareFrom = saved.snareFrom;
  const num = (k, lo, hi) => { if (Number.isFinite(saved[k])) b[k] = Math.min(hi, Math.max(lo, saved[k])); };
  num('noiseLevel', 0, 1); num('toneRange', 0, 36); num('snarePitch', 0, 12); num('subDrive', 0, 1);
  return b;
}

// Instants des coups du roulement (en 16e depuis le début) : la densité double à chaque quart de la montée
// (par ex. noires, croches, doubles, triples croches sur la dernière mesure), sans dépasser 1/32.
export function rollHits(sixteenths, from = 4) {
  const hits = [];
  const quarter = sixteenths / 4;
  for (let q = 0; q < 4; q++) {
    const step = Math.max(0.5, from / Math.pow(2, q));
    for (let s = q * quarter; s < (q + 1) * quarter - 1e-6; s += step) hits.push(+s.toFixed(4));
  }
  return hits;
}

const ctxFor = (sec, sr) => new OfflineAudioContext(2, Math.max(1, Math.ceil(sec * sr)), sr);
const render = ctx => ctx.startRendering();
function noiseBuffer(ctx, sec) {
  const b = ctx.createBuffer(2, Math.ceil(sec * ctx.sampleRate), ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  return b;
}
const tanhCurve = k => Float32Array.from({ length: 2049 }, (_, i) => { const x = i / 1024 - 1; return Math.tanh(k * x) / Math.tanh(k); });

/** Riser de bruit : bruit stéréo, filtre passe-bande qui monte de 300 Hz à 9 kHz, volume qui monte. */
export async function riserNoise(sec, sr, level = 0.8) {
  const ctx = ctxFor(sec, sr);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, sec);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 1.8;
  bp.frequency.setValueAtTime(300, 0);
  bp.frequency.exponentialRampToValueAtTime(9000, sec);
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.setValueAtTime(150, 0);
  hp.frequency.exponentialRampToValueAtTime(2500, sec);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.02, 0);
  g.gain.exponentialRampToValueAtTime(level * 0.9, sec * 0.98);
  g.gain.linearRampToValueAtTime(0, sec);
  src.connect(bp).connect(hp).connect(g).connect(ctx.destination);
  src.start(0);
  return render(ctx);
}

/** Uplifter : trois scies désaccordées qui montent de `range` demi-tons, filtre qui s'ouvre, volume qui monte. */
export async function riserTone(sec, sr, range = 24, note = 48) {
  const ctx = ctxFor(sec, sr);
  const f0 = 440 * Math.pow(2, (note - 69) / 12), f1 = f0 * Math.pow(2, range / 12);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 4;
  lp.frequency.setValueAtTime(400, 0);
  lp.frequency.exponentialRampToValueAtTime(12000, sec);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.01, 0);
  g.gain.exponentialRampToValueAtTime(0.35, sec * 0.98);
  g.gain.linearRampToValueAtTime(0, sec);
  lp.connect(g).connect(ctx.destination);
  [-14, 0, 14].forEach((cents, k) => {
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.detune.value = cents;
    o.frequency.setValueAtTime(f0, 0);
    o.frequency.exponentialRampToValueAtTime(f1, sec);
    const pan = ctx.createStereoPanner();
    pan.pan.value = k - 1;
    o.connect(pan).connect(lp);
    o.start(0);
    o.stop(sec);
  });
  return render(ctx);
}

// Une caisse claire hardcore : corps (sinus qui tombe) et bruit, un peu saturée.
function snareHit(ctx, at, vel, pitch, out) {
  const body = ctx.createOscillator();
  const f = 190 * Math.pow(2, pitch / 12);
  body.frequency.setValueAtTime(f * 1.6, at);
  body.frequency.exponentialRampToValueAtTime(f, at + 0.03);
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0, at);
  bg.gain.linearRampToValueAtTime(0.7 * vel, at + 0.002);
  bg.gain.setTargetAtTime(0, at + 0.01, 0.04);
  body.connect(bg).connect(out);
  body.start(at);
  body.stop(at + 0.3);
  const n = ctx.createBufferSource();
  n.buffer = ctx._noise;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 1500 * Math.pow(2, pitch / 24);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0, at);
  ng.gain.linearRampToValueAtTime(0.8 * vel, at + 0.002);
  ng.gain.setTargetAtTime(0, at + 0.015, 0.05);
  n.connect(hp).connect(ng).connect(out);
  n.start(at, Math.random() * 0.5);
  n.stop(at + 0.35);
}

/** Roulement de caisse claire : coups de plus en plus serrés jusqu'au drop, crescendo et montée de hauteur. */
export async function snareRoll(sec, sr, bpm, { from = 4, pitch = 7 } = {}) {
  const ctx = ctxFor(sec + 0.3, sr);
  ctx._noise = noiseBuffer(ctx, 1);
  const sh = ctx.createWaveShaper();
  sh.curve = tanhCurve(2.5);
  const out = ctx.createGain();
  out.gain.value = 0.6;
  sh.connect(out).connect(ctx.destination);
  const s16 = 60 / bpm / 4, total = Math.round(sec / s16);
  for (const h of rollHits(total, from)) {
    const x = h / total;
    snareHit(ctx, h * s16, 0.35 + 0.65 * x, pitch * x, sh);
  }
  return render(ctx);
}

/** Roulement de kick : le son `kick` (Float32Array) répété comme le roulement, chaque coup coupant le précédent. */
export async function kickRoll(sec, sr, bpm, kick) {
  const ctx = ctxFor(sec, sr);
  const buf = ctx.createBuffer(1, kick.length, sr);
  buf.copyToChannel(kick, 0);
  const s16 = 60 / bpm / 4, total = Math.round(sec / s16);
  const hits = rollHits(total, 4);
  hits.forEach((h, k) => {
    const at = h * s16, next = k + 1 < hits.length ? hits[k + 1] * s16 : sec;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 + 0.5 * (h / total), at);
    g.gain.setValueAtTime(0.5 + 0.5 * (h / total), Math.max(at, next - 0.004));
    g.gain.linearRampToValueAtTime(0, next);
    src.connect(g).connect(ctx.destination);
    src.start(at);
    src.stop(next + 0.01);
  });
  return render(ctx);
}

/** Sub drop : sinus qui tombe de 90 à 30 Hz sur `sec`, un peu saturé, qui s'éteint. */
export async function subDrop(sec, sr, drive = 0.3) {
  const ctx = ctxFor(sec, sr);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(90, 0);
  o.frequency.exponentialRampToValueAtTime(30, sec);
  const pre = ctx.createGain();
  pre.gain.value = 1 + drive * 4;
  const sh = ctx.createWaveShaper();
  sh.curve = tanhCurve(1 + drive * 4);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, 0);
  g.gain.linearRampToValueAtTime(0.8, 0.01);
  g.gain.setTargetAtTime(0, sec * 0.3, sec * 0.25);
  o.connect(pre).connect(sh).connect(g).connect(ctx.destination);
  o.start(0);
  o.stop(sec);
  return render(ctx);
}

/** Impact au drop : coup sourd (sinus grave qui tombe) et souffle de bruit filtré qui retombe. */
export async function impact(sr) {
  const sec = 2.5;
  const ctx = ctxFor(sec, sr);
  const o = ctx.createOscillator();
  o.frequency.setValueAtTime(120, 0);
  o.frequency.exponentialRampToValueAtTime(38, 0.4);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.9, 0);
  og.gain.setTargetAtTime(0, 0.05, 0.35);
  o.connect(og).connect(ctx.destination);
  o.start(0);
  o.stop(sec);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, sec);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(8000, 0);
  lp.frequency.exponentialRampToValueAtTime(200, sec);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5, 0);
  ng.gain.setTargetAtTime(0, 0.02, 0.5);
  n.connect(lp).connect(ng).connect(ctx.destination);
  n.start(0);
  return render(ctx);
}

/**
 * Les éléments de la montée : [{ id, start (temps, relatif au drop : négatif = avant), buffer }].
 * opts : réglages (defaultBuildup) ; bpm ; sr ; kick : Float32Array (roulement de kick) ou null.
 */
export async function buildupParts(opts, bpm, sr, kick = null) {
  const beats = opts.bars * 4, bd = 60 / bpm;
  const sec = (beats - opts.gap) * bd;   // la montée s'arrête au silence d'avant le drop
  const parts = [];
  const add = async (id, start, p) => parts.push({ id, start, buffer: await p });
  if (opts.noise) await add('noise', -beats, riserNoise(sec, sr, opts.noiseLevel));
  if (opts.tone) await add('tone', -beats, riserTone(sec, sr, opts.toneRange));
  if (opts.snare) await add('snare', -beats, snareRoll(sec, sr, bpm, { from: opts.snareFrom, pitch: opts.snarePitch }));
  if (opts.kickroll && kick) await add('kickroll', -beats, kickRoll(sec, sr, bpm, kick));
  if (opts.sub) await add('sub', 0, subDrop(opts.subLen * bd, sr, opts.subDrive));
  if (opts.impact) await add('impact', 0, impact(sr));
  return parts;
}
