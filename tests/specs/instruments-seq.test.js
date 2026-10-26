// Séquenceur pas à pas : lignes de pads, pas (clic, glisser), lecture qui joue les pads, longueur 16 / 32 / 64,
// changement de pattern à la fin du pattern, lignes ajoutées / changées / enlevées, pose sur la timeline, enregistrement
// (source « Séquenceur pas à pas »), scènes, sauvegardes invalides.
export default async function (t, A) {
  const S = A.state, Q = A.stepSeq;
  A.wm.toggle('seq', true);
  await t.wait(50);
  const p = () => S.seq.patterns[S.seq.pattern];
  t.eq(p().rows.length, 8, 'pattern de départ : 8 lignes (sons de la banque 1)');
  t.eq(t.$$('#seq-grid .tr-cell').length, 8 * 16, '16 pas par ligne');
  t.ok(p().rows[0].steps[0] === 2 && p().rows[1].steps[4] === 1, 'un motif de départ');
  // Clic puis glisser : la même valeur se peint.
  const cell = (r, s) => t.$(`#seq-grid .tr-cell[data-r="${r}"][data-s="${s}"]`);
  cell(2, 1).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
  for (const s of [2, 3]) cell(2, s).dispatchEvent(new PointerEvent('pointerenter'));
  window.dispatchEvent(new PointerEvent('pointerup'));
  cell(2, 5).dispatchEvent(new PointerEvent('pointerenter'));
  t.eq(p().rows[2].steps.slice(0, 6), [0, 1, 1, 1, 0, 0], 'clic puis glisser : trois pas posés, rien après le relâchement');
  t.ok(cell(2, 2).classList.contains('on'), 'la grille les montre');
  // Lecture : les pads jouent, sur la voie des pads.
  await A.loadSeqPads();
  const level = t.meter(A.mixer.input('pads'));
  const hits = [];
  const oh = Q.onHit; Q.onHit = (row, time, vel) => { hits.push({ pad: row.pad, vel }); oh(row, time, vel); };
  t.$('#seq-play').click();
  let peak = 0;
  for (let i = 0; i < 50; i++) { peak = Math.max(peak, level()); await t.wait(20); }
  t.ok(Q.running && hits.length >= 4, 'les coups partent', hits.length);
  t.ok(hits.some(h => h.pad === 0 && h.vel === 1), 'le kick accentué', hits.slice(0, 4));
  t.ok(peak > 0.05, 'les pads sonnent', peak);
  // Changement de pattern pendant la lecture : il attend la fin du pattern.
  t.$$('#seq-patterns button')[1].click();
  t.ok(Q.queued === 1 && S.seq.pattern === 0, 'pattern 2 en attente');
  await t.until(() => S.seq.pattern === 1, 4000);
  t.eq(S.seq.pattern, 1, 'pattern 2 en place à la fin du pattern 1');
  t.$('#seq-play').click();
  Q.onHit = oh;
  t.ok(!Q.running, 'arrêt');
  // Longueur : 32 pas recopient la mesure ; pages de 16 pas.
  t.$$('#seq-patterns button')[0].click();
  t.$('#seq-len button[data-len="32"]').click();
  t.eq(p().len, 32, '32 pas');
  t.eq(p().rows[0].steps.slice(16, 20), [2, 0, 0, 0], 'la première mesure est recopiée');
  t.eq(t.$$('#seq-pages button').length, 2, 'deux pages');
  t.$$('#seq-pages button')[1].click();
  t.eq(t.$('#seq-grid .tr-cell').dataset.s, '16', 'la page 2 montre les pas 17 à 32');
  t.eq(Q.length, 32, 'l\'horloge suit la longueur du pattern');
  t.$('#seq-len button[data-len="16"]').click();
  t.eq([p().len, S.seq.page], [16, 0], 'retour à 16 pas, page 1');
  // Lignes : ajouter (pad sélectionné), changer le son, couper, enlever.
  S.selected = 12;
  t.$('#seq-add').click();
  t.eq(p().rows.length, 9, 'ligne ajoutée');
  t.eq([p().rows[8].bank, p().rows[8].pad], [S.bank, 12], 'avec le pad sélectionné');
  t.$$('#seq-grid .seq-tool[data-icon="pads"]')[8].click();
  t.ok(t.$('.send-menu .send-grid'), 'la grille des pads s\'ouvre pour choisir le son');
  t.$$('.send-menu .send-cell')[0].click();
  t.eq(p().rows[8].pad, 32, 'son choisi (case en haut à gauche = pad 33)');
  t.$$('#seq-grid .seq-tool[data-icon="mute"]')[8].click();
  t.ok(p().rows[8].mute, 'ligne coupée');
  t.$$('#seq-grid .seq-tool[data-icon="trash"]')[8].click();
  t.eq(p().rows.length, 8, 'ligne enlevée');
  // Sur la timeline : une piste par ligne qui joue, blocs de pads.
  const T = S.tl.tracks;
  for (const tr of T) { tr.clips = []; tr.arm = false; }
  T[0].arm = true;
  S.tl.playhead = 8;
  const used = p().rows.filter(r => r.steps.some(Boolean));
  const lanes = A.seqToTimeline(2);
  t.eq(lanes?.length, used.length, 'une piste par ligne qui joue', lanes);
  const kicks = T[lanes[0]].clips;
  t.eq(kicks.length, used[0].steps.filter(Boolean).length * 2, 'les coups du kick, deux fois');
  t.ok(kicks.every(c => c.type === 'pad' && c.bank === used[0].bank && c.pad === used[0].pad), 'blocs de pads');
  t.eq(kicks[0].start, 8, 'à partir de la mesure de la tête de lecture');
  t.ok(kicks.every((c, k) => !kicks[k + 1] || c.start + c.len <= kicks[k + 1].start + 1e-9), 'un coup ne chevauche pas le suivant');
  // Enregistrement en jouant : source « Séquenceur pas à pas ».
  for (const tr of T) { tr.clips = []; tr.arm = false; }
  T[0].src = 'seq'; T[0].arm = true;
  S.tl.playhead = 0;
  await A.tlStartRec();
  await t.wait(1300);
  const ran = Q.running;
  await A.tlStopRec();
  t.ok(ran && !Q.running, 'le séquenceur démarre avec l\'enregistrement et s\'arrête avec lui');
  const rec = T.flatMap(tr => tr.clips);
  t.ok(rec.length >= 3 && rec.every(c => c.type === 'pad'), 'ses coups deviennent des blocs de pads', rec.length);
  t.ok(rec.some(c => c.vel < 1), 'les coups non accentués gardent leur force');
  T[0].arm = false; T[0].src = null;
  // Scènes : pattern et lecture.
  t.$$('#seq-patterns button')[3].click();
  A.captureScene(0);
  t.eq(S.scenes[0].seq, { pattern: 3, running: false }, 'la scène retient le pattern du séquenceur');
  // Sauvegardes invalides.
  const { mergeSeqState } = await import('/js/stepseq.js');
  const m = mergeSeqState({ patterns: [{ len: 48, rows: [{ bank: 99, pad: 0 }, { bank: 1, pad: 2, steps: [2, 5, 1] }] }], pattern: 12 });
  t.eq(m.patterns[0].len, 16, 'longueur invalide -> 16');
  t.eq(m.patterns[0].rows.map(r => [r.bank, r.pad]), [[1, 2]], 'ligne invalide écartée');
  t.eq(m.patterns[0].rows[0].steps.slice(0, 3), [2, 0, 1], 'valeurs de pas invalides -> silence');
  t.eq(m.pattern, 0, 'pattern invalide -> 1');
}
