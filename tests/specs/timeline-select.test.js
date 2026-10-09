// Timeline : sélection au lasso, copier / coller, dupliquer, déplacer un groupe, Ctrl + clic, Suppr / annuler, tout sélectionner.
const P = (el, type, x, y, o = {}) => el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, pointerId: 1, button: 0, ...o }));
const W = (type, x, y, o = {}) => window.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 1, ...o }));
const key = (k, o = {}) => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));

export default async function (t, A) {
  const S = A.state;
  for (const id of Object.keys(S.windows)) if (A.wm.isOpen(id)) A.wm.toggle(id, false);
  await A.loadDemo();
  S.tl.zoom = 40;
  A.renderTl();
  await t.wait(300);
  const count = () => S.tl.tracks.reduce((n, tr) => n + tr.clips.length + tr.fx.length, 0);
  const n0 = count();
  t.ok(n0 > 20, 'la démo est chargée', n0);
  const clips = () => t.$$('.tl-clip');
  // Lasso sur les pistes 1 à 3, mesures 1 à 8.
  const lanes = t.$$('.tl-lane');
  const r0 = lanes[0].getBoundingClientRect(), r2 = lanes[2].getBoundingClientRect();
  const bar = S.tl.zoom;
  const x0 = r0.left + 2, y0 = r0.top + 3, x1 = r0.left + bar * 8 - 2, y1 = r2.bottom - 3;
  P(lanes[0], 'pointerdown', x0, y0); W('pointermove', (x0 + x1) / 2, (y0 + y1) / 2); W('pointermove', x1, y1); W('pointerup', x1, y1);
  const picked = A.tlPicked.size;
  t.ok(picked >= 1, 'le lasso sélectionne des blocs', picked);
  t.eq(t.$$('.tl-clip.selected, .tl-fx.selected').length, picked, 'les blocs sélectionnés sont surlignés');
  // Copier, coller à la mesure 40.
  key('c', { ctrlKey: true });
  S.tl.playhead = 39 * 4;
  key('v', { ctrlKey: true });
  t.eq(count(), n0 + picked, 'Ctrl+V colle autant de blocs que copiés');
  const pasted = [...A.tlPicked];
  t.eq(pasted.length, picked, 'les blocs collés deviennent la sélection');
  t.ok(pasted.every(o => o.start >= 39 * 4), 'collés à la tête de lecture (mesure 40)', pasted.map(o => o.start));
  t.ok(S.tl.bars >= 40, 'le morceau s\'allonge si besoin', S.tl.bars);
  // Ctrl+D : duplique à la suite.
  const beforeDup = count();
  const pastedStart = Math.min(...pasted.map(o => o.start));
  key('d', { ctrlKey: true });
  t.eq(count(), beforeDup + picked, 'Ctrl+D duplique la sélection');
  t.ok(Math.min(...[...A.tlPicked].map(o => o.start)) > pastedStart, 'la copie est placée après l\'original');
  // Glisser le groupe d'une mesure à droite.
  const el = clips().find(c => A.tlPicked.has(c._obj));
  const b = el.getBoundingClientRect();
  const s0 = [...A.tlPicked].map(o => o.start);
  P(el, 'pointerdown', b.left + 10, b.top + 10); W('pointermove', b.left + 10 + bar, b.top + 10); W('pointerup', b.left + 10 + bar, b.top + 10);
  const s1 = [...A.tlPicked].map(o => o.start);
  t.ok(s1.every((s, i) => s === s0[i] + 4), 'tout le groupe avance d\'une mesure', { s0, s1 });
  // Ctrl + clic : retire un bloc de la sélection.
  const n1 = A.tlPicked.size;
  const el2 = clips().find(c => A.tlPicked.has(c._obj));
  const r = el2.getBoundingClientRect();
  P(el2, 'pointerdown', r.left + 5, r.top + 5, { ctrlKey: true }); W('pointerup', 0, 0);
  t.eq(A.tlPicked.size, n1 - 1, 'Ctrl + clic retire un bloc de la sélection');
  // Suppr, puis Annuler.
  const n2 = count();
  key('Delete');
  t.eq(count(), n2 - (n1 - 1), 'Suppr retire les blocs sélectionnés');
  key('z', { ctrlKey: true });
  await t.wait(50);
  t.eq(count(), n2, 'Ctrl+Z les remet');
  // Ctrl+A puis Suppr, puis Annuler.
  const r5 = lanes[5].getBoundingClientRect();
  P(lanes[5], 'pointerdown', r0.left + 5, r5.top + 5); W('pointerup', r0.left + 5, r5.top + 5);
  key('a', { ctrlKey: true });
  t.eq(A.tlPicked.size, count(), 'Ctrl+A sélectionne tous les blocs');
  const total = count();
  key('Delete');
  t.eq(count(), 0, 'tout est supprimé');
  key('z', { ctrlKey: true });
  await t.wait(50);
  t.eq(count(), total, 'et tout revient avec Ctrl+Z');
}
