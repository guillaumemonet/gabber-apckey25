// Pendant la lecture, la vue suit la tête de lecture : après chaque défilement, la ligne reste visible à droite des
// en-têtes de piste (fixes au défilement), jamais cachée dessous.
export default async function (t, A) {
  const S = A.state;
  for (const tr of S.tl.tracks) tr.clips = [];
  S.tl.bars = 64;
  S.tl.zoom = 400;   // une mesure = 400 px : la tête de lecture sort vite de la vue
  A.renderTl();
  const scroll = t.$('#tl-scroll'), line = t.$('#tl-playhead');
  const headRight = () => t.$('#tl-grid .tl-head').getBoundingClientRect().right;
  const visible = () => { const x = line.getBoundingClientRect().left; return x >= headRight() && x <= scroll.getBoundingClientRect().right; };
  // Départ juste avant le bord droit de la vue : la vue défile tout de suite.
  S.tl.playhead = Math.floor((scroll.clientWidth - A.TL_HEAD) / A.beatPx()) - 0.25;
  t.$('#tl-play').click();
  t.ok(await t.until(() => scroll.scrollLeft > 0, 3000), 'la vue suit la tête de lecture');
  let ok = true;
  for (let k = 0; k < 20; k++) { await t.wait(50); ok = ok && visible(); }
  t.ok(ok, 'la tête de lecture reste visible, à droite des en-têtes de piste', [line.getBoundingClientRect().left, headRight()]);
  t.$('#tl-play').click();
  S.tl.zoom = 64;
  A.renderTl();
}
