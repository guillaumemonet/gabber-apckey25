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

// ---------- Voix enregistrée (autotune, js/autotune.js) ----------
// Une prise réelle a du bruit, des souffles, des consonnes sourdes : la hauteur n'est mesurée que là où la voix est
// nettement périodique (avec hystérésis, pour ne pas hacher une note qui faiblit), les sauts d'octave isolés sont
// corrigés, et seules les parties voisées sont recalculées (le reste est recopié tel quel).

const AN_HOP = 0.005;   // une mesure de hauteur toutes les 5 ms

// Filtre passe-bas (sinus cardinal fenêtré) puis décimation par D : -> signal à sr / D.
function decimate(x, D, from, to) {
  const n = Math.max(0, Math.ceil((to - from) / D));
  const out = new Float32Array(n);
  if (D === 1) { for (let i = 0; i < n; i++) out[i] = x[from + i] ?? 0; return out; }
  const half = 8 * D, fc = 0.45 / D, h = new Float32Array(2 * half + 1);
  let s = 0;
  for (let j = -half; j <= half; j++) {
    const w = 0.42 + 0.5 * Math.cos(Math.PI * j / half) + 0.08 * Math.cos(2 * Math.PI * j / half);
    h[j + half] = (j ? Math.sin(2 * Math.PI * fc * j) / (Math.PI * j) : 2 * fc) * w;
    s += h[j + half];
  }
  for (let j = 0; j < h.length; j++) h[j] /= s;
  for (let i = 0; i < n; i++) {
    const c = from + i * D;
    let v = 0;
    for (let j = -half; j <= half; j++) { const k = c + j; if (k >= 0 && k < x.length) v += h[j + half] * x[k]; }
    out[i] = v;
  }
  return out;
}

export const hzToMidi = f => 69 + 12 * Math.log2(f / 440);
export const midiToHz = m => 440 * Math.pow(2, (m - 69) / 12);

/**
 * Hauteur d'une voix enregistrée, entre les échantillons `from` et `to`. YIN sur le signal décimé (vers 11 kHz),
 * affiné à pleine résolution ; voisement avec hystérésis (entrer : période nette et niveau suffisant ; rester : un
 * peu moins exigeant) ; trous de moins de 15 ms comblés, parties voisées de moins de 30 ms ignorées ; sauts d'octave
 * corrigés par rapport à la médiane locale, puis médiane sur 5 mesures.
 * -> { sr, hop, start, f0 (Hz, 0 = sourd), ap (apériodicité 0..1, 1 = bruit), rms }
 */
export function analyzePitch(x, sr, { fmin = 60, fmax = 1000, from = 0, to = x.length } = {}) {
  from = Math.max(0, Math.floor(from));
  to = Math.min(x.length, Math.ceil(to));
  const hop = Math.max(1, Math.round(sr * AN_HOP));
  const frames = Math.max(1, Math.ceil((to - from) / hop));
  const D = Math.max(1, Math.floor(sr / 11025)), srd = sr / D;
  const tauMin = Math.max(2, Math.floor(srd / fmax)), tauMax = Math.ceil(srd / fmin), W = tauMax;
  const pad = (W + tauMax) * D;
  const base = Math.max(0, from - pad);
  const xd = decimate(x, D, base, Math.min(x.length, to + pad));
  const f0 = new Float32Array(frames), ap = new Float32Array(frames).fill(1), rms = new Float32Array(frames);
  const d = new Float32Array(tauMax + 2);
  const Wf = W * D;
  // Niveau (fenêtre de 20 ms).
  const rw = Math.round(sr * 0.01);
  for (let k = 0; k < frames; k++) {
    const c = from + k * hop;
    let s = 0, n = 0;
    for (let j = Math.max(0, c - rw); j < Math.min(x.length, c + rw); j++) { s += x[j] * x[j]; n++; }
    rms[k] = n ? Math.sqrt(s / n) : 0;
  }
  let peak = 0;
  for (const r of rms) peak = Math.max(peak, r);
  const floor = Math.max(1e-5, peak * 0.003);   // −50 dB sous la crête : en dessous, rien n'est mesuré
  // Différence à pleine résolution autour du décalage `guess` : minimum parabolique.
  // -> { lag, n (différence normalisée : 0 = périodique, 1 = bruit) } ou null
  const refine = (c, guess) => {
    const s0 = c - (Wf >> 1);
    const lo = Math.max(2, Math.floor(guess - D)), hi = Math.ceil(guess + D);
    if (s0 < 0 || s0 + Wf + hi + 1 >= x.length) return null;
    const e = new Float64Array(hi - lo + 3);
    for (let tt = lo - 1; tt <= hi + 1; tt++) {
      let s = 0;
      for (let j = 0; j < Wf; j++) { const v = x[s0 + j] - x[s0 + j + tt]; s += v * v; }
      e[tt - lo + 1] = s;
    }
    let m = 1;
    for (let i = 2; i < e.length - 1; i++) if (e[i] < e[m]) m = i;
    const p = e[m - 1], q = e[m], rr = e[m + 1], dn = p - 2 * q + rr;
    const lag = lo - 1 + m + (dn > 0 ? 0.5 * (p - rr) / dn : 0);
    let en = 0;
    const L = lo - 1 + m;
    for (let j = 0; j < Wf; j++) en += x[s0 + j] * x[s0 + j] + x[s0 + j + L] * x[s0 + j + L];
    return { lag, n: en > 0 ? Math.max(0, q - (dn > 0 ? (p - rr) * (p - rr) / (8 * dn) : 0)) / en : 1 };
  };
  for (let k = 0; k < frames; k++) {
    if (rms[k] < floor) continue;
    const c = from + k * hop;
    const i0 = Math.round((c - base) / D) - (W >> 1);
    if (i0 < 0 || i0 + W + tauMax >= xd.length) continue;
    let run = 0;
    d[0] = 1;
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0;
      for (let j = 0; j < W; j++) { const v = xd[i0 + j] - xd[i0 + j + tau]; s += v * v; }
      run += s;
      d[tau] = run > 0 ? s * tau / run : 1;
    }
    // Premier creux sous le seuil (YIN), sinon le plus profond.
    let tau = -1, best = tauMin;
    for (let tt = tauMin; tt < tauMax; tt++) {
      if (d[tt] < d[best]) best = tt;
      if (d[tt] < 0.15) { while (tt + 1 < tauMax && d[tt + 1] < d[tt]) tt++; tau = tt; break; }
    }
    // Pas de creux net : le premier creux presque aussi profond que le plus profond (évite l'octave du dessous).
    if (tau < 0) {
      tau = best;
      for (let tt = tauMin + 1; tt < best; tt++) if (d[tt] <= d[tt - 1] && d[tt] <= d[tt + 1] && d[tt] < d[best] * 1.3 + 0.04) { tau = tt; break; }
    }
    ap[k] = Math.min(1, d[tau]);
    if (ap[k] > 0.45 || tau <= 1) continue;
    const a = d[tau - 1], b = d[tau], cc = d[tau + 1], den = a - 2 * b + cc;
    const td = den > 0 ? tau + 0.5 * (a - cc) / den : tau;
    // Affinage à pleine résolution autour de td × D ; la demi-période est essayée aussi (voix aiguë : à 11 kHz, la
    // période ne tombe pas sur un nombre entier d'échantillons et YIN préfère parfois l'octave du dessous).
    let r = refine(c, td * D);
    if (r && td * D / 2 >= sr / fmax) {
      const half = refine(c, td * D / 2);
      if (half && half.n < r.n * 1.5 + 0.02) r = half;
    }
    if (!r) { f0[k] = sr / (td * D); continue; }
    ap[k] = Math.min(ap[k], r.n);
    f0[k] = sr / r.lag;
  }
  // Voisement avec hystérésis.
  const v = new Uint8Array(frames);
  for (let k = 0; k < frames; k++) {
    const was = k > 0 && v[k - 1];
    v[k] = f0[k] > 0 && (was ? ap[k] < 0.35 && rms[k] > floor * 2 : ap[k] < 0.2 && rms[k] > floor * 6) ? 1 : 0;
  }
  // Trous courts comblés (hauteur interpolée), parties trop courtes retirées.
  const gap = 3, minRun = 6;
  for (let k = 1; k < frames; k++) {
    if (v[k] || !v[k - 1]) continue;
    let e = k;
    while (e < frames && !v[e] && e - k <= gap) e++;
    if (e < frames && v[e] && e - k <= gap) {
      const a = hzToMidi(f0[k - 1]), b = hzToMidi(f0[e]);
      for (let j = k; j < e; j++) { f0[j] = midiToHz(a + (b - a) * (j - k + 1) / (e - k + 1)); v[j] = 1; }
    }
  }
  for (let k = 0; k < frames;) {
    if (!v[k]) { k++; continue; }
    let e = k;
    while (e < frames && v[e]) e++;
    if (e - k < minRun) for (let j = k; j < e; j++) v[j] = 0;
    k = e;
  }
  // Sauts d'octave : comparés à la médiane des ±50 ms voisées autour.
  const m = new Float32Array(frames).fill(NaN);
  for (let k = 0; k < frames; k++) if (v[k]) m[k] = hzToMidi(f0[k]);
  const fixed = Float32Array.from(m);
  for (let k = 0; k < frames; k++) {
    if (!v[k]) continue;
    const w = [];
    for (let j = Math.max(0, k - 10); j <= Math.min(frames - 1, k + 10); j++) if (v[j]) w.push(m[j]);
    w.sort((p, q) => p - q);
    const dm = m[k] - w[w.length >> 1];
    if (Math.abs(dm) > 7) fixed[k] = m[k] - 12 * Math.round(dm / 12);
  }
  for (let k = 0; k < frames; k++) {
    if (!v[k]) { f0[k] = 0; continue; }
    const w = [];
    for (let j = k - 2; j <= k + 2; j++) if (j >= 0 && j < frames && v[j]) w.push(fixed[j]);
    w.sort((p, q) => p - q);
    f0[k] = midiToHz(w[w.length >> 1]);
  }
  return { sr, hop, start: from, f0, ap, rms };
}

// Parties voisées d'une analyse : [[première mesure, dernière + 1], …].
export function voicedRuns(track) {
  const out = [];
  const f = track.f0;
  for (let k = 0; k < f.length;) {
    if (!f[k]) { k++; continue; }
    let e = k;
    while (e < f.length && f[e]) e++;
    out.push([k, e]);
    k = e;
  }
  return out;
}

// Interpolation cubique (Catmull-Rom) de x en une position fractionnaire.
function cubic(x, p) {
  const i = Math.floor(p), u = p - i;
  const a = x[i - 1] ?? 0, b = x[i] ?? 0, c = x[i + 1] ?? 0, d = x[i + 2] ?? 0;
  return b + 0.5 * u * (c - a + u * (2 * a - 5 * b + 4 * c - d + u * (3 * (b - c) + d - a)));
}

/**
 * Change la hauteur d'une voix enregistrée sans changer sa durée : TD-PSOLA à positions fractionnaires (marques
 * espacées d'une période exacte, grains lus en interpolation cubique), niveau normalisé par la somme des fenêtres.
 * chans : canaux (mêmes marques pour tous) ; track : analyzePitch ; ratio(i) : facteur de hauteur voulu à
 * l'échantillon i ; formant : facteur des formants (> 1 : voix plus petite). Seules les parties voisées sont
 * recalculées, avec un fondu de `fade` secondes à leurs bords : le reste (consonnes sourdes, souffles, silences)
 * est recopié à l'identique. -> nouveaux canaux (même longueur)
 */
export function psolaShift(chans, sr, track, ratio, { formant = 1, fade = 0.008 } = {}) {
  const out = chans.map(c => Float32Array.from(c));
  const n = chans[0].length, hop = track.hop, st = track.start, F = track.f0;
  const fAt = i => {
    const p = (i - st) / hop, k = Math.max(0, Math.min(F.length - 1, Math.floor(p))), k1 = Math.min(F.length - 1, k + 1);
    const a = F[k], b = F[k1];
    if (!a) return b;
    if (!b) return a;
    return a + (b - a) * Math.max(0, Math.min(1, p - k));
  };
  const nf = Math.round(sr * fade);
  for (const [k0, k1] of voicedRuns(track)) {
    const s0 = st + k0 * hop, s1 = Math.min(n, st + k1 * hop);
    if (s1 - s0 < 4) continue;
    // Marques d'analyse : une par période, depuis le début de la partie voisée.
    const marks = [];
    for (let p = s0; p < s1;) { const T = sr / (fAt(p) || 100); marks.push({ pos: p, T }); p += T; }
    let maxT = 0;
    for (const mk of marks) maxT = Math.max(maxT, mk.T);
    const pad = Math.ceil(maxT * 4 * Math.max(1, formant)) + 4;
    const a0 = Math.max(0, s0 - pad), a1 = Math.min(n, s1 + pad);
    const ys = chans.map(() => new Float32Array(a1 - a0)), ws = new Float32Array(a1 - a0);
    let mi = 0;
    for (let ts = s0; ts < s1;) {
      while (mi + 1 < marks.length && Math.abs(marks[mi + 1].pos - ts) <= Math.abs(marks[mi].pos - ts)) mi++;
      const mk = marks[mi];
      const r = Math.max(0.25, Math.min(4, ratio(ts) || 1));
      const Ts = mk.T / r, L = Math.max(mk.T, Ts);
      for (let o = Math.ceil(ts - L); o <= Math.floor(ts + L); o++) {
        if (o < a0 || o >= a1) continue;
        const src = mk.pos + (o - ts) * formant;
        if (src < 1 || src >= n - 2) continue;
        const w = 0.5 + 0.5 * Math.cos(Math.PI * (o - ts) / L);
        ws[o - a0] += w;
        for (let c = 0; c < chans.length; c++) ys[c][o - a0] += w * cubic(chans[c], src);
      }
      ts += Ts;
    }
    // Fondu enchaîné : son d'origine aux bords, son recalculé à l'intérieur.
    const f = Math.min(nf, (s1 - s0) >> 1);
    for (let i = s0; i < s1; i++) {
      const w = ws[i - a0];
      if (w < 0.05) continue;
      const g = f > 0 ? Math.min(1, (i - s0 + 0.5) / f, (s1 - i - 0.5) / f) : 1;
      const mix = 0.5 - 0.5 * Math.cos(Math.PI * g);
      for (let c = 0; c < chans.length; c++) out[c][i] = chans[c][i] + mix * (ys[c][i - a0] / w - chans[c][i]);
    }
  }
  return out;
}
