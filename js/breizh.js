// Breizh generator : airs à la manière des sonneurs bretons (bombarde, biniou, cornemuse), avec ornements et bourdons.
// Un air traditionnel se joue en parties répétées (A A B B) : chaque partie est une phrase de quelques mesures,
// une « question » qui s'arrête sur la quinte puis une « réponse » qui revient à la tonique ; la partie B monte plus haut.
// Le rythme vient de la danse (an dro, gavotte, marche, gwerz) ; la mélodie avance surtout par degrés conjoints
// dans le mode choisi, ses temps forts sur les notes de l'accord de tonique. Les ornements (notes d'agrément très
// courtes avant une note, comme les « gracenotes » de la cornemuse) donnent le son des sonneurs.
import { rng } from './melody.js';

export const BZ_MODES = { minor: [0, 2, 3, 5, 7, 8, 10], dorian: [0, 2, 3, 5, 7, 9, 10], mixolydian: [0, 2, 4, 5, 7, 9, 10], major: [0, 2, 4, 5, 7, 9, 11] };
export const BZ_DANCES = ['andro', 'gavotte', 'march', 'gwerz'];
export const BZ_ORNAMENTS = ['none', 'light', 'rich'];
export const BZ_DRONES = ['none', 'tonic', 'fifth'];
export const BZ_FORMS = ['A', 'AB'];
// Instruments : preset de la mélodie, note la plus grave possible pour la tonique, deuxième voix (couple de sonneurs, bagad).
// Couple : la bombarde reprend son souffle à la fin de chaque phrase de deux mesures, le biniou joue tout à l'octave au-dessus.
export const BZ_INSTRUMENTS = {
  bombarde: { lead: 'bombarde', low: 62 },
  biniou: { lead: 'biniou', low: 74 },
  cornemuse: { lead: 'cornemuse', low: 64 },
  couple: { lead: 'bombarde', low: 62, breathe: true, second: { preset: 'biniou', shift: 12 } },
  bagad: { lead: 'bagad', low: 64, second: { preset: 'bombarde', shift: -12 } },
};

// Cellules rythmiques d'une mesure de 4 temps ([début, longueur] en temps) ; `end` : mesure de fin de phrase (note longue).
const RHYTHMS = {
  andro: {
    cells: [[[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]], [[0, 1], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 0.5], [3.5, 0.5]],
      [[0, 0.5], [0.5, 0.5], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1]]],
    end: [[[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 2]], [[0, 1], [1, 0.5], [1.5, 0.5], [2, 2]]],
  },
  gavotte: {
    cells: [[[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]], [[0, 0.75], [0.75, 0.25], [1, 0.5], [1.5, 0.5], [2, 1], [3, 0.5], [3.5, 0.5]],
      [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 0.5], [2, 0.5], [2.5, 1], [3.5, 0.5]]],
    end: [[[0, 0.5], [0.5, 0.5], [1, 1], [2, 2]], [[0, 0.5], [0.5, 1], [1.5, 0.5], [2, 2]]],
  },
  march: {
    cells: [[[0, 0.75], [0.75, 0.25], [1, 0.75], [1.75, 0.25], [2, 1], [3, 1]], [[0, 1], [1, 0.75], [1.75, 0.25], [2, 0.75], [2.75, 0.25], [3, 1]],
      [[0, 0.5], [0.5, 0.5], [1, 0.75], [1.75, 0.25], [2, 1], [3, 0.5], [3.5, 0.5]]],
    end: [[[0, 0.75], [0.75, 0.25], [1, 1], [2, 2]], [[0, 1], [1, 1], [2, 2]]],
  },
  gwerz: {
    cells: [[[0, 2], [2, 1], [3, 1]], [[0, 1.5], [1.5, 0.5], [2, 2]], [[0, 1], [1, 1], [2, 1.5], [3.5, 0.5]]],
    end: [[[0, 1], [1, 3]], [[0, 4]]],
  },
};
const GRACE = 0.0625;   // durée d'une note d'agrément (en temps : 25 ms à 150 BPM)

const pick = (r, list) => list[Math.floor(r() * list.length)];
// Note d'un degré du mode (0 = tonique, 7 = octave, -1 = degré sous la tonique).
export function bzDegree(tonic, mode, d) {
  const s = BZ_MODES[mode] ?? BZ_MODES.minor;
  const o = Math.floor(d / 7);
  return tonic + 12 * o + s[((d % 7) + 7) % 7];
}
// Tonique dans le registre de l'instrument (classe de hauteur 0-11 -> note MIDI).
export const bzTonic = (instrument, pc) => { const low = (BZ_INSTRUMENTS[instrument] ?? BZ_INSTRUMENTS.bombarde).low; return low + ((pc - low) % 12 + 12) % 12; };
// Durée d'un passage de l'air (en temps) : la phrase, ou A A B B.
export const bzPhraseBeats = o => (o.bars ?? 4) * 4 * (o.form === 'A' ? 1 : 4);

const CHORD = [0, 2, 4, 7];            // degrés de l'accord de tonique (temps forts)
const STEPS = [-1, -1, -1, 1, 1, 1, -2, 2, 0, 1, -1, 3, -3];

/**
 * Air sur `bars` mesures (une partie) : [{ t, len, note, vel }].
 * `high` : partie B (plus haute) ; la phrase est coupée en question (fin sur la quinte) / réponse (fin sur la tonique).
 */
function phrase(r, o, tonic, high) {
  const rh = RHYTHMS[o.dance] ?? RHYTHMS.andro;
  const bars = o.bars ?? 4;
  const main = pick(r, rh.cells), alt = pick(r, rh.cells), end = pick(r, rh.end), half = pick(r, rh.end);
  const motif = Array.from({ length: 8 }, () => pick(r, STEPS));
  const out = [];
  let d = high ? pick(r, [4, 4, 5, 7]) : pick(r, [0, 2, 2, 4]);
  const lo = -1, hi = 7;
  for (let b = 0; b < bars; b++) {
    const last = b === bars - 1, mid = bars >= 2 && b === bars / 2 - 1;
    const cell = last ? end : mid && bars >= 4 ? half : b % 2 === 0 ? main : alt;
    // La 3e mesure reprend le motif de la 1re (un ton plus haut ou plus bas) : l'air se retient.
    const shift = b === 2 ? pick(r, [1, -1, 0]) : 0;
    cell.forEach(([t, len], k) => {
      const first = b === 0 && k === 0;
      if (!first) d += motif[(k + (b % 2) * 3) % motif.length] + (k === 0 ? shift : 0);
      if (d < lo) d = lo + 1;
      if (d > hi) d = hi - 1;
      // Temps forts : une note de l'accord de tonique (la plus proche).
      if (t === 0 || t === 2) d = CHORD.reduce((best, c) => (Math.abs(c - d) < Math.abs(best - d) ? c : best), CHORD[0]);
      // Fin de la question sur la quinte, fin de la phrase sur la tonique.
      if (k === cell.length - 1 && (mid || last)) d = last ? (high && r() < 0.3 ? 7 : 0) : 4;
      out.push({ t: b * 4 + t, len, note: bzDegree(tonic, o.mode, d), vel: t === 0 ? 0.95 : t % 1 === 0 ? 0.88 : 0.8, d });
    });
  }
  return out;
}

// Notes d'agrément : une (ou deux) notes très courtes avant les notes posées sur un temps.
// Cornemuse et bagad : la note la plus haute du chalumeau (comme le sol aigu des gracenotes) ; bombarde et biniou : le degré au-dessus.
function ornament(seq, r, o, tonic) {
  const amount = o.ornaments === 'rich' ? 0.75 : o.ornaments === 'light' ? 0.35 : 0;
  if (!amount) return seq;
  const pipes = o.instrument === 'cornemuse' || o.instrument === 'bagad';
  const out = [];
  for (let i = 0; i < seq.length; i++) {
    const n = seq[i], prev = out[out.length - 1];
    const room = prev ? n.t - prev.t : n.t;
    if (n.t % 1 === 0 && n.len >= 0.5 && room >= 0.5 && r() < amount) {
      const top = pipes ? bzDegree(tonic, o.mode, n.d >= 7 ? 8 : 7) : bzDegree(tonic, o.mode, n.d + 1);
      const graces = o.ornaments === 'rich' && n.len >= 1 && r() < 0.5 ? [top, bzDegree(tonic, o.mode, n.d + 1)] : [top];
      const start = n.t - graces.length * GRACE;
      if (start >= 0) {
        if (prev && prev.t + prev.len > start) prev.len = +(start - prev.t).toFixed(4);
        graces.forEach((note, k) => out.push({ t: +(start + k * GRACE).toFixed(4), len: GRACE, note, vel: 0.7, d: n.d, grace: true }));
      }
    }
    out.push({ ...n });
  }
  return out;
}

/**
 * Un passage de l'air (A, ou A A B B) : [{ t, len, note, vel }], temps depuis le début.
 * @param {{ instrument?: string, dance?: string, tonic?: number, mode?: string, bars?: number, form?: string, ornaments?: string, seed?: number }} o
 */
export function generateBreizh(o = {}) {
  const r = rng(o.seed ?? 1);
  const tonic = bzTonic(o.instrument, o.tonic ?? 5);
  const bars = o.bars ?? 4, part = bars * 4;
  const a = phrase(r, o, tonic, false);
  let seq = a;
  if (o.form !== 'A') {
    const b = phrase(r, o, tonic, true);
    seq = [...a, ...a.map(n => ({ ...n, t: n.t + part })), ...b.map(n => ({ ...n, t: n.t + 2 * part })), ...b.map(n => ({ ...n, t: n.t + 3 * part }))];
  }
  seq = ornament(seq, r, o, tonic);
  return seq.map(({ t, len, note, vel }) => ({ t: +t.toFixed(4), len: +len.toFixed(4), note, vel })).sort((x, y) => x.t - y.t || x.note - y.note);
}

// Voix de la bombarde dans un couple : elle respire à la fin de chaque phrase de deux mesures (le biniou continue) ;
// plus de note sur le dernier temps, la note tenue s'arrête un demi-temps avant la fin de la phrase.
export const bzBreathe = seq => seq.filter(n => n.t % 8 < 7 - 1e-6)
  .map(n => ({ ...n, len: +Math.min(n.len, Math.floor(n.t / 8) * 8 + 7.5 - n.t).toFixed(4) }));
// Deuxième voix (biniou à l'octave au-dessus, bombardes du bagad à l'octave au-dessous).
export const bzShift = (seq, shift) => seq.map(n => ({ ...n, note: n.note + shift })).filter(n => n.note >= 24 && n.note <= 108);
// Notes du bourdon : tonique une et deux octaves sous la mélodie, et la quinte pour « tonique + quinte ».
export function bzDroneNotes(o) {
  if (!o.drone || o.drone === 'none') return [];
  const t0 = bzTonic(o.instrument, o.tonic ?? 5);
  const base = BZ_INSTRUMENTS[o.instrument]?.low >= 74 ? t0 - 24 : t0 - 12;
  return o.drone === 'fifth' ? [base - 12, base, base + 7] : [base - 12, base];
}
