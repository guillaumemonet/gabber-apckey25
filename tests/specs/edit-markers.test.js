// Marqueurs : « + Marqueur » à la mesure de la tête de lecture, double-clic dans la règle, clic = y aller, glisser =
// déplacer (à la mesure), double-clic = renommer, clic droit = supprimer, Alt+← / → ; annuler ; anciennes sauvegardes.
export default async function (t, A) {
  const S = A.state;
  t.eq(S.tl.markers, [], 'aucun marqueur au départ');
  t.eq(A.mergeTlState({ tracks: [{ clips: [] }] }).markers, [], 'une ancienne sauvegarde n’a pas de marqueurs');
  const ruler = t.$('#tl-ruler');
  const bp = () => A.beatPx();
  A.save();

  // « + Marqueur » à la mesure de la tête de lecture (temps 9,5 -> mesure 3 = temps 8).
  S.tl.playhead = 9.5;
  t.$('#tl-marker-add').click();
  t.eq(S.tl.markers.map(m => m.beat), [8], 'marqueur posé au début de la mesure de la tête de lecture');
  t.ok(t.$$('#tl-ruler .tl-marker').length === 1 && t.$$('#tl-grid .tl-mline').length === 1, 'drapeau dans la règle et trait sur les pistes');
  // Double-clic dans la règle (mesure 5 = temps 16).
  const r = ruler.getBoundingClientRect();
  ruler.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: r.left + 17.5 * bp(), clientY: r.top + 10 }));
  t.eq(S.tl.markers.map(m => m.beat), [8, 16], 'double-clic dans la règle : un marqueur à cette mesure');

  // Clic = la tête de lecture y va.
  const mk = i => t.$$('#tl-ruler .tl-marker')[i];
  const click = el => { const b = el.getBoundingClientRect(); el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: b.left + 5, clientY: b.top + 5 })); window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); };
  click(mk(1));
  t.eq(S.tl.playhead, 16, 'clic sur un marqueur : la tête de lecture y va');

  // Glisser : à la mesure.
  const b0 = mk(0).getBoundingClientRect();
  mk(0).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: b0.left + 5, clientY: b0.top + 5 }));
  window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: b0.left + 5 + 3.4 * bp(), clientY: b0.top + 5 }));
  window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
  t.eq(S.tl.markers.map(m => m.beat), [12, 16], 'glissé de 3,4 temps : calé sur la mesure suivante');

  // Double-clic = renommer.
  mk(0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const input = t.$('.tl-marker-edit');
  t.ok(input, 'champ de nom');
  input.value = 'Drop';
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  t.eq(S.tl.markers[0].name, 'Drop', 'marqueur renommé');
  t.eq(mk(0).textContent, 'Drop', 'nom affiché');

  // Alt+flèches : précédent / suivant.
  A.setTlFocus(true);
  S.tl.playhead = 0;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  t.eq(S.tl.playhead, 12, 'Alt+→ : marqueur suivant');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }));
  t.eq(S.tl.playhead, 16, 'Alt+→ encore : le suivant');
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, bubbles: true }));
  t.eq(S.tl.playhead, 12, 'Alt+← : le précédent');
  A.setTlFocus(false);

  // Clic droit = supprimer ; Ctrl+Z le ramène.
  mk(1).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
  t.eq(S.tl.markers.length, 1, 'clic droit : supprimé');
  A.tlUndo();
  await t.wait(50);
  t.eq(S.tl.markers.map(m => m.beat), [12, 16], 'Ctrl+Z ramène le marqueur');
  t.ok(A.stateSnapshot().tl.markers.length === 2, 'marqueurs enregistrés avec le projet');
}
