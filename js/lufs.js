// Mesure de la sonie en LUFS (norme ITU-R BS.1770 / EBU R128) : filtre de pondération K, blocs de 400 ms,
// fenêtres momentanée (400 ms) et court terme (3 s), sonie intégrée avec portes absolue (-70 LUFS) et relative (-10 LU).
// Le calcul travaille sur l'énergie de tranches de 100 ms : le compteur en direct (js/master-worklet.js les envoie)
// et la mesure d'un export (measureLoudness) partagent le même code.

export const SLICE = 0.1;   // durée d'une tranche (s) : un bloc de 400 ms = 4 tranches (recouvrement de 75 %)

/** Coefficients des deux filtres de pondération K (plateau aigu puis passe-haut) pour une fréquence d'échantillonnage. */
export function kWeighting(sr) {
  let K = Math.tan(Math.PI * 1681.974450955533 / sr);
  const Vh = Math.pow(10, 3.999843853973347 / 20), Vb = Math.pow(Vh, 0.4996667741545416), Q1 = 0.7071752369554196;
  let a0 = 1 + K / Q1 + K * K;
  const shelf = { b: [(Vh + Vb * K / Q1 + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q1 + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / Q1 + K * K) / a0] };
  K = Math.tan(Math.PI * 38.13547087602444 / sr);
  const Q2 = 0.5003270373238773;
  a0 = 1 + K / Q2 + K * K;
  const hp = { b: [1, -2, 1], a: [2 * (K * K - 1) / a0, (1 - K / Q2 + K * K) / a0] };
  return [shelf, hp];
}

const toLufs = e => (e > 0 ? -0.691 + 10 * Math.log10(e) : -Infinity);
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;

/** Sonie intégrée (LUFS) à partir de l'énergie des tranches de 100 ms (somme des canaux, pondérée K). */
export function integrated(slices) {
  const blocks = [];
  for (let i = 3; i < slices.length; i++) blocks.push((slices[i] + slices[i - 1] + slices[i - 2] + slices[i - 3]) / 4);
  const abs = blocks.filter(e => toLufs(e) > -70);
  if (!abs.length) return -Infinity;
  const rel = toLufs(mean(abs)) - 10;
  const gated = abs.filter(e => toLufs(e) > rel);
  return gated.length ? toLufs(mean(gated)) : -Infinity;
}

/** Compteur en direct : on lui donne l'énergie de chaque tranche de 100 ms. */
export class LoudnessMeter {
  constructor() { this.reset(); }
  reset() { this.slices = []; this.peak = 0; this._int = null; }
  push(energy, peak = 0) {
    this.slices.push(energy);
    if (this.slices.length > 36000) this.slices.shift();   // une heure
    this.peak = Math.max(this.peak, peak);
    this._int = null;
  }
  window(n) { const s = this.slices.slice(-n); return s.length < n ? -Infinity : toLufs(mean(s)); }
  get momentary() { return this.window(4); }
  get shortTerm() { return this.window(30); }
  get integrated() { return (this._int ??= integrated(this.slices)); }
}

// Filtre biquad (forme directe I) appliqué à un tableau, avec son état.
function biquad(x, { b, a }) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

/**
 * Mesure d'un son entier (export WAV) : sonie intégrée, sonie court terme maximale et crête (en dB).
 * @param {Float32Array[]} channels
 * @param {number} sr
 */
export function measureLoudness(channels, sr) {
  const [shelf, hp] = kWeighting(sr);
  const weighted = channels.map(c => biquad(biquad(c, shelf), hp));
  const n = Math.round(SLICE * sr);
  const slices = [];
  for (let i = 0; i + n <= weighted[0].length; i += n) {
    let e = 0;
    for (const w of weighted) { let s = 0; for (let k = i; k < i + n; k++) s += w[k] * w[k]; e += s / n; }
    slices.push(e);
  }
  let peak = 0;
  for (const c of channels) for (let i = 0; i < c.length; i++) { const v = Math.abs(c[i]); if (v > peak) peak = v; }
  let shortMax = -Infinity;
  for (let i = 30; i <= slices.length; i++) shortMax = Math.max(shortMax, toLufs(mean(slices.slice(i - 30, i))));
  return { integrated: integrated(slices), shortMax, peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity };
}
