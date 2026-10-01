// Effets de piste de la timeline : blocs posés sur la ligne d'effets d'une piste, actifs pendant leur durée.
// Chaque bloc a sa propre petite chaîne audio, insérée en série sur la piste : transparente en dehors du bloc,
// elle agit (automation calée sur l'horloge audio) pendant sa durée. Plusieurs blocs se cumulent.
// Un bloc : { id, fx (type), start, len (en temps), p (réglages), name }.
import { t } from './i18n.js';
import { distCurve } from './tr909.js';
import { curveSamples, curveNeutral } from './curves.js';

// Courbes des blocs « Courbe » (designer d'effet) : identifiant -> courbe ; branché par l'application.
let resolveCurve = () => null;
export function setCurveResolver(fn) { resolveCurve = fn; }
// Ce qui change la structure de la chaîne d'une courbe (le réglage piloté) : la chaîne est alors reconstruite.
const curveSig = id => resolveCurve(id)?.target ?? '-';

// Motifs de déclenchement du PCF (16 pas).
export const PCF_PATTERNS = {
  eighths: 'x.x.x.x.x.x.x.x.',
  sixteenths: 'xxxxxxxxxxxxxxxx',
  quarters: 'x...x...x...x...',
  offbeat: '..x...x...x...x.',
  gallop: 'x..xx..xx..xx.xx',
  '332': 'x..x..x.x..x..x.',
  roll: 'x.x.xxxxx.x.xxxx',
};

// Réglages : { clé: [type, défaut, options ou min/max/pas] }.
const S = (def, options) => ['select', def, options];
const R = (def, min, max, step) => ['range', def, min, max, step];
const DIV = [4, 8, 16, 32];

export const FX_TYPES = {
  fadein: { family: 'volume', params: {} },
  fadeout: { family: 'volume', params: {} },
  swell: { family: 'volume', params: { from: R(0.25, 0, 1, 0.05) } },
  gate: { family: 'volume', params: { div: S(16, [8, 16, 32]), depth: R(1, 0.2, 1, 0.05) } },
  mute: { family: 'volume', params: {} },
  hprise: { family: 'filter', params: { to: R(2500, 300, 8000, 50), reso: R(4, 0.7, 14, 0.1) } },
  lpclose: { family: 'filter', params: { to: R(400, 100, 3000, 25), reso: R(3, 0.7, 14, 0.1) } },
  wobble: { family: 'filter', params: { div: S(8, DIV), lo: R(250, 60, 2000, 10), hi: R(3500, 500, 12000, 50), reso: R(6, 0.7, 16, 0.1) } },
  pcf: { family: 'filter', params: { mode: S('lp', ['lp', 'bp']), pattern: S('eighths', Object.keys(PCF_PATTERNS)), freq: R(300, 60, 4000, 10), q: R(8, 0.7, 20, 0.1), amt: R(0.7, 0, 1, 0.01), dec: R(0.12, 0.02, 0.8, 0.01) } },
  reverbthrow: { family: 'space', params: { amount: R(0.9, 0.1, 1.5, 0.05) } },
  delaythrow: { family: 'space', params: { div: S(8, [4, 8, 16, 6]), feedback: R(0.55, 0, 0.9, 0.05), mix: R(0.8, 0.1, 1, 0.05) } },
  autopan: { family: 'space', params: { div: S(4, DIV), depth: R(0.8, 0.1, 1, 0.05) } },
  stutter: { family: 'time', params: { div: S(16, [8, 16, 32]) } },
  tapestop: { family: 'time', params: {} },
  driverise: { family: 'drive', params: { drive: R(0.9, 0.2, 1, 0.05) } },
  orbit3d: { family: '3d', params: { bars: S(1, [0.5, 1, 2, 4]), radius: R(1.5, 0.5, 6, 0.1), dir: S('cw', ['cw', 'ccw']) } },
  flyby3d: { family: '3d', params: { dir: S('lr', ['lr', 'rl']), distance: R(8, 2, 20, 0.5) } },
  zoomin3d: { family: '3d', params: { distance: R(12, 2, 30, 0.5) } },
  zoomout3d: { family: '3d', params: { distance: R(12, 2, 30, 0.5) } },
  spiral3d: { family: '3d', params: { bars: S(1, [0.5, 1, 2]), height: R(4, 1, 10, 0.5) } },
  crushrise: { family: 'drive', params: { amount: R(0.85, 0.2, 1, 0.05) } },
  curve: { family: 'curve', params: { curve: ['curve', 'b:pump'] } },
};

// Banque d'effets : ce qui apparaît dans la bibliothèque (type, réglages, longueur par défaut en temps).
export const FX_BANK = [
  { id: 'fadein', fx: 'fadein', len: 8 },
  { id: 'fadeout', fx: 'fadeout', len: 8 },
  { id: 'swell', fx: 'swell', len: 16 },
  { id: 'gate8', fx: 'gate', p: { div: 8 }, len: 8 },
  { id: 'gate16', fx: 'gate', p: { div: 16 }, len: 8 },
  { id: 'mute', fx: 'mute', len: 4 },
  { id: 'hprise', fx: 'hprise', len: 16 },
  { id: 'lpclose', fx: 'lpclose', len: 16 },
  { id: 'wobble4', fx: 'wobble', p: { div: 4 }, len: 16 },
  { id: 'wobble8', fx: 'wobble', p: { div: 8 }, len: 16 },
  { id: 'pcf8', fx: 'pcf', p: { pattern: 'eighths' }, len: 16 },
  { id: 'pcf16', fx: 'pcf', p: { pattern: 'sixteenths', dec: 0.07 }, len: 16 },
  { id: 'pcfoff', fx: 'pcf', p: { pattern: 'offbeat', dec: 0.18 }, len: 16 },
  { id: 'pcfgallop', fx: 'pcf', p: { pattern: 'gallop', dec: 0.09 }, len: 16 },
  { id: 'pcf332', fx: 'pcf', p: { pattern: '332', dec: 0.15 }, len: 16 },
  { id: 'pcfband', fx: 'pcf', p: { mode: 'bp', pattern: 'sixteenths', freq: 600, q: 5, dec: 0.08 }, len: 16 },
  { id: 'reverbthrow', fx: 'reverbthrow', len: 2 },
  { id: 'delaythrow', fx: 'delaythrow', len: 2 },
  { id: 'autopan', fx: 'autopan', len: 16 },
  { id: 'stutter8', fx: 'stutter', p: { div: 8 }, len: 4 },
  { id: 'stutter16', fx: 'stutter', p: { div: 16 }, len: 4 },
  { id: 'stutter32', fx: 'stutter', p: { div: 32 }, len: 2 },
  { id: 'tapestop', fx: 'tapestop', len: 4 },
  { id: 'driverise', fx: 'driverise', len: 16 },
  { id: 'crushrise', fx: 'crushrise', len: 16 },
  { id: 'orbit3d', fx: 'orbit3d', len: 16 },
  { id: 'flyby3d', fx: 'flyby3d', len: 8 },
  { id: 'zoomin3d', fx: 'zoomin3d', len: 16 },
  { id: 'zoomout3d', fx: 'zoomout3d', len: 16 },
  { id: 'spiral3d', fx: 'spiral3d', len: 16 },
];

export const FX_FAMILY_COLORS = { volume: 13, filter: 37, space: 41, time: 53, drive: 5, '3d': 49, curve: 21 };

export function fxDefaults(type) {
  return Object.fromEntries(Object.entries(FX_TYPES[type]?.params ?? {}).map(([k, v]) => [k, v[1]]));
}

// Bloc tel qu'il est sauvegardé ; les réglages inconnus reprennent leur valeur par défaut.
export function cleanFx(b) {
  if (!b || typeof b !== 'object' || !FX_TYPES[b.fx] || !Number.isFinite(b.start) || !Number.isFinite(b.len)) return null;
  const p = fxDefaults(b.fx);
  for (const [k, [kind, , a, bmax]] of Object.entries(FX_TYPES[b.fx].params)) {
    const v = b.p?.[k];
    if (kind === 'curve' ? typeof v === 'string' && /^[bu]:/.test(v) : kind === 'select' ? a.includes(v) : Number.isFinite(v) && v >= a && v <= bmax) p[k] = v;
  }
  return { id: typeof b.id === 'string' ? b.id : crypto.randomUUID(), fx: b.fx, start: Math.max(0, b.start), len: Math.max(0.25, b.len), p, name: String(b.name ?? '') };
}

export const bankName = item => t(`tfx.${item.id}`);

// ---- Chaînes audio ----

const RAMP = 0.004;

// Une chaîne d'effet : in -> ... -> out, transparente hors du bloc. `play(t0, t1, bd)` programme l'effet.
function buildGroup(ctx, engine, b) {
  const p = b.p;
  const input = ctx.createGain();
  const output = ctx.createGain();
  const gain = v => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const params = [];   // paramètres automatisés (remis à zéro à l'arrêt) : [AudioParam, valeur neutre]
  const neutral = (param, v) => { params.push([param, v]); param.value = v; return param; };
  const timers = [];
  let unwire = null;   // débranche le côté traité (arrêt de la lecture)
  // Mélange sec / traité : hors du bloc, 100 % sec (exactement transparent).
  // Le côté traité n'est branché (donc calculé) qu'autour de ses blocs : un effet muet coûte autant qu'un effet
  // qui joue (la 3D surtout). Rendu hors ligne (export) : branché tout le temps, les minuteries n'y ont pas de sens.
  const crossfade = wetIn => {
    const dry = gain(1), wet = gain(0);
    input.connect(dry).connect(output);
    const offline = typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
    let wired = false, open = 0;
    const wire = v => {
      if (v === wired) return;
      wired = v;
      if (v) input.connect(wetIn); else { try { input.disconnect(wetIn); } catch { /* déjà débranché */ } }
    };
    if (offline) wire(true);
    else unwire = () => { for (const id of timers) clearTimeout(id); timers.length = 0; open = 0; wire(false); };
    neutral(dry.gain, 1);
    neutral(wet.gain, 0);
    // Branché 1,5 s avant (une minuterie peut prendre du retard), débranché une fois le côté traité retombé à zéro.
    const arm = (t0, t1) => {
      if (offline) return;
      const now = ctx.currentTime;
      open++;
      timers.push(setTimeout(() => wire(true), Math.max(0, (t0 - now - 1.5) * 1000)));
      timers.push(setTimeout(() => { open = Math.max(0, open - 1); if (!open) wire(false); }, Math.max(0, (t1 - now + 0.5) * 1000)));
    };
    return { dry, wet, arm, open(t0, t1, fade = RAMP) {
      dry.gain.setTargetAtTime(0, t0, fade); wet.gain.setTargetAtTime(1, t0, fade);
      dry.gain.setTargetAtTime(1, t1, RAMP); wet.gain.setTargetAtTime(0, t1, RAMP);
      arm(t0, t1);
    } };
  };
  let play = () => {};
  switch (b.fx) {
    case 'fadein': case 'fadeout': case 'swell': case 'mute': case 'gate': {
      const g = gain(1);
      input.connect(g).connect(output);
      neutral(g.gain, 1);
      play = (t0, t1, bd) => {
        const a = g.gain;
        if (b.fx === 'fadein') { a.setValueAtTime(0.0001, t0); a.linearRampToValueAtTime(1, t1); }
        else if (b.fx === 'fadeout') { a.setValueAtTime(1, t0); a.linearRampToValueAtTime(0.0001, t1 - RAMP); a.setValueAtTime(1, t1); }
        else if (b.fx === 'swell') { a.setValueAtTime(p.from, t0); a.exponentialRampToValueAtTime(1.25, t1 - RAMP); a.setTargetAtTime(1, t1, RAMP); }
        else if (b.fx === 'mute') { a.setTargetAtTime(0, t0, RAMP); a.setTargetAtTime(1, t1, RAMP); }
        else {   // gate : ouvert la première moitié de chaque pas
          const step = bd * 4 / p.div;
          for (let s = t0; s < t1 - 1e-4; s += step) { a.setTargetAtTime(1, s, 0.002); a.setTargetAtTime(1 - p.depth, s + step / 2, 0.002); }
          a.setTargetAtTime(1, t1, RAMP);
        }
      };
      break;
    }
    case 'hprise': case 'lpclose': case 'wobble': case 'pcf': {
      const f = ctx.createBiquadFilter();
      f.type = b.fx === 'hprise' ? 'highpass' : b.fx === 'pcf' && p.mode === 'bp' ? 'bandpass' : 'lowpass';
      const x = crossfade(f);
      f.connect(x.wet).connect(output);
      play = (t0, t1, bd) => {
        const fr = f.frequency;
        fr.cancelScheduledValues(t0);
        if (b.fx === 'hprise') { f.Q.setValueAtTime(p.reso, t0); fr.setValueAtTime(30, t0); fr.exponentialRampToValueAtTime(p.to, t1); }
        else if (b.fx === 'lpclose') { f.Q.setValueAtTime(p.reso, t0); fr.setValueAtTime(18000, t0); fr.exponentialRampToValueAtTime(p.to, t1); }
        else if (b.fx === 'wobble') {
          f.Q.setValueAtTime(p.reso, t0);
          const period = bd * 4 / p.div;
          const n = Math.max(8, Math.ceil((t1 - t0) / period * 48));
          const curve = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const ph = ((i / (n - 1)) * (t1 - t0)) / period;
            curve[i] = p.lo * Math.pow(p.hi / p.lo, 0.5 - 0.5 * Math.cos(2 * Math.PI * ph));
          }
          fr.setValueCurveAtTime(curve, t0, t1 - t0);
        } else {   // PCF : l'enveloppe du filtre repart à chaque pas actif du motif
          f.Q.setValueAtTime(p.q, t0);
          fr.setValueAtTime(p.freq, t0);
          const pat = PCF_PATTERNS[p.pattern] ?? PCF_PATTERNS.eighths;
          const step = bd / 4;
          const peak = Math.min(18000, p.freq * (1 + p.amt * 14));
          let k = 0;
          for (let s = t0; s < t1 - 1e-4; s += step, k++) {
            if (pat[k % 16] !== 'x') continue;
            fr.setValueAtTime(peak, s);
            fr.setTargetAtTime(p.freq, s + 0.001, p.dec / 3);
          }
        }
        x.open(t0, t1);
      };
      break;
    }
    case 'reverbthrow': {
      input.connect(output);
      const send = gain(0);
      input.connect(send).connect(engine.reverbIn);
      neutral(send.gain, 0);
      play = (t0, t1) => { send.gain.setTargetAtTime(p.amount, t0, 0.01); send.gain.setTargetAtTime(0, t1, 0.02); };
      break;
    }
    case 'delaythrow': {
      input.connect(output);
      const send = gain(0);
      const d = ctx.createDelay(4);
      const fb = gain(p.feedback);
      const wet = gain(p.mix);
      input.connect(send).connect(d).connect(wet).connect(output);
      d.connect(fb).connect(d);
      neutral(send.gain, 0);
      play = (t0, t1, bd) => {
        const time = p.div === 6 ? bd * 0.75 : bd * 4 / p.div;   // 6 = croche pointée
        d.delayTime.setValueAtTime(Math.min(3.9, time), t0);
        send.gain.setTargetAtTime(1, t0, RAMP);
        send.gain.setTargetAtTime(0, t1, RAMP);   // les échos continuent après le bloc
      };
      break;
    }
    case 'autopan': {
      const pan = ctx.createStereoPanner();
      input.connect(pan).connect(output);
      neutral(pan.pan, 0);
      play = (t0, t1, bd) => {
        const period = bd * 4 / p.div;
        const n = Math.max(8, Math.ceil((t1 - t0) / period * 32));
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) curve[i] = p.depth * Math.sin(2 * Math.PI * ((i / (n - 1)) * (t1 - t0)) / period);
        pan.pan.setValueCurveAtTime(curve, t0, t1 - t0);
        pan.pan.setValueAtTime(0, t1 + 0.001);
      };
      break;
    }
    case 'stutter': {
      // Le premier pas joue normalement, puis il est répété en boucle jusqu'à la fin du bloc.
      const cap = gain(0), d = ctx.createDelay(2), fb = gain(0);
      const x = crossfade(cap);
      cap.connect(d).connect(x.wet).connect(output);
      d.connect(fb).connect(d);
      neutral(cap.gain, 0);
      neutral(fb.gain, 0);
      play = (t0, t1, bd) => {
        const len = Math.min(1.9, bd * 4 / p.div);
        d.delayTime.setValueAtTime(len, t0);
        cap.gain.setValueAtTime(1, t0);
        cap.gain.setValueAtTime(0, t0 + len);
        fb.gain.setValueAtTime(0, t0);
        fb.gain.setValueAtTime(1, t0 + len);
        fb.gain.setValueAtTime(0, t1);
        x.open(t0 + len, t1, 0.001);
      };
      break;
    }
    case 'tapestop': {
      // Ligne à retard dont le retard grandit : la hauteur descend jusqu'à l'arrêt, comme une bande qui freine.
      const d = ctx.createDelay(8);
      const vol = gain(1);
      const x = crossfade(d);
      d.connect(vol).connect(x.wet).connect(output);
      neutral(d.delayTime, 0);
      neutral(vol.gain, 1);
      play = (t0, t1) => {
        const T = Math.min(15, t1 - t0);
        const n = 128;
        const curve = new Float32Array(n);
        for (let i = 0; i < n; i++) { const u = (i / (n - 1)) * T; curve[i] = Math.min(7.9, (u * u) / (2 * T)); }
        d.delayTime.setValueCurveAtTime(curve, t0, T);
        d.delayTime.setValueAtTime(0, t1 + 0.01);
        vol.gain.setValueAtTime(1, t0);
        vol.gain.setValueAtTime(1, t0 + T * 0.65);
        vol.gain.linearRampToValueAtTime(0.0001, t0 + T);
        vol.gain.setValueAtTime(1, t1 + 0.01);
        x.open(t0, t1, 0.001);
      };
      break;
    }
    case 'driverise': case 'crushrise': {
      const sh = ctx.createWaveShaper();
      sh.curve = b.fx === 'driverise' ? distCurve(p.drive, 'tube') : distCurve(p.amount, 'crush');
      sh.oversample = '2x';
      const trim = gain(b.fx === 'driverise' ? 0.38 : 0.45);   // la saturation monte le niveau : on compense
      const dry = gain(1), wet = gain(0);
      input.connect(dry).connect(output);
      input.connect(sh).connect(trim).connect(wet).connect(output);
      neutral(dry.gain, 1);
      neutral(wet.gain, 0);
      play = (t0, t1) => {
        // La saturation monte progressivement pendant le bloc (le son sec s'efface d'autant).
        wet.gain.setValueAtTime(0, t0); wet.gain.linearRampToValueAtTime(1, t1 - RAMP); wet.gain.setTargetAtTime(0, t1, RAMP);
        dry.gain.setValueAtTime(1, t0); dry.gain.linearRampToValueAtTime(0.15, t1 - RAMP); dry.gain.setTargetAtTime(1, t1, RAMP);
      };
      break;
    }
    case 'orbit3d': case 'flyby3d': case 'zoomin3d': case 'zoomout3d': case 'spiral3d': {
      // Son en 3D (binaural HRTF, au casque surtout) : trajectoire du son autour de l'auditeur pendant le bloc.
      const pn = ctx.createPanner();
      pn.panningModel = 'HRTF';
      pn.distanceModel = 'inverse';
      pn.refDistance = 1;
      pn.rolloffFactor = 0.9;
      const air = ctx.createBiquadFilter();   // l'air absorbe les aigus quand le son est loin
      air.type = 'lowpass';
      air.frequency.value = 20000;
      const x = crossfade(pn);
      pn.connect(air).connect(x.wet).connect(output);
      const set = (param, v) => { if (param) param.value = v; };
      set(pn.positionX, 0); set(pn.positionY, 0); set(pn.positionZ, -1);
      play = (t0, t1, bd) => {
        const T = t1 - t0;
        const n = Math.max(32, Math.ceil(T * 60));
        const X = new Float32Array(n), Y = new Float32Array(n), Z = new Float32Array(n), F = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1);
          const time = u * T;
          let px = 0, py = 0, pz = -1;
          if (b.fx === 'orbit3d' || b.fx === 'spiral3d') {
            const turn = (p.bars ?? 1) * 4 * bd;
            const a = 2 * Math.PI * time / turn * (p.dir === 'ccw' ? -1 : 1);
            const r = b.fx === 'orbit3d' ? p.radius : 1.5;
            px = r * Math.sin(a); pz = -r * Math.cos(a);
            if (b.fx === 'spiral3d') py = p.height * (u - 0.3);
          } else if (b.fx === 'flyby3d') {
            const s = p.dir === 'rl' ? -1 : 1;
            px = s * p.distance * (u * 2 - 1); pz = -0.8;
          } else {
            const d = b.fx === 'zoomin3d' ? p.distance + (1 - p.distance) * u : 1 + (p.distance - 1) * u;
            pz = -d;
          }
          X[i] = px; Y[i] = py; Z[i] = pz;
          const dist = Math.hypot(px, py, pz);
          F[i] = Math.max(1200, 20000 / Math.max(1, dist / 1.5));
        }
        if (pn.positionX) {
          for (const a of [pn.positionX, pn.positionY, pn.positionZ, air.frequency]) a.cancelScheduledValues(t0);
          pn.positionX.setValueCurveAtTime(X, t0, T);
          pn.positionY.setValueCurveAtTime(Y, t0, T);
          pn.positionZ.setValueCurveAtTime(Z, t0, T);
        }
        air.frequency.setValueCurveAtTime(F, t0, T);
        x.open(t0, t1, 0.01);
      };
      if (pn.positionX) { neutral(pn.positionX, 0); neutral(pn.positionY, 0); neutral(pn.positionZ, -1); }
      neutral(air.frequency, 20000);
      break;
    }
    case 'curve': {
      // Courbe du designer d'effet : le réglage choisi suit la forme dessinée, répétée en boucle sur la durée du bloc.
      const curve = () => resolveCurve(p.curve);
      const target = curve()?.target;
      // Programme `param` de t0 à t1 ; un rejeu (courbe retouchée pendant la lecture) remplace ce qui était prévu.
      const ride = (param, values, t0, T, neutral) => {
        const now = ctx.currentTime;
        try {
          param.cancelScheduledValues(t0 > now + 0.1 ? t0 : 0);
          param.setValueCurveAtTime(values, t0, T);
        } catch {
          param.cancelScheduledValues(0);
          param.setValueCurveAtTime(values, Math.max(t0, now + 0.01), Math.max(0.01, T - Math.max(0, now + 0.01 - t0)));
        }
        param.setTargetAtTime(neutral, t0 + T, 0.004);
      };
      const make = mapper => (t0, t1, bd, off = 0) => {
        const c = curve();
        if (!c) return;
        const T = t1 - t0;
        mapper(c, curveSamples(c, T, bd, off), t0, T);
      };
      if (target === 'lp' || target === 'hp') {
        const f = ctx.createBiquadFilter();
        f.type = target === 'lp' ? 'lowpass' : 'highpass';
        input.connect(f).connect(output);
        neutral(f.frequency, target === 'lp' ? 20000 : 20);
        f.Q.value = curve().q;
        play = make((c, v, t0, T) => { f.Q.setValueAtTime(c.q, t0); ride(f.frequency, v, t0, T, curveNeutral(c)); });
      } else if (target === 'pan') {
        const pan = ctx.createStereoPanner();
        input.connect(pan).connect(output);
        neutral(pan.pan, 0);
        play = make((c, v, t0, T) => ride(pan.pan, v, t0, T, 0));
      } else if (target === 'drive') {
        // Saturation : mélange sec / saturé suivant la courbe (le côté saturé n'est branché que pendant le bloc).
        const sh = ctx.createWaveShaper();
        sh.curve = distCurve(0.8, 'tube');
        sh.oversample = '2x';
        const x = crossfade(sh);
        sh.connect(x.wet).connect(output);
        play = make((c, v, t0, T) => {
          const dry = v.map(a => 1 - a * 0.7);
          ride(x.wet.gain, v, t0, T, 0);
          ride(x.dry.gain, dry, t0, T, 1);
          x.arm(t0, t0 + T);
        });
      } else if (target === 'rev' || target === 'dly') {
        input.connect(output);
        const send = gain(0);
        input.connect(send).connect(target === 'rev' ? engine.reverbIn : engine.delayIn);
        neutral(send.gain, 0);
        play = make((c, v, t0, T) => ride(send.gain, v, t0, T, 0));
      } else {   // volume (et courbe introuvable : transparent)
        const g = gain(1);
        input.connect(g).connect(output);
        neutral(g.gain, 1);
        play = make((c, v, t0, T) => ride(g.gain, v, t0, T, 1));
      }
      break;
    }
    default:
      input.connect(output);
  }
  return {
    input, output, play,
    // Retour aux valeurs neutres ; une courbe en cours peut refuser .value : on repasse alors par setValueAtTime.
    reset() {
      unwire?.();
      const now = ctx.currentTime;
      for (const [param, v] of params) {
        try { param.cancelScheduledValues(0); param.value = v; } catch {
          try { param.cancelScheduledValues(0); param.setValueAtTime(v, now + 0.005); } catch { /* il reviendra au prochain bloc */ }
        }
      }
    },
  };
}

const fxKey = b => `${b.id}:${JSON.stringify(b.p)}${b.fx === 'curve' ? `:${curveSig(b.p.curve)}` : ''}`;

// Chaîne d'effets d'une piste vers une destination (son de la timeline, synthé, pads).
export class TrackChain {
  constructor(ctx, engine, dest) {
    this.ctx = ctx;
    this.engine = engine;
    this.dest = dest;
    this.input = ctx.createGain();
    this.groups = new Map();   // clé (id + réglages) -> chaîne de l'effet
    this.order = '';
    this.input.connect(dest);
  }

  // Reconstruit la chaîne si la liste des blocs (ou leurs réglages) a changé.
  sync(blocks) {
    const keyOf = fxKey;
    const sorted = [...blocks].sort((a, b) => a.start - b.start);
    const order = sorted.map(keyOf).join('|');
    if (order === this.order) return;
    this.order = order;
    const keep = new Set(sorted.map(keyOf));
    for (const [k, g] of this.groups) if (!keep.has(k)) { g.output.disconnect(); this.groups.delete(k); }
    for (const b of sorted) if (!this.groups.has(keyOf(b))) this.groups.set(keyOf(b), buildGroup(this.ctx, this.engine, b));
    this.input.disconnect();
    for (const g of this.groups.values()) g.output.disconnect();
    let node = this.input;
    for (const b of sorted) { const g = this.groups.get(keyOf(b)); node.connect(g.input); node = g.output; }
    node.connect(this.dest);
  }

  // off : temps du bloc déjà passés à t0 (lecture partie du milieu du bloc), pour les courbes calées sur le bloc.
  play(block, t0, t1, bd, off = 0) {
    if (t1 - t0 < 0.01) return;
    try { this.groups.get(fxKey(block))?.play(t0, t1, bd, off); } catch (err) { console.warn('Track effect', block.fx, err); }
  }
  reset() { for (const g of this.groups.values()) g.reset(); }
}
