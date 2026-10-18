// Écrêteur (clipper), compression multibande façon OTT et stéréo (graves en mono, largeur) : le son fort et propre d'un master hardcore.
// Mêmes chaînes pour le master (js/audio.js) et pour les inserts des voies, pistes et bus (js/mixer.js).
// Chaque chaîne : { input, output, update(p, on) } ; coupée, l'entrée passe directement à la sortie (rien n'est calculé).

const OTT_WORKLET = 'js/ott-worklet.js?v=1';

// Réglages : [min, max, pas, défaut].
export const CLIP_PARAMS = { drive: [0, 12, 0.5, 3], ceiling: [-12, 0, 0.1, -0.5], soft: [0, 100, 1, 30] };
export const OTT_PARAMS = { depth: [0, 100, 1, 30], time: [10, 500, 5, 100], up: [0, 100, 1, 100], down: [0, 100, 1, 100], output: [-12, 12, 0.5, 0] };

const dbGain = db => Math.pow(10, db / 20);
const isOffline = ctx => typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;

// Réglage posé tout de suite (premier réglage, rendu hors ligne) ou lissé (bouton tourné pendant la lecture).
function setParam(ctx, param, v, now) {
  if (now) { param.cancelScheduledValues(0); param.value = v; } else param.setTargetAtTime(v, ctx.currentTime, 0.01);
}

// Branche fxIn -> ... -> fxOut entre input et output quand l'effet est actif (fondu de 5 ms), et le débranche
// une fois éteint (plus aucun calcul). Renvoie set(on, now).
function bypass(ctx, input, output, fxIn, fxOut) {
  const dry = ctx.createGain(), wet = ctx.createGain();
  wet.gain.value = 0;
  input.connect(dry).connect(output);
  fxOut.connect(wet).connect(output);
  let on = false, wired = false, timer;
  const wire = v => {
    if (v === wired) return;
    wired = v;
    if (v) input.connect(fxIn); else { try { input.disconnect(fxIn); } catch { /* déjà débranché */ } }
  };
  return (v, now) => {
    if (v === on && !now) return;
    on = v;
    clearTimeout(timer);
    if (on) wire(true);
    if (now) { dry.gain.cancelScheduledValues(0); wet.gain.cancelScheduledValues(0); dry.gain.value = on ? 0 : 1; wet.gain.value = on ? 1 : 0; }
    else {
      const t = ctx.currentTime;
      dry.gain.setTargetAtTime(on ? 0 : 1, t, 0.005);
      wet.gain.setTargetAtTime(on ? 1 : 0, t, 0.005);
    }
    if (!on) { if (now) wire(false); else timer = setTimeout(() => wire(false), 150); }
  };
}

// ---- Écrêteur ----

// Courbe : linéaire jusqu'au coude, puis rejoint le plafond en douceur (tanh, pente continue) ;
// softness 0 = écrêtage dur au plafond, 100 = saturation douce dès le départ. Entrée de ±CLIP_RANGE (+24 dB).
const CLIP_RANGE = 16;
const CLIP_POINTS = 16385;   // impair : 0 tombe sur un point, et chaque point est un multiple exact de 1/512
export function clipCurve(ceilingDb, soft) {
  const c = dbGain(ceilingDb), k = c * (1 - Math.min(1, Math.max(0, soft / 100))), span = c - k;
  const curve = new Float32Array(CLIP_POINTS);
  for (let i = 0; i < CLIP_POINTS; i++) {
    const x = (i / (CLIP_POINTS - 1) * 2 - 1) * CLIP_RANGE, a = Math.abs(x);
    const y = a <= k ? a : span > 0 ? k + span * Math.tanh((a - k) / span) : c;
    curve[i] = x < 0 ? -y : y;
  }
  return curve;
}

export function buildClipper(ctx) {
  const input = ctx.createGain(), output = ctx.createGain();
  const pre = ctx.createGain();   // drive, ramené dans le domaine de la courbe
  const shaper = ctx.createWaveShaper();
  shaper.oversample = '4x';       // suréchantillonné : moins de repliement des harmoniques de l'écrêtage
  pre.connect(shaper);
  const set = bypass(ctx, input, output, pre, shaper);
  let shape = '', first = true;
  return { input, output, update(p, on = true) {
    const now = first || isOffline(ctx);
    first = false;
    setParam(ctx, pre.gain, dbGain(p.drive) / CLIP_RANGE, now);
    const s = `${p.ceiling}:${p.soft}`;
    if (s !== shape) { shape = s; shaper.curve = clipCurve(p.ceiling, p.soft); }
    set(!!on, now);
  } };
}

// ---- Compression multibande façon OTT (js/ott-worklet.js) ----

const ottModules = new WeakMap();   // contexte -> chargement du module
const ottReady = new WeakSet();
export function loadOttWorklet(ctx) {
  if (!ottModules.has(ctx)) ottModules.set(ctx, ctx.audioWorklet.addModule(OTT_WORKLET).then(() => { ottReady.add(ctx); }));
  return ottModules.get(ctx);
}

export function buildOtt(ctx) {
  const input = ctx.createGain(), output = ctx.createGain();
  const fxIn = ctx.createGain(), fxOut = ctx.createGain();
  fxIn.connect(fxOut);   // en attendant le module du fil audio : passage direct
  const set = bypass(ctx, input, output, fxIn, fxOut);
  let node = null, last = null, first = true;
  const make = () => {
    node?.disconnect();
    node = new AudioWorkletNode(ctx, 'gk-ott', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: last ?? {} });
    fxIn.disconnect();
    fxIn.connect(node).connect(fxOut);
  };
  if (ottReady.has(ctx)) make();
  else loadOttWorklet(ctx).then(make, err => console.warn('Compression multibande indisponible', err));
  return { input, output, update(p, on = true) {
    last = { depth: p.depth, time: p.time, up: p.up, down: p.down, output: p.output };
    // Hors ligne (export), le message peut arriver après le début du rendu (machine lente) : le nœud est refait avec
    // les réglages dès sa création. En direct, le message suffit (quelques ms).
    if (node && isOffline(ctx)) make(); else node?.port.postMessage(last);
    set(!!on, first || isOffline(ctx));
    first = false;
  } };
}

// ---- Stéréo : graves en mono et largeur ----
// Milieu / côtés : M = (G + D) / 2, C = (G − D) / 2 ; G = M + C, D = M − C. Les côtés passent par un passe-haut
// Linkwitz-Riley 24 dB/oct. (deux Butterworth) : sous la fréquence, il ne reste que le milieu (graves en mono).
// Le milieu passe par un passe-tout du 2e ordre à la même fréquence (la somme passe-bas + passe-haut d'un LR4) :
// milieu et côtés gardent la même phase, l'image ne bouge pas au-dessus de la coupure. Largeur : gain des côtés
// (0 % = mono, 100 % = intact, 200 % = élargi).

export const STEREO_PARAMS = { freq: [20, 300, 5, 120], width: [0, 200, 1, 100] };

export function buildStereo(ctx) {
  const input = ctx.createGain(), output = ctx.createGain();
  const split = ctx.createChannelSplitter(2), merge = ctx.createChannelMerger(2);
  const half = () => { const g = ctx.createGain(); g.gain.value = 0.5; return g; };
  const mid = ctx.createGain(), side = ctx.createGain();
  const lm = half(), rm = half(), ls = half(), rs = half();
  rs.gain.value = -0.5;
  split.connect(lm, 0); split.connect(rm, 1); split.connect(ls, 0); split.connect(rs, 1);
  lm.connect(mid); rm.connect(mid); ls.connect(side); rs.connect(side);
  const ap = ctx.createBiquadFilter();
  ap.type = 'allpass'; ap.Q.value = Math.SQRT1_2;
  const hp = [0, 1].map(() => { const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.Q.value = Math.SQRT1_2; return f; });
  const width = ctx.createGain(), inv = ctx.createGain();
  inv.gain.value = -1;
  mid.connect(ap);
  side.connect(hp[0]).connect(hp[1]).connect(width);
  ap.connect(merge, 0, 0); ap.connect(merge, 0, 1);
  width.connect(merge, 0, 0); width.connect(inv).connect(merge, 0, 1);
  const set = bypass(ctx, input, output, split, merge);
  let first = true;
  return { input, output, update(p, on = true) {
    const now = first || isOffline(ctx);
    first = false;
    for (const f of [ap, ...hp]) setParam(ctx, f.frequency, p.freq, now);
    setParam(ctx, width.gain, p.width / 100, now);
    set(!!on, now);
  } };
}
