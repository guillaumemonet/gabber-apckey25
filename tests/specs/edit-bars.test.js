// Insérer / supprimer des mesures (clic droit sur la règle, js/app/bars.js) : blocs décalés ou coupés en deux, blocs
// d'effets allongés, automation tenue, marqueurs et tête de lecture décalés, longueur du morceau, menu, annuler.
export default async function (t, A) {
  const S = A.state, tl = S.tl;
  for (const tr of tl.tracks) { tr.clips = []; tr.fx = []; tr.auto = {}; }
  tl.markers = [];
  tl.bars = 16;
  const note = (id, start, len) => ({ id, type: 'note', preset: 'hardstyle_lead', cat: 'lead', color: 1, start, len, loop: false, name: id,
    seq: Array.from({ length: len }, (_, i) => ({ t: i, len: 1, note: 60 + i, vel: 0.9 })), pat: len });
  tl.tracks[0].clips.push(note('avant', 0, 8), note('cheval', 12, 8), note('apres', 32, 4));
  tl.tracks[1].fx.push({ id: 'fx1', fx: 'hprise', start: 8, len: 16, p: {}, name: '' });
  tl.tracks[1].auto = { vol: [{ b: 0, v: 0.2 }, { b: 32, v: 1 }] };
  tl.markers.push({ id: 'm1', beat: 32, name: 'Drop' });
  tl.playhead = 40;
  A.renderTl();
  A.save();   // état de départ dans l'historique (Annuler y revient)
  await t.wait(50);

  // Menu : clic droit sur la mesure 5 (temps 16).
  const ruler = t.$('#tl-ruler'), r = ruler.getBoundingClientRect();
  ruler.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 16 * A.beatPx() + 2, clientY: r.top + 5 }));
  await t.wait(30);
  const menu = t.$('.bar-menu');
  t.ok(menu && /5/.test(menu.querySelector('.cm-head').textContent), 'clic droit sur la règle : menu de la mesure 5', menu?.textContent);
  menu.querySelector('[data-ins="4"]').click();
  await t.wait(30);

  const clips = tl.tracks[0].clips.slice().sort((a, b) => a.start - b.start);
  t.eq(clips.map(c => [c.start, c.len]), [[0, 8], [12, 4], [32, 4], [48, 4]], 'bloc avant intact, bloc à cheval coupé et sa suite décalée, bloc après décalé de 4 mesures');
  t.eq(clips[2].seq.map(n => n.note), [64, 65, 66, 67], 'la seconde moitié garde ses notes');
  t.eq([tl.tracks[1].fx[0].start, tl.tracks[1].fx[0].len], [8, 32], 'bloc d’effet à cheval : allongé');
  const vol = tl.tracks[1].auto.vol;
  t.ok(Math.abs(A.autoAt(vol, 16) - A.autoAt(vol, 32)) < 1e-6 && Math.abs(A.autoAt(vol, 48) - 1) < 1e-6, 'automation tenue pendant les mesures insérées, fin décalée', JSON.stringify(vol));
  t.eq([tl.markers[0].beat, tl.playhead, tl.bars], [48, 56, 20], 'marqueur, tête de lecture et longueur du morceau suivent');

  // Annuler.
  A.tlUndo();
  await t.wait(30);
  t.eq([S.tl.bars, S.tl.markers[0]?.beat, S.tl.tracks[0].clips.length], [16, 32, 3], 'Ctrl+Z : tout revient');

  const tl2 = S.tl;
  // Supprimer 2 mesures à partir de la mesure 3 (temps 8 à 16).
  A.removeBars(2, 2);
  const after = tl2.tracks[0].clips.slice().sort((a, b) => a.start - b.start);
  t.eq(after.map(c => [c.start, c.len]), [[0, 8], [8, 4], [24, 4]], 'supprimer : le contenu disparaît (bloc coupé au bord), la suite glisse à gauche');
  t.eq([tl2.tracks[1].fx[0].start, tl2.tracks[1].fx[0].len], [8, 8], 'bloc d’effet raccourci');
  t.eq([tl2.markers[0]?.beat, tl2.bars], [24, 14], 'marqueur décalé, morceau raccourci', JSON.stringify([tl2.markers, S.tl.markers, S.tl === tl2]));
  for (const tr of tl2.tracks) { tr.clips = []; tr.fx = []; tr.auto = {}; }
  tl2.markers = [];
}
