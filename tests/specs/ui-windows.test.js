// Fenêtres : structure (barre de titre, aide, fermeture), aide qui suit la fenêtre, Échap, déplacement par la barre,
// et une page d'aide pour chaque fenêtre.
export default async function (t, A) {
  const { state, wm } = A;
  const ids = Object.keys(state.windows);
  t.ok(ids.length >= 15, 'toutes les fenêtres sont déclarées', ids.length);
  const broken = ids.filter(id => {
    const el = t.$(`[data-win="${id}"]`);
    const bar = el?.firstElementChild;
    return !bar?.classList.contains('win-bar') || !bar.querySelector('h2')?.textContent || !bar.querySelector('.win-help') || !bar.querySelector('.win-close');
  });
  t.eq(broken, [], 'chaque fenêtre a sa barre : titre, aide, fermeture');

  wm.toggle('piano', true);
  wm.toggle('mix', true);
  const piano = t.$('[data-win="piano"]');
  piano.querySelector('.win-help').click();
  const pop = t.$('.win-help-pop');
  t.ok(!pop.hidden && pop.querySelectorAll('li').length >= 3, 'l\'aide du synthé s\'ouvre');
  t.ok(piano.querySelector('.win-help').classList.contains('active'), 'bouton ? actif');
  const titlePiano = pop.querySelector('h2').textContent;
  t.$('[data-win="mix"] .win-help').click();
  t.ok(pop.querySelector('h2').textContent !== titlePiano, 'l\'aide passe au mixeur');
  t.ok(!piano.querySelector('.win-help').classList.contains('active'), 'le ? du synthé s\'éteint');
  t.$('[data-win="mix"] .win-close').click();
  t.ok(!wm.isOpen('mix'), 'fermer la fenêtre');
  t.ok(pop.hidden, 'fermer la fenêtre ferme son aide');
  piano.querySelector('.win-help').click();
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  t.ok(pop.hidden, 'Échap ferme l\'aide');

  // Déplacement par la barre de titre.
  const h2 = piano.querySelector('.win-bar h2');
  const r0 = piano.getBoundingClientRect(), b = h2.getBoundingClientRect();
  h2.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: b.left + 5, clientY: b.top + 5 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: b.left + 105, clientY: b.top + 65 }));
  window.dispatchEvent(new PointerEvent('pointerup', {}));
  const r1 = piano.getBoundingClientRect();
  // L'aimantation aux bords et aux autres fenêtres (14 px) peut décaler un peu la position finale.
  t.near(r1.left - r0.left, 100, 45, 'la fenêtre suit la souris (horizontal)');
  t.near(r1.top - r0.top, 60, 45, 'la fenêtre suit la souris (vertical)');

  // Une aide pour chaque fenêtre.
  const missing = [];
  for (const id of ids) {
    wm.toggle(id, true);
    t.$(`[data-win="${id}"] .win-help`).click();
    if (pop.querySelectorAll('li').length < 2) missing.push(id);
    wm.closeHelp();
  }
  t.eq(missing, [], 'chaque fenêtre a une page d\'aide');
}
