// Fenêtre Banques (js/app/banks-ui.js) : liste des 25 banques (nom automatique ou le sien), grille de la banque
// choisie (disposition de l'APC), échanger / copier deux pads en les glissant, déplacer un pad dans une autre banque,
// dupliquer, renommer, sauvegarde, annuler.
export default async function (t, A) {
  const S = A.state;
  A.wm.toggle('banks', true);
  await t.wait(30);
  t.eq(t.$$('#bank-mgr .bm-bank').length, 25, 'les 25 banques');
  t.eq(t.$$('#bank-mgr .bm-pad').length, 40, 'les 40 pads de la banque');
  t.eq(t.$('#bank-mgr .bm-pad').dataset.pad, '32', 'disposition de l’APC : en haut à gauche, le pad 33');
  const lib = S.banks.findIndex(b => b.some(p => p?.sampleId?.startsWith('lib:')));
  t.ok(lib >= 0 && A.bankName(lib), 'une banque de la bibliothèque prend son nom', A.bankName(lib));

  // Banque de travail : la 20 (vidée), deux pads.
  const B = 19;
  t.$(`#bank-mgr .bm-bank[data-bank="${B}"]`).click();
  t.eq(A.mgrBank(), B, 'banque affichée');
  S.banks[B] = new Array(40).fill(null);
  const mk = (name, color) => A.newPad(name, color, S.banks[lib].find(Boolean).sampleId, null);
  S.banks[B][0] = mk('Un', 5);
  S.banks[B][1] = mk('Deux', 9);
  A.renderBankMgr();
  A.save();
  const drop = (from, to, alt = false) => {
    const dt = new DataTransfer();
    from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
    to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
    to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, altKey: alt }));
  };
  const cell = i => t.$(`#bank-mgr .bm-pad[data-pad="${i}"]`);
  drop(cell(0), cell(1));
  t.eq([S.banks[B][0]?.name, S.banks[B][1]?.name], ['Deux', 'Un'], 'glisser un pad sur un autre : échangés');
  drop(cell(1), cell(10), true);
  t.eq([S.banks[B][1]?.name, S.banks[B][10]?.name], ['Un', 'Un'], 'Alt + glisser : copié');
  S.banks[B + 1] = new Array(40).fill(null);
  drop(cell(10), t.$(`#bank-mgr .bm-bank[data-bank="${B + 1}"]`));
  t.eq([S.banks[B][10], S.banks[B + 1][0]?.name], [null, 'Un'], 'glisser sur une autre banque : déplacé au premier pad libre');

  // Renommer la banque, dupliquer.
  const name = t.$('#bank-mgr .bm-name');
  name.value = 'Mes kicks'; name.dispatchEvent(new Event('input'));
  t.eq(A.bankName(B), 'Mes kicks', 'banque renommée');
  t.ok(/Mes kicks/.test(t.$(`#bank-mgr .bm-bank[data-bank="${B}"]`).textContent), 'nom affiché dans la liste');
  const to = A.duplicateBank(B);
  t.ok(to >= 0 && S.banks[to][0]?.name === 'Deux' && S.banks[to][0] !== S.banks[B][0], 'Dupliquer : une copie dans une banque vide', to);
  t.eq(JSON.parse(JSON.stringify(A.stateSnapshot().bankNames))[B], 'Mes kicks', 'noms enregistrés avec le projet');
  t.eq(A.cleanBankNames(null).length, 25, 'ancienne sauvegarde : noms automatiques');

  // Annuler : la copie disparaît.
  A.tlUndo();
  await t.wait(30);
  t.ok(!S.banks[to].some(Boolean), 'Ctrl+Z : la banque dupliquée est de nouveau vide');
  for (const b of [B, B + 1, to]) S.banks[b] = new Array(40).fill(null);
  S.bankNames[B] = '';
  A.wm.toggle('banks', false);
}
