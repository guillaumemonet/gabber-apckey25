// Courbes d'effet (designer d'effet) : une forme dessinée sur 1, 2 ou 4 temps, répétée en boucle, qui pilote un réglage
// d'une piste (volume, filtres, panoramique, saturation, envois reverb / delay) pendant un bloc d'effet « Courbe ».
// Une courbe : { id, name, target, beats, points: [{ x, y, c, hold }], depth, smooth, freq, q }
// - x : position dans la boucle (0..1), y : valeur (0..1, 1 = en haut) ;
// - c : courbure du segment qui part de ce point (-1..1, 0 = droit), hold : palier (la valeur reste jusqu'au point suivant) ;
// - depth : 0 = sans effet, 1 = la courbe telle quelle ; smooth : lissage (ms) ; freq / q : réglages des filtres.

export const CURVE_TARGETS = ['vol', 'lp', 'hp', 'pan', 'drive', 'rev', 'dly'];
export const CURVE_BEATS = [1, 2, 4];
// Valeur sans effet de chaque réglage (en position 0..1) : la profondeur ramène la courbe vers elle.
const NEUTRAL = { vol: 1, lp: 1, hp: 0, pan: 0.5, drive: 0, rev: 0, dly: 0 };
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const P = (x, y, c = 0, hold = false) => ({ x, y, c, hold });

// Formes de départ (non modifiables : les retoucher en fait une courbe à toi).
const steps = (n, on = 0.5) => Array.from({ length: n }, (_, k) => [P(k / n, 1, 0, true), P((k + on) / n, 0, 0, true)]).flat();
export const CURVE_SHAPES = [
  { id: 'b:pump', target: 'vol', beats: 1, points: [P(0, 0, -0.55), P(0.55, 1, 0, true)] },
  { id: 'b:pump2', target: 'vol', beats: 2, points: [P(0, 0, -0.5), P(0.3, 1, 0, true), P(0.5, 0, -0.5), P(0.8, 1, 0, true)] },
  { id: 'b:trance', target: 'vol', beats: 1, points: steps(4, 0.6) },
  { id: 'b:gate332', target: 'vol', beats: 2, points: [P(0, 1, 0, true), P(0.14, 0, 0, true), P(0.375, 1, 0, true), P(0.515, 0, 0, true), P(0.75, 1, 0, true), P(0.86, 0, 0, true)] },
  { id: 'b:stutter', target: 'vol', beats: 1, points: steps(8, 0.5) },
  { id: 'b:breath', target: 'vol', beats: 4, points: [P(0, 0.35, 0.45), P(0.5, 1, -0.45)] },
  { id: 'b:wobble', target: 'lp', beats: 1, points: [P(0, 0.05, 0.3), P(0.5, 0.9, -0.3)] },
  { id: 'b:lpsaw', target: 'lp', beats: 2, points: [P(0, 1, -0.6), P(0.97, 0.05, 0, true)] },
  { id: 'b:hpsweep', target: 'hp', beats: 4, points: [P(0, 0, 0.5), P(0.98, 1, 0, true)] },
  { id: 'b:pingpong', target: 'pan', beats: 1, points: [P(0, 0.1, 0, true), P(0.5, 0.9, 0, true)] },
  { id: 'b:panswing', target: 'pan', beats: 2, points: [P(0, 0, 0.35), P(0.5, 1, -0.35)] },
  { id: 'b:drivepulse', target: 'drive', beats: 1, points: [P(0, 1, -0.5), P(0.6, 0, 0, true)] },
  { id: 'b:revtail', target: 'rev', beats: 4, points: [P(0, 0, 0, true), P(0.75, 0, 0.4), P(0.95, 1, 0, true)] },
  { id: 'b:echo', target: 'dly', beats: 1, points: [P(0, 0, 0, true), P(0.5, 1, 0, true), P(0.62, 0, 0, true)] },
].map(s => ({ ...s, name: '', depth: 1, smooth: 3, freq: s.target === 'hp' ? 3000 : 220, q: s.target === 'lp' ? 4 : 1 }));

export const defaultCurve = () => ({ id: null, name: '', target: 'vol', beats: 1, points: [P(0, 1), P(0.5, 0.3)], depth: 1, smooth: 3, freq: 220, q: 1 });

// Courbe telle qu'elle est sauvegardée ; tout ce qui n'est pas valide reprend sa valeur par défaut.
export function cleanCurve(c) {
  if (!c || typeof c !== 'object') return null;
  const d = defaultCurve();
  const num = (v, lo, hi, def) => (Number.isFinite(v) ? clamp(v, lo, hi) : def);
  const points = (Array.isArray(c.points) ? c.points : [])
    .filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .map(p => P(clamp(p.x, 0, 1), clamp(p.y, 0, 1), num(p.c, -1, 1, 0), !!p.hold))
    .sort((a, b) => a.x - b.x)
    .slice(0, 128);
  return {
    id: typeof c.id === 'string' ? c.id : null,
    name: typeof c.name === 'string' ? c.name.slice(0, 32) : '',
    target: CURVE_TARGETS.includes(c.target) ? c.target : d.target,
    beats: CURVE_BEATS.includes(c.beats) ? c.beats : d.beats,
    points: points.length ? points : d.points,
    depth: num(c.depth, 0, 1, 1),
    smooth: num(c.smooth, 0, 80, 3),
    freq: num(c.freq, 20, 12000, d.freq),
    q: num(c.q, 0.5, 16, 1),
  };
}

// Valeur (0..1) de la courbe à la position u de la boucle (0..1).
export function curveAt(curve, u) {
  const pts = curve.points;
  if (!pts.length) return 1;
  u = u - Math.floor(u);
  let i = pts.length - 1;
  for (let k = 0; k < pts.length; k++) if (pts[k].x <= u) i = k; else break;
  const a = pts[i];
  const before = u < pts[0].x;   // avant le premier point : segment qui vient du dernier point (boucle)
  const from = before ? pts[pts.length - 1] : a;
  const next = before ? pts[0] : pts[i + 1] ?? pts[0];
  if (from.hold) return from.y;
  const x0 = before ? from.x - 1 : from.x;
  const x1 = next === pts[0] && !before ? next.x + 1 : next.x;
  const span = x1 - x0;
  if (span <= 1e-6) return next.y;
  const t = clamp((u - x0) / span, 0, 1);
  const k = from.c * 8;
  const s = Math.abs(k) < 1e-3 ? t : (Math.exp(k * t) - 1) / (Math.exp(k) - 1);
  return from.y + (next.y - from.y) * s;
}

// Position 0..1 -> valeur du réglage (fréquence en Hz, gain, panoramique…), profondeur comprise.
export function curveValue(curve, y) {
  const n = NEUTRAL[curve.target];
  const v = n + (y - n) * curve.depth;
  switch (curve.target) {
    case 'lp': return curve.freq * Math.pow(20000 / curve.freq, v);
    case 'hp': return 20 * Math.pow(curve.freq / 20, v);
    case 'pan': return v * 2 - 1;
    default: return v;   // volume, saturation, envois
  }
}
export const curveNeutral = curve => curveValue({ ...curve, depth: 0 }, 0);

// Valeurs du réglage de `t0` à `t0 + T` (secondes) : `off` = temps déjà écoulés dans la boucle au départ.
// Échantillonné finement puis lissé (un palier sans lissage claquerait).
export function curveSamples(curve, T, bd, off = 0, rate = 400) {
  const n = Math.max(2, Math.min(200000, Math.ceil(T * rate) + 1));
  const out = new Float32Array(n);
  const period = curve.beats * bd;
  const tau = Math.max(curve.target === 'vol' || curve.target === 'pan' ? 0.0015 : 0.0005, curve.smooth / 1000);
  const a = 1 - Math.exp(-(T / (n - 1)) / tau);
  let y = curveAt(curve, (off * bd) / period);
  for (let i = 0; i < n; i++) {
    const time = (i / (n - 1)) * T;
    const target = curveAt(curve, (off * bd + time) / period);
    y += (target - y) * (i ? a : 1);
    out[i] = curveValue(curve, y);
  }
  return out;
}

// Tracé de la courbe pour un dessin : n points (u, y) sur une boucle.
export function curvePath(curve, n = 64) {
  return Array.from({ length: n + 1 }, (_, i) => [i / n, curveAt(curve, Math.min(0.99999, i / n))]);
}
