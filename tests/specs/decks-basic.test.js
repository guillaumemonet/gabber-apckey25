// Platines : chargement, lecture synchro au tempo, scratch en arrière, pause, cue, crossfader,
// glisser un son de la bibliothèque sur un deck, page de potards de l'APC, aide.
const find = (A, name) => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === name && p.bpm) return p; };
const item = p => ({ sampleId: `lib:${p.file}`, name: p.name, loop: true, bpm: p.bpm, cat: p.cat });

export default async function (t, A) {
  const S = A.state, D = A.decks;
  A.wm.toggle('decks', true);
  await t.wait(200);
  t.eq(t.$$('.deck').length, 2, 'deux decks');
  t.eq(t.$$('.deck-knobs .knob').length, 10, '5 potards par deck');
  t.ok(t.$('.deck-vinyl') && t.$('.deck-zoom') && t.$('.deck-wave'), 'platine, forme d\'onde zoomée et vue d\'ensemble');

  const beat = find(A, 'Mainstream beat');
  await A.loadDeck('A', item(beat));
  const dA = D.decks.A;
  t.eq(S.decks.A.bpm, 190, 'tempo du son connu (190)');
  t.ok(dA.duration > 1, 'son chargé', dA.duration);

  // Lecture synchro : tempo global = tempo du son -> vitesse 1.
  A.setBpm(190);
  await t.wait(50);
  t.ok(/190/.test(t.$('.deck[data-deck="A"] .deck-bpm').textContent), 'tempo affiché', t.$('.deck[data-deck="A"] .deck-bpm').textContent);
  const level = t.meter(D.out);
  t.$('.deck[data-deck="A"] .deck-play').click();
  await t.wait(300);
  const p0 = dA.posAt(), t0 = A.engine.ctx.currentTime;
  let peak = 0;
  for (let i = 0; i < 20; i++) { await t.wait(40); peak = Math.max(peak, level()); }
  // La boucle (1 mesure) peut reboucler pendant la mesure : écart pris modulo sa durée.
  const speed = ((((dA.posAt() - p0) % dA.duration) + dA.duration) % dA.duration) / (A.engine.ctx.currentTime - t0);
  t.ok(dA.playing, 'le deck joue');
  t.ok(peak > 0.05, 'le son sort des platines', peak);
  t.ok(speed > 0.8 && speed < 1.2, 'vitesse 1 au tempo du son', speed);

  // Tempo global 95 : le deck synchro ralentit de moitié.
  A.setBpm(95);
  await t.wait(300);
  const speeds = [];
  for (let i = 0; i < 6; i++) {
    const a = dA.posAt(), ta = A.engine.ctx.currentTime;
    await t.wait(150);
    const d = (((dA.posAt() - a) % dA.duration) + dA.duration) % dA.duration, dt = A.engine.ctx.currentTime - ta;
    if (d > 0 && dt > 0) speeds.push(d / dt);
  }
  speeds.sort((x, y) => x - y);
  t.near(speeds[Math.floor(speeds.length / 2)] ?? 0, 0.5, 0.12, 'à 95 BPM, le deck synchro joue à mi-vitesse');
  A.setBpm(190);

  // Scratch : la main tire le disque en arrière (position).
  dA.scratchStart();
  await t.wait(100);
  const ps = dA.posAt();
  for (let i = 0; i < 8; i++) { dA.scratchMove(-0.15); await t.wait(30); }
  await t.wait(150);
  const pe = dA.posAt();
  dA.scratchEnd();
  t.ok(pe < ps || pe > dA.duration - 1.5, 'le scratch fait reculer le disque', { ps, pe });

  // Pause puis cue.
  t.$('.deck[data-deck="A"] .deck-play').click();
  await t.wait(400);
  const pp = dA.posAt();
  await t.wait(300);
  t.ok(!dA.playing, 'pause');
  t.near(dA.posAt(), pp, 0.02, 'à l\'arrêt, la position ne bouge plus');
  t.$('.deck[data-deck="A"] .deck-cue').click();          // à l'arrêt : le point de cue est posé ici
  const cue = S.decks.A.cue;
  t.$('.deck[data-deck="A"] .deck-play').click();
  await t.wait(500);
  t.$('.deck[data-deck="A"] .deck-cue').click();          // en lecture : retour au cue et pause
  await t.wait(200);
  t.ok(!dA.playing, 'cue en lecture : pause');
  t.near(dA.posAt(), cue, 0.05, 'cue en lecture : retour au point de cue');

  // Crossfader tout à droite : le deck A ne s'entend plus.
  t.$('.deck[data-deck="A"] .deck-play').click();
  const xf = t.$('#deck-xfade');
  xf.value = 1; xf.dispatchEvent(new Event('input'));
  await t.wait(400);
  let peakB = 0;
  for (let i = 0; i < 10; i++) { await t.wait(40); peakB = Math.max(peakB, level()); }
  t.eq(S.decks.xfade, 1, 'crossfader enregistré');
  t.ok(peakB < 0.01, 'crossfader sur B : A coupé', peakB);
  xf.value = 0.5; xf.dispatchEvent(new Event('input'));
  t.$('.deck[data-deck="A"] .deck-play').click();

  // Glisser un son de la bibliothèque sur le deck B.
  const row = t.$('#lib-list .lib-item');
  const deckB = t.$('.deck[data-deck="B"]');
  const r = row.getBoundingClientRect(), rb = deckB.getBoundingClientRect();
  row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, clientX: r.left + 5, clientY: r.top + 5 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: r.left + 40, clientY: r.top + 30 }));
  window.dispatchEvent(new PointerEvent('pointermove', { clientX: rb.left + 60, clientY: rb.top + 60 }));
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: rb.left + 60, clientY: rb.top + 60 }));
  const loadedB = await t.until(() => D.decks.B.buffer, 5000);
  t.ok(loadedB && S.decks.B.name, 'son glissé sur le deck B', S.decks.B.name);

  // Page de potards des platines (Maj + REC deux fois) : K7 = crossfader.
  const btn = (name, pressed = true) => A.apc.dispatchEvent(new CustomEvent('button', { detail: { name, pressed } }));
  btn('shift');
  for (let i = 0; i < 3 && S.page !== 'decks'; i++) btn('record');   // Maj + REC fait tourner les pages TB-303 / platines / synthé
  btn('shift', false);
  t.eq(S.page, 'decks', 'page de potards des platines');
  A.turnKnob(6, { value: 0.9 });
  t.near(S.decks.xfade, 0.9, 0.001, 'K7 règle le crossfader');
  t.ok(A.knobDefs().some(d => d?.deck === 'A'), 'potards du deck A sur la page');

  // Aide de la fenêtre.
  t.$('[data-win="decks"] .win-help').click();
  t.ok(t.$$('.win-help-pop li').length >= 5, 'aide des platines');
}
