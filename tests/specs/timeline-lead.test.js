// Générateur de mélodie (onglet Mélodie de la fenêtre Générateur) : réglages, écoute (un 2e clic l'arrête),
// un seul bloc de notes répété, temps forts sur les notes de l'accord, même graine = même mélodie, nouvelle idée,
// quatre styles, lecture avec son propre preset, ouverture dans le piano roll.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.playhead = 0;
  A.wm.toggle('gen', true);
  const box = t.$('#gen');
  t.$$('.gen-tabs button')[1].click();
  t.eq(S.gen.tab, 'lead', 'onglet Mélodie');
  const panel = box.querySelector('[data-panel="lead"]');
  t.ok(!panel.hidden && box.querySelector('[data-panel="chords"]').hidden, 'seuls les réglages de la mélodie sont affichés');
  t.eq(panel.querySelectorAll('select').length, 4, 'son, style, densité, registre');
  const input = t.$('#gen-prog');
  input.value = 'Fm Db Eb C'; input.dispatchEvent(new Event('input'));

  // Écoute, puis arrêt au deuxième clic.
  const level = t.meter(E.output);
  const peak = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, level()); await t.wait(20); } return p; };
  t.$('#gen-listen').click();
  const playingPeak = await peak(600);
  t.ok(A.genPreviewing() && playingPeak > 0.02, 'Écouter joue la mélodie', playingPeak);
  t.$('#gen-listen').click();
  await t.wait(300);
  const after = await peak(400);   // il ne reste que la queue de réverbération
  t.ok(!A.genPreviewing() && after < playingPeak * 0.15, 'un deuxième clic l’arrête', [playingPeak, after]);

  // Générer : un seul bloc, phrase de 4 accords × 2 mesures, répétée 2 fois.
  t.$('#gen-go').click();
  await t.wait(100);
  const clips = S.tl.tracks.flatMap(tr => tr.clips);
  t.eq(clips.length, 1, 'un seul bloc de notes');
  const c = clips[0];
  t.ok(c.seq?.length >= 8 && c.pat === 32 && c.len === 64 && c.start === 0, 'motif de 8 mesures répété deux fois', [c.seq?.length, c.pat, c.len]);
  t.eq([c.preset, c.cat], ['hardstyle_lead', 'lead'], 'son de la mélodie et catégorie lead');
  const chordPcs = [[5, 8, 0], [1, 5, 8], [3, 7, 10], [0, 4, 7]];   // Fm Db Eb C
  const strong = c.seq.filter(n => n.t % 4 === 0 || n.t % 4 === 2);
  t.ok(strong.length > 0 && strong.every(n => chordPcs[Math.floor(n.t / 8)].includes(n.note % 12)), 'temps forts sur les notes de l’accord',
    strong.map(n => [n.t, n.note % 12]));
  t.ok(c.seq.some(n => n.note % 12 === 4), 'sur do majeur, la mélodie prend le mi bécarre', c.seq.filter(n => n.t >= 24).map(n => n.note % 12));
  t.ok(c.seq.every(n => n.note >= 55 && n.note <= 96 && n.len > 0 && n.t + n.len <= 32 + 1e-6), 'notes dans le registre et dans le motif');

  // Même graine = même mélodie ; nouvelle idée = autre mélodie.
  const chords = A.parseProgression('Fm Db Eb C').chords;
  t.eq(JSON.stringify(A.leadSeq(chords)), JSON.stringify(c.seq), 'même graine : la même mélodie (écoute = ce qui est posé)');
  const seed = S.gen.lead.seed;
  t.$('#gen-idea').click();
  t.ok(S.gen.lead.seed !== seed && JSON.stringify(A.leadSeq(chords)) !== JSON.stringify(c.seq), 'Nouvelle idée tire une autre mélodie');
  A.stopGenPreview();

  // Les quatre styles, aux trois densités.
  for (const style of A.LEAD_STYLES) for (const density of A.LEAD_DENSITIES) {
    const seq = A.generateLead(chords, { style, density, beatsPerChord: 8, seed: 3 });
    t.ok(seq.length >= 4 && seq.every(n => n.t >= 0 && n.t < 32 && Number.isInteger(n.note)), `style ${style}, densité ${density}`, seq.length);
  }
  const dbl = A.generateLead(chords, { seed: 3, double: true }), single = A.generateLead(chords, { seed: 3 });
  t.eq(dbl.length, single.length * 2, 'doublage à l’octave : chaque note a son octave');

  // Lecture dans la timeline avec son propre preset.
  t.$('#tl-play').click();
  t.ok(await t.until(() => [...E.voices.values()].some(v => v.patched), 4000), 'la mélodie joue avec son propre son');
  t.$('#tl-play').click();
  t.ok(await t.until(() => E.voices.size === 0, 4000), 'à l’arrêt, plus aucune voix');

  // Retouche dans le piano roll.
  A.openRoll(c, true);
  t.ok(A.wm.isOpen('roll') && S.roll.clip === c.id, 'le bloc s’ouvre dans le piano roll');
}
