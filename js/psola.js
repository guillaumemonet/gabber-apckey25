// Hauteur et durée d'une voix (générateur de voix, js/voice.js) : détection de la hauteur (YIN), marques de période,
// puis TD-PSOLA. Chaque période de la voix est découpée (fenêtre de Hann sur deux périodes) et recollée à l'écart de la
// note visée : la hauteur change sans changer le timbre (les formants restent en place, pas de voix de « canard »),
// et la durée change en répétant ou en sautant des périodes.

const HOP_SEC = 0.005;
const UNVOICED_SEC = 0.005;   // pas des grains hors des voyelles (consonnes sourdes, souffle) : recopiés sans changement

/**
 * Hauteur de la voix toutes les 5 ms (YIN). -> { hop, f0 (Hz, 0 = sourd), rms }
 * Une trame est voisée si YIN trouve une période nette et si elle n'est pas trop faible.
 */
export function pitchTrack(x, sr, fmin = 70, fmax = 650) {
  const hop = Math.max(1, Math.round(sr * HOP_SEC));
  const tauMin = Math.floor(sr / fmax), tauMax = Math.ceil(sr / fmin), W = tauMax;
  const frames = Math.max(1, Math.ceil(x.length / hop));
  const f0 = new Float32Array(frames), rms = new Float32Array(frames);
  const d = new Float32Array(tauMax + 2);
  let peak = 0;
  for (let k = 0; k < frames; k++) {
    const c = k * hop;
    let s = 0;
    for (let j = c - (W >> 1); j < c + (W >> 1); j++) { const v = x[j] ?? 0; s += v * v; }
    rms[k] = Math.sqrt(s / W);
    peak = Math.max(peak, rms[k]);
  }
  for (let k = 0; k < frames; k++) {
    if (rms[k] < peak * 0.04) continue;
    const i0 = k * hop - (W >> 1);
    if (i0 < 0 || i0 + W + tauMax >= x.length) continue;
    // Différence cumulée normalisée.
    let run = 0;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = x[i0 + j] - x[i0 + j + tau]; s += v * v; }
      run += s;
      d[tau] = run > 0 ? s * tau / run : 1;
    }
    let tau = -1;
    for (let t = tauMin; t < tauMax; t++) {
      if (d[t] < 0.2) { while (t + 1 < tauMax && d[t + 1] < d[t]) t++; tau = t; break; }
    }
    if (tau < 0) continue;
    // Interpolation parabolique autour du minimum.
    const a = d[tau - 1], b = d[tau], cc = d[tau + 1], den = a - 2 * b + cc;
    const exact = den > 0 ? tau + 0.5 * (a - cc) / den : tau;
    f0[k] = sr / exact;
  }
  // Médiane sur 3 trames : retire les sauts d'octave isolés.
  const out = Float32Array.from(f0);
  for (let k = 1; k + 1 < frames; k++) {
    const v = [f0[k - 1], f0[k], f0[k + 1]];
    if (v.every(Boolean)) out[k] = v.sort((p, q) => p - q)[1];
  }
  return { hop, f0: out, rms };
}

// Hauteur médiane des trames voisées (0 si aucune).
export function medianF0(track) {
  const v = [...track.f0].filter(Boolean).sort((a, b) => a - b);
  return v.length ? v[v.length >> 1] : 0;
}

/** Marques d'analyse : une par période dans les parties voisées (calées sur les crêtes), tous les 5 ms ailleurs. */
export function pitchMarks(x, sr, track) {
  const marks = [];
  const n = x.length, un = Math.round(sr * UNVOICED_SEC);
  let p = 0, wasVoiced = false;
  while (p < n) {
    const f = track.f0[Math.min(track.f0.length - 1, Math.floor(p / track.hop))];
    if (f > 0) {
      const T = sr / f;
      // Recale la marque sur la crête la plus proche (large à l'entrée de la voyelle, serré ensuite).
      const r = Math.round(T * (wasVoiced ? 0.15 : 0.5));
      let best = Math.round(p), bv = -Infinity;
      for (let i = Math.max(0, Math.round(p) - r); i <= Math.min(n - 1, Math.round(p) + r); i++) if (x[i] > bv) { bv = x[i]; best = i; }
      if (marks.length && best <= marks[marks.length - 1].pos) best = Math.round(p);
      marks.push({ pos: best, T, voiced: true });
      p = best + T;
      wasVoiced = true;
    } else {
      marks.push({ pos: Math.round(p), T: un, voiced: false });
      p += un;
      wasVoiced = false;
    }
  }
  return marks;
}

/**
 * TD-PSOLA. `len` : durée de sortie (échantillons). `map(ts)` : instant d'analyse (échantillon de x) pour l'instant de
 * sortie ts. `pitch(ts, ta, f)` : hauteur voulue (Hz) en ts pour une partie voisée de hauteur d'origine f
 * (0 = garder). `formant` : > 1 éclaircit le timbre (voix plus petite), < 1 l'assombrit.
 */
export function psola(x, sr, marks, { len, map, pitch, formant = 1 }) {
  const out = new Float32Array(len);
  if (!marks.length || !x.length) return out;
  const near = ta => {
    let lo = 0, hi = marks.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (marks[m].pos <= ta) lo = m; else hi = m; }
    return Math.abs(marks[hi].pos - ta) < Math.abs(marks[lo].pos - ta) ? marks[hi] : marks[lo];
  };
  let ts = 0;
  while (ts < len) {
    const ta = map(ts);
    const m = near(ta);
    const Ta = m.T;
    const f = m.voiced ? pitch(ts, ta, sr / Ta) : 0;
    const Ts = f > 0 ? sr / f : Ta;
    const L = Math.max(2, Math.round(Ta));
    const c = Math.round(ts);
    for (let j = -L; j <= L; j++) {
      const o = c + j;
      if (o < 0 || o >= len) continue;
      const src = m.pos + j * formant, i = Math.floor(src), fr = src - i;
      if (i < 0 || i + 1 >= x.length) continue;
      out[o] += (0.5 + 0.5 * Math.cos(Math.PI * j / L)) * (x[i] + (x[i + 1] - x[i]) * fr);
    }
    ts += Math.max(1, Ts);
  }
  return out;
}
