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
