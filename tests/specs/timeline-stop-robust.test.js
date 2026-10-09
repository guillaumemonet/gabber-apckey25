// Timeline : Stop fonctionne à n'importe quel moment (y compris au passage de la boucle), même si un nettoyage échoue.
export default async function (t, A) {
  const S = A.state;
  await A.loadDemo();
  // Effets de piste, blocs de notes (synthé à oscillateurs, dont « init » et « live », synthé à couches), coups de pad.
  const it = id => A.fxItems().find(i => i.sampleId === 'fx:' + id);
  A.tlPlaceFx(it('pcf16'), 0, 0); A.tlPlaceFx(it('orbit3d'), 3, 4); A.tlPlaceFx(it('stutter16'), 6, 0); A.tlPlaceFx(it('tapestop'), 1, 8);
  ['init', 'hoover', 'reese', 'laser', 'live'].forEach((o, k) => S.tl.tracks[9 + k].clips.push({ id: 'o' + k, type: 'note', osc: o,
    seq: [{ t: 0, len: 0.5, note: 53, vel: 0.9 }, { t: 0.5, len: 0.5, note: 56, vel: 0.9 }, { t: 1, len: 2, note: 60, vel: 0.9 }], pat: 4, len: 16, start: 0, name: 'o', cat: 'lead', color: 1, loop: false }));
  S.tl.tracks[14].clips.push({ id: 'n1', type: 'note', notes: [53, 56, 60], vel: 0.8, preset: 'epic_strings', name: 'Fm', cat: 'strings', color: 1, start: 0, len: 8, loop: false });
  const bank = S.banks.findIndex(b => b[1]?.buffer);
  for (let b = 0; b < 16; b++) S.tl.tracks[15].clips.push({ id: 'p' + b, type: 'pad', bank, pad: 1, sampleId: S.banks[bank][1].sampleId, name: 'x', color: 1, cat: 'drums', start: b, len: 0.5, loop: false });
  S.tl.bars = 4;
  S.tl.loop = true;
  A.renderTl();
  const btn = t.$('#tl-play');
  const cycle = (16 * 60) / S.bpm * 1000;   // 4 mesures
  const bad = [];
  for (const ms of [300, 900, cycle - 300, cycle - 150, cycle + 80, cycle * 2 - 260, 1700]) {
    S.tl.playhead = 0;
    btn.click();
    await t.wait(ms);
    btn.click();
    await t.wait(120);
    if (A.timeline.playing || btn.dataset.icon !== 'play') bad.push(Math.round(ms));
  }
  t.eq(bad, [], 'Stop arrête la lecture à chaque fois (avant, pendant et après le passage de la boucle)');
  // Un nettoyage qui plante pendant l'arrêt : la lecture s'arrête quand même à l'écran.
  btn.click();
  await t.wait(500);
  A.timeline.chains.set(99, new Map([['x', { reset() { throw new Error('boom'); } }]]));
  btn.click();
  await t.wait(150);
  const x1 = t.$('#tl-playhead').style.left;
  await t.wait(400);
  t.ok(!A.timeline.playing, 'arrêtée malgré un effet qui refuse sa remise à zéro');
  t.eq(btn.dataset.icon, 'play', 'le bouton repasse sur ▶');
  t.eq(t.$('#tl-playhead').style.left, x1, 'la tête de lecture est immobile');
  A.timeline.chains.delete(99);
}
