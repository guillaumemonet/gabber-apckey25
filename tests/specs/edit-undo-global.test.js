// Annuler au-delà de la timeline : banque vidée, son d'un pad remplacé, pas de la TR-909 et de la TB-303, scène, bus ;
// un son importé n'est plus effacé tout de suite ; tourner un potentiomètre ne crée pas d'étape ; un geste sur un
// curseur d'effet d'insert = une seule étape.
export default async function (t, A) {
  const S = A.state, h = A.tlHistory;
  window.confirm = () => true;
  const b = S.banks.findIndex(bk => bk.some(p => p?.sampleId?.startsWith('lib:anthem-drums/')));
  A.setBank(b);
  await t.until(() => A.bankLoaded(b), 15000);
  A.save();
  const ids = () => S.banks[b].map(p => p?.sampleId ?? null);
  const before = ids();

  // Vider la banque, puis Annuler.
  A.clearBank();
  t.ok(S.banks[b].every(p => !p), 'banque vidée');
  A.tlUndo();
  await t.wait(50);
  t.eq(ids(), before, 'Annuler : la banque revient');
  t.ok(await t.until(() => S.banks[b].filter(Boolean).every(p => p.buffer), 10000), 'avec ses sons, rechargés');

  // Remplacer le son d'un pad (bibliothèque), puis Annuler : l'ancien revient, ses potentiomètres restent.
  S.banks[b][0].p.vol = 0.33;
  A.save();
  const lib = A.libManifest.banks.find(x => x.name !== S.banks[b][0].name).pads.find(Boolean);
  await A.loadItemIntoPad({ sampleId: 'lib:' + lib.file, name: lib.name, cat: lib.cat, bpm: lib.bpm || 0, loop: lib.mode === 2 }, 0);
  t.eq(S.banks[b][0].sampleId, 'lib:' + lib.file, 'son du pad remplacé');
  A.tlUndo();
  await t.wait(50);
  t.eq(S.banks[b][0].sampleId, before[0], 'Annuler : l’ancien son revient');

  // Un son importé n'est pas effacé quand on vide son pad (Annuler doit pouvoir le ramener).
  await A.store.saveSample('user:undo-test', { name: 'Test', data: new ArrayBuffer(8) });
  S.banks[b][1] = { name: 'Test', color: 5, sampleId: 'user:undo-test', bpm: 0, p: A.defaultPositions('pad'), buffer: null };
  A.save();
  A.selectPad(1);
  A.clearPad(1);
  t.ok(await A.store.loadSample('user:undo-test'), 'son importé gardé après avoir vidé son pad');
  A.tlUndo();
  await t.wait(50);
  t.eq(S.banks[b][1]?.sampleId, 'user:undo-test', 'Annuler : il revient sur son pad');

  // TR-909 : un pas, puis Annuler.
  A.wm.toggle('tr', true);
  const pat = () => JSON.stringify(S.tr.patterns[S.tr.pattern]);
  const tr0 = pat();
  t.$$('#tr-grid .tr-cell')[1].click();
  t.ok(pat() !== tr0, 'pas de la 909 modifié');
  A.tlUndo();
  await t.wait(30);
  t.eq(pat(), tr0, 'Annuler : le pattern de la 909 revient');

  // TB-303 : une case, puis Annuler.
  A.wm.toggle('acid', true);
  const ac0 = JSON.stringify(S.acid.patterns);
  t.$$('#acid-grid .acid-cell')[3].click();
  t.ok(JSON.stringify(S.acid.patterns) !== ac0, 'case de la 303 modifiée');
  A.tlUndo();
  await t.wait(30);
  t.eq(JSON.stringify(S.acid.patterns), ac0, 'Annuler : le pattern de la 303 revient');

  // Scène enregistrée, puis Annuler.
  A.captureScene(7);
  A.save();
  t.ok(S.scenes[7], 'scène 8 enregistrée');
  A.tlUndo();
  await t.wait(30);
  t.ok(!S.scenes[7], 'Annuler : la scène disparaît');

  // Bus : un effet d'insert, puis Annuler.
  A.wm.toggle('buses', true);
  const add = t.$$('#buses .fx-add')[0];
  add.value = 'eq'; add.dispatchEvent(new Event('change'));
  t.eq(S.tl.buses[0].inserts.length, 1, 'insert ajouté au bus A');
  A.tlUndo();
  await t.wait(30);
  t.eq(S.tl.buses[0].inserts.length, 0, 'Annuler : l’insert du bus disparaît');

  // Tourner un potentiomètre ne crée pas d'étape d'annulation.
  const n0 = h.past.length;
  A.setPage('pad');
  for (let i = 0; i < 10; i++) A.turnKnob(0, { delta: 1 });
  A.save();
  t.eq(h.past.length, n0, 'les potentiomètres ne remplissent pas l’historique');
  // Un geste sur un curseur d'insert : une seule étape (au lâcher).
  add.value = 'eq'; add.dispatchEvent(new Event('change'));
  const n1 = h.past.length;
  const slider = t.$$('#buses .fx-list input[type=range]')[0];
  for (const v of [1, 2, 3, 4, 5]) { slider.value = v; slider.dispatchEvent(new Event('input')); }
  t.eq(h.past.length, n1, 'pendant le geste : pas d’étape');
  slider.dispatchEvent(new Event('change'));
  t.eq(h.past.length, n1 + 1, 'au lâcher : une seule étape');
}
