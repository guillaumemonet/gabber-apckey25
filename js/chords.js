// Suites d'accords pour le générateur de nappes : lecture des symboles (« Fm Db Eb Cm ») et
// enchaînement des voix (chaque accord garde les notes communes et bouge le moins possible).

export const PROGRESSIONS = ['Fm Db Eb Cm', 'Fm Db Ab Eb', 'Fm Bbm Db C', 'Fm Eb Db C', 'Fm Ab Eb Db', 'Bbm Fm Db C'];

const ROOTS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], dim: [0, 3, 6], aug: [0, 4, 8],
  sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14],
};
const ALIASES = { min: 'm', '-': 'm', maj: '', M: '', M7: 'maj7', min7: 'm7', '°': 'dim', '+': 'aug' };

// « F#m7 » -> { name, root (0-11), intervals } ; null si le symbole n'est pas reconnu.
export function parseChord(sym) {
  const m = /^([A-Ga-g])([#b]?)(.*)$/.exec(sym.trim());
  if (!m) return null;
  const q = ALIASES[m[3]] ?? m[3];
  const intervals = QUALITIES[q];
  if (!intervals) return null;
  const root = (ROOTS[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
  return { name: m[1].toUpperCase() + m[2] + q, root, intervals };
}

// Texte libre : accords séparés par des espaces, virgules, tirets ou barres.
export function parseProgression(text) {
  const tokens = text.split(/[\s,;|–—]+|-(?=[A-G])/).map(s => s.trim()).filter(s => s && s !== '-');
  const chords = [];
  const bad = [];
  for (const tok of tokens) {
    const c = parseChord(tok);
    if (c) chords.push(c); else bad.push(tok);
  }
  return { chords, bad };
}

// Positions serrées possibles d'un accord (chaque note une fois) dont la plus grave est entre lo et hi.
function closeVoicings(chord, lo, hi) {
  const pcs = chord.intervals.map(i => (chord.root + i) % 12);
  const out = [];
  for (let low = lo; low <= hi; low++) {
    if (!pcs.includes(low % 12)) continue;
    const notes = [low];
    const rest = pcs.filter((pc, i) => pcs.indexOf(pc) === i && pc !== low % 12);
    for (const pc of rest.sort((a, b) => ((a - low) % 12 + 12) % 12 - ((b - low) % 12 + 12) % 12)) {
      notes.push(low + ((pc - low) % 12 + 12) % 12);
    }
    out.push(notes);
  }
  return out;
}

const mean = a => a.reduce((s, n) => s + n, 0) / a.length;

// Notes de chaque accord autour de `center` (note MIDI), en enchaînant les voix au plus près.
export function voiceChords(chords, center = 62) {
  let prev = null;
  return chords.map(chord => {
    const cands = closeVoicings(chord, center - 10, center + 2);
    const cost = v => {
      const drift = Math.abs(mean(v) - center) * 0.4;
      if (!prev) return drift * 3;
      const move = v.length === prev.length ? v.reduce((s, n, i) => s + Math.abs(n - prev[i]), 0) : Math.abs(mean(v) - mean(prev)) * v.length;
      return move + drift;
    };
    prev = cands.reduce((best, v) => (cost(v) < cost(best) ? v : best));
    return prev;
  });
}

// Fondamentale à la basse (entre do2 et si2).
export const bassNote = chord => 36 + chord.root;
