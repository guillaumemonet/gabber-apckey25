// Potentiomètres : rangée sous les pads (molette, potentiomètres physiques de l'APC), potentiomètres de la TR-909, page de l'APC
// qui suit la fenêtre active, page EQ choisie dans l'en-tête.
const wheel = (el, up = true) => el.dispatchEvent(new WheelEvent('wheel', { deltaY: up ? -100 : 100, bubbles: true, cancelable: true }));
const knob = (A, index, value) => A.apc.dispatchEvent(new CustomEvent('knob', { detail: { index, value } }));

export default async function (t, A) {
  const S = A.state;
  // --- Pads ---
  A.setBank(6);
  A.selectPad(0);
  A.wm.toggle('pads', true);
  await t.wait(100);
  const row = t.$$('#pad-knobs .knob');
  t.eq(row.length, 8, 'rangée de 8 potentiomètres sous les pads');
  t.ok(t.$('#pad-knobs-name').textContent.startsWith('Pad 1'), 'la rangée montre le pad sélectionné', t.$('#pad-knobs-name').textContent);
  t.eq(S.page, 'pad', 'la fenêtre des pads active la page Pad');
  const pad = S.banks[6][0];
  const p0 = pad.p.pitch;
  wheel(row[1]);
  await t.wait(30);
  t.ok(pad.p.pitch > p0, 'la molette monte la hauteur du pad', [p0, pad.p.pitch]);
  t.ok(row[1].querySelector('.value').textContent !== '', 'la valeur affichée suit');
  knob(A, 0, 0.3);
  await t.wait(30);
  t.near(pad.p.volume, 0.3, 0.01, 'potentiomètre K1 de l’APC = volume du pad');
  A.selectPad(5);
  await t.wait(30);
  t.ok(t.$('#pad-knobs-name').textContent.startsWith('Pad 6'), 'changer de pad change la rangée', t.$('#pad-knobs-name').textContent);

  // --- TR-909 : molette sur la décroissance de la grosse caisse ---
  A.wm.toggle('tr', true);
  await t.wait(30);
  const tr = t.$$('#tr-knobs .knob');
  t.ok(tr.length >= 6, 'potentiomètres de la 909', tr.length);
  const d0 = S.tr.params.bd.decay;
  wheel(tr[2]);
  t.ok(S.tr.params.bd.decay !== d0, 'la molette change la décroissance de la grosse caisse', [d0, S.tr.params.bd.decay]);

  // --- La page de l'APC suit la fenêtre active ---
  const expect = { acid: 'acid', tr: 'tr', editor: 'pad' };
  for (const [win, page] of Object.entries(expect)) {
    A.wm.toggle(win, true);
    await t.wait(30);
    t.eq(S.page, page, `fenêtre ${win} active → page ${page}`);
  }
  A.wm.toggle('acid', true);
  await t.wait(30);
  const c0 = S.acid.params.cutoff;
  knob(A, 0, 0.9);
  await t.wait(30);
  t.ok(S.acid.params.cutoff !== c0, 'K1 sur la page TB-303 règle la coupure de la 303', [c0, S.acid.params.cutoff]);

  // --- Page choisie dans l'en-tête : EQ, K8 = gain ---
  const sel = t.$('#apc-page');
  t.ok(sel.options.length > 5, 'menu des pages de potentiomètres', sel.options.length);
  sel.value = 'eq';
  sel.dispatchEvent(new Event('change'));
  knob(A, 7, 0.8);
  await t.wait(30);
  t.eq(S.page, 'eq', 'page EQ choisie');
  t.ok(S.globals.eqGain > 0, 'K8 monte le gain de l’EQ', S.globals.eqGain);
}
