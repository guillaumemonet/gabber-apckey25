// Blocs de notes de la timeline (synthé). Deux formes :
// - ancienne : { type: 'note', note | notes (accord), vel, len } : toutes les notes durent tout le bloc ;
// - piano roll : { type: 'note', seq: [{ t, len, note, vel }], pat } : notes placées dans un motif de `pat` temps,
//   répété sur toute la longueur `len` du bloc (comme une boucle audio).
// Les temps sont en noires (temps), depuis le début du bloc.

export const NOTE_LO = 24;    // do1
export const NOTE_HI = 108;   // do8

export const clipNotes = clip => clip.seq ?? (clip.notes ?? [clip.note]).map(note => ({ t: 0, len: clip.len, note, vel: clip.vel ?? 0.85 }));
export const patLen = clip => (clip.seq ? clip.pat || clip.len : clip.len);

// Passe un ancien bloc au format du piano roll (sans changer ce qu'il joue).
export function toSeq(clip) {
  if (clip.seq) return clip;
  clip.seq = clipNotes(clip);
  clip.pat = clip.len;
  delete clip.note;
  delete clip.notes;
  delete clip.vel;
  return clip;
}

// Notes jouées par le bloc sur toute sa longueur (motif répété, notes coupées à la fin du bloc).
// `i` : numéro unique de la note dans le bloc (clé de la voix).
export function clipEvents(clip) {
  const notes = clipNotes(clip);
  const pat = patLen(clip);
  const out = [];
  if (!(pat > 0) || !(clip.len > 0)) return out;
  let i = 0;
  for (let r = 0; r < clip.len - 1e-6; r += pat) {
    for (const n of notes) {
      const t = r + n.t;
      i++;
      if (n.t >= pat - 1e-6 || t >= clip.len - 1e-6) continue;
      out.push({ t, len: Math.min(n.len, clip.len - t), note: n.note, vel: n.vel ?? 0.85, i });
    }
  }
  return out;
}

// Justesse propre d'un instrument (bloc avec `tune: { root, scale }`, posé par le Breizh generator) : écart en centièmes
// avec le tempérament égal, selon l'intervalle entre la note et la tonique `root` (note MIDI).
// pipe = chalumeau de la cornemuse écossaise, mesuré sur des enregistrements (la grave = tonique) : seconde, tierce, quarte,
// quinte, sixte presque justes (9/8, 5/4, 4/3 un peu haute, 3/2, 5/3) ; le sol grave sous la tonique très bas (7/8,
// la septième « bémol » de la cornemuse), le sol aigu au contraire un peu haut (9/5). Les degrés absents du chalumeau
// prennent l'intervalle juste le plus simple.
export const TUNINGS = {
  pipe: { cents: [0, 12, 3, 16, -9, 10, -10, 7, 14, -9, 17, -12], below: { 10: -29 } },
};
export function tunedNote(note, tune) {
  const s = TUNINGS[tune?.scale];
  if (!s || !Number.isFinite(tune.root)) return note;
  const iv = note - tune.root, pc = ((iv % 12) + 12) % 12;
  return note + ((iv < 0 ? s.below?.[pc] : undefined) ?? s.cents[pc]) / 100;
}

// Ligne monophonique (synthé à oscillateurs en mono / legato) : une note s'arrête quand la suivante commence,
// et la suivante glisse depuis elle si elles se touchent.
export function monoLine(events) {
  const ev = events.map(e => ({ ...e })).sort((a, b) => a.t - b.t);
  for (let i = 0; i + 1 < ev.length; i++) {
    const a = ev[i], b = ev[i + 1];
    if (b.t < a.t + a.len - 1e-6) a.len = Math.max(0.01, b.t - a.t);
    if (b.t <= a.t + a.len + 1e-6 && b.t > a.t) b.from = a.note;
  }
  return ev;
}

// Rassemble des blocs de notes en un seul motif qui commence au temps `start` (temps de la timeline).
export function mergeNotes(clips, start) {
  return clips.flatMap(c => clipEvents(c).map(e => ({ t: c.start + e.t - start, len: e.len, note: e.note, vel: e.vel })))
    .sort((a, b) => a.t - b.t || a.note - b.note);
}

// Calage sur la grille : le début et la fin de chaque note (au moins une case).
export function quantize(notes, grid) {
  for (const n of notes) {
    const t = Math.max(0, Math.round(n.t / grid) * grid);
    const end = Math.round((n.t + n.len) / grid) * grid;
    n.t = +t.toFixed(4);
    n.len = +Math.max(grid, end - t).toFixed(4);
  }
}
