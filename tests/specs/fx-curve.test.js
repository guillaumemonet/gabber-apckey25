// Designer d'effet : fenêtre, édition à la souris, enregistrement d'une courbe, rendu (volume, profondeur,
// panoramique, passe-bas), retouche pendant la lecture, écoute, courbes transportées par un fichier morceau.
export default async function (t, A) {
  const S = A.state, E = A.curveEd;
  A.wm.toggle('curve', true);
  await t.wait(200);
  const cv = t.$('#curve-canvas');
  t.eq(t.$$('#curve-shapes button').length, A.CURVE_SHAPES.length, 'les formes de départ sont proposées');
  t.eq(t.$$('#curve-target option').length, 7, '7 réglages pilotables');
  t.eq(t.$$('#curve-beats button').length, 3, 'longueurs 1, 2 et 4 temps');
  t.ok(cv.clientWidth > 300 && cv.width > 0, 'éditeur dessiné');
  t.ok(t.$('button[data-plugin="curve"]'), 'bouton du designer dans la barre des outils');
  t.ok(A.fxItems().filter(i => i.curveId).length >= A.CURVE_SHAPES.length, 'les courbes sont dans l\'onglet Effets');

  // Édition à la souris : un point ajouté à 0,8 puis déplacé (aimanté à la grille).
  A.openCurve('b:pump');
  await t.wait(300);   // laisse la fenêtre finir de se placer (sous charge, le canevas bouge encore)
  const r = cv.getBoundingClientRect();
  const at = (u, v) => ({ clientX: r.left + 46 + u * (r.width - 56), clientY: r.top + 10 + (1 - v) * (r.height - 30), bubbles: true, button: 0, pointerId: 1 });
  const n0 = E.draft.points.length;
  cv.dispatchEvent(new PointerEvent('pointerdown', at(0.8, 0.4)));
  window.dispatchEvent(new PointerEvent('pointermove', at(0.82, 0.2)));
  window.dispatchEvent(new PointerEvent('pointerup', at(0.82, 0.2)));
  t.eq(E.draft.points.length, n0 + 1, 'un clic ajoute un point');
  const added = E.draft.points.find(p => p.x > 0.6);
  t.near(added?.x, 0.75, 0.001, 'le point est aimanté à la grille');
  t.near(added?.y, 0.2, 0.05, 'le point suit la souris');
  t.ok(E.dirty && E.src === 'b:pump', 'la forme de départ devient un brouillon modifié');
  t.eq(S.curves.length, 0, 'la forme de départ elle-même n\'est pas modifiée');

  // Enregistrement.
  t.$('#curve-name').value = 'Ma pompe';
  t.$('#curve-name').dispatchEvent(new Event('input'));
  t.$('#curve-save').click();
  const mine = S.curves[0];
  t.ok(mine?.id?.startsWith('u:'), 'la courbe est enregistrée parmi les tiennes');
  t.eq(mine?.name, 'Ma pompe', 'avec son nom');
  t.eq(E.src, mine?.id, 'le designer édite maintenant ta courbe');
  t.ok(A.fxItems().some(i => i.ownCurve && i.name === 'Ma pompe'), 'elle apparaît dans la bibliothèque');
  t.ok(t.$('#curve-save').hidden, 'plus besoin d\'enregistrer : les retouches s\'appliquent en direct');

  // Rendu : une nappe tenue sous la courbe.
  const pad = A.libManifest.banks.find(b => b.name === 'Hardcore').pads.find(p => p?.name === 'String pads');
  for (const tr of S.tl.tracks) { tr.clips = []; tr.fx = []; }
  S.tl.tracks[0].clips.push({ id: 'c1', start: 0, len: 8, sampleId: 'lib:' + pad.file, name: 'pads', cat: 'pad', color: 1, bpm: pad.bpm, loop: true });
  await A.ensureBuffer('lib:' + pad.file);
  S.tl.bars = 2;
  A.tlPlaceFx({ fx: 'curve', p: { curve: mine.id }, len: 8, name: 'x' }, 0, 0);
  const env = async () => {
    const ch = await A.renderSong();
    const sr = A.engine.ctx.sampleRate, seg = Math.round(60 / S.bpm / 8 * sr), out = [];
    for (let k = 8; k < 32; k++) { let s = 0; for (let i = k * seg; i < (k + 1) * seg; i++) s += ch[0][i] ** 2 + ch[1][i] ** 2; out.push(Math.sqrt(s / seg / 2)); }
    let l = 0, rr = 0;
    for (let i = 0; i < ch[0].length; i += 7) { l += ch[0][i] ** 2; rr += ch[1][i] ** 2; }
    return { min: Math.min(...out), max: Math.max(...out), lr: Math.sqrt(l / rr), total: Math.sqrt((l + rr) / (ch[0].length / 7) / 2) };
  };
  const pump = await env();
  mine.depth = 0;
  const flat = await env();
  t.ok(pump.min < pump.max * 0.15, 'la pompe fait plonger le volume à chaque temps', pump);
  t.ok(flat.min > flat.max * 0.3, 'profondeur 0 : plus d\'effet', flat);
  mine.depth = 1;
  mine.target = 'pan';
  const pan = await env();
  t.ok(Math.abs(pan.lr - 1) > 0.15, 'la courbe de panoramique déplace le son', pan.lr);
  mine.target = 'lp';
  mine.freq = 150;
  const lp = await env();
  // La courbe (une pompe) ferme le filtre au début de chaque temps : les creux descendent.
  t.ok(lp.min < flat.min * 0.9, 'la courbe de passe-bas ferme le filtre sur les temps', { lp: lp.min, flat: flat.min });
  t.ok(t.$('.tl-fx .tl-fx-curve'), 'le bloc de courbe montre sa forme sur la timeline');
  mine.target = 'vol';

  // Retouche pendant la lecture.
  A.openCurve(mine.id);
  A.timeline.play(0);
  await t.wait(600);
  const slider = t.$('#curve-sliders input[data-k="depth"]');
  slider.value = 30;
  slider.dispatchEvent(new Event('input'));
  await t.wait(500);
  A.timeline.stop();
  t.near(mine.depth, 0.3, 0.001, 'la profondeur retouchée s\'applique à ta courbe');
  t.ok(/1/.test(t.$('#curve-hint').textContent), 'le designer indique les blocs qui utilisent la courbe', t.$('#curve-hint').textContent);

  // Écoute.
  const level = t.meter(A.engine.master);
  await A.curvePreviewToggle();
  let peak = 0;
  for (let k = 0; k < 12; k++) { await t.wait(40); peak = Math.max(peak, level()); }
  t.ok(peak > 0.05, 'Écouter joue une boucle à travers la courbe', peak);
  t.eq(t.$('#curve-play').textContent, 'Arrêter', 'le bouton devient Arrêter');
  A.curvePreviewStop();
  await t.wait(300);
  t.ok(level() < 0.01, 'l\'écoute s\'arrête', level());
  t.eq(t.$('#curve-play').textContent, 'Écouter', 'le bouton redevient Écouter');

  // Fichier morceau : les courbes voyagent avec lui.
  const tracks = S.tl.tracks.map(tr => ({ ...tr }));
  const file = { format: 'gabberkey-file', version: 1, app: 'GabberKey', kind: 'song', data: { bpm: 190, tl: { bars: 2, loop: true, zoom: 40, tracks }, curves: [mine] }, samples: {} };
  S.curves = [];
  await A.loadFile(new File([JSON.stringify(file)], 'x.gabber'));
  t.eq(S.curves.map(c => c.name), ['Ma pompe'], 'la courbe revient avec le morceau');
  t.eq(S.tl.tracks[0].fx[0]?.p.curve, mine.id, 'le bloc pointe toujours sur elle');
}
