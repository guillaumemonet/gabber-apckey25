// Platines : scratch qui suit la position de la main, relâché qui repart à la vitesse du moteur,
// transition automatique complète (départ en phase sur la phrase, échange des basses, fin propre) et reprise en main.
const find = (A, name) => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === name && p.bpm) return p; };
const item = p => ({ sampleId: `lib:${p.file}`, name: p.name, loop: true, bpm: p.bpm, cat: p.cat });

export default async function (t, A) {
  const S = A.state, D = A.decks;
  A.wm.toggle('decks', true);
  A.setBpm(190);
  await A.loadDeck('A', item(find(A, 'Mainstream beat')));
  await A.loadDeck('B', item(find(A, 'String pads')));
  await t.wait(300);
  const dA = D.decks.A, dB = D.decks.B;
  const level = t.meter(dA.node);

  // Scratch : la main va et vient (±1/4 de tour), le disque suit, sans valeur absurde.
  dA.play();
  await t.wait(600);
  dA.scratchStart();
  const p0 = dA.posAt();
  let hand = 0, nan = false, peak = 0;
  for (let k = 0; k < 120; k++) {
    const turns = 0.25 * Math.sin((k / 60) * 2 * Math.PI);
    dA.scratchMove((turns - hand) * 1.8);
    hand = turns;
    if (k % 6 === 0) { const l = level(); nan ||= Number.isNaN(l); peak = Math.max(peak, l); }
    await t.wait(8);
  }
  await t.wait(150);
  t.ok(!nan, 'pas de NaN pendant le scratch');
  t.ok(peak > 0.02, 'le scratch fait du son', peak);
  const moved = Math.abs(dA.posAt() - p0 - hand * 1.8);
  t.ok(moved < 0.3 || moved > dA.duration - 0.3, 'le disque suit la position de la main', moved);
  dA.scratchEnd();
  const st = await t.until(() => Math.abs(dA.speed - 1) < 0.05 && dA.speed, 1500);
  t.ok(st, 'relâché : le moteur ramène le disque à sa vitesse', dA.speed);

  // Transition automatique A -> B.
  S.decks.xfade = 0; D.update();
  await t.wait(400);
  A.autoTransition();
  const x = A.autoX;
  t.ok(x && x.synced, 'transition calée (tempos connus)', x);
  t.ok(x.bars === 8 || x.bars === 16 || x.bars === 4, 'longueur en mesures', x?.bars);
  t.ok(x.wait > 0 && x.wait < 12, 'départ sur la prochaine phrase', x?.wait);
  t.ok(t.$('#deck-auto').classList.contains('active'), 'bouton actif pendant la transition');
  t.ok(/→|->/.test(t.$('#toast')?.textContent ?? ''), 'le plan est annoncé', t.$('#toast')?.textContent);
  await t.wait((x.wait + 0.5) * 1000);
  t.ok(dB.playing, 'B est parti');
  // Phase : les deux decks estimés au même instant d'après leur dernier rapport (sans plafond), médiane de plusieurs mesures.
  const beatsAt = (d, s, T) => ((d.pos + (T - d.at) * d.speed) * s.bpm) / 60;
  const phases = [];
  for (let k = 0; k < 9; k++) {
    const T = A.engine.ctx.currentTime;
    const ph = (((beatsAt(dA, S.decks.A, T) - beatsAt(dB, S.decks.B, T)) % 4) + 4) % 4;
    phases.push(Math.min(ph, 4 - ph));
    await t.wait(60);
  }
  phases.sort((a, b) => a - b);
  t.ok(phases[4] < 0.1, 'A et B en phase sur la mesure', phases);
  t.eq(S.decks.B.low, 0, 'B entre sans basses');
  await t.wait(x.dur * 500 + 400);
  t.eq(S.decks.A.low, 0, 'à mi-parcours, A perd ses basses');
  t.eq(S.decks.B.low, 0.5, '… et B récupère les siennes');
  await t.wait(x.dur * 500 + 600);
  t.ok(!A.autoX, 'transition terminée');
  t.ok(!dA.playing && dB.playing, 'A arrêté, B seul');
  t.eq(S.decks.xfade, 1, 'crossfader côté B');
  t.eq([S.decks.A.low, S.decks.A.filter, S.decks.B.low, S.decks.B.high, S.decks.B.filter], [0.5, 0.5, 0.5, 0.5, 0.5], 'réglages revenus au neutre');

  // Un geste sur le crossfader arrête une transition en cours.
  A.autoTransition();
  await t.wait(200);
  t.ok(A.autoX, 'nouvelle transition lancée');
  const xf = t.$('#deck-xfade');
  xf.value = 0.7; xf.dispatchEvent(new Event('input'));
  t.ok(!A.autoX, 'le crossfader reprend la main');
  t.ok(!t.$('#deck-auto').classList.contains('active'), 'bouton éteint');
  D.stopAll();
}
