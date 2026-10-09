// Tap tempo et métronome : tempo trouvé et affiché, clics sur chaque temps (accent sur le 1er), voyants,
// mode « seulement en enregistrement », décompte d'une mesure avant REC, menu d'options.
export default async function (t, A) {
  const S = A.state;
  const tap = t.$('#tap');
  // Le tempo attendu vient des intervalles réellement écoulés (une minuterie peut prendre du retard).
  const times = [];
  const click = () => { times.push(performance.now()); tap.click(); };
  click();
  await t.wait(316); click();
  t.near(S.bpm, 60000 / (times[1] - times[0]), 3, 'deux clics : tempo = intervalle entre les clics');
  t.ok(/\d/.test(tap.textContent), 'le tempo trouvé s’affiche sur le bouton', tap.textContent);
  await t.wait(316); click();
  t.near(S.bpm, 60000 / ((times[2] - times[0]) / 2), 4, 'troisième clic : moyenne des intervalles');
  await t.wait(2700);
  t.ok(!/\d/.test(tap.textContent), 'le bouton revient à « Tap »', tap.textContent);
  A.setBpm(190);
  let clicks = [];
  const orig = A.metro.click.bind(A.metro);
  A.metro.click = (time, accent) => { clicks.push({ time, accent }); orig(time, accent); };
  t.$('#metro').click();
  const seen = new Set();
  for (let i = 0; i < 40; i++) { await t.wait(25); seen.add(A.metro.current()); }
  t.ok(S.metro.on && t.$('#metro').classList.contains('active'), 'métronome allumé');
  t.ok(clicks.length >= 3, 'il clique', clicks.length);
  const gaps = clicks.slice(1).map((c, i) => c.time - clicks[i].time);
  t.ok(gaps.every(g => Math.abs(g - 60 / 190) < 0.002), 'un clic par temps', gaps);
  t.ok(clicks.some(c => c.accent), 'accent sur le premier temps');
  t.ok(seen.size >= 3, 'les voyants battent la mesure', [...seen]);
  S.metro.when = 'rec';
  clicks = [];
  await t.wait(900);
  t.eq(clicks.length, 0, '« seulement en enregistrement » : rien au repos');
  S.metro.countIn = true;
  for (const tr of S.tl.tracks) tr.arm = false;
  S.tl.tracks[0].arm = true; S.tl.tracks[0].src = 'pads';
  clicks = [];
  const t0 = A.engine.ctx.currentTime;
  const p = A.tlStartRec();
  await t.wait(200);
  t.ok(!A.tlRec, 'pendant le décompte, l’enregistrement n’a pas commencé');
  t.ok(clicks.length >= 1, 'le décompte clique');
  await p;
  t.near(A.engine.ctx.currentTime - t0, 4 * 60 / 190, 0.25, 'l’enregistrement démarre après une mesure de décompte');
  await t.wait(1100);
  t.ok(clicks.length >= 6, 'le métronome clique pendant l’enregistrement', clicks.length);
  await A.tlStopRec();
  t.ok(!A.tlRec, 'enregistrement arrêté');
  t.$('#metro-opts').click();
  await t.wait(50);
  const box = t.$('.metro-opts');
  t.ok(box, 'menu d’options');
  t.eq(box?.querySelector('.m-when').value, 'rec', 'option « quand » affichée');
  t.eq(box?.querySelector('.m-count').checked, true, 'option décompte affichée');
}
