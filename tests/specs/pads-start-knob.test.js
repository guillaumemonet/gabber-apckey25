// Potentiomètre « Début » en direct sur une boucle calée au tempo : la boucle repart à la nouvelle position (fondu court,
// pas de trou), garde sa longueur et reste calée sur la grille ; l'arrêt reste propre.
export default async function (t, A) {
  const S = A.state, E = A.engine, ctx = E.ctx;
  A.wm.toggle('pads', true);
  A.setBpm(190);
  A.setBank(18);   // Anthem chords : pad 1 = cordes épiques (boucle de 4 mesures, son tenu)
  await t.until(() => A.bankLoaded(18), 15000);   // sons chargés à l'affichage de la banque
  A.setPage('pad');
  const meter = t.meter(E.padBus);
  const press = i => {
    A.apc.dispatchEvent(new CustomEvent('pad', { detail: { index: i, pressed: true } }));
    A.apc.dispatchEvent(new CustomEvent('pad', { detail: { index: i, pressed: false } }));
  };
  const key = 18 * 40;
  press(0);
  await t.wait(800);
  const v = E.padVoices.get(key);
  t.ok(v, 'la boucle joue');
  if (!v) return;
  t.ok(v.synced, 'boucle calée au tempo');
  const src0 = v.src, dur = v.src.buffer.duration;
  const phaseErr = time => {
    const ph = ((E.padPos(v, time) - v.offset) % dur + dur) % dur;
    const ex = (((time - v.startAt) * v.track.rate) % dur + dur) % dur;
    const d = Math.abs(ph - ex);
    return Math.min(d, dur - d);
  };
  t.near(phaseErr(ctx.currentTime), 0, 0.01, 'position suivie avant le changement');
  for (let k = 0; k < 20; k++) A.turnKnob(4, { delta: 6 });   // K5 = Début
  await t.wait(40);
  const lv = [];
  for (let k = 0; k < 10; k++) { lv.push(meter()); await t.wait(15); }
  t.ok(v.src !== src0, 'le son repart à la nouvelle position (nouvelle source)');
  t.ok(v.offset > 1, 'le début a bien avancé', v.offset);
  t.ok(E.padVoices.get(key) === v, 'toujours la même voix');
  t.near(phaseErr(ctx.currentTime), 0, 0.01, 'la boucle reste calée sur la grille');
  t.ok(Math.min(...lv) > 0.05, 'pas de trou dans le son pendant le changement', lv.map(x => x.toFixed(3)));
  t.near(v.src.loopEnd - v.src.loopStart, dur, 0.01, 'la boucle garde toute sa longueur');
  for (let k = 0; k < 40; k++) A.turnKnob(4, { delta: -6 });
  await t.wait(100);
  t.near(v.offset, 0, 0.001, 'retour au début');
  press(0);
  await t.wait(400);
  t.ok(!E.padVoices.has(key), 'arrêt propre');
  t.ok(meter() < 0.01, 'silence après l’arrêt', meter());
}
