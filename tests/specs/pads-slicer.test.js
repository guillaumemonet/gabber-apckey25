// Découpeur de breaks : coups trouvés sur un break fabriqué (positions connues), parts égales, repères ajoutés /
// enlevés, tranches sur les pads, motif d'origine dans le séquenceur, menu d'un bloc audio, réglages invalides.
export default async function (t, A) {
  const S = A.state, ctx = A.engine.ctx, sr = ctx.sampleRate;
  // Un break de 2 s à 120 BPM (1 mesure) : 8 coups (bruit qui décroît) toutes les croches, d'intensités variées.
  const hitsAt = [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75];
  const buf = ctx.createBuffer(2, sr * 2, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.002;
    hitsAt.forEach((at, k) => {
      const a = Math.round(at * sr), amp = [0.9, 0.4, 0.7, 0.35, 0.9, 0.5, 0.7, 0.45][k];
      for (let i = 0; i < sr * 0.2; i++) d[a + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (sr * 0.03));
    });
  }
  A.bufferCache.set('rec:test-break', buf);
  t.ok(await A.openSlicer({ sampleId: 'rec:test-break', name: 'Break test', bpm: 120 }), 'son chargé');
  await t.wait(80);
  t.ok(A.wm.isOpen('slicer'), 'la fenêtre s\'ouvre');
  const sl = S.slicer;
  t.eq(sl.slices.length, 8, '8 coups trouvés', sl.slices.map(v => v.toFixed(3)));
  t.ok(sl.slices.every((v, k) => Math.abs(v - hitsAt[k]) < 0.012), 'chacun juste avant son attaque (< 12 ms)', sl.slices.map(v => v.toFixed(3)));
  t.ok(/8 tranches · 1 mesure/.test(t.$('#sl-info').textContent), 'nombre de tranches et de mesures affiché', t.$('#sl-info').textContent);
  // Parts égales.
  t.$('#sl-mode [data-mode="grid"]').click();
  t.eq(sl.slices.length, 16, '16 parts égales');
  t.near(sl.slices[1], 0.125, 1e-9, 'de même longueur');
  t.$('#sl-mode [data-mode="onset"]').click();
  // Repères : ajouter, enlever (le premier reste).
  A.addSlice(0.6);
  t.eq(sl.slices.length, 9, 'repère ajouté');
  A.removeSlice(sl.slices.findIndex(v => Math.abs(v - 0.6) < 0.01));
  A.removeSlice(0);
  t.eq(sl.slices.length, 8, 'repère enlevé ; le premier reste');
  // Vers les pads : un pad par tranche, du début de la tranche au début de la suivante.
  const b = 20;
  const pads = A.slicesToPads(b, 4);
  t.eq(pads, [4, 5, 6, 7, 8, 9, 10, 11], 'pads 5 à 12');
  t.ok(S.banks[b][4].name === 'Break test 1' && S.banks[b][11].name === 'Break test 8', 'nommés d\'après le son');
  t.near(S.banks[b][5].buffer.duration, sl.slices[2] - sl.slices[1], 0.002, 'chaque tranche va jusqu\'à la suivante');
  t.eq(A.slicesToPads(b, 36), null, 'pas assez de place après le pad 37 : refusé');
  // Vers le séquenceur : le motif d'origine dans un pattern libre.
  for (const p of S.seq.patterns.slice(2)) p.rows = [];
  S.seq.pattern = 1;
  for (const r of S.seq.patterns[1].rows) r.steps.fill(0);
  const k = A.slicesToSeq(21, 0);
  const pat = S.seq.patterns[k];
  t.eq(k, 1, 'pattern libre choisi (le pattern 2, vide)');
  t.eq(pat.len, 16, '1 mesure : 16 pas');
  t.eq(pat.rows.map(r => r.steps.findIndex(Boolean)), [0, 2, 4, 6, 8, 10, 12, 14], 'chaque tranche sur son pas (une croche = 2 pas)');
  t.ok(pat.rows.every((r, i) => r.bank === 21 && r.pad === i), 'les lignes jouent les pads des tranches');
  t.ok(A.wm.isOpen('seq'), 'le séquenceur s\'ouvre');
  // Au tempo du projet : la boucle suit sans changer de hauteur (les tranches ne sont pas accélérées).
  t.eq(S.banks[21][0].buffer.sampleRate, sr, 'tranches à la fréquence du son');
  // Menu d'un bloc audio : « Découper ».
  const T = S.tl.tracks;
  T[5].clips = [{ id: 'cut-me', start: 0, len: 4, sampleId: 'rec:test-break', name: 'Break bloc', bpm: 120, loop: false }];
  A.renderTl();
  A.openClipMenu(5, T[5].clips[0], 100, 100);
  const item = t.$$('.clip-menu .cm-item').find(e => e.dataset.icon === 'slice');
  t.ok(item, 'le menu d\'un bloc audio propose de le découper');
  item?.click();
  await t.wait(50);
  t.eq(S.slicer.name, 'Break bloc', 'le son du bloc est dans le découpeur');
  T[5].clips = [];
  A.renderTl();
  // Un vrai break (amen de la bibliothèque, 1 mesure) : ses coups, chacun sur un pas différent.
  const amen = A.libManifest.banks.flatMap(b => b.pads).find(x => x?.file === 'bank3/loop_amen.flac');
  await A.openSlicer({ sampleId: 'lib:bank3/loop_amen.flac', name: 'Amen', bpm: amen?.bpm ?? 0 });
  const steps = A.slicerBars() ? sl.slices.map(v => Math.round(v / (60 / sl.bpm / 4))) : [];
  t.ok(sl.slices.length >= 7 && sl.slices.length <= 18, 'amen : entre 7 et 18 coups', `${sl.slices.length} coups, ${A.slicerBars().toFixed(2)} mesure(s), pas ${steps}`);
  t.ok(new Set(steps).size >= sl.slices.length - 1, 'presque un coup par pas', steps);
  // Réglages invalides.
  const { mergeSlicer } = await import('/js/slicer.js');
  const m = mergeSlicer({ mode: 'x', grid: 7, sens: 3, slices: [0.5, 'a', 0.1], bpm: -2 });
  t.eq([m.mode, m.grid, m.sens, m.slices, m.bpm], ['onset', 16, 1, [0.1, 0.5], 0], 'valeurs invalides écartées, repères triés');
}
