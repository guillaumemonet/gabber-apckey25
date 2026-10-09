// Bibliothèque → pad : un son glissé sur un pad remplace son son (mode boucle et tempo pour une boucle) ;
// « Vider la banque » ; une banque de la bibliothèque vidée ne revient pas d'elle-même.
export default async function (t, A) {
  const S = A.state;
  A.wm.toggle('pads', true);
  A.setBank(15);   // banque 16 (Anthems)
  await t.wait(200);
  const search = t.$('#lib-search');
  search.value = 'riff de guitare';
  search.dispatchEvent(new Event('input'));
  const row = await t.until(() => t.$('#lib-list .lib-item'), 3000);
  t.ok(row, 'la recherche trouve le riff de guitare');
  const sid = row.dataset.id;
  const label = row.querySelector('span').textContent;
  const before = S.banks[15][0]?.sampleId;
  const pad = t.$$('#pads .pad').find(p => p.querySelector('.num').textContent === '1');
  const rr = row.getBoundingClientRect(), pr = pad.getBoundingClientRect();
  const at = (x, y) => ({ clientX: x, clientY: y, bubbles: true, button: 0, pointerId: 1 });
  const x0 = rr.left + 10, y0 = rr.top + 5, x1 = pr.left + pr.width / 2, y1 = pr.top + pr.height / 2;
  row.dispatchEvent(new PointerEvent('pointerdown', at(x0, y0)));
  for (let k = 1; k <= 6; k++) window.dispatchEvent(new PointerEvent('pointermove', at(x0 + (x1 - x0) * k / 6, y0 + (y1 - y0) * k / 6)));
  t.ok(pad.classList.contains('dragover'), 'le pad visé se surligne pendant le glisser');
  window.dispatchEvent(new PointerEvent('pointerup', at(x1, y1)));
  const p0 = await t.until(() => (S.banks[15][0]?.sampleId === sid ? S.banks[15][0] : null), 4000);
  t.ok(p0, 'le pad prend le son lâché', [before, S.banks[15][0]?.sampleId, sid]);
  t.ok(p0?.buffer, 'son décodé');
  t.near(p0?.p.mode ?? 0, 1, 0.01, 'une boucle passe en mode boucle');
  t.eq(p0?.bpm, 190, 'tempo de la boucle gardé (calée sur le tempo)');
  t.eq(pad.querySelector('.name').textContent, label, 'le nom du pad suit');
  t.ok(!pad.classList.contains('dragover'), 'surlignage retiré au lâcher');

  // Vider la banque.
  t.$('#bank-clear').click();
  await t.wait(200);
  t.eq(S.banks[15].filter(Boolean).length, 0, 'la banque est vidée');
  t.ok(t.$('#toast').textContent.includes('16'), 'message de confirmation', t.$('#toast').textContent);
  // Redémarrage simulé : la bibliothèque n'y revient pas.
  const added = await A.importLibrary();
  t.eq(S.banks[15].filter(Boolean).length, 0, 'une banque vidée ne se remplit pas toute seule');
  t.eq(added.length, 0, 'aucune banque réinstallée', added);
}
