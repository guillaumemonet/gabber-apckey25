// Étirement temporel et transposition (sans dépendance, dans un Worker ou dans Node).
// - stretch : WSOLA (Waveform Similarity Overlap-Add). Le son est découpé en tranches de N échantillons qui se
//   chevauchent de moitié (fenêtre de Hann) ; chaque tranche est prise à l'endroit voulu de l'entrée, décalée de quelques
//   millisecondes pour ressembler le plus possible à la suite naturelle de la tranche précédente : pas de cassure.
//   La recherche se fait d'abord à gros grain (1 échantillon sur 4), puis au plus près.
// - transposition : rééchantillonnage (interpolation cubique), puis étirement pour retrouver la durée voulue.
// Une boucle reste une boucle : son début sert de suite à sa fin pendant le calcul.

const N = 1024, HOP = N / 2, TOL = 384;
const HANN = (() => { const w = new Float32Array(N); for (let i = 0; i < N; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N); return w; })();

// Rééchantillonne `x` en lisant à la vitesse `speed` (2 = une octave plus haut, deux fois plus court).
export function resample(x, speed) {
  const n = Math.max(1, Math.floor(x.length / speed));
  const y = new Float32Array(n);
  const at = i => x[Math.min(x.length - 1, Math.max(0, i))];
  for (let i = 0; i < n; i++) {
    const p = i * speed, k = Math.floor(p), f = p - k;
    const a = at(k - 1), b = at(k), c = at(k + 1), d = at(k + 2);
    y[i] = b + 0.5 * f * (c - a + f * (2 * a - 5 * b + 4 * c - d + f * (3 * (b - c) + d - a)));
  }
  return y;
}

/**
 * Étire des canaux à la longueur `outLen` (même hauteur).
 * @param {Float32Array[]} chans
 * @param {number} outLen
 * @param {boolean} loop  le son boucle : sa fin se raccorde à son début
 */
export function stretch(chans, outLen, loop = false) {
  const len = chans[0].length;
  if (len < N * 2 || Math.abs(outLen / len - 1) < 1e-4) return chans.map(c => { const y = new Float32Array(outLen); y.set(c.subarray(0, Math.min(len, outLen))); return y; });
  // Entrée prolongée : la boucle recommence (ou un silence) pour que les dernières tranches aient une suite.
  const ext = len + N * 2 + TOL * 2;
  const src = chans.map(c => { const y = new Float32Array(ext); y.set(c); if (loop) for (let i = len; i < ext; i++) y[i] = c[(i - len) % len]; return y; });
  const mono = new Float32Array(ext);
  for (const c of src) for (let i = 0; i < ext; i++) mono[i] += c[i] / src.length;
  const ha = HOP * (len / outLen);   // pas de lecture dans l'entrée
  const out = chans.map(() => new Float32Array(outLen + N));
  let prev = 0;
  const frames = Math.ceil(outLen / HOP) + 1;
  for (let k = 0; k < frames; k++) {
    const nominal = Math.round(k * ha);
    let sel = nominal;
    if (k > 0) {
      const want = prev + HOP;   // suite naturelle de la tranche précédente
      const lo = Math.max(0, nominal - TOL), hi = Math.min(ext - N, nominal + TOL);
      let best = -Infinity;
      const corr = (p, step) => { let s = 0; for (let i = 0; i < N; i += step) s += mono[p + i] * mono[want + i]; return s; };
      for (let p = lo; p <= hi; p += 4) { const c = corr(p, 4); if (c > best) { best = c; sel = p; } }
      const c0 = sel;
      best = -Infinity;
      for (let p = Math.max(lo, c0 - 4); p <= Math.min(hi, c0 + 4); p++) { const c = corr(p, 1); if (c > best) { best = c; sel = p; } }
    }
    const o = k * HOP;
    for (let ch = 0; ch < src.length; ch++) {
      const s = src[ch], y = out[ch];
      for (let i = 0; i < N && o + i < y.length; i++) y[o + i] += HANN[i] * (s[sel + i] ?? 0);
    }
    prev = sel;
  }
  // La première demi-tranche n'a reçu qu'une fenêtre montante : on la reprend telle quelle.
  for (let ch = 0; ch < src.length; ch++) for (let i = 0; i < HOP && i < outLen; i++) out[ch][i] = src[ch][i];
  return out.map(y => y.subarray(0, outLen));
}

/**
 * Son à la durée `factor` × l'original (tempo) et transposé de `semis` demi-tons (hauteur).
 * @param {Float32Array[]} chans
 * @param {number} factor  durée de sortie / durée d'entrée (2 = deux fois plus lent)
 * @param {number} semis
 */
export function warp(chans, factor, semis = 0, loop = false) {
  const outLen = Math.max(1, Math.round(chans[0].length * factor));
  const speed = Math.pow(2, semis / 12);
  const pitched = Math.abs(speed - 1) > 1e-6 ? chans.map(c => resample(c, speed)) : chans;
  return stretch(pitched, outLen, loop);
}
