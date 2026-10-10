// Barres de presets de la TR-909 (kits), du designer de kick, du synthé à couches et du synthé à oscillateurs :
// choisir un preset, tourner un potentiomètre (son perso), enregistrer, recharger, supprimer ; preset perso du synthé.
export default async function (t, A) {
  const S = A.state;
  const bar = id => t.$(`#${id}`);
  const groups = id => [...bar(id).querySelectorAll('optgroup')].length;
  t.eq(S.tr.kit, 'gabber', 'kit 909 par défaut : Gabber');
  t.eq(groups('tr-pbar'), 3, 'kits 909 en 3 catégories');
  t.eq(groups('kick-pbar'), 3, 'kicks en 3 catégories');
  t.eq(groups('osc-pbar'), 4, 'synthé à oscillateurs en 4 catégories');
  const wheel = sel => t.$$(sel)[0].dispatchEvent(new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true }));
  const flow = async (id, knob, name) => {
    const b = bar(id), sel = b.querySelector('.pb-sel');
    const builtins = [...sel.options].filter(o => o.value && !o.value.startsWith('u:'));
    sel.value = builtins[2].value; sel.dispatchEvent(new Event('change'));
    t.eq(sel.value, builtins[2].value, `${id} : preset choisi`);
    knob();
    t.eq(sel.value, '', `${id} : un potentiomètre tourné rend le son perso`);
    b.querySelector('.pb-name').value = name;
    b.querySelector('.pb-save').click();
    const saved = sel.value;
    t.ok(saved.startsWith('u:'), `${id} : preset perso enregistré`, saved);
    sel.value = builtins[0].value; sel.dispatchEvent(new Event('change'));
    sel.value = saved; sel.dispatchEvent(new Event('change'));
    t.eq(sel.value, saved, `${id} : preset perso rechargé`);
    b.querySelector('.pb-del').click();
    t.ok(!sel.value.startsWith('u:'), `${id} : supprimé`, sel.value);
  };
  A.wm.toggle('tr', true);
  await flow('tr-pbar', () => { A.setPage('tr'); A.turnKnob(0, { delta: 5 }); }, 'Mon kit');
  A.wm.toggle('kick', true);
  await flow('kick-pbar', () => wheel('#kick-knobs .knob'), 'Mon kick');
  A.wm.toggle('piano', true);
  await flow('synth-pbar', () => wheel('#synth-knobs .knob'), 'Mon synthé');
  A.wm.toggle('osc', true);
  await flow('osc-pbar', () => { A.setPage('osc'); A.turnKnob(0, { delta: 5 }); }, 'Mon osc');
  // Un preset perso du synthé garde son son de départ et ses potentiomètres.
  const sb = bar('synth-pbar'), sel = sb.querySelector('.pb-sel');
  sel.value = 'thunder_pad'; sel.dispatchEvent(new Event('change'));
  const pos = S.globals.cutoff;
  wheel('#synth-knobs .knob');
  const turned = S.globals.cutoff;
  t.ok(turned !== pos, 'le potentiomètre change la brillance');
  sb.querySelector('.pb-name').value = 'Pad brillant';
  sb.querySelector('.pb-save').click();
  sel.value = 'hoover'; sel.dispatchEvent(new Event('change'));
  sel.value = S.synthUser[0].id; sel.dispatchEvent(new Event('change'));
  t.eq(S.synthUser[0].base, 'thunder_pad', 'le preset perso garde son son de départ');
  t.eq(S.preset, 'thunder_pad', 'le recharger remet ce son');
  t.near(S.globals.cutoff, turned, 1e-6, 'et ses potentiomètres');
}
