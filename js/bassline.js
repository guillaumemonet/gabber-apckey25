// Générateur de basse : une ligne qui suit une suite d'accords (js/chords.js), dans les rythmes des styles hardcore.
// La fondamentale tombe sur les temps forts de chaque accord ; quinte, octave et notes de la gamme remplissent selon le
// style ; une note de passage peut mener à l'accord suivant. Le tirage (graine) ne change que les styles qui varient
// (acid, marche) : la même graine redonne la même ligne.
import { chordScale, keyScale, rng } from './melody.js';

/**
 * Styles : sub (fondamentale tenue, breaks d'hymne), offbeat (croche sur le contretemps, rave / early / frenchcore),
 * rolling (trois doubles croches entre les temps, rave / hard trance), reverse (deux doubles croches après le
 * contretemps, basse « reverse » de la hardstyle), octave (croches fondamentale / octave, happy hardcore),
 * walk (fondamentale, quinte, octave en croches, rave), acid (doubles croches à la TB-303, glissés et accents).
 */
export const BASS_STYLES = ['sub', 'offbeat', 'rolling', 'reverse', 'octave', 'walk', 'acid'];
export const BASS_OCTAVES = { low: 29, mid: 41 };   // plus grave fondamentale possible (fa1, fa2)

const STEP = { offbeat: [[0.5, 0.42]], rolling: [[0.25, 0.22], [0.5, 0.22], [0.75, 0.22]], reverse: [[0.5, 0.2], [0.75, 0.2]] };

/**
 * Ligne de basse sur une suite d'accords (un passage) : [{ t, len, note, vel }], temps depuis le début.
 * @param {{ root: number, intervals: number[] }[]} chords
 * @param {{ style?: string, octave?: string, beatsPerChord?: number, seed?: number, passing?: boolean }} o
 */
export function generateBass(chords, o = {}) {
  const style = BASS_STYLES.includes(o.style) ? o.style : 'offbeat';
  const lo = BASS_OCTAVES[o.octave] ?? BASS_OCTAVES.low;
  const cb = o.beatsPerChord ?? 8;
  const r = rng(o.seed ?? 1);
  const scale = chords.length ? keyScale(chords) : [];
  const rootOf = c => lo + ((c.root - lo) % 12 + 12) % 12;
  const out = [];
  const add = (t, len, note, vel) => out.push({ t: +t.toFixed(4), len: +len.toFixed(4), note, vel });
  chords.forEach((c, i) => {
    const t0 = i * cb, root = rootOf(c);
    const fifth = root + (c.intervals.includes(6) ? 6 : 7);
    const third = root + (c.intervals.includes(3) ? 3 : 4);
    // Fin de l'accord gardée pour la note de passage (le dernier contretemps).
    const next = chords[i + 1] ?? chords[0];
    const passAt = o.passing && chords.length > 1 && next !== c ? cb - 0.5 : Infinity;
    if (style === 'sub') {
      add(t0, Math.min(cb, passAt), root, 0.9);
    } else if (STEP[style]) {
      for (let b = 0; b < cb; b++) for (const [o2, len] of STEP[style]) if (b + o2 < passAt - 1e-6) add(t0 + b + o2, len, root, o2 === STEP[style][0][0] ? 0.9 : 0.8);
    } else if (style === 'octave') {
      for (let e = 0; e < cb * 2; e++) if (e / 2 < passAt - 1e-6) add(t0 + e / 2, 0.42, e % 2 ? root + 12 : root, e % 2 ? 0.8 : 0.9);
    } else if (style === 'walk') {
      // Motif d'une mesure tiré une fois : fondamentale sur le temps, quinte / octave / tierce entre.
      const shapes = [[0, 12, 7, 12], [0, 7, 12, 7], [0, 0, 7, 12], [0, 12, 0, 7]];
      const shape = shapes[Math.floor(r() * shapes.length)];
      for (let e = 0; e < cb * 2; e++) {
        if (e / 2 >= passAt - 1e-6) continue;
        const k = shape[e % 4], note = k === 7 ? fifth : root + k;
        add(t0 + e / 2, 0.42, e % 4 === 2 && r() < 0.25 ? third : note, e % 2 ? 0.78 : 0.9);
      }
    } else {
      // Acid : un motif de 16 doubles croches tiré une fois par accord, rejoué sur toute sa durée.
      const sc = chordScale(scale, c).map(pc => lo + ((pc - lo) % 12 + 12) % 12).sort((a, b) => a - b);
      const cell = Array.from({ length: 16 }, (_, s) => {
        if (s % 4 === 0) return { note: root, acc: s === 0 };
        if (r() < 0.3) return null;   // silence
        const n = r() < 0.5 ? root : r() < 0.5 ? sc[Math.floor(r() * sc.length)] : root + 12;
        return { note: n, acc: r() < 0.25, slide: r() < 0.2 };
      });
      for (let s = 0; s < cb * 4; s++) {
        const step = cell[s % 16];
        if (!step || s / 4 >= passAt - 1e-6) continue;
        add(t0 + s / 4, step.slide ? 0.3 : 0.2, step.note, step.acc ? 1 : 0.72);
      }
    }
    // Note de passage : un demi-ton ou un ton sous la fondamentale suivante (ou la quinte), sur le dernier contretemps.
    if (passAt < cb) {
      const target = rootOf(next);
      const cands = [target - 1, target + 1, target - 2, target + 2, fifth].filter(n => n >= lo - 2);
      const inKey = cands.filter(n => scale.includes(((n % 12) + 12) % 12));
      const note = (inKey.length ? inKey : cands)[Math.floor(r() * Math.min(2, (inKey.length ? inKey : cands).length))];
      add(t0 + passAt, 0.42, note, 0.85);
    }
  });
  return out.sort((a, b) => a.t - b.t || a.note - b.note);
}
