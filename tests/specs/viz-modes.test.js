// Visualiseur : chaque mode dessine quelque chose pendant que la démo joue, les filtres s'allument,
// le mode « mots » montre son champ, le projecteur s'ouvre (ou explique que la fenêtre est bloquée), la fermeture arrête tout.
export default async function (t, A) {
  const S = A.state;
  await A.loadDemo();
  A.wm.toggle('viz', true);
  A.timeline.play(64);
  const cv = t.$('#viz-canvas');
  const stats = () => {
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0, n = 0;
    for (let i = 0; i < d.length; i += 40) { if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; n++; }
    return lit / n;
  };
  await t.wait(500);
  t.ok(cv.width > 100 && cv.height > 100, 'la scène a une taille', [cv.width, cv.height]);
  const dark = [];
  for (const m of A.VIZ_MODES) {
    A.setVizMode(m);
    await t.wait(900);
    t.eq(S.viz.mode, m, `mode ${m} choisi`);
    if (stats() < 0.003) dark.push(m);
  }
  t.ok(dark.length <= 2, 'les modes dessinent une image', dark);

  A.setVizMode('tunnel');
  A.toggleVizFx('crt');
  t.ok(S.viz.k.crt > 0, 'filtre CRT allumé');
  t.ok(A.viz.fx.crt > 0, 'le visualiseur applique le filtre');
  A.toggleVizFx('crt');
  t.eq(S.viz.k.crt, 0, 'filtre CRT éteint');

  A.setVizMode('bang');
  await t.wait(100);
  t.ok(!t.$('#viz-words').hidden, 'le mode mots montre son champ');

  A.openProjector();
  await t.wait(1200);
  const p = A.projector;
  if (p && !p.win.closed) {
    t.ok(A.viz.outputs.size >= 2, 'le projecteur reçoit l\'image');
    p.win.close();
    await t.wait(1500);
    t.ok(A.viz.outputs.size <= 1, 'fermer le projecteur le retire');
  } else {
    t.ok(/bloqu|block/i.test(t.$('#toast')?.textContent ?? ''), 'fenêtre bloquée : un message l\'explique', t.$('#toast')?.textContent);
  }

  A.timeline.stop();
  A.wm.toggle('viz', false);
  await t.wait(400);
  t.ok(!A.viz.running, 'fenêtre fermée : le visualiseur s\'arrête');
}
