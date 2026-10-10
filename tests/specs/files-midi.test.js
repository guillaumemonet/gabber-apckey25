// Fichiers MIDI : export des blocs de notes (motif déplié, transposition et gain compris ; coups de pads sur le canal 10),
// aller-retour exact, import par « Ouvrir… » (blocs de notes sur des pistes libres, à la mesure de la tête de lecture),
// fichier illisible.
export default async function (t, A) {
  const S = A.state;
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.arm = false; });
  S.tl.tracks[0].arm = true;
  S.tl.bars = 8;
  S.tl.tracks[0].clips.push({ id: 'n1', type: 'note', seq: [{ t: 0, len: 1, note: 65, vel: 0.8 }, { t: 1, len: 1, note: 68, vel: 0.8 }], pat: 2, len: 4, start: 4, name: 'Hook', cat: 'lead', loop: false });
  S.tl.tracks[1].clips.push({ id: 'n2', type: 'note', notes: [53, 56, 60], vel: 0.7, len: 8, start: 0, name: 'Fm', cat: 'pad' });
  S.tl.tracks[2].clips.push({ id: 'p1', type: 'pad', bank: 16, pad: 0, start: 2, len: 1, vel: 1 });
  A.renderTl();

  const mt = A.timelineMidiTracks();
  t.eq(mt.length, 3, 'trois pistes MIDI (deux de notes, une de pads)');
  t.eq(mt[0].notes.map(n => [n.t, n.note]), [[4, 65], [5, 68], [6, 65], [7, 68]], 'motif déplié sur la longueur du bloc, en temps du morceau');
  t.eq(mt[1].notes.map(n => n.note), [53, 56, 60], 'accord d’un ancien bloc');
  t.eq([mt[2].channel, mt[2].notes[0].note, mt[2].notes[0].t], [9, 36, 2], 'coup de pad : canal 10, note 36');

  // Aller-retour.
  const bytes = A.writeMidi(mt, S.bpm);
  const back = A.readMidi(bytes);
  t.near(back.bpm, S.bpm, 0.01, 'tempo du fichier');
  t.eq(back.tracks.map(x => x.notes.map(n => [n.t, n.len, n.note])), mt.map(x => x.notes.map(n => [n.t, n.len, n.note])), 'notes identiques après l’aller-retour');

  // Bouton MIDI (export).
  t.$('#tl-midi').click();
  t.ok(/3/.test(t.$('#toast').textContent), 'export : fichier prêt', t.$('#toast').textContent);

  // Import par « Ouvrir… » : à la mesure de la tête de lecture, sur des pistes libres.
  S.tl.playhead = 9;   // mesure 3 (temps 8)
  const file = new File([bytes], 'hook.mid', { type: 'audio/midi' });
  const input = t.$('#file-input');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
  const imported = () => S.tl.tracks.flatMap(tr => tr.clips).filter(c => c.type === 'note' && !['n1', 'n2'].includes(c.id));
  t.ok(await t.until(() => imported().length === 3, 3000), 'trois blocs importés', imported().length);
  const hook = imported().find(c => c.name === mt[0].name);
  t.ok(hook && hook.start === 8, 'à la mesure de la tête de lecture', hook?.start);
  t.eq(hook.seq.map(n => [n.t, n.note]), mt[0].notes.map(n => [n.t, n.note]), 'notes du bloc (temps depuis le début du fichier)');
  t.eq(hook.len % 4, 0, 'longueur arrondie à la mesure');
  const lanes = S.tl.tracks.map((tr, i) => (tr.clips.some(c => imported().includes(c)) ? i : -1)).filter(i => i >= 0);
  // Pistes libres sur la durée importée (elles peuvent avoir des blocs ailleurs).
  const overlap = (a, b) => a.start < b.start + A.timeline.clipBeats(b) && b.start < a.start + A.timeline.clipBeats(a);
  t.ok(lanes.length === 3 && imported().every(c => S.tl.tracks.find(tr => tr.clips.includes(c)).clips.every(o => o === c || !overlap(o, c))), 'sur des pistes libres pendant leur durée', lanes);

  // Fichier illisible.
  t.eq(await A.importMidiFile(new File([new Uint8Array([1, 2, 3, 4])], 'bad.mid')), 0, 'fichier illisible : rien n’est importé');
  t.ok(/illisible|Unreadable/i.test(t.$('#toast').textContent), 'et un message l’explique');
}
