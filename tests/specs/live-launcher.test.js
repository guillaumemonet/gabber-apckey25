// Lanceur de clips : cases remplies (bibliothèque, « Envoyer au lanceur »), lancement, changement à la mesure suivante,
// ligne entière, tout arrêter, grille de l'APC (pads, SCENE LAUNCH, STOP ALL), Panique, annuler, sauvegarde.
export default async function (t, A) {
  const S = A.state, E = A.engine;
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const item = name => { const p = find(name); return { sampleId: 'lib:' + p.file, name: p.name, cat: p.cat, bpm: p.bpm || 0, loop: p.mode === 2, bars: 0 }; };
  S.tl.tracks.forEach(tr => { tr.clips = []; tr.fx = []; tr.mute = false; tr.solo = false; });
  S.sc.on = false;
  A.save();
  A.wm.toggle('launcher', true);
  t.eq(t.$$('#launcher .ln-slot').length, 40, '8 colonnes × 5 lignes');
  t.eq(t.$$('#launcher .ln-row').length, 5, 'un bouton par ligne');

  await A.slotFromLibrary(0, 0, item('Mainstream beat'));
  await A.slotFromLibrary(1, 0, item('Breakdown pad'));
  await A.slotFromLibrary(1, 1, item('Mainstream beat'));
  t.ok(S.launcher.slots[0][0] && S.launcher.slots[1][0] && S.launcher.slots[1][1], 'cases remplies depuis la bibliothèque');
  t.ok(t.$('#launcher .ln-slot[data-row="0"][data-col="0"]').classList.contains('full'), 'case affichée');

  // Lancer : rien ne joue, la case part tout de suite.
  const level = t.meter(E.output);
  const peak = async ms => { let p = 0; const t0 = performance.now(); while (performance.now() - t0 < ms) { p = Math.max(p, level()); await t.wait(20); } return p; };
  t.$('#launcher .ln-slot[data-row="0"][data-col="0"]').click();
  t.ok(await t.until(() => A.lnPlaying(0) === 0, 2000), 'la case 1 de la colonne 1 joue');
  t.ok((await peak(600)) > 0.03, 'on l’entend');
  // Changer de case dans la colonne : à la mesure suivante.
  const bar = 240 / S.bpm;
  t.$('#launcher .ln-slot[data-row="1"][data-col="0"]').click();
  await t.wait(30);
  t.eq(A.lnPlaying(0), 0, 'en attente de la mesure : l’ancienne case joue encore');
  t.ok(await t.until(() => A.lnPlaying(0) === 1, bar * 1000 + 800), 'à la mesure suivante : la nouvelle case joue');

  // Ligne entière, puis tout arrêter.
  t.$$('#launcher .ln-row')[1].click();
  t.ok(await t.until(() => A.lnPlaying(1) === 1, bar * 1000 + 800), 'Ligne 2 : la colonne 2 démarre aussi');
  t.$('#ln-stop-all').click();
  t.ok(await t.until(() => A.lnPlaying(0) === null && A.lnPlaying(1) === null, bar * 1000 + 800), 'Tout arrêter : plus rien ne joue');

  // Envoyer au lanceur depuis un bloc de la timeline.
  const p = find('Breakdown pad');
  S.tl.tracks[2].clips.push({ id: 'c-ln', start: 0, len: 8, sampleId: 'lib:' + p.file, name: p.name, cat: p.cat, color: 1, bpm: p.bpm || 0, loop: true });
  A.renderTl();
  t.$$('#tl-grid .tl-clip').find(e => e._obj?.id === 'c-ln').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 600, clientY: 400 }));
  [...t.$$('.clip-menu .cm-item')].find(b => b.dataset.icon === 'grid').click();
  t.eq(S.launcher.slots[0][2]?.name, p.name, 'Envoyer au lanceur : colonne de sa piste, première case libre');

  // Grille de l'APC.
  t.$('#ln-mode').click();
  t.ok(A.launcherMode, 'grille APC = lanceur');
  const pad = i => { A.apc.dispatchEvent(new CustomEvent('pad', { detail: { index: i, pressed: true } })); A.apc.dispatchEvent(new CustomEvent('pad', { detail: { index: i, pressed: false } })); };
  const btn = name => { A.apc.dispatchEvent(new CustomEvent('button', { detail: { name, pressed: true } })); A.apc.dispatchEvent(new CustomEvent('button', { detail: { name, pressed: false } })); };
  pad(32 + 2);   // rangée du haut de l'APC = ligne 1, colonne 3
  t.ok(await t.until(() => A.lnPlaying(2) === 0, 2000), 'pad de l’APC : la case démarre');
  btn('scene2');
  t.ok(await t.until(() => A.lnPlaying(0) === 1 && A.lnPlaying(1) === 1, bar * 1000 + 800), 'SCENE LAUNCH 2 : la ligne 2 démarre');
  t.eq(S.bank, S.bank, 'la banque ne change pas en mode lanceur');
  btn('stopAll');
  t.ok(await t.until(() => [0, 1, 2].every(c => A.lnPlaying(c) === null), bar * 1000 + 800), 'STOP ALL : tous les clips s’arrêtent');
  t.$('#ln-mode').click();

  // Panique : tout s'arrête tout de suite.
  t.$('#launcher .ln-slot[data-row="0"][data-col="0"]').click();
  await t.until(() => A.lnPlaying(0) === 0, 2000);
  A.panic();
  t.eq(A.lnPlaying(0), null, 'Panique coupe le lanceur');

  // Vider une case (clic droit), Annuler.
  t.$('#launcher .ln-slot[data-row="0"][data-col="2"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  t.eq(S.launcher.slots[0][2], null, 'clic droit : case vidée');
  A.tlUndo();
  await t.wait(50);
  t.ok(S.launcher.slots[0][2], 'Ctrl+Z : la case revient');
  t.ok(A.stateSnapshot().launcher.slots[1][1], 'cases enregistrées avec le projet');
}
