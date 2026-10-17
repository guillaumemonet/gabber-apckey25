// Autotune : recale la hauteur d'une voix enregistrée sur une gamme (la note la plus proche) ou sur les notes d'un
// bloc (la mélodie d'un lead). Hors temps réel, sur un son entier : la hauteur est mesurée (js/psola.js, YIN robuste),
// une courbe de correction est calculée, puis la voix est recalculée par TD-PSOLA (timbre gardé ; formants
// déplaçables à part). Les consonnes sourdes, souffles et silences ne sont pas touchés.
//
// Réglages :
// - vitesse (ms) : temps que met la correction à rejoindre la note. 0 = immédiat (voix « robot », marches nettes entre
//   les notes) ; 50 à 400 ms = naturel (les glissés et le vibrato passent, la note finit juste) ;
// - humain (0..1) : part des variations rapides de la voix (vibrato, petites inflexions) gardée autour de la note juste ;
// - formant (demi-tons) : timbre plus petit (+) ou plus gros (−), sans changer la hauteur ;
// - mélange (0..1) : voix corrigée / voix d'origine.
import { analyzePitch, hzToMidi, psolaShift, voicedRuns } from './psola.js';

export const TUNE_SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentaMinor: [0, 3, 5, 7, 10],
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};
export const TUNE_HYST = 0.3;    // demi-ton : une note n'est quittée que 0,15 demi-ton au-delà de la frontière

// Moyenne glissante centrée (sur les seules valeurs d'une partie), en mesures.
function boxAvg(v, k0, k1, r) {
  const out = new Float32Array(k1 - k0);
  let s = 0, n = 0, lo = k0, hi = k0;
  for (let k = k0; k < k1; k++) {
    while (hi < Math.min(k1, k + r + 1)) { s += v[hi++]; n++; }
    while (lo < k - r) { s -= v[lo++]; n--; }
    out[k - k0] = s / n;
  }
  return out;
}

// Note de la gamme la plus proche de m (demi-tons MIDI, fractionnaires).
export function nearestInScale(m, root, steps) {
  let best = null;
  const base = Math.floor(m) - 13;
  for (let n = base; n <= base + 27; n++) if (steps.includes(((n - root) % 12 + 12) % 12) && (best === null || Math.abs(n - m) < Math.abs(best - m))) best = n;
  return best;
}

/**
 * Courbe de correction d'une analyse (js/psola.js analyzePitch). Hauteurs « entendues » = mesurées + shift.
 * opts : { mode: 'scale' | 'notes', root, scale, notes: [{ t0, t1, note }] (secondes du son), shift, speed (ms),
 * humanize (0..1), exact (notes : garder leur octave au lieu de prendre la plus proche de la voix), vibrato (demi-tons :
 * vibrato ajouté à 5,5 Hz sur les notes de plus de 0,45 s, après 0,25 s) }
 * -> { input, target, output (demi-tons entendus par mesure, NaN = sourd), corr (demi-tons à appliquer) }
 */
export function tuneCurve(track, opts) {
  const { hop, sr, start } = track;
  const N = track.f0.length;
  const shift = opts.shift ?? 0, h = Math.max(0, Math.min(1, opts.humanize ?? 0));
  const input = new Float32Array(N).fill(NaN), target = new Float32Array(N).fill(NaN), output = new Float32Array(N).fill(NaN), corr = new Float32Array(N);
  for (let k = 0; k < N; k++) if (track.f0[k]) input[k] = hzToMidi(track.f0[k]) + shift;
  const steps = TUNE_SCALES[opts.scale] ?? TUNE_SCALES.chromatic, root = opts.root ?? 0;
  const ms = sr / hop / 1000;   // mesures par ms
  const alpha = opts.speed > 0 ? 1 - Math.exp(-(hop / sr) / (opts.speed / 1000)) : 1;
  const secOf = k => (start + k * hop) / sr;
  const minSeg = Math.round(30 * ms);
  const vibrato = opts.mode === 'notes' ? opts.vibrato ?? 0 : 0;
  const vib = new Float32Array(N);   // vibrato ajouté à la note visée
  for (const [k0, k1] of voicedRuns(track)) {
    // Hauteur moyenne sur 80 ms : décide de la note (le vibrato est en partie lissé, une note courte reste visible).
    const mid = boxAvg(input, k0, k1, Math.round(40 * ms));
    // Note visée par mesure.
    if (opts.mode === 'notes') {
      const notes = (opts.notes ?? []).filter(nt => nt.t1 > secOf(k0) && nt.t0 < secOf(k1));
      if (!notes.length) continue;   // aucune note pendant cette partie : rien n'est corrigé
      // Octave de chaque note : au plus près de ce qui est chanté pendant la note.
      const octs = notes.map(nt => {
        const w = [];
        for (let k = k0; k < k1; k++) if (secOf(k) >= nt.t0 && secOf(k) < nt.t1) w.push(mid[k - k0]);
        const ref = w.length ? w.sort((a, b) => a - b)[w.length >> 1] : mid[0];
        return opts.exact ? nt.note : nt.note + 12 * Math.round((ref - nt.note) / 12);
      });
      for (let k = k0; k < k1; k++) {
        const s = secOf(k);
        let j = notes.findIndex(nt => s >= nt.t0 && s < nt.t1);
        if (j < 0) {   // entre deux notes : la plus proche dans le temps
          let bd = Infinity;
          notes.forEach((nt, i) => { const dd = Math.min(Math.abs(s - nt.t0), Math.abs(s - nt.t1)); if (dd < bd) { bd = dd; j = i; } });
        }
        target[k] = octs[j];
        const nt = notes[j], u = s - nt.t0 - 0.25;
        if (vibrato && nt.t1 - nt.t0 > 0.45 && u > 0) vib[k] = vibrato * Math.min(1, u / 0.2) * Math.sin(2 * Math.PI * 5.5 * u);
      }
    } else {
      // Note de la gamme la plus proche, avec hystérésis : quittée seulement franchement au-delà de la frontière.
      let cur = null;
      for (let k = k0; k < k1; k++) {
        const v = mid[k - k0], near = nearestInScale(v, root, steps);
        if (cur === null || Math.abs(v - cur) > Math.abs(v - near) + TUNE_HYST) cur = near;
        target[k] = cur;
      }
      // Notes de moins de 30 ms (passage d'un glissé) : rattachées à la note d'avant.
      for (let k = k0; k < k1;) {
        let e = k;
        while (e < k1 && target[e] === target[k]) e++;
        if (e - k < minSeg && (k > k0 || e < k1)) target.fill(k > k0 ? target[k - 1] : target[e], k, e);
        k = e;
      }
    }
    // Hauteur sans vibrato, note par note : deux moyennes de 200 et 160 ms (zéros vers 5 et 6 Hz), qui ne débordent
    // pas sur la note voisine.
    const slow = new Float32Array(N);
    for (let a = k0; a < k1;) {
      let b = a;
      while (b < k1 && target[b] === target[a]) b++;
      slow.set(boxAvg(input, a, b, Math.round(100 * ms)), a);
      slow.set(boxAvg(slow, a, b, Math.round(80 * ms)), a);
      a = b;
    }
    // Correction : écart entre la note et la voix (dont on retire la part « humaine » des variations rapides),
    // lissé par la vitesse.
    let c = null;
    for (let k = k0; k < k1; k++) {
      const ref = slow[k] + (1 - h) * (input[k] - slow[k]);
      const e = target[k] + vib[k] - ref;
      c = c === null ? e : c + alpha * (e - c);
      corr[k] = c;
      output[k] = input[k] + c;
    }
  }
  return { input, target, output, corr };
}

/**
 * Autotune d'un son. chans : canaux (Float32Array) ; opts : celles de tuneCurve, plus formant (demi-tons), mix (0..1),
 * from / to (échantillons : seule cette partie est analysée et recalculée), fmin / fmax (Hz).
 * -> { chans, track, curve, stats: { voiced (part du temps), moved (écart moyen corrigé, en cents) } }
 */
export function autotune(chans, sr, opts = {}) {
  const n = chans[0].length;
  const from = Math.max(0, Math.floor(opts.from ?? 0)), to = Math.min(n, Math.ceil(opts.to ?? n));
  const mono = new Float32Array(n);
  for (const c of chans) for (let i = from; i < to; i++) mono[i] += c[i] / chans.length;
  const track = analyzePitch(mono, sr, { from, to, fmin: opts.fmin ?? 60, fmax: opts.fmax ?? 1000 });
  const curve = tuneCurve(track, opts);
  const { hop, start } = track, N = curve.corr.length;
  const ratio = i => {
    const p = (i - start) / hop, k = Math.max(0, Math.min(N - 1, Math.floor(p))), k1 = Math.min(N - 1, k + 1);
    const c = curve.corr[k] + (curve.corr[k1] - curve.corr[k]) * Math.max(0, Math.min(1, p - k));
    return Math.pow(2, c / 12);
  };
  const formant = Math.pow(2, (opts.formant ?? 0) / 12);
  let wet = psolaShift(chans, sr, track, ratio, { formant });
  const mix = Math.max(0, Math.min(1, opts.mix ?? 1));
  if (mix < 1) wet = wet.map((w, ci) => { const d = chans[ci], o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = d[i] + mix * (w[i] - d[i]); return o; });
  let voiced = 0, moved = 0;
  for (let k = 0; k < N; k++) if (track.f0[k]) { voiced++; moved += Math.abs(curve.corr[k]); }
  return { chans: wet, track, curve, stats: { voiced: voiced / N, moved: voiced ? 100 * moved / voiced : 0 } };
}
