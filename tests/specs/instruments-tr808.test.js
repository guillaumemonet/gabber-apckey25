// TR-808 : fenêtre (même code que la 909), 13 instruments qui sonnent, séquenceur, kits, page de potentiomètres, grille
// de l'APC, voie du mixeur, enregistrement audio dans la timeline ; la 909 n'a pas changé.
export default async function (t, A) {
  const S = A.state, D = A.drum808;
  A.wm.toggle('tr8', true);
  await t.wait(50);
  t.eq(t.$$('#tr8-grid .tr-name').length, 13, '13 instruments');
  t.eq(t.$$('#tr8-grid .tr-cell').length, 13 * 16, '16 pas par instrument');
  t.eq(t.$$('#tr-grid .tr-name').length, 11, 'la 909 garde ses 11 instruments');
  t.ok(t.$$('.strip-name').some(e => e.textContent === 'TR-808'), 'voie TR-808 dans le mixeur');
  const level = t.meter(A.mixer.input('tr8'));
  const peakOver = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, level()); await t.wait(15); } return p; };
  // Chaque instrument sonne.
  const silent = [];
  for (const { id } of A.DRUM_DEFS.tr8.instruments) {
    await t.wait(250);
    D.trigger(id);
    if ((await peakOver(160)) < 0.02) silent.push(id);
  }
  t.eq(silent, [], 'les 13 instruments sonnent');
  // Séquenceur : les pas défilent, ça joue, l'arrêt coupe.
  const steps = [];
  const os = D.onStep; D.onStep = s => { steps.push(s); os(s); };
  t.$('#tr8-play').click();
  const p1 = await peakOver(1000);
  t.ok(D.running && steps.length >= 6, 'les pas défilent', steps.length);
  t.ok(p1 > 0.05, 'le pattern sonne', p1);
  t.$('#tr8-play').click();
  D.onStep = os;
  t.ok(!D.running && !A.drum.running, 'arrêt (la 909 n\'a pas démarré)');
  // Grille : clic sur un pas.
  const cells = t.$$('#tr8-grid .tr-cell');
  t.$$('#tr8-patterns button')[5].click();
  cells[16 * 10 + 3].click();   // cloche, pas 4
  t.eq(S.tr8.pattern, 5, 'pattern 6 choisi');
  t.eq(S.tr8.patterns[5].cb[3], 1, 'le pas de la cloche est posé');
  cells[16 * 10 + 3].click();
  t.eq(S.tr8.patterns[5].cb[3], 2, 'deuxième clic : accent');
  // Kits.
  const sel = t.$('#tr8-pbar .pb-sel');
  sel.value = 'boom';
  sel.dispatchEvent(new Event('change'));
  t.eq([S.tr8.kit, S.tr8.params.bd.drive], ['boom', 0.55], 'kit « Boom saturé » appliqué');
  // Page de potentiomètres.
  A.setPage('tr8');
  A.selectDrumInstr('tr8', 'bd');
  const defs = A.knobDefs('tr8');
  t.ok(/BD/.test(defs[0].label) && defs.length === 8, 'page 808 : BD en K1, 8 potentiomètres', defs[0].label);
  A.turnKnob(2, { value: 0.95 });
  t.eq(S.tr8.params.bd.decay, 0.95, 'K3 : déclin de la grosse caisse');
  t.eq(S.tr8.kit, null, 'le kit devient personnalisé');
  A.turnKnob(7, { value: 0.5 });
  t.near(D.volume, 0.5 * 0.5 * 1.3, 1e-6, 'K8 : volume 808');
  // Grille de l'APC : 13 instruments, puis Accent, Effacer, Muet.
  A.toggleTrMode(true, 'tr8');
  t.ok(A.trMode && A.trTarget === 'tr8' && S.page === 'tr8', 'Maj + PLAY : la grille pilote la 808');
  A.trPad(16 + 6);
  t.eq(S.tr8.sel, 'cp', 'rangée 3 : le clap choisi');
  A.trPad(2);
  t.eq(S.tr8.patterns[S.tr8.pattern].cp[2], 1, 'rangée 1 : pas posé');
  A.trPad(16 + 15);
  t.ok(S.tr8.mutes.cp, 'Muet (après les 13 instruments et Accent, Effacer)');
  A.trPad(16 + 15);
  A.toggleTrMode(false);
  t.ok(!A.trMode, 'retour aux pads');
  // La 909 n'a pas changé.
  t.eq(A.knobDefs('tr').length, 8, 'page 909 intacte');
  t.ok(A.DRUM_DEFS.tr.defaultState().patterns[0].bd[0] === 2, 'patterns de départ de la 909 intacts');
  // Anciennes sauvegardes : pas de 808 -> état par défaut ; un état incomplet est complété.
  t.eq(A.DRUM_DEFS.tr8.mergeState(undefined).kit, 'clean', 'sans sauvegarde : kit 808 propre');
  t.eq(A.DRUM_DEFS.tr8.mergeState({ patterns: [{ bd: new Array(16).fill(1) }], pattern: 99 }).pattern, 0, 'pattern invalide écarté');
  // Enregistrement audio dans la timeline (source TR-808).
  const T = S.tl.tracks;
  for (const tr of T) { tr.arm = false; tr.clips = []; }
  T[0].src = 'tr8'; T[0].arm = true;
  S.tr8.pattern = 0;
  S.tl.playhead = 0;
  await A.tlStartRec();
  await t.wait(1200);
  const ran = D.running;
  await A.tlStopRec();
  t.ok(ran && !D.running, 'la 808 a joué pendant la prise puis s\'est arrêtée');
  t.ok(T[0].clips.some(c => c.sampleId?.startsWith('rec:')), 'un bloc audio est posé sur la piste', T[0].clips.length);
  T[0].arm = false;
}
