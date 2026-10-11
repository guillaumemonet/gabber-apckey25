// Écrêteur (clipper) et compression multibande façon OTT : le son fort et propre d'un master hardcore.
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
    node = new AudioWorkletNode(ctx, 'gk-ott', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2], processorOptions: last ?? {} });
    fxIn.disconnect();
    fxIn.connect(node).connect(fxOut);
  };
  if (ottReady.has(ctx)) make();
  else loadOttWorklet(ctx).then(make, err => console.warn('Compression multibande indisponible', err));
  return { input, output, update(p, on = true) {
    last = { depth: p.depth, time: p.time, up: p.up, down: p.down, output: p.output };
    node?.port.postMessage(last);
    set(!!on, first || isOffline(ctx));
    first = false;
  } };
}
