// Découpeur de breaks : trouve les coups d'une boucle (transitoires, par le flux spectral) ou la découpe en parts égales,
// puis en fait des sons séparés (une tranche par coup), prêts pour les pads et le séquenceur pas à pas.

export const SLICES_MAX = 32;
export const SLICE_GRIDS = [4, 8, 16, 32];

// Réglages du découpeur : le son (et son tempo), la méthode (coups ou parts égales), les repères (secondes).
export function defaultSlicer() { return { sampleId: null, name: '', bpm: 0, mode: 'onset', sens: 0.5, grid: 16, slices: [] }; }
export function mergeSlicer(saved) {
  const base = defaultSlicer();
  if (!saved || typeof saved !== 'object') return base;
  if (typeof saved.sampleId === 'string') base.sampleId = saved.sampleId;
  if (typeof saved.name === 'string') base.name = saved.name.slice(0, 32);
  if (Number.isFinite(saved.bpm) && saved.bpm >= 0 && saved.bpm <= 400) base.bpm = saved.bpm;
  if (['onset', 'grid'].includes(saved.mode)) base.mode = saved.mode;
  if (Number.isFinite(saved.sens)) base.sens = Math.min(1, Math.max(0, saved.sens));
  if (SLICE_GRIDS.includes(saved.grid)) base.grid = saved.grid;
  if (Array.isArray(saved.slices)) base.slices = saved.slices.filter(Number.isFinite).sort((a, b) => a - b).slice(0, SLICES_MAX);
  return base;
}

// FFT radix 2 en place (re, im : Float64Array de longueur puissance de 2).
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k, q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci, ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr; im[q] = im[p] - ti;
        re[p] += tr; im[p] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

export function monoOf(buffer) {
  const out = new Float32Array(buffer.length);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) out[i] += d[i] / buffer.numberOfChannels;
  }
  return out;
}

// Juste avant l'attaque : le premier endroit où l'énergie (fenêtres de 32 échantillons) dépasse le dixième du maximum
// des environs, puis le passage par zéro qui le précède.
function settle(x, pos, sr) {
  const span = Math.round(sr * 0.025), win = 32;
  const a = Math.max(0, pos - span), b = Math.min(x.length - win, pos + span);
  const env = [];
  let peak = 0;
  for (let i = a; i <= b; i += 8) {
    let e = 0;
    for (let k = 0; k < win; k++) e += x[i + k] * x[i + k];
    env.push(e);
    peak = Math.max(peak, e);
  }
  const k = env.findIndex(e => e > peak * 0.1);
  let at = a + Math.max(0, k) * 8;
  for (let i = at; i > Math.max(1, at - 200); i--) if ((x[i - 1] <= 0) !== (x[i] <= 0)) { at = i; break; }
  return at;
}
export function zeroCross(x, i) {
  for (let k = Math.max(1, i); k < Math.min(x.length, i + 400); k++) if ((x[k - 1] <= 0) !== (x[k] <= 0)) return k;
  return i;
}

// Flux spectral d'un son (hausse d'énergie bande par bande, compressée en log), normalisé à 1, par trames de `hop`
// échantillons. -> { flux, hop, N, x (son en mono) }
export function onsetFlux(buffer) {
  const x = monoOf(buffer);
  const N = 1024, hop = 256, frames = Math.max(0, Math.floor((x.length - N) / hop) + 1);
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const re = new Float64Array(N), im = new Float64Array(N);
  let prev = new Float64Array(N / 2);
  const flux = new Float64Array(frames);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < N; i++) { re[i] = x[f * hop + i] * win[i]; im[i] = 0; }
    fft(re, im);
    const cur = new Float64Array(N / 2);
    let sum = 0;
    for (let b = 1; b < N / 2; b++) {
      cur[b] = Math.log1p(100 * Math.hypot(re[b], im[b]));
      const d = cur[b] - prev[b];
      if (d > 0) sum += d;
    }
    flux[f] = sum;
    prev = cur;
  }
  const peak = flux.reduce((m, v) => Math.max(m, v), 1e-9);
  for (let f = 0; f < frames; f++) flux[f] /= peak;
  return { flux, hop, N, x };
}

/**
 * Début des coups (en secondes) d'un son : pics du flux spectral au-dessus d'un seuil adaptatif (médiane locale).
 * @param {AudioBuffer} buffer
 * @param {number} sens  sensibilité 0..1 (plus haut : plus de coups, même les petits)
 * @param {number} minGap  écart minimal entre deux coups (secondes)
 */
export function detectOnsets(buffer, sens = 0.5, minGap = 0.06) {
  const sr = buffer.sampleRate;
  const { flux, hop, N, x } = onsetFlux(buffer);
  const frames = flux.length, W = 10;
  const delta = 0.02 + (1 - sens) * 0.16;
  const out = [0];
  const gap = Math.round(minGap * sr);
  for (let f = 1; f < frames - 1; f++) {
    if (flux[f] < flux[f - 1] || flux[f] <= flux[f + 1]) continue;
    const near = Array.from(flux.subarray(Math.max(0, f - W), Math.min(frames, f + W + 1))).sort((a, b) => a - b);
    if (flux[f] < near[near.length >> 1] + delta) continue;
    const pos = settle(x, f * hop + N / 2 - hop, sr);
    if (pos - out[out.length - 1] < gap) continue;
    out.push(pos);
  }
  // Trop de coups : on garde les plus forts.
  if (out.length > SLICES_MAX) {
    const strength = p => flux[Math.min(frames - 1, Math.max(0, Math.round((p - N / 2 + hop) / hop)))];
    const keep = new Set(out.slice(1).sort((a, b) => strength(b) - strength(a)).slice(0, SLICES_MAX - 1));
    return [0, ...out.slice(1).filter(p => keep.has(p))].map(p => p / sr);
  }
  return out.map(p => p / sr);
}

// Découpe en `n` parts égales (en secondes).
export const gridSlices = (duration, n) => Array.from({ length: n }, (_, k) => k * duration / n);

/** Les tranches en sons séparés : du début de chacune au début de la suivante, avec de courts fondus (pas de clic). */
export function sliceBuffers(ctx, buffer, starts) {
  const sr = buffer.sampleRate;
  const marks = [...starts.map(s => Math.round(s * sr)), buffer.length];
  return starts.map((_, k) => {
    const a = marks[k], b = Math.max(a + 1, marks[k + 1]);
    const out = ctx.createBuffer(buffer.numberOfChannels, b - a, sr);
    const fin = Math.min(Math.round(sr * 0.0015), (b - a) >> 2), fout = Math.min(Math.round(sr * 0.006), (b - a) >> 2);
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const d = out.getChannelData(c);
      d.set(buffer.getChannelData(c).subarray(a, b));
      for (let i = 0; i < fin; i++) d[i] *= i / fin;
      for (let i = 0; i < fout; i++) d[d.length - 1 - i] *= i / fout;
    }
    return out;
  });
}

/** Pas (double-croches) où tombe chaque tranche, pour un son au tempo `bpm` ; null si elle tombe hors de `len` pas. */
export function sliceSteps(starts, bpm, len) {
  const step = 60 / bpm / 4;
  return starts.map(s => { const k = Math.round(s / step); return k < len ? k : null; });
}
