// Presets des générateurs (js/app/tool-presets.js) et barre de titre harmonisée : chaque générateur a sa barre de
// presets (vos réglages), enregistrés puis rappelés ; 📁 / 💾 dans la barre de titre des outils ; boutons Écouter gris,
// action principale orange.
export default async function (t, A) {
  const S = A.state;
  for (const id of A.TOOL_PRESET_KINDS) {
    A.wm.toggle(id, true);
    await t.wait(40);
    t.ok(t.$(`#${id}-pbar .pb-sel`) && t.$(`#${id}-pbar .pb-cat`).hidden, `${id} : barre de presets (une seule catégorie : vos réglages)`);
    t.eq(t.$$(`[data-win="${id}"] .win-file`).length, 2, `${id} : 📁 / 💾 dans la barre de titre`);
    A.wm.toggle(id, false);
  }
  // Designer de montée : enregistrer un preset, changer un réglage, le rappeler.
  A.wm.toggle('buildup', true);
  await t.wait(40);
  S.buildup.bars = 16;
  S.buildup.snare = false;
  const wrap = t.$('#buildup-pbar');
  wrap.querySelector('.pb-name').value = 'Montée longue';
  wrap.querySelector('.pb-save').click();
  t.eq(S.toolPresets.buildup.map(p => p.name), ['Montée longue'], 'preset enregistré');
  S.buildup.bars = 4;
  S.buildup.snare = true;
  const sel = wrap.querySelector('.pb-sel');
  sel.value = S.toolPresets.buildup[0].id;
  sel.dispatchEvent(new Event('change'));
  await t.wait(30);
  t.eq([S.buildup.bars, S.buildup.snare], [16, false], 'preset rappelé : les réglages reviennent');
  t.ok(/16/.test(t.$('#buildup select[data-key="bars"]').value), 'la fenêtre affiche les réglages rappelés');
  t.eq(JSON.parse(JSON.stringify(A.stateSnapshot().toolPresets)).buildup[0].name, 'Montée longue', 'enregistré avec le projet');
  t.eq(A.cleanToolPresets({ buildup: [{ id: 'x' }], gen: 'n' }).buildup, [], 'presets invalides écartés');
  wrap.querySelector('.pb-del').click();
  t.eq(S.toolPresets.buildup.length, 0, 'corbeille : supprimé');
  A.wm.toggle('buildup', false);
  // Boutons : Écouter en gris, l'action principale en orange.
  for (const id of ['kick-play', 'curve-play', 'osc-test', 'roll-play', 'ed-load']) t.ok(!t.$(`#${id}`).classList.contains('primary'), `${id} : bouton gris`);
  for (const id of ['gen-go', 'breizh-go', 'bu-go', 'voice-go']) t.ok(t.$(`#${id}`).classList.contains('primary') && t.$(`#${id}`).dataset.icon, `${id} : bouton principal avec icône`);
}
