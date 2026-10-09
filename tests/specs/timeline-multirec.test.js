// Timeline : nom, couleur et instrument d'une piste ; enregistrement simultané de plusieurs pistes armées
// (pads -> blocs de pad, synthé -> bloc de notes, TR-909 -> audio) ; sans piste armée, rien ne démarre.
export default async function (t, A) {
  const S = A.state;
  const T = S.tl.tracks;
  // Renommer par double-clic.
  t.$$('.tl-name')[0].dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const inp = t.$('.tl-rename');
  t.ok(inp, 'double-clic sur le nom : champ de saisie');
  inp.value = 'Kicks live';
  inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  // Couleur, instrument et nom par le panneau de la piste 2.
  t.$$('.tl-knobs')[1].click();
  await t.wait(50);
  const box = t.$('.track-knobs');
  box.querySelectorAll('.tk-color')[4].click();
  const sel = box.querySelector('.tk-src'); sel.value = 'synth'; sel.dispatchEvent(new Event('change'));
  const nm = box.querySelector('.tk-name'); nm.value = 'Lead'; nm.dispatchEvent(new Event('input')); nm.dispatchEvent(new Event('change'));
  box.querySelector('.win-close')?.click();
  const heads = t.$$('.tl-head');
  t.eq(heads[0].querySelector('.tl-name').textContent, 'Kicks live', 'piste 1 renommée');
  t.eq(heads[1].querySelector('.tl-name').textContent, 'Lead', 'piste 2 renommée depuis le panneau');
  t.ok(/^#[0-9a-f]{6}$/i.test(T[1].color || ''), 'couleur de piste choisie', T[1].color);
  t.ok(t.$$('.tl-lane')[1].classList.contains('colored'), 'la ligne prend la couleur');
  t.eq(T[1].src, 'synth', 'instrument enregistré : synthé');
  t.ok(!heads[1].querySelector('.tl-src').hidden && heads[1].querySelector('.tl-src').dataset.icon, 'icône de l\'instrument dans l\'en-tête');
  // Trois pistes armées : pads, synthé, TR-909 (audio).
  for (const tr of T) tr.clips = [];
  T[0].src = 'pads'; T[0].arm = true;
  T[1].arm = true;
  T[2].src = 'tr'; T[2].arm = true;
  A.renderTl();
  S.tl.playhead = 0;
  await A.tlStartRec();
  await t.wait(400);
  A.triggerPad(0); await t.wait(300); A.triggerPad(1);
  A.playNote(65, 0.9, true); await t.wait(250); A.playNote(65, 0, false);
  await t.wait(1200);
  const drumRan = A.drum.running;
  await A.tlStopRec();
  await t.until(() => T[2].clips.length, 3000);
  const kinds = i => T[i].clips.map(c => c.type || (c.sampleId?.startsWith('rec:') ? 'audio' : 'sample'));
  const pads = T.flatMap(tr => tr.clips).filter(c => c.type === 'pad');
  t.eq(pads.length, 2, 'un bloc par coup de pad');
  t.ok(kinds(0).length >= 1 && kinds(0).every(k => k === 'pad'), 'piste pads : les coups de pad', kinds(0));
  t.eq(kinds(1), ['note'], 'piste synthé : un bloc de notes (aucun coup de pad débordé)');
  t.eq(kinds(2), ['audio'], 'piste TR-909 : une prise audio (aucun coup de pad débordé)');
  t.ok(T.slice(3).every(tr => tr.clips.every(c => c.type === 'pad')), 'un coup qui chevauche le précédent déborde sur une piste libre', T.slice(3).flatMap(tr => tr.clips.map(c => c.type)));
  t.ok(drumRan && !A.drum.running, 'la 909 a joué pendant la prise puis s\'est arrêtée');
  // Aucune piste armée : un message, rien ne démarre.
  for (const tr of T) tr.arm = false;
  await A.tlStartRec();
  t.ok(!A.timeline.playing && !A.tlRec, 'sans piste armée, l\'enregistrement ne démarre pas');
  t.ok(t.$('#toast')?.textContent, 'un message l\'explique', t.$('#toast')?.textContent);
}
