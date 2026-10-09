// Timeline : annuler / rétablir (boutons, Ctrl+Z, Ctrl+Y, Ctrl+Maj+Z), branche oubliée, Ctrl+Z dans un champ de texte.
export default async function (t, A) {
  const S = A.state;
  const count = () => S.tl.tracks.reduce((n, tr) => n + tr.clips.length, 0);
  const btn = id => t.$(id);
  const h = A.tlHistory;
  t.eq(count(), 0, 'timeline vide au départ');
  t.ok(btn('#tl-undo').disabled && btn('#tl-redo').disabled, 'Annuler / Rétablir désactivés au départ');
  // 1. Générer des nappes, 2. charger la démo, 3. supprimer un bloc.
  A.generatePads();
  await t.wait(50);
  const afterGen = count();
  await A.loadDemo();
  await t.wait(50);
  const afterDemo = count();
  const tr = S.tl.tracks.findIndex(x => x.clips.length);
  A.tlDelete(tr, S.tl.tracks[tr].clips[0]);
  await t.wait(50);
  t.ok(afterGen > 0, 'le générateur pose des blocs', afterGen);
  t.ok(afterDemo > afterGen, 'la démo remplace la timeline', afterDemo);
  t.eq(count(), afterDemo - 1, 'un bloc supprimé');
  t.eq(S.tl.bars, 50, 'la démo fait 50 mesures');
  t.eq(h.past.length, 3, 'trois étapes dans l\'historique');
  t.ok(!btn('#tl-undo').disabled, 'Annuler activé');
  const key = (k, shift = false) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, ctrlKey: true, shiftKey: shift, bubbles: true }));
  key('z'); await t.wait(30);
  t.eq(count(), afterDemo, 'Ctrl+Z : le bloc supprimé revient');
  key('z'); await t.wait(30);
  t.eq(count(), afterGen, 'Ctrl+Z : retour avant la démo');
  t.eq(S.tl.bars, 32, 'la longueur du morceau revient aussi');
  btn('#tl-undo').click(); await t.wait(30);
  t.eq(count(), 0, 'bouton Annuler : retour au début');
  t.ok(!h.canUndo && btn('#tl-undo').disabled, 'plus rien à annuler');
  key('y'); await t.wait(30);
  t.eq(count(), afterGen, 'Ctrl+Y rétablit');
  key('z', true); await t.wait(30);
  t.eq(count(), afterDemo, 'Ctrl+Maj+Z rétablit');
  btn('#tl-redo').click(); await t.wait(30);
  t.eq(count(), afterDemo - 1, 'bouton Rétablir');
  t.ok(!h.canRedo && btn('#tl-redo').disabled, 'plus rien à rétablir');
  // Une nouvelle modification après un retour en arrière efface la suite.
  key('z'); await t.wait(30);
  A.generatePads(); await t.wait(30);
  t.ok(!h.canRedo, 'une nouvelle modification oublie ce qui avait été annulé');
  // Ctrl+Z dans un champ de texte ne touche pas la timeline.
  const inp = t.$('#gen input[type=text]') || t.$('#lib-search');
  inp.focus();
  const before = count();
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
  await t.wait(30);
  t.eq(count(), before, 'Ctrl+Z dans un champ de texte ne touche pas la timeline');
}
