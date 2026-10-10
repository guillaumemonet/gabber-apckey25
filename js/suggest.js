// Suggestions du Générateur, sans réseau de neurones : de la théorie musicale et un peu de statistique.
// - Mélodies : beaucoup de candidates (js/melody.js, graines différentes), notées selon des règles de « hook » d'hymne
//   et selon le goût appris (moyenne des traits des mélodies choisies) ; on propose les meilleures, différentes entre elles.
// - Suites d'accords : marche dans un tableau des enchaînements habituels de l'hymne hardcore en mineur, notée elle aussi.
import { generateLead } from './melody.js';

const pcs = c => c.intervals.map(i => (c.root + i) % 12);

/** Traits d'une mélodie (un passage de la suite) : tous entre 0 et 1 environ. */
export function leadFeatures(seq, chords, beatsPerChord) {
  const notes = [...seq].sort((a, b) => a.t - b.t || b.note - a.note).filter((n, i, a) => i === 0 || n.t !== a[i - 1].t);   // la voix du dessus
  if (notes.length < 2) return null;
  const total = chords.length * beatsPerChord;
  const steps = notes.slice(1).map((n, i) => Math.abs(n.note - notes[i].note));
  const lo = Math.min(...notes.map(n => n.note)), hi = Math.max(...notes.map(n => n.note));
  const strong = notes.filter(n => Math.abs(n.t % 2) < 1e-6);
  const onChord = strong.filter(n => pcs(chords[Math.min(chords.length - 1, Math.floor(n.t / beatsPerChord))]).includes(n.note % 12)).length;
  const peakAt = notes.find(n => n.note === hi).t / total;
  const last = notes[notes.length - 1];
  const lastChord = chords[chords.length - 1];
  // Motif : les intervalles se répètent-ils d'un accord à l'autre ?
  const per = chords.map((_, i) => notes.filter(n => n.t >= i * beatsPerChord && n.t < (i + 1) * beatsPerChord));
  const shape = g => g.slice(1).map((n, i) => [Math.round((n.t - g[i].t) * 4), Math.sign(n.note - g[i].note)].join());
  let same = 0, cmp = 0;
  for (let i = 1; i < per.length; i++) {
    const a = shape(per[0]), b = shape(per[i]);
    for (let k = 0; k < Math.min(a.length, b.length); k++) { cmp++; if (a[k] === b[k]) same++; }
  }
  return {
    step: steps.filter(s => s > 0 && s <= 2).length / steps.length,          // mouvements conjoints
    leap: steps.filter(s => s > 7).length / steps.length,                    // grands sauts
    repeat: steps.filter(s => s === 0).length / steps.length,                // notes répétées
    range: Math.min(1, (hi - lo) / 24),                                      // ambitus (24 demi-tons = 1)
    density: Math.min(1, notes.length / (total * 1.5)),                      // notes par temps
    chordTones: strong.length ? onChord / strong.length : 0,                 // temps forts sur l'accord
    peak: peakAt,                                                            // place du sommet (0 = début, 1 = fin)
    resolve: last.note % 12 === lastChord.root ? 1 : pcs(lastChord).includes(last.note % 12) ? 0.5 : 0,
    motif: cmp ? same / cmp : 0,                                             // motif repris d'un accord à l'autre
  };
}
export const FEATURES = ['step', 'leap', 'repeat', 'range', 'density', 'chordTones', 'peak', 'resolve', 'motif'];

// Règles d'un bon hook d'hymne (0..1) : conjoint, peu de sauts, ambitus d'une octave environ, temps forts sur l'accord,
// sommet dans le dernier tiers, fin résolue, motif repris (mais pas à l'identique partout).
export function theoryScore(f) {
  const bell = (x, mid, w) => Math.exp(-(((x - mid) / w) ** 2));
  return (
    1.2 * bell(f.step, 0.6, 0.3) +
    1.0 * (1 - Math.min(1, f.leap * 4)) +
    0.6 * (1 - Math.min(1, f.repeat * 2.5)) +
    0.8 * bell(f.range, 0.45, 0.2) +
    1.5 * f.chordTones +
    0.8 * bell(f.peak, 0.75, 0.25) +
    0.7 * f.resolve +
    1.0 * bell(f.motif, 0.7, 0.25)
  ) / 7.6;
}

/** Goût appris : moyenne des traits des mélodies choisies. { n, mean: { trait: valeur } } */
export function learnTaste(taste, f) {
  const n = (taste?.n ?? 0) + 1;
  const mean = { ...(taste?.mean ?? {}) };
  for (const k of FEATURES) mean[k] = ((mean[k] ?? f[k]) * (n - 1) + f[k]) / n;
  return { n, mean };
}
// Proximité avec le goût (0..1) ; sans goût appris : 0.5 (neutre).
export function tasteScore(taste, f) {
  if (!taste?.n) return 0.5;
  const d = Math.sqrt(FEATURES.reduce((s, k) => s + (f[k] - (taste.mean[k] ?? f[k])) ** 2, 0) / FEATURES.length);
  return Math.max(0, 1 - d * 2.5);
}

const contour = seq => seq.map(n => n.note).join(',');
function similar(a, b) {
  const x = a.map(n => `${n.t}:${n.note}`), y = new Set(b.map(n => `${n.t}:${n.note}`));
  return x.filter(k => y.has(k)).length / Math.max(x.length, y.size);
}

/**
 * Les meilleures mélodies pour cette suite : [{ seed, seq, score, features }], différentes entre elles.
 * @param {object[]} chords
 * @param {{ style, density, register, beatsPerChord, double }} o
 * @param {{ n, mean }} taste
 * @param {number} count
 * @param {number} tries   candidates essayées
 */
export function suggestLeads(chords, o, taste = null, count = 3, tries = 120, seed0 = 1) {
  const cands = [];
  const seen = new Set();
  // Le goût pèse de plus en plus à mesure qu'il apprend (jusqu'à 40 %).
  const w = Math.min(0.4, (taste?.n ?? 0) * 0.08);
  for (let i = 0; i < tries; i++) {
    const seed = seed0 + i * 7919;
    for (const density of o.density ? [o.density] : ['low', 'mid', 'high']) {
      const seq = generateLead(chords, { ...o, density, seed });
      const key = contour(seq);
      if (seen.has(key)) continue;
      seen.add(key);
      const f = leadFeatures(seq, chords, o.beatsPerChord);
      if (!f) continue;
      cands.push({ seed, density, seq, features: f, score: (1 - w) * theoryScore(f) + w * tasteScore(taste, f) });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const out = [];
  for (const c of cands) {
    if (out.every(x => similar(x.seq, c.seq) < 0.5)) out.push(c);
    if (out.length >= count) break;
  }
  return out;
}

// ---- Suites d'accords ----
// Degrés de la gamme mineure (demi-tons depuis la tonique) et qualité : i iv v VI VII III, plus V (majeur, couleur « épique »).
const DEG = { i: [0, 'm'], iv: [5, 'm'], v: [7, 'm'], V: [7, ''], VI: [8, ''], VII: [10, ''], III: [3, ''] };
// Enchaînements habituels dans l'hymne hardcore / hardstyle en mineur (poids).
const NEXT = {
  i: { VI: 4, VII: 2, iv: 2, III: 1.5, v: 1, V: 1 },
  VI: { VII: 4, III: 2, iv: 1.5, i: 1, V: 1.5, v: 0.5 },
  VII: { i: 3, III: 2, VI: 1.5, v: 1, V: 1.5 },
  III: { VII: 3, VI: 2, iv: 1.5, V: 1 },
  iv: { VI: 2, VII: 2, i: 1.5, V: 2, v: 1 },
  v: { VI: 2, i: 2, iv: 1, VII: 1 },
  V: { i: 3, VI: 2 },
};
const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
export const chordName = (tonic, deg) => { const [s, q] = DEG[deg]; return NAMES[(tonic + s) % 12] + q; };

// Note d'une suite (en degrés) : départ sur i, enchaînements fréquents, couleur (VI, VII, V), fin qui relance la boucle.
function progScore(p) {
  let s = 0;
  for (let i = 1; i < p.length; i++) s += Math.log(1 + (NEXT[p[i - 1]][p[i]] ?? 0));
  s += Math.log(1 + (NEXT[p[p.length - 1]].i ?? 0)) * 0.8;   // la boucle revient sur i
  if (new Set(p).size === p.length) s += 0.6;                // quatre accords différents
  if (p.includes('VI')) s += 0.3;
  if (p.includes('V') || p.includes('VII')) s += 0.3;
  return s;
}

/** Suites d'accords d'hymne dans la tonalité de `tonic` (0 = do, 5 = fa) : [{ degrees, text }]. */
export function suggestProgressions(tonic, count = 6, length = 4) {
  const all = [];
  const walk = p => {
    if (p.length === length) { all.push(p); return; }
    for (const d of Object.keys(NEXT[p[p.length - 1]])) walk([...p, d]);
  };
  walk(['i']);
  return all.map(p => ({ degrees: p, score: progScore(p) })).sort((a, b) => b.score - a.score).slice(0, count)
    .map(x => ({ degrees: x.degrees, text: x.degrees.map(d => chordName(tonic, d)).join(' ') }));
}
