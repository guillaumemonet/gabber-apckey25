// « Envoyer vers… » (menu d'un bloc, js/app/send-to.js) : grille du lanceur ou d'une banque de pads (disposition de
// l'APC), case choisie ; un son entier va tel quel sur le pad, un bloc de notes est rendu en audio ; annuler.
export default async function (t, A) {
  const S = A.state;
  for (const tr of S.tl.tracks) tr.clips = [];
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const beat = find('Mainstream beat');
  const audio = { id: 'c-a', start: 0, len: 8, sampleId: 'lib:' + beat.file, name: 'Beat', cat: beat.cat, color: 1, bpm: beat.bpm || 0, loop: true };
  const notes = { id: 'c-n', type: 'note', preset: 'hardstyle_lead', cat: 'lead', color: 5, start: 8, len: 4, loop: false, name: 'Lead',
    seq: [0, 1, 2, 3].map(i => ({ t: i, len: 1, note: 60 + i, vel: 0.9 })), pat: 4 };
  // Blocs passés au format enregistré (comme après un chargement) : Annuler retrouve exactement cet état.
  S.tl.tracks[0] = A.cleanTrack({ ...S.tl.tracks[0], clips: [audio, notes] });
  const [clipA, clipN] = S.tl.tracks[0].clips;
  await A.loadTlBuffers();
  A.renderTl();
  A.save();

  // Menu du bloc : « Envoyer vers… » ouvre la grille.
  A.openClipMenu(0, clipA, 200, 200);
  const item = [...document.querySelectorAll('.clip-menu .cm-item')].find(b => /Envoyer vers|Send to/.test(b.textContent));
  t.ok(item, 'menu du bloc : Envoyer vers…');
  item.click();
  await t.wait(30);
  t.eq(t.$$('.send-menu .send-cell').length, 40, 'grille de 8 × 5');
  t.eq(t.$('.send-menu .send-cell').dataset.cell, '32', 'disposition de l’APC : en haut à gauche, le pad 33');

  // Banque 12, pad 1 (en bas à gauche) : le son entier, tel quel, en boucle.
  const before = [S.banks[11][0]?.name ?? null, S.banks[11][7]?.name ?? null, S.banks[11][2]?.name ?? null];
  const bank = t.$('.send-menu .send-bank');
  bank.value = '11'; bank.dispatchEvent(new Event('change'));
  t.$('.send-menu .send-cell[data-cell="0"]').click();
  await t.until(() => S.banks[11][0], 3000);
  const pad = S.banks[11][0];
  t.ok(pad && pad.sampleId === audio.sampleId && pad.name === 'Beat', 'son entier : posé tel quel sur le pad 1 de la banque 12', pad && [pad.sampleId, pad.name]);
  t.eq(Math.round(pad.p.mode * 2), 2, 'une boucle reste une boucle');

  // Effets de la piste : décoché par défaut ; coché, le son est rendu avec eux (même un son entier).
  A.openSendTo(0, clipA, 200, 200);
  t.ok(t.$('.send-menu .send-fx') && !t.$('.send-menu .send-fx').checked, 'Inclure les effets de la piste : décoché par défaut');
  A.closeSendTo();
  const wet = await A.sendToPad(0, clipA, 11, 2, { fx: true });
  t.ok(wet && wet.sampleId.startsWith('rec:'), 'effets inclus : le son est rendu avec la piste', wet?.sampleId);
  // Un bloc de notes : rendu en audio.
  const sent = await A.sendToPad(0, clipN, 11, 7);
  t.ok(sent && sent.sampleId.startsWith('rec:') && sent.buffer.duration > 1, 'bloc de notes : rendu en audio sur le pad 8', sent && [sent.sampleId, sent.buffer.duration]);

  // Lanceur : case choisie.
  A.openSendTo(0, clipN, 200, 200);
  t.$$('.send-menu .send-tabs button').find(b => b.dataset.target === 'launcher').click();
  t.$('.send-menu .send-cell[data-cell="2:5"]').click();
  t.eq(S.launcher.slots[2][5]?.name, 'Lead', 'lanceur : ligne 3, colonne 6');

  // Annuler : pads et lanceur reviennent comme avant.
  A.tlUndo(); A.tlUndo(); A.tlUndo(); A.tlUndo();
  await t.wait(50);
  t.eq([S.banks[11][0]?.name ?? null, S.banks[11][7]?.name ?? null, S.banks[11][2]?.name ?? null, S.launcher.slots[2][5]], [...before, null], 'Ctrl+Z : pads et lanceur reviennent comme avant');
  for (const tr of S.tl.tracks) tr.clips = [];
}
