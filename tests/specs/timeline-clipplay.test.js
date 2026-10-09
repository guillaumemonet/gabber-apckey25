// Timeline : écouter un bloc seul (▶ au survol, double-clic), sans déranger le morceau ; double-clic sur un bloc
// de notes = piano roll, sur un bloc d'effet = réglages.
export default async function (t, A) {
  const S = A.state;
  const find = n => { for (const b of A.libManifest.banks) for (const p of b.pads) if (p && p.name === n) return p; };
  const p = find('Anthem lead');
  for (const tr of S.tl.tracks) { tr.clips = []; tr.fx = []; }
  S.tl.tracks[0].clips.push({ id: 'c1', start: 4, len: 8, sampleId: 'lib:' + p.file, name: 'Anthem', cat: 'lead', color: 49, bpm: 190, loop: true });
  S.tl.tracks[1].clips.push({ id: 'n1', type: 'note', start: 0, len: 4, pat: 4, seq: [{ t: 0, len: 1, note: 65, vel: 0.9 }, { t: 1, len: 1, note: 68, vel: 0.9 }], osc: 'hoover', name: 'Notes', cat: 'lead', color: 49 });
  A.tlPlaceFx({ fx: 'gate', p: { div: 16 }, len: 8, name: 'Gate' }, 0, 4);
  await A.ensureBuffer('lib:' + p.file);
  A.renderTl();
  const level = t.meter(A.mixer.input('tl'));
  const oscLevel = t.meter(A.oscSynth.out);
  const el = obj => t.$$('.tl-clip, .tl-fx').find(x => x._obj === obj);
  const dbl = async obj => { for (let k = 0; k < 2; k++) { t.press(el(obj), 20, 20); await t.wait(120); } };
  const clip = S.tl.tracks[0].clips[0];
  // Double-clic sur un bloc de son : écoute.
  await dbl(clip);
  await t.wait(400);
  t.eq(A.tlPrev?.clipId, 'c1', 'double-clic : le bloc s\'écoute');
  t.ok(level() > 0.02, 'on l\'entend', level());
  t.ok(el(clip).classList.contains('previewing') && el(clip).querySelector('.tl-prev-bar'), 'le bloc est surligné, une barre avance');
  t.eq(el(clip).querySelector('.tl-play')?.dataset.icon, 'stop', 'le bouton devient ■');
  t.ok(!A.timeline.playing, 'le morceau ne démarre pas');
  // ■ arrête l'écoute.
  el(clip).querySelector('.tl-play').click();
  await t.wait(400);
  t.eq(A.tlPrev, null, '■ arrête l\'écoute');
  t.ok(level() < 0.01, 'silence ensuite', level());
  // Écoute pendant que le morceau joue : l'arrêter ne coupe pas le morceau.
  A.timeline.play(0);
  await t.wait(300);
  el(clip).querySelector('.tl-play').click();
  await t.wait(300);
  el(clip).querySelector('.tl-play').click();
  await t.wait(200);
  t.ok(A.timeline.playing, 'le morceau continue après l\'écoute');
  A.timeline.stop();
  // Bloc de notes : double-clic = piano roll ; ▶ = écoute des notes, qui s'arrête seule à la fin du bloc.
  const note = S.tl.tracks[1].clips[0];
  await dbl(note);
  await t.wait(300);
  t.ok(A.wm.isOpen('roll'), 'double-clic sur un bloc de notes : piano roll');
  el(note).querySelector('.tl-play').click();
  await t.wait(300);
  t.ok(oscLevel() > 0.01, 'les notes s\'entendent', oscLevel());
  const ended = await t.until(() => A.tlPrev === null, 5000);
  t.ok(ended, 'l\'écoute s\'arrête seule à la fin du bloc');
  // Bloc d'effet : double-clic = réglages.
  await dbl(S.tl.tracks[0].fx[0]);
  await t.wait(200);
  t.ok(t.$('#fx-editor'), 'double-clic sur un bloc d\'effet : ses réglages');
  t.ok(/double-clic|double-click/.test(el(clip).title), 'l\'info-bulle du bloc explique le double-clic', el(clip).title);
}
