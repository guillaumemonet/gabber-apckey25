// Timeline : ajouter / retirer des pistes (annulable), potentiomètres d'une piste (volume, pano…) en direct et à l'export.
export default async function (t, A) {
  const S = A.state;
  const lanes = () => t.$$('#tl-grid .tl-lane').length;
  t.eq(S.tl.tracks.length, 16, '16 pistes au départ');
  t.eq(lanes(), 16, 'une ligne par piste');
  t.ok(/16/.test(t.$('#tl-tracks').textContent), 'le compteur affiche 16 pistes', t.$('#tl-tracks').textContent);
  t.eq(t.$$('.tl-knobs').length, 16, 'un bouton de potentiomètres par piste');
  // Ajouter deux pistes, retirer la dernière, annuler.
  t.$('#tl-tracks-more').click();
  t.$('#tl-tracks-more').click();
  t.eq(S.tl.tracks.length, 18, '+ ajoute des pistes');
  t.$('#tl-tracks-less').click();
  await t.wait(50);
  t.eq(S.tl.tracks.length, 17, '− retire la dernière piste');
  t.$('#tl-undo').click();
  await t.wait(100);
  t.eq(S.tl.tracks.length, 18, 'Annuler la remet');
  t.eq(lanes(), 18, 'et sa ligne aussi');
  // Potentiomètres de la piste 1 sur la démo, les autres pistes coupées.
  await A.loadDemo();
  for (const [i, tr] of S.tl.tracks.entries()) tr.mute = i !== 0;
  t.$$('.tl-knobs')[0].click();
  await t.wait(50);
  const box = t.$('.track-knobs');
  t.ok(box, 'le panneau de potentiomètres s\'ouvre');
  t.eq(box.querySelectorAll('.knob').length, 6, '6 potentiomètres : volume, pano, filtres, delay, réverbe');
  S.tl.playhead = 16;
  A.tlToggle();
  await t.wait(900);
  let p1 = 0; for (let i = 0; i < 10; i++) { p1 = Math.max(p1, A.masterPeak()); await t.wait(40); }
  const vol = box.querySelectorAll('.knob')[0];
  vol.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true }));
  t.ok(S.tl.tracks[0].vol < 1 && S.tl.tracks[0].vol > 0.8, 'la molette baisse le volume', S.tl.tracks[0].vol);
  t.ok(/%/.test(box.querySelectorAll('.value')[0].textContent), 'la valeur affichée suit', box.querySelectorAll('.value')[0].textContent);
  t.ok(t.$$('.tl-knobs')[0].classList.contains('active'), 'le bouton signale une piste réglée');
  S.tl.tracks[0].vol = 0;
  A.timeline.updateTrack(0);
  await t.wait(500);
  let p2 = 0; for (let i = 0; i < 10; i++) { p2 = Math.max(p2, A.masterPeak()); await t.wait(40); }
  A.tlToggle();
  t.ok(p1 > 0.02, 'la piste joue', p1);
  t.ok(p2 < p1 * 0.1, 'volume à zéro : la piste se tait en direct', { p1, p2 });
  // Export : la piste réglée tout à gauche sort à gauche.
  S.tl.tracks[0].vol = 1; S.tl.tracks[0].pan = -1; S.tl.tracks[0].rev = 0.5;
  S.tl.bars = 20;
  const chans = await A.renderSong();
  let l = 0, r = 0; for (let i = 0; i < chans[0].length; i += 7) { l += chans[0][i] ** 2; r += chans[1][i] ** 2; }
  t.ok(Math.sqrt(l) > Math.sqrt(r) * 3, 'pano à gauche respecté à l\'export', { l: Math.sqrt(l), r: Math.sqrt(r) });
}
