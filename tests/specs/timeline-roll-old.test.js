// Piano roll : anciens blocs de notes (une note, ou un accord avec preset) convertis à l'ouverture sans changer ce
// qu'ils jouent ; regrouper des blocs voisins du même son.
export async function seed() {
  await new Promise((res, rej) => {
    const req = indexedDB.open('apc-studio', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('state'); req.result.createObjectStore('samples'); };
    req.onsuccess = () => {
      const tx = req.result.transaction('state', 'readwrite');
      const tracks = Array.from({ length: 16 }, () => ({ mute: false, clips: [] }));
      tracks[2].clips.push({ id: 'old1', type: 'note', note: 65, vel: 0.9, name: 'F4', color: 9, cat: 'lead', start: 0, len: 0.5, loop: false });
      tracks[2].clips.push({ id: 'old2', type: 'note', notes: [53, 56, 60], vel: 0.8, preset: 'epic_strings', name: 'Fm', cat: 'strings', color: 9, start: 4, len: 8, loop: false });
      tracks[2].clips.push({ id: 'old3', type: 'note', note: 68, vel: 0.9, name: 'G#4', color: 9, cat: 'lead', start: 2, len: 1, loop: false });
      tx.objectStore('state').put({ bank: 0, page: 'synth', bpm: 190, preset: 'init', globals: {}, windows: { roll: { open: true, x: 20, y: 20, w: 900, h: 500 } }, tl: { bars: 32, tracks }, banks: [] }, 'main');
      tx.oncomplete = () => { req.result.close(); res(); };
      tx.onerror = rej;
    };
    req.onerror = rej;
  });
}

export default async function (t, A) {
  const S = A.state;
  const list = S.tl.tracks[2].clips;
  t.eq(list.map(c => c.id), ['old1', 'old2', 'old3'], 'les anciens blocs sont chargés');
  t.ok(A.wm.isOpen('roll'), 'la fenêtre du piano roll est restaurée');
  const chord = list[1];
  A.openRoll(chord, true);
  await t.wait(100);
  t.eq(chord.seq?.map(n => [n.t, n.note, n.len]), [[0, 53, 8], [0, 56, 8], [0, 60, 8]], 'accord converti en notes (même durée)');
  t.ok(chord.seq?.every(n => Math.abs(n.vel - 0.8) < 1e-6), 'vélocité gardée', chord.seq);
  t.eq([chord.pat, chord.len, chord.note, chord.notes], [8, 8, undefined, undefined], 'motif = longueur du bloc, ancien format retiré');
  t.eq(t.$('#roll-preset').value, 'epic_strings', 'le son du bloc est affiché');
  t.ok(/3/.test(t.$('#roll-where').textContent) && /2/.test(t.$('#roll-where').textContent), 'emplacement : piste 3, mesure 2', t.$('#roll-where').textContent);
  // Regrouper : les deux blocs d'une note sans preset (pas l'accord, d'un autre son).
  A.openRoll(list[0], true);
  A.rollMerge();
  const after = S.tl.tracks[2].clips;
  t.eq(after.length, 2, 'les deux blocs d\'une note sont regroupés, l\'accord reste à part');
  const m = after.find(c => c.id === 'old1');
  t.eq([m?.start, m?.len, m?.pat], [0, 4, 4], 'bloc regroupé : une mesure');
  t.eq(m?.seq.map(n => [n.t, n.note]).sort((a, b) => a[0] - b[0]), [[0, 65], [2, 68]], 'avec les deux notes à leur place');
  t.ok(after.includes(chord), 'l\'accord n\'est pas touché');
}
