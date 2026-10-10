// Générateur de mélodie (lead) : une ligne qui suit une suite d'accords (js/chords.js), comme un hook d'hymne hardcore.
// Un motif rythmique et un contour mélodique sont tirés au hasard (graine) puis rejoués sur chaque accord :
// la mélodie se répète en suivant l'harmonie, ce qui la rend facile à retenir. Les temps forts tombent sur les
// notes de l'accord ; entre eux, la mélodie passe par la gamme (celle du premier accord, ajustée à chaque accord).

export const LEAD_STYLES = ['anthem', 'arp', 'riff', 'call'];
export const LEAD_DENSITIES = ['low', 'mid', 'high'];
export const LEAD_REGISTERS = { mid: 67, high: 74 };   // note centrale de la mélodie (sol4, ré5)

// Tirage pseudo-aléatoire reproductible : la même graine donne la même mélodie (écoute = ce qui est posé).
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// Motifs d'une mesure : [début, longueur] en temps.
const CELLS = {
  anthem: {
    low: [[[0, 2], [2, 2]], [[0, 3], [3, 1]], [[0, 1.5], [1.5, 2.5]]],
    mid: [[[0, 1.5], [1.5, 1.5], [3, 1]], [[0, 1], [1, 1], [2, 1.5], [3.5, 0.5]], [[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 2]]],
    high: [[[0, 0.75], [0.75, 0.75], [1.5, 0.5], [2, 0.5], [2.5, 0.5], [3, 1]], [[0, 0.5], [0.5, 0.5], [1, 0.5], [1.5, 1], [2.5, 0.5], [3, 1]]],
  },
  riff: {
    low: [[[0.5, 0.4], [1.5, 0.4], [2.5, 0.4], [3.5, 0.4]]],
    mid: [[[0, 0.4], [0.75, 0.25], [1.5, 0.4], [2, 0.4], [2.75, 0.25], [3.5, 0.4]], [[0, 0.25], [0.5, 0.4], [1.5, 0.4], [2, 0.25], [2.5, 0.4], [3.5, 0.4]]],
    high: [[[0, 0.25], [0.5, 0.25], [0.75, 0.25], [1.5, 0.25], [2, 0.25], [2.5, 0.25], [2.75, 0.25], [3.5, 0.25]],
      [[0, 0.25], [0.25, 0.25], [0.75, 0.25], [1.5, 0.25], [2, 0.25], [2.25, 0.25], [2.75, 0.25], [3.25, 0.25], [3.5, 0.25]]],
  },
};
CELLS.call = CELLS.anthem;
const ARP_STEP = { low: 0.5, mid: 0.5, high: 0.25 };

const pcsOf = chord => chord.intervals.map(i => (chord.root + i) % 12);

// Gamme du morceau : mineure naturelle si le premier accord est mineur, majeure sinon.
export function keyScale(chords) {
  const c = chords[0];
  const steps = c.intervals.includes(3) ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
  return steps.map(s => (c.root + s) % 12);
}

// Gamme sur un accord : une note de l'accord absente de la gamme remplace le degré voisin (mi bécarre sur do majeur en fa mineur).
export function chordScale(scale, chord) {
  const out = [...scale];
  for (const tone of pcsOf(chord)) {
    if (out.includes(tone)) continue;
    const k = out.findIndex(pc => [1, 11].includes((tone - pc + 12) % 12));   // degré à un demi-ton
    if (k >= 0) out[k] = tone; else out.push(tone);
  }
  return out;
}

const notesIn = (pcs, lo, hi) => { const out = []; for (let n = lo; n <= hi; n++) if (pcs.includes(n % 12)) out.push(n); return out; };
const nearest = (list, n) => list.reduce((b, x) => (Math.abs(x - n) < Math.abs(b - n) ? x : b));

/**
 * Mélodie sur une suite d'accords (un passage) : [{ t, len, note, vel }], temps depuis le début.
 * @param {{ root: number, intervals: number[] }[]} chords
 * @param {{ style?: string, density?: string, register?: string, beatsPerChord?: number, seed?: number, double?: boolean }} o
 */
export function generateLead(chords, o = {}) {
  const style = LEAD_STYLES.includes(o.style) ? o.style : 'anthem';
  const density = LEAD_DENSITIES.includes(o.density) ? o.density : 'mid';
  const center = LEAD_REGISTERS[o.register] ?? LEAD_REGISTERS.high;
  const B = o.beatsPerChord ?? 8;
  const r = rng(o.seed ?? 1);
  const lo = center - 8, hi = center + 9;
  const scale = keyScale(chords);
  const seq = [];
  const push = (t, len, note, strong) => seq.push({ t: +t.toFixed(4), len: +len.toFixed(4), note, vel: strong ? 0.95 : 0.8 });
  const bars = Math.max(1, Math.round(B / 4));

  if (style === 'arp') {
    const order = pick(r, ['up', 'updown', 'gabber']);
    const step = ARP_STEP[density];
    chords.forEach((c, ci) => {
      const tones = notesIn(pcsOf(c), center - 7, center + 10);
      const seqIdx = order === 'up' ? tones.map((_, i) => i)
        : order === 'updown' ? [...tones.keys(), ...[...tones.keys()].reverse().slice(1, -1)]
          : tones.flatMap((_, i) => (i === 0 ? [] : [0, i]));
      let k = 0;
      for (let t = 0; t < B - 1e-6; t += step) {
        if (density === 'low' && Math.round(t / step) % 4 === 3) continue;   // un trou par temps
        push(ci * B + t, step * 0.85, tones[seqIdx[k++ % seqIdx.length]], t % 1 === 0);
      }
    });
  } else if (style === 'riff') {
    const cells = CELLS.riff[density];
    const cell = pick(r, cells);
    const shape = cell.map(() => pick(r, [0, 0, 12, 7, 12, 0, 3]));   // fondamentale, octave, quinte, tierce
    chords.forEach((c, ci) => {
      const root = nearest(notesIn([c.root], lo - 5, hi), center - 5);
      const pcs = pcsOf(c);
      for (let b = 0; b < bars; b++) {
        cell.forEach(([t, len], k) => {
          let note = root + shape[k];
          if (shape[k] === 3) note = root + ((pcs[1] - c.root + 12) % 12);   // tierce de l'accord (mineure ou majeure)
          if (shape[k] === 7 && !pcs.includes((c.root + 7) % 12)) note = root;
          push(ci * B + b * 4 + t, len, note, t % 1 === 0);
        });
      }
    });
  } else {
    // Hymne / question-réponse : motif rythmique + contour en degrés de la gamme, rejoués sur chaque accord.
    const cells = CELLS[style][density];
    const main = pick(r, cells);
    const alt = pick(r, cells);
    const contour = Array.from({ length: 16 }, () => pick(r, [-2, -1, -1, 1, 1, 2, 2, 3]));
    // Note de l'accord la plus proche dans le sens du mouvement (vers le haut, vers le bas, ou au plus près).
    const toward = (tones, n, d) => (d > 0 ? tones.find(x => x >= n) : d < 0 ? [...tones].reverse().find(x => x <= n) : null) ?? nearest(tones, n);
    let note = center;
    chords.forEach((c, ci) => {
      const tones = notesIn(pcsOf(c), lo, hi);
      const steps = notesIn(chordScale(scale, c), lo, hi);
      const answer = style === 'call' && ci % 2 === 1;
      for (let b = 0; b < bars; b++) {
        const cell = bars > 1 && b === bars - 1 ? alt : main;
        cell.forEach(([t, len], k) => {
          const first = ci === 0 && b === 0 && k === 0;
          let d = first ? 0 : contour[(b * 4 + k) % contour.length];
          if (style === 'call') d = answer ? -Math.abs(d) : Math.abs(d);   // question qui monte, réponse qui descend
          let i = steps.indexOf(nearest(steps, note)) + d;
          if (i < 0 || i >= steps.length) { d = -d; i = steps.indexOf(nearest(steps, note)) + d; }   // rebond sur les bords du registre
          note = steps[Math.max(0, Math.min(steps.length - 1, i))];
          const strong = t === 0 || t === 2;
          if (strong) note = toward(tones, note, d);
          // Fin de phrase (dernier accord) : la dernière note se pose sur la fondamentale.
          if (ci === chords.length - 1 && b === bars - 1 && k === cell.length - 1) note = nearest(notesIn([c.root], lo, hi), note);
          push(ci * B + b * 4 + t, len, note, strong);
        });
      }
    });
  }
  if (o.double) {
    for (const n of [...seq]) if (n.note + 12 <= 108) seq.push({ ...n, note: n.note + 12, vel: +(n.vel * 0.75).toFixed(2) });
  }
  return seq.sort((a, b) => a.t - b.t || a.note - b.note);
}
