// Éditeur de notes du Générateur : un piano roll sous les deux onglets montre le brouillon (un passage de la suite) ;
// les réglages le recalculent tant qu'il n'est pas retouché ; une retouche est gardée, posée par Générer, et
// « Recalculer » repart des réglages.
export default async function (t, A) {
  const S = A.state;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.playhead = 0;
  A.wm.toggle('gen', true);
  await t.wait(100);
  t.ok(t.$('#gen-canvas') && t.$('#gen-canvas').clientHeight > 150, 'piano roll sous les réglages');
  const input = t.$('#gen-prog');
  input.value = 'Fm Db Eb C'; input.dispatchEvent(new Event('input'));
  const setSel = (panel, key, v) => { const el = t.$(`#gen [data-panel="${panel}"] select[data-key="${key}"]`); el.value = v; el.dispatchEvent(new Event('change')); };

  // Onglet Accords : brouillon = les accords tenus, 3 notes chacun.
  t.$$('.gen-tabs button')[0].click();
  const dc = A.draft('chords');
  t.eq(dc.seq.length, 12, 'brouillon des accords : 4 accords de 3 notes');
  t.eq(dc.pat, 32, 'un passage de la suite (4 accords × 2 mesures)');
  t.ok(!dc.edited && t.$('#gen-recompute').disabled, 'pas retouché : Recalculer désactivé');
  setSel('chords', 'rhythm', 'beats');
  t.eq(A.draft('chords').seq.length, 12 * 8, 'un réglage (rythme : chaque temps) recalcule le brouillon');
  setSel('chords', 'rhythm', 'hold');

  // Retouche à la main : une note montée d'une octave.
  const first = A.draft('chords').seq[0];
  first.note += 12;
  A.genRoll.host.changed();
  t.ok(A.draft('chords').edited && !t.$('#gen-recompute').disabled, 'retouche signalée, Recalculer disponible');
  t.ok(/main|hand/i.test(t.$('#gen .gen-edited').textContent), 'message « retouchées à la main »');
  setSel('chords', 'register', 'high');
  t.ok(A.draft('chords').seq.includes(first), 'un réglage ne remplace plus les notes retouchées');
  setSel('chords', 'register', 'mid');
  t.$('#gen-go').click();
  await t.wait(100);
  const blocks = S.tl.tracks.flatMap(tr => tr.clips).filter(c => c.cat === 'pad');
  t.ok(blocks.some(c => c.start === 0 && c.seq.some(n => n.note === first.note)), 'Générer pose les notes retouchées', blocks[0]?.seq);

  // Onglet Mélodie : même principe ; Nouvelle idée et Recalculer repartent des réglages.
  t.$$('.gen-tabs button')[1].click();
  const dl = A.draft('lead');
  t.ok(dl.seq.length >= 8 && !dl.edited, 'brouillon de la mélodie');
  const chords = A.parseProgression('Fm Db Eb C').chords;
  t.eq(JSON.stringify(dl.seq), JSON.stringify(A.leadSeq(chords)), 'le brouillon est la mélodie des réglages');
  dl.seq.splice(0, 1);
  A.genRoll.host.changed();
  const n0 = A.draft('lead').seq.length;
  setSel('lead', 'style', 'arp');
  t.eq(A.draft('lead').seq.length, n0, 'mélodie retouchée gardée quand on change de style');
  t.$('#gen-recompute').click();
  t.ok(!A.draft('lead').edited && JSON.stringify(A.draft('lead').seq) === JSON.stringify(A.leadSeq(chords)), 'Recalculer : la mélodie des réglages (style arpège)');
  dl.seq = A.draft('lead').seq;
  A.draft('lead').seq[0].vel = 0.5;
  A.genRoll.host.changed();
  t.$('#gen-idea').click();
  t.ok(!A.draft('lead').edited, 'Nouvelle idée repart des réglages');
  A.stopGenPreview();

  // Écouter joue toute la suite (8 mesures ≈ 10 s), pas seulement les deux premiers accords.
  t.$('#gen-listen').click();
  await t.wait(6000);
  t.ok(A.genPreviewing(), 'Écouter joue toujours après 5 mesures (toute la suite)');
  t.$('#gen-listen').click();
  t.ok(!A.genPreviewing(), 'un deuxième clic arrête');

  // Le brouillon est enregistré avec le projet.
  t.ok(A.stateSnapshot().gen.draft.lead.seq.length > 0, 'brouillons enregistrés avec le projet');
}
