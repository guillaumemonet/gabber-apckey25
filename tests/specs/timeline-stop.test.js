// Timeline : Stop coupe vraiment le son (coups de pad programmés d'avance, démo complète), la tête de lecture s'arrête.
export default async function (t, A) {
  const S = A.state;
  const peakAfter = async ms => { await t.wait(ms); let p = 0; for (let i = 0; i < 10; i++) { p = Math.max(p, A.masterPeak()); await t.wait(40); } return p; };
  // 1) Le même pad sur chaque temps de 8 mesures (comme après un enregistrement des pads).
  for (const tr of S.tl.tracks) { tr.clips = []; tr.fx = []; }
  const kickBank = S.banks.findIndex(b => b[0]?.buffer);
  const pad = S.banks[kickBank][0];
  for (let b = 0; b < 32; b++) S.tl.tracks[0].clips.push({ id: 'p' + b, type: 'pad', bank: kickBank, pad: 0, sampleId: pad.sampleId, name: 'kick', color: 1, cat: 'drums', start: b, len: 0.5, loop: false });
  S.tl.playhead = 0;
  A.tlToggle();
  const playing = await peakAfter(600);
  A.tlToggle();
  const afterStop = await peakAfter(700);
  t.ok(playing > 0.02, 'les coups de pad sonnent', playing);
  t.ok(afterStop < 0.01, 'plus rien après Stop (coups programmés coupés)', afterStop);
  t.ok(!A.timeline.playing, 'la timeline est arrêtée');
  t.eq(t.$('#tl-play').dataset.icon, 'play', 'le bouton repasse sur ▶');
  // 2) La démo : lecture puis arrêt, sans réverbe ni delay (leurs queues continuent normalement après l'arrêt).
  await A.loadDemo();
  for (const id of ['rSend', 'dSend']) { S.globals[id] = 0; A.engine.set(id, 0); }
  for (const ch of Object.values(S.mix.channels)) { ch.delay = 0; ch.reverb = 0; }
  S.tl.playhead = 16 * 4;
  A.tlToggle();
  const demoPlaying = await peakAfter(1500);
  A.tlToggle();
  const dryStop = await peakAfter(400);
  t.ok(demoPlaying > 0.05, 'la démo joue', demoPlaying);
  t.ok(dryStop < 0.05 && dryStop < demoPlaying * 0.3, 'la démo se tait à l\'arrêt', { demoPlaying, dryStop });
  const x = t.$('#tl-playhead').style.left;
  await t.wait(400);
  t.eq(t.$('#tl-playhead').style.left, x, 'la tête de lecture ne bouge plus');
}
