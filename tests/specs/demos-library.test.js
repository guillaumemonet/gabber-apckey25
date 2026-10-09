// Démos 1 et 2 : menu Démo, chargement, sons tous présents, rendu sans écrêtage.
const peakOf = chans => { let p = 0; for (const c of chans) for (let i = 0; i < c.length; i += 3) p = Math.max(p, Math.abs(c[i])); return p; };
const missing = A => [...new Set(A.state.tl.tracks.flatMap(tr => tr.clips.map(c => c.sampleId)).filter(Boolean))].filter(id => !A.clipBuffer(id));

export default async function (t, A) {
  const S = A.state;
  t.$('#tl-demo').click();
  await t.wait(100);
  const picks = t.$$('.demo-pick');
  t.eq(picks.length, 5, 'le menu Démo propose 5 morceaux');
  t.eq(picks.map(b => b.dataset.demo), ['1', '2', '3', '4', '5'], 'dans l\'ordre');
  picks.find(b => b.dataset.demo === '2').click();
  t.ok(await t.until(() => S.tl.tracks.length === 15 && S.tl.bars === 64, 20000), 'démo 2 chargée (15 pistes, 64 mesures)');
  await t.wait(1500);
  t.eq(S.bpm, 190, 'démo 2 : 190 BPM');
  t.eq(missing(A), [], 'démo 2 : tous les sons sont là (prises 909 / 303 embarquées)');
  t.ok(S.userSounds.some(u => u.name === 'Kick Terror'), 'démo 2 : le kick du designer rejoint la bibliothèque');
  t.ok(/190/.test(t.$('#toast')?.textContent ?? ''), 'démo 2 : message de chargement', t.$('#toast')?.textContent);
  // Démo 2 : beaucoup de voix de synthé, son rendu hors ligne complet prend plusieurs minutes ; on l'écoute en direct
  // pendant le premier drop (le rendu hors ligne est vérifié sur les démos 1, 3, 4 et 5).
  const level = t.meter(A.engine.master);
  A.timeline.play(64);
  let p2 = 0;
  for (let k = 0; k < 40; k++) { await t.wait(50); p2 = Math.max(p2, level()); }
  A.timeline.stop();
  t.ok(p2 > 0.2 && p2 <= 1, 'démo 2 : le premier drop sonne, sans dépasser le niveau maximal', p2);

  t.$('#tl-demo').click();
  await t.wait(100);
  t.$('.demo-pick[data-demo="1"]').click();
  t.ok(await t.until(() => S.tl.bars === 50, 10000), 'démo 1 chargée (50 mesures)');
  await t.wait(500);
  t.eq(S.tl.tracks.length, 16, 'démo 1 : ses 16 pistes, même après un morceau de 15 pistes');
  t.eq(S.tl.tracks.reduce((n, tr) => n + tr.clips.length, 0), 38, 'démo 1 : ses 38 blocs');
  await t.until(() => !missing(A).length, 10000);
  t.eq(missing(A), [], 'démo 1 : tous les sons sont là');
  const p1 = peakOf(await A.renderSong());
  t.ok(p1 > 0.3 && Number.isFinite(p1), 'démo 1 : rendu audible', p1);
}
