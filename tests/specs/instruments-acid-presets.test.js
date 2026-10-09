// Presets de la TB-303 : catégories, preset fourni, potard qui rend le son perso, preset perso enregistré dans une
// catégorie, rechargé puis supprimé ; potard Slide ; fichiers de réglages avec les presets perso.
export default async function (t, A) {
  const S = A.state;
  t.near(S.acid.params.slide, 0.46, 0.01, 'Slide : valeur par défaut');
  A.wm.toggle('acid', true);
  const sel = t.$('#acid-presets .pb-sel');
  const groups = [...sel.querySelectorAll('optgroup')];
  t.eq(groups.length, 4, '4 catégories (Acid, Basse, Lead, FX)');
  t.eq(groups.reduce((n, g) => n + g.children.length, 0), 15, '15 sons fournis');
  sel.value = 'screamer'; sel.dispatchEvent(new Event('change'));
  t.eq(S.acid.sound, 'screamer', 'preset Screamer chargé');
  t.ok(A.acid.f1.Q.value > 5, 'le filtre de la 303 suit (résonance forte)', A.acid.f1.Q.value);
  t.$$('#acid-knobs .knob')[1].dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  t.eq(S.acid.sound, null, 'tourner un potard rend le son perso');
  t.eq(sel.value, '', 'le menu n’affiche plus de preset');
  t.$('#acid-presets .pb-name').value = 'Mon screamer';
  t.$('#acid-presets .pb-cat').value = 'lead';
  t.$('#acid-presets .pb-save').click();
  t.eq(S.acid.user.length, 1, 'preset perso enregistré');
  t.eq(S.acid.user[0]?.cat, 'lead', 'dans la catégorie Lead');
  t.ok(S.acid.sound?.startsWith('u:'), 'il devient le son courant');
  t.ok([...sel.querySelectorAll('optgroup')].some(g => g.textContent.includes('Mon screamer')), 'il apparaît dans le menu');
  const reso = S.acid.params.reso;
  sel.value = 'sub'; sel.dispatchEvent(new Event('change'));
  t.ok(S.acid.params.reso !== reso, 'un autre preset change les réglages');
  sel.value = S.acid.user[0].id; sel.dispatchEvent(new Event('change'));
  t.near(S.acid.params.reso, reso, 1e-6, 'recharger le preset perso rend ses réglages');
  t.$('#acid-presets .pb-del').click();
  t.eq(S.acid.user.length, 0, 'suppression');
  t.ok(A.acid.p('slide') > 0.02 && A.acid.p('slide') < 0.3, 'durée de glissé raisonnable (s)', A.acid.p('slide'));
  t.ok('user' in A.TOOL_IO.acid.get().acid, 'les fichiers de réglages TB-303 emportent les presets perso');
}
